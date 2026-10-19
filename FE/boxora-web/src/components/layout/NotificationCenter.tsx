import React, { useCallback, useEffect, useRef, useState } from 'react'
import { NotificationLog, notificationService } from '../../services/notificationService'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface NotificationCenterProps {
  userId?: string
}

const formatDate = (value?: string) => {
  if (!value) return 'Thời gian không xác định'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Thời gian không xác định'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const getTypeLabel = (type?: string) => {
  switch (type) {
    case 'HANDOVER_PIN':
    case 'HANDOVER_CHECKIN': return 'Mã PIN & Bàn giao'
    case 'RENEWAL_REMINDER_3D': return 'Sắp hết hạn'
    case 'RENEWAL_REMINDER_7D': return 'Gia hạn'
    case 'REFUND_STATUS': return 'Hoàn tiền'
    case 'SEALING_NOTICE': return 'Niêm phong'
    case 'UNSEALING_NOTICE': return 'Mở niêm phong'
    default: return type?.replaceAll('_', ' ') || 'Thông báo'
  }
}

const getLocalNotifications = (userId?: string): NotificationLog[] => {
  try {
    const raw = localStorage.getItem('boxora_in_app_notifications')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((n: NotificationLog) => !n.recipientId || !userId || n.recipientId === userId)
  } catch {
    return []
  }
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [items, setItems] = useState<NotificationLog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const requestIdRef = useRef(0)

  const loadNotifications = useCallback(async () => {
    const localItems = getLocalNotifications(userId)

    if (!userId || !UUID_PATTERN.test(userId)) {
      requestIdRef.current += 1
      setItems(localItems)
      if (localItems.length === 0) {
        setError('Thông báo sẽ xuất hiện khi tài khoản có lịch sử được ghi nhận.')
      } else {
        setError('')
      }
      return
    }

    const requestId = ++requestIdRef.current
    setIsLoading(true)
    setError('')
    try {
      const page = await notificationService.getRecent({ recipientId: userId, page: 0, size: 10 })
      if (requestId === requestIdRef.current) {
        const remoteItems = page?.content ?? []
        const merged = [...localItems]
        for (const r of remoteItems) {
          if (!merged.some((m) => m.id === r.id)) {
            merged.push(r)
          }
        }
        setItems(merged)
      }
    } catch {
      if (requestId === requestIdRef.current) {
        if (localItems.length > 0) {
          setItems(localItems)
          setError('')
        } else {
          setError('Không tải được thông báo. Vui lòng thử lại.')
        }
      }
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false)
    }
  }, [userId])

  // Load on mount or when userId changes
  useEffect(() => {
    requestIdRef.current += 1
    setError('')
    setExpandedId(null)
    void loadNotifications()
  }, [userId, loadNotifications])

  // Listen to real-time in-app pushes
  useEffect(() => {
    const handleNewNotification = (event: Event) => {
      const customEvent = event as CustomEvent<NotificationLog>
      const newNotif = customEvent.detail
      if (!newNotif) return

      setItems((prev) => {
        if (prev.some((p) => p.id === newNotif.id)) return prev
        return [newNotif, ...prev]
      })
      setError('')
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'boxora_in_app_notifications') {
        void loadNotifications()
      }
    }

    window.addEventListener('boxora_notification_pushed', handleNewNotification)
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('boxora_notification_pushed', handleNewNotification)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [loadNotifications])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const togglePanel = () => {
    const nextOpen = !isOpen
    setIsOpen(nextOpen)
    if (nextOpen) void loadNotifications()
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={togglePanel}
        aria-label={items.length ? `Thông báo gần đây, ${items.length} mục` : 'Mở thông báo gần đây'}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="dashboard-notifications-panel"
        title="Thông báo gần đây"
        className={`relative flex h-9 w-9 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          isOpen
            ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-white dark:border-slate-900 bg-blue-600 px-1 text-[9px] font-bold leading-none text-white">
            {items.length > 9 ? '9+' : items.length}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          id="dashboard-notifications-panel"
          role="dialog"
          aria-label="Thông báo gần đây"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-60 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left shadow-xl"
        >
          <header className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3">
            <div>
              <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">Thông báo</h2>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Lịch sử mới nhất của tài khoản</p>
            </div>
            <div className="flex items-center gap-1">
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('boxora_in_app_notifications')
                    setItems([])
                  }}
                  className="px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                  title="Đánh dấu tất cả là đã đọc"
                >
                  Đã đọc tất cả
                </button>
              )}
              <button
                type="button"
                onClick={() => void loadNotifications()}
                disabled={isLoading}
                aria-label="Làm mới thông báo"
                title="Làm mới"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[19px] ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
              </button>
            </div>
          </header>

          <div className="max-h-[min(65vh,28rem)] overflow-y-auto p-2.5">
            {isLoading && items.length === 0 ? (
              <div className="space-y-2 p-2" aria-live="polite" aria-label="Đang tải thông báo">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="animate-pulse rounded-xl border border-slate-100 p-3">
                    <div className="h-3 w-2/3 rounded bg-slate-100" />
                    <div className="mt-2 h-2.5 w-full rounded bg-slate-100" />
                    <div className="mt-2 h-2.5 w-1/2 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="px-4 py-8 text-center">
                <span className="material-symbols-outlined text-[28px] text-slate-300">notifications_off</span>
                <p className="mt-2 text-xs leading-5 text-slate-500">{error}</p>
                {userId && UUID_PATTERN.test(userId) && (
                  <button
                    type="button"
                    onClick={() => void loadNotifications()}
                    className="mt-3 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                  >
                    Thử lại
                  </button>
                )}
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <span className="material-symbols-outlined text-[30px] text-slate-300">notifications_none</span>
                <p className="mt-2 text-xs font-semibold text-slate-700">Chưa có thông báo</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">Thông báo mới sẽ được hiển thị tại đây.</p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {items.map((item) => {
                  const expanded = expandedId === item.id
                  const isPinNotif = item.notificationType === 'HANDOVER_PIN' || item.notificationType === 'HANDOVER_CHECKIN'
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : item.id)}
                        aria-expanded={expanded}
                        className={`w-full rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 ${
                          isPinNotif
                            ? 'border-cyan-100 bg-cyan-50/40 hover:border-cyan-300 hover:bg-cyan-50/70'
                            : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isPinNotif && (
                              <span className="material-symbols-outlined text-[17px] text-cyan-700 shrink-0">key</span>
                            )}
                            <span className="text-xs font-bold leading-5 text-slate-900 truncate">
                              {item.title || 'Thông báo Boxora'}
                            </span>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              isPinNotif
                                ? 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {getTypeLabel(item.notificationType)}
                          </span>
                        </div>
                        <p className={`mt-1.5 text-[11px] leading-[1.45rem] ${isPinNotif ? 'text-slate-700 font-medium' : 'text-slate-600'} ${expanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
                          {item.content || 'Không có nội dung chi tiết.'}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] text-slate-400">
                          <span>{formatDate(item.createdAt)}</span>
                          <span className={isPinNotif ? 'text-cyan-700 font-semibold' : ''}>
                            {item.status === 'SENT' ? 'Đã gửi' : item.status || item.channel || 'Thông báo'}
                          </span>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {items.length > 0 && !error && (
            <footer className="border-t border-slate-100 px-4 py-2.5 text-center text-[10px] text-slate-400">
              Hiển thị {items.length} thông báo gần nhất
            </footer>
          )}
        </section>
      )}
    </div>
  )
}

export default NotificationCenter
