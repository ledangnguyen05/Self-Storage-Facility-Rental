import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseCopyToClipboardResult {
  /** Copies `text`; resolves true on success, false when the browser refuses. Never throws. */
  copy: (text: string) => Promise<boolean>
  /** True for `resetMs` after a successful copy (for a "Đã sao chép" state). */
  copied: boolean
  /** Last failure, or null. */
  error: Error | null
}

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  try {
    textarea.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}

/**
 *   const { copy, copied } = useCopyToClipboard()
 *   <Button onClick={() => copy(booking.bookingCode)}>{copied ? 'Đã sao chép' : 'Sao chép'}</Button>
 */
export function useCopyToClipboard(resetMs = 2000): UseCopyToClipboardResult {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const timerRef = useRef<number | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  const copy = useCallback(
    async (text: string) => {
      let ok = false
      let failure: Error | null = null
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
          ok = true
        } else {
          ok = legacyCopy(text)
        }
      } catch (err) {
        ok = legacyCopy(text)
        if (!ok) failure = err instanceof Error ? err : new Error('Không thể sao chép.')
      }
      if (!ok && !failure) failure = new Error('Không thể sao chép.')

      if (!mountedRef.current) return ok
      setError(failure)
      setCopied(ok)
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      if (ok) {
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null
          if (mountedRef.current) setCopied(false)
        }, resetMs)
      }
      return ok
    },
    [resetMs]
  )

  return { copy, copied, error }
}
