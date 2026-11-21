
import { nameFromType } from '../core/names';
import { type LocatedFiber, type MinimalFiber, type PathNode, type RawPath, type RawPathEntry, type ServerEntry } from '../definitions';

export const WorkTag = {
  FunctionComponent: 0,
  ClassComponent: 1,
  IndeterminateComponent: 2,
  HostRoot: 3,
  HostComponent: 5,
  ContextConsumer: 9,
  ContextProvider: 10,
  IncompleteClassComponent: 16,
} as const;

const FIBER_KEY_PREFIX = '__reactFiber$';

function fiberFromElement(element: Element): MinimalFiber | null {
  for (const key of Object.keys(element)) {
    if (key.startsWith(FIBER_KEY_PREFIX)) {
      return (element as unknown as Record<string, MinimalFiber>)[key];
    }
  }
  return null;
}

export function locateFiber(element: Element): LocatedFiber | null {
  let current: Element | null = element;
  let distance = 0;
  while (current) {
    const fiber = fiberFromElement(current);
    if (fiber) return { fiber, domDistance: distance };
    current = current.parentElement;
    distance += 1;
  }
  return null;
}

function findHostRoot(fiber: MinimalFiber): MinimalFiber | null {
  let current: MinimalFiber | null = fiber;
  while (current) {
    if (current.tag === WorkTag.HostRoot) return current;
    current = current.return;
  }
  return null;
}

function resolveCurrentChain(fiber: MinimalFiber): MinimalFiber {
  const hostRoot = findHostRoot(fiber);
  const fiberRoot = hostRoot?.stateNode as { current?: MinimalFiber } | null;
  if (fiberRoot?.current && fiberRoot.current !== hostRoot) {
    return fiber.alternate ?? fiber;
  }
  return fiber;
}

export function buildRawPath(located: LocatedFiber): RawPath {
  const fiber = resolveCurrentChain(located.fiber);
  const leafToRoot: PathNode[] = [];
  const seenServerNames = new Set<string>();
  let current: MinimalFiber | null = fiber;
  while (current && current.tag !== WorkTag.HostRoot) {
    leafToRoot.push({ entry: classify(current), fiber: current });
    const serverEntries = collectServerEntries(current);
    for (let i = serverEntries.length - 1; i >= 0; i--) {
      const server = serverEntries[i];
      if (seenServerNames.has(server.name)) continue;
      seenServerNames.add(server.name);
      leafToRoot.push({
        entry: { name: server.name, kind: 'server-component', props: server.props },
        fiber: null,
      });
    }
    current = current.return;
  }
  return { nodes: leafToRoot.reverse() };
}

function collectServerEntries(fiber: MinimalFiber): ServerEntry[] {
  const debugInfo = (fiber as { _debugInfo?: unknown })._debugInfo;
  if (!Array.isArray(debugInfo)) return [];
  const entries: ServerEntry[] = [];
  for (const entry of debugInfo) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as { name?: unknown; env?: unknown; props?: unknown };
    if (typeof record.name !== 'string' || record.name.length === 0) continue;
    if (typeof record.env !== 'string' || record.env === 'client') continue;
    entries.push({ name: record.name, props: record.props });
  }
  return entries;
}

function classify(fiber: MinimalFiber): RawPathEntry {
  const type = fiber.type;

  if (typeof type === 'string') return { name: type, kind: 'host' };

  if (typeof type === 'symbol') {
    if (symbolIs(type, 'react.suspense')) {
      return { name: 'Suspense', kind: 'suspense' };
    }
    if (symbolIs(type, 'react.fragment')) return { name: '', kind: 'fragment' };
    if (symbolIs(type, 'react.strict_mode')) return { name: '', kind: 'strict-mode' };
    if (symbolIs(type, 'react.profiler')) return { name: '', kind: 'profiler' };
  }

  if (type === null || type === undefined) {
    if (fiber.tag === 13 || fiber.tag === 17) return { name: 'Suspense', kind: 'suspense' };
    if (fiber.tag === 7) return { name: '', kind: 'fragment' };
  }

  const $$typeof = typeSymbol(type);
  if ($$typeof !== undefined) {
    if (symbolIs($$typeof, 'react.suspense')) return { name: 'Suspense', kind: 'suspense' };
    if (symbolIs($$typeof, 'react.fragment')) return { name: '', kind: 'fragment' };
    if (symbolIs($$typeof, 'react.strict_mode')) return { name: '', kind: 'strict-mode' };
    if (symbolIs($$typeof, 'react.consumer')) return { name: '', kind: 'consumer' };
    if (symbolIs($$typeof, 'react.provider') || symbolIs($$typeof, 'react.context')) {
      const displayName = (type as { displayName?: unknown }).displayName;
      const name = typeof displayName === 'string' ? displayName : '';
      return {
        name,
        kind: fiber.tag === WorkTag.ContextConsumer ? 'consumer' : 'provider',
      };
    }
  }

  const name = nameFromType(type);
  if (name === 'ErrorBoundary' && hasNextErrorBoundarySignature(fiber)) {
    return { name, kind: 'named-component', nextInternal: true };
  }
  return { name, kind: name ? 'named-component' : 'anonymous' };
}

function hasNextErrorBoundarySignature(fiber: MinimalFiber): boolean {
  try {
    const props = fiber.memoizedProps as Record<string, unknown> | null | undefined;
    if (!props || typeof props !== 'object') return false;
    return 'errorComponent' in props && 'errorStyles' in props;
  } catch {
    return false;
  }
}

function typeSymbol(type: unknown): symbol | undefined {
  const $$typeof = (type as { $$typeof?: unknown } | null | undefined)?.$$typeof;
  return typeof $$typeof === 'symbol' ? $$typeof : undefined;
}

function symbolIs(symbol: symbol, description: string): boolean {
  return typeof Symbol === 'function' && symbol === Symbol.for(description);
}

export function isClassComponent(fiber: MinimalFiber): boolean {
  const type = fiber.type as { prototype?: { isReactComponent?: unknown } } | null;
  return (
    fiber.tag === WorkTag.ClassComponent ||
    fiber.tag === WorkTag.IncompleteClassComponent ||
    (typeof type?.prototype?.isReactComponent === 'object' && type.prototype.isReactComponent !== null)
  );
}
