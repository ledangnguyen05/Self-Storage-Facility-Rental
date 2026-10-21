import { useCallback } from 'react'
import { useAsyncData } from '../../hooks/useAsyncData'
import { usePolling } from '../../hooks/usePolling'
import { isRequestCanceled } from '../../lib/apiError'
import { notificationService, type NotificationLog } from '../../services/notificationService'

/** The unread badge is refreshed this often while the tab is visible. */
const UNREAD_POLL_MS = 60_000
const FEED_SIZE = 15

const NO_ITEMS: NotificationLog[] = []

/**
 * The signed-in account's notification feed. Read state lives on the server
 * (`read_at`), so it is the same on every device and survives clearing the browser.
 * Marking read updates the screen first and falls back to a reload if the call fails.
 */
export function useNotificationFeed(userId: string | undefined) {
  const enabled = Boolean(userId)

  const feed = useAsyncData((signal) => notificationService.getMine({ size: FEED_SIZE }, { signal }), [userId], {
    enabled,
    keepPreviousData: false,
  })
  const unread = useAsyncData((signal) => notificationService.getUnreadCount({ signal }), [userId], {
    enabled,
    keepPreviousData: false,
  })
  const { reload: reloadFeed, setData: setFeed, data: feedData } = feed
  const { reload: reloadUnread, setData: setUnread } = unread

  usePolling(reloadUnread, UNREAD_POLL_MS, enabled)

  const reload = useCallback(async () => {
    await Promise.all([reloadFeed(), reloadUnread()])
  }, [reloadFeed, reloadUnread])

  /** Marks one notification as read. Resolves false when the server refused (the feed is then reloaded). */
  const markRead = useCallback(
    async (id: string): Promise<boolean> => {
      const target = feedData?.content.find((item) => item.id === id)
      if (!target || target.read) return true
      const stamp = new Date().toISOString()
      setFeed((current) =>
        current
          ? { ...current, content: current.content.map((item) => (item.id === id ? { ...item, read: true, readAt: stamp } : item)) }
          : current,
      )
      setUnread((current) => Math.max(0, (current ?? 0) - 1))
      try {
        await notificationService.markRead(id)
        return true
      } catch (err) {
        if (!isRequestCanceled(err)) await reload()
        return false
      }
    },
    [feedData, reload, setFeed, setUnread],
  )

  /** Marks everything as read. Resolves false on failure. */
  const markAllRead = useCallback(async (): Promise<boolean> => {
    try {
      await notificationService.markAllRead()
      await reload()
      return true
    } catch (err) {
      if (!isRequestCanceled(err)) await reload()
      return false
    }
  }, [reload])

  const items = feed.data?.content ?? NO_ITEMS

  return {
    items,
    /** Server count: includes notifications older than the ones listed. */
    unreadCount: unread.data ?? items.filter((item) => !item.read).length,
    isLoading: enabled && feed.isLoading,
    isRefreshing: enabled && (feed.isRefreshing || feed.isLoading),
    error: feed.error,
    reload,
    markRead,
    markAllRead,
  }
}
