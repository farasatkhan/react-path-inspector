import { MESSAGE_SOURCE, type ResolveProjectRootResult, type ResolveProjectRootToMain } from '../definitions';

const MAX_CHUNK_FETCHES = 12;
const MAX_ABSOLUTE_SOURCES = 8;

let scanPromise: Promise<string[]> | null = null;

function absoluteFromSourcePath(source: string): string | null {
  let path = source;
  if (path.startsWith('file://')) {
    path = path.slice('file://'.length);
    try {
      path = decodeURIComponent(path);
    } catch {
      return null;
    }
  }
  if (!/^[A-Za-z]:[/\\]/.test(path) && !path.startsWith('/')) return null;
  return path.replace(/\\/g, '/');
}

function rootCandidates(absolute: string): string[] {
  const candidates: string[] = [];
  const nodeModules = absolute.indexOf('/node_modules/');
  if (nodeModules > 0) candidates.push(absolute.slice(0, nodeModules));
  const src = absolute.indexOf('/src/');
  if (src > 0) candidates.push(absolute.slice(0, src));
  const app = absolute.indexOf('/app/');
  if (app > 0) candidates.push(absolute.slice(0, app));
  return candidates;
}

function collectChunkScriptUrls(): string[] {
  const urls: string[] = [];
  for (const script of document.querySelectorAll('script[src]')) {
    const src = script.getAttribute('src');
    if (!src) continue;
    try {
      const url = new URL(src, location.origin);
      if (url.pathname.startsWith('/_next/static/chunks/') && url.pathname.endsWith('.js')) {
        urls.push(url.pathname);
      }
    } catch {
      // Ignore malformed script URLs.
    }
  }
  return urls;
}

function walkSources(map: unknown, out: string[]): void {
  if (out.length >= MAX_ABSOLUTE_SOURCES || !map || typeof map !== 'object') return;
  const sources = (map as { sources?: unknown }).sources;
  if (Array.isArray(sources)) {
    for (const source of sources) {
      if (out.length >= MAX_ABSOLUTE_SOURCES) return;
      if (typeof source !== 'string') continue;
      const absolute = absoluteFromSourcePath(source);
      if (absolute) out.push(absolute);
    }
  }
  const sections = (map as { sections?: unknown }).sections;
  if (Array.isArray(sections)) {
    for (const section of sections) {
      if (out.length >= MAX_ABSOLUTE_SOURCES) return;
      walkSources((section as { map?: unknown }).map, out);
    }
  }
}

async function fetchChunkAbsolutes(chunkPath: string): Promise<string[]> {
  const response = await fetch(chunkPath);
  if (!response.ok) return [];
  const body = await response.text();
  const mapRefs = body.match(/sourceMappingURL=([^\s*]+\.map)/g);
  if (!mapRefs || mapRefs.length === 0) return [];
  const mapRef = mapRefs[mapRefs.length - 1].slice('sourceMappingURL='.length);
  let mapUrl: URL;
  try {
    mapUrl = new URL(mapRef, new URL(chunkPath, location.origin).href);
  } catch {
    return [];
  }
  if (mapUrl.protocol !== 'http:' && mapUrl.protocol !== 'https:') return [];
  const mapResponse = await fetch(mapUrl.href);
  if (!mapResponse.ok) return [];
  let map: unknown;
  try {
    map = await mapResponse.json();
  } catch {
    return [];
  }
  const absolutes: string[] = [];
  walkSources(map, absolutes);
  return absolutes;
}

async function scanPageChunks(): Promise<string[]> {
  const chunkPaths = collectChunkScriptUrls().slice(0, MAX_CHUNK_FETCHES);
  const collected: string[] = [];
  for (const chunkPath of chunkPaths) {
    try {
      collected.push(...(await fetchChunkAbsolutes(chunkPath)));
    } catch {
      // Skip chunks that fail to load or parse.
    }
    if (collected.length >= MAX_ABSOLUTE_SOURCES) break;
  }
  return collected;
}

function pickRoot(requestId: number, relPath: string, absolutes: string[]): ResolveProjectRootResult {
  const rel = relPath.replace(/\\/g, '/').replace(/^\//, '').toLowerCase();
  if (rel) {
    const exact = absolutes.find((absolute) => absolute.toLowerCase().endsWith(`/${rel}`));
    if (exact) {
      const root = exact.slice(0, exact.length - rel.length - 1);
      return { source: MESSAGE_SOURCE, type: 'resolve-project-root-result', requestId, ok: true, root };
    }
  }
  const votes = new Map<string, number>();
  for (const absolute of absolutes) {
    for (const root of rootCandidates(absolute)) {
      votes.set(root, (votes.get(root) ?? 0) + 1);
    }
  }
  let bestRoot: string | null = null;
  let bestVotes = 0;
  for (const [root, count] of votes) {
    if (count > bestVotes) {
      bestRoot = root;
      bestVotes = count;
    }
  }
  if (!bestRoot) {
    return { source: MESSAGE_SOURCE, type: 'resolve-project-root-result', requestId, ok: false, reason: 'no-absolute-source' };
  }
  return { source: MESSAGE_SOURCE, type: 'resolve-project-root-result', requestId, ok: true, root: bestRoot };
}

export async function handleResolveProjectRoot(request: ResolveProjectRootToMain): Promise<ResolveProjectRootResult> {
  if (!scanPromise) scanPromise = scanPageChunks();
  const absolutes = await scanPromise;
  return pickRoot(request.requestId, request.relPath, absolutes);
}
