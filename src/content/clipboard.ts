import { showToast } from './toast';

export async function writeToClipboard(
  path: string,
  arrow: string,
  warning: string | null,
  removed: boolean,
  theme: 'light' | 'dark',
): Promise<void> {
  try {
    await navigator.clipboard.writeText(path);
    const suffix =
      (removed ? ' (showing last known state)' : '') +
      (warning ? ' (names look minified: production build?)' : '');
    showToast(`Copied: ${arrow}${suffix}`, 'success', theme);
  } catch {
    showToast('Could not write to the clipboard', 'error', theme);
  }
}
