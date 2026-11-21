
import { detectSecretValue } from '../core/redact';
import { type OutputElement } from '../definitions';

const MAX_ATTR_CHARS = 40;
const MAX_ATTRS_SHOWN = 5;

const INTERESTING_ATTRS = [
  'name',
  'type',
  'href',
  'src',
  'placeholder',
  'value',
  'role',
  'aria-label',
];

export function describeElement(element: Element): string {
  const parts = describeParts(element);
  return `<${element.tagName.toLowerCase()}${parts.length > 0 ? ` ${parts.join(' ')}` : ''}>`;
}

export function describeElementJson(element: Element): OutputElement {
  const attributes: Record<string, string> = {};
  for (const attr of describeParts(element)) {
    const match = /^([a-z-]+)="([\s\S]*)"$/.exec(attr);
    if (match) attributes[match[1]] = match[2];
  }
  return {
    tag: element.tagName.toLowerCase(),
    id: element.id || null,
    className: element.getAttribute('class'),
    attributes,
  };
}

function describeParts(element: Element): string[] {
  const parts: string[] = [];

  if (element.id) parts.push(`id="${element.id}"`);

  const classAttr = element.getAttribute('class');
  if (classAttr) parts.push(`class="${truncate(classAttr)}"`);

  for (const attr of INTERESTING_ATTRS) {
    if (parts.length >= MAX_ATTRS_SHOWN) break;
    const raw = element.getAttribute(attr);
    if (raw === null || raw.length === 0) continue;
    const value = detectSecretValue(raw) ?? truncate(raw);
    parts.push(`${attr}="${value}"`);
  }

  return parts;
}

function truncate(text: string): string {
  return text.length <= MAX_ATTR_CHARS ? text : `${text.slice(0, MAX_ATTR_CHARS)}…`;
}
