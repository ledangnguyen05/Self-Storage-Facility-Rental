import { AUTH_STORAGE_KEYS, STORAGE_KEYS } from '../constants/storageKeys'
import { getJSON, getString, removeItem, setJSON, setString, type StorageArea } from './storage'

/**
 * Where the signed-in session is kept.
 *
 * - `local`   "Ghi nhớ phiên đăng nhập" on (default): survives closing the browser.
 * - `session` "Ghi nhớ phiên đăng nhập" off: gone when the tab / browser is closed.
 *
 * Tokens and the cached user always live together in one area; this module is the only place that
 * reads or writes them (lib/axios and AuthProvider both go through it).
 */
export type SessionArea = StorageArea

const AREAS: readonly SessionArea[] = ['session', 'local']

/** Area that currently holds the access token (`local` when there is no session). */
export function currentSessionArea(): SessionArea {
  return AREAS.find((area) => getString(STORAGE_KEYS.accessToken, area) !== null) ?? 'local'
}

export function readAccessToken(): string | null {
  for (const area of AREAS) {
    const value = getString(STORAGE_KEYS.accessToken, area)
    if (value) return value
  }
  return null
}

export function readRefreshToken(): string | null {
  for (const area of AREAS) {
    const value = getString(STORAGE_KEYS.refreshToken, area)
    if (value) return value
  }
  return null
}

export function readStoredUser<T>(fallback: T): T {
  for (const area of AREAS) {
    const value = getJSON<T | null>(STORAGE_KEYS.user, null, area)
    if (value !== null) return value
  }
  return fallback
}

export interface PersistedSession<TUser> {
  accessToken: string
  refreshToken?: string | null
  user: TUser
}

/** Removes the session from both areas, so a leftover copy can never resurrect it. */
export function clearStoredSession(): void {
  for (const area of AREAS) {
    AUTH_STORAGE_KEYS.forEach((key) => removeItem(key, area))
  }
}

/** Stores a fresh session in the area chosen by `remember` and wipes the other one. */
export function persistSession<TUser>(session: PersistedSession<TUser>, remember: boolean): void {
  clearStoredSession()
  const area: SessionArea = remember ? 'local' : 'session'
  setString(STORAGE_KEYS.accessToken, session.accessToken, area)
  if (session.refreshToken) setString(STORAGE_KEYS.refreshToken, session.refreshToken, area)
  setJSON(STORAGE_KEYS.user, session.user, area)
}

/** After a token refresh: updates the tokens in place, in whichever area the session already lives. */
export function updateStoredTokens(accessToken: string, refreshToken?: string | null): void {
  const area = currentSessionArea()
  setString(STORAGE_KEYS.accessToken, accessToken, area)
  if (refreshToken) setString(STORAGE_KEYS.refreshToken, refreshToken, area)
}

/** After a profile edit: updates the cached user in place. */
export function updateStoredUser<TUser>(user: TUser): void {
  setJSON(STORAGE_KEYS.user, user, currentSessionArea())
}

/** Moves an existing session between areas when the "remember session" preference changes. */
export function moveSession(remember: boolean): void {
  const target: SessionArea = remember ? 'local' : 'session'
  const source: SessionArea = remember ? 'session' : 'local'
  const accessToken = getString(STORAGE_KEYS.accessToken, source)
  if (!accessToken) return
  const refreshToken = getString(STORAGE_KEYS.refreshToken, source)
  const user = getString(STORAGE_KEYS.user, source)
  setString(STORAGE_KEYS.accessToken, accessToken, target)
  if (refreshToken) setString(STORAGE_KEYS.refreshToken, refreshToken, target)
  if (user) setString(STORAGE_KEYS.user, user, target)
  AUTH_STORAGE_KEYS.forEach((key) => removeItem(key, source))
}
