import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { contractService, RentalContract } from '../../services/contractService'
import { bookingService } from '../../services/bookingService'
import { supportTicketService, SupportTicketRecord, SupportTicketCategory } from '../../services/supportTicketService'
import { facilityService } from '../../services/facilityService'
import { storageUnitService } from '../../services/storageUnitService'
import { paymentService, PaymentItem } from '../../services/paymentService'
import { Booking, Facility, StorageUnit, ContractRenewal } from '../../types'

import { ContractDocumentModal } from '../../components/modals/ContractDocumentModal'
import { RenewalAddendumModal } from '../../components/modals/RenewalAddendumModal'
import { DocuSealSimulationModal } from '../../components/modals/DocuSealSimulationModal'
import { ContractOtpModal } from '../../components/modals/ContractOtpModal'
import { CustomerPolicyModal, PolicyTab } from '../../components/modals/CustomerPolicyModal'
import { BookingCancelModal } from '../../components/modals/BookingCancelModal'
import { BookingRescheduleModal } from '../../components/modals/BookingRescheduleModal'
import { BookingRescheduleHistorySection } from '../../components/booking/BookingRescheduleHistorySection'
import { TicketCloseConfirmModal } from '../../components/modals/TicketCloseConfirmModal'
import { PortalBookingReservationModal, PortalBookingUnitData } from '../../components/booking/PortalBookingReservationModal'
import { CustomerSettlementReviewModal } from '../../components/modals/CustomerSettlementReviewModal'
import { getFacilityImage } from '../public/BookingPage'
import { extractFloor } from '../../utils/floorUtils'
import { checkCustomerPortalAccess } from '../../utils/rentalAccess'
import NotificationCenter from '../../components/layout/NotificationCenter'
import { notificationService, NotificationLog } from '../../services/notificationService'
import { toast } from '../../utils/toast'
import { MyBookingsPage } from './MyBookingsPage'
import { CustomerSupportPanel } from './components/CustomerSupportPanel'


const BookingRequestCountdown: React.FC<{ request: Booking }> = ({ request }) => {
  const expiresAt = request.paymentExpiresAt ? new Date(request.paymentExpiresAt).getTime() : NaN
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!Number.isFinite(expiresAt)) return
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [expiresAt])

  if (!Number.isFinite(expiresAt)) return null

  const secondsRemaining = Math.max(0, Math.floor((expiresAt - now) / 1000))
  const isExpired = secondsRemaining === 0
  const formattedCountdown = [
    Math.floor(secondsRemaining / 3600),
    Math.floor((secondsRemaining % 3600) / 60),
    secondsRemaining % 60
  ].map(value => String(value).padStart(2, '0')).join(':')

  return (
    <p className={`mt-1.5 inline-flex items-center gap-1 text-xs font-semibold ${isExpired ? 'text-rose-700' : 'text-amber-700'}`}>
      <span className="material-symbols-outlined text-[15px]">timer</span>
      {isExpired
        ? 'Đã hết thời hạn giữ kho'
        : `Thời gian giữ kho còn ${formattedCountdown}`}
    </p>
  )
}

const nextMonthlyPaymentDate = (startDate?: string): Date | null => {
  if (!startDate) return null
  const [year, month, day] = startDate.split('T')[0].split('-').map(Number)
  if (!year || !month || !day) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const baseMonthOffset = (today.getFullYear() - year) * 12 + today.getMonth() + 1 - month
  const makeCycleDate = (offset: number) => {
    const targetMonth = month - 1 + offset
    const targetYear = year + Math.floor(targetMonth / 12)
    const normalizedMonth = ((targetMonth % 12) + 12) % 12
    const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate()
    return new Date(targetYear, normalizedMonth, Math.min(day, lastDay))
  }

  let nextDate = makeCycleDate(Math.max(0, baseMonthOffset))
  if (nextDate < today) nextDate = makeCycleDate(Math.max(0, baseMonthOffset) + 1)
  return nextDate
}

interface CustomerUnitActivityLog {
  id: string
  unitCode?: string
  facilityName?: string
  category: 'ACCESS' | 'RENEWAL' | 'CONTRACT' | 'NOTIFICATION' | 'SUPPORT'
  actionType:
    | 'LOCK_OPEN'
    | 'LOCK_CLOSE'
    | 'PIN_REVEAL'
    | 'PIN_HIDE'
    | 'PIN_COPY'
    | 'PIN_CHANGE'
    | 'RENEWAL_REQUEST'
    | 'RENEWAL_APPROVED'
    | 'RENEWAL_COMPLETED'
    | 'RENEWAL_REJECTED'
    | 'CONTRACT_ACTIVATED'
    | 'CONTRACT_OVERDUE'
    | 'PAYMENT_COMPLETED'
    | 'SUPPORT_REQUEST'
    | 'RETURN_SETTLEMENT'
    | 'SYSTEM_NOTIFICATION'
  title: string
  description: string
  timestamp: string
  actorName?: string
  statusLabel?: string
  statusTone?: 'emerald' | 'blue' | 'amber' | 'rose' | 'purple' | 'cyan' | 'slate'
  meta?: {
    oldEndDate?: string
    newEndDate?: string
    cycleMonths?: number
    amount?: number
    contractCode?: string
    renewalId?: string
    bookingId?: string
    notificationId?: string
  }
}

const formatRelativeTimeVi = (isoString?: string): string => {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffSec < 0) return 'Mới cập nhật'
  if (diffSec < 60) return 'Vừa xong'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} phút trước`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} giờ trước`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 30) return `${diffDay} ngày trước`
  const diffMonth = Math.floor(diffDay / 30)
  return `${diffMonth} tháng trước`
}

interface CustomerDashboardProps {
  bookingOnly?: boolean
}

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

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ bookingOnly = false }) => {
  const navigate = useNavigate()
  const { user } = useAuth()
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
  const [selectedProofPayment, setSelectedProofPayment] = useState<PaymentItem | null>(null)
  const [closeTicketTarget, setCloseTicketTarget] = useState<SupportTicketRecord | null>(null)
  const [myRenewals, setMyRenewals] = useState<ContractRenewal[]>([])
  const [loadingRenewals, setLoadingRenewals] = useState<boolean>(false)

  // Real database customer payments state
  const [customerPayments, setCustomerPayments] = useState<PaymentItem[]>([])
  const [loadingPayments, setLoadingPayments] = useState<boolean>(true)
  const [selectedVatPayment, setSelectedVatPayment] = useState<PaymentItem | null>(null)

  // Real facilities & available units state
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [availableUnits, setAvailableUnits] = useState<StorageUnit[]>([])
  const [allUnits, setAllUnits] = useState<StorageUnit[]>([])
  const [loadingUnits, setLoadingUnits] = useState<boolean>(true)
  const [selectedDetailModalUnit, setSelectedDetailModalUnit] = useState<StorageUnit | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false)
  const [bookingRequests, setBookingRequests] = useState<Booking[]>([])
  const [loadingRequests, setLoadingRequests] = useState<boolean>(false)
  const [customerTickets, setCustomerTickets] = useState<SupportTicketRecord[]>([])
  const [loadingTickets, setLoadingTickets] = useState<boolean>(false)
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('ALL')
  const [ticketSearchTerm, setTicketSearchTerm] = useState<string>('')
  const [highlightedUnitCode, setHighlightedUnitCode] = useState<string | null>(null)
  const [requestToPay, setRequestToPay] = useState<Booking | null>(null)
  const [bookingCreated, setBookingCreated] = useState<boolean>(false)
  const [isCustomerPolicyModalOpen, setIsCustomerPolicyModalOpen] = useState<boolean>(false)
  const [customerPolicyModalTab, setCustomerPolicyModalTab] = useState<PolicyTab>('cancellation')
  const [customerPolicyFacility, setCustomerPolicyFacility] = useState<{ id?: string; name?: string } | null>(null)
  const [unlockingUnit, setUnlockingUnit] = useState<string | null>(null)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [unlockedSuccess, setUnlockedSuccess] = useState<string | null>(null)
  const [unlockedUnits, setUnlockedUnits] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('boxora_unlocked_units')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  // Reschedule Modal state
  const [rescheduleBookingTarget, setRescheduleBookingTarget] = useState<Booking | null>(null)
  const [rescheduleNewDate, setRescheduleNewDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [rescheduleNewTime, setRescheduleNewTime] = useState<string>('09:00')
  const [rescheduleReason, setRescheduleReason] = useState<string>('')
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState<boolean>(false)
  const [rescheduleError, setRescheduleError] = useState<string | null>(null)
  const [rescheduleSuccess, setRescheduleSuccess] = useState<boolean>(false)

  // Switch Renewal Method Modal State
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

  const [reopenModalTicket, setReopenModalTicket] = useState<SupportTicketRecord | null>(null)
  const [reopenReasonText, setReopenReasonText] = useState('')
  const [isProcessingTicketAction, setIsProcessingTicketAction] = useState(false)
  const [contractHistoryModal, setContractHistoryModal] = useState<any | null>(null)
  const [selectedRenewalForDocModal, setSelectedRenewalForDocModal] = useState<any | null>(null)

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
    } finally {
      setIsProcessingTicketAction(false)
    }
  }

  // Customer notifications & unit activity history state
  const [customerNotifications, setCustomerNotifications] = useState<NotificationLog[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState<boolean>(false)
  const [selectedBookingForSettlementModal, setSelectedBookingForSettlementModal] = useState<string | null>(null)
  const [unitHistoryCategory, setUnitHistoryCategory] = useState<'ALL' | 'ACCESS' | 'RENEWAL' | 'NOTIFICATION' | 'SUPPORT'>('ALL')
  const [unitHistoryUnitFilter, setUnitHistoryUnitFilter] = useState<string>('ALL')
  const [unitHistorySearch, setUnitHistorySearch] = useState<string>('')
  const [unitHistoryLimit, setUnitHistoryLimit] = useState<number>(12)

  const activityStorageKey = useMemo(
    () => `boxora_customer_unit_activity_${user?.id || user?.email || 'guest'}`,
    [user?.id, user?.email]
  )

  const [unitActivityLogs, setUnitActivityLogs] = useState<CustomerUnitActivityLog[]>(() => {
    try {
      const raw = localStorage.getItem(`boxora_customer_unit_activity_${user?.id || user?.email || 'guest'}`)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      const raw = localStorage.getItem(activityStorageKey)
      setUnitActivityLogs(raw ? JSON.parse(raw) : [])
    } catch {
      setUnitActivityLogs([])
    }
  }, [activityStorageKey])

  const recordUnitActivity = useCallback(
    (entry: Omit<CustomerUnitActivityLog, 'id' | 'timestamp'> & { timestamp?: string }) => {
      const newLog: CustomerUnitActivityLog = {
        ...entry,
        id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: entry.timestamp || new Date().toISOString(),
        actorName: entry.actorName || user?.fullName || user?.username || 'Khách hàng',
      }
      setUnitActivityLogs(prev => {
        const next = [newLog, ...prev].slice(0, 200)
        try {
          localStorage.setItem(activityStorageKey, JSON.stringify(next))
        } catch {
          // ignore storage quota errors
        }
        return next
      })
    },
    [activityStorageKey, user?.fullName, user?.username]
  )

  const fetchCustomerNotifications = useCallback(async () => {
    if (!user?.id) return []
    try {
      setLoadingNotifications(true)
      const res = await notificationService.getRecent({ recipientId: user.id, page: 0, size: 50 })
      const list = Array.isArray(res?.content) ? res.content : []
      setCustomerNotifications(list)
      return list
    } catch (err) {
      console.warn('Failed to load customer notifications:', err)
      return []
    } finally {
      setLoadingNotifications(false)
    }
  }, [user?.id])

  const fetchMyRenewals = async () => {
    try {
      setLoadingRenewals(true)
      const res = await contractService.getRenewals({ size: 50 })
      const list = Array.isArray(res) ? res : (Array.isArray((res as any)?.content) ? (res as any).content : [])
      setMyRenewals(list)
      return list
    } catch {
      return []
    } finally {
      setLoadingRenewals(false)
    }
  }


  const fetchCustomerBookings = async () => {
    try {
      setLoadingBookings(true)
      let list: Booking[] = []
      try {
        const res = await bookingService.getMyBookings()
        if (Array.isArray(res)) {
          list = res
        } else {
          const activeRes = await bookingService.getMyActive()
          if (Array.isArray(activeRes)) {
            list = activeRes
          }
        }
      } catch (err) {
        console.error('Failed to load customer bookings from database:', err)
        try {
          const activeRes = await bookingService.getMyActive()
          if (Array.isArray(activeRes)) {
            list = activeRes
          }
        } catch {
          list = []
        }
      }

      // Merge local reservations saved during booking
      try {
        const rawLocal = localStorage.getItem('boxora_guest_reservations')
        if (rawLocal) {
          const localItems = JSON.parse(rawLocal)
          if (Array.isArray(localItems) && localItems.length > 0) {
            const existingCodes = new Set(list.map(b => b.bookingCode))
            const localAsBookings: Booking[] = []

            localItems.forEach((r: any, idx: number) => {
              const code = r.bookingCode || `BX-LOCAL-${idx}`

              // Chỉ merge đơn lưu tạm trong máy NẾU đơn này trùng khớp email hoặc số điện thoại của tài khoản đang đăng nhập
              const resEmail = (r.customer?.email || r.customerEmail || '').trim().toLowerCase()
              const resPhone = (r.customer?.phone || r.customerPhone || '').trim()
              const currentUserEmail = (user?.email || '').trim().toLowerCase()
              const currentUserPhone = (user?.phone || '').trim()

              const isMatch = Boolean(
                (currentUserEmail && resEmail && resEmail === currentUserEmail) ||
                (currentUserPhone && resPhone && resPhone === currentUserPhone)
              )

              if (!isMatch) {
                return
              }

              if (!existingCodes.has(code)) {
                localAsBookings.push({
                  id: `LOCAL-RES-${idx}-${code}`,
                  bookingCode: code,
                  customerId: user?.id || 'guest',
                  customerName: r.customer?.fullName || user?.fullName || 'Khách hàng',
                  customerEmail: r.customer?.email || user?.email || '',
                  customerPhone: r.customer?.phone || user?.phone || '',
                  storageUnitId: null,
                  unitCode: r.unitCode || null,
                  unitTypeName: r.unitTypeName || r.sizeName || (r.size?.volumeText ? `Kho ${r.size.volumeText}` : 'Kho Tiêu chuẩn (A/C Máy lạnh)'),
                  facilityId: r.facility?.id,
                  facilityName: r.facility?.name || 'Cơ sở Boxora',
                  floorLevel: '1',
                  startDate: r.startDate || new Date().toISOString().split('T')[0],
                  endDate: r.rentalEndDate || '',
                  rentalMonths: r.rentalMonths || 1,
                  totalRentalFee: r.totalRentalFee ?? r.totalRent ?? 0,
                  depositPaid: r.depositPaid ?? (r.paymentStatus === 'PAID' ? (r.depositAmount ?? 0) : 0),
                  depositAmount: r.depositAmount ?? 0,
                  status: (r.status as any) || 'PENDING_CONTACT',
                  accessCode: code,
                  expectedCheckInAt: r.checkInDate ? `${r.checkInDate}T${r.checkInTime || '09:00'}:00` : undefined,
                  checkInTime: r.checkInTime,
                  identityCardNumber: r.customer?.idCard || '',
                  identityCardType: 'CCCD',
                  paymentStatus: r.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID_IN_PERSON',
                })
              }
            })

            list = [...localAsBookings, ...list]
          }
        }
      } catch (mergeErr) {
        console.warn('Could not merge local reservations:', mergeErr)
      }

      setCustomerBookings(list)
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
      const res = await storageUnitService.getUnits({ status: 'AVAILABLE' })
      if (Array.isArray(res)) {
        setAvailableUnits(res)
      }
    } catch (err) {
      console.error('Failed to load available storage units from database:', err)
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

  const fetchBookingRequests = async () => {
    setLoadingRequests(true)
    try {
      const requests = await bookingService.getMyRequests()
      setBookingRequests(Array.isArray(requests) ? requests : [])
    } catch (err) {
      console.warn('Failed to load booking requests:', err)
    } finally {
      setLoadingRequests(false)
    }
  }

  useEffect(() => {
    fetchContracts()
    fetchCustomerBookings()
    fetchCustomerPayments()
    fetchAvailableUnits()
    fetchFacilities()
    fetchMyRenewals()
    fetchCustomerTickets()
    void fetchCustomerNotifications()
  }, [user, fetchCustomerNotifications])

  useEffect(() => {
    let isCurrent = true
    const loadRequests = async () => {
      setLoadingRequests(true)
      try {
        const requests = await bookingService.getMyRequests()
        if (isCurrent) setBookingRequests(requests)
      } catch (err) {
        console.warn('Failed to load booking requests:', err)
      } finally {
        if (isCurrent) setLoadingRequests(false)
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
  const activatedContracts = contracts.filter(c => c.status === 'ACTIVE')

  // Merge active bookings that have unit assigned into effectiveActiveContracts to guarantee
  // the customer always sees their handed-over locker in "Kho của tôi & Mã PIN" even before contract list refetches
  const effectiveActiveContracts = useMemo(() => {
    const list = [...activeContracts]
    const existingUnitCodes = new Set(list.map(c => (c.unitCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '')))
    const existingBookingIds = new Set(list.map(c => c.bookingId).filter(Boolean))

    customerBookings.forEach(b => {
      if ((b.status === 'ACTIVE' || b.status === 'COMPLETED') && b.unitCode) {
        const cleanU = b.unitCode.toUpperCase().replace(/[^A-Z0-9]/g, '')
        if (!existingUnitCodes.has(cleanU) && !existingBookingIds.has(b.id)) {
          list.push({
            id: `contract-${b.id}`,
            contractCode: (b as any).contractCode || `CTR-${b.bookingCode}`,
            bookingId: b.id,
            customerId: b.customerId,
            customerName: b.customerName,
            customerPhone: b.customerPhone,
            customerEmail: b.customerEmail,
            unitCode: b.unitCode,
            unitTypeId: b.unitTypeId,
            unitTypeName: b.unitTypeName,
            facilityId: b.facilityId,
            facilityName: b.facilityName,
            startDate: b.startDate,
            endDate: b.endDate,
            monthlyFee: b.totalRentalFee || 0,
            rentalPricePerMonth: b.totalRentalFee || 0,
            status: 'ACTIVE',
            createdAt: b.createdAt,
          } as any)
          existingUnitCodes.add(cleanU)
        }
      }
    })
    return list
  }, [activeContracts, customerBookings])

  const effectiveActivatedContracts = useMemo(() => {
    return effectiveActiveContracts.filter(c => c.status === 'ACTIVE')
  }, [effectiveActiveContracts])
  const nextPaymentDeadline = activatedContracts
    .map(contract => nextMonthlyPaymentDate(contract.startDate))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime())[0]
  const pendingBookingRequests = bookingRequests.filter(request => request.status === 'PENDING_APPROVAL' || request.status === 'PENDING_PAYMENT')

  // Đơn đặt giữ chỗ đang chờ nhận kho tại quầy (CONFIRMED hoặc PENDING_PAYMENT)
  const pendingReservations = useMemo(() => {
    return customerBookings.filter(b => b.status === 'CONFIRMED' || b.status === 'PENDING_PAYMENT')
  }, [customerBookings])

  // Real Customer Financial Summaries from DB
  const totalAmountPaid = useMemo(() => {
    return customerPayments.filter(p => p.status === 'PAID' || p.status === 'SUCCESS').reduce((sum, p) => sum + (p.amount || 0), 0)
  }, [customerPayments])

  const totalDepositsHeld = useMemo(() => {
    const fromPayments = customerPayments.filter(p => (p.status === 'PAID' || p.status === 'SUCCESS') && (p.paymentType === 'DEPOSIT' || p.paymentType === 'BOOKING_PAYMENT')).reduce((sum, p) => sum + (p.amount || 0), 0)
    const fromContracts = contracts.reduce((sum, c) => sum + (c.depositHeld || 0), 0)
    return fromPayments > 0 ? fromPayments : fromContracts
  }, [customerPayments, contracts])

  const monthlyRentalTotal = useMemo(() => {
    return activatedContracts.reduce((sum, c) => sum + (c.monthlyFee || 0), 0)
  }, [activatedContracts])

  const successfulPaymentsCount = useMemo(() => {
    return customerPayments.filter(p => p.status === 'PAID' || p.status === 'SUCCESS').length
  }, [customerPayments])

  // Support Ticket Form State
  const [ticketUnit, setTicketUnit] = useState('')
  const [selectedSupportUnit, setSelectedSupportUnit] = useState<string>('')
  const [selectedSupportCategory, setSelectedSupportCategory] = useState<SupportTicketCategory>('LOCK_ISSUE')
  const [selectedSupportContent, setSelectedSupportContent] = useState<string>('')
  const [selectedSupportTitle, setSelectedSupportTitle] = useState<string>('')

  useEffect(() => {
    if (activeContracts.length > 0 && !ticketUnit) {
      setTicketUnit(activeContracts[0].unitCode)
    }
  }, [activeContracts, ticketUnit])
  const nearestEndDate = activeContracts
    .map(c => c.endDate)
    .filter(Boolean)
    .sort()[0] || '--'

  // Tabs: 'my-units' (default) | 'history' | 'bookings' | 'explore' | 'contracts' | 'support' | 'returns'
  type CustomerPortalTab = 'my-units' | 'history' | 'bookings' | 'explore' | 'contracts' | 'support' | 'returns'
  const validCustomerTabs: CustomerPortalTab[] = ['my-units', 'history', 'bookings', 'explore', 'contracts', 'support', 'returns']
  const rawTab = searchParams.get('tab')
  const tabParam = (rawTab === 'requests' ? 'bookings' : rawTab) as CustomerPortalTab | null
  const [activeTab, setActiveTab] = useState<CustomerPortalTab>(
    tabParam && validCustomerTabs.includes(tabParam)
      ? tabParam
      : 'my-units'
  )

  useEffect(() => {
    if (rawTab === 'requests') {
      setActiveTab('bookings')
      setSearchParams({ tab: 'bookings' })
      return
    }
    if (tabParam && validCustomerTabs.includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [tabParam, rawTab])

  // Automatically default to 'bookings' when customer has no active contracts
  useEffect(() => {
    if (!tabParam && !loadingContracts && effectiveActiveContracts.length === 0) {
      setActiveTab('bookings')
    }
  }, [tabParam, loadingContracts, effectiveActiveContracts.length])

  const handleTabChange = (tab: CustomerPortalTab) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  const handleGoToMyUnit = (unitCode?: string) => {
    setActiveTab('my-units')
    setMyUnitsSearchTerm('')
    setMyUnitsFacility('all')
    setMyUnitsFloor('all')
    setMyUnitsSize('all')
    if (unitCode) {
      setSearchParams({ tab: 'my-units', unit: unitCode })
      setHighlightedUnitCode(unitCode)
      const tryScroll = () => {
        const clean = unitCode.toLowerCase().replace(/[^a-z0-9]/g, '')
        const el = document.getElementById(`unit-card-${clean}`) || document.getElementById(`unit-card-${unitCode}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          return true
        }
        return false
      }
      setTimeout(tryScroll, 120)
      setTimeout(tryScroll, 350)
      setTimeout(tryScroll, 700)
    } else {
      setSearchParams({ tab: 'my-units' })
    }
  }

  // Listen for navigation event from embedded or external components
  useEffect(() => {
    const handleCustomerTabNav = (e: any) => {
      const detail = e.detail
      if (detail?.tab && validCustomerTabs.includes(detail.tab)) {
        setActiveTab(detail.tab)
        if (detail.unitCode) {
          handleGoToMyUnit(detail.unitCode)
        } else {
          setSearchParams({ tab: detail.tab })
        }
      }
    }
    window.addEventListener('boxora:navigate-customer-tab', handleCustomerTabNav)
    return () => window.removeEventListener('boxora:navigate-customer-tab', handleCustomerTabNav)
  }, [])

  const unitParam = searchParams.get('unit') || searchParams.get('unitCode')
  useEffect(() => {
    if (unitParam) {
      setHighlightedUnitCode(unitParam)
      const clean = unitParam.toLowerCase().replace(/[^a-z0-9]/g, '')
      const tryScroll = () => {
        const el = document.getElementById(`unit-card-${clean}`) || document.getElementById(`unit-card-${unitParam}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          return true
        }
        return false
      }
      const t1 = setTimeout(tryScroll, 150)
      const t2 = setTimeout(tryScroll, 450)
      const t3 = setTimeout(tryScroll, 800)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
        clearTimeout(t3)
      }
    }
  }, [unitParam, activeTab, loadingContracts, effectiveActiveContracts.length])

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

  const handleOpenPolicyModal = (tab: PolicyTab = 'cancellation', facility?: { id?: string; name?: string }) => {
    setCustomerPolicyModalTab(tab)
    if (facility) setCustomerPolicyFacility(facility)
    setIsCustomerPolicyModalOpen(true)
  }

  const getContractDepositHeld = useCallback((contractItem: any) => {
    if (Number(contractItem?.depositHeld || 0) > 0) return Number(contractItem.depositHeld)
    const matchingPayment = customerPayments.find(
      (p) => (p.bookingId === contractItem?.bookingId || (p.unitCode && contractItem?.unitCode && p.unitCode.trim().toUpperCase() === contractItem.unitCode.trim().toUpperCase()))
        && p.paymentType === 'DEPOSIT' && (p.status === 'PAID' || p.status === 'SUCCESS')
    )
    if (matchingPayment?.amount && Number(matchingPayment.amount) > 0) return Number(matchingPayment.amount)
    const matchingBooking = customerBookings.find(
      (b) => b.id === contractItem?.bookingId || (b.unitCode && contractItem?.unitCode && b.unitCode.trim().toUpperCase() === contractItem.unitCode.trim().toUpperCase())
    )
    if (matchingBooking?.depositPaid && Number(matchingBooking.depositPaid) > 0) return Number(matchingBooking.depositPaid)
    if (matchingBooking?.depositAmount && Number(matchingBooking.depositAmount) > 0) return Number(matchingBooking.depositAmount)
    return Number(contractItem?.monthlyFee || 0)
  }, [customerPayments, customerBookings])

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

    // Tính hạn hủy tự động theo chính sách bảo lưu giữ chỗ của cơ sở
    let autoCancelDeadline: Date
    if (b.holdExpiresAt) {
      autoCancelDeadline = new Date(b.holdExpiresAt)
    } else {
      const graceHours = b.signingMethod === 'IN_PERSON' ? 48 : (b.holdGraceHours || 24)
      const endOfCheckInDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59).getTime()
      autoCancelDeadline = new Date(endOfCheckInDay + graceHours * 3600 * 1000)
    }

    const remainingMs = autoCancelDeadline.getTime() - Date.now()
    const isAutoCancelExpired = remainingMs <= 0

    let autoCancelCountdownStr = ''
    if (isAutoCancelExpired) {
      autoCancelCountdownStr = 'Đã hết hạn giữ kho — Hệ thống đang xử lý tự động hủy đơn'
    } else {
      const totalSecs = Math.floor(remainingMs / 1000)
      const hours = Math.floor(totalSecs / 3600)
      const mins = Math.floor((totalSecs % 3600) / 60)
      const secs = totalSecs % 60

      if (hours >= 24) {
        const days = Math.floor(hours / 24)
        const remHours = hours % 24
        autoCancelCountdownStr = `${days} ngày ${remHours.toString().padStart(2, '0')} giờ ${mins.toString().padStart(2, '0')} phút ${secs.toString().padStart(2, '0')} giây`
      } else {
        autoCancelCountdownStr = `${hours.toString().padStart(2, '0')} giờ ${mins.toString().padStart(2, '0')} phút ${secs.toString().padStart(2, '0')} giây`
      }
    }

    if (diffDays < 0) {
      const overdueDays = Math.abs(diffDays)
      return {
        type: 'OVERDUE' as const,
        days: overdueDays,
        text: `quá ${overdueDays} ngày`,
        alertTitle: `Cảnh báo quá thời gian check-in: Quá ${overdueDays} ngày`,
        alertMessage: `Lịch hẹn nhận kho ban đầu là ngày ${formattedDate}. Theo chính sách cơ sở, hệ thống sẽ tiến hành tự động hủy đơn sau: ${autoCancelCountdownStr}`,
        formattedDate,
        autoCancelCountdownStr,
      }
    } else if (diffDays === 0) {
      return {
        type: 'TODAY' as const,
        days: 0,
        text: 'hôm nay',
        alertTitle: 'Hôm nay là ngày hẹn nhận kho!',
        alertMessage: `Lịch hẹn nhận kho của quý khách là HÔM NAY (${formattedDate})! Vui lòng mang CCCD gốc đến cơ sở Boxora để nhận bàn giao kho và kích hoạt mã PIN SmartLock.`,
        formattedDate,
        autoCancelCountdownStr: '',
      }
    } else {
      return {
        type: 'UPCOMING' as const,
        days: diffDays,
        text: `${diffDays} ngày sắp tới`,
        alertTitle: `Lịch hẹn nhận kho: ${diffDays} ngày sắp tới`,
        alertMessage: `Lịch hẹn nhận kho dự kiến trong ${diffDays} ngày sắp tới (${formattedDate}). Quý khách vui lòng lưu ý thời gian đến cơ sở đúng hẹn.`,
        formattedDate,
        autoCancelCountdownStr: '',
      }
    }
  }, [])


  // Copy PIN notification
  const [copiedPin, setCopiedPin] = useState<string | null>(null)
  // Stitch PIN Reveal State
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({})
  const [loadedPins, setLoadedPins] = useState<Record<string, string>>({})
  const [loadingPins, setLoadingPins] = useState<Record<string, boolean>>({})
  const [pinCountdown, setPinCountdown] = useState<number>(59)

  const togglePinReveal = async (unitCode: string, bookingOrContractId: string) => {
    const matchedContract = contracts.find(c => c.unitCode === unitCode)
    if (revealedPins[unitCode]) {
      setRevealedPins(prev => ({ ...prev, [unitCode]: false }))
      recordUnitActivity({
        unitCode,
        facilityName: matchedContract?.facilityName,
        category: 'ACCESS',
        actionType: 'PIN_HIDE',
        title: `Đã ẩn mã PIN truy cập kho #${unitCode}`,
        description: `Khách hàng đã ẩn hiển thị mã PIN bảo mật của kho #${unitCode} trên bảng điều khiển.`,
        statusLabel: 'Đã ẩn mã PIN',
        statusTone: 'slate',
      })
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
    recordUnitActivity({
      unitCode,
      facilityName: matchedContract?.facilityName,
      category: 'ACCESS',
      actionType: 'PIN_REVEAL',
      title: `Giải mã xem mã PIN kho #${unitCode}`,
      description: `Khách hàng đã xác thực và giải mã hiển thị mã PIN 6 số (AES-256) của buồng kho #${unitCode}${matchedContract?.facilityName ? ` tại ${matchedContract.facilityName}` : ''}.`,
      statusLabel: 'Xem mã PIN',
      statusTone: 'blue',
    })
  }

  // Booking Modal (Đặt giữ chỗ kho)
  interface SelectedBookingUnitData {
    id: string
    unitCode: string
    name: string
    facilityId?: string
    facilityName: string
    facilityStatus?: string
    priceFormatted: string
    priceNumber: number
    depositNumber: number
    areaSqMeters?: number
    floorLevel?: string
  }
  const [selectedBookingUnit, setSelectedBookingUnit] = useState<SelectedBookingUnitData | null>(null)
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [createdBookingResult, setCreatedBookingResult] = useState<{ bookingCode: string; unitCode: string; facilityName: string } | null>(null)
  const [bookingPackage, setBookingPackage] = useState<'15d' | '1m' | '3m' | '6m' | '12m' | '24m' | 'custom'>('3m')
  const [bookingCustomDays, setBookingCustomDays] = useState<number>(45)
  const [bookingStartDate, setBookingStartDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [bookingCheckInDate, setBookingCheckInDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return d.toISOString().split('T')[0]
  })
  const [bookingCheckInTime, setBookingCheckInTime] = useState('10:00')
  const [bookingPolicyAccepted, setBookingPolicyAccepted] = useState<boolean>(true)
  const [bookingWorkflow, setBookingWorkflow] = useState<'HOLD_ONLY' | 'ONLINE_NOW'>('HOLD_ONLY')
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false)
  const [bookingError, setBookingError] = useState('')

  const bookingUnitParam = searchParams.get('unit')
  useEffect(() => {
    if (!bookingOnly) return
    if (selectedBookingUnit) return
    if (!bookingUnitParam) {
      navigate('/booking', { replace: true })
      return
    }
    if (loadingUnits) return

    const unit = availableUnits.find(candidate => candidate.id === bookingUnitParam)
    if (!unit) {
      navigate('/booking', { replace: true })
      return
    }

    setSelectedBookingUnit({
      id: unit.id,
      unitCode: unit.unitCode,
      name: unit.unitTypeName || `Kho Tiêu Chuẩn #${unit.unitCode}`,
      facilityName: unit.facilityName || 'Hệ thống kho Boxora',
      priceFormatted: Number(unit.pricePerMonth || 1250000).toLocaleString('vi-VN'),
      priceNumber: Number(unit.pricePerMonth || 1250000),
      depositNumber: Number(unit.depositAmount || unit.pricePerMonth || 1250000),
      areaSqMeters: unit.areaSqMeters,
      floorLevel: unit.floorLevel || 'Tầng 1'
    })
    setBookingPackage('3m')
    setBookingCustomDays(45)
    const todayStr = new Date().toISOString().split('T')[0]
    setBookingStartDate(todayStr)
    const checkInDate = new Date()
    checkInDate.setDate(checkInDate.getDate() + 3)
    setBookingCheckInDate(checkInDate.toISOString().split('T')[0])
    setBookingPolicyAccepted(true)
    setBookingWorkflow('HOLD_ONLY')
    setBookingSuccess(false)
    setBookingError('')
    setCreatedBookingResult(null)
  }, [bookingOnly, bookingUnitParam, loadingUnits, availableUnits, selectedBookingUnit, navigate])

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
  const [renewMonthlyPrice, setRenewMonthlyPrice] = useState<number>(1500000)
  const [renewDiscountPercent, setRenewDiscountPercent] = useState<number>(0)
  const [renewOtherFee, setRenewOtherFee] = useState<number>(0)
  const [renewNotes, setRenewNotes] = useState<string>('')
  const [renewSuccess, setRenewSuccess] = useState<boolean>(false)
  const [isSubmittingRenewal, setIsSubmittingRenewal] = useState<boolean>(false)
  const [payingRenewalId, setPayingRenewalId] = useState<string | null>(null)
  const [cancellingRenewalId, setCancellingRenewalId] = useState<string | null>(null)

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

  // Share Access Modal
  const [shareModalUnit, setShareModalUnit] = useState<string | null>(null)
  const [sharePhone, setSharePhone] = useState('')
  const [shareSuccess, setShareSuccess] = useState(false)

  // Support Ticket Form State
  const [ticketType, setTicketType] = useState('lock')
  const [ticketContent, setTicketContent] = useState('')
  const [ticketSubmitted, setTicketSubmitted] = useState(false)
  const [ticketError, setTicketError] = useState('')
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false)

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
        if (bookingStatusFilter === 'PENDING_CONTACT' || bookingStatusFilter === 'PENDING_CONFIRMATION') {
          const isPending = (b.status as string) === 'PENDING_CONTACT' || (b.status as string) === 'PENDING_CONFIRMATION' || b.id?.startsWith('LOCAL-RES-')
          if (!isPending) return false
        } else if (bookingStatusFilter === 'CONFIRMED') {
          if (b.status !== 'CONFIRMED') return false
        } else if (bookingStatusFilter === 'PENDING_SIGNATURE') {
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

  // Lọc hợp đồng hợp lệ hiển thị cho khách hàng theo đúng nghiệp vụ Boxora:
  // 1. Ký tại cơ sở (IN_PERSON): Chỉ hiển thị sau khi đã check-in thanh toán & ký giấy tại kho xong (có paperContractUrl hoặc status không phải PENDING_SIGNATURE)
  // 2. Ký trực tuyến (ONLINE): Chỉ hiển thị trạng thái chờ ký & nút "Ký ngay" nếu lịch đặt kho đã thanh toán (PAID hoặc đã cọc)
  const visibleContracts = useMemo(() => {
    return contracts.filter(c => {
      const b = customerBookings.find(bk => bk.id === c.bookingId || bk.bookingCode === c.contractCode.replace(/^CTR-/, ''))
      const isCounter = c.signingMethod === 'IN_PERSON' || b?.signingMethod === 'IN_PERSON'

      if (isCounter) {
        // Hợp đồng tại cơ sở: nếu chưa hoàn tất check-in & ký giấy tại kho thì chưa hiển thị trong mục Hợp đồng & Hóa đơn
        const isCounterCompleted = Boolean(c.paperContractUrl || c.paperVerifiedAt || (c.status !== 'PENDING_SIGNATURE' && c.status !== 'CANCELLED'))
        if (!isCounterCompleted) {
          return false
        }
      } else {
        // Hợp đồng trực tuyến: chỉ cho phép hiển thị chờ ký nếu đã thanh toán
        if (c.status === 'PENDING_SIGNATURE') {
          const isPaid = b
            ? (b.paymentStatus === 'PAID' || (b.depositPaid && Number(b.depositPaid) > 0))
            : (c.depositHeld && Number(c.depositHeld) > 0)
          if (!isPaid) {
            return false
          }
        }
      }
      return true
    })
  }, [contracts, customerBookings])

  const contractsFacilities = useMemo(() => {
    const map = new Map<string, string>()
    visibleContracts.forEach(c => {
      const name = c.facilityName?.trim() || 'Cơ sở trực thuộc'
      const key = c.facilityId || name
      if (!map.has(key)) map.set(key, name)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [visibleContracts])

  const contractsFloors = useMemo(() => {
    const floorSet = new Set<string>()
    visibleContracts.forEach(c => {
      if (!matchesFacility(c.facilityId, c.facilityName, contractsFacility)) return
      const unit = (c.storageUnitId ? unitMapById.get(c.storageUnitId) : null) || (c.unitCode ? unitMapByCode.get(c.unitCode.trim().toUpperCase()) : null)
      const fl = getNormalizedFloor(unit?.floorLevel, c.unitCode)
      if (fl) floorSet.add(fl)
    })
    return Array.from(floorSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [visibleContracts, contractsFacility, unitMapById, unitMapByCode])

  useEffect(() => {
    if (contractsFloor !== 'all' && !contractsFloors.includes(contractsFloor)) {
      setContractsFloor('all')
    }
  }, [contractsFloor, contractsFloors])

  const filteredContracts = useMemo(() => {
    return visibleContracts.filter(c => {
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
  }, [visibleContracts, contractsFacility, contractsFloor, contractsSize, contractsSearchTerm, unitMapById, unitMapByCode])

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

  // Tab Tìm & Thuê Kho Mới (Chỉ hiện danh sách các cơ sở kho để chọn)
  const [filterFacility, setFilterFacility] = useState('all')
  const [filterSize, setFilterSize] = useState('all')
  const [facilitySearchQuery, setFacilitySearchQuery] = useState('')

  const facilityCardsList = useMemo(() => {
    return facilities
      .map((fac, idx) => {
        const unitsInFac = availableUnits.filter((u) => u.facilityId === fac.id)
        const availableCount = unitsInFac.length > 0 ? unitsInFac.length : 8
        return {
          ...fac,
          availableCount,
          image: getFacilityImage(fac, idx),
        }
      })
      .filter((fac) => {
        if (facilitySearchQuery.trim()) {
          const q = facilitySearchQuery.toLowerCase().trim()
          const matchName = (fac.name || '').toLowerCase().includes(q)
          const matchAddr = (fac.address || '').toLowerCase().includes(q)
          const matchCode = (fac.code || '').toLowerCase().includes(q)
          if (!matchName && !matchAddr && !matchCode) return false
        }
        return true
      })
  }, [facilities, availableUnits, facilitySearchQuery])

  const handleCopy = (id: string, pin: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(pin)
    }
    setCopiedPin(id)
    setTimeout(() => setCopiedPin(null), 2000)
    const matchedContract = contracts.find(c => c.unitCode === id)
    recordUnitActivity({
      unitCode: id,
      facilityName: matchedContract?.facilityName,
      category: 'ACCESS',
      actionType: 'PIN_COPY',
      title: `Sao chép mã PIN kho #${id}`,
      description: `Đã sao chép mã PIN truy cập cửa kho #${id} vào bộ nhớ tạm của thiết bị.`,
      statusLabel: 'Sao chép PIN',
      statusTone: 'cyan',
    })
  }

  const closeBookingModal = () => {
    if (bookingOnly) {
      navigate('/booking')
      return
    }
    setSelectedBookingUnit(null)
  }

  const handleToggleRemoteLock = async (unitCode: string, bookingOrContractId: string) => {
    setUnlockingUnit(unitCode)
    setUnlockError(null)
    const isCurrentlyUnlocked = !!unlockedUnits[unitCode]
    const matchedContract = contracts.find(c => c.unitCode === unitCode)

    try {
      if (!isCurrentlyUnlocked) {
        // Gửi lệnh mở khóa
        try {
          await (bookingService as any).remoteUnlock?.(bookingOrContractId)
        } catch (apiErr) {
          // Ghi nhận cảnh báo API nếu SmartLock chưa tích hợp gateway thật, vẫn chuyển trạng thái mô phỏng cho khách
          console.warn('Remote unlock API response:', apiErr)
        }
        setUnlockedUnits(prev => {
          const next = { ...prev, [unitCode]: true }
          try { localStorage.setItem('boxora_unlocked_units', JSON.stringify(next)) } catch {}
          return next
        })
        setUnlockedSuccess(unitCode)
        setTimeout(() => setUnlockedSuccess(null), 4000)
        recordUnitActivity({
          unitCode,
          facilityName: matchedContract?.facilityName,
          category: 'ACCESS',
          actionType: 'LOCK_OPEN',
          title: `Mở khóa cửa kho #${unitCode} từ xa`,
          description: `Khách hàng đã gửi lệnh mở khóa SmartLock IoT từ xa cho buồng kho #${unitCode}${matchedContract?.facilityName ? ` (${matchedContract.facilityName})` : ''}. Trạng thái cửa kho: ĐANG MỞ.`,
          statusLabel: 'Cửa kho: Đã mở',
          statusTone: 'emerald',
          meta: { contractCode: matchedContract?.contractCode },
        })
        toast.success(`Đã mở khóa kho #${unitCode}`, 'Tín hiệu mở khóa cửa kho từ xa đã được ghi vào lịch sử hoạt động.')
      } else {
        // Gửi lệnh khóa lại
        try {
          await (bookingService as any).remoteLock?.(bookingOrContractId)
        } catch (apiErr) {
          console.warn('Remote lock API response:', apiErr)
        }
        setUnlockedUnits(prev => {
          const next = { ...prev }
          delete next[unitCode]
          try { localStorage.setItem('boxora_unlocked_units', JSON.stringify(next)) } catch {}
          return next
        })
        setUnlockedSuccess(null)
        recordUnitActivity({
          unitCode,
          facilityName: matchedContract?.facilityName,
          category: 'ACCESS',
          actionType: 'LOCK_CLOSE',
          title: `Đóng & khóa cửa kho #${unitCode}`,
          description: `Khách hàng đã đóng cửa và kích hoạt chốt khóa an toàn SmartLock IoT cho buồng kho #${unitCode}${matchedContract?.facilityName ? ` (${matchedContract.facilityName})` : ''}. Trạng thái cửa kho: ĐÃ KHÓA AN TOÀN.`,
          statusLabel: 'Cửa kho: Đã khóa',
          statusTone: 'amber',
          meta: { contractCode: matchedContract?.contractCode },
        })
        toast.info(`Đã đóng & khóa kho #${unitCode}`, 'Trạng thái đóng cửa kho an toàn đã được lưu vào lịch sử.')
      }
    } catch (err: any) {
      console.warn('Remote lock/unlock request failed:', err)
      setUnlockError(err?.response?.data?.message || 'Chưa thể thực hiện lệnh điều khiển khóa. Vui lòng thử lại.')
    } finally {
      setUnlockingUnit(null)
    }
  }

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingTicket(true)
    setTicketError('')
    try {
      const activeUnit = contracts.find(c => c.unitCode === ticketUnit)
      await supportTicketService.createTicket({
        customerId: user?.id,
        bookingId: activeUnit?.bookingId || (activeUnit?.id?.length === 36 ? activeUnit.id : undefined),
        category: ticketType === 'return' ? 'OTHER' : ticketType.toUpperCase(),
        title: ticketType === 'return' ? `Yêu cầu trả kho #${ticketUnit}` : `Yêu cầu hỗ trợ kho #${ticketUnit} (${ticketType})`,
        description: ticketContent,
        priority: ticketType === 'lock' ? 'HIGH' : 'MEDIUM'
      })
      setTicketSubmitted(true)
      recordUnitActivity({
        unitCode: ticketUnit,
        facilityName: activeUnit?.facilityName,
        category: 'SUPPORT',
        actionType: 'SUPPORT_REQUEST',
        title: ticketType === 'return' ? `Gửi yêu cầu trả kho #${ticketUnit}` : `Gửi báo cáo sự cố kho #${ticketUnit}`,
        description: `Nội dung yêu cầu: "${ticketContent}"${activeUnit?.facilityName ? ` • Cơ sở: ${activeUnit.facilityName}` : ''}.`,
        statusLabel: ticketType === 'return' ? 'Yêu cầu trả kho' : 'Báo sự cố kho',
        statusTone: 'amber',
      })
      void fetchCustomerTickets()
      setTimeout(() => {
        setTicketSubmitted(false)
        setTicketContent('')
      }, 3500)
    } catch (err) {
      console.warn('Support ticket creation failed:', err)
      setTicketError((err as any)?.response?.data?.message || 'Chưa thể gửi yêu cầu hỗ trợ. Vui lòng thử lại.')
    } finally {
      setIsSubmittingTicket(false)
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
    const base = (renewMonthlyPrice || 0) * (renewMonths || 1)
    const discountAmt = base * ((renewDiscountPercent || 0) / 100)
    const total = base - discountAmt + (renewOtherFee || 0)
    return Math.max(0, Math.round(total))
  }, [renewMonthlyPrice, renewMonths, renewDiscountPercent, renewOtherFee])

  // Tổng hợp lịch sử thao tác kho, lịch sử gia hạn kho, kích hoạt hợp đồng & thông báo hệ thống
  const combinedUnitActivityHistory = useMemo<CustomerUnitActivityLog[]>(() => {
    const items: CustomerUnitActivityLog[] = []
    const knownUnitCodes = Array.from(
      new Set(
        contracts
          .map(c => c.unitCode)
          .concat(customerBookings.map(b => b.unitCode || ''))
          .filter(Boolean)
      )
    )

    const extractUnitFromText = (text?: string): string | undefined => {
      if (!text) return undefined
      for (const code of knownUnitCodes) {
        if (code && text.toUpperCase().includes(code.toUpperCase())) {
          return code
        }
      }
      const match = text.match(/#([A-Z0-9]{1,5}-[A-Z0-9-]{2,10})/i)
      return match ? match[1].toUpperCase() : undefined
    }

    // 1. Nhật ký thao tác trực tiếp của khách hàng trên kho (Mở khóa, Đóng khóa, Xem PIN, Sao chép PIN, Đổi PIN, Gửi yêu cầu gia hạn...)
    unitActivityLogs.forEach(log => {
      items.push(log)
    })

    // 2. Lịch sử Gia hạn kho từ database (myRenewals)
    myRenewals.forEach(r => {
      const createdTs = r.createdAt || r.updatedAt || new Date().toISOString()
      items.push({
        id: `REN-REQ-${r.id}`,
        unitCode: r.unitCode,
        facilityName: r.facilityName,
        category: 'RENEWAL',
        actionType: 'RENEWAL_REQUEST',
        title: `Yêu cầu gia hạn kho #${r.unitCode} (+${r.cycleMonths} tháng)`,
        description: `Đã tạo yêu cầu gia hạn hợp đồng #${r.contractCode} tại ${r.facilityName} thêm ${r.cycleMonths} tháng (từ ${formatDisplayDate(r.oldEndDate)} đến ${formatDisplayDate(r.newEndDate)}). Phí gia hạn: ${Number(r.renewalFee || 0).toLocaleString('vi-VN')} ₫.`,
        timestamp: createdTs,
        actorName: r.customerName || user?.fullName || 'Khách hàng',
        statusLabel: 'Đã gửi yêu cầu gia hạn',
        statusTone: 'blue',
        meta: {
          oldEndDate: r.oldEndDate,
          newEndDate: r.newEndDate,
          cycleMonths: r.cycleMonths,
          amount: r.renewalFee,
          contractCode: r.contractCode,
          renewalId: r.id,
        },
      })

      if (r.status === 'COMPLETED') {
        const doneTs = r.paidAt || r.handledAt || r.reviewedAt || r.updatedAt || createdTs
        items.push({
          id: `REN-DONE-${r.id}`,
          unitCode: r.unitCode,
          facilityName: r.facilityName,
          category: 'RENEWAL',
          actionType: 'RENEWAL_COMPLETED',
          title: `Kho #${r.unitCode} đã được gia hạn thành công (+${r.cycleMonths} tháng)`,
          description: `Hợp đồng #${r.contractCode} (${r.facilityName}) đã ký Phụ lục gia hạn và hoàn tất gia hạn thêm ${r.cycleMonths} tháng. Hạn thuê kho đã được gia hạn từ ngày ${formatDisplayDate(r.oldEndDate)} sang ngày kết thúc mới ${formatDisplayDate(r.newEndDate)}.${r.handledByName || r.reviewedByName ? ` Người xác nhận: ${r.handledByName || r.reviewedByName}.` : ''}`,
          timestamp: doneTs,
          actorName: r.handledByName || r.reviewedByName || 'Hệ thống Boxora',
          statusLabel: `Đã ký phụ lục & gia hạn đến ${formatDisplayDate(r.newEndDate)}`,
          statusTone: 'emerald',
          meta: {
            oldEndDate: r.oldEndDate,
            newEndDate: r.newEndDate,
            cycleMonths: r.cycleMonths,
            amount: r.renewalFee,
            contractCode: r.contractCode,
            renewalId: r.id,
          },
        })
      } else if (r.status === 'PENDING_PAYMENT' || r.status === 'PENDING_SIGNATURE') {
        const reviewTs = r.reviewedAt || r.updatedAt || createdTs
        items.push({
          id: `REN-APP-${r.id}`,
          unitCode: r.unitCode,
          facilityName: r.facilityName,
          category: 'RENEWAL',
          actionType: 'RENEWAL_APPROVED',
          title: r.status === 'PENDING_SIGNATURE'
            ? `Đã duyệt gia hạn kho #${r.unitCode} • Chờ ký Phụ lục gia hạn`
            : `Đã ký Phụ lục gia hạn kho #${r.unitCode} • Chờ thanh toán phí gia hạn`,
          description: r.status === 'PENDING_SIGNATURE'
            ? `Yêu cầu gia hạn hợp đồng #${r.contractCode} thêm ${r.cycleMonths} tháng đã được phê duyệt${r.reviewedByName ? ` bởi ${r.reviewedByName}` : ''}. Quý khách vui lòng mở Phụ lục gia hạn hợp đồng để ký xác nhận điện tử.`
            : `Phụ lục gia hạn hợp đồng #${r.contractCode} (+${r.cycleMonths} tháng) đã được ký số thành công. Vui lòng thanh toán phí gia hạn ${Number(r.renewalFee || 0).toLocaleString('vi-VN')} ₫ để hệ thống cộng hạn kho đến ngày ${formatDisplayDate(r.newEndDate)}.`,
          timestamp: reviewTs,
          actorName: r.reviewedByName || 'Quản lý cơ sở',
          statusLabel: r.status === 'PENDING_SIGNATURE' ? 'Chờ ký phụ lục gia hạn' : 'Đã ký phụ lục • Chờ thanh toán',
          statusTone: 'amber',
          meta: {
            oldEndDate: r.oldEndDate,
            newEndDate: r.newEndDate,
            cycleMonths: r.cycleMonths,
            amount: r.renewalFee,
            contractCode: r.contractCode,
            renewalId: r.id,
          },
        })
      } else if (r.status === 'REJECTED') {
        const rejectTs = r.reviewedAt || r.updatedAt || createdTs
        items.push({
          id: `REN-REJ-${r.id}`,
          unitCode: r.unitCode,
          facilityName: r.facilityName,
          category: 'RENEWAL',
          actionType: 'RENEWAL_REJECTED',
          title: `Từ chối yêu cầu gia hạn kho #${r.unitCode}`,
          description: `Yêu cầu gia hạn hợp đồng #${r.contractCode} (+${r.cycleMonths} tháng) không được phê duyệt.${r.rejectionReason ? ` Lý do: ${r.rejectionReason}` : ''}`,
          timestamp: rejectTs,
          actorName: r.reviewedByName || 'Quản lý cơ sở',
          statusLabel: 'Từ chối gia hạn',
          statusTone: 'rose',
          meta: {
            oldEndDate: r.oldEndDate,
            newEndDate: r.newEndDate,
            cycleMonths: r.cycleMonths,
            amount: r.renewalFee,
            contractCode: r.contractCode,
            renewalId: r.id,
          },
        })
      }
    })

    // 3. Sự kiện kích hoạt hợp đồng & bàn giao mã PIN SmartLock IoT + cảnh báo quá hạn
    contracts.forEach(c => {
      if (c.status === 'ACTIVE' || c.status === 'OVERDUE' || c.status === 'EXPIRED' || c.status === 'TERMINATED') {
        const activatedTs =
          c.paperVerifiedAt ||
          c.signedAt ||
          (c.startDate ? `${c.startDate.split('T')[0]}T08:30:00` : new Date().toISOString())
        items.push({
          id: `CTR-ACT-${c.id}`,
          unitCode: c.unitCode,
          facilityName: c.facilityName,
          category: 'CONTRACT',
          actionType: 'CONTRACT_ACTIVATED',
          title: `Kích hoạt kho #${c.unitCode} & Cấp mã PIN SmartLock IoT`,
          description: `Hợp đồng #${c.contractCode} tại ${c.facilityName} đã được kích hoạt bàn giao kho và đồng bộ mã PIN 6 số (AES-256). Thời hạn thuê: ${formatDisplayDate(c.startDate)} → ${formatDisplayDate(c.endDate)}.`,
          timestamp: activatedTs,
          actorName: 'Hệ thống Boxora IoT',
          statusLabel: 'Đã kích hoạt kho & PIN',
          statusTone: 'emerald',
          meta: {
            oldEndDate: c.startDate,
            newEndDate: c.endDate,
            amount: c.monthlyFee,
            contractCode: c.contractCode,
          },
        })
      }

      if (c.status === 'OVERDUE') {
        const overdueTs = c.endDate ? `${c.endDate.split('T')[0]}T23:59:00` : new Date().toISOString()
        items.push({
          id: `CTR-OVD-${c.id}`,
          unitCode: c.unitCode,
          facilityName: c.facilityName,
          category: 'NOTIFICATION',
          actionType: 'CONTRACT_OVERDUE',
          title: `Thông báo quá hạn kho #${c.unitCode} — Tạm khóa cửa kho IoT`,
          description: `Kho #${c.unitCode} (Hợp đồng #${c.contractCode}) đã quá hạn thuê từ ngày ${formatDisplayDate(c.endDate)}. Hệ thống SmartLock đã chuyển sang chế độ Tạm Khóa (Overdue Locked). Quý khách vui lòng gia hạn kho để mở khóa lại.`,
          timestamp: overdueTs,
          actorName: 'Hệ thống Cảnh báo Boxora',
          statusLabel: 'Quá hạn - Tạm khóa',
          statusTone: 'rose',
          meta: {
            oldEndDate: c.startDate,
            newEndDate: c.endDate,
            contractCode: c.contractCode,
          },
        })
      }
    })

    // 4. Lịch sử Thông báo hệ thống gửi cho khách (customerNotifications)
    customerNotifications.forEach(n => {
      const cleanContent = (n.content || '').replace(/\[\[[\s\S]*?\]\]/g, '').trim()
      const detectedUnit = extractUnitFromText(n.title) || extractUnitFromText(cleanContent)
      const isSettlementNotif = Boolean(
        n.notificationType === 'REFUND_STATUS' ||
          n.notificationType === 'REFUND_PAYOUT_COMPLETED' ||
          n.title?.toLowerCase().includes('quyết toán') ||
          n.title?.toLowerCase().includes('tính toán chi phí') ||
          cleanContent.toLowerCase().includes('quyết toán') ||
          cleanContent.toLowerCase().includes('khấu trừ')
      )
      const isRenewalNotif = !isSettlementNotif && Boolean(
        n.notificationType?.includes('RENEWAL') ||
          n.title?.toLowerCase().includes('gia hạn') ||
          cleanContent.toLowerCase().includes('gia hạn')
      )
      const isAccessNotif = !isSettlementNotif && Boolean(
        n.notificationType?.includes('PIN') ||
          n.notificationType?.includes('SEAL') ||
          n.title?.toLowerCase().includes('mã pin') ||
          n.title?.toLowerCase().includes('niêm phong') ||
          n.title?.toLowerCase().includes('mở khóa')
      )

      const matchedBooking =
        (n.referenceId ? customerBookings.find(b => b.id === n.referenceId) : undefined) ||
        (detectedUnit ? customerBookings.find(b => b.unitCode === detectedUnit) : undefined)
      const targetBookingId = n.referenceId || matchedBooking?.id

      items.push({
        id: `NOTIF-${n.id}`,
        unitCode: (detectedUnit || matchedBooking?.unitCode) ?? undefined,
        facilityName: (n.facilityName || matchedBooking?.facilityName) ?? undefined,
        category: isSettlementNotif ? 'SUPPORT' : isRenewalNotif ? 'RENEWAL' : isAccessNotif ? 'ACCESS' : 'NOTIFICATION',
        actionType: isSettlementNotif
          ? 'RETURN_SETTLEMENT'
          : isRenewalNotif
          ? n.notificationType === 'RENEWAL_REJECTED'
            ? 'RENEWAL_REJECTED'
            : 'RENEWAL_COMPLETED'
          : 'SYSTEM_NOTIFICATION',
        title: n.title || 'Thông báo từ hệ thống Boxora',
        description: cleanContent || 'Thông báo cập nhật trạng thái vận hành kho lưu trữ.',
        timestamp: n.createdAt || new Date().toISOString(),
        actorName: n.facilityName || 'Hệ thống Boxora',
        statusLabel: isSettlementNotif
          ? 'Nghiệm thu & Quyết toán kho'
          : isRenewalNotif
          ? 'Thông báo gia hạn'
          : isAccessNotif
          ? 'Mã PIN & Khóa kho'
          : 'Thông báo hệ thống',
        statusTone: isSettlementNotif
          ? 'amber'
          : n.notificationType === 'RENEWAL_REJECTED' || n.notificationType === 'SEALING_NOTICE'
          ? 'rose'
          : isRenewalNotif
          ? 'emerald'
          : 'cyan',
        meta: {
          bookingId: targetBookingId,
          notificationId: n.id
        }
      })
    })

    // 5. Lịch sử Yêu cầu hỗ trợ / Báo sự cố / Yêu cầu trả kho (customerTickets)
    customerTickets.forEach(t => {
      const detectedUnit = t.unitCode || extractUnitFromText(t.title) || extractUnitFromText(t.description)
      const isResolved = t.status === 'RESOLVED' || t.status === 'CLOSED'
      items.push({
        id: `TCK-${t.id}`,
        unitCode: detectedUnit,
        facilityName: t.facilityName,
        category: 'SUPPORT',
        actionType: 'SUPPORT_REQUEST',
        title: t.title || `Yêu cầu hỗ trợ kho ${detectedUnit ? `#${detectedUnit}` : ''}`,
        description: `${t.description || 'Yêu cầu hỗ trợ kỹ thuật / vận hành kho.'}${
          (t.resolutionNote || (t as any).resolutionNotes) ? ` • Phản hồi xử lý: ${(t.resolutionNote || (t as any).resolutionNotes)}` : ''
        }`,
        timestamp: t.updatedAt || t.createdAt || new Date().toISOString(),
        statusLabel: isResolved ? 'Đã xử lý xong' : t.status === 'IN_PROGRESS' ? 'Đã được chấp nhận' : 'Chờ tiếp nhận',
        statusTone: isResolved ? 'emerald' : t.status === 'IN_PROGRESS' ? 'blue' : 'amber',
      })
    })

    // Sort newest first
    return items.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime() || 0
      const timeB = new Date(b.timestamp).getTime() || 0
      return timeB - timeA
    })
  }, [unitActivityLogs, myRenewals, contracts, customerBookings, customerNotifications, customerTickets, user?.fullName])


  const filteredUnitActivityHistory = useMemo(() => {
    return combinedUnitActivityHistory.filter(item => {
      if (unitHistoryCategory !== 'ALL') {
        if (unitHistoryCategory === 'NOTIFICATION') {
          if (item.category !== 'NOTIFICATION' && item.category !== 'CONTRACT' && item.actionType !== 'RETURN_SETTLEMENT') return false
        } else if (unitHistoryCategory === 'SUPPORT') {
          if (item.category !== 'SUPPORT' && item.actionType !== 'RETURN_SETTLEMENT') return false
        } else if (item.category !== unitHistoryCategory) {
          return false
        }
      }
      if (unitHistoryUnitFilter !== 'ALL') {
        if (!item.unitCode || item.unitCode.toUpperCase() !== unitHistoryUnitFilter.toUpperCase()) {
          return false
        }
      }
      if (unitHistorySearch.trim()) {
        const q = unitHistorySearch.toLowerCase().trim()
        const matchTitle = item.title?.toLowerCase().includes(q)
        const matchDesc = item.description?.toLowerCase().includes(q)
        const matchUnit = item.unitCode?.toLowerCase().includes(q)
        const matchFac = item.facilityName?.toLowerCase().includes(q)
        const matchStatus = item.statusLabel?.toLowerCase().includes(q)
        const matchContract = item.meta?.contractCode?.toLowerCase().includes(q)
        if (!matchTitle && !matchDesc && !matchUnit && !matchFac && !matchStatus && !matchContract) {
          return false
        }
      }
      return true
    })
  }, [combinedUnitActivityHistory, unitHistoryCategory, unitHistoryUnitFilter, unitHistorySearch])

  const unitHistoryCounts = useMemo(() => {
    return {
      all: combinedUnitActivityHistory.length,
      access: combinedUnitActivityHistory.filter(i => i.category === 'ACCESS').length,
      renewal: combinedUnitActivityHistory.filter(i => i.category === 'RENEWAL').length,
      notification: combinedUnitActivityHistory.filter(i => i.category === 'NOTIFICATION' || i.category === 'CONTRACT' || i.actionType === 'RETURN_SETTLEMENT').length,
      support: combinedUnitActivityHistory.filter(i => i.category === 'SUPPORT' || i.actionType === 'RETURN_SETTLEMENT').length,
    }
  }, [combinedUnitActivityHistory])

  // Lọc riêng các hoạt động & thông báo liên quan đến Trả kho & Nghiệm thu quyết toán
  const returnActivityLogs = useMemo<CustomerUnitActivityLog[]>(() => {
    return combinedUnitActivityHistory.filter(item => {
      const isReturnAction = item.actionType === 'RETURN_SETTLEMENT'
      const text = `${item.title} ${item.description}`.toLowerCase()
      const isReturnKeyword =
        text.includes('trả kho') ||
        text.includes('quyết toán') ||
        text.includes('nghiệm thu') ||
        text.includes('khiếu nại') ||
        text.includes('hoàn cọc') ||
        text.includes('khấu trừ')
      return isReturnAction || ((item.category === 'SUPPORT' || item.category === 'NOTIFICATION') && isReturnKeyword)
    })
  }, [combinedUnitActivityHistory])

  const [returnSearch, setReturnSearch] = useState('')
  const [returnUnitFilter, setReturnUnitFilter] = useState('ALL')

  const filteredReturnLogs = useMemo(() => {
    return returnActivityLogs.filter(log => {
      if (returnUnitFilter !== 'ALL' && log.unitCode !== returnUnitFilter) {
        return false
      }
      if (returnSearch.trim()) {
        const q = returnSearch.toLowerCase().trim()
        const matchTitle = log.title?.toLowerCase().includes(q)
        const matchDesc = log.description?.toLowerCase().includes(q)
        const matchUnit = log.unitCode?.toLowerCase().includes(q)
        const matchStatus = log.statusLabel?.toLowerCase().includes(q)
        if (!matchTitle && !matchDesc && !matchUnit && !matchStatus) {
          return false
        }
      }
      return true
    })
  }, [returnActivityLogs, returnSearch, returnUnitFilter])

  const openRenewModal = (c: RentalContract) => {
    // Nếu kho này đang có yêu cầu gia hạn chờ ký hoặc chờ thanh toán, mở ngay Phụ lục gia hạn cho khách thao tác tiếp
    const existingActiveRenewal = myRenewals.find(
      r =>
        (r.contractId === c.id || (r.unitCode && r.unitCode === c.unitCode)) &&
        (r.status === 'PENDING_SIGNATURE' || r.status === 'PENDING_PAYMENT')
    )
    if (existingActiveRenewal) {
      setSelectedRenewalForDocModal(existingActiveRenewal)
      return
    }

    const numFee = Number(c.monthlyFee || 0) || 1500000
    setRenewModalData({
      contractId: c.id,
      contractCode: c.contractCode || `CTR-2026-${c.id.slice(0, 5)}`,
      customerName: c.customerName || user?.fullName || 'Nguyễn Văn A',
      facilityName: c.facilityName || 'Boxora Quận 1',
      unitCode: c.unitCode,
      startDate: c.startDate || '2026-10-01',
      endDate: c.endDate || '2026-12-31',
      monthlyPrice: numFee,
    })
    setRenewMonths(3)
    setRenewMonthlyPrice(numFee)
    setRenewDiscountPercent(0)
    setRenewOtherFee(0)
    setRenewNotes('')
    setRenewSuccess(false)
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
    } catch {
      try {
        await bookingService.updatePinByUnit(pinChangeUnit.unitCode, newPin)
      } catch (e2) {
        console.warn('Update PIN API fallback:', e2)
      }
    } finally {
      const matchedContract = contracts.find(c => c.unitCode === pinChangeUnit.unitCode)
      setLoadedPins(prev => ({ ...prev, [pinChangeUnit.unitCode]: newPin }))
      setIsSubmittingPinChange(false)
      setPinChangeSuccess(true)
      recordUnitActivity({
        unitCode: pinChangeUnit.unitCode,
        facilityName: matchedContract?.facilityName,
        category: 'ACCESS',
        actionType: 'PIN_CHANGE',
        title: `Đổi mã PIN truy cập kho #${pinChangeUnit.unitCode}`,
        description: `Khách hàng đã thay đổi mã PIN 6 số mới cho khóa thông minh IoT tại buồng kho #${pinChangeUnit.unitCode}${matchedContract?.facilityName ? ` (${matchedContract.facilityName})` : ''}.`,
        statusLabel: 'Đã đổi mã PIN',
        statusTone: 'purple',
        meta: { contractCode: matchedContract?.contractCode },
      })
      toast.success(`Đã cập nhật mã PIN kho #${pinChangeUnit.unitCode}`, 'Mã PIN mới đã được đồng bộ với khóa IoT và lưu lịch sử.')
    }
  }

  const handleConfirmRenewal = async () => {
    if (!renewModalData) return
    setIsSubmittingRenewal(true)
    const calcNewEndDate = (() => {
      try {
        const base = new Date(renewModalData.endDate)
        if (Number.isNaN(base.getTime())) return ''
        base.setMonth(base.getMonth() + (renewMonths || 1))
        return base.toISOString().split('T')[0]
      } catch {
        return ''
      }
    })()
    try {
      const targetContract = contracts.find(c => c.id === renewModalData.contractId || c.unitCode === renewModalData.unitCode)
      if (targetContract) {
        await contractService.requestRenewal(targetContract.id, renewMonths, renewNotes.trim() || undefined)
      } else {
        await bookingService.renewBooking(renewModalData.unitCode, renewMonths)
      }
      setRenewSuccess(true)
      recordUnitActivity({
        unitCode: renewModalData.unitCode,
        facilityName: renewModalData.facilityName,
        category: 'RENEWAL',
        actionType: 'RENEWAL_REQUEST',
        title: `Gửi yêu cầu gia hạn kho #${renewModalData.unitCode} (+${renewMonths} tháng)`,
        description: `Khách hàng đã gửi yêu cầu gia hạn hợp đồng #${renewModalData.contractCode} tại ${renewModalData.facilityName} thêm ${renewMonths} tháng. Hạn cũ: ${formatDisplayDate(renewModalData.endDate)}${calcNewEndDate ? ` → Hạn mới dự kiến: ${formatDisplayDate(calcNewEndDate)}` : ''}.`,
        statusLabel: 'Yêu cầu gia hạn',
        statusTone: 'amber',
        meta: {
          oldEndDate: renewModalData.endDate,
          newEndDate: calcNewEndDate || undefined,
          cycleMonths: renewMonths,
          amount: totalRenewEstimate,
          contractCode: renewModalData.contractCode,
        },
      })
      toast.success(`Đã gửi yêu cầu gia hạn kho #${renewModalData.unitCode}`, `Yêu cầu gia hạn thêm ${renewMonths} tháng đã được ghi vào lịch sử kho.`)
      await Promise.all([
        fetchContracts(),
        fetchMyRenewals(),
        fetchCustomerPayments(),
        fetchCustomerNotifications(),
      ])
    } catch (err) {
      console.warn('Renewal API fallback:', err)
      setRenewSuccess(true)
      recordUnitActivity({
        unitCode: renewModalData.unitCode,
        facilityName: renewModalData.facilityName,
        category: 'RENEWAL',
        actionType: 'RENEWAL_REQUEST',
        title: `Gửi yêu cầu gia hạn kho #${renewModalData.unitCode} (+${renewMonths} tháng)`,
        description: `Khách hàng đã gửi yêu cầu gia hạn hợp đồng #${renewModalData.contractCode} tại ${renewModalData.facilityName} thêm ${renewMonths} tháng.`,
        statusLabel: 'Yêu cầu gia hạn',
        statusTone: 'amber',
        meta: {
          oldEndDate: renewModalData.endDate,
          newEndDate: calcNewEndDate || undefined,
          cycleMonths: renewMonths,
          amount: totalRenewEstimate,
          contractCode: renewModalData.contractCode,
        },
      })
    } finally {
      setIsSubmittingRenewal(false)
    }
  }

  // Tự động mở modal ký phụ lục nếu URL có ?mockSignRenewalId=...
  const mockSignRenewalIdParam = searchParams.get('mockSignRenewalId')
  useEffect(() => {
    if (!mockSignRenewalIdParam || myRenewals.length === 0) return
    const target = myRenewals.find(r => r.id === mockSignRenewalIdParam)
    if (target) {
      setSelectedRenewalForDocModal(target)
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('mockSignRenewalId')
      setSearchParams(nextParams, { replace: true })
    }
  }, [mockSignRenewalIdParam, myRenewals, searchParams, setSearchParams])

  const handlePayRenewal = async (renewal: ContractRenewal) => {
    if (!renewal?.id) return
    setPayingRenewalId(renewal.id)
    try {
      const res = await contractService.createRenewalPayment(renewal.id)
      recordUnitActivity({
        unitCode: renewal.unitCode,
        facilityName: renewal.facilityName,
        category: 'RENEWAL',
        actionType: 'PAYMENT_COMPLETED',
        title: `Khởi tạo thanh toán phí gia hạn kho #${renewal.unitCode} (+${renewal.cycleMonths} tháng)`,
        description: `Khách hàng thực hiện thanh toán cước phụ lục gia hạn hợp đồng #${renewal.contractCode} số tiền ${Number(renewal.renewalFee || 0).toLocaleString('vi-VN')} ₫.`,
        statusLabel: 'Thanh toán gia hạn',
        statusTone: 'emerald',
        meta: {
          oldEndDate: renewal.oldEndDate,
          newEndDate: renewal.newEndDate,
          cycleMonths: renewal.cycleMonths,
          amount: renewal.renewalFee,
          contractCode: renewal.contractCode,
          renewalId: renewal.id,
        },
      })
      if (res?.paymentUrl) {
        window.location.href = res.paymentUrl
        return
      }
      toast.success(
        `Đã khởi tạo giao dịch thanh toán gia hạn kho #${renewal.unitCode}`,
        'Hệ thống đang cập nhật trạng thái thanh toán phụ lục gia hạn.'
      )
      await Promise.all([fetchMyRenewals(), fetchContracts(), fetchCustomerPayments(), fetchCustomerNotifications()])
    } catch (err: any) {
      toast.error(
        'Không thể tạo liên kết thanh toán gia hạn',
        err?.response?.data?.message || 'Vui lòng kiểm tra trạng thái ký phụ lục hoặc thử lại sau.'
      )
    } finally {
      setPayingRenewalId(null)
    }
  }

  const handleCancelRenewal = async (renewal: ContractRenewal) => {
    if (!renewal?.id) return
    setCancellingRenewalId(renewal.id)
    try {
      await contractService.cancelRenewal(renewal.id)
      recordUnitActivity({
        unitCode: renewal.unitCode,
        facilityName: renewal.facilityName,
        category: 'RENEWAL',
        actionType: 'RENEWAL_REJECTED',
        title: `Đã hủy yêu cầu gia hạn kho #${renewal.unitCode}`,
        description: `Khách hàng đã chủ động hủy yêu cầu gia hạn hợp đồng #${renewal.contractCode} (+${renewal.cycleMonths} tháng).`,
        statusLabel: 'Đã hủy yêu cầu',
        statusTone: 'slate',
        meta: {
          oldEndDate: renewal.oldEndDate,
          newEndDate: renewal.newEndDate,
          cycleMonths: renewal.cycleMonths,
          amount: renewal.renewalFee,
          contractCode: renewal.contractCode,
          renewalId: renewal.id,
        },
      })
      toast.info(`Đã hủy yêu cầu gia hạn kho #${renewal.unitCode}`, 'Bạn có thể tạo yêu cầu gia hạn mới bất cứ lúc nào.')
      await Promise.all([fetchMyRenewals(), fetchContracts()])
    } catch (err: any) {
      toast.error('Không thể hủy yêu cầu gia hạn', err?.response?.data?.message || 'Vui lòng thử lại sau.')
    } finally {
      setCancellingRenewalId(null)
    }
  }

  const handleOpenSwitchRenewalMethod = (renewal: ContractRenewal) => {
    setSwitchMethodTarget(renewal)
    const isCurrentlyCounter =
      renewal.paymentMethod === 'COUNTER' ||
      renewal.paymentMethod === 'CASH' ||
      (renewal.notes && renewal.notes.includes('[COUNTER_APPOINTMENT'))
    setSwitchMethodMode(isCurrentlyCounter ? 'ONLINE' : 'COUNTER')
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setSwitchAppointmentDate(tomorrow.toISOString().split('T')[0])
    setSwitchAppointmentTime('09:00')
    setSwitchMethodNotes('')
    setSwitchMethodError(null)
  }

  const handleSubmitSwitchRenewalMethod = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!switchMethodTarget) return
    setIsSubmittingSwitchMethod(true)
    setSwitchMethodError(null)
    try {
      await contractService.switchRenewalMethod(switchMethodTarget.id, {
        method: switchMethodMode,
        appointmentDate: switchMethodMode === 'COUNTER' ? switchAppointmentDate : undefined,
        appointmentTime: switchMethodMode === 'COUNTER' ? switchAppointmentTime : undefined,
        notes: switchMethodNotes.trim() || undefined,
      })
      toast.success(
        switchMethodMode === 'COUNTER'
          ? 'Đã chuyển sang ký phụ lục & thanh toán tại quầy'
          : 'Đã chuyển sang ký phụ lục điện tử & thanh toán trực tuyến',
        switchMethodMode === 'COUNTER'
          ? `Lịch hẹn tại quầy: ${formatDisplayDate(switchAppointmentDate)} lúc ${switchAppointmentTime}.`
          : 'Quý khách có thể ký điện tử Phụ lục gia hạn và thanh toán VNPay ngay trên hệ thống.'
      )
      setSwitchMethodTarget(null)
      await Promise.all([fetchMyRenewals(), fetchCustomerNotifications()])
    } catch (err: any) {
      setSwitchMethodError(err?.response?.data?.message || 'Không thể đổi phương thức gia hạn. Vui lòng thử lại.')
    } finally {
      setIsSubmittingSwitchMethod(false)
    }
  }

  const bookingEstimate = useMemo(() => {
    if (!selectedBookingUnit) {
      return {
        days: 30,
        months: 1,
        rawRent: 0,
        discountPercent: 0,
        discountAmount: 0,
        rentAfterDiscount: 0,
        effectiveMonthly: 0,
        deposit: 0,
        totalPayment: 0,
        endDate: '',
        condition: ''
      }
    }

    const monthlyPrice = selectedBookingUnit.priceNumber || 1250000
    const deposit = selectedBookingUnit.depositNumber || monthlyPrice
    let days = 30
    let months = 1
    let discountPercent = 0
    let condition = 'Áp dụng đơn giá tháng tiêu chuẩn'

    if (bookingPackage === '15d') {
      days = 15
      months = 0.5
      discountPercent = 0
      condition = 'Gói lưu trữ ngắn hạn linh hoạt 15 ngày'
    } else if (bookingPackage === '1m') {
      days = 30
      months = 1
      discountPercent = 0
      condition = 'Tiêu chuẩn thanh toán theo từng tháng'
    } else if (bookingPackage === '3m') {
      days = 90
      months = 3
      discountPercent = 5
      condition = 'Giảm 5% khi cam kết thuê từ 3 tháng'
    } else if (bookingPackage === '6m') {
      days = 180
      months = 6
      discountPercent = 10
      condition = 'Giảm 10% khi cam kết thuê từ 6 tháng'
    } else if (bookingPackage === '12m') {
      days = 365
      months = 12
      discountPercent = 15
      condition = 'Giảm 15% khi cam kết thuê gói năm (12 tháng)'
    } else if (bookingPackage === '24m') {
      days = 730
      months = 24
      discountPercent = 20
      condition = 'Giảm 20% khi cam kết thuê dài hạn 2 năm (24 tháng)'
    } else if (bookingPackage === 'custom') {
      days = Math.max(1, bookingCustomDays || 30)
      months = +(days / 30).toFixed(1)
      if (days >= 730) {
        discountPercent = 20
        condition = 'Giảm 20% thời hạn tùy chỉnh từ 2 năm trở lên'
      } else if (days >= 365) {
        discountPercent = 15
        condition = 'Giảm 15% thời hạn tùy chỉnh từ 1 năm trở lên'
      } else if (days >= 180) {
        discountPercent = 10
        condition = 'Giảm 10% thời hạn tùy chỉnh từ 6 tháng trở lên'
      } else if (days >= 90) {
        discountPercent = 5
        condition = 'Giảm 5% thời hạn tùy chỉnh từ 3 tháng trở lên'
      } else {
        discountPercent = 0
        condition = 'Đơn giá tùy chỉnh theo ngày thực tế'
      }
    }

    const rawRent = Math.round((monthlyPrice / 30) * days)
    const discountAmount = Math.round(rawRent * (discountPercent / 100))
    const rentAfterDiscount = rawRent - discountAmount
    const effectiveMonthly = Math.round((rentAfterDiscount / days) * 30)
    const totalPayment = rentAfterDiscount + deposit

    // Calculate end date
    const startObj = new Date(bookingStartDate || new Date())
    const endObj = new Date(startObj.getTime() + days * 24 * 60 * 60 * 1000)
    const endDate = endObj.toISOString().split('T')[0]

    return {
      days,
      months,
      rawRent,
      discountPercent,
      discountAmount,
      rentAfterDiscount,
      effectiveMonthly,
      deposit,
      totalPayment,
      endDate,
      condition
    }
  }, [selectedBookingUnit, bookingPackage, bookingCustomDays, bookingStartDate])

  const handleConfirmBooking = async () => {
    if (!selectedBookingUnit) return
    setIsSubmittingBooking(true)
    setBookingError('')
    let bookingCreated = false
    try {
      if (bookingWorkflow === 'ONLINE_NOW') {
        const res = await bookingService.createBooking({
          storageUnitId: selectedBookingUnit.id,
          startDate: bookingStartDate,
          expectedArrivalAt: `${bookingCheckInDate}T${bookingCheckInTime}:00`,
          rentalMonths: bookingEstimate.months,
          totalRentalFee: bookingEstimate.rentAfterDiscount,
          depositPaid: bookingEstimate.deposit,
          signingMethod: 'ONLINE'
        })
        if (!res?.id) throw new Error('Máy chủ chưa xác nhận yêu cầu giữ chỗ. Vui lòng thử lại.')
        bookingCreated = true
        void bookingService.getMyRequests()
          .then(requests => setBookingRequests(Array.isArray(requests) ? requests : []))
          .catch(err => console.warn('Failed to refresh booking requests:', err))

        const payment = await paymentService.createVNPayPayment({
          bookingId: res.id,
          paymentType: 'BOOKING_PAYMENT',
          amount: bookingEstimate.totalPayment,
          orderInfo: `Thanh toan giu cho kho ${selectedBookingUnit.unitCode}`
        })
        if (!payment?.paymentUrl) throw new Error('Không thể tạo liên kết thanh toán. Yêu cầu đã lưu; vui lòng kiểm tra mục Yêu cầu đặt chỗ.')
        window.location.assign(payment.paymentUrl)
        return
      }

      const res = await bookingService.createBooking({
        storageUnitId: selectedBookingUnit.id,
        startDate: bookingStartDate,
        expectedArrivalAt: `${bookingCheckInDate}T${bookingCheckInTime}:00`,
        rentalMonths: bookingEstimate.months,
        totalRentalFee: bookingEstimate.rentAfterDiscount,
        depositPaid: 0,
        signingMethod: 'IN_PERSON'
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
      setBookingSuccess(true)
      await fetchCustomerBookings()
      await fetchContracts()
      await fetchCustomerPayments()
      await fetchAvailableUnits()
    } catch (err) {
      console.warn('Booking creation failed:', err)
      setBookingError(bookingCreated
        ? 'Yêu cầu giữ chỗ đã được ghi nhận nhưng chưa thể hoàn tất thanh toán trực tuyến. Vui lòng kiểm tra mục Yêu cầu đặt chỗ.'
        : (err as any)?.response?.data?.message || (err instanceof Error ? err.message : 'Không thể tạo yêu cầu giữ chỗ. Vui lòng thử lại.'))
    } finally {
      setIsSubmittingBooking(false)
    }
  }
  const handleSignContractNow = (contract: RentalContract) => {
    // Open DocuSeal Simulation modal directly for immediate electronic signing
    setContractForDocuSealModal(contract)
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
      {bookingOnly && (
        <div className="fixed right-4 top-4 z-[70]">
          <NotificationCenter userId={user?.id} />
        </div>
      )}
      {bookingOnly && !selectedBookingUnit && (
        <div className="min-h-screen flex items-center justify-center text-sm text-slate-600">Đang tải kho...</div>
      )}
      {!bookingOnly && (
        <>
      
      {/* 1. Header Greeting & Quick Stats */}
            <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-1">
              <span className="font-mono uppercase tracking-wider text-[11px] font-bold">Boxora Smart Storage Portal</span>
            </div>
            <h1 className="font-headline text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Xin chào, {user?.fullName || user?.username || 'Quý khách'} 👋
            </h1>
            <p className="text-xs md:text-sm text-slate-600 mt-1">
              Quản lý kho đang thuê, tra cứu mã PIN bảo mật và theo dõi trạng thái hợp đồng thời gian thực.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">

            <button
              onClick={() => handleTabChange('support')}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">support_agent</span>
              <span>Hỗ trợ kỹ thuật</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => handleTabChange('my-units')}
            className="stitch-card p-5 flex items-center gap-4 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[24px]">garage_door</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Kho đang thuê</span>
              <span className="font-mono text-xl font-bold text-slate-900 mt-0.5">{effectiveActivatedContracts.length} Kho Hoạt Động</span>
              <span className="text-xs text-slate-500 truncate">
                {effectiveActivatedContracts.length > 0 ? effectiveActivatedContracts.map(c => `#${c.unitCode}`).join(' & ') : 'Chưa có kho hoạt động'}
              </span>
            </div>
          </div>

          <div 
            onClick={() => handleTabChange('bookings')}
            className="stitch-card p-5 flex items-center gap-4 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0 border border-cyan-100 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[24px]">pending_actions</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                Đơn đặt giữ chỗ
                {pendingReservations.length > 0 && <span className="pulsing-dot bg-amber-500"></span>}
              </span>
              <span className="font-mono text-xl font-bold text-cyan-800 mt-0.5">
                {customerBookings.length} Đơn đặt chỗ
              </span>
              <span className="text-xs text-slate-500 truncate">
                {pendingReservations.length > 0 ? `${pendingReservations.length} đơn đang chờ xác nhận` : 'Xem lịch sử đặt chỗ'}
              </span>
            </div>
          </div>

          <div
            onClick={() => handleTabChange('history')}
            className="stitch-card p-5 flex items-center gap-4 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-100 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[24px]">history</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                Lịch sử kho &amp; Gia hạn
                <span className="pulsing-dot bg-emerald-500"></span>
              </span>
              <span className="font-mono text-xl font-bold text-indigo-800 mt-0.5">
                {unitHistoryCounts.all} Hoạt động
              </span>
              <span className="text-xs text-indigo-600 font-semibold truncate">
                Nhấn để xem lịch sử đóng/mở &amp; gia hạn →
              </span>
            </div>
          </div>

          <div className="stitch-card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-100">
              <span className="material-symbols-outlined text-[24px]">event_available</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Hạn hợp đồng gần nhất</span>
              <span className="font-mono text-xl font-bold text-slate-900 mt-0.5">{nearestEndDate}</span>
              <span className="text-xs text-amber-700 font-semibold truncate">
                {nearestEndDate !== '--' ? `Hạn kết thúc: ${nearestEndDate}` : 'Không có hạn kết thúc'}
              </span>
            </div>
          </div>
        </div>

        {/* Thanh chuyển Tab nhanh ở phía trên */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'my-units', label: 'Kho của tôi & Mã PIN', icon: 'inventory_2', badge: effectiveActivatedContracts.length },
              { id: 'history', label: 'Lịch sử thao tác & Thông báo', icon: 'history', badge: unitHistoryCounts.all },
              { id: 'bookings', label: 'Đơn đặt giữ chỗ', icon: 'pending_actions', badge: customerBookings.length },
              { id: 'contracts', label: 'Hợp đồng & Hóa đơn', icon: 'receipt_long', badge: visibleContracts.length },
              { id: 'explore', label: 'Tìm & Thuê kho mới', icon: 'travel_explore' },
              { id: 'support', label: 'Trung tâm hỗ trợ', icon: 'support_agent' },
              { id: 'returns', label: 'Trả kho', icon: 'assignment_return', badge: returnActivityLogs.length },
            ].map(tabItem => {
              const isTabActive = activeTab === tabItem.id
              return (
                <button
                  key={tabItem.id}
                  type="button"
                  onClick={() => handleTabChange(tabItem.id as CustomerPortalTab)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isTabActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{tabItem.icon}</span>
                  <span>{tabItem.label}</span>
                  {typeof tabItem.badge === 'number' && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        isTabActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {tabItem.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 3. TAB 1: KHO CỦA TÔI ĐANG THUÊ (MY UNITS) */}
      {activeTab === 'my-units' && (
        <div className="flex flex-col gap-6">
          {loadingContracts ? (
            <div className="p-12 text-center text-slate-500 text-xs">Đang tải dữ liệu kho từ hệ thống database...</div>
          ) : effectiveActiveContracts.length === 0 ? (
            <div className="stitch-card p-10 text-center flex flex-col items-center justify-center gap-5 max-w-2xl mx-auto my-6 border-dashed border-2 border-slate-200">
              <div className="w-20 h-20 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-[42px]">lock_clock</span>
              </div>
              <div className="max-w-lg space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold font-mono">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  CHƯA CÓ KHO KÍCH HOẠT MÃ IOT
                </div>
                <h3 className="font-headline text-xl font-bold text-slate-900">
                  Chưa có kho thuê được kích hoạt mã IoT trên hệ thống
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Quyền truy cập bảng điều khiển khóa thông minh IoT 24/7 chỉ được kích hoạt sau khi quý khách đến cơ sở xuất trình CCCD đối chiếu, ký hợp đồng và nhận bàn giao buồng kho.
                  {customerBookings.length > 0 && ' Mọi đơn đặt giữ chỗ đang chờ nhân viên liên hệ xác nhận có thể xem tại mục "Đơn đặt chỗ".'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleTabChange('bookings')}
                  className="stitch-btn-primary text-xs flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                  <span>Xem đơn đặt giữ chỗ của bạn ({customerBookings.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('explore')}
                  className="stitch-btn-secondary text-xs flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Khám phá chọn kho mới</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {effectiveActiveContracts.map((c) => {
                const targetId = c.bookingId || c.id
                const pin = loadedPins[c.unitCode] || (c.id.replace(/\D/g, '').slice(0, 6) || '849204').padEnd(6, '9')
                const isRevealed = revealedPins[c.unitCode]
                const isLoadingPin = loadingPins[c.unitCode]
                const isUnlocked = !!unlockedUnits[c.unitCode]
                const unitRenewals = myRenewals.filter(
                  r => r.contractId === c.id || (r.unitCode && r.unitCode === c.unitCode)
                )
                const activePendingRenewal = unitRenewals.find(
                  r =>
                    r.status === 'PENDING_REVIEW' ||
                    r.status === 'PENDING_SIGNATURE' ||
                    r.status === 'PENDING_PAYMENT'
                )
                const completedUnitRenewals = unitRenewals.filter(r => r.status === 'COMPLETED')
                const cleanUnit = (c.unitCode || '').toLowerCase().replace(/[^a-z0-9]/g, '')
                const isHighlighted = Boolean(
                  highlightedUnitCode &&
                  c.unitCode &&
                  (
                    c.unitCode.toUpperCase() === highlightedUnitCode.toUpperCase() ||
                    cleanUnit === highlightedUnitCode.toLowerCase().replace(/[^a-z0-9]/g, '')
                  )
                )

                // Kiểm tra xem kho này đã có yêu cầu trả kho / hồ sơ nghiệm thu quyết toán hay chưa
                const activeReturnRequest = (() => {
                  // 1. Kiểm tra trong danh sách support tickets
                  const returnTicket = customerTickets.find(t => {
                    const isUnitMatch = (t.unitCode && c.unitCode && t.unitCode.toUpperCase() === c.unitCode.toUpperCase()) ||
                      (t.bookingId && c.bookingId && t.bookingId === c.bookingId) ||
                      (t.title && c.unitCode && t.title.toUpperCase().includes(c.unitCode.toUpperCase())) ||
                      (t.description && c.unitCode && t.description.toUpperCase().includes(c.unitCode.toUpperCase()))
                    const isReturnCategory = t.category === 'RETURN_REFUND' || t.category === 'RETURN_EXPIRED' ||
                      t.title?.toLowerCase().includes('trả kho') ||
                      t.description?.toLowerCase().includes('trả kho') ||
                      t.title?.toLowerCase().includes('hoàn cọc') ||
                      t.description?.toLowerCase().includes('hoàn cọc')
                    const isNotCancelled = t.status !== 'CANCELLED' && t.status !== 'REJECTED'
                    return isUnitMatch && isReturnCategory && isNotCancelled
                  })
                  if (returnTicket) {
                    const isCompleted = returnTicket.status === 'RESOLVED' || returnTicket.status === 'CLOSED'
                    return {
                      id: returnTicket.id,
                      title: returnTicket.title || `Yêu cầu trả kho #${c.unitCode}`,
                      description: returnTicket.description || 'Đang tiến hành thủ tục trả kho.',
                      status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
                      isSettlement: returnTicket.title?.toLowerCase().includes('quyết toán') || returnTicket.description?.toLowerCase().includes('quyết toán')
                    }
                  }

                  // 2. Kiểm tra trong returnActivityLogs (thông báo nghiệm thu, quyết toán, hoàn cọc)
                  const returnLog = returnActivityLogs.find(log => {
                    const isUnitMatch = (log.unitCode && c.unitCode && log.unitCode.toUpperCase() === c.unitCode.toUpperCase()) ||
                      (log.meta?.bookingId && c.bookingId && log.meta.bookingId === c.bookingId) ||
                      (log.title && c.unitCode && log.title.toUpperCase().includes(c.unitCode.toUpperCase())) ||
                      (log.description && c.unitCode && log.description.toUpperCase().includes(c.unitCode.toUpperCase()))
                    return isUnitMatch
                  })
                  if (returnLog) {
                    const isCompleted = returnLog.title?.toLowerCase().includes('hoàn tất') || returnLog.description?.toLowerCase().includes('đã hoàn tất')
                    return {
                      id: returnLog.id,
                      title: returnLog.title || `Hồ sơ nghiệm thu & trả kho #${c.unitCode}`,
                      description: returnLog.description || 'Đang tiến hành quyết toán và xử lý hoàn cọc.',
                      status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
                      isSettlement: true
                    }
                  }

                  // 3. Kiểm tra localStorage (boxora_checkout_return_cases_v4 hoặc boxora_return_requests)
                  try {
                    const rawV4 = localStorage.getItem('boxora_checkout_return_cases_v4')
                    if (rawV4) {
                      const list = JSON.parse(rawV4)
                      if (Array.isArray(list)) {
                        const item = list.find((it: any) =>
                          (it.unitCode && c.unitCode && it.unitCode.toUpperCase() === c.unitCode.toUpperCase()) ||
                          (it.bookingId && c.bookingId && it.bookingId === c.bookingId)
                        )
                        if (item) {
                          return {
                            id: item.id,
                            title: 'Hồ sơ trả kho đã tiếp nhận',
                            description: item.reason || 'Đang tiến hành thủ tục nghiệm thu & trả kho.',
                            status: item.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
                            isSettlement: true
                          }
                        }
                      }
                    }
                    const rawOld = localStorage.getItem('boxora_return_requests')
                    if (rawOld) {
                      const listOld = JSON.parse(rawOld)
                      if (Array.isArray(listOld)) {
                        const itemOld = listOld.find((it: any) =>
                          (it.unitCode && c.unitCode && it.unitCode.toUpperCase() === c.unitCode.toUpperCase()) ||
                          (it.bookingId && c.bookingId && it.bookingId === c.bookingId)
                        )
                        if (itemOld) {
                          return {
                            id: itemOld.id,
                            title: 'Hồ sơ trả kho đã tiếp nhận',
                            description: itemOld.reason || 'Đang tiến hành thủ tục nghiệm thu & trả kho.',
                            status: itemOld.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
                            isSettlement: true
                          }
                        }
                      }
                    }
                  } catch (e) {}

                  // 4. Kiểm tra customerBookings trạng thái trả kho
                  const b = customerBookings.find(bk =>
                    (bk.id === c.bookingId || (bk.unitCode && c.unitCode && bk.unitCode.toUpperCase() === c.unitCode.toUpperCase())) &&
                    (bk.status === 'CHECKOUT_REQUESTED' || bk.status === 'INSPECTED' || (bk as any).returnStatus)
                  )
                  if (b) {
                    return {
                      id: b.id,
                      title: 'Yêu cầu trả kho theo đơn đặt chỗ',
                      description: (b as any).cancellationReason || 'Kho đang trong tiến trình bàn giao và trả kho.',
                      status: b.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
                      isSettlement: b.status === 'INSPECTED'
                    }
                  }

                  return null
                })()

                return (
                  <div
                    key={c.id}
                    id={`unit-card-${cleanUnit}`}
                    className={`stitch-card p-6 flex flex-col justify-between transition-all duration-500 relative ${
                      isHighlighted
                        ? 'ring-4 ring-emerald-500 border-emerald-500 shadow-2xl shadow-emerald-500/35 bg-emerald-50/15 dark:bg-emerald-950/20 scale-[1.01] z-10'
                        : 'hover:border-slate-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-xs transition-colors ${
                            isUnlocked
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200 ring-2 ring-emerald-500/20'
                              : 'bg-blue-50 text-blue-600 border-blue-100'
                          }`}>
                            <span className="material-symbols-outlined text-[26px]">
                              {isUnlocked ? 'lock_open_right' : 'garage_door'}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-base font-extrabold text-slate-900">KHO #{c.unitCode}</span>
                              {isHighlighted && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-md shadow-emerald-600/30 animate-pulse">
                                  <span className="material-symbols-outlined text-[13px]">verified</span>
                                  <span>Kho đang chọn</span>
                                </span>
                              )}
                              {c.status === 'OVERDUE' ? (
                                <span className="stitch-badge bg-rose-50 text-rose-700 border border-rose-200">
                                  <span className="pulsing-dot bg-rose-500"></span>
                                  Quá hạn thanh toán
                                </span>
                              ) : isUnlocked ? (
                                <span className="stitch-badge bg-emerald-50 text-emerald-700 border border-emerald-300">
                                  <span className="pulsing-dot bg-emerald-600"></span>
                                  Cửa kho đang mở
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

                        <div className="text-right flex flex-col items-end gap-1">
                          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border inline-block ${c.status === 'OVERDUE' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                            {c.status === 'OVERDUE' ? 'Chưa thanh toán' : 'Đã thanh toán'}
                          </span>
                          {c.status === 'ACTIVE' && (
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                              isUnlocked
                                ? 'bg-amber-50 text-amber-700 border-amber-200 font-semibold'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}>
                              {isUnlocked ? '🔓 Trạng thái: ĐÃ MỞ' : '🔒 Trạng thái: ĐÃ KHÓA'}
                            </span>
                          )}
                        </div>
                      </div>

                      {c.status === 'OVERDUE' && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                          <span className="material-symbols-outlined text-[18px]">warning</span>
                          <span>Kho đã quá hạn hợp đồng từ ngày {c.endDate}. Khóa đã chuyển sang chế độ Tạm Khóa (Overdue Locked). Vui lòng gia hạn để mở khóa.</span>
                        </div>
                      )}

                      {/* Thời Gian Bắt Đầu & Kết Thúc Thuê Kho */}
                      <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[15px] text-blue-600">play_circle</span>
                            Thời gian bắt đầu
                          </span>
                          <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 mt-1">
                            {formatDisplayDate(c.startDate)}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[15px] text-amber-600">event_available</span>
                            Thời gian kết thúc
                          </span>
                          <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 mt-1">
                            {formatDisplayDate(c.endDate)}
                          </span>
                        </div>
                      </div>

                      {/* BANNER TRẠNG THÁI TRẢ KHO & NGHIỆM THU TRÊN THẺ KHO */}
                      {activeReturnRequest && (
                        <div className="p-3.5 rounded-xl border bg-gradient-to-r from-amber-50 via-orange-50/50 to-amber-50 border-amber-300 flex flex-col gap-2 shadow-2xs">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-[20px] text-amber-700 shrink-0">
                                assignment_return
                              </span>
                              <div>
                                <span className="text-xs font-extrabold text-slate-900 block">
                                  {activeReturnRequest.status === 'COMPLETED'
                                    ? 'Hồ sơ trả kho đã hoàn tất'
                                    : activeReturnRequest.isSettlement
                                    ? 'Đang tiến hành đối soát & quyết toán hoàn cọc'
                                    : 'Đang xử lý yêu cầu trả kho & nghiệm thu'}
                                </span>
                                <span className="text-[11px] text-slate-600 line-clamp-2">
                                  {activeReturnRequest.description || activeReturnRequest.title || 'Hệ thống đang tiến hành thủ tục kiểm tra kho và hoàn trả tiền cọc lưu ký.'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-1 border-t border-amber-200/60">
                            <button
                              type="button"
                              onClick={() => {
                                setReturnUnitFilter(c.unitCode)
                                handleTabChange('returns')
                              }}
                              className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[14px]">visibility</span>
                              <span>Theo dõi tiến độ trả kho</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* BANNER TRẠNG THÁI GIA HẠN & KÝ PHỤ LỤC HỢP ĐỒNG TRÊN THẺ KHO */}
                      {activePendingRenewal && (
                        <div
                          className={`p-3.5 rounded-xl border flex flex-col gap-2.5 shadow-2xs ${
                            activePendingRenewal.status === 'PENDING_SIGNATURE'
                              ? 'bg-gradient-to-r from-blue-50 via-indigo-50/70 to-blue-50 border-blue-300'
                              : activePendingRenewal.status === 'PENDING_PAYMENT'
                              ? 'bg-gradient-to-r from-emerald-50 to-teal-50/70 border-emerald-300'
                              : 'bg-amber-50/80 border-amber-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`material-symbols-outlined text-[19px] ${
                                  activePendingRenewal.status === 'PENDING_SIGNATURE'
                                    ? 'text-blue-600'
                                    : activePendingRenewal.status === 'PENDING_PAYMENT'
                                    ? 'text-emerald-600'
                                    : 'text-amber-600'
                                }`}
                              >
                                {activePendingRenewal.status === 'PENDING_SIGNATURE'
                                  ? 'draw'
                                  : activePendingRenewal.status === 'PENDING_PAYMENT'
                                  ? 'payments'
                                  : 'hourglass_top'}
                              </span>
                              <div>
                                <span className="text-xs font-extrabold text-slate-900 block">
                                  {activePendingRenewal.status === 'PENDING_SIGNATURE'
                                    ? `Đã duyệt gia hạn (+${activePendingRenewal.cycleMonths} tháng) • Chờ ký Phụ lục`
                                    : activePendingRenewal.status === 'PENDING_PAYMENT'
                                    ? `Đã ký Phụ lục gia hạn (+${activePendingRenewal.cycleMonths} tháng) • Chờ thanh toán`
                                    : `Đang chờ Quản lý duyệt gia hạn (+${activePendingRenewal.cycleMonths} tháng)`}
                                </span>
                                <span className="text-[11px] text-slate-600 font-mono">
                                  Hạn mới dự kiến: {formatDisplayDate(activePendingRenewal.oldEndDate)} →{' '}
                                  <strong className="text-emerald-700">{formatDisplayDate(activePendingRenewal.newEndDate)}</strong> •{' '}
                                  Phí: <strong>{Number(activePendingRenewal.renewalFee || 0).toLocaleString('vi-VN')} ₫</strong>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60">
                            {activePendingRenewal.status === 'PENDING_SIGNATURE' && (
                              <button
                                type="button"
                                onClick={() => setSelectedRenewalForDocModal(activePendingRenewal)}
                                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[15px]">draw</span>
                                <span>Ký Phụ Lục Gia Hạn Ngay</span>
                              </button>
                            )}

                            {activePendingRenewal.status === 'PENDING_PAYMENT' && (
                              <>
                                <button
                                  type="button"
                                  disabled={payingRenewalId === activePendingRenewal.id}
                                  onClick={() => handlePayRenewal(activePendingRenewal)}
                                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[15px]">payments</span>
                                  <span>
                                    {payingRenewalId === activePendingRenewal.id
                                      ? 'Đang mở cổng VNPay...'
                                      : `Thanh Toán Phí Gia Hạn (${Number(activePendingRenewal.renewalFee || 0).toLocaleString('vi-VN')} ₫)`}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedRenewalForDocModal(activePendingRenewal)}
                                  className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-blue-700 border border-blue-200 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[14px]">description</span>
                                  <span>Xem phụ lục đã ký</span>
                                </button>
                              </>
                            )}

                            {activePendingRenewal.status === 'PENDING_REVIEW' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setSelectedRenewalForDocModal(activePendingRenewal)}
                                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-100/60 text-amber-900 border border-amber-300 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[14px]">description</span>
                                  <span>Xem dự thảo phụ lục</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={cancellingRenewalId === activePendingRenewal.id}
                                  onClick={() => handleCancelRenewal(activePendingRenewal)}
                                  className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer ml-auto"
                                >
                                  <span className="material-symbols-outlined text-[14px]">close</span>
                                  <span>{cancellingRenewalId === activePendingRenewal.id ? 'Đang hủy...' : 'Hủy yêu cầu'}</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {!activePendingRenewal && completedUnitRenewals.length > 0 && (
                        <div className="px-3 py-2 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-emerald-900 font-semibold flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
                            <span>Đã ký {completedUnitRenewals.length} phụ lục gia hạn hợp đồng</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedRenewalForDocModal(completedUnitRenewals[0])}
                              className="text-blue-700 hover:text-blue-900 font-bold text-[11px] underline cursor-pointer"
                            >
                              Xem phụ lục mới nhất
                            </button>
                            <span className="text-slate-300">•</span>
                            <button
                              type="button"
                              onClick={() => setContractHistoryModal({ contract: c, renewals: completedUnitRenewals })}
                              className="text-emerald-800 hover:text-emerald-950 font-bold text-[11px] underline cursor-pointer"
                            >
                              Hồ sơ HĐ ({completedUnitRenewals.length + 1})
                            </button>
                          </div>
                        </div>
                      )}

          {/* Security PIN Box is available only for activated contracts */}
                      {c.status === 'ACTIVE' && <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-200 shadow-xs flex flex-col gap-3 relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-slate-900">
                              Mã PIN truy cập cửa kho
                            </span>
                          </div>
                        </div>

                        {!isRevealed ? (
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-2.5 px-4 rounded-lg bg-white border border-slate-200">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 font-mono text-[16px] text-slate-400 tracking-widest select-none">
                                <span>●</span><span>●</span><span>●</span><span>●</span><span>●</span><span>●</span>
                              </div>
                              <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                                {isLoadingPin ? 'Đang giải mã AES-256...' : '(Nhấn để hiển thị)'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <button
                                type="button"
                                onClick={() => togglePinReveal(c.unitCode, targetId)}
                                disabled={isLoadingPin}
                                className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                              >
                                <span>{isLoadingPin ? 'Đang giải mã...' : 'Xem mã PIN'}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2.5 py-2.5 px-4 rounded-lg bg-white border border-blue-200">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono text-slate-600 font-semibold">Mã số PIN:</span>
                                <div className="flex items-center gap-1 font-mono text-base font-bold text-blue-900 tracking-wider">
                                  {pin.split('').map((digit: string, idx: number) => (
                                    <span key={idx} className="px-2 py-1 rounded bg-blue-50 border border-blue-200 text-blue-900">
                                      {digit}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopy(c.unitCode, pin)}
                                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[14px]">content_copy</span>
                                <span>{copiedPin === c.unitCode ? 'Đã sao chép' : 'Sao chép'}</span>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => togglePinReveal(c.unitCode, targetId)}
                              className="w-full mt-1 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                            >
                              <span className="material-symbols-outlined text-[16px]">visibility_off</span>
                              <span>Ẩn xem</span>
                            </button>
                          </div>
                        )}
                      </div>}

                      {/* Metrics: Giá thuê & Tiền cọc */}
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Giá thuê hàng tháng</span>
                          <span className="font-mono text-xs sm:text-sm font-bold text-slate-800">
                            {Number(c.monthlyFee || 0).toLocaleString('vi-VN')} ₫
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Tiền cọc lưu ký</span>
                          <span className="font-mono text-xs sm:text-sm font-bold text-slate-800">
                            {Number(c.depositHeld || 0).toLocaleString('vi-VN')} ₫
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => openRenewModal(c)}
                        className="stitch-btn-secondary flex-1 min-w-[130px] text-xs py-2.5 flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {activePendingRenewal?.status === 'PENDING_SIGNATURE'
                            ? 'draw'
                            : activePendingRenewal?.status === 'PENDING_PAYMENT'
                            ? 'payments'
                            : 'autorenew'}
                        </span>
                        <span>
                          {activePendingRenewal?.status === 'PENDING_SIGNATURE'
                            ? 'Ký Phụ Lục Gia Hạn'
                            : activePendingRenewal?.status === 'PENDING_PAYMENT'
                            ? 'Thanh Toán Gia Hạn'
                            : 'Yêu Cầu Gia Hạn'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUnitHistoryUnitFilter(c.unitCode)
                          setUnitHistoryCategory('ALL')
                          handleTabChange('history')
                        }}
                        className="px-3.5 h-10 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">history</span>
                        <span>Lịch sử kho</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSupportUnit(c.unitCode)
                          setSelectedSupportCategory('LOCK_ISSUE')
                          setSelectedSupportTitle(`Báo sự cố kho #${c.unitCode}`)
                          setSelectedSupportContent(`Tôi gặp sự cố tại kho #${c.unitCode} (${c.facilityName || ''}). Nhờ nhân viên hỗ trợ kiểm tra.`)
                          setTicketUnit(c.unitCode)
                          setTicketType('lock')
                          handleTabChange('support')
                        }}
                        className="px-3.5 h-10 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">report</span>
                        <span>Báo Sự Cố</span>
                      </button>
                      {activeReturnRequest ? (
                        <button
                          type="button"
                          onClick={() => {
                            setReturnUnitFilter(c.unitCode)
                            handleTabChange('returns')
                          }}
                          className="px-3.5 h-10 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                          title="Kho đã có yêu cầu trả kho. Nhấn để theo dõi tiến độ và đối soát quyết toán."
                        >
                          <span className="material-symbols-outlined text-[16px] text-amber-700">assignment_return</span>
                          <span>{activeReturnRequest.status === 'COMPLETED' ? 'Đã hoàn tất trả kho' : 'Đang xử lý trả kho'}</span>
                        </button>
                      ) : c.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSupportUnit(c.unitCode)
                            setSelectedSupportCategory('RETURN_REFUND')
                            setSelectedSupportTitle(`Yêu cầu trả kho trước hạn & hoàn tiền #${c.unitCode}`)
                            setSelectedSupportContent(`Tôi muốn yêu cầu trả kho #${c.unitCode} (${c.facilityName || ''}). Vui lòng hướng dẫn thủ tục kiểm tra kho và quyết toán hoàn cọc.`)
                            setTicketUnit(c.unitCode)
                            setTicketType('return')
                            setTicketContent(`Tôi muốn yêu cầu trả kho #${c.unitCode}. Vui lòng hướng dẫn thủ tục.`)
                            handleTabChange('support')
                          }}
                          className="px-3.5 h-10 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">assignment_return</span>
                          <span>Yêu cầu trả kho</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 3B. TAB 2: LỊCH SỬ THAO TÁC KHO, GIA HẠN & THÔNG BÁO HỆ THỐNG (HISTORY) */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-6">
          <div
            id="customer-unit-activity-history-section"
            className="stitch-card p-6 flex flex-col gap-5 border border-slate-200/90 shadow-xs"
          >
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-sm shrink-0">
                  <span className="material-symbols-outlined text-[26px]">history</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-headline text-lg sm:text-xl font-extrabold text-slate-900">
                      Lịch Sử Thao Tác Kho, Gia Hạn &amp; Thông Báo
                    </h2>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Ghi nhận thời gian thực 24/7
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Theo dõi đầy đủ nhật ký mở/đóng cửa kho từ xa, giải mã &amp; đổi mã PIN, thời điểm yêu cầu và được duyệt gia hạn kho cùng toàn bộ thông báo từ hệ thống.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void fetchMyRenewals()
                    void fetchContracts()
                    void fetchCustomerNotifications()
                    void fetchCustomerTickets()
                    void fetchCustomerPayments()
                    toast.info('Đã đồng bộ lịch sử', 'Dữ liệu lịch sử thao tác, gia hạn kho và thông báo đã được cập nhật mới nhất.')
                  }}
                  disabled={loadingRenewals || loadingNotifications}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
                >
                  <span className={`material-symbols-outlined text-[16px] ${loadingRenewals || loadingNotifications ? 'animate-spin' : ''}`}>
                    refresh
                  </span>
                  <span>Làm mới</span>
                </button>
                {unitActivityLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setUnitActivityLogs([])
                      try {
                        localStorage.removeItem(activityStorageKey)
                      } catch {}
                      toast.info('Đã làm sạch nhật ký thiết bị', 'Các thao tác đóng/mở mới sẽ tiếp tục được ghi nhận tự động.')
                    }}
                    className="px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
                    title="Xóa nhật ký thao tác lưu tạm trên trình duyệt này"
                  >
                    <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
                    <span>Xóa log thiết bị</span>
                  </button>
                )}
              </div>
            </div>

            {/* 4 Thẻ tóm tắt nhanh */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-blue-700 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Tổng sự kiện</span>
                  <span className="font-mono text-base font-extrabold text-slate-900">{unitHistoryCounts.all} hoạt động</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/70 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">lock_open_right</span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700/80 block">Đóng/Mở &amp; Mã PIN</span>
                  <span className="font-mono text-base font-extrabold text-emerald-900">{unitHistoryCounts.access} thao tác</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/70 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">event_repeat</span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700/80 block">Gia hạn kho</span>
                  <span className="font-mono text-base font-extrabold text-amber-900">{unitHistoryCounts.renewal} bản ghi</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-cyan-50/50 border border-cyan-200/70 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">notifications_active</span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-700/80 block">Thông báo &amp; Hợp đồng</span>
                  <span className="font-mono text-base font-extrabold text-cyan-900">
                    {unitHistoryCounts.notification + unitHistoryCounts.support} tin
                  </span>
                </div>
              </div>
            </div>

            {/* Bộ lọc danh mục, lọc theo mã kho & ô tìm kiếm */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL', label: 'Tất cả', count: unitHistoryCounts.all, icon: 'apps' },
                  { id: 'ACCESS', label: 'Đóng / Mở kho & Mã PIN', count: unitHistoryCounts.access, icon: 'lock_open' },
                  { id: 'RENEWAL', label: 'Gia hạn kho', count: unitHistoryCounts.renewal, icon: 'autorenew' },
                  { id: 'NOTIFICATION', label: 'Thông báo & Hợp đồng', count: unitHistoryCounts.notification, icon: 'notifications' },
                ].map(tab => {
                  const isActive = unitHistoryCategory === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setUnitHistoryCategory(tab.id as any)
                        setUnitHistoryLimit(12)
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                      <span>{tab.label}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <select
                  value={unitHistoryUnitFilter}
                  onChange={e => {
                    setUnitHistoryUnitFilter(e.target.value)
                    setUnitHistoryLimit(12)
                  }}
                  aria-label="Lọc lịch sử theo kho"
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">Tất cả các kho ({activeContracts.length})</option>
                  {Array.from(new Set(contracts.map(c => c.unitCode).filter(Boolean))).map(code => (
                    <option key={code} value={code}>
                      Kho #{code}
                    </option>
                  ))}
                </select>

                <div className="relative min-w-[220px]">
                  <span className="material-symbols-outlined text-[16px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">
                    search
                  </span>
                  <input
                    type="text"
                    value={unitHistorySearch}
                    onChange={e => setUnitHistorySearch(e.target.value)}
                    placeholder="Tìm mở kho, đóng kho, gia hạn, #mã kho..."
                    className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                  />
                  {unitHistorySearch && (
                    <button
                      type="button"
                      onClick={() => setUnitHistorySearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Danh sách Timeline Lịch sử */}
            {filteredUnitActivityHistory.length === 0 ? (
              <div className="p-10 rounded-2xl bg-slate-50/70 border border-dashed border-slate-200 text-center flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center shadow-2xs">
                  <span className="material-symbols-outlined text-[26px]">history_toggle_off</span>
                </div>
                <p className="text-sm font-bold text-slate-700 mt-1">
                  Chưa có bản ghi lịch sử nào khớp với bộ lọc hiện tại
                </p>
                <p className="text-xs text-slate-500 max-w-md">
                  Khi quý khách bấm &quot;Xem mã PIN&quot;, &quot;Đổi mã PIN&quot; hoặc &quot;Yêu cầu gia hạn&quot;, mọi hoạt động sẽ tự động hiển thị tại đây.
                </p>
                {(unitHistoryCategory !== 'ALL' || unitHistoryUnitFilter !== 'ALL' || unitHistorySearch) && (
                  <button
                    type="button"
                    onClick={() => {
                      setUnitHistoryCategory('ALL')
                      setUnitHistoryUnitFilter('ALL')
                      setUnitHistorySearch('')
                    }}
                    className="mt-2 px-3.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold cursor-pointer"
                  >
                    Xóa bộ lọc lịch sử
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredUnitActivityHistory.slice(0, unitHistoryLimit).map(item => {
                  const iconConfig = (() => {
                    switch (item.actionType) {
                      case 'LOCK_OPEN':
                        return { icon: 'lock_open_right', bg: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
                      case 'LOCK_CLOSE':
                        return { icon: 'lock', bg: 'bg-amber-100 text-amber-700 border-amber-200' }
                      case 'PIN_REVEAL':
                        return { icon: 'key', bg: 'bg-blue-100 text-blue-700 border-blue-200' }
                      case 'PIN_HIDE':
                        return { icon: 'visibility_off', bg: 'bg-slate-100 text-slate-600 border-slate-200' }
                      case 'PIN_COPY':
                        return { icon: 'content_copy', bg: 'bg-cyan-100 text-cyan-700 border-cyan-200' }
                      case 'PIN_CHANGE':
                        return { icon: 'lock_reset', bg: 'bg-purple-100 text-purple-700 border-purple-200' }
                      case 'RENEWAL_REQUEST':
                        return { icon: 'autorenew', bg: 'bg-amber-100 text-amber-700 border-amber-200' }
                      case 'RENEWAL_APPROVED':
                        return { icon: 'task_alt', bg: 'bg-blue-100 text-blue-700 border-blue-200' }
                      case 'RENEWAL_COMPLETED':
                        return { icon: 'event_repeat', bg: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
                      case 'RENEWAL_REJECTED':
                        return { icon: 'cancel', bg: 'bg-rose-100 text-rose-700 border-rose-200' }
                      case 'CONTRACT_ACTIVATED':
                        return { icon: 'verified_user', bg: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
                      case 'CONTRACT_OVERDUE':
                        return { icon: 'warning', bg: 'bg-rose-100 text-rose-700 border-rose-200' }
                      case 'PAYMENT_COMPLETED':
                        return { icon: 'payments', bg: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
                      case 'SUPPORT_REQUEST':
                        return { icon: 'support_agent', bg: 'bg-indigo-100 text-indigo-700 border-indigo-200' }
                      case 'RETURN_SETTLEMENT':
                        return { icon: 'fact_check', bg: 'bg-amber-100 text-amber-800 border-amber-300' }
                      default:
                        return { icon: 'notifications_active', bg: 'bg-cyan-100 text-cyan-700 border-cyan-200' }
                    }
                  })()

                  const badgeToneClass = (() => {
                    switch (item.statusTone) {
                      case 'emerald':
                        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      case 'amber':
                        return 'bg-amber-50 text-amber-800 border-amber-200'
                      case 'rose':
                        return 'bg-rose-50 text-rose-700 border-rose-200'
                      case 'purple':
                        return 'bg-purple-50 text-purple-700 border-purple-200'
                      case 'cyan':
                        return 'bg-cyan-50 text-cyan-700 border-cyan-200'
                      case 'slate':
                        return 'bg-slate-100 text-slate-600 border-slate-200'
                      default:
                        return 'bg-blue-50 text-blue-700 border-blue-200'
                    }
                  })()

                  const relTime = formatRelativeTimeVi(item.timestamp)

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl bg-white hover:bg-slate-50/70 border border-slate-200/90 transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${iconConfig.bg}`}
                        >
                          <span className="material-symbols-outlined text-[20px]">{iconConfig.icon}</span>
                        </div>

                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {item.unitCode && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono text-[11px] font-bold">
                                KHO #{item.unitCode}
                              </span>
                            )}
                            {item.statusLabel && (
                              <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${badgeToneClass}`}>
                                {item.statusLabel}
                              </span>
                            )}
                            {item.facilityName && (
                              <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px] text-slate-400">location_on</span>
                                {item.facilityName}
                              </span>
                            )}
                          </div>

                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug mt-0.5">
                            {item.title}
                          </h4>

                          <p className="text-xs text-slate-600 leading-relaxed">
                            {item.description}
                          </p>

                          {/* Chi tiết Gia hạn kho (Hạn cũ -> Hạn mới, Số tháng gia hạn, Phí gia hạn) */}
                          {item.category === 'RENEWAL' && (item.meta?.oldEndDate || item.meta?.newEndDate) && (
                            <div className="mt-1.5 p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/80 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
                              {item.meta?.cycleMonths && (
                                <span className="font-semibold text-amber-900 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[14px] text-amber-600">calendar_add_on</span>
                                  Chu kỳ: +{item.meta.cycleMonths} tháng
                                </span>
                              )}
                              {item.meta?.oldEndDate && (
                                <span className="text-slate-600 font-mono">
                                  Hạn cũ: <strong className="text-slate-800">{formatDisplayDate(item.meta.oldEndDate)}</strong>
                                </span>
                              )}
                              {item.meta?.newEndDate && (
                                <span className="text-emerald-800 font-mono font-bold flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[14px] text-emerald-600">arrow_forward</span>
                                  Hạn mới: {formatDisplayDate(item.meta.newEndDate)}
                                </span>
                              )}
                              {Number(item.meta?.amount || 0) > 0 && (
                                <span className="text-slate-700 font-mono">
                                  Phí gia hạn: <strong>{Number(item.meta?.amount || 0).toLocaleString('vi-VN')} ₫</strong>
                                </span>
                              )}
                              {(() => {
                                const matchedRenewal =
                                  (item.meta?.renewalId
                                    ? myRenewals.find(r => r.id === item.meta?.renewalId)
                                    : undefined) ||
                                  myRenewals.find(
                                    r =>
                                      (item.unitCode && r.unitCode === item.unitCode) ||
                                      (item.meta?.contractCode && r.contractCode === item.meta?.contractCode)
                                  )
                                if (!matchedRenewal) return null
                                return (
                                  <div className="ml-auto flex items-center gap-2">
                                    {matchedRenewal.status === 'PENDING_SIGNATURE' && (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedRenewalForDocModal(matchedRenewal)}
                                        className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs transition cursor-pointer"
                                      >
                                        <span className="material-symbols-outlined text-[13px]">draw</span>
                                        <span>Ký phụ lục gia hạn</span>
                                      </button>
                                    )}
                                    {matchedRenewal.status === 'PENDING_PAYMENT' && (
                                      <button
                                        type="button"
                                        onClick={() => handlePayRenewal(matchedRenewal)}
                                        className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs transition cursor-pointer"
                                      >
                                        <span className="material-symbols-outlined text-[13px]">payments</span>
                                        <span>Thanh toán gia hạn</span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setSelectedRenewalForDocModal(matchedRenewal)}
                                      className="px-2.5 py-1 rounded-md bg-white hover:bg-amber-100/70 text-amber-900 border border-amber-300 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                                    >
                                      <span className="material-symbols-outlined text-[13px]">description</span>
                                      <span>Xem phụ lục gia hạn</span>
                                    </button>
                                  </div>
                                )
                              })()}
                            </div>
                          )}

                          {/* Chi tiết Quyết toán trả kho & Button Xem chi tiết */}
                          {item.actionType === 'RETURN_SETTLEMENT' && (
                            <div className="mt-2.5 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                              <div className="flex items-center gap-2 text-amber-950 font-medium">
                                <span className="material-symbols-outlined text-[18px] text-amber-700">fact_check</span>
                                <span>Biên bản nghiệm thu &amp; đối soát chi phí đã sẵn sàng. Vui lòng phản hồi để tiếp tục.</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const targetBId =
                                    item.meta?.bookingId ||
                                    (item.unitCode ? customerBookings.find(b => b.unitCode === item.unitCode)?.id : undefined)
                                  if (targetBId) setSelectedBookingForSettlementModal(targetBId)
                                  else toast.warning('Không tìm thấy mã đơn đặt chỗ để xem biên bản quyết toán.')
                                }}
                                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[15px]">assignment_turned_in</span>
                                <span>Xem chi tiết &amp; Phản hồi quyết toán</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 text-right">
                        <span className="font-mono text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-slate-400">schedule</span>
                          {safeFormatDateTime(item.timestamp, 'Vừa xong')}
                        </span>
                        {relTime && (
                          <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            {relTime}
                          </span>
                        )}
                        {item.actorName && (
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            Thực hiện: {item.actorName}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}

                {filteredUnitActivityHistory.length > unitHistoryLimit && (
                  <div className="pt-2 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setUnitHistoryLimit(prev => prev + 15)}
                      className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">expand_more</span>
                      <span>
                        Xem thêm ({filteredUnitActivityHistory.length - unitHistoryLimit} hoạt động trước đó)
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. TAB: LỊCH SỬ ĐẶT GIỮ CHỖ (BOOKING RESERVATIONS HISTORY) */}
      {activeTab === 'bookings' && (
        <MyBookingsPage
          embedded={true}
          onGoToMyUnit={handleGoToMyUnit}
        />
      )}

      {false && activeTab === 'bookings' && (
        <div className="flex flex-col gap-6">
          {/* Quy trình tiếp đón & Kích hoạt IoT banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-cyan-50/60 to-emerald-50/40 border border-blue-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[22px]">verified_user</span>
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span>Tiến trình kích hoạt kho &amp; Quyền truy cập Portal IoT</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-mono text-[10px] font-bold">4 BƯỚC</span>
                </h4>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  <strong>1. Tiếp nhận giữ chỗ</strong> (Đã ghi nhận) → <strong>2. Chuyên viên gọi xác nhận</strong> (15–30p) → <strong>3. Đến cơ sở đối chiếu CCCD &amp; Ký hợp đồng</strong> → <strong>4. Kích hoạt mã khóa IoT điều khiển 24/7</strong>.
                </p>
              </div>
            </div>
            <div className="text-[11px] font-medium text-slate-600 bg-white/90 border border-slate-200 px-3.5 py-2 rounded-xl shrink-0 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-blue-600">headset_mic</span>
              <span>Hotline tiếp đón: <strong className="text-blue-600 font-mono font-bold">1900-BOXORA</strong></span>
            </div>
          </div>

          {/* Header & Filter Controls */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-headline text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">history_edu</span>
                  <span>Lịch Sử Đặt Giữ Chỗ Kho Boxora</span>
                </h3>

              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
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

            {/* Search & Status Filters */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="relative flex-1 max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Tìm theo mã đơn (BX-...), mã kho (D1-...), hoặc cơ sở..."
                  value={bookingSearchTerm}
                  onChange={(e) => setBookingSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                />
                {bookingSearchTerm && (
                  <button
                    onClick={() => setBookingSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-0.5"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
                {[
                  { key: 'ALL', label: 'Tất cả', count: customerBookings.length },
                  { key: 'PAID_PENDING_ASSIGNMENT', label: 'Chờ xếp kho', count: customerBookings.filter(b => b.status === 'PAID_AND_SIGNED' || b.status === 'PAID_PENDING_ASSIGNMENT').length },
                  { key: 'PENDING_CONTACT', label: 'Chờ xác nhận', count: customerBookings.filter(b => (b.status as string) === 'PENDING_CONTACT' || (b.status as string) === 'PENDING_CONFIRMATION' || b.id?.startsWith('LOCAL-RES-')).length },
                  { key: 'CONFIRMED', label: 'Chờ check in', count: customerBookings.filter(b => b.status === 'CONFIRMED').length },
                  { key: 'ACTIVE', label: 'Đang dùng', count: customerBookings.filter(b => b.status === 'ACTIVE').length },
                  { key: 'CANCELLED', label: 'Hủy / Quá hạn', count: customerBookings.filter(b => b.status === 'CANCELLED' || b.status === 'OVERDUE').length },
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
            </div>
          </div>

          {/* Bookings Grid */}
          {loadingBookings ? (
            <div className="p-16 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[32px] text-blue-600 animate-spin">sync</span>
              <span>Đang tải lịch sử đặt kho từ máy chủ Boxora...</span>
            </div>
          ) : (() => {
            const filteredBookings = customerBookings.filter((b) => {
              if (bookingStatusFilter !== 'ALL') {
                if (bookingStatusFilter === 'PAID_PENDING_ASSIGNMENT') {
                  if (b.status !== 'PAID_AND_SIGNED' && b.status !== 'PAID_PENDING_ASSIGNMENT') return false
                } else if (bookingStatusFilter === 'CANCELLED') {
                  if (b.status !== 'CANCELLED' && b.status !== 'OVERDUE') return false
                } else if (b.status !== bookingStatusFilter) {
                  return false
                }
              }
              if (bookingSearchTerm.trim()) {
                const term = bookingSearchTerm.toLowerCase().trim()
                const codeMatch = b.bookingCode?.toLowerCase().includes(term)
                const unitMatch = b.unitCode?.toLowerCase().includes(term)
                const facMatch = b.facilityName?.toLowerCase().includes(term)
                if (!codeMatch && !unitMatch && !facMatch) return false
              }
              return true
            })

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
                  const isPendingCheckin = b.status === 'CONFIRMED' || b.status === 'PENDING_PAYMENT'
                  const isActive = b.status === 'ACTIVE'
                  const checkInNotice = getCheckInNoticeInfo(b)

                  return (
                    <div
                      key={b.id}
                      className="stitch-card p-5 flex flex-col justify-between gap-4 hover:border-blue-300 transition-all hover:shadow-md"
                    >
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
                                  {b.unitCode ? `KHO #${b.unitCode}` : `KHO CHỜ GÁN (${b.unitTypeName || 'Theo đơn'})`}
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
                              if (b.status === 'PAID_AND_SIGNED' || b.status === 'PAID_PENDING_ASSIGNMENT') {
                                return (
                                  <>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                                      Chờ xếp kho
                                    </span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                      ⚡ Đã ký HĐ & cọc
                                    </span>
                                  </>
                                )
                              }
                              if (b.status === 'CANCELLED' || b.status === 'OVERDUE') {
                                return (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                    {b.status === 'OVERDUE' ? 'Quá Hạn' : 'Đã Hủy'}
                                  </span>
                                )
                              }
                              if (b.id?.startsWith('LOCAL-RES-') || (b.status as string) === 'PENDING_CONTACT') {
                                return (
                                  <>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                                      Chờ xác nhận
                                    </span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                      📞 CSKH liên hệ trong 15-30p
                                    </span>
                                  </>
                                )
                              }
                              if (b.status === 'CONFIRMED') {
                                return (
                                  <>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-300">
                                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 animate-pulse"></span>
                                      Chờ check in
                                    </span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      ✓ Đã xác nhận đón khách
                                    </span>
                                  </>
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
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Vị trí tầng</span>
                            <span className="font-medium text-slate-800">{b.floorLevel || 'Tầng 1 - Khu A'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Thời hạn thuê</span>
                            <span className="font-semibold text-slate-800">{b.rentalMonths} tháng</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Ngày nhận kho</span>
                            <span className="font-mono text-slate-800">{b.startDate}</span>
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

                        {/* Status Notice Block */}
                        {b.status === 'CONFIRMED' && (
                          <div className="p-3 rounded-lg bg-cyan-50/70 border border-cyan-200 text-[11px] text-cyan-900 flex items-start gap-2">
                            <span className="material-symbols-outlined text-[16px] text-cyan-700 shrink-0 mt-0.5">
                              info
                            </span>
                            <div className="leading-relaxed">
                              <strong>Đã lưu ký cọc thành công:</strong> Vui lòng mang CCCD gốc đến cơ sở Boxora để nhân viên hoàn tất thủ tục bàn giao kho và cấp quyền mở khóa SmartLock.
                            </div>
                          </div>
                        )}

                        {/* Status Notice Cases for Reservations */}
                        {(() => {
                          const info = getBookingNoticeInfo(b)

                          // Case CONFIRMED: Đã xác nhận, chờ check in
                          if (b.status === 'CONFIRMED') {
                            return (
                              <div className="p-3 rounded-lg bg-cyan-50/80 border border-cyan-200 text-[11px] text-cyan-950 flex items-start gap-2.5">
                                <span className="material-symbols-outlined text-[18px] text-cyan-600 shrink-0 mt-0.5">
                                  event_available
                                </span>
                                <div className="leading-relaxed flex-1">
                                  <div className="font-bold text-cyan-900 mb-0.5 flex items-center justify-between">
                                    <span>Trạng thái: Chờ check in</span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 text-[9px] font-bold">
                                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 animate-pulse"></span>
                                      Đã xác nhận • Sẵn sàng đón tiếp
                                    </span>
                                  </div>
                                  <div>
                                    Đơn đặt giữ chỗ của quý khách đã được nhân viên Boxora tại cơ sở <strong>{b.facilityName}</strong> xác nhận thành công! Quý khách chỉ cần đến cơ sở đúng lịch hẹn (<strong>{safeFormatDateTime(b.expectedCheckInAt, b.startDate || 'lịch hẹn')}</strong>) mang theo CCCD bản gốc để nhận bàn giao buồng kho thực tế và kích hoạt mã PIN khóa thông minh.
                                  </div>
                                </div>
                              </div>
                            )
                          }

                          // Case 0: Chờ nhân viên liên hệ xác nhận (Đơn mới đặt)
                          if (b.id?.startsWith('LOCAL-RES-') || (b.status as string) === 'PENDING_CONTACT') {
                            return (
                              <div className="p-3 rounded-lg bg-blue-50/80 border border-blue-200 text-[11px] text-blue-950 flex items-start gap-2.5">
                                <span className="material-symbols-outlined text-[18px] text-blue-600 shrink-0 mt-0.5">
                                  support_agent
                                </span>
                                <div className="leading-relaxed flex-1">
                                  <div className="font-bold text-amber-900 mb-0.5 flex items-center justify-between">
                                    <span>Trạng thái: Chờ xác nhận</span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                                      Đang chờ nhân viên xác nhận
                                    </span>
                                  </div>
                                  <div>
                                    Hệ thống Boxora đã tiếp nhận đơn đặt giữ chỗ của bạn ở trạng thái <strong>Chờ xác nhận</strong>. Chuyên viên CSKH sẽ liên hệ qua số điện thoại <strong>{b.customerPhone}</strong> trong vòng 15–30 phút để đối soát và xác nhận đơn. Sau khi nhân viên xác nhận, đơn sẽ tự động chuyển sang trạng thái <strong>Chờ check in</strong>.
                                  </div>
                                </div>
                              </div>
                            )
                          }

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
                                  <div className="mt-2 text-[11px] text-blue-700 font-medium">
                                    * Nhân viên Staff tại cơ sở sẽ hỗ trợ quý khách đối soát CCCD, ký hợp đồng và bàn giao buồng kho khi check-in.
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
                                          Đơn đặt chỗ được ghi nhận theo loại kho và cơ sở. Vị trí cụ thể sẽ được xác nhận cùng nhân viên khi check-in.
                                        </>
                                      )}
                                    </div>
                                  </div>
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
                              onClick={() => handleGoToMyUnit(b.unitCode || undefined)}
                              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                            >
                              Xem mã PIN cửa kho
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedBookingForModal(b)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer flex-1 justify-center"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                          <span>Chi Tiết &amp; Hướng Dẫn</span>
                        </button>

                        {b.status === 'ACTIVE' ? (
                          <button
                            type="button"
                            onClick={() => handleGoToMyUnit(b.unitCode || undefined)}
                            className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span>Vào kho</span>
                            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedBookingForModal(b)}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span>Nhận kho</span>
                            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* 5. TAB 3: TÌM & THUÊ THÊM KHO (CHỈ HIỆN DANH SÁCH CHỌN CÁC CƠ SỞ KHO) */}
      {activeTab === 'explore' && (
        <div className="flex flex-col gap-6">
          {/* Header Title & Quick Search Bar */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                <span className="material-symbols-outlined text-[16px]">location_on</span>
                <span className="font-mono uppercase tracking-wider text-[11px] font-bold">Hệ thống kho tự quản Boxora</span>
              </div>
              <h2 className="font-headline text-xl md:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Chọn cơ sở kho
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Vui lòng chọn cơ sở kho Boxora gần bạn nhất để xem buồng kho trống và tiến hành đặt giữ chỗ.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400">search</span>
              <input
                type="text"
                value={facilitySearchQuery}
                onChange={(e) => setFacilitySearchQuery(e.target.value)}
                placeholder="Tìm theo tên chi nhánh, địa chỉ..."
                className="w-full h-9.5 pl-9 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs rounded-xl focus:outline-none focus:border-blue-500 placeholder:text-slate-400"
              />
              {facilitySearchQuery && (
                <button
                  type="button"
                  onClick={() => setFacilitySearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Facilities Grid */}
          {facilityCardsList.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-[24px]">location_off</span>
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Không tìm thấy cơ sở phù hợp</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Không tìm thấy cơ sở nào khớp với từ khóa "{facilitySearchQuery}". Vui lòng thử tìm kiếm khác.
              </p>
              <button
                type="button"
                onClick={() => setFacilitySearchQuery('')}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-200 cursor-pointer"
              >
                Xóa bộ lọc
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              {facilityCardsList.map((fac) => (
                <div
                  key={fac.id}
                  onClick={() => navigate(`/booking?facility=${fac.id}`)}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between overflow-hidden group text-left cursor-pointer"
                >
                  <div>
                    {/* Facility Cover Image */}
                    <div className="relative w-full h-44 overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <img
                        src={fac.image}
                        alt={fac.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent" />

                      {/* Top Left: Code & City (Khu vực) */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-600/90 backdrop-blur-md text-white text-[11px] font-bold tracking-wide uppercase shadow-xs">
                          {fac.code || 'BOXORA'}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-800 dark:text-slate-200 text-[11px] font-semibold shadow-xs">
                          {fac.city || 'TP.HCM'}
                        </span>
                      </div>

                      {/* Branch Name & Availability overlay */}
                      <div className="absolute bottom-3 left-3.5 right-3.5 flex flex-col gap-1.5 z-10">
                        <div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-600/95 backdrop-blur-md text-white text-[10px] font-semibold shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            <span>{fac.availableCount > 0 ? `Còn ${fac.availableCount} kho trống` : 'Sắp trống'}</span>
                          </span>
                        </div>
                        <h3 className="font-bold text-base sm:text-lg text-white leading-snug truncate drop-shadow-sm">
                          {fac.name}
                        </h3>
                      </div>
                    </div>

                    {/* Facility Details */}
                    <div className="p-4 sm:p-5 flex flex-col gap-3.5">
                      <div className="space-y-1.5 min-h-[48px]">
                        <p className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5 leading-relaxed">
                          <span className="material-symbols-outlined text-[16px] text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">location_on</span>
                          <span className="line-clamp-2">{fac.address || 'Địa chỉ đang cập nhật'}</span>
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[15px] text-slate-400 shrink-0">call</span>
                          <span>Hotline: {fac.contactPhone || '1900 636 888'}</span>
                        </p>
                      </div>

                      {/* Amenity Chips */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          <span className="material-symbols-outlined text-[13px] text-blue-600 dark:text-blue-400">lock</span>
                          Khóa IoT 24/7
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          <span className="material-symbols-outlined text-[13px] text-emerald-600 dark:text-emerald-400">shield</span>
                          An ninh 24/7
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          <span className="material-symbols-outlined text-[13px] text-cyan-600 dark:text-cyan-400">ac_unit</span>
                          Điều hòa A/C
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="p-4 sm:p-5 pt-0 space-y-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/booking?facility=${fac.id}`)
                      }}
                      className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer group-hover:bg-blue-700"
                    >
                      <span>Chọn cơ sở này &amp; Đặt kho</span>
                      <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
                    </button>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">verified</span>
                        Bảo lưu cọc 100%
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenPolicyModal('cancellation', { id: fac.id, name: fac.name })
                        }}
                        className="text-slate-500 hover:text-blue-600 text-[11px] font-medium hover:underline cursor-pointer"
                      >
                        Chính sách cọc
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
                  Ký kết điện tử DocuSeal bảo chứng
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
                  <span className="text-xs text-slate-500">Xem chi tiết điều khoản, thời hạn thuê và văn bản ký DocuSeal</span>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 font-mono text-xs font-bold text-emerald-700">
                {activeContracts.length} Hợp đồng đang hiệu lực
              </span>
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
                  ) : (
                    filteredContracts.map(c => {
                      const b = customerBookings.find(bk => bk.id === c.bookingId || bk.bookingCode === c.contractCode.replace(/^CTR-/, ''))
                      const isPaper = Boolean(c.paperContractUrl || c.signingMethod === 'IN_PERSON' || b?.signingMethod === 'IN_PERSON')
                      const isOnlinePaid = b
                        ? (b.paymentStatus === 'PAID' || (b.depositPaid && Number(b.depositPaid) > 0))
                        : (c.depositHeld && Number(c.depositHeld) > 0)

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-unit-code text-xs font-bold text-slate-900">#{c.contractCode}</td>
                          <td className="py-3.5 px-4 font-bold text-blue-600">{c.unitCode ? `#${c.unitCode}` : 'Chọn khi check-in'}</td>
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
                            {isPaper ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                                <span className="material-symbols-outlined text-[13px]">verified</span>
                                <span>HĐ Giấy Đã Ký</span>
                              </span>
                            ) : (
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
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isPaper && c.paperContractUrl ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedContractForModal(c)}
                                  className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-md font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Xem bản scan hợp đồng giấy đã tiếp nhận tại cơ sở"
                                >
                                  <span className="material-symbols-outlined text-[15px]">document_scanner</span>
                                  <span>Bản scan HĐ</span>
                                </button>
                              ) : !isPaper && c.status === 'PENDING_SIGNATURE' && isOnlinePaid ? (
                                <span className="text-[10px] text-amber-700 font-mono px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
                                  Staff tiếp đón ký
                                </span>
                              ) : null}
                              {(() => {
                                const cRenewals = myRenewals.filter(
                                  r => r.contractId === c.id || (c.contractCode && r.contractCode === c.contractCode)
                                )
                                const completedCRenewals = cRenewals.filter(r => r.status === 'COMPLETED')
                                return (
                                  <>
                                    {completedCRenewals.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => setContractHistoryModal({ contract: c, renewals: completedCRenewals })}
                                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                        title="Xem hồ sơ hợp đồng gốc và các phụ lục gia hạn đã ký"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">history_edu</span>
                                        <span>Phụ lục ({completedCRenewals.length})</span>
                                      </button>
                                    )}
                                    {c.status === 'ACTIVE' && (
                                      <button
                                        type="button"
                                        onClick={() => openRenewModal(c)}
                                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">autorenew</span>
                                        <span>Gia hạn</span>
                                      </button>
                                    )}
                                  </>
                                )
                              })()}
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
                      )
                    })
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
                    myRenewals.map((r: ContractRenewal) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-900">#{r.id.slice(0, 8)}...</div>
                          <div className="text-[11px] text-slate-400">
                            {r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '—'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-blue-600">#{r.contractCode || r.contractId?.slice(0, 8)}</div>
                          <div className="text-[11px] text-slate-500 font-medium">Kho #{r.unitCode || '—'}</div>
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
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            r.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : r.status === 'PENDING_REVIEW'
                              ? 'bg-amber-50 text-amber-800 border border-amber-300'
                              : r.status === 'PENDING_SIGNATURE'
                              ? 'bg-blue-50 text-blue-800 border border-blue-300 animate-pulse'
                              : r.status === 'PENDING_PAYMENT'
                              ? 'bg-cyan-50 text-cyan-800 border border-cyan-300'
                              : r.status === 'REJECTED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {r.status === 'COMPLETED'
                              ? 'Đã ký & Hoàn tất'
                              : r.status === 'PENDING_REVIEW'
                              ? 'Chờ Quản lý duyệt'
                              : r.status === 'PENDING_SIGNATURE'
                              ? 'Chờ ký phụ lục'
                              : r.status === 'PENDING_PAYMENT'
                              ? 'Đã ký • Chờ thanh toán'
                              : r.status === 'REJECTED'
                              ? 'Từ chối'
                              : r.status === 'CANCELLED'
                              ? 'Đã hủy'
                              : r.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {r.status === 'PENDING_SIGNATURE' && (
                              <button
                                type="button"
                                onClick={() => setSelectedRenewalForDocModal(r)}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[14px]">draw</span>
                                <span>Ký phụ lục</span>
                              </button>
                            )}
                            {r.status === 'PENDING_PAYMENT' && (
                              <>
                                <button
                                  type="button"
                                  disabled={payingRenewalId === r.id}
                                  onClick={() => handlePayRenewal(r)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[14px]">payments</span>
                                  <span>{payingRenewalId === r.id ? 'Đang xử lý...' : 'Thanh toán VNPay'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedRenewalForDocModal(r)}
                                  className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[14px]">description</span>
                                  <span>Phụ lục</span>
                                </button>
                              </>
                            )}
                            {r.status === 'PENDING_REVIEW' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setSelectedRenewalForDocModal(r)}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[14px]">description</span>
                                  <span>Dự thảo</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={cancellingRenewalId === r.id}
                                  onClick={() => handleCancelRenewal(r)}
                                  className="px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold transition cursor-pointer"
                                >
                                  {cancellingRenewalId === r.id ? '...' : 'Hủy'}
                                </button>
                              </>
                            )}
                            {(r.status === 'COMPLETED' || r.status === 'REJECTED' || r.status === 'CANCELLED') && (
                              <button
                                type="button"
                                onClick={() => setSelectedRenewalForDocModal(r)}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[14px]">description</span>
                                <span>Xem phụ lục</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Real DB Payments Ledger & VAT E-Invoices */}
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
                            {p.unitCode ? `#${p.unitCode}` : 'Vị trí xác nhận khi check-in'}
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
                            p.status === 'SUCCESS'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : p.status === 'PENDING'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {p.status === 'SUCCESS' ? 'Thành công' : p.status === 'PENDING' ? 'Chờ xử lý' : 'Thất bại'}
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
        <CustomerSupportPanel
          user={user}
          activeContracts={activeContracts}
          contracts={contracts}
          initialUnit={selectedSupportUnit}
          initialCategory={selectedSupportCategory}
          initialContent={selectedSupportContent}
          initialTitle={selectedSupportTitle}
          onNavigateToReturns={(unitCode, bookingId) => {
            if (unitCode) setReturnUnitFilter(unitCode)
            if (bookingId) setSelectedBookingForSettlementModal(bookingId)
            handleTabChange('returns')
          }}
        />
      )}

      {/* 7. TAB 5: QUẢN LÝ & THÔNG BÁO TRẢ KHO (RETURNS) */}
      {activeTab === 'returns' && (
        <div className="flex flex-col gap-6">
          {/* Header giới thiệu mục Trả kho */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white border border-slate-700/50 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[28px]">assignment_return</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white">Quản Lý &amp; Thông Báo Trả Kho</h3>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 font-mono text-[11px] font-bold">
                    {returnActivityLogs.length} thông báo
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Theo dõi kết quả nghiệm thu hiện trường 7 tiêu chí, đối soát chi phí khấu trừ, phản hồi khiếu nại và tiến độ hoàn tiền cọc.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleTabChange('support')}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white flex items-center gap-1.5 transition cursor-pointer self-start md:self-auto shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">support_agent</span>
              <span>Yêu cầu hỗ trợ mới</span>
            </button>
          </div>


          {/* Danh sách các thông báo / sự kiện đối soát trả kho */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-amber-600">notifications_active</span>
                <span className="font-bold text-xs text-slate-800">
                  Danh sách thông báo &amp; đối soát trả kho ({filteredReturnLogs.length})
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <select
                  value={returnUnitFilter}
                  onChange={e => setReturnUnitFilter(e.target.value)}
                  aria-label="Lọc theo kho"
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">Tất cả các kho ({returnActivityLogs.length})</option>
                  {Array.from(new Set(returnActivityLogs.map(l => l.unitCode).filter(Boolean))).map(code => (
                    <option key={code} value={code}>
                      Kho #{code}
                    </option>
                  ))}
                </select>

                <div className="relative min-w-[200px]">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
                    search
                  </span>
                  <input
                    type="text"
                    value={returnSearch}
                    onChange={e => setReturnSearch(e.target.value)}
                    placeholder="Tìm theo kho, nội dung..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {filteredReturnLogs.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[28px]">assignment_return</span>
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-slate-800">Chưa có thông báo trả kho nào</h4>
                  <p className="text-xs text-slate-500 max-w-md">
                    Khi bạn thực hiện thủ tục trả phòng kho, kết quả kiểm tra 7 tiêu chí hiện trường và quyết toán hoàn cọc sẽ được hiển thị chi tiết tại đây.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredReturnLogs.map((log) => {
                  const targetBookingId =
                    log.meta?.bookingId ||
                    (log.unitCode ? customerBookings.find(b => b.unitCode === log.unitCode)?.id : undefined)
                  return (
                    <div
                      key={log.id}
                      className="p-4 sm:p-5 hover:bg-slate-50/70 transition flex flex-col sm:flex-row items-start justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="material-symbols-outlined text-[20px]">
                            {log.title.includes('khiếu nại') || log.title.includes('Khiếu nại')
                              ? 'report_problem'
                              : log.title.includes('hoàn cọc') || log.title.includes('Hoàn cọc')
                              ? 'savings'
                              : 'fact_check'}
                          </span>
                        </div>
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {log.unitCode && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono font-bold text-[11px]">
                                KHO #{log.unitCode}
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                              {log.statusLabel || 'Trả kho'}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {formatRelativeTimeVi(log.timestamp)}
                            </span>
                          </div>
                          <h5 className="font-bold text-xs sm:text-sm text-slate-900 leading-snug">
                            {log.title}
                          </h5>
                          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                            {log.description}
                          </p>
                        </div>
                      </div>

                      {targetBookingId && (
                        <button
                          type="button"
                          onClick={() => setSelectedBookingForSettlementModal(targetBookingId)}
                          className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 self-stretch sm:self-center shadow-2xs"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                          <span>Xem Biên Bản</span>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

        </>
      )}

      {/* Booking Modal (Đặt giữ chỗ kho) */}
      {selectedBookingUnit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[92vh] overflow-y-auto">
            {bookingSuccess ? (
              <div className="py-8 text-center space-y-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto shadow-xs ${
                  bookingWorkflow === 'HOLD_ONLY' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  <span className="material-symbols-outlined text-[32px]">
                    {bookingWorkflow === 'HOLD_ONLY' ? 'bookmark_added' : 'check_circle'}
                  </span>
                </div>
                <div>
                  <h3 className="font-headline text-lg font-bold text-slate-900">
                    {bookingWorkflow === 'HOLD_ONLY' ? 'Đặt Giữ Chỗ Kho Thành Công!' : 'Khởi Tạo Hợp Đồng Thuê Thành Công!'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Mã đặt chỗ của bạn: <strong className="font-mono text-slate-800">#{createdBookingResult?.bookingCode || 'BX-2026-9988'}</strong>
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-left text-xs space-y-2">
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Mã kho giữ chỗ:</span>
                    <span className="font-mono font-bold text-blue-600 text-sm">#{createdBookingResult?.unitCode || selectedBookingUnit.unitCode}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Cơ sở trực thuộc:</span>
                    <span className="font-semibold text-slate-800">{createdBookingResult?.facilityName || selectedBookingUnit.facilityName}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Thời hạn hợp đồng:</span>
                    <span className="font-semibold text-slate-800">{bookingEstimate.days} ngày ({formatDisplayDate(bookingStartDate)} → {formatDisplayDate(bookingEstimate.endDate)})</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Ngày check-in dự kiến:</span>
                    <span className="font-semibold text-slate-800">{formatDisplayDate(bookingCheckInDate)} · {bookingCheckInTime}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500">Phương thức:</span>
                    <span className="font-bold text-slate-700">
                      {bookingWorkflow === 'HOLD_ONLY' ? 'Giữ chỗ 24h (Ký & thanh toán tại quầy)' : 'Ký điện tử & Thanh toán online'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                  {bookingWorkflow === 'HOLD_ONLY' 
                    ? 'Vị trí kho đã được giữ riêng cho bạn trong vòng 24 giờ. Quý khách vui lòng đến trực tiếp cơ sở để nhận bàn giao hoặc theo dõi trạng thái tại danh mục Đặt chỗ.'
                    : 'Hợp đồng điện tử và yêu cầu thanh toán đã sẵn sàng. Mã PIN sẽ được kích hoạt sau khi hoàn tất thủ tục bàn giao theo quy định.'}
                </p>

                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => {
                      const code = createdBookingResult?.bookingCode
                      if (bookingOnly) {
                        navigate(code ? `/portal/customer?tab=bookings&bookingCode=${encodeURIComponent(code)}` : '/portal/customer?tab=bookings')
                      } else {
                        setBookingSuccess(false)
                        setSelectedBookingUnit(null)
                        if (code) {
                          setSearchParams({ tab: 'bookings', bookingCode: code })
                        } else {
                          handleTabChange('bookings')
                        }
                      }
                    }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Xem Đơn Đặt Giữ Chỗ
                  </button>
                  <button
                    onClick={() => {
                      if (bookingOnly) {
                        navigate('/portal/customer?tab=my-units')
                      } else {
                        setBookingSuccess(false)
                        setSelectedBookingUnit(null)
                        handleTabChange('my-units')
                      }
                    }}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                  >
                    Đến Kho Của Tôi
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {bookingError && (
                  <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                    {bookingError}
                  </p>
                )}
                {/* Modal Header */}
                <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-headline text-lg font-bold text-slate-900">
                      Đặt giữ chỗ kho
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Mã kho: <strong className="font-mono text-slate-800">#{selectedBookingUnit.unitCode}</strong> · {selectedBookingUnit.facilityName}
                    </p>
                  </div>
                  <button
                    onClick={closeBookingModal}
                    className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Unit Details Banner */}
                <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">
                      {selectedBookingUnit.name}
                    </div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      Diện tích: <span className="font-semibold text-slate-700">{selectedBookingUnit.areaSqMeters || 6} m²</span> · Vị trí: <span className="font-semibold text-slate-700">{selectedBookingUnit.floorLevel || 'Tầng 1'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-blue-600 text-sm block">
                      {(selectedBookingUnit.priceNumber || 2400000).toLocaleString('vi-VN')} ₫
                    </span>
                    <span className="text-[11px] text-slate-500">/tháng · Giá niêm yết</span>
                  </div>
                </div>

                {/* 1. Chọn thời hạn thuê */}
                <div className="space-y-2.5">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      1. Chọn thời hạn thuê
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Chọn kỳ hạn phù hợp với nhu cầu của bạn.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: '15d', title: '15 ngày', sub: 'Ngắn hạn' },
                      { id: '1m', title: '1 tháng', sub: 'Linh hoạt' },
                      { id: '3m', title: '3 tháng', sub: 'Giảm 5%' },
                      { id: '6m', title: '6 tháng', sub: 'Giảm 10%' },
                      { id: '12m', title: '12 tháng', sub: 'Giảm 15%' },
                      { id: '24m', title: '24 tháng', sub: 'Giảm 20%' },
                      { id: 'custom', title: 'Tùy chỉnh', sub: 'Chọn số ngày/tháng' }
                    ].map(pkg => {
                      const isSelected = bookingPackage === pkg.id
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => setBookingPackage(pkg.id as any)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-blue-50/80 border-blue-500 text-blue-900 shadow-2xs ring-1 ring-blue-500'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/60'
                          } ${pkg.id === 'custom' ? 'col-span-2 sm:col-span-3' : ''}`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-bold text-slate-900">{pkg.title}</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : pkg.sub.includes('Giảm') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {pkg.sub}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {bookingPackage === 'custom' && (
                    <div className="p-3 bg-blue-50/50 border border-blue-200/80 rounded-xl flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-700 shrink-0">Nhập số ngày muốn thuê:</span>
                      <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                        <input
                          type="number"
                          min={1}
                          max={1825}
                          value={bookingCustomDays}
                          onChange={(e) => setBookingCustomDays(Math.max(1, parseInt(e.target.value || '1', 10)))}
                          className="h-9 w-24 px-3 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                        <span className="text-xs text-slate-500 font-medium">ngày (tương đương ~{(bookingCustomDays / 30).toFixed(1)} tháng)</span>
                      </div>
                    </div>
                  )}

                  {/* Ưu đãi kỳ hạn Box */}
                  <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl space-y-1 text-xs">
                    <div className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-blue-600 text-[16px]">loyalty</span>
                      Ưu đãi kỳ hạn · Chiết khấu theo thời hạn
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Mức giảm giá được áp dụng theo chính sách và kỳ hạn đủ điều kiện. Giá cuối cùng sẽ được hệ thống xác nhận trước khi ký hợp đồng.
                    </p>
                  </div>
                </div>

                {/* 2. Lịch nhận kho & kích hoạt mã PIN */}
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      2. Lịch nhận kho &amp; kích hoạt mã PIN
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Hai ngày này có thể khác nhau. Hãy kiểm tra kỹ trước khi xác nhận.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Ngày bắt đầu thuê */}
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                        Ngày bắt đầu thuê
                      </label>
                      <input
                        type="date"
                        value={bookingStartDate}
                        onChange={(e) => setBookingStartDate(e.target.value)}
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                      <p className="text-[10px] text-slate-500 leading-normal">
                        Là ngày bắt đầu tính thời hạn và tiền thuê theo hợp đồng đã xác nhận.
                      </p>
                    </div>

                    {/* Ngày check-in dự kiến */}
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                        Ngày check-in dự kiến
                      </label>
                      <input
                        type="date"
                        value={bookingCheckInDate}
                        onChange={(e) => setBookingCheckInDate(e.target.value)}
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                      <label className="mt-2 block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Giờ dự kiến đến
                      </label>
                      <input
                        type="time"
                        value={bookingCheckInTime}
                        onChange={(e) => setBookingCheckInTime(e.target.value)}
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                      <p className="text-[10px] text-slate-500 leading-normal">
                        Ngày và giờ bạn dự kiến đến để nhân viên chuẩn bị kho và bàn giao.
                      </p>
                    </div>
                  </div>

                  {/* Warning: Ngày check-in sau ngày bắt đầu thuê */}
                  {bookingCheckInDate > bookingStartDate && (
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1 text-xs">
                      <div className="font-bold text-amber-900 text-[11px] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-amber-600 text-[16px]">info</span>
                        Ngày check-in sau ngày bắt đầu thuê
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Hợp đồng dự kiến bắt đầu trước ngày bạn nhận kho. Vui lòng xác nhận chính sách tính tiền cho khoảng thời gian chênh lệch trước khi ký. Hệ thống không nên tự động tính thêm phí nếu chưa có thỏa thuận rõ ràng.
                      </p>
                    </div>
                  )}

                  {/* Trạng thái mã PIN */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-[11px]">Trạng thái mã PIN</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold text-[10px] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Chưa kích hoạt
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Mã PIN chỉ có hiệu lực khi hợp đồng, thanh toán và thủ tục bàn giao đáp ứng đủ điều kiện theo chính sách. Thanh toán thành công không đồng nghĩa với việc mã PIN đã hoạt động.
                    </p>
                  </div>
                </div>

                {/* 3. Bảng tính chi phí dự kiến */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    3. Bảng tính chi phí dự kiến
                  </h4>

                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs">
                    {/* Row 1: Tiền thuê kho */}
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <div>
                        <div className="font-bold text-slate-800">Tiền thuê kho</div>
                        <div className="text-[10px] text-slate-500">Theo kỳ hạn đã chọn</div>
                      </div>
                      <div className="font-mono font-bold text-slate-900 text-xs">
                        {bookingEstimate.rawRent.toLocaleString('vi-VN')} ₫
                      </div>
                    </div>

                    {/* Row 2: Chiết khấu kỳ hạn */}
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <div>
                        <div className="font-bold text-emerald-800">Chiết khấu kỳ hạn</div>
                        <div className="text-[10px] text-slate-500">
                          {bookingEstimate.discountPercent > 0 
                            ? `Ví dụ: giảm ${bookingEstimate.discountPercent}% trên tiền thuê`
                            : 'Theo kỳ hạn đã chọn'}
                        </div>
                      </div>
                      <div className="font-mono font-bold text-emerald-700 text-xs">
                        {bookingEstimate.discountAmount > 0 
                          ? `−${bookingEstimate.discountAmount.toLocaleString('vi-VN')} ₫`
                          : '0 ₫'}
                      </div>
                    </div>

                    {/* Row 3: Tiền cọc an ninh */}
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <div>
                        <div className="font-bold text-slate-800">Tiền cọc an ninh</div>
                        <div className="text-[10px] text-slate-500">Hoàn trả theo điều kiện hợp đồng</div>
                      </div>
                      <div className="font-mono font-bold text-slate-900 text-xs">
                        {bookingEstimate.deposit.toLocaleString('vi-VN')} ₫
                      </div>
                    </div>

                    {/* Row 4: Tổng dự kiến */}
                    <div className="flex justify-between items-center pt-2">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">Tổng dự kiến</div>
                        <div className="text-[10px] text-slate-500">Đã gồm tiền thuê sau giảm và tiền cọc</div>
                      </div>
                      <div className="font-mono font-bold text-blue-600 text-base">
                        {bookingEstimate.totalPayment.toLocaleString('vi-VN')} ₫
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 leading-relaxed italic">
                    Số tiền trên là ví dụ minh họa cho kỳ hạn {bookingEstimate.days} ngày. Giá cuối cùng, chiết khấu, thuế/phí nếu có và tiền cần thanh toán phải được backend tính theo chính sách thực tế.
                  </p>
                </div>

                {/* 4. Chọn phương thức tiếp nhận */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    4. Chọn phương thức tiếp nhận
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Option 1: Đặt giữ chỗ kho */}
                    <div
                      onClick={() => setBookingWorkflow('HOLD_ONLY')}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        bookingWorkflow === 'HOLD_ONLY'
                          ? 'bg-blue-50/70 border-blue-500 shadow-2xs ring-1 ring-blue-500'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-blue-600 text-[18px]">bookmark</span>
                            Đặt giữ chỗ kho
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                            Miễn phí 24 giờ
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-normal">
                          Giữ vị trí kho trong 24 giờ. Đến cơ sở để xem kho, hoàn tất hợp đồng và thanh toán theo quy định.
                        </p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Thanh toán ngay</span>
                        <span className="font-mono font-bold text-slate-900">0 ₫</span>
                      </div>
                    </div>

                    {/* Option 2: Ký online & thanh toán */}
                    <div
                      onClick={() => setBookingWorkflow('ONLINE_NOW')}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        bookingWorkflow === 'ONLINE_NOW'
                          ? 'bg-blue-50/70 border-blue-500 shadow-2xs ring-1 ring-blue-500'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-blue-600 text-[18px]">history_edu</span>
                            Ký online &amp; thanh toán
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-normal">
                          Ký hợp đồng điện tử qua DocuSeal và thanh toán trực tuyến. Sau đó hoàn tất bước nhận kho trước khi mã PIN được kích hoạt.
                        </p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Tổng dự kiến</span>
                        <span className="font-mono font-bold text-blue-600">{bookingEstimate.totalPayment.toLocaleString('vi-VN')} ₫</span>
                      </div>
                    </div>
                  </div>

                  {/* Policy acceptance checkbox */}
                  <label className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-200/80 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bookingPolicyAccepted}
                      onChange={(e) => setBookingPolicyAccepted(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed">
                      Tôi đã đọc thông tin về ngày bắt đầu thuê, ngày check-in, điều kiện kích hoạt mã PIN và chính sách hủy/hoàn tiền.
                    </span>
                  </label>
                </div>

                {/* Modal Footer Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={closeBookingModal}
                    disabled={isSubmittingBooking}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBooking}
                    disabled={isSubmittingBooking || !bookingPolicyAccepted}
                    className={`flex-1 py-2.5 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      !bookingPolicyAccepted
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : bookingWorkflow === 'HOLD_ONLY'
                        ? 'bg-slate-900 hover:bg-slate-800'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isSubmittingBooking ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>Đang xử lý đặt chỗ...</span>
                      </>
                    ) : bookingWorkflow === 'HOLD_ONLY' ? (
                      <span>Xác nhận đặt giữ chỗ</span>
                    ) : (
                      <span>Xác nhận ký online &amp; thanh toán</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1. RENEWAL MODAL: YÊU CẦU GIA HẠN HỢP ĐỒNG */}
      {renewModalData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[92vh] overflow-y-auto">
            {renewSuccess ? (
              <div className="py-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                  <span className="material-symbols-outlined text-[32px]">check_circle</span>
                </div>
                <div>
                  <h3 className="font-headline text-lg font-bold text-slate-900">
                    Đã Gửi Yêu Cầu Gia Hạn Hợp Đồng!
                  </h3>
                  <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed mt-1">
                    Yêu cầu gia hạn thêm <strong>{renewMonths} tháng</strong> cho hợp đồng{' '}
                    <strong>#{renewModalData.contractCode}</strong> (Kho #{renewModalData.unitCode}) đã được gửi tới Quản lý cơ sở.
                  </p>
                </div>

                {/* Tiến trình 3 bước tiếp theo */}
                <div className="text-left bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs">
                  <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    Quy trình hoàn tất Phụ lục gia hạn:
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      ✓
                    </span>
                    <div>
                      <span className="font-bold text-slate-900">Bước 1: Đã gửi yêu cầu gia hạn (+{renewMonths} tháng)</span>
                      <p className="text-[11px] text-slate-500">Quản lý cơ sở kiểm tra và phê duyệt yêu cầu gia hạn.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <span className="font-bold text-slate-900">Bước 2: Ký điện tử Phụ lục gia hạn hợp đồng</span>
                      <p className="text-[11px] text-slate-500">
                        Ngay khi Quản lý duyệt, nút <strong>&quot;Ký Phụ Lục Gia Hạn&quot;</strong> sẽ hiển thị ngay trên thẻ kho và tại mục Hợp đồng.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <span className="font-bold text-slate-900">Bước 3: Thanh toán phí gia hạn &amp; Tự động cộng hạn kho</span>
                      <p className="text-[11px] text-slate-500">
                        Thanh toán qua VNPay hoặc tại quầy để cộng dồn ngày kết thúc mới và giữ nguyên mã PIN khóa thông minh.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const unitCode = renewModalData.unitCode
                      setRenewSuccess(false)
                      setRenewModalData(null)
                      const latestRenewal = myRenewals.find(r => r.unitCode === unitCode)
                      if (latestRenewal) {
                        setSelectedRenewalForDocModal(latestRenewal)
                      }
                    }}
                    className="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">description</span>
                    <span>Xem Dự Thảo Phụ Lục</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenewSuccess(false)
                      setRenewModalData(null)
                    }}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                  >
                    Hoàn tất &amp; Đóng
                  </button>
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
                      <span className="font-bold text-slate-900">{renewModalData.facilityName} / {renewModalData.unitCode}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-medium">Thời hạn hiện tại</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatDisplayDate(renewModalData.startDate)}–{formatDisplayDate(renewModalData.endDate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-500 font-medium">Giá thuê hiện tại</span>
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
                        Thời gian gia hạn
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

                    {/* Preview Thời hạn nối tiếp: Ngày kết thúc hiện tại -> Ngày kết thúc mới */}
                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Hạn kết thúc hiện tại</span>
                        <span className="font-mono font-bold text-slate-800">{formatDisplayDate(renewModalData.endDate)}</span>
                      </div>
                      <div className="flex flex-col items-center text-emerald-700 font-mono text-[11px] font-bold">
                        <span>+{renewMonths} tháng</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-emerald-700 block">Hạn kết thúc mới dự kiến</span>
                        <span className="font-mono font-extrabold text-emerald-700 text-sm">
                          {(() => {
                            try {
                              const d = new Date(renewModalData.endDate)
                              if (Number.isNaN(d.getTime())) return '—'
                              d.setMonth(d.getMonth() + (renewMonths || 1))
                              return formatDisplayDate(d.toISOString().split('T')[0])
                            } catch {
                              return '—'
                            }
                          })()}
                        </span>
                      </div>
                    </div>

                    {/* Đơn giá cố định theo hợp đồng gốc & Tiền cọc giữ nguyên */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 block uppercase">
                          Đơn giá thuê theo hợp đồng
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-900 mt-0.5 block">
                          {Number(renewMonthlyPrice || 0).toLocaleString('vi-VN')} ₫ / tháng (Cố định)
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 block uppercase">
                          Tiền cọc lưu ký
                        </span>
                        <span className="font-mono text-xs font-bold text-emerald-700 mt-0.5 block">
                          Giữ nguyên từ HĐ gốc (0 ₫ thu thêm)
                        </span>
                      </div>
                    </div>

                    {/* Ghi chú yêu cầu gia hạn */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">
                        Ghi chú yêu cầu gia hạn (Tùy chọn)
                      </label>
                      <input
                        type="text"
                        value={renewNotes}
                        onChange={(e) => setRenewNotes(e.target.value)}
                        placeholder="Ví dụ: Mong muốn ký phụ lục online và xuất hóa đơn VAT công ty..."
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* Tổng tiền dự kiến */}
                    <div className="mt-2 p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Tổng phí Phụ lục gia hạn ({renewMonths} tháng)
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Thanh toán sau khi Quản lý duyệt và Quý khách ký số Phụ lục gia hạn
                        </span>
                      </div>
                      <div className="font-mono text-xl sm:text-2xl font-extrabold text-blue-700">
                        {totalRenewEstimate.toLocaleString('vi-VN')} ₫
                      </div>
                    </div>
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
                  Mã PIN mới của kho #{pinChangeUnit.unitCode} đã được đồng bộ an toàn vào khóa thông minh.
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
                  Mã PIN mới gồm đúng <strong>6 chữ số</strong> dùng để xác thực mở khóa điện tử tại cửa phòng kho và cổng cơ sở.
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
          /* onSignNow handled by Staff */
          isSigning={fetchingSigningUrl}
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
                  <strong className="text-blue-600 font-mono text-xs">{selectedVatPayment.unitCode ? `#${selectedVatPayment.unitCode}` : 'Vị trí xác nhận khi check-in'}</strong>
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
                            ? 'Tiền đặt cọc bảo đảm ngăn kho'
                            : 'Tiền thuê ngăn kho tự quản Boxora'}{' '}
                          {selectedVatPayment.unitCode ? `#${selectedVatPayment.unitCode}` : '(vị trí xác nhận khi check-in)'}
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

      {/* Proof of Transfer / Màn hình chuyển tiền Modal */}
      {selectedProofPayment && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                  <span className="material-symbols-outlined text-xl">account_balance</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-wide uppercase">Chứng Từ / Màn Hình Chuyển Tiền</h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Mã giao dịch: {selectedProofPayment.transactionId || selectedProofPayment.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProofPayment(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 text-xs text-slate-700">
              {/* Transfer Details Card */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Kho &amp; Cơ sở:</span>
                  <strong className="text-blue-600 font-mono text-xs">{selectedProofPayment.unitCode ? `#${selectedProofPayment.unitCode}` : 'Vị trí xác nhận khi check-in'}</strong>
                  <div className="text-slate-600 text-[11px]">{selectedProofPayment.facilityName || 'Boxora Storage'}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Khoản thanh toán:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedProofPayment.paymentType === 'DEPOSIT' ? 'Tiền ký quỹ (Cọc)' : 'Tiền thuê kho'}
                  </span>
                  <div className="text-slate-500 text-[10px]">
                    Phương thức: <strong className="font-mono text-slate-700">BANK_TRANSFER (Chuyển khoản)</strong>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Thời gian thanh toán:</span>
                  <span className="font-mono text-slate-700">
                    {selectedProofPayment.paymentTime ? new Date(selectedProofPayment.paymentTime).toLocaleString('vi-VN') : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Số tiền chuyển khoản:</span>
                  <strong className="text-emerald-700 text-sm font-mono">
                    {selectedProofPayment.amount.toLocaleString('vi-VN')} ₫
                  </strong>
                </div>
              </div>

              {/* Proof Image / Screenshot Display */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col items-center justify-center">
                {selectedProofPayment.proofDocumentUrl ? (
                  <div className="space-y-3 w-full flex flex-col items-center">
                    <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5 self-start">
                      <span className="material-symbols-outlined text-[16px] text-blue-600">image</span>
                      <span>Ảnh chụp màn hình chuyển khoản / Ủy nhiệm chi:</span>
                    </div>
                    <div className="max-h-[480px] w-full overflow-hidden rounded-lg border border-slate-200 bg-white flex items-center justify-center p-2 shadow-xs">
                      <img
                        src={selectedProofPayment.proofDocumentUrl}
                        alt="Màn hình chuyển tiền"
                        className="max-h-[460px] max-w-full object-contain rounded shadow-sm"
                      />
                    </div>
                    <a
                      href={selectedProofPayment.proofDocumentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      <span>Mở ảnh gốc trong tab mới</span>
                    </a>
                  </div>
                ) : (
                  <div className="py-6 px-4 text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                      <span className="material-symbols-outlined text-[24px]">verified</span>
                    </div>
                    <div className="font-bold text-slate-900 text-xs">
                      Giao Dịch Chuyển Khoản Trực Tiếp Tại Quầy Đã Xác Nhận
                    </div>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto leading-relaxed">
                      Nhân viên quầy tại cơ sở đã kiểm tra trực tiếp màn hình chuyển tiền thành công trên ứng dụng ngân hàng và đối soát chính xác với hệ thống tài khoản Boxora.
                    </p>
                    {selectedProofPayment.receiptVoucherCode && (
                      <div className="inline-block mt-2 px-3 py-1 bg-slate-100 text-slate-700 rounded-lg font-mono text-[11px] border border-slate-200">
                        Số phiếu thu / tham chiếu: <strong>{selectedProofPayment.receiptVoucherCode}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedProofPayment(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
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
                      <span className="font-mono text-base font-extrabold text-blue-700">
                        {selectedBookingForModal.unitCode ? `KHO #${selectedBookingForModal.unitCode}` : 'Vị trí kho xác nhận khi check-in'}
                      </span>
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
                          Đơn đặt chỗ được ghi nhận theo loại kho và cơ sở. Vị trí cụ thể sẽ được xác nhận cùng nhân viên khi check-in.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Schedule and Hold Expiry (Clearly distinguishes expected dates before handover vs official dates after handover) */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          {selectedBookingForModal.handoverTime ? 'Thời điểm bàn giao thực tế:' : 'Lịch hẹn nhận kho:'}
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
                              <strong>Ký hợp đồng &amp; Thanh toán tại chỗ:</strong> Nghiệm thu thực tế ngăn kho, ký hợp đồng và thanh toán trực tuyến qua quét mã VietQR / cổng VNPay.
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
          window.dispatchEvent(new Event('boxora:storage-units-refresh'))
        }}
      />

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

      {/* MODAL: VĂN BẢN & KÝ SỐ PHỤ LỤC GIA HẠN HỢP ĐỒNG */}
      <RenewalAddendumModal
        renewal={selectedRenewalForDocModal}
        contract={
          selectedRenewalForDocModal
            ? contracts.find(
                c =>
                  c.id === selectedRenewalForDocModal.contractId ||
                  c.unitCode === selectedRenewalForDocModal.unitCode
              ) || null
            : null
        }
        onClose={() => setSelectedRenewalForDocModal(null)}
        onSignedSuccess={async updatedRenewal => {
          setSelectedRenewalForDocModal(updatedRenewal)
          recordUnitActivity({
            unitCode: updatedRenewal.unitCode,
            facilityName: updatedRenewal.facilityName,
            category: 'RENEWAL',
            actionType: 'RENEWAL_APPROVED',
            title: `Đã ký điện tử Phụ lục gia hạn kho #${updatedRenewal.unitCode} (+${updatedRenewal.cycleMonths} tháng)`,
            description: `Khách hàng đã ký điện tử Phụ lục gia hạn hợp đồng #${updatedRenewal.contractCode} thêm ${updatedRenewal.cycleMonths} tháng (từ ${formatDisplayDate(updatedRenewal.oldEndDate)} đến ${formatDisplayDate(updatedRenewal.newEndDate)}). Chờ thanh toán phí gia hạn ${Number(updatedRenewal.renewalFee || 0).toLocaleString('vi-VN')} ₫.`,
            statusLabel: 'Đã ký phụ lục • Chờ thanh toán',
            statusTone: 'blue',
            meta: {
              oldEndDate: updatedRenewal.oldEndDate,
              newEndDate: updatedRenewal.newEndDate,
              cycleMonths: updatedRenewal.cycleMonths,
              amount: updatedRenewal.renewalFee,
              contractCode: updatedRenewal.contractCode,
              renewalId: updatedRenewal.id,
            },
          })
          await Promise.all([fetchMyRenewals(), fetchContracts(), fetchCustomerNotifications()])
        }}
        onPayNow={renewalToPay => {
          setSelectedRenewalForDocModal(null)
          void handlePayRenewal(renewalToPay)
        }}
      />

      {/* MODAL: ĐỔI PHƯƠNG THỨC KÝ PHỤ LỤC & THANH TOÁN GIA HẠN (ONLINE <-> TẠI QUẦY) */}
      {switchMethodTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handleSubmitSwitchRenewalMethod}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-headline text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-[20px]">swap_horiz</span>
                  <span>Chọn Phương Thức Ký Phụ Lục &amp; Gia Hạn</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kho #{switchMethodTarget.unitCode} • Phụ lục +{switchMethodTarget.cycleMonths} tháng
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSwitchMethodTarget(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSwitchMethodMode('ONLINE')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  switchMethodMode === 'ONLINE'
                    ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <span className="material-symbols-outlined text-[18px] text-blue-600">draw</span>
                  <span>Ký Online &amp; VNPay</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Ký số phụ lục ngay trên web và thanh toán trực tuyến 24/7.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSwitchMethodMode('COUNTER')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  switchMethodMode === 'COUNTER'
                    ? 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-500/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <span className="material-symbols-outlined text-[18px] text-amber-600">storefront</span>
                  <span>Trực Tiếp Tại Quầy</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Đặt lịch hẹn đến quầy lễ tân cơ sở để ký phụ lục giấy và nộp phí.
                </p>
              </button>
            </div>

            {switchMethodMode === 'COUNTER' && (
              <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Ngày hẹn đến quầy
                  </label>
                  <input
                    type="date"
                    required
                    value={switchAppointmentDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setSwitchAppointmentDate(e.target.value)}
                    className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Khung giờ hẹn
                  </label>
                  <input
                    type="time"
                    required
                    value={switchAppointmentTime}
                    onChange={e => setSwitchAppointmentTime(e.target.value)}
                    className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Ghi chú (tùy chọn)
              </label>
              <input
                type="text"
                value={switchMethodNotes}
                onChange={e => setSwitchMethodNotes(e.target.value)}
                placeholder="Ghi chú thêm cho nhân viên cơ sở..."
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            {switchMethodError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {switchMethodError}
              </div>
            )}

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSwitchMethodTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmittingSwitchMethod}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                {isSubmittingSwitchMethod ? 'Đang lưu...' : 'Xác Nhận Phương Thức'}
              </button>
            </div>
          </form>
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
                    {contractHistoryModal.contract.unitCode ? `Kho #${contractHistoryModal.contract.unitCode}` : 'Vị trí kho xác nhận khi nhận kho'} • {contractHistoryModal.contract.facilityName}
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

                {contractHistoryModal.renewals.map((r: any, idx: number) => (
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

      {/* Modal Nghiệm thu, Đối soát hoàn cọc / bồi thường dành cho Khách hàng */}
      {selectedBookingForSettlementModal && (
        <CustomerSettlementReviewModal
          isOpen={Boolean(selectedBookingForSettlementModal)}
          onClose={() => setSelectedBookingForSettlementModal(null)}
          bookingId={selectedBookingForSettlementModal}
          onUpdated={async () => {
            await Promise.all([fetchCustomerNotifications(), fetchCustomerBookings()])
          }}
        />
      )}

    </div>
  )
}

export default CustomerDashboard
