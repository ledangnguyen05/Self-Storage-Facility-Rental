import React, { useState, useEffect, useMemo, useRef } from 'react'

import { useOutletContext, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { bookingService } from '../../services/bookingService'
import { paymentService, PaymentItem } from '../../services/paymentService'
import { handoverService, HandoverPrerequisites } from '../../services/handoverService'
import { reportService } from '../../services/reportService'
import { masterKeyService } from '../../services/masterKeyService'
import { supportTicketService } from '../../services/supportTicketService'
import { facilityService } from '../../services/facilityService'
import { storageUnitService } from '../../services/storageUnitService'
import { contractService } from '../../services/contractService'
import { Booking, StorageUnit, Facility, FacilityPolicy, OccupancyReport, RentalContract } from '../../types'
import { extractFloor, resolveBookingFloor, filterArrivals, AppointmentStatusFilter } from '../../utils/floorUtils'
import { reservationEmailService } from '../../services/reservationEmailService'

import { HandoverCheckInWorkbench } from './components/HandoverCheckInWorkbench'
import { StaffPolicyGuideModal } from './components/StaffPolicyGuideModal'
import { ContractDocumentModal } from '../../components/modals/ContractDocumentModal'
import { AssignPhysicalUnitModal } from '../../components/modals/AssignPhysicalUnitModal'
import { staffAssignmentService, StaffAssignmentResponse, isShiftAbsent } from '../../services/staffAssignmentService'
import { ShiftSwapModal } from '../manager/modals/ShiftSwapModal'
import { ShiftHandoverModal } from '../manager/modals/ShiftHandoverModal'
import { ReceptionShiftAlertModal } from '../../components/modals/ReceptionShiftAlertModal'
import { EarlyCheckInConfirmModal, isBookingBeforeCheckInTime, EarlyCheckInActionType, getBookingScheduleInfo } from '../../components/modals/EarlyCheckInConfirmModal'
import { ContractRenewalsManagementPanel } from '../../components/renewal/ContractRenewalsManagementPanel'
import { getAssignmentWindow } from '../../constants/shiftConstants'
import { toast } from '../../utils/toast'

const localDateString = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const assignmentWindow = (assignment: StaffAssignmentResponse) => {
  return getAssignmentWindow(assignment)
}

const isWithinAssignmentWindow = (assignment: StaffAssignmentResponse, now = new Date()) => {
  const window = assignmentWindow(assignment)
  return Boolean(window && now >= window.start && now < window.end)
}

const isAssignmentOnDuty = (assignment: StaffAssignmentResponse | null, now = new Date()) => {
  if (!assignment || assignment.status !== 'CHECKED_IN' || !assignment.checkedInAt || assignment.checkedOutAt) return false
  return isWithinAssignmentWindow(assignment, now)
}


export const StaffDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { selectedFacility, facilities: contextFacilities } = useOutletContext<{
    selectedFacility?: string
    facilities?: Facility[]
  }>() || {}
  const isAdmin = user?.role?.name === 'ADMIN' || user?.roleName === 'ADMIN' || (user as any)?.role === 'ADMIN'
  const resolvedRole = (typeof user?.role === 'string' ? user?.role : user?.role?.name || user?.roleName || 'STAFF').toUpperCase()
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [checkInSuccessMsg, setCheckInSuccessMsg] = useState<string | null>(null)

  const currentTargetFacility = useMemo(() => {
    if (user?.facilityId) return user.facilityId
    if (selectedFacility && selectedFacility !== 'ALL') return selectedFacility
    return facilities.length > 0 ? facilities[0].id : ''
  }, [user?.facilityId, selectedFacility, facilities])

  // Master Key Emergency Override Modal (BR-RULE-009)
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false)
  const [emergencyFacilityId, setEmergencyFacilityId] = useState('')
  const [emergencyReason, setEmergencyReason] = useState('Sự cố kẹt khóa điện tử khẩn cấp tại cửa phân khu')
  const [emergencyCategory, setEmergencyCategory] = useState<'MAINTENANCE_EMERGENCY' | 'FIRE_HAZARD' | 'POLICE_WARRANT' | 'ABANDONED_AUCTION' | 'INTERNAL_AUDIT'>('MAINTENANCE_EMERGENCY')
  const [emergencySeverity, setEmergencySeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('CRITICAL')
  const [witnessStaffId, setWitnessStaffId] = useState('')
  const [witnessPassword, setWitnessPassword] = useState('')
  const [isEmergencyCalling, setIsEmergencyCalling] = useState(false)
  const [emergencyResult, setEmergencyResult] = useState<string | null>(null)
  const [emergencyError, setEmergencyError] = useState<string | null>(null)

  const assignedFacilityName = useMemo(() => {
    return facilities.find(f => f.id === selectedFacility)?.name || 'Cơ sở Boxora'
  }, [facilities, selectedFacility])

  const closeBookingDetail = () => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('bookingId')
      return next
    })
  }

  // Work Shift & Attendance State
  type StaffTab = 'pending_orders' | 'reception' | 'renewals'
  const [staffActiveTab, setStaffActiveTab] = useState<StaffTab>(() => {
    const tabParam = new URLSearchParams(window.location.search).get('tab')
    if (tabParam === 'pending_orders' || tabParam === 'reception' || tabParam === 'renewals') {
      return tabParam as StaffTab
    }
    return 'pending_orders'
  })
  const [tab1Filter, setTab1Filter] = useState<'PENDING_CONTACT' | 'CANCELLED' | 'ALL'>('PENDING_CONTACT')
  const [pendingSearchTerm, setPendingSearchTerm] = useState('')
  const [highlightedBookingCode, setHighlightedBookingCode] = useState<string | null>(null)
  const [assignModalBooking, setAssignModalBooking] = useState<Booking | null>(null)
  const [receptionViewMode, setReceptionViewMode] = useState<'all' | 'check_in' | 'returns'>('all')

  const handleCreatePaymentLinkForCustomer = async (b: Booking) => {
    try {
      const payableTotal = (b.totalRentalFee || 0) + (b.depositAmount || 0) || 1000000
      const res = await paymentService.createVNPayPayment({
        bookingId: b.id,
        amount: payableTotal,
        paymentType: 'BOOKING_PAYMENT',
        orderInfo: `Thanh toan giu cho ${b.bookingCode}`,
      })
      if (res?.paymentUrl) {
        await navigator.clipboard.writeText(res.paymentUrl)
        toast.success(`Đã tạo link thanh toán VNPay và tự động sao chép vào bộ nhớ tạm!\nSau khi khách hàng thanh toán xong, đơn sẽ tự động chuyển sang trạng thái "ĐÃ THANH TOÁN - CHỜ GÁN KHO".`, {
          title: 'Tạo link thanh toán VNPay thành công',
          duration: 6000,
        })
      }
    } catch (err: any) {
      console.error('Create payment link error:', err)
      toast.error(err?.response?.data?.message || 'Không thể tạo link thanh toán VNPay cho đơn này.')
    }
  }
  const [viewingContract, setViewingContract] = useState<RentalContract | null>(null)
  const [viewingContractBooking, setViewingContractBooking] = useState<Booking | null>(null)
  const [loadingContractBookingId, setLoadingContractBookingId] = useState<string | null>(null)
  const [myTodayAssignment, setMyTodayAssignment] = useState<StaffAssignmentResponse | null>(null)
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false)
  const [showStaffSwapModal, setShowStaffSwapModal] = useState(false)
  const [showStaffHandoverModal, setShowStaffHandoverModal] = useState(false)
  const [pendingIncomingSwapsCount, setPendingIncomingSwapsCount] = useState<number>(0)
  const [attendanceSuccessMsg, setAttendanceSuccessMsg] = useState<string | null>(null)
  const isActuallyOnDuty = useMemo(() => isAssignmentOnDuty(myTodayAssignment), [myTodayAssignment])

  // Facility policy & guide
  const [staffFacilityPolicy, setStaffFacilityPolicy] = useState<FacilityPolicy | null>(null)
  const [isPolicyGuideOpen, setIsPolicyGuideOpen] = useState(false)


  // QR Code Scanner State

  // Dynamic arrivals & active rentals from BE
  const [arrivals, setArrivals] = useState<Booking[]>([])
  const [activeRentals, setActiveRentals] = useState<Booking[]>([])
  const [radarUnits, setRadarUnits] = useState<StorageUnit[]>([])
  const [selectedReturnBookingId, setSelectedReturnBookingId] = useState<string>('')
  const [activeBookingId, setActiveBookingId] = useState<string>('')
  const [occupancyData, setOccupancyData] = useState<OccupancyReport | null>(null)
  const [focusedBookingNotice, setFocusedBookingNotice] = useState<string | null>(null)
  const [bookingDetail, setBookingDetail] = useState<Booking | null>(null)
  const [bookingDetailLoading, setBookingDetailLoading] = useState(false)
  const [bookingDetailError, setBookingDetailError] = useState('')
  const bookingDetailId = searchParams.get('bookingId')

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFloor, setSelectedFloor] = useState<string>('all')
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<'current' | 'today' | 'past' | 'future' | 'all'>('all')
  const [filterFromDate, setFilterFromDate] = useState<string>('')
  const [filterToDate, setFilterToDate] = useState<string>('')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<AppointmentStatusFilter>('ALL')
  const [claimingBookingId, setClaimingBookingId] = useState<string | null>(null)
  const [rejectingBooking, setRejectingBooking] = useState<Booking | null>(null)
  const [rejectionReasonText, setRejectionReasonText] = useState<string>('')
  const [rejectionError, setRejectionError] = useState<string>('')
  const [isRejectingSubmitting, setIsRejectingSubmitting] = useState<boolean>(false)
  const [confirmingBooking, setConfirmingBooking] = useState<Booking | null>(null)
  const [confirmingNotes, setConfirmingNotes] = useState<string>('')
  const [confirmingError, setConfirmingError] = useState<string>('')
  const [isConfirmingSubmitting, setIsConfirmingSubmitting] = useState<boolean>(false)
  const [reviewDetailBooking, setReviewDetailBooking] = useState<Booking | null>(null)
  const [detailPrereq, setDetailPrereq] = useState<HandoverPrerequisites | null>(null)
  const [loadingDetailPrereq, setLoadingDetailPrereq] = useState(false)
  const [detailContract, setDetailContract] = useState<RentalContract | null>(null)

  // Modal hiển thị ảnh chứng từ thanh toán & ảnh hợp đồng đã ký
  const [photoViewerModal, setPhotoViewerModal] = useState<{
    isOpen: boolean
    title: string
    subtitle?: string
    fileUrl?: string | null
    isPdf?: boolean
    notes?: string
  } | null>(null)

  useEffect(() => {
    if (!reviewDetailBooking?.id || reviewDetailBooking.id.startsWith('LOCAL-RES-')) {
      setDetailPrereq(null)
      setDetailContract(null)
      return
    }
    let active = true
    setLoadingDetailPrereq(true)
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

  const [earlyConfirmState, setEarlyConfirmState] = useState<{
    booking: Booking
    actionType: EarlyCheckInActionType
    onConfirm: () => void
  } | null>(null)

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
        setViewingContractBooking(booking)
        setViewingContract(contract)
      } else {
        toast.warning('Đơn đặt kho này chưa khởi tạo hợp đồng điện tử.')
      }
    } catch {
      toast.error('Không thể tải văn bản hợp đồng lúc này. Vui lòng thử lại.')
    } finally {
      setLoadingContractBookingId(null)
    }
  }
  const [receptionAlertData, setReceptionAlertData] = useState<{
    isOpen: boolean
    message: string
    booking?: Booking | null
    canCheckInToday?: boolean
  } | null>(null)


  // Inspection Return state
  const [returnConfirmed, setReturnConfirmed] = useState(false)
  const [isSettlingReturn, setIsSettlingReturn] = useState(false)
  const [settlementSuccessMsg, setSettlementSuccessMsg] = useState<string | null>(null)

  // Ticket status state
  const [tickets, setTickets] = useState<Array<{
    id: string
    backendId?: string
    title: string
    detail: string
    location: string
    priority: string
    staff: string
    time: string
    status: string
  }>>([])

  // Live Shift Revenue & Cashier Payments from DB
  const [shiftPayments, setShiftPayments] = useState<PaymentItem[]>([])
  const [isShiftPaymentsLoading, setIsShiftPaymentsLoading] = useState(false)

  useEffect(() => {
    const targetFacility = (!selectedFacility || selectedFacility === 'ALL') ? undefined : selectedFacility
    fetchArrivals(targetFacility)
    fetchOccupancy(targetFacility)
    loadFacilities()
    loadTicketQueue()
    loadActiveRentals(targetFacility)
    loadRadarUnits(targetFacility)
    loadShiftPayments(targetFacility)
  }, [selectedFacility])

  // Tự động kiểm tra và quét gửi email thông báo cho đơn quá hạn 24h chưa tiếp nhận
  useEffect(() => {
    reservationEmailService.checkAndSendOverdueReminders()
    const timer = setInterval(() => {
      reservationEmailService.checkAndSendOverdueReminders()
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  // Đồng bộ URL params và sự kiện click từ Chuông thông báo
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    const codeParam = searchParams.get('bookingCode')

    if (tabParam === 'pending_orders' || tabParam === 'reception' || tabParam === 'renewals') {
      setStaffActiveTab(tabParam as StaffTab)
    }

    if (codeParam) {
      setHighlightedBookingCode(codeParam)
      setPendingSearchTerm(codeParam)
      const matched = arrivals.find(b => b.bookingCode === codeParam)
      if (matched) {
        setReviewDetailBooking(matched)
      }
    }
  }, [searchParams, arrivals])

  useEffect(() => {
    const handleSelectPending = (e: Event) => {
      const customEvent = e as CustomEvent<{ bookingCode?: string }>
      const code = customEvent.detail?.bookingCode
      setStaffActiveTab('pending_orders')
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



  const fetchArrivals = async (
    facilityId?: string,
    _timeframe?: 'current' | 'today' | 'past' | 'future' | 'all',
    fromDate?: string,
    toDate?: string
  ) => {
    try {
      const rawTarget = facilityId || currentTargetFacility
      const targetId = (!rawTarget || rawTarget === 'ALL') ? undefined : rawTarget
      const from = fromDate !== undefined ? fromDate : filterFromDate
      const to = toDate !== undefined ? toDate : filterToDate

      const data = await bookingService.getUpcomingArrivals(targetId, {
        timeframe: 'ALL',
        fromDate: from || undefined,
        toDate: to || undefined,
      })
      let filtered: Booking[] = []
      if (Array.isArray(data)) {
        filtered = data
        if (targetId) {
          filtered = filtered.filter(b => {
            if (b.facilityId) return b.facilityId === targetId
            if (b.storageUnitId) {
              const matchedUnit = radarUnits.find(u => u.id === b.storageUnitId)
              if (matchedUnit?.facilityId) {
                return matchedUnit.facilityId === targetId
              }
            }
            return false // Deny by default: Không hiển thị booking thiếu cơ sở xác minh
          })
        }
      }

      // Merge các đơn đặt giữ chỗ khách hàng gửi trực tuyến tới Staff từ localStorage
      try {
        const rawLocal = localStorage.getItem('boxora_guest_reservations')
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal)
          if (Array.isArray(parsed)) {
            const localArrivals: Booking[] = parsed
              .filter((r: any) => !targetId || r.facility?.id === targetId || r.facilityId === targetId)
              .map((r: any) => ({
                id: r.id || `LOCAL-RES-${r.bookingCode}`,
                bookingCode: r.bookingCode,
                customerName: r.customer?.fullName || r.customerName || 'Khách đặt giữ chỗ',
                customerPhone: r.customer?.phone || r.customerPhone || 'N/A',
                identityCardNumber: r.customer?.idCard || r.customerIdCard || r.identityCardNumber,
                customerEmail: r.customer?.email || r.customerEmail,
                facilityId: r.facility?.id || r.facilityId || targetId || '',
                facilityName: r.facility?.name || r.facilityName || assignedFacilityName || 'Cơ sở Boxora',
                unitTypeId: r.unitTypeId,
                unitTypeName: r.unitTypeName || r.sizeName || r.size?.volumeText,
                unitCode: r.unitCode || r.sizeName || r.size?.volumeText || 'Kho tự quản',
                storageUnitId: r.storageUnitId || '',
                startDate: r.startDate || new Date().toISOString().slice(0, 10),
                endDate: r.rentalEndDate || '',
                expectedCheckInAt: r.expectedCheckInAt || (r.checkInDate ? `${r.checkInDate}T${r.checkInTime ? r.checkInTime.split(' - ')[0] || '09:00' : '09:00'}:00` : undefined),
                checkInTime: r.checkInTime,
                status: (r.status || 'PENDING_CONTACT') as any,
                customerId: r.customerId || 'guest',
                accessCode: r.accessCode || r.bookingCode || '',
                rentalMonths: r.rentalMonths || 1,
                totalRentalFee: r.totalRentalFee || r.totalRent || 0,
                depositAmount: r.depositAmount || 0,
                depositPaid: r.depositPaid ?? (r.paymentStatus === 'PAID' ? (r.depositAmount || 0) : 0),
                paymentStatus: r.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID',
                signingMethod: r.signingMethod || (r.paymentMethod === 'AT_FACILITY' || r.paymentMethod === 'IN_PERSON' ? 'IN_PERSON' : 'ONLINE'),
                assignedStaffName: r.assignedStaffName,
                contractCode: r.contractCode,
                contractSigned: r.contractSigned,
                paperContractUrl: r.paperContractUrl,
                paymentProofUrl: r.paymentProofUrl,
                checkinOverdueReminderSentAt: r.checkinOverdueReminderSentAt,
                createdAt: r.createdAt,
              }))

            const existingCodes = new Set(filtered.map(b => b.bookingCode))
            const newLocal = localArrivals.filter(b => !existingCodes.has(b.bookingCode))
            filtered = [...filtered, ...newLocal]
          }
        }
      } catch (localErr) {
        console.warn('Lỗi đọc đơn giữ chỗ gửi staff từ localStorage:', localErr)
      }

      setArrivals(filtered)
    } catch {
      try {
        const targetId = facilityId || currentTargetFacility
        const rawLocal = localStorage.getItem('boxora_guest_reservations')
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal)
          if (Array.isArray(parsed)) {
            const localArrivals: Booking[] = parsed
              .filter((r: any) => !targetId || r.facility?.id === targetId || r.facilityId === targetId)
              .map((r: any) => ({
                id: r.id || `LOCAL-RES-${r.bookingCode}`,
                bookingCode: r.bookingCode,
                customerName: r.customer?.fullName || r.customerName || 'Khách đặt giữ chỗ',
                customerPhone: r.customer?.phone || r.customerPhone || 'N/A',
                identityCardNumber: r.customer?.idCard || r.customerIdCard || r.identityCardNumber,
                customerEmail: r.customer?.email || r.customerEmail,
                facilityId: r.facility?.id || r.facilityId || targetId || '',
                facilityName: r.facility?.name || r.facilityName || assignedFacilityName || 'Cơ sở Boxora',
                unitTypeId: r.unitTypeId,
                unitTypeName: r.unitTypeName || r.sizeName || r.size?.volumeText,
                unitCode: r.unitCode || r.sizeName || r.size?.volumeText || 'Kho tự quản',
                storageUnitId: r.storageUnitId || '',
                startDate: r.startDate || new Date().toISOString().slice(0, 10),
                endDate: r.rentalEndDate || '',
                expectedCheckInAt: r.expectedCheckInAt || (r.checkInDate ? `${r.checkInDate}T${r.checkInTime ? r.checkInTime.split(' - ')[0] || '09:00' : '09:00'}:00` : undefined),
                checkInTime: r.checkInTime,
                status: (r.status || 'PENDING_CONTACT') as any,
                customerId: r.customerId || 'guest',
                accessCode: r.accessCode || r.bookingCode || '',
                rentalMonths: r.rentalMonths || 1,
                totalRentalFee: r.totalRentalFee || r.totalRent || 0,
                depositAmount: r.depositAmount || 0,
                depositPaid: r.depositPaid ?? (r.paymentStatus === 'PAID' ? (r.depositAmount || 0) : 0),
                paymentStatus: r.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID',
                signingMethod: r.signingMethod || (r.paymentMethod === 'AT_FACILITY' || r.paymentMethod === 'IN_PERSON' ? 'IN_PERSON' : 'ONLINE'),
                assignedStaffName: r.assignedStaffName,
                contractCode: r.contractCode,
                contractSigned: r.contractSigned,
                paperContractUrl: r.paperContractUrl,
                paymentProofUrl: r.paymentProofUrl,
                checkinOverdueReminderSentAt: r.checkinOverdueReminderSentAt,
                createdAt: r.createdAt,
              }))
            setArrivals(localArrivals)
            return
          }
        }
      } catch {}
      setArrivals([])
    }

  }

  const loadShiftPayments = async (facilityId?: string) => {
    setIsShiftPaymentsLoading(true)
    try {
      const res = await paymentService.getPayments({ size: 20, facilityId: facilityId || undefined })
      if (Array.isArray(res)) {
        setShiftPayments(res)
      } else {
        setShiftPayments([])
      }
    } catch {
      setShiftPayments([])
    } finally {
      setIsShiftPaymentsLoading(false)
    }
  }

  const loadRadarUnits = async (facilityId?: string) => {
    try {
      const units = await storageUnitService.getUnits(facilityId ? { facilityId } : undefined)
      if (Array.isArray(units)) {
        setRadarUnits(units)
      } else {
        setRadarUnits([])
      }
    } catch {
      setRadarUnits([])
    }
  }

  const loadActiveRentals = async (facilityId?: string) => {
    try {
      const res = await bookingService.getAll({ status: 'ACTIVE', size: 50 })
      if (res?.content && res.content.length > 0) {
        let filtered = res.content
        if (facilityId) {
          filtered = filtered.filter(b => b.facilityId === facilityId || !b.facilityId)
        }
        setActiveRentals(filtered)
        if (!filtered.some(booking => booking.id === selectedReturnBookingId)) setSelectedReturnBookingId('')
      } else {
        setActiveRentals([])
        setSelectedReturnBookingId('')
      }
    } catch {
      setActiveRentals([])
    }
  }

  const loadFacilities = async () => {
    try {
      if (contextFacilities && contextFacilities.length > 0) {
        setFacilities(contextFacilities)
        setEmergencyFacilityId(contextFacilities[0].id)
        return
      }
      const res = await facilityService.getFacilities()
      if (res?.content && res.content.length > 0) {
        setFacilities(res.content)
        setEmergencyFacilityId(res.content[0].id)
      }
    } catch {
      // Fallback
    }
  }

  const loadTicketQueue = async () => {
    try {
      const res = await supportTicketService.getQueue()
      if (res && Array.isArray(res)) {
        setTickets(res.map((t: any) => ({
          id: t.ticketCode || (t.id ? `#TK-${t.id.slice(0, 4)}` : '#TK-0000'),
          backendId: t.id,
          title: t.title || 'Sự cố thiết bị',
          detail: t.customerName ? `${t.customerName} - ${t.description || 'Chi tiết hiện trường'}` : (t.description || 'Chi tiết hiện trường'),
          location: t.unitCode ? `Kho #${t.unitCode}` : (t.category || 'Kho Boxora'),
          priority: t.priority || 'MEDIUM',
          staff: t.assignedStaffName || 'Nhân viên trực ca',
          time: t.createdAt ? new Date(t.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Hôm nay',
          status: t.status || 'IN_PROGRESS'
        })))
      }
    } catch {
      // Empty on error
    }
  }

  const fetchOccupancy = async (facilityId?: string) => {
    try {
      const scopedFacilityId = facilityId ?? ((!selectedFacility || selectedFacility === 'ALL') ? undefined : selectedFacility)
      const res = await reportService.getOccupancyReport(scopedFacilityId)
      if (res) {
        setOccupancyData(res)
      }
    } catch {
      // Empty on error
    }
  }

  // Lookup maps for Storage Units (by ID and by Facility+UnitCode)

  const unitMapByCodeAndFacility = useMemo(() => {
    const map = new Map<string, StorageUnit>()
    radarUnits.forEach((u) => {
      if (u.unitCode && u.facilityId) {
        map.set(`${u.facilityId}#${u.unitCode.trim().toUpperCase()}`, u)
      }
    })
    return map
  }, [radarUnits])

  const unitMapById = useMemo(() => {
    const map = new Map<string, StorageUnit>()
    radarUnits.forEach((u) => {
      if (u.id) map.set(u.id, u)
    })
    return map
  }, [radarUnits])

  // Discover all distinct floors available in current facility
  const availableFloors = useMemo(() => {
    const floorSet = new Set<string>()
    arrivals.forEach((b) => {
      const f = resolveBookingFloor(b, unitMapById, unitMapByCodeAndFacility)
      if (f) floorSet.add(f)
    })
    radarUnits.forEach((u) => {
      const f = extractFloor(u.floorLevel)
      if (f) floorSet.add(f)
    })
    return Array.from(floorSet).sort((a, b) => {
      const numA = parseInt(a, 10)
      const numB = parseInt(b, 10)
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB
      return a.localeCompare(b)
    })
  }, [arrivals, radarUnits, unitMapById, unitMapByCodeAndFacility])

  // Helper: Kiểm tra đơn đã thanh toán hay chưa
  const isBookingPaid = (b: Booking): boolean => {
    const s = String(b.status || '').toUpperCase()
    if (s === 'PAID_PENDING_ASSIGNMENT' || s === 'PAID_AND_SIGNED' || s === 'CONFIRMED' || s === 'AWAITING_CHECKIN' || s === 'ACTIVE' || s === 'COMPLETED') {
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

  // Mục 1: Đơn chưa thanh toán chờ liên hệ tư vấn & xác nhận
  const isPendingContact = (b: Booking): boolean => {
    const s = String(b.status || '').toUpperCase()
    if (s === 'CANCELLED' || s === 'COMPLETED' || s === 'ACTIVE') return false
    if (isBookingPaid(b)) return false
    return (
      s === 'PENDING_CONTACT' ||
      s === 'PENDING_CONFIRMATION' ||
      s === 'PENDING_APPROVAL' ||
      s === 'PENDING_PAYMENT' ||
      s === 'PENDING_SIGNATURE' ||
      s === 'PENDING' ||
      !s
    )
  }

  // Mục 2: Đơn đã thanh toán chờ check-in tại quầy tiếp đón
  const isPaidCheckIn = (b: Booking): boolean => {
    const s = String(b.status || '').toUpperCase()
    if (s === 'CANCELLED' || s === 'COMPLETED' || s === 'ACTIVE') return false
    return isBookingPaid(b)
  }

  // Summary counts for arrival status pills
  const arrivalStatusCounts = useMemo(() => {
    let pendingContact = 0
    let confirmedCheckIn = 0
    let active = 0
    let completed = 0
    let cancelled = 0
    arrivals.forEach((b) => {
      const s = String(b.status || '').toUpperCase()
      if (s === 'CANCELLED') cancelled++
      else if (s === 'COMPLETED') completed++
      else if (s === 'ACTIVE') active++
      else if (isPaidCheckIn(b)) confirmedCheckIn++
      else if (isPendingContact(b)) pendingContact++
    })
    return {
      total: arrivals.length,
      pendingContact,
      pendingConfirmation: pendingContact,
      confirmedCheckIn,
      pending: pendingContact,
      active,
      completed,
      cancelled,
    }
  }, [arrivals])

  // Filtered pending reservations for Tab 1 "Đơn chờ xử lý" - Mặc định chỉ hiển thị đơn chờ liên hệ
  const filteredPendingOrders = useMemo(() => {
    return arrivals.filter((b) => {
      const s = String(b.status || '').toUpperCase()
      const isCancelled = s === 'CANCELLED'
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

        if (!code.includes(q) && !name.includes(q) && !phone.includes(q) && !email.includes(q) && !unit.includes(q) && !fac.includes(q) && !cccd.includes(q) && !ctr.includes(q)) {
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

  // Lọc danh sách đơn đã thanh toán chờ check-in cho Tab 2 "Bàn Tiếp Đón & Trả Kho"
  const checkInArrivals = useMemo(() => {
    return arrivals.filter((b) => {
      if (!isPaidCheckIn(b)) return false

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const code = (b.bookingCode || '').toLowerCase()
        const name = (b.customerName || '').toLowerCase()
        const phone = (b.customerPhone || '').toLowerCase()
        const unit = (b.unitCode || '').toLowerCase()
        const fac = (b.facilityName || '').toLowerCase()
        const ctr = (b.contractCode || '').toLowerCase()
        if (!code.includes(q) && !name.includes(q) && !phone.includes(q) && !unit.includes(q) && !fac.includes(q) && !ctr.includes(q)) {
          return false
        }
      }
      return true
    }).sort((a, b) => {
      const aNeedsUnit = !a.storageUnitId
      const bNeedsUnit = !b.storageUnitId
      if (aNeedsUnit && !bNeedsUnit) return -1
      if (!aNeedsUnit && bNeedsUnit) return 1

      const timeB = new Date((b as any).createdAt || b.expectedCheckInAt || b.startDate || 0).getTime()
      const timeA = new Date((a as any).createdAt || a.expectedCheckInAt || a.startDate || 0).getTime()
      return timeB - timeA
    })
  }, [arrivals, searchQuery])

  // Danh sách cho HandoverCheckInWorkbench
  const workbenchArrivals = useMemo(() => {
    return arrivals.filter((b) => {
      return isPaidCheckIn(b) || b.id === activeBookingId
    })
  }, [arrivals, activeBookingId])

  // Filtered arrivals based on Search, Floor, Shift / Timeframe, Date range, Status
  const filteredArrivals = useMemo(() => {
    return filterArrivals(
      arrivals,
      searchQuery,
      selectedFloor,
      selectedShiftFilter,
      unitMapById,
      unitMapByCodeAndFacility,
      new Date(),
      filterFromDate || undefined,
      filterToDate || undefined,
      selectedStatusFilter
    )
  }, [arrivals, searchQuery, selectedFloor, selectedShiftFilter, unitMapById, unitMapByCodeAndFacility, filterFromDate, filterToDate, selectedStatusFilter])

  const handleTimeframeChange = (tf: 'current' | 'today' | 'past' | 'future' | 'all') => {
    setSelectedShiftFilter(tf)
    fetchArrivals(currentTargetFacility, tf, filterFromDate, filterToDate)
  }

  const handleDateFilterApply = (from: string, to: string) => {
    setFilterFromDate(from)
    setFilterToDate(to)
    fetchArrivals(currentTargetFacility, selectedShiftFilter, from, to)
  }

  const handleResetDateFilter = () => {
    setFilterFromDate('')
    setFilterToDate('')
    fetchArrivals(currentTargetFacility, selectedShiftFilter, '', '')
  }

  // Mở modal xác nhận đơn đặt giữ chỗ
  const handleStaffConfirmBooking = (booking: Booking) => {
    setConfirmingBooking(booking)
    setConfirmingNotes('')
    setConfirmingError('')
  }

  // Thực thi xác nhận đơn: gọi backend API chuyển trạng thái sang CONFIRMED và đồng bộ email
  const executeStaffConfirmBooking = async (booking: Booking, notes?: string) => {
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

    const res = reservationEmailService.confirmReservation(booking.bookingCode, {
      id: user?.id,
      fullName: user?.fullName || 'Nhân viên trực ca Boxora',
    })

    setArrivals(prev => prev.map(b =>
      (b.id === booking.id || b.bookingCode === booking.bookingCode)
        ? {
            ...b,
            status: 'CONFIRMED' as any,
            assignedStaffId: user?.id,
            assignedStaffName: user?.fullName || 'Nhân viên trực ca Boxora',
            staffAssignmentNotes: notes?.trim() || b.staffAssignmentNotes,
          }
        : b
    ))
    setAttendanceSuccessMsg(res.message || 'Đã xác nhận đơn đặt giữ chỗ thành công (Chờ check in).')
    setTimeout(() => setAttendanceSuccessMsg(null), 5000)
    setConfirmingBooking(null)
    setConfirmingNotes('')
    setConfirmingError('')
    setReviewDetailBooking(null)
    setIsConfirmingSubmitting(false)

    window.dispatchEvent(new Event('boxora:storage-units-refresh'))
    fetchArrivals(selectedFacility !== 'ALL' ? selectedFacility : undefined)
  }

  // Nhân viên từ chối đơn: có điền lý do, chuyển sang CANCELLED và gửi email đến khách hàng
  const handleStaffRejectBooking = async (booking: Booking, reason: string) => {
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

    const res = reservationEmailService.rejectReservation(booking.bookingCode, trimmed, {
      id: user?.id,
      fullName: user?.fullName || 'Nhân viên trực ca Boxora',
    })

    setArrivals(prev => prev.map(b =>
      (b.id === booking.id || b.bookingCode === booking.bookingCode)
        ? {
            ...b,
            status: 'CANCELLED' as any,
            rejectionReason: trimmed as any,
          }
        : b
    ))
    setAttendanceSuccessMsg(res.message || 'Đã từ chối đơn đặt giữ chỗ.')
    setTimeout(() => setAttendanceSuccessMsg(null), 5000)
    setRejectingBooking(null)
    setRejectionReasonText('')
    setRejectionError('')
    setReviewDetailBooking(null)
    setIsRejectingSubmitting(false)

    window.dispatchEvent(new Event('boxora:storage-units-refresh'))
    fetchArrivals(selectedFacility !== 'ALL' ? selectedFacility : undefined)
    fetchOccupancy(selectedFacility !== 'ALL' ? selectedFacility : undefined)
    loadRadarUnits(selectedFacility !== 'ALL' ? selectedFacility : undefined)
  }

  const openRejectModal = (booking: Booking) => {
    setRejectingBooking(booking)
    setRejectionReasonText('')
    setRejectionError('')
  }

  // Hủy đơn quá hạn 48h cho đơn đặt ký + thanh toán tại quầy
  const handleCancelOverdueBooking = async (booking: Booking) => {
    const unitText = booking.unitCode ? `Kho #${booking.unitCode}` : (booking.unitTypeName || 'buồng kho')
    const confirmed = window.confirm(
      `XÁC NHẬN HỦY ĐƠN QUÁ HẠN 48 GIỜ:\n\n` +
      `Đơn đặt giữ chỗ ${booking.bookingCode} (khách hàng: ${booking.customerName || 'N/A'}) đã quá 48 giờ sau lịch hẹn check-in nhưng chưa được tiếp nhận.\n\n` +
      `Khi xác nhận hủy đơn:\n` +
      `1. Trạng thái đơn sẽ chuyển sang ĐÃ HỦY (CANCELLED).\n` +
      `2. Buồng ${unitText} tại ${booking.facilityName || 'cơ sở'} sẽ được GIẢI PHÓNG về trạng thái TRỐNG (AVAILABLE) và hoàn lại số lượng khả dụng ở Bước 2 quy trình đặt kho.\n` +
      `3. Email thông báo hủy đơn sẽ được gửi đến email khách hàng (${booking.customerEmail || 'đã đăng ký'}).\n\n` +
      `Bạn có chắc chắn muốn hủy đơn này không?`
    )
    if (!confirmed) return

    const reason = 'Hủy đơn do quá hạn 48 giờ sau lịch hẹn check-in nhưng khách hàng chưa đến làm thủ tục tiếp nhận tại quầy'
    try {
      const isBackendId = Boolean(booking.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(booking.id.trim()))
      const targetIdOrCode = isBackendId ? booking.id : booking.bookingCode
      try {
        await bookingService.cancelBooking(targetIdOrCode, reason)
      } catch (err: any) {
        console.warn('Backend cancel booking overdue error (fallback to local):', err)
      }

      reservationEmailService.cancelOverdueReservation(booking.bookingCode, reason, {
        id: user?.id,
        fullName: user?.fullName || 'Nhân viên quầy Boxora',
      })

      // Giải phóng ô kho local nếu có
      if (booking.storageUnitId) {
        try {
          const rawUnits = localStorage.getItem('boxora_storage_units')
          if (rawUnits) {
            const parsedUnits = JSON.parse(rawUnits)
            if (Array.isArray(parsedUnits)) {
              const uIdx = parsedUnits.findIndex((u: any) => u.id === booking.storageUnitId)
              if (uIdx !== -1) {
                parsedUnits[uIdx].status = 'AVAILABLE'
                localStorage.setItem('boxora_storage_units', JSON.stringify(parsedUnits))
              }
            }
          }
        } catch {}
      }

      window.dispatchEvent(new CustomEvent('boxora:storage-units-refresh'))
      window.dispatchEvent(new CustomEvent('boxora_reservation_updated', {
        detail: { bookingCode: booking.bookingCode, status: 'CANCELLED' }
      }))
      window.dispatchEvent(new Event('boxora:notifications-refresh'))

      setArrivals(prev => prev.map(b =>
        (b.id === booking.id || b.bookingCode === booking.bookingCode)
          ? { ...b, status: 'CANCELLED' as any, cancellationReason: reason }
          : b
      ))
      setAttendanceSuccessMsg(`Đã hủy đơn quá hạn ${booking.bookingCode} thành công. Buồng ${unitText} đã được hoàn lại số lượng khả dụng trên hệ thống.`)
      setTimeout(() => setAttendanceSuccessMsg(null), 6000)
      fetchArrivals(selectedFacility !== 'ALL' ? selectedFacility : undefined)
    } catch (err: any) {
      console.error('Lỗi hủy đơn quá hạn:', err)
      toast.error(err.message || 'Có lỗi xảy ra khi hủy đơn.')
    }
  }

  const handleClaimReception = async (booking: Booking) => {
    // Proactive check on shift attendance if user is staff/manager
    if (user?.roleName !== 'ADMIN') {
      const isShiftCheckedIn = myTodayAssignment?.status === 'CHECKED_IN' || (myTodayAssignment?.checkedInAt && !myTodayAssignment?.checkedOutAt)
      const bookingCheckinDate = booking.expectedCheckInAt ? booking.expectedCheckInAt.slice(0, 10) : booking.startDate
      const todayStr = localDateString(new Date())

      if (bookingCheckinDate === todayStr && !isShiftCheckedIn) {
        setReceptionAlertData({
          isOpen: true,
          message: 'Bạn chưa điểm danh vào ca làm việc hôm nay! Vui lòng điểm danh vào ca trực trước khi tiếp nhận lượt khách.',
          booking,
          canCheckInToday: !!myTodayAssignment,
        })
        return
      }
    }

    setClaimingBookingId(booking.id)
    try {
      const updated = await bookingService.claimCheckInReception(booking.id)
      setArrivals(prev => prev.map(b => b.id === booking.id ? {
        ...b,
        assignedStaffId: updated.assignedStaffId || user?.id,
        assignedStaffName: updated.assignedStaffName || user?.fullName || 'Nhân viên quầy'
      } : b))
      setActiveBookingId(booking.id)
      setAttendanceSuccessMsg(`Đã tiếp nhận lượt đón khách của đơn ${booking.bookingCode} thành công!`)
      setTimeout(() => setAttendanceSuccessMsg(null), 4000)
      setTimeout(() => {
        document.getElementById('handover-workbench')?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
    } catch (err: any) {
      const isShiftCheckedIn = myTodayAssignment?.status === 'CHECKED_IN' || (myTodayAssignment?.checkedInAt && !myTodayAssignment?.checkedOutAt)
      const bookingCheckinDate = booking.expectedCheckInAt ? booking.expectedCheckInAt.slice(0, 10) : booking.startDate
      const todayStr = localDateString(new Date())
      const isBookingToday = bookingCheckinDate === todayStr

      setReceptionAlertData({
        isOpen: true,
        message: err?.response?.data?.message || 'Không thể tiếp nhận khách: Bạn chỉ có thể tiếp nhận khi có ca làm việc vào ngày hẹn check-in tại cơ sở và đã điểm danh vào ca trực.',
        booking,
        canCheckInToday: isBookingToday && !isShiftCheckedIn && !!myTodayAssignment,
      })
    } finally {
      setClaimingBookingId(null)
    }
  }

  const handleExecuteEmergencyOverride = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsEmergencyCalling(true)
    setEmergencyResult(null)
    setEmergencyError(null)
    try {
      await masterKeyService.executeOverride({
        facilityId: emergencyFacilityId,
        category: emergencyCategory,
        severity: emergencySeverity,
        witnessUserId: witnessStaffId,
        witnessPassword,
        reason: emergencyReason
      })
      setEmergencyResult('Lệnh khẩn cấp đã được kích hoạt thành công qua Master Key Service. Cửa sảnh và rào chắn kiểm soát mở cưỡng chế trong 60 giây.')
    } catch (err: any) {
      console.warn('MasterKey override failed:', err)
      setEmergencyError(err?.response?.data?.message || 'Không thể xác thực lệnh Master Key. Chưa có thao tác mở cửa nào được xác nhận.')
    } finally {
      setIsEmergencyCalling(false)
    }
  }

  const handleProcessReturnSettlement = async () => {
    const returnTargetId = selectedReturnBookingId || (activeRentals.length > 0 ? activeRentals[0].id : null)
    if (!returnTargetId) {
      setSettlementSuccessMsg('Vui lòng chọn một lượt thuê đang hiệu lực để nghiệm thu trả kho.')
      return
    }
    const targetBooking = activeRentals.find(r => r.id === returnTargetId) || activeRentals[0]
    setIsSettlingReturn(true)
    try {
      await handoverService.processReturnSettlement({
        bookingId: returnTargetId,
        recordType: 'RETURN',
        doorConditionPassed: true,
        cleanlinessPassed: true,
        smartLockPassed: true,
        sensorPassed: true,
        wallStructurePassed: true,
        depositSettled: targetBooking?.depositPaid || targetBooking?.depositAmount || 0,
        deductionAmount: 0,
        refundMethod: 'VNPAY_REFUND',
        notes: 'Kho nguyên vẹn, sàn sạch, khóa SmartLock và cảm biến hoạt động tốt.'
      })
      setReturnConfirmed(true)
      setSettlementSuccessMsg(`Đã hoàn tất nghiệm thu trả kho #${targetBooking?.unitCode || ''}. Lệnh hoàn cọc đã được chuyển sang cổng thanh toán tự động.`)
      fetchArrivals()
      fetchOccupancy()
      loadActiveRentals()
    } catch (err: any) {
      console.warn('Return settlement failed:', err)
      const msg = err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi nghiệm thu trả kho'
      setSettlementSuccessMsg(`Lỗi nghiệm thu: ${msg}`)
    } finally {
      setIsSettlingReturn(false)
    }
  }

  const handleResolveTicket = async (ticketId: string, backendId?: string) => {
    try {
      const targetId = backendId || ticketId.replace('#', '')
      if (targetId) {
        await supportTicketService.resolveTicket(targetId, 'Đã kiểm tra hiện trường và xử lý xong tại chỗ')
      }
    } catch (err) {
      console.warn('Ticket resolve fallback:', err)
    }
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'RESOLVED' } : t))
  }


  const [activeEvidenceModal, setActiveEvidenceModal] = useState<{
    ticketId: string
    title: string
    images: string[]
  } | null>(null)



  // Danh sách các yêu cầu hoàn trả kho của khách hàng
  const customerReturnRequests = useMemo(() => {
    const list: Array<{
      id: string
      bookingId: string
      unitCode: string
      customerName: string
      customerPhone: string
      facilityName: string
      requestDate: string
      reason: string
      status: 'PENDING' | 'INSPECTING' | 'COMPLETED'
      contractCode?: string
      depositPaid?: number
      depositAmount?: number
      endDate?: string
    }> = []

    // 1. Yêu cầu trả kho lưu trong localStorage
    try {
      const raw = localStorage.getItem('boxora_return_requests')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            list.push({
              id: item.id || `RET-${item.bookingId || Math.random()}`,
              bookingId: item.bookingId || item.id,
              unitCode: item.unitCode || 'N/A',
              customerName: item.customerName || 'Khách hàng',
              customerPhone: item.customerPhone || 'Theo hồ sơ',
              facilityName: item.facilityName || 'Boxora Facility',
              requestDate: item.requestDate || item.createdAt || new Date().toISOString().split('T')[0],
              reason: item.reason || 'Khách yêu cầu thanh lý hợp đồng & trả buồng kho',
              status: item.status || 'PENDING',
              contractCode: item.contractCode,
              depositPaid: item.depositPaid || item.depositAmount,
              depositAmount: item.depositAmount || item.depositPaid,
              endDate: item.endDate,
            })
          })
        }
      }
    } catch (e) {
      console.warn('Error reading boxora_return_requests:', e)
    }

    // 2. Yêu cầu trả kho từ Support Tickets
    tickets.forEach((t: any) => {
      const isReturn =
        t.category === 'return' ||
        t.type === 'return' ||
        t.title?.toLowerCase().includes('trả kho') ||
        t.title?.toLowerCase().includes('hoàn trả') ||
        t.description?.toLowerCase().includes('trả kho')

      if (isReturn) {
        const unitMatch = t.title?.match(/#([A-Z0-9-]+)/i) || t.description?.match(/#([A-Z0-9-]+)/i)
        const unitCode = unitMatch ? unitMatch[1] : (t.unitCode || 'N/A')
        const existing = list.find((item) => item.unitCode === unitCode)
        if (!existing) {
          list.push({
            id: `TICKET-RET-${t.id}`,
            bookingId: t.bookingId || t.id,
            unitCode: unitCode,
            customerName: t.customerName || 'Khách hàng',
            customerPhone: t.customerPhone || 'Theo hồ sơ',
            facilityName: t.facilityName || 'Cơ sở hiện tại',
            requestDate: t.createdAt ? String(t.createdAt).split('T')[0] : new Date().toISOString().split('T')[0],
            reason: t.description || t.title || 'Khách gửi yêu cầu trả kho qua ứng dụng',
            status: t.status === 'RESOLVED' ? 'COMPLETED' : 'PENDING',
          })
        }
      }
    })

    // 3. Các hợp đồng đang thuê sắp đến hạn trả kho
    activeRentals.forEach((r, idx) => {
      const existing = list.find((item) => item.bookingId === r.id || item.unitCode === r.unitCode)
      if (!existing && idx < 3) {
        list.push({
          id: `ACT-RET-${r.id}`,
          bookingId: r.id,
          unitCode: r.unitCode || 'A-101',
          customerName: r.customerName || 'Khách thuê',
          customerPhone: r.customerPhone || 'N/A',
          facilityName: r.facilityName || 'Cơ sở đã chọn',
          requestDate: r.endDate || new Date().toISOString().split('T')[0],
          reason: 'Đến hạn thanh lý hợp đồng & nghiệm thu hoàn cọc',
          status: 'PENDING',
          contractCode: (r as any).contractCode,
          depositPaid: r.depositPaid,
          depositAmount: r.depositAmount,
          endDate: r.endDate,
        })
      }
    })

    return list
  }, [tickets, activeRentals])

  const currentReturnBooking = activeRentals.find(r => r.id === selectedReturnBookingId) || (customerReturnRequests.find(r => r.bookingId === selectedReturnBookingId || r.id === selectedReturnBookingId) as any)
  const returnDepositAmt = currentReturnBooking ? (currentReturnBooking.depositPaid || currentReturnBooking.depositAmount || 0) : 0
  const facilityTotalUnits = facilities.find(facility => facility.id === selectedFacility)?.totalUnits
  const facilityOccupancy = occupancyData?.byFacility?.find(facility => facility.facilityId === selectedFacility)
  const fallbackReportTotal = selectedFacility && selectedFacility !== 'ALL'
    ? facilityOccupancy?.totalUnits || 0
    : occupancyData?.byFacility?.reduce((sum: number, facility: any) => sum + (facility.totalUnits || 0), 0) || 0
  const fallbackReportOccupied = selectedFacility && selectedFacility !== 'ALL'
    ? facilityOccupancy?.occupiedUnits || 0
    : occupancyData?.byFacility?.reduce((sum: number, facility: any) => sum + (facility.occupiedUnits || 0), 0) || 0
  const reportedTotalUnits = occupancyData?.systemSummary?.totalUnits || fallbackReportTotal
  const totalFacilityUnits = reportedTotalUnits || radarUnits.length || facilityTotalUnits || 0
  const occupiedFacilityUnits = reportedTotalUnits
    ? (occupancyData?.systemSummary?.totalUnits
      ? occupancyData.systemSummary.occupiedUnits
      : fallbackReportOccupied)
    : radarUnits.length
      ? radarUnits.filter(unit => unit.status === 'OCCUPIED').length
      : activeRentals.length
  const occupancyRate = totalFacilityUnits > 0
    ? (occupiedFacilityUnits / totalFacilityUnits) * 100
    : 0

  // Live shift revenue calculations from DB
  const shiftTotalCollected = useMemo(() => {
    return shiftPayments.filter(p => p.status === 'PAID' || p.status === 'SUCCESS').reduce((sum, p) => sum + (p.amount || 0), 0)
  }, [shiftPayments])

  const shiftRentalRevenue = useMemo(() => {
    return shiftPayments
      .filter(p => (p.status === 'PAID' || p.status === 'SUCCESS') && (!p.paymentType || p.paymentType === 'RENTAL' || p.paymentType === 'RENTAL_FEE' || p.paymentType === 'BOOKING_PAYMENT' || p.paymentType === 'CONTRACT' || p.paymentType === 'EXTEND' || p.paymentType === 'RENEWAL_FEE'))
      .reduce((sum, p) => sum + (p.amount || 0), 0)
  }, [shiftPayments])

  const shiftDepositRevenue = useMemo(() => {
    return shiftPayments
      .filter(p => (p.status === 'PAID' || p.status === 'SUCCESS') && p.paymentType === 'DEPOSIT')
      .reduce((sum, p) => sum + (p.amount || 0), 0)
  }, [shiftPayments])

  const handleExportShiftLedgerCsv = () => {
    if (!shiftPayments || shiftPayments.length === 0) {
      toast.info('Không có dữ liệu giao dịch để xuất sổ thu ngân.')
      return
    }
    const headers = ['Mã GD', 'Khách hàng', 'Mã Kho', 'Cơ sở', 'Số tiền (VNĐ)', 'Phương thức', 'Loại thanh toán', 'Thời gian', 'Trạng thái']
    const rows = shiftPayments.map(p => [
      p.id,
      p.customerName || 'N/A',
      p.unitCode || 'N/A',
      p.facilityName || 'Boxora',
      p.amount,
      p.paymentMethod || 'VNPay',
      p.paymentType || 'RENTAL',
      p.paymentTime ? new Date(p.paymentTime).toLocaleString('vi-VN') : '',
      p.status
    ])
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `So_Thu_Ngan_Ca_Truc_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="staff-dashboard-page flex flex-col gap-6 text-left max-w-7xl mx-auto">
      
      {/* 1. TOP OPERATIONAL SHIFT HEADER */}
      <div className="w-full bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[26px] text-cyan-400">desktop_windows</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-headline text-xl font-bold text-slate-900">
                  Bàn Vận Hành Quầy &amp; Tiếp Đón Thực Địa
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-mono font-bold uppercase tracking-wider">
                  Ca sáng: 08:00 - 16:30
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Đang trực ca
                </span>
              </div>
              <span className="text-xs text-slate-500 mt-1">
                Phụ trách tiếp đón, kiểm toán hiện trường và xử lý sự cố phát sinh.
              </span>
            </div>
          </div>


        </div>
      </div>

      {/* ALERT: Incoming Shift Swap waiting for confirmation */}
      {pendingIncomingSwapsCount > 0 && (
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-2xl flex items-center justify-between gap-4 shadow-xs flex-wrap">
          <div className="flex items-center gap-3 text-amber-950 font-medium text-xs">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs animate-pulse">
              <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
            </div>
            <div>
              <p className="font-bold text-amber-950 text-sm">
                Yêu cầu đổi ca trực cần xác nhận!
              </p>
              <p className="text-amber-800 text-xs">
                Bạn có <strong>{pendingIncomingSwapsCount}</strong> ca trực được đồng nghiệp đề xuất đổi sang cho bạn và đã được Quản lý cơ sở phê duyệt.
              </p>
            </div>
          </div>
          <Link
            to="/staff/my-shifts"
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors shadow-xs shrink-0 cursor-pointer"
          >
            <span>Xem và phản hồi ngay</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>
      )}

      {/* OPERATION TAB NAVIGATION FOR STAFF */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => {
            setStaffActiveTab('pending_orders')
            setSearchParams({ tab: 'pending_orders' })
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap ${
            staffActiveTab === 'pending_orders'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">pending_actions</span>
          <span>1. Đơn Chờ Xử Lý</span>
          {arrivalStatusCounts.pendingContact > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              staffActiveTab === 'pending_orders'
                ? 'bg-white text-amber-700'
                : 'bg-amber-100 text-amber-800 animate-pulse'
            }`}>
              {arrivalStatusCounts.pendingContact} đơn
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setStaffActiveTab('reception')
            setSearchParams({ tab: 'reception' })
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap ${
            staffActiveTab === 'reception'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">desk</span>
          <span>2. Bàn Tiếp Đón &amp; Trả Kho</span>
          {arrivalStatusCounts.confirmedCheckIn > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              staffActiveTab === 'reception'
                ? 'bg-white text-cyan-800'
                : 'bg-cyan-100 text-cyan-800'
            }`}>
              {arrivalStatusCounts.confirmedCheckIn} chờ check-in
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setStaffActiveTab('renewals')
            setSearchParams({ tab: 'renewals' })
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap ${
            staffActiveTab === 'renewals'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">autorenew</span>
          <span>3. Hỗ Trợ Gia Hạn &amp; Thu Cước Tại Quầy</span>
        </button>
      </div>

      {staffActiveTab === 'pending_orders' ? (
        <section className="space-y-4 animate-in fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-[24px]">pending_actions</span>
                <h2 className="font-headline text-lg font-bold text-slate-900">
                  Quản Lý Đơn Đặt Giữ Chỗ Chờ Xử Lý
                </h2>
                {arrivalStatusCounts.pendingContact > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-300 animate-pulse">
                    {arrivalStatusCounts.pendingContact} đơn cần liên hệ
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Duyệt đối soát thông tin khách hàng đặt trước trực tuyến chưa thanh toán. Nhấn <strong>[Xác nhận]</strong> để chuyển sang Chờ check in ở Bàn tiếp đón hoặc <strong>[Từ chối]</strong> có kèm lý do.
              </p>
            </div>

            <button
              type="button"
              onClick={() => fetchArrivals(currentTargetFacility, selectedShiftFilter, filterFromDate, filterToDate)}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer self-start sm:self-auto"
            >
              <span className="material-symbols-outlined text-[16px] text-slate-500">refresh</span>
              <span>Làm mới danh sách</span>
            </button>
          </div>

          {/* 3 THẺ THỐNG KÊ MỤC 1: CHỜ LIÊN HỆ, ĐƠN ĐÃ HỦY, TỔNG ĐƠN */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Thẻ 1: Chờ liên hệ */}
            <div
              onClick={() => setTab1Filter(prev => prev === 'PENDING_CONTACT' ? 'ALL' : 'PENDING_CONTACT')}
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
                  {arrivalStatusCounts.pendingContact}
                </span>
                <span className="text-xs text-amber-700">đơn cần tư vấn</span>
              </div>
              <span className="text-[11px] text-amber-600 font-medium block mt-1">
                ⚡ Cần nhân viên liên hệ xác nhận
              </span>
            </div>

            {/* Thẻ 2: Đơn đã hủy */}
            <div
              onClick={() => setTab1Filter(prev => prev === 'CANCELLED' ? 'PENDING_CONTACT' : 'CANCELLED')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                tab1Filter === 'CANCELLED'
                  ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-400/50 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-rose-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-bold text-rose-800 font-mono">
                  Đơn Đã Hủy
                </span>
                <span className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">cancel</span>
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="font-headline text-2xl font-extrabold text-rose-900 tabular-nums">
                  {arrivalStatusCounts.cancelled}
                </span>
                <span className="text-xs text-rose-700">đơn đã hủy / từ chối</span>
              </div>
              <span className="text-[11px] text-rose-600 font-medium block mt-1">
                Đã giải phóng hoặc từ chối tiếp nhận
              </span>
            </div>

            {/* Thẻ 3: Tổng đơn */}
            <div
              onClick={() => setTab1Filter(prev => prev === 'ALL' ? 'PENDING_CONTACT' : 'ALL')}
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
                  {arrivals.length}
                </span>
                <span className="text-xs text-slate-500">tất cả đơn</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium block mt-1">
                Toàn bộ hồ sơ đặt chỗ tại cơ sở
              </span>
            </div>
          </div>

          {/* Search Box */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={pendingSearchTerm}
                onChange={(e) => setPendingSearchTerm(e.target.value)}
                placeholder="Tìm mã đơn, tên khách, SĐT, CCCD, kho..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-amber-400 transition"
              />
              {pendingSearchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setPendingSearchTerm('')
                    setHighlightedBookingCode(null)
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 font-medium">
                Đang hiển thị <strong className="text-amber-700">{filteredPendingOrders.length}</strong> đơn {tab1Filter === 'CANCELLED' ? 'đã hủy' : tab1Filter === 'ALL' ? 'toàn bộ' : 'chờ liên hệ'}
              </span>
              {tab1Filter !== 'PENDING_CONTACT' && (
                <button
                  type="button"
                  onClick={() => setTab1Filter('PENDING_CONTACT')}
                  className="text-xs text-amber-700 hover:underline font-bold ml-1 cursor-pointer"
                >
                  (Về danh sách chờ liên hệ)
                </button>
              )}
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 font-mono uppercase tracking-wider text-[11px] border-b border-slate-200">
                    <th className="py-3 px-4 font-semibold">Mã đơn &amp; Hợp đồng</th>
                    <th className="py-3 px-4 font-semibold">Khách hàng</th>
                    <th className="py-3 px-4 font-semibold">Cơ sở &amp; Kho</th>
                    <th className="py-3 px-4 font-semibold">Thời gian sẽ tiếp đón khách hàng</th>
                    <th className="py-3 px-4 font-semibold">Trạng thái &amp; Chữ ký</th>
                    <th className="py-3 px-4 font-semibold text-right">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredPendingOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                          <span className="material-symbols-outlined text-[24px]">inbox</span>
                        </div>
                        <p className="font-semibold text-slate-600 text-xs">Không có đơn đặt chỗ nào trong danh sách</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Thử chọn bộ lọc khác hoặc tìm kiếm mã đơn khác.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPendingOrders.map((b) => {
                      const s = String(b.status || '')
                      const isCancelled = s === 'CANCELLED'
                      const isHighlighted = highlightedBookingCode === b.bookingCode
                      const isContractSigned = Boolean(b.contractSigned) || b.contractStatus === 'PENDING_ACTIVATION' || b.contractStatus === 'ACTIVE'
                      const hasContract = Boolean(b.contractCode || b.contractId || b.paymentStatus === 'PAID')
                      const isPaidPending = s === 'PENDING_PAYMENT' && b.paymentStatus === 'PAID'
                      const isConfirmed = s === 'CONFIRMED' || (s as string) === 'CHECKIN_STEP1_COMPLETED' || isPaidPending
                      const isActiveOrCompleted = s === 'ACTIVE' || s === 'COMPLETED'
                      const isPending = s === 'PENDING_CONTACT' || s === 'PENDING_PAYMENT' || s === 'PENDING_APPROVAL' || (s as string) === 'PENDING_SIGNATURE' || (!isConfirmed && !isActiveOrCompleted && !isCancelled)
                      const isInPerson = b.signingMethod === 'IN_PERSON' 
                        || (b as any).signingMethod === 'in_person' 
                        || (b as any).paymentMethod === 'AT_FACILITY' 
                        || (b as any).paymentMethod === 'IN_PERSON'
                        || (b as any).isDirectPayment

                      const checkInTimeMs = b.expectedCheckInAt 
                        ? new Date(b.expectedCheckInAt).getTime() 
                        : (b.startDate ? new Date(b.startDate + 'T' + ((b as any).checkInTime?.split(' - ')[0] || '09:00') + ':00').getTime() : 0)
                      const hoursOverdue = checkInTimeMs > 0 ? (Date.now() - checkInTimeMs) / (1000 * 60 * 60) : 0
                      const isOverdue48h = hoursOverdue >= 48

                      return (
                        <tr
                          key={b.id || b.bookingCode}
                          className={`transition-colors ${
                            isHighlighted
                              ? 'bg-amber-50/90 ring-2 ring-amber-400/80 font-bold'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="py-3.5 px-4 font-mono">
                            <div className="flex items-center gap-1.5">
                              <strong className="text-slate-900 font-bold text-xs">{b.bookingCode}</strong>
                              {isHighlighted && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 text-[9px] font-bold">Vừa mở</span>
                              )}
                            </div>
                            {b.contractCode ? (
                              <span className="text-[10px] text-blue-700 font-bold block mt-0.5">
                                HĐ: {b.contractCode}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                {(b as any).createdAt ? new Date((b as any).createdAt).toLocaleDateString('vi-VN') : 'Mới tạo'}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <strong className="text-slate-900 block text-xs">{b.customerName}</strong>
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
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="text-slate-800 font-semibold block text-xs">{b.facilityName}</span>
                            <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                              {b.unitCode && b.unitCode !== 'Kho tự quản' ? `Kho #${b.unitCode}` : (b.unitTypeName || 'Kho tự quản')} · {b.rentalMonths} tháng
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

                              {!isCancelled && (
                                isContractSigned ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="material-symbols-outlined text-[12px]">draw</span>
                                    <span>Đã ký HĐ điện tử</span>
                                  </span>
                                ) : b.signingMethod === 'IN_PERSON' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                    <span>🏢 Ký giấy tại quầy</span>
                                  </span>
                                ) : hasContract ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                    <span>⏳ Chờ khách ký HĐ</span>
                                  </span>
                                ) : null
                              )}
                              {b.assignedStaffName ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200" title={`Nhân viên tiếp nhận: ${b.assignedStaffName}`}>
                                  <span className="material-symbols-outlined text-[12px]">person</span>
                                  <span>Tiếp nhận: <strong>{b.assignedStaffName}</strong></span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200" title="Đơn chưa có nhân viên tiếp nhận">
                                  <span className="material-symbols-outlined text-[12px]">person_off</span>
                                  <span>Chưa tiếp nhận</span>
                                </span>
                              )}

                              {isInPerson && !isActiveOrCompleted && !isCancelled && (
                                isOverdue48h ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse" title="Đã quá 48 giờ sau lịch hẹn check-in: Nhân viên có quyền hủy đơn">
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
                              {/* Đối với đơn đang chờ xử lý / chờ xác nhận / chờ ký: chỉ hiển thị 2 button [Xác nhận] và [Từ chối] (thêm [Hủy đơn] nếu quá 48h) */}
                              {isPending ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleStaffConfirmBooking(b)}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
                                    title="Xác nhận đơn"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">check_circle</span>
                                    <span>Xác nhận</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openRejectModal(b)}
                                    className="px-2.5 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                                    title="Từ chối đơn và điền lý do"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">cancel</span>
                                    <span>Từ chối</span>
                                  </button>
                                  {isOverdue48h && (
                                    <button
                                      type="button"
                                      onClick={() => handleCancelOverdueBooking(b)}
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
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const proceed = () => {
                                            setActiveBookingId(b.id)
                                            setStaffActiveTab('reception')
                                            setSearchParams({ tab: 'reception' })
                                            setTimeout(() => {
                                              document.getElementById('handover-workbench')?.scrollIntoView({ behavior: 'smooth' })
                                            }, 100)
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
                                        title={isInPerson ? "Chuyển sang Bàn Tiếp Đón để đón khách làm thủ tục ký giấy & thanh toán tại quầy" : "Chuyển sang Bàn Tiếp Đón & Nghiệm Thu Bàn Giao Kho"}
                                      >
                                        <span className="material-symbols-outlined text-[15px]">desk</span>
                                        <span>{isActiveOrCompleted ? 'Hồ Sơ Bàn Giao' : 'Check-in'}</span>
                                      </button>
                                      {isInPerson && isOverdue48h && (
                                        <button
                                          type="button"
                                          onClick={() => handleCancelOverdueBooking(b)}
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
                                      onClick={() => handleCancelOverdueBooking(b)}
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
          </div>
        </section>
      ) : staffActiveTab === 'renewals' ? (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
            <div>
              <h3 className="font-headline text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">autorenew</span>
                Hỗ Trợ Gia Hạn Hợp Đồng &amp; Ghi Nhận Thu Cước Tại Quầy
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tra cứu yêu cầu gia hạn cơ sở, kiểm tra công nợ và ghi nhận nộp tiền mặt / chuyển khoản / POS
              </p>
            </div>
          </div>
          <ContractRenewalsManagementPanel
            currentFacilityId={user?.facilityId || selectedFacility}
            facilities={contextFacilities}
            userRole={resolvedRole}
            showChainWideFilter={false}
          />
        </section>
      ) : (
        <>
          {/* 2 THẺ MỤC: CHỜ CHECK IN & YÊU CẦU TRẢ KHO */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Mục 1: Chờ check in */}
            <div
              onClick={() => setReceptionViewMode(prev => prev === 'check_in' ? 'all' : 'check_in')}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                receptionViewMode === 'check_in'
                  ? 'bg-cyan-50/90 border-cyan-400 ring-2 ring-cyan-400/40 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-cyan-300 hover:shadow-xs'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                  receptionViewMode === 'check_in'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'bg-cyan-50 border border-cyan-200 text-cyan-700'
                }`}>
                  <span className="material-symbols-outlined text-[24px]">how_to_reg</span>
                </span>
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-bold text-cyan-800 font-mono block">
                    Chờ check in
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-headline text-3xl font-extrabold text-cyan-900 tabular-nums">
                      {checkInArrivals.length}
                    </span>
                    <span className="text-xs text-cyan-700 font-medium">khách đến nhận kho</span>
                  </div>
                  <span className="text-[11px] text-cyan-600 mt-1 block font-medium">
                    ✓ Sẵn sàng tiếp đón &amp; bàn giao buồng kho
                  </span>
                </div>
              </div>
              <span className={`material-symbols-outlined text-[22px] transition-transform ${
                receptionViewMode === 'check_in' ? 'text-cyan-600 font-bold scale-110' : 'text-slate-300'
              }`}>
                {receptionViewMode === 'check_in' ? 'check_circle' : 'chevron_right'}
              </span>
            </div>

            {/* Mục 2: Yêu cầu trả kho */}
            <div
              onClick={() => setReceptionViewMode(prev => prev === 'returns' ? 'all' : 'returns')}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                receptionViewMode === 'returns'
                  ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-400/40 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-amber-300 hover:shadow-xs'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                  receptionViewMode === 'returns'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 border border-amber-200 text-amber-700'
                }`}>
                  <span className="material-symbols-outlined text-[24px]">assignment_return</span>
                </span>
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-bold text-amber-800 font-mono block">
                    Yêu cầu trả kho
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-headline text-3xl font-extrabold text-amber-900 tabular-nums">
                      {customerReturnRequests.length}
                    </span>
                    <span className="text-xs text-amber-700 font-medium">yêu cầu hoàn trả</span>
                  </div>
                  <span className="text-[11px] text-amber-600 mt-1 block font-medium">
                    ⚡ Nghiệm thu trả kho &amp; đối soát thanh lý
                  </span>
                </div>
              </div>
              <span className={`material-symbols-outlined text-[22px] transition-transform ${
                receptionViewMode === 'returns' ? 'text-amber-600 font-bold scale-110' : 'text-slate-300'
              }`}>
                {receptionViewMode === 'returns' ? 'check_circle' : 'chevron_right'}
              </span>
            </div>
          </section>

      {/* 3. TACTICAL SEARCH & LOCATION FILTER RIBBON */}
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
              onChange={(e) => handleTimeframeChange(e.target.value as any)}
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả lịch hẹn (Hôm nay &amp; Sắp tới)</option>
              <option value="current">Ca Hiện Tại</option>
              <option value="today">Trọn Vẹn Hôm Nay</option>
              <option value="future">Lịch Hẹn Sắp Tới</option>
              <option value="past">Lịch Sử Đã Qua</option>
            </select>
          </div>
          {receptionViewMode !== 'all' && (
            <button
              type="button"
              onClick={() => setReceptionViewMode('all')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer self-start md:self-auto shrink-0"
            >
              <span>Đang lọc xem: <strong>{receptionViewMode === 'check_in' ? 'Chờ check in' : 'Yêu cầu trả kho'}</strong></span>
              <span className="underline ml-1">(Hiển thị cả 2 mục)</span>
            </button>
          )}
        </div>
      </div>

      {/* Full-Width Handover & Check-in Operator Workbench */}
      {receptionViewMode !== 'returns' && (
      <HandoverCheckInWorkbench
        arrivals={workbenchArrivals}
        activeBookingId={activeBookingId}
        onHandoverComplete={(bookingId) => {
          setCheckInSuccessMsg(`Hoàn tất quy trình check-in bàn giao buồng kho cho đơn #${bookingId}`)
          fetchArrivals()
          fetchOccupancy()
          loadActiveRentals()
        }}
      />
      )}

      {/* Main Dual Workspace: Check-in Queue + Return Inspections */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Side: Upcoming Appointments & Return Requests (Col 8) */}
        <div className="xl:col-span-8 flex flex-col gap-6 min-w-0">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 min-w-0">

            {/* Upcoming Appointments Table: Chỉ hiển thị các đơn chờ Check-in */}
            {receptionViewMode !== 'returns' && (
            <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-600 text-[18px]">how_to_reg</span>
                Danh sách khách hàng chờ Check-in tại cơ sở
              </span>
              <span className="text-xs text-slate-500 font-mono font-bold">
                {checkInArrivals.length} khách chờ check-in
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-mono uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3 rounded-l-lg font-semibold">Khách hàng</th>
                    <th className="py-2.5 px-3 font-semibold">Mã Đơn &amp; Hợp Đồng</th>
                    <th className="py-2.5 px-3 font-semibold">Kho Đăng Ký</th>
                    <th className="py-2.5 px-3 font-semibold">Thời gian tiếp đón</th>
                    <th className="py-2.5 px-3 font-semibold">Trạng Thái &amp; Chữ Ký</th>
                    <th className="py-2.5 px-3 font-semibold">Cọc Giữ Chỗ</th>
                    <th className="py-2.5 px-3 rounded-r-lg text-right font-semibold">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {checkInArrivals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                        Không có lịch hẹn nhận kho nào đang chờ check-in trong ca trực hiện tại.
                      </td>
                    </tr>
                  ) : (
                    checkInArrivals.map((b) => {
                      const isContractSigned = Boolean(b.contractSigned) || b.contractStatus === 'PENDING_ACTIVATION' || b.contractStatus === 'ACTIVE'
                      const hasContract = Boolean(b.contractCode || b.contractId || b.paymentStatus === 'PAID' || b.status === 'CONFIRMED' || b.status === 'ACTIVE')
                      const hasPhysicalUnit = Boolean(b.storageUnitId && b.unitCode && b.unitCode !== 'Kho tự quản')

                      return (
                        <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-3">
                            <div className="font-bold text-slate-900 text-xs">{b.customerName || 'Khách vãng lai'}</div>
                            <div className="text-slate-500 font-mono text-[11px] tabular-nums mt-0.5">{b.customerPhone || 'N/A'}</div>
                          </td>
                          <td className="py-3.5 px-3 font-mono">
                            <div className="font-bold text-slate-900">{b.bookingCode}</div>
                            {b.contractCode && (
                              <span className="text-[10px] text-blue-700 font-bold block mt-0.5">{b.contractCode}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            {hasPhysicalUnit ? (
                              <>
                                <span className="font-mono font-bold text-cyan-700">Kho #{b.unitCode}</span>
                                <span className="text-slate-500 block text-[10px]">{b.facilityName || 'Boxora'}</span>
                              </>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  Chưa gán ô kho vật lý
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono block">
                                  Cỡ: {b.unitTypeName || 'Tiêu chuẩn'} · {b.rentalMonths} tháng
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-3 font-mono tabular-nums text-slate-700">
                            {b.expectedCheckInAt
                              ? `${new Date(b.expectedCheckInAt).toLocaleDateString('vi-VN')} ${new Date(b.expectedCheckInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                              : ((b as any).checkInDate || b.startDate)}
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="flex flex-col items-start gap-1">
                              {!hasPhysicalUnit ? (
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
                              {b.status !== 'CANCELLED' && isContractSigned && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  ✓ Đã ký HĐ điện tử
                                </span>
                              )}
                              {b.signingMethod === 'IN_PERSON' && !isContractSigned && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                  🏢 Ký giấy tại quầy
                                </span>
                              )}
                              {hasContract && !isContractSigned && b.signingMethod !== 'IN_PERSON' && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                  ⏳ Chờ khách ký HĐ
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-slate-900 tabular-nums">
                            {(b.depositPaid || b.depositAmount || b.totalRentalFee || 0).toLocaleString('vi-VN')}đ
                          </td>
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

                              <button
                                type="button"
                                onClick={() => {
                                  const proceed = () => {
                                    setActiveBookingId(b.id)
                                    setFocusedBookingNotice(`Đã chọn check-in khách hàng ${b.customerName} (${b.bookingCode})`)
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
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1 shadow-xs"
                                title="Tiến hành thủ tục Check-in bàn giao kho"
                              >
                                <span className="material-symbols-outlined text-[14px]">how_to_reg</span>
                                <span>Check-in</span>
                              </button>
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
            )}

            {/* Yêu Cầu Hoàn Trả Kho Của Khách Hàng */}
            {receptionViewMode !== 'check_in' && (
            <div className="mt-2 pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-amber-600">assignment_return</span>
                  <span className="font-headline text-xs sm:text-sm font-bold text-slate-900">
                    Yêu Cầu Hoàn Trả Kho Của Khách Hàng
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                    {customerReturnRequests.length} yêu cầu
                  </span>
                </div>
                <span className="font-mono text-[11px] text-slate-400">
                  {selectedFacility && selectedFacility !== 'ALL'
                    ? facilities.find(f => f.id === selectedFacility)?.name || 'Cơ sở đã chọn'
                    : 'Toàn hệ thống'}
                </span>
              </div>

              {customerReturnRequests.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-1">
                  <span className="material-symbols-outlined text-[28px] text-slate-400">check_circle</span>
                  <p className="text-xs font-semibold text-slate-700">Chưa có yêu cầu trả kho nào đang chờ</p>
                  <p className="text-[11px] text-slate-400">
                    Khi khách hàng gửi yêu cầu trả kho qua Portal, danh sách sẽ hiển thị tại đây để nhân viên xử lý nghiệm thu.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {customerReturnRequests.map((req) => {
                    const isSelected = selectedReturnBookingId === req.bookingId || selectedReturnBookingId === req.id
                    return (
                      <div
                        key={req.id}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                          isSelected
                            ? 'bg-amber-50/70 border-amber-300 shadow-xs ring-1 ring-amber-300'
                            : 'bg-white border-slate-200 hover:border-amber-300 hover:shadow-xs'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                                #{req.unitCode}
                              </span>
                              <strong className="text-xs text-slate-900 truncate max-w-[140px]">
                                {req.customerName}
                              </strong>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              req.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800 animate-pulse'
                            }`}>
                              {req.status === 'COMPLETED' ? 'Đã nghiệm thu' : 'Chờ nghiệm thu'}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                            {req.reason}
                          </p>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100">
                            <span>SĐT: {req.customerPhone}</span>
                            <span>Hạn/Ngày gửi: {req.requestDate}</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReturnBookingId(req.bookingId)
                              setReturnConfirmed(false)
                              setSettlementSuccessMsg(null)
                              document.getElementById('return-workbench')?.scrollIntoView({ behavior: 'smooth' })
                            }}
                            className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-amber-600 hover:text-white text-slate-700'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[15px]">fact_check</span>
                            <span>{isSelected ? 'Đang chọn nghiệm thu' : 'Xử lý trả kho'}</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            )}

          </div>
        </div>

        {/* Right Side: Return & Condition Inspection Flow (Col 4) */}
        <div id="return-workbench" className="xl:col-span-4 flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-[22px]">fact_check</span>
                  <h2 className="font-headline text-base font-bold text-slate-900">Nghiệm Thu Trả Kho</h2>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] font-bold">
                  #FLOW-RET-07
                </span>
              </div>

              {/* Target Contract Profile */}
              {activeRentals.length > 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0 whitespace-nowrap">Hồ Sơ Cần Nghiệm Thu</span>
                    <select
                      value={selectedReturnBookingId}
                      onChange={(e) => {
                        setSelectedReturnBookingId(e.target.value)
                        setReturnConfirmed(false)
                        setSettlementSuccessMsg(null)
                      }}
                      className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800 font-mono text-[10px] font-bold focus:outline-none"
                    >
                      <option value="">Chọn đơn trả kho</option>
                      {activeRentals.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.bookingCode} - Kho #{r.unitCode}
                        </option>
                      ))}
                    </select>
                  </div>
                  {currentReturnBooking ? (
                    <>
                      <div className="mt-1">
                        <span className="font-bold text-slate-900 text-sm block">{currentReturnBooking.customerName || 'Khách thuê'}</span>
                        <span className="text-xs text-slate-500">SĐT: {currentReturnBooking.customerPhone || 'N/A'}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                        <span className="text-slate-800">Vị trí: <strong className="font-mono text-slate-900">Kho #{currentReturnBooking.unitCode}</strong></span>
                        <span className="text-amber-700 font-mono font-bold text-[11px]">Hạn: {currentReturnBooking.endDate}</span>
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">Chọn hồ sơ trả kho để bắt đầu nghiệm thu.</p>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs text-slate-500 text-center">
                  Chưa có hợp đồng nào đến hạn nghiệm thu trả kho
                </div>
              )}

              {/* 4 Inspection Checklist Items */}
              {currentReturnBooking && <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-900 font-mono">
                    Biên bản thẩm định hiện trường
                  </span>
                  <span className="text-xs text-slate-500 font-mono">4/4 tiêu chuẩn</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">garage</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-900">Tình trạng cửa cuốn</span>
                      <span className="text-[10px] text-slate-500">Mở êm, không móp méo, ray dẫn tốt</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px] font-bold">
                    Tốt
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">cleaning_services</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-900">Vệ sinh kho &amp; sàn</span>
                      <span className="text-[10px] text-slate-500">Đã dọn sạch rác, không ẩm ướt</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px] font-bold">
                    Sạch sẽ
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">lock</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-900">Ổ khóa Smart Lock</span>
                      <span className="text-[10px] text-slate-500">Cảm biến nhạy, pin 92%</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px] font-bold">
                    Bình thường
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-slate-500 text-[18px]">thermostat</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-900">Cảm biến nhiệt / ẩm</span>
                      <span className="text-[10px] text-slate-500 font-mono">22°C • 48% RH (Chuẩn)</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px] font-bold">
                    Chuẩn
                  </span>
                </div>

                {/* Proof Photos */}
                <div className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-900 uppercase font-mono">
                      Ảnh chụp hiện trường (Bắt buộc)
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">2/2 ảnh</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative rounded-lg overflow-hidden h-20 shadow-sm bg-slate-200">
                      <img 
                        className="w-full h-full object-cover" 
                        src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80" 
                        alt="Toàn cảnh kho"
                      />
                      <span className="absolute bottom-1 left-1 px-1 bg-slate-900/80 text-white text-[9px] rounded font-mono">
                        Toàn cảnh kho
                      </span>
                    </div>
                    <div className="relative rounded-lg overflow-hidden h-20 shadow-sm bg-slate-200">
                      <img 
                        className="w-full h-full object-cover" 
                        src="https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=400&q=80" 
                        alt="Ổ khóa số"
                      />
                      <span className="absolute bottom-1 left-1 px-1 bg-slate-900/80 text-white text-[9px] rounded font-mono">
                        Ổ khóa số
                      </span>
                    </div>
                  </div>
                </div>

                {/* Settlement Summary */}
                <div className="mt-2 p-3.5 rounded-xl bg-slate-100 border border-slate-200 flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Tiền cọc giữ ban đầu:</span>
                    <span className="font-mono tabular-nums font-bold text-slate-800">
                      {returnDepositAmt.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Khấu trừ vệ sinh/hư hại:</span>
                    <span className="font-mono tabular-nums text-slate-500">0đ</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-900 pt-2 border-t border-slate-200">
                    <span className="font-bold">Số tiền hoàn trả khách:</span>
                    <span className="font-mono tabular-nums text-base text-emerald-600 font-extrabold">
                      {returnDepositAmt.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                </div>
              </div>}
            </div>

            {currentReturnBooking && settlementSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
                <span>{settlementSuccessMsg}</span>
              </div>
            )}

            {currentReturnBooking && <button
              onClick={handleProcessReturnSettlement}
              disabled={returnConfirmed || isSettlingReturn}
              className={`mt-4 w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer ${
                returnConfirmed
                  ? 'bg-emerald-600 text-white'
                  : isSettlingReturn
                  ? 'bg-slate-500 text-white cursor-wait'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {returnConfirmed ? 'check_circle' : isSettlingReturn ? 'hourglass_top' : 'assignment_turned_in'}
              </span>
              <span>
                {returnConfirmed ? 'ĐÃ HOÀN CỌC & TRẢ KHO' : isSettlingReturn ? 'Đang Xử Lý Quyết Toán Cọc...' : 'Xác Nhận Trả Kho & Hoàn Trả Cọc'}
              </span>
            </button>}
          </div>
        </div>

      </div>

        </>
      )}



      {/* Evidence Image Preview Modal */}
      {activeEvidenceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">image</span>
                </span>
                <div>
                  <h3 className="font-headline text-base font-bold text-slate-900">
                    Bằng Chứng Hiện Trường Sự Cố {activeEvidenceModal.ticketId}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {activeEvidenceModal.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveEvidenceModal(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto p-1">
                {activeEvidenceModal.images.map((imgUrl, idx) => (
                  <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group shadow-sm">
                    <img
                      src={imgUrl}
                      alt={`Bằng chứng ${idx + 1}`}
                      className="w-full h-56 object-cover"
                    />
                    <div className="absolute bottom-2 right-2 flex gap-1">
                      <a
                        href={imgUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 rounded-md bg-slate-900/80 hover:bg-slate-900 text-white text-[11px] font-bold flex items-center gap-1 backdrop-blur-sm transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        Xem ảnh gốc
                      </a>
                    </div>
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white font-mono text-[10px]">
                      Ảnh #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">
                  Tổng cộng: <strong className="text-slate-800">{activeEvidenceModal.images.length}</strong> hình ảnh bằng chứng
                </span>
                <button
                  type="button"
                  onClick={() => setActiveEvidenceModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                >
                  Đóng cửa sổ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Master Key Emergency Override Modal (BR-RULE-009) */}
      {isEmergencyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-rose-600 font-headline font-bold text-base">
                <span className="material-symbols-outlined text-[24px]">crisis_alert</span>
                <h3>Lệnh Khẩn Cấp Mở Cửa</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEmergencyModalOpen(false)
                  setEmergencyResult(null)
                  setEmergencyError(null)
                  setWitnessStaffId('')
                  setWitnessPassword('')
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <span className="material-symbols-outlined text-[16px]">security</span>
                <span>Nguyên tắc xác thực 2 người (Two-Person Rule)</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Mọi thao tác mở cưỡng chế barrier và cửa sảnh cần người làm chứng được phân quyền xác nhận mật khẩu; hệ thống lưu vết audit để kiểm soát thao tác.
              </p>
            </div>

            {emergencyResult ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-[28px]">check_circle</span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Lệnh Cưỡng Chế Đã Kích Hoạt</h4>
                <p className="text-xs text-slate-600">{emergencyResult}</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsEmergencyModalOpen(false)
                    setEmergencyResult(null)
                    setWitnessStaffId('')
                    setWitnessPassword('')
                  }}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Đóng cửa sổ
                </button>
              </div>
            ) : (
              <form onSubmit={handleExecuteEmergencyOverride} className="space-y-3 text-xs">
                {emergencyError && (
                  <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800">
                    {emergencyError}
                  </p>
                )}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Cơ sở áp dụng</label>
                  <select
                    value={emergencyFacilityId}
                    onChange={(e) => setEmergencyFacilityId(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-rose-500"
                  >
                    {facilities.length > 0 ? (
                      facilities.map(f => (
                        <option key={f.id} value={f.id}>{(f as any).facilityName || f.name} ({(f as any).facilityCode || (f as any).code || 'BOXORA'})</option>
                      ))
                    ) : (
                      <option value="a1111111-2222-3333-4444-555555555555">Boxora Tan Binh Mega Hub (HCM-TB)</option>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Loại tình huống</label>
                    <select
                      value={emergencyCategory}
                      onChange={(e) => setEmergencyCategory(e.target.value as any)}
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-rose-500"
                    >
                      <option value="MAINTENANCE_EMERGENCY">Sự Cố Kẹt Khóa / Kỹ Thuật</option>
                      <option value="FIRE_HAZARD">Báo Cháy PCCC / Cứu Hộ</option>
                      <option value="POLICE_WARRANT">Yêu Cầu Cơ Quan Chức Năng</option>
                      <option value="INTERNAL_AUDIT">Kiểm Tra An Ninh Định Kỳ</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Mức độ khẩn cấp</label>
                    <select
                      value={emergencySeverity}
                      onChange={(e) => setEmergencySeverity(e.target.value as any)}
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-rose-500"
                    >
                      <option value="CRITICAL">Cực Kỳ Khẩn Cấp (CRITICAL)</option>
                      <option value="HIGH">Ưu Tiên Cao (HIGH)</option>
                      <option value="MEDIUM">Trung Bình (MEDIUM)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Lý do chi tiết</label>
                  <textarea
                    rows={2}
                    required
                    value={emergencyReason}
                    onChange={(e) => setEmergencyReason(e.target.value)}
                    placeholder="Ghi rõ lý do can thiệp mở khóa khẩn cấp..."
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Quản lý / nhân viên làm chứng (UUID)</label>
                    <input
                      type="text"
                      required
                      value={witnessStaffId}
                      onChange={(e) => setWitnessStaffId(e.target.value)}
                      placeholder="UUID nhân viên hoặc quản lý"
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-rose-500 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Mật khẩu người làm chứng</label>
                    <input
                      type="password"
                      required
                      value={witnessPassword}
                      onChange={(e) => setWitnessPassword(e.target.value)}
                      placeholder="Mật khẩu xác nhận"
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEmergencyModalOpen(false)
                      setEmergencyError(null)
                      setWitnessStaffId('')
                      setWitnessPassword('')
                    }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isEmergencyCalling}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                  >
                    {isEmergencyCalling ? 'Đang Ghi Nhận Lệnh...' : 'Kích Hoạt Cưỡng Chế (60 Giây)'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Real-time HTML5-QRCode Camera Scanner Modal & Check-in API */}
      {bookingDetailId && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="booking-preparation-title" className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 id="booking-preparation-title" className="text-base font-bold text-slate-900">Thông tin kho cần chuẩn bị</h2>
                <p className="mt-1 text-xs text-slate-500">Chỉ xem và chuẩn bị vận hành; nhân viên không duyệt yêu cầu.</p>
              </div>
              <button type="button" onClick={closeBookingDetail} aria-label="Đóng" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="space-y-4 p-5">
              {bookingDetailLoading ? (
                <p className="py-8 text-center text-sm text-slate-500">Đang tải thông tin đặt kho…</p>
              ) : bookingDetailError ? (
                <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{bookingDetailError}</p>
              ) : bookingDetail ? (
                <>
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-4">
                    <p className="font-mono text-xs font-bold text-cyan-800">#{bookingDetail.bookingCode}</p>
                    <h3 className="mt-1 text-sm font-bold text-slate-900">Kho {bookingDetail.unitCode} · {bookingDetail.facilityName}</h3>
                    <p className="mt-2 text-xs text-slate-600">
                      Khách dự kiến đến: <strong className="text-slate-900">
                        {bookingDetail.expectedArrivalAt
                          ? new Date(bookingDetail.expectedArrivalAt).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
                          : `${bookingDetail.startDate} (chưa có giờ cụ thể)`}
                      </strong>
                    </p>
                  </div>
                  <div className="grid gap-2 rounded-xl bg-slate-50 p-4 text-xs sm:grid-cols-2">
                    <span>Khách hàng: <strong className="text-slate-900">{bookingDetail.customerName}</strong></span>
                    <span>Điện thoại: <strong className="text-slate-900">{bookingDetail.customerPhone}</strong></span>
                    <span>Mã đơn: <strong className="font-mono text-slate-900">{bookingDetail.bookingCode}</strong></span>
                    <span>Trạng thái: <strong className="text-slate-900">{bookingDetail.status}</strong></span>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-bold text-amber-900">Danh sách chuẩn bị</p>
                    <ul className="mt-2 space-y-1.5 text-xs text-amber-900">
                      <li>• Kiểm tra vệ sinh và tình trạng thực tế của kho.</li>
                      <li>• Kiểm tra ổ khóa, thiết bị IoT và cảm biến.</li>
                      <li>• Giữ kho sẵn sàng, không xếp đồ hoặc đưa kho đi bảo trì đột xuất.</li>
                    </ul>
                  </div>
                </>
              ) : null}
            </div>
          </section>
        </div>
      )}




      {/* MODAL NHẬP LÝ DO TỪ CHỐI ĐƠN ĐẶT GIỮ CHỖ */}
      {rejectingBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg max-h-[92vh] rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col text-left animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[20px]">cancel</span>
                </span>
                <div>
                  <h3 className="font-extrabold text-base">Từ Chối Đơn Đặt Giữ Chỗ</h3>
                  <span className="text-xs font-mono text-cyan-300">Mã đơn: {rejectingBooking.bookingCode}</span>
                </div>
              </div>
              <button
                type="button"
                disabled={isRejectingSubmitting}
                onClick={() => {
                  setRejectingBooking(null)
                  setRejectionError('')
                }}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1 font-mono text-xs">
                <div>Khách hàng: <strong className="text-slate-900 dark:text-white">{rejectingBooking.customerName}</strong> ({rejectingBooking.customerPhone})</div>
                <div>Cơ sở: <strong>{rejectingBooking.facilityName}</strong> · Kho {rejectingBooking.unitCode || 'Chưa gán kho vật lý'}</div>
                <div>Lịch hẹn: <strong>{(rejectingBooking as any).checkInDate || rejectingBooking.startDate}</strong> ({(rejectingBooking as any).checkInTime || 'Giờ tiếp đón'})</div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900 dark:text-white block text-xs">
                    Điền lý do từ chối (Nội dung này sẽ được gửi email tới khách hàng): <span className="text-rose-600">*</span>
                  </label>
                  <span className={`text-[11px] font-mono font-medium ${
                    rejectionReasonText.trim().length > 0 && rejectionReasonText.trim().length < 5
                      ? 'text-rose-500 font-bold'
                      : 'text-slate-400'
                  }`}>
                    {rejectionReasonText.trim().length}/5 ký tự tối thiểu
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={rejectionReasonText}
                  onChange={(e) => {
                    const val = e.target.value
                    setRejectionReasonText(val)
                    if (rejectionError && val.trim().length >= 5) {
                      setRejectionError('')
                    }
                  }}
                  placeholder="Nhập chi tiết lý do từ chối đơn đặt kho (tối thiểu 5 ký tự)..."
                  className={`w-full p-3 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs outline-none transition-all resize-none ${
                    rejectionError
                      ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20 dark:bg-rose-950/20'
                      : 'border-slate-300 dark:border-slate-700 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                  }`}
                />

                {/* Validate hiển thị trực tiếp trong form thay vì alert */}
                {rejectionError && (
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs animate-in fade-in slide-in-from-top-1 duration-150 shadow-sm">
                    <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0 mt-0.5">
                      error
                    </span>
                    <span className="font-semibold leading-relaxed">
                      {rejectionError}
                    </span>
                  </div>
                )}
              </div>

              {/* Gợi ý lý do nhanh */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-500 block">Chọn nhanh lý do mẫu:</span>
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
                        setRejectionReasonText(preset)
                        setRejectionError('')
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10.5px] cursor-pointer hover:border-slate-300 border border-transparent transition"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isRejectingSubmitting}
                onClick={() => {
                  setRejectingBooking(null)
                  setRejectionError('')
                }}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer transition disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isRejectingSubmitting}
                onClick={() => handleStaffRejectBooking(rejectingBooking, rejectionReasonText)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50 transition flex items-center gap-1.5 active:scale-95"
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

      {/* MODAL XÁC NHẬN ĐƠN ĐẶT GIỮ CHỖ CỦA NHÂN VIÊN */}
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
                  Bạn có chắc chắn muốn xác nhận đơn đặt giữ chỗ này? Trạng thái đơn sẽ chuyển sang <strong className="font-bold underline">Chờ check in</strong> (CONFIRMED) và hệ thống sẽ gửi thông báo xác nhận lịch hẹn nhận kho cho khách hàng.
                </p>
              </div>

              {/* Validate hiển thị trực tiếp trong form thay vì alert */}
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
                  Ghi chú nội bộ nhân viên (tùy chọn):
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
                onClick={() => executeStaffConfirmBooking(confirmingBooking, confirmingNotes)}
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
                    <span>Xác nhận đơn (Chờ check in)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM CHI TIẾT ĐƠN ĐẶT GIỮ CHỖ CỦA STAFF */}
      {reviewDetailBooking && (() => {
        const s = String(reviewDetailBooking.status || '').toUpperCase()
        const isCancelled = s === 'CANCELLED' || s === 'REJECTED'
        const isModalPaidPending = !isCancelled && (s === 'PAID_PENDING_ASSIGNMENT' || s === 'PAID_AND_SIGNED' || (s === 'CONFIRMED' && !reviewDetailBooking.storageUnitId))
        const isModalConfirmed = !isCancelled && ((s === 'CONFIRMED' && Boolean(reviewDetailBooking.storageUnitId)) || s === 'AWAITING_CHECKIN')
        const isModalContractSigned = !isCancelled && (Boolean(reviewDetailBooking.contractSigned) || reviewDetailBooking.contractStatus === 'PENDING_ACTIVATION' || reviewDetailBooking.contractStatus === 'ACTIVE')
        const hasModalContract = !isCancelled && Boolean(reviewDetailBooking.contractCode || reviewDetailBooking.contractId || reviewDetailBooking.paymentStatus === 'PAID' || isModalConfirmed || s === 'ACTIVE' || s === 'COMPLETED')
        const sched = getBookingScheduleInfo(reviewDetailBooking)
        const modalIsInPerson = reviewDetailBooking.signingMethod === 'IN_PERSON'
          || (reviewDetailBooking as any).signingMethod === 'in_person'
          || (reviewDetailBooking as any).paymentMethod === 'AT_FACILITY'
          || (reviewDetailBooking as any).paymentMethod === 'IN_PERSON'
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
                      {isCancelled ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 font-sans font-semibold">
                          ✕ Đã từ chối đơn
                        </span>
                      ) : isModalContractSigned ? (
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
                    <strong className="text-slate-900 dark:text-white font-sans text-xs">{reviewDetailBooking.facilityName}</strong>
                    <span className="text-[11px] text-slate-500 block">Quy cách: {reviewDetailBooking.unitCode}</span>
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

                {/* MỤC CHỨNG TỪ HOÀN TẤT ĐÃ KÝ & THANH TOÁN (2 BUTTONS: ẢNH THANH TOÁN & ẢNH HỢP ĐỒNG ĐÃ KÝ) */}
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
                {!isCancelled && !modalIsActiveOrCompleted && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = reviewDetailBooking;
                      setReviewDetailBooking(null);
                      setRejectingBooking(target);
                      setRejectionReasonText('');
                      setRejectionError('');
                    }}
                    className="px-4 py-2.5 rounded-xl border border-rose-300 hover:bg-rose-50 text-rose-700 text-xs font-bold cursor-pointer"
                  >
                    Từ chối đơn...
                  </button>
                )}

                {!isCancelled && modalIsOverdue48h && modalIsInPerson && !modalIsActiveOrCompleted && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = reviewDetailBooking;
                      setReviewDetailBooking(null);
                      handleCancelOverdueBooking(target);
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

                  {((reviewDetailBooking.status as string) === 'PENDING_CONTACT' || (reviewDetailBooking.status as string) === 'PENDING_CONFIRMATION' || (reviewDetailBooking.status as string) === 'PENDING_SIGNATURE') ? (
                    <button
                      type="button"
                      onClick={() => {
                        const target = reviewDetailBooking
                        setReviewDetailBooking(null)
                        handleStaffConfirmBooking(target)
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
                  ) : isModalConfirmed ? (
                    <button
                      type="button"
                      onClick={() => {
                        const target = reviewDetailBooking
                        const proceed = () => {
                          setReviewDetailBooking(null)
                          setStaffActiveTab('reception')
                          setSearchParams({ tab: 'reception' })
                          setActiveBookingId(target.id)
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

      {/* MODAL XEM ẢNH THANH TOÁN & ẢNH HỢP ĐỒNG ĐÃ KÝ */}
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
                    className="w-full h-[60vh] rounded-2xl border border-slate-200 bg-white shadow-xs"
                  />
                ) : (
                  <div className="relative group max-w-full">
                    <img
                      src={photoViewerModal.fileUrl}
                      alt={photoViewerModal.title}
                      className="max-h-[62vh] max-w-full object-contain rounded-2xl shadow-md border border-slate-200 bg-white"
                    />
                  </div>
                )
              ) : (
                <div className="p-8 text-center max-w-md">
                  <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto mb-3">
                    <span className="material-symbols-outlined text-[32px]">payments</span>
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-1">
                    Thanh Toán Trực Tuyến Đã Xác Nhận
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {photoViewerModal.notes || 'Đơn hàng này được xác nhận thanh toán trực tuyến qua hệ thống hoặc chưa có tệp ảnh chứng từ tải lên.'}
                  </p>
                </div>
              )}
            </div>

            {photoViewerModal.notes && photoViewerModal.fileUrl && (
              <div className="px-5 py-2.5 bg-blue-50/70 dark:bg-slate-800/60 border-t border-blue-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2 shrink-0">
                <span className="material-symbols-outlined text-[15px] text-blue-600 shrink-0">info</span>
                <span className="truncate">{photoViewerModal.notes}</span>
              </div>
            )}

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

      <ContractDocumentModal
        contract={viewingContract}
        booking={viewingContractBooking}
        onClose={() => {
          setViewingContract(null)
          setViewingContractBooking(null)
        }}
      />

      <AssignPhysicalUnitModal
        isOpen={Boolean(assignModalBooking)}
        booking={assignModalBooking}
        facilityId={assignModalBooking?.facilityId || (selectedFacility !== 'ALL' ? selectedFacility : undefined)}
        onClose={() => setAssignModalBooking(null)}
        onSuccess={(_updated) => {
          setAssignModalBooking(null)
          fetchArrivals()
          window.dispatchEvent(new Event('boxora:notifications-refresh'))
        }}
      />

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

    </div>
  )
}

