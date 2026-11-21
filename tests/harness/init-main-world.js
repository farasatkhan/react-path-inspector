// Isolation test 2: main-world behaviors from react-path-inspector besides
// the version hook: history wrappers + message listener + contextmenu capture.
(() => {
  const notify = () => window.postMessage({ source: "react-path-copier", type: "route-changed" }, window.location.origin);
  const originalPushState = history.pushState.bind(history);
  history.pushState = function pushed(...args) {
    const result = originalPushState(...args);
    notify();
    return result;
  };
  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = function replaced(...args) {
    const result = originalReplaceState(...args);
    notify();
    return result;
  };
  window.addEventListener("popstate", notify);
  window.addEventListener(
    "contextmenu",
    (event) => {},
    true,
  );
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "react-path-copier") return;
    // simulate main-world handling of requests (echo back a minimal result)
    if (data.type === "copy-path" || data.type === "open-path-bar") {
      window.postMessage({ source: "react-path-copier", type: data.type + "-result", requestId: data.requestId, ok: false, reason: "isolated-test" }, window.location.origin);
    }
  });
})();
