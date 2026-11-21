
export function normalizeOrigin(origin: string): string | null {
  let raw = origin.trim().replace(/\/+$/, "");
  if (raw.length === 0) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `http://${raw}`;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname;
  if (!/^(\*\.)?([a-z0-9-]+\.)*[a-z0-9-]+$|^\[[\da-f:]+\]$/i.test(host)) return null;
  return `${url.protocol}//${host}`;
}

export function normalizeSiteKey(origin: string): string | null {
  let raw = origin.trim().replace(/\/+$/, "");
  if (raw.length === 0) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `http://${raw}`;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname;
  if (!/^(\*\.)?([a-z0-9-]+\.)*[a-z0-9-]+$|^\[[\da-f:]+\]$/i.test(host)) return null;
  return `${url.protocol}//${url.host}`;
}

export function originToPattern(origin: string): string | null {
  const normalized = normalizeOrigin(origin);
  return normalized ? `${normalized}/*` : null;
}

export function registrationIdsFor(pattern: string): { isolatedId: string; mainId: string } {
  let hash = 5381;
  for (let i = 0; i < pattern.length; i++) {
    hash = ((hash << 5) + hash + pattern.charCodeAt(i)) >>> 0;
  }
  const suffix = hash.toString(36);
  return { isolatedId: `rpc-isolated-${suffix}`, mainId: `rpc-main-${suffix}` };
}

function registeredIdsFor(registered: chrome.scripting.RegisteredContentScript[]): string[] {
  const ids: string[] = [];
  for (const script of registered) {
    if (script.id.startsWith('rpc-')) ids.push(script.id);
  }
  return ids;
}

export async function syncOriginRegistrations(allowedOrigins: readonly string[]): Promise<void> {
  const registered = await chrome.scripting.getRegisteredContentScripts();

  const wanted: Array<{ pattern: string; isolatedId: string; mainId: string }> = [];
  for (const origin of allowedOrigins) {
    const pattern = originToPattern(origin);
    if (!pattern) continue;
    const granted = await chrome.permissions.contains({ origins: [pattern] });
    if (!granted) continue;
    const { isolatedId, mainId } = registrationIdsFor(pattern);
    wanted.push({ pattern, isolatedId, mainId });
  }
  const wantedIds = new Set(wanted.flatMap((w) => [w.isolatedId, w.mainId]));

  const stale = registeredIdsFor(registered).filter((id) => !wantedIds.has(id));
  if (stale.length > 0) {
    await chrome.scripting.unregisterContentScripts({ ids: stale }).catch(() => {});
  }

  const knownIds = new Set(registeredIdsFor(registered));
  for (const entry of wanted) {
    if (knownIds.has(entry.isolatedId) && knownIds.has(entry.mainId)) continue;
    await chrome.scripting.unregisterContentScripts({ ids: [entry.isolatedId, entry.mainId] }).catch(() => {});
    await chrome.scripting.registerContentScripts([
      {
        id: entry.isolatedId,
        matches: [entry.pattern],
        js: ['contentScript.js'],
        runAt: 'document_idle',
        persistAcrossSessions: true,
      },
      {
        id: entry.mainId,
        matches: [entry.pattern],
        js: ['mainWorld.js'],
        runAt: 'document_start',
        world: chrome.scripting.ExecutionWorld.MAIN,
        persistAcrossSessions: true,
      },
    ]);
  }
}
