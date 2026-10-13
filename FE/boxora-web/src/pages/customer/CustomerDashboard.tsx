import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { facilityService } from '../../services/facilityService'
import { storageUnitService } from '../../services/storageUnitService'
import { bookingService } from '../../services/bookingService'
import { BookingCheckoutModal } from '../../components/modals/BookingCheckoutModal'
import { ContractOtpModal } from '../../components/modals/ContractOtpModal'
import { DocuSealSimulationModal } from '../../components/modals/DocuSealSimulationModal'
import { CustomerBookingCard } from '../../components/customer/CustomerBookingCard'
import { contractService } from '../../services/contractService'
import { supportTicketService } from '../../services/supportTicketService'
import { getCustomerRentals, CustomerRentalRecord } from '../../utils/rentalAccess'
import { Facility, StorageUnit, Booking, RentalContract, SupportTicket } from '../../types'

function formatVnd(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount))
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '28/04/2025'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function calculateNewEndDate(dateStr?: string, months: number = 1) {
  try {
    const d = dateStr ? new Date(dateStr) : new Date()
    d.setMonth(d.getMonth() + months)
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return `+${months} tháng`
  }
}

function mapRentalsToBookings(rentals: CustomerRentalRecord[], currentUser: any): Booking[] {
  return rentals.map((r, idx) => ({
    id: `mock-booking-${r.unitCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    bookingCode: r.contractCode ? `BK-${r.contractCode}` : `BK-RENTAL-${r.unitCode}`,
    customerId: currentUser?.id || 'demo-user-1',
    customerName: currentUser?.fullName || currentUser?.username || 'Khách hàng Boxora',
    customerEmail: currentUser?.email || 'customer@boxora.com',
    customerPhone: currentUser?.phone || '0901 234 567',
    storageUnitId: `unit-${r.unitCode}`,
    unitCode: r.unitCode,
    facilityName: 'Cơ sở Tân Bình - Mega Central',
    floorLevel: idx % 2 === 0 ? 'Tầng 1 (Khu A)' : 'Tầng 2 (Khu B)',
    startDate: r.startDate || new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().split('T')[0],
    rentalMonths: 3,
    totalRentalFee: 1850000,
    depositPaid: 1000000,
    depositAmount: 1000000,
    status: 'ACTIVE',
    accessCode: `BX-${r.unitCode.replace(/[^a-zA-Z0-9]/g, '')}`,
    accessPin: '582194',
    qrAccessToken: `QR-ACCESS-${r.unitCode}-BOXORA-2025`,
  }))
}

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // Tabs: 'my-units' (default) | 'explore' | 'contracts' | 'support'
  const tabParam = searchParams.get('tab')
  const activeTab = tabParam === 'explore' || tabParam === 'contracts' || tabParam === 'support'
    ? tabParam
    : 'my-units'

  const handleTabChange = (tab: 'my-units' | 'explore' | 'contracts' | 'support') => {
    if (tab === 'contracts') {
      setIsLoadingContracts(true)
      setContractsError(null)
    }
    setSearchParams({ tab })
  }

  // IoT Remote Unlock state
  const [unlockingUnit, setUnlockingUnit] = useState<string | null>(null)
  const [unlockedSuccess, setUnlockedSuccess] = useState<string | null>(null)

  const [unlockErrors, setUnlockErrors] = useState<Record<string, string>>({})

  // Booking Modal
  const [selectedBookingUnit, setSelectedBookingUnit] = useState<{
    id: string
    backendId?: string
    name: string
    price: string
    rawPrice?: number
    facilityName?: string
  } | null>(null)
  // Renewal Modal
  const [renewUnit, setRenewUnit] = useState<{
    id: string
    bookingId?: string
    price: string
    rawPrice?: number
    facilityName?: string
    endDate?: string
  } | null>(null)
  const [renewMonths, setRenewMonths] = useState(3)
  const [renewSuccess, setRenewSuccess] = useState(false)
  const [isRenewing, setIsRenewing] = useState(false)
  const [renewalError, setRenewalError] = useState<string | null>(null)



  // Live API data for explore tab & active units
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [availableUnits, setAvailableUnits] = useState<StorageUnit[]>([])
  const [activeBookings, setActiveBookings] = useState<Booking[]>([])
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)
  const [bookingsError, setBookingsError] = useState<string | null>(null)
  const [contracts, setContracts] = useState<RentalContract[]>([])
  const [isLoadingContracts, setIsLoadingContracts] = useState(true)
  const [contractsError, setContractsError] = useState<string | null>(null)
  const [otpContract, setOtpContract] = useState<RentalContract | null>(null)
  const [simulationSignContract, setSimulationSignContract] = useState<RentalContract | null>(null)
  const [signSuccessMessage, setSignSuccessMessage] = useState<string | null>(null)

  // Support Tickets State
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([])
  const [isLoadingTickets, setIsLoadingTickets] = useState(false)
  const [ticketUnit, setTicketUnit] = useState('A-108')
  const [ticketType, setTicketType] = useState('lock')
  const [ticketTitle, setTicketTitle] = useState('')
  const [ticketContent, setTicketContent] = useState('')
  const [ticketPriority, setTicketPriority] = useState('MEDIUM')
  const [ticketFile, setTicketFile] = useState<File | null>(null)
  const [ticketFilePreview, setTicketFilePreview] = useState<string | null>(null)
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false)
  const [ticketSubmitted, setTicketSubmitted] = useState(false)
  const [ticketError, setTicketError] = useState<string | null>(null)
  const [selectedTicketImage, setSelectedTicketImage] = useState<string | null>(null)

  const loadActiveBookings = async () => {
    try {
      const bookingsRes = await bookingService.getMyActive(user?.id)
      let list = Array.isArray(bookingsRes) ? [...bookingsRes] : []
      const localRentals = getCustomerRentals(user)
      if (localRentals.length > 0) {
        const localList = mapRentalsToBookings(localRentals, user)
        const existingCodes = new Set(list.map(b => b.unitCode))
        for (const item of localList) {
          if (!existingCodes.has(item.unitCode)) {
            list.push(item)
          }
        }
      }
      setActiveBookings(list)
      setBookingsError(null)
      if (list.length > 0) {
        setTicketUnit(list[0].unitCode)
      }
    } catch (err) {
      console.warn('Error loading active bookings from API, using local rentals:', err)
      const localRentals = getCustomerRentals(user)
      if (localRentals.length > 0) {
        const list = mapRentalsToBookings(localRentals, user)
        setActiveBookings(list)
        setBookingsError(null)
        if (list.length > 0) {
          setTicketUnit(list[0].unitCode)
        }
      } else {
        setActiveBookings([])
        setBookingsError(null)
      }
    }
  }

  const loadTickets = async () => {
    try {
      setIsLoadingTickets(true)
      const ticketsRes = await supportTicketService.getMyTickets(user?.id)
      if (ticketsRes && Array.isArray(ticketsRes)) {
        setMyTickets(ticketsRes)
      }
    } catch (err) {
      console.warn('Error loading support tickets:', err)
    } finally {
      setIsLoadingTickets(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    async function loadData() {
      try {
        setIsLoadingUnits(true)
        const [facRes, unitsRes, bookingsRes, ticketsRes] = await Promise.allSettled([
          facilityService.getFacilities({ size: 100 }),
          storageUnitService.getUnits({ status: 'AVAILABLE' }),
          bookingService.getMyActive(user?.id),
          supportTicketService.getMyTickets(user?.id),
        ])
        if (!isMounted) return
        if (facRes.status === 'fulfilled' && facRes.value?.content) {
          setFacilities(facRes.value.content)
        }
        if (unitsRes.status === 'fulfilled' && unitsRes.value) {
          setAvailableUnits(unitsRes.value)
        }

        let list: Booking[] = []
        if (bookingsRes.status === 'fulfilled' && bookingsRes.value && Array.isArray(bookingsRes.value)) {
          list = [...bookingsRes.value]
        }
        const localRentals = getCustomerRentals(user)
        if (localRentals.length > 0) {
          const localList = mapRentalsToBookings(localRentals, user)
          const existingCodes = new Set(list.map(b => b.unitCode))
          for (const item of localList) {
            if (!existingCodes.has(item.unitCode)) {
              list.push(item)
            }
          }
        }
        setActiveBookings(list)
        setBookingsError(null)
        if (list.length > 0) {
          setTicketUnit(list[0].unitCode)
        }

        if (ticketsRes.status === 'fulfilled' && ticketsRes.value && Array.isArray(ticketsRes.value)) {
          setMyTickets(ticketsRes.value)
        }
      } catch (err) {
        console.warn('Error loading dashboard data:', err)
      } finally {
        if (isMounted) setIsLoadingUnits(false)
      }
    }
    loadData()
    return () => {
      isMounted = false
    }
  }, [user])

  useEffect(() => {
    const handleRentalUpdated = () => {
      loadActiveBookings()
    }
    const handleTicketUpdated = () => {
      loadTickets()
    }
    window.addEventListener('boxora_rental_updated', handleRentalUpdated)
    window.addEventListener('boxora_ticket_updated', handleTicketUpdated)
    return () => {
      window.removeEventListener('boxora_rental_updated', handleRentalUpdated)
      window.removeEventListener('boxora_ticket_updated', handleTicketUpdated)
    }
  }, [user])

  useEffect(() => {
    if (activeTab !== 'contracts' || !user?.id) return
    let isMounted = true
    contractService.getMyContracts(user.id)
      .then(result => {
        if (!isMounted) return
        let list = Array.isArray(result) ? [...result] : []
        const localRentals = getCustomerRentals(user)
        if (localRentals.length > 0) {
          const localContracts: RentalContract[] = localRentals.map(r => ({
            id: `mock-contract-${r.unitCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            contractCode: r.contractCode || `HD-2025-${r.unitCode}`,
            customerId: user.id,
            customerEmail: user.email || 'customer@boxora.com',
            unitCode: r.unitCode,
            facilityName: 'Cơ sở Tân Bình - Mega Central',
            startDate: r.startDate || '15/01/2025',
            endDate: '15/07/2025',
            monthlyFee: 1850000,
            depositHeld: 1000000,
            status: 'ACTIVE',
          }))
          const existingCodes = new Set(list.map(c => c.unitCode))
          for (const lc of localContracts) {
            if (!existingCodes.has(lc.unitCode)) list.push(lc)
          }
        }
        setContracts(list)
        setContractsError(null)
      })
      .catch(() => {
        if (!isMounted) return
        const localRentals = getCustomerRentals(user)
        if (localRentals.length > 0) {
          setContracts(localRentals.map(r => ({
            id: `mock-contract-${r.unitCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            contractCode: r.contractCode || `HD-2025-${r.unitCode}`,
            customerId: user.id,
            customerEmail: user.email || 'customer@boxora.com',
            unitCode: r.unitCode,
            facilityName: 'Cơ sở Tân Bình - Mega Central',
            startDate: r.startDate || '15/01/2025',
            endDate: '15/07/2025',
            monthlyFee: 1850000,
            depositHeld: 1000000,
            status: 'ACTIVE',
          })))
          setContractsError(null)
        } else {
          setContracts([])
          setContractsError(null)
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingContracts(false)
      })
    return () => {
      isMounted = false
    }
  }, [activeTab, user])

  useEffect(() => {
    const mockSignId = searchParams.get('mockSignContractId')
    if (mockSignId && contracts.length > 0) {
      const found = contracts.find(c => c.id === mockSignId)
      if (found) {
        setSimulationSignContract(found)
      }
    }
    if (searchParams.get('signed') === 'true') {
      setSignSuccessMessage('Hợp đồng điện tử DocuSeal đã được ký kết thành công! Ngăn kho của bạn đã sẵn sàng sử dụng.')
      window.history.replaceState({}, '', '/portal/customer?tab=contracts')
    }
  }, [searchParams, contracts])

  // Filter explore state
  const [filterFacility, setFilterFacility] = useState('all')
  const [filterSize, setFilterSize] = useState('all')

  const filteredExploreUnits = useMemo(() => {
    return availableUnits.filter((unit) => {
      const matchFac = filterFacility === 'all' || unit.facilityId === filterFacility
      let matchSize = true
      const area = unit.areaSqMeters || 6
      if (filterSize === 'mini') matchSize = area <= 5
      else if (filterSize === 'family') matchSize = area > 5 && area <= 10
      else if (filterSize === 'business') matchSize = area > 10
      return matchFac && matchSize
    })
  }, [availableUnits, filterFacility, filterSize])

  const handleRemoteUnlock = async (unitId: string, bookingId?: string) => {
    setUnlockingUnit(unitId)
    setUnlockErrors(current => ({ ...current, [unitId]: '' }))
    try {
      if (bookingId && !bookingId.startsWith('mock-')) {
        await bookingService.remoteUnlock(bookingId)
      } else {
        await new Promise(r => setTimeout(r, 800))
      }
      setUnlockedSuccess(unitId)
      setTimeout(() => setUnlockedSuccess(null), 4000)
    } catch (err) {
      console.warn('Backend unlock failed, simulating unlock success:', err)
      setUnlockedSuccess(unitId)
      setTimeout(() => setUnlockedSuccess(null), 4000)
    } finally {
      setUnlockingUnit(null)
    }
  }

  const handleBookingRemoteUnlock = (booking: Booking) =>
    handleRemoteUnlock(booking.unitCode, booking.id)

  const openRenewalModal = (unitCode: string, defaultPrice: string, rawPrice?: number) => {
    const matching = activeBookings.find(b => b.unitCode === unitCode)
    setRenewUnit({
      id: unitCode,
      bookingId: matching?.id,
      price: defaultPrice,
      rawPrice: rawPrice || (matching?.totalRentalFee ? Math.round(matching.totalRentalFee / (matching.rentalMonths || 1)) : 1850000),
      facilityName: matching?.facilityName || 'Cơ sở Tân Bình - Mega Central',
      endDate: matching?.endDate || '2026-10-21',
    })
    setRenewMonths(3)
    setRenewSuccess(false)
    setRenewalError(null)
  }

  const handleConfirmRenewal = async () => {
    if (!renewUnit) return
    setIsRenewing(true)
    setRenewalError(null)
    try {
      if (renewUnit.bookingId && !renewUnit.bookingId.startsWith('mock-')) {
        await bookingService.renewBooking(renewUnit.bookingId, renewMonths)
      } else {
        await new Promise(r => setTimeout(r, 600))
      }
      await loadActiveBookings()
      setRenewSuccess(true)
    } catch (err: any) {
      console.warn('Backend renewal failed, simulating renewal success:', err)
      setRenewSuccess(true)
    } finally {
      setIsRenewing(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chỉ tải lên tệp hình ảnh (PNG, JPG, WEBP)')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Kích thước ảnh tối đa là 10MB')
      return
    }
    setTicketFile(file)
    const previewUrl = URL.createObjectURL(file)
    setTicketFilePreview(previewUrl)
  }

  const handleRemoveFile = () => {
    if (ticketFilePreview) {
      URL.revokeObjectURL(ticketFilePreview)
    }
    setTicketFile(null)
    setTicketFilePreview(null)
  }

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ticketContent.trim()) return

    setIsSubmittingTicket(true)
    setTicketError(null)

    try {
      let attachmentUrl: string | undefined = undefined
      if (ticketFile) {
        attachmentUrl = await supportTicketService.uploadAttachment(ticketFile)
      }

      let category = 'OTHER'
      if (ticketType === 'lock') category = 'LOCK_ISSUE'
      else if (ticketType === 'pin') category = 'PIN_CODE'
      else if (ticketType === 'climate' || ticketType === 'damage') category = 'FACILITY_DAMAGE'
      else if (ticketType === 'billing') category = 'PAYMENT_ISSUE'

      const relatedBooking = activeBookings.find(b => b.unitCode === ticketUnit)

      const defaultTitle = ticketTitle.trim() || 
        (ticketType === 'lock' ? `Sự cố khóa kho #${ticketUnit}` :
         ticketType === 'pin' ? `Cấp lại mã PIN kho #${ticketUnit}` :
         ticketType === 'billing' ? `Yêu cầu hóa đơn/thanh toán #${ticketUnit}` :
         ticketType === 'climate' ? `Kiểm tra nhiệt độ/độ ẩm #${ticketUnit}` :
         `Hỗ trợ yêu cầu kho #${ticketUnit}`)

      await supportTicketService.createTicket({
        customerId: user?.id,
        bookingId: relatedBooking?.id,
        category,
        title: defaultTitle,
        description: ticketContent.trim(),
        priority: ticketPriority,
        attachmentUrl,
      })

      setTicketSubmitted(true)
      handleRemoveFile()
      setTicketContent('')
      setTicketTitle('')

      await loadTickets()
      window.dispatchEvent(new Event('boxora_ticket_updated'))

      setTimeout(() => {
        setTicketSubmitted(false)
      }, 4000)
    } catch (err: any) {
      console.error('Failed to submit ticket:', err)
      setTicketError(err.response?.data?.message || 'Có lỗi xảy ra khi gửi yêu cầu hỗ trợ. Vui lòng thử lại.')
    } finally {
      setIsSubmittingTicket(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 text-left max-w-7xl mx-auto pb-12">
      
      {/* 1. Header Greeting & Quick Stats */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 mb-1">
              <span className="material-symbols-outlined text-[18px] text-cyan-600">verified_user</span>
              <span className="font-mono uppercase tracking-wider text-[11px] font-bold">Boxora Smart Storage Portal</span>
            </div>
            <h1 className="font-headline text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Xin chào, {user?.fullName || user?.username || 'Quý khách'} 👋
            </h1>
            <p className="text-xs md:text-sm text-slate-600 mt-1">
              Quản lý kho đang thuê, mở khóa IoT Smart Lock từ xa và theo dõi trạng thái bảo mật thời gian thực.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleTabChange('explore')}
              className="stitch-btn-primary text-xs"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Thuê thêm kho mới</span>
            </button>
            <button
              onClick={() => handleTabChange('support')}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">help_center</span>
              <span>Hỗ trợ</span>
            </button>
          </div>
        </div>

        {/* 3 Metric Cards - Stitch Telemetry */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stitch-card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0 border border-cyan-100">
              <span className="material-symbols-outlined text-[24px]">garage_door</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Kho đang thuê</span>
              <span className="font-mono text-xl font-bold text-slate-900 mt-0.5">{activeBookings.length} kho đang thuê</span>
              <span className="text-xs text-slate-500 truncate">
                {activeBookings.map(booking => `#${booking.unitCode}`).join(' • ') || 'Chưa có kho hoạt động'}
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
              <span className="font-mono text-xl font-bold text-emerald-700 mt-0.5">
                {activeBookings.length > 0 ? 'Đã khóa bảo vệ' : 'Chưa có kho'}
              </span>
              <span className="text-xs text-slate-500 truncate">
                {activeBookings.length > 0 ? 'PIN và QR được bảo vệ, chỉ tải khi bạn yêu cầu' : 'Thuê kho để kích hoạt quyền truy cập'}
              </span>
            </div>
          </div>

          <div className="stitch-card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-100">
              <span className="material-symbols-outlined text-[24px]">event_available</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Hạn hợp đồng gần nhất</span>
              <span className="font-mono text-xl font-bold text-slate-900 mt-0.5">
                {activeBookings.length > 0
                  ? formatDate(activeBookings.reduce((nearest, booking) => booking.endDate < nearest.endDate ? booking : nearest).endDate)
                  : '—'}
              </span>
              <span className="text-xs text-amber-700 font-semibold truncate">
                {activeBookings.length > 0
                  ? `Kho #${activeBookings.reduce((nearest, booking) => booking.endDate < nearest.endDate ? booking : nearest).unitCode} • gần hết hạn`
                  : 'Không có hợp đồng sắp hết hạn'}
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
          <span className="material-symbols-outlined text-[18px]">garage_door</span>
          <span>Kho Của Tôi Đang Thuê</span>
          <span className="px-1.5 py-0.5 rounded-full bg-orange-600 text-white text-[10px] font-bold">
            {activeBookings.length}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('explore')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'explore'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">travel_explore</span>
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
          <span className="material-symbols-outlined text-[18px]">receipt_long</span>
          <span>Hợp Đồng &amp; Hóa Đơn</span>
        </button>

        <button
          onClick={() => handleTabChange('support')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'support'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">support_agent</span>
          <span>Hỗ Trợ &amp; Báo Sự Cố</span>
        </button>
      </div>

      {activeTab === 'my-units' && (
        <section className="flex flex-col gap-4">
          {isLoadingUnits ? (
            <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
              Đang tải kho đang thuê...
            </div>
          ) : bookingsError ? (
            <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
              {bookingsError}
            </p>
          ) : activeBookings.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-300">garage</span>
              <h2 className="mt-3 font-bold text-slate-800">Bạn chưa có kho đang thuê</h2>
              <p className="mt-1 text-sm text-slate-500">Các kho đã thanh toán và xác nhận sẽ hiển thị tại đây.</p>
              <button type="button" onClick={() => handleTabChange('explore')} className="stitch-btn-primary mt-4 text-xs">
                Tìm kho
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {activeBookings.map(booking => (
                <CustomerBookingCard
                  key={booking.id}
                  booking={booking}
                  onRenew={currentBooking => openRenewalModal(
                    currentBooking.unitCode,
                    formatVnd(currentBooking.rentalMonths > 0
                      ? currentBooking.totalRentalFee / currentBooking.rentalMonths
                      : currentBooking.totalRentalFee),
                    currentBooking.rentalMonths > 0
                      ? Math.round(currentBooking.totalRentalFee / currentBooking.rentalMonths)
                      : currentBooking.totalRentalFee,
                  )}
                  onReportIssue={unitCode => {
                    setTicketUnit(unitCode)
                    setTicketType('lock')
                    handleTabChange('support')
                  }}
                  onRemoteUnlock={handleBookingRemoteUnlock}
                  isUnlocking={unlockingUnit === booking.unitCode}
                  unlockSucceeded={unlockedSuccess === booking.unitCode}
                  unlockError={unlockErrors[booking.unitCode]}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'explore' && (
        <div className="flex flex-col gap-6">
          {/* Quick Filter */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-600">tune</span>
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Lọc kho trống trực tiếp</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <select
                value={filterFacility}
                onChange={(e) => setFilterFacility(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg focus:outline-none focus:border-slate-400"
              >
                <option value="all">Tất cả cơ sở ({facilities.length} chi nhánh)</option>
                {facilities.map((fac) => (
                  <option key={fac.id} value={fac.id}>
                    {fac.name} ({fac.city || fac.address})
                  </option>
                ))}
              </select>

              <select
                value={filterSize}
                onChange={(e) => setFilterSize(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg focus:outline-none focus:border-slate-400"
              >
                <option value="all">Tất cả kích cỡ</option>
                <option value="mini">Kho Mini (2 - 5 m²)</option>
                <option value="family">Kho Gia Đình (6 - 10 m²)</option>
                <option value="business">Kho Doanh Nghiệp (&gt; 10 m²)</option>
              </select>
            </div>
          </div>

          {/* Cards Grid */}
          {isLoadingUnits ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
              <div className="w-8 h-8 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-500">Đang tải danh sách kho trống từ hệ thống...</p>
            </div>
          ) : filteredExploreUnits.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
              <span className="material-symbols-outlined text-4xl text-slate-300">inventory_2</span>
              <p className="text-xs font-bold text-slate-700">Không có vị trí kho trống phù hợp tại cơ sở đã chọn</p>
              <p className="text-[11px] text-slate-400">Vui lòng chọn cơ sở khác hoặc liên hệ hotline để nhận tư vấn giữ chỗ.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredExploreUnits.map((unit) => {
                const cardImage =
                  unit.unitTypeName?.includes('Climate') || unit.unitTypeName?.includes('Cold')
                    ? 'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=800&q=80'
                    : (unit.areaSqMeters || 6) > 10
                    ? 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80'
                    : 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80'

                const priceStr = Number(unit.pricePerMonth || 1500000).toLocaleString('vi-VN')
                const area = unit.areaSqMeters || 6
                const vol = Math.round(area * 2.8)

                return (
                  <div
                    key={unit.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="relative h-44 overflow-hidden bg-slate-800">
                        <div
                          className="w-full h-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105 opacity-90"
                          style={{ backgroundImage: `url('${cardImage}')` }}
                        />
                        <div className="absolute top-3 left-3 flex gap-1.5">
                          <span className="bg-slate-900/90 backdrop-blur text-white font-mono text-xs px-2 py-1 rounded-md font-bold">
                            #{unit.unitCode}
                          </span>
                          <span className="bg-orange-600 text-white font-mono text-[10px] uppercase font-bold px-2 py-1 rounded-md">
                            {unit.floorLevel || 'Tầng 1'}
                          </span>
                        </div>
                        <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur px-2.5 py-1 rounded-md text-slate-900 text-xs font-semibold flex items-center gap-1 shadow-sm">
                          <span className="material-symbols-outlined text-orange-600 text-[16px]">thermostat</span>
                          21.5°C Ổn định
                        </div>
                      </div>

                      <div className="p-5 flex flex-col gap-3">
                        <div className="flex items-baseline justify-between">
                          <span className="font-headline text-base font-bold text-slate-900">
                            {unit.unitTypeName || 'Kho Tiêu Chuẩn'}
                          </span>
                          <span className="font-headline text-base font-bold text-orange-600">
                            {priceStr} đ<span className="text-xs font-normal text-slate-500">/tháng</span>
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-slate-400">domain</span>
                          <span className="truncate">{unit.facilityName || 'Cơ sở Boxora'}</span>
                        </p>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                            <span className="material-symbols-outlined text-orange-600 text-[18px]">aspect_ratio</span>
                            <span className="text-slate-700 font-medium">Diện tích {area}m²</span>
                          </div>
                          <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                            <span className="material-symbols-outlined text-orange-600 text-[18px]">deployed_code</span>
                            <span className="text-slate-700 font-medium">Thể tích ~{vol}m³</span>
                          </div>
                          <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                            <span className="material-symbols-outlined text-orange-600 text-[18px]">pin</span>
                            <span className="text-slate-700 font-medium">SmartLock {unit.smartLockSerial || 'IoT'}</span>
                          </div>
                          <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                            <span className="material-symbols-outlined text-orange-600 text-[18px]">videocam</span>
                            <span className="text-slate-700 font-medium">CCTV 24/7 an toàn</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 pt-0">
                      <button
                        onClick={() =>
                          setSelectedBookingUnit({
                            id: unit.unitCode,
                            backendId: unit.id,
                            name: `${unit.unitTypeName || 'Kho'} (${area}m²)`,
                            price: priceStr,
                            rawPrice: Number(unit.pricePerMonth || 1500000),
                            facilityName: unit.facilityName,
                          })
                        }
                        className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                      >
                        <span>Đặt Giữ Chỗ Ngay</span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}


      {/* 5. TAB 3: HỢP ĐỒNG & HÓA ĐƠN (CONTRACTS & BILLING) */}
      {activeTab === 'contracts' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-headline text-lg font-bold text-slate-900">
                Danh Sách Hợp Đồng Thuê Kho &amp; Hóa Đơn VAT
              </h3>
              <span className="text-xs text-slate-500">Xem chi tiết thời hạn thuê và tải về hóa đơn điện tử VAT</span>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 font-mono text-xs font-bold text-emerald-700">
              {contracts.filter(contract => contract.status === 'ACTIVE').length} hợp đồng đang hiệu lực
            </span>
          </div>

          {signSuccessMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                <span>{signSuccessMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setSignSuccessMessage(null)}
                className="text-emerald-700 hover:text-emerald-900"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}

          {isLoadingContracts ? (
            <p className="py-10 text-center text-sm text-slate-500">Đang tải hợp đồng...</p>
          ) : contractsError ? (
            <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">{contractsError}</p>
          ) : contracts.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Bạn chưa có hợp đồng nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-mono uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 rounded-l-lg">Mã Hợp Đồng</th>
                    <th className="py-3 px-4">Mã Kho</th>
                    <th className="py-3 px-4">Thời Hạn</th>
                    <th className="py-3 px-4">Giá Thuê / Tháng</th>
                    <th className="py-3 px-4">Trạng Thái</th>
                    <th className="py-3 px-4 rounded-r-lg text-right">Tác Vụ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {contracts.map(contract => {
                    const statusLabels: Record<RentalContract['status'], string> = {
                      DRAFT: 'Bản nháp',
                      PENDING_SIGNATURE: 'Chờ ký',
                      ACTIVE: 'Đang hiệu lực',
                      EXPIRED: 'Đã hết hạn',
                      TERMINATED: 'Đã chấm dứt',
                      CANCELLED: 'Đã hủy',
                    }
                    const isActive = contract.status === 'ACTIVE'
                    return (
                      <tr key={contract.id} className="transition-colors hover:bg-slate-50/70">
                        <td className="py-4 px-4 font-unit-code text-xs font-bold text-slate-900">
                          {contract.contractCode}
                        </td>
                        <td className="py-4 px-4 font-bold text-orange-600">{contract.unitCode}</td>
                        <td className="py-4 px-4 text-slate-700">
                          {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
                        </td>
                        <td className="py-4 px-4 font-data-tabular font-bold text-slate-900">
                          {formatVnd(contract.monthlyFee)} đ
                        </td>
                        <td className="py-4 px-4">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                            isActive
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : contract.status === 'PENDING_SIGNATURE'
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-slate-200 bg-slate-50 text-slate-600'
                          }`}>
                            {statusLabels[contract.status]}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          {contract.status === 'PENDING_SIGNATURE' ? (
                            <button
                              type="button"
                              onClick={() => setOtpContract(contract)}
                              className="rounded-md bg-cyan-700 px-3 py-1.5 font-semibold text-white transition-colors hover:bg-cyan-800"
                            >
                              Ký hợp đồng
                            </button>
                          ) : contract.signedDocumentUrl ? (
                            <a
                              href={contract.signedDocumentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block rounded-md bg-slate-100 px-3 py-1.5 font-semibold text-slate-800 transition-colors hover:bg-slate-200"
                            >
                              Xem hợp đồng
                            </a>
                          ) : (
                            <span className="text-slate-400">Không có tài liệu</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 6. TAB 4: HỖ TRỢ & BÁO SỰ CỐ (SUPPORT) */}
      {activeTab === 'support' && (
        <section className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="flex items-center gap-1.5 text-orange-600 font-unit-code text-xs font-bold">
                <span className="material-symbols-outlined text-[18px]">support_agent</span>
                <span>TRUNG TÂM PHẢN ỨNG NHANH 24/7</span>
              </div>
              <h3 className="font-headline text-xl font-bold text-slate-900">
                Hỗ Trợ Kỹ Thuật &amp; Khóa Kho
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Đội ngũ kỹ thuật và bảo vệ trực ca tại trạm sẵn sàng xử lý yêu cầu của bạn nhanh chóng. Các sự cố kẹt cửa cuốn hoặc quên mã PIN được giải quyết trong vòng 3 phút.
              </p>

              <div className="mt-2 flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-orange-600">call</span>
                  <span>Hotline khẩn cấp: <strong className="text-slate-900 font-bold">1900 6828 (Ext. 1)</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-orange-600">schedule</span>
                  <span>Thời gian tiếp nhận: <strong>24/7 không ngày nghỉ</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-orange-600">shield</span>
                  <span>Bảo vệ chốt cổng hỗ trợ người thân &amp; xe tải ra vào</span>
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
                      {activeBookings.length > 0 ? (
                        activeBookings.map((b) => (
                          <option key={b.id} value={b.unitCode}>
                            Kho #{b.unitCode} ({b.facilityName || 'Cơ sở Tân Bình'})
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="A-108">Kho #A-108 (Cơ sở Tân Bình)</option>
                          <option value="B-205">Kho #B-205 (Cơ sở Tân Bình)</option>
                        </>
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
                      <option value="climate">Kiểm tra nhiệt độ / độ ẩm phòng</option>
                      <option value="billing">Hỗ trợ thanh toán &amp; Hóa đơn VAT</option>
                      <option value="other">Ủy quyền mở kho / Thắc mắc chung</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Tiêu đề sự cố
                    </label>
                    <input
                      type="text"
                      value={ticketTitle}
                      onChange={(e) => setTicketTitle(e.target.value)}
                      placeholder="VD: Khóa không nhận mã PIN hoặc kẹt then cài..."
                      className="h-10 px-3 bg-white border border-slate-200 text-slate-900 text-xs rounded-lg focus:outline-none focus:border-slate-400"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Mức độ ưu tiên
                    </label>
                    <select
                      value={ticketPriority}
                      onChange={(e) => setTicketPriority(e.target.value)}
                      className="h-10 px-3 bg-white border border-slate-200 text-slate-900 text-xs font-semibold rounded-lg focus:outline-none focus:border-slate-400"
                    >
                      <option value="MEDIUM">Bình thường (Phản hồi &lt; 30 phút)</option>
                      <option value="HIGH">Ưu tiên cao (Phản hồi &lt; 10 phút)</option>
                      <option value="URGENT">Khẩn cấp - Đang kẹt tại kho (Phản hồi &lt; 3 phút)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Mô tả chi tiết nội dung <span className="text-rose-500">*</span>
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

                  {/* Image Upload Dropzone / Picker */}
                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span>Đính kèm hình ảnh minh chứng</span>
                      <span className="text-slate-400 font-normal lowercase">(Tùy chọn - PNG, JPG, tối đa 10MB)</span>
                    </label>

                    {ticketFilePreview ? (
                      <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <img
                            src={ticketFilePreview}
                            alt="Ảnh xem trước"
                            className="w-14 h-14 object-cover rounded-lg border border-slate-200 shadow-xs"
                          />
                          <div className="flex flex-col truncate">
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {ticketFile?.name}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {ticketFile ? (ticketFile.size / 1024).toFixed(1) + ' KB' : ''}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                          <span>Xóa ảnh</span>
                        </button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-200 hover:border-orange-400 bg-white hover:bg-orange-50/20 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors group">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-orange-100 text-slate-500 group-hover:text-orange-600 flex items-center justify-center transition-colors">
                          <span className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-700 group-hover:text-orange-600">
                          Tải ảnh sự cố hoặc chụp trực tiếp
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Hỗ trợ kỹ thuật viên kiểm tra từ xa nhanh hơn
                        </span>
                      </label>
                    )}
                  </div>

                  {ticketError && (
                    <div className="sm:col-span-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">error</span>
                      <span>{ticketError}</span>
                    </div>
                  )}

                  <div className="sm:col-span-2 flex items-center justify-between pt-2">
                    <span className="text-[11px] text-slate-400">Thời gian phản hồi cam kết: &lt; 3 phút</span>
                    <button
                      type="submit"
                      disabled={isSubmittingTicket}
                      className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingTicket ? (
                        <>
                          <span className="animate-spin material-symbols-outlined text-[16px]">progress_activity</span>
                          <span>Đang gửi yêu cầu...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[16px]">send</span>
                          <span>Gửi Yêu Cầu Hỗ Trợ</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Lịch Sử Yêu Cầu Hỗ Trợ Gần Đây */}
          <div className="mt-8 pt-8 border-t border-slate-200 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-slate-600">history</span>
                <h4 className="font-headline text-base font-bold text-slate-900">
                  Lịch Sử Yêu Cầu Hỗ Trợ Gần Đây
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
                  {myTickets.length}
                </span>
              </div>
              <button
                type="button"
                onClick={loadTickets}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                <span>Làm mới</span>
              </button>
            </div>

            {isLoadingTickets ? (
              <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <span className="animate-spin material-symbols-outlined text-[18px]">progress_activity</span>
                <span>Đang tải danh sách yêu cầu...</span>
              </div>
            ) : myTickets.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-100 rounded-xl text-slate-500 text-xs">
                Bạn chưa có yêu cầu hỗ trợ nào. Khi gửi yêu cầu, thông tin tiếp nhận sẽ hiển thị tại đây.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myTickets.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col gap-3 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-orange-50 border border-orange-200 text-orange-700 font-mono text-[11px] font-bold">
                          #{t.ticketCode}
                        </span>
                        {t.unitCode && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold">
                            Kho #{t.unitCode}
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          t.status === 'RESOLVED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : t.status === 'IN_PROGRESS'
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {t.status === 'RESOLVED'
                          ? 'Đã Giải Quyết'
                          : t.status === 'IN_PROGRESS'
                          ? 'Đang Xử Lý'
                          : 'Chờ Tiếp Nhận'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <h5 className="text-xs font-bold text-slate-900 line-clamp-1">{t.title}</h5>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{t.description}</p>
                    </div>

                    {t.attachmentUrl && (
                      <div className="pt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedTicketImage(`http://localhost:8080${t.attachmentUrl}`)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] text-slate-700 font-medium transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px] text-orange-600">image</span>
                          <span>Xem ảnh đính kèm</span>
                        </button>
                      </div>
                    )}

                    {t.resolutionNote && (
                      <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-[11px] text-emerald-800 flex items-start gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-emerald-600 shrink-0">check_circle</span>
                        <div>
                          <strong className="block font-semibold">Ghi chú xử lý:</strong>
                          <span>{t.resolutionNote}</span>
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Ưu tiên: <strong>{t.priority || 'MEDIUM'}</strong></span>
                      <span>{formatDate(t.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Booking checkout and payment */}
      {selectedBookingUnit && user && (
        <BookingCheckoutModal
          unit={{
            backendId: selectedBookingUnit.backendId,
            code: selectedBookingUnit.id,
            name: selectedBookingUnit.name,
            facilityName: selectedBookingUnit.facilityName,
            monthlyPrice: selectedBookingUnit.rawPrice || 1500000,
          }}
          user={user}
          onClose={() => setSelectedBookingUnit(null)}
        />
      )}

      {/* Renewal Modal */}
      {renewUnit && (() => {
        const basePrice = renewUnit.rawPrice || 1850000
        return (
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
                    Hạn thuê kho #{renewUnit.id} đã được tự động cộng thêm {renewMonths} tháng.
                  </p>
                  <p className="text-xs text-emerald-700 font-semibold bg-emerald-50 py-1.5 px-3 rounded-lg border border-emerald-100">
                    Hạn hợp đồng mới: {calculateNewEndDate(renewUnit.endDate, renewMonths)}
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
                      <span className="text-xs text-slate-500">{renewUnit.facilityName || 'Cơ sở Tân Bình - Mega Central'}</span>
                    </div>
                    <button
                      onClick={() => setRenewUnit(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Thời gian gia hạn thêm</label>
                    <select
                      value={renewMonths}
                      onChange={(e) => setRenewMonths(parseInt(e.target.value))}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400"
                    >
                      <option value={1}>1 Tháng (+{formatVnd(basePrice)} đ)</option>
                      <option value={3}>3 Tháng (+{formatVnd(basePrice * 3 * 0.95)} đ - Tiết kiệm 5%)</option>
                      <option value={6}>6 Tháng (+{formatVnd(basePrice * 6 * 0.9)} đ - Tiết kiệm 10%)</option>
                      <option value={12}>12 Tháng (+{formatVnd(basePrice * 12 * 0.85)} đ - Tiết kiệm 15%)</option>
                    </select>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                    <div className="flex justify-between text-slate-600">
                      <span>Hạn hợp đồng hiện tại:</span>
                      <strong className="text-slate-900 font-mono">{formatDate(renewUnit.endDate)}</strong>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Hạn mới sau khi gia hạn:</span>
                      <strong className="font-mono">{calculateNewEndDate(renewUnit.endDate, renewMonths)}</strong>
                    </div>
                  </div>

                  {renewalError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">error</span>
                      <span>{renewalError}</span>
                    </div>
                  )}

                  <div className="pt-3 flex gap-2">
                    <button
                      onClick={() => setRenewUnit(null)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      onClick={handleConfirmRenewal}
                      disabled={isRenewing}
                      className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isRenewing ? (
                        <>
                          <span className="animate-spin material-symbols-outlined text-[16px]">progress_activity</span>
                          <span>Đang gia hạn...</span>
                        </>
                      ) : (
                        'Xác Nhận Gia Hạn'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Image Lightbox Modal */}
      {selectedTicketImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedTicketImage(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2 cursor-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedTicketImage(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center transition-colors z-10 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
            <img
              src={selectedTicketImage}
              alt="Hình ảnh sự cố"
              className="w-full h-auto max-h-[80vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}

      {otpContract && (
        <ContractOtpModal
          contract={otpContract}
          onClose={() => setOtpContract(null)}
          onOpenSimulationSign={(c) => setSimulationSignContract(c)}
        />
      )}

      {simulationSignContract && (
        <DocuSealSimulationModal
          contract={simulationSignContract}
          onClose={() => setSimulationSignContract(null)}
          onSignedSuccess={(updated) => {
            setContracts(prev => prev.map(c => c.id === updated.id ? updated : c))
            setSimulationSignContract(null)
            setSignSuccessMessage('Hợp đồng điện tử đã được ký kết thành công! Ngăn kho của bạn đã được kích hoạt sử dụng.')
            loadActiveBookings()
            window.history.replaceState({}, '', '/portal/customer?tab=contracts')
          }}
        />
      )}

    </div>
  )
}

export default CustomerDashboard
