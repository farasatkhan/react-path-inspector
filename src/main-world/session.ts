import { applyBudget } from '../core/budget';
import { filterPath, minificationWarning } from '../core/filter';
import { formatJson } from '../core/format-json';
import { formatMarkdown } from '../core/format-md';
import { nodeToKeysBlock, nodeToMarkdownBlock } from '../core/output';
import {
  DEFAULT_CONTEXT,
  serializeJsonSafe,
  serializeProps,
  serializeServerProps,
  serializeValue,
} from '../core/serialize';
import {
  MESSAGE_SOURCE,
  type BudgetBlock,
  type CopyNodeResult,
  type CopyPropsResult,
  type CopyPropsToMain,
  type CopyPathResult,
  type CopyPathToMain,
  type DebugFiberInfoResult,
  type FilteredPath,
  type HighlightResult,
  type InternalOutput,
  type MinimalFiber,
  type OpenPathBarResult,
  type OpenPathBarToMain,
  type OutputFormat,
  type OutputNode,
  type PathBarChip,
  type PathNode,
  type PropsPreviewResult,
  type RawPathEntry,
  type RunOptions,
  type SerializeContext,
} from '../definitions';
import { buildRawPath, isClassComponent, locateFiber } from './fiber';
import { computeHighlight } from './highlight';
import { describeElement, describeElementJson } from './element';
import { reactVersion } from './version';

const LOG_PREFIX = '[React Path Inspector]';
const REMOVED_NOTE =
  '[note: element was removed from the page before copy; showing the last known state]';

export let lastContextTarget: Element | null = null;

export function setLastContextTarget(element: Element | null): void {
  lastContextTarget = element;
}

window.addEventListener(
  'contextmenu',
  (event) => {
    lastContextTarget = event.target instanceof Element ? event.target : null;
  },
  true,
);

function contextFromOptions(options: RunOptions): SerializeContext {
  return {
    limits: {
      maxDepth: options.maxDepth,
      maxStringChars: options.maxStringChars,
      maxItems: options.maxItems,
    },
    redact: {
      extraKeys: options.extraRedactKeys,
      disabledKeys: options.disabledRedactKeys,
      redactPersonalData: options.redactPersonalData,
    },
  };
}

function filterEverything(nodes: PathNode[]): FilteredPath {
  const components: string[] = [];
  const componentIndices: number[] = [];
  nodes.forEach((node, index) => {
    if (index === nodes.length - 1) return;
    components.push(node.entry.name || `(${node.entry.kind})`);
    componentIndices.push(index);
  });
  return {
    components,
    componentIndices,
    clickedHost: nodes.length > 0 ? nodes[nodes.length - 1].entry : null,
    contextProviderCount: 0,
    dropped: [],
  };
}

function classStateText(fiber: MinimalFiber, context: SerializeContext): string | null {
  if (!isClassComponent(fiber)) return null;
  try {
    return `  state: ${serializeValue(fiber.memoizedState, context, new WeakSet(), 0)}`;
  } catch {
    return '  state: [Error reading prop]';
  }
}

function buildInternalOutput(
  element: Element,
  options: RunOptions,
  selectedComponentIndex: number,
  note: string,
): InternalOutput | null {
  const located = locateFiber(element);
  if (!located) return null;
  const context = contextFromOptions(options);

  const { nodes } = buildRawPath(located);
  const filtered = options.showEverything
    ? filterEverything(nodes)
    : filterPath(nodes.map((node) => node.entry));

  const outputNodes: OutputNode[] = filtered.componentIndices.map((entryIndex, position) => {
    const { entry, fiber } = nodes[entryIndex];
    const name = filtered.components[position];
    const selected = position === selectedComponentIndex;

    if (entry.kind === 'server-component') {
      const hasProps = entry.props !== undefined;
      const serverContext: SerializeContext = { ...context, limits: { ...context.limits, maxDepth: 1 } };
      return {
        name,
        boundary: 'server',
        selected,
        propsText: hasProps ? serializeServerProps(entry.props as object, context) : null,
        propsJson: hasProps ? serializeJsonSafe(entry.props, serverContext) : null,
        propsNote: hasProps ? null : '[not available on client]',
        propsKeys: hasProps ? Object.keys(entry.props as object) : [],
        stateText: null,
        stateJson: null,
      };
    }

    let propsText: string | null = null;
    let propsJson: unknown = null;
    let propsKeys: string[] = [];
    let propsNote: string | null = null;
    try {
      const props = fiber?.memoizedProps;
      propsText = serializeProps(props, context);
      propsJson = serializeJsonSafe(props, context);
      propsKeys = Object.keys((props as object) ?? {});
    } catch {
      propsText = '[Error reading prop]';
      propsNote = '[Error reading prop]';
    }

    let stateText: string | null = null;
    let stateJson: unknown = null;
    if (fiber) {
      stateText = classStateText(fiber, context);
      if (stateText && fiber.memoizedState !== undefined) {
        try {
          stateJson = serializeJsonSafe(fiber.memoizedState, context);
        } catch {
          stateJson = null;
        }
      }
    }

    return { name, boundary: 'client', selected, propsText, propsJson, propsNote, propsKeys, stateText, stateJson };
  });

  const warnings: string[] = [];
  const minified = minificationWarning(filtered.components);
  if (minified) warnings.push(minified);

  return {
    from: `${location.host}${location.pathname}`,
    route: location.pathname,
    reactVersion: reactVersion(),
    note: note.trim().length > 0 ? note.trim() : null,
    pathSummary: [...filtered.components, filtered.clickedHost?.name ?? '']
      .filter((name) => name.length > 0)
      .join(' → '),
    nodes: outputNodes,
    clickedElementMarkdown: `Clicked element:\n${describeElement(element)}`,
    clickedElementJson: describeElementJson(element),
    providersLine: providersLineFor(nodes.map((node) => node.entry)),
    trimmedCount: 0,
    warnings,
  };
}

function providersLineFor(rawEntries: RawPathEntry[]): string | null {
  const filtered = filterPath(rawEntries);
  if (filtered.contextProviderCount === 0) return null;

  const named = new Map<string, number>();
  let unnamed = 0;
  for (const dropped of filtered.dropped) {
    if (dropped.kind !== 'provider') continue;
    if (dropped.name) named.set(dropped.name, (named.get(dropped.name) ?? 0) + 1);
    else unnamed += 1;
  }

  const parts: string[] = [];
  const shown = [...named.entries()].slice(0, 5);
  for (const [name, count] of shown) {
    parts.push(count > 1 ? `${name} ×${count}` : name);
  }
  const hiddenEntries = [...named.entries()].slice(5);
  if (hiddenEntries.length > 0) {
    const hiddenCount = hiddenEntries.reduce((sum, [, count]) => sum + count, 0);
    parts.push(`+${hiddenCount} more named`);
  }
  if (unnamed > 0) parts.push(`${unnamed} unnamed`);

  const detail = parts.length > 0 ? `: ${parts.join(', ')}` : '';
  return `Context providers between these nodes: ${filtered.contextProviderCount} (omitted${detail})`;
}

function truncateOutput(
  output: InternalOutput,
  chipIndex: number,
  rawNodes: PathNode[],
  chipNodeIndices: number[],
  showEverything: boolean,
): InternalOutput {
  const nodes = output.nodes
    .slice(0, chipIndex + 1)
    .map((node, index) => ({ ...node, selected: index === chipIndex }));

  let providersLine: string | null = null;
  if (!showEverything) {
    const nodePosition = chipNodeIndices[chipIndex] ?? -1;
    if (nodePosition >= 0) {
      providersLine = providersLineFor(
        rawNodes.slice(0, nodePosition + 1).map((node) => node.entry),
      );
    }
  }

  const isNearest = chipIndex === output.nodes.length - 1;
  const minified = minificationWarning(nodes.map((node) => node.name));

  return {
    ...output,
    nodes,
    pathSummary: nodes.map((node) => node.name).join(' → '),
    providersLine,
    clickedElementMarkdown: isNearest ? output.clickedElementMarkdown : null,
    clickedElementJson: isNearest ? output.clickedElementJson : null,
    warnings: minified ? [minified] : [],
  };
}

function formatOutput(
  output: InternalOutput,
  format: 'markdown' | 'json',
  options: RunOptions,
  markdownSuffix: string | null,
): string {
  const blocks: BudgetBlock[] = output.nodes.map((node) => ({
    text: nodeToMarkdownBlock(node, node.selected),
    keysText: nodeToKeysBlock(node),
  }));
  const budget = applyBudget(blocks, options.budgetChars);
  const withTrim: InternalOutput = { ...output, trimmedCount: budget.trimmedCount };

  if (format === 'json') {
    const reduced = new Set(budget.reducedIndices);
    const jsonWithReductions = reduced.size
      ? {
          ...withTrim,
          nodes: withTrim.nodes.map((node, index) =>
            reduced.has(index)
              ? { ...node, propsJson: null, propsNote: '[reduced to prop keys to fit budget]' }
              : node,
          ),
        }
      : withTrim;
    if (markdownSuffix) {
      jsonWithReductions.warnings = [...jsonWithReductions.warnings, markdownSuffix];
    }
    return formatJson(jsonWithReductions);
  }

  return formatMarkdown(
    {
      headerEnabled: options.headerEnabled,
      from: withTrim.from,
      reactVersion: withTrim.reactVersion,
      note: withTrim.note,
      route: withTrim.route,
      pathSummary: withTrim.pathSummary,
      blocks: budget.blocks,
      clickedElementMarkdown: withTrim.clickedElementMarkdown,
      providersLine: withTrim.providersLine,
      trimmedCount: withTrim.trimmedCount,
      budgetChars: options.budgetChars,
      warnings: markdownSuffix ? [...withTrim.warnings, markdownSuffix] : withTrim.warnings,
    },
  );
}

function chipsFromOutput(output: InternalOutput): PathBarChip[] {
  return output.nodes.map((node, index) => ({
    index,
    name: node.name,
    server: node.boundary === 'server',
  }));
}

interface PathSession {
  element: Element;
  captured: InternalOutput;
  rawNodes: PathNode[];
  chipNodeIndices: number[];
}

let session: PathSession | null = null;

function optionsToChipNodeIndices(
  _output: InternalOutput,
  rawNodes: PathNode[],
  options: RunOptions,
): number[] {
  if (options.showEverything) {
    return rawNodes.slice(0, Math.max(0, rawNodes.length - 1)).map((_, index) => index);
  }
  const filtered = filterPath(rawNodes.map((node) => node.entry));
  return filtered.componentIndices;
}

function logFiberDebugInfo(element: Element): boolean {
  const located = locateFiber(element);
  if (!located) return false;

  const { nodes } = buildRawPath(located);
  console.info(
    `${LOG_PREFIX} raw unfiltered path (${nodes.length} fibers, root → clicked):\n` +
      nodes.map((node) => `  ${node.entry.name || `(${node.entry.kind})`}`).join(' → '),
  );

  let withDebugInfo = 0;
  const envs = new Set<string>();

  nodes.forEach((node, index) => {
    if (!node.fiber) return;
    const label = `${LOG_PREFIX} ${index + 1}/${nodes.length} ${
      node.entry.name || `(unnamed ${node.entry.kind})`
    } [tag ${node.fiber.tag}]`;

    const debugInfo = (node.fiber as { _debugInfo?: unknown })._debugInfo;
    if (!Array.isArray(debugInfo) || debugInfo.length === 0) {
      console.info(`${label}: no _debugInfo`);
      return;
    }

    withDebugInfo += 1;
    for (const entry of debugInfo) {
      const env = (entry as { env?: unknown } | null)?.env;
      if (typeof env === 'string') envs.add(env);
    }
    console.info(`${label} _debugInfo:`, debugInfo);
    try {
      console.info(`${label} memoizedProps:`, node.fiber.memoizedProps);
    } catch {
      console.info(`${label} memoizedProps: [error reading]`);
    }
  });

  console.info(
    `${LOG_PREFIX} summary: ${withDebugInfo}/${nodes.length} fibers have _debugInfo; ` +
      `envs seen: ${envs.size > 0 ? [...envs].join(', ') : 'none'}`,
  );
  return true;
}

export function handleCopyPath(request: CopyPathToMain): CopyPathResult {
  const output = lastContextTarget
    ? buildInternalOutput(lastContextTarget, request.options, -1, '')
    : null;
  if (output && request.options.debugLogging && lastContextTarget) {
    logFiberDebugInfo(lastContextTarget);
  }
  if (output && output.nodes.length > 0) {
    const nearest = output.nodes.length - 1;
    output.nodes[nearest].selected = true;
    return {
      source: MESSAGE_SOURCE,
      type: 'copy-path-result',
      requestId: request.requestId,
      ok: true,
      path: formatOutput(output, request.format, request.options, null),
      arrow: output.pathSummary,
      warning: output.warnings[0] ?? null,
    };
  }
  return {
    source: MESSAGE_SOURCE,
    type: 'copy-path-result',
    requestId: request.requestId,
    ok: false,
    reason: 'no-fiber',
  };
}

export function handleDebugFiberInfo(requestId: number): DebugFiberInfoResult {
  const logged = lastContextTarget ? logFiberDebugInfo(lastContextTarget) : false;
  return logged
    ? { source: MESSAGE_SOURCE, type: 'debug-fiber-info-result', requestId, ok: true }
    : { source: MESSAGE_SOURCE, type: 'debug-fiber-info-result', requestId, ok: false, reason: 'no-fiber' };
}

export function handleOpenPathBar(request: OpenPathBarToMain): OpenPathBarResult {
  const output = lastContextTarget
    ? buildInternalOutput(lastContextTarget, request.options, -1, '')
    : null;
  if (output && output.nodes.length > 0) {
    const { nodes } = buildRawPath(locateFiber(lastContextTarget as Element) as NonNullable<ReturnType<typeof locateFiber>>);
    session = {
      element: lastContextTarget as Element,
      captured: output,
      rawNodes: nodes,
      chipNodeIndices: optionsToChipNodeIndices(output, nodes, request.options),
    };
    return {
      source: MESSAGE_SOURCE,
      type: 'open-path-bar-result',
      requestId: request.requestId,
      ok: true,
      chips: chipsFromOutput(output),
    };
  }
  return {
    source: MESSAGE_SOURCE,
    type: 'open-path-bar-result',
    requestId: request.requestId,
    ok: false,
    reason: 'no-fiber',
  };
}

export function handleHighlight(request: {
  requestId: number;
  index: number;
}): HighlightResult {
  if (!session || !session.captured.nodes[request.index]) {
    return {
      source: MESSAGE_SOURCE,
      type: 'highlight-result',
      requestId: request.requestId,
      ok: false,
      reason: 'bad-index',
    };
  }
  const nodeIndex = session.chipNodeIndices[request.index] ?? -1;
  const name = session.captured.nodes[request.index].name;
  const highlight = computeHighlight(session.rawNodes, nodeIndex, name);
  return {
    source: MESSAGE_SOURCE,
    type: 'highlight-result',
    requestId: request.requestId,
    ok: true,
    index: request.index,
    rects: highlight.rects,
    label: highlight.label,
    portal: highlight.portal,
    borderOnly: highlight.borderOnly,
    noDom: highlight.noDom,
  };
}

export function handlePropsPreview(request: {
  requestId: number;
  index: number;
  options: RunOptions;
}): PropsPreviewResult {
  if (!session) {
    return {
      source: MESSAGE_SOURCE,
      type: 'props-preview-result',
      requestId: request.requestId,
      ok: false,
      reason: 'no-session',
    };
  }
  if (!session.captured.nodes[request.index]) {
    return {
      source: MESSAGE_SOURCE,
      type: 'props-preview-result',
      requestId: request.requestId,
      ok: false,
      reason: 'bad-index',
    };
  }

  if (session.element.isConnected && locateFiber(session.element) !== null) {
    const fresh = buildInternalOutput(session.element, request.options, -1, '');
    if (fresh && fresh.nodes.length > 0) {
      const located = locateFiber(session.element);
      if (located) {
        const rawNodes = buildRawPath(located).nodes;
        session = {
          element: session.element,
          captured: fresh,
          rawNodes,
          chipNodeIndices: optionsToChipNodeIndices(fresh, rawNodes, request.options),
        };
      }
      const clampedIndex = Math.min(request.index, fresh.nodes.length - 1);
      return {
        source: MESSAGE_SOURCE,
        type: 'props-preview-result',
        requestId: request.requestId,
        ok: true,
        index: request.index,
        text: nodeToMarkdownBlock(fresh.nodes[clampedIndex], true),
        removed: false,
      };
    }
  }

  const capturedIndex = Math.min(request.index, session.captured.nodes.length - 1);
  return {
    source: MESSAGE_SOURCE,
    type: 'props-preview-result',
    requestId: request.requestId,
    ok: true,
    index: request.index,
    text: nodeToMarkdownBlock(session.captured.nodes[capturedIndex], true),
    removed: !session.element.isConnected,
  };
}

export function handleCopyProps(request: CopyPropsToMain): CopyPropsResult {
  if (!session) {
    return {
      source: MESSAGE_SOURCE,
      type: 'copy-props-result',
      requestId: request.requestId,
      ok: false,
      reason: 'no-session',
    };
  }
  if (!session.captured.nodes[request.index]) {
    return {
      source: MESSAGE_SOURCE,
      type: 'copy-props-result',
      requestId: request.requestId,
      ok: false,
      reason: 'bad-index',
    };
  }

  const connected = session.element.isConnected && locateFiber(session.element) !== null;
  const removed = !session.element.isConnected;

  if (connected) {
    const fresh = buildInternalOutput(session.element, request.options, -1, '');
    if (fresh && fresh.nodes.length > 0) {
      const located = locateFiber(session.element);
      if (located) {
        const rawNodes = buildRawPath(located).nodes;
        session = {
          element: session.element,
          captured: fresh,
          rawNodes,
          chipNodeIndices: optionsToChipNodeIndices(fresh, rawNodes, request.options),
        };
      }
      const clampedIndex = Math.min(request.index, fresh.nodes.length - 1);
      const text = propsOnlyText(fresh.nodes[clampedIndex], request.format);
      if (text !== null) {
        return {
          source: MESSAGE_SOURCE,
          type: 'copy-props-result',
          requestId: request.requestId,
          ok: true,
          text,
          name: fresh.nodes[clampedIndex].name,
          removed: false,
        };
      }
    }
  }

  const capturedIndex = Math.min(request.index, session.captured.nodes.length - 1);
  const capturedNode = session.captured.nodes[capturedIndex];
  const text = propsOnlyText(capturedNode, request.format);
  if (text === null) {
    return {
      source: MESSAGE_SOURCE,
      type: 'copy-props-result',
      requestId: request.requestId,
      ok: false,
      reason: 'no-props',
    };
  }
  return {
    source: MESSAGE_SOURCE,
    type: 'copy-props-result',
    requestId: request.requestId,
    ok: true,
    text,
    name: capturedNode.name,
    removed,
  };
}

function propsOnlyText(node: OutputNode, format: OutputFormat): string | null {
  if (format === 'json') {
    if (node.propsNote) return null;
    return node.propsJson === undefined ? null : JSON.stringify(node.propsJson, null, 2);
  }
  if (node.propsNote) return `props: ${node.propsNote}`;
  return node.propsText === null ? null : `props: ${node.propsText}`;
}

export function handleCopyNode(request: {
  requestId: number;
  index: number;
  note: string;
  format: 'markdown' | 'json';
  options: RunOptions;
}): CopyNodeResult {
  if (!session) {
    return {
      source: MESSAGE_SOURCE,
      type: 'copy-node-result',
      requestId: request.requestId,
      ok: false,
      reason: 'no-session',
    };
  }
  if (!session.captured.nodes[request.index]) {
    return {
      source: MESSAGE_SOURCE,
      type: 'copy-node-result',
      requestId: request.requestId,
      ok: false,
      reason: 'bad-index',
    };
  }

  const connected = session.element.isConnected && locateFiber(session.element) !== null;
  const removed = !session.element.isConnected;

  if (connected) {
    const fresh = buildInternalOutput(session.element, request.options, -1, request.note);
    if (fresh && fresh.nodes.length > 0) {
      const located = locateFiber(session.element);
      let rawNodes = session.rawNodes;
      let chipNodeIndices = session.chipNodeIndices;
      if (located) {
        rawNodes = buildRawPath(located).nodes;
        chipNodeIndices = optionsToChipNodeIndices(fresh, rawNodes, request.options);
        session = {
          element: session.element,
          captured: fresh,
          rawNodes,
          chipNodeIndices,
        };
      }
      const clampedIndex = Math.min(request.index, fresh.nodes.length - 1);
      const truncated = truncateOutput(fresh, clampedIndex, rawNodes, chipNodeIndices, request.options.showEverything);
      return {
        source: MESSAGE_SOURCE,
        type: 'copy-node-result',
        requestId: request.requestId,
        ok: true,
        path: formatOutput(truncated, request.format, request.options, null),
        arrow: truncated.pathSummary,
        warning: truncated.warnings[0] ?? null,
        removed: false,
      };
    }
  }

  const captured = { ...session.captured, note: request.note.trim() || session.captured.note };
  const clampedIndex = Math.min(request.index, captured.nodes.length - 1);
  const truncated = truncateOutput(captured, clampedIndex, session.rawNodes, session.chipNodeIndices, request.options.showEverything);
  return {
    source: MESSAGE_SOURCE,
    type: 'copy-node-result',
    requestId: request.requestId,
    ok: true,
    path: formatOutput(truncated, request.format, request.options, removed ? REMOVED_NOTE : null),
    arrow: truncated.pathSummary,
    warning: truncated.warnings[0] ?? null,
    removed,
  };
}
