import { useEffect, useRef } from 'react'
import { markSilentSyncWindow } from '../utils/tabLoadingTracker'

const SYNC_CHANNEL_NAME = 'boxora_realtime_sync_channel'
const SYNC_STORAGE_KEY = 'boxora_last_sync_event'
export const DATA_SYNC_EVENT = 'boxora:data-sync'

export interface SyncEventDetail {
  url?: string
  method?: string
  ts: number
  sourceTabId?: string
}

const TAB_ID = typeof window !== 'undefined'
  ? `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  : 'server'

let broadcastChannel: BroadcastChannel | null = null
let isListenerInitialized = false

function initCrossTabListeners() {
  if (typeof window === 'undefined' || isListenerInitialized) return
  isListenerInitialized = true

  try {
    if ('BroadcastChannel' in window) {
      broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME)
      broadcastChannel.onmessage = (event: MessageEvent<SyncEventDetail>) => {
        const data = event?.data
        if (!data || data.sourceTabId === TAB_ID) return
        dispatchLocalSyncEvents(data)
      }
    }
  } catch {
    // Ignore BroadcastChannel errors in restricted environments
  }

  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key === SYNC_STORAGE_KEY && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue) as SyncEventDetail
        if (parsed && parsed.sourceTabId !== TAB_ID) {
          dispatchLocalSyncEvents(parsed)
        }
      } catch {
        // Ignore malformed storage payload
      }
    } else if (event.key === 'boxora_guest_reservations') {
      dispatchLocalSyncEvents({ ts: Date.now() })
    }
  })
}

function dispatchLocalSyncEvents(detail: SyncEventDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(DATA_SYNC_EVENT, { detail }))
  window.dispatchEvent(new Event('boxora:storage-units-refresh'))
  window.dispatchEvent(new Event('boxora:notifications-refresh'))
}

/**
 * Broadcasts a data synchronization signal to the current tab AND all other open browser tabs.
 * Automatically invoked by axios response interceptor after any successful mutation.
 */
export function broadcastDataSync(url?: string, method?: string) {
  if (typeof window === 'undefined') return
  initCrossTabListeners()

  const detail: SyncEventDetail = {
    url,
    method,
    ts: Date.now(),
    sourceTabId: TAB_ID,
  }

  dispatchLocalSyncEvents(detail)

  try {
    broadcastChannel?.postMessage(detail)
  } catch {
    // Ignore
  }

  try {
    localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(detail))
  } catch {
    // Ignore storage quota errors
  }
}

export interface UseRealtimeSyncOptions {
  /** Polling interval in milliseconds while tab is visible (default: 5000ms) */
  intervalMs?: number
  /** Whether synchronization is active (default: true) */
  enabled?: boolean
  /** Debounce delay in ms for event-driven refreshes (default: 250ms) */
  debounceMs?: number
}

/**
 * Keeps component data automatically synchronized in real time without requiring F5:
 * 1. Instant refresh (debounced) when any mutation happens in this tab or another browser tab (BroadcastChannel + localStorage).
 * 2. Instant refresh when the user focuses the window or switches back to the tab (visibilitychange / focus).
 * 3. Silent periodic polling while the tab is visible so changes from other devices/browsers appear automatically.
 */
export function useRealtimeSync(
  onSync: () => void | Promise<unknown>,
  options: UseRealtimeSyncOptions = {}
) {
  const { intervalMs = 3000, enabled = true, debounceMs = 80 } = options
  const onSyncRef = useRef(onSync)
  onSyncRef.current = onSync

  const isRunningRef = useRef(false)
  const pendingRerunRef = useRef(false)
  const debounceTimerRef = useRef<number | null>(null)
  const lastRunAtRef = useRef<number>(0)

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return
    initCrossTabListeners()

    const executeSync = async (isPeriodicTick = false) => {
      if (isPeriodicTick && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return
      }
      if (isRunningRef.current) {
        pendingRerunRef.current = true
        return
      }
      isRunningRef.current = true
      lastRunAtRef.current = Date.now()
      markSilentSyncWindow(400)
      try {
        await onSyncRef.current()
      } catch {
        // Silent background sync error handling
      } finally {
        isRunningRef.current = false
        if (pendingRerunRef.current) {
          pendingRerunRef.current = false
          scheduleSync()
        }
      }
    }

    function scheduleSync() {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null
        void executeSync(false)
      }, debounceMs)
    }

    const handleVisibilityOrFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        if (Date.now() - lastRunAtRef.current > 300) {
          scheduleSync()
        }
      }
    }

    window.addEventListener(DATA_SYNC_EVENT, scheduleSync)
    window.addEventListener('storage', scheduleSync)
    window.addEventListener('boxora:storage-units-refresh', scheduleSync)
    window.addEventListener('boxora:notifications-refresh', scheduleSync)
    window.addEventListener('boxora_reservation_updated', scheduleSync)
    window.addEventListener('boxora_reservation_status_changed', scheduleSync)
    window.addEventListener('boxora_rental_updated', scheduleSync)
    window.addEventListener('focus', handleVisibilityOrFocus)
    document.addEventListener('visibilitychange', handleVisibilityOrFocus)

    const effectiveInterval = Math.min(intervalMs, 4000)
    const intervalId = effectiveInterval > 0
      ? window.setInterval(() => {
          void executeSync(true)
        }, effectiveInterval)
      : null

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current)
      }
      if (intervalId !== null) {
        window.clearInterval(intervalId)
      }
      window.removeEventListener(DATA_SYNC_EVENT, scheduleSync)
      window.removeEventListener('storage', scheduleSync)
      window.removeEventListener('boxora:storage-units-refresh', scheduleSync)
      window.removeEventListener('boxora:notifications-refresh', scheduleSync)
      window.removeEventListener('boxora_reservation_updated', scheduleSync)
      window.removeEventListener('boxora_reservation_status_changed', scheduleSync)
      window.removeEventListener('boxora_rental_updated', scheduleSync)
      window.removeEventListener('focus', handleVisibilityOrFocus)
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
    }
  }, [enabled, intervalMs, debounceMs])
}

