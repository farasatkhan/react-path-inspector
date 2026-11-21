
export const SETTINGS_SCHEMA_VERSION = 3;

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  theme: 'light',
  defaultFormat: 'markdown',
  headerEnabled: true,
  noteFieldEnabled: false,
  budgetChars: 8000,
  maxDepth: 3,
  maxStringChars: 200,
  maxItems: 5,
  extraRedactKeys: [],
  disabledRedactKeys: [],
  redactPersonalData: false,
  showEverything: false,
  debugLogging: false,
  allowedOrigins: ['http://localhost', 'http://127.0.0.1'],
  editor: 'vscode',
  defaultProjectRoot: '',
  projectRoots: {},
  editorShortcut: 'mod+shift+x',
  selectShortcut: 'mod+shift+z',
};

import { type Settings, type UiTheme } from '../definitions';

const STORAGE_KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const partial = (stored[STORAGE_KEY] ?? {}) as Partial<Settings> & { schemaVersion?: number };
  const merged = { ...DEFAULT_SETTINGS, ...partial };

  if (!partial.schemaVersion || partial.schemaVersion < SETTINGS_SCHEMA_VERSION) {
    merged.schemaVersion = SETTINGS_SCHEMA_VERSION;
    if (!partial.schemaVersion || partial.schemaVersion < 2) {
      merged.allowedOrigins = [...DEFAULT_SETTINGS.allowedOrigins];
    }
  }
  return merged;
}

export async function saveSettings(partial: Partial<Settings>): Promise<void> {
  const current = await loadSettings();
  await chrome.storage.local.set({
    [STORAGE_KEY]: { ...current, ...partial, schemaVersion: SETTINGS_SCHEMA_VERSION },
  });
}

export async function resetSettings(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_SETTINGS });
}
