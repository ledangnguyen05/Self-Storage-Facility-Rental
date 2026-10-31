import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Booking, StorageUnit, RentalContract } from '../../../types'
import { bookingService } from '../../../services/bookingService'
import { contractService } from '../../../services/contractService'
import { handoverService, HandoverPrerequisites } from '../../../services/handoverService'
import { reservationEmailService } from '../../../services/reservationEmailService'
import { storageUnitService } from '../../../services/storageUnitService'
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
import { ContractDocumentModal } from '../../../components/modals/ContractDocumentModal'
import { extractFloor, resolveBookingFloor } from '../../../utils/floorUtils'
import { HandoverCheckInWorkbench } from './HandoverCheckInWorkbench'

export interface ReceptionDeskMetrics {
  pendingCheckIn: number
  handedOver: number
  total: number
}

export interface ReceptionDeskWorkbenchProps {
  facilityId?: string
  facilityName?: string
  userRole?: string
  arrivals?: Booking[]
  radarUnits?: StorageUnit[]
  activeBookingId?: string
  onSelectBooking?: (bookingId: string) => void
  onHandoverComplete?: (bookingId: string) => void
  onRefresh?: () => void
  onMetricsChange?: (metrics: ReceptionDeskMetrics) => void
}

export const isBookingPaid = (b: Booking): boolean => {
  const s = String(b.status || '').toUpperCase()
  if (
    s === 'PAID_PENDING_ASSIGNMENT' ||
    s === 'PAID_AND_SIGNED' ||
    s === 'CONFIRMED' ||
    s === 'AWAITING_CHECKIN' ||
    s === 'ACTIVE' ||
    s === 'COMPLETED'
  ) {
    return true
  }
  if (b.paymentStatus === 'PAID') {
    return true
  }
  if ((b.depositPaid || 0) > 0 && s !== 'CANCELLED' && s !== 'PENDING_PAYMENT') {
    return true
  }
  return false
}

export const isPaidCheckIn = (b: Booking): boolean => {
  const s = String(b.status || '').toUpperCase()
  if (s === 'CANCELLED' || s === 'REJECTED' || s === 'COMPLETED' || s === 'ACTIVE') return false
  return isBookingPaid(b)
}

export const isHandedOverBooking = (b: Booking): boolean => {
  const s = String(b.status || '').toUpperCase()
  return s === 'ACTIVE' || s === 'COMPLETED'
}

export const isPendingCheckInBooking = (b: Booking): boolean => {
  const s = String(b.status || '').toUpperCase()
  if (s === 'ACTIVE' || s === 'COMPLETED' || s === 'CANCELLED' || s === 'REJECTED') return false
  return isBookingPaid(b) || s === 'CONFIRMED' || s === 'READY_FOR_CHECKIN' || s === 'PAID_AND_SIGNED' || s === 'PAID_PENDING_ASSIGNMENT'
}

export const ReceptionDeskWorkbench: React.FC<ReceptionDeskWorkbenchProps> = ({
  facilityId,
  facilityName,
  userRole,
  arrivals: propArrivals,
  radarUnits: propRadarUnits,
  activeBookingId: propActiveBookingId,
  onSelectBooking,
  onHandoverComplete,
  onRefresh,
  onMetricsChange,
}) => {
  const { user } = useAuth()
  const resolvedRole = userRole || user?.role || 'STAFF'
  const isManagementRole = resolvedRole === 'ADMIN' || resolvedRole === 'BUSINESS_MANAGER'

  // Internal state when arrivals / radarUnits are not passed
  const [internalArrivals, setInternalArrivals] = useState<Booking[]>([])
  const [internalUnits, setInternalUnits] = useState<StorageUnit[]>([])
  const [internalLoading, setInternalLoading] = useState(false)

  // Active booking ID management
  const [localActiveBookingId, setLocalActiveBookingId] = useState<string>('')
  const activeBookingId = propActiveBookingId !== undefined ? propActiveBookingId : localActiveBookingId

  const handleSetActiveBookingId = useCallback((id: string) => {
    setLocalActiveBookingId(id)
    if (onSelectBooking) {
      onSelectBooking(id)
    }
  }, [onSelectBooking])

  // Fetch internal arrivals if propArrivals is undefined
  const fetchInternalArrivals = useCallback(async () => {
    if (propArrivals !== undefined) return
    setInternalLoading(true)
    try {
      const targetFac = facilityId && facilityId !== 'ALL' ? facilityId : undefined
      const [arrivalsRes, unitsRes] = await Promise.allSettled([
        bookingService.getUpcomingArrivals(targetFac, { timeframe: 'ALL' }),
        storageUnitService.getUnits(targetFac ? { facilityId: targetFac } : undefined),
      ])

      if (arrivalsRes.status === 'fulfilled' && Array.isArray(arrivalsRes.value)) {
        setInternalArrivals(arrivalsRes.value)
      } else {
        setInternalArrivals([])
      }

      if (unitsRes.status === 'fulfilled' && Array.isArray(unitsRes.value)) {
        setInternalUnits(unitsRes.value)
      }
    } catch (err) {
      console.error('Failed to load arrivals for ReceptionDeskWorkbench:', err)
    } finally {
      setInternalLoading(false)
    }
  }, [propArrivals, facilityId])

  useEffect(() => {
    if (propArrivals === undefined) {
      fetchInternalArrivals()
    }
  }, [propArrivals, fetchInternalArrivals])

  const rawArrivals = propArrivals !== undefined ? propArrivals : internalArrivals
  const radarUnits = propRadarUnits !== undefined ? propRadarUnits : internalUnits

  // Radar Units lookup maps
  const unitMapById = useMemo(() => {
    const map = new Map<string, StorageUnit>()
    radarUnits.forEach(u => {
      if (u.id) map.set(u.id, u)
    })
    return map
  }, [radarUnits])

  const unitMapByCodeAndFacility = useMemo(() => {
    const map = new Map<string, StorageUnit>()
    radarUnits.forEach(u => {
      if (u.unitCode) {
        const key = `${u.facilityId || ''}::${u.unitCode.trim().toUpperCase()}`
        map.set(key, u)
      }
    })
    return map
  }, [radarUnits])

  // Filter rawArrivals strictly by facilityId if specified
  const scopedArrivals = useMemo(() => {
    if (!facilityId || facilityId === 'ALL') return rawArrivals
    return rawArrivals.filter(b => {
      if (b.facilityId) return b.facilityId === facilityId
      if (b.storageUnitId && radarUnits.length > 0) {
        const u = radarUnits.find(unit => unit.id === b.storageUnitId)
        if (u?.facilityId) return u.facilityId === facilityId
      }
      return false
    })
  }, [rawArrivals, facilityId, radarUnits])

  // Available floors extracted from radarUnits or bookings
  const availableFloors = useMemo(() => {
    const floorSet = new Set<string>()
    radarUnits.forEach(u => {
      const f = extractFloor(u.floorLevel)
      if (f) floorSet.add(f)
    })
    if (floorSet.size === 0) {
      scopedArrivals.forEach(b => {
        const f = resolveBookingFloor(b, unitMapById, unitMapByCodeAndFacility)
        if (f) floorSet.add(f)
      })
    }
    return Array.from(floorSet).sort((a, b) => {
      const numA = parseInt(a, 10)
      const numB = parseInt(b, 10)
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB
      return a.localeCompare(b)
    })
  }, [radarUnits, scopedArrivals, unitMapById, unitMapByCodeAndFacility])

  // Search & Filter Ribbon States
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFloor, setSelectedFloor] = useState<string>('all')
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<'all' | 'current' | 'today' | 'future' | 'past'>('all')

  // Reception Queue Table 3 Status Filter Tabs
  const [receptionStatusFilter, setReceptionStatusFilter] = useState<'PENDING_CHECKIN' | 'HANDED_OVER' | 'ALL'>('PENDING_CHECKIN')

  // Calculate reception counts for 3 tabs
  const receptionCounts = useMemo<ReceptionDeskMetrics>(() => {
    let pendingCheckIn = 0
    let handedOver = 0
    scopedArrivals.forEach((b) => {
      if (isHandedOverBooking(b)) {
        handedOver++
      } else if (isPendingCheckInBooking(b)) {
        pendingCheckIn++
      }
    })
    return {
      pendingCheckIn,
      handedOver,
      total: pendingCheckIn + handedOver,
    }
  }, [scopedArrivals])

  // Notify parent of metrics changes
  useEffect(() => {
    if (onMetricsChange) {
      onMetricsChange(receptionCounts)
    }
  }, [receptionCounts, onMetricsChange])

  // Filtered reception queue arrivals for table
  const receptionArrivals = useMemo(() => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    return scopedArrivals
      .filter((b) => {
        const isHanded = isHandedOverBooking(b)
        const isPending = isPendingCheckInBooking(b)

        // 1. Status Filter Tab
        if (receptionStatusFilter === 'PENDING_CHECKIN' && !isPending) return false
        if (receptionStatusFilter === 'HANDED_OVER' && !isHanded) return false
        if (receptionStatusFilter === 'ALL' && (!isPending && !isHanded)) return false

        // 2. Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase()
          const code = (b.bookingCode || '').toLowerCase()
          const name = (b.customerName || '').toLowerCase()
          const phone = (b.customerPhone || '').toLowerCase()
          const email = (b.customerEmail || '').toLowerCase()
          const unit = (b.unitCode || '').toLowerCase()
          const fac = (b.facilityName || '').toLowerCase()
          const ctr = (b.contractCode || '').toLowerCase()
          const cccd = (b.identityCardNumber || '').toLowerCase()
          if (
            !code.includes(q) &&
            !name.includes(q) &&
            !phone.includes(q) &&
            !email.includes(q) &&
            !unit.includes(q) &&
            !fac.includes(q) &&
            !ctr.includes(q) &&
            !cccd.includes(q)
          ) {
            return false
          }
        }

        // 3. Floor Filter
        if (selectedFloor !== 'all') {
          const floor = resolveBookingFloor(b, unitMapById, unitMapByCodeAndFacility)
          if (!floor || floor !== selectedFloor) return false
        }

        // 4. Shift / Timeframe Filter
        if (selectedShiftFilter !== 'all') {
          const checkInDateTime = b.expectedCheckInAt ? new Date(b.expectedCheckInAt) : (b.startDate ? new Date(b.startDate) : null)
          const bDateStr = checkInDateTime && !isNaN(checkInDateTime.getTime())
            ? `${checkInDateTime.getFullYear()}-${String(checkInDateTime.getMonth() + 1).padStart(2, '0')}-${String(checkInDateTime.getDate()).padStart(2, '0')}`
            : (b.startDate || '')

          if (selectedShiftFilter === 'current' || selectedShiftFilter === 'today') {
            if (bDateStr && bDateStr !== todayStr) return false
          } else if (selectedShiftFilter === 'future') {
            if (bDateStr && bDateStr <= todayStr) return false
          } else if (selectedShiftFilter === 'past') {
            if (bDateStr && bDateStr >= todayStr) return false
          }
        }

        return true
      })
      .sort((a, b) => {
        const aNeedsUnit = !a.storageUnitId
        const bNeedsUnit = !b.storageUnitId
        if (aNeedsUnit && !bNeedsUnit) return -1
        if (!aNeedsUnit && bNeedsUnit) return 1

        const timeB = new Date((b as any).createdAt || b.expectedCheckInAt || b.startDate || 0).getTime()
        const timeA = new Date((a as any).createdAt || a.expectedCheckInAt || a.startDate || 0).getTime()
        return timeB - timeA
      })
  }, [scopedArrivals, receptionStatusFilter, searchQuery, selectedFloor, selectedShiftFilter, unitMapById, unitMapByCodeAndFacility])

  // Workbench arrivals (supports active check-in or viewing finished handovers)
  const workbenchArrivals = useMemo(() => {
    return scopedArrivals.filter((b) => {
      return isPaidCheckIn(b) || b.id === activeBookingId || b.status === 'ACTIVE' || b.status === 'COMPLETED'
    })
  }, [scopedArrivals, activeBookingId])

  // Modals state
  const [reviewDetailBooking, setReviewDetailBooking] = useState<Booking | null>(null)
  const [detailPrereq, setDetailPrereq] = useState<HandoverPrerequisites | null>(null)
  const [loadingDetailPrereq, setLoadingDetailPrereq] = useState(false)
  const [detailContract, setDetailContract] = useState<RentalContract | null>(null)
  const [loadingContractBookingId, setLoadingContractBookingId] = useState<string | null>(null)

  const [earlyConfirmState, setEarlyConfirmState] = useState<{
    booking: Booking
    actionType: EarlyCheckInActionType
    onConfirm: () => void
  } | null>(null)

  const [assignModalBooking, setAssignModalBooking] = useState<Booking | null>(null)
  const [cancellingOverdueBooking, setCancellingOverdueBooking] = useState<Booking | null>(null)

  const [viewingContract, setViewingContract] = useState<RentalContract | null>(null)
  const [viewingContractBooking, setViewingContractBooking] = useState<Booking | null>(null)

  const [photoViewerModal, setPhotoViewerModal] = useState<{
    isOpen: boolean
    title: string
    subtitle?: string
    fileUrl: string | null
    isPdf?: boolean
    notes?: string
  } | null>(null)

  const [rejectingBooking, setRejectingBooking] = useState<Booking | null>(null)
  const [rejectionReasonText, setRejectionReasonText] = useState('')
  const [rejectionError, setRejectionError] = useState('')
  const [isRejectingSubmitting, setIsRejectingSubmitting] = useState(false)

  // Load prerequisites & contract when opening review detail modal
  useEffect(() => {
    if (!reviewDetailBooking?.id || reviewDetailBooking.id.startsWith('LOCAL-RES-')) {
      setDetailPrereq(null)
      setDetailContract(null)
      return
    }
    let active = true
    setLoadingDetailPrereq(true)

    bookingService.getById(reviewDetailBooking.id)
      .then((authoritativeBooking: Booking) => {
        if (!active || !authoritativeBooking) return
        setReviewDetailBooking(prev => (prev && prev.id === authoritativeBooking.id ? { ...prev, ...authoritativeBooking } : prev))
      })
      .catch((err) => {
        console.warn('Không thể tải trạng thái đơn mới nhất từ máy chủ:', err)
      })

    Promise.allSettled([
      handoverService.getCheckInPrerequisites(reviewDetailBooking.id),
      contractService.getContractByBookingId(reviewDetailBooking.id),
    ]).then(([prereqRes, contractRes]) => {
      if (!active) return
      if (prereqRes.status === 'fulfilled') {
        setDetailPrereq(prereqRes.value)
      } else {
        setDetailPrereq(null)
      }
      if (contractRes.status === 'fulfilled') {
        setDetailContract(contractRes.value)
      } else {
        setDetailContract(null)
      }
      setLoadingDetailPrereq(false)
    })

    return () => { active = false }
  }, [reviewDetailBooking?.id])

  // Open contract modal
  const handleOpenContractModal = async (booking: Booking) => {
    if (!booking?.id) return
    setLoadingContractBookingId(booking.id)
    try {
      let contract: RentalContract | null = null
      if (booking.contractId) {
        contract = await contractService.getContractById(booking.contractId)
      }
      if (!contract && !booking.id.startsWith('LOCAL-RES-')) {
        contract = await contractService.getContractByBookingId(booking.id)
      }
      if (contract) {
        setViewingContract(contract)
        setViewingContractBooking(booking)
      } else {
        toast.info(`Đang mở xem chi tiết hợp đồng điện tử của đơn #${booking.bookingCode}`)
        setViewingContractBooking(booking)
      }
    } catch {
      toast.info(`Đang mở xem chi tiết hợp đồng điện tử của đơn #${booking.bookingCode}`)
      setViewingContractBooking(booking)
    } finally {
      setLoadingContractBookingId(null)
    }
  }

  // View payment proof in photo lightbox
  const handleViewPaymentProof = async (booking: Booking, prereq?: HandoverPrerequisites | null) => {
    const paymentWithProof = prereq?.paymentHistory?.find(p => p.proofDocumentUrl && p.proofDocumentUrl.trim().length > 0)
    const proofUrl = paymentWithProof?.proofDocumentUrl

    if (proofUrl) {
      if (proofUrl.startsWith('http://') || proofUrl.startsWith('https://') || proofUrl.startsWith('data:') || proofUrl.startsWith('blob:')) {
        setPhotoViewerModal({
          isOpen: true,
          title: `Ảnh Thanh Toán / Biên Lai Thu Tiền`,
          subtitle: `Mã đơn: ${booking.bookingCode} • Số tiền: ${(paymentWithProof.amount || 0).toLocaleString('vi-VN')}đ (${paymentWithProof.paymentMethod || 'Chuyển khoản'})`,
          fileUrl: proofUrl,
          isPdf: proofUrl.toLowerCase().includes('.pdf'),
          notes: paymentWithProof.paymentNotes || 'Biên lai chuyển khoản / chứng từ nộp tiền tại quầy cơ sở Boxora.'
        })
        return
      }
      try {
        const blobUrl = await handoverService.viewAuthorizedDocument(booking.id, proofUrl)
        setPhotoViewerModal({
          isOpen: true,
          title: `Ảnh Thanh Toán / Biên Lai Thu Tiền`,
          subtitle: `Mã đơn: ${booking.bookingCode} • Số tiền: ${(paymentWithProof.amount || 0).toLocaleString('vi-VN')}đ (${paymentWithProof.paymentMethod || 'Chuyển khoản'})`,
          fileUrl: blobUrl,
          isPdf: proofUrl.toLowerCase().includes('.pdf'),
          notes: paymentWithProof.paymentNotes || 'Biên lai chuyển khoản / chứng từ nộp tiền tại quầy cơ sở Boxora.'
        })
      } catch {
        toast.error('Không thể tải ảnh chứng từ thanh toán lúc này. Vui lòng thử lại.')
      }
      return
    }

    const vnpayPayment = prereq?.paymentHistory?.find(p => p.paymentMethod === 'VNPAY' || (p.status === 'PAID' && !p.proofDocumentUrl))
    if (vnpayPayment || booking.paymentStatus === 'PAID') {
      setPhotoViewerModal({
        isOpen: true,
        title: `Chứng Từ Thanh Toán - Đơn ${booking.bookingCode}`,
        subtitle: 'Thanh toán trực tuyến VNPay Gateway',
        fileUrl: null,
        notes: `Đơn đã được thanh toán trực tuyến thành công qua cổng thanh toán VNPay. Mã đơn: ${booking.bookingCode} • Số tiền: ${(booking.depositPaid || booking.depositAmount || 0).toLocaleString('vi-VN')}đ. Giao dịch điện tử tự động không có ảnh chụp chứng từ giấy.`
      })
      return
    }

    toast.warning('Đơn đặt kho này chưa có ảnh chứng từ thanh toán nào được tải lên.')
  }

  // View signed contract photo in photo lightbox
  const handleViewSignedContractPhoto = async (booking: Booking, prereq?: HandoverPrerequisites | null, contract?: RentalContract | null) => {
    const paperUrl = contract?.paperContractUrl || prereq?.paperContractUrl || (booking as any).paperContractUrl

    if (paperUrl) {
      if (paperUrl.startsWith('http://') || paperUrl.startsWith('https://') || paperUrl.startsWith('data:') || paperUrl.startsWith('blob:')) {
        setPhotoViewerModal({
          isOpen: true,
          title: `Ảnh Hợp Đồng Đã Ký Tại Quầy`,
          subtitle: `Mã HĐ: ${contract?.contractCode || booking.contractCode || 'HĐ Giấy Tại Quầy'} • Đơn: ${booking.bookingCode}`,
          fileUrl: paperUrl,
          isPdf: paperUrl.toLowerCase().includes('.pdf'),
          notes: (contract as any)?.paperNotes || 'Bản scan / ảnh chụp văn bản Hợp đồng đã ký trực tiếp tại quầy cơ sở Boxora.'
        })
        return
      }
      try {
        const blobUrl = await handoverService.viewAuthorizedDocument(booking.id, paperUrl)
        setPhotoViewerModal({
          isOpen: true,
          title: `Ảnh Hợp Đồng Đã Ký Tại Quầy`,
          subtitle: `Mã HĐ: ${contract?.contractCode || booking.contractCode || 'HĐ Giấy Tại Quầy'} • Đơn: ${booking.bookingCode}`,
          fileUrl: blobUrl,
          isPdf: paperUrl.toLowerCase().includes('.pdf'),
          notes: (contract as any)?.paperNotes || 'Bản scan / ảnh chụp văn bản Hợp đồng đã ký trực tiếp tại quầy cơ sở Boxora.'
        })
      } catch {
        toast.error('Không thể tải ảnh hợp đồng đã ký lúc này. Vui lòng thử lại.')
      }
      return
    }

    const docUrl = contract?.signedDocumentUrl || prereq?.signedDocumentUrl
    if (docUrl) {
      setPhotoViewerModal({
        isOpen: true,
        title: `Văn Bản Hợp Đồng Điện Tử Đã Ký`,
        subtitle: `Mã HĐ: ${contract?.contractCode || booking.contractCode}`,
        fileUrl: docUrl,
        isPdf: true,
        notes: 'Hợp đồng điện tử ký số qua nền tảng DocuSeal, có giá trị pháp lý đầy đủ.'
      })
      return
    }

    handleOpenContractModal(booking)
  }

  // Cancel overdue booking (>48h)
  const executeCancelOverdueBooking = async (booking: Booking, customReason?: string) => {
    const reason = customReason?.trim() || 'Hủy đơn do quá hạn 48 giờ sau lịch hẹn check-in nhưng khách hàng chưa đến làm thủ tục tiếp nhận tại quầy'
    try {
      const isBackendId = Boolean(booking.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(booking.id.trim()))
      const targetIdOrCode = isBackendId ? booking.id : booking.bookingCode
      try {
        await bookingService.cancelBooking(targetIdOrCode, reason)
      } catch (err) {
        console.warn('Backend cancel booking overdue error (fallback to local):', err)
      }

      reservationEmailService.cancelOverdueReservation(booking.bookingCode, reason, {
        id: user?.id,
        fullName: user?.fullName || 'Nhân viên quầy Boxora',
      })

      toast.success(`Đã hủy đơn ${booking.bookingCode} quá hạn và giải phóng buồng kho.`)
      setCancellingOverdueBooking(null)
      if (onRefresh) {
        onRefresh()
      } else {
        fetchInternalArrivals()
      }
    } catch {
      toast.error('Có lỗi xảy ra khi hủy đơn quá hạn. Vui lòng thử lại.')
    }
  }

  // Reject booking
  const handleConfirmRejectBooking = async () => {
    if (!rejectingBooking) return
    if (!rejectionReasonText.trim()) {
      setRejectionError('Vui lòng nhập lý do từ chối đơn đặt giữ chỗ.')
      return
    }
    setIsRejectingSubmitting(true)
    setRejectionError('')
    try {
      const isBackendId = Boolean(rejectingBooking.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rejectingBooking.id.trim()))
      const targetIdOrCode = isBackendId ? rejectingBooking.id : rejectingBooking.bookingCode
      await bookingService.cancelBooking(targetIdOrCode, rejectionReasonText.trim())
      toast.success(`Đã từ chối đơn đặt ${rejectingBooking.bookingCode}.`)
      setRejectingBooking(null)
      setRejectionReasonText('')
      if (onRefresh) {
        onRefresh()
      } else {
        fetchInternalArrivals()
      }
    } catch (err: any) {
      setRejectionError(err?.response?.data?.message || 'Không thể từ chối đơn lúc này. Vui lòng thử lại.')
    } finally {
      setIsRejectingSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in">
      {/* 1. TACTICAL SEARCH & LOCATION FILTER RIBBON */}
      <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm nhanh tên khách hàng, SĐT, mã đặt chỗ #BX-XXXX, mã hợp đồng, hoặc mã số kho..."
            className="w-full pl-10 pr-3 py-2 bg-slate-50 text-slate-900 text-xs rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:border-blue-600 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
            <span className="text-slate-500 font-medium">Khu vực:</span>
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả tầng</option>
              {availableFloors.length > 0 ? (
                availableFloors.map(fl => (
                  <option key={fl} value={fl}>Tầng {fl}</option>
                ))
              ) : (
                <>
                  <option value="1">Tầng 1</option>
                  <option value="2">Tầng 2</option>
                  <option value="3">Tầng 3</option>
                </>
              )}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
            <span className="text-slate-500 font-medium">Khung giờ:</span>
            <select
              value={selectedShiftFilter}
              onChange={(e) => setSelectedShiftFilter(e.target.value as any)}
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả lịch hẹn (Hôm nay &amp; Sắp tới)</option>
              <option value="current">Ca Hiện Tại</option>
              <option value="today">Trọn Vẹn Hôm Nay</option>
              <option value="future">Lịch Hẹn Sắp Tới</option>
              <option value="past">Lịch Sử Đã Qua</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. OPERATOR WORKBENCH (FULL-WIDTH 4-STEP CHECK-IN) */}
      {isManagementRole ? (
        <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-900 flex items-start gap-3.5 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">visibility</span>
          </div>
          <div className="text-xs leading-relaxed">
            <div className="flex items-center gap-2 font-bold text-sm text-blue-950 mb-0.5">
              <span>Chế độ giám sát quy trình tiếp nhận &amp; bàn giao kho</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-200 text-blue-800">CHỈ ĐỌC</span>
            </div>
            <p className="text-blue-800">
              Tài khoản <strong>{resolvedRole === 'ADMIN' ? 'Quản Trị Viên (Admin)' : 'Quản Lý Kinh Doanh (Business Manager)'}</strong> đang theo dõi danh sách lịch hẹn và đối soát điều kiện check-in ở chế độ giám sát chỉ đọc. Quy trình 4 bước tiếp nhận khách hàng (Xác thực CCCD, Gán kho vật lý, Hợp đồng &amp; Thanh toán, Cấp PIN SmartLock) được thực hiện trực tiếp bởi <strong>Nhân viên quầy (Facility Staff)</strong> và <strong>Quản lý cơ sở (Facility Manager)</strong> tại quầy tiếp đón. Bấm <em>"Xem chi tiết"</em> tại từng đơn trong bảng bên dưới để đối soát 3 điều kiện bàn giao.
            </p>
          </div>
        </div>
      ) : (
        <HandoverCheckInWorkbench
          facilityId={facilityId}
          arrivals={workbenchArrivals}
          activeBookingId={activeBookingId}
          onSelectBooking={handleSetActiveBookingId}
          onHandoverComplete={(bookingId) => {
            if (onHandoverComplete) {
              onHandoverComplete(bookingId)
            } else {
              toast.success(`Hoàn tất quy trình check-in bàn giao buồng kho cho đơn #${bookingId}`)
              if (onRefresh) {
                onRefresh()
              } else {
                fetchInternalArrivals()
              }
            }
          }}
        />
      )}

      {/* 3. CHECK-IN QUEUE TABLE CONTAINER */}
      <div id="checkin-queue-table" className="w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-6 scroll-mt-6">
        {/* 3 Status Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setReceptionStatusFilter('PENDING_CHECKIN')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                receptionStatusFilter === 'PENDING_CHECKIN'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
              <span>Chờ Check-in</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                receptionStatusFilter === 'PENDING_CHECKIN' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
              }`}>
                {receptionCounts.pendingCheckIn}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setReceptionStatusFilter('HANDED_OVER')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                receptionStatusFilter === 'HANDED_OVER'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>Đã Bàn Giao</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                receptionStatusFilter === 'HANDED_OVER' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {receptionCounts.handedOver}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setReceptionStatusFilter('ALL')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                receptionStatusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">inventory_2</span>
              <span>Tổng Đơn Tiếp Đón</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                receptionStatusFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
              }`}>
                {receptionCounts.total}
              </span>
            </button>
          </div>

          <span className="text-xs text-slate-500 font-mono font-bold">
            Hiển thị {receptionArrivals.length} / {receptionCounts.total} đơn
          </span>
        </div>

        {/* 6-Column Standard Queue Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-mono uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3 rounded-l-lg font-semibold">Khách hàng</th>
                <th className="py-2.5 px-3 font-semibold">Loại kho</th>
                <th className="py-2.5 px-3 font-semibold">Thời gian tiếp đón</th>
                <th className="py-2.5 px-3 font-semibold">Trạng Thái &amp; Chữ Ký</th>
                <th className="py-2.5 px-3 font-semibold">Cọc Giữ Chỗ</th>
                <th className="py-2.5 px-3 rounded-r-lg text-right font-semibold">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {receptionArrivals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    {internalLoading
                      ? 'Đang tải danh sách lịch hẹn tiếp đón...'
                      : 'Không có lịch hẹn nhận kho nào đang chờ check-in trong ca trực hiện tại.'}
                  </td>
                </tr>
              ) : (
                receptionArrivals.map((b) => {
                  const isContractSigned = Boolean(b.contractSigned) || b.contractStatus === 'PENDING_ACTIVATION' || b.contractStatus === 'ACTIVE'
                  const hasContract = Boolean(b.contractCode || b.contractId || b.paymentStatus === 'PAID' || b.status === 'CONFIRMED' || b.status === 'ACTIVE')
                  const hasPhysicalUnit = Boolean(b.storageUnitId && b.unitCode && b.unitCode !== 'Kho tự quản')

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Cột 1: Khách hàng */}
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-900 text-xs">{b.customerName || 'Khách vãng lai'}</div>
                        <div className="text-slate-500 font-mono text-[11px] tabular-nums mt-0.5">{b.customerPhone || 'N/A'}</div>
                        {b.customerEmail && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[150px]" title={b.customerEmail}>
                            {b.customerEmail}
                          </div>
                        )}
                        <div className="text-[10.5px] font-mono text-slate-600 mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-800">{b.bookingCode}</span>
                          {b.contractCode && (
                            <span className="text-blue-700 font-semibold">• HĐ: {b.contractCode}</span>
                          )}
                        </div>
                      </td>

                      {/* Cột 2: Loại kho */}
                      <td className="py-3.5 px-3">
                        <span className="text-slate-800 font-semibold block text-xs">{b.facilityName || facilityName || 'Boxora'}</span>
                        <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                          {hasPhysicalUnit ? (
                            <span className="font-bold text-cyan-700">Kho #{b.unitCode}</span>
                          ) : (
                            <span className="text-slate-600">{b.unitTypeName || 'Tiêu chuẩn'}</span>
                          )}
                          <span> · {b.rentalMonths || 1} tháng</span>
                        </span>
                        {!hasPhysicalUnit && (
                          <span className="inline-block px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 mt-1">
                            Chưa gán buồng kho
                          </span>
                        )}
                      </td>

                      {/* Cột 3: Thời gian tiếp đón */}
                      <td className="py-3.5 px-3">
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
                              : ((b as any).checkInTime || '09:00')}
                          </span>
                        </div>
                      </td>

                      {/* Cột 4: Trạng Thái & Chữ Ký */}
                      <td className="py-3.5 px-3">
                        <div className="flex flex-col items-start gap-1">
                          {b.status === 'ACTIVE' || b.status === 'COMPLETED' ? (
                            <>
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
                                <span className="material-symbols-outlined text-[13px]">verified</span>
                                <span>ĐÃ BÀN GIAO KHO</span>
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ✓ Đang hoạt động
                              </span>
                            </>
                          ) : !hasPhysicalUnit ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span>ĐÃ THANH TOÁN - CHỜ GÁN KHO</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-300">
                              <span className="material-symbols-outlined text-[13px]">how_to_reg</span>
                              <span>Chờ check in</span>
                            </span>
                          )}
                          {b.status !== 'CANCELLED' && b.status !== 'ACTIVE' && b.status !== 'COMPLETED' && isContractSigned && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ✓ Đã ký HĐ điện tử
                            </span>
                          )}
                          {b.signingMethod === 'IN_PERSON' && !isContractSigned && b.status !== 'ACTIVE' && b.status !== 'COMPLETED' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              🏢 Ký giấy tại quầy
                            </span>
                          )}
                          {hasContract && !isContractSigned && b.signingMethod !== 'IN_PERSON' && b.status !== 'ACTIVE' && b.status !== 'COMPLETED' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              ⏳ Chờ khách ký HĐ
                            </span>
                          )}
                          {b.assignedStaffName ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200" title={`Nhân viên tiếp nhận: ${b.assignedStaffName}`}>
                              <span className="material-symbols-outlined text-[12px]">person</span>
                              <span>Tiếp nhận: <strong>{b.assignedStaffName}</strong></span>
                            </span>
                          ) : b.status !== 'ACTIVE' && b.status !== 'COMPLETED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200" title="Đơn chưa có nhân viên tiếp nhận">
                              <span className="material-symbols-outlined text-[12px]">person_off</span>
                              <span>Chưa tiếp nhận</span>
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Cột 5: Cọc Giữ Chỗ */}
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-900 tabular-nums">
                        {(b.depositPaid || b.depositAmount || b.totalRentalFee || 0).toLocaleString('vi-VN')}đ
                      </td>

                      {/* Cột 6: Hành động */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setReviewDetailBooking(b)}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1"
                            title="Xem chi tiết đơn & hợp đồng"
                          >
                            <span className="material-symbols-outlined text-[14px]">visibility</span>
                            <span>Xem chi tiết</span>
                          </button>

                          {b.status === 'ACTIVE' || b.status === 'COMPLETED' ? (
                            <button
                              type="button"
                              onClick={() => {
                                handleSetActiveBookingId(b.id)
                                document.getElementById('handover-workbench')?.scrollIntoView({ behavior: 'smooth' })
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1 shadow-xs"
                              title="Xem hồ sơ bàn giao & thông tin mã PIN"
                            >
                              <span className="material-symbols-outlined text-[14px]">inventory_2</span>
                              <span>Hồ Sơ Bàn Giao</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                const proceed = () => {
                                  handleSetActiveBookingId(b.id)
                                  document.getElementById('handover-workbench')?.scrollIntoView({ behavior: 'smooth' })
                                }
                                const { isPremature } = isBookingBeforeCheckInTime(b)
                                if (isPremature) {
                                  setEarlyConfirmState({
                                    booking: b,
                                    actionType: 'ENTER_RECEPTION',
                                    onConfirm: proceed,
                                  })
                                } else {
                                  proceed()
                                }
                              }}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1 shadow-xs"
                              title="Tiến hành thủ tục tiếp nhận và bàn giao kho"
                            >
                              <span className="material-symbols-outlined text-[14px]">desk</span>
                              <span>Tiếp nhận</span>
                            </button>
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
      </div>

      {/* MODAL 1: XEM CHI TIẾT ĐƠN ĐẶT GIỮ CHỖ CỦA STAFF & MANAGER */}
      {reviewDetailBooking && (() => {
        const s = String(reviewDetailBooking.status || '').toUpperCase()
        const isCancelled = s === 'CANCELLED' || s === 'REJECTED'
        const isModalPaidPending = !isCancelled && (s === 'PAID_PENDING_ASSIGNMENT' || s === 'PAID_AND_SIGNED' || (s === 'CONFIRMED' && !reviewDetailBooking.storageUnitId))
        const isModalConfirmed = !isCancelled && ((s === 'CONFIRMED' && Boolean(reviewDetailBooking.storageUnitId)) || s === 'AWAITING_CHECKIN')
        const modalIsInPerson = reviewDetailBooking.signingMethod === 'IN_PERSON'
          || (reviewDetailBooking as any).signingMethod === 'in_person'
          || (reviewDetailBooking as any).paymentMethod === 'AT_FACILITY'
          || (reviewDetailBooking as any).paymentMethod === 'IN_PERSON'

        const isModalContractSigned = Boolean(reviewDetailBooking.contractSigned)
          || reviewDetailBooking.contractStatus === 'PENDING_ACTIVATION'
          || reviewDetailBooking.contractStatus === 'ACTIVE'
          || (!modalIsInPerson && Boolean(reviewDetailBooking.contractCode) && (
              reviewDetailBooking.paymentStatus === 'PAID' ||
              reviewDetailBooking.paymentStatus === 'REFUNDED' ||
              reviewDetailBooking.paymentStatus === 'REFUND_PENDING' ||
              s === 'PAID_AND_SIGNED' ||
              s === 'PAID_PENDING_ASSIGNMENT'
            ))

        const hasModalContract = Boolean(
          reviewDetailBooking.contractCode ||
          reviewDetailBooking.contractId ||
          reviewDetailBooking.paymentStatus === 'PAID' ||
          isModalConfirmed ||
          isModalContractSigned ||
          s === 'ACTIVE' ||
          s === 'COMPLETED'
        )
        const sched = getBookingScheduleInfo(reviewDetailBooking)
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
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh] text-xs sm:text-sm">
                {/* Thông tin Hợp đồng & Trạng thái đơn */}
                <div className={`p-4 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isCancelled
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100'
                    : isModalPaidPending
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-950 dark:text-emerald-100'
                    : isModalConfirmed
                    ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 text-cyan-900 dark:text-cyan-200'
                    : s === 'ACTIVE'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-900 dark:text-emerald-200'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 text-amber-900 dark:text-amber-200'
                }`}>
                  <div className="space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-[13px]">
                      <span className="material-symbols-outlined text-[17px]">
                        {isCancelled ? 'cancel' : isModalContractSigned ? 'verified' : 'description'}
                      </span>
                      <span>
                        {isCancelled
                          ? 'ĐÃ HỦY / TỪ CHỐI'
                          : isModalPaidPending
                          ? 'Đã thanh toán · Sẵn sàng Check-in gán kho'
                          : isModalConfirmed
                          ? 'Đã ký HĐ điện tử · Chờ khách đến kho Check-in'
                          : s === 'ACTIVE'
                          ? 'Đang thuê (Hợp đồng ACTIVE)'
                          : s === 'PENDING_CONTACT'
                          ? 'Chờ liên hệ tư vấn'
                          : 'Chờ xác nhận'}
                      </span>
                    </div>
                    {isCancelled && (reviewDetailBooking.rejectionReason || reviewDetailBooking.cancellationReason) && (
                      <div className="text-[11.5px] text-rose-700 dark:text-rose-300 font-medium">
                        Lý do từ chối: <span className="italic font-semibold">"{(reviewDetailBooking.rejectionReason || reviewDetailBooking.cancellationReason)}"</span>
                      </div>
                    )}
                    <div className="text-[11px] opacity-90 flex items-center gap-2 flex-wrap font-mono">
                      <span>Mã HĐ: <strong className="text-blue-700 dark:text-blue-400 font-bold">{reviewDetailBooking.contractCode || `CTR-${reviewDetailBooking.bookingCode}`}</strong></span>
                      {isModalContractSigned ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-sans font-semibold">
                          ✓ Đã ký điện tử
                        </span>
                      ) : reviewDetailBooking.signingMethod === 'IN_PERSON' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-sans font-semibold">
                          🏢 Ký giấy tại quầy
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-sans font-semibold">
                          ⏳ Chờ ký
                        </span>
                      )}
                    </div>
                  </div>

                  {hasModalContract && !reviewDetailBooking.id.startsWith('LOCAL-RES-') && (
                    <button
                      type="button"
                      onClick={() => handleOpenContractModal(reviewDetailBooking)}
                      disabled={loadingContractBookingId === reviewDetailBooking.id}
                      className="shrink-0 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition active:scale-95"
                      title="Mở xem văn bản Hợp đồng điện tử & chữ ký khách hàng"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {loadingContractBookingId === reviewDetailBooking.id ? 'hourglass_top' : 'description'}
                      </span>
                      <span>{loadingContractBookingId === reviewDetailBooking.id ? 'Đang tải...' : 'Xem Hợp Đồng'}</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Khách hàng:</span>
                    <strong className="text-slate-900 dark:text-white font-sans text-xs">{reviewDetailBooking.customerName}</strong>
                    <div className="text-blue-600 font-bold text-xs mt-0.5">{reviewDetailBooking.customerPhone}</div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">CCCD &amp; Email:</span>
                    <strong className="text-slate-900 dark:text-white text-xs block">{reviewDetailBooking.identityCardNumber || 'Chưa cung cấp'}</strong>
                    <span className="text-[11px] text-slate-500 font-sans truncate block">{reviewDetailBooking.customerEmail || 'Chưa có'}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Cơ sở kho:</span>
                    <strong className="text-slate-900 dark:text-white font-sans text-xs">{reviewDetailBooking.facilityName || facilityName || 'Boxora'}</strong>
                    <span className="text-[11px] text-slate-500 block">Quy cách: {reviewDetailBooking.unitCode ? `Kho #${reviewDetailBooking.unitCode}` : (reviewDetailBooking.unitTypeName || 'Tiêu chuẩn')}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Thời gian sẽ tiếp đón khách hàng:</span>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <strong className="text-emerald-600 dark:text-emerald-400 text-xs">
                        {reviewDetailBooking.expectedCheckInAt
                          ? `${new Date(reviewDetailBooking.expectedCheckInAt).toLocaleDateString('vi-VN')} ${new Date(reviewDetailBooking.expectedCheckInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                          : `${(reviewDetailBooking as any).checkInDate || reviewDetailBooking.startDate} (${(reviewDetailBooking as any).checkInTime || 'Giờ tiếp đón'})`}
                      </strong>
                      {sched.relativeText && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${sched.badgeClass}`}>
                          {sched.relativeText}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-sans mt-0.5 block">Thời hạn thuê: {(reviewDetailBooking as any).rentalDurationText || (reviewDetailBooking.rentalMonths ? `${reviewDetailBooking.rentalMonths} tháng` : '1 tháng')}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 sm:col-span-2">
                  <span className="text-[10px] text-slate-400 block uppercase">Nhân viên tiếp nhận / Phụ trách:</span>
                  {reviewDetailBooking.assignedStaffName ? (
                    <div className="flex items-center gap-1.5 mt-0.5 text-blue-700 font-bold text-xs">
                      <span className="material-symbols-outlined text-[16px]">person</span>
                      <span>{reviewDetailBooking.assignedStaffName}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-0.5 text-slate-500 font-medium text-xs">
                      <span className="material-symbols-outlined text-[16px]">person_off</span>
                      <span>Chưa tiếp nhận</span>
                    </div>
                  )}
                </div>

                {/* MỤC CHỨNG TỪ HOÀN TẤT ĐÃ KÝ & THANH TOÁN */}
                {(s === 'ACTIVE' || s === 'COMPLETED' || isModalContractSigned || reviewDetailBooking.paymentStatus === 'PAID') && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/90 to-indigo-50/90 dark:from-slate-800/90 dark:to-slate-800/60 border border-blue-200 dark:border-blue-900/50 shadow-xs space-y-3 sm:col-span-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[18px]">verified</span>
                        </span>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">Chứng Từ Nghiệm Thu &amp; Bàn Giao Hoàn Tất</h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">Xem nhanh ảnh biên lai thanh toán và bản scan hợp đồng đã ký</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 shrink-0">
                        {s === 'ACTIVE' || s === 'COMPLETED' ? '✓ ĐÃ HOÀN TẤT' : '✓ ĐÃ CÓ CHỨNG TỪ'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {/* Nút 1: Ảnh thanh toán */}
                      <button
                        type="button"
                        onClick={() => handleViewPaymentProof(reviewDetailBooking, detailPrereq)}
                        disabled={loadingDetailPrereq}
                        className="px-4 py-3 rounded-xl bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-slate-800 border border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-200 font-bold text-xs flex items-center justify-between gap-2 shadow-xs transition hover:border-emerald-400 cursor-pointer group disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                          </span>
                          <div className="text-left">
                            <span className="block font-bold text-xs text-slate-900 dark:text-white">Ảnh thanh toán</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                              {loadingDetailPrereq ? 'Đang kiểm tra...' : detailPrereq?.paymentHistory?.some(p => p.proofDocumentUrl) ? 'Xem biên lai chuyển khoản' : 'Thanh toán trực tuyến VNPay / Quầy'}
                            </span>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-emerald-600 transition">
                          visibility
                        </span>
                      </button>

                      {/* Nút 2: Ảnh hợp đồng đã ký */}
                      <button
                        type="button"
                        onClick={() => handleViewSignedContractPhoto(reviewDetailBooking, detailPrereq, detailContract)}
                        disabled={loadingDetailPrereq}
                        className="px-4 py-3 rounded-xl bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-800 border border-blue-300 dark:border-blue-700/60 text-blue-800 dark:text-blue-200 font-bold text-xs flex items-center justify-between gap-2 shadow-xs transition hover:border-blue-400 cursor-pointer group disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                            <span className="material-symbols-outlined text-[18px]">description</span>
                          </span>
                          <div className="text-left">
                            <span className="block font-bold text-xs text-slate-900 dark:text-white">Ảnh hợp đồng đã ký</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                              {loadingDetailPrereq ? 'Đang kiểm tra...' : (detailContract?.paperContractUrl || detailPrereq?.paperContractUrl) ? 'Bản scan HĐ giấy tại quầy' : 'Hợp đồng điện tử đã ký'}
                            </span>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-blue-600 transition">
                          visibility
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {!isCancelled && !modalIsActiveOrCompleted && !isManagementRole && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = reviewDetailBooking
                        setReviewDetailBooking(null)
                        setRejectingBooking(target)
                        setRejectionReasonText('')
                        setRejectionError('')
                      }}
                      className="px-4 py-2.5 rounded-xl border border-rose-300 hover:bg-rose-50 text-rose-700 text-xs font-bold cursor-pointer"
                    >
                      Từ chối đơn...
                    </button>
                  )}

                  {!isCancelled && modalIsOverdue48h && modalIsInPerson && !modalIsActiveOrCompleted && !isManagementRole && (
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

                  {!isManagementRole && !isCancelled && isModalPaidPending ? (
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
                  ) : !isManagementRole && !isCancelled && isModalConfirmed ? (
                    <button
                      type="button"
                      onClick={() => {
                        const target = reviewDetailBooking
                        const proceed = () => {
                          setReviewDetailBooking(null)
                          handleSetActiveBookingId(target.id)
                          setTimeout(() => {
                            document.getElementById('handover-workbench')?.scrollIntoView({ behavior: 'smooth' })
                          }, 100)
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

      {/* MODAL 2: TỪ CHỐI ĐƠN */}
      {rejectingBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col text-left animate-in zoom-in-95 duration-200">
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
                onClick={() => setRejectingBooking(null)}
                disabled={isRejectingSubmitting}
                className="w-8 h-8 rounded-full bg-rose-800 hover:bg-rose-900 text-rose-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs">
                Bạn đang từ chối đơn đặt giữ chỗ của khách hàng <strong>{rejectingBooking.customerName}</strong> ({rejectingBooking.customerPhone}). Vui lòng nhập lý do rõ ràng để thông báo tới khách hàng.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Lý do từ chối đơn <span className="text-rose-600">*</span>:
                </label>
                <textarea
                  rows={3}
                  value={rejectionReasonText}
                  onChange={(e) => setRejectionReasonText(e.target.value)}
                  placeholder="Ví dụ: Không liên lạc được với khách hàng, thông tin CCCD không trùng khớp..."
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              {rejectionError && (
                <div className="p-3 rounded-xl bg-rose-100 text-rose-800 text-xs font-medium">
                  {rejectionError}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectingBooking(null)}
                disabled={isRejectingSubmitting}
                className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmRejectBooking}
                disabled={isRejectingSubmitting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {isRejectingSubmitting ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: PHOTO / DOCUMENT VIEWER LIGHTBOX */}
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
              {photoViewerModal.fileUrl ? (
                photoViewerModal.isPdf ? (
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
                )
              ) : (
                <div className="text-center p-6 space-y-2">
                  <span className="material-symbols-outlined text-4xl text-slate-400">info</span>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {photoViewerModal.notes || 'Không có tệp ảnh xem trước.'}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              {photoViewerModal.fileUrl ? (
                <button
                  type="button"
                  onClick={() => window.open(photoViewerModal.fileUrl!, '_blank')}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  <span>Mở tab mới / Tải xuống</span>
                </button>
              ) : <div />}
              <button
                type="button"
                onClick={() => setPhotoViewerModal(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: XEM HỢP ĐỒNG ĐIỆN TỬ */}
      <ContractDocumentModal
        contract={viewingContract}
        booking={viewingContractBooking}
        onClose={() => {
          setViewingContract(null)
          setViewingContractBooking(null)
        }}
      />

      {/* MODAL 5: GÁN BUỒNG KHO VẬT LÝ */}
      <AssignPhysicalUnitModal
        isOpen={Boolean(assignModalBooking)}
        booking={assignModalBooking}
        facilityId={assignModalBooking?.facilityId || (facilityId && facilityId !== 'ALL' ? facilityId : undefined)}
        onClose={() => setAssignModalBooking(null)}
        onSuccess={(_updated) => {
          setAssignModalBooking(null)
          if (onRefresh) {
            onRefresh()
          } else {
            fetchInternalArrivals()
          }
          window.dispatchEvent(new Event('boxora:notifications-refresh'))
        }}
      />

      {/* MODAL 6: XÁC NHẬN CHECK-IN SỚM */}
      <EarlyCheckInConfirmModal
        isOpen={Boolean(earlyConfirmState)}
        booking={earlyConfirmState?.booking || null}
        actionType={earlyConfirmState?.actionType || 'ENTER_RECEPTION'}
        onConfirm={() => {
          const action = earlyConfirmState?.onConfirm
          setEarlyConfirmState(null)
          if (action) action()
        }}
        onClose={() => setEarlyConfirmState(null)}
      />

      {/* MODAL 7: HỦY ĐƠN QUÁ HẠN 48H */}
      <CancelOverdueBookingModal
        isOpen={Boolean(cancellingOverdueBooking)}
        booking={cancellingOverdueBooking}
        userRoleTitle={user?.fullName ? `${user.fullName} (${resolvedRole === 'STAFF' ? 'Nhân viên quầy' : 'Quản lý cơ sở'})` : 'Nhân sự vận hành Boxora'}
        onConfirm={(b, r) => executeCancelOverdueBooking(b, r)}
        onClose={() => setCancellingOverdueBooking(null)}
      />
    </div>
  )
}

export default ReceptionDeskWorkbench

