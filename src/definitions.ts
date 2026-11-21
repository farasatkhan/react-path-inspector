import type { RefObject } from 'react';

export const MESSAGE_SOURCE = 'react-path-copier';

export type OutputFormat = 'markdown' | 'json';

export type UiTheme = 'system' | 'light' | 'dark';

export type EditorId = 'vscode' | 'cursor';

export type InspectMode = 'editor' | 'select';

export interface Settings {
  schemaVersion: number;
  theme: UiTheme;
  defaultFormat: OutputFormat;
  headerEnabled: boolean;
  noteFieldEnabled: boolean;
  budgetChars: number;
  maxDepth: number;
  maxStringChars: number;
  maxItems: number;
  extraRedactKeys: string[];
  disabledRedactKeys: string[];
  redactPersonalData: boolean;
  showEverything: boolean;
  debugLogging: boolean;
  allowedOrigins: string[];
  editor: EditorId;
  defaultProjectRoot: string;
  projectRoots: Record<string, string>;
  editorShortcut: string;
  selectShortcut: string;
}

export interface CopyPathRequest {
  type: 'copy-path';
  format?: OutputFormat;
}

export interface DebugFiberInfoRequest {
  type: 'debug-fiber-info';
}

export interface OpenPathBarRequest {
  type: 'open-path-bar';
}

export interface OpenEditorUrlRequest {
  type: 'open-editor-url';
  url: string;
}

export type RuntimeMessage = CopyPathRequest | DebugFiberInfoRequest | OpenPathBarRequest | OpenEditorUrlRequest;

export interface RunOptions {
  showEverything: boolean;
  debugLogging: boolean;
  headerEnabled: boolean;
  budgetChars: number;
  maxDepth: number;
  maxStringChars: number;
  maxItems: number;
  extraRedactKeys: string[];
  disabledRedactKeys: string[];
  redactPersonalData: boolean;
}

export interface CopyPathToMain {
  source: typeof MESSAGE_SOURCE;
  type: 'copy-path';
  requestId: number;
  format: OutputFormat;
  options: RunOptions;
}

export type CopyPathResult =
  | {
      source: typeof MESSAGE_SOURCE;
      type: 'copy-path-result';
      requestId: number;
      ok: true;
      path: string;
      arrow: string;
      warning: string | null;
    }
  | {
      source: typeof MESSAGE_SOURCE;
      type: 'copy-path-result';
      requestId: number;
      ok: false;
      reason: 'no-fiber';
    };

export interface DebugFiberInfoToMain {
  source: typeof MESSAGE_SOURCE;
  type: 'debug-fiber-info';
  requestId: number;
}

export type DebugFiberInfoResult =
  | {
      source: typeof MESSAGE_SOURCE;
      type: 'debug-fiber-info-result';
      requestId: number;
      ok: true;
    }
  | {
      source: typeof MESSAGE_SOURCE;
      type: 'debug-fiber-info-result';
      requestId: number;
      ok: false;
      reason: 'no-fiber';
    };

export interface OpenPathBarToMain {
  source: typeof MESSAGE_SOURCE;
  type: 'open-path-bar';
  requestId: number;
  options: RunOptions;
}

export interface PathBarChip {
  index: number;
  name: string;
  server: boolean;
}

export type OpenPathBarResult =
  | {
      source: typeof MESSAGE_SOURCE;
      type: 'open-path-bar-result';
      requestId: number;
      ok: true;
      chips: PathBarChip[];
    }
  | {
      source: typeof MESSAGE_SOURCE;
      type: 'open-path-bar-result';
      requestId: number;
      ok: false;
      reason: 'no-fiber';
    };

export interface HighlightToMain {
  source: typeof MESSAGE_SOURCE;
  type: 'highlight';
  requestId: number;
  index: number;
}

export interface PropsPreviewToMain {
  source: typeof MESSAGE_SOURCE;
  type: 'props-preview';
  requestId: number;
  index: number;
  options: RunOptions;
}

export type PropsPreviewResult =
  | {
      source: typeof MESSAGE_SOURCE;
      type: 'props-preview-result';
      requestId: number;
      ok: true;
      index: number;
      text: string;
      removed: boolean;
    }
  | {
      source: typeof MESSAGE_SOURCE;
      type: 'props-preview-result';
      requestId: number;
      ok: false;
      reason: 'no-fiber' | 'bad-index' | 'no-session';
    };

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type HighlightResult =
  | {
      source: typeof MESSAGE_SOURCE;
      type: 'highlight-result';
      requestId: number;
      ok: true;
      index: number;
      rects: HighlightRect[];
      label: string | null;
      portal: boolean;
      borderOnly: boolean;
      noDom: boolean;
    }
  | {
      source: typeof MESSAGE_SOURCE;
      type: 'highlight-result';
      requestId: number;
      ok: false;
      reason: 'no-fiber' | 'bad-index';
    };

export interface CopyNodeToMain {
  source: typeof MESSAGE_SOURCE;
  type: 'copy-node';
  requestId: number;
  index: number;
  note: string;
  format: OutputFormat;
  options: RunOptions;
}

export type CopyNodeResult =
  | {
      source: typeof MESSAGE_SOURCE;
      type: 'copy-node-result';
      requestId: number;
      ok: true;
      path: string;
      arrow: string;
      warning: string | null;
      removed: boolean;
    }
  | {
      source: typeof MESSAGE_SOURCE;
      type: 'copy-node-result';
      requestId: number;
      ok: false;
      reason: 'no-fiber' | 'bad-index' | 'no-session';
    };

export interface CopyPropsToMain {
  source: typeof MESSAGE_SOURCE;
  type: 'copy-props';
  requestId: number;
  index: number;
  format: OutputFormat;
  options: RunOptions;
}

export type CopyPropsResult =
  | {
      source: typeof MESSAGE_SOURCE;
      type: 'copy-props-result';
      requestId: number;
      ok: true;
      text: string;
      name: string;
      removed: boolean;
    }
  | {
      source: typeof MESSAGE_SOURCE;
      type: 'copy-props-result';
      requestId: number;
      ok: false;
      reason: 'no-session' | 'bad-index' | 'no-props';
    };

export interface RouteChangedFromMain {
  source: typeof MESSAGE_SOURCE;
  type: 'route-changed';
}

export interface InspectStartToMain {
  source: typeof MESSAGE_SOURCE;
  type: 'inspect-start';
  mode: InspectMode;
}

export interface InspectStopToMain {
  source: typeof MESSAGE_SOURCE;
  type: 'inspect-stop';
}

export interface InspectSource {
  fileName: string;
  line: number;
  column: number;
}

export interface InspectTarget {
  rect: HighlightRect;
  source: InspectSource | null;
  borderOnly: boolean;
}

export interface InspectHoverFromMain {
  source: typeof MESSAGE_SOURCE;
  type: 'inspect-hover';
  element: InspectTarget | null;
  owner: InspectTarget | null;
}

export interface InspectClickFromMain {
  source: typeof MESSAGE_SOURCE;
  type: 'inspect-click';
  mode: InspectMode;
  hasFiber: boolean;
  sourceInfo: InspectSource | null;
}

export interface InspectStoppedFromMain {
  source: typeof MESSAGE_SOURCE;
  type: 'inspect-stopped';
}

export type WindowRequest = CopyPathToMain | DebugFiberInfoToMain | OpenPathBarToMain | HighlightToMain | PropsPreviewToMain | CopyNodeToMain | CopyPropsToMain | InspectStartToMain | InspectStopToMain;
export type WindowResult =
  | CopyPathResult
  | DebugFiberInfoResult
  | OpenPathBarResult
  | HighlightResult
  | PropsPreviewResult
  | CopyNodeResult
  | CopyPropsResult;
export type WindowMessage = WindowRequest | WindowResult | RouteChangedFromMain | InspectHoverFromMain | InspectClickFromMain | InspectStoppedFromMain;

export type ToastKind = 'success' | 'error' | 'info';

export interface BudgetBlock {
  text: string;
  keysText: string | null;
}

export interface BudgetResult {
  blocks: string[];
  reducedIndices: number[];
  trimmedCount: number;
  note: string | null;
  overBudget: boolean;
}

export type FiberKind =
  | 'host'
  | 'named-component'
  | 'anonymous'
  | 'fragment'
  | 'strict-mode'
  | 'profiler'
  | 'consumer'
  | 'suspense'
  | 'provider'
  | 'server-component';

export interface RawPathEntry {
  name: string | null;
  kind: FiberKind;
  props?: unknown;
  nextInternal?: boolean;
}

export interface FilteredPath {
  components: string[];
  componentIndices: number[];
  clickedHost: RawPathEntry | null;
  contextProviderCount: number;
  dropped: RawPathEntry[];
}

export interface MarkdownInput {
  headerEnabled: boolean;
  from: string | null;
  reactVersion: string | null;
  note: string | null;
  route: string | null;
  pathSummary: string;
  blocks: string[];
  clickedElementMarkdown: string | null;
  providersLine: string | null;
  trimmedCount: number;
  budgetChars: number;
  warnings: string[];
}

export interface JsonOutput {
  route: string | null;
  from: string | null;
  reactVersion: string | null;
  note: string | null;
  path: string[];
  nodes: Array<{
    name: string;
    boundary: 'server' | 'client';
    selected: boolean;
    props: unknown;
    propsNote: string | null;
    propsKeys: string[];
    state: unknown;
    context: null;
  }>;
  element: OutputElement | null;
  warnings: string[];
  trimmed: { ancestorsReducedToKeys: number } | null;
}

export interface OutputNode {
  name: string;
  boundary: 'server' | 'client';
  selected: boolean;
  propsText: string | null;
  propsJson: unknown;
  propsNote: string | null;
  propsKeys: string[];
  stateText: string | null;
  stateJson: unknown;
}

export interface OutputElement {
  tag: string;
  id: string | null;
  className: string | null;
  attributes: Record<string, string>;
}

export interface InternalOutput {
  from: string | null;
  route: string | null;
  reactVersion: string | null;
  note: string | null;
  pathSummary: string;
  nodes: OutputNode[];
  clickedElementMarkdown: string | null;
  clickedElementJson: OutputElement | null;
  providersLine: string | null;
  trimmedCount: number;
  warnings: string[];
}

export interface RedactOptions {
  extraKeys?: readonly string[];
  disabledKeys?: readonly string[];
  redactPersonalData?: boolean;
}

export interface SerializeLimits {
  maxDepth: number;
  maxStringChars: number;
  maxItems: number;
}

export interface SerializeContext {
  limits: SerializeLimits;
  redact: RedactOptions;
}

export interface JsonSafeCounters {
  arraysTruncated: number;
  objectsCollapsed: number;
}

export interface MinimalFiber {
  tag: number;
  type: unknown;
  key: string | null;
  return: MinimalFiber | null;
  alternate: MinimalFiber | null;
  sibling: MinimalFiber | null;
  child: MinimalFiber | null;
  stateNode: unknown;
  memoizedProps?: unknown;
  memoizedState?: unknown;
}

export interface LocatedFiber {
  fiber: MinimalFiber;
  domDistance: number;
}

export interface PathNode {
  entry: RawPathEntry;
  fiber: MinimalFiber | null;
}

export interface RawPath {
  nodes: PathNode[];
}

export interface ServerEntry {
  name: string;
  props: unknown;
}

export interface HighlightData {
  rects: { x: number; y: number; width: number; height: number }[];
  label: string | null;
  portal: boolean;
  borderOnly: boolean;
  noDom: boolean;
}

export interface OverlayData {
  rects: { x: number; y: number; width: number; height: number }[];
  label: string | null;
  borderOnly: boolean;
  theme?: 'light' | 'dark';
}

export interface Overlay {
  update(data: OverlayData | null): void;
  destroy(): void;
}

export interface InspectOverlayData {
  element: {
    x: number;
    y: number;
    width: number;
    height: number;
    pathLabel: string | null;
    sizeLabel: string;
  } | null;
  owner: {
    x: number;
    y: number;
    width: number;
    height: number;
    pathLabel: string | null;
    sizeLabel: string;
  } | null;
}

export interface BarProps {
  chips: PathBarChip[];
  selected: number;
  noDomFlags: Record<number, boolean>;
  noteEnabled: boolean;
  theme: 'light' | 'dark';
  noteInputRef: RefObject<HTMLTextAreaElement | null>;
  propsOpen: boolean;
  propsPreview: { index: number; text: string } | null;
  propsLoading: boolean;
  onNoteChange: (note: string) => void;
  onSelect: (index: number) => void;
  onCopy: (note: string) => void;
  onCopyProps: () => void;
  onToggleProps: () => void;
  onClose: () => void;
}

export interface BarState extends BarProps {
  visible: boolean;
}

export interface BarController {
  update(state: Partial<BarState>): void;
  focusNote(): void;
  getNote(): string;
  destroy(): void;
}

export interface BarMount {
  controller: BarController;
  host: HTMLElement;
}
