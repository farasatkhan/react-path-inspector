
import { detectSecretValue, isSensitiveKey, REDACTED_KEY_MATCH } from './redact';
import { type JsonSafeCounters, type RedactOptions, type SerializeContext, type SerializeLimits } from '../definitions';
import { nameFromType } from './names';

export const DEFAULT_LIMITS: SerializeLimits = {
  maxDepth: 3,
  maxStringChars: 200,
  maxItems: 5,
};

export const DEFAULT_CONTEXT: SerializeContext = { limits: DEFAULT_LIMITS, redact: {} };

const REACT_ELEMENT_TYPES = [
  typeof Symbol === 'function' ? Symbol.for('react.element') : null,
  typeof Symbol === 'function' ? Symbol.for('react.transitional.element') : null,
].filter((symbol): symbol is symbol => symbol !== null);

const REACT_LAZY =
  typeof Symbol === 'function' ? Symbol.for('react.lazy') : null;

export function serializeProps(props: unknown, context: SerializeContext = DEFAULT_CONTEXT): string {
  return serializeValue(props, context, new WeakSet(), 0);
}

export function serializeJsonSafe(
  value: unknown,
  context: SerializeContext = DEFAULT_CONTEXT,
  counters: JsonSafeCounters = { arraysTruncated: 0, objectsCollapsed: 0 },
  seen: WeakSet<object> = new WeakSet(),
  depth = 0,
): unknown {
  const { limits, redact } = context;

  if (typeof value === 'string') {
    const secret = detectSecretValue(value, redact);
    if (secret) return secret;
    if (value.length > limits.maxStringChars) {
      counters.arraysTruncated += 0;
      return `${value.slice(0, limits.maxStringChars)}…`;
    }
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (value === undefined) return null;
  if (typeof value === 'bigint') return `${value.toString()}n`;
  if (typeof value === 'symbol') return String(value);
  if (typeof value === 'function') {
    const name = (value as { name?: unknown }).name;
    return `ƒ ${typeof name === 'string' && name ? name : 'anonymous'}`;
  }

  const objectValue = value as object;
  if (seen.has(objectValue)) return '[Circular]';

  if (isReactElement(objectValue)) return `<${reactElementName(objectValue)} />`;
  if (isDomNode(objectValue)) return domNodeSummary(objectValue);
  if (objectValue instanceof Date) {
    return Number.isNaN(objectValue.getTime()) ? 'Date(invalid)' : objectValue.toISOString();
  }
  if (objectValue instanceof Map || objectValue instanceof Set) {
    return serializeValue(objectValue, context, seen, depth);
  }
  if (typeof (objectValue as { then?: unknown }).then === 'function') return 'Promise';

  if (Array.isArray(objectValue)) {
    seen.add(objectValue);
    const items = objectValue
      .slice(0, limits.maxItems)
      .map((item) => {
        try {
          return serializeJsonSafe(item, context, counters, seen, depth + 1);
        } catch {
          return '[Error reading prop]';
        }
      });
    if (objectValue.length > limits.maxItems) {
      counters.arraysTruncated += 1;
      items.push(`… +${objectValue.length - limits.maxItems} more`);
    }
    seen.delete(objectValue);
    return items;
  }

  if (depth >= limits.maxDepth) {
    counters.objectsCollapsed += 1;
    return '{…}';
  }

  seen.add(objectValue);
  const record: Record<string, unknown> = {};
  try {
    for (const key of Object.keys(objectValue as Record<string, unknown>)) {
      if (isSensitiveKey(key, context.redact)) {
        record[key] = REDACTED_KEY_MATCH;
        continue;
      }
      try {
        record[key] = serializeJsonSafe(
          (objectValue as Record<string, unknown>)[key],
          context,
          counters,
          seen,
          depth + 1,
        );
      } catch {
        record[key] = '[Error reading prop]';
      }
    }
  } finally {
    seen.delete(objectValue);
  }
  return record;
}

export function serializeServerProps(props: object, context: SerializeContext = DEFAULT_CONTEXT): string {
  const parts: string[] = [];
  for (const key of Object.keys(props)) {
    if (isSensitiveKey(key, context.redact)) {
      parts.push(`${key}: ${REDACTED_KEY_MATCH}`);
      continue;
    }
    let rendered: string;
    try {
      rendered = shallowRender((props as Record<string, unknown>)[key], context);
    } catch {
      rendered = '[Error reading prop]';
    }
    parts.push(`${key}: ${rendered}`);
  }
  return `{ ${parts.join(', ')} }`;
}

function shallowRender(value: unknown, context: SerializeContext): string {
  if (typeof value === 'string') {
    const secret = detectSecretValue(value, context.redact);
    if (secret) return secret;
    return truncateString(value, Math.min(context.limits.maxStringChars, 60));
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return String(value);

  const objectValue = value as object;
  if (isReactElement(objectValue)) return `<${reactElementName(objectValue)} />`;
  if (typeof (objectValue as { then?: unknown }).then === 'function') return 'Promise';
  if (typeof objectValue === 'function') {
    const name = (objectValue as { name?: unknown }).name;
    return `ƒ ${typeof name === 'string' && name ? name : 'anonymous'}`;
  }
  return '{…}';
}

export function serializeValue(
  value: unknown,
  context: SerializeContext = DEFAULT_CONTEXT,
  seen: WeakSet<object> = new WeakSet(),
  depth = 0,
): string {
  const { limits, redact } = context;

  if (typeof value === 'string') {
    const secret = detectSecretValue(value, redact);
    if (secret) return secret;
    return truncateString(value, limits.maxStringChars);
  }

  if (typeof value === 'number') return Number.isNaN(value) ? 'NaN' : String(value);
  if (typeof value === 'boolean') return String(value);
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'bigint') return `${value.toString()}n`;
  if (typeof value === 'symbol') return String(value);

  if (typeof value === 'function') {
    const name = (value as { name?: unknown }).name;
    return `ƒ ${typeof name === 'string' && name ? name : 'anonymous'}`;
  }

  const objectValue = value as object;
  if (seen.has(objectValue)) return '[Circular]';

  if (isReactElement(objectValue)) {
    return `<${reactElementName(objectValue)} />`;
  }

  const $$typeof = (objectValue as { $$typeof?: unknown }).$$typeof;
  if (REACT_LAZY !== null && $$typeof === REACT_LAZY) return 'lazy component';

  if (isDomNode(objectValue)) return domNodeSummary(objectValue);

  if (objectValue instanceof Date) {
    const iso = Number.isNaN(objectValue.getTime()) ? 'invalid' : objectValue.toISOString();
    return `Date("${iso}")`;
  }

  if (objectValue instanceof Map) return serializeMap(objectValue, context, seen, depth);
  if (objectValue instanceof Set) return serializeSet(objectValue, context, seen, depth);

  if (Array.isArray(objectValue)) return serializeArray(objectValue, context, seen, depth);

  if (typeof (objectValue as { then?: unknown }).then === 'function') return 'Promise';

  return serializeObject(objectValue, context, seen, depth);
}

function truncateString(text: string, maxChars: number): string {
  if (text.length <= maxChars) return JSON.stringify(text);
  return `${JSON.stringify(text.slice(0, maxChars))}…`;
}

function isReactElement(value: object): boolean {
  const $$typeof = (value as { $$typeof?: unknown }).$$typeof;
  return typeof $$typeof === 'symbol' && REACT_ELEMENT_TYPES.includes($$typeof);
}

function reactElementName(value: object): string {
  const type = (value as { type?: unknown }).type;
  if (typeof type === 'string') return type;
  const name = nameFromType(type);
  return name || 'anonymous';
}

function isDomNode(value: object): boolean {
  const node = value as { nodeType?: unknown; nodeName?: unknown };
  return (
    typeof node.nodeType === 'number' &&
    node.nodeType >= 1 &&
    node.nodeType <= 12 &&
    typeof node.nodeName === 'string'
  );
}

function domNodeSummary(value: object): string {
  const node = value as {
    nodeType: number;
    nodeName: string;
    id?: unknown;
  };
  if (node.nodeType === 3) return '<text>';
  if (node.nodeType === 11) return '<fragment>';
  const tag = node.nodeName.toLowerCase();
  const id = typeof node.id === 'string' && node.id ? `#${node.id}` : '';
  return `<${tag}${id}>`;
}

function serializeArray(
  value: unknown[],
  context: SerializeContext,
  seen: WeakSet<object>,
  depth: number,
): string {
  const { maxItems } = context.limits;
  seen.add(value);
  const shown = value.slice(0, maxItems).map((item) => {
    try {
      return serializeValue(item, context, seen, depth + 1);
    } catch {
      return '[Error reading prop]';
    }
  });
  const more = value.length > maxItems ? `, … +${value.length - maxItems} more` : '';
  seen.delete(value);
  return `[${shown.join(', ')}${more}]`;
}

function serializeMap(
  value: Map<unknown, unknown>,
  context: SerializeContext,
  seen: WeakSet<object>,
  depth: number,
): string {
  const { maxItems } = context.limits;
  seen.add(value);
  const entries: string[] = [];
  let extra = 0;
  for (const [key, item] of value.entries()) {
    if (entries.length >= maxItems) {
      extra += 1;
      continue;
    }
    entries.push(`${serializeMember(key, context, seen, depth)} => ${serializeMember(item, context, seen, depth)}`);
  }
  const more = extra > 0 ? `, … +${extra} more` : '';
  seen.delete(value);
  return `Map(${value.size}) {${entries.join(', ')}${more}}`;
}

function serializeSet(
  value: Set<unknown>,
  context: SerializeContext,
  seen: WeakSet<object>,
  depth: number,
): string {
  const { maxItems } = context.limits;
  seen.add(value);
  const items: string[] = [];
  let extra = 0;
  for (const item of value) {
    if (items.length >= maxItems) {
      extra += 1;
      continue;
    }
    items.push(serializeMember(item, context, seen, depth));
  }
  const more = extra > 0 ? `, … +${extra} more` : '';
  seen.delete(value);
  return `Set(${value.size}) {${items.join(', ')}${more}}`;
}

function serializeObject(
  value: object,
  context: SerializeContext,
  seen: WeakSet<object>,
  depth: number,
): string {
  const { maxDepth } = context.limits;
  if (depth >= maxDepth) return '{…}';

  seen.add(value);
  const parts: string[] = [];
  try {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (isSensitiveKey(key, context.redact)) {
        parts.push(`${key}: ${REDACTED_KEY_MATCH}`);
        continue;
      }
      let rendered: string;
      try {
        rendered = serializeValue(record[key], context, seen, depth + 1);
      } catch {
        rendered = '[Error reading prop]';
      }
      parts.push(`${key}: ${rendered}`);
    }
  } finally {
    seen.delete(value);
  }

  const prefix = classPrefix(value);
  return `${prefix}{${parts.join(', ')}}`;
}

function serializeMember(
  value: unknown,
  context: SerializeContext,
  seen: WeakSet<object>,
  depth: number,
): string {
  try {
    return serializeValue(value, context, seen, depth + 1);
  } catch {
    return '[Error reading prop]';
  }
}

function classPrefix(value: object): string {
  const constructor = (value as { constructor?: { name?: unknown } }).constructor;
  const name = constructor?.name;
  return typeof name === 'string' && name && name !== 'Object' ? `${name} ` : '';
}
