/**
 * Shared API envelope types, mirroring the Spring Boot backend
 * (`common/response/ApiResponse`, `common/response/PageResponse`,
 * `exception/GlobalExceptionHandler`).
 */

/** Paged list returned by every `PageResponse<T>` endpoint. */
export interface PageResult<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

/** Success envelope: `{ success, message, data }`. */
export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
  errors?: unknown
  timestamp?: string
}

/** Error body produced by GlobalExceptionHandler. */
export interface ApiErrorBody {
  status?: number
  code?: number
  error?: string
  message?: string
  /** Field validation errors: `{ field: message }` (or a list in older handlers). */
  errors?: Record<string, string> | string[] | null
}

/** `FileUploadResponse` returned by upload endpoints. */
export interface FileUploadResponse {
  fileName: string
  fileUrl: string
  fileType: string
  fileSize: number
  uploadedAt: string
}

/** Optional per-call request options accepted by service read methods. */
export interface RequestOptions {
  /** Abort signal (e.g. from `useAsyncData`). */
  signal?: AbortSignal
}
