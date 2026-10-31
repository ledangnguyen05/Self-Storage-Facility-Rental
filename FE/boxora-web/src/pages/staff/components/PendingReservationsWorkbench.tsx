import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Booking, StorageUnit } from '../../../types'
import { bookingService } from '../../../services/bookingService'
import { reservationEmailService } from '../../../services/reservationEmailService'
import { useAuth } from '../../../context/AuthContext'
import { toast } from '../../../utils/toast'
import {
  EarlyCheckInConfirmModal,
  isBookingBeforeCheckInTime,
  EarlyCheckInActionType,
  getBookingScheduleInfo,
} from '../../../components/modals/EarlyCheckInConfirmModal'
import { CancelOverdueBookingModal } from '../../../components/modals/CancelOverdueBookingModal'
import { AssignPhysicalUnitModal } from '../../../components/modals/AssignPhysicalUnitModal'

export interface PendingReservationsWorkbenchProps {
  facilityId?: string
  arrivals?: Booking[]
  radarUnits?: StorageUnit[]
  highlightedBookingCode?: string | null
  onRefresh?: () => void
  onProceedToReception?: (bookingId: string) => void
}

const TAB1_PAGE_SIZE = 10

const isPendingContact = (b: Booking): boolean => {
  const s = String(b.status || '').toUpperCase()
  if (s === 'CANCELLED' || s === 'REJECTED' || s === 'ACTIVE' || s === 'COMPLETED' || s === 'CONFIRMED' || (s as string) === 'CHECKIN_STEP1_COMPLETED') return false
  return s === 'PENDING_CONTACT' || s === 'PENDING_PAYMENT' || s === 'PENDING_APPROVAL' || (s as string) === 'PENDING_SIGNATURE' || s === 'PENDING' || !s
}

export const PendingReservationsWorkbench: React.FC<PendingReservationsWorkbenchProps> = ({
  facilityId,
  arrivals: propArrivals,
  radarUnits = [],
  highlightedBookingCode: initialHighlightedCode = null,
  onRefresh,
  onProceedToReception,
}) => {
  const { user } = useAuth()

  // Local state for arrivals if not provided or when local refresh needed
  const [internalArrivals, setInternalArrivals] = useState<Booking[]>([])
  const [isInternalLoading, setIsInternalLoading] = useState(false)

  // Use props arrivals if provided, else fallback to internal
  const arrivals = propArrivals !== undefined ? propArrivals : internalArrivals

  // Filters & Pagination
  const [tab1Filter, setTab1Filter] = useState<'PENDING_CONTACT' | 'CANCELLED' | 'ALL'>('PENDING_CONTACT')
  const [pendingSearchTerm, setPendingSearchTerm] = useState('')
  const [highlightedBookingCode, setHighlightedBookingCode] = useState<string | null>(initialHighlightedCode)
  const [tab1Page, setTab1Page] = useState(1)

  // Modals state
  const [reviewDetailBooking, setReviewDetailBooking] = useState<Booking | null>(null)
  const [confirmingBooking, setConfirmingBooking] = useState<Booking | null>(null)
  const [confirmingNotes, setConfirmingNotes] = useState('')
  const [confirmingError, setConfirmingError] = useState('')
  const [isConfirmingSubmitting, setIsConfirmingSubmitting] = useState(false)

  const [rejectingBooking, setRejectingBooking] = useState<Booking | null>(null)
  const [rejectionReasonText, setRejectionReasonText] = useState('')
  const [rejectionError, setRejectionError] = useState('')
  const [isRejectingSubmitting, setIsRejectingSubmitting] = useState(false)

  const [cancellingOverdueBooking, setCancellingOverdueBooking] = useState<Booking | null>(null)

  const [earlyConfirmState, setEarlyConfirmState] = useState<{
    booking: Booking
    actionType: EarlyCheckInActionType
    onConfirm: () => void
  } | null>(null)

  const [assignModalBooking, setAssignModalBooking] = useState<Booking | null>(null)

  const [photoViewerModal, setPhotoViewerModal] = useState<{
    fileUrl: string
    title: string
    subtitle?: string
    isPdf?: boolean
  } | null>(null)

  // Update highlighted code when prop changes
  useEffect(() => {
    if (initialHighlightedCode) {
      setHighlightedBookingCode(initialHighlightedCode)
      setPendingSearchTerm(initialHighlightedCode)
    }
  }, [initialHighlightedCode])

  // Listen to cross-component notification clicks
  useEffect(() => {
    const handleSelectPending = (e: Event) => {
      const customEvent = e as CustomEvent<{ bookingCode?: string }>
      const code = customEvent.detail?.bookingCode
      if (code) {
        setHighlightedBookingCode(code)
        setPendingSearchTerm(code)
        const matched = arrivals.find(b => b.bookingCode === code)
        if (matched) {
          setReviewDetailBooking(matched)
        }
      }
    }

    window.addEventListener('boxora_select_staff_pending_booking', handleSelectPending)
    return () => {
      window.removeEventListener('boxora_select_staff_pending_booking', handleSelectPending)
    }
  }, [arrivals])

  // Fetch internal arrivals if not provided via props
  const fetchInternalArrivals = useCallback(async () => {
    if (propArrivals !== undefined && onRefresh) {
      onRefresh()
      return
    }

    setIsInternalLoading(true)
    try {
      const targetId = (!facilityId || facilityId === 'ALL') ? undefined : facilityId
      const data = await bookingService.getUpcomingArrivals(targetId, { timeframe: 'ALL' })
      if (Array.isArray(data)) {
        setInternalArrivals(data)
      } else {
        setInternalArrivals([])
      }
    } catch {
      setInternalArrivals([])
    } finally {
      setIsInternalLoading(false)
    }
  }, [facilityId, propArrivals, onRefresh])

  // Counts
  const counts = useMemo(() => {
    let pendingContact = 0
    let cancelled = 0
    arrivals.forEach(b => {
      const s = String(b.status || '').toUpperCase()
      if (s === 'CANCELLED' || s === 'REJECTED') {
        cancelled += 1
      } else if (isPendingContact(b)) {
        pendingContact += 1
      }
    })
    return {
      pendingContact,
      cancelled,
      total: arrivals.length,
    }
  }, [arrivals])

  // Filtered orders
  const filteredPendingOrders = useMemo(() => {
    return arrivals.filter((b) => {
      const s = String(b.status || '').toUpperCase()
      const isCancelled = s === 'CANCELLED' || s === 'REJECTED'
      const isContact = isPendingContact(b)

      if (tab1Filter === 'PENDING_CONTACT' && !isContact) return false
      if (tab1Filter === 'CANCELLED' && !isCancelled) return false

      if (pendingSearchTerm.trim()) {
        const q = pendingSearchTerm.trim().toLowerCase()
        const code = (b.bookingCode || '').toLowerCase()
        const name = (b.customerName || '').toLowerCase()
        const phone = (b.customerPhone || '').toLowerCase()
        const email = (b.customerEmail || '').toLowerCase()
        const unit = (b.unitCode || '').toLowerCase()
        const fac = (b.facilityName || '').toLowerCase()
        const cccd = (b.identityCardNumber || '').toLowerCase()
        const ctr = (b.contractCode || '').toLowerCase()

        if (
          !code.includes(q) &&
          !name.includes(q) &&
          !phone.includes(q) &&
          !email.includes(q) &&
          !unit.includes(q) &&
          !fac.includes(q) &&
          !cccd.includes(q) &&
          !ctr.includes(q)
        ) {
          return false
        }
      }

      return true
    }).sort((a, b) => {
      if (highlightedBookingCode) {
        if (a.bookingCode === highlightedBookingCode) return -1
        if (b.bookingCode === highlightedBookingCode) return 1
      }
      const timeB = new Date((b as any).createdAt || b.expectedCheckInAt || b.startDate || 0).getTime()
      const timeA = new Date((a as any).createdAt || a.expectedCheckInAt || a.startDate || 0).getTime()
      return timeB - timeA
    })
  }, [arrivals, tab1Filter, pendingSearchTerm, highlightedBookingCode])

  // Pagination
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredPendingOrders.length / TAB1_PAGE_SIZE))
  }, [filteredPendingOrders.length])

  const safePage = useMemo(() => {
    return Math.min(Math.max(1, tab1Page), totalPages)
  }, [tab1Page, totalPages])

  const pagedOrders = useMemo(() => {
    const start = (safePage - 1) * TAB1_PAGE_SIZE
    return filteredPendingOrders.slice(start, start + TAB1_PAGE_SIZE)
  }, [filteredPendingOrders, safePage])

  // Handlers
  const handleConfirmBooking = (booking: Booking) => {
    setConfirmingBooking(booking)
    setConfirmingNotes('')
    setConfirmingError('')
  }

  const executeConfirmBooking = async (booking: Booking, notes?: string) => {
    const s = String(booking?.status || '').toUpperCase()
    if (s === 'CANCELLED' || s === 'REJECTED' || s === 'COMPLETED' || s === 'ACTIVE') {
      setConfirmingError(`Đơn đặt kho ở trạng thái ${s} không thể xác nhận.`)
      return
    }
    setIsConfirmingSubmitting(true)
    setConfirmingError('')
    try {
      const isBackendId = Boolean(booking.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(booking.id.trim()))
      const targetIdOrCode = isBackendId ? booking.id : booking.bookingCode
      await bookingService.confirmBooking(targetIdOrCode, notes)
    } catch (err: any) {
      console.warn('Backend confirm booking error:', err)
      const errMsg = err.response?.data?.message || err.message
      const isLocalOnly = !booking.id || booking.id.startsWith('LOCAL-RES-') || booking.id.startsWith('res_') || err?.response?.status === 404 || err?.response?.data?.errorCode === 'BOOKING_NOT_FOUND'
      if (!isLocalOnly) {
        setConfirmingError(`Không thể xác nhận đơn trên máy chủ: ${errMsg}`)
        setIsConfirmingSubmitting(false)
        return
      }
    }

    try {
      reservationEmailService.confirmReservation(booking.bookingCode, {
        id: user?.id,
        fullName: user?.fullName || 'Nhân sự vận hành Boxora',
      })
    } catch {}

    toast.success('Đã xác nhận đơn đặt giữ chỗ thành công (Chờ check-in)!')
    setConfirmingBooking(null)
    setConfirmingNotes('')
    setConfirmingError('')
    setReviewDetailBooking(null)
    setIsConfirmingSubmitting(false)

    window.dispatchEvent(new Event('boxora:storage-units-refresh'))
    if (onRefresh) {
      onRefresh()
    } else {
      fetchInternalArrivals()
    }
  }

  const handleRejectBooking = async (booking: Booking, reason: string) => {
    const s = String(booking?.status || '').toUpperCase()
    if (s === 'CANCELLED' || s === 'REJECTED' || s === 'COMPLETED') {
      setRejectionError('Đơn đặt giữ chỗ đã bị hủy/từ chối trước đó, không thể từ chối lần nữa.')
      return
    }
    const trimmed = (reason || '').trim()
    if (!trimmed) {
      setRejectionError('Vui lòng điền hoặc chọn lý do từ chối đơn đặt giữ chỗ.')
      return
    }
    if (trimmed.length < 5) {
      setRejectionError('Lý do từ chối quá ngắn. Vui lòng nhập tối thiểu 5 ký tự để gửi thông tin rõ ràng cho khách hàng.')
      return
    }

    setRejectionError('')
    setIsRejectingSubmitting(true)
    try {
      const isBackendId = Boolean(booking.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(booking.id.trim()))
      const targetIdOrCode = isBackendId ? booking.id : booking.bookingCode
      await bookingService.cancelBooking(targetIdOrCode, trimmed)
    } catch (err: any) {
      console.error('Backend cancel booking error on reject:', err)
      const errMsg = err.response?.data?.message || err.message || 'Lỗi xử lý hủy đơn trên máy chủ'
      const isLocalOnly = !booking.id || booking.id.startsWith('LOCAL-RES-') || booking.id.startsWith('res_') || err?.response?.status === 404 || err?.response?.data?.errorCode === 'BOOKING_NOT_FOUND'
      if (!isLocalOnly) {
        setRejectionError(`Không thể từ chối đơn trên máy chủ: ${errMsg}`)
        setIsRejectingSubmitting(false)
        return
      }
    }

    try {
      reservationEmailService.rejectReservation(booking.bookingCode, trimmed, {
        id: user?.id,
        fullName: user?.fullName || 'Nhân sự vận hành Boxora',
      })
    } catch {}

    toast.info('Đã từ chối đơn đặt giữ chỗ.')
    setRejectingBooking(null)
    setRejectionReasonText('')
    setRejectionError('')
    setReviewDetailBooking(null)
    setIsRejectingSubmitting(false)

    window.dispatchEvent(new Event('boxora:storage-units-refresh'))
    if (onRefresh) {
      onRefresh()
    } else {
      fetchInternalArrivals()
    }
  }

  const executeCancelOverdueBooking = async (booking: Booking, customReason?: string) => {
    const reason = customReason?.trim() || 'Hủy đơn do quá hạn 48 giờ sau lịch hẹn check-in nhưng khách hàng chưa đến làm thủ tục tiếp nhận tại quầy'
    try {
      const isBackendId = Boolean(booking.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(booking.id.trim()))
      const targetIdOrCode = isBackendId ? booking.id : booking.bookingCode
      try {
        await bookingService.cancelBooking(targetIdOrCode, reason)
      } catch (err: any) {
        console.warn('Backend cancel booking overdue error (fallback to local):', err)
      }

      try {
        reservationEmailService.cancelOverdueReservation(booking.bookingCode, reason, {
          id: user?.id,
          fullName: user?.fullName || 'Nhân sự vận hành Boxora',
        })
      } catch {}

      toast.warning('Đã hủy đơn quá hạn 48h và giải phóng kho giữ chỗ!')
      setCancellingOverdueBooking(null)
      setReviewDetailBooking(null)

      window.dispatchEvent(new Event('boxora:storage-units-refresh'))
      if (onRefresh) {
        onRefresh()
      } else {
        fetchInternalArrivals()
      }
    } catch (err: any) {
      toast.error('Có lỗi xảy ra khi hủy đơn quá hạn: ' + (err.message || 'Lỗi server'))
    }
  }

  return (
    <section className="space-y-4 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600 text-[24px]">pending_actions</span>
            <h2 className="font-headline text-lg font-bold text-slate-900">
              Quản Lý Đơn Đặt Giữ Chỗ Chờ Xử Lý
            </h2>
            {counts.pendingContact > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-300 animate-pulse">
                {counts.pendingContact} đơn cần liên hệ
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Tiếp nhận hồ sơ giữ chỗ từ khách hàng, xác thực thông tin, tư vấn lịch hẹn và chuẩn bị bàn giao kho.
          </p>
        </div>

        <button
          type="button"
          disabled={isInternalLoading}
          onClick={() => {
            if (onRefresh) {
              onRefresh()
            } else {
              fetchInternalArrivals()
            }
            toast.info('Đang làm mới danh sách đơn đặt giữ chỗ...')
          }}
          className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[16px] text-slate-500 ${isInternalLoading ? 'animate-spin' : ''}`}>
            refresh
          </span>
          <span>Làm mới danh sách</span>
        </button>
      </div>

      {/* 3 Thẻ thống kê: Chờ liên hệ, Đơn đã hủy, Tổng đơn */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Thẻ 1: Chờ liên hệ */}
        <div
          onClick={() => {
            setTab1Filter(prev => prev === 'PENDING_CONTACT' ? 'ALL' : 'PENDING_CONTACT')
            setTab1Page(1)
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            tab1Filter === 'PENDING_CONTACT'
              ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/50 shadow-sm'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-bold text-amber-800 font-mono">
              Chờ Liên Hệ
            </span>
            <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">support_agent</span>
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="font-headline text-2xl font-extrabold text-amber-900 tabular-nums">
              {counts.pendingContact}
            </span>
            <span className="text-xs text-amber-700">đơn cần tư vấn</span>
          </div>
          <span className="text-[11px] text-amber-600 font-medium block mt-1">
            ⚡ Cần liên hệ khách hàng xác nhận
          </span>
        </div>

        {/* Thẻ 2: Đơn đã hủy */}
        <div
          onClick={() => {
            setTab1Filter(prev => prev === 'CANCELLED' ? 'PENDING_CONTACT' : 'CANCELLED')
            setTab1Page(1)
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            tab1Filter === 'CANCELLED'
              ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-400/50 shadow-sm'
              : 'bg-white border-slate-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-bold text-rose-800 font-mono">
              Đơn Đã Hủy / Từ Chối
            </span>
            <span className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">cancel</span>
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="font-headline text-2xl font-extrabold text-rose-900 tabular-nums">
              {counts.cancelled}
            </span>
            <span className="text-xs text-rose-700">đơn đã hủy / từ chối</span>
          </div>
          <span className="text-[11px] text-rose-600 font-medium block mt-1">
            Đã giải phóng hoặc từ chối tiếp nhận
          </span>
        </div>

        {/* Thẻ 3: Tổng đơn */}
        <div
          onClick={() => {
            setTab1Filter(prev => prev === 'ALL' ? 'PENDING_CONTACT' : 'ALL')
            setTab1Page(1)
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            tab1Filter === 'ALL'
              ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/50 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-600 font-mono">
              Tổng Đơn Tiếp Nhận
            </span>
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="font-headline text-2xl font-extrabold text-slate-900 tabular-nums">
              {counts.total}
            </span>
            <span className="text-xs text-slate-500">tất cả hồ sơ tại cơ sở</span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium block mt-1">
            Toàn bộ hồ sơ đặt chỗ tại cơ sở
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={pendingSearchTerm}
            onChange={(e) => {
              setPendingSearchTerm(e.target.value)
              setTab1Page(1)
            }}
            placeholder="Tìm mã đơn, tên khách, SĐT, CCCD, kho..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-amber-400 transition"
          />
          {pendingSearchTerm && (
            <button
              type="button"
              onClick={() => {
                setPendingSearchTerm('')
                setHighlightedBookingCode(null)
                setTab1Page(1)
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Hiển thị <strong>{filteredPendingOrders.length}</strong> đơn phù hợp
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-mono uppercase tracking-wider text-[11px] border-b border-slate-200">
                <th className="py-3 px-4 font-semibold">Khách hàng</th>
                <th className="py-3 px-4 font-semibold">Loại kho</th>
                <th className="py-3 px-4 font-semibold">Thời gian sẽ tiếp đón khách hàng</th>
                <th className="py-3 px-4 font-semibold">Trạng thái &amp; Chữ ký</th>
                <th className="py-3 px-4 font-semibold text-right">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredPendingOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                      <span className="material-symbols-outlined text-[24px]">inbox</span>
                    </div>
                    <p className="font-semibold text-slate-600 text-xs">Không có đơn đặt chỗ nào trong danh sách</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Thử chọn bộ lọc khác hoặc tìm kiếm mã đơn khác.</p>
                  </td>
                </tr>
              ) : (
                pagedOrders.map((b) => {
                  const s = String(b.status || '').toUpperCase()
                  const isCancelled = s === 'CANCELLED' || s === 'REJECTED'
                  const isHighlighted = highlightedBookingCode === b.bookingCode
                  const isInPerson = b.signingMethod === 'IN_PERSON' 
                    || (b as any).signingMethod === 'in_person' 
                    || (b as any).paymentMethod === 'AT_FACILITY' 
                    || (b as any).paymentMethod === 'IN_PERSON'
                    || (b as any).isDirectPayment
                  const isContractSigned = Boolean(b.contractSigned)
                    || b.contractStatus === 'PENDING_ACTIVATION'
                    || b.contractStatus === 'ACTIVE'
                    || (!isInPerson && Boolean(b.contractCode) && (b.paymentStatus === 'PAID' || b.paymentStatus === 'REFUNDED' || b.paymentStatus === 'REFUND_PENDING' || s === 'PAID_AND_SIGNED' || s === 'PAID_PENDING_ASSIGNMENT'))
                  const hasContract = Boolean(b.contractCode || b.contractId || b.paymentStatus === 'PAID' || isContractSigned)
                  const isPaidPending = !isCancelled && s === 'PENDING_PAYMENT' && b.paymentStatus === 'PAID'
                  const isConfirmed = !isCancelled && (s === 'CONFIRMED' || (s as string) === 'CHECKIN_STEP1_COMPLETED' || isPaidPending)
                  const isActiveOrCompleted = s === 'ACTIVE' || s === 'COMPLETED'
                  const isPending = !isCancelled && !isConfirmed && !isActiveOrCompleted && (s === 'PENDING_CONTACT' || s === 'PENDING_PAYMENT' || s === 'PENDING_APPROVAL' || (s as string) === 'PENDING_SIGNATURE' || s === 'PENDING' || !s)

                  const checkInTimeMs = b.expectedCheckInAt 
                    ? new Date(b.expectedCheckInAt).getTime() 
                    : (b.startDate ? new Date(b.startDate + 'T' + ((b as any).checkInTime?.split(' - ')[0] || '09:00') + ':00').getTime() : 0)
                  const hoursOverdue = checkInTimeMs > 0 ? (Date.now() - checkInTimeMs) / (1000 * 60 * 60) : 0
                  const isOverdue48h = !isCancelled && !isActiveOrCompleted && hoursOverdue >= 48

                  return (
                    <tr
                      key={b.id || b.bookingCode}
                      className={`transition-colors ${
                        isHighlighted
                          ? 'bg-amber-50/90 ring-2 ring-amber-400/80 font-bold'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <strong className="text-slate-900 block text-xs">{b.customerName || 'Khách vãng lai'}</strong>
                          {isHighlighted && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 text-[9px] font-bold">Vừa mở</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                          {b.customerPhone && b.customerPhone !== 'N/A' && (
                            <a
                              href={`tel:${b.customerPhone}`}
                              className="text-blue-600 hover:underline font-mono inline-flex items-center gap-0.5"
                              title="Gọi cho khách hàng"
                            >
                              <span className="material-symbols-outlined text-[13px]">phone</span>
                              <span>{b.customerPhone}</span>
                            </a>
                          )}
                          {b.customerEmail && (
                            <span className="text-slate-400 truncate max-w-[140px] block" title={b.customerEmail}>
                              {b.customerEmail}
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] font-mono text-slate-600 mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-800">{b.bookingCode}</span>
                          {b.contractCode ? (
                            <span className="text-blue-700 font-semibold">• HĐ: {b.contractCode}</span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">
                              • {(b as any).createdAt ? new Date((b as any).createdAt).toLocaleDateString('vi-VN') : 'Mới tạo'}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-slate-900 font-semibold block text-xs">
                          {b.unitTypeName || (b as any).sizeName || (radarUnits?.find(u => u.id === b.storageUnitId)?.unitTypeName) || 'Tiêu chuẩn'}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                          {b.rentalMonths || 1} tháng
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 text-xs flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-blue-500">calendar_today</span>
                          <span>
                            {b.expectedCheckInAt
                              ? new Date(b.expectedCheckInAt).toLocaleDateString('vi-VN')
                              : ((b as any).checkInDate || b.startDate)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {(() => {
                            const sched = getBookingScheduleInfo(b)
                            return (
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${sched.badgeClass}`}>
                                {sched.relativeText}
                              </span>
                            )
                          })()}
                          <span className="text-[10px] text-slate-500 font-mono">
                            {b.expectedCheckInAt
                              ? new Date(b.expectedCheckInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                              : ((b as any).checkInTime || 'Giờ tiếp đón')}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col items-start gap-1">
                          {isCancelled ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <span className="material-symbols-outlined text-[12px]">cancel</span>
                              <span>ĐÃ HỦY / TỪ CHỐI</span>
                            </span>
                          ) : s === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <span className="material-symbols-outlined text-[12px]">check_circle</span>
                              <span>ĐÃ BÀN GIAO</span>
                            </span>
                          ) : s === 'COMPLETED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                              <span className="material-symbols-outlined text-[12px]">task_alt</span>
                              <span>ĐÃ HOÀN TẤT</span>
                            </span>
                          ) : s === 'CONFIRMED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                              <span className="material-symbols-outlined text-[12px]">verified</span>
                              <span>ĐÃ XÁC NHẬN</span>
                            </span>
                          ) : s === 'PENDING_CONTACT' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              <span>CHỜ LIÊN HỆ TƯ VẤN</span>
                            </span>
                          ) : s === 'PENDING_PAYMENT' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              <span>CHƯA THANH TOÁN</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              <span>Chờ liên hệ</span>
                            </span>
                          )}

                          {isContractSigned ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="material-symbols-outlined text-[12px]">draw</span>
                              <span>Đã ký HĐ điện tử</span>
                            </span>
                          ) : isInPerson ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <span>🏢 Ký giấy tại quầy</span>
                            </span>
                          ) : hasContract && !isCancelled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              <span>⏳ Chờ khách ký HĐ</span>
                            </span>
                          ) : null}
                          {b.assignedStaffName ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200" title={`Nhân sự tiếp nhận: ${b.assignedStaffName}`}>
                              <span className="material-symbols-outlined text-[12px]">person</span>
                              <span>Tiếp nhận: <strong>{b.assignedStaffName}</strong></span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200" title="Đơn chưa có nhân sự tiếp nhận">
                              <span className="material-symbols-outlined text-[12px]">person_off</span>
                              <span>Chưa tiếp nhận</span>
                            </span>
                          )}

                          {isInPerson && !isActiveOrCompleted && !isCancelled && (
                            isOverdue48h ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse" title="Đã quá 48 giờ sau lịch hẹn check-in: Được quyền hủy đơn">
                                <span className="material-symbols-outlined text-[12px]">warning</span>
                                <span>Quá hạn 48h</span>
                              </span>
                            ) : hoursOverdue >= 24 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300" title="Đã quá 24h sau lịch hẹn check-in: Hệ thống đã gửi email cảnh báo">
                                <span className="material-symbols-outlined text-[12px]">mail</span>
                                <span>Đã gửi mail nhắc 24h</span>
                              </span>
                            ) : null
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {isPending ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleConfirmBooking(b)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
                                title="Xác nhận đơn"
                              >
                                <span className="material-symbols-outlined text-[15px]">check_circle</span>
                                <span>Xác nhận</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingBooking(b)
                                  setRejectionReasonText('')
                                  setRejectionError('')
                                }}
                                className="px-2.5 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                                title="Từ chối đơn và điền lý do"
                              >
                                <span className="material-symbols-outlined text-[15px]">cancel</span>
                                <span>Từ chối</span>
                              </button>
                              {isOverdue48h && (
                                <button
                                  type="button"
                                  onClick={() => setCancellingOverdueBooking(b)}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
                                  title="Đã quá 48h sau lịch hẹn check-in khách chưa đến tiếp nhận: Hủy đơn và giải phóng kho"
                                >
                                  <span className="material-symbols-outlined text-[15px]">event_busy</span>
                                  <span>Hủy đơn</span>
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setReviewDetailBooking(b)}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                                title="Xem chi tiết đơn & hợp đồng"
                              >
                                <span className="material-symbols-outlined text-[15px]">visibility</span>
                                <span>Xem chi tiết</span>
                              </button>

                              {isPaidPending ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const { isPremature } = isBookingBeforeCheckInTime(b)
                                    if (isPremature) {
                                      setEarlyConfirmState({
                                        booking: b,
                                        actionType: 'ASSIGN_PHYSICAL_UNIT',
                                        onConfirm: () => setAssignModalBooking(b),
                                      })
                                    } else {
                                      setAssignModalBooking(b)
                                    }
                                  }}
                                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm ring-2 ring-emerald-400/40"
                                  title="Thực hiện Check-in cho khách hàng"
                                >
                                  <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                                  <span>Check-in</span>
                                </button>
                              ) : (isConfirmed || isActiveOrCompleted) ? (
                                <>
                                  {onProceedToReception && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const proceed = () => {
                                          onProceedToReception(b.id)
                                        }
                                        const { isPremature } = isBookingBeforeCheckInTime(b)
                                        if (isPremature && !isActiveOrCompleted) {
                                          setEarlyConfirmState({
                                            booking: b,
                                            actionType: 'ENTER_RECEPTION',
                                            onConfirm: proceed,
                                          })
                                        } else {
                                          proceed()
                                        }
                                      }}
                                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
                                      title={isInPerson ? "Chuyển sang Bàn Tiếp Đón để đón khách làm thủ tục ký hợp đồng & thanh toán số" : "Chuyển sang Bàn Tiếp Đón & Nghiệm Thu Bàn Giao Kho"}
                                    >
                                      <span className="material-symbols-outlined text-[15px]">desk</span>
                                      <span>{isActiveOrCompleted ? 'Hồ Sơ Bàn Giao' : 'Check-in'}</span>
                                    </button>
                                  )}
                                  {isInPerson && isOverdue48h && (
                                    <button
                                      type="button"
                                      onClick={() => setCancellingOverdueBooking(b)}
                                      className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
                                      title="Đã quá 48h sau lịch hẹn check-in khách chưa đến tiếp nhận: Hủy đơn và giải phóng kho"
                                    >
                                      <span className="material-symbols-outlined text-[15px]">event_busy</span>
                                      <span>Hủy đơn</span>
                                    </button>
                                  )}
                                </>
                              ) : isOverdue48h ? (
                                <button
                                  type="button"
                                  onClick={() => setCancellingOverdueBooking(b)}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
                                  title="Đã quá 48h sau lịch hẹn check-in khách chưa đến tiếp nhận: Hủy đơn và giải phóng kho"
                                >
                                  <span className="material-symbols-outlined text-[15px]">event_busy</span>
                                  <span>Hủy đơn</span>
                                </button>
                              ) : null}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3.5 border-t border-slate-200 bg-slate-50/50 rounded-b-2xl flex-wrap gap-2">
            <div className="text-xs text-slate-500 font-medium">
              Trang <strong className="text-slate-800">{safePage}</strong> / <strong>{totalPages}</strong> (Tổng <strong>{filteredPendingOrders.length}</strong> đơn phù hợp)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTab1Page(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Trang trước
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1]
                  return (
                    <React.Fragment key={p}>
                      {prev && p - prev > 1 && <span className="text-xs text-slate-400 px-1">...</span>}
                      <button
                        type="button"
                        onClick={() => setTab1Page(p)}
                        className={`w-7 h-7 text-xs font-bold rounded-lg transition cursor-pointer ${
                          safePage === p
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  )
                })}
              <button
                type="button"
                onClick={() => setTab1Page(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Trang sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL XÁC NHẬN ĐƠN */}
      {confirmingBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg max-h-[92vh] rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col text-left animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-700 text-white p-5 flex items-center justify-between border-b border-emerald-800">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                </span>
                <div>
                  <h3 className="font-extrabold text-base">Xác Nhận Đơn Đặt Giữ Chỗ</h3>
                  <span className="text-xs font-mono text-emerald-100">Mã đơn: {confirmingBooking.bookingCode}</span>
                </div>
              </div>
              <button
                type="button"
                disabled={isConfirmingSubmitting}
                onClick={() => {
                  setConfirmingBooking(null)
                  setConfirmingError('')
                }}
                className="w-8 h-8 rounded-full bg-emerald-800 hover:bg-emerald-900 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 space-y-1.5 font-mono text-xs">
                <div>Khách hàng: <strong className="text-slate-900 dark:text-white font-sans">{confirmingBooking.customerName}</strong> ({confirmingBooking.customerPhone || 'Không có SĐT'})</div>
                {confirmingBooking.customerEmail && (
                  <div>Email: <strong className="font-sans text-slate-700 dark:text-slate-300">{confirmingBooking.customerEmail}</strong></div>
                )}
                <div>Cơ sở: <strong className="text-slate-900 dark:text-white">{confirmingBooking.facilityName}</strong> · {confirmingBooking.unitCode ? `Kho #${confirmingBooking.unitCode}` : 'Chưa gán ô kho vật lý'}</div>
                <div>Lịch hẹn nhận kho: <strong className="text-emerald-700 dark:text-emerald-400">{(confirmingBooking as any).checkInDate || confirmingBooking.startDate}</strong> ({(confirmingBooking as any).checkInTime || (confirmingBooking.expectedCheckInAt ? confirmingBooking.expectedCheckInAt.slice(11, 16) : '09:00')})</div>
                <div>Thời hạn thuê: <strong>{confirmingBooking.rentalMonths || 1} tháng</strong> · Tiền thuê: <strong>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(confirmingBooking.totalRentalFee || 0))}</strong></div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[20px] text-amber-600 shrink-0 mt-0.5">info</span>
                <p className="leading-relaxed">
                  Bạn có chắc chắn muốn xác nhận đơn đặt giữ chỗ này? Trạng thái đơn sẽ chuyển sang <strong className="font-bold underline">Chờ check-in</strong> (CONFIRMED) và hệ thống sẽ gửi thông báo xác nhận lịch hẹn nhận kho cho khách hàng.
                </p>
              </div>

              {confirmingError && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs animate-in fade-in slide-in-from-top-1 duration-150 shadow-sm">
                  <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0 mt-0.5">
                    error
                  </span>
                  <span className="font-semibold leading-relaxed">
                    {confirmingError}
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="font-bold text-slate-900 dark:text-white block text-xs">
                  Ghi chú nội bộ (tùy chọn):
                </label>
                <textarea
                  rows={2}
                  value={confirmingNotes}
                  onChange={(e) => setConfirmingNotes(e.target.value)}
                  placeholder="Ví dụ: Đã gọi điện nhắc khách mang CCCD bản gốc, chuẩn bị ô kho tầng 1..."
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isConfirmingSubmitting}
                onClick={() => {
                  setConfirmingBooking(null)
                  setConfirmingError('')
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer transition disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isConfirmingSubmitting}
                onClick={() => executeConfirmBooking(confirmingBooking, confirmingNotes)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isConfirmingSubmitting ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Đang xác nhận...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Xác nhận đơn (Chờ check-in)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TỪ CHỐI ĐƠN */}
      {rejectingBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg max-h-[92vh] rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col text-left animate-in zoom-in-95 duration-200">
            <div className="bg-rose-700 text-white p-5 flex items-center justify-between border-b border-rose-800">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[20px]">cancel</span>
                </span>
                <div>
                  <h3 className="font-extrabold text-base">Từ Chối Đơn Đặt Giữ Chỗ</h3>
                  <span className="text-xs font-mono text-rose-100">Mã đơn: {rejectingBooking.bookingCode}</span>
                </div>
              </div>
              <button
                type="button"
                disabled={isRejectingSubmitting}
                onClick={() => {
                  setRejectingBooking(null)
                  setRejectionReasonText('')
                  setRejectionError('')
                }}
                className="w-8 h-8 rounded-full bg-rose-800 hover:bg-rose-900 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
              <div className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/50 space-y-1.5 font-mono text-xs">
                <div>Khách hàng: <strong className="text-slate-900 dark:text-white font-sans">{rejectingBooking.customerName}</strong> ({rejectingBooking.customerPhone || 'Không có SĐT'})</div>
                {rejectingBooking.customerEmail && (
                  <div>Email nhận thông báo: <strong className="font-sans text-slate-700 dark:text-slate-300">{rejectingBooking.customerEmail}</strong></div>
                )}
                <div>Cơ sở: <strong>{rejectingBooking.facilityName}</strong> · Loại kho: <strong>{rejectingBooking.unitTypeName || 'Tiêu chuẩn'}</strong></div>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[20px] text-rose-600 shrink-0 mt-0.5">warning</span>
                <p className="leading-relaxed">
                  Đơn đặt giữ chỗ sẽ chuyển sang trạng thái <strong className="font-bold underline">Đã hủy / Từ chối</strong>. Hệ thống sẽ tự động giải phóng ô kho giữ chỗ và gửi email giải thích lý do đến khách hàng.
                </p>
              </div>

              {rejectionError && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs animate-in fade-in slide-in-from-top-1 duration-150 shadow-sm">
                  <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0 mt-0.5">error</span>
                  <span className="font-semibold leading-relaxed">{rejectionError}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="font-bold text-slate-900 dark:text-white block text-xs">
                  Chọn lý do nhanh:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Đã liên hệ nhiều lần nhưng khách hàng không bắt máy hoặc không phản hồi',
                    'Khách hàng thay đổi kế hoạch và chủ động yêu cầu hủy lịch giữ chỗ',
                    'Loại kho khách chọn tạm hết chỗ tại thời điểm tiếp nhận hiện trường',
                    'Thông tin CCCD hoặc giấy tờ khách hàng cung cấp không hợp lệ',
                    'Hàng hóa khách muốn lưu trữ thuộc danh mục cấm theo quy định an toàn',
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setRejectionReasonText(preset)
                        setRejectionError('')
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 text-[11px] font-medium border border-slate-200 transition cursor-pointer text-left"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-900 dark:text-white block text-xs">
                  Lý do chi tiết gửi khách hàng <span className="text-rose-500">*</span>:
                </label>
                <textarea
                  rows={3}
                  value={rejectionReasonText}
                  onChange={(e) => {
                    setRejectionReasonText(e.target.value)
                    if (rejectionError) setRejectionError('')
                  }}
                  placeholder="Nhập lý do rõ ràng, lịch sự để thông báo cho khách hàng qua email..."
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isRejectingSubmitting}
                onClick={() => {
                  setRejectingBooking(null)
                  setRejectionReasonText('')
                  setRejectionError('')
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer transition disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isRejectingSubmitting}
                onClick={() => handleRejectBooking(rejectingBooking, rejectionReasonText)}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isRejectingSubmitting ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <span>Xác nhận từ chối &amp; Gửi mail cho khách</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM CHI TIẾT ĐƠN ĐẶT GIỮ CHỖ */}
      {reviewDetailBooking && (() => {
        const s = String(reviewDetailBooking.status || '').toUpperCase()
        const isCancelled = s === 'CANCELLED' || s === 'REJECTED'
        const isModalPaidPending = !isCancelled && (s === 'PAID_PENDING_ASSIGNMENT' || s === 'PAID_AND_SIGNED' || (s === 'CONFIRMED' && !reviewDetailBooking.storageUnitId))
        const isModalConfirmed = !isCancelled && ((s === 'CONFIRMED' && Boolean(reviewDetailBooking.storageUnitId)) || s === 'AWAITING_CHECKIN')
        const sched = getBookingScheduleInfo(reviewDetailBooking)
        const modalIsInPerson = reviewDetailBooking.signingMethod === 'IN_PERSON'
          || (reviewDetailBooking as any).signingMethod === 'in_person'
          || (reviewDetailBooking as any).paymentMethod === 'AT_FACILITY'
          || (reviewDetailBooking as any).paymentMethod === 'IN_PERSON'

        const pStatus = String(reviewDetailBooking.paymentStatus || '').toUpperCase()
        const isModalRefunded = pStatus === 'REFUNDED'
        const isModalRefundPending = pStatus === 'REFUND_PENDING'
        const isModalPaid = pStatus === 'PAID'
          || Number(reviewDetailBooking.depositPaid || 0) > 0
          || (!modalIsInPerson && (s === 'PAID_AND_SIGNED' || s === 'PAID_PENDING_ASSIGNMENT' || s === 'CONFIRMED' || s === 'ACTIVE'))

        const isModalContractSigned = Boolean(reviewDetailBooking.contractSigned)
          || reviewDetailBooking.contractStatus === 'PENDING_ACTIVATION'
          || reviewDetailBooking.contractStatus === 'ACTIVE'
          || (!modalIsInPerson && Boolean(reviewDetailBooking.contractCode) && (
              isModalPaid ||
              isModalRefundPending ||
              isModalRefunded ||
              s === 'PAID_AND_SIGNED' ||
              s === 'PAID_PENDING_ASSIGNMENT' ||
              Boolean(reviewDetailBooking.contractId)
            ))

        const hasModalContract = Boolean(
          reviewDetailBooking.contractCode ||
          reviewDetailBooking.contractId ||
          isModalPaid ||
          isModalConfirmed ||
          isModalContractSigned ||
          s === 'ACTIVE' ||
          s === 'COMPLETED'
        )
        const modalCheckInMs = reviewDetailBooking.expectedCheckInAt 
          ? new Date(reviewDetailBooking.expectedCheckInAt).getTime() 
          : (reviewDetailBooking.startDate ? new Date(reviewDetailBooking.startDate + 'T' + ((reviewDetailBooking as any).checkInTime?.split(' - ')[0] || '09:00') + ':00').getTime() : 0)
        const modalHoursOverdue = modalCheckInMs > 0 ? (Date.now() - modalCheckInMs) / (1000 * 60 * 60) : 0
        const modalIsOverdue48h = modalHoursOverdue >= 48
        const modalIsActiveOrCompleted = s === 'ACTIVE' || s === 'COMPLETED'

        return (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-xl max-h-[92vh] rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col text-left animate-in zoom-in-95 duration-200">
              <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[20px]">feed</span>
                  </span>
                  <div>
                    <h3 className="font-extrabold text-base">Chi Tiết Đơn Đặt Giữ Chỗ</h3>
                    <span className="text-xs font-mono text-cyan-300">Mã đơn: {reviewDetailBooking.bookingCode}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewDetailBooking(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
                {/* 1. Thông tin khách hàng */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center justify-between">
                    <span>1. Thông Tin Khách Hàng</span>
                    {reviewDetailBooking.identityCardNumber && (
                      <span className="text-blue-600 font-mono text-[11px]">CCCD: {reviewDetailBooking.identityCardNumber}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                    <div>Họ và tên: <strong className="text-slate-900 dark:text-white">{reviewDetailBooking.customerName}</strong></div>
                    <div>SĐT: <strong className="font-mono text-blue-600">{reviewDetailBooking.customerPhone || 'N/A'}</strong></div>
                    <div className="col-span-2">Email: <strong className="font-mono">{reviewDetailBooking.customerEmail || 'Chưa cung cấp'}</strong></div>
                  </div>
                </div>

                {/* 2. Thông tin lịch hẹn nhận kho */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center justify-between">
                    <span>2. Lịch Hẹn &amp; Tiếp Đón</span>
                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold border ${sched.badgeClass}`}>
                      {sched.relativeText}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                    <div>Cơ sở: <strong className="text-slate-900 dark:text-white">{reviewDetailBooking.facilityName}</strong></div>
                    <div>Loại kho: <strong className="text-slate-900 dark:text-white">{reviewDetailBooking.unitTypeName || 'Tiêu chuẩn'}</strong></div>
                    <div>Ngày bắt đầu: <strong>{(reviewDetailBooking as any).checkInDate || reviewDetailBooking.startDate}</strong></div>
                    <div>Giờ hẹn: <strong>{(reviewDetailBooking as any).checkInTime || (reviewDetailBooking.expectedCheckInAt ? reviewDetailBooking.expectedCheckInAt.slice(11, 16) : '09:00')}</strong></div>
                    <div>Thời hạn thuê: <strong>{reviewDetailBooking.rentalMonths || 1} tháng</strong></div>
                    <div>Ô kho gán: <strong className="font-mono text-blue-600">{reviewDetailBooking.unitCode ? `#${reviewDetailBooking.unitCode}` : 'Chưa gán ô kho'}</strong></div>
                  </div>
                </div>

                {/* 3. Tài chính & Thanh toán */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center justify-between">
                    <span>3. Thanh Toán &amp; Hợp Đồng</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isModalRefunded
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : isModalRefundPending
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : isModalPaid
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : modalIsInPerson
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {isModalRefunded
                        ? 'ĐÃ HOÀN TIỀN'
                        : isModalRefundPending
                        ? 'CHỜ HOÀN TIỀN'
                        : isModalPaid
                        ? 'ĐÃ THANH TOÁN'
                        : modalIsInPerson
                        ? 'CHƯA THANH TOÁN (Thu tại quầy)'
                        : 'CHƯA THANH TOÁN'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                    <div>Tổng tiền thuê: <strong className="text-slate-900 dark:text-white">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(reviewDetailBooking.totalRentalFee || 0))}</strong></div>
                    <div>Tiền cọc: <strong>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(reviewDetailBooking.depositAmount || 0))}</strong></div>
                    <div>Hình thức ký: <strong>{modalIsInPerson ? '🏢 Ký giấy tại quầy' : '✍️ Ký điện tử'}</strong></div>
                    <div>Trạng thái ký: <strong>{
                      modalIsInPerson
                        ? 'Chưa ký (Ký giấy tại quầy khi nhận kho)'
                        : isModalContractSigned
                        ? 'Đã ký hoàn tất'
                        : hasModalContract
                        ? 'Chờ ký điện tử'
                        : 'Chưa ký'
                    }</strong></div>
                  </div>
                </div>

                {/* Ghi chú nếu có */}
                {reviewDetailBooking.staffAssignmentNotes && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl text-blue-900 dark:text-blue-300">
                    <span className="font-bold block text-[11px] uppercase tracking-wider mb-1">Ghi chú nội bộ:</span>
                    <p className="leading-relaxed">{reviewDetailBooking.staffAssignmentNotes}</p>
                  </div>
                )}
              </div>

              {/* Action Footer */}
              <div className="p-4 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  {modalIsInPerson && modalIsOverdue48h && !modalIsActiveOrCompleted && !isCancelled && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = reviewDetailBooking
                        setReviewDetailBooking(null)
                        setCancellingOverdueBooking(target)
                      }}
                      className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                      title="Quá hạn 48 giờ sau lịch hẹn check-in: Hủy đơn và giải phóng kho"
                    >
                      <span className="material-symbols-outlined text-[16px]">event_busy</span>
                      <span>Hủy đơn quá hạn</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewDetailBooking(null)}
                    className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Đóng
                  </button>

                  {!isCancelled && ((reviewDetailBooking.status as string) === 'PENDING_CONTACT' || (reviewDetailBooking.status as string) === 'PENDING_CONFIRMATION' || (reviewDetailBooking.status as string) === 'PENDING_SIGNATURE' || (reviewDetailBooking.status as string) === 'PENDING_APPROVAL' || (reviewDetailBooking.status as string) === 'PENDING') ? (
                    <button
                      type="button"
                      onClick={() => {
                        const target = reviewDetailBooking
                        setReviewDetailBooking(null)
                        handleConfirmBooking(target)
                      }}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer"
                    >
                      Xác nhận đơn
                    </button>
                  ) : isModalPaidPending ? (
                    <button
                      type="button"
                      onClick={() => {
                        const target = reviewDetailBooking
                        setReviewDetailBooking(null)
                        const { isPremature } = isBookingBeforeCheckInTime(target)
                        if (isPremature) {
                          setEarlyConfirmState({
                            booking: target,
                            actionType: 'ASSIGN_PHYSICAL_UNIT',
                            onConfirm: () => setAssignModalBooking(target),
                          })
                        } else {
                          setAssignModalBooking(target)
                        }
                      }}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                      <span>Check-in</span>
                    </button>
                  ) : isModalConfirmed && onProceedToReception ? (
                    <button
                      type="button"
                      onClick={() => {
                        const target = reviewDetailBooking
                        const proceed = () => {
                          setReviewDetailBooking(null)
                          onProceedToReception(target.id)
                        }
                        const { isPremature } = isBookingBeforeCheckInTime(target)
                        if (isPremature) {
                          setEarlyConfirmState({
                            booking: target,
                            actionType: 'ENTER_RECEPTION',
                            onConfirm: proceed,
                          })
                        } else {
                          proceed()
                        }
                      }}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                      <span>Check-in</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* MODAL HỦY ĐƠN QUÁ HẠN 48H */}
      <CancelOverdueBookingModal
        isOpen={Boolean(cancellingOverdueBooking)}
        booking={cancellingOverdueBooking}
        userRoleTitle="Nhân sự vận hành Boxora"
        onConfirm={executeCancelOverdueBooking}
        onClose={() => setCancellingOverdueBooking(null)}
      />

      {/* EARLY CHECK-IN CONFIRM MODAL */}
      {earlyConfirmState && (
        <EarlyCheckInConfirmModal
          isOpen={true}
          booking={earlyConfirmState.booking}
          actionType={earlyConfirmState.actionType}
          onConfirm={() => {
            const cb = earlyConfirmState.onConfirm
            setEarlyConfirmState(null)
            cb()
          }}
          onClose={() => setEarlyConfirmState(null)}
        />
      )}

      {/* ASSIGN PHYSICAL UNIT MODAL */}
      {assignModalBooking && (
        <AssignPhysicalUnitModal
          isOpen={true}
          booking={assignModalBooking}
          facilityId={facilityId}
          onClose={() => setAssignModalBooking(null)}
          onSuccess={() => {
            setAssignModalBooking(null)
            if (onRefresh) {
              onRefresh()
            } else {
              fetchInternalArrivals()
            }
          }}
        />
      )}

      {/* PHOTO VIEWER MODAL */}
      {photoViewerModal && (
        <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">
                    {photoViewerModal.fileUrl ? (photoViewerModal.isPdf ? 'picture_as_pdf' : 'photo_library') : 'info'}
                  </span>
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm sm:text-base truncate">{photoViewerModal.title}</h3>
                  {photoViewerModal.subtitle && (
                    <p className="text-xs text-slate-300 font-mono truncate">{photoViewerModal.subtitle}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPhotoViewerModal(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-950/60 flex flex-col items-center justify-center min-h-[300px]">
              {photoViewerModal.isPdf ? (
                <iframe
                  src={photoViewerModal.fileUrl}
                  title={photoViewerModal.title}
                  className="w-full h-[65vh] rounded-xl border border-slate-200 dark:border-slate-800 bg-white"
                />
              ) : (
                <img
                  src={photoViewerModal.fileUrl}
                  alt={photoViewerModal.title}
                  className="max-h-[65vh] w-auto object-contain rounded-xl shadow-lg border border-slate-200 dark:border-slate-800"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default PendingReservationsWorkbench
