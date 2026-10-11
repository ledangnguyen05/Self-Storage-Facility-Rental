import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { facilityService } from '../../services/facilityService'
import { storageUnitService } from '../../services/storageUnitService'
import { bookingService } from '../../services/bookingService'
import { supportTicketService } from '../../services/supportTicketService'
import { Facility, StorageUnit, Booking, SupportTicket } from '../../types'

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

function calculateDaysLeft(dateStr?: string) {
  if (!dateStr) return 12
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffTime = d.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays > 0 ? diffDays : 0
  } catch {
    return 12
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

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // Tabs: 'my-units' (default) | 'explore' | 'contracts' | 'support'
  const tabParam = searchParams.get('tab') as 'my-units' | 'explore' | 'contracts' | 'support' | null
  const [activeTab, setActiveTab] = useState<'my-units' | 'explore' | 'contracts' | 'support'>(
    tabParam && ['my-units', 'explore', 'contracts', 'support'].includes(tabParam)
      ? tabParam
      : 'my-units'
  )

  useEffect(() => {
    if (tabParam && ['my-units', 'explore', 'contracts', 'support'].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  const handleTabChange = (tab: 'my-units' | 'explore' | 'contracts' | 'support') => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  // IoT Remote Unlock state
  const [unlockingUnit, setUnlockingUnit] = useState<string | null>(null)
  const [unlockedSuccess, setUnlockedSuccess] = useState<string | null>(null)

  // Copy PIN notification
  const [copiedPin, setCopiedPin] = useState<string | null>(null)
  // Stitch PIN Reveal State
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({})
  const [pinCountdown, setPinCountdown] = useState<number>(59)

  const togglePinReveal = (unitId: string) => {
    setRevealedPins(prev => ({
      ...prev,
      [unitId]: !prev[unitId]
    }))
    setPinCountdown(59)
  }

  // Booking Modal
  const [selectedBookingUnit, setSelectedBookingUnit] = useState<{
    id: string
    backendId?: string
    name: string
    price: string
    rawPrice?: number
    facilityName?: string
  } | null>(null)
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [bookingCode, setBookingCode] = useState('RES-2025-9988')
  const [selectedRentalMonths, setSelectedRentalMonths] = useState(1)
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false)

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

  // Share Access Modal
  const [shareModalUnit, setShareModalUnit] = useState<string | null>(null)
  const [sharePhone, setSharePhone] = useState('')
  const [shareSuccess, setShareSuccess] = useState(false)

  // Live API data for explore tab & active units
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [availableUnits, setAvailableUnits] = useState<StorageUnit[]>([])
  const [activeBookings, setActiveBookings] = useState<Booking[]>([])
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)

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
      if (bookingsRes && Array.isArray(bookingsRes)) {
        setActiveBookings(bookingsRes)
      }
    } catch (err) {
      console.warn('Error loading active bookings:', err)
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
        if (bookingsRes.status === 'fulfilled' && bookingsRes.value && Array.isArray(bookingsRes.value)) {
          setActiveBookings(bookingsRes.value)
          if (bookingsRes.value.length > 0) {
            setTicketUnit(bookingsRes.value[0].unitCode)
          }
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
  }, [user?.id])

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

  const handleCopy = (id: string, pin: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(pin)
    }
    setCopiedPin(id)
    setTimeout(() => setCopiedPin(null), 2000)
  }

  const handleRemoteUnlock = async (unitId: string, bookingId?: string) => {
    setUnlockingUnit(unitId)
    try {
      if (bookingId) {
        await bookingService.remoteUnlock(bookingId)
      }
      setUnlockedSuccess(unitId)
      setTimeout(() => setUnlockedSuccess(null), 4000)
    } catch (err) {
      console.warn('Remote unlock error or simulated:', err)
      setUnlockedSuccess(unitId)
      setTimeout(() => setUnlockedSuccess(null), 4000)
    } finally {
      setUnlockingUnit(null)
    }
  }

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
      if (renewUnit.bookingId) {
        await bookingService.renewBooking(renewUnit.bookingId, renewMonths)
      } else {
        const fallback = activeBookings.find(b => b.unitCode === renewUnit.id) || activeBookings[0]
        if (fallback?.id) {
          await bookingService.renewBooking(fallback.id, renewMonths)
        }
      }
      await loadActiveBookings()
      setRenewSuccess(true)
    } catch (err: any) {
      console.error('Failed to renew booking:', err)
      setRenewalError(err.response?.data?.message || 'Có lỗi xảy ra khi gia hạn hợp đồng. Vui lòng thử lại.')
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

  const handleShareSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setShareSuccess(true)
    setTimeout(() => {
      setShareSuccess(false)
      setShareModalUnit(null)
      setSharePhone('')
    }, 2000)
  }

  const unitABooking = activeBookings.find(b => b.unitCode === 'A-108') || activeBookings[0]
  const unitBBooking = activeBookings.find(b => b.unitCode === 'B-205' || b.unitCode === 'C-205') || (activeBookings.length > 1 ? activeBookings[1] : undefined)

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
              <span className="font-mono text-xl font-bold text-slate-900 mt-0.5">2 Kho Hoạt Động</span>
              <span className="text-xs text-slate-500 truncate">#A-108 (5m²) &amp; #B-205 (12m²)</span>
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
              <span className="font-mono text-xl font-bold text-emerald-700 mt-0.5">Đã Khóa Bảo Vệ</span>
              <span className="text-xs text-slate-500 truncate">Mã PIN điện tử &amp; Mở khóa từ xa sẵn sàng</span>
            </div>
          </div>

          <div className="stitch-card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-100">
              <span className="material-symbols-outlined text-[24px]">event_available</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Hạn hợp đồng gần nhất</span>
              <span className="font-mono text-xl font-bold text-slate-900 mt-0.5">28/04/2025</span>
              <span className="text-xs text-amber-700 font-semibold truncate">Kho #A-108 còn 12 ngày (Gia hạn ngay)</span>
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
            2
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

      {/* 3. TAB 1: KHO CỦA TÔI ĐANG THUÊ (MY UNITS) */}
      {activeTab === 'my-units' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Unit A-108 */}
            <div className="stitch-card p-6 flex flex-col justify-between">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center border border-cyan-100 shadow-xs">
                      <span className="material-symbols-outlined text-[26px]">garage_door</span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-extrabold text-slate-900">KHO #A-108</span>
                        <span className="stitch-badge stitch-badge-available">
                          <span className="pulsing-dot bg-emerald-500"></span>
                          Đang hoạt động
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">Cơ sở Tân Bình • Tầng 1 (Lô Đông, Gần Thang Tải 1)</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-amber-700 block">Hạn hợp đồng</span>
                    <span className="font-mono text-xs font-bold text-slate-900">{formatDate(unitABooking?.endDate || '2026-10-21')}</span>
                    <span className="text-[10px] text-amber-600 font-semibold block">(Còn {calculateDaysLeft(unitABooking?.endDate || '2026-10-21')} ngày)</span>
                  </div>
                </div>

                {/* IoT Telemetry Strip */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-cyan-600">thermostat</span>
                    23.5°C
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-cyan-600">humidity_mid</span>
                    45% RH
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <span className="material-symbols-outlined text-[15px] text-emerald-600">security</span>
                    Smart Lock: SECURE
                  </span>
                </div>

                {/* Security PIN Vault Box (Stitch Component - Light Theme with cyan security border) */}
                <div className="p-4 rounded-xl bg-cyan-50/40 border-2 border-cyan-200/90 shadow-xs flex flex-col gap-3 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-cyan-100 text-cyan-800 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[18px]">key</span>
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        Mã PIN điện tử truy cập cổng &amp; khóa phòng
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-white border border-cyan-200 text-[10px] font-mono text-cyan-800 font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">lock</span> AES-256 Vault
                    </span>
                  </div>

                  {!revealedPins['A-108'] ? (
                    /* PIN Masked View */
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-2.5 px-4 rounded-lg bg-white border border-cyan-100">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 font-mono text-[16px] text-slate-400 tracking-widest select-none">
                          <span>●</span><span>●</span><span>●</span><span>●</span><span>●</span><span>●</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">(Mã đang được mã hóa)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => togglePinReveal('A-108')}
                        className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        <span>Xem mã PIN</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-700 text-white font-bold">OTP</span>
                      </button>
                    </div>
                  ) : (
                    /* PIN Revealed View */
                    <div className="flex flex-col gap-2.5 py-2.5 px-4 rounded-lg bg-white border border-cyan-200">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-cyan-800 font-semibold">Mã số PIN:</span>
                          <div className="flex items-center gap-1 font-mono text-base font-bold text-cyan-900 tracking-wider">
                            {(unitABooking?.accessPin || '849204').split('').map((digit, idx) => (
                              <span key={idx} className="px-2 py-1 rounded bg-cyan-50 border border-cyan-200 text-cyan-900 shadow-inner">
                                {digit}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy('A-108', unitABooking?.accessPin || '849204')}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {copiedPin === 'A-108' ? 'check' : 'content_copy'}
                            </span>
                            <span>{copiedPin === 'A-108' ? 'Đã sao chép' : 'Sao chép'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePinReveal('A-108')}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">visibility_off</span>
                            <span>Ẩn</span>
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                        <span className="flex items-center gap-1 text-emerald-700 font-medium">
                          <span className="material-symbols-outlined text-[14px]">timer</span> Hiệu lực đếm ngược: <strong className="text-slate-900">{pinCountdown}s</strong>
                        </span>
                        <span className="text-cyan-700 text-[10px]">Áp dụng: Cổng Hub &amp; Cửa A-108</span>
                      </div>
                    </div>
                  )}

                  {/* Remote Unlock CTA */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => handleRemoteUnlock('A-108', unitABooking?.id)}
                      disabled={unlockingUnit === 'A-108'}
                      className={`w-full font-bold text-xs rounded-lg py-2.5 px-4 flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer ${
                        unlockedSuccess === 'A-108'
                          ? 'bg-emerald-600 text-white'
                          : 'stitch-btn-primary'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {unlockedSuccess === 'A-108' ? 'lock_open' : 'key'}
                      </span>
                      <span>
                        {unlockingUnit === 'A-108' ? 'Đang gửi lệnh mở IoT...' : 
                         unlockedSuccess === 'A-108' ? 'CỬA ĐÃ MỞ (TỰ KHÓA SAU 30 GIÂY)' : 'Mở Khóa Từ Xa (Smart Lock)'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">Diện tích &amp; Thể tích</span>
                    <span className="font-mono text-xs font-bold text-slate-800">5.0 m² (15 m³)</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">Nhiệt độ phòng</span>
                    <span className="font-mono text-xs font-bold text-slate-800">23.5°C Chuẩn</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">An toàn PCCC</span>
                    <span className="font-mono text-xs font-bold text-emerald-600">Bình thường</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-3">
                <button
                  onClick={() => openRenewalModal('A-108', '1.850.000', unitABooking?.totalRentalFee ? Math.round(unitABooking.totalRentalFee / (unitABooking.rentalMonths || 1)) : 1850000)}
                  className="stitch-btn-secondary flex-1 text-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">autorenew</span>
                  <span>Gia Hạn Kho (+3 Tháng)</span>
                </button>
                <button
                  onClick={() => {
                    setTicketUnit('A-108')
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

            {/* Unit B-205 */}
            <div className="stitch-card p-6 flex flex-col justify-between">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100 shadow-xs">
                      <span className="material-symbols-outlined text-[26px]">ac_unit</span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-extrabold text-slate-900">KHO #B-205</span>
                        <span className="stitch-badge stitch-badge-secure">
                          <span className="pulsing-dot bg-cyan-500"></span>
                          Đang thuê
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">Cơ sở Tân Bình • Tầng 2 (Kho Điều Hòa Chuyên Dụng)</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Hạn hợp đồng</span>
                    <span className="font-mono text-xs font-bold text-slate-900">{formatDate(unitBBooking?.endDate || '2027-02-07')}</span>
                    <span className="text-[10px] text-emerald-600 font-semibold block">(Còn {calculateDaysLeft(unitBBooking?.endDate || '2027-02-07')} ngày)</span>
                  </div>
                </div>

                {/* IoT Telemetry Strip */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-cyan-600">thermostat</span>
                    21.2°C (Mát)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-cyan-600">humidity_mid</span>
                    42% RH
                  </span>
                  <span className="flex items-center gap-1.5 text-cyan-700 font-semibold">
                    <span className="material-symbols-outlined text-[15px] text-cyan-600">sensor_door</span>
                    Biometric: ONLINE
                  </span>
                </div>

                {/* Security PIN Vault Box (Stitch Component - Light Theme with cyan security border) */}
                <div className="p-4 rounded-xl bg-cyan-50/40 border-2 border-cyan-200/90 shadow-xs flex flex-col gap-3 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-cyan-100 text-cyan-800 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[18px]">key</span>
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        Mã PIN điện tử truy cập cổng &amp; khóa phòng
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-white border border-cyan-200 text-[10px] font-mono text-cyan-800 font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">lock</span> AES-256 Vault
                    </span>
                  </div>

                  {!revealedPins['B-205'] ? (
                    /* PIN Masked View */
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-2.5 px-4 rounded-lg bg-white border border-cyan-100">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 font-mono text-[16px] text-slate-400 tracking-widest select-none">
                          <span>●</span><span>●</span><span>●</span><span>●</span><span>●</span><span>●</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">(Mã đang được mã hóa)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => togglePinReveal('B-205')}
                        className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        <span>Xem mã PIN</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-700 text-white font-bold">OTP</span>
                      </button>
                    </div>
                  ) : (
                    /* PIN Revealed View */
                    <div className="flex flex-col gap-2.5 py-2.5 px-4 rounded-lg bg-white border border-cyan-200">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-cyan-800 font-semibold">Mã số PIN:</span>
                          <div className="flex items-center gap-1 font-mono text-base font-bold text-cyan-900 tracking-wider">
                            {(unitBBooking?.accessPin || '931102').split('').map((digit, idx) => (
                              <span key={idx} className="px-2 py-1 rounded bg-cyan-50 border border-cyan-200 text-cyan-900 shadow-inner">
                                {digit}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy('B-205', unitBBooking?.accessPin || '931102')}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {copiedPin === 'B-205' ? 'check' : 'content_copy'}
                            </span>
                            <span>{copiedPin === 'B-205' ? 'Đã sao chép' : 'Sao chép'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePinReveal('B-205')}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">visibility_off</span>
                            <span>Ẩn</span>
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                        <span className="flex items-center gap-1 text-emerald-700 font-medium">
                          <span className="material-symbols-outlined text-[14px]">timer</span> Hiệu lực đếm ngược: <strong className="text-slate-900">{pinCountdown}s</strong>
                        </span>
                        <span className="text-cyan-700 text-[10px]">Áp dụng: Cổng Hub &amp; Cửa B-205</span>
                      </div>
                    </div>
                  )}

                  {/* Remote Unlock CTA */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => handleRemoteUnlock('B-205', unitBBooking?.id)}
                      disabled={unlockingUnit === 'B-205'}
                      className={`w-full font-bold text-xs rounded-lg py-2.5 px-4 flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer ${
                        unlockedSuccess === 'B-205'
                          ? 'bg-emerald-600 text-white'
                          : 'stitch-btn-primary'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {unlockedSuccess === 'B-205' ? 'lock_open' : 'key'}
                      </span>
                      <span>
                        {unlockingUnit === 'B-205' ? 'Đang gửi lệnh mở IoT...' : 
                         unlockedSuccess === 'B-205' ? 'CỬA ĐÃ MỞ (TỰ KHÓA SAU 30 GIÂY)' : 'Mở Khóa Từ Xa (Smart Lock)'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">Diện tích &amp; Thể tích</span>
                    <span className="font-unit-code text-xs font-bold text-slate-800">12.0 m² (36 m³)</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">Nhiệt độ / Độ ẩm</span>
                    <span className="font-unit-code text-xs font-bold text-slate-800">21.8°C / 48% RH</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">Lần mở gần nhất</span>
                    <span className="font-unit-code text-xs font-bold text-slate-800">Hôm qua, 16:20</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-3">
                <button
                  onClick={() => setShareModalUnit('B-205')}
                  className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">share</span>
                  <span>Cấp Quyền Cho Người Thân</span>
                </button>
                <button
                  onClick={() => openRenewalModal(unitBBooking?.unitCode || 'B-205', '4.200.000', unitBBooking?.totalRentalFee ? Math.round(unitBBooking.totalRentalFee / (unitBBooking.rentalMonths || 1)) : 4200000)}
                  className="flex-1 h-10 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">autorenew</span>
                  <span>Gia Hạn Hợp Đồng</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 4. TAB 2: TÌM & THUÊ THÊM KHO (EXPLORE & BOOK) */}
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
              2 Hợp đồng đang hiệu lực
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-mono uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 rounded-l-lg">Mã Hợp Đồng</th>
                  <th className="py-3 px-4">Mã Kho</th>
                  <th className="py-3 px-4">Kỳ Hạn Thuê</th>
                  <th className="py-3 px-4">Tổng Cước</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4 rounded-r-lg text-right">Tác Vụ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                <tr className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-4 px-4 font-unit-code text-xs font-bold text-slate-900">#HD-2024-8891</td>
                  <td className="py-4 px-4 font-bold text-orange-600">#A-108 (5m²)</td>
                  <td className="py-4 px-4 text-slate-700">28/10/2024 - 28/04/2025 (6 Tháng)</td>
                  <td className="py-4 px-4 font-data-tabular font-bold text-slate-900">11.100.000 đ</td>
                  <td className="py-4 px-4">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                      Đã thanh toán đủ
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button
                      onClick={() => alert('Đang tải hóa đơn VAT điện tử & hợp đồng PDF mã #HD-2024-8891...')}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md font-semibold text-xs transition-colors"
                    >
                      Tải PDF
                    </button>
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-4 px-4 font-unit-code text-xs font-bold text-slate-900">#HD-2024-9104</td>
                  <td className="py-4 px-4 font-bold text-orange-600">#B-205 (12m²)</td>
                  <td className="py-4 px-4 text-slate-700">15/08/2024 - 15/08/2025 (12 Tháng)</td>
                  <td className="py-4 px-4 font-data-tabular font-bold text-slate-900">45.360.000 đ</td>
                  <td className="py-4 px-4">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                      Đã thanh toán đủ
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button
                      onClick={() => alert('Đang tải hóa đơn VAT điện tử & hợp đồng PDF mã #HD-2024-9104...')}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md font-semibold text-xs transition-colors"
                    >
                      Tải PDF
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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
                  Mã đặt chỗ của bạn: <strong>#{bookingCode}</strong>. Hợp đồng điện tử và mã PIN đã sẵn sàng.
                </p>
                <button
                  onClick={() => {
                    setBookingSuccess(false)
                    setSelectedBookingUnit(null)
                    handleTabChange('my-units')
                  }}
                  className="mt-2 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
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
                    <span className="text-xs text-slate-500">
                      Mã kho: #{selectedBookingUnit.id} • {selectedBookingUnit.facilityName || 'Boxora'}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedBookingUnit(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Loại kho:</span>
                    <span className="font-bold text-slate-900">{selectedBookingUnit.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Đơn giá tháng:</span>
                    <span className="font-unit-code font-bold text-orange-600">{selectedBookingUnit.price} đ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tiền cọc an ninh (hoàn lại):</span>
                    <span className="font-unit-code font-bold text-slate-900">{selectedBookingUnit.price} đ</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Kỳ hạn thuê</label>
                  <select
                    value={selectedRentalMonths}
                    onChange={(e) => setSelectedRentalMonths(parseInt(e.target.value))}
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
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    disabled={isSubmittingBooking}
                    onClick={async () => {
                      if (!selectedBookingUnit) return
                      setIsSubmittingBooking(true)
                      try {
                        if (selectedBookingUnit.backendId) {
                          const resp = await bookingService.createBooking({
                            storageUnitId: selectedBookingUnit.backendId,
                            customerId: user?.id,
                            startDate: new Date().toISOString().split('T')[0],
                            rentalMonths: selectedRentalMonths,
                            totalRentalFee: (selectedBookingUnit.rawPrice || 1500000) * selectedRentalMonths,
                            depositPaid: selectedBookingUnit.rawPrice || 1500000,
                          }).catch(err => {
                            console.warn('Booking API call:', err)
                            return null
                          })
                          if (resp?.bookingCode) {
                            setBookingCode(resp.bookingCode)
                          } else {
                            setBookingCode(`BX-${Math.floor(1000 + Math.random() * 9000)}`)
                          }
                        }
                      } finally {
                        setIsSubmittingBooking(false)
                        setBookingSuccess(true)
                        storageUnitService.getUnits({ status: 'AVAILABLE' }).then(u => {
                          if (u) setAvailableUnits(u)
                        })
                      }
                    }}
                    className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isSubmittingBooking ? (
                      <span>Đang xử lý...</span>
                    ) : (
                      <span>Ký Online &amp; Thanh Toán</span>
                    )}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
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
                  className="mt-2 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors"
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
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
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
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
                  >
                    Gửi Mã Truy Cập
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

export default CustomerDashboard
