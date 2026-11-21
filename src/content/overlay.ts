
import { type Overlay, type OverlayData } from '../definitions';

const OVERLAY_CSS = `
.rpc-ovl-dark { --ovl-label-bg: rgba(23, 24, 26, 0.95); --ovl-label-border: rgba(255, 255, 255, 0.1); --ovl-label-text: rgba(255, 255, 255, 0.92); --ovl-label-shadow: 0 4px 16px rgba(0, 0, 0, 0.4); }
.rpc-ovl-light { --ovl-label-bg: rgba(255, 255, 255, 0.98); --ovl-label-border: rgba(17, 19, 23, 0.12); --ovl-label-text: rgba(17, 19, 23, 0.92); --ovl-label-shadow: 0 4px 16px rgba(17, 19, 23, 0.18); }
.rpc-rect {
  position: absolute;
  background: rgba(62, 99, 221, 0.07);
  border: 1.5px solid rgba(88, 116, 233, 0.85);
  border-radius: 4px;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.35), 0 0 0 5px rgba(62, 99, 221, 0.2);
}
.rpc-rect-border-only { background: transparent; border: 2px solid rgba(88, 116, 233, 0.85); box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.35), 0 0 0 5px rgba(62, 99, 221, 0.2); }
.rpc-label {
  position: absolute;
  transform: translateY(-130%);
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--ovl-label-bg);
  border: 1px solid var(--ovl-label-border);
  color: var(--ovl-label-text);
  font: 11.5px/1.4 "Inter", system-ui, sans-serif;
  padding: 3px 9px 3px 7px;
  border-radius: 7px;
  white-space: nowrap;
  box-shadow: var(--ovl-label-shadow);
}
.rpc-label-dot { width: 6px; height: 6px; border-radius: 50%; background: #3e63dd; flex: none; }
`;

export function createOverlay(): Overlay {
  const host = document.createElement('div');
  host.id = 'react-path-copier-overlay-host';
  host.style.cssText = 'position:absolute; top:0; left:0; z-index:2147483646; pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = OVERLAY_CSS;
  shadow.appendChild(style);
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute; top:0; left:0;';
  box.className = 'rpc-ovl-light';
  shadow.appendChild(box);
  document.documentElement.appendChild(host);
  let lastTheme: 'light' | 'dark' = 'light';

  return {
    update(data) {
      box.textContent = '';
      if (!data || data.rects.length === 0) return;
      const theme = data.theme ?? lastTheme;
      lastTheme = theme;
      box.className = `rpc-ovl-${theme}`;
      for (const rect of data.rects) {
        const rectDiv = document.createElement('div');
        rectDiv.className = data.borderOnly ? 'rpc-rect rpc-rect-border-only' : 'rpc-rect';
        rectDiv.style.left = `${rect.x}px`;
        rectDiv.style.top = `${rect.y}px`;
        rectDiv.style.width = `${rect.width}px`;
        rectDiv.style.height = `${rect.height}px`;
        box.appendChild(rectDiv);
        if (data.label) {
          const label = document.createElement('div');
          label.className = 'rpc-label';
          label.style.left = `${rect.x}px`;
          label.style.top = `${rect.y}px`;
          const dot = document.createElement('span');
          dot.className = 'rpc-label-dot';
          label.appendChild(dot);
          label.appendChild(document.createTextNode(data.label));
          box.appendChild(label);
        }
      }
    },
    destroy() {
      host.remove();
    },
  };
}
