const [, , cdpUrl, extensionId, site, projectRoot] = process.argv;
if (!cdpUrl || !extensionId || !site || !projectRoot) {
  console.error("usage: node set-content-storage.js <cdp-url> <extension-id> <site> <root>");
  process.exit(1);
}
const ws = new WebSocket(cdpUrl);
let nextId = 1;
const pending = new Map();
function send(method, params = {}, sessionId) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error("timeout " + method)); } }, 15000);
  });
}
ws.onmessage = (event) => {
  const m = JSON.parse(event.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  }
};
ws.onopen = async () => {
  try {
    const { targetInfos } = await send("Target.getTargets");
    const page = targetInfos.find((t) => t.type === "page" && t.url.startsWith(site));
    if (!page) {
      console.log("NO_PAGE for " + site + " targets: " + JSON.stringify(targetInfos.map((t) => t.type + " " + t.url.slice(0, 60))));
      process.exit(2);
    }
    const { sessionId } = await send("Target.attachToTarget", { targetId: page.targetId, flatten: true });
    const contexts = [];
    ws.onmessage = (event) => {
      const m = JSON.parse(event.data);
      if (m.method === "Runtime.executionContextCreated") contexts.push(m.params.context);
      if (m.id && pending.has(m.id)) {
        const { resolve, reject } = pending.get(m.id);
        pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      }
    };
    await send("Runtime.enable", {}, sessionId);
    const contextPromise = new Promise((resolve) => {
      const interval = setInterval(() => {
        const found = contexts.find(
          (c) => c.auxData && c.auxData.type === "isolated" && String(c.origin || "").includes(extensionId),
        );
        if (found) { clearInterval(interval); resolve(found); }
      }, 100);
      setTimeout(() => { clearInterval(interval); resolve(null); }, 8000);
    });
    const world = await contextPromise;
    if (!world) {
      console.log("NO_ISOLATED_WORLD for " + extensionId + "; saw: " + JSON.stringify(contexts.map((c) => ({ id: c.id, origin: c.origin, name: c.name }))));
      process.exit(3);
    }
    console.log("FOUND world", world.id, world.origin, world.name);
    const expression = `(async () => {
      const stored = await chrome.storage.local.get("settings");
      const settings = stored.settings ?? {};
      const merged = {
        ...settings,
        projectRoots: { ...(settings.projectRoots ?? {}), ${JSON.stringify(site)}: ${JSON.stringify(projectRoot)} },
        schemaVersion: settings.schemaVersion ?? 2,
      };
      await chrome.storage.local.set({ settings: merged });
      const check = await chrome.storage.local.get("settings");
      return JSON.stringify({ runtimeId: chrome.runtime.id, projectRoots: check.settings.projectRoots, defaultRoot: check.settings.defaultProjectRoot });
    })()`;
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) {
      console.log("EXC:", JSON.stringify(result.exceptionDetails.exception?.description || result.exceptionDetails).slice(0, 400));
      process.exit(5);
    }
    console.log("RESULT:", result.result.value);
    process.exit(0);
  } catch (e) { console.error("FAILED:", e.message); process.exit(3); }
};
ws.onerror = () => { console.error("WS_ERROR"); process.exit(4); };
