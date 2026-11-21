import { loadSettings } from '../shared/settings';
import { type UiTheme } from '../definitions';
import { resolveUiTheme } from '../utils';

let cachedThemeSetting: UiTheme = 'light';

export function resolvedTheme(): 'light' | 'dark' {
  return resolveUiTheme(cachedThemeSetting);
}

export function setCachedThemeSetting(theme: UiTheme): void {
  cachedThemeSetting = theme;
}

void (async () => {
  cachedThemeSetting = (await loadSettings()).theme;
})();

if (chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) {
      void loadSettings().then((settings) => {
        cachedThemeSetting = settings.theme;
      });
    }
  });
}
