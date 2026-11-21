
import { type HighlightData, type MinimalFiber, type PathNode } from '../definitions';

const MAX_HOST_ELEMENTS = 100;
const MOSTLY_VIEWPORT_RATIO = 0.85;

function collectHostElements(fiber: MinimalFiber, out: Element[], depth: number): void {
  if (out.length >= MAX_HOST_ELEMENTS || depth > 60) return;

  if (typeof fiber.type === 'string') {
    const element = fiber.stateNode as Element | null;
    if (element && element.nodeType === 1) out.push(element);
    return;
  }

  let child = fiber.child as MinimalFiber | null;
  while (child) {
    collectHostElements(child, out, depth + 1);
    child = child.sibling as MinimalFiber | null;
  }
}

export interface UnionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function unionRectFor(elements: Element[]): UnionRect | null {
  if (elements.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + window.scrollX;
    const y = rect.top + window.scrollY;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + rect.width);
    maxY = Math.max(maxY, y + rect.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function fiberUnionRect(fiber: MinimalFiber): UnionRect | null {
  const elements: Element[] = [];
  collectHostElements(fiber, elements, 0);
  return unionRectFor(elements);
}

export function firstHostFiber(fiber: MinimalFiber): MinimalFiber | null {
  let best: MinimalFiber | null = null;
  const walk = (node: MinimalFiber, depth: number): void => {
    if (best || depth > 60) return;
    if (typeof node.type === 'string') {
      best = node;
      return;
    }
    let child = node.child as MinimalFiber | null;
    while (child) {
      walk(child, depth + 1);
      if (best) return;
      child = child.sibling as MinimalFiber | null;
    }
  };
  walk(fiber, 0);
  return best;
}

function isPortalFiber(fiber: MinimalFiber): boolean {
  let current: MinimalFiber | null = fiber;
  while (current) {
    if (current.tag === 4) return true;
    current = current.return;
  }
  return false;
}

export function computeHighlight(nodes: PathNode[], componentNodeIndex: number, name: string): HighlightData {
  let fiberNode: PathNode | null = null;
  for (let i = componentNodeIndex; i >= 0 && i < nodes.length; i++) {
    if (nodes[i].fiber) {
      fiberNode = nodes[i];
      break;
    }
  }

  if (!fiberNode?.fiber) {
    return { rects: [], label: null, portal: false, borderOnly: false, noDom: true };
  }

  const fiber = fiberNode.fiber;
  const elements: Element[] = [];
  collectHostElements(fiber, elements, 0);

  if (elements.length === 0) {
    return { rects: [], label: null, portal: false, borderOnly: false, noDom: true };
  }

  const union = unionRectFor(elements);
  if (!union) {
    return { rects: [], label: null, portal: false, borderOnly: false, noDom: true };
  }

  const viewportArea = window.innerWidth * window.innerHeight;
  const borderOnly = union.width * union.height > MOSTLY_VIEWPORT_RATIO * viewportArea;
  const portal = isPortalFiber(fiber);
  const label = `${name} · ${elements.length} element${elements.length === 1 ? '' : 's'}${portal ? ' (portal)' : ''}`;

  return { rects: [union], label, portal, borderOnly, noDom: false };
}
