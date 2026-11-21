import { type InspectSource } from '../definitions';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const MAX_BUNDLE_CHARS = 2000000;
const MAX_MAPPINGS = 400000;

interface Mapping {
  generatedColumn: number;
  fileName: string | null;
  sourceLine: number;
  sourceColumn: number;
}

interface SourceMapData {
  mappings: Map<number, Mapping[]>;
  mapUrl: string;
}

type MapEntry = {
  promise: Promise<void>;
  data: SourceMapData | null;
};

const mapCache = new Map<string, MapEntry>();

function decodeVlq(segment: string): number[] {
  const values: number[] = [];
  let value = 0;
  let shift = 0;
  for (const char of segment) {
    const digit = BASE64_ALPHABET.indexOf(char);
    if (digit < 0) return values;
    value += (digit & 31) << shift;
    if ((digit & 32) === 0) {
      const negative = value & 1;
      value = value >>> 1;
      values.push(negative ? -value : value);
      value = 0;
      shift = 0;
    } else {
      shift += 5;
    }
  }
  return values;
}

function parseMappings(
  mappingsText: string,
  resolveSource: (sourceIndex: number) => string | null,
  byLine: Map<number, Mapping[]>,
  lineOffset: number,
  columnOffset: number,
): void {
  let sourceIndex = 0;
  let sourceLine = 0;
  let sourceColumn = 0;
  let total = 0;

  const lines = mappingsText.split(';');
  for (let groupIndex = 0; groupIndex < lines.length; groupIndex++) {
    const generatedLine = groupIndex + lineOffset;
    let generatedColumn = 0;
    for (const segment of lines[groupIndex].split(',')) {
      if (!segment) continue;
      const fields = decodeVlq(segment);
      generatedColumn += fields[0] ?? 0;
      if (fields.length >= 4) {
        sourceIndex += fields[1];
        sourceLine += fields[2];
        sourceColumn += fields[3];
        const fileName = resolveSource(sourceIndex);
        if (fileName) {
          const list = byLine.get(generatedLine) ?? [];
          list.push({
            generatedColumn: groupIndex === 0 ? generatedColumn + columnOffset : generatedColumn,
            fileName,
            sourceLine,
            sourceColumn,
          });
          byLine.set(generatedLine, list);
          total += 1;
          if (total > MAX_MAPPINGS) return;
        }
      }
    }
  }
}

function findSourceMapUrl(bundleUrl: string, bundleText: string): string | null {
  const match = /\/\/[#@]\s*sourceMappingURL\s*=\s*([^\s'"]+)/.exec(bundleText);
  if (!match) return null;
  try {
    return new URL(match[1], bundleUrl).href;
  } catch {
    return null;
  }
}

function normalizeSourcePath(source: string, sourceRoot: string, mapUrl: string, bundleUrl: string): string | null {
  if (!source) return null;
  let candidate = source;

  if (candidate.startsWith('webpack://')) {
    candidate = candidate.slice('webpack://'.length);
    const bangIndex = candidate.lastIndexOf('!');
    if (bangIndex >= 0) candidate = candidate.slice(bangIndex + 1);
    const dotSlash = candidate.indexOf('./');
    if (dotSlash >= 0) candidate = candidate.slice(dotSlash + 2);
    const queryIndex = candidate.indexOf('?');
    if (queryIndex >= 0) candidate = candidate.slice(0, queryIndex);
    return candidate.replace(/^\/+/, '').replace(/\\/g, '/');
  }

  if (candidate.startsWith('file://')) {
    try {
      const pathname = decodeURIComponent(new URL(candidate).pathname);
      return pathname.replace(/^\/(?=[a-zA-Z]:\/)/, '');
    } catch {
      return null;
    }
  }

  if (sourceRoot) {
    candidate = `${sourceRoot.replace(/\/+$/, '')}/${candidate}`;
  }

  if (candidate.startsWith('/')) {
    return candidate;
  }

  // Relative sources resolve against the map's location; inline maps travel
  // in data:/blob: URLs, which are not valid bases, so fall back to the
  // bundle itself (Vite emits bare filenames for its inline dev maps).
  for (const base of [mapUrl, bundleUrl]) {
    try {
      const resolved = new URL(candidate, base);
      if (resolved.protocol === 'http:' || resolved.protocol === 'https:' || resolved.protocol === 'file:') {
        return decodeURIComponent(resolved.pathname);
      }
    } catch {
      continue;
    }
  }
  return candidate;
}

function collectMappings(
  json: unknown,
  mapUrl: string,
  bundleUrl: string,
  byLine: Map<number, Mapping[]>,
  lineOffset: number,
  columnOffset: number,
  depth: number,
): void {
  if (!json || typeof json !== 'object' || depth > 3) return;
  const record = json as { sources?: unknown; sourceRoot?: unknown; mappings?: unknown; sections?: unknown };

  if (Array.isArray(record.sections)) {
    for (const section of record.sections) {
      const s = section as { offset?: { line?: unknown; column?: unknown }; map?: unknown };
      const line = typeof s.offset?.line === 'number' ? s.offset.line : 0;
      const column = typeof s.offset?.column === 'number' ? s.offset.column : 0;
      collectMappings(s.map, mapUrl, bundleUrl, byLine, lineOffset + line, columnOffset + column, depth + 1);
    }
    return;
  }

  if (!Array.isArray(record.sources) || typeof record.mappings !== 'string') return;
  const sources: unknown[] = record.sources;
  const sourceRoot = typeof record.sourceRoot === 'string' ? record.sourceRoot : '';
  parseMappings(
    record.mappings,
    (index) => {
      if (index < 0 || index >= sources.length) return null;
      const raw = sources[index];
      return typeof raw === 'string' ? normalizeSourcePath(raw, sourceRoot, mapUrl, bundleUrl) : null;
    },
    byLine,
    lineOffset,
    columnOffset,
  );
}

function parseSourceMap(json: unknown, mapUrl: string, bundleUrl: string): SourceMapData | null {
  const byLine = new Map<number, Mapping[]>();
  collectMappings(json, mapUrl, bundleUrl, byLine, 0, 0, 0);
  if (byLine.size === 0) return null;
  return { mappings: byLine, mapUrl };
}

async function loadEntry(bundleUrl: string, entry: MapEntry): Promise<void> {
  try {
    const response = await fetch(bundleUrl, { credentials: 'omit' });
    if (!response.ok) return;
    const text = await response.text();
    if (text.length > MAX_BUNDLE_CHARS) return;
    const mapUrl = findSourceMapUrl(bundleUrl, text);
    if (!mapUrl) return;
    const mapResponse = await fetch(mapUrl, { credentials: 'omit' });
    if (!mapResponse.ok) return;
    const mapJson: unknown = await mapResponse.json();
    entry.data = parseSourceMap(mapJson, mapUrl, bundleUrl);
  } catch {
    entry.data = null;
  }
}

function entryFor(bundleUrl: string): MapEntry {
  let entry = mapCache.get(bundleUrl);
  if (!entry) {
    entry = { promise: null as unknown as Promise<void>, data: null };
    entry.promise = loadEntry(bundleUrl, entry);
    mapCache.set(bundleUrl, entry);
  }
  return entry;
}

export function isSourceMapReady(bundleUrl: string): boolean {
  return mapCache.has(bundleUrl);
}

export function lookupOriginalSource(bundleUrl: string, line: number, column: number): InspectSource | null {
  const entry = mapCache.get(bundleUrl);
  if (!entry?.data) return null;
  const { data } = entry;
  const mappings = data.mappings.get(line - 1);
  if (!mappings || mappings.length === 0) return null;

  let best: Mapping | null = null;
  for (const mapping of mappings) {
    if (mapping.generatedColumn > column) break;
    best = mapping;
  }
  if (!best?.fileName) return null;
  return {
    fileName: best.fileName,
    line: best.sourceLine + 1,
    column: best.sourceColumn + 1,
  };
}

export function ensureSourceMap(bundleUrl: string): Promise<void> {
  return entryFor(bundleUrl).promise;
}

export async function resolveOriginalSource(bundleUrl: string, line: number, column: number): Promise<InspectSource | null> {
  await ensureSourceMap(bundleUrl);
  return lookupOriginalSource(bundleUrl, line, column);
}
