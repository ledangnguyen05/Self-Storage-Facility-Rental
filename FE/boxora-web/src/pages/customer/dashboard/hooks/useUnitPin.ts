import { useCallback, useEffect, useRef, useState } from 'react'
import { getApiErrorMessage, isRequestCanceled } from '@/lib/apiError'
import type { BookingPinData } from '@/services/bookingService'
import { fetchUnitAccess, type UnitAccessTarget } from '../lib/unitAccess'

export type UnitPinStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface UnitPinState {
  status: UnitPinStatus
  /** Empty when the backend has not issued a PIN yet. */
  pin: string
  qrAccessToken?: string
  revealed: boolean
  error?: string
}

const IDLE: UnitPinState = { status: 'idle', pin: '', revealed: false }

/**
 * Access PINs of the customer's units, keyed by contract id. A PIN is fetched
 * on first reveal and cached; a failed fetch shows an error instead of
 * revealing an empty box. In-flight requests are aborted on unmount.
 */
export function useUnitPin() {
  const [states, setStates] = useState<Record<string, UnitPinState>>({})
  const controllers = useRef(new Map<string, AbortController>())

  useEffect(() => {
    const active = controllers.current
    return () => {
      active.forEach(controller => controller.abort())
      active.clear()
    }
  }, [])

  const patch = useCallback((key: string, next: Partial<UnitPinState>) => {
    setStates(previous => ({ ...previous, [key]: { ...(previous[key] ?? IDLE), ...next } }))
  }, [])

  const load = useCallback(
    async (key: string, target: UnitAccessTarget) => {
      controllers.current.get(key)?.abort()
      const controller = new AbortController()
      controllers.current.set(key, controller)
      patch(key, { status: 'loading', error: undefined })
      try {
        const data = await fetchUnitAccess(target, controller.signal)
        if (controller.signal.aborted) return
        patch(key, { status: 'ready', pin: data.pin, qrAccessToken: data.qrAccessToken, revealed: true, error: undefined })
      } catch (err) {
        if (controller.signal.aborted || isRequestCanceled(err)) return
        patch(key, { status: 'error', revealed: false, error: getApiErrorMessage(err, 'Không thể tải mã PIN. Vui lòng thử lại.') })
      } finally {
        if (controllers.current.get(key) === controller) controllers.current.delete(key)
      }
    },
    [patch],
  )

  const get = useCallback((key: string): UnitPinState => states[key] ?? IDLE, [states])

  /** Reveal (fetching on first use) or hide the PIN. */
  const toggle = useCallback(
    (key: string, target: UnitAccessTarget) => {
      const current = states[key] ?? IDLE
      if (current.status === 'loading') return
      if (current.status === 'ready') {
        patch(key, { revealed: !current.revealed })
        return
      }
      void load(key, target)
    },
    [states, patch, load],
  )

  /** Store the PIN returned by a successful change. */
  const setPin = useCallback(
    (key: string, data: Pick<BookingPinData, 'pin' | 'qrAccessToken'>) => {
      patch(key, {
        status: 'ready',
        pin: data.pin,
        error: undefined,
        ...(data.qrAccessToken ? { qrAccessToken: data.qrAccessToken } : {}),
      })
    },
    [patch],
  )

  return { get, toggle, retry: load, setPin }
}

export type UnitPinApi = ReturnType<typeof useUnitPin>
