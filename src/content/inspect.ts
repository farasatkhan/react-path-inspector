import { loadSettings } from '../shared/settings';
import { normalizeSiteKey } from '../shared/origins';
import { buildEditorUrl, editorDisplayName, isAbsoluteSourcePath, joinRootPath, matchesShortcut, prettyShortcut, resolveProjectRoot } from '../utils';
import { MESSAGE_SOURCE, type InspectMode, type InspectOverlayData, type Settings } from '../definitions';
import { createInspectOverlay } from './inspectOverlay';
import { closeBar, openBar } from './bar/session';
import { requestMainWorld } from './messaging';
import { resolvedTheme, setCachedThemeSetting } from './theme';
import { showToast } from './toast';

let activeMode: InspectMode | null = null;
let overlay: ReturnType<typeof createInspectOverlay> | null = null;
let cachedSettings: Settings | null = null;

void (async () => {
  cachedSettings = await loadSettings();
})();

if (chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) {
      void loadSettings().then((settings) => {
        cachedSettings = settings;
        setCachedThemeSetting(settings.theme);
      });
    }
  });
}

function pathLabelOf(fileName: string | null, line: number | null, column: number | null): string | null {
  if (!fileName) return null;
  const display = displayFileName(fileName);
  if (line === 1 && column === 1) return display;
  const lineText = line !== null ? `:${line}` : '';
  const columnText = column !== null ? `:${column}` : '';
  return `${display}${lineText}${columnText}`;
}

function displayFileName(fileName: string): string {
  const settings = cachedSettings;
  if (!settings) return fileName;
  const root = resolveProjectRoot(location.origin, settings.projectRoots, settings.defaultProjectRoot);
  if (!root) return fileName;
  const normalizedRoot = root.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const normalizedFile = fileName.replace(/\\/g, '/');
  if (normalizedFile.toLowerCase().startsWith(normalizedRoot + '/')) {
    return normalizedFile.slice(normalizedRoot.length + 1);
  }
  return fileName;
}

function toOverlayBox(
  target: { rect: { x: number; y: number; width: number; height: number }; source: { fileName: string; line: number; column: number } | null } | null,
): InspectOverlayData['element'] {
  if (!target) return null;
  return {
    x: target.rect.x,
    y: target.rect.y,
    width: target.rect.width,
    height: target.rect.height,
    pathLabel: target.source ? pathLabelOf(target.source.fileName, target.source.line, target.source.column) : null,
    sizeLabel: `${Math.round(target.rect.width)}px × ${Math.round(target.rect.height)}px`,
  };
}

function openInEditor(settings: Settings, origin: string, fileName: string, line: number, column: number): boolean {
  const absolutePath = isAbsoluteSourcePath(fileName)
    ? fileName
    : joinRootPath(resolveProjectRoot(origin, settings.projectRoots, settings.defaultProjectRoot), fileName);
  const url = buildEditorUrl(settings.editor, absolutePath, line, column);
  if (!url) return false;
  if (settings.debugLogging) {
    console.info(`[React Path Inspector] editor URL: ${url}`);
  }
  void chrome.runtime
    .sendMessage({ type: 'open-editor-url', url })
    .then((response) => {
      if (!response?.ok) anchorLaunch(url);
    })
    .catch(() => anchorLaunch(url));
  return true;
}

function anchorLaunch(url: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => anchor.remove(), 1000);
}

async function handleInspectClick(mode: InspectMode, hasFiber: boolean, sourceInfo: { fileName: string; line: number; column: number } | null): Promise<void> {
  if (mode === 'select') {
    stopInspect();
    await openBar();
    return;
  }

  const settings = cachedSettings ?? (await loadSettings());
  if (!hasFiber || !sourceInfo) {
    showToast('No source info here. Source paths only exist in development builds.', 'error', resolvedTheme());
    return;
  }

  const origin = location.origin;
  const absolute = isAbsoluteSourcePath(sourceInfo.fileName);
  const root = resolveProjectRoot(origin, settings.projectRoots, settings.defaultProjectRoot);
  if (!absolute && !root) {
    showToast(`Set a project root for ${origin} in React Path Inspector options to open ${sourceInfo.fileName}`, 'error', resolvedTheme());
    return;
  }

  const opened = openInEditor(settings, origin, sourceInfo.fileName, sourceInfo.line, sourceInfo.column);
  if (!opened) {
    showToast('Could not build the editor URL from this source path.', 'error', resolvedTheme());
    return;
  }
  const openedAt = sourceInfo.line > 1 ? `:${sourceInfo.line}` : '';
  showToast(`Opened ${displayFileName(sourceInfo.fileName)}${openedAt} in ${editorDisplayName(settings.editor)}`, 'success', resolvedTheme());
  stopInspect();
}

export function toggleInspect(mode: InspectMode): void {
  if (activeMode === mode) {
    stopInspect();
    return;
  }
  void startInspect(mode);
}

async function startInspect(mode: InspectMode): Promise<void> {
  const settings = cachedSettings ?? (await loadSettings());
  setCachedThemeSetting(settings.theme);
  closeBar();
  stopInspect();
  activeMode = mode;
  overlay = createInspectOverlay();
  window.postMessage({ source: MESSAGE_SOURCE, type: 'inspect-start', mode }, window.location.origin);
  const editorName = editorDisplayName(settings.editor);
  showToast(
    mode === 'editor'
      ? `Inspect on: click an element to open it in ${editorName}. Press ${prettyShortcut(settings.editorShortcut)} or Esc to exit.`
      : `Select on: click a component to inspect its path. Press ${prettyShortcut(settings.selectShortcut)} or Esc to exit.`,
    'info',
    resolvedTheme(),
  );
}

export function stopInspect(): void {
  if (!activeMode) return;
  activeMode = null;
  overlay?.update(null);
  overlay?.destroy();
  overlay = null;
  window.postMessage({ source: MESSAGE_SOURCE, type: 'inspect-stop' }, window.location.origin);
}

function onWindowMessage(event: MessageEvent): void {
  if (event.source !== window) return;
  const data = event.data as { source?: unknown; type?: string } | undefined;
  if (!data || data.source !== MESSAGE_SOURCE) return;

  if (data.type === 'inspect-hover') {
    if (!activeMode || !overlay) return;
    const message = event.data as {
      element: Parameters<typeof toOverlayBox>[0];
      owner: Parameters<typeof toOverlayBox>[0];
    };
    overlay.update({ element: toOverlayBox(message.element), owner: toOverlayBox(message.owner) });
    return;
  }
  if (data.type === 'inspect-click') {
    if (!activeMode) return;
    const message = event.data as { mode: InspectMode; hasFiber: boolean; sourceInfo: { fileName: string; line: number; column: number } | null };
    void handleInspectClick(message.mode, message.hasFiber, message.sourceInfo);
    return;
  }
  if (data.type === 'inspect-stopped') {
    activeMode = null;
    overlay?.update(null);
    overlay?.destroy();
    overlay = null;
    return;
  }
}

function onKeyDown(event: KeyboardEvent): void {
  const settings = cachedSettings;
  if (!settings) return;
  if (event.key === 'Escape') return;
  if (matchesShortcut(event, settings.editorShortcut)) {
    event.preventDefault();
    event.stopPropagation();
    toggleInspect('editor');
    return;
  }
  if (matchesShortcut(event, settings.selectShortcut)) {
    event.preventDefault();
    event.stopPropagation();
    toggleInspect('select');
  }
}

window.addEventListener('message', onWindowMessage);
window.addEventListener('keydown', onKeyDown, true);
