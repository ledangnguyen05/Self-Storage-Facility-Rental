import type { PageResult } from '../types/api'

/** Wraps a plain array (or a missing body) in a single-page PageResult. Page objects pass through. */
export function toPageResult<T>(data: T[] | PageResult<T> | null | undefined): PageResult<T> {
  if (Array.isArray(data)) {
    return { content: data, page: 0, size: data.length, totalElements: data.length, totalPages: 1, first: true, last: true }
  }
  if (data && Array.isArray(data.content)) return data
  return { content: [], page: 0, size: 0, totalElements: 0, totalPages: 0, first: true, last: true }
}
