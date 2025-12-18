type CacheEntry<T> = {
  ts: number;
  value: T;
};

const safeJsonParse = <T>(raw: string): T | null => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const buildCacheKey = (
  prefix: string,
  params?: Record<string, unknown>
): string => {
  if (!params) return prefix;

  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(params).sort()) {
    const value = (params as Record<string, unknown>)[key];
    if (value === undefined || value === null || value === "") continue;
    normalized[key] = value;
  }

  return `${prefix}:${JSON.stringify(normalized)}`;
};

export const readSessionCache = <T>(
  key: string,
  maxAgeMs: number
): T | null => {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(key);
  if (!raw) return null;

  const entry = safeJsonParse<CacheEntry<T>>(raw);
  if (!entry || typeof entry.ts !== "number") return null;

  if (Date.now() - entry.ts > maxAgeMs) return null;

  return entry.value;
};

export const writeSessionCache = <T>(key: string, value: T): void => {
  if (typeof window === "undefined") return;

  try {
    const entry: CacheEntry<T> = { ts: Date.now(), value };
    window.sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // ignore quota / serialization errors
  }
};
