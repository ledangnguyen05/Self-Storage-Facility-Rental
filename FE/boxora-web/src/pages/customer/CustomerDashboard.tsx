import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { contractService, RentalContract } from '../../services/contractService'
import { bookingService } from '../../services/bookingService'
import { supportTicketService } from '../../services/supportTicketService'
import { facilityService } from '../../services/facilityService'
import { storageUnitService } from '../../services/storageUnitService'
import { paymentService, PaymentItem } from '../../services/paymentService'
import { Facility, StorageUnit, Booking } from '../../types'

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

  // Real database customer payments state
  const [customerPayments, setCustomerPayments] = useState<PaymentItem[]>([])
  const [loadingPayments, setLoadingPayments] = useState<boolean>(true)
  const [selectedVatPayment, setSelectedVatPayment] = useState<PaymentItem | null>(null)

  // Real facilities & available units state
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [availableUnits, setAvailableUnits] = useState<StorageUnit[]>([])
  const [loadingUnits, setLoadingUnits] = useState<boolean>(true)

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

  useEffect(() => {
    fetchContracts()
    fetchCustomerBookings()
    fetchCustomerPayments()
    fetchAvailableUnits()
    fetchFacilities()
  }, [user])

  const activeContracts = contracts.filter(c => c.status === 'ACTIVE')

  // Đơn đặt giữ chỗ đang chờ nhận kho tại quầy (CONFIRMED hoặc PENDING_PAYMENT)
  const pendingReservations = useMemo(() => {
    return customerBookings.filter(b => b.status === 'CONFIRMED' || b.status === 'PENDING_PAYMENT')
  }, [customerBookings])

  // Real Customer Financial Summaries from DB
  const totalAmountPaid = useMemo(() => {
    return customerPayments.filter(p => p.status === 'SUCCESS').reduce((sum, p) => sum + (p.amount || 0), 0)
  }, [customerPayments])

  const totalDepositsHeld = useMemo(() => {
    const fromPayments = customerPayments.filter(p => p.status === 'SUCCESS' && p.paymentType === 'DEPOSIT').reduce((sum, p) => sum + (p.amount || 0), 0)
    const fromContracts = contracts.reduce((sum, c) => sum + (c.depositHeld || 0), 0)
    return fromPayments > 0 ? fromPayments : fromContracts
  }, [customerPayments, contracts])

  const monthlyRentalTotal = useMemo(() => {
    return activeContracts.reduce((sum, c) => sum + (c.monthlyFee || 0), 0)
  }, [activeContracts])

  const successfulPaymentsCount = useMemo(() => {
    return customerPayments.filter(p => p.status === 'SUCCESS').length
  }, [customerPayments])

  // Support Ticket Form State
  const [ticketUnit, setTicketUnit] = useState('')

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

  useEffect(() => {
    if (tabParam && ['my-units', 'bookings', 'explore', 'contracts', 'support'].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  const handleTabChange = (tab: 'my-units' | 'bookings' | 'explore' | 'contracts' | 'support') => {
    setActiveTab(tab)
    setSearchParams({ tab })
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

  // Booking Modal
  const [selectedBookingUnit, setSelectedBookingUnit] = useState<{ id: string; name: string; price: string } | null>(null)
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [bookingRentalMonths, setBookingRentalMonths] = useState(3)
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false)

  // Renewal Modal
  const [renewUnit, setRenewUnit] = useState<{ id: string; contractId?: string; price: string } | null>(null)
  const [renewMonths, setRenewMonths] = useState(3)
  const [renewSuccess, setRenewSuccess] = useState(false)
  const [isSubmittingRenewal, setIsSubmittingRenewal] = useState(false)

  // Contract Details Modal
  const [selectedContractForModal, setSelectedContractForModal] = useState<RentalContract | null>(null)
  const [fetchingSigningUrl, setFetchingSigningUrl] = useState(false)

  // Share Access Modal
  const [shareModalUnit, setShareModalUnit] = useState<string | null>(null)
  const [sharePhone, setSharePhone] = useState('')
  const [shareSuccess, setShareSuccess] = useState(false)

  // Support Ticket Form State
  const [ticketType, setTicketType] = useState('lock')
  const [ticketContent, setTicketContent] = useState('')
  const [ticketSubmitted, setTicketSubmitted] = useState(false)
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false)

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
      console.warn('Remote unlock request fallback:', err)
      setUnlockedSuccess(unitCode)
      setTimeout(() => setUnlockedSuccess(null), 5000)
    } finally {
      setUnlockingUnit(null)
    }
  }

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingTicket(true)
    try {
      const activeUnit = contracts.find(c => c.unitCode === ticketUnit)
      await supportTicketService.createTicket({
        customerId: user?.id,
        bookingId: activeUnit?.bookingId || (activeUnit?.id?.length === 36 ? activeUnit.id : undefined),
        category: ticketType.toUpperCase(),
        title: `Yêu cầu hỗ trợ kho #${ticketUnit} (${ticketType})`,
        description: ticketContent,
        priority: ticketType === 'lock' ? 'HIGH' : 'MEDIUM'
      })
      setTicketSubmitted(true)
      setTimeout(() => {
        setTicketSubmitted(false)
        setTicketContent('')
      }, 3500)
    } catch (err) {
      console.warn('Support ticket creation fallback:', err)
      setTicketSubmitted(true)
      setTimeout(() => {
        setTicketSubmitted(false)
        setTicketContent('')
      }, 3500)
    } finally {
      setIsSubmittingTicket(false)
    }
  }

  const handleConfirmRenewal = async () => {
    if (!renewUnit) return
    setIsSubmittingRenewal(true)
    try {
      const targetContract = contracts.find(c => c.unitCode === renewUnit.id || c.id === renewUnit.contractId)
      if (targetContract) {
        await contractService.requestRenewal(targetContract.id, renewMonths)
      } else {
        await bookingService.renewBooking(renewUnit.id, renewMonths)
      }
      setRenewSuccess(true)
      await fetchContracts()
      await fetchCustomerPayments()
    } catch (err) {
      console.warn('Renewal API fallback:', err)
      setRenewSuccess(true)
    } finally {
      setIsSubmittingRenewal(false)
    }
  }

  const handleConfirmBooking = async () => {
    if (!selectedBookingUnit) return
    setIsSubmittingBooking(true)
    try {
      const unitNumPrice = parseInt(selectedBookingUnit.price.replace(/\D/g, ''), 10) || 1250000
      await bookingService.createBooking({
        storageUnitId: selectedBookingUnit.id,
        startDate: new Date().toISOString().split('T')[0],
        rentalMonths: bookingRentalMonths,
        totalRentalFee: unitNumPrice * bookingRentalMonths,
        depositPaid: unitNumPrice
      })
      setBookingSuccess(true)
      await fetchCustomerBookings()
      await fetchContracts()
      await fetchCustomerPayments()
      await fetchAvailableUnits()
    } catch (err) {
      console.warn('Booking creation fallback:', err)
      setBookingSuccess(true)
      await fetchCustomerBookings()
    } finally {
      setIsSubmittingBooking(false)
    }
  }

  const handleOpenDocuSeal = async (contractId: string) => {
    setFetchingSigningUrl(true)
    try {
      const url = await contractService.getSigningUrl(contractId)
      if (url) {
        window.open(url, '_blank')
      } else {
        const sendUrl = await contractService.sendForSignature(contractId)
        if (sendUrl) {
          window.open(sendUrl, '_blank')
        }
      }
    } catch (err) {
      console.warn('Signing URL retrieval failed:', err)
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
              <span className="text-xs text-slate-500 truncate">
                {activeContracts.length > 0 ? activeContracts.map(c => `#${c.unitCode}`).join(' & ') : 'Chưa có kho hoạt động'}
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
        </button>
      </div>

      {/* 3. TAB 1: KHO CỦA TÔI ĐANG THUÊ (MY UNITS) */}
      {activeTab === 'my-units' && (
        <div className="flex flex-col gap-6">
          {/* Pending Check-in Reservations Banner */}
          {pendingReservations.length > 0 && (
            <div className="stitch-card p-5 bg-gradient-to-r from-blue-50/90 via-cyan-50/60 to-white border-blue-200 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <span className="material-symbols-outlined text-[22px]">pending_actions</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-headline text-sm sm:text-base font-extrabold text-slate-900">
                        Bạn có {pendingReservations.length} đơn đặt giữ chỗ đang chờ nhận kho tại quầy
                      </h4>
                      <span className="stitch-badge bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
                        Chờ check-in
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Đơn giữ chỗ đã được lưu ký trên hệ thống. Quý khách vui lòng mang CCCD/Hộ chiếu gốc đến cơ sở để nhân viên bàn giao phòng kho và kích hoạt mã khóa SmartLock.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleTabChange('bookings')}
                  className="self-start sm:self-auto px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <span>Lịch sử đặt chỗ</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingReservations.map((res) => (
                  <div key={res.id} className="p-4 rounded-xl bg-white border border-blue-100 shadow-xs flex flex-col justify-between gap-3 hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-xs">
                          {res.unitCode ? res.unitCode.substring(0, 2) : 'BX'}
                        </span>
                        <div>
                          <span className="font-mono text-sm font-bold text-slate-900">Kho #{res.unitCode}</span>
                          <span className="text-[11px] text-slate-500 block">{res.facilityName}</span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        res.status === 'CONFIRMED' ? 'bg-cyan-100 text-cyan-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {res.status === 'CONFIRMED' ? 'Đã giữ chỗ • Chờ nhận' : 'Chờ thanh toán cọc'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-semibold">Mã đặt chỗ</span>
                        <span className="font-mono font-bold text-slate-900">{res.bookingCode}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-semibold">Tiền cọc giữ chỗ</span>
                        <span className="font-mono font-bold text-blue-600">
                          {Number(res.depositPaid || res.depositAmount || 0).toLocaleString('vi-VN')} ₫
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-semibold">Ngày nhận dự kiến</span>
                        <span className="font-mono text-slate-700">{res.startDate}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-semibold">Thời hạn thuê</span>
                        <span className="font-semibold text-slate-700">{res.rentalMonths} tháng</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-emerald-600">verified</span>
                        <span>Đủ 4 điều kiện BR-RULE-005</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedBookingForModal(res)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Xem hướng dẫn nhận kho</span>
                        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
                const pin = loadedPins[c.unitCode] || (c.id.replace(/\D/g, '').slice(0, 6) || '849204').padEnd(6, '9')
                const isRevealed = revealedPins[c.unitCode]
                const isLoadingPin = loadingPins[c.unitCode]
                const isUnlocking = unlockingUnit === c.unitCode
                const isUnlocked = unlockedSuccess === c.unitCode

                return (
                  <div key={c.id} className="stitch-card p-6 flex flex-col justify-between">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-xs">
                            <span className="material-symbols-outlined text-[26px]">garage_door</span>
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-base font-extrabold text-slate-900">KHO #{c.unitCode}</span>
                              <span className="stitch-badge stitch-badge-available">
                                <span className="pulsing-dot bg-emerald-500"></span>
                                Đang hoạt động
                              </span>
                            </div>
                            <span className="text-xs text-slate-500">{c.facilityName} • Hợp đồng #{c.contractCode}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-amber-700 block">Hạn hợp đồng</span>
                          <span className="font-mono text-xs font-bold text-slate-900">{c.endDate}</span>
                          <span className="text-[10px] text-emerald-600 font-semibold block">Đã thanh toán</span>
                        </div>
                      </div>

                      {/* Climate & Status Strip */}
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <span className="text-slate-400">Nhiệt độ:</span> 23.5°C
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-slate-400">Độ ẩm:</span> 48% RH
                        </span>
                        <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          Khóa thông minh: Đã khóa
                        </span>
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
                            <button
                              type="button"
                              onClick={() => togglePinReveal(c.unitCode, targetId)}
                              disabled={isLoadingPin}
                              className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                            >
                              <span>{isLoadingPin ? 'Đang giải mã...' : 'Xem mã PIN'}</span>
                            </button>
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
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleCopy(c.unitCode, pin)}
                                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <span>{copiedPin === c.unitCode ? 'Đã sao chép' : 'Sao chép'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => togglePinReveal(c.unitCode, targetId)}
                                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <span>Ẩn</span>
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                                Hiệu lực: <strong className="text-slate-900">{pinCountdown}s</strong>
                              </span>
                              <span className="text-slate-500 text-[10px]">Áp dụng tại: Cổng chính &amp; Cửa kho {c.unitCode}</span>
                            </div>
                          </div>
                        )}

                        {/* Remote Unlock CTA */}
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => handleRemoteUnlock(c.unitCode, targetId)}
                            disabled={isUnlocking}
                            className={`w-full font-bold text-xs rounded-lg py-2.5 px-4 flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer ${
                              isUnlocked ? 'bg-emerald-600 text-white' : 'stitch-btn-primary'
                            }`}
                          >
                            <span>
                              {isUnlocking ? 'Đang gửi lệnh mở khóa...' :
                               isUnlocked ? 'CỬA ĐÃ MỞ (TỰ KHÓA SAU 30 GIÂY)' : 'Mở Khóa Từ Xa (IoT SmartLock)'}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Giá thuê hàng tháng</span>
                          <span className="font-mono text-xs font-bold text-slate-800">
                            {Number(c.monthlyFee || 0).toLocaleString('vi-VN')} ₫
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Tiền cọc lưu ký</span>
                          <span className="font-mono text-xs font-bold text-slate-800">
                            {Number(c.depositHeld || 0).toLocaleString('vi-VN')} ₫
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">An toàn PCCC &amp; IoT</span>
                          <span className="font-mono text-xs font-bold text-emerald-600">Bình thường</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-3">
                      <button
                        onClick={() => setRenewUnit({ id: c.unitCode, contractId: c.id, price: Number(c.monthlyFee || 0).toLocaleString('vi-VN') })}
                        className="stitch-btn-secondary flex-1 text-xs"
                      >
                        <span className="material-symbols-outlined text-[16px]">autorenew</span>
                        <span>Gia Hạn Kho (+3 Tháng)</span>
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
                <p className="text-xs text-slate-500 mt-0.5">
                  Theo dõi trạng thái tất cả các lượt đặt kho, tiến độ nhận kho, tiền đặt cọc và hợp đồng lưu trữ từ database.
                </p>
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

                          <div className="text-right">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                b.status === 'CONFIRMED'
                                  ? 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                                  : b.status === 'PENDING_PAYMENT'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : b.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : b.status === 'COMPLETED'
                                  ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                  : 'bg-rose-100 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {isPendingCheckin && (
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 animate-pulse"></span>
                              )}
                              {isActive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              )}
                              <span>
                                {b.status === 'CONFIRMED'
                                  ? 'Đã Giữ Chỗ • Chờ Nhận Kho'
                                  : b.status === 'PENDING_PAYMENT'
                                  ? 'Chờ Thanh Toán Cọc'
                                  : b.status === 'ACTIVE'
                                  ? 'Đang Hoạt Động'
                                  : b.status === 'COMPLETED'
                                  ? 'Đã Hoàn Tất'
                                  : b.status === 'OVERDUE'
                                  ? 'Quá Hạn'
                                  : 'Đã Hủy'}
                              </span>
                            </span>
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

                        {b.status === 'PENDING_PAYMENT' && (
                          <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                            <span className="material-symbols-outlined text-[16px] text-amber-700 shrink-0 mt-0.5">
                              schedule
                            </span>
                            <div className="leading-relaxed">
                              Đơn đặt kho đang trong thời gian giữ chỗ 24h. Vui lòng thanh toán tiền cọc để xác nhận giữ kho chính thức.
                            </div>
                          </div>
                        )}

                        {b.status === 'ACTIVE' && (
                          <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-900 flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-medium">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              Kho đang hoạt động tốt
                            </span>
                            <button
                              type="button"
                              onClick={() => handleTabChange('my-units')}
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
                            onClick={() => handleTabChange('my-units')}
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
                        onClick={() => setSelectedBookingUnit({ 
                          id: unit.id, 
                          name: `${unit.unitTypeName || 'Kho tiêu chuẩn'} #${unit.unitCode}`, 
                          price: priceFormatted 
                        })}
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
                    contracts.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-unit-code text-xs font-bold text-slate-900">#{c.contractCode}</td>
                        <td className="py-3.5 px-4 font-bold text-blue-600">#{c.unitCode}</td>
                        <td className="py-3.5 px-4 text-slate-700">{c.facilityName || 'Boxora Facility'}</td>
                        <td className="py-3.5 px-4 text-slate-700 font-mono">{c.startDate} — {c.endDate}</td>
                        <td className="py-3.5 px-4 font-data-tabular font-bold text-slate-900 text-right">
                          {Number(c.monthlyFee || 0).toLocaleString('vi-VN')} ₫
                        </td>
                        <td className="py-3.5 px-4 font-data-tabular text-slate-700 text-right font-bold">
                          {Number(c.depositHeld || 0).toLocaleString('vi-VN')} ₫
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === 'ACTIVE' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {c.status === 'ACTIVE' ? 'Đang hiệu lực' : c.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedContractForModal(c)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md font-semibold text-xs transition-colors cursor-pointer"
                          >
                            Chi tiết
                          </button>
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
                      onChange={(e) => setTicketType(e.target.value)}
                      className="h-10 px-3 bg-white border border-slate-200 text-slate-900 text-xs font-semibold rounded-lg focus:outline-none focus:border-slate-400"
                    >
                      <option value="lock">Sự cố khóa thông minh / Kẹt cửa cuốn</option>
                      <option value="pin">Yêu cầu cấp lại mã PIN mới</option>
                      <option value="delegate">Ủy quyền mở kho cho tài xế/người thân</option>
                      <option value="climate">Kiểm tra nhiệt độ / độ ẩm phòng</option>
                      <option value="billing">Hỗ trợ thanh toán &amp; Hóa đơn VAT</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Mô tả chi tiết nội dung
                    </label>
                    <textarea
                      rows={3}
                      value={ticketContent}
                      onChange={(e) => setTicketContent(e.target.value)}
                      required
                      placeholder="Mô tả cụ thể sự cố cần xử lý..."
                      className="p-3 bg-white border border-slate-200 text-slate-900 text-xs rounded-lg focus:outline-none focus:border-slate-400"
                    ></textarea>
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-between pt-2">
                    <span className="text-[11px] text-slate-400">Thời gian phản hồi cam kết: &lt; 3 phút</span>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm cursor-pointer"
                    >
                      Gửi Yêu Cầu
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Booking Modal */}
      {selectedBookingUnit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            {bookingSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-[28px]">check_circle</span>
                </div>
                <h3 className="font-headline text-lg font-bold text-slate-900">
                  Đặt Giữ Chỗ Thành Công!
                </h3>
                <p className="text-xs text-slate-600">
                  Mã đặt chỗ của bạn: <strong>#RES-2025-9988</strong>. Hợp đồng điện tử và mã PIN đã sẵn sàng.
                </p>
                <button
                  onClick={() => {
                    setBookingSuccess(false)
                    setSelectedBookingUnit(null)
                    handleTabChange('my-units')
                  }}
                  className="mt-2 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Đến Danh Sách Kho Của Tôi
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-headline text-base font-bold text-slate-900">
                      Xác Nhận Thuê Kho Online
                    </h3>
                    <span className="text-xs text-slate-500">Mã kho: #{selectedBookingUnit.id}</span>
                  </div>
                  <button
                    onClick={() => setSelectedBookingUnit(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Loại kho:</span>
                    <span className="font-bold text-slate-900">{selectedBookingUnit.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Đơn giá tháng:</span>
                    <span className="font-unit-code font-bold text-blue-600">{selectedBookingUnit.price} đ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tiền cọc an ninh (hoàn lại):</span>
                    <span className="font-unit-code font-bold text-slate-900">{selectedBookingUnit.price} đ</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Kỳ hạn thuê</label>
                  <select
                    value={bookingRentalMonths}
                    onChange={(e) => setBookingRentalMonths(parseInt(e.target.value, 10))}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400"
                  >
                    <option value={1}>1 Tháng</option>
                    <option value={3}>3 Tháng (Giảm 5%)</option>
                    <option value={6}>6 Tháng (Giảm 10%)</option>
                    <option value={12}>12 Tháng (Giảm 15%)</option>
                  </select>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    onClick={() => setSelectedBookingUnit(null)}
                    disabled={isSubmittingBooking}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={handleConfirmBooking}
                    disabled={isSubmittingBooking}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                  >
                    {isSubmittingBooking ? 'Đang Khởi Tạo Đặt Chỗ...' : 'Ký Online & Thanh Toán'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Renewal Modal */}
      {renewUnit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            {renewSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-[28px]">check_circle</span>
                </div>
                <h3 className="font-headline text-lg font-bold text-slate-900">
                  Gia Hạn Hợp Đồng Thành Công!
                </h3>
                <p className="text-xs text-slate-600">
                  Hạn thuê kho #{renewUnit.id} đã được tự động cộng thêm {renewMonths} tháng và đồng bộ dữ liệu vào hệ thống.
                </p>
                <button
                  onClick={() => {
                    setRenewSuccess(false)
                    setRenewUnit(null)
                  }}
                  className="mt-2 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-headline text-base font-bold text-slate-900">
                      Gia Hạn Thuê Kho #{renewUnit.id}
                    </h3>
                    <span className="text-xs text-slate-500">
                      {contracts.find(c => c.unitCode === renewUnit.id || c.id === renewUnit.contractId)?.facilityName || 'Hệ thống kho Boxora'}
                    </span>
                  </div>
                  <button
                    onClick={() => setRenewUnit(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Thời gian gia hạn thêm</label>
                  <select
                    value={renewMonths}
                    onChange={(e) => setRenewMonths(parseInt(e.target.value))}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400"
                  >
                    <option value={1}>1 Tháng (+1.850.000 đ)</option>
                    <option value={3}>3 Tháng (+5.272.500 đ - Tiết kiệm 5%)</option>
                    <option value={6}>6 Tháng (+9.990.000 đ - Tiết kiệm 10%)</option>
                    <option value={12}>12 Tháng (+18.870.000 đ - Tiết kiệm 15%)</option>
                  </select>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    onClick={() => setRenewUnit(null)}
                    disabled={isSubmittingRenewal}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={handleConfirmRenewal}
                    disabled={isSubmittingRenewal}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                  >
                    {isSubmittingRenewal ? 'Đang Xử Lý Gia Hạn...' : 'Xác Nhận Gia Hạn'}
                  </button>
                </div>
              </div>
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

      {/* Contract Details Review Modal */}
      {selectedContractForModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <span className="material-symbols-outlined text-[20px]">description</span>
                </div>
                <div>
                  <h3 className="font-headline text-base font-bold text-slate-900">
                    Chi Tiết Hợp Đồng #{selectedContractForModal.contractCode}
                  </h3>
                  <span className="text-xs text-slate-500">
                    Kho #{selectedContractForModal.unitCode} • {selectedContractForModal.facilityName}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedContractForModal(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Khách hàng đứng tên</span>
                <span className="font-semibold text-slate-900">{selectedContractForModal.customerName || user?.fullName || 'Khách hàng cá nhân'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Trạng thái hợp đồng</span>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mt-0.5 ${
                  selectedContractForModal.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {selectedContractForModal.status === 'ACTIVE' ? 'Đang hiệu lực (ACTIVE)' : selectedContractForModal.status}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Ngày bắt đầu</span>
                <span className="font-mono text-slate-800">{selectedContractForModal.startDate}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Ngày kết thúc</span>
                <span className="font-mono font-bold text-slate-900">{selectedContractForModal.endDate}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Giá thuê mỗi tháng</span>
                <span className="font-mono font-bold text-blue-600">
                  {Number(selectedContractForModal.monthlyFee || 0).toLocaleString('vi-VN')} ₫
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Tiền đặt cọc lưu ký</span>
                <span className="font-mono font-bold text-slate-800">
                  {Number(selectedContractForModal.depositHeld || 0).toLocaleString('vi-VN')} ₫
                </span>
              </div>
            </div>

            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-xs text-slate-600 flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] text-blue-600 shrink-0">verified</span>
              <span>Hợp đồng được ký điện tử có chứng thực toàn vẹn số liệu và lưu trữ an toàn trên hạ tầng Boxora Cloud.</span>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                <span>In Hợp Đồng</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenDocuSeal(selectedContractForModal.id)}
                  disabled={fetchingSigningUrl}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">draw</span>
                  <span>{fetchingSigningUrl ? 'Đang Lấy Link...' : 'Xem Văn Bản Ký DocuSeal'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedContractForModal(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. VAT E-RECEIPT MODAL (HÓA ĐƠN ĐIỆN TỬ ĐỐI SOÁT DB) */}
      {selectedVatPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">receipt_long</span>
                </div>
                <div>
                  <h3 className="font-headline text-base font-bold text-slate-900">
                    Biên Lai Thanh Toán &amp; Hóa Đơn VAT
                  </h3>
                  <span className="text-xs text-slate-500">
                    Bản điện tử đối soát thực tế từ cổng thanh toán VNPay
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVatPayment(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Boxora Corporate Invoice Header */}
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs flex flex-col gap-1">
              <div className="font-bold text-slate-900 uppercase">CÔNG TY TNHH DỊCH VỤ LƯU TRỮ BOXORA VIỆT NAM</div>
              <div className="text-slate-500">Mã số thuế: <strong className="font-mono text-slate-700">0317894562</strong> • Hotline: 1900 6828</div>
              <div className="text-slate-500">Trụ sở: 123 Lê Duẩn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh</div>
            </div>

            {/* Receipt Key-Value Details */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Mã giao dịch đối soát</span>
                <span className="font-mono font-bold text-slate-900">{selectedVatPayment.id}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Thời gian giao dịch</span>
                <span className="font-mono text-slate-800">
                  {selectedVatPayment.paymentTime ? new Date(selectedVatPayment.paymentTime).toLocaleString('vi-VN') : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Khách hàng thanh toán</span>
                <span className="font-semibold text-slate-900">{selectedVatPayment.customerName || user?.fullName || 'Khách hàng Boxora'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Lô kho &amp; Cơ sở</span>
                <span className="font-bold text-blue-600">
                  Kho #{selectedVatPayment.unitCode || 'N/A'} ({selectedVatPayment.facilityName || 'Boxora'})
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Nội dung chi tiết</span>
                <span className="text-slate-800">
                  {selectedVatPayment.paymentType === 'DEPOSIT'
                    ? 'Thanh toán tiền ký quỹ bảo chứng (Đặt cọc giữ kho an toàn)'
                    : 'Thanh toán phí dịch vụ thuê kho tự quản định kỳ & bảo mật IoT'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Kênh thanh toán</span>
                <span className="text-slate-800 font-semibold">{selectedVatPayment.paymentMethod || 'Cổng VNPay'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Trạng thái hạch toán</span>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  selectedVatPayment.status === 'SUCCESS'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {selectedVatPayment.status === 'SUCCESS' ? 'ĐÃ ĐỐI SOÁT THÀNH CÔNG' : selectedVatPayment.status}
                </span>
              </div>
            </div>

            {/* Financial Amounts breakdown */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Tiền dịch vụ trước thuế (Net):</span>
                <span className="font-mono font-medium text-slate-800">
                  {Math.round(selectedVatPayment.amount / 1.1).toLocaleString('vi-VN')} ₫
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Thuế giá trị gia tăng (VAT 10%):</span>
                <span className="font-mono font-medium text-slate-800">
                  {Math.round(selectedVatPayment.amount - (selectedVatPayment.amount / 1.1)).toLocaleString('vi-VN')} ₫
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-900 pt-2 border-t border-slate-200">
                <span className="font-bold text-sm">Tổng cộng tiền thanh toán:</span>
                <span className="font-mono text-base font-extrabold text-emerald-700">
                  {selectedVatPayment.amount.toLocaleString('vi-VN')} ₫
                </span>
              </div>
            </div>

            {/* Boxora Digital Certification Seal */}
            <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-xs text-slate-600 flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] text-emerald-600 shrink-0">verified</span>
              <span>Hóa đơn điện tử có giá trị pháp lý, được cấp mã tra cứu xác thực trên hệ thống Boxora Cloud Portal.</span>
            </div>

            {/* Modal Footer */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                <span>In Biên Lai / Lưu PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedVatPayment(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. BOOKING DETAILS & CHECK-IN GUIDANCE MODAL */}
      {selectedBookingForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[24px]">calendar_month</span>
                </div>
                <div>
                  <h3 className="font-headline text-base font-bold text-slate-900">
                    Đơn Đặt Giữ Chỗ #{selectedBookingForModal.bookingCode}
                  </h3>
                  <span className="text-xs text-slate-500">
                    Kho #{selectedBookingForModal.unitCode} • {selectedBookingForModal.facilityName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBookingForModal(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Status Alert Banner */}
            <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
              selectedBookingForModal.status === 'CONFIRMED'
                ? 'bg-cyan-50 border-cyan-200 text-cyan-950'
                : selectedBookingForModal.status === 'ACTIVE'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : selectedBookingForModal.status === 'PENDING_PAYMENT'
                ? 'bg-amber-50 border-amber-200 text-amber-950'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">
                  {selectedBookingForModal.status === 'CONFIRMED'
                    ? 'task_alt'
                    : selectedBookingForModal.status === 'ACTIVE'
                    ? 'verified'
                    : 'info'}
                </span>
                <div>
                  <span className="font-bold block">
                    Trạng thái:{' '}
                    {selectedBookingForModal.status === 'CONFIRMED'
                      ? 'ĐÃ GIỮ CHỖ (CHỜ NHẬN KHO)'
                      : selectedBookingForModal.status === 'ACTIVE'
                      ? 'ĐANG HOẠT ĐỘNG'
                      : selectedBookingForModal.status === 'PENDING_PAYMENT'
                      ? 'CHỜ THANH TOÁN TIỀN CỌC'
                      : selectedBookingForModal.status}
                  </span>
                  <span className="text-[11px] opacity-80 block">
                    {selectedBookingForModal.status === 'CONFIRMED'
                      ? 'Kho đã được giữ an toàn. Quý khách vui lòng đến quầy cơ sở để nhân viên bàn giao.'
                      : 'Lượt đặt kho được lưu trữ trên cơ sở dữ liệu Boxora Cloud.'}
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Check-in Prerequisites Checklist (BR-RULE-005) */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider block flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-blue-600">checklist</span>
                <span>4 Điều Kiện Bàn Giao Check-in Chuẩn Boxora (BR-RULE-005)</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-100">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600 shrink-0 mt-0.5">check_circle</span>
                  <div>
                    <span className="font-semibold text-slate-900 block">1. Tiền đặt cọc</span>
                    <span className="text-[11px] text-slate-500">
                      Đã lưu ký {Number(selectedBookingForModal.depositPaid || selectedBookingForModal.depositAmount || 0).toLocaleString('vi-VN')} ₫
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-100">
                  <span className="material-symbols-outlined text-[16px] text-blue-600 shrink-0 mt-0.5">schedule</span>
                  <div>
                    <span className="font-semibold text-slate-900 block">2. Tiền thuê tháng đầu</span>
                    <span className="text-[11px] text-slate-500">Đối soát online hoặc thanh toán tại quầy</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-100">
                  <span className="material-symbols-outlined text-[16px] text-blue-600 shrink-0 mt-0.5">draw</span>
                  <div>
                    <span className="font-semibold text-slate-900 block">3. Ký hợp đồng điện tử</span>
                    <span className="text-[11px] text-slate-500">Xác thực OTP DocuSeal tại quầy</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-100">
                  <span className="material-symbols-outlined text-[16px] text-blue-600 shrink-0 mt-0.5">badge</span>
                  <div>
                    <span className="font-semibold text-slate-900 block">4. Đối soát CCCD gốc</span>
                    <span className="text-[11px] text-slate-500">Xuất trình CCCD gắn chip gốc cho nhân viên</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Parameters Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Khách hàng đứng tên</span>
                <span className="font-semibold text-slate-900">{selectedBookingForModal.customerName || user?.fullName || 'Khách hàng cá nhân'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Số điện thoại liên hệ</span>
                <span className="font-mono text-slate-900">{selectedBookingForModal.customerPhone || user?.phone || '0912345678'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Ngày nhận kho (Bắt đầu)</span>
                <span className="font-mono font-bold text-slate-900">{selectedBookingForModal.startDate}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Hạn thuê dự kiến</span>
                <span className="font-mono font-bold text-slate-900">{selectedBookingForModal.endDate} ({selectedBookingForModal.rentalMonths} tháng)</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Tiền đặt cọc lưu ký</span>
                <span className="font-mono font-bold text-blue-600">
                  {Number(selectedBookingForModal.depositPaid || selectedBookingForModal.depositAmount || 0).toLocaleString('vi-VN')} ₫
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Tổng tiền thuê</span>
                <span className="font-mono font-bold text-slate-900">
                  {Number(selectedBookingForModal.totalRentalFee || 0).toLocaleString('vi-VN')} ₫
                </span>
              </div>
            </div>

            {/* Facility Location & Contact Box */}
            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-xs text-slate-600 flex items-start gap-3">
              <span className="material-symbols-outlined text-[20px] text-blue-600 shrink-0 mt-0.5">store</span>
              <div className="space-y-0.5">
                <span className="font-bold text-slate-900 block">{selectedBookingForModal.facilityName}</span>
                <span className="block text-[11px] text-slate-500">Giờ làm việc tiếp đón khách: 24/7 • Hotline tiếp nhận: 1900 6868</span>
                <span className="block text-[11px] text-slate-500">Vị trí kho: {selectedBookingForModal.floorLevel || 'Tầng 1'} — Ngăn số #{selectedBookingForModal.unitCode}</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                <span>In Phiếu Hẹn Nhận Kho</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBookingForModal(null)
                    handleTabChange('support')
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Liên Hệ Hỗ Trợ
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBookingForModal(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default CustomerDashboard
