/**
 * Safe Web Storage helpers. Every call swallows storage errors (private mode,
 * quota, disabled storage) and JSON parse errors. Keys live in
 * `constants/storageKeys.ts`.
 */

export type StorageArea = 'local' | 'session'

function getArea(area: StorageArea): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return area === 'session' ? window.sessionStorage : window.localStorage
  } catch {
    return null
  }
}

/** Raw string value, or null. */
export function getString(key: string, area: StorageArea = 'local'): string | null {
  try {
    return getArea(area)?.getItem(key) ?? null
  } catch {
    return null
  }
}

/** Stores a raw string. Returns false when storage is unavailable. */
export function setString(key: string, value: string, area: StorageArea = 'local'): boolean {
  try {
    const store = getArea(area)
    if (!store) return false
    store.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/** Parsed JSON value, or `fallback` when missing or unparseable. */
export function getJSON<T>(key: string, fallback: T, area: StorageArea = 'local'): T {
  const raw = getString(key, area)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** Serialises `value` as JSON. Returns false when storage is unavailable or full. */
export function setJSON<T>(key: string, value: T, area: StorageArea = 'local'): boolean {
  try {
    return setString(key, JSON.stringify(value), area)
  } catch {
    return false
  }
}

export function removeItem(key: string, area: StorageArea = 'local'): void {
  try {
    getArea(area)?.removeItem(key)
  } catch {
    // ignore
  }
}

/** Removes every key starting with one of `prefixes`. */
export function removeByPrefix(prefixes: readonly string[], area: StorageArea = 'local'): void {
  try {
    const store = getArea(area)
    if (!store) return
    const doomed: string[] = []
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i)
      if (key && prefixes.some((p) => key.startsWith(p))) doomed.push(key)
    }
    doomed.forEach((key) => store.removeItem(key))
  } catch {
    // ignore
  }
}

/** Namespaced object form: `storage.getJSON(key, fallback)`. */
export const storage = {
  getString,
  setString,
  getJSON,
  setJSON,
  remove: removeItem,
  removeByPrefix,
}
