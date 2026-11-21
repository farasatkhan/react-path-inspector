
export const NEXT_INTERNAL_DENYLIST = [
  'OuterLayoutRouter',
  'InnerLayoutRouter',
  'RedirectBoundary',
  'RedirectErrorBoundary',
  'HTTPAccessFallbackBoundary',
  'HTTPAccessFallbackErrorBoundary',
  'DevRootHTTPAccessFallbackBoundary',
  'LoadingBoundary',
  'LoadingBoundaryProvider',
  'ClientPageRoot',
  'SegmentViewNode',
  'SegmentStateProvider',
  'RenderFromTemplateContext',
  'TemplateContext',
  'ScrollHandler',
  'InnerScrollHandler',
  'ServerRoot',
  'AppRouter',
  'Router',
  'Root',
  'RootErrorBoundary',
  'ErrorBoundaryHandler',
  'AppDevOverlayErrorBoundary',
  'HotReload',
] as const;

const NEXT_INTERNAL_PREFIXES = ['__next'] as const;

import { type FilteredPath, type RawPathEntry } from '../definitions';

export function filterPath(entries: RawPathEntry[]): FilteredPath {
  const result: FilteredPath = {
    components: [],
    componentIndices: [],
    clickedHost: null,
    contextProviderCount: 0,
    dropped: [],
  };

  const denylist: readonly string[] = NEXT_INTERNAL_DENYLIST;
  const prefixes: readonly string[] = NEXT_INTERNAL_PREFIXES;

  entries.forEach((entry, index) => {
    if (index === entries.length - 1) {
      result.clickedHost = entry;
      return;
    }

    if (entry.kind === 'provider') {
      result.contextProviderCount += 1;
      result.dropped.push(entry);
      return;
    }

    if (entry.nextInternal) {
      result.dropped.push(entry);
      return;
    }

    if (denylist.includes(entry.name) || prefixes.some((p) => entry.name.startsWith(p))) {
      result.dropped.push(entry);
      return;
    }

    if (entry.kind !== 'named-component' && entry.kind !== 'server-component' && entry.kind !== 'suspense') {
      result.dropped.push(entry);
      return;
    }

    result.components.push(entry.name);
    result.componentIndices.push(index);
  });

  return result;
}

export function minificationWarning(names: readonly string[]): string | null {
  if (names.length < 4) return null;
  const shortCount = names.filter((name) => name.length > 0 && name.length <= 2).length;
  if (shortCount / names.length <= 0.5) return null;
  return '[warning: component names look minified. This is likely a production build]';
}
