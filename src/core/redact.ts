
const SECRET_KEY_ENTRIES = [
  'accessToken',
  'api_key',
  'password',
  'secret',
  'authorization',
  'cookie',
] as const;

import { type RedactOptions } from '../definitions';

export const BUILT_IN_REDACT_KEYS: readonly string[] = SECRET_KEY_ENTRIES;

const PERSONAL_KEY_ENTRIES = ['email', 'phone', 'address', 'ssn'] as const;

const SECRET_VALUE_PREFIXES = ['sk-', 'ghp_', 'AKIA'] as const;

const JWT_PATTERN = /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/;
const BEARER_PATTERN = /^Bearer\s+\S+/i;
const HEX_PATTERN = /^[0-9a-f]{32,}$/i;
const BASE64_PATTERN = /^[A-Za-z0-9+/]{32,}={0,2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const REDACTED_KEY_MATCH = '[redacted: key match]';

function splitWords(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.toLowerCase());
}

function containsContiguousRun(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  outer: for (let start = 0; start <= haystack.length - needle.length; start++) {
    for (let offset = 0; offset < needle.length; offset++) {
      if (haystack[start + offset] !== needle[offset]) continue outer;
    }
    return true;
  }
  return false;
}

export function isSensitiveKey(key: string, options: RedactOptions = {}): boolean {
  if (key === 'key') return false;
  const keyWords = splitWords(key);
  if (keyWords.length === 0) return false;

  const disabled = new Set(options.disabledKeys ?? []);
  const entries: string[] = [
    ...SECRET_KEY_ENTRIES.filter((entry) => !disabled.has(entry)),
    ...(options.extraKeys ?? []),
    ...(options.redactPersonalData ? PERSONAL_KEY_ENTRIES : []),
  ];

  return entries.some((entry) => containsContiguousRun(keyWords, splitWords(entry)));
}

export function detectSecretValue(value: string, options: RedactOptions = {}): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  if (JWT_PATTERN.test(trimmed)) return '[redacted: looks like a JWT]';
  if (BEARER_PATTERN.test(trimmed)) return '[redacted: looks like a Bearer token]';
  if (HEX_PATTERN.test(trimmed) || BASE64_PATTERN.test(trimmed)) {
    return '[redacted: looks like a long token]';
  }
  if (SECRET_VALUE_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
    return '[redacted: looks like an API key]';
  }
  if (options.redactPersonalData && EMAIL_PATTERN.test(trimmed)) {
    return '[redacted: looks like an email]';
  }
  return null;
}
