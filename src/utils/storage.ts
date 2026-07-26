/**
 * Safe localStorage wrapper.
 *
 * localStorage throws (instead of returning null) in several real situations:
 *  - pages opened directly from disk via file:// (opaque origin)
 *  - Safari/Chrome private mode with storage disabled
 *  - Android WebView with DOM storage turned off
 *  - browsers where the user blocked all site data
 *
 * An unguarded access crashes the whole React tree at boot, so every call is
 * wrapped and falls back to an in-memory store. The game stays fully playable,
 * it just won't persist between sessions.
 */

const memory = new Map<string, string>();
let usable: boolean | null = null;

function isUsable(): boolean {
  if (usable !== null) return usable;
  try {
    const probe = '__ce_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    usable = true;
  } catch {
    usable = false;
  }
  return usable;
}

export const storage = {
  getItem(key: string): string | null {
    if (isUsable()) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        /* fall through to memory */
      }
    }
    return memory.has(key) ? (memory.get(key) as string) : null;
  },

  setItem(key: string, value: string): void {
    memory.set(key, value);
    if (isUsable()) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* quota exceeded or blocked — memory copy already kept */
      }
    }
  },

  /** Reads and JSON-parses a key, returning `fallback` on any failure. */
  getJSON<T>(key: string, fallback: T): T {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  setJSON(key: string, value: unknown): void {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore serialization errors */
    }
  }
};
