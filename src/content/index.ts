import { loadSettings } from '../shared/settings';
import { runOptionsFrom, resolveUiTheme } from '../utils';
import { MESSAGE_SOURCE, type RuntimeMessage } from '../definitions';
import { requestMainWorld, resolvePending } from './messaging';
import { resolvedTheme } from './theme';
import { showToast } from './toast';
import { writeToClipboard } from './clipboard';
import { closeBar, openBar } from './bar/session';
import './inspect';

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data as { source?: unknown; type?: string; requestId?: number } | undefined;
  if (!data || data.source !== MESSAGE_SOURCE) return;

  if (data.type === 'route-changed') {
    closeBar();
    return;
  }

  resolvePending(data);
});

chrome.runtime.onMessage.addListener((raw: unknown) => {
  const message = raw as RuntimeMessage | undefined;
  if (message?.type === 'copy-path') void quickCopy(message.format);
  else if (message?.type === 'debug-fiber-info') void debugFiberInfo();
  else if (message?.type === 'open-path-bar') void openBar();
});

async function quickCopy(formatOverride?: 'markdown' | 'json'): Promise<void> {
  const settings = await loadSettings();
  const result = await requestMainWorld('copy-path', {
    format: formatOverride ?? settings.defaultFormat,
    options: runOptionsFrom(settings),
  });
  if (result.type !== 'copy-path-result' || !result.ok) {
    showToast('No React component found here', 'error', resolveUiTheme(settings.theme));
    return;
  }
  await writeToClipboard(result.path, result.arrow, result.warning, false, resolveUiTheme(settings.theme));
}

async function debugFiberInfo(): Promise<void> {
  const settings = await loadSettings();
  const result = await requestMainWorld('debug-fiber-info');
  showToast(
    result.ok
      ? 'Fiber info logged. Open the page console to inspect.'
      : 'No React component found here',
    result.ok ? 'info' : 'error',
    resolveUiTheme(settings.theme),
  );
}
