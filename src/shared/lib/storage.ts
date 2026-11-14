import type { z } from 'zod';

/**
 * Safe localStorage access.
 * - Never throws: private mode, disabled storage, quota errors and SecurityErrors all
 *   degrade to "nothing stored" / "not saved".
 * - Reads are Zod-parsed, so a tampered, stale or hand-edited value is ignored (and
 *   removed) instead of flowing into the app as trusted data.
 */
export function readStorage<T>(key: string, schema: z.ZodType<T>): T | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    removeStorage(key);
    return null;
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    removeStorage(key);
    return null;
  }
  return parsed.data;
}

/** Returns whether the value was stored. */
export function writeStorage(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable — nothing to remove.
  }
}
