const [, , cdpUrl, extensionId, projectRoot] = process.argv;

if (!cdpUrl || !extensionId || !projectRoot) {
  console.error("usage: node set-project-root.js <cdp-url> <extension-id> <root>");
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
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error("timeout: " + method));
      }
    }, 15000);
  });
}

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
};

ws.onopen = async () => {
  try {
    const { targetInfos } = await send("Target.getTargets");
    const worker = targetInfos.find(
      (t) =>
        (t.type === "service_worker" || t.type === "page") &&
        t.url.startsWith(`chrome-extension://${extensionId}/`),
    );
    if (!worker) {
      console.log(
        "NO_WORKER: " +
          JSON.stringify(targetInfos.map((t) => t.type + " " + t.url.slice(0, 80))),
      );
      process.exit(2);
    }
    const { sessionId } = await send("Target.attachToTarget", {
      targetId: worker.targetId,
      flatten: true,
    });

    const expression = `(async () => {
      const SITE = "http://localhost:3000";
      const ROOT = ${JSON.stringify(projectRoot)};
      const stored = await chrome.storage.local.get("settings");
      const settings = stored.settings ?? {};
      const merged = {
        ...settings,
        projectRoots: { ...(settings.projectRoots ?? {}), [SITE]: ROOT },
        schemaVersion: settings.schemaVersion ?? 2,
      };
      await chrome.storage.local.set({ settings: merged });
      const check = await chrome.storage.local.get("settings");
      return JSON.stringify(check.settings.projectRoots);
    })()`;

    const result = await send(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    console.log("PROJECT_ROOTS:", result.result.value);
    process.exit(0);
  } catch (error) {
    console.error("FAILED:", error.message);
    process.exit(3);
  }
};

ws.onerror = (error) => {
  console.error("WS_ERROR:", error.message || String(error));
  process.exit(4);
};
