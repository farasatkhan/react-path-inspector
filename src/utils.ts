import { type EditorId, type RunOptions, type Settings, type UiTheme } from './definitions';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function resolveUiTheme(theme: UiTheme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  const dark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return dark ? 'dark' : 'light';
}

export function runOptionsFrom(settings: Settings): RunOptions {
  return {
    showEverything: settings.showEverything,
    debugLogging: settings.debugLogging,
    headerEnabled: settings.headerEnabled,
    budgetChars: settings.budgetChars,
    maxDepth: settings.maxDepth,
    maxStringChars: settings.maxStringChars,
    maxItems: settings.maxItems,
    extraRedactKeys: settings.extraRedactKeys,
    disabledRedactKeys: settings.disabledRedactKeys,
    redactPersonalData: settings.redactPersonalData,
  };
}

export function withTheme(
  base: Record<string, string>,
  theme: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = { ...base };
  for (const [key, value] of Object.entries(theme)) {
    out[key] = key in out ? out[key] + ' ' + value : value;
  }
  return out;
}

export interface ShortcutSpec {
  mod: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
}

export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /mac/i.test(navigator.platform || navigator.userAgent || '');
}

export function isWindows(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /win/i.test(navigator.platform || navigator.userAgent || '');
}

export function isAbsoluteSourcePath(fileName: string): boolean {
  if (/^[a-zA-Z]:[\\/]/.test(fileName) || fileName.startsWith('\\\\')) return true;
  return fileName.startsWith('/') && !isWindows();
}

export function parseShortcut(text: string): ShortcutSpec | null {
  const tokens = text
    .toLowerCase()
    .split('+')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return null;

  const spec: ShortcutSpec = { mod: false, ctrl: false, alt: false, shift: false, key: '' };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const isLast = i === tokens.length - 1;
    if (token === 'mod' && isLast) return null;
    if (token === 'mod') spec.mod = true;
    else if (token === 'ctrl' || token === 'control') spec.ctrl = true;
    else if (token === 'alt' || token === 'option') spec.alt = true;
    else if (token === 'shift') spec.shift = true;
    else if (isLast && token.length === 1) spec.key = token;
    else return null;
  }
  return spec.key ? spec : null;
}

export function matchesShortcut(event: KeyboardEvent, text: string): boolean {
  const spec = parseShortcut(text);
  if (!spec) return false;
  if (event.key.toLowerCase() !== spec.key) return false;

  const mac = isMac();
  const wantMod = spec.mod ? (mac ? event.metaKey : event.ctrlKey) : true;
  if (!wantMod) return false;
  if (spec.mod && (mac ? event.ctrlKey : event.metaKey)) return false;
  if (!spec.mod) {
    if (spec.ctrl !== event.ctrlKey) return false;
    if (mac && !spec.ctrl && event.metaKey) return false;
  }
  if (spec.alt !== event.altKey) return false;
  if (spec.shift !== event.shiftKey) return false;
  return true;
}

export function prettyShortcut(text: string): string {
  const spec = parseShortcut(text);
  if (!spec) return text;
  const mac = isMac();
  const parts: string[] = [];
  if (spec.mod) parts.push(mac ? 'Cmd' : 'Ctrl');
  if (spec.ctrl) parts.push('Ctrl');
  if (spec.alt) parts.push(mac ? 'Option' : 'Alt');
  if (spec.shift) parts.push('Shift');
  parts.push(spec.key.toUpperCase());
  return parts.join('+');
}

export function editorDisplayName(editor: EditorId): string {
  return editor === 'cursor' ? 'Cursor' : 'VS Code';
}

export function buildEditorUrl(editor: EditorId, absolutePath: string, line: number, column: number): string | null {
  const path = absolutePath.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\//, '');
  if (!path) return null;
  const encoded = encodeURI(path);
  return `${editor}://file/${encoded}:${line}:${column}`;
}

export function joinRootPath(root: string, fileName: string): string {
  const normalizedRoot = root.replace(/\\/g, '/').replace(/\/+$/, '');
  const normalizedFile = fileName.replace(/\\/g, '/').replace(/^\//, '');
  if (!normalizedRoot) return normalizedFile;
  return `${normalizedRoot}/${normalizedFile}`;
}

export function resolveProjectRoot(
  origin: string,
  roots: Record<string, string>,
  fallback: string,
): string {
  const exact = roots[origin];
  if (exact && exact.trim()) return exact.trim();
  const withoutPort = origin.replace(/:\d+$/, '');
  if (withoutPort !== origin) {
    const loose = roots[withoutPort];
    if (loose && loose.trim()) return loose.trim();
  }
  return fallback.trim();
}
