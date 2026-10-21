import { API_BASE_URL, api } from '../lib/axios'
import { getApiErrorStatus } from '../lib/apiError'
import { readStoredUser } from '../lib/authSession'

/**
 * Uploaded evidence (handover photos, receipts, paper contracts, ticket photos, refund slips) is private: a stored path
 * such as `/uploads/handover/9f1c.jpg` is not a link anyone can open. The API signs it for the signed-in user
 * (`POST /api/v1/files/sign`) and the browser opens the short-lived signed link instead. Never render a stored path
 * directly: use `<SignedImage>` / `<SignedFileLink>` or `useSignedUrl`.
 */

export type SignStatus = 'OK' | 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID'

export interface SignedFile {
  /** The stored path that was asked for. */
  url: string
  /** Absolute-ready link (relative to the API origin) that works without a token; null unless `status` is OK. */
  signedUrl: string | null
  /** Epoch milliseconds the link stops working; undefined for links that never expire (external urls). */
  expiresAt?: number
  status: SignStatus
}

interface SignedFileDto {
  url: string
  signedUrl?: string | null
  expiresAt?: string | null
  status: SignStatus
}

const UPLOAD_PATH = /^\/uploads\/[A-Za-z0-9_-]{1,40}\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/
/** A link is renewed this long before it expires. */
const EXPIRY_MARGIN_MS = 60_000
const MAX_BATCH = 50

/** The plain `/uploads/<dir>/<file>` path of a stored value (query and fragment dropped), or null for anything else. */
export function toUploadPath(url: string | null | undefined): string | null {
  if (!url) return null
  const value = url.trim().split(/[?#]/)[0]
  return UPLOAD_PATH.test(value) ? value : null
}

export function isUploadUrl(url: string | null | undefined): boolean {
  return toUploadPath(url) !== null
}

/** Signed paths are relative to the API origin (the Vite proxy in development). */
export function resolveSignedUrl(signedUrl: string): string {
  return signedUrl.startsWith('/') && !signedUrl.startsWith('//') ? `${API_BASE_URL}${signedUrl}` : signedUrl
}

interface Waiter {
  resolve: (file: SignedFile) => void
  reject: (error: unknown) => void
}
const waiters = new Map<string, Waiter[]>()

const cache = new Map<string, SignedFile>()
const inflight = new Map<string, Promise<SignedFile>>()
let queue: string[] = []
let flushScheduled = false

function isFresh(file: SignedFile): boolean {
  return file.status !== 'OK' ? false : file.expiresAt === undefined || file.expiresAt - EXPIRY_MARGIN_MS > Date.now()
}

function fromDto(dto: SignedFileDto): SignedFile {
  return {
    url: dto.url,
    signedUrl: dto.signedUrl ?? null,
    expiresAt: dto.expiresAt ? Date.parse(dto.expiresAt) : undefined,
    status: dto.status,
  }
}

async function flush(): Promise<void> {
  flushScheduled = false
  const paths = Array.from(new Set(queue))
  queue = []
  for (let start = 0; start < paths.length; start += MAX_BATCH) {
    const batch = paths.slice(start, start + MAX_BATCH)
    try {
      const response = await api.post('/api/v1/files/sign', { urls: batch })
      const items = (response.data?.data ?? []) as SignedFileDto[]
      const byUrl = new Map(items.map(item => [item.url, fromDto(item)]))
      for (const path of batch) {
        const result = byUrl.get(path) ?? { url: path, signedUrl: null, status: 'INVALID' as SignStatus }
        if (result.status === 'OK') cache.set(path, result)
        const pending = waiters.get(path)
        waiters.delete(path)
        pending?.forEach(waiter => waiter.resolve(result))
      }
    } catch (error) {
      // A server that predates signed links answers 404/405 and still serves /uploads openly: keep working against it
      // during a rolling deployment. A server that knows the endpoint never answers like this.
      const status = getApiErrorStatus(error)
      const legacyServer = status === 404 || status === 405
      for (const path of batch) {
        const pending = waiters.get(path)
        waiters.delete(path)
        const result: SignedFile = { url: path, signedUrl: path, status: 'OK' }
        pending?.forEach(waiter => (legacyServer ? waiter.resolve(result) : waiter.reject(error)))
      }
    }
  }
}

/**
 * Signed link for one stored value. Requests made in the same tick are sent as one call, results are cached until
 * shortly before they expire, and external or foreign urls pass through unchanged.
 */
export function signUploadUrl(url: string, options: { force?: boolean } = {}): Promise<SignedFile> {
  const path = toUploadPath(url)
  if (!path) return Promise.resolve({ url, signedUrl: url, status: 'OK' })
  dropCacheOfPreviousUser()

  const cached = cache.get(path)
  if (!options.force && cached && isFresh(cached)) return Promise.resolve(cached)
  if (options.force) cache.delete(path)

  const existing = inflight.get(path)
  if (existing && !options.force) return existing

  const promise = new Promise<SignedFile>((resolve, reject) => {
    const list = waiters.get(path) ?? []
    list.push({ resolve, reject })
    waiters.set(path, list)
    queue.push(path)
    if (!flushScheduled) {
      flushScheduled = true
      setTimeout(() => void flush(), 0)
    }
  }).finally(() => {
    if (inflight.get(path) === promise) inflight.delete(path)
  })
  inflight.set(path, promise)
  return promise
}

/** Drops every cached link, e.g. after sign-out. */
export function clearSignedUrlCache(): void {
  cache.clear()
  inflight.clear()
}

let cacheOwnerId: string | null | undefined
/** A link was signed for one account: when another one signs in on the same tab the cached links are not reused. */
function dropCacheOfPreviousUser(): void {
  const owner = readStoredUser<{ id?: string } | null>(null)?.id ?? null
  if (cacheOwnerId !== undefined && cacheOwnerId !== owner) clearSignedUrlCache()
  cacheOwnerId = owner
}

export const fileService = {
  sign: signUploadUrl,
  /** Opens a stored file in a new tab through a fresh signed link. */
  async open(url: string): Promise<SignStatus> {
    const result = await signUploadUrl(url)
    if (result.status === 'OK' && result.signedUrl) {
      window.open(resolveSignedUrl(result.signedUrl), '_blank', 'noopener,noreferrer')
    }
    return result.status
  },
}
