import { MESSAGE_SOURCE, type CopyPathToMain, type DebugFiberInfoToMain, type HighlightToMain, type InspectStartToMain, type InspectStopToMain, type OpenPathBarToMain, type PropsPreviewToMain, type CopyNodeToMain, type CopyPropsToMain, type WindowResult } from '../definitions';
import { startInspect, stopInspect } from './inspect';
import {
  handleCopyPath,
  handleCopyNode,
  handleCopyProps,
  handleDebugFiberInfo,
  handleHighlight,
  handleOpenPathBar,
  handlePropsPreview,
} from './session';
import { installVersionHook } from './version';

installVersionHook();

function post(result: WindowResult): void {
  window.postMessage(result, window.location.origin);
}

function notifyRouteChanged(): void {
  window.postMessage({ source: MESSAGE_SOURCE, type: 'route-changed' }, window.location.origin);
}
const originalPushState = history.pushState.bind(history);
history.pushState = function pushed(...args: Parameters<History['pushState']>) {
  const result = originalPushState(...args);
  notifyRouteChanged();
  return result;
} as History['pushState'];
const originalReplaceState = history.replaceState.bind(history);
history.replaceState = function replaced(...args: Parameters<History['replaceState']>) {
  const result = originalReplaceState(...args);
  notifyRouteChanged();
  return result;
} as History['replaceState'];
window.addEventListener('popstate', notifyRouteChanged);

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data as Record<string, unknown> | undefined;
  if (!data || data.source !== MESSAGE_SOURCE) return;

  switch (data.type) {
    case 'copy-path':
      post(handleCopyPath(data as unknown as CopyPathToMain));
      return;
    case 'debug-fiber-info':
      post(handleDebugFiberInfo((data as unknown as DebugFiberInfoToMain).requestId));
      return;
    case 'open-path-bar':
      post(handleOpenPathBar(data as unknown as OpenPathBarToMain));
      return;
    case 'highlight':
      post(handleHighlight(data as unknown as HighlightToMain));
      return;
    case 'props-preview':
      post(handlePropsPreview(data as unknown as PropsPreviewToMain));
      return;
    case 'copy-node':
      post(handleCopyNode(data as unknown as CopyNodeToMain));
      return;
    case 'copy-props':
      post(handleCopyProps(data as unknown as CopyPropsToMain));
      return;
    case 'inspect-start':
      startInspect((data as unknown as InspectStartToMain).mode);
      return;
    case 'inspect-stop':
      stopInspect(false);
      return;
    default:
      return;
  }
});
