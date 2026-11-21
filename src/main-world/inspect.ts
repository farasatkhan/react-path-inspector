import { MESSAGE_SOURCE, type InspectMode, type InspectSource, type InspectTarget } from '../definitions';
import type { MinimalFiber } from '../definitions';
import { locateFiber } from './fiber';
import { fiberUnionRect, firstHostFiber } from './highlight';
import { ensureSourceMap, isSourceMapReady, lookupOriginalSource } from './sourcemap';
import { setLastContextTarget } from './session';

const MOSTLY_VIEWPORT_RATIO = 0.85;
const DEBUG_SOURCE_KEY = '_debugSource';
const JSX_RUNTIME_FRAME_HINTS = ['jsx-dev-runtime', 'jsx-runtime', 'react-stack-bottom-frame'];
const SOURCE_EXTENSION = /\.(tsx|ts|jsx|js|html|htm|mts|cts|mjs|cjs)$/i;
const TURBOPACK_CHUNK_PATTERN = /\/_next\/static\/chunks\/(.+)\._\.js$/;
const IMPLAUSIBLE_PATH_HINTS = ['/.next/', 'node_modules/next/', 'root-of-the-server', '/prerender/'];

interface StackFrame {
  url: string;
  path: string;
  line: number;
  column: number;
}

type FrameKind = 'direct' | 'user-chunk' | 'ssr' | 'other';

const SSR_FRAME_PREFIX = 'about://react/prerender';

function isPlausibleSourcePath(path: string): boolean {
  if (!path || path.includes('\\') || path.includes('%5c')) return false;
  const lowered = path.toLowerCase();
  if (IMPLAUSIBLE_PATH_HINTS.some((hint) => lowered.includes(hint))) return false;
  return SOURCE_EXTENSION.test(path.split('?')[0]);
}

function decodeChunkSourcePath(path: string): string | null {
  const match = TURBOPACK_CHUNK_PATTERN.exec(path);
  if (!match) return null;
  let name: string;
  try {
    name = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  const tokens = name.split('_');
  if (tokens.length < 2) return null;
  const segments = tokens.slice(0, -1);
  const extMatch = /^(.+_)?(tsx|ts|jsx|js|mts|cts|mjs|cjs)$/.exec(segments[segments.length - 1] ?? '');
  if (!extMatch) return null;
  const stem = extMatch[1] ? extMatch[1].slice(0, -1) : '';
  const lastIdx = segments.length - 1;
  if (stem) {
    segments[lastIdx] = `${stem}.${extMatch[2]}`;
  } else if (lastIdx > 0) {
    segments[lastIdx - 1] = `${segments[lastIdx - 1]}.${extMatch[2]}`;
    segments.pop();
  } else {
    segments[lastIdx] = `.${extMatch[2]}`;
  }
  const body = segments.join('/');
  const lowered = body.toLowerCase();
  if (lowered.includes('node_modules') || lowered.includes('next/dist')) return null;
  return body;
}

function frameKind(frame: StackFrame): FrameKind {
  if (pathIsDirectlyUsable(frame.path)) return 'direct';
  if (decodeChunkSourcePath(frame.path)) return 'user-chunk';
  if (frame.url.toLowerCase().startsWith(SSR_FRAME_PREFIX)) return 'ssr';
  return 'other';
}

interface InspectState {
  mode: InspectMode;
  hovered: Element | null;
  frame: number | null;
  listeners: Array<[EventTarget, string, EventListener]>;
}

let state: InspectState | null = null;

function postMessage(message: unknown): void {
  window.postMessage(message, window.location.origin);
}

function readDebugSource(fiber: MinimalFiber): InspectSource | null {
  const source = (fiber as unknown as Record<string, unknown>)[DEBUG_SOURCE_KEY] as
    | { fileName?: unknown; lineNumber?: unknown; columnNumber?: unknown }
    | undefined;
  if (!source || typeof source.fileName !== 'string' || source.fileName.length === 0) return null;
  return {
    fileName: source.fileName,
    line: typeof source.lineNumber === 'number' ? source.lineNumber : 1,
    column: typeof source.columnNumber === 'number' ? source.columnNumber : 1,
  };
}

function pathIsDirectlyUsable(path: string): boolean {
  if (!isPlausibleSourcePath(path)) return false;
  if (path.startsWith('/_next/')) return false;
  return true;
}

function parseStackFrame(body: string): StackFrame | null {
  const match = /(?:\(([^)]+)\)|((?:https?|file):\/\/\S+|[^\s()]+))[.:]?$/.exec(body);
  const location = (match && (match[1] || match[2])) || null;
  if (!location) return null;
  const parsed = /^(.+?):(\d+):(\d+)$/.exec(location);
  if (!parsed) return null;
  const [, url, lineText, columnText] = parsed;
  const path = stripOrigin(url);
  if (!path || !/\.[a-z]+/i.test(path.split('?')[0])) return null;
  return {
    url,
    path: path.split('?')[0],
    line: Number(lineText),
    column: Number(columnText),
  };
}

function stripOrigin(url: string): string {
  const slashIndex = url.indexOf('://');
  let path: string;
  if (slashIndex < 0) {
    path = url;
  } else {
    const afterProtocol = url.slice(slashIndex + 3);
    const firstSlash = afterProtocol.indexOf('/');
    path = firstSlash < 0 ? '/' : afterProtocol.slice(firstSlash);
  }
  return path.replace(/\/\.\//g, '/').replace(/\/{2,}/g, '/');
}

function stackFramesOf(fiber: MinimalFiber): StackFrame[] {
  const error = (fiber as unknown as { _debugStack?: { stack?: unknown } })._debugStack;
  const stack = error && typeof error.stack === 'string' ? error.stack : null;
  if (!stack) return [];

  const frames: StackFrame[] = [];
  for (const rawLine of stack.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('at ')) continue;
    const body = line.slice(3);
    const lower = body.toLowerCase();
    if (JSX_RUNTIME_FRAME_HINTS.some((hint) => lower.includes(hint))) continue;
    const frame = parseStackFrame(body);
    if (frame) frames.push(frame);
  }
  return frames;
}

function bestFrame(frames: StackFrame[]): StackFrame | null {
  if (frames.length === 0) return null;
  let ssr: StackFrame | null = null;
  for (const frame of frames) {
    const kind = frameKind(frame);
    if (kind === 'direct' || kind === 'user-chunk') return frame;
    if (kind === 'ssr' && !ssr) ssr = frame;
  }
  return ssr ?? frames[0];
}

function sourceFromFrame(frame: StackFrame): { source: InspectSource | null; resolved: boolean } {
  if (frameKind(frame) === 'ssr') {
    const cached = ssrResults.get(ssrCacheKey(frame));
    return { source: cached ?? null, resolved: Boolean(cached) };
  }
  if (isSourceMapReady(frame.url)) {
    const mapped = lookupOriginalSource(frame.url, frame.line, frame.column);
    if (mapped && isPlausibleSourcePath(mapped.fileName)) return { source: mapped, resolved: true };
  }
  if (pathIsDirectlyUsable(frame.path)) {
    return { source: { fileName: frame.path, line: frame.line, column: frame.column }, resolved: true };
  }
  const decoded = decodeChunkSourcePath(frame.path);
  if (decoded) {
    return { source: { fileName: decoded, line: 1, column: 1 }, resolved: false };
  }
  return { source: null, resolved: false };
}

const MAX_ANCESTOR_DEPTH = 40;
const sourceCache = new WeakMap<MinimalFiber, { source: InspectSource | null; frame: StackFrame | null; resolved: boolean }>();

function ownSource(fiber: MinimalFiber): { source: InspectSource | null; frame: StackFrame | null; kind: FrameKind; resolved: boolean } {
  const direct = readDebugSource(fiber);
  if (direct) return { source: direct, frame: null, kind: 'direct', resolved: true };
  const frame = bestFrame(stackFramesOf(fiber));
  const outcome = frame ? sourceFromFrame(frame) : { source: null, resolved: false };
  return {
    source: outcome.source,
    frame,
    kind: frame ? frameKind(frame) : 'other',
    resolved: outcome.resolved,
  };
}

const KIND_PRIORITY: Record<FrameKind, number> = { direct: 0, 'user-chunk': 1, ssr: 2, other: 3 };

function sourceOf(fiber: MinimalFiber | null): { source: InspectSource | null; frame: StackFrame | null; resolved: boolean } {
  if (!fiber) return { source: null, frame: null, resolved: false };

  const cached = sourceCache.get(fiber);
  if (cached) return cached;

  let best: { source: InspectSource | null; frame: StackFrame | null; kind: FrameKind; resolved: boolean } | null = null;
  let current: MinimalFiber | null = fiber;
  for (let depth = 0; current && depth < MAX_ANCESTOR_DEPTH; depth++) {
    const candidate = ownSource(current);
    if (candidate.source && candidate.resolved) {
      sourceCache.set(fiber, candidate);
      return candidate;
    }
    if (candidate.frame && (!best || KIND_PRIORITY[candidate.kind] < KIND_PRIORITY[best.kind])) {
      best = candidate;
    }
    if (best && best.kind !== 'other') break;
    current = current.return as MinimalFiber | null;
  }

  if (!best) return { source: null, frame: null, resolved: false };
  return { source: best.source, frame: best.frame, resolved: best.resolved };
}

const ssrCache = new Map<string, Promise<InspectSource | null>>();
const ssrResults = new Map<string, InspectSource | null>();

function ssrCacheKey(frame: StackFrame): string {
  return `${frame.url}|${frame.line}|${frame.column}`;
}

async function resolveSsrFrame(frame: StackFrame): Promise<InspectSource | null> {
  const cacheKey = ssrCacheKey(frame);
  let pending = ssrCache.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      const response = await fetch('/__nextjs_original-stack-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frames: [{ file: frame.url, methodName: '', line1: frame.line, column1: frame.column }],
          isServer: true,
          isEdgeServer: false,
          isAppDirectory: true,
        }),
      });
      if (!response.ok) return null;
      const json = (await response.json()) as Array<{ value?: { originalStackFrame?: { file?: unknown; line1?: unknown; column1?: unknown; ignored?: unknown } | null; reason?: string } | { reason: string } }>;
      const first = json[0];
      const value = first && 'value' in first ? first.value : null;
      const osf = value && 'originalStackFrame' in value ? value.originalStackFrame ?? null : null;
      if (!osf || typeof osf.file !== 'string' || osf.ignored === true) return null;
      const line = typeof osf.line1 === 'number' ? osf.line1 : null;
      const column = typeof osf.column1 === 'number' ? osf.column1 : null;
      const fileName = osf.file.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
      if (!isPlausibleSourcePath(fileName)) return null;
      const source: InspectSource = {
        fileName,
        line: line !== null && line >= 1 ? line : 1,
        column: column !== null && column >= 1 ? column : 1,
      };
      ssrResults.set(cacheKey, source);
      return source;
    })();
    ssrCache.set(cacheKey, pending);
  }
  return pending;
}

function prefetchSourceMap(frame: StackFrame | null, hovered: Element): void {
  if (!frame) return;
  if (frameKind(frame) === 'ssr') {
    void resolveSsrFrame(frame).then(() => {
      if (state?.hovered === hovered) scheduleHover();
    });
    return;
  }
  if (isSourceMapReady(frame.url)) return;
  void ensureSourceMap(frame.url).then(() => {
    if (state?.hovered === hovered) scheduleHover();
  });
}

async function resolveFrameSource(frame: StackFrame): Promise<InspectSource | null> {
  if (frameKind(frame) === 'ssr') {
    return resolveSsrFrame(frame);
  }
  await ensureSourceMap(frame.url);
  return sourceFromFrame(frame).source;
}

function isComponentFiber(fiber: MinimalFiber): boolean {
  return typeof fiber.type === 'function';
}

function rectIsMostlyViewport(rect: { width: number; height: number }): boolean {
  const viewportArea = window.innerWidth * window.innerHeight;
  return rect.width * rect.height > MOSTLY_VIEWPORT_RATIO * viewportArea;
}

function rectForElement(element: Element): { x: number; y: number; width: number; height: number } {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + window.scrollX,
    y: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height,
  };
}

function ownerTargetFor(fiber: MinimalFiber): MinimalFiber | null {
  let current = fiber.return as MinimalFiber | null;
  while (current) {
    if (isComponentFiber(current)) return current;
    current = current.return as MinimalFiber | null;
  }
  return null;
}

interface TargetInfo {
  target: InspectTarget | null;
  frame: StackFrame | null;
}

function elementTargetInfo(element: Element, fiber: MinimalFiber | null): TargetInfo {
  const rect = rectForElement(element);
  if (rect.width === 0 && rect.height === 0) return { target: null, frame: null };
  const { source, frame } = sourceOf(fiber);
  return {
    target: { rect, source, borderOnly: rectIsMostlyViewport(rect) },
    frame,
  };
}

function ownerTargetInfo(fiber: MinimalFiber | null): TargetInfo {
  const owner = fiber ? ownerTargetFor(fiber) : null;
  if (!owner) return { target: null, frame: null };
  const ownerRect = fiberUnionRect(owner);
  if (!ownerRect || ownerRect.width <= 0 || ownerRect.height <= 0) return { target: null, frame: null };
  const { source, frame } = sourceOf(firstHostFiber(owner) ?? owner);
  return {
    target: { rect: ownerRect, source, borderOnly: rectIsMostlyViewport(ownerRect) },
    frame,
  };
}

function rectsMatch(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return (
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

let lastHoverSignature = '';

function emitHover(): void {
  if (!state) return;
  state.frame = null;
  const hovered = state.hovered;
  if (!hovered || !hovered.isConnected) {
    if (lastHoverSignature !== 'cleared') {
      lastHoverSignature = 'cleared';
      postMessage({ source: MESSAGE_SOURCE, type: 'inspect-hover', element: null, owner: null });
    }
    return;
  }

  const located = locateFiber(hovered);
  const elementInfo = elementTargetInfo(hovered, located ? located.fiber : null);
  const ownerInfo = ownerTargetInfo(located ? located.fiber : null);
  if (ownerInfo.target && elementInfo.target && rectsMatch(ownerInfo.target.rect, elementInfo.target.rect)) {
    ownerInfo.target = null;
    ownerInfo.frame = null;
  }

  prefetchSourceMap(elementInfo.frame, hovered);
  prefetchSourceMap(ownerInfo.frame, hovered);

  const signature = JSON.stringify([elementInfo.target, ownerInfo.target]);
  if (signature === lastHoverSignature) return;
  lastHoverSignature = signature;

  postMessage({
    source: MESSAGE_SOURCE,
    type: 'inspect-hover',
    element: elementInfo.target,
    owner: ownerInfo.target,
  });
}

function scheduleHover(): void {
  if (!state || state.frame !== null) return;
  let called = false;
  const run = () => {
    if (called) return;
    called = true;
    if (state) state.frame = null;
    emitHover();
  };
  state.frame = window.requestAnimationFrame(run);
  window.setTimeout(run, 60);
}

function onMouseMove(event: Event): void {
  if (!state) return;
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  if (target === state.hovered) return;
  state.hovered = target;
  scheduleHover();
}

function onScroll(): void {
  if (!state?.hovered) return;
  scheduleHover();
}

function onClick(event: MouseEvent): void {
  if (!state) return;
  event.preventDefault();
  event.stopPropagation();

  const element = event.target instanceof Element ? event.target : state.hovered;
  if (!element) return;
  const mode = state.mode;
  state.hovered = element;
  const located = locateFiber(element);
  setLastContextTarget(element);

  void (async () => {
    const { source, frame, resolved } = sourceOf(located ? located.fiber : null);
    let finalSource = source;
    if (frame && (!resolved || !finalSource)) {
      const better = await resolveFrameSource(frame);
      if (better) finalSource = better;
    }
    postMessage({
      source: MESSAGE_SOURCE,
      type: 'inspect-click',
      mode,
      hasFiber: Boolean(located),
      sourceInfo: finalSource,
    });
  })();
}

function onKeyDown(event: KeyboardEvent): void {
  if (!state) return;
  if (event.key !== 'Escape') return;
  event.preventDefault();
  event.stopPropagation();
  stopInspect();
}

function addListener(target: EventTarget, type: string, handler: EventListener, capture = false): void {
  target.addEventListener(type, handler, capture);
  state?.listeners.push([target, type, handler]);
}

export function startInspect(mode: InspectMode): void {
  stopInspect(false);
  lastHoverSignature = 'cleared';
  state = { mode, hovered: null, frame: null, listeners: [] };
  addListener(document, 'mousemove', onMouseMove, true);
  addListener(document, 'mousedown', (event) => event.stopPropagation(), true);
  addListener(document, 'click', onClick as EventListener, true);
  addListener(window, 'keydown', onKeyDown, true);
  addListener(window, 'scroll', onScroll, true);
}

export function stopInspect(notify = true): void {
  if (!state) return;
  if (state.frame !== null) window.cancelAnimationFrame(state.frame);
  for (const [target, type, handler] of state.listeners) {
    target.removeEventListener(type, handler, true);
  }
  state = null;
  if (notify) {
    postMessage({ source: MESSAGE_SOURCE, type: 'inspect-stopped' });
  }
}
