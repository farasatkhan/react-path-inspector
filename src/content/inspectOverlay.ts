import { type InspectOverlayData } from '../definitions';

const MOSTLY_VIEWPORT_RATIO = 0.85;
const CHIP_GAP = 2;

const INSPECT_CSS = `
.rpc-inspect-fill-blue { background: rgba(43, 115, 181, 0.5); }
.rpc-inspect-fill-green { background: rgba(135, 211, 107, 0.5); }
.rpc-inspect-border-blue { background: transparent; border: 2px solid rgba(43, 115, 181, 0.85); }
.rpc-inspect-border-green { background: transparent; border: 2px solid rgba(135, 211, 107, 0.9); }
.rpc-inspect-rect {
  position: absolute;
  border-radius: 3px;
  pointer-events: none;
}
.rpc-inspect-chip {
  position: absolute;
  display: flex;
  align-items: stretch;
  overflow: hidden;
  border-radius: 5px;
  background: #2e3037;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.28);
  pointer-events: none;
  white-space: nowrap;
}
.rpc-inspect-chip-part {
  font: 500 11px/1.7 ui-monospace, "SF Mono", "Cascadia Mono", Consolas, monospace;
  padding: 1px 8px;
  letter-spacing: 0.01em;
}
.rpc-inspect-chip-path { color: #e14fb8; }
.rpc-inspect-chip-path-muted { color: rgba(255, 255, 255, 0.55); font-weight: 400; }
.rpc-inspect-chip-size { color: #ffffff; }
.rpc-inspect-chip-divider { width: 1px; background: rgba(255, 255, 255, 0.25); margin: 3px 1px; }
@keyframes rpc-inspect-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.rpc-inspect-layer { animation: rpc-inspect-in 120ms ease-out; }
`;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  pathLabel: string | null;
  sizeLabel: string;
}

function borderOnly(rect: Box): boolean {
  return rect.width * rect.height > MOSTLY_VIEWPORT_RATIO * window.innerWidth * window.innerHeight;
}

function buildRect(rect: Box, kind: 'blue' | 'green', clipPath: string | null = null): HTMLDivElement {
  const div = document.createElement('div');
  div.className = `rpc-inspect-rect ${borderOnly(rect) ? `rpc-inspect-border-${kind}` : `rpc-inspect-fill-${kind}`}`;
  div.style.left = `${Math.round(rect.x)}px`;
  div.style.top = `${Math.round(rect.y)}px`;
  div.style.width = `${Math.round(rect.width)}px`;
  div.style.height = `${Math.round(rect.height)}px`;
  if (clipPath) div.style.clipPath = clipPath;
  return div;
}

function buildChip(rect: Box): HTMLDivElement {
  const chip = document.createElement('div');
  chip.className = 'rpc-inspect-chip';
  const pathPart = document.createElement('span');
  pathPart.className = 'rpc-inspect-chip-part rpc-inspect-chip-path';
  pathPart.textContent = rect.pathLabel ?? 'no source info';
  if (!rect.pathLabel) pathPart.classList.add('rpc-inspect-chip-path-muted');
  chip.appendChild(pathPart);
  const divider = document.createElement('span');
  divider.className = 'rpc-inspect-chip-divider';
  chip.appendChild(divider);
  const sizePart = document.createElement('span');
  sizePart.className = 'rpc-inspect-chip-part rpc-inspect-chip-size';
  sizePart.textContent = rect.sizeLabel;
  chip.appendChild(sizePart);
  return chip;
}

function chipBelow(rect: Box, viewportBottom: number, chipHeight: number): number {
  const below = rect.y + rect.height + CHIP_GAP;
  if (below + chipHeight <= viewportBottom) return below;
  const above = rect.y - chipHeight - CHIP_GAP;
  if (above >= 0) return above;
  return Math.max(0, Math.min(below, viewportBottom - chipHeight));
}

function chipsCollide(aY: number, bY: number, chipHeight: number): boolean {
  return Math.abs(aY - bY) < chipHeight + CHIP_GAP;
}

function rectsIntersect(
  a: Box,
  b: Box,
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function clipGreenAroundBlue(green: Box, blue: Box): string | null {
  if (!rectsIntersect(green, blue)) return null;
  const x0 = 0;
  const y0 = 0;
  const x1 = green.width;
  const y1 = green.height;
  const hx = Math.max(x0, blue.x - green.x);
  const hy = Math.max(y0, blue.y - green.y);
  const hx1 = Math.min(x1, blue.x - green.x + blue.width);
  const hy1 = Math.min(y1, blue.y - green.y + blue.height);
  if (hx >= hx1 || hy >= hy1) return null;
  const path = `M ${x0} ${y0} H ${x1} V ${y1} H ${x0} Z M ${hx} ${hy} H ${hx1} V ${hy1} H ${hx} Z`;
  return `path(evenodd, "${path}")`;
}

export function createInspectOverlay() {
  const host = document.createElement('div');
  host.id = 'react-path-copier-inspect-host';
  host.style.cssText = 'position:absolute; top:0; left:0; z-index:2147483646; pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = INSPECT_CSS;
  shadow.appendChild(style);
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute; top:0; left:0;';
  shadow.appendChild(box);
  document.documentElement.appendChild(host);
  let chipHeight = 20;

  function placeChip(layer: HTMLElement, rect: Box, preferredY: number): void {
    const chip = buildChip(rect);
    chip.style.left = `${Math.round(rect.x)}px`;
    chip.style.top = `${Math.round(preferredY)}px`;
    layer.appendChild(chip);
    chipHeight = chip.offsetHeight || chipHeight;
  }

  return {
    update(data: InspectOverlayData | null) {
      box.textContent = '';
      if (!data) return;
      const layer = document.createElement('div');
      layer.className = 'rpc-inspect-layer';
      box.appendChild(layer);

      const viewportBottom = window.scrollY + window.innerHeight;
      if (data.owner && data.element && !borderOnly(data.owner)) {
        const clip = clipGreenAroundBlue(data.owner, data.element);
        layer.appendChild(buildRect(data.owner, 'green', clip));
      } else if (data.owner) {
        layer.appendChild(buildRect(data.owner, 'green'));
      }
      if (data.element) layer.appendChild(buildRect(data.element, 'blue'));

      if (data.element) {
        const elementChipY = chipBelow(data.element, viewportBottom, chipHeight);
        placeChip(layer, data.element, elementChipY);
        if (data.owner) {
          const ownerChipY = chipBelow(data.owner, viewportBottom, chipHeight);
          if (!chipsCollide(elementChipY, ownerChipY, chipHeight)) {
            placeChip(layer, data.owner, ownerChipY);
          }
        }
      } else if (data.owner) {
        placeChip(layer, data.owner, chipBelow(data.owner, viewportBottom, chipHeight));
      }
    },
    destroy() {
      host.remove();
    },
  };
}
