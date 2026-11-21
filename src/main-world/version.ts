
interface RendererInfo {
  version?: string;
}

interface DevToolsHook {
  renderers?: Map<number, RendererInfo>;
  inject?(renderer: RendererInfo): number;
  [key: string]: unknown;
}

export function installVersionHook(): void {
  const w = window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: DevToolsHook };
  if (w.__REACT_DEVTOOLS_GLOBAL_HOOK__) return;

  const renderers = new Map<number, RendererInfo>();
  let uid = 0;
  const hook: DevToolsHook = {
    renderers,
    supportsFiber: true,
    inject(renderer: RendererInfo) {
      uid += 1;
      renderers.set(uid, renderer);
      return uid;
    },
    checkDCE() {},
    onCommitFiberRoot() {},
    onCommitFiberMount() {},
  };
  w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
}

export function reactVersion(): string | null {
  const hook = (window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: DevToolsHook })
    .__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook?.renderers) return null;
  for (const renderer of hook.renderers.values()) {
    if (renderer?.version) return renderer.version;
  }
  return null;
}
