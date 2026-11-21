import { MESSAGE_SOURCE, type WindowResult } from '../definitions';

interface PendingRequest {
  resolve: (result: WindowResult) => void;
  expect: string;
}

let requestCounter = 0;
const pending = new Map<number, PendingRequest>();

export function requestMainWorld(
  type: string,
  extra: Record<string, unknown> = {},
): Promise<WindowResult> {
  const requestId = requestCounter++;
  return new Promise((resolve) => {
    pending.set(requestId, { resolve, expect: `${type}-result` });
    window.postMessage({ source: MESSAGE_SOURCE, type, requestId, ...extra }, window.location.origin);
  });
}

export function resolvePending(data: { requestId?: number; type?: string }): WindowResult | null {
  const entry = pending.get(data.requestId ?? -1);
  if (!entry || data.type !== entry.expect) return null;
  pending.delete(data.requestId ?? -1);
  const result = data as unknown as WindowResult;
  entry.resolve(result);
  return result;
}
