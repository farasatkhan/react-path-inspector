import { loadSettings } from '../../shared/settings';
import { clamp, resolveUiTheme, runOptionsFrom } from '../../utils';
import { type BarController, type Overlay, type PathBarChip, type Settings } from '../../definitions';
import { mountBar } from './mount';
import { createOverlay } from '../overlay';
import { requestMainWorld } from '../messaging';
import { resolvedTheme, setCachedThemeSetting } from '../theme';
import { showToast } from '../toast';
import { writeToClipboard } from '../clipboard';

let barMount: { controller: BarController; host: HTMLElement } | null = null;
let overlay: Overlay | null = null;
let chips: PathBarChip[] = [];
let selected = 0;
let noDomFlags: Record<number, boolean> = {};
let barSettings: Settings | null = null;
let keyHandler: ((event: KeyboardEvent) => void) | null = null;
let outsideHandler: ((event: PointerEvent) => void) | null = null;
let systemThemeHandler: ((event: MediaQueryListEvent) => void) | null = null;
let propsOpen = false;
let propsPreviewState: { index: number; text: string } | null = null;
let propsLoading = false;

export async function openBar(): Promise<void> {
  closeBar();
  const settings = await loadSettings();
  setCachedThemeSetting(settings.theme);
  const result = await requestMainWorld('open-path-bar', { options: runOptionsFrom(settings) });
  if (result.type !== 'open-path-bar-result' || !result.ok) {
    showToast('No React component found here', 'error', resolvedTheme());
    return;
  }

  chips = result.chips;
  selected = chips.length - 1;
  noDomFlags = {};
  barSettings = settings;
  barMount = mountBar();
  overlay = createOverlay();
  installBarListeners();
  if (settings.theme === 'system' && typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    systemThemeHandler = () => {
      renderBar();
      void requestHighlight();
    };
    mq.addEventListener('change', systemThemeHandler);
  }
  renderBar();
  void requestHighlight();
}

function renderBar(): void {
  barMount?.controller.update({
    visible: true,
    chips,
    selected,
    noDomFlags,
    noteEnabled: barSettings?.noteFieldEnabled ?? false,
    theme: resolvedTheme(),
    propsOpen,
    propsPreview: propsPreviewState,
    propsLoading,
    onSelect: (index) => void selectChip(index),
    onCopy: (note) => void copySelected(note),
    onCopyProps: () => void copyPropsSelected(),
    onToggleProps: () => toggleProps(),
    onClose: () => closeBar(),
  });
}

function installBarListeners(): void {
  keyHandler = (event: KeyboardEvent) => {
    const noteEl = (barMount?.host.shadowRoot?.querySelector(
      '.rpc-bar-note',
    ) as HTMLTextAreaElement | null) ?? null;
    const inNote = !!(
      barMount &&
      noteEl &&
      barMount.host.shadowRoot?.activeElement === noteEl
    );
    if (event.key === 'Enter' && !(inNote && event.shiftKey)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void copySelected(barMount?.controller.getNote() ?? '');
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeBar();
    } else if (event.key === 'ArrowUp' && !inNote) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void selectChip(selected - 1);
    } else if (event.key === 'ArrowDown' && !inNote) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void selectChip(selected + 1);
    } else if (event.key === 'Tab' && (barSettings?.noteFieldEnabled ?? false)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      barMount?.controller.focusNote();
    }
  };
  window.addEventListener('keydown', keyHandler, true);

  outsideHandler = (event: PointerEvent) => {
    if (!event.composedPath().includes(barMount?.host as Node)) closeBar();
  };
  document.addEventListener('pointerdown', outsideHandler, true);
}

export async function selectChip(index: number): Promise<void> {
  const clamped = clamp(index, 0, chips.length - 1);
  const selectionChanged = clamped !== selected;
  selected = clamped;
  renderBar();
  if (selectionChanged) await requestHighlight();
  if (propsOpen && selectionChanged) void requestPropsPreview();
}

function toggleProps(): void {
  propsOpen = !propsOpen;
  if (propsOpen) {
    void requestPropsPreview();
  } else {
    propsPreviewState = null;
    renderBar();
  }
}

async function requestPropsPreview(): Promise<void> {
  if (!barSettings) return;
  const requested = selected;
  propsLoading = true;
  renderBar();
  const result = await requestMainWorld('props-preview', {
    index: requested,
    options: runOptionsFrom(barSettings),
  });
  propsLoading = false;
  if (result.type !== 'props-preview-result' || !result.ok) {
    propsPreviewState = null;
    renderBar();
    return;
  }
  if (result.index !== requested || !barMount || !propsOpen) return;
  propsPreviewState = { index: result.index, text: result.text };
  renderBar();
}

async function requestHighlight(): Promise<void> {
  const requested = selected;
  const result = await requestMainWorld('highlight', { index: requested });
  if (result.type !== 'highlight-result' || !result.ok || !overlay) return;
  if (result.index !== requested || !barMount) return;

  noDomFlags[requested] = result.noDom;
  renderBar();
  overlay.update(
    result.noDom
      ? null
      : { rects: result.rects, label: result.label, borderOnly: result.borderOnly, theme: resolvedTheme() },
  );
}

async function copySelected(note: string): Promise<void> {
  const settings = await loadSettings();
  const result = await requestMainWorld('copy-node', {
    index: selected,
    note,
    format: settings.defaultFormat,
    options: runOptionsFrom(settings),
  });
  if (result.type !== 'copy-node-result' || !result.ok) {
    showToast('No React component found here', 'error', resolvedTheme());
    return;
  }
  await writeToClipboard(result.path, result.arrow, result.warning, result.removed, resolvedTheme());
}

async function copyPropsSelected(): Promise<void> {
  const settings = await loadSettings();
  const result = await requestMainWorld('copy-props', {
    index: selected,
    format: settings.defaultFormat,
    options: runOptionsFrom(settings),
  });
  if (result.type !== 'copy-props-result' || !result.ok) {
    showToast('No props available here', 'error', resolvedTheme());
    return;
  }
  await writeToClipboard(result.text, `${result.name} · props`, null, result.removed, resolvedTheme());
}

export function closeBar(): void {
  if (keyHandler) {
    window.removeEventListener('keydown', keyHandler, true);
    keyHandler = null;
  }
  if (outsideHandler) {
    document.removeEventListener('pointerdown', outsideHandler, true);
    outsideHandler = null;
  }
  if (systemThemeHandler) {
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', systemThemeHandler);
    systemThemeHandler = null;
  }
  overlay?.destroy();
  overlay = null;
  barMount?.controller.destroy();
  barMount = null;
  chips = [];
  noDomFlags = {};
  barSettings = null;
  propsOpen = false;
  propsPreviewState = null;
  propsLoading = false;
}
