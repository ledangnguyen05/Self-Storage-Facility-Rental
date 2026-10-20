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
    case 'RENEWAL_REJECTED': return 'Gia hạn bị từ chối'
    case 'RENEWAL_APPROVED': return 'Gia hạn được duyệt'
    case 'RENEWAL_REACTIVATED': return 'Duyệt lại gia hạn'
    case 'RENEWAL_COMPLETED': return 'Gia hạn thành công'
    case 'REFUND_STATUS': return 'Hoàn tiền'
    case 'SEALING_NOTICE': return 'Niêm phong'
    case 'UNSEALING_NOTICE': return 'Mở niêm phong'
    default: return type?.replaceAll('_', ' ') || 'Thông báo'
  }
}

const getTypeBadgeStyle = (type?: string) => {
  switch (type) {
    case 'HANDOVER_PIN':
    case 'HANDOVER_CHECKIN':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200'
    case 'RENEWAL_REJECTED':
      return 'bg-rose-100 text-rose-800 border-rose-200'
    case 'RENEWAL_APPROVED':
    case 'RENEWAL_COMPLETED':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    case 'RENEWAL_REMINDER_3D':
    case 'RENEWAL_REMINDER_7D':
      return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'SEALING_NOTICE':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
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

const getReadNotificationIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem('boxora_read_notification_ids')
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

const saveReadNotificationIds = (ids: Set<string>) => {
  try {
    localStorage.setItem('boxora_read_notification_ids', JSON.stringify(Array.from(ids)))
  } catch {
    // Ignore storage quota
  }
}

// Gentle pleasant audio chime using browser Web Audio API
const playNotificationChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12) // A5
    gain.gain.setValueAtTime(0.06, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
  } catch {
    // Audio autoplay restrictions
  }
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [items, setItems] = useState<NotificationLog[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadNotificationIds())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [hasNewAlert, setHasNewAlert] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'important'>('all')

  // Real-time floating Toast notification for new items
  const [floatingToast, setFloatingToast] = useState<NotificationLog | null>(null)
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)
  const requestIdRef = useRef(0)
  const knownIdsRef = useRef<Set<string>>(new Set())
  const isInitialLoadRef = useRef(true)

  const triggerNewNotificationToast = useCallback((notif: NotificationLog) => {
    setFloatingToast(notif)
    setHasNewAlert(true)
    playNotificationChime()

    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => {
      setFloatingToast(null)
    }, 8000)
  }, [])

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      saveReadNotificationIds(next)
      return next
    })
  }, [])

  const markAllAsRead = useCallback(() => {
    const next = new Set(readIds)
    items.forEach((item) => next.add(item.id))
    setReadIds(next)
    saveReadNotificationIds(next)
    setHasNewAlert(false)
  }, [items, readIds])

  const loadNotifications = useCallback(async (isBackgroundPoll = false) => {
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
    if (!isBackgroundPoll) {
      setIsLoading(true)
      setError('')
    }

    try {
      const page = await notificationService.getRecent({ recipientId: userId, page: 0, size: 25 })
      if (requestId === requestIdRef.current) {
        const remoteItems = page?.content ?? []
        const merged = [...localItems]
        for (const r of remoteItems) {
          if (!merged.some((m) => m.id === r.id)) {
            merged.push(r)
          }
        }

        // Sort descending by creation date
        merged.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())

        // Check for new notifications arriving after initial load
        if (!isInitialLoadRef.current && knownIdsRef.current.size > 0) {
          const newlyDiscovered = merged.find((item) => !knownIdsRef.current.has(item.id))
          if (newlyDiscovered) {
            triggerNewNotificationToast(newlyDiscovered)
          }
        }

        // Update known IDs
        merged.forEach((item) => knownIdsRef.current.add(item.id))
        isInitialLoadRef.current = false

        setItems(merged)
      }
    } catch {
      if (requestId === requestIdRef.current) {
        if (localItems.length > 0) {
          setItems(localItems)
          setError('')
        } else if (!isBackgroundPoll) {
          setError('Không tải được thông báo. Vui lòng thử lại.')
        }
      }
    } finally {
      if (requestId === requestIdRef.current && !isBackgroundPoll) {
        setIsLoading(false)
      }
    }
  }, [userId, triggerNewNotificationToast])

  // Load on mount or when userId changes
  useEffect(() => {
    requestIdRef.current += 1
    setError('')
    setExpandedId(null)
    isInitialLoadRef.current = true
    void loadNotifications()
  }, [userId, loadNotifications])

  // Periodic gentle polling every 20 seconds to catch real-time notifications
  useEffect(() => {
    if (!userId || !UUID_PATTERN.test(userId)) return

    const pollInterval = setInterval(() => {
      void loadNotifications(true)
    }, 20000)

    return () => clearInterval(pollInterval)
  }, [userId, loadNotifications])

  // Listen to real-time in-app pushes via custom events and storage changes
  useEffect(() => {
    const handleNewNotification = (event: Event) => {
      const customEvent = event as CustomEvent<NotificationLog>
      const newNotif = customEvent.detail
      if (!newNotif) return

      knownIdsRef.current.add(newNotif.id)
      triggerNewNotificationToast(newNotif)

      setItems((prev) => {
        if (prev.some((p) => p.id === newNotif.id)) return prev
        return [newNotif, ...prev]
      })
      setError('')
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'boxora_in_app_notifications') {
        void loadNotifications(true)
      }
    }

    window.addEventListener('boxora_notification_pushed', handleNewNotification)
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('boxora_notification_pushed', handleNewNotification)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [loadNotifications, triggerNewNotificationToast])

  // Close dropdown on click outside or Escape
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
    setHasNewAlert(false)
    if (nextOpen) void loadNotifications()
  }

  const handleNotificationClick = (item: NotificationLog) => {
    markAsRead(item.id)
    setExpandedId((prev) => (prev === item.id ? null : item.id))
  }

  const unreadCount = items.filter((item) => !readIds.has(item.id)).length

  // Filtered items based on active tab
  const filteredItems = items.filter((item) => {
    if (activeTab === 'unread') return !readIds.has(item.id)
    if (activeTab === 'important') {
      const type = item.notificationType || ''
      return type.includes('PIN') || type.includes('RENEWAL') || type.includes('SEALING')
    }
    return true
  })

  return (
    <>
      {/* FLOATING TOAST NOTIFICATION: Real-time pop-up banner when a new notification arrives */}
      {floatingToast && (
        <div className="fixed top-5 right-5 z-80 max-w-sm w-[calc(100vw-2.5rem)] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-4 shadow-2xl border border-blue-500/50 flex flex-col gap-2 relative overflow-hidden ring-4 ring-blue-500/20">
            {/* Ambient accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 animate-pulse" />

            <div className="flex items-start justify-between gap-3 pt-0.5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 ring-1 ring-blue-400/40">
                  <span className="material-symbols-outlined text-[18px] animate-bounce">notifications_active</span>
                </span>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>Thông Báo Mới</span>
                    <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  </h4>
                  <span className="text-[10px] text-slate-400">{formatDate(floatingToast.createdAt)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFloatingToast(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Đóng thông báo"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <div className="text-xs font-bold text-blue-200 mt-1 line-clamp-2">
              {floatingToast.title || 'Thông báo Boxora'}
            </div>

            <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
              {floatingToast.content}
            </p>

            <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-800">
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-950 text-blue-300 border border-blue-800">
                {getTypeLabel(floatingToast.notificationType)}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(true)
                  setExpandedId(floatingToast.id)
                  markAsRead(floatingToast.id)
                  setFloatingToast(null)
                }}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">visibility</span>
                <span>Xem chi tiết</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bell Button and Dropdown Panel */}
      <div ref={panelRef} className="relative">
        <button
          type="button"
          onClick={togglePanel}
          aria-label={unreadCount ? `Thông báo, ${unreadCount} chưa đọc` : 'Mở thông báo gần đây'}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls="dashboard-notifications-panel"
          title="Thông báo hệ thống"
          className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${
            isOpen
              ? 'border-blue-400 bg-blue-50 text-blue-700 shadow-md ring-2 ring-blue-500/20 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 dark:hover:bg-slate-800 shadow-xs'
          }`}
        >
          <span className={`material-symbols-outlined text-[20px] ${hasNewAlert || unreadCount > 0 ? 'animate-[wiggle_1s_ease-in-out_infinite]' : ''}`}>
            notifications
          </span>

          {/* Unread badge & Pulse indicator */}
          {unreadCount > 0 && (
            <>
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-extrabold leading-none text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-500 opacity-75 animate-ping pointer-events-none" />
            </>
          )}
        </button>

        {isOpen && (
          <section
            id="dashboard-notifications-panel"
            role="dialog"
            aria-label="Thông báo gần đây"
            className="absolute right-0 top-[calc(100%+0.6rem)] z-60 w-[min(28rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <header className="border-b border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/80 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">notifications</span>
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight flex items-center gap-1.5">
                      <span>Thông Báo Boxora</span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-blue-600 text-white">
                          {unreadCount} mới
                        </span>
                      )}
                    </h2>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Lịch sử sự kiện, mã kho & hợp đồng</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="px-2 py-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                      title="Đánh dấu tất cả thông báo là đã đọc"
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
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/60 hover:text-slate-900 transition disabled:opacity-50 cursor-pointer"
                  >
                    <span className={`material-symbols-outlined text-[17px] ${isLoading ? 'animate-spin text-blue-600' : ''}`}>refresh</span>
                  </button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    activeTab === 'all'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                  }`}
                >
                  Tất cả ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('unread')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                    activeTab === 'unread'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>Chưa đọc</span>
                  {unreadCount > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${activeTab === 'unread' ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-700'}`}>
                      {unreadCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('important')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    activeTab === 'important'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                  }`}
                >
                  Quan trọng
                </button>
              </div>
            </header>

            {/* Notifications List */}
            <div className="max-h-[min(65vh,30rem)] overflow-y-auto p-2.5 space-y-2">
              {isLoading && items.length === 0 ? (
                <div className="space-y-2 p-2" aria-live="polite">
                  {[0, 1, 2].map((row) => (
                    <div key={row} className="animate-pulse rounded-xl border border-slate-100 dark:border-slate-800 p-3 bg-slate-50/50">
                      <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
                      <div className="mt-2 h-2.5 w-full rounded bg-slate-200 dark:bg-slate-800" />
                      <div className="mt-2 h-2 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
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
                      className="mt-3 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition cursor-pointer"
                    >
                      Thử lại
                    </button>
                  )}
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-2">
                    <span className="material-symbols-outlined text-[24px]">notifications_none</span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {activeTab === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">Các thông báo mới nhất sẽ được tự động hiển thị tại đây.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {filteredItems.map((item) => {
                    const isExpanded = expandedId === item.id
                    const isUnread = !readIds.has(item.id)
                    const isPinNotif = item.notificationType === 'HANDOVER_PIN' || item.notificationType === 'HANDOVER_CHECKIN'

                    return (
                      <li key={item.id}>
                        <div
                          onClick={() => handleNotificationClick(item)}
                          className={`w-full rounded-2xl border text-left cursor-pointer transition-all duration-200 relative overflow-hidden ${
                            isExpanded
                              ? 'shadow-[0_12px_28px_-4px_rgba(37,99,235,0.22),0_8px_16px_-4px_rgba(37,99,235,0.12)] ring-2 ring-blue-500 border-blue-400 bg-white dark:bg-slate-800 scale-[1.01] z-10 p-3.5'
                              : isPinNotif
                              ? 'border-cyan-200/80 bg-cyan-50/40 hover:bg-cyan-50/80 hover:border-cyan-400 hover:shadow-md p-3'
                              : isUnread
                              ? 'border-blue-200 bg-blue-50/30 hover:bg-white hover:border-blue-300 hover:shadow-md p-3'
                              : 'border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-800/40 hover:bg-white hover:border-slate-300 hover:shadow-sm p-3'
                          }`}
                        >
                          {/* Accent left line indicator */}
                          <div
                            className={`absolute left-0 top-0 bottom-0 w-1 transition-all ${
                              isExpanded
                                ? 'bg-blue-600'
                                : isPinNotif
                                ? 'bg-cyan-500'
                                : isUnread
                                ? 'bg-blue-500'
                                : 'bg-transparent'
                            }`}
                          />

                          {/* "Đang xem chi tiết" badge when expanded */}
                          {isExpanded && (
                            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-blue-100 dark:border-slate-700">
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/70 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                                <span className="material-symbols-outlined text-[13px] text-blue-600 animate-pulse">visibility</span>
                                <span>Đang xem chi tiết thông báo</span>
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                #{item.id.slice(0, 8)}
                              </span>
                            </div>
                          )}

                          {/* Top Row: Icon, Title, and Badge */}
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-start gap-2 min-w-0 flex-1">
                              {/* Icon */}
                              <div className="mt-0.5 shrink-0">
                                {isPinNotif ? (
                                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
                                    <span className="material-symbols-outlined text-[15px]">key</span>
                                  </span>
                                ) : isUnread ? (
                                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300 relative">
                                    <span className="material-symbols-outlined text-[15px]">notifications</span>
                                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white dark:ring-slate-900" />
                                  </span>
                                ) : (
                                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                    <span className="material-symbols-outlined text-[15px]">mark_email_read</span>
                                  </span>
                                )}
                              </div>

                              {/* Title - FULL VISIBILITY without truncation */}
                              <div className="flex-1 min-w-0">
                                <h3 className={`text-xs font-bold leading-snug break-words ${
                                  isExpanded ? 'text-blue-950 dark:text-blue-100 text-[13px]' : 'text-slate-900 dark:text-slate-100'
                                }`}>
                                  {item.title || 'Thông báo Boxora'}
                                </h3>
                              </div>
                            </div>

                            {/* Badge */}
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold border ${getTypeBadgeStyle(item.notificationType)}`}>
                              {getTypeLabel(item.notificationType)}
                            </span>
                          </div>

                          {/* Content Body - FULL VISIBILITY */}
                          <div className="mt-2 pl-8">
                            <p className={`text-xs leading-relaxed text-slate-600 dark:text-slate-300 break-words ${
                              isExpanded ? 'whitespace-pre-wrap font-medium text-slate-800 dark:text-slate-200' : 'line-clamp-2'
                            }`}>
                              {item.content || 'Không có nội dung chi tiết.'}
                            </p>

                            {/* Highlights for PIN code or action details when expanded */}
                            {isExpanded && isPinNotif && item.content && (
                              <div className="mt-2.5 p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 text-cyan-900 dark:text-cyan-200 text-xs flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-[16px] text-cyan-600">lock_open</span>
                                  <span>Mã SmartLock PIN cá nhân hóa để truy cập kho trực tiếp</span>
                                </div>
                              </div>
                            )}

                            {/* Meta & Expand toggle */}
                            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-1.5">
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">schedule</span>
                                <span>{formatDate(item.createdAt)}</span>
                              </span>

                              <div className="flex items-center gap-2">
                                <span className={`font-semibold ${
                                  item.status === 'SENT' ? 'text-emerald-600' : 'text-slate-500'
                                }`}>
                                  {item.status === 'SENT' ? '✓ Đã nhận' : item.status || 'Hệ thống'}
                                </span>

                                <span className={`flex items-center gap-0.5 text-[10px] font-bold ${
                                  isExpanded ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'
                                }`}>
                                  <span>{isExpanded ? 'Thu gọn' : 'Xem hết'}</span>
                                  <span className={`material-symbols-outlined text-[14px] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                    expand_more
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && !error && (
              <footer className="border-t border-slate-100 dark:border-slate-800 px-4 py-2 bg-slate-50/70 dark:bg-slate-900 flex items-center justify-between text-[10px] text-slate-500">
                <span>Hiển thị {filteredItems.length}/{items.length} thông báo</span>
                <span className="text-slate-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">touch_app</span>
                  <span>Nhấn vào để xem đầy đủ</span>
                </span>
              </footer>
            )}
          </section>
        )}
      </div>
    </>
  )
}

export default NotificationCenter

