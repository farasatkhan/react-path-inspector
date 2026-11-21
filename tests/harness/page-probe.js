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

  el.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
  );

  const opened = await request("open-path-bar", { options: OPTIONS });
  if (!opened.ok) {
    return JSON.stringify({ error: "open-path-bar failed", reason: opened.reason });
  }
  const chips = opened.chips.map((c) => (c.server ? c.name + " (server)" : c.name));

  const props = {};
  for (let i = Math.max(0, chips.length - 4); i < chips.length; i++) {
    const res = await request("props-preview", { index: i, options: OPTIONS });
    props[chips[i] || String(i)] = res.ok
      ? String(res.text).slice(0, 900)
      : "ERR:" + (res.reason ?? "unknown");
  }

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
