import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { contractService, RentalContract } from '../../services/contractService'
import { bookingService } from '../../services/bookingService'
import { supportTicketService, SupportTicketRecord } from '../../services/supportTicketService'
import { facilityService } from '../../services/facilityService'
import { storageUnitService } from '../../services/storageUnitService'
import { paymentService, PaymentItem } from '../../services/paymentService'
import { Booking, Facility, StorageUnit } from '../../types'
import { BookingCheckoutModal } from '../../components/modals/BookingCheckoutModal'
import { ContractDocumentModal } from '../../components/modals/ContractDocumentModal'
import { DocuSealSimulationModal } from '../../components/modals/DocuSealSimulationModal'
import { ContractOtpModal } from '../../components/modals/ContractOtpModal'
import { CustomerPolicyModal } from '../../components/modals/CustomerPolicyModal'
import { BookingCancelModal } from '../../components/modals/BookingCancelModal'
import { BookingRescheduleModal } from '../../components/modals/BookingRescheduleModal'
import { BookingRescheduleHistorySection } from '../../components/booking/BookingRescheduleHistorySection'

const UNIT_CARD_IMAGES = [
  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1590247813693-5541d1c609fd?auto=format&fit=crop&w=800&q=80'
]

export const CustomerDashboard: React.FC = () => {
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

  // Real database customer payments state
  const [customerPayments, setCustomerPayments] = useState<PaymentItem[]>([])
  const [loadingPayments, setLoadingPayments] = useState<boolean>(true)
  const [selectedVatPayment, setSelectedVatPayment] = useState<PaymentItem | null>(null)

  // Real facilities & available units state
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [availableUnits, setAvailableUnits] = useState<StorageUnit[]>([])
  const [isCustomerPolicyModalOpen, setIsCustomerPolicyModalOpen] = useState<boolean>(false)
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

  useEffect(() => {
    fetchContracts()
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

  const totalDepositsHeld = useMemo(() => {
    const fromPayments = customerPayments.filter(p => (p.status === 'PAID' || p.status === 'SUCCESS') && p.paymentType === 'DEPOSIT').reduce((sum, p) => sum + (p.amount || 0), 0)
    const fromContracts = contracts.reduce((sum, c) => sum + (c.depositHeld || 0), 0)
    return fromPayments > 0 ? fromPayments : fromContracts
  }, [customerPayments, contracts])

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
  }, [tabParam, searchParams])

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

  // IoT Remote Unlock state
  const [unlockingUnit, setUnlockingUnit] = useState<string | null>(null)
  const [unlockedSuccess, setUnlockedSuccess] = useState<string | null>(null)
  const [unlockError, setUnlockError] = useState<string | null>(null)

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

  // Booking Modal (Đặt giữ chỗ kho)
  interface SelectedBookingUnitData {
    id: string
    unitCode: string
    name: string
    facilityName: string
    priceFormatted: string
    priceNumber: number
    depositNumber: number
    areaSqMeters?: number
    floorLevel?: string
  }
  const [selectedBookingUnit, setSelectedBookingUnit] = useState<SelectedBookingUnitData | null>(null)
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [createdBookingResult, setCreatedBookingResult] = useState<{
    bookingCode: string
    unitCode: string
    facilityName: string
    expectedCheckInAt?: string | null
    holdExpiresAt?: string | null
    paymentStatus?: string | null
  } | null>(null)
  const [bookingPackage, setBookingPackage] = useState<'15d' | '1m' | '3m' | '6m' | '12m' | '24m' | 'custom'>('3m')
  const [bookingCustomDays, setBookingCustomDays] = useState<number>(45)
  const [bookingStartDate, setBookingStartDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [bookingCheckInDate, setBookingCheckInDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return d.toISOString().split('T')[0]
  })
  const [bookingCheckInTime, setBookingCheckInTime] = useState<string>('09:00')
  const [bookingPolicyAccepted, setBookingPolicyAccepted] = useState<boolean>(true)
  const [bookingWorkflow, setBookingWorkflow] = useState<'HOLD_ONLY' | 'ONLINE_NOW'>('HOLD_ONLY')
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false)

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
  const [renewMonthlyPrice, setRenewMonthlyPrice] = useState<number>(1500000)
  const [renewDiscountPercent, setRenewDiscountPercent] = useState<number>(0)
  const [renewOtherFee, setRenewOtherFee] = useState<number>(0)
  const [renewSuccess, setRenewSuccess] = useState<boolean>(false)
  const [renewError, setRenewError] = useState<string | null>(null)
  const [isSubmittingRenewal, setIsSubmittingRenewal] = useState<boolean>(false)

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

  // Filter explore state
  const [filterFacility, setFilterFacility] = useState('all')
  const [filterSize, setFilterSize] = useState('all')

  const handleCopy = (id: string, pin: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(pin)
    }
    setCopiedPin(id)
    setTimeout(() => setCopiedPin(null), 2000)
  }

  const handleRemoteUnlock = async (unitCode: string, bookingOrContractId: string) => {
    setUnlockingUnit(unitCode)
    setUnlockError(null)
    try {
      await bookingService.remoteUnlock(bookingOrContractId)
      setUnlockedSuccess(unitCode)
      setTimeout(() => setUnlockedSuccess(null), 5000)
    } catch (err: any) {
      console.warn('Remote unlock request failed:', err)
      const msg = err?.response?.data?.message || err?.message || 'Gửi tín hiệu mở khóa từ xa thất bại. Vui lòng kiểm tra kết nối thiết bị.'
      setUnlockError(msg)
      setTimeout(() => setUnlockError(null), 5000)
    } finally {
      setUnlockingUnit(null)
    }
  }

  const handleCloseCustomerTicket = async () => {
    if (!closeTicketTarget) return
    setIsProcessingTicketAction(true)
    setTicketActionError(null)
    try {
      await supportTicketService.closeTicket(closeTicketTarget.id, 'Khách hàng xác nhận sự cố đã được xử lý hoàn tất')
      await fetchCustomerTickets()
      setCloseTicketTarget(null)
    } catch (err: any) {
      console.error('Failed to close ticket:', err)
      setTicketActionError(err?.response?.data?.message || err?.message || 'Không thể đóng phiếu. Phiếu vẫn giữ nguyên trạng thái.')
    } finally {
      setIsProcessingTicketAction(false)
    }
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
    if (ticketType === 'other' && (!ticketContent || !ticketContent.trim())) {
      setTicketError('Vui lòng ghi rõ mô tả chi tiết vấn đề bạn cần hỗ trợ.')
      return
    }
    setIsSubmittingTicket(true)
    setTicketError(null)
    try {
      const activeUnit = contracts.find(c => c.unitCode === ticketUnit)
      const isGeneral = ticketUnit === 'general'
      
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

      const title = isGeneral 
        ? `Yêu cầu hỗ trợ (${typeLabel})` 
        : `Sự cố kho #${ticketUnit} (${typeLabel})`

      await supportTicketService.createTicket({
        customerId: user?.id,
        bookingId: activeUnit?.bookingId || (activeUnit?.id?.length === 36 ? activeUnit.id : undefined),
        facilityId: activeUnit?.facilityId,
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
    const base = (renewMonthlyPrice || 0) * (renewMonths || 1)
    const discountAmt = base * ((renewDiscountPercent || 0) / 100)
    const total = base - discountAmt + (renewOtherFee || 0)
    return Math.max(0, Math.round(total))
  }, [renewMonthlyPrice, renewMonths, renewDiscountPercent, renewOtherFee])

  const openRenewModal = (c: RentalContract) => {
    const numFee = Number(c.monthlyFee || 0) || 1500000
    setRenewModalData({
      contractId: c.id,
      contractCode: c.contractCode || `CTR-2026-${c.id.slice(0, 5)}`,
      customerName: c.customerName || user?.fullName || 'Nguyễn Văn A',
      facilityName: c.facilityName || 'StoreHub Quận 1',
      unitCode: c.unitCode,
      startDate: c.startDate || '2026-10-01',
      endDate: c.endDate || '2026-12-31',
      monthlyPrice: numFee,
    })
    setRenewMonths(3)
    setRenewMonthlyPrice(numFee)
    setRenewDiscountPercent(0)
    setRenewOtherFee(0)
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
    try {
      const targetContract = contracts.find(c => c.id === renewModalData.contractId || c.unitCode === renewModalData.unitCode)
      if (targetContract) {
        await contractService.requestRenewal(targetContract.id, renewMonths)
      } else {
        await bookingService.renewBooking(renewModalData.unitCode, renewMonths)
      }
      setRenewSuccess(true)
      await fetchContracts()
      await fetchCustomerPayments()
    } catch (err: any) {
      console.warn('Renewal API error:', err)
      setRenewSuccess(false)
      const msg = err?.response?.data?.message || err?.message || 'Không thể gia hạn hợp đồng. Vui lòng kiểm tra lại điều kiện hợp đồng.'
      setRenewError(msg)
    } finally {
      setIsSubmittingRenewal(false)
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

    const rawRent = bookingPackage === 'custom'
      ? Math.round((monthlyPrice / 30) * days)
      : bookingPackage === '15d'
      ? Math.round(monthlyPrice * 0.5)
      : Math.round(monthlyPrice * months)
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

  const handlePayBookingVNPay = (b: Booking) => {
    setRequestToPay(b)
  }

  const handleConfirmBooking = async () => {
    if (!selectedBookingUnit) return
    setIsSubmittingBooking(true)
    try {
      const months = Math.max(1, Math.round(bookingEstimate.months || 1))
      const expectedCheckInAt = `${bookingCheckInDate}T${bookingCheckInTime || '09:00'}:00`

      if (bookingWorkflow === 'ONLINE_NOW') {
        // Option "Ký online & thanh toán": Tạo booking và chuyển tiếp ngay sang cổng VNPay Sandbox thực
        let bookingId = ''
        let createdBooking: any = null
        try {
          const res = await bookingService.createBooking({
            storageUnitId: selectedBookingUnit.id,
            startDate: bookingStartDate,
            rentalMonths: months,
            totalRentalFee: bookingEstimate.rentAfterDiscount,
            depositPaid: bookingEstimate.deposit,
            signingMethod: 'ONLINE',
            checkInTime: bookingCheckInTime || '09:00',
            expectedCheckInAt,
          })
          if (!res?.id) {
            throw new Error('Hệ thống không trả về mã đơn đặt kho hợp lệ.')
          }
          bookingId = res.id
          createdBooking = res
        } catch (bErr: any) {
          console.error('Booking creation error:', bErr)
          const errorMsg = bErr?.response?.data?.message || bErr?.message || 'Không thể tạo đơn đặt kho. Ngăn kho này có thể vừa được đặt hoặc đang có người giữ chỗ.'
          alert(errorMsg)
          return
        }

        // Tạo giao dịch thanh toán VNPay Sandbox và lấy URL chính thức
        const paymentAmount = (createdBooking?.totalRentalFee != null && createdBooking?.depositAmount != null)
          ? Math.round(Number(createdBooking.totalRentalFee) + Number(createdBooking.depositAmount))
          : Math.round(bookingEstimate.totalPayment)

        try {
          const payment = await paymentService.createVNPayPayment({
            bookingId: bookingId,
            paymentType: 'BOOKING_PAYMENT',
            amount: paymentAmount,
            orderInfo: `Thanh toan giu cho kho ${selectedBookingUnit.unitCode}`
          })
          if (payment?.paymentUrl) {
            // Chuyển hướng trực tiếp sang cổng thanh toán VNPay Sandbox để khách tự nhập thẻ test
            window.location.href = payment.paymentUrl
            return
          }
          throw new Error('Cổng VNPay không phản hồi đường dẫn thanh toán.')
        } catch (payErr: any) {
          console.error('VNPay create payment error:', payErr)
          const errorMsg = payErr?.response?.data?.message || payErr?.message || 'Không thể khởi tạo giao dịch VNPay. Vui lòng thử lại.'
          alert(`Đơn đặt kho đã được tạo (Mã: ${createdBooking?.bookingCode || bookingId}) nhưng chưa thể mở cổng thanh toán: ${errorMsg}\nBạn có thể vào tab "Đơn đặt chỗ" để thanh toán lại bất cứ lúc nào.`)
          handleTabChange('bookings')
          setSelectedBookingUnit(null)
          setBookingSuccess(false)
          await fetchCustomerBookings()
          await fetchContracts()
          await fetchCustomerPayments()
        }
        return
      }

      // Option "Giữ chỗ miễn phí theo lịch hẹn": Giữ chỗ theo lịch hẹn và hạn chính sách
      try {
        const res = await bookingService.createBooking({
          storageUnitId: selectedBookingUnit.id,
          startDate: bookingStartDate,
          rentalMonths: months,
          totalRentalFee: bookingEstimate.rentAfterDiscount,
          depositPaid: 0,
          signingMethod: 'IN_PERSON',
          checkInTime: bookingCheckInTime || '09:00',
          expectedCheckInAt,
        })
        if (!res?.id) {
          throw new Error('Hệ thống không trả về thông tin xác nhận.')
        }
        setCreatedBookingResult({
          bookingCode: res.bookingCode,
          unitCode: selectedBookingUnit.unitCode,
          facilityName: selectedBookingUnit.facilityName,
          expectedCheckInAt: res.expectedCheckInAt,
          holdExpiresAt: res.holdExpiresAt,
          paymentStatus: res.paymentStatus,
        })
        setBookingSuccess(true)
        await fetchCustomerBookings()
        await fetchContracts()
        await fetchCustomerPayments()
        await fetchAvailableUnits()
      } catch (err: any) {
        console.error('In-person booking error:', err)
        const errorMsg = err?.response?.data?.message || err?.message || 'Không thể giữ chỗ kho này. Vui lòng kiểm tra lại.'
        alert(errorMsg)
      }
    } finally {
      setIsSubmittingBooking(false)
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

  const getBookingNoticeInfo = (b: Booking) => {
    const matchingContract = contracts.find(c =>
      (c.bookingId && (c.bookingId === b.id || c.bookingId === b.bookingCode)) ||
      (c.unitCode && c.unitCode === b.unitCode)
    )
    const isPaid = b.paymentStatus === 'PAID'
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

    if (b.status === 'CANCELLED' || b.status === 'OVERDUE') {
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
      isContractSigned,
      scenario,
    }
  }

  return (
    <div className="flex flex-col gap-6 text-left max-w-7xl mx-auto pb-12">
      
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
              Quản lý kho đang thuê, mở khóa Smart Lock từ xa và theo dõi trạng thái bảo mật thời gian thực.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleTabChange('explore')}
              className="stitch-btn-primary text-xs"
            >
              <span>Thuê thêm kho</span>
            </button>
            <button
              onClick={() => handleTabChange('support')}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Hỗ trợ kỹ thuật</span>
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
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Kho đang thuê</span>
              <span className="font-mono text-xl font-bold text-slate-900 mt-0.5">{activeContracts.length} Kho Hoạt Động</span>
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
                {pendingReservations.length} Chờ Nhận Kho
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
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                Bảo mật cửa kho
                <span className="pulsing-dot bg-emerald-500"></span>
              </span>
              <span className="font-mono text-xl font-bold text-emerald-700 mt-0.5">Đã Khóa An Toàn</span>
              <span className="text-xs text-slate-500 truncate">Mã PIN điện tử &amp; Mở từ xa</span>
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
      </div>

      {/* 2. Main Tab Buttons */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl w-fit border border-slate-200 shadow-sm overflow-x-auto max-w-full">
        <button
          onClick={() => handleTabChange('my-units')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'my-units'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Kho Của Tôi</span>
          <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
            {activeContracts.length}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('bookings')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'bookings'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Lịch Sử Đặt Chỗ</span>
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
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'explore'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Tìm &amp; Thuê Thêm Kho</span>
        </button>

        <button
          onClick={() => handleTabChange('contracts')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'contracts'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Hợp Đồng &amp; Hóa Đơn</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-700 text-white text-[10px] font-bold">
            {contracts.length}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('support')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'support'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Hỗ Trợ &amp; Báo Sự Cố</span>
          {customerTickets.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'support' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'
            }`}>
              {customerTickets.length}
            </span>
          )}
        </button>
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
                  const statusLabel = request.status === 'CONFIRMED'
                    ? 'Đã xác nhận đặt chỗ'
                    : request.status === 'PENDING_PAYMENT'
                      ? 'Chờ thanh toán'
                      : request.status === 'PENDING_APPROVAL'
                        ? 'Chờ xử lý'
                        : 'Yêu cầu đã đóng'
                  const statusClass = request.status === 'CONFIRMED'
                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                    : request.status === 'PENDING_PAYMENT'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  return (
                    <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                      <div>
                        <p className="text-xs font-bold text-slate-900">Kho #{request.unitCode} · {request.facilityName}</p>
                        <p className="mt-1 text-[11px] text-slate-500">Mã yêu cầu {request.bookingCode} · {request.rentalMonths} tháng</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClass}`}>{statusLabel}</span>
                        {request.status === 'PENDING_PAYMENT' && (
                          <button
                            type="button"
                            onClick={() => setRequestToPay(request)}
                            className="rounded-lg bg-cyan-700 px-3 py-2 text-[10px] font-bold text-white hover:bg-cyan-800"
                          >
                            Tiếp tục thanh toán
                          </button>
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
                    ? 'Các phòng kho bạn đã đặt giữ chỗ đang chờ làm thủ tục nhận kho tại quầy. Sau khi nhân viên bàn giao, kho sẽ hiển thị tại đây kèm mã PIN SmartLock và quyền mở cửa từ xa.'
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {activeContracts.map((c) => {
                const targetId = c.bookingId || c.id
                const pin = loadedPins[c.unitCode] || ''
                const isRevealed = revealedPins[c.unitCode]
                const isLoadingPin = loadingPins[c.unitCode]
                const isUnlocking = unlockingUnit === c.unitCode
                const isUnlocked = unlockedSuccess === c.unitCode
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

                      {/* Security PIN Box */}
                      <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-200 shadow-xs flex flex-col gap-3 relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-slate-900">
                              Mã PIN truy cập cửa kho
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-white border border-blue-200 text-[10px] font-mono text-blue-700 font-semibold">
                            Bảo mật AES-256
                          </span>
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
                          <div className="flex flex-col gap-2.5 py-2.5 px-4 rounded-lg bg-white border border-blue-200">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono text-slate-600 font-semibold">Mã số PIN:</span>
                                <div className="flex items-center gap-1 font-mono text-base font-bold text-blue-900 tracking-wider">
                                  {(pin || '------').split('').map((digit: string, idx: number) => (
                                    <span key={idx} className="px-2 py-1 rounded bg-blue-50 border border-blue-200 text-blue-900">
                                      {digit}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={!pin}
                                onClick={() => handleCopy(c.unitCode, pin)}
                                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
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
                      </div>

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

                    <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-3">
                      <button
                        onClick={() => openRenewModal(c)}
                        className="stitch-btn-secondary flex-1 text-xs py-2.5 flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[18px]">autorenew</span>
                        <span>Yêu Cầu Gia Hạn</span>
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
                  onClick={() => setIsCustomerPolicyModalOpen(true)}
                  className="px-3 py-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-cyan-200"
                  title="Xem quy định đặt cọc, hủy đặt kho và SLA hoàn tiền"
                >
                  <span className="material-symbols-outlined text-[16px]">policy</span>
                  <span>Chính sách cọc &amp; hủy</span>
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

            {/* Search & Status Filters */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="relative flex-1 max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Tìm theo mã đặt chỗ (BX-...), mã kho (D1-..., D7-...), hoặc cơ sở..."
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
                  { key: 'CONFIRMED', label: 'Đã giữ chỗ', count: customerBookings.filter(b => b.status === 'CONFIRMED').length },
                  { key: 'PENDING_PAYMENT', label: 'Chờ cọc', count: customerBookings.filter(b => b.status === 'PENDING_PAYMENT').length },
                  { key: 'ACTIVE', label: 'Đang dùng', count: customerBookings.filter(b => b.status === 'ACTIVE').length },
                  { key: 'COMPLETED', label: 'Đã xong', count: customerBookings.filter(b => b.status === 'COMPLETED').length },
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
                if (bookingStatusFilter === 'CANCELLED') {
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
                            <span className="font-mono font-bold text-slate-900">
                              {b.expectedCheckInAt ? new Date(b.expectedCheckInAt).toLocaleString('vi-VN') : b.startDate}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Thời hạn thuê</span>
                            <span className="font-semibold text-slate-800">{b.rentalMonths} tháng</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Hạn giữ chỗ</span>
                            <span className="font-mono font-bold text-amber-700">
                              {b.holdExpiresAt ? new Date(b.holdExpiresAt).toLocaleString('vi-VN') : (b.status === 'ACTIVE' ? 'Đã kích hoạt' : 'Theo chính sách')}
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

                        {/* Status Notice Block */}
                        {(b.status === 'CANCELLED' || b.status === 'OVERDUE') && (
                          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-800 flex items-start gap-2">
                            <span className="material-symbols-outlined text-[16px] text-rose-600 shrink-0 mt-0.5">
                              event_busy
                            </span>
                            <div className="leading-relaxed">
                              <strong>Đơn giữ chỗ đã hết hạn / đã hủy:</strong> {b.holdExpiresAt ? `Hạn giữ chỗ đã kết thúc lúc ${new Date(b.holdExpiresAt).toLocaleString('vi-VN')}. ` : ''}Kho đã được tự động giải phóng theo chính sách cơ sở.
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
                                    Thủ tục hợp đồng và thanh toán đã hoàn tất 100%! Quý khách chỉ cần mang CCCD gốc đến cơ sở Boxora đúng lịch hẹn (<strong>{b.expectedCheckInAt ? new Date(b.expectedCheckInAt).toLocaleString('vi-VN') : b.startDate}</strong>) để xem kho thực tế, nhận bàn giao và nhận mã PIN SmartLock. <em>Lưu ý: Thời hạn thuê kho sẽ chính thức có hiệu lực tính từ ngày bạn check-in và kích hoạt mã PIN tại cơ sở.</em>
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
                                    Đơn đặt kho đã thanh toán đủ. Quý khách vui lòng ký hợp đồng điện tử trực tuyến (DocuSeal) hoặc mang CCCD gốc đến cơ sở Boxora để ký hợp đồng và nhận bàn giao kho.
                                  </div>
                                  {info.matchingContract && info.matchingContract.status === 'PENDING_SIGNATURE' ? (
                                    <div className="mt-2.5 flex items-center justify-end">
                                      <button
                                        type="button"
                                        onClick={() => handleSignContractNow(info.matchingContract!)}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                                      >
                                        <span className="material-symbols-outlined text-[15px]">draw</span>
                                        <span>Ký hợp đồng điện tử ngay</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="mt-1 text-[10px] text-blue-700 italic">
                                      (Quý khách có thể ký trực tiếp khi mang CCCD gốc đến cơ sở nhận kho)
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          }

                          // Case 1: Check-in thanh toán và ký hợp đồng tại chỗ
                          if (info.scenario === 'UNPAID_IN_PERSON') {
                            return (
                              <div className="space-y-2">
                                <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-[11px] text-amber-950 flex items-start gap-2.5">
                                  <span className="material-symbols-outlined text-[18px] text-amber-700 shrink-0 mt-0.5">
                                    storefront
                                  </span>
                                  <div className="leading-relaxed flex-1">
                                    <div className="font-bold text-amber-900 mb-0.5 flex items-center justify-between">
                                      <span>Check-in thanh toán và ký hợp đồng tại chỗ</span>
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold">
                                        Thanh toán tại quầy
                                      </span>
                                    </div>
                                    <div>
                                      Kho được bảo lưu riêng cho bạn đến <strong>{b.holdExpiresAt ? new Date(b.holdExpiresAt).toLocaleString('vi-VN') : 'lịch hẹn + thời gian gia hạn'}</strong>. Quý khách vui lòng mang CCCD gốc đến cơ sở Boxora để xem kho thực tế, ký hợp đồng và thanh toán nhận bàn giao.
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
                                    <span>Thanh toán và ký hợp đồng trực tuyến ngay</span>
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

                    <div className="p-5 pt-0">
                      <button
                        onClick={() => {
                          setSelectedBookingUnit({ 
                            id: unit.id, 
                            unitCode: unit.unitCode,
                            name: unit.unitTypeName || `Kho Tiêu Chuẩn #${unit.unitCode}`, 
                            facilityName: unit.facilityName || 'Hệ thống kho Boxora',
                            priceFormatted: priceFormatted,
                            priceNumber: Number(unit.pricePerMonth || 1250000),
                            depositNumber: Number(unit.depositAmount || unit.pricePerMonth || 1250000),
                            areaSqMeters: unit.areaSqMeters,
                            floorLevel: unit.floorLevel || 'Tầng 1'
                          })
                          setBookingPackage('3m')
                          setBookingCustomDays(45)
                          const todayStr = new Date().toISOString().split('T')[0]
                          setBookingStartDate(todayStr)
                          const checkInD = new Date()
                          checkInD.setDate(checkInD.getDate() + 3)
                          setBookingCheckInDate(checkInD.toISOString().split('T')[0])
                          setBookingPolicyAccepted(true)
                          setBookingWorkflow('HOLD_ONLY')
                          setBookingSuccess(false)
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
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsCustomerPolicyModalOpen(true)}
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
                    contracts.map(c => (
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
                          {Number(c.depositHeld || 0).toLocaleString('vi-VN')} ₫
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
                                title="Ký hợp đồng DocuSeal ngay"
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
                              : p.status === 'PENDING'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : p.status === 'REFUNDED'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {p.status === 'PAID' || p.status === 'SUCCESS' ? 'Thành công' : p.status === 'PENDING' ? 'Chờ xử lý' : p.status === 'REFUNDED' ? 'Đã hoàn tiền' : 'Thất bại'}
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
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Kho lưu trữ liên quan
                      </label>
                      <select
                        value={ticketUnit}
                        onChange={(e) => setTicketUnit(e.target.value)}
                        className="h-10 px-3 bg-white border border-slate-200 text-slate-900 text-xs font-semibold rounded-lg focus:outline-none focus:border-slate-400"
                      >
                        {activeContracts.length > 0 ? (
                          activeContracts.map(c => (
                            <option key={c.unitCode} value={c.unitCode}>
                              Kho #{c.unitCode} ({c.facilityName})
                            </option>
                          ))
                        ) : (
                          <option value="general">Chưa có kho hoạt động</option>
                        )}
                        <option value="general">Khác / Thắc mắc chung</option>
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
                        disabled={isSubmittingTicket}
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

            {/* Filters & Search */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Tìm theo mã phiếu (TK-...), kho, hoặc nội dung..."
                  value={ticketSearchTerm}
                  onChange={(e) => setTicketSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                />
                {ticketSearchTerm && (
                  <button
                    onClick={() => setTicketSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-0.5"
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
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        ticketStatusFilter === tab.key
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* List Content */}
            {loadingTickets ? (
              <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[32px] text-blue-600 animate-spin">sync</span>
                <span>Đang tải lịch sử báo cáo sự cố từ hệ thống...</span>
              </div>
            ) : (() => {
              const filteredTickets = customerTickets.filter(t => {
                if (ticketStatusFilter !== 'ALL') {
                  if (ticketStatusFilter === 'PENDING') {
                    if (t.status !== 'OPEN' && t.status !== 'PENDING') return false
                  } else if (ticketStatusFilter === 'RESOLVED') {
                    if (t.status !== 'RESOLVED' && t.status !== 'CLOSED') return false
                  } else if (t.status !== ticketStatusFilter) {
                    return false
                  }
                }
                if (ticketSearchTerm.trim()) {
                  const term = ticketSearchTerm.toLowerCase().trim()
                  const codeMatch = t.ticketCode?.toLowerCase().includes(term)
                  const unitMatch = t.unitCode?.toLowerCase().includes(term)
                  const titleMatch = t.title?.toLowerCase().includes(term)
                  const descMatch = t.description?.toLowerCase().includes(term)
                  const resMatch = t.resolutionNote?.toLowerCase().includes(term)
                  if (!codeMatch && !unitMatch && !titleMatch && !descMatch && !resMatch) return false
                }
                return true
              })

              if (filteredTickets.length === 0) {
                return (
                  <div className="p-10 text-center flex flex-col items-center justify-center gap-3 bg-slate-50/70 border border-slate-200 rounded-xl">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[28px]">assignment_turned_in</span>
                    </div>
                    <div className="max-w-md">
                      <h4 className="text-sm font-bold text-slate-800">
                        {ticketSearchTerm || ticketStatusFilter !== 'ALL'
                          ? 'Không có báo cáo sự cố nào phù hợp bộ lọc'
                          : 'Chưa có yêu cầu hỗ trợ hoặc báo cáo sự cố nào'}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {ticketSearchTerm || ticketStatusFilter !== 'ALL'
                          ? 'Thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc trạng thái khác.'
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
                    Mã đặt chỗ của bạn: <strong className="font-mono text-slate-800">#{createdBookingResult?.bookingCode || 'Đã ghi nhận'}</strong>
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
                    <span className="text-slate-500">Lịch hẹn nhận kho:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {createdBookingResult?.expectedCheckInAt
                        ? new Date(createdBookingResult.expectedCheckInAt).toLocaleString('vi-VN')
                        : `${formatDisplayDate(bookingCheckInDate)} lúc ${bookingCheckInTime}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Hạn giữ chỗ:</span>
                    <span className="font-mono font-bold text-amber-700">
                      {createdBookingResult?.holdExpiresAt
                        ? new Date(createdBookingResult.holdExpiresAt).toLocaleString('vi-VN')
                        : 'Sau giờ hẹn 24 giờ (Theo chính sách cơ sở)'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Trạng thái thanh toán:</span>
                    <span className="font-semibold text-slate-800">
                      {bookingWorkflow === 'HOLD_ONLY' ? 'Chưa thanh toán (Thanh toán tại quầy cơ sở)' : 'Chờ xác nhận VNPay'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500">Phương thức:</span>
                    <span className="font-bold text-slate-700">
                      {bookingWorkflow === 'HOLD_ONLY' ? 'Giữ chỗ miễn phí theo lịch hẹn (Ký & thanh toán tại quầy)' : 'Ký điện tử & Thanh toán online'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                  {bookingWorkflow === 'HOLD_ONLY' 
                    ? 'Vị trí kho đã được bảo lưu riêng cho bạn đến lịch hẹn và thời gian gia hạn theo chính sách. Quý khách vui lòng đến trực tiếp cơ sở để xem kho thực tế, ký biên bản và thanh toán nhận bàn giao.'
                    : 'Hợp đồng điện tử và yêu cầu thanh toán đã sẵn sàng. Mã PIN sẽ được kích hoạt sau khi hoàn tất thủ tục bàn giao theo quy định.'}
                </p>

                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => {
                      setBookingSuccess(false)
                      setSelectedBookingUnit(null)
                      handleTabChange('bookings')
                    }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Xem Danh Sách Đặt Chỗ
                  </button>
                  <button
                    onClick={() => {
                      setBookingSuccess(false)
                      setSelectedBookingUnit(null)
                      handleTabChange('my-units')
                    }}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                  >
                    Đến Kho Của Tôi
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
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
                    onClick={() => setSelectedBookingUnit(null)}
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
                      <div className="flex items-center gap-2 flex-1">
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

                    {/* Ngày & Giờ check-in dự kiến */}
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                        Lịch hẹn check-in dự kiến
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        <input
                          type="date"
                          value={bookingCheckInDate}
                          onChange={(e) => setBookingCheckInDate(e.target.value)}
                          className="col-span-3 h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                        <input
                          type="time"
                          value={bookingCheckInTime}
                          onChange={(e) => setBookingCheckInTime(e.target.value)}
                          className="col-span-2 h-9 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 leading-normal">
                        Ngày &amp; giờ bạn đến cơ sở để xem kho thực tế, ký biên bản và thanh toán nhận kho.
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
                    {/* Option 1: Giữ chỗ miễn phí theo lịch hẹn */}
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
                            Giữ chỗ miễn phí theo lịch hẹn
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                            Theo chính sách cơ sở
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-normal">
                          Giữ vị trí kho đến giờ hẹn ({formatDisplayDate(bookingCheckInDate)} lúc {bookingCheckInTime}) + 24 giờ gia hạn theo chính sách. Xem kho thực tế và thanh toán tại quầy.
                        </p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Thanh toán ngay</span>
                        <span className="font-mono font-bold text-slate-900">0 ₫ (Thanh toán tại quầy)</span>
                      </div>
                    </div>

                    {/* Option 2: Ký online & thanh toán ngay */}
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
                            Ký online &amp; thanh toán ngay
                          </span>
                          <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                            Thanh toán trực tuyến
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-normal">
                          Ký hợp đồng DocuSeal trực tuyến và thanh toán cọc + tiền thuê tháng đầu qua cổng VNPay Sandbox.
                        </p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Tổng thanh toán ngay</span>
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
                    onClick={() => setSelectedBookingUnit(null)}
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
              <div className="py-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                  <span className="material-symbols-outlined text-[32px]">check_circle</span>
                </div>
                <h3 className="font-headline text-lg font-bold text-slate-900">
                  Gửi Yêu Cầu Gia Hạn Thành Công!
                </h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                  Yêu cầu gia hạn thêm <strong>{renewMonths} tháng</strong> cho hợp đồng <strong>#{renewModalData.contractCode}</strong> (Kho #{renewModalData.unitCode}) đã được tiếp nhận và xử lý vào hệ thống Boxora.
                </p>
                <button
                  onClick={() => {
                    setRenewSuccess(false)
                    setRenewModalData(null)
                  }}
                  className="mt-4 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  Đóng cửa sổ
                </button>
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

                    {/* Inputs for Price, Discount, Other Fee */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">
                          Giá thuê mỗi tháng (VND)
                        </label>
                        <input
                          type="number"
                          value={renewMonthlyPrice}
                          onChange={(e) => setRenewMonthlyPrice(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">
                          Chiết khấu (%)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={renewDiscountPercent}
                          onChange={(e) => setRenewDiscountPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                          className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">
                          Phí khác (VND)
                        </label>
                        <input
                          type="number"
                          value={renewOtherFee}
                          onChange={(e) => setRenewOtherFee(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Tổng tiền dự kiến */}
                    <div className="mt-2 p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Tổng tiền dự kiến
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Chưa tính công nợ cũ hoặc khoản điều chỉnh khác
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
          onSignNow={handleSignContractNow}
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
                            Sẵn sàng nhận kho
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-800">
                          Thủ tục hợp đồng và thanh toán đã hoàn tất 100%! Quý khách chỉ cần mang CCCD gốc đến cơ sở Boxora đúng lịch hẹn để đối soát, nhận bàn giao kho và kích hoạt mã PIN mở khóa SmartLock. <em>Lưu ý: Thời hạn thuê và hiệu lực hợp đồng sẽ chính thức tính từ ngày bạn hoàn tất check-in và nhận mã PIN tại cơ sở.</em>
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
                          Đơn đặt kho đã thanh toán đủ. Quý khách vui lòng hoàn tất ký hợp đồng điện tử trực tuyến (DocuSeal) hoặc mang CCCD gốc đến cơ sở Boxora để ký hợp đồng và nhận bàn giao kho.
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
                        <strong className="font-mono text-slate-900 text-xs">
                          {selectedBookingForModal.handoverTime
                            ? new Date(selectedBookingForModal.handoverTime).toLocaleString('vi-VN')
                            : selectedBookingForModal.expectedCheckInAt
                            ? new Date(selectedBookingForModal.expectedCheckInAt).toLocaleString('vi-VN')
                            : selectedBookingForModal.startDate}
                        </strong>
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
                              <strong>Ký hợp đồng &amp; Nghiệm thu:</strong> Đơn kho đã thanh toán đủ. Quý khách vui lòng ký hợp đồng điện tử DocuSeal hoặc ký trực tiếp tại cơ sở trước khi nhận bàn giao kho.
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
                          <strong>Kích hoạt mã PIN mở khóa:</strong> Sau khi bàn giao hoàn tất, hệ thống tự động phát hành mã PIN bảo mật cho bạn để mở khóa SmartLock.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Append-Only Check-in Rescheduling History */}
                  <div className="border-t border-slate-200/80 pt-3">
                    <BookingRescheduleHistorySection bookingId={selectedBookingForModal.id} />
                  </div>

                  {/* Action buttons */}
                  <div className="pt-2 flex items-center">
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
        facilityId={facilities[0]?.id}
        facilityName={facilities[0]?.name}
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
            depositAmount: requestToPay.depositPaid || requestToPay.depositAmount || 0,
            size: undefined,
            address: ''
          }}
          user={user}
          existingBooking={requestToPay}
          onClose={() => {
            setRequestToPay(null)
            fetchCustomerBookings()
            fetchContracts()
            fetchCustomerPayments()
          }}
        />
      )}

      {/* Ticket closure confirmation: no state changes until the backend confirms. */}
      {closeTicketTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <section role="dialog" aria-modal="true" aria-labelledby="close-ticket-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><span className="material-symbols-outlined">verified</span></div>
              <div>
                <h3 id="close-ticket-title" className="text-base font-bold text-slate-900">Xác nhận hài lòng và đóng phiếu</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">Xác nhận này sẽ đóng phiếu sự cố #{closeTicketTarget.ticketCode || closeTicketTarget.id.slice(0, 8)}. Bạn chỉ nên tiếp tục khi sự cố đã được xử lý hoàn toàn.</p>
              </div>
            </div>
            {ticketActionError && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{ticketActionError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" disabled={isProcessingTicketAction} onClick={() => setCloseTicketTarget(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Cancel</button>
              <button type="button" disabled={isProcessingTicketAction} onClick={handleCloseCustomerTicket} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{isProcessingTicketAction ? 'Đang đóng...' : 'Confirm'}</button>
            </div>
          </section>
        </div>
      )}

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

    </div>
  )
}

export default CustomerDashboard
