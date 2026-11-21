

import { loadSettings } from '../shared/settings';

import { syncOriginRegistrations } from '../shared/origins';
import { type OutputFormat, type RuntimeMessage } from '../definitions';

const SELECT_COMPONENT_MENU_ID = 'select-react-component';
const COPY_MD_MENU_ID = 'copy-react-path-markdown';
const COPY_JSON_MENU_ID = 'copy-react-path-json';
const DEBUG_FIBER_INFO_MENU_ID = 'debug-fiber-info';

function ensureMenus(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: SELECT_COMPONENT_MENU_ID,
      title: 'Select React component…',
      contexts: ['all'],
    });
    chrome.contextMenus.create({
      id: COPY_MD_MENU_ID,
      title: 'Copy React path as Markdown',
      contexts: ['all'],
    });
    chrome.contextMenus.create({
      id: COPY_JSON_MENU_ID,
      title: 'Copy React path as JSON',
      contexts: ['all'],
    });
    chrome.contextMenus.create({
      id: DEBUG_FIBER_INFO_MENU_ID,
      title: 'Debug: log fiber info to console',
      contexts: ['all'],
    });
  });
}

function syncOrigins(): void {
  void (async () => {
    const settings = await loadSettings();
    await syncOriginRegistrations(settings.allowedOrigins).catch(() => {});
  })();
}

chrome.runtime.onInstalled.addListener(() => {
  ensureMenus();
  syncOrigins();
});
chrome.runtime.onStartup.addListener(() => {
  ensureMenus();
  syncOrigins();
});

function formatForMenu(menuItemId: string): OutputFormat | undefined {
  if (menuItemId === COPY_MD_MENU_ID) return 'markdown';
  if (menuItemId === COPY_JSON_MENU_ID) return 'json';
  return undefined;
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  const menuItemId = info.menuItemId as string;
  const send = (message: RuntimeMessage) =>
    chrome.tabs.sendMessage(tab.id as number, message, { frameId: info.frameId });

  if (menuItemId === SELECT_COMPONENT_MENU_ID) {
    send({ type: 'open-path-bar' });
    return;
  }
  if (menuItemId === DEBUG_FIBER_INFO_MENU_ID) {
    send({ type: 'debug-fiber-info' });
    return;
  }
  const format = formatForMenu(menuItemId);
  if (format) {
    send({ type: 'copy-path', format });
  }
});

chrome.runtime.onMessage.addListener((raw, sender, sendResponse) => {
  const message = raw as RuntimeMessage | undefined;
  if (message?.type !== 'open-editor-url' || !message.url) return false;
  void openEditorTab(message.url, sender.tab?.windowId).catch(() => {});
  sendResponse({ ok: true });
  return false;
});

const EDITOR_TAB_ALARM_PREFIX = 'editor-tab-cleanup-';
const EDITOR_TAB_SAFETY_WHEN_MS = 20000;

function pendingEditorTabKey(tabId: number): string {
  return `pendingEditorTab:${tabId}`;
}

function editorTabAlarmName(tabId: number): string {
  return `${EDITOR_TAB_ALARM_PREFIX}${tabId}`;
}

async function openEditorTab(url: string, windowId: number | undefined): Promise<void> {
  const tab = await chrome.tabs.create({ url, windowId });
  if (!tab || tab.id === undefined) return;
  const tabId = tab.id;
  await chrome.storage.session.set({ [pendingEditorTabKey(tabId)]: { url } });
  chrome.alarms.create(editorTabAlarmName(tabId), { when: Date.now() + EDITOR_TAB_SAFETY_WHEN_MS });
}

chrome.tabs.onUpdated.addListener((changedTabId, info) => {
  if (info.url === undefined || !info.url.startsWith('about:blank')) return;
  void closeEditorTabIfBlank(changedTabId);
});

chrome.tabs.onRemoved.addListener((closedTabId) => {
  void forgetEditorTab(closedTabId);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith(EDITOR_TAB_ALARM_PREFIX)) return;
  void closeEditorTabIfBlank(Number(alarm.name.slice(EDITOR_TAB_ALARM_PREFIX.length)));
});

async function closeEditorTabIfBlank(tabId: number): Promise<void> {
  const key = pendingEditorTabKey(tabId);
  const stored = await chrome.storage.session.get(key);
  const pending = stored[key] as { url: string } | undefined;
  if (!pending) return;
  await chrome.storage.session.remove(key);
  await chrome.alarms.clear(editorTabAlarmName(tabId));
  const current = await chrome.tabs.get(tabId).catch(() => undefined);
  if (current?.url === pending.url || current?.url?.startsWith('about:blank')) {
    chrome.tabs.remove(tabId).catch(() => {});
  }
}

async function forgetEditorTab(tabId: number): Promise<void> {
  const key = pendingEditorTabKey(tabId);
  const stored = await chrome.storage.session.get(key);
  if (!stored[key]) return;
  await chrome.storage.session.remove(key);
  await chrome.alarms.clear(editorTabAlarmName(tabId));
}
