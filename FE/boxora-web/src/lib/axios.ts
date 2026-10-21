import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { APP_EVENTS } from '../constants/storageKeys'
import { getApiErrorCode } from './apiError'
import { clearStoredSession, readAccessToken, readRefreshToken, updateStoredTokens } from './authSession'

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || ''

const AUTH_PREFIX = '/api/v1/auth/'
const REFRESH_PATH = '/api/v1/auth/refresh-token'
/** Auth endpoints that act on the signed-in user, so an expired token there may be refreshed. */
const AUTHENTICATED_AUTH_PATHS = ['/api/v1/auth/profile', '/api/v1/auth/change-password']
/** Web Locks name that serialises token refreshes across browser tabs. */
const REFRESH_LOCK_NAME = 'boxora-token-refresh'

/**
 * Backend error codes that mean "the ACCESS token was rejected" (`INVALID_TOKEN` 400, `TOKEN_EXPIRED` 401). Together
 * with the `WWW-Authenticate: Bearer error="invalid_token"` header they are the only signal on which a 401 is
 * answered with a refresh and a replay. Every other 401 (wrong password, bad Google token, a business rule) is a real
 * answer and goes to the caller untouched.
 */
const ACCESS_TOKEN_REJECTED_CODES: readonly number[] = [400, 401]
/** `USER_INACTIVE` as answered by the refresh endpoint: the account was locked while signed in. */
const ACCOUNT_LOCKED_CODE = 203

const SESSION_ENDED_MESSAGE = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.'
const SESSION_LOCKED_MESSAGE = 'Tài khoản của bạn đang bị khóa nên phiên đăng nhập đã kết thúc. Vui lòng liên hệ bộ phận hỗ trợ Boxora.'

/**
 * `withCredentials` makes the browser keep and send the HttpOnly refresh-token cookie. It is required when the
 * API lives on another origin (VITE_API_BASE_URL set) and harmless through the same-origin proxy.
 */
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

export function getAccessToken(): string | null {
  return readAccessToken()
}

/** Removes access token, refresh token and the cached user (from both local and session storage). */
export function clearAuthStorage(): void {
  clearStoredSession()
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

function pathOf(url: string | undefined): string {
  if (!url) return ''
  try {
    return new URL(url, 'http://local').pathname
  } catch {
    return url
  }
}

/** Login, register, Google, refresh, logout… must never trigger a refresh (avoids loops and false expiries). */
function skipsRefresh(url: string | undefined): boolean {
  const path = pathOf(url)
  if (!path.startsWith(AUTH_PREFIX)) return false
  return !AUTHENTICATED_AUTH_PATHS.includes(path)
}

function bearerOf(config: InternalAxiosRequestConfig): string | null {
  const header = config.headers?.Authorization
  return typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : null
}

// Single-flight refresh: concurrent 401s in this tab share one promise.
let refreshPromise: Promise<string> | null = null

/** Detail of the `APP_EVENTS.sessionExpired` event: what the login screen tells the visitor. */
export interface SessionExpiredDetail {
  message: string
}

function notifySessionExpired(message: string = SESSION_ENDED_MESSAGE): void {
  clearAuthStorage()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<SessionExpiredDetail>(APP_EVENTS.sessionExpired, { detail: { message } }))
  }
}

/** True when the server said, on a 401, that the Bearer ACCESS token itself was expired or invalid. */
export function isAccessTokenRejected(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.response?.status !== 401) return false
  const headers = error.response.headers as Record<string, unknown> | undefined
  const challenge = headers?.['www-authenticate']
  if (typeof challenge === 'string' && /invalid_token/i.test(challenge)) return true
  const code = getApiErrorCode(error)
  return code !== undefined && ACCESS_TOKEN_REJECTED_CODES.includes(code)
}

/** True when the server answered and refused the refresh token (as opposed to being unreachable). */
function isRefreshRejected(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return true // malformed answer: the session cannot be restored
  const status = err.response?.status
  return status === 400 || status === 401 || status === 403
}

/** Runs `task` while holding the cross-tab refresh lock (a plain call where Web Locks are unavailable). */
function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks || typeof locks.request !== 'function') return task()
  return locks.request(REFRESH_LOCK_NAME, task)
}

/**
 * Exchanges the refresh token for a new access token. The backend rotates refresh tokens and treats the reuse
 * of an old one as theft, so two tabs must not refresh at the same time: the lock makes the second tab notice
 * (after the first one finished) that a newer token is already stored and simply reuse it.
 */
function refreshAccessToken(staleToken: string): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = withRefreshLock(async () => {
      const stored = readAccessToken()
      if (stored && stored !== staleToken) return stored // another tab refreshed while we waited

      const storedRefreshToken = readRefreshToken()
      // The backend prefers its HttpOnly refresh cookie and falls back to the body token.
      const res = await axios.post(
        `${API_BASE_URL}${REFRESH_PATH}`,
        storedRefreshToken ? { refreshToken: storedRefreshToken } : {},
        { withCredentials: true },
      )
      const data = res.data?.data as { accessToken?: string; refreshToken?: string | null } | undefined
      if (!data?.accessToken) throw new Error('REFRESH_FAILED')
      updateStoredTokens(data.accessToken, data.refreshToken)
      return data.accessToken
    })
      .catch((err: unknown) => {
        // A dropped connection or a 5xx must not log the user out; only a refusal does.
        if (isRefreshRejected(err)) {
          notifySessionExpired(getApiErrorCode(err) === ACCOUNT_LOCKED_CODE ? SESSION_LOCKED_MESSAGE : SESSION_ENDED_MESSAGE)
        }
        throw err
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

// Request: attach the access token.
api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response: when the backend says the ACCESS token was rejected, refresh once and replay the request.
// A business 401/403 (for example a wrong witness password) is never refreshed or replayed.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined
    if (!isAccessTokenRejected(error) || !original || original._retry || skipsRefresh(original.url)) {
      return Promise.reject(error)
    }

    const sentToken = bearerOf(original)
    if (!sentToken) {
      // Anonymous request: nothing to refresh.
      return Promise.reject(error)
    }

    original._retry = true

    // Another request already refreshed while this one was in flight: just replay.
    const current = getAccessToken()
    if (current && current !== sentToken) {
      original.headers.Authorization = `Bearer ${current}`
      return api(original)
    }

    try {
      const token = await refreshAccessToken(sentToken)
      original.headers.Authorization = `Bearer ${token}`
      return api(original)
    } catch {
      return Promise.reject(error)
    }
  }
)
