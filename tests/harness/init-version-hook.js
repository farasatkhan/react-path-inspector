(() => {
  const renderers = new Map();
  let uid = 0;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers,
    supportsFiber: true,
    inject(renderer) {
      uid += 1;
      renderers.set(uid, renderer);
      return uid;
    },
    checkDCE() {},
    onCommitFiberRoot() {},
    onCommitFiberMount() {},
  };
})();
