import { useCallback, useEffect, useRef } from 'react'
import { APP_EVENTS } from '../constants/storageKeys'
import { notificationService, type NotificationLog } from '../services/notificationService'
import {
  getBrowserNotificationPermission,
  getWebSettings,
  playAlertSound,
  showBrowserNotification,
} from '../utils/webSettings'
import { usePolling } from './usePolling'

/** Background tabs are throttled to about one tick a minute by browsers anyway. */
const POLL_INTERVAL_MS = 60_000
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Plays the alert sound and/or shows an OS notification for freshly arrived notifications, as the user's settings allow. */
function announce(items: readonly NotificationLog[]): void {
  if (items.length === 0) return
  const settings = getWebSettings()
  if (settings.enableEmergencySound) playAlertSound(settings.soundVolume)
  if (settings.enableNotifications) {
    const first = items[0]
    const title = items.length === 1 ? first.title || 'Thông báo Boxora' : `${items.length} thông báo mới từ Boxora`
    const body = items.length === 1 ? first.content : first.title
    showBrowserNotification(title, body, `boxora-${first.id}`)
  }
}

/**
 * Makes the "Âm báo" and "Thông báo của trình duyệt" settings real. While signed in it watches for
 * notifications that were not there before (server history, polled once a minute, plus in-app pushes) and
 * alerts the user. The first poll only records what already exists, so signing in never blasts old items.
 */
export function useNotificationAlerts(userId?: string): void {
  /** Ids already seen; null until the first successful poll has set the baseline. */
  const seenRef = useRef<Set<string> | null>(null)

  useEffect(() => {
    seenRef.current = null
  }, [userId])

  const check = useCallback(async () => {
    if (!userId || !UUID_PATTERN.test(userId)) return
    const settings = getWebSettings()
    const canDesktop = settings.enableNotifications && getBrowserNotificationPermission() === 'granted'
    if (!settings.enableEmergencySound && !canDesktop) {
      seenRef.current = null // re-baseline when the user turns an alert on later
      return
    }

    const page = await notificationService.getMine({ page: 0, size: 10 })
    const items = page?.content ?? []
    const known = seenRef.current
    seenRef.current = new Set([...(known ?? []), ...items.map((item) => item.id)])
    if (!known) return
    // Only what is new AND still unread: something read on another device must not ring here.
    announce(items.filter((item) => !known.has(item.id) && !item.readAt && !item.read))
  }, [userId])

  usePolling(check, POLL_INTERVAL_MS, Boolean(userId), { immediate: true, pauseWhenHidden: false })

  // Notifications pushed inside the app (for example by the staff workbench).
  useEffect(() => {
    if (!userId) return undefined
    const onPushed = (event: Event) => {
      const item = (event as CustomEvent<NotificationLog | undefined>).detail
      if (!item?.id) return
      if (item.recipientId && item.recipientId !== userId) return
      if (seenRef.current?.has(item.id)) return
      seenRef.current?.add(item.id)
      announce([item])
    }
    window.addEventListener(APP_EVENTS.notificationPushed, onPushed)
    return () => window.removeEventListener(APP_EVENTS.notificationPushed, onPushed)
  }, [userId])
}
