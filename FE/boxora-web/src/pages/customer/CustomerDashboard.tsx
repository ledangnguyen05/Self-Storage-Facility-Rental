import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { contractService, RentalContract } from '../../services/contractService'
import { bookingService } from '../../services/bookingService'
import { supportTicketService, SupportTicketRecord } from '../../services/supportTicketService'
import { facilityService } from '../../services/facilityService'
import { storageUnitService } from '../../services/storageUnitService'
import { paymentService, PaymentItem } from '../../services/paymentService'
import { Booking, Facility, StorageUnit, ContractRenewal } from '../../types'
import { BookingCheckoutModal } from '../../components/modals/BookingCheckoutModal'
import { ContractDocumentModal } from '../../components/modals/ContractDocumentModal'
import { DocuSealSimulationModal } from '../../components/modals/DocuSealSimulationModal'
import { DocuSealRenewalModal } from '../../components/modals/DocuSealRenewalModal'
import { RenewalDocumentModal } from '../../components/modals/RenewalDocumentModal'
import { ContractOtpModal } from '../../components/modals/ContractOtpModal'
import { CustomerPolicyModal, PolicyTab } from '../../components/modals/CustomerPolicyModal'
import { BookingCancelModal } from '../../components/modals/BookingCancelModal'
import { BookingRescheduleModal } from '../../components/modals/BookingRescheduleModal'
import { BookingRescheduleHistorySection } from '../../components/booking/BookingRescheduleHistorySection'
import { TicketCloseConfirmModal } from '../../components/modals/TicketCloseConfirmModal'
import { PortalBookingReservationModal, PortalBookingUnitData } from '../../components/booking/PortalBookingReservationModal'
import { extractFloor } from '../../utils/floorUtils'

const UNIT_CARD_IMAGES = [
  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1590247813693-5541d1c609fd?auto=format&fit=crop&w=800&q=80'
]

const safeFormatDateTime = (dateVal?: string | null, fallback = ''): string => {
  if (!dateVal) return fallback
  try {
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return fallback || String(dateVal)
    return d.toLocaleString('vi-VN')
  } catch {
    return fallback || String(dateVal)
  }
}

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Real database contracts state
  const [contracts, setContracts] = useState<RentalContract[]>([])
  const [loadingContracts, setLoadingContracts] = useState<boolean>(true)

  // Real database customer bookings state (Lịch sử đặt giữ chỗ)
  const [customerBookings, setCustomerBookings] = useState<Booking[]>([])
  const [loadingBookings, setLoadingBookings] = useState<boolean>(true)
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('ALL')
  const [bookingSearchTerm, setBookingSearchTerm] = useState<string>('')
  const [selectedBookingForModal, setSelectedBookingForModal] = useState<Booking | null>(null)
  const [cancellingBookingTarget, setCancellingBookingTarget] = useState<Booking | null>(null)

  // Real database customer payments state
  const [customerPayments, setCustomerPayments] = useState<PaymentItem[]>([])
  const [loadingPayments, setLoadingPayments] = useState<boolean>(true)
  const [selectedVatPayment, setSelectedVatPayment] = useState<PaymentItem | null>(null)

  // Real facilities & available units state
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [availableUnits, setAvailableUnits] = useState<StorageUnit[]>([])
  const [allUnits, setAllUnits] = useState<StorageUnit[]>([])
  const [isCustomerPolicyModalOpen, setIsCustomerPolicyModalOpen] = useState<boolean>(false)
  const [customerPolicyModalTab, setCustomerPolicyModalTab] = useState<PolicyTab>('cancellation')
  const [customerPolicyFacility, setCustomerPolicyFacility] = useState<{ id?: string; name?: string } | null>(null)
  const [loadingUnits, setLoadingUnits] = useState<boolean>(true)
  const [bookingRequests, setBookingRequests] = useState<Booking[]>([])
  const [requestToPay, setRequestToPay] = useState<Booking | null>(null)

  const fetchCustomerBookings = async () => {
    try {
      setLoadingBookings(true)
      const res = await bookingService.getMyBookings()
      if (Array.isArray(res)) {
        setCustomerBookings(res)
      } else {
        const activeRes = await bookingService.getMyActive()
        if (Array.isArray(activeRes)) {
          setCustomerBookings(activeRes)
        }
      }
    } catch (err) {
      console.error('Failed to load customer bookings from database:', err)
      try {
        const activeRes = await bookingService.getMyActive()
        if (Array.isArray(activeRes)) {
          setCustomerBookings(activeRes)
        }
      } catch {
        setCustomerBookings([])
      }
    } finally {
      setLoadingBookings(false)
    }
  }

  const fetchContracts = async () => {
    try {
      setLoadingContracts(true)
      const res = await contractService.getMyContracts({ size: 50 })
      if (res?.content && Array.isArray(res.content)) {
        setContracts(res.content)
      }
    } catch (err) {
      console.error('Failed to load real customer contracts from database:', err)
    } finally {
      setLoadingContracts(false)
    }
  }

  const fetchCustomerPayments = async () => {
    try {
      setLoadingPayments(true)
      const res = await paymentService.getMyPayments()
      if (Array.isArray(res)) {
        setCustomerPayments(res)
      }
    } catch (err) {
      console.error('Failed to load customer payments from database:', err)
      setCustomerPayments([])
    } finally {
      setLoadingPayments(false)
    }
  }

  const fetchAvailableUnits = async () => {
    try {
      setLoadingUnits(true)
      const res = await storageUnitService.getUnits()
      if (Array.isArray(res)) {
        setAllUnits(res)
        setAvailableUnits(res.filter(u => u.status === 'AVAILABLE'))
      }
    } catch (err) {
      console.error('Failed to load storage units from database:', err)
    } finally {
      setLoadingUnits(false)
    }
  }

  const fetchFacilities = async () => {
    try {
      const res = await facilityService.getFacilities()
      if (res?.content) {
        setFacilities(res.content)
      }
    } catch (err) {
      console.error('Failed to load facilities from database:', err)
    }
  }

  const fetchCustomerTickets = async () => {
    try {
      setLoadingTickets(true)
      const res = await supportTicketService.getMyTickets()
      if (Array.isArray(res)) {
        setCustomerTickets(res)
      }
    } catch (err) {
      console.error('Failed to load customer support tickets:', err)
    } finally {
      setLoadingTickets(false)
    }
  }

  const fetchMyRenewals = async () => {
    try {
      setLoadingRenewals(true)
      const res = await contractService.getRenewals({ size: 50 })
      if (res?.content && Array.isArray(res.content)) {
        setMyRenewals(res.content)
      }
    } catch (err) {
      console.warn('Failed to load customer renewals:', err)
      setMyRenewals([])
    } finally {
      setLoadingRenewals(false)
    }
  }

  const [isRefreshingData, setIsRefreshingData] = useState<boolean>(false)

  const handleRefreshAll = async () => {
    setIsRefreshingData(true)
    try {
      await Promise.allSettled([
        fetchContracts(),
        fetchMyRenewals(),
        fetchCustomerBookings(),
        fetchCustomerPayments(),
        fetchAvailableUnits(),
        fetchFacilities(),
        fetchCustomerTickets(),
        (async () => {
          try {
            const reqs = await bookingService.getMyRequests()
            setBookingRequests(reqs)
          } catch (err) {
            console.warn('Failed to refresh booking requests:', err)
          }
        })()
      ])
    } finally {
      setIsRefreshingData(false)
    }
  }

  useEffect(() => {
    fetchContracts()
    fetchMyRenewals()
    fetchCustomerBookings()
    fetchCustomerPayments()
    fetchAvailableUnits()
    fetchFacilities()
    fetchCustomerTickets()
  }, [user])

  useEffect(() => {
    let isCurrent = true
    const loadRequests = async () => {
      try {
        const requests = await bookingService.getMyRequests()
        if (isCurrent) setBookingRequests(requests)
      } catch (err) {
        console.warn('Failed to load booking requests:', err)
      }
    }
    void loadRequests()
    const intervalId = window.setInterval(() => void loadRequests(), 15000)
    return () => {
      isCurrent = false
      window.clearInterval(intervalId)
    }
  }, [user?.id])

  const activeContracts = contracts.filter(c => c.status === 'ACTIVE' || c.status === 'OVERDUE')

  // Đơn đặt giữ chỗ đang chờ nhận kho tại quầy (CONFIRMED hoặc PENDING_PAYMENT)
  const pendingReservations = useMemo(() => {
    return customerBookings.filter(b => b.status === 'CONFIRMED' || b.status === 'PENDING_PAYMENT')
  }, [customerBookings])

  // Real Customer Financial Summaries from DB
  const totalAmountPaid = useMemo(() => {
    return customerPayments.filter(p => p.status === 'PAID' || p.status === 'SUCCESS').reduce((sum, p) => sum + (p.amount || 0), 0)
  }, [customerPayments])

  // Helper: Hiển thị đúng số tiền cọc lưu ký theo dữ liệu CSDL và chính sách Boxora
  const getContractDepositHeld = useCallback((c: any) => {
    if (Number(c?.depositHeld || 0) > 0) return Number(c.depositHeld)

    const matchingPayment = customerPayments.find(
      (p) => (p.bookingId === c?.bookingId || (p.unitCode && c?.unitCode && p.unitCode.trim().toUpperCase() === c.unitCode.trim().toUpperCase()))
        && p.paymentType === 'DEPOSIT' && (p.status === 'PAID' || p.status === 'SUCCESS')
    )
    if (matchingPayment?.amount && Number(matchingPayment.amount) > 0) return Number(matchingPayment.amount)

    const matchingBooking = customerBookings.find(
      (b) => b.id === c?.bookingId || (b.unitCode && c?.unitCode && b.unitCode.trim().toUpperCase() === c.unitCode.trim().toUpperCase())
    )
    if (matchingBooking?.depositPaid && Number(matchingBooking.depositPaid) > 0) return Number(matchingBooking.depositPaid)
    if (matchingBooking?.depositAmount && Number(matchingBooking.depositAmount) > 0) return Number(matchingBooking.depositAmount)

    return Number(c?.monthlyFee || 0)
  }, [customerPayments, customerBookings])

  const totalDepositsHeld = useMemo(() => {
    const fromPayments = customerPayments.filter(p => (p.status === 'PAID' || p.status === 'SUCCESS') && p.paymentType === 'DEPOSIT').reduce((sum, p) => sum + (p.amount || 0), 0)
    const fromContracts = contracts.reduce((sum, c) => sum + getContractDepositHeld(c), 0)
    return fromPayments > 0 ? fromPayments : fromContracts
  }, [customerPayments, contracts, getContractDepositHeld])

  const monthlyRentalTotal = useMemo(() => {
    return activeContracts.reduce((sum, c) => sum + (c.monthlyFee || 0), 0)
  }, [activeContracts])

  const successfulPaymentsCount = useMemo(() => {
    return customerPayments.filter(p => p.status === 'PAID' || p.status === 'SUCCESS').length
  }, [customerPayments])

  // Support Ticket Form & History State
  const [ticketUnit, setTicketUnit] = useState('')
  const [customerTickets, setCustomerTickets] = useState<SupportTicketRecord[]>([])
  const [loadingTickets, setLoadingTickets] = useState<boolean>(false)
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('ALL')
  const [ticketSearchTerm, setTicketSearchTerm] = useState<string>('')

  useEffect(() => {
    if (activeContracts.length > 0 && !ticketUnit) {
      setTicketUnit(activeContracts[0].unitCode)
    }
  }, [activeContracts, ticketUnit])
  const nearestEndDate = activeContracts
    .map(c => c.endDate)
    .filter(Boolean)
    .sort()[0] || '--'

  // Tabs: 'my-units' (default) | 'bookings' | 'explore' | 'contracts' | 'support'
  const tabParam = searchParams.get('tab') as 'my-units' | 'bookings' | 'explore' | 'contracts' | 'support' | null
  const [activeTab, setActiveTab] = useState<'my-units' | 'bookings' | 'explore' | 'contracts' | 'support'>(
    tabParam && ['my-units', 'bookings', 'explore', 'contracts', 'support'].includes(tabParam)
      ? tabParam
      : 'my-units'
  )

  const [highlightedUnitCode, setHighlightedUnitCode] = useState<string | null>(null)
  const [highlightedBookingCode, setHighlightedBookingCode] = useState<string | null>(null)

  useEffect(() => {
    if (tabParam && ['my-units', 'bookings', 'explore', 'contracts', 'support'].includes(tabParam)) {
      setActiveTab(tabParam)
    }
    const unitParam = searchParams.get('unit') || searchParams.get('unitCode')
    if (unitParam) {
      setHighlightedUnitCode(unitParam)
      setTimeout(() => {
        const clean = unitParam.toLowerCase().replace(/[^a-z0-9]/g, '')
        const el = document.getElementById(`unit-card-${clean}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 250)
    }
    const bookingParam = searchParams.get('booking') || searchParams.get('bookingCode')
    if (bookingParam) {
      setHighlightedBookingCode(bookingParam)
      setBookingStatusFilter('ALL')
      setBookingSearchTerm('')
      setTimeout(() => {
        const clean = bookingParam.toLowerCase().replace(/[^a-z0-9]/g, '')
        const el = document.getElementById(`booking-card-${clean}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 250)
    }
  }, [tabParam, searchParams, customerBookings.length])

  const handleTabChange = (tab: 'my-units' | 'bookings' | 'explore' | 'contracts' | 'support') => {
    setActiveTab(tab)
    setSearchParams({ tab })
    if (tab === 'support') {
      fetchCustomerTickets()
    }
  }

  const handleGoToMyUnit = (unitCode?: string) => {
    setActiveTab('my-units')
    if (unitCode) {
      setSearchParams({ tab: 'my-units', unit: unitCode })
      setHighlightedUnitCode(unitCode)
      setTimeout(() => {
        const clean = unitCode.toLowerCase().replace(/[^a-z0-9]/g, '')
        const el = document.getElementById(`unit-card-${clean}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 150)
    } else {
      setSearchParams({ tab: 'my-units' })
    }
  }

  const getBookingNoticeInfo = useCallback((b: Booking) => {
    const matchingContract =
      contracts.find(c => Boolean(c.bookingId) && (c.bookingId === b.id || c.bookingId === b.bookingCode)) ||
      contracts.find(
        c =>
          !c.bookingId &&
          Boolean(c.unitCode) &&
          c.unitCode === b.unitCode &&
          c.status !== 'TERMINATED' &&
          c.status !== 'EXPIRED'
      )

    // Filter initial booking payment transactions and separate PAID, REFUNDED, and REFUND_PENDING
    const allBookingPayments = customerPayments.filter(
      p =>
        ((p.bookingId && (p.bookingId === b.id || p.bookingId === b.bookingCode)) ||
          (p.bookingCode && (p.bookingCode === b.bookingCode || p.bookingCode === b.id))) &&
        (p.paymentType === 'DEPOSIT' || p.paymentType === 'RENTAL_FEE' || p.paymentType === 'BOOKING_PAYMENT') &&
        Number(p.amount || 0) > 0
    )
    const confirmedBookingPayments = allBookingPayments.filter(
      p => p.status === 'PAID' || p.status === 'SUCCESS'
    )
    // Only confirmed REFUNDED transactions are deducted from held money; REFUND_PENDING is NOT deducted
    const refundedBookingPayments = allBookingPayments.filter(
      p => p.status === 'REFUNDED'
    )
    const refundPendingBookingPayments = allBookingPayments.filter(
      p => p.status === 'REFUND_PENDING'
    )
    const hasRefundPendingTx = refundPendingBookingPayments.length > 0
    const hasRefundedOrRefundPendingDepositTx = allBookingPayments.some(
      p =>
        (p.paymentType === 'DEPOSIT' || p.paymentType === 'BOOKING_PAYMENT') &&
        (p.status === 'REFUNDED' || p.status === 'REFUND_PENDING')
    )

    const requiredDeposit = Math.max(0, Number(b.depositAmount ?? matchingContract?.depositHeld ?? 0))
    const requiredFirstMonthRent = Math.max(
      0,
      b.totalRentalFee && b.rentalMonths && b.rentalMonths > 0
        ? Math.round(Number(b.totalRentalFee) / Number(b.rentalMonths))
        : Number(b.totalRentalFee ?? matchingContract?.monthlyFee ?? 0)
    )
    const requiredTotalInitial =
      b.initialPaymentAmount && Number(b.initialPaymentAmount) > 0
        ? Number(b.initialPaymentAmount)
        : requiredDeposit + requiredFirstMonthRent

    const paidDepositTx = confirmedBookingPayments
      .filter(p => p.paymentType === 'DEPOSIT')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const paidRentTx = confirmedBookingPayments
      .filter(p => p.paymentType === 'RENTAL_FEE')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const paidBookingTx = confirmedBookingPayments
      .filter(p => p.paymentType === 'BOOKING_PAYMENT')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)

    const refundedDepositTx = refundedBookingPayments
      .filter(p => p.paymentType === 'DEPOSIT')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const refundedRentTx = refundedBookingPayments
      .filter(p => p.paymentType === 'RENTAL_FEE')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const refundedBookingTx = refundedBookingPayments
      .filter(p => p.paymentType === 'BOOKING_PAYMENT')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)

    const isBookingCancelledOrRefunded =
      b.status === 'CANCELLED' || String(b.paymentStatus || '').toUpperCase() === 'REFUNDED'
    const canFallbackToBookingDepositField =
      !isBookingCancelledOrRefunded &&
      b.status !== 'PENDING_PAYMENT' &&
      !hasRefundedOrRefundPendingDepositTx &&
      String(b.paymentStatus || '').toUpperCase() !== 'UNPAID'

    // Avoid double-counting BOOKING_PAYMENT with DEPOSIT / RENTAL_FEE or booking.depositPaid
    const baseDepositPaid =
      paidDepositTx === 0 && paidBookingTx === 0
        ? canFallbackToBookingDepositField
          ? Math.max(0, Number(b.depositPaid || 0))
          : 0
        : paidDepositTx
    const unpaidDepositBeforeBookingTx = Math.max(0, requiredDeposit - baseDepositPaid)
    const allocatedBookingToDeposit = Math.min(paidBookingTx, unpaidDepositBeforeBookingTx)
    const remainingBookingTxForRent = Math.max(0, paidBookingTx - allocatedBookingToDeposit)

    const grossDepositPaid = isBookingCancelledOrRefunded ? 0 : baseDepositPaid + allocatedBookingToDeposit
    const grossRentPaid = isBookingCancelledOrRefunded ? 0 : paidRentTx + remainingBookingTxForRent

    const deductDeposit = Math.min(refundedDepositTx, grossDepositPaid)
    const excessDepositRefund = Math.max(0, refundedDepositTx - deductDeposit)
    const afterDepositRefund = Math.max(0, grossDepositPaid - deductDeposit)
    const afterRentRefund = Math.max(0, grossRentPaid - refundedRentTx - excessDepositRefund)

    const deductBookingFromDeposit = Math.min(refundedBookingTx, afterDepositRefund)
    const remBookingRefund = Math.max(0, refundedBookingTx - deductBookingFromDeposit)

    const effectiveDepositPaid = Math.max(0, afterDepositRefund - deductBookingFromDeposit)
    const effectiveRentPaid = Math.max(0, afterRentRefund - remBookingRefund)

    const depositRemaining = Math.max(0, requiredDeposit - effectiveDepositPaid)
    const rentRemaining = Math.max(0, requiredFirstMonthRent - effectiveRentPaid)
    const remainingAmountDue = depositRemaining + rentRemaining

    const isObligationSatisfiedByTx =
      !isBookingCancelledOrRefunded &&
      !hasRefundPendingTx &&
      (requiredTotalInitial > 0
        ? depositRemaining === 0 && rentRemaining === 0
        : paidBookingTx - refundedBookingTx > 0)

    // Never treat PARTIALLY_PAID or a single DEPOSIT transaction as full payment when rental fee is still unpaid
    const isPaid =
      !isBookingCancelledOrRefunded &&
      !hasRefundPendingTx &&
      b.paymentStatus !== 'PARTIALLY_PAID' &&
      (isObligationSatisfiedByTx ||
        (b.paymentStatus === 'PAID' &&
          b.status !== 'PENDING_PAYMENT' &&
          confirmedBookingPayments.length === 0 &&
          refundedBookingPayments.length === 0 &&
          !hasRefundedOrRefundPendingDepositTx))

    const isPartiallyPaid =
      !isBookingCancelledOrRefunded &&
      !hasRefundPendingTx &&
      !isPaid &&
      ((b.paymentStatus === 'PARTIALLY_PAID' && !hasRefundedOrRefundPendingDepositTx) ||
        effectiveDepositPaid > 0 ||
        effectiveRentPaid > 0)

    const isContractSigned = Boolean(
      b.status === 'ACTIVE' ||
      (matchingContract && (
        matchingContract.status === 'ACTIVE' ||
        matchingContract.status === 'PENDING_ACTIVATION' ||
        Boolean(matchingContract.signedAt) ||
        Boolean(matchingContract.signedDocumentUrl) ||
        Boolean((matchingContract as any).paperVerifiedAt) ||
        Boolean(matchingContract.signatureData)
      ))
    )

    let scenario: 'CANCELLED_OR_OVERDUE' | 'ACTIVE' | 'PAID_SIGNED' | 'PAID_UNSIGNED' | 'UNPAID_IN_PERSON' = 'UNPAID_IN_PERSON'

    if (b.status === 'CANCELLED' || b.status === 'OVERDUE' || hasRefundPendingTx) {
      scenario = 'CANCELLED_OR_OVERDUE'
    } else if (b.status === 'ACTIVE') {
      scenario = 'ACTIVE'
    } else if (isPaid && isContractSigned) {
      scenario = 'PAID_SIGNED'
    } else if (isPaid && !isContractSigned) {
      scenario = 'PAID_UNSIGNED'
    } else {
      scenario = 'UNPAID_IN_PERSON'
    }

    return {
      matchingContract,
      isPaid,
      isPartiallyPaid,
      effectiveDepositPaid,
      effectiveRentPaid,
      depositRemaining,
      rentRemaining,
      remainingAmountDue,
      isContractSigned,
      scenario,
    }
  }, [contracts, customerPayments])

  // Helper: Tính toán thông báo trạng thái ngày check-in để customer chú ý
  // Quy chuẩn hiển thị: "đã quá (number) ngày", "hôm nay", "(number) ngày sắp tới"
  const getCheckInNoticeInfo = useCallback((b: Booking) => {
    if (!b) return null

    // Không áp dụng cho đơn đã kích hoạt/đang dùng, đã hủy, quá hạn hoặc hoàn tất
    if (
      b.status === 'ACTIVE' ||
      b.status === 'CANCELLED' ||
      b.status === 'OVERDUE' ||
      b.status === 'COMPLETED'
    ) {
      return null
    }

    const rawDate = b.expectedCheckInAt || b.startDate
    if (!rawDate) return null

    let targetDate: Date
    if (typeof rawDate === 'string') {
      const parsed = new Date(rawDate)
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed
      } else {
        const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (match) {
          targetDate = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
        } else {
          return null
        }
      }
    } else {
      targetDate = new Date(rawDate)
    }

    if (isNaN(targetDate.getTime())) return null

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const targetDayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime()

    const diffMs = targetDayStart - todayStart
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))

    const formattedDate = targetDate.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

    if (diffDays < 0) {
      const overdueDays = Math.abs(diffDays)
      return {
        type: 'OVERDUE' as const,
        days: overdueDays,
        text: `đã quá ${overdueDays} ngày`,
        alertTitle: `Chú ý: Đã quá ${overdueDays} ngày so với lịch hẹn nhận kho!`,
        alertMessage: `Lịch hẹn nhận kho ban đầu là ngày ${formattedDate}. Quý khách vui lòng đến cơ sở để hoàn tất nhận bàn giao kho hoặc bấm "Đổi lịch" bên dưới để hẹn ngày mới phù hợp.`,
        formattedDate,
      }
    } else if (diffDays === 0) {
      return {
        type: 'TODAY' as const,
        days: 0,
        text: 'hôm nay',
        alertTitle: 'Hôm nay là ngày hẹn nhận kho!',
        alertMessage: `Lịch hẹn nhận kho của quý khách là HÔM NAY (${formattedDate})! Vui lòng mang CCCD gốc đến cơ sở Boxora để nhận bàn giao kho và kích hoạt mã PIN SmartLock.`,
        formattedDate,
      }
    } else {
      return {
        type: 'UPCOMING' as const,
        days: diffDays,
        text: `${diffDays} ngày sắp tới`,
        alertTitle: `Lịch hẹn nhận kho: ${diffDays} ngày sắp tới`,
        alertMessage: `Lịch hẹn nhận kho dự kiến trong ${diffDays} ngày sắp tới (${formattedDate}). Quý khách vui lòng lưu ý thời gian đến cơ sở đúng hẹn.`,
        formattedDate,
      }
    }
  }, [])

  const handleGoToBooking = (booking: Booking) => {
    const fullBooking =
      customerBookings.find(
        cb => cb.id === booking.id || (cb.bookingCode && cb.bookingCode === booking.bookingCode)
      ) || booking
    const targetCode = fullBooking.bookingCode || fullBooking.id
    setRequestToPay(null)
    setActiveTab('bookings')
    setBookingStatusFilter('ALL')
    setBookingSearchTerm('')
    setSearchParams({ tab: 'bookings', booking: targetCode })
    setHighlightedBookingCode(targetCode)
    setTimeout(() => {
      const clean = targetCode.toLowerCase().replace(/[^a-z0-9]/g, '')
      const el = document.getElementById(`booking-card-${clean}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 150)
  }

  // Copy PIN notification
  const [copiedPin, setCopiedPin] = useState<string | null>(null)
  // Stitch PIN Reveal State
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({})
  const [loadedPins, setLoadedPins] = useState<Record<string, string>>({})
  const [loadingPins, setLoadingPins] = useState<Record<string, boolean>>({})
  const [pinCountdown, setPinCountdown] = useState<number>(59)

  const togglePinReveal = async (unitCode: string, bookingOrContractId: string) => {
    if (revealedPins[unitCode]) {
      setRevealedPins(prev => ({ ...prev, [unitCode]: false }))
      return
    }

    if (!loadedPins[unitCode]) {
      setLoadingPins(prev => ({ ...prev, [unitCode]: true }))
      try {
        const res = await bookingService.getBookingPin(bookingOrContractId)
        if (res?.accessPin) {
          setLoadedPins(prev => ({ ...prev, [unitCode]: res.accessPin }))
        }
      } catch (err) {
        console.warn('Backend getBookingPin fallback:', err)
      } finally {
        setLoadingPins(prev => ({ ...prev, [unitCode]: false }))
      }
    }

    setRevealedPins(prev => ({ ...prev, [unitCode]: true }))
    setPinCountdown(59)
  }

  const [selectedBookingUnit, setSelectedBookingUnit] = useState<PortalBookingUnitData | null>(null)

  // Reschedule Modal state
  const [rescheduleBookingTarget, setRescheduleBookingTarget] = useState<Booking | null>(null)
  const [rescheduleNewDate, setRescheduleNewDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [rescheduleNewTime, setRescheduleNewTime] = useState<string>('09:00')
  const [rescheduleReason, setRescheduleReason] = useState<string>('')
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState<boolean>(false)
  const [rescheduleError, setRescheduleError] = useState<string | null>(null)
  const [rescheduleSuccess, setRescheduleSuccess] = useState<boolean>(false)

  // Renewal Modal (Yêu cầu gia hạn hợp đồng)
  const [renewModalData, setRenewModalData] = useState<{
    contractId: string
    contractCode: string
    customerName: string
    facilityName: string
    unitCode: string
    startDate: string
    endDate: string
    monthlyPrice: number
  } | null>(null)
  const [renewMonths, setRenewMonths] = useState<number>(3)
  const [renewNotes, setRenewNotes] = useState<string>('')
  const [renewSuccess, setRenewSuccess] = useState<boolean>(false)
  const [createdRenewal, setCreatedRenewal] = useState<ContractRenewal | null>(null)
  const [renewError, setRenewError] = useState<string | null>(null)
  const [isSubmittingRenewal, setIsSubmittingRenewal] = useState<boolean>(false)
  const [renewalForSigning, setRenewalForSigning] = useState<ContractRenewal | null>(null)
  const [isPayingRenewal, setIsPayingRenewal] = useState<boolean>(false)
  const [myRenewals, setMyRenewals] = useState<ContractRenewal[]>([])
  const [loadingRenewals, setLoadingRenewals] = useState<boolean>(false)
  const [renewMethod, setRenewMethod] = useState<'ONLINE' | 'COUNTER'>('ONLINE')
  const [renewAppointmentDate, setRenewAppointmentDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [contractHistoryModal, setContractHistoryModal] = useState<{ contract: RentalContract; renewals: ContractRenewal[] } | null>(null)

  // Switch Renewal Method Modal State (Chọn/Đổi sang trực tuyến hoặc trực tiếp tại cơ sở)
  const [switchMethodTarget, setSwitchMethodTarget] = useState<ContractRenewal | null>(null)
  const [switchMethodMode, setSwitchMethodMode] = useState<'ONLINE' | 'COUNTER'>('COUNTER')
  const [switchAppointmentDate, setSwitchAppointmentDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [switchAppointmentTime, setSwitchAppointmentTime] = useState<string>('09:00')
  const [switchMethodNotes, setSwitchMethodNotes] = useState<string>('')
  const [isSubmittingSwitchMethod, setIsSubmittingSwitchMethod] = useState<boolean>(false)
  const [switchMethodError, setSwitchMethodError] = useState<string | null>(null)

  // PIN Change Request Modal (Yêu cầu đổi mã PIN)
  const [pinChangeUnit, setPinChangeUnit] = useState<{ unitCode: string; targetId: string; currentPin: string } | null>(null)
  const [newPin, setNewPin] = useState<string>('')
  const [confirmPin, setConfirmPin] = useState<string>('')
  const [pinChangeError, setPinChangeError] = useState<string>('')
  const [pinChangeSuccess, setPinChangeSuccess] = useState<boolean>(false)
  const [isSubmittingPinChange, setIsSubmittingPinChange] = useState<boolean>(false)

  // Contract Details & Signing Modals
  const [selectedContractForModal, setSelectedContractForModal] = useState<RentalContract | null>(null)
  const [contractForDocuSealModal, setContractForDocuSealModal] = useState<RentalContract | null>(null)
  const [contractForOtpModal, setContractForOtpModal] = useState<RentalContract | null>(null)
  const [fetchingSigningUrl, setFetchingSigningUrl] = useState(false)
  const [selectedRenewalForDocModal, setSelectedRenewalForDocModal] = useState<ContractRenewal | null>(null)

  // Share Access Modal
  const [shareModalUnit, setShareModalUnit] = useState<string | null>(null)
  const [sharePhone, setSharePhone] = useState('')
  const [shareSuccess, setShareSuccess] = useState(false)

  // Support Ticket Form State
  const [ticketType, setTicketType] = useState('lock')
  const [ticketPriority, setTicketPriority] = useState('MEDIUM')
  const [ticketContent, setTicketContent] = useState('')
  const [ticketSubmitted, setTicketSubmitted] = useState(false)
  const [ticketError, setTicketError] = useState<string | null>(null)
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false)
  const [reopenModalTicket, setReopenModalTicket] = useState<SupportTicketRecord | null>(null)
  const [closeTicketTarget, setCloseTicketTarget] = useState<SupportTicketRecord | null>(null)
  const [ticketActionError, setTicketActionError] = useState<string | null>(null)
  const [reopenReasonText, setReopenReasonText] = useState('')
  const [isProcessingTicketAction, setIsProcessingTicketAction] = useState(false)

  // Unit lookups
  const unitMapById = useMemo(() => {
    const map = new Map<string, StorageUnit>()
    allUnits.forEach(u => map.set(u.id, u))
    return map
  }, [allUnits])

  const unitMapByCode = useMemo(() => {
    const map = new Map<string, StorageUnit>()
    allUnits.forEach(u => {
      if (u.unitCode) map.set(u.unitCode.trim().toUpperCase(), u)
    })
    return map
  }, [allUnits])

  const getNormalizedFloor = (rawFloor?: string | null, unitCode?: string | null): string | null => {
    const fromRaw = extractFloor(rawFloor)
    if (fromRaw) return fromRaw
    if (unitCode) {
      const match = unitCode.match(/(?:[A-Z0-9]+-)?([A-Z])?([1-9])\d{2}/i)
      if (match && match[2]) return match[2]
    }
    return null
  }

  const matchesSize = (area: number | null | undefined, sizeFilter: string): boolean => {
    if (sizeFilter === 'all') return true
    const eff = area ?? 6
    if (sizeFilter === 'mini') return eff <= 5
    if (sizeFilter === 'family') return eff > 5 && eff <= 10
    if (sizeFilter === 'business') return eff > 10
    return true
  }

  const matchesFacility = (
    itemFacilityId: string | undefined | null,
    itemFacilityName: string | undefined | null,
    selectedFacility: string
  ): boolean => {
    if (selectedFacility === 'all') return true
    if (itemFacilityId && itemFacilityId === selectedFacility) return true
    if (itemFacilityName && (itemFacilityName.toLowerCase() === selectedFacility.toLowerCase() || selectedFacility.toLowerCase().includes(itemFacilityName.toLowerCase()))) return true
    return false
  }

  // 1. Tab "Kho của tôi" (My Units) Filter States & Calculations
  const [myUnitsSearchTerm, setMyUnitsSearchTerm] = useState('')
  const [myUnitsFacility, setMyUnitsFacility] = useState('all')
  const [myUnitsFloor, setMyUnitsFloor] = useState('all')
  const [myUnitsSize, setMyUnitsSize] = useState('all')

  const myUnitsFacilities = useMemo(() => {
    const map = new Map<string, string>()
    activeContracts.forEach(c => {
      const name = c.facilityName?.trim() || 'Cơ sở trực thuộc'
      const key = c.facilityId || name
      if (!map.has(key)) map.set(key, name)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [activeContracts])

  const myUnitsFloors = useMemo(() => {
    const floorSet = new Set<string>()
    activeContracts.forEach(c => {
      if (!matchesFacility(c.facilityId, c.facilityName, myUnitsFacility)) return
      const unit = (c.storageUnitId ? unitMapById.get(c.storageUnitId) : null) || (c.unitCode ? unitMapByCode.get(c.unitCode.trim().toUpperCase()) : null)
      const fl = getNormalizedFloor(unit?.floorLevel, c.unitCode)
      if (fl) floorSet.add(fl)
    })
    return Array.from(floorSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [activeContracts, myUnitsFacility, unitMapById, unitMapByCode])

  useEffect(() => {
    if (myUnitsFloor !== 'all' && !myUnitsFloors.includes(myUnitsFloor)) {
      setMyUnitsFloor('all')
    }
  }, [myUnitsFloor, myUnitsFloors])

  const filteredActiveContracts = useMemo(() => {
    return activeContracts.filter(c => {
      if (!matchesFacility(c.facilityId, c.facilityName, myUnitsFacility)) return false

      const unit = (c.storageUnitId ? unitMapById.get(c.storageUnitId) : null) || (c.unitCode ? unitMapByCode.get(c.unitCode.trim().toUpperCase()) : null)
      const fl = getNormalizedFloor(unit?.floorLevel, c.unitCode)
      if (myUnitsFloor !== 'all' && fl !== myUnitsFloor) return false

      const area = unit?.areaSqMeters
      if (!matchesSize(area, myUnitsSize)) return false

      if (myUnitsSearchTerm.trim()) {
        const q = myUnitsSearchTerm.toLowerCase().trim()
        const matchUnit = c.unitCode?.toLowerCase().includes(q)
        const matchContract = c.contractCode?.toLowerCase().includes(q)
        const matchFac = c.facilityName?.toLowerCase().includes(q)
        const matchType = unit?.unitTypeName?.toLowerCase().includes(q)
        if (!matchUnit && !matchContract && !matchFac && !matchType) return false
      }
      return true
    })
  }, [activeContracts, myUnitsFacility, myUnitsFloor, myUnitsSize, myUnitsSearchTerm, unitMapById, unitMapByCode])

  // 2. Tab "Đơn đặt chỗ" (Bookings) Filter States & Calculations
  const [bookingFacility, setBookingFacility] = useState('all')
  const [bookingFloor, setBookingFloor] = useState('all')
  const [bookingSize, setBookingSize] = useState('all')

  const bookingsFacilities = useMemo(() => {
    const map = new Map<string, string>()
    customerBookings.forEach(b => {
      const name = b.facilityName?.trim() || 'Cơ sở trực thuộc'
      const key = b.facilityId || name
      if (!map.has(key)) map.set(key, name)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [customerBookings])

  const bookingsFloors = useMemo(() => {
    const floorSet = new Set<string>()
    customerBookings.forEach(b => {
      if (!matchesFacility(b.facilityId, b.facilityName, bookingFacility)) return
      const unit = (b.storageUnitId ? unitMapById.get(b.storageUnitId) : null) || (b.unitCode ? unitMapByCode.get(b.unitCode.trim().toUpperCase()) : null)
      const fl = getNormalizedFloor(b.floorLevel || unit?.floorLevel, b.unitCode)
      if (fl) floorSet.add(fl)
    })
    return Array.from(floorSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [customerBookings, bookingFacility, unitMapById, unitMapByCode])

  useEffect(() => {
    if (bookingFloor !== 'all' && !bookingsFloors.includes(bookingFloor)) {
      setBookingFloor('all')
    }
  }, [bookingFloor, bookingsFloors])

  const filteredCustomerBookings = useMemo(() => {
    return customerBookings.filter(b => {
      if (bookingStatusFilter !== 'ALL') {
        if (bookingStatusFilter === 'PENDING_SIGNATURE') {
          const info = getBookingNoticeInfo(b)
          const isPendingSign = info.scenario === 'PAID_UNSIGNED'
          if (!isPendingSign) return false
        } else if (b.status !== bookingStatusFilter) {
          return false
        }
      }

      if (!matchesFacility(b.facilityId, b.facilityName, bookingFacility)) return false

      const unit = (b.storageUnitId ? unitMapById.get(b.storageUnitId) : null) || (b.unitCode ? unitMapByCode.get(b.unitCode.trim().toUpperCase()) : null)
      const fl = getNormalizedFloor(b.floorLevel || unit?.floorLevel, b.unitCode)
      if (bookingFloor !== 'all' && fl !== bookingFloor) return false

      const area = unit?.areaSqMeters
      if (!matchesSize(area, bookingSize)) return false

      if (bookingSearchTerm.trim()) {
        const q = bookingSearchTerm.toLowerCase().trim()
        const codeMatch = b.bookingCode?.toLowerCase().includes(q)
        const unitMatch = b.unitCode?.toLowerCase().includes(q)
        const facMatch = b.facilityName?.toLowerCase().includes(q)
        const phoneMatch = b.customerPhone?.toLowerCase().includes(q)
        const pinMatch = b.accessPin?.toLowerCase().includes(q) || b.accessCode?.toLowerCase().includes(q)
        if (!codeMatch && !unitMatch && !facMatch && !phoneMatch && !pinMatch) return false
      }
      return true
    })
  }, [customerBookings, bookingStatusFilter, bookingFacility, bookingFloor, bookingSize, bookingSearchTerm, unitMapById, unitMapByCode, getBookingNoticeInfo])

  // 3. Tab "Hợp đồng & hóa đơn" (Contracts) Filter States & Calculations
  const [contractsSearchTerm, setContractsSearchTerm] = useState('')
  const [contractsFacility, setContractsFacility] = useState('all')
  const [contractsFloor, setContractsFloor] = useState('all')
  const [contractsSize, setContractsSize] = useState('all')

  const contractsFacilities = useMemo(() => {
    const map = new Map<string, string>()
    contracts.forEach(c => {
      const name = c.facilityName?.trim() || 'Cơ sở trực thuộc'
      const key = c.facilityId || name
      if (!map.has(key)) map.set(key, name)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [contracts])

  const contractsFloors = useMemo(() => {
    const floorSet = new Set<string>()
    contracts.forEach(c => {
      if (!matchesFacility(c.facilityId, c.facilityName, contractsFacility)) return
      const unit = (c.storageUnitId ? unitMapById.get(c.storageUnitId) : null) || (c.unitCode ? unitMapByCode.get(c.unitCode.trim().toUpperCase()) : null)
      const fl = getNormalizedFloor(unit?.floorLevel, c.unitCode)
      if (fl) floorSet.add(fl)
    })
    return Array.from(floorSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [contracts, contractsFacility, unitMapById, unitMapByCode])

  useEffect(() => {
    if (contractsFloor !== 'all' && !contractsFloors.includes(contractsFloor)) {
      setContractsFloor('all')
    }
  }, [contractsFloor, contractsFloors])

  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      if (!matchesFacility(c.facilityId, c.facilityName, contractsFacility)) return false

      const unit = (c.storageUnitId ? unitMapById.get(c.storageUnitId) : null) || (c.unitCode ? unitMapByCode.get(c.unitCode.trim().toUpperCase()) : null)
      const fl = getNormalizedFloor(unit?.floorLevel, c.unitCode)
      if (contractsFloor !== 'all' && fl !== contractsFloor) return false

      const area = unit?.areaSqMeters
      if (!matchesSize(area, contractsSize)) return false

      if (contractsSearchTerm.trim()) {
        const q = contractsSearchTerm.toLowerCase().trim()
        const matchCode = c.contractCode?.toLowerCase().includes(q)
        const matchUnit = c.unitCode?.toLowerCase().includes(q)
        const matchFac = c.facilityName?.toLowerCase().includes(q)
        const matchStatus = c.status?.toLowerCase().includes(q)
        if (!matchCode && !matchUnit && !matchFac && !matchStatus) return false
      }
      return true
    })
  }, [contracts, contractsFacility, contractsFloor, contractsSize, contractsSearchTerm, unitMapById, unitMapByCode])

  // 4. Tab "Hỗ trợ & sự cố" (Support) Filter States & Calculations
  const [ticketFacility, setTicketFacility] = useState('all')
  const [ticketFloor, setTicketFloor] = useState('all')
  const [ticketSize, setTicketSize] = useState('all')
  const [ticketFormFacilityId, setTicketFormFacilityId] = useState<string>('')

  // Chỉ hiển thị cơ sở nào đang có kho với status là đang hoạt động (ACTIVE hoặc OVERDUE)
  const supportFacilities = useMemo(() => {
    const map = new Map<string, string>()
    activeContracts.forEach(c => {
      const name = c.facilityName?.trim() || 'Cơ sở trực thuộc'
      const key = c.facilityId || name
      if (!map.has(key)) map.set(key, name)
    })
    customerBookings.filter(b => b.status === 'ACTIVE').forEach(b => {
      const name = b.facilityName?.trim()
      const key = b.facilityId || name
      if (name && key && !map.has(key)) map.set(key, name)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [activeContracts, customerBookings])

  useEffect(() => {
    if (supportFacilities.length > 0) {
      if (!ticketFormFacilityId || !supportFacilities.some(f => f.id === ticketFormFacilityId)) {
        setTicketFormFacilityId(supportFacilities[0].id)
      }
    } else {
      setTicketFormFacilityId('')
    }
  }, [supportFacilities, ticketFormFacilityId])

  const availableActiveUnitsForTicket = useMemo(() => {
    if (!ticketFormFacilityId) return activeContracts
    return activeContracts.filter(c => c.facilityId === ticketFormFacilityId || c.facilityName === ticketFormFacilityId)
  }, [activeContracts, ticketFormFacilityId])

  useEffect(() => {
    if (availableActiveUnitsForTicket.length > 0) {
      if (!ticketUnit || !availableActiveUnitsForTicket.some(c => c.unitCode === ticketUnit)) {
        setTicketUnit(availableActiveUnitsForTicket[0].unitCode)
      }
    } else {
      setTicketUnit('')
    }
  }, [availableActiveUnitsForTicket, ticketUnit])

  const supportFloors = useMemo(() => {
    const floorSet = new Set<string>()
    customerTickets.forEach(t => {
      const unit = t.unitCode ? unitMapByCode.get(t.unitCode.trim().toUpperCase()) : null
      const facKey = t.facilityId || unit?.facilityId || t.facilityName || unit?.facilityName
      if (ticketFacility !== 'all' && facKey !== ticketFacility && t.facilityName !== ticketFacility) return
      const fl = getNormalizedFloor(unit?.floorLevel, t.unitCode)
      if (fl) floorSet.add(fl)
    })
    return Array.from(floorSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [customerTickets, ticketFacility, unitMapByCode])

  useEffect(() => {
    if (ticketFloor !== 'all' && !supportFloors.includes(ticketFloor)) {
      setTicketFloor('all')
    }
  }, [ticketFloor, supportFloors])

  const filteredCustomerTickets = useMemo(() => {
    return customerTickets.filter(t => {
      if (ticketStatusFilter !== 'ALL') {
        if (ticketStatusFilter === 'PENDING') {
          if (t.status !== 'OPEN' && t.status !== 'PENDING') return false
        } else if (ticketStatusFilter === 'RESOLVED') {
          if (t.status !== 'RESOLVED' && t.status !== 'CLOSED') return false
        } else if (t.status !== ticketStatusFilter) {
          return false
        }
      }

      const unit = t.unitCode ? unitMapByCode.get(t.unitCode.trim().toUpperCase()) : null
      const facKey = t.facilityId || unit?.facilityId || t.facilityName || unit?.facilityName
      if (ticketFacility !== 'all' && facKey !== ticketFacility && t.facilityName !== ticketFacility && unit?.facilityName !== ticketFacility) {
        return false
      }

      const fl = getNormalizedFloor(unit?.floorLevel, t.unitCode)
      if (ticketFloor !== 'all' && fl !== ticketFloor) return false

      const area = unit?.areaSqMeters
      if (!matchesSize(area, ticketSize)) return false

      if (ticketSearchTerm.trim()) {
        const q = ticketSearchTerm.toLowerCase().trim()
        const codeMatch = t.ticketCode?.toLowerCase().includes(q) || t.ticketNumber?.toLowerCase().includes(q)
        const unitMatch = t.unitCode?.toLowerCase().includes(q)
        const titleMatch = t.title?.toLowerCase().includes(q)
        const descMatch = t.description?.toLowerCase().includes(q)
        const catMatch = t.category?.toLowerCase().includes(q)
        const facMatch = t.facilityName?.toLowerCase().includes(q) || unit?.facilityName?.toLowerCase().includes(q)
        if (!codeMatch && !unitMatch && !titleMatch && !descMatch && !catMatch && !facMatch) return false
      }

      return true
    })
  }, [customerTickets, ticketStatusFilter, ticketFacility, ticketFloor, ticketSize, ticketSearchTerm, unitMapByCode])

  // Filter explore state (Tab Tìm kiếm kho mới)
  const [filterFacility, setFilterFacility] = useState('all')
  const [filterFloor, setFilterFloor] = useState('all')
  const [filterSize, setFilterSize] = useState('all')

  const availableFloors = useMemo(() => {
    const floors = new Set<string>()
    availableUnits.forEach(u => {
      if (filterFacility !== 'all' && u.facilityId !== filterFacility) return
      const fl = extractFloor(u.floorLevel)
      if (fl) floors.add(fl)
    })
    return Array.from(floors).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [availableUnits, filterFacility])

  const handleOpenPolicyModal = (tab: PolicyTab = 'cancellation', facility?: { id?: string; name?: string }) => {
    setCustomerPolicyModalTab(tab)
    if (facility) {
      setCustomerPolicyFacility(facility)
    } else if (filterFacility !== 'all') {
      const matched = facilities.find(f => f.id === filterFacility)
      setCustomerPolicyFacility(matched ? { id: matched.id, name: matched.name } : null)
    } else {
      setCustomerPolicyFacility(facilities[0] ? { id: facilities[0].id, name: facilities[0].name } : null)
    }
    setIsCustomerPolicyModalOpen(true)
  }

  const handleCopy = (id: string, pin: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(pin)
    }
    setCopiedPin(id)
    setTimeout(() => setCopiedPin(null), 2000)
  }

  const handleReopenCustomerTicket = async () => {
    if (!reopenModalTicket || !reopenReasonText.trim()) return
    setIsProcessingTicketAction(true)
    try {
      await supportTicketService.reopenTicket(reopenModalTicket.id, reopenReasonText.trim())
      setReopenModalTicket(null)
      setReopenReasonText('')
      await fetchCustomerTickets()
    } catch (err: any) {
      console.error('Failed to reopen ticket:', err)
      alert(err?.response?.data?.message || err?.message || 'Không thể yêu cầu xử lý lại')
    } finally {
      setIsProcessingTicketAction(false)
    }
  }

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (activeContracts.length === 0) {
      setTicketError('Quý khách chưa có kho nào đang ở trạng thái hoạt động (đã check-in). Chỉ các cơ sở có kho đang hoạt động mới có thể gửi báo cáo sự cố.')
      return
    }
    if (ticketType === 'other' && (!ticketContent || !ticketContent.trim())) {
      setTicketError('Vui lòng ghi rõ mô tả chi tiết vấn đề bạn cần hỗ trợ.')
      return
    }
    setIsSubmittingTicket(true)
    setTicketError(null)
    try {
      const activeUnit = activeContracts.find(c => c.unitCode === ticketUnit)
      if (!activeUnit) {
        setTicketError('Vui lòng chọn ngăn kho đang hoạt động để gửi yêu cầu hỗ trợ.')
        setIsSubmittingTicket(false)
        return
      }
      
      let category = 'OTHER'
      let typeLabel = 'Khác'
      if (ticketType === 'lock') {
        category = 'LOCK_ISSUE'
        typeLabel = 'Khóa & Cửa'
      } else if (ticketType === 'pin') {
        category = 'PIN_CODE'
        typeLabel = 'Mã PIN'
      } else if (ticketType === 'access') {
        category = 'ACCESS_ISSUE'
        typeLabel = 'Truy cập kho'
      } else if (ticketType === 'cleanliness') {
        category = 'CLEANLINESS_PEST'
        typeLabel = 'Vệ sinh'
      } else if (ticketType === 'climate') {
        category = 'CLIMATE_TEMP'
        typeLabel = 'Nhiệt độ/Độ ẩm'
      } else if (ticketType === 'facility_damage') {
        category = 'FACILITY_DAMAGE'
        typeLabel = 'Hư hỏng thiết bị'
      } else if (ticketType === 'billing') {
        category = 'PAYMENT_ISSUE'
        typeLabel = 'Thanh toán'
      }

      const title = `Sự cố kho #${activeUnit.unitCode} (${typeLabel}) - ${activeUnit.facilityName || 'Boxora'}`

      await supportTicketService.createTicket({
        customerId: user?.id,
        bookingId: activeUnit.bookingId || (activeUnit.id?.length === 36 ? activeUnit.id : undefined),
        facilityId: activeUnit.facilityId,
        category: category,
        title: title,
        description: ticketContent.trim(),
        priority: ticketPriority || 'MEDIUM'
      })
      await fetchCustomerTickets()
      setTicketSubmitted(true)
      setTimeout(() => {
        setTicketSubmitted(false)
        setTicketContent('')
        setTicketType('lock')
      }, 3500)
    } catch (err: any) {
      console.error('Support ticket creation failed:', err)
      const msg = err?.response?.data?.message || err?.message || 'Gửi yêu cầu hỗ trợ thất bại. Vui lòng thử lại sau.'
      setTicketError(msg)
      setTicketSubmitted(false)
      setTimeout(() => {
        setTicketError(null)
      }, 6000)
    } finally {
      setIsSubmittingTicket(false)
    }
  }

  const formatDisplayDateTime = (d?: string) => {
    if (!d) return '—'
    try {
      const date = new Date(d)
      if (isNaN(date.getTime())) return d
      return date.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch {
      return d
    }
  }

  const getTicketCategoryMeta = (cat?: string) => {
    switch (cat?.toUpperCase()) {
      case 'LOCK_ISSUE':
      case 'LOCK':
        return { label: 'Sự cố khóa & cửa cuốn', icon: 'lock_reset', color: 'bg-rose-50 text-rose-700 border-rose-200' }
      case 'PIN_CODE':
      case 'PIN':
        return { label: 'Cấp lại mã PIN', icon: 'pin', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
      case 'ACCESS_ISSUE':
        return { label: 'Truy cập kho / Barrier', icon: 'door_front', color: 'bg-blue-50 text-blue-700 border-blue-200' }
      case 'CLEANLINESS_PEST':
        return { label: 'Vệ sinh / Côn trùng', icon: 'pest_control', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
      case 'CLIMATE_TEMP':
      case 'CLIMATE':
        return { label: 'Nhiệt độ / Độ ẩm', icon: 'thermostat', color: 'bg-teal-50 text-teal-700 border-teal-200' }
      case 'PAYMENT_ISSUE':
      case 'BILLING':
        return { label: 'Thanh toán & Hóa đơn', icon: 'receipt_long', color: 'bg-amber-50 text-amber-700 border-amber-200' }
      case 'FACILITY_DAMAGE':
        return { label: 'Cơ sở vật chất', icon: 'build', color: 'bg-orange-50 text-orange-700 border-orange-200' }
      case 'DELEGATE':
        return { label: 'Ủy quyền mở kho', icon: 'badge', color: 'bg-purple-50 text-purple-700 border-purple-200' }
      default:
        return { label: 'Khác', icon: 'help_center', color: 'bg-slate-100 text-slate-700 border-slate-200' }
    }
  }

  const getTicketStatusMeta = (status?: string) => {
    switch (status?.toUpperCase()) {
      case 'CLOSED':
        return { label: 'Đã đóng hoàn tất', badge: 'bg-slate-100 text-slate-700 border-slate-300', icon: 'task_alt' }
      case 'RESOLVED':
        return { label: 'Chờ khách xác nhận', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: 'check_circle' }
      case 'REOPENED':
        return { label: 'Đang yêu cầu xử lý lại', badge: 'bg-rose-100 text-rose-800 border-rose-300', icon: 'replay' }
      case 'IN_PROGRESS':
        return { label: 'Đang xử lý', badge: 'bg-blue-100 text-blue-800 border-blue-200', icon: 'pending' }
      case 'OPEN':
      case 'PENDING':
      default:
        return { label: 'Chờ tiếp nhận', badge: 'bg-amber-100 text-amber-800 border-amber-200', icon: 'schedule' }
    }
  }

  const getTicketPriorityMeta = (priority?: string) => {
    switch (priority?.toUpperCase()) {
      case 'URGENT':
      case 'HIGH':
        return { label: 'Khẩn cấp', badge: 'bg-rose-100 text-rose-800 border-rose-200' }
      case 'MEDIUM':
        return { label: 'Tiêu chuẩn', badge: 'bg-sky-50 text-sky-700 border-sky-200' }
      case 'LOW':
      default:
        return { label: 'Thấp', badge: 'bg-slate-100 text-slate-600 border-slate-200' }
    }
  }

  const formatDisplayDate = (d?: string) => {
    if (!d) return '—'
    if (d.includes('/')) return d
    const parts = d.split('T')[0].split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return d
  }

  const totalRenewEstimate = useMemo(() => {
    if (!renewModalData) return 0
    return Math.max(0, Math.round((renewModalData.monthlyPrice || 0) * (renewMonths || 1)))
  }, [renewModalData, renewMonths])

  const openRenewModal = (c: RentalContract) => {
    const numFee = Number(c.monthlyFee || 0) || 1500000
    setRenewModalData({
      contractId: c.id,
      contractCode: c.contractCode || `CTR-2026-${c.id.slice(0, 5)}`,
      customerName: c.customerName || user?.fullName || 'Khách hàng Boxora',
      facilityName: c.facilityName || 'Boxora Facility',
      unitCode: c.unitCode,
      startDate: c.startDate || '2026-10-01',
      endDate: c.endDate || '2026-12-31',
      monthlyPrice: numFee,
    })
    setRenewMonths(3)
    setRenewNotes('')
    setRenewSuccess(false)
    setCreatedRenewal(null)
    setRenewError(null)
    setRenewMethod('ONLINE')
    const defDate = new Date()
    defDate.setDate(defDate.getDate() + 1)
    setRenewAppointmentDate(defDate.toISOString().split('T')[0])
  }

  const openPinChangeModal = (unitCode: string, targetId: string, currentPin: string) => {
    setPinChangeUnit({ unitCode, targetId, currentPin })
    setNewPin('')
    setConfirmPin('')
    setPinChangeError('')
    setPinChangeSuccess(false)
  }

  const handleGenerateRandomPin = () => {
    const rand = Math.floor(100000 + Math.random() * 900000).toString()
    setNewPin(rand)
    setConfirmPin(rand)
    setPinChangeError('')
  }

  const handlePinChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pinChangeUnit) return
    if (!/^\d{6}$/.test(newPin)) {
      setPinChangeError('Mã PIN mới phải bao gồm đúng 6 chữ số.')
      return
    }
    if (newPin !== confirmPin) {
      setPinChangeError('Xác nhận mã PIN mới không trùng khớp.')
      return
    }
    setPinChangeError('')
    setIsSubmittingPinChange(true)
    try {
      await bookingService.updatePin(pinChangeUnit.targetId, newPin)
      setLoadedPins(prev => ({ ...prev, [pinChangeUnit.unitCode]: newPin }))
      setPinChangeSuccess(true)
    } catch (e1: any) {
      try {
        await bookingService.updatePinByUnit(pinChangeUnit.unitCode, newPin)
        setLoadedPins(prev => ({ ...prev, [pinChangeUnit.unitCode]: newPin }))
        setPinChangeSuccess(true)
      } catch (e2: any) {
        console.warn('Update PIN API error:', e2)
        const msg = e2?.response?.data?.message || e1?.response?.data?.message || 'Cập nhật mã PIN thất bại. Vui lòng thử lại.'
        setPinChangeError(msg)
      }
    } finally {
      setIsSubmittingPinChange(false)
    }
  }

  const handleConfirmRenewal = async () => {
    if (!renewModalData) return
    setIsSubmittingRenewal(true)
    setRenewError(null)

    const token = localStorage.getItem('boxora_access_token')
    if (!token) {
      setRenewError('Phiên đăng nhập đã hết hạn hoặc không tồn tại. Vui lòng đăng nhập lại để tiếp tục gửi yêu cầu.')
      setIsSubmittingRenewal(false)
      return
    }

    try {
      const targetContract = contracts.find(c => c.id === renewModalData.contractId || c.unitCode === renewModalData.unitCode)
      const targetId = targetContract ? targetContract.id : renewModalData.contractId

      const res = await contractService.requestRenewal(targetId, renewMonths, renewNotes.trim() || undefined)
      setCreatedRenewal(res)
      setRenewSuccess(true)
      await fetchContracts()
      await fetchMyRenewals()
      await fetchCustomerPayments()
    } catch (err: any) {
      console.warn('Renewal API error:', err)
      setRenewSuccess(false)
      let msg = err?.response?.data?.message
      if (!msg && err?.response?.data?.errors) {
        const errorValues = Object.values(err.response.data.errors)
        if (errorValues.length > 0) {
          msg = errorValues.join(', ')
        }
      }
      if (!msg) {
        if (err?.response?.status === 401) {
          msg = 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại để tiếp tục gửi yêu cầu.'
        } else if (err?.response?.status === 403) {
          msg = 'Tài khoản hiện tại chưa được cấp quyền gửi yêu cầu gia hạn cho hợp đồng này.'
        } else {
          msg = err?.message || 'Không thể gửi yêu cầu gia hạn hợp đồng. Vui lòng kiểm tra lại điều kiện hợp đồng.'
        }
      }
      setRenewError(msg)
    } finally {
      setIsSubmittingRenewal(false)
    }
  }

  const handlePayRenewalVNPay = async (renewal: ContractRenewal) => {
    setIsPayingRenewal(true)
    try {
      const res = await contractService.createRenewalPayment(renewal.id)
      if (res?.paymentUrl) {
        window.location.href = res.paymentUrl
      }
    } catch (err: any) {
      console.error('Lỗi khi mở cổng thanh toán VNPay:', err)
      const msg = err?.response?.data?.message || err?.message || 'Không thể khởi tạo thanh toán VNPay cho phụ lục này.'
      alert(msg)
    } finally {
      setIsPayingRenewal(false)
    }
  }

  const handleCancelRenewal = async (renewalId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy yêu cầu gia hạn này không?')) return
    try {
      await contractService.cancelRenewal(renewalId)
      await fetchMyRenewals()
      await fetchContracts()
    } catch (err: any) {
      console.error('Lỗi khi hủy yêu cầu gia hạn:', err)
      const msg = err?.response?.data?.message || err?.message || 'Không thể hủy yêu cầu gia hạn.'
      alert(msg)
    }
  }

  const handleReactivateRenewal = async (renewalId: string) => {
    try {
      await contractService.reactivateRenewal(renewalId)
      alert('Đã kích hoạt duyệt lại yêu cầu gia hạn thành công! Yêu cầu đã được chuyển tới Quản lý cơ sở để xét duyệt lại.')
      await fetchMyRenewals()
      await fetchContracts()
    } catch (err: any) {
      console.error('Lỗi khi kích hoạt duyệt lại:', err)
      const msg = err?.response?.data?.message || err?.message || 'Không thể kích hoạt duyệt lại yêu cầu gia hạn.'
      alert(msg)
    }
  }

  const handleOpenSwitchMethodModal = (renewal: ContractRenewal, targetMode?: 'ONLINE' | 'COUNTER') => {
    const isSigned = !!(renewal.signedAt || renewal.signatureData || renewal.status === 'PENDING_PAYMENT')
    if (isSigned && targetMode === 'COUNTER') {
      alert('Phụ lục gia hạn đã được ký điện tử trực tuyến, bắt buộc hoàn tất thanh toán trực tuyến qua VNPay và không thể đổi sang hình thức trực tiếp tại quầy.')
      return
    }

    setSwitchMethodTarget(renewal)
    const mode = targetMode || (renewal.paymentMethod === 'COUNTER' ? 'ONLINE' : 'COUNTER')
    setSwitchMethodMode(mode)
    const d = new Date()
    d.setDate(d.getDate() + 1)
    setSwitchAppointmentDate(renewal.counterAppointmentDate ? renewal.counterAppointmentDate.slice(0, 10) : d.toISOString().split('T')[0])
    setSwitchAppointmentTime(renewal.counterAppointmentTime || '09:00')
    setSwitchMethodNotes('')
    setSwitchMethodError(null)
  }

  const handleSwitchMethodSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!switchMethodTarget) return

    const isSigned = !!(switchMethodTarget.signedAt || switchMethodTarget.signatureData || switchMethodTarget.status === 'PENDING_PAYMENT')
    if (isSigned && switchMethodMode === 'COUNTER') {
      setSwitchMethodError('Phụ lục gia hạn đã được ký điện tử trực tuyến, bắt buộc hoàn tất thanh toán trực tuyến qua cổng VNPay.')
      return
    }

    if (switchMethodMode === 'COUNTER') {
      if (!switchAppointmentDate) {
        setSwitchMethodError('Vui lòng chọn ngày hẹn đến cơ sở gia hạn.')
        return
      }
      const todayStr = new Date().toISOString().split('T')[0]
      if (switchAppointmentDate < todayStr) {
        setSwitchMethodError('Ngày hẹn đến cơ sở không thể là ngày trong quá khứ.')
        return
      }
      if (!switchAppointmentTime) {
        setSwitchMethodError('Vui lòng chọn giờ hẹn check-in đến cơ sở.')
        return
      }
    }

    setIsSubmittingSwitchMethod(true)
    setSwitchMethodError(null)
    try {
      await contractService.switchRenewalMethod(switchMethodTarget.id, {
        method: switchMethodMode,
        appointmentDate: switchMethodMode === 'COUNTER' ? switchAppointmentDate : undefined,
        appointmentTime: switchMethodMode === 'COUNTER' ? switchAppointmentTime : undefined,
        notes: switchMethodNotes.trim() || undefined,
      })
      await fetchMyRenewals()
      await fetchContracts()
      setSwitchMethodTarget(null)
    } catch (err: any) {
      console.error('Lỗi khi đổi phương thức gia hạn:', err)
      const msg = err?.response?.data?.message || err?.message || 'Không thể thay đổi phương thức gia hạn.'
      setSwitchMethodError(msg)
    } finally {
      setIsSubmittingSwitchMethod(false)
    }
  }

  const handlePayBookingVNPay = (b: Booking) => {
    const info = getBookingNoticeInfo(b)
    if (info.isPaid) {
      if (!info.isContractSigned) {
        void handleSignContractForBooking(b, info.matchingContract)
      }
      return
    }
    setRequestToPay(b)
  }

  const handleOpenRescheduleModal = (booking: Booking) => {
    setRescheduleBookingTarget(booking)
    const baseDate = booking.expectedCheckInAt ? booking.expectedCheckInAt.slice(0, 10) : booking.startDate
    setRescheduleNewDate(baseDate || new Date().toISOString().split('T')[0])
    const baseTime = booking.expectedCheckInAt ? booking.expectedCheckInAt.slice(11, 16) : (booking.checkInTime || '09:00')
    setRescheduleNewTime(baseTime)
    setRescheduleReason('')
    setRescheduleError(null)
    setRescheduleSuccess(false)
  }

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rescheduleBookingTarget) return
    setIsSubmittingReschedule(true)
    setRescheduleError(null)
    try {
      const newExpectedCheckInAt = `${rescheduleNewDate}T${rescheduleNewTime || '09:00'}:00`
      await bookingService.rescheduleBooking(rescheduleBookingTarget.id, {
        newStartDate: rescheduleNewDate,
        newCheckInTime: rescheduleNewTime || '09:00',
        newExpectedCheckInAt,
        reason: rescheduleReason.trim() || undefined,
      })
      setRescheduleSuccess(true)
      await fetchCustomerBookings()
    } catch (err: any) {
      console.error('Reschedule booking error:', err)
      setRescheduleError(err?.response?.data?.message || err?.message || 'Không thể đổi lịch hẹn. Kho có thể không khả dụng trong thời gian mới.')
    } finally {
      setIsSubmittingReschedule(false)
    }
  }

  const handleSignContractNow = (contract: RentalContract) => {
    // Open DocuSeal Simulation modal directly for immediate electronic signing
    setContractForDocuSealModal(contract)
  }

  const handleSignContractForBooking = async (b: Booking, existingContract?: RentalContract) => {
    if (existingContract) {
      handleSignContractNow(existingContract)
      return
    }
    try {
      const res = await contractService.getMyContracts({ size: 50 })
      const list = Array.isArray(res?.content) ? res.content : contracts
      if (Array.isArray(res?.content)) {
        setContracts(res.content)
      }
      const found =
        list.find(c => Boolean(c.bookingId) && (c.bookingId === b.id || c.bookingId === b.bookingCode)) ||
        list.find(
          c =>
            !c.bookingId &&
            Boolean(c.unitCode) &&
            c.unitCode === b.unitCode &&
            c.status !== 'TERMINATED' &&
            c.status !== 'EXPIRED'
        )
      if (found) {
        handleSignContractNow(found)
      }
    } catch (err) {
      console.warn('Could not load contract for booking signing:', err)
    }
  }

  const handleContractSignedSuccess = async () => {
    setContractForDocuSealModal(null)
    setSelectedContractForModal(null)
    await Promise.all([
      fetchContracts(),
      fetchCustomerBookings(),
      fetchAvailableUnits(),
    ])
  }

  const handleOpenDocuSeal = async (contractId: string) => {
    const target = contracts.find(c => c.id === contractId) || selectedContractForModal
    setFetchingSigningUrl(true)
    try {
      const url = await contractService.getSigningUrl(contractId)
      // Check if it's a real external DocuSeal url and NOT the dead dummy boxora.vn domain
      if (url && (url.includes('docuseal.com') || url.includes('/portal/customer')) && !url.includes('boxora.vn')) {
        if (url.includes('mockSignContractId=') && target) {
          setContractForDocuSealModal(target)
          return
        }
        window.open(url, '_blank')
      } else {
        // Fallback: Display the full in-app contract document modal
        if (target) {
          setSelectedContractForModal(target)
        }
      }
    } catch (err) {
      console.warn('DocuSeal signing URL fallback to in-app document viewer:', err)
      if (target) {
        setSelectedContractForModal(target)
      }
    } finally {
      setFetchingSigningUrl(false)
    }
  }

  const handleShareSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setShareSuccess(true)
    setTimeout(() => {
      setShareSuccess(false)
      setShareModalUnit(null)
      setSharePhone('')
    }, 2000)
  }

  return (
    <div className="flex flex-col gap-6 text-left max-w-7xl mx-auto pb-12">
      
      {/* 1. Header Greeting & Quick Stats */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-1">
              <span className="text-[11px] font-semibold text-slate-500">Hệ thống quản lý kho tự quản Boxora</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Xin chào, {user?.fullName || user?.username || 'Quý khách'}
            </h1>
            <p className="text-xs md:text-sm text-slate-600 mt-1">
              Quản lý kho đang thuê, kiểm tra mã PIN và theo dõi trạng thái khóa bảo mật.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-center shrink-0">
            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={isRefreshingData}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-xs border border-slate-200 hover:border-blue-300 transition-all shadow-2xs hover:shadow-sm cursor-pointer disabled:opacity-60 group"
              title="Tải lại toàn bộ dữ liệu kho, hợp đồng, lịch sử gia hạn và thanh toán mới nhất"
            >
              <span className={`material-symbols-outlined text-[19px] text-blue-600 group-hover:rotate-180 transition-transform duration-300 ${isRefreshingData ? 'animate-spin' : ''}`}>sync</span>
              <span>{isRefreshingData ? 'Đang làm mới...' : 'Làm mới dữ liệu'}</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stitch-card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <span className="material-symbols-outlined text-[24px]">garage_door</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold text-slate-500">Kho đang thuê</span>
              <span className="text-xl font-bold text-slate-900 mt-0.5">{activeContracts.length} kho đang hoạt động</span>
            </div>
          </div>

          <div 
            onClick={() => handleTabChange('bookings')}
            className="stitch-card p-5 flex items-center gap-4 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-100 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[24px]">pending_actions</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                Đơn đặt chỗ
                {pendingReservations.length > 0 && <span className="pulsing-dot bg-amber-500"></span>}
              </span>
              <span className="text-xl font-bold text-slate-900 mt-0.5">
                {pendingReservations.length} chờ nhận kho
              </span>
              <span className="text-xs text-slate-500 truncate">
                {customerBookings.length > 0 ? `${customerBookings.length} đơn trong lịch sử` : 'Chưa có đơn đặt chỗ'}
              </span>
            </div>
          </div>

          <div className="stitch-card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
              <span className="material-symbols-outlined text-[24px]">lock</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                Trạng thái khóa
                <span className="pulsing-dot bg-emerald-500"></span>
              </span>
              <span className="text-xl font-bold text-emerald-700 mt-0.5">Đã khóa</span>
              <span className="text-xs text-slate-500 truncate">Bảo mật mã PIN điện tử</span>
            </div>
          </div>

          <div className="stitch-card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-100">
              <span className="material-symbols-outlined text-[24px]">event_available</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold text-slate-500">Hợp đồng gần nhất hết hạn</span>
              <span className="text-xl font-bold text-slate-900 mt-0.5">{nearestEndDate}</span>
              <span className="text-xs text-amber-700 font-semibold truncate">
                {nearestEndDate !== '--' ? `Ngày hết hạn: ${nearestEndDate}` : 'Không có hợp đồng'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Tab Buttons & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl w-fit border border-slate-200 shadow-sm overflow-x-auto max-w-full">
          <button
            onClick={() => handleTabChange('my-units')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'my-units'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Kho của tôi</span>
            <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
              {activeContracts.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('bookings')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'bookings'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Đơn đặt chỗ</span>
            <div className="flex items-center gap-1">
              <span className={`px-1.5 py-0.5 rounded-full text-white text-[10px] font-bold ${
                pendingReservations.length > 0 ? 'bg-amber-600' : 'bg-slate-700'
              }`}>
                {customerBookings.length}
              </span>
              {pendingReservations.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              )}
            </div>
          </button>

          <button
            onClick={() => handleTabChange('explore')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'explore'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Tìm &amp; thuê kho mới</span>
          </button>

          <button
            onClick={() => handleTabChange('contracts')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'contracts'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Hợp đồng &amp; hóa đơn</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-700 text-white text-[10px] font-bold">
              {contracts.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('support')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'support'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Hỗ trợ &amp; sự cố</span>
            {customerTickets.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'support' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'
              }`}>
                {customerTickets.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={isRefreshingData}
            className="px-3.5 py-2 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 hover:border-blue-300 shadow-2xs whitespace-nowrap shrink-0 disabled:opacity-60"
            title="Làm mới dữ liệu toàn bộ dashboard"
          >
            <span className={`material-symbols-outlined text-[17px] text-blue-600 ${isRefreshingData ? 'animate-spin' : ''}`}>sync</span>
            <span>{isRefreshingData ? 'Đang tải...' : 'Làm mới'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenPolicyModal('cancellation')}
            className="px-3.5 py-2 bg-white hover:bg-cyan-50/80 text-slate-700 hover:text-cyan-700 text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer border border-slate-200 hover:border-cyan-300 shadow-2xs whitespace-nowrap shrink-0"
            title="Xem quy định đặt cọc, hủy giữ chỗ và thời gian hoàn tiền cọc"
          >
            <span className="material-symbols-outlined text-[18px] text-cyan-600">policy</span>
            <span>Chính sách đặt cọc &amp; hủy</span>
          </button>
        </div>
      </div>

      {/* 3. TAB 1: KHO CỦA TÔI ĐANG THUÊ (MY UNITS) */}
      {activeTab === 'my-units' && (
        <div className="flex flex-col gap-6">
          {bookingRequests.length > 0 && (
            <section className="stitch-card p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Yêu cầu thuê kho</h2>
                  <p className="mt-1 text-xs text-slate-500">Trạng thái được cập nhật tự động.</p>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800">{bookingRequests.length} yêu cầu</span>
              </div>
              <div className="space-y-2">
                {bookingRequests.slice(0, 5).map(request => {
                  const fullBooking =
                    customerBookings.find(
                      cb => cb.id === request.id || (cb.bookingCode && cb.bookingCode === request.bookingCode)
                    ) || request
                  const noticeInfo = getBookingNoticeInfo(fullBooking)
                  const needsOnlineProcedure =
                    (fullBooking.status === 'PENDING_PAYMENT' || fullBooking.status === 'CONFIRMED') &&
                    (noticeInfo.scenario === 'UNPAID_IN_PERSON' || noticeInfo.scenario === 'PAID_UNSIGNED')
                  const statusLabel =
                    noticeInfo.scenario === 'PAID_SIGNED'
                      ? 'Đã thanh toán & Ký HĐ'
                      : fullBooking.status === 'CONFIRMED'
                        ? 'Đã xác nhận đặt chỗ'
                        : fullBooking.status === 'PENDING_APPROVAL'
                          ? 'Chờ xử lý'
                          : 'Yêu cầu đã đóng'
                  const statusClass =
                    noticeInfo.scenario === 'PAID_SIGNED'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : fullBooking.status === 'CONFIRMED'
                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                  return (
                    <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                      <div>
                        <p className="text-xs font-bold text-slate-900">Kho #{fullBooking.unitCode} · {fullBooking.facilityName}</p>
                        <p className="mt-1 text-[11px] text-slate-500">Mã yêu cầu {fullBooking.bookingCode} · {fullBooking.rentalMonths} tháng</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {needsOnlineProcedure ? (
                          <a
                            href={`/portal/customer?tab=bookings&booking=${encodeURIComponent(fullBooking.bookingCode || fullBooking.id)}`}
                            onClick={(e) => {
                              e.preventDefault()
                              handleGoToBooking(fullBooking)
                            }}
                            className="rounded-lg bg-cyan-700 px-3 py-2 text-[10px] font-bold text-white hover:bg-cyan-800 transition-colors cursor-pointer inline-flex items-center"
                          >
                            Thanh toán và ký hợp đồng trực tuyến ngay -&gt;
                          </a>
                        ) : (
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClass}`}>{statusLabel}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
          {loadingContracts ? (
            <div className="p-12 text-center text-slate-500 text-xs">Đang tải dữ liệu kho từ hệ thống database...</div>
          ) : activeContracts.length === 0 ? (
            <div className="stitch-card p-10 text-center flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[36px]">warehouse</span>
              </div>
              <div className="max-w-md">
                <h3 className="font-headline text-lg font-bold text-slate-900 mb-1">
                  {pendingReservations.length > 0
                    ? 'Bạn chưa có kho đang kích hoạt hoạt động'
                    : 'Bạn chưa có kho đang thuê nào'}
                </h3>
                <p className="text-xs text-slate-500">
                  {pendingReservations.length > 0
                    ? 'Các phòng kho bạn đã đặt giữ chỗ đang chờ làm thủ tục nhận kho tại quầy. Sau khi bàn giao, kho sẽ hiển thị tại đây cùng PIN/QR lưu trong Boxora. Trạng thái khóa vật lý cần được xác nhận tại cơ sở.'
                    : 'Hãy khám phá hệ thống vị trí kho tự quản của Boxora để tìm kích thước và cơ sở thuận tiện nhất.'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {pendingReservations.length > 0 && (
                  <button
                    onClick={() => handleTabChange('bookings')}
                    className="stitch-btn-secondary text-xs"
                  >
                    <span>Xem Lịch Sử Đặt Chỗ</span>
                  </button>
                )}
                <button
                  onClick={() => handleTabChange('explore')}
                  className="stitch-btn-primary text-xs"
                >
                  <span>Tìm &amp; Thuê Thêm Kho</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Filter & Search Toolbar */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                      search
                    </span>
                    <input
                      type="text"
                      placeholder="Tìm theo mã kho (TD-A101...), hợp đồng, cơ sở, loại kho..."
                      value={myUnitsSearchTerm}
                      onChange={(e) => setMyUnitsSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                    />
                    {myUnitsSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setMyUnitsSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
                        title="Xóa tìm kiếm"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Filter Dropdowns */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Facility */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
                      <span className="material-symbols-outlined text-[16px] text-slate-500">apartment</span>
                      <span className="text-slate-500 font-medium">Cơ sở:</span>
                      <select
                        value={myUnitsFacility}
                        onChange={(e) => setMyUnitsFacility(e.target.value)}
                        className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer max-w-[170px] truncate"
                      >
                        <option value="all">
                          {myUnitsFacilities.length > 1
                            ? `Tất cả cơ sở (${myUnitsFacilities.length})`
                            : myUnitsFacilities[0]?.name || 'Tất cả cơ sở'}
                        </option>
                        {myUnitsFacilities.length > 1 &&
                          myUnitsFacilities.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Floor */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
                      <span className="material-symbols-outlined text-[16px] text-slate-500">layers</span>
                      <span className="text-slate-500 font-medium">Tầng:</span>
                      <select
                        value={myUnitsFloor}
                        onChange={(e) => setMyUnitsFloor(e.target.value)}
                        className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
                      >
                        <option value="all">Tất cả tầng</option>
                        {myUnitsFloors.map((fl) => (
                          <option key={fl} value={fl}>
                            Tầng {fl}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Size */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
                      <span className="material-symbols-outlined text-[16px] text-slate-500">straighten</span>
                      <span className="text-slate-500 font-medium">Kích cỡ:</span>
                      <select
                        value={myUnitsSize}
                        onChange={(e) => setMyUnitsSize(e.target.value)}
                        className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
                      >
                        <option value="all">Tất cả kích cỡ</option>
                        <option value="mini">Kho Mini (≤ 5 m²)</option>
                        <option value="family">Kho Gia Đình (6 - 10 m²)</option>
                        <option value="business">Kho Doanh Nghiệp (&gt; 10 m²)</option>
                      </select>
                    </div>

                    {/* Reset Button */}
                    {(myUnitsSearchTerm || myUnitsFacility !== 'all' || myUnitsFloor !== 'all' || myUnitsSize !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setMyUnitsSearchTerm('')
                          setMyUnitsFacility('all')
                          setMyUnitsFloor('all')
                          setMyUnitsSize('all')
                        }}
                        className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                        title="Đặt lại bộ lọc"
                      >
                        <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                        <span className="hidden sm:inline">Đặt lại</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1 border-t border-slate-100 flex-wrap gap-2">
                  <span>
                    Hiển thị <strong className="text-slate-900 font-bold">{filteredActiveContracts.length}</strong> / {activeContracts.length} kho đang thuê
                  </span>
                  {(myUnitsSearchTerm || myUnitsFacility !== 'all' || myUnitsFloor !== 'all' || myUnitsSize !== 'all') && (
                    <span className="text-blue-600 font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">filter_alt</span>
                      <span>Đang lọc theo tiêu chí</span>
                    </span>
                  )}
                </div>
              </div>

              {filteredActiveContracts.length === 0 ? (
                <div className="stitch-card p-10 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[30px]">search_off</span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">Không tìm thấy kho nào phù hợp</h4>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Không có kho đang thuê nào phù hợp với bộ lọc cơ sở, tầng, kích cỡ hoặc từ khóa tìm kiếm của bạn.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMyUnitsSearchTerm('')
                      setMyUnitsFacility('all')
                      setMyUnitsFloor('all')
                      setMyUnitsSize('all')
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Xóa bộ lọc tìm kiếm
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {filteredActiveContracts.map((c) => {
                const targetId = c.bookingId || c.id
                const pin = loadedPins[c.unitCode] || ''
                const isRevealed = revealedPins[c.unitCode]
                const isLoadingPin = loadingPins[c.unitCode]
                const cleanCardCode = (c.unitCode || '').toLowerCase().replace(/[^a-z0-9]/g, '')
                const cleanHighlightCode = (highlightedUnitCode || '').toLowerCase().replace(/[^a-z0-9]/g, '')
                const isHighlighted = Boolean(highlightedUnitCode && cleanCardCode === cleanHighlightCode)

                return (
                  <div 
                    key={c.id} 
                    id={`unit-card-${cleanCardCode}`}
                    className={`stitch-card p-6 flex flex-col justify-between transition-all duration-500 relative ${
                      isHighlighted
                        ? 'ring-4 ring-blue-500 shadow-[0_20px_50px_rgba(37,99,235,0.35),0_0_25px_rgba(59,130,246,0.3)] !border-blue-500 bg-gradient-to-b from-blue-50/50 via-white to-white scale-[1.02] z-10'
                        : 'hover:shadow-md'
                    }`}
                  >
                    {isHighlighted && (
                      <div className="mb-4 -mt-1 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold flex items-center justify-between shadow-md animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px]">verified</span>
                          <span>Kho đang xem: #{c.unitCode}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setHighlightedUnitCode(null)
                          }}
                          className="text-white/80 hover:text-white cursor-pointer px-1.5 py-0.5 rounded hover:bg-white/20 transition-colors flex items-center gap-1 text-[11px]"
                          title="Tắt làm nổi bật"
                        >
                          <span>Đóng</span>
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    )}
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-xs">
                            <span className="material-symbols-outlined text-[26px]">garage_door</span>
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-base font-extrabold text-slate-900">KHO #{c.unitCode}</span>
                              {c.status === 'OVERDUE' ? (
                                <span className="stitch-badge bg-rose-50 text-rose-700 border border-rose-200">
                                  <span className="pulsing-dot bg-rose-500"></span>
                                  Quá hạn thanh toán
                                </span>
                              ) : (
                                <span className="stitch-badge stitch-badge-available">
                                  <span className="pulsing-dot bg-emerald-500"></span>
                                  Đang hoạt động
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-500">{c.facilityName} • Hợp đồng #{c.contractCode}</span>
                          </div>

                        </div>

                        <div className="text-right">
                          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border inline-block ${c.status === 'OVERDUE' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                            {c.status === 'OVERDUE' ? 'Chưa thanh toán' : 'Đã thanh toán'}
                          </span>
                        </div>
                      </div>

                      {c.status === 'OVERDUE' && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                          <span className="material-symbols-outlined text-[18px]">warning</span>
                          <span>Boxora ghi nhận hợp đồng đã quá hạn từ ngày {c.endDate}. PIN/QR trong hệ thống có thể đã bị thu hồi; trạng thái khóa vật lý chưa được xác minh. Vui lòng liên hệ cơ sở để được hướng dẫn.</span>
                        </div>
                      )}

                      {/* Thời Gian Bắt Đầu & Kết Thúc Thuê Kho */}
                      <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[15px] text-blue-600">play_circle</span>
                            Ngày bắt đầu
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-slate-900 mt-1">
                            {formatDisplayDate(c.startDate)}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[15px] text-amber-600">event_available</span>
                            Ngày kết thúc
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-slate-900 mt-1">
                            {formatDisplayDate(c.endDate)}
                          </span>
                        </div>
                      </div>

                      {/* Security PIN Box */}
                      <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col gap-3 relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-semibold text-slate-900">
                              Mã PIN lưu trong Boxora
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] text-slate-600 font-medium">
                            Trạng thái thiết bị chưa xác minh
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Boxora không xác nhận đồng bộ mã PIN với khóa vật lý. Vui lòng xác nhận việc cài đặt mã tại cơ sở trước khi sử dụng.
                        </p>

                        {!isRevealed ? (
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-2.5 px-4 rounded-lg bg-white border border-slate-200">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 font-mono text-[16px] text-slate-400 tracking-widest select-none">
                                <span>●</span><span>●</span><span>●</span><span>●</span><span>●</span><span>●</span>
                              </div>
                              <span className="text-[11px] text-slate-400 hidden sm:inline">
                                {isLoadingPin ? 'Đang tải...' : '(Nhấn để xem)'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <button
                                type="button"
                                onClick={() => togglePinReveal(c.unitCode, targetId)}
                                disabled={isLoadingPin}
                                className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                              >
                                <span>{isLoadingPin ? 'Đang tải...' : 'Xem mã PIN'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openPinChangeModal(c.unitCode, targetId, pin)}
                                className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[15px] text-blue-600">lock_reset</span>
                                <span>Đổi mã PIN</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2.5 py-2.5 px-4 rounded-lg bg-white border border-slate-200">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-600 font-medium">Mã PIN:</span>
                                <div className="flex items-center gap-1 font-mono text-base font-bold text-slate-900 tracking-wider">
                                  {(pin || '------').split('').map((digit: string, idx: number) => (
                                    <span key={idx} className="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-slate-900">
                                      {digit}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={!pin}
                                onClick={() => handleCopy(c.unitCode, pin)}
                                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-[11px] flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-[14px]">content_copy</span>
                                <span>{copiedPin === c.unitCode ? 'Đã sao chép' : 'Sao chép'}</span>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => togglePinReveal(c.unitCode, targetId)}
                              className="w-full mt-1 py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">visibility_off</span>
                              <span>Ẩn mã PIN</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Metrics: Giá thuê & Tiền cọc */}
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                          <span className="text-[11px] text-slate-500 block font-normal">Giá thuê hàng tháng</span>
                          <span className="text-sm font-semibold text-slate-900">
                            {Number(c.monthlyFee || 0).toLocaleString('vi-VN')} ₫
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                          <span className="text-[11px] text-slate-500 block font-normal">Tiền cọc lưu ký</span>
                          <span className="text-sm font-semibold text-slate-900 font-mono">
                            {getContractDepositHeld(c).toLocaleString('vi-VN')} ₫
                          </span>
                        </div>
                      </div>

                      {/* Vị trí nằm ngay bên dưới giá thuê hàng tháng và tiền cọc lưu ký */}
                      {(() => {
                        const contractRenewals = myRenewals.filter(r => r.contractId === c.id)
                        const completedRenewals = contractRenewals.filter(r => r.status === 'COMPLETED')
                        const pendingRenewal = contractRenewals.find(r => r.status === 'PENDING_SIGNATURE' || r.status === 'PENDING_PAYMENT' || r.status === 'PENDING_REVIEW')
                        const rejectedRenewal = contractRenewals.find(r => r.status === 'REJECTED')

                        return (
                          <>
                            {completedRenewals.length > 0 && (
                              <div className="mt-3 p-3 bg-blue-50/80 border border-blue-200/90 rounded-xl space-y-2 text-left animate-in fade-in duration-150">
                                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                  <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs">
                                    <span className="material-symbols-outlined text-[17px] text-blue-600">verified</span>
                                    <span>
                                      Kho có hợp đồng gia hạn ({completedRenewals.length} hợp đồng gia hạn + 1 hợp đồng gốc)
                                    </span>
                                  </div>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-200/90 text-blue-900">
                                    Tổng {completedRenewals.length + 1} HĐ
                                  </span>
                                </div>
                                
                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                  Kho đã hoàn tất ký phụ lục &amp; thanh toán gia hạn trực tuyến. Kỳ hạn hợp đồng hiện tại đã nối dài đến <strong>{formatDisplayDate(c.endDate)}</strong>.
                                </p>

                                <button
                                  type="button"
                                  onClick={() => setContractHistoryModal({ contract: c, renewals: completedRenewals })}
                                  className="w-full py-2 px-3 bg-white hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-300 hover:border-blue-600 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer group"
                                >
                                  <span className="material-symbols-outlined text-[16px] group-hover:scale-110 transition-transform">history_edu</span>
                                  <span>Hiển thị chi tiết các hợp đồng đã ký trước đó</span>
                                </button>
                              </div>
                            )}

                            {pendingRenewal && (
                              <div className="mt-3 p-3 bg-amber-50/90 border border-amber-200 rounded-xl space-y-2 text-xs text-left">
                                <div className="flex items-center justify-between flex-wrap gap-1">
                                  <span className="font-bold text-amber-900 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[16px] text-amber-600">pending_actions</span>
                                    <span>Yêu cầu gia hạn (+{pendingRenewal.cycleMonths} tháng)</span>
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    pendingRenewal.status === 'PENDING_REVIEW'
                                      ? 'bg-amber-200 text-amber-900'
                                      : pendingRenewal.status === 'PENDING_SIGNATURE'
                                        ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                        : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                  }`}>
                                    {pendingRenewal.status === 'PENDING_REVIEW'
                                      ? 'Chờ Quản lý cơ sở duyệt'
                                      : pendingRenewal.status === 'PENDING_SIGNATURE'
                                        ? 'Đã duyệt • Chờ ký phụ lục'
                                        : 'Đã ký • Chờ thanh toán online'}
                                  </span>
                                </div>

                                {pendingRenewal.status === 'PENDING_REVIEW' && (
                                  <p className="text-[11px] text-slate-600 leading-relaxed bg-white/70 p-2 rounded-lg border border-amber-200/60">
                                    Yêu cầu gia hạn đang được Quản lý cơ sở xem xét phê duyệt. Sau khi được duyệt, quý khách có thể chọn hình thức ký và thanh toán (trực tuyến hoặc trực tiếp tại quầy).
                                  </p>
                                )}

                                {pendingRenewal.status === 'PENDING_SIGNATURE' && (
                                  <div className="space-y-2">
                                    {pendingRenewal.paymentMethod === 'COUNTER' ? (
                                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                          <div className="font-bold flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[16px] text-emerald-600">storefront</span>
                                            <span>Hình thức: Ký &amp; Nộp tại quầy</span>
                                          </div>
                                          <span className="text-[11px] font-mono font-bold text-emerald-800">
                                            Hẹn: {formatDisplayDate(pendingRenewal.counterAppointmentDate)}{pendingRenewal.counterAppointmentTime ? ` lúc ${pendingRenewal.counterAppointmentTime}` : ''}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-slate-600 leading-tight">
                                          Quý khách vui lòng đến cơ sở vào ngày hẹn trên (hoặc đúng khung giờ đã chọn) để ký phụ lục giấy và thanh toán cước.
                                        </p>
                                        <div className="flex items-center gap-2 pt-1">
                                          <button
                                            type="button"
                                            onClick={() => handleOpenSwitchMethodModal(pendingRenewal, 'ONLINE')}
                                            className="flex-1 py-1 px-2 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                                          >
                                            <span className="material-symbols-outlined text-[14px]">draw</span>
                                            <span>Đổi sang Ký &amp; Thanh toán Online</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenSwitchMethodModal(pendingRenewal, 'COUNTER')}
                                            className="py-1 px-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-md text-[11px] font-semibold transition cursor-pointer"
                                          >
                                            Đổi ngày hẹn
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="space-y-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setRenewalForSigning(pendingRenewal)}
                                          className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                                        >
                                          <span className="material-symbols-outlined text-[15px]">draw</span>
                                          <span>Ký Phụ Lục Online Ngay</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenSwitchMethodModal(pendingRenewal, 'COUNTER')}
                                          className="w-full py-1 px-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                                        >
                                          <span className="material-symbols-outlined text-[14px] text-emerald-600">storefront</span>
                                          <span>Muốn đến cơ sở ký &amp; nộp tiền trực tiếp? Nhấn để đặt lịch</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {pendingRenewal.status === 'PENDING_PAYMENT' && (
                                  <div className="space-y-2">
                                    <div className="p-2.5 bg-blue-50/90 border border-blue-200 rounded-lg text-blue-900 text-[11px] space-y-1">
                                      <div className="font-bold flex items-center gap-1 text-blue-950">
                                        <span className="material-symbols-outlined text-[15px] text-blue-600">lock</span>
                                        <span>Đã ký phụ lục online • Bắt buộc thanh toán online</span>
                                      </div>
                                      <p className="text-slate-600 text-[10px] leading-relaxed">
                                        Do hợp đồng gia hạn đã được ký điện tử trực tuyến, hệ thống khóa hình thức trực tiếp và quý khách vui lòng hoàn tất thanh toán qua cổng VNPay.
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handlePayRenewalVNPay(pendingRenewal)}
                                      disabled={isPayingRenewal}
                                      className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                                    >
                                      <span className="material-symbols-outlined text-[15px]">credit_card</span>
                                      <span>Thanh Toán VNPay ({Number(pendingRenewal.renewalFee || 0).toLocaleString('vi-VN')} ₫)</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {!pendingRenewal && rejectedRenewal && (() => {
                              const createdAtDate = rejectedRenewal.createdAt ? new Date(rejectedRenewal.createdAt) : new Date()
                              const unlockDate = new Date(createdAtDate.getTime() + 3 * 24 * 60 * 60 * 1000)
                              const now = new Date()
                              const canReactivate = now >= unlockDate
                              const diffMs = unlockDate.getTime() - now.getTime()
                              const hoursRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)))
                              const daysRemaining = Math.floor(hoursRemaining / 24)
                              const remainingHours = hoursRemaining % 24

                              return (
                                <div className="mt-3 p-3 bg-rose-50/90 border border-rose-200 rounded-xl space-y-2 text-xs text-left animate-in fade-in">
                                  <div className="flex items-center justify-between flex-wrap gap-1">
                                    <span className="font-bold text-rose-950 flex items-center gap-1.5">
                                      <span className="material-symbols-outlined text-[16px] text-rose-600">cancel</span>
                                      <span>Yêu cầu gia hạn (+{rejectedRenewal.cycleMonths} tháng) bị từ chối</span>
                                    </span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-900">
                                      Đã từ chối
                                    </span>
                                  </div>

                                  <div className="bg-white/80 p-2.5 rounded-lg border border-rose-200 text-[11px] space-y-1">
                                    <p className="text-rose-900 font-semibold">
                                      Lý do từ chối: <span className="font-normal text-slate-800">{rejectedRenewal.rejectionReason || 'Không có lý do chi tiết'}</span>
                                    </p>
                                    <p className="text-[10px] text-slate-500">
                                      Ngày gửi đơn: {safeFormatDateTime(rejectedRenewal.createdAt)}
                                    </p>
                                  </div>

                                  <div className="pt-1">
                                    {canReactivate ? (
                                      <button
                                        type="button"
                                        onClick={() => handleReactivateRenewal(rejectedRenewal.id)}
                                        className="w-full py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                                      >
                                        <span className="material-symbols-outlined text-[16px]">replay</span>
                                        <span>Kích hoạt duyệt lại yêu cầu gia hạn ngay</span>
                                      </button>
                                    ) : (
                                      <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[15px] text-amber-600">schedule</span>
                                        <span>
                                          Có thể kích hoạt duyệt lại sau: <strong>{daysRemaining > 0 ? `${daysRemaining} ngày ` : ''}{remainingHours} giờ</strong> nữa (vào lúc {unlockDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày {unlockDate.toLocaleDateString('vi-VN')})
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })()}
                          </>
                        )
                      })()}
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-3">
                      <button
                        onClick={() => openRenewModal(c)}
                        className="stitch-btn-secondary flex-1 text-xs py-2.5 flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[18px]">autorenew</span>
                        <span>Yêu cầu gia hạn</span>
                      </button>
                      <button
                        onClick={() => {
                          setTicketUnit(c.unitCode)
                          setTicketType('lock')
                          handleTabChange('support')
                        }}
                        className="px-3.5 h-10 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">report</span>
                        <span>Báo Sự Cố</span>
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
      )}

      {/* 4. TAB: LỊCH SỬ ĐẶT GIỮ CHỖ (BOOKING RESERVATIONS HISTORY) */}
      {activeTab === 'bookings' && (
        <div className="flex flex-col gap-6">
          {/* Header & Filter Controls */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-headline text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">history_edu</span>
                  <span>Lịch Sử Đặt Giữ Chỗ Kho Boxora</span>
                </h3>
                
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => handleOpenPolicyModal('cancellation')}
                  className="px-3 py-2 bg-white hover:bg-cyan-50/80 text-slate-700 hover:text-cyan-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 hover:border-cyan-300 shadow-2xs"
                  title="Xem quy định đặt cọc, hủy giữ chỗ và thời gian hoàn tiền cọc"
                >
                  <span className="material-symbols-outlined text-[17px] text-cyan-600">policy</span>
                  <span>Chính sách đặt cọc &amp; hủy</span>
                </button>
                <button
                  type="button"
                  onClick={fetchCustomerBookings}
                  disabled={loadingBookings}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-[16px] ${loadingBookings ? 'animate-spin' : ''}`}>
                    refresh
                  </span>
                  <span>{loadingBookings ? 'Đang tải...' : 'Làm mới'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('explore')}
                  className="stitch-btn-primary text-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Đặt Thuê Thêm Kho</span>
                </button>
              </div>
            </div>

            {/* Search & Multi-Filters */}
            <div className="flex flex-col gap-3 pt-3 border-t border-slate-100">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                {/* Search Input */}
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Tìm theo mã đặt chỗ (BX-...), mã kho (TD-...), sđt, mã PIN hoặc cơ sở..."
                    value={bookingSearchTerm}
                    onChange={(e) => setBookingSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  />
                  {bookingSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setBookingSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
                      title="Xóa tìm kiếm"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Dropdowns */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Facility */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
                    <span className="material-symbols-outlined text-[16px] text-slate-500">apartment</span>
                    <span className="text-slate-500 font-medium">Cơ sở:</span>
                    <select
                      value={bookingFacility}
                      onChange={(e) => setBookingFacility(e.target.value)}
                      className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer max-w-[170px] truncate"
                    >
                      <option value="all">
                        {bookingsFacilities.length > 1
                          ? `Tất cả cơ sở (${bookingsFacilities.length})`
                          : bookingsFacilities[0]?.name || 'Tất cả cơ sở'}
                      </option>
                      {bookingsFacilities.length > 1 &&
                        bookingsFacilities.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Floor */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
                    <span className="material-symbols-outlined text-[16px] text-slate-500">layers</span>
                    <span className="text-slate-500 font-medium">Tầng:</span>
                    <select
                      value={bookingFloor}
                      onChange={(e) => setBookingFloor(e.target.value)}
                      className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
                    >
                      <option value="all">Tất cả tầng</option>
                      {bookingsFloors.map((fl) => (
                        <option key={fl} value={fl}>
                          Tầng {fl}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Size */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
                    <span className="material-symbols-outlined text-[16px] text-slate-500">straighten</span>
                    <span className="text-slate-500 font-medium">Kích cỡ:</span>
                    <select
                      value={bookingSize}
                      onChange={(e) => setBookingSize(e.target.value)}
                      className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
                    >
                      <option value="all">Tất cả kích cỡ</option>
                      <option value="mini">Kho Mini (≤ 5 m²)</option>
                      <option value="family">Kho Gia Đình (6 - 10 m²)</option>
                      <option value="business">Kho Doanh Nghiệp (&gt; 10 m²)</option>
                    </select>
                  </div>

                  {/* Reset Button */}
                  {(bookingSearchTerm || bookingFacility !== 'all' || bookingFloor !== 'all' || bookingSize !== 'all' || bookingStatusFilter !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setBookingSearchTerm('')
                        setBookingFacility('all')
                        setBookingFloor('all')
                        setBookingSize('all')
                        setBookingStatusFilter('ALL')
                      }}
                      className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                      title="Đặt lại bộ lọc"
                    >
                      <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                      <span className="hidden sm:inline">Đặt lại</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 pt-1">
                {[
                  { key: 'ALL', label: 'Tất cả', count: customerBookings.length },
                  { key: 'CONFIRMED', label: 'Đã giữ chỗ', count: customerBookings.filter(b => b.status === 'CONFIRMED').length },
                  { key: 'PENDING_PAYMENT', label: 'Chờ cọc', count: customerBookings.filter(b => b.status === 'PENDING_PAYMENT').length },
                  { 
                    key: 'PENDING_SIGNATURE', 
                    label: 'Chờ ký', 
                    count: customerBookings.filter(b => {
                      const info = getBookingNoticeInfo(b)
                      return info.scenario === 'PAID_UNSIGNED'
                    }).length 
                  },
                  { key: 'ACTIVE', label: 'Đang dùng', count: customerBookings.filter(b => b.status === 'ACTIVE').length },
                  { key: 'COMPLETED', label: 'Đã xong', count: customerBookings.filter(b => b.status === 'COMPLETED').length },
                  { key: 'CANCELLED', label: 'Hủy', count: customerBookings.filter(b => b.status === 'CANCELLED').length },
                  { key: 'OVERDUE', label: 'Quá hạn', count: customerBookings.filter(b => b.status === 'OVERDUE').length },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setBookingStatusFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                      bookingStatusFilter === tab.key
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      bookingStatusFilter === tab.key ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Count & Active status footer */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1 border-t border-slate-100 flex-wrap gap-2">
                <span>
                  Hiển thị <strong className="text-slate-900 font-bold">{filteredCustomerBookings.length}</strong> / {customerBookings.length} đơn đặt giữ chỗ
                </span>
                {(bookingSearchTerm || bookingFacility !== 'all' || bookingFloor !== 'all' || bookingSize !== 'all' || bookingStatusFilter !== 'ALL') && (
                  <span className="text-blue-600 font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">filter_alt</span>
                    <span>Đang lọc theo tiêu chí</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bookings Grid */}
          {loadingBookings ? (
            <div className="p-16 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[32px] text-blue-600 animate-spin">sync</span>
              <span>Đang tải lịch sử đặt kho từ máy chủ Boxora...</span>
            </div>
          ) : (() => {
            const filteredBookings = filteredCustomerBookings

            if (filteredBookings.length === 0) {
              return (
                <div className="stitch-card p-12 text-center flex flex-col items-center justify-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[36px]">event_busy</span>
                  </div>
                  <div className="max-w-md">
                    <h3 className="font-headline text-base font-bold text-slate-900 mb-1">
                      Không tìm thấy đơn đặt giữ chỗ nào phù hợp
                    </h3>
                    <p className="text-xs text-slate-500">
                      {bookingSearchTerm || bookingStatusFilter !== 'ALL'
                        ? 'Thử xóa bộ lọc hoặc tìm kiếm với từ khóa khác.'
                        : 'Quý khách chưa có đơn đặt giữ chỗ nào. Khám phá các vị trí kho đang mở để đặt giữ chỗ trực tuyến ngay.'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleTabChange('explore')}
                    className="stitch-btn-primary text-xs"
                  >
                    <span>Khám Phá &amp; Đặt Kho Mới</span>
                  </button>
                </div>
              )
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredBookings.map((b) => {
                  const cleanBookingCode = (b.bookingCode || b.id || '').toLowerCase().replace(/[^a-z0-9]/g, '')
                  const cleanHighlightBooking = (highlightedBookingCode || '').toLowerCase().replace(/[^a-z0-9]/g, '')
                  const isBookingHighlighted = Boolean(highlightedBookingCode && cleanBookingCode === cleanHighlightBooking)
                  const checkInNotice = getCheckInNoticeInfo(b)

                  return (
                    <div
                      key={b.id}
                      id={`booking-card-${cleanBookingCode}`}
                      className={`stitch-card p-5 flex flex-col justify-between gap-4 transition-all ${
                        isBookingHighlighted
                          ? 'ring-4 ring-blue-500 shadow-[0_20px_50px_rgba(37,99,235,0.28)] !border-blue-500 bg-gradient-to-b from-blue-50/40 via-white to-white scale-[1.01] z-10'
                          : 'hover:border-blue-300 hover:shadow-md'
                      }`}
                    >
                      {isBookingHighlighted && (
                        <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xs font-bold flex items-center justify-between shadow-sm">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px]">bookmark_added</span>
                            <span>Đơn giữ kho: #{b.bookingCode}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setHighlightedBookingCode(null)
                            }}
                            className="text-white/80 hover:text-white cursor-pointer px-1.5 py-0.5 rounded hover:bg-white/20 transition-colors flex items-center gap-1 text-[11px]"
                          >
                            <span>Đóng</span>
                            <span className="material-symbols-outlined text-[13px]">close</span>
                          </button>
                        </div>
                      )}
                      <div className="flex flex-col gap-3.5">
                        {/* Top: Unit & Status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm border border-blue-100 shadow-2xs">
                              {b.unitCode ? b.unitCode.substring(0, 2) : 'BX'}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-base font-extrabold text-slate-900">
                                  KHO #{b.unitCode}
                                </span>
                              </div>
                              <span className="text-xs text-slate-500 block truncate max-w-[180px]">
                                {b.facilityName}
                              </span>
                            </div>
                          </div>

                          <div className="text-right flex flex-col items-end gap-1">
                            {(() => {
                              const info = getBookingNoticeInfo(b)
                              if (b.status === 'CANCELLED' || b.status === 'OVERDUE') {
                                return (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                    {b.status === 'OVERDUE' ? 'Quá Hạn' : 'Đã Hủy'}
                                  </span>
                                )
                              }
                              if (b.status === 'ACTIVE') {
                                return (
                                  <>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                      Đang Hoạt Động
                                    </span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      ✓ Đã thanh toán đủ
                                    </span>
                                  </>
                                )
                              }
                              if (info.scenario === 'PAID_SIGNED') {
                                return (
                                  <>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                                      Đã Giữ Chỗ • Chờ Nhận Kho
                                    </span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      ✓ Đã thanh toán &amp; Ký HĐ
                                    </span>
                                  </>
                                )
                              }
                              if (info.scenario === 'PAID_UNSIGNED') {
                                return (
                                  <>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
                                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 animate-pulse"></span>
                                      Đã Giữ Chỗ • Chờ Nhận Kho
                                    </span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                      ✓ Đã thanh toán (Chờ ký HĐ)
                                    </span>
                                  </>
                                )
                              }
                              // UNPAID_IN_PERSON
                              return (
                                <>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 animate-pulse"></span>
                                    Đã Giữ Chỗ (Tại cơ sở)
                                  </span>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                    ○ Chưa thanh toán (Tại cơ sở)
                                  </span>
                                </>
                              )
                            })()}
                            {checkInNotice && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border tracking-wider mt-0.5 ${
                                  checkInNotice.type === 'OVERDUE'
                                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                                    : checkInNotice.type === 'TODAY'
                                    ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                                    : 'bg-blue-100 text-blue-800 border-blue-300'
                                }`}
                                title={`Lịch nhận kho: ${checkInNotice.text}`}
                              >
                                <span className="material-symbols-outlined text-[12px]">
                                  {checkInNotice.type === 'OVERDUE' ? 'warning' : checkInNotice.type === 'TODAY' ? 'schedule' : 'event'}
                                </span>
                                <span>{checkInNotice.text}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Mã đặt chỗ</span>
                            <span className="font-mono font-bold text-slate-900">{b.bookingCode}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Lịch hẹn nhận kho</span>
                            <span className="font-mono font-bold text-slate-900 block">
                              {safeFormatDateTime(b.expectedCheckInAt, b.startDate || 'Chưa ấn định')}
                            </span>
                            {checkInNotice && (
                              <div className="mt-1">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    checkInNotice.type === 'OVERDUE'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : checkInNotice.type === 'TODAY'
                                      ? 'bg-amber-50 text-amber-900 border-amber-300 font-extrabold'
                                      : 'bg-blue-50 text-blue-700 border-blue-200'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[12px]">
                                    {checkInNotice.type === 'OVERDUE' ? 'warning' : checkInNotice.type === 'TODAY' ? 'schedule' : 'event'}
                                  </span>
                                  <span>{checkInNotice.text}</span>
                                </span>
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Thời hạn thuê</span>
                            <span className="font-semibold text-slate-800">{b.rentalMonths} tháng</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Hạn giữ chỗ</span>
                            <span className="font-mono font-bold text-amber-700">
                              {safeFormatDateTime(b.holdExpiresAt, b.status === 'ACTIVE' ? 'Đã kích hoạt' : 'Theo chính sách')}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Tiền cọc giữ chỗ</span>
                            <span className="font-mono font-bold text-blue-600">
                              {Number(b.depositPaid || b.depositAmount || 0).toLocaleString('vi-VN')} ₫
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Tổng tiền thuê</span>
                            <span className="font-mono font-bold text-slate-900">
                              {Number(b.totalRentalFee || 0).toLocaleString('vi-VN')} ₫
                            </span>
                          </div>
                        </div>

                        {/* Check-in Reminder Notice Block */}
                        {checkInNotice && (
                          <div
                            className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs transition-all ${
                              checkInNotice.type === 'OVERDUE'
                                ? 'bg-rose-50/90 border-rose-200 text-rose-950 shadow-xs'
                                : checkInNotice.type === 'TODAY'
                                ? 'bg-amber-50/90 border-amber-200 text-amber-950 shadow-xs'
                                : 'bg-sky-50/80 border-sky-200 text-sky-950'
                            }`}
                          >
                            <span
                              className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${
                                checkInNotice.type === 'OVERDUE'
                                  ? 'text-rose-600'
                                  : checkInNotice.type === 'TODAY'
                                  ? 'text-amber-600 animate-pulse'
                                  : 'text-sky-600'
                              }`}
                            >
                              {checkInNotice.type === 'OVERDUE'
                                ? 'notification_important'
                                : checkInNotice.type === 'TODAY'
                                ? 'alarm'
                                : 'event'}
                            </span>
                            <div className="flex-1 leading-relaxed">
                              <div className="font-bold flex items-center justify-between gap-2 mb-0.5 flex-wrap">
                                <span className={
                                  checkInNotice.type === 'OVERDUE'
                                    ? 'text-rose-900'
                                    : checkInNotice.type === 'TODAY'
                                    ? 'text-amber-900'
                                    : 'text-sky-900'
                                }>
                                  {checkInNotice.type === 'OVERDUE'
                                    ? 'Lưu ý ngày nhận kho:'
                                    : checkInNotice.type === 'TODAY'
                                    ? 'Lịch nhận kho hôm nay:'
                                    : 'Lịch nhận kho dự kiến:'}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border tracking-wide ${
                                    checkInNotice.type === 'OVERDUE'
                                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                                      : checkInNotice.type === 'TODAY'
                                      ? 'bg-amber-200 text-amber-900 border-amber-400'
                                      : 'bg-blue-100 text-blue-800 border-blue-300'
                                  }`}
                                >
                                  {checkInNotice.text}
                                </span>
                              </div>
                              <div className="text-[11px]">
                                {checkInNotice.alertMessage}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Status Notice Block */}
                        {(b.status === 'CANCELLED' || b.status === 'OVERDUE') && (
                          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-800 flex items-start gap-2">
                            <span className="material-symbols-outlined text-[16px] text-rose-600 shrink-0 mt-0.5">
                              event_busy
                            </span>
                            <div className="leading-relaxed">
                              <strong>Đơn giữ chỗ đã hết hạn / đã hủy:</strong> {b.holdExpiresAt ? `Hạn giữ chỗ đã kết thúc lúc ${safeFormatDateTime(b.holdExpiresAt)}. ` : ''}Kho đã được tự động giải phóng theo chính sách cơ sở.
                            </div>
                          </div>
                        )}

                        {/* 3 Status Notice Cases for Reservations */}
                        {(() => {
                          const info = getBookingNoticeInfo(b)

                          // Case 3: Đã thanh toán và ký hợp đồng rồi
                          if (info.scenario === 'PAID_SIGNED') {
                            return (
                              <div className="p-3 rounded-lg bg-emerald-50/80 border border-emerald-200 text-[11px] text-emerald-950 flex items-start gap-2.5">
                                <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0 mt-0.5">
                                  verified
                                </span>
                                <div className="leading-relaxed flex-1">
                                  <div className="font-bold text-emerald-900 mb-0.5 flex items-center justify-between">
                                    <span>Đã thanh toán &amp; ký hợp đồng rồi</span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                                      <span className="material-symbols-outlined text-[11px]">task_alt</span>
                                      Sẵn sàng nhận kho
                                    </span>
                                  </div>
                                  <div>
                                    Thủ tục hợp đồng và thanh toán đã hoàn tất 100%! Quý khách chỉ cần mang CCCD gốc đến cơ sở Boxora đúng lịch hẹn (<strong>{safeFormatDateTime(b.expectedCheckInAt, b.startDate || 'lịch hẹn')}</strong>) để xem kho thực tế, nhận bàn giao và nhận mã PIN SmartLock. <em>Lưu ý: Thời hạn thuê kho sẽ chính thức có hiệu lực tính từ ngày bạn check-in và kích hoạt mã PIN tại cơ sở.</em>
                                  </div>
                                </div>
                              </div>
                            )
                          }

                          // Case 2: Đã thanh toán nhưng chưa ký
                          if (info.scenario === 'PAID_UNSIGNED') {
                            return (
                              <div className="p-3 rounded-lg bg-blue-50/80 border border-blue-200 text-[11px] text-blue-950 flex items-start gap-2.5">
                                <span className="material-symbols-outlined text-[18px] text-blue-600 shrink-0 mt-0.5">
                                  edit_document
                                </span>
                                <div className="leading-relaxed flex-1">
                                  <div className="font-bold text-blue-900 mb-0.5 flex items-center justify-between">
                                    <span>Đã thanh toán nhưng chưa ký</span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[9px] font-bold">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                      Chờ ký hợp đồng
                                    </span>
                                  </div>
                                  <div>
                                    Đơn đặt kho đã thanh toán đủ. Quý khách vui lòng ký hợp đồng điện tử trực tuyến hoặc mang CCCD gốc đến cơ sở Boxora để ký hợp đồng và nhận bàn giao kho.
                                  </div>
                                  <div className="mt-2.5 flex items-center justify-end">
                                    <button
                                      type="button"
                                      onClick={() => void handleSignContractForBooking(b, info.matchingContract)}
                                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                                    >
                                      <span className="material-symbols-outlined text-[15px]">draw</span>
                                      <span>Ký hợp đồng điện tử ngay</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )
                          }

                          // Case 1: Chưa thanh toán đủ (chưa thanh toán hoặc mới thanh toán một phần như tiền cọc)
                          if (info.scenario === 'UNPAID_IN_PERSON') {
                            return (
                              <div className="space-y-2">
                                <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-[11px] text-amber-950 flex items-start gap-2.5">
                                  <span className="material-symbols-outlined text-[18px] text-amber-700 shrink-0 mt-0.5">
                                    {info.isPartiallyPaid ? 'payments' : 'storefront'}
                                  </span>
                                  <div className="leading-relaxed flex-1">
                                    <div className="font-bold text-amber-900 mb-0.5 flex items-center justify-between">
                                      <span>
                                        {info.isPartiallyPaid
                                          ? 'Đã thanh toán một phần • Chờ hoàn tất phần còn lại'
                                          : 'Check-in thanh toán và ký hợp đồng tại chỗ'}
                                      </span>
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold">
                                        {info.isPartiallyPaid
                                          ? `Còn thiếu ${Number(info.remainingAmountDue || 0).toLocaleString('vi-VN')} ₫`
                                          : 'Thanh toán tại quầy'}
                                      </span>
                                    </div>
                                    <div>
                                      {info.isPartiallyPaid ? (
                                        <>
                                          Hệ thống đã ghi nhận khoản thanh toán hợp lệ{' '}
                                          <strong>{Number((info.effectiveDepositPaid || 0) + (info.effectiveRentPaid || 0)).toLocaleString('vi-VN')} ₫</strong>. Quý khách vui lòng thanh toán phần còn thiếu{' '}
                                          <strong>{Number(info.remainingAmountDue || 0).toLocaleString('vi-VN')} ₫</strong> trực tuyến để ký hợp đồng điện tử ngay hoặc hoàn tất tại quầy khi nhận bàn giao kho.
                                        </>
                                      ) : (
                                        <>
                                          Kho được bảo lưu riêng cho bạn đến <strong>{b.holdExpiresAt ? new Date(b.holdExpiresAt).toLocaleString('vi-VN') : 'lịch hẹn + thời gian gia hạn'}</strong>. Quý khách vui lòng mang CCCD gốc đến cơ sở Boxora để xem kho thực tế, ký hợp đồng và thanh toán nhận bàn giao.
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handlePayBookingVNPay(b)}
                                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                                    title="Thanh toán trước để hoàn tất nhanh thủ tục"
                                  >
                                    <span className="material-symbols-outlined text-sm">credit_card</span>
                                    <span>Thanh toán và ký hợp đồng trực tuyến ngay -&gt;</span>
                                  </button>
                                </div>
                              </div>
                            )
                          }

                          return null
                        })()}

                        {b.status === 'ACTIVE' && (
                          <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-900 flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-medium">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              Kho đang hoạt động tốt
                            </span>
                            <button
                              type="button"
                              onClick={() => handleGoToMyUnit(b.unitCode)}
                              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                            >
                              Xem mã PIN cửa kho
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      {b.status !== 'CANCELLED' && b.status !== 'OVERDUE' && (
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedBookingForModal(b)}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer flex-1 justify-center"
                          >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                            <span>Chi Tiết &amp; Hướng Dẫn</span>
                          </button>

                          {(b.status === 'CONFIRMED' || b.status === 'PENDING_PAYMENT') && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenRescheduleModal(b)}
                                className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer border border-amber-200"
                                title="Đổi ngày / giờ hẹn nhận kho"
                              >
                                <span className="material-symbols-outlined text-[15px]">edit_calendar</span>
                                <span>Đổi lịch</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setCancellingBookingTarget(b)}
                                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer border border-rose-200"
                                title="Hủy đơn đặt giữ chỗ kho"
                              >
                                <span className="material-symbols-outlined text-[15px]">event_busy</span>
                                <span>Hủy đơn</span>
                              </button>
                            </>
                          )}

                          {b.status === 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() => handleGoToMyUnit(b.unitCode)}
                              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:shadow"
                            >
                              <span>Vào kho</span>
                              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* 5. TAB 3: TÌM & THUÊ THÊM KHO (EXPLORE & BOOK) */}
      {activeTab === 'explore' && (
        <div className="flex flex-col gap-6">
          {/* Quick Filter */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Lọc kho trống</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <select
                value={filterFacility}
                onChange={(e) => setFilterFacility(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg focus:outline-none focus:border-slate-400"
              >
                <option value="all">Tất cả cơ sở</option>
                {facilities.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </option>
                ))}
              </select>

              <select
                value={filterFloor}
                onChange={(e) => setFilterFloor(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg focus:outline-none focus:border-slate-400"
              >
                <option value="all">Tất cả tầng</option>
                {availableFloors.map(floor => (
                  <option key={floor} value={floor}>
                    Tầng {floor}
                  </option>
                ))}
              </select>

              <select
                value={filterSize}
                onChange={(e) => setFilterSize(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg focus:outline-none focus:border-slate-400"
              >
                <option value="all">Tất cả kích cỡ</option>
                <option value="mini">Kho Mini (≤ 5 m²)</option>
                <option value="family">Kho Gia Đình (6 - 10 m²)</option>
                <option value="business">Kho Doanh Nghiệp (&gt; 10 m²)</option>
              </select>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {loadingUnits ? (
              <div className="col-span-full py-12 text-center text-slate-500 text-xs">
                Đang tải danh sách kho đang trống từ hệ thống database...
              </div>
            ) : availableUnits.filter(u => {
                if (filterFacility !== 'all' && u.facilityId !== filterFacility) return false
                if (filterFloor !== 'all' && extractFloor(u.floorLevel) !== filterFloor) return false
                const area = u.areaSqMeters || 6
                if (filterSize === 'mini' && area > 5) return false
                if (filterSize === 'family' && (area <= 5 || area > 10)) return false
                if (filterSize === 'business' && area <= 10) return false
                return true
              }).length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 text-xs bg-white rounded-2xl border border-slate-200">
                Không có kho trống nào phù hợp với bộ lọc đã chọn. Vui lòng chọn cơ sở hoặc kích thước khác.
              </div>
            ) : (
              availableUnits.filter(u => {
                if (filterFacility !== 'all' && u.facilityId !== filterFacility) return false
                if (filterFloor !== 'all' && extractFloor(u.floorLevel) !== filterFloor) return false
                const area = u.areaSqMeters || 6
                if (filterSize === 'mini' && area > 5) return false
                if (filterSize === 'family' && (area <= 5 || area > 10)) return false
                if (filterSize === 'business' && area <= 10) return false
                return true
              }).map((unit, idx) => {
                const bgImg = UNIT_CARD_IMAGES[idx % UNIT_CARD_IMAGES.length]
                const priceFormatted = Number(unit.pricePerMonth || 1250000).toLocaleString('vi-VN')
                const areaVal = unit.areaSqMeters ? `${unit.areaSqMeters.toFixed(1)} m²` : '6.0 m²'
                const volumeVal = unit.areaSqMeters ? `${Math.round(unit.areaSqMeters * 2.8)} m³` : '17 m³'

                return (
                  <div key={unit.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                    <div>
                      <div className="relative h-44 overflow-hidden bg-slate-800">
                        <div 
                          className="w-full h-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105 opacity-90"
                          style={{ backgroundImage: `url('${bgImg}')` }}
                        ></div>
                        <div className="absolute top-3 left-3 flex gap-1.5">
                          <span className="bg-slate-900/90 backdrop-blur text-white font-unit-code text-xs px-2 py-1 rounded-md">
                            #{unit.unitCode}
                          </span>
                          <span className="bg-blue-600 text-white font-mono text-[10px] uppercase font-bold px-2 py-1 rounded-md">
                            {unit.floorLevel || 'Tầng 1'}
                          </span>
                        </div>
                        <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur px-2.5 py-1 rounded-md text-slate-900 text-xs font-semibold flex items-center gap-1 shadow-sm">
                          <span className="text-slate-500">{unit.facilityName || 'Kho Boxora'}</span>
                        </div>
                      </div>

                      <div className="p-5 flex flex-col gap-3">
                        <div className="flex items-baseline justify-between">
                          <span className="font-headline text-base font-bold text-slate-900">
                            {unit.unitTypeName || `Kho Tiêu Chuẩn #${unit.unitCode}`}
                          </span>
                          <span className="font-headline text-base font-bold text-blue-600">
                            {priceFormatted} đ<span className="text-xs font-normal text-slate-500">/tháng</span>
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Phù hợp lưu trữ gia dụng, hành lý, thiết bị cá nhân và hàng hóa thương mại điện tử.
                        </p>

                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                            <span className="text-slate-400 block text-[10px] uppercase font-medium">Diện tích</span>
                            <span className="font-data-tabular font-semibold text-slate-800">{areaVal}</span>
                          </div>
                          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                            <span className="text-slate-400 block text-[10px] uppercase font-medium">Thể tích</span>
                            <span className="font-data-tabular font-semibold text-slate-800">{volumeVal}</span>
                          </div>
                          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                            <span className="text-slate-400 block text-[10px] uppercase font-medium">Khóa cửa</span>
                            <span className="text-slate-800 font-semibold">Smart Lock + PIN</span>
                          </div>
                          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                            <span className="text-slate-400 block text-[10px] uppercase font-medium">An ninh</span>
                            <span className="text-slate-800 font-semibold">CCTV 24/7 chuyên dụng</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 pt-0 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                        <span className="flex items-center gap-1 text-slate-600 font-medium">
                          <span className="material-symbols-outlined text-[14px] text-emerald-600">verified</span>
                          Bảo lưu cọc 100%
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenPolicyModal('cancellation', { id: unit.facilityId, name: unit.facilityName })
                          }}
                          className="inline-flex items-center gap-1 text-cyan-700 hover:text-cyan-800 font-semibold hover:underline cursor-pointer"
                          title="Xem quy định đặt cọc, hủy giữ chỗ & hoàn tiền cọc của cơ sở này"
                        >
                          <span className="material-symbols-outlined text-[14px]">policy</span>
                          <span>Chính sách đặt cọc &amp; hủy</span>
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedBookingUnit({ 
                            id: unit.id, 
                            unitCode: unit.unitCode,
                            name: unit.unitTypeName || `Kho Tiêu Chuẩn #${unit.unitCode}`, 
                            facilityId: unit.facilityId,
                            facilityName: unit.facilityName || 'Hệ thống kho Boxora',
                            priceFormatted: priceFormatted,
                            priceNumber: Number(unit.pricePerMonth || 1250000),
                            depositNumber: Number(unit.depositAmount || unit.pricePerMonth || 1250000),
                            areaSqMeters: unit.areaSqMeters,
                            floorLevel: unit.floorLevel || 'Tầng 1'
                          })
                        }}
                        className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                      >
                        <span>Đặt Giữ Chỗ</span>
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* 5. TAB 3: HỢP ĐỒNG & HÓA ĐƠN (CONTRACTS & BILLING) */}
      {activeTab === 'contracts' && (
        <div className="flex flex-col gap-6">
          {/* Customer Financial KPI Summary Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Tổng chi phí đã thanh toán</span>
                <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">paid</span>
                </span>
              </div>
              <div className="mt-3">
                <div className="text-xl font-bold text-slate-900 font-mono">
                  {loadingPayments ? (
                    <span className="inline-block w-24 h-6 bg-slate-200 animate-pulse rounded"></span>
                  ) : (
                    `${totalAmountPaid.toLocaleString('vi-VN')} ₫`
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  <span className="font-semibold text-emerald-600">{successfulPaymentsCount}</span> giao dịch đã đối soát thành công
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Tiền ký quỹ đặt cọc (Giữ hộ)</span>
                <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">savings</span>
                </span>
              </div>
              <div className="mt-3">
                <div className="text-xl font-bold text-amber-900 font-mono">
                  {loadingPayments || loadingContracts ? (
                    <span className="inline-block w-24 h-6 bg-slate-200 animate-pulse rounded"></span>
                  ) : (
                    `${totalDepositsHeld.toLocaleString('vi-VN')} ₫`
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Được hoàn trả 100% khi thanh lý kho
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Cước thuê kho định kỳ</span>
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">event_repeat</span>
                </span>
              </div>
              <div className="mt-3">
                <div className="text-xl font-bold text-blue-900 font-mono">
                  {loadingContracts ? (
                    <span className="inline-block w-24 h-6 bg-slate-200 animate-pulse rounded"></span>
                  ) : (
                    `${monthlyRentalTotal.toLocaleString('vi-VN')} ₫/tháng`
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Cho {activeContracts.length} kho đang thuê hoạt động
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Hợp đồng có hiệu lực</span>
                <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">description</span>
                </span>
              </div>
              <div className="mt-3">
                <div className="text-xl font-bold text-slate-900 font-mono">
                  {loadingContracts ? (
                    <span className="inline-block w-20 h-6 bg-slate-200 animate-pulse rounded"></span>
                  ) : (
                    `${activeContracts.length} Hợp đồng`
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Ký kết điện tử bảo chứng
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Contracts Table */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">handshake</span>
                </div>
                <div>
                  <h3 className="font-headline text-base font-bold text-slate-900">
                    Danh Sách Hợp Đồng Thuê Kho Điện Tử
                  </h3>
                  <span className="text-xs text-slate-500">Xem chi tiết điều khoản, thời hạn thuê và văn bản hợp đồng đã ký</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleOpenPolicyModal('rental')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-700 text-xs font-bold border border-cyan-200 transition cursor-pointer"
                  title="Xem các quy định về hợp đồng, thanh toán và hoàn trả tiền cọc"
                >
                  <span className="material-symbols-outlined text-[16px]">policy</span>
                  <span>Chính sách thuê kho &amp; Hợp đồng</span>
                </button>
                <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 font-mono text-xs font-bold text-emerald-700">
                  {activeContracts.length} Hợp đồng đang hiệu lực
                </span>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="bg-slate-50/70 p-3.5 sm:p-4 rounded-xl border border-slate-200/90 flex flex-col gap-3">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                {/* Search Input */}
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Tìm theo mã hợp đồng, mã kho, hoặc cơ sở..."
                    value={contractsSearchTerm}
                    onChange={(e) => setContractsSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  {contractsSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setContractsSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
                      title="Xóa tìm kiếm"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Dropdowns */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Facility */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs">
                    <span className="material-symbols-outlined text-[16px] text-slate-500">apartment</span>
                    <span className="text-slate-500 font-medium">Cơ sở:</span>
                    <select
                      value={contractsFacility}
                      onChange={(e) => setContractsFacility(e.target.value)}
                      className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer max-w-[170px] truncate"
                    >
                      <option value="all">
                        {contractsFacilities.length > 1
                          ? `Tất cả cơ sở (${contractsFacilities.length})`
                          : contractsFacilities[0]?.name || 'Tất cả cơ sở'}
                      </option>
                      {contractsFacilities.length > 1 &&
                        contractsFacilities.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Floor */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs">
                    <span className="material-symbols-outlined text-[16px] text-slate-500">layers</span>
                    <span className="text-slate-500 font-medium">Tầng:</span>
                    <select
                      value={contractsFloor}
                      onChange={(e) => setContractsFloor(e.target.value)}
                      className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
                    >
                      <option value="all">Tất cả tầng</option>
                      {contractsFloors.map((fl) => (
                        <option key={fl} value={fl}>
                          Tầng {fl}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Size */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs">
                    <span className="material-symbols-outlined text-[16px] text-slate-500">straighten</span>
                    <span className="text-slate-500 font-medium">Kích cỡ:</span>
                    <select
                      value={contractsSize}
                      onChange={(e) => setContractsSize(e.target.value)}
                      className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
                    >
                      <option value="all">Tất cả kích cỡ</option>
                      <option value="mini">Kho Mini (≤ 5 m²)</option>
                      <option value="family">Kho Gia Đình (6 - 10 m²)</option>
                      <option value="business">Kho Doanh Nghiệp (&gt; 10 m²)</option>
                    </select>
                  </div>

                  {/* Reset Button */}
                  {(contractsSearchTerm || contractsFacility !== 'all' || contractsFloor !== 'all' || contractsSize !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setContractsSearchTerm('')
                        setContractsFacility('all')
                        setContractsFloor('all')
                        setContractsSize('all')
                      }}
                      className="px-2.5 py-2 bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Đặt lại bộ lọc"
                    >
                      <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                      <span className="hidden sm:inline">Đặt lại</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-0.5 border-t border-slate-200/70 flex-wrap gap-2">
                <span>
                  Hiển thị <strong className="text-slate-900 font-bold">{filteredContracts.length}</strong> / {contracts.length} hợp đồng
                </span>
                {(contractsSearchTerm || contractsFacility !== 'all' || contractsFloor !== 'all' || contractsSize !== 'all') && (
                  <span className="text-blue-600 font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">filter_alt</span>
                    <span>Đang lọc theo tiêu chí</span>
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-mono uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 rounded-l-lg font-semibold">Mã Hợp Đồng</th>
                    <th className="py-3 px-4 font-semibold">Mã Kho</th>
                    <th className="py-3 px-4 font-semibold">Cơ Sở</th>
                    <th className="py-3 px-4 font-semibold">Kỳ Hạn Thuê</th>
                    <th className="py-3 px-4 font-semibold text-right">Cước Hàng Tháng</th>
                    <th className="py-3 px-4 font-semibold text-right">Tiền Ký Quỹ Cọc</th>
                    <th className="py-3 px-4 font-semibold text-center">Trạng Thái</th>
                    <th className="py-3 px-4 rounded-r-lg text-right font-semibold">Tác Vụ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {loadingContracts ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                        <div className="flex items-center justify-center gap-2">
                          <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                          <span>Đang nạp danh sách hợp đồng thực tế từ hệ thống database...</span>
                        </div>
                      </td>
                    </tr>
                  ) : contracts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                        Chưa có hợp đồng nào trong hồ sơ của bạn.
                      </td>
                    </tr>
                  ) : filteredContracts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 text-xs">
                        Không tìm thấy hợp đồng nào phù hợp với bộ lọc tìm kiếm đã chọn.
                      </td>
                    </tr>
                  ) : (
                    filteredContracts.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-unit-code text-xs font-bold text-slate-900">#{c.contractCode}</td>
                        <td className="py-3.5 px-4 font-bold text-blue-600">#{c.unitCode}</td>
                        <td className="py-3.5 px-4 text-slate-700">{c.facilityName || 'Boxora Facility'}</td>
                        <td className="py-3.5 px-4 text-slate-700 font-mono">
                          {c.status === 'PENDING_ACTIVATION' ? (
                            <div className="flex flex-col">
                              <span>{c.startDate} — {c.endDate}</span>
                              <span className="text-[10px] text-cyan-700 font-sans font-semibold">
                                (Kích hoạt khi check-in)
                              </span>
                            </div>
                          ) : (
                            `${c.startDate} — ${c.endDate}`
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-data-tabular font-bold text-slate-900 text-right">
                          {Number(c.monthlyFee || 0).toLocaleString('vi-VN')} ₫
                        </td>
                        <td className="py-3.5 px-4 font-data-tabular text-slate-700 text-right font-bold">
                          {getContractDepositHeld(c).toLocaleString('vi-VN')} ₫
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            c.status === 'ACTIVE' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : c.status === 'PENDING_ACTIVATION'
                              ? 'bg-cyan-50 text-cyan-800 border border-cyan-300'
                              : c.status === 'PENDING_SIGNATURE'
                              ? 'bg-amber-50 text-amber-800 border border-amber-300 animate-pulse'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {c.status === 'ACTIVE' 
                              ? 'Đang hiệu lực' 
                              : c.status === 'PENDING_ACTIVATION'
                              ? 'Đã ký • Chờ nhận kho'
                              : c.status === 'PENDING_SIGNATURE' 
                              ? 'Chờ ký số' 
                              : c.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {c.status === 'PENDING_SIGNATURE' && (
                              <button
                                type="button"
                                onClick={() => handleSignContractNow(c)}
                                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-md font-bold text-xs shadow-sm flex items-center gap-1 transition-all cursor-pointer animate-pulse"
                                title="Ký hợp đồng trực tuyến ngay"
                              >
                                <span className="material-symbols-outlined text-[15px]">edit_document</span>
                                <span>Ký ngay</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedContractForModal(c)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md font-semibold text-xs transition-colors cursor-pointer"
                            >
                              Chi tiết
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {/* Section 2: Contract Renewals Table */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">autorenew</span>
                </div>
                <div>
                  <h3 className="font-headline text-base font-bold text-slate-900">
                    Yêu Cầu &amp; Phụ Lục Gia Hạn Hợp Đồng
                  </h3>
                  <span className="text-xs text-slate-500">
                    Theo dõi tình trạng phê duyệt, ký phụ lục điện tử DocuSeal và thanh toán cước kỳ mới
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchMyRenewals}
                  className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center gap-1 transition cursor-pointer"
                  title="Làm mới danh sách gia hạn"
                >
                  <span className="material-symbols-outlined text-[15px]">refresh</span>
                  <span>Làm mới</span>
                </button>
                <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 font-mono text-xs font-bold text-blue-700">
                  {myRenewals.length} Yêu cầu gia hạn
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-mono uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 rounded-l-lg font-semibold">Mã YC / Ngày Yêu Cầu</th>
                    <th className="py-3 px-4 font-semibold">Hợp Đồng / Kho</th>
                    <th className="py-3 px-4 font-semibold">Cơ Sở</th>
                    <th className="py-3 px-4 font-semibold">Thời Hạn Mới</th>
                    <th className="py-3 px-4 font-semibold text-right">Phí Gia Hạn</th>
                    <th className="py-3 px-4 font-semibold text-center">Trạng Thái</th>
                    <th className="py-3 px-4 rounded-r-lg text-right font-semibold">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {loadingRenewals ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                        <div className="flex items-center justify-center gap-2">
                          <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                          <span>Đang tải thông tin gia hạn hợp đồng...</span>
                        </div>
                      </td>
                    </tr>
                  ) : myRenewals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                        Chưa phát sinh yêu cầu gia hạn nào. Quý khách có thể yêu cầu gia hạn tại bảng hợp đồng trên hoặc trong trang "Kho của tôi".
                      </td>
                    </tr>
                  ) : (
                    myRenewals.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-900">#{r.id.slice(0, 8)}...</div>
                          <div className="text-[11px] text-slate-400">
                            {r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '—'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-blue-600">#{r.contractCode}</div>
                          <div className="text-[11px] text-slate-500 font-medium">Kho #{r.unitCode}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {r.facilityName || 'Boxora Facility'}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-emerald-700">{formatDisplayDate(r.newEndDate)}</div>
                          <div className="text-[11px] text-slate-500 font-semibold">+{r.cycleMonths} tháng (từ {formatDisplayDate(r.oldEndDate)})</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-right">
                          {Number(r.renewalFee || 0).toLocaleString('vi-VN')} ₫
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {r.status === 'PENDING_REVIEW' && (
                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                              Chờ QL cơ sở duyệt
                            </span>
                          )}
                          {r.status === 'PENDING_SIGNATURE' && (
                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-300 animate-pulse">
                              Chờ ký phụ lục
                            </span>
                          )}
                          {r.status === 'PENDING_PAYMENT' && (
                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-300">
                              Chờ thanh toán
                            </span>
                          )}
                          {r.status === 'COMPLETED' && (
                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Hoàn tất gia hạn
                            </span>
                          )}
                          {r.status === 'REJECTED' && (
                            <div>
                              <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Bị từ chối
                              </span>
                              {r.rejectionReason && (
                                <div className="text-[10px] text-rose-600 mt-0.5 max-w-[160px] truncate" title={r.rejectionReason}>
                                  Lý do: {r.rejectionReason}
                                </div>
                              )}
                            </div>
                          )}
                          {r.status === 'CANCELLED' && (
                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              Đã hủy
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {r.status === 'PENDING_REVIEW' && (
                              <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Chờ QL cơ sở duyệt
                              </span>
                            )}

                            {r.status === 'PENDING_SIGNATURE' && (
                              r.paymentMethod === 'COUNTER' ? (
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-[10px] text-emerald-800 font-bold flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[13px] text-emerald-600">event</span>
                                    <span>Hẹn quầy: {formatDisplayDate(r.counterAppointmentDate)}{r.counterAppointmentTime ? ` lúc ${r.counterAppointmentTime}` : ''}</span>
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenSwitchMethodModal(r, 'ONLINE')}
                                      className="px-2 py-0.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded text-[11px] font-semibold transition cursor-pointer"
                                    >
                                      Ký Online
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenSwitchMethodModal(r, 'COUNTER')}
                                      className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded text-[11px] font-semibold transition cursor-pointer"
                                    >
                                      Đổi hẹn
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setRenewalForSigning(r)}
                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold text-xs shadow-xs flex items-center gap-1 transition cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">draw</span>
                                    <span>Ký online</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSwitchMethodModal(r, 'COUNTER')}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium text-[11px] flex items-center gap-1 transition cursor-pointer"
                                    title="Chuyển sang đến quầy cơ sở ký và thanh toán"
                                  >
                                    <span className="material-symbols-outlined text-[13px] text-emerald-600">storefront</span>
                                    <span>Đến quầy</span>
                                  </button>
                                </div>
                              )
                            )}

                            {r.status === 'PENDING_PAYMENT' && (
                              <button
                                type="button"
                                onClick={() => handlePayRenewalVNPay(r)}
                                disabled={isPayingRenewal}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-xs shadow-xs flex items-center gap-1 transition cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[14px]">credit_card</span>
                                <span>Thanh toán VNPay</span>
                              </button>
                            )}

                            {['PENDING_REVIEW', 'PENDING_SIGNATURE', 'PENDING_PAYMENT'].includes(r.status) && (
                              <button
                                type="button"
                                onClick={() => handleCancelRenewal(r.id)}
                                className="px-2 py-1 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded-md font-medium text-xs border border-slate-200 hover:border-rose-200 transition cursor-pointer"
                                title="Hủy yêu cầu gia hạn"
                              >
                                Hủy
                              </button>
                            )}

                            {r.status === 'COMPLETED' && (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedRenewalForDocModal(r)}
                                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Xem văn bản phụ lục gia hạn"
                                >
                                  <span className="material-symbols-outlined text-[13px]">description</span>
                                  <span>Xem phụ lục</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const parentContract = contracts.find((c) => c.id === r.contractId) || ({
                                      id: r.contractId,
                                      contractCode: r.contractCode,
                                      unitCode: r.unitCode,
                                      facilityName: r.facilityName,
                                      customerName: r.customerName,
                                      customerEmail: r.customerEmail,
                                      startDate: r.oldEndDate,
                                      endDate: r.newEndDate,
                                      monthlyFee: r.renewalFee / (r.cycleMonths || 1),
                                      status: 'ACTIVE',
                                    } as any)
                                    setSelectedContractForModal(parentContract)
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Xem văn bản hợp đồng gốc"
                                >
                                  <span>Xem HĐ gốc</span>
                                </button>
                              </div>
                            )}

                            {r.status === 'REJECTED' && (() => {
                              const createdAtDate = r.createdAt ? new Date(r.createdAt) : new Date()
                              const unlockDate = new Date(createdAtDate.getTime() + 3 * 24 * 60 * 60 * 1000)
                              const now = new Date()
                              const canReactivate = now >= unlockDate
                              const diffMs = unlockDate.getTime() - now.getTime()
                              const hoursRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)))
                              const daysRemaining = Math.floor(hoursRemaining / 24)
                              const remainingHours = hoursRemaining % 24

                              return canReactivate ? (
                                <button
                                  type="button"
                                  onClick={() => handleReactivateRenewal(r.id)}
                                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-bold text-xs shadow-xs flex items-center gap-1 transition cursor-pointer"
                                  title="Kích hoạt duyệt lại yêu cầu sau 3 ngày"
                                >
                                  <span className="material-symbols-outlined text-[14px]">replay</span>
                                  <span>Duyệt lại</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200" title={`Có thể kích hoạt duyệt lại lúc ${unlockDate.toLocaleString('vi-VN')}`}>
                                  Duyệt lại sau {daysRemaining > 0 ? `${daysRemaining}d ` : ''}{remainingHours}h
                                </span>
                              )
                            })()}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Real DB Payments Ledger & VAT E-Invoices */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                </div>
                <div>
                  <h3 className="font-headline text-base font-bold text-slate-900">
                    Lịch Sử Giao Dịch &amp; Hóa Đơn Điện Tử VAT
                  </h3>
                  <span className="text-xs text-slate-500">
                    Đối soát dữ liệu thanh toán cổng VNPay và nộp tiền thực tế được trích xuất từ database
                  </span>
                </div>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {customerPayments.length} giao dịch phát sinh
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-mono uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 rounded-l-lg font-semibold">Mã GD / Ngày Giờ</th>
                    <th className="py-3 px-4 font-semibold">Mã Kho</th>
                    <th className="py-3 px-4 font-semibold">Cơ Sở</th>
                    <th className="py-3 px-4 font-semibold">Loại Thanh Toán</th>
                    <th className="py-3 px-4 font-semibold">Phương Thức</th>
                    <th className="py-3 px-4 font-semibold text-right">Số Tiền</th>
                    <th className="py-3 px-4 font-semibold text-center">Trạng Thái</th>
                    <th className="py-3 px-4 rounded-r-lg text-right font-semibold">Hóa Đơn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {loadingPayments ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                        <div className="flex items-center justify-center gap-2">
                          <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                          <span>Đang nạp lịch sử giao dịch cá nhân từ database...</span>
                        </div>
                      </td>
                    </tr>
                  ) : customerPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                        Chưa ghi nhận giao dịch thanh toán nào trong tài khoản của bạn.
                      </td>
                    </tr>
                  ) : (
                    customerPayments.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-900">{p.id.slice(0, 8)}...</div>
                          <div className="text-[11px] text-slate-400">
                            {p.paymentTime ? new Date(p.paymentTime).toLocaleString('vi-VN') : '—'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            #{p.unitCode || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {p.facilityName || 'Boxora Facility'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                            p.paymentType === 'DEPOSIT'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {p.paymentType === 'DEPOSIT' ? 'Tiền ký quỹ (Cọc)' : 'Tiền thuê kho'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {p.paymentMethod || 'VNPay'}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-right">
                          {p.amount.toLocaleString('vi-VN')} ₫
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            p.status === 'PAID' || p.status === 'SUCCESS'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : p.status === 'PENDING' || p.status === 'REFUND_PENDING'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : p.status === 'REFUNDED'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {p.status === 'PAID' || p.status === 'SUCCESS'
                              ? 'Thành công'
                              : p.status === 'PENDING'
                              ? 'Chờ xử lý'
                              : p.status === 'REFUND_PENDING'
                              ? 'Chờ hoàn tiền'
                              : p.status === 'REFUNDED'
                              ? 'Đã ghi nhận hoàn tiền'
                              : 'Thất bại'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedVatPayment(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">receipt</span>
                            <span>Biên lai VAT</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. TAB 4: HỖ TRỢ & BÁO SỰ CỐ (SUPPORT) */}
      {activeTab === 'support' && (
        <div className="flex flex-col gap-6">
          <section className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 flex flex-col gap-4">
                <div className="flex items-center gap-1.5 text-blue-600 font-unit-code text-xs font-bold">
                  <span>TRUNG TÂM PHẢN HỒI KHÁCH HÀNG 24/7</span>
                </div>
                <h3 className="font-headline text-xl font-bold text-slate-900">
                  Hỗ Trợ Kỹ Thuật &amp; Khóa Kho
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Đội ngũ kỹ thuật và bảo vệ trực ca tại trạm sẵn sàng xử lý yêu cầu của bạn nhanh chóng. Các sự cố kẹt cửa cuốn hoặc quên mã PIN được giải quyết trong vòng 3 phút.
                </p>

                <div className="mt-2 flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                  <div>
                    Hotline khẩn cấp: <strong className="text-slate-900 font-bold">1900 6828 (Ext. 1)</strong>
                  </div>
                  <div>
                    Thời gian tiếp nhận: <strong>24/7 không ngày nghỉ</strong>
                  </div>
                  <div>
                    Bảo vệ chốt cổng hỗ trợ người thân &amp; xe tải ra vào
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 bg-slate-50 border border-slate-200 p-6 rounded-xl">
                {ticketSubmitted ? (
                  <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[28px]">check</span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">Yêu Cầu Đã Được Tiếp Nhận!</h4>
                    <p className="text-xs text-slate-500 max-w-xs">
                      Nhân viên phụ trách đang xử lý và sẽ phản hồi hoặc liên hệ lại với bạn ngay lập tức.
                    </p>
                  </div>
                ) : (
                  <form className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left" onSubmit={handleSupportSubmit}>
                    {activeContracts.length === 0 && (
                      <div className="sm:col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0">info</span>
                        <span>
                          Quý khách chưa có ngăn kho nào đang ở trạng thái hoạt động (ACTIVE). Báo cáo sự cố chỉ áp dụng cho các cơ sở có kho đã hoàn tất nhận bàn giao (check-in) và đang kích hoạt sử dụng.
                        </span>
                      </div>
                    )}

                    {/* Cơ sở: Chỉ hiển thị cơ sở đang có kho với status là đang hoạt động */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span>Cơ sở lưu trữ</span>
                        {supportFacilities.length > 0 && (
                          <span className="text-[10px] text-emerald-600 font-semibold lowercase">
                            ({supportFacilities.length} cơ sở có kho hoạt động)
                          </span>
                        )}
                      </label>
                      {supportFacilities.length > 1 ? (
                        <select
                          value={ticketFormFacilityId}
                          onChange={(e) => setTicketFormFacilityId(e.target.value)}
                          className="h-10 px-3 bg-white border border-slate-200 text-slate-900 text-xs font-semibold rounded-lg focus:outline-none focus:border-slate-400"
                        >
                          {supportFacilities.map(f => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      ) : supportFacilities.length === 1 ? (
                        <div className="h-10 px-3 bg-slate-100 border border-slate-200 text-slate-900 text-xs font-semibold rounded-lg flex items-center justify-between">
                          <span className="truncate">{supportFacilities[0].name}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold shrink-0">
                            Đang hoạt động
                          </span>
                        </div>
                      ) : (
                        <div className="h-10 px-3 bg-slate-100 border border-slate-200 text-slate-500 text-xs font-medium rounded-lg flex items-center">
                          Chưa có cơ sở nào có kho hoạt động
                        </div>
                      )}
                    </div>

                    {/* Kho lưu trữ liên quan: Chỉ hiển thị các kho đang hoạt động của cơ sở này */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Kho lưu trữ liên quan
                      </label>
                      <select
                        value={ticketUnit}
                        onChange={(e) => setTicketUnit(e.target.value)}
                        disabled={availableActiveUnitsForTicket.length === 0}
                        className="h-10 px-3 bg-white border border-slate-200 text-slate-900 text-xs font-semibold rounded-lg focus:outline-none focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {availableActiveUnitsForTicket.length > 0 ? (
                          availableActiveUnitsForTicket.map(c => (
                            <option key={c.unitCode} value={c.unitCode}>
                              Kho #{c.unitCode} ({c.facilityName})
                            </option>
                          ))
                        ) : (
                          <option value="">Chưa có kho hoạt động tại cơ sở này</option>
                        )}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Vấn đề cần hỗ trợ
                      </label>
                      <select
                        value={ticketType}
                        onChange={(e) => {
                          setTicketType(e.target.value)
                          if (ticketError) setTicketError(null)
                        }}
                        className="h-10 px-3 bg-white border border-slate-200 text-slate-900 text-xs font-semibold rounded-lg focus:outline-none focus:border-slate-400"
                      >
                        <option value="lock">Sự cố khóa thông minh / Kẹt cửa cuốn</option>
                        <option value="access">Không thể truy cập kho / Cửa ra vào trạm</option>
                        <option value="cleanliness">Vệ sinh &amp; Côn trùng trong kho</option>
                        <option value="climate">Kiểm tra nhiệt độ / Độ ẩm phòng</option>
                        <option value="facility_damage">Hư hỏng thiết bị &amp; Cơ sở vật chất</option>
                        <option value="pin">Yêu cầu cấp lại mã PIN mới</option>
                        <option value="billing">Hỗ trợ thanh toán &amp; Hóa đơn VAT</option>
                        <option value="other">Khác</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Mức độ ảnh hưởng (Ưu tiên)
                      </label>
                      <select
                        value={ticketPriority}
                        onChange={(e) => setTicketPriority(e.target.value)}
                        className="h-10 px-3 bg-white border border-slate-200 text-slate-900 text-xs font-semibold rounded-lg focus:outline-none focus:border-slate-400"
                      >
                        <option value="LOW">Thấp - Thắc mắc / Góp ý thông thường</option>
                        <option value="MEDIUM">Bình thường - Cần xử lý trong 24h</option>
                        <option value="HIGH">Cao - Ảnh hưởng việc bốc dỡ hàng / Ra vào</option>
                        <option value="URGENT">Khẩn cấp - Không mở được kho / Kẹt hàng hóa</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Mô tả chi tiết nội dung {ticketType === 'other' ? <span className="text-rose-500 font-bold">* (Bắt buộc ghi rõ mô tả)</span> : ''}
                        </label>
                        {ticketType === 'other' && (
                          <span className="text-[11px] text-amber-700 font-medium">Vui lòng nêu rõ vấn đề cần xử lý</span>
                        )}
                      </div>
                      <textarea
                        rows={3}
                        value={ticketContent}
                        onChange={(e) => {
                          setTicketContent(e.target.value)
                          if (ticketError) setTicketError(null)
                        }}
                        required
                        placeholder={
                          ticketType === 'other'
                            ? "Vui lòng ghi rõ mô tả cụ thể và chi tiết vấn đề bạn đang gặp phải để đội ngũ Boxora hỗ trợ..."
                            : "Mô tả cụ thể sự cố cần xử lý..."
                        }
                        className={`p-3 bg-white border text-slate-900 text-xs rounded-lg focus:outline-none transition-colors ${
                          ticketType === 'other' && !ticketContent.trim()
                            ? 'border-amber-400 focus:border-amber-500 bg-amber-50/20'
                            : 'border-slate-200 focus:border-slate-400'
                        }`}
                      ></textarea>
                    </div>

                    {ticketError && (
                      <div className="sm:col-span-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">error</span>
                        <span>{ticketError}</span>
                      </div>
                    )}

                    <div className="sm:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                      <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                        Đội ngũ Boxora sẽ phản hồi và giải quyết vấn đề sớm nhất có thể
                      </span>
                      <button
                        type="submit"
                        disabled={isSubmittingTicket || activeContracts.length === 0}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-lg transition-colors shadow-sm cursor-pointer self-end sm:self-auto"
                      >
                        {isSubmittingTicket ? 'Đang gửi...' : 'Gửi Yêu Cầu'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </section>

          {/* LỊCH SỬ BÁO CÁO & PHẢN HỒI SỰ CỐ */}
          <section className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2 text-blue-600 font-mono text-xs font-bold uppercase tracking-wider mb-1">
                  <span className="material-symbols-outlined text-[16px]">history</span>
                  <span>NHẬT KÝ PHẢN HỒI &amp; XỬ LÝ SỰ CỐ</span>
                </div>
                <h3 className="font-headline text-lg font-bold text-slate-900">
                  Lịch Sử Báo Cáo Sự Cố
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Theo dõi tiến độ, thời gian tiếp nhận và kết quả xử lý thực tế từ kỹ thuật viên và bảo vệ cơ sở Boxora.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchCustomerTickets}
                  disabled={loadingTickets}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  title="Tải lại danh sách báo cáo mới nhất"
                >
                  <span className={`material-symbols-outlined text-[16px] ${loadingTickets ? 'animate-spin' : ''}`}>
                    sync
                  </span>
                  <span>{loadingTickets ? 'Đang tải...' : 'Làm mới'}</span>
                </button>
              </div>
            </div>

            {/* Filters & Search Toolbar */}
            <div className="bg-slate-50/70 p-3.5 sm:p-4 rounded-xl border border-slate-200/90 flex flex-col gap-3">
              {/* Row 1: Search & Status Filter Pills */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                {/* Search Input */}
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Tìm theo mã phiếu (TK-...), kho, tiêu đề, hoặc nội dung..."
                    value={ticketSearchTerm}
                    onChange={(e) => setTicketSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  {ticketSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setTicketSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
                      title="Xóa tìm kiếm"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Status Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
                  {[
                    { key: 'ALL', label: 'Tất cả', count: customerTickets.length },
                    { key: 'PENDING', label: 'Chờ tiếp nhận', count: customerTickets.filter(t => t.status === 'OPEN' || t.status === 'PENDING').length },
                    { key: 'IN_PROGRESS', label: 'Đang xử lý', count: customerTickets.filter(t => t.status === 'IN_PROGRESS').length },
                    { key: 'RESOLVED', label: 'Đã giải quyết', count: customerTickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setTicketStatusFilter(tab.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                        ticketStatusFilter === tab.key
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          ticketStatusFilter === tab.key
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 2: Facility, Floor, Size Filter Dropdowns & Stats */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200/60">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Facility */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs">
                    <span className="material-symbols-outlined text-[16px] text-slate-500">apartment</span>
                    <span className="text-slate-500 font-medium">Cơ sở:</span>
                    <select
                      value={ticketFacility}
                      onChange={(e) => setTicketFacility(e.target.value)}
                      className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer max-w-[170px] truncate"
                    >
                      <option value="all">
                        {supportFacilities.length > 1
                          ? `Tất cả cơ sở (${supportFacilities.length})`
                          : supportFacilities[0]?.name || 'Chưa có cơ sở hoạt động'}
                      </option>
                      {supportFacilities.length > 1 &&
                        supportFacilities.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Floor */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs">
                    <span className="material-symbols-outlined text-[16px] text-slate-500">layers</span>
                    <span className="text-slate-500 font-medium">Tầng:</span>
                    <select
                      value={ticketFloor}
                      onChange={(e) => setTicketFloor(e.target.value)}
                      className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
                    >
                      <option value="all">Tất cả tầng</option>
                      {supportFloors.map((fl) => (
                        <option key={fl} value={fl}>
                          Tầng {fl}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Size */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs">
                    <span className="material-symbols-outlined text-[16px] text-slate-500">aspect_ratio</span>
                    <span className="text-slate-500 font-medium">Kích cỡ:</span>
                    <select
                      value={ticketSize}
                      onChange={(e) => setTicketSize(e.target.value)}
                      className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
                    >
                      <option value="all">Tất cả cỡ</option>
                      <option value="mini">Mini (≤ 5m²)</option>
                      <option value="family">Gia đình (6-10m²)</option>
                      <option value="business">Doanh nghiệp (&gt; 10m²)</option>
                    </select>
                  </div>

                  {/* Reset Filters */}
                  {(ticketSearchTerm || ticketFacility !== 'all' || ticketFloor !== 'all' || ticketSize !== 'all' || ticketStatusFilter !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setTicketSearchTerm('')
                        setTicketFacility('all')
                        setTicketFloor('all')
                        setTicketSize('all')
                        setTicketStatusFilter('ALL')
                      }}
                      className="px-2.5 py-2 bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Đặt lại bộ lọc"
                    >
                      <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                      <span className="hidden sm:inline">Đặt lại</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span>
                    Hiển thị <strong className="text-slate-900 font-bold">{filteredCustomerTickets.length}</strong> / {customerTickets.length} sự cố
                  </span>
                  {(ticketSearchTerm || ticketFacility !== 'all' || ticketFloor !== 'all' || ticketSize !== 'all') && (
                    <span className="text-blue-600 font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">filter_alt</span>
                      <span>Đang lọc</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* List Content */}
            {loadingTickets ? (
              <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[32px] text-blue-600 animate-spin">sync</span>
                <span>Đang tải lịch sử báo cáo sự cố từ hệ thống...</span>
              </div>
            ) : (() => {
              const filteredTickets = filteredCustomerTickets

              if (filteredTickets.length === 0) {
                return (
                  <div className="p-10 text-center flex flex-col items-center justify-center gap-3 bg-slate-50/70 border border-slate-200 rounded-xl">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[28px]">assignment_turned_in</span>
                    </div>
                    <div className="max-w-md">
                      <h4 className="text-sm font-bold text-slate-800">
                        {ticketSearchTerm || ticketStatusFilter !== 'ALL' || ticketFacility !== 'all' || ticketFloor !== 'all' || ticketSize !== 'all'
                          ? 'Không có báo cáo sự cố nào phù hợp bộ lọc'
                          : 'Chưa có yêu cầu hỗ trợ hoặc báo cáo sự cố nào'}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {ticketSearchTerm || ticketStatusFilter !== 'ALL' || ticketFacility !== 'all' || ticketFloor !== 'all' || ticketSize !== 'all'
                          ? 'Thử thay đổi từ khóa tìm kiếm, cơ sở/tầng hoặc chọn bộ lọc trạng thái khác.'
                          : 'Khi gặp sự cố khóa thông minh, kẹt cửa cuốn, cần cấp lại mã PIN hoặc hỗ trợ thanh toán, bạn có thể gửi yêu cầu ở biểu mẫu phía trên.'}
                      </p>
                    </div>
                  </div>
                )
              }

              return (
                <div className="space-y-4">
                  {filteredTickets.map(t => {
                    const catMeta = getTicketCategoryMeta(t.category)
                    const statusMeta = getTicketStatusMeta(t.status)
                    const priorityMeta = getTicketPriorityMeta(t.priority)
                    const isResolved = t.status === 'RESOLVED' || t.status === 'CLOSED'
                    const isInProgress = t.status === 'IN_PROGRESS'

                    return (
                      <div
                        key={t.id}
                        className="p-5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs transition-all space-y-4 text-left"
                      >
                        {/* Top: Header metadata */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-extrabold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                              #{t.ticketCode || t.id.substring(0, 8).toUpperCase()}
                            </span>

                            {t.unitCode && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                <span className="material-symbols-outlined text-[13px]">warehouse</span>
                                <span>Kho #{t.unitCode}</span>
                              </span>
                            )}

                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${catMeta.color}`}>
                              <span className="material-symbols-outlined text-[13px]">{catMeta.icon}</span>
                              <span>{catMeta.label}</span>
                            </span>

                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${priorityMeta.badge}`}>
                              Ưu tiên: {priorityMeta.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-slate-400">
                              {formatDisplayDateTime(t.createdAt)}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusMeta.badge}`}>
                              <span className="material-symbols-outlined text-[14px]">{statusMeta.icon}</span>
                              <span>{statusMeta.label}</span>
                            </span>
                          </div>
                        </div>

                        {/* Title & Description */}
                        <div className="space-y-1.5">
                          <h4 className="text-sm font-bold text-slate-900">
                            {t.title}
                          </h4>
                          <div className="text-xs text-slate-700 bg-slate-50/80 p-3 rounded-lg border border-slate-100 leading-relaxed whitespace-pre-wrap">
                            {t.description}
                          </div>
                        </div>

                        {/* Resolution Note / Status update from Boxora */}
                        {t.status === 'RESOLVED' ? (
                          <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="material-symbols-outlined text-[20px]">verified</span>
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-emerald-900 text-sm">
                                    Kết quả xử lý từ nhân viên Boxora:
                                  </span>
                                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/90 px-2.5 py-0.5 rounded-full border border-emerald-300">
                                    ✓ Đã xử lý - Chờ xác nhận
                                  </span>
                                </div>
                                <p className="text-xs text-emerald-900 leading-relaxed font-medium">
                                  {t.resolutionNote || 'Kỹ thuật viên đã kiểm tra hiện trường cơ sở và giải quyết hoàn tất yêu cầu của quý khách.'}
                                </p>
                              </div>
                            </div>

                            {/* Customer confirmation action bar */}
                            <div className="border-t border-emerald-200/80 pt-3 flex flex-wrap items-center justify-between gap-2.5">
                              <span className="text-[11px] text-emerald-800 font-medium">
                                Quý khách vui lòng xác nhận sự cố đã hết hoặc gửi yêu cầu xử lý lại nếu chưa khắc phục triệt để:
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={isProcessingTicketAction}
                                  onClick={() => {
                                    setCloseTicketTarget(t)
                                    setTicketActionError(null)
                                  }}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                  <span>Xác nhận hài lòng &amp; Đóng phiếu</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isProcessingTicketAction}
                                  onClick={() => {
                                    setReopenModalTicket(t)
                                    setReopenReasonText('')
                                  }}
                                  className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                                  <span>Yêu cầu xử lý lại</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : t.status === 'CLOSED' ? (
                          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-3">
                            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                              <span className="material-symbols-outlined text-[18px]">lock</span>
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-800">
                                  Phiếu sự cố đã được nghiệm thu đóng
                                </span>
                                <span className="text-[10px] font-semibold text-slate-600 bg-slate-200 px-2 py-0.5 rounded">
                                  ĐÃ ĐÓNG
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed">
                                {t.resolutionNote || 'Vấn đề đã được giải quyết và xác nhận nghiệm thu hoàn tất.'}
                              </p>
                            </div>
                          </div>
                        ) : t.status === 'REOPENED' ? (
                          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-950 flex items-start gap-3">
                            <div className="w-7 h-7 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                              <span className="material-symbols-outlined text-[18px]">cached</span>
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-amber-900">
                                  Đã yêu cầu xử lý lại (Đang mở lại)
                                </span>
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-200 px-2 py-0.5 rounded">
                                  CẦN KIỂM TRA LẠI
                                </span>
                              </div>
                              <p className="text-xs text-amber-900 leading-relaxed font-medium">
                                {t.resolutionNote ? `Lý do / Ghi chú: ${t.resolutionNote}` : 'Kỹ thuật viên ca trực đang được điều phối kiểm tra và xử lý lại sự cố.'}
                              </p>
                            </div>
                          </div>
                        ) : isInProgress ? (
                          <div className="p-3.5 rounded-lg bg-blue-50/80 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
                            <span className="material-symbols-outlined text-[18px] text-blue-600 shrink-0 mt-0.5 animate-spin">
                              sync
                            </span>
                            <div className="flex-1">
                              <strong>Đang xử lý:</strong> Kỹ thuật viên / bảo vệ ca trực Boxora đang kiểm tra hiện trường cơ sở.
                              {t.resolutionNote && (
                                <p className="mt-1 text-slate-700 font-medium">Ghi chú điều phối: {t.resolutionNote}</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                            <span className="material-symbols-outlined text-[18px] text-amber-700 shrink-0 mt-0.5">
                              schedule
                            </span>
                            <div>
                              <strong>Chờ tiếp nhận:</strong> Yêu cầu đã được chuyển tới ca trực tại trạm. Đội ngũ kỹ thuật sẽ tiếp nhận và tiến hành xử lý trong ít phút.
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </section>
        </div>
      )}

      {selectedBookingUnit && (
        <PortalBookingReservationModal
          unit={selectedBookingUnit}
          onClose={() => setSelectedBookingUnit(null)}
          onNavigate={handleTabChange}
          onRefresh={async () => {
            await Promise.all([fetchCustomerBookings(), fetchContracts(), fetchCustomerPayments(), fetchAvailableUnits()])
          }}
        />
      )}
      {/* 1. RENEWAL MODAL: YÊU CẦU GIA HẠN HỢP ĐỒNG */}
      {renewModalData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[92vh] overflow-y-auto">
            {renewSuccess && createdRenewal ? (
              <div className="py-4 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                  <span className="material-symbols-outlined text-[32px]">check_circle</span>
                </div>
                <div className="space-y-1">
                  <h3 className="font-headline text-lg font-bold text-slate-900">
                    Khởi Tạo Yêu Cầu Gia Hạn Thành Công!
                  </h3>
                  <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                    Yêu cầu gia hạn thêm <strong>{createdRenewal.cycleMonths} tháng</strong> cho hợp đồng <strong>#{createdRenewal.contractCode}</strong> (Kho #{createdRenewal.unitCode}) đã được ghi nhận trên hệ thống Boxora.
                  </p>
                </div>

                {/* Status Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border">
                  {createdRenewal.status === 'PENDING_REVIEW' && (
                    <span className="bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">pending_actions</span>
                      <span>Chờ Quản Lý Cơ Sở Phê Duyệt</span>
                    </span>
                  )}
                  {createdRenewal.status === 'PENDING_SIGNATURE' && (
                    <span className="bg-blue-100 text-blue-800 border border-blue-300 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">draw</span>
                      <span>Đã Duyệt • Chờ Ký Phụ Lục Điện Tử</span>
                    </span>
                  )}
                  {createdRenewal.status === 'PENDING_PAYMENT' && (
                    <span className="bg-indigo-100 text-indigo-800 border border-indigo-300 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">payments</span>
                      <span>Đã Ký • Chờ Thanh Toán Phí Gia Hạn</span>
                    </span>
                  )}
                  {createdRenewal.status === 'COMPLETED' && (
                    <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">verified</span>
                      <span>Gia Hạn Hoàn Tất Thành Công</span>
                    </span>
                  )}
                </div>

                {/* Information Card */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-left space-y-2">
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Mã yêu cầu</span>
                    <span className="font-mono font-bold text-slate-800">#{createdRenewal.id.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Thời hạn hiện tại</span>
                    <span className="font-mono text-slate-700">{formatDisplayDate(createdRenewal.oldEndDate)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Thời hạn kết thúc mới</span>
                    <span className="font-mono font-bold text-emerald-700">{formatDisplayDate(createdRenewal.newEndDate)}</span>
                  </div>
                  <div className="flex justify-between py-1 pt-1.5">
                    <span className="font-semibold text-slate-700">Tổng phí gia hạn dự kiến</span>
                    <span className="font-mono font-extrabold text-blue-700 text-sm">
                      {Number(createdRenewal.renewalFee || 0).toLocaleString('vi-VN')} ₫
                    </span>
                  </div>
                </div>

                {/* Next Step Action Buttons */}
                <div className="space-y-2 pt-2">
                  {createdRenewal.status === 'PENDING_SIGNATURE' && (
                    <button
                      type="button"
                      onClick={() => {
                        setRenewalForSigning(createdRenewal)
                        setRenewModalData(null)
                      }}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">draw</span>
                      <span>Ký Phụ Lục Gia Hạn Ngay (DocuSeal)</span>
                    </button>
                  )}

                  {createdRenewal.status === 'PENDING_PAYMENT' && (
                    <button
                      type="button"
                      onClick={() => handlePayRenewalVNPay(createdRenewal)}
                      disabled={isPayingRenewal}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">credit_card</span>
                      <span>Thanh Toán VNPay ({Number(createdRenewal.renewalFee || 0).toLocaleString('vi-VN')} ₫)</span>
                    </button>
                  )}

                  {createdRenewal.status === 'PENDING_REVIEW' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 text-left flex items-start gap-2">
                      <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0 mt-0.5">info</span>
                      <p className="leading-relaxed">
                        Yêu cầu gia hạn của bạn đang được Ban Quản Lý cơ sở xem xét theo quy định. Bạn sẽ nhận được thông báo ngay khi có kết quả để ký phụ lục và hoàn tất thanh toán.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setRenewSuccess(false)
                        setRenewModalData(null)
                        setActiveTab('contracts')
                      }}
                      className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                    >
                      Xem trong Hợp đồng &amp; Gia hạn
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenewSuccess(false)
                        setRenewModalData(null)
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Modal Header */}
                <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-600 text-[22px]">autorenew</span>
                      <h3 className="font-headline text-base font-bold text-slate-900">
                        Yêu Cầu Gia Hạn Hợp Đồng
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Kho #{renewModalData.unitCode} • {renewModalData.facilityName}
                    </p>
                  </div>
                  <button
                    onClick={() => setRenewModalData(null)}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* A. THÔNG TIN HỢP ĐỒNG HIỆN TẠI */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center">A</span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Thông tin hợp đồng hiện tại
                    </h4>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs space-y-2">
                    <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-medium">Mã hợp đồng</span>
                      <span className="font-mono font-bold text-slate-900">{renewModalData.contractCode}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-medium">Khách hàng</span>
                      <span className="font-bold text-slate-900">{renewModalData.customerName}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-medium">Cơ sở / Kho</span>
                      <span className="font-bold text-slate-900">{renewModalData.facilityName} / #{renewModalData.unitCode}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-medium">Thời hạn hiện tại</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatDisplayDate(renewModalData.startDate)} – {formatDisplayDate(renewModalData.endDate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-500 font-medium">Giá thuê chính thức</span>
                      <span className="font-mono font-bold text-blue-700">
                        {Number(renewModalData.monthlyPrice || 0).toLocaleString('vi-VN')} ₫/tháng
                      </span>
                    </div>
                  </div>
                </div>

                {/* B. THÔNG TIN GIA HẠN */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center">B</span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Thông tin gia hạn
                    </h4>
                  </div>

                  <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    {/* Thời gian gia hạn options */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1.5 uppercase tracking-wider">
                        Thời gian gia hạn thêm
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[1, 3, 6, 12].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setRenewMonths(m)}
                            className={`py-2 px-1 text-center rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              renewMonths === m
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {m} tháng
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quy trình gia hạn hướng dẫn */}
                    <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-1 text-xs text-blue-900 text-left">
                      <div className="flex items-center gap-1.5 font-bold text-blue-950">
                        <span className="material-symbols-outlined text-[17px] text-blue-700">info</span>
                        <span>Quy trình gia hạn hợp đồng Boxora</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Yêu cầu gia hạn của bạn sẽ được chuyển tới Quản lý cơ sở xem xét phê duyệt. Sau khi được duyệt, bạn sẽ chọn hình thức thực hiện (ký điện tử &amp; thanh toán trực tuyến hoặc đến trực tiếp cơ sở) và thanh toán cước phí.
                      </p>
                    </div>

                    {/* Pricing breakdown according to business policy */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1.5">
                      <div className="flex justify-between text-slate-600">
                        <span>Giá thuê mỗi tháng:</span>
                        <span className="font-mono font-bold text-slate-800">
                          {Number(renewModalData.monthlyPrice || 0).toLocaleString('vi-VN')} ₫
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Chiết khấu (%):</span>
                        <span className="font-mono text-emerald-600 font-semibold">0% (theo chính sách)</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Phí khác:</span>
                        <span className="font-mono text-slate-700">0 ₫</span>
                      </div>
                    </div>

                    {/* Ghi chú */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">
                        Ghi chú gửi quản lý (tùy chọn)
                      </label>
                      <input
                        type="text"
                        value={renewNotes}
                        onChange={(e) => setRenewNotes(e.target.value)}
                        placeholder="Ví dụ: Mong muốn tiếp tục lưu trữ tài liệu..."
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* Tổng tiền dự kiến */}
                    <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Tổng tiền gia hạn dự kiến
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {Number(renewModalData.monthlyPrice || 0).toLocaleString('vi-VN')} ₫ × {renewMonths} tháng
                        </span>
                      </div>
                      <div className="font-mono text-xl sm:text-2xl font-extrabold text-blue-700">
                        {totalRenewEstimate.toLocaleString('vi-VN')} ₫
                      </div>
                    </div>

                    {/* Thông báo lỗi - Đặt ngay dưới Tổng tiền gia hạn dự kiến */}
                    {renewError && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in duration-150">
                        <span className="material-symbols-outlined text-[20px] text-rose-600 shrink-0 mt-0.5">error</span>
                        <div className="space-y-0.5">
                          <div className="font-bold text-rose-900">Không thể gửi yêu cầu gia hạn</div>
                          <div className="leading-relaxed">{renewError}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action buttons */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setRenewModalData(null)}
                    disabled={isSubmittingRenewal}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRenewal}
                    disabled={isSubmittingRenewal}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSubmittingRenewal ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        <span>Đang gửi yêu cầu...</span>
                      </>
                    ) : (
                      <span>Gửi Yêu Cầu Gia Hạn</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DocuSeal Renewal Addendum Modal */}
      {renewalForSigning && (
        <DocuSealRenewalModal
          renewal={renewalForSigning}
          onClose={() => setRenewalForSigning(null)}
          onSignedSuccess={async (updated) => {
            setCreatedRenewal(updated)
            await fetchMyRenewals()
            await fetchContracts()
          }}
          onProceedToPayment={(ren) => {
            void handlePayRenewalVNPay(ren)
          }}
        />
      )}

      {/* Switch Renewal Method Modal (Chọn / Đổi sang Trực Tuyến hoặc Trực Tiếp Tại Cơ Sở) */}
      {switchMethodTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
                </div>
                <div>
                  <h3 className="font-headline text-base font-bold text-slate-900">
                    Chọn Phương Thức Ký &amp; Thanh Toán
                  </h3>
                  <p className="text-xs text-slate-500">
                    Hợp đồng #{switchMethodTarget.contractCode} • Kho #{switchMethodTarget.unitCode}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSwitchMethodTarget(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {switchMethodError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                <span className="material-symbols-outlined text-rose-600 text-[18px] shrink-0 mt-0.5">error</span>
                <span className="leading-relaxed">{switchMethodError}</span>
              </div>
            )}

            <form onSubmit={handleSwitchMethodSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Hình thức thực hiện
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSwitchMethodMode('ONLINE')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                      switchMethodMode === 'ONLINE'
                        ? 'bg-blue-50/90 border-blue-600 ring-1 ring-blue-600 text-blue-900'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <span className="material-symbols-outlined text-[17px] text-blue-600">draw</span>
                      <span>Trực tuyến 24/7</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Ký phụ lục DocuSeal &amp; thanh toán VNPay online ngay.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const isSigned = !!(switchMethodTarget.signedAt || switchMethodTarget.signatureData || switchMethodTarget.status === 'PENDING_PAYMENT')
                      if (isSigned) {
                        setSwitchMethodError('Phụ lục gia hạn đã được ký điện tử trực tuyến, bắt buộc hoàn tất thanh toán trực tuyến qua VNPay và không thể đổi sang hình thức trực tiếp tại quầy.')
                        return
                      }
                      setSwitchMethodMode('COUNTER')
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                      switchMethodMode === 'COUNTER'
                        ? 'bg-emerald-50/90 border-emerald-600 ring-1 ring-emerald-600 text-emerald-900'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <span className="material-symbols-outlined text-[17px] text-emerald-600">storefront</span>
                      <span>Tại cơ sở Boxora</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Đến quầy ký phụ lục giấy &amp; thanh toán cước trực tiếp.
                    </p>
                  </button>
                </div>
              </div>

              {switchMethodMode === 'COUNTER' && (
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-3 text-xs animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 font-bold text-emerald-900">
                        <span className="material-symbols-outlined text-[16px] text-emerald-700">calendar_month</span>
                        <span>Ngày hẹn đến cơ sở <span className="text-rose-500">*</span></span>
                      </label>
                      <input
                        type="date"
                        required
                        value={switchAppointmentDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setSwitchAppointmentDate(e.target.value)}
                        className="w-full h-9 px-3 bg-white border border-emerald-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 font-bold text-emerald-900">
                        <span className="material-symbols-outlined text-[16px] text-emerald-700">schedule</span>
                        <span>Giờ hẹn check-in <span className="text-rose-500">*</span></span>
                      </label>
                      <input
                        type="time"
                        required
                        value={switchAppointmentTime}
                        onChange={(e) => setSwitchAppointmentTime(e.target.value)}
                        className="w-full h-9 px-3 bg-white border border-emerald-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400"
                      />
                    </div>
                  </div>

                  {/* Preset quick times for convenience */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-500 font-medium">Khung giờ gợi ý:</span>
                    {['09:00', '10:30', '14:00', '16:00', '17:30'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSwitchAppointmentTime(preset)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                          switchAppointmentTime === preset
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Vui lòng chọn ngày và giờ bạn sẽ đến cơ sở <strong>{switchMethodTarget.facilityName}</strong> để ký phụ lục giấy và thanh toán phí.
                  </p>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Ghi chú gửi quản lý / nhân viên (tùy chọn)
                </label>
                <input
                  type="text"
                  value={switchMethodNotes}
                  onChange={(e) => setSwitchMethodNotes(e.target.value)}
                  placeholder="Ví dụ: Tôi sẽ ghé buổi sáng khoảng 10h..."
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSwitchMethodTarget(null)}
                  disabled={isSubmittingSwitchMethod}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSwitchMethod}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingSwitchMethod ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>Xác Nhận Thay Đổi</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. PIN CHANGE MODAL: YÊU CẦU ĐỔI MÃ PIN */}
      {pinChangeUnit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            {pinChangeSuccess ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-[28px]">check_circle</span>
                </div>
                <h3 className="font-headline text-base font-bold text-slate-900">
                  Đổi Mã PIN Thành Công!
                </h3>
                <p className="text-xs text-slate-600">
                  Mã PIN mới đã được lưu trong Boxora. Việc đồng bộ hoặc hoạt động của khóa vật lý chưa được xác minh; vui lòng kiểm tra với cơ sở trước khi sử dụng.
                </p>
                <button
                  onClick={() => {
                    setPinChangeSuccess(false)
                    setPinChangeUnit(null)
                    setNewPin('')
                    setConfirmPin('')
                  }}
                  className="mt-2 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            ) : (
              <form onSubmit={handlePinChangeSubmit} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-headline text-base font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-blue-600 text-[20px]">lock_reset</span>
                      Yêu Cầu Đổi Mã PIN
                    </h3>
                    <span className="text-xs text-slate-500">Kho #{pinChangeUnit.unitCode}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPinChangeUnit(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs text-slate-600 leading-relaxed">
                  Mã PIN gồm đúng <strong>6 chữ số</strong> được lưu trong Boxora. Khóa vật lý chỉ sử dụng được mã nếu cơ sở đã cài đặt và xác minh riêng.
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1 uppercase tracking-wider">
                      Mã PIN mới (6 chữ số)
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Nhập 6 số mới (VD: 123456)"
                      value={newPin}
                      onChange={(e) => {
                        setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                        setPinChangeError('')
                      }}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg font-mono text-sm tracking-widest text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1 uppercase tracking-wider">
                      Xác nhận mã PIN mới
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Nhập lại 6 số mới"
                      value={confirmPin}
                      onChange={(e) => {
                        setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                        setPinChangeError('')
                      }}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg font-mono text-sm tracking-widest text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateRandomPin}
                    className="w-full py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">shuffle</span>
                    <span>Tạo ngẫu nhiên 6 số an toàn</span>
                  </button>

                  {pinChangeError && (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">error</span>
                      <span>{pinChangeError}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPinChangeUnit(null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPinChange}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isSubmittingPinChange ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        <span>Đang lưu...</span>
                      </>
                    ) : (
                      <span>Xác Nhận Đổi PIN</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Share Access Modal */}
      {shareModalUnit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            {shareSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-[28px]">check_circle</span>
                </div>
                <h3 className="font-headline text-lg font-bold text-slate-900">
                  Cấp Quyền Thành Công!
                </h3>
                <p className="text-xs text-slate-600">
                  Mã token và hướng dẫn mở cửa tạm thời đã được gửi tới số <strong>{sharePhone}</strong>.
                </p>
                <button
                  onClick={() => {
                    setShareSuccess(false)
                    setShareModalUnit(null)
                    setSharePhone('')
                  }}
                  className="mt-2 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Hoàn tất
                </button>
              </div>
            ) : (
              <form onSubmit={handleShareSubmit} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-headline text-base font-bold text-slate-900">
                      Cấp Quyền Mở Kho #{shareModalUnit}
                    </h3>
                    <span className="text-xs text-slate-500">Tạo mã truy cập tạm thời cho tài xế hoặc người thân</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShareModalUnit(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Số điện thoại người nhận</label>
                  <input
                    type="tel"
                    required
                    value={sharePhone}
                    onChange={(e) => setSharePhone(e.target.value)}
                    placeholder="Ví dụ: 0912 345 678"
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Thời hạn hiệu lực của mã</label>
                  <select className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400">
                    <option value="4h">Trong 4 Giờ (Giao nhận gấp)</option>
                    <option value="24h">Trong 24 Giờ (1 Ngày)</option>
                    <option value="7d">Trong 7 Ngày</option>
                  </select>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShareModalUnit(null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                  >
                    Gửi Mã Truy Cập
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Full Legal Contract Document Viewer Modal */}
      {selectedContractForModal && (
        <ContractDocumentModal
          contract={selectedContractForModal}
          onClose={() => setSelectedContractForModal(null)}
          onSignNow={handleSignContractNow}
          isSigning={fetchingSigningUrl}
        />
      )}

      {/* Renewal Addendum Legal Document Viewer Modal */}
      {selectedRenewalForDocModal && (
        <RenewalDocumentModal
          renewal={selectedRenewalForDocModal}
          contract={contracts.find((c) => c.id === selectedRenewalForDocModal.contractId) || null}
          onClose={() => setSelectedRenewalForDocModal(null)}
          onViewOriginalContract={() => {
            const parentContract = contracts.find((c) => c.id === selectedRenewalForDocModal.contractId) || ({
              id: selectedRenewalForDocModal.contractId,
              contractCode: selectedRenewalForDocModal.contractCode,
              unitCode: selectedRenewalForDocModal.unitCode,
              facilityName: selectedRenewalForDocModal.facilityName,
              customerName: selectedRenewalForDocModal.customerName,
              customerEmail: selectedRenewalForDocModal.customerEmail,
              startDate: selectedRenewalForDocModal.oldEndDate,
              endDate: selectedRenewalForDocModal.newEndDate,
              monthlyFee: selectedRenewalForDocModal.renewalFee / (selectedRenewalForDocModal.cycleMonths || 1),
              status: 'ACTIVE',
            } as any)
            setSelectedRenewalForDocModal(null)
            setSelectedContractForModal(parentContract)
          }}
        />
      )}

      {/* DocuSeal Electronic Signature Modal */}
      {contractForDocuSealModal && (
        <DocuSealSimulationModal
          contract={contractForDocuSealModal}
          onClose={() => setContractForDocuSealModal(null)}
          onSignedSuccess={handleContractSignedSuccess}
        />
      )}

      {/* Contract OTP Verification Modal */}
      {contractForOtpModal && (
        <ContractOtpModal
          contract={contractForOtpModal}
          onClose={() => setContractForOtpModal(null)}
          onOpenSimulationSign={(c) => {
            setContractForOtpModal(null)
            setContractForDocuSealModal(c)
          }}
        />
      )}

      {/* VAT Invoice / Official Receipt Modal */}
      {selectedVatPayment && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-emerald-400 text-2xl">receipt_long</span>
                <div>
                  <h3 className="font-bold text-sm tracking-wide uppercase">Biên Lai Thu Tiền Điện Tử (VAT)</h3>
                  <p className="text-[10px] text-slate-400 font-mono">Mã tra cứu: {selectedVatPayment.transactionId || selectedVatPayment.id.slice(0, 16)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVatPayment(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Receipt Body */}
            <div className="p-6 space-y-5 text-xs text-slate-700">
              {/* Unit & Issuer Header */}
              <div className="border-b border-slate-200 pb-4 flex justify-between items-start gap-4">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm uppercase">CÔNG TY CỔ PHẦN HỆ THỐNG KHO BOXORA</h4>
                  <p className="text-[11px] text-slate-500">Mã số thuế: 0317894562 · Hotline: 1900 6868</p>
                  <p className="text-[11px] text-slate-500">Cơ sở phát hành: {selectedVatPayment.facilityName || 'Boxora Storage'}</p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-lg border border-emerald-200 text-[11px]">
                    ✓ ĐÃ THANH TOÁN
                  </span>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    {selectedVatPayment.paymentTime ? new Date(selectedVatPayment.paymentTime).toLocaleString('vi-VN') : '—'}
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Khách hàng (Người nộp tiền):</span>
                  <strong className="text-slate-900 text-xs">{user?.fullName || selectedVatPayment.customerName || 'Quý Khách Hàng'}</strong>
                  <div className="text-slate-500 text-[11px] font-mono">{user?.email || 'customer@gmail.com'}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Ngăn kho tiếp nhận:</span>
                  <strong className="text-blue-600 font-mono text-xs">#{selectedVatPayment.unitCode || 'N/A'}</strong>
                  <div className="text-slate-500 text-[11px]">Phương thức: {selectedVatPayment.paymentMethod || 'VNPay'}</div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Nội dung thanh toán</th>
                      <th className="py-2.5 px-3 text-right">Thuế suất</th>
                      <th className="py-2.5 px-3 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-900">
                          {selectedVatPayment.paymentType === 'DEPOSIT'
                            ? `Tiền đặt cọc bảo đảm ngăn kho #${selectedVatPayment.unitCode}`
                            : `Tiền thuê ngăn kho tự quản Boxora #${selectedVatPayment.unitCode}`}
                        </span>
                        <div className="text-[10px] text-slate-400">Mã GD đối soát: {selectedVatPayment.transactionId || selectedVatPayment.id}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">10% VAT</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {selectedVatPayment.amount.toLocaleString('vi-VN')} ₫
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Totals Breakdown */}
              <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Tiền dịch vụ (chưa thuế):</span>
                  <span>{Math.round(selectedVatPayment.amount / 1.1).toLocaleString('vi-VN')} ₫</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Tiền thuế GTGT (10%):</span>
                  <span>{(selectedVatPayment.amount - Math.round(selectedVatPayment.amount / 1.1)).toLocaleString('vi-VN')} ₫</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>TỔNG CỘNG THANH TOÁN:</span>
                  <span className="text-emerald-600 text-base">{selectedVatPayment.amount.toLocaleString('vi-VN')} ₫</span>
                </div>
              </div>

              {/* Boxora e-Invoice Seal */}
              <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>Hóa đơn điện tử có giá trị khấu trừ thuế theo quy định Bộ Tài Chính.</span>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                <span>In Biên Lai</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedVatPayment(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Reschedule Booking Modal (Đổi lịch hẹn nhận kho chuyên nghiệp theo chính sách Boxora) */}
      <BookingRescheduleModal
        isOpen={!!rescheduleBookingTarget}
        booking={rescheduleBookingTarget}
        onClose={() => setRescheduleBookingTarget(null)}
        onSuccess={async (updatedBooking) => {
          await fetchCustomerBookings()
          if (selectedBookingForModal && selectedBookingForModal.id === updatedBooking.id) {
            setSelectedBookingForModal(updatedBooking)
          }
        }}
      />

      {/* Booking Details & Handover Guide Modal */}
      {selectedBookingForModal && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-cyan-400 text-2xl">info</span>
                <div>
                  <h3 className="font-bold text-sm tracking-wide">Chi Tiết Đơn Đặt &amp; Hướng Dẫn Nhận Kho</h3>
                  <p className="text-[10px] text-slate-400 font-mono">Mã: #{selectedBookingForModal.bookingCode}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBookingForModal(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {(() => {
              const modalInfo = getBookingNoticeInfo(selectedBookingForModal)
              return (
                <div className="p-6 space-y-4 text-xs text-slate-700 max-h-[75vh] overflow-y-auto">
                  {/* Unit Header */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div>
                      <span className="font-mono text-base font-extrabold text-blue-700">KHO #{selectedBookingForModal.unitCode}</span>
                      <div className="text-slate-500 text-[11px]">{selectedBookingForModal.facilityName}</div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold mb-1 border ${
                        modalInfo.scenario === 'PAID_SIGNED'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : modalInfo.scenario === 'PAID_UNSIGNED'
                          ? 'bg-blue-100 text-blue-800 border-blue-200'
                          : 'bg-cyan-100 text-cyan-800 border-cyan-200'
                      }`}>
                        {modalInfo.scenario === 'PAID_SIGNED'
                          ? '✓ Đã hoàn tất thủ tục'
                          : modalInfo.scenario === 'PAID_UNSIGNED'
                          ? 'Chờ Ký Hợp Đồng'
                          : selectedBookingForModal.status === 'CONFIRMED'
                          ? 'Đang Giữ Chỗ (Tại cơ sở)'
                          : selectedBookingForModal.status}
                      </span>
                      <div className="text-[10px] font-semibold text-slate-600">
                        {modalInfo.scenario === 'PAID_SIGNED'
                          ? '✓ Đã thanh toán & Đã ký HĐ'
                          : modalInfo.scenario === 'PAID_UNSIGNED'
                          ? '✓ Đã thanh toán đủ'
                          : '○ Chưa thanh toán (Tại cơ sở)'}
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Status Notice Banner */}
                  {modalInfo.scenario === 'PAID_SIGNED' && (
                    <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-[20px] text-emerald-600 shrink-0 mt-0.5">
                        verified
                      </span>
                      <div className="leading-relaxed flex-1">
                        <div className="font-bold text-emerald-900 text-xs mb-0.5 flex items-center justify-between">
                          <span>Đã thanh toán &amp; ký hợp đồng rồi</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            <span className="material-symbols-outlined text-[12px]">task_alt</span>
                            Chờ bàn giao tại cơ sở
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-800">
                          Thủ tục hợp đồng và thanh toán đã hoàn tất 100%! Quý khách chỉ cần mang CCCD gốc đến cơ sở Boxora đúng lịch hẹn để đối soát và nhận bàn giao. Boxora sẽ lưu mã PIN/QR sau check-in; vui lòng xác nhận với nhân viên việc cài đặt khóa vật lý. <em>Thời hạn thuê và hiệu lực hợp đồng sẽ chính thức tính từ ngày bạn hoàn tất check-in.</em>
                        </p>
                      </div>
                    </div>
                  )}

                  {modalInfo.scenario === 'PAID_UNSIGNED' && (
                    <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-950 flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-[20px] text-blue-600 shrink-0 mt-0.5">
                        edit_document
                      </span>
                      <div className="leading-relaxed flex-1">
                        <div className="font-bold text-blue-900 text-xs mb-0.5 flex items-center justify-between">
                          <span>Đã thanh toán nhưng chưa ký</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                            Chờ ký hợp đồng
                          </span>
                        </div>
                        <p className="text-[11px] text-blue-800">
                          Đơn đặt kho đã thanh toán đủ. Quý khách vui lòng hoàn tất ký hợp đồng điện tử trực tuyến hoặc mang CCCD gốc đến cơ sở Boxora để ký hợp đồng và nhận bàn giao kho.
                        </p>
                      </div>
                    </div>
                  )}

                  {modalInfo.scenario === 'UNPAID_IN_PERSON' && (
                    <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-950 flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-[20px] text-amber-700 shrink-0 mt-0.5">
                        storefront
                      </span>
                      <div className="leading-relaxed flex-1">
                        <div className="font-bold text-amber-900 text-xs mb-0.5 flex items-center justify-between">
                          <span>Check-in thanh toán và ký hợp đồng tại chỗ</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                            Thanh toán tại quầy
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-800">
                          Kho được bảo lưu riêng cho bạn đến <strong>{selectedBookingForModal.holdExpiresAt ? new Date(selectedBookingForModal.holdExpiresAt).toLocaleString('vi-VN') : 'lịch hẹn + thời gian gia hạn'}</strong>. Quý khách vui lòng mang CCCD gốc đến cơ sở Boxora để xem kho thực tế, ký hợp đồng và thanh toán nhận bàn giao.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Schedule and Hold Expiry (Clearly distinguishes expected dates before handover vs official dates after handover) */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          {selectedBookingForModal.handoverTime ? 'Thời điểm bàn giao thực tế:' : 'Lịch hẹn check-in nhận kho:'}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <strong className="font-mono text-slate-900 text-xs">
                            {selectedBookingForModal.handoverTime
                              ? new Date(selectedBookingForModal.handoverTime).toLocaleString('vi-VN')
                              : selectedBookingForModal.expectedCheckInAt
                              ? new Date(selectedBookingForModal.expectedCheckInAt).toLocaleString('vi-VN')
                              : selectedBookingForModal.startDate}
                          </strong>
                          {(() => {
                            const notice = getCheckInNoticeInfo(selectedBookingForModal)
                            if (!notice) return null
                            return (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                                notice.type === 'OVERDUE'
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : notice.type === 'TODAY'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-blue-100 text-blue-800 border-blue-300'
                              }`}>
                                <span className="material-symbols-outlined text-[11px]">
                                  {notice.type === 'OVERDUE' ? 'warning' : notice.type === 'TODAY' ? 'schedule' : 'event'}
                                </span>
                                <span>{notice.text}</span>
                              </span>
                            )
                          })()}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          {selectedBookingForModal.handoverTime ? 'Trạng thái bàn giao:' : 'Hạn bảo lưu giữ chỗ:'}
                        </span>
                        <strong className={`font-mono text-xs ${selectedBookingForModal.handoverTime ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {selectedBookingForModal.handoverTime
                            ? 'Đã hoàn tất bàn giao & kích hoạt'
                            : selectedBookingForModal.holdExpiresAt
                            ? new Date(selectedBookingForModal.holdExpiresAt).toLocaleString('vi-VN')
                            : 'Theo chính sách cơ sở'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          {selectedBookingForModal.handoverTime ? 'Kỳ hạn thuê chính thức:' : 'Kỳ hạn thuê dự kiến:'}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {selectedBookingForModal.startDate} → {selectedBookingForModal.endDate} ({selectedBookingForModal.rentalMonths} tháng)
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Tiền cọc giữ chỗ:</span>
                        <span className="font-mono font-bold text-blue-600">
                          {Number(selectedBookingForModal.depositPaid || selectedBookingForModal.depositAmount || 0).toLocaleString('vi-VN')} ₫
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Handover Steps Guide */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                      Quy trình nhận kho tại cơ sở Boxora
                    </h4>
                    <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-white">
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                        <p className="text-[11px] leading-relaxed">
                          <strong>Mang CCCD / Hộ chiếu gốc:</strong> Đến quầy tiếp đón của cơ sở <strong>{selectedBookingForModal.facilityName}</strong> đúng theo lịch hẹn.
                        </p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                        <p className="text-[11px] leading-relaxed">
                          <strong>Cung cấp mã #{selectedBookingForModal.bookingCode}:</strong> Nhân viên trực quầy sẽ đối soát và dẫn bạn đi xem thực tế ngăn kho.
                        </p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                        <p className="text-[11px] leading-relaxed">
                          {modalInfo.scenario === 'PAID_SIGNED' ? (
                            <>
                              <strong>Nghiệm thu &amp; Bàn giao nhanh:</strong> Hồ sơ hợp đồng và thanh toán đã hoàn tất 100%. Quý khách chỉ cần nghiệm thu ngăn kho thực tế và nhận bàn giao ngay.
                            </>
                          ) : modalInfo.scenario === 'PAID_UNSIGNED' ? (
                            <>
                              <strong>Ký hợp đồng &amp; Nghiệm thu:</strong> Đơn kho đã thanh toán đủ. Quý khách vui lòng ký hợp đồng điện tử trực tuyến hoặc ký trực tiếp tại cơ sở trước khi nhận bàn giao kho.
                            </>
                          ) : (
                            <>
                              <strong>Ký hợp đồng &amp; Thanh toán tại chỗ:</strong> Nghiệm thu thực tế ngăn kho, ký biên bản hợp đồng và thanh toán tiền mặt hoặc chuyển khoản tại quầy.
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">4</span>
                        <p className="text-[11px] leading-relaxed">
                          <strong>Lưu mã PIN/QR:</strong> Sau khi bàn giao hoàn tất, Boxora lưu mã PIN/QR. Việc cài đặt hoặc hoạt động của khóa vật lý cần được cơ sở xác nhận.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Append-Only Check-in Rescheduling History */}
                  <div className="border-t border-slate-200/80 pt-3">
                    <BookingRescheduleHistorySection bookingId={selectedBookingForModal.id} />
                  </div>

                  {/* Action buttons */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                    {modalInfo.scenario === 'UNPAID_IN_PERSON' && (
                      <button
                        type="button"
                        onClick={() => {
                          const target = selectedBookingForModal
                          setSelectedBookingForModal(null)
                          handlePayBookingVNPay(target)
                        }}
                        className="w-full py-2.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer text-center shadow-sm"
                      >
                        Thanh toán và ký hợp đồng trực tuyến ngay -&gt;
                      </button>
                    )}
                    {modalInfo.scenario === 'PAID_UNSIGNED' && (
                      <button
                        type="button"
                        onClick={() => {
                          const target = selectedBookingForModal
                          const contract = modalInfo.matchingContract
                          setSelectedBookingForModal(null)
                          void handleSignContractForBooking(target, contract)
                        }}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer text-center shadow-sm"
                      >
                        Ký hợp đồng điện tử ngay -&gt;
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedBookingForModal(null)}
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer text-center shadow-sm"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Customer Policy Modal (Read-Only) */}
      <CustomerPolicyModal
        isOpen={isCustomerPolicyModalOpen}
        onClose={() => setIsCustomerPolicyModalOpen(false)}
        facilityId={customerPolicyFacility?.id || (selectedBookingUnit ? facilities.find(f => f.name === selectedBookingUnit.facilityName || f.id === selectedBookingUnit.facilityId)?.id : undefined) || facilities[0]?.id}
        facilityName={customerPolicyFacility?.name || selectedBookingUnit?.facilityName || facilities[0]?.name}
        initialTab={customerPolicyModalTab}
      />

      {/* Booking Cancellation Modal (3 Refund Milestones & Unit Release) */}
      <BookingCancelModal
        isOpen={Boolean(cancellingBookingTarget)}
        booking={cancellingBookingTarget}
        onClose={() => setCancellingBookingTarget(null)}
        onSuccess={async () => {
          await Promise.all([
            fetchCustomerBookings(),
            fetchContracts(),
            fetchCustomerPayments(),
            fetchAvailableUnits(),
          ])
        }}
      />

      {/* Booking Checkout & Payment Continuation Modal */}
      {requestToPay && user && (
        <BookingCheckoutModal
          unit={{
            backendId: requestToPay.storageUnitId || requestToPay.id,
            code: requestToPay.unitCode || 'N/A',
            name: requestToPay.unitCode ? `Kho #${requestToPay.unitCode}` : 'Kho Boxora',
            facilityName: requestToPay.facilityName || 'Boxora Facility',
            monthlyPrice: (requestToPay.totalRentalFee && requestToPay.rentalMonths ? requestToPay.totalRentalFee / requestToPay.rentalMonths : 0) || 1000000,
            depositAmount: requestToPay.depositAmount || requestToPay.depositPaid || 0,
            size: undefined,
            address: ''
          }}
          user={user}
          existingBooking={requestToPay}
          existingPayments={customerPayments}
          onClose={() => {
            setRequestToPay(null)
            fetchCustomerBookings()
            fetchContracts()
            fetchCustomerPayments()
          }}
        />
      )}

      {/* Ticket closure confirmation: Task 2 standardized modal */}
      <TicketCloseConfirmModal
        isOpen={Boolean(closeTicketTarget)}
        ticket={closeTicketTarget}
        onClose={() => setCloseTicketTarget(null)}
        onSuccess={async () => {
          await fetchCustomerTickets()
        }}
      />

      {/* Reopen Ticket Modal (Customer Request Re-handling) */}
      {reopenModalTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600 text-[22px]">restart_alt</span>
                <h3 className="font-bold text-slate-900 text-sm">
                  Yêu Cầu Xử Lý Lại Sự Cố #{reopenModalTicket.ticketCode || reopenModalTicket.id.substring(0, 8)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReopenModalTicket(null)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Nếu sự cố của bạn chưa được khắc phục triệt để hoặc phát sinh vấn đề mới liên quan, vui lòng nêu rõ lý do để kỹ thuật viên kiểm tra lại.
              </p>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Lý do yêu cầu xử lý lại <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={reopenReasonText}
                  onChange={(e) => setReopenReasonText(e.target.value)}
                  placeholder="Ví dụ: Khóa thông minh vẫn báo lỗi sau khi mở lần đầu, hoặc cửa cuốn vẫn phát tiếng kêu bất thường..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isProcessingTicketAction}
                onClick={() => setReopenModalTicket(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isProcessingTicketAction || !reopenReasonText.trim()}
                onClick={handleReopenCustomerTicket}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-xs font-bold rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isProcessingTicketAction ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                    <span>Đang gửi...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">send</span>
                    <span>Gửi Yêu Cầu Xử Lý Lại</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHI TIẾT CÁC HỢP ĐỒNG ĐÃ KÝ TRƯỚC ĐÓ */}
      {contractHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[24px]">history_edu</span>
                </div>
                <div>
                  <h3 className="font-headline text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Lịch Sử Hợp Đồng &amp; Phụ Lục Gia Hạn</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                      Tổng {contractHistoryModal.renewals.length + 1} Hợp đồng
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Kho #{contractHistoryModal.contract.unitCode} • {contractHistoryModal.contract.facilityName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setContractHistoryModal(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Summary Banner */}
            <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-xl flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-slate-500 font-medium block text-[11px]">Hiệu lực thuê tích lũy hiện tại:</span>
                <span className="font-mono font-bold text-blue-900 text-sm">
                  {formatDisplayDate(contractHistoryModal.contract.startDate)} → {formatDisplayDate(contractHistoryModal.contract.endDate)}
                </span>
              </div>
              <div className="text-right space-y-0.5">
                <span className="text-slate-500 font-medium block text-[11px]">Trạng thái hợp đồng:</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {contractHistoryModal.contract.status === 'ACTIVE' ? 'Đang hoạt động' : contractHistoryModal.contract.status}
                </span>
              </div>
            </div>

            {/* Timeline of Contracts */}
            <div className="space-y-4">
              {/* 1. HỢP ĐỒNG GỐC BAN ĐẦU */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-2.5 relative">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">
                      1
                    </span>
                    <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                      Hợp Đồng Gốc Ban Đầu
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      Hợp đồng chính
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-800 text-xs">
                    #{contractHistoryModal.contract.contractCode || `CTR-BX-${contractHistoryModal.contract.id.slice(0, 8)}`}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-[10px] text-slate-500 block">Ngày bắt đầu</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {formatDisplayDate(contractHistoryModal.contract.startDate)}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-[10px] text-slate-500 block">Ngày kết thúc ban đầu</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {formatDisplayDate(
                        contractHistoryModal.renewals.length > 0
                          ? contractHistoryModal.renewals[0].oldEndDate
                          : contractHistoryModal.contract.endDate
                      )}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-[10px] text-slate-500 block">Cước thuê tháng</span>
                    <span className="font-semibold text-blue-700">
                      {Number(contractHistoryModal.contract.monthlyFee || 0).toLocaleString('vi-VN')} ₫
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-[10px] text-slate-500 block">Tiền cọc lưu ký</span>
                    <span className="font-semibold text-slate-900">
                      {getContractDepositHeld(contractHistoryModal.contract).toLocaleString('vi-VN')} ₫
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-emerald-600">verified_user</span>
                    <span>Đã hoàn tất ký số &amp; thanh toán kích hoạt kho</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const initialContract = {
                        ...contractHistoryModal.contract,
                        endDate:
                          contractHistoryModal.renewals.length > 0
                            ? contractHistoryModal.renewals[0].oldEndDate
                            : contractHistoryModal.contract.endDate,
                      }
                      setSelectedContractForModal(initialContract)
                      setContractHistoryModal(null)
                    }}
                    className="text-blue-600 hover:text-blue-800 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <span>Xem văn bản hợp đồng gốc</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
              </div>

              {/* 2. CÁC PHỤ LỤC GIA HẠN */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Các Phụ Lục Gia Hạn Hợp Đồng ({contractHistoryModal.renewals.length})
                  </span>
                </div>

                {contractHistoryModal.renewals.map((r, idx) => (
                  <div
                    key={r.id}
                    className="border border-blue-200/90 rounded-xl p-4 bg-gradient-to-r from-white to-blue-50/30 shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                          {idx + 2}
                        </span>
                        <span className="font-bold text-slate-900 text-xs">
                          Phụ Lục Gia Hạn Lần {idx + 1}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">check</span>
                          <span>Đã ký &amp; thanh toán</span>
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-blue-700">
                        + {r.cycleMonths} Tháng
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2 bg-white border border-slate-200/70 rounded-lg">
                        <span className="text-[10px] text-slate-500 block">Thời hạn nối tiếp</span>
                        <span className="font-mono text-[11px] font-semibold text-slate-800">
                          {formatDisplayDate(r.oldEndDate)}
                        </span>
                      </div>
                      <div className="p-2 bg-white border border-slate-200/70 rounded-lg">
                        <span className="text-[10px] text-slate-500 block">Thời hạn gia hạn mới</span>
                        <span className="font-mono text-[11px] font-bold text-emerald-700">
                          {formatDisplayDate(r.newEndDate)}
                        </span>
                      </div>
                      <div className="p-2 bg-white border border-slate-200/70 rounded-lg">
                        <span className="text-[10px] text-slate-500 block">Tổng phí gia hạn</span>
                        <span className="font-bold text-blue-700">
                          {Number(r.renewalFee || 0).toLocaleString('vi-VN')} ₫
                        </span>
                      </div>
                      <div className="p-2 bg-white border border-slate-200/70 rounded-lg">
                        <span className="text-[10px] text-slate-500 block">Phương thức</span>
                        <span className="font-semibold text-slate-800">
                          {r.paymentMethod ? r.paymentMethod : 'Ký online + Chuyển khoản'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-slate-100">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-slate-500">
                          {r.notes ? `Ghi chú: ${r.notes}` : 'Phụ lục gia hạn đã được lưu trữ và có giá trị pháp lý tương đương hợp đồng gốc.'}
                        </span>
                        {(r.customerName || r.reviewedByName) && (
                          <span className="text-[11px] text-blue-800 font-medium">
                            • Người ký: <strong>{r.customerName || r.reviewedByName}</strong>
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRenewalForDocModal(r)
                        }}
                        className="text-blue-600 hover:text-blue-800 font-bold text-xs flex items-center gap-1 cursor-pointer py-1 ml-auto shrink-0"
                        title="Xem văn bản phụ lục gia hạn"
                      >
                        <span>Xem văn bản phụ lục</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setContractHistoryModal(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default CustomerDashboard
