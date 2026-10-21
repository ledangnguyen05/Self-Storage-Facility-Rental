import { useEffect, useState } from 'react'
import { parseDate } from '@/lib/format'

export interface CountdownState {
  /** Seconds left, or null when there is no deadline. */
  secondsRemaining: number | null
  isExpired: boolean
  /** `HH:MM:SS`, or '' without a deadline. */
  label: string
}

const pad = (value: number) => String(value).padStart(2, '0')

/** Ticks once per second until `deadline`. The interval is cleared on unmount, on expiry and when the deadline changes. */
export function useCountdown(deadline: string | null | undefined): CountdownState {
  const targetTime = parseDate(deadline ?? null)?.getTime() ?? null
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (targetTime === null) return undefined
    const id = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= targetTime) window.clearInterval(id)
    }, 1000)
    return () => window.clearInterval(id)
  }, [targetTime])

  const secondsRemaining = targetTime === null ? null : Math.max(0, Math.floor((targetTime - now) / 1000))
  const label =
    secondsRemaining === null
      ? ''
      : `${pad(Math.floor(secondsRemaining / 3600))}:${pad(Math.floor((secondsRemaining % 3600) / 60))}:${pad(secondsRemaining % 60)}`

  return { secondsRemaining, isExpired: secondsRemaining !== null && secondsRemaining <= 0, label }
}
