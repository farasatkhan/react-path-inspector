

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
  openEditorTab(message.url, sender.tab?.windowId);
  sendResponse({ ok: true });
  return false;
});

function openEditorTab(url: string, windowId: number | undefined): void {
  chrome.tabs.create({ url, windowId }, (tab) => {
    if (!tab || tab.id === undefined) return;
    const tabId = tab.id;
    const listener = (changedTabId: number, info: { url?: string }) => {
      if (changedTabId !== tabId || info.url === undefined) return;
      if (info.url.startsWith('about:blank')) {
        cleanup();
        chrome.tabs.remove(tabId).catch(() => {});
      }
    };
    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(listener);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      window.clearTimeout(safety);
    };
    const onRemoved = (closedTabId: number) => {
      if (closedTabId === tabId) cleanup();
    };
    const safety = window.setTimeout(() => {
      cleanup();
      chrome.tabs.get(tabId).then((current) => {
        if (current.url === url || current.url?.startsWith('about:blank')) {
          chrome.tabs.remove(tabId).catch(() => {});
        }
      }).catch(() => {});
    }, 20000);
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.onRemoved.addListener(onRemoved);
  });
}
