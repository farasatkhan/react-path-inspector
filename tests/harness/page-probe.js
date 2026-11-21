// React Path Inspector probe harness.
// Runs IN THE PAGE via `agent-browser eval --stdin`. Reads the target from
// window.__RPICONFIG = { selector: "css selector" }, then exercises the
// extension's real pipeline:
//   1. synthetic contextmenu  -> sets lastContextTarget (same code path as a
//      real right-click, minus the Chrome menu)
//   2. open-path-bar          -> filtered chip path
//   3. props-preview          -> serialized props for the last chips
//   4. highlight              -> noDom / portal / rect flags per chip
//   5. inspect-start + mousemove -> resolved source file:line:col for the
//      hovered element and its owner component
(async () => {
  const config = window.__RPICONFIG;
  if (!config || !config.selector) {
    return JSON.stringify({ error: "no window.__RPICONFIG.selector" });
  }
  const SRC = "react-path-copier";
  const OPTIONS = {
    showEverything: false,
    debugLogging: false,
    headerEnabled: false,
    budgetChars: 12000,
    maxDepth: 3,
    maxStringChars: 200,
    maxItems: 5,
    extraRedactKeys: [],
    disabledRedactKeys: [],
    redactPersonalData: false,
  };

  const el = document.querySelector(config.selector);
  if (!el) {
    return JSON.stringify({ error: "selector not found: " + config.selector });
  }
  el.scrollIntoView({ block: "center" });
  await new Promise((r) => setTimeout(r, 400));

  const request = (type, extra) =>
    new Promise((resolve) => {
      const id = Math.floor(Math.random() * 1e9);
      const listener = (event) => {
        const data = event.data;
        if (
          data &&
          data.source === SRC &&
          data.type === type + "-result" &&
          data.requestId === id
        ) {
          window.removeEventListener("message", listener);
          resolve(data);
        }
      };
      window.addEventListener("message", listener);
      window.postMessage(
        { source: SRC, type, requestId: id, ...extra },
        window.location.origin,
      );
      setTimeout(() => resolve({ timeout: true }), 5000);
    });

  // 1. context target (right-click equivalent)
  el.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
  );

  // 2. path chips
  const opened = await request("open-path-bar", { options: OPTIONS });
  if (!opened.ok) {
    return JSON.stringify({ error: "open-path-bar failed", reason: opened.reason });
  }
  const chips = opened.chips.map((c) => (c.server ? c.name + " (server)" : c.name));

  // 3. props for the nearest four chips
  const props = {};
  for (let i = Math.max(0, chips.length - 4); i < chips.length; i++) {
    const res = await request("props-preview", { index: i, options: OPTIONS });
    props[chips[i] || String(i)] = res.ok
      ? String(res.text).slice(0, 900)
      : "ERR:" + (res.reason ?? "unknown");
  }

  // 4. highlight flags per chip
  const highlight = {};
  for (let i = 0; i < chips.length; i++) {
    const res = await request("highlight", { index: i });
    highlight[chips[i] || String(i)] = res.ok
      ? {
          noDom: res.noDom === true,
          portal: res.portal === true,
          rectCount: (res.rects || []).length,
        }
      : "ERR:" + res.reason;
  }

  // 5. hover sources. The extension resolves sources asynchronously (SSR
  // endpoint / chunk source maps) and RE-EMITS inspect-hover afterwards, so
  // collect every emit for a while and keep the last one.
  const rect = el.getBoundingClientRect();
  const hoverData = await new Promise((resolve) => {
    let last = { timeout: true };
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", listener);
      resolve(last);
    };
    const listener = (event) => {
      const data = event.data;
      if (data && data.source === SRC && data.type === "inspect-hover") {
        last = data;
        // Keep listening: the extension first emits a chunk-decode fallback
        // (line 1), then RE-EMITS with the source-map-resolved position.
        // Finish early only when an absolute path shows up.
        const sources = [data.element, data.owner]
          .filter(Boolean)
          .map((t) => t.source);
        if (sources.length > 0 && sources[0] && /^[A-Za-z]:\//.test(sources[0].fileName || "")) {
          finish();
        }
      }
    };
    window.addEventListener("message", listener);
    window.postMessage(
      { source: SRC, type: "inspect-start", mode: "editor" },
      window.location.origin,
    );
    setTimeout(() => {
      el.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
        }),
      );
    }, 150);
    // keep re-hovering: later emits carry resolved sources
    const rehover = setInterval(() => {
      el.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
        }),
      );
    }, 600);
    setTimeout(() => {
      clearInterval(rehover);
      finish();
    }, 6000);
  });
  window.postMessage({ source: SRC, type: "inspect-stop" }, window.location.origin);

  const src = (t) =>
    t && t.source ? t.source.fileName + ":" + t.source.line + ":" + t.source.column : null;

  return JSON.stringify({
    route: location.pathname,
    chips,
    props,
    highlight,
    hoverElementSource: src(hoverData.element),
    hoverOwnerSource: src(hoverData.owner),
    hoverTimeout: Boolean(hoverData.timeout),
  });
})()
