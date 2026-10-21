import { useEffect, useReducer } from 'react'

const secondsUntil = (expiresAt: string) => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))

/** Seconds left until `expiresAt` (re-rendered every second), or null when there is no deadline. */
export function useCountdown(expiresAt: string | null | undefined): number | null {
  const [, tick] = useReducer((count: number) => count + 1, 0)

  useEffect(() => {
    if (!expiresAt) return undefined
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [expiresAt])

  return expiresAt ? secondsUntil(expiresAt) : null
}

/** `3725` → `01:02:05` */
export function formatCountdown(totalSeconds: number): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(Math.floor(totalSeconds / 3600))}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(totalSeconds % 60)}`
}
