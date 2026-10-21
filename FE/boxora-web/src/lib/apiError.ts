import axios from 'axios'
import type { ApiErrorBody } from '../types/api'

export const DEFAULT_ERROR_MESSAGE = 'Đã có lỗi xảy ra. Vui lòng thử lại.'

/** Backend placeholder messages that should be replaced by a field-level error. */
const GENERIC_SERVER_MESSAGES = new Set(['validation failed', 'invalid request'])

/** English HTTP reason phrases (`error` field) are never shown to users. */
const HTTP_REASON_PHRASES = new Set([
  'bad request',
  'unauthorized',
  'forbidden',
  'not found',
  'conflict',
  'internal server error',
  'service unavailable',
  'gateway timeout',
  'bad gateway',
])

const STATUS_MESSAGES: Record<number, string> = {
  401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy dữ liệu yêu cầu.',
  408: 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.',
  409: 'Dữ liệu đã thay đổi. Vui lòng tải lại và thử lại.',
  413: 'Tệp tải lên quá lớn.',
  429: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.',
  500: 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.',
  502: 'Không thể kết nối tới máy chủ. Vui lòng thử lại sau.',
  503: 'Hệ thống đang bảo trì. Vui lòng thử lại sau.',
  504: 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.',
}

const NETWORK_MESSAGE = 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.'
const TIMEOUT_MESSAGE = 'Kết nối quá thời gian chờ. Vui lòng thử lại.'

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

function firstValidationError(errors: ApiErrorBody['errors'] | unknown): string | null {
  if (!errors) return null
  if (Array.isArray(errors)) {
    const first = errors.find(nonEmpty)
    return first ?? null
  }
  if (typeof errors === 'object') {
    const first = Object.values(errors as Record<string, unknown>).find(nonEmpty)
    return first ?? null
  }
  return null
}

function messageFromBody(body: unknown): string | null {
  if (nonEmpty(body)) {
    // Some proxies return HTML or plain text; only accept short plain strings.
    return body.length < 300 && !body.trim().startsWith('<') ? body.trim() : null
  }
  if (!body || typeof body !== 'object') return null
  const data = body as ApiErrorBody
  const message = nonEmpty(data.message) ? data.message.trim() : null
  const validation = firstValidationError(data.errors)

  if (message && !GENERIC_SERVER_MESSAGES.has(message.toLowerCase())) return message
  if (validation) return validation
  if (nonEmpty(data.error) && !HTTP_REASON_PHRASES.has(data.error.trim().toLowerCase())) {
    return data.error.trim()
  }
  return null
}

/** True when the request was aborted (AbortController / axios CancelToken). */
export function isRequestCanceled(err: unknown): boolean {
  if (axios.isCancel(err)) return true
  return err instanceof DOMException && err.name === 'AbortError'
}

/** HTTP status of an axios error, or undefined. */
export function getApiErrorStatus(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined
}

/** Backend business error code (`code` field of the error body), or undefined. */
export function getApiErrorCode(err: unknown): number | undefined {
  if (!axios.isAxiosError(err)) return undefined
  const data = err.response?.data as ApiErrorBody | undefined
  return typeof data?.code === 'number' ? data.code : undefined
}

/**
 * User-facing Vietnamese message for any thrown value.
 * Order: backend `message` → first validation error → backend `error` →
 * network / timeout / HTTP status message → `fallback`.
 */
export function getApiErrorMessage(err: unknown, fallback: string = DEFAULT_ERROR_MESSAGE): string {
  if (axios.isAxiosError(err)) {
    const fromBody = messageFromBody(err.response?.data)
    if (fromBody) return fromBody
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') return TIMEOUT_MESSAGE
    if (!err.response) return err.code === 'ERR_CANCELED' ? fallback : NETWORK_MESSAGE
    return STATUS_MESSAGES[err.response.status] ?? fallback
  }
  // Runtime TypeErrors ("Failed to fetch", "Cannot read properties…") are never user copy.
  if (err instanceof TypeError) return fallback
  // Plain Errors thrown by our own code carry Vietnamese copy; ERROR_CODE style messages do not.
  if (err instanceof Error && nonEmpty(err.message) && !/^[A-Z0-9_]+$/.test(err.message)) {
    return err.message
  }
  if (nonEmpty(err)) return err
  return fallback
}
