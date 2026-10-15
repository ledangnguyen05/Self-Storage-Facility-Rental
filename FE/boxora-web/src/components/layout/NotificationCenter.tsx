import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
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
    case 'BOOKING_CREATED': return 'Yêu cầu đã ghi nhận'
    case 'BOOKING_APPROVAL_REQUEST': return 'Chờ duyệt'
    case 'BOOKING_PREPARATION': return 'Chuẩn bị kho'
    case 'RENEWAL_REMINDER_3D': return 'Sắp hết hạn'
    case 'RENEWAL_REMINDER_7D': return 'Gia hạn'
    case 'REFUND_STATUS': return 'Hoàn tiền'
    case 'SEALING_NOTICE': return 'Niêm phong'
    case 'UNSEALING_NOTICE': return 'Mở niêm phong'
    default: return type?.replaceAll('_', ' ') || 'Thông báo'
  }
}

const getNotificationAction = (item: NotificationLog, role?: string | null) => {
  if (item.notificationType === 'BOOKING_APPROVAL_REQUEST'
    && ['ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER'].includes(role || '')
    && item.referenceId) {
    return {
      label: 'Xem & duyệt',
      to: `/portal/facility-manager?bookingApprovalId=${encodeURIComponent(item.referenceId)}`,
    }
  }

  if (item.notificationType === 'BOOKING_PREPARATION' && role === 'STAFF' && item.referenceId) {
    return {
      label: 'Xem chi tiết kho',
      to: `/portal/staff?bookingId=${encodeURIComponent(item.referenceId)}`,
    }
  }

  if (item.notificationType === 'BOOKING_CREATED' && role === 'CUSTOMER') {
    return { label: 'Xem yêu cầu đặt chỗ', to: '/portal/customer?tab=requests' }
  }

  return null
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ userId }) => {
  const { role } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [items, setItems] = useState<NotificationLog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    requestIdRef.current += 1
    setItems([])
    setError('')
    setExpandedId(null)
    setIsLoading(false)
  }, [userId])

  const loadNotifications = useCallback(async () => {
    if (!userId || !UUID_PATTERN.test(userId)) {
      requestIdRef.current += 1
      setItems([])
      setError('Thông báo sẽ xuất hiện khi tài khoản có lịch sử được ghi nhận.')
      return
    }

    const requestId = ++requestIdRef.current
    setIsLoading(true)
    setError('')
    try {
      const page = await notificationService.getRecent({ recipientId: userId, page: 0, size: 6 })
      if (requestId === requestIdRef.current) setItems(page?.content ?? [])
    } catch {
      if (requestId === requestIdRef.current) setError('Không tải được thông báo. Vui lòng thử lại.')
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (userId && UUID_PATTERN.test(userId)) {
      void loadNotifications()
    }
  }, [userId, loadNotifications])

  useEffect(() => {
    const refreshAfterBooking = () => { void loadNotifications() }
    window.addEventListener('boxora:notifications-refresh', refreshAfterBooking)
    return () => window.removeEventListener('boxora:notifications-refresh', refreshAfterBooking)
  }, [loadNotifications])

  useEffect(() => {
    if (!userId || !UUID_PATTERN.test(userId)) return

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadNotifications()
    }
    const intervalId = window.setInterval(refreshWhenVisible, 30_000)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [userId, loadNotifications])

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
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 ${isOpen ? 'border-cyan-200 bg-cyan-50 text-cyan-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
      >
        <span className="material-symbols-outlined text-[21px]">notifications</span>
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-cyan-700 px-1 text-[9px] font-bold leading-none text-white">
            {items.length > 9 ? '9+' : items.length}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          id="dashboard-notifications-panel"
          role="dialog"
          aria-label="Thông báo gần đây"
          className="absolute right-0 top-[calc(100%+0.75rem)] z-[60] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-[0_18px_55px_rgba(15,23,42,0.18)]"
        >
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Thông báo</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">Lịch sử mới nhất của tài khoản</p>
            </div>
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
                  const action = getNotificationAction(item, role)
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : item.id)}
                        aria-expanded={expanded}
                        className="w-full rounded-xl border border-transparent px-3 py-3 text-left transition-colors hover:border-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-xs font-bold leading-5 text-slate-900">{item.title || 'Thông báo Boxora'}</span>
                          <span className="shrink-0 rounded-full bg-cyan-50 px-2 py-1 text-[9px] font-bold text-cyan-800">
                            {getTypeLabel(item.notificationType)}
                          </span>
                        </div>
                        <p className={`mt-1.5 text-[11px] leading-[1.45rem] text-slate-600 ${expanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
                          {item.content || 'Không có nội dung chi tiết.'}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] text-slate-400">
                          <span>{formatDate(item.createdAt)}</span>
                          <span>{item.status === 'SENT' ? 'Đã gửi' : item.status || item.channel || 'Thông báo'}</span>
                        </div>
                      </button>
                      {expanded && action && (
                        <Link
                          to={action.to}
                          onClick={() => setIsOpen(false)}
                          className="mx-2 mt-1 inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-3 py-2 text-[11px] font-bold text-white transition-colors hover:bg-cyan-800"
                        >
                          <span>{action.label}</span>
                          <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                        </Link>
                      )}
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
