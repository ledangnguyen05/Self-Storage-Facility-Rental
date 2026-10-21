import { useEffect, useLayoutEffect, useRef } from 'react'

export interface UsePollingOptions {
  /** Also run the callback immediately when polling starts. Default false. */
  immediate?: boolean
  /** Skip ticks while the tab is hidden. Default true. */
  pauseWhenHidden?: boolean
}

/**
 * Calls `callback` every `intervalMs` while `enabled`. Ticks never overlap:
 * the next one is scheduled after the previous callback settles. Cleared on
 * unmount or when `enabled` / `intervalMs` change.
 *
 *   usePolling(() => reload(), 30_000, isOpen)
 */
export function usePolling(
  callback: () => void | Promise<unknown>,
  intervalMs: number,
  enabled = true,
  options: UsePollingOptions = {}
): void {
  const { immediate = false, pauseWhenHidden = true } = options
  const callbackRef = useRef(callback)
  useLayoutEffect(() => {
    callbackRef.current = callback
  })

  useEffect(() => {
    if (!enabled || !Number.isFinite(intervalMs) || intervalMs <= 0) return undefined
    let cancelled = false
    let timer: number | null = null

    const tick = async () => {
      if (cancelled) return
      const hidden = pauseWhenHidden && typeof document !== 'undefined' && document.visibilityState === 'hidden'
      if (!hidden) {
        try {
          await callbackRef.current()
        } catch {
          // The callback owns its error handling; polling continues.
        }
      }
      if (!cancelled) timer = window.setTimeout(tick, intervalMs)
    }

    if (immediate) {
      void tick()
    } else {
      timer = window.setTimeout(tick, intervalMs)
    }

    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [enabled, intervalMs, immediate, pauseWhenHidden])
}
