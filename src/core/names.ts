
export function nameFromType(type: unknown): string {
  if (typeof type === 'function') {
    const fn = type as { displayName?: unknown; name?: unknown };
    if (typeof fn.displayName === 'string' && fn.displayName) return fn.displayName;
    return typeof fn.name === 'string' ? fn.name : '';
  }
  if (type && typeof type === 'object') {
    const obj = type as Record<string, unknown>;
    if (typeof obj.displayName === 'string' && obj.displayName) return obj.displayName;
    const inner = obj.type ?? obj.render;
    if (typeof inner === 'function') return nameFromType(inner);
    if (typeof obj.name === 'string' && obj.name) return obj.name;
  }
  return '';
}
