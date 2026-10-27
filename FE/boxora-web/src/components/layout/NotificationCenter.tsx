import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

import { NotificationLog, notificationService } from '../../services/notificationService'
import { reservationEmailService } from '../../services/reservationEmailService'
import { bookingService } from '../../services/bookingService'
import { useAuth } from '../../context/AuthContext'
import { Check, X, Phone, Mail, Building2, Calendar, Clock, AlertCircle, FileText, Send, User, ChevronRight } from 'lucide-react'

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
    case 'NEW_BOOKING_RESERVATION': return 'Đơn giữ chỗ mới'
    case 'HANDOVER_PIN':
    case 'HANDOVER_CHECKIN': return 'Mã PIN & Bàn giao'

    case 'RENEWAL_REMINDER_3D': return 'Sắp hết hạn'
    case 'RENEWAL_REMINDER_7D': return 'Gia hạn'
    case 'REFUND_STATUS': return 'Hoàn tiền'
    case 'SEALING_NOTICE': return 'Niêm phong'
    case 'UNSEALING_NOTICE': return 'Mở niêm phong'
    case 'SUPPORT_TICKET_UPDATE': return 'Cập nhật yêu cầu'
    case 'REFUND_BANK_INFO_REQUIRED': return 'Cần nhập STK'
    case 'REFUND_PAYOUT_COMPLETED': return 'Đã hoàn tiền'
    default: return type?.replaceAll('_', ' ') || 'Thông báo'
  }
}

const getTypeBadgeStyle = (type?: string) => {
  switch (type) {
    case 'NEW_BOOKING_RESERVATION':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'HANDOVER_PIN':
    case 'HANDOVER_CHECKIN':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200'
    case 'RENEWAL_REJECTED':
      return 'bg-rose-100 text-rose-800 border-rose-200'
    case 'RENEWAL_APPROVED':
    case 'RENEWAL_COMPLETED':
    case 'REFUND_PAYOUT_COMPLETED':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    case 'RENEWAL_REMINDER_3D':
    case 'RENEWAL_REMINDER_7D':
    case 'REFUND_BANK_INFO_REQUIRED':
      return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'SUPPORT_TICKET_UPDATE':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'SEALING_NOTICE':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
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

const getNotificationAction = (item: NotificationLog, role?: string | null) => {
  if (item.notificationType === 'BOOKING_PREPARATION' && role === 'STAFF' && item.referenceId) {
    return {
      label: 'Xem chi tiết kho',
      to: `/portal/staff?bookingId=${encodeURIComponent(item.referenceId)}`,
    }
  }

  if (item.notificationType === 'BOOKING_CREATED' && role === 'CUSTOMER') {
    return { label: 'Xem đơn đặt giữ chỗ', to: '/portal/customer?tab=bookings' }
  }

  if (
    (item.notificationType === 'SUPPORT_TICKET_UPDATE' ||
      item.notificationType === 'REFUND_BANK_INFO_REQUIRED' ||
      item.notificationType === 'REFUND_PAYOUT_COMPLETED') &&
    role === 'CUSTOMER'
  ) {
    return { label: 'Xem yêu cầu hỗ trợ', to: '/portal/customer?tab=support' }
  }

  return null
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ userId }) => {
  const navigate = useNavigate()
  const { user, role } = useAuth()

  const [isOpen, setIsOpen] = useState(false)
  const [items, setItems] = useState<NotificationLog[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadNotificationIds())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [hasNewAlert, setHasNewAlert] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'important'>('all')

  const markAsRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      saveReadNotificationIds(next)
      return next
    })
  }

  // Real-time floating Toast notification for new items
  const [floatingToast, setFloatingToast] = useState<NotificationLog | null>(null)
  const [reviewBooking, setReviewBooking] = useState<any | null>(null)
  const [isRejecting, setIsRejecting] = useState<boolean>(false)
  const [rejectionReason, setRejectionReason] = useState<string>('')
  const [rejectionError, setRejectionError] = useState<string>('')
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null)
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false)
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false)
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null)


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

  const handleNotificationClick = (item: NotificationLog) => {
    markAsRead(item.id)
    setExpandedId((prev) => (prev === item.id ? null : item.id))

    // Khi nhân viên nhấn vào thông báo trong nút chuông: nhảy vào mục Đơn chờ xử lý ở dashboard nhân viên
    const isBookingNotif = item.notificationType === 'NEW_BOOKING_RESERVATION' ||
      item.referenceType === 'BOOKING' ||
      (item.title && (item.title.includes('Đơn giữ chỗ') || item.title.includes('đơn giữ chỗ')))

    if (isBookingNotif) {
      const code = item.referenceId || (item.title ? item.title.replace(/.*Đơn giữ chỗ(?: mới)?:?\s*/i, '').trim() : '')
      setIsOpen(false)

      const userRole = String(user?.role?.name || user?.roleName || '').toUpperCase()
      if (userRole === 'STAFF' || userRole === 'FACILITY_MANAGER' || userRole === 'OPERATIONS_STAFF') {
        window.dispatchEvent(new CustomEvent('boxora_select_staff_pending_booking', { detail: { bookingCode: code } }))
        navigate(`/staff?tab=pending_orders${code ? `&bookingCode=${encodeURIComponent(code)}` : ''}`)
        return
      }

      if (code) {
        let found = reservationEmailService.getReservationByCode(code)
        if (!found) {
          // Fallback parsing from notification details
          found = {
            id: `RES-${code}`,
            bookingCode: code,
            customerName: item.content?.match(/Khách hàng ([^(]+)/)?.[1]?.trim() || item.recipientName || 'Khách đặt giữ chỗ',
            customerPhone: item.content?.match(/\(([^)]+)\)/)?.[1]?.trim() || '',
            identityCardNumber: 'Đối chiếu khi check-in',
            customerEmail: item.recipientEmail || 'customer@boxora.vn',
            facilityName: item.facilityName || 'Cơ sở Boxora',
            unitCode: item.content?.match(/kho ([^t]+) tại/)?.[1]?.trim() || 'Kho tự quản Boxora',
            checkInDate: item.content?.match(/Lịch hẹn: ([^(]+)/)?.[1]?.trim() || 'Theo lịch hẹn',
            checkInTime: item.content?.match(/\(([^)]+)\)\./)?.[1]?.trim() || 'Giờ tiếp đón',
            status: 'PENDING_CONTACT',
            createdAt: item.createdAt,
            totalRentalFee: 0,
            depositAmount: 0,
          }
        }
        setReviewBooking(found)
        setIsRejecting(false)
        setRejectionReason('')
        setActionSuccessMsg(null)
      }
    }
  }

  // Xử lý xác nhận đơn: gọi backend API và gửi email
  const handleExecuteConfirmReservation = async () => {
    if (!reviewBooking) return
    setIsProcessingAction(true)
    try {
      const isBackendId = reviewBooking.id && !reviewBooking.id.startsWith('LOCAL-RES-')
      const targetIdOrCode = isBackendId ? reviewBooking.id : reviewBooking.bookingCode
      const updated = await bookingService.confirmBooking(targetIdOrCode)
      reservationEmailService.confirmReservation(reviewBooking.bookingCode, {
        id: user?.id,
        fullName: user?.fullName || 'Nhân viên trực ca Boxora',
      })
      setReviewBooking((prev: any) => ({ ...prev, status: updated?.status || 'CONFIRMED' }))
      setActionSuccessMsg('Đã xác nhận đơn đặt giữ chỗ thành công (Chờ check in).')
      setIsConfirmDialogOpen(false)
      setTimeout(() => setActionSuccessMsg(null), 5000)
      window.dispatchEvent(new Event('boxora:storage-units-refresh'))
    } catch (err: any) {
      console.error('Confirm booking error:', err)
      alert(err.response?.data?.message || err.message || 'Không thể xác nhận đơn trên máy chủ')
    } finally {
      setIsProcessingAction(false)
    }
  }

  // Xử lý từ chối đơn: có điền lý do, chuyển trạng thái sang CANCELLED & gửi email cho khách
  const handleRejectReservationAction = async () => {
    if (!reviewBooking) return
    const trimmedReason = (rejectionReason || '').trim()
    if (!trimmedReason) {
      setRejectionError('Vui lòng điền hoặc chọn lý do từ chối đơn đặt giữ chỗ.')
      return
    }
    if (trimmedReason.length < 5) {
      setRejectionError('Lý do từ chối quá ngắn. Vui lòng nhập tối thiểu 5 ký tự để gửi giải thích cho khách hàng.')
      return
    }

    setRejectionError('')
    setIsProcessingAction(true)
    try {
      const isBackendId = reviewBooking.id && !reviewBooking.id.startsWith('LOCAL-RES-')
      const targetIdOrCode = isBackendId ? reviewBooking.id : reviewBooking.bookingCode
      const cancelRes = await bookingService.cancelBooking(targetIdOrCode, trimmedReason)
      reservationEmailService.rejectReservation(reviewBooking.bookingCode, trimmedReason, {
        id: user?.id,
        fullName: user?.fullName || 'Nhân viên trực ca Boxora',
      })
      setReviewBooking((prev: any) => ({
        ...prev,
        status: cancelRes?.status || 'CANCELLED',
        rejectionReason: trimmedReason,
        cancelledAt: new Date().toISOString()
      }))
      setIsRejecting(false)
      setRejectionReason('')
      setRejectionError('')
      setActionSuccessMsg('Đã từ chối đơn đặt giữ chỗ thành công.')
      setTimeout(() => setActionSuccessMsg(null), 5000)
      window.dispatchEvent(new Event('boxora:storage-units-refresh'))
    } catch (err: any) {
      console.error('Reject booking error:', err)
      setRejectionError(err.response?.data?.message || err.message || 'Không thể từ chối đơn trên máy chủ')
    } finally {
      setIsProcessingAction(false)
    }
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
                  handleNotificationClick(floatingToast)
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
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
              {unreadCount > 9 ? '9+' : unreadCount}
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
        </section>
        )}
      </div>
      {/* CONFIRMATION DIALOG MODAL CHO XÁC NHẬN ĐƠN */}
      {isConfirmDialogOpen && reviewBooking && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col text-left animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-700 text-white p-5 flex items-center justify-between border-b border-emerald-800">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center font-bold">
                  <Check size={20} />
                </span>
                <div>
                  <h3 className="font-extrabold text-base">Xác Nhận Đơn Đặt Giữ Chỗ</h3>
                  <span className="text-xs font-mono text-emerald-100">Mã đơn: {reviewBooking.bookingCode}</span>
                </div>
              </div>
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => setIsConfirmDialogOpen(false)}
                className="w-8 h-8 rounded-full bg-emerald-800 hover:bg-emerald-900 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs sm:text-sm">
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 space-y-1.5 font-mono text-xs">
                <div>Khách hàng: <strong className="text-slate-900 dark:text-white font-sans">{reviewBooking.customerName}</strong> ({reviewBooking.customerPhone || 'Không có SĐT'})</div>
                <div>Cơ sở: <strong className="text-slate-900 dark:text-white">{reviewBooking.facilityName}</strong> · {reviewBooking.unitCode ? `Kho #${reviewBooking.unitCode}` : 'Chưa gán ô kho vật lý'}</div>
                <div>Lịch hẹn nhận kho: <strong className="text-emerald-700 dark:text-emerald-400">{reviewBooking.checkInDate} ({reviewBooking.checkInTime || '09:00'})</strong></div>
                <div>Thời hạn thuê: <strong>{reviewBooking.rentalDurationText || (reviewBooking.rentalMonths ? `${reviewBooking.rentalMonths} tháng` : '1 tháng')}</strong></div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Bạn có chắc chắn muốn xác nhận đơn đặt giữ chỗ này? Trạng thái đơn sẽ chuyển sang <strong className="font-bold underline">Chờ check in</strong> (CONFIRMED) và hệ thống sẽ gửi thông báo xác nhận lịch hẹn nhận kho cho khách hàng.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => setIsConfirmDialogOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer transition disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={handleExecuteConfirmReservation}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isProcessingAction ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Đang xác nhận...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Xác nhận đơn (Chờ check in)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM CHI TIẾT ĐƠN GIỮ CHỖ & XÁC NHẬN / TỪ CHỐI (KHI BẤM TỪ THÔNG BÁO) */}
      {reviewBooking && (
        <div className="fixed inset-0 z-90 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-left animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-50 via-white to-cyan-50 text-slate-900 p-5 sm:p-6 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/30">
                  <FileText size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                      Xem Đơn Đặt Giữ Chỗ
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                      reviewBooking.status === 'CONFIRMED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : reviewBooking.status === 'CANCELLED'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                    }`}>
                      {reviewBooking.status === 'CONFIRMED'
                        ? 'Chờ check in'
                        : reviewBooking.status === 'CANCELLED'
                        ? 'Đã từ chối'
                        : 'Chờ xác nhận'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 mt-0.5">
                    <span>Mã đơn: <strong>{reviewBooking.bookingCode}</strong></span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setReviewBooking(null)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto text-xs sm:text-sm">
              
              {/* Toast thông báo kết quả thao tác */}
              {actionSuccessMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-600 text-white text-xs font-medium flex items-center gap-2 shadow-lg shadow-emerald-600/25 animate-in fade-in">
                  <Check size={18} className="shrink-0" />
                  <span>{actionSuccessMsg}</span>
                </div>
              )}

              {/* Thông báo trạng thái */}
              {reviewBooking.status === 'CONFIRMED' ? (
                <div className="p-3.5 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/60 text-cyan-900 dark:text-cyan-200 text-xs flex items-start gap-2.5">
                  <Clock size={16} className="text-cyan-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Đơn đã được xác nhận (Trạng thái: Chờ check in)</strong>
                    <span>Khách hàng sẽ mang CCCD bản gốc đến cơ sở nhận kho theo lịch hẹn. Hệ thống đã gửi email xác nhận.</span>
                  </div>
                </div>
              ) : reviewBooking.status === 'CANCELLED' ? (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Đơn này đã bị từ chối / hủy</strong>
                    <span>Lý do từ chối: "{reviewBooking.rejectionReason || 'Theo thông báo của nhân viên'}"</span>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
                  <Clock size={16} className="text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <strong className="block font-semibold">Đơn đang ở trạng thái: Chờ xác nhận</strong>
                    <span>Vui lòng liên hệ khách hàng qua số điện thoại bên dưới để đối soát thông tin, sau đó bấm Xác nhận hoặc Từ chối kèm lý do.</span>
                  </div>
                </div>
              )}

              {/* Grid thông tin chi tiết */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase">Khách hàng:</span>
                  <strong className="text-slate-900 dark:text-white font-sans text-xs">{reviewBooking.customerName}</strong>
                  <div className="flex items-center gap-1.5 text-blue-600 dark:text-cyan-400 text-xs mt-0.5 font-mono">
                    <Phone size={12} />
                    <a href={`tel:${reviewBooking.customerPhone}`} className="hover:underline font-bold">
                      {reviewBooking.customerPhone}
                    </a>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase">CCCD đối chiếu &amp; Email:</span>
                  <strong className="text-slate-900 dark:text-white text-xs block">{reviewBooking.identityCardNumber || 'Chưa cung cấp'}</strong>
                  <span className="text-[11px] text-slate-500 font-sans truncate block mt-0.5">
                    {reviewBooking.customerEmail || 'customer@boxora.vn'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase">Cơ sở tiếp đón:</span>
                  <strong className="text-slate-900 dark:text-white font-sans text-xs">{reviewBooking.facilityName}</strong>
                  <span className="text-[11px] text-slate-500 block truncate font-sans mt-0.5">
                    Kho: {reviewBooking.unitCode || 'Kho tự quản Boxora'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase">Lịch hẹn đón tiếp:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400 text-xs">
                    {reviewBooking.checkInDate} ({reviewBooking.checkInTime})
                  </strong>
                  <span className="text-[10px] text-slate-400 block font-sans mt-0.5">
                    Thời hạn thuê: {reviewBooking.rentalDurationText || (reviewBooking.rentalMonths ? `${reviewBooking.rentalMonths} tháng` : '1 tháng')}
                  </span>
                </div>
              </div>

              {/* Khối Điền lý do từ chối (khi nhân viên chọn Từ chối) */}
              {isRejecting && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800/80 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between text-rose-900 dark:text-rose-200 font-bold text-xs">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={16} className="text-rose-600" />
                      <span>Lý do từ chối đơn đặt giữ chỗ (Bắt buộc):</span>
                    </div>
                    <span className={`text-[11px] font-mono font-medium ${
                      rejectionReason.trim().length > 0 && rejectionReason.trim().length < 5
                        ? 'text-rose-600 font-bold'
                        : 'text-slate-400'
                    }`}>
                      {rejectionReason.trim().length}/5 ký tự
                    </span>
                  </div>

                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => {
                      const val = e.target.value
                      setRejectionReason(val)
                      if (rejectionError && val.trim().length >= 5) {
                        setRejectionError('')
                      }
                    }}
                    placeholder="Nhập chi tiết lý do từ chối đơn (nội dung này sẽ được gửi email tới khách hàng)..."
                    className={`w-full p-3 rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none transition-all resize-none ${
                      rejectionError
                        ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/30'
                        : 'border-rose-300 dark:border-rose-700 focus:ring-2 focus:ring-rose-500'
                    }`}
                  />

                  {/* Validate hiển thị trực tiếp trong form thay vì alert */}
                  {rejectionError && (
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-white dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs shadow-xs animate-in fade-in slide-in-from-top-1">
                      <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                      <span className="font-semibold leading-relaxed">{rejectionError}</span>
                    </div>
                  )}

                  {/* Các lý do mẫu để chọn nhanh */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-300 block">
                      Chọn nhanh lý do mẫu:
                    </span>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      {[
                        'Không liên lạc được qua số điện thoại sau nhiều lần gọi',
                        'Khách hàng đổi ý / không còn nhu cầu thuê kho',
                        'Cơ sở tạm hết buồng kho theo quy cách yêu cầu',
                        'Thông tin CCCD hoặc số điện thoại không hợp lệ',
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setRejectionReason(preset)
                            setRejectionError('')
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 text-slate-700 dark:text-slate-300 text-[10.5px] transition-colors cursor-pointer"
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-200/60">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRejecting(false)
                        setRejectionError('')
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      disabled={isProcessingAction}
                      onClick={handleRejectReservationAction}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send size={13} />
                      <span>{isProcessingAction ? 'Đang gửi...' : 'Xác nhận từ chối & Gửi mail cho khách'}</span>
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500 font-mono">
                {reviewBooking.createdAt ? `Gửi lúc: ${formatDate(reviewBooking.createdAt)}` : ''}
              </span>

              <div className="flex items-center gap-2">
                {reviewBooking.status === 'PENDING_CONTACT' && !isRejecting && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRejecting(true)
                        setRejectionError('')
                      }}
                      className="px-4 py-2.5 rounded-xl border border-rose-300 hover:bg-rose-50 text-rose-700 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <X size={15} />
                      <span>Từ chối đơn</span>
                    </button>

                    <button
                      type="button"
                      disabled={isProcessingAction}
                      onClick={() => setIsConfirmDialogOpen(true)}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
                    >
                      <Check size={16} />
                      <span>Xác nhận đơn...</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setReviewBooking(null)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>

  )
}

export default NotificationCenter
