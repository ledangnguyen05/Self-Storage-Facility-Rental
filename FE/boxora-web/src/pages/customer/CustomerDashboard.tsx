import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { contractService, RentalContract } from '../../services/contractService'
import { bookingService } from '../../services/bookingService'
import { storageUnitService } from '../../services/storageUnitService'
import { supportTicketService, SupportTicketCategory } from '../../services/supportTicketService'
import { Booking, StorageUnit } from '../../types'

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

  const activeContracts = contracts.filter(c => c.status === 'ACTIVE')
  const nearestEndDateValue = activeContracts
    .map(c => c.endDate)
    .filter(Boolean)
    .sort()[0] || '--'
  const nearestEndDate = nearestEndDateValue === '--'
    ? '--'
    : new Date(`${nearestEndDateValue.slice(0, 10)}T00:00:00`).toLocaleDateString('vi-VN')

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
  const [unlockError, setUnlockError] = useState<string | null>(null)

  // Copy PIN notification
  const [copiedPin, setCopiedPin] = useState<string | null>(null)
  // Stitch PIN Reveal State
  const [revealedPins, setRevealedPins] = useState<Record<string, string>>({})
  const [loadingPinUnit, setLoadingPinUnit] = useState<string | null>(null)
  const [pinErrors, setPinErrors] = useState<Record<string, string>>({})

  // Booking Modal
  const [selectedBookingUnit, setSelectedBookingUnit] = useState<StorageUnit | null>(null)
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [bookingResult, setBookingResult] = useState<Booking | null>(null)
  const [bookingMonths, setBookingMonths] = useState(1)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false)

  // Renewal Modal
  const [renewUnit, setRenewUnit] = useState<{ id: string; contractId: string; price: string } | null>(null)
  const [renewMonths, setRenewMonths] = useState(3)
  const [renewSuccess, setRenewSuccess] = useState(false)
  const [renewSigningUrl, setRenewSigningUrl] = useState<string | null>(null)
  const [renewError, setRenewError] = useState<string | null>(null)
  const [isRenewing, setIsRenewing] = useState(false)

  // Share Access Modal
  const [shareModalUnit, setShareModalUnit] = useState<string | null>(null)
  const [sharePhone, setSharePhone] = useState('')
  const [shareSuccess, setShareSuccess] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [isSubmittingShare, setIsSubmittingShare] = useState(false)

  // Support Ticket Form State
  const [ticketUnit, setTicketUnit] = useState('general')
  const [ticketType, setTicketType] = useState('lock')
  const [ticketTitle, setTicketTitle] = useState('')
  const [ticketContent, setTicketContent] = useState('')
  const [ticketPriority, setTicketPriority] = useState('MEDIUM')
  const [ticketFile, setTicketFile] = useState<File | null>(null)
  const [ticketFilePreview, setTicketFilePreview] = useState<string | null>(null)
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false)
  const [ticketSubmitted, setTicketSubmitted] = useState(false)
  const [ticketCode, setTicketCode] = useState<string | null>(null)
  const [ticketError, setTicketError] = useState<string | null>(null)
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false)

  // Filter explore state
  const [filterFacility, setFilterFacility] = useState('all')
  const [filterSize, setFilterSize] = useState('all')
  const [availableUnits, setAvailableUnits] = useState<StorageUnit[]>([])
  const [isLoadingAvailableUnits, setIsLoadingAvailableUnits] = useState(false)
  const [availableUnitsError, setAvailableUnitsError] = useState(false)

  const fetchAvailableUnits = async () => {
    setIsLoadingAvailableUnits(true)
    setAvailableUnitsError(false)
    try {
      const units = await storageUnitService.getUnits({ status: 'AVAILABLE' })
      setAvailableUnits(Array.isArray(units) ? units : [])
    } catch {
      setAvailableUnits([])
      setAvailableUnitsError(true)
    } finally {
      setIsLoadingAvailableUnits(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'explore') void fetchAvailableUnits()
  }, [activeTab])

  const filteredAvailableUnits = availableUnits.filter(unit => {
    const matchesFacility = filterFacility === 'all' || unit.facilityId === filterFacility
    const area = unit.areaSqMeters
    const matchesSize = filterSize === 'all' || (area !== undefined && (
      (filterSize === 'mini' && area >= 2 && area <= 5) ||
      (filterSize === 'family' && area > 5 && area <= 10) ||
      (filterSize === 'business' && area >= 15 && area <= 30)
    ))
    return matchesFacility && matchesSize
  })

  const handleCreateBooking = async () => {
    if (!selectedBookingUnit) return
    if (!user?.id) {
      setBookingError('Phiên đăng nhập không còn hợp lệ. Hãy đăng nhập lại để đặt kho.')
      return
    }
    const today = new Date()
    const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    setIsSubmittingBooking(true)
    setBookingError(null)
    try {
      const result = await bookingService.create({
        storageUnitId: selectedBookingUnit.id,
        customerId: user.id,
        startDate,
        rentalMonths: bookingMonths,
        totalRentalFee: selectedBookingUnit.pricePerMonth * bookingMonths,
      })
      setBookingResult(result)
      setBookingSuccess(true)
      void fetchAvailableUnits()
    } catch (error) {
      const responseMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      setBookingError(responseMessage || 'Không tạo được yêu cầu giữ kho. Kho có thể vừa được khách khác đặt hoặc kỳ hạn chưa đáp ứng chính sách; hãy kiểm tra và thử lại.')
    } finally {
      setIsSubmittingBooking(false)
    }
  }

  const handleCopy = async (id: string, pin: string) => {
    try {
      await navigator.clipboard.writeText(pin)
      setCopiedPin(id)
      setTimeout(() => setCopiedPin(null), 2000)
    } catch {
      setPinErrors(prev => ({ ...prev, [id]: 'Không thể sao chép. Hãy chọn và sao chép mã thủ công.' }))
    }
  }

  const togglePinReveal = async (contract: RentalContract) => {
    if (revealedPins[contract.unitCode]) {
      setRevealedPins(prev => {
        const next = { ...prev }
        delete next[contract.unitCode]
        return next
      })
      return
    }
    if (!contract.bookingId) {
      setPinErrors(prev => ({ ...prev, [contract.unitCode]: 'Hợp đồng này chưa liên kết lượt đặt kho để lấy mã PIN.' }))
      return
    }
    setPinErrors(prev => ({ ...prev, [contract.unitCode]: '' }))
    setLoadingPinUnit(contract.unitCode)
    try {
      const pinRecord = await bookingService.getAccessPin(contract.bookingId)
      setRevealedPins(prev => ({ ...prev, [contract.unitCode]: pinRecord.pin }))
    } catch {
      setPinErrors(prev => ({ ...prev, [contract.unitCode]: 'Không lấy được mã PIN. Hãy thử lại hoặc liên hệ hỗ trợ.' }))
    } finally {
      setLoadingPinUnit(null)
    }
  }

  const handleRemoteUnlock = async (contract: RentalContract) => {
    if (!contract.bookingId) {
      setUnlockError('Hợp đồng này chưa liên kết lượt đặt kho để gửi lệnh mở khóa.')
      return
    }
    setUnlockError(null)
    setUnlockingUnit(contract.unitCode)
    try {
      await bookingService.remoteUnlock(contract.bookingId)
      setUnlockedSuccess(contract.unitCode)
      setTimeout(() => setUnlockedSuccess(current => current === contract.unitCode ? null : current), 5000)
    } catch {
      setUnlockError(`Không gửi được lệnh mở khóa cho kho ${contract.unitCode}. Vui lòng thử lại hoặc liên hệ nhân viên.`)
    } finally {
      setUnlockingUnit(null)
    }
  }

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTicketError(null)
    setIsSubmittingTicket(true)
    const categoryMap: Record<string, SupportTicketCategory> = {
      lock: 'LOCK_ISSUE',
      pin: 'PIN_CODE',
      delegate: 'OTHER',
      climate: 'FACILITY_DAMAGE',
      billing: 'PAYMENT_ISSUE',
    }
    const titleMap: Record<string, string> = {
      lock: 'Sự cố khóa thông minh / cửa cuốn',
      pin: 'Yêu cầu hỗ trợ mã PIN',
      delegate: 'Yêu cầu hỗ trợ quyền truy cập',
      climate: 'Yêu cầu kiểm tra điều kiện kho',
      billing: 'Yêu cầu hỗ trợ thanh toán',
    }
    const relatedContract = activeContracts.find(contract => contract.unitCode === ticketUnit)
    try {
      const result = await supportTicketService.create({
        customerId: user?.id,
        bookingId: relatedContract?.bookingId,
        category: categoryMap[ticketType] || 'OTHER',
        title: titleMap[ticketType] || 'Yêu cầu hỗ trợ',
        description: ticketContent.trim(),
        priority: ticketType === 'lock' ? 'HIGH' : 'MEDIUM',
      })
      setTicketCode(result.ticketCode)
      setTicketSubmitted(true)
      setTicketContent('')
    } catch {
      setTicketError('Chưa gửi được yêu cầu. Kiểm tra kết nối và thử lại; yêu cầu chưa được ghi nhận.')
    } finally {
      setIsSubmittingTicket(false)
    }
  }

  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const relatedContract = activeContracts.find(contract => contract.unitCode === shareModalUnit)
    if (!relatedContract?.bookingId) {
      setShareError('Hợp đồng này chưa liên kết lượt đặt kho. Vui lòng gửi yêu cầu qua mục Hỗ trợ.')
      return
    }
    setIsSubmittingShare(true)
    setShareError(null)
    try {
      await supportTicketService.create({
        customerId: user?.id,
        bookingId: relatedContract.bookingId,
        category: 'OTHER',
        title: 'Yêu cầu cấp quyền truy cập tạm thời',
        description: `Khách hàng đề nghị cấp quyền truy cập tạm thời cho số điện thoại ${sharePhone}. Vui lòng xác minh và xử lý yêu cầu.`,
        priority: 'MEDIUM',
      })
      setShareSuccess(true)
    } catch {
      setShareError('Chưa gửi được yêu cầu ủy quyền. Thử lại sau; hiện chưa có quyền nào được cấp.')
    } finally {
      setIsSubmittingShare(false)
    }
  }

  const handleRenewSubmit = async () => {
    if (!renewUnit) return
    setRenewError(null)
    setIsRenewing(true)
    try {
      const result = await contractService.requestRenewal(renewUnit.contractId, renewMonths) as { signingUrl?: string; status?: string }
      setRenewSigningUrl(result?.signingUrl || null)
      setRenewSuccess(true)
    } catch {
      setRenewError('Chưa tạo được yêu cầu gia hạn. Hợp đồng có thể chưa đến kỳ gia hạn; hãy kiểm tra trạng thái và thử lại.')
    } finally {
      setIsRenewing(false)
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
              <span className="font-mono text-lg font-bold text-slate-900 mt-0.5 sm:text-xl">
                {loadingContracts ? 'Đang tải' : `${activeContracts.length} kho đang thuê`}
              </span>
              <span className="text-xs text-slate-500 truncate">
                {loadingContracts
                  ? 'Đang lấy danh sách kho'
                  : activeContracts.length > 0
                    ? activeContracts.map(c => `#${c.unitCode}`).join(' & ')
                    : 'Chưa có kho hoạt động'}
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
              <span className="font-mono text-lg font-bold text-slate-900 mt-0.5 sm:text-xl">
                {loadingContracts ? 'Đang tải' : nearestEndDate}
              </span>
              <span className="text-xs text-amber-700 font-semibold truncate">
                {loadingContracts ? 'Đang lấy thông tin hợp đồng' : nearestEndDateValue !== '--' ? 'Ngày kết thúc gần nhất' : 'Không có hợp đồng hoạt động'}
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
            {loadingContracts ? '…' : activeContracts.length}
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {activeContracts.map((c) => {
                const pin = revealedPins[c.unitCode] || ''
                const isRevealed = Boolean(pin)
                const isUnlocking = unlockingUnit === c.unitCode
                const isUnlocked = unlockedSuccess === c.unitCode

                return (
                  <div key={c.id} className="stitch-card p-6 flex flex-col justify-between">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center border border-cyan-100 shadow-xs">
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
                          <span className="font-mono text-xs font-bold text-slate-900">{new Date(`${c.endDate.slice(0, 10)}T00:00:00`).toLocaleDateString('vi-VN')}</span>
                          <span className="text-[10px] text-slate-600 font-semibold block">{c.status === 'ACTIVE' ? 'Đang hiệu lực' : c.status === 'PENDING_SIGNATURE' ? 'Chờ ký' : c.status}</span>
                        </div>
                      </div>

                      {/* IoT Telemetry Strip */}
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600">
                        <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-slate-400">thermostat</span>
                          Cảm biến: —
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[15px] text-slate-400">humidity_mid</span>
                          Độ ẩm: —
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-500 font-semibold">
                          <span className="material-symbols-outlined text-[15px] text-slate-400">security</span>
                          Trạng thái IoT: —
                        </span>
                      </div>

                      {/* Security PIN Vault Box */}
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
                            <span className="material-symbols-outlined text-[12px]">lock</span> Mã PIN hệ thống
                          </span>
                        </div>

                        {!isRevealed ? (
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-2.5 px-4 rounded-lg bg-white border border-cyan-100">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 font-mono text-[16px] text-slate-400 tracking-widest select-none">
                                <span>●</span><span>●</span><span>●</span><span>●</span><span>●</span><span>●</span>
                              </div>
                              <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">(Mã đang được mã hóa)</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => void togglePinReveal(c)}
                              disabled={!c.bookingId || loadingPinUnit === c.unitCode}
                              className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">{loadingPinUnit === c.unitCode ? 'progress_activity' : 'visibility'}</span>
                              <span>{loadingPinUnit === c.unitCode ? 'Đang tải mã...' : 'Xem mã PIN'}</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2.5 py-2.5 px-4 rounded-lg bg-white border border-cyan-200">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono text-cyan-800 font-semibold">Mã số PIN:</span>
                                <div className="flex items-center gap-1 font-mono text-base font-bold text-cyan-900 tracking-wider">
                                  {pin.split('').map((digit, idx) => (
                                    <span key={idx} className="px-2 py-1 rounded bg-cyan-50 border border-cyan-200 text-cyan-900 shadow-inner">
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
                                  <span className="material-symbols-outlined text-[14px]">
                                    {copiedPin === c.unitCode ? 'check' : 'content_copy'}
                                  </span>
                                  <span>{copiedPin === c.unitCode ? 'Đã sao chép' : 'Sao chép'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void togglePinReveal(c)}
                                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[14px]">visibility_off</span>
                                  <span>Ẩn</span>
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                              <span className="flex items-center gap-1 text-slate-600 font-medium">
                                <span className="material-symbols-outlined text-[14px]">verified_user</span> Mã được xác thực từ hệ thống
                              </span>
                              <span className="text-cyan-700 text-[10px]">Áp dụng: Cổng Hub &amp; Cửa {c.unitCode}</span>
                            </div>
                          </div>
                        )}

                        {pinErrors[c.unitCode] && (
                          <p role="alert" className="text-[11px] text-rose-700">{pinErrors[c.unitCode]}</p>
                        )}

                        {/* Remote Unlock CTA */}
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => void handleRemoteUnlock(c)}
                            disabled={!c.bookingId || isUnlocking}
                            className={`w-full font-bold text-xs rounded-lg py-2.5 px-4 flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer ${
                              isUnlocked ? 'bg-emerald-600 text-white' : 'stitch-btn-primary'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {isUnlocked ? 'lock_open' : 'key'}
                            </span>
                            <span>
                              {isUnlocking ? 'Đang gửi lệnh mở IoT...' :
                               isUnlocked ? 'Đã gửi lệnh mở khóa' : 'Mở Khóa Từ Xa (Smart Lock)'}
                            </span>
                          </button>
                        </div>
                        {unlockError && (
                          <p role="alert" className="text-[11px] text-rose-700">{unlockError}</p>
                        )}
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
                          <span className="font-mono text-xs font-bold text-slate-500">Chưa có dữ liệu</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-3">
                      <button
                        onClick={() => {
                          setRenewUnit({ id: c.unitCode, contractId: c.id, price: Number(c.monthlyFee || 0).toLocaleString('vi-VN') })
                          setRenewError(null)
                          setRenewSigningUrl(null)
                        }}
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
        </section>
      )}

      {activeTab === 'explore' && (
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Kho đang trống</h3>
                <p className="mt-1 text-xs text-slate-500">Chọn kho còn khả dụng theo dữ liệu hệ thống.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={filterFacility} onChange={event => setFilterFacility(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800">
                  <option value="all">Tất cả cơ sở</option>
                  {[...new Map(availableUnits.map(unit => [unit.facilityId, unit.facilityName])).entries()].map(([facilityId, facilityName]) => (
                    <option key={facilityId} value={facilityId}>{facilityName || 'Cơ sở chưa cập nhật'}</option>
                  ))}
                </select>
                <select value={filterSize} onChange={event => setFilterSize(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800">
                  <option value="all">Mọi diện tích</option>
                  <option value="mini">2–5 m²</option>
                  <option value="family">Trên 5–10 m²</option>
                  <option value="business">15–30 m²</option>
                </select>
                <button type="button" onClick={() => void fetchAvailableUnits()} disabled={isLoadingAvailableUnits} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                  <span className={`material-symbols-outlined text-[16px] ${isLoadingAvailableUnits ? 'animate-spin' : ''}`}>refresh</span>
                  Tải lại
                </button>
              </div>
            </div>
          </div>

          {isLoadingAvailableUnits ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Đang tải kho trống">
              {[0, 1, 2].map(item => <div key={item} className="h-52 rounded-2xl border border-slate-200 bg-white animate-pulse" />)}
            </div>
          ) : availableUnitsError ? (
            <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
              <p className="text-sm font-semibold text-rose-900">Không tải được danh sách kho trống.</p>
              <p className="mt-1 text-xs text-rose-700">Thử tải lại sau khi kết nối dịch vụ được khôi phục.</p>
              <button type="button" onClick={() => void fetchAvailableUnits()} className="mt-3 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-rose-800 border border-rose-200">Thử lại</button>
            </div>
          ) : filteredAvailableUnits.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
              <span className="material-symbols-outlined text-3xl text-slate-400">inventory_2</span>
              <p className="mt-2 text-sm font-semibold text-slate-700">{availableUnits.length ? 'Không có kho phù hợp bộ lọc.' : 'Hiện chưa có kho trống.'}</p>
              <p className="mt-1 text-xs text-slate-500">Danh sách được lấy trực tiếp từ tình trạng kho hiện tại.</p>
              {availableUnits.length > 0 && <button type="button" onClick={() => { setFilterFacility('all'); setFilterSize('all') }} className="mt-3 text-xs font-semibold text-cyan-700 hover:underline">Xóa bộ lọc</button>}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredAvailableUnits.map(unit => (
                <article key={unit.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs font-bold text-slate-500">#{unit.unitCode}</p>
                      <h4 className="mt-1 text-base font-bold text-slate-900">{unit.unitTypeName || 'Kho lưu trữ'}</h4>
                      <p className="mt-1 text-xs text-slate-500">{unit.facilityName || 'Cơ sở chưa cập nhật'}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-200">Còn trống</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                    <div><span className="block text-slate-500">Diện tích</span><strong className="mt-1 block text-slate-900">{unit.areaSqMeters != null ? `${unit.areaSqMeters} m²` : 'Chưa cập nhật'}</strong></div>
                    <div><span className="block text-slate-500">Tầng</span><strong className="mt-1 block text-slate-900">{unit.floorLevel || '—'}</strong></div>
                  </div>
                  <div className="mt-4 flex items-baseline justify-between gap-2">
                    <span className="text-xs text-slate-500">Giá thuê / tháng</span>
                    <strong className="text-base font-bold text-orange-700">{Number(unit.pricePerMonth || 0).toLocaleString('vi-VN')} ₫</strong>
                  </div>
                  <button type="button" onClick={() => { setSelectedBookingUnit(unit); setBookingError(null); setBookingSuccess(false); setBookingResult(null); setBookingMonths(1) }} className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white transition-colors hover:bg-slate-800">
                    Yêu cầu giữ kho
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </article>
              ))}
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
                Gửi yêu cầu tại đây để hệ thống ghi nhận và chuyển cho nhân viên phụ trách. Với sự cố cần hỗ trợ ngay, vui lòng gọi hotline.
              </p>

              <div className="mt-2 flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-orange-600">call</span>
                  <span>Hotline khẩn cấp: <strong className="text-slate-900 font-bold">1900 6828 (Ext. 1)</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-orange-600">schedule</span>
                  <span>Thời gian tiếp nhận: <strong>Vui lòng xác nhận qua hotline</strong></span>
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
                    Yêu cầu đã được lưu{ticketCode ? ` với mã ${ticketCode}` : ''}. Nhân viên sẽ cập nhật trạng thái xử lý.
                  </p>
                  <button type="button" onClick={() => { setTicketSubmitted(false); setTicketCode(null) }} className="mt-3 text-xs font-semibold text-cyan-700 hover:text-cyan-900">Gửi yêu cầu khác</button>
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
                      {activeContracts.map(contract => (
                        <option key={contract.id} value={contract.unitCode}>Kho #{contract.unitCode} ({contract.facilityName})</option>
                      ))}
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
                    <span className="text-[11px] text-slate-500">Yêu cầu được lưu và chuyển đến hàng đợi hỗ trợ.</span>
                    <button
                      type="submit"
                      disabled={isSubmittingTicket}
                      className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-bold text-xs rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">{isSubmittingTicket ? 'progress_activity' : 'send'}</span>
                      {isSubmittingTicket ? 'Đang gửi...' : 'Gửi Yêu Cầu'}
                    </button>
                  </div>
                  {ticketError && <p role="alert" className="sm:col-span-2 text-xs text-rose-700">{ticketError}</p>}
                </form>
              )}
            </div>
          </div>

      {/* Booking Modal */}
      {selectedBookingUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="booking-dialog-title" className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            {bookingSuccess && bookingResult ? (
              <div className="space-y-3 py-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <span className="material-symbols-outlined text-[28px]">check_circle</span>
                </div>
                <h3 id="booking-dialog-title" className="text-lg font-bold text-slate-900">Đã tạo yêu cầu giữ kho</h3>
                <p className="text-xs text-slate-600">Mã yêu cầu: <strong className="font-mono">{bookingResult.bookingCode}</strong></p>
                <p className="text-xs leading-relaxed text-slate-500">Trạng thái hiện tại: chờ thanh toán. Hợp đồng và mã truy cập chỉ được cấp sau khi hoàn tất thanh toán.</p>
                <button type="button" onClick={() => { setBookingSuccess(false); setBookingResult(null); setSelectedBookingUnit(null) }} className="mt-2 w-full rounded-lg bg-slate-900 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-800">Đóng</button>
              </div>
            ) : (
              <form onSubmit={event => { event.preventDefault(); void handleCreateBooking() }} className="space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 id="booking-dialog-title" className="text-base font-bold text-slate-900">Yêu cầu giữ kho</h3>
                    <span className="text-xs text-slate-500">#{selectedBookingUnit.unitCode} · {selectedBookingUnit.facilityName}</span>
                  </div>
                  <button type="button" onClick={() => setSelectedBookingUnit(null)} aria-label="Đóng" className="text-slate-400 hover:text-slate-700">
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs">
                  <div className="flex justify-between gap-3"><span className="text-slate-500">Loại kho</span><strong className="text-right text-slate-900">{selectedBookingUnit.unitTypeName || 'Kho lưu trữ'}</strong></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">Giá thuê / tháng</span><strong className="text-orange-700">{Number(selectedBookingUnit.pricePerMonth || 0).toLocaleString('vi-VN')} ₫</strong></div>
                  <p className="border-t border-slate-200 pt-2 text-slate-500">Tiền cọc sẽ được xác nhận ở bước thanh toán theo chính sách cơ sở.</p>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-[11px] font-bold uppercase text-slate-500">Kỳ hạn thuê</span>
                  <select value={bookingMonths} onChange={event => setBookingMonths(Number(event.target.value))} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-800 focus:border-slate-400 focus:outline-none">
                    <option value={1}>1 tháng</option>
                    <option value={3}>3 tháng</option>
                    <option value={6}>6 tháng</option>
                    <option value={12}>12 tháng</option>
                  </select>
                </label>
                <div className="flex justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs"><span className="text-slate-500">Tạm tính tiền thuê</span><strong className="text-slate-900">{(selectedBookingUnit.pricePerMonth * bookingMonths).toLocaleString('vi-VN')} ₫</strong></div>
                {bookingError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{bookingError}</p>}

                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  <button type="button" onClick={() => setSelectedBookingUnit(null)} disabled={isSubmittingBooking} className="flex-1 rounded-lg bg-slate-100 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60">Hủy</button>
                  <button type="submit" disabled={isSubmittingBooking} className="flex-1 rounded-lg bg-orange-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60">
                    {isSubmittingBooking ? 'Đang gửi…' : 'Gửi yêu cầu giữ kho'}
                  </button>
                </div>
              </form>
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
      {renewUnit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            {renewSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-[28px]">check_circle</span>
                </div>
                <h3 className="font-headline text-lg font-bold text-slate-900">
                  Đã tạo yêu cầu gia hạn
                </h3>
                <p className="text-xs text-slate-600">
                  Yêu cầu gia hạn kho #{renewUnit.id} ({renewMonths} tháng) đã được ghi nhận. Hợp đồng chỉ có hiệu lực sau khi hoàn tất bước ký.
                </p>
                {renewSigningUrl && <a href={renewSigningUrl} target="_blank" rel="noreferrer" className="inline-flex text-xs font-semibold text-cyan-700 hover:underline">Mở liên kết ký phụ lục</a>}
                <button
                  onClick={() => {
                    setRenewSuccess(false)
                    setRenewUnit(null)
                  }}
                  className="mt-2 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors"
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
                  <span className="text-xs text-slate-500">{contracts.find(contract => contract.id === renewUnit.contractId)?.facilityName || 'Cơ sở'}</span>
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
                    onClick={() => setRenewUnit(null)}
                    className="text-slate-400 hover:text-slate-600"
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
                    <option value={1}>1 Tháng</option>
                    <option value={3}>3 Tháng</option>
                    <option value={6}>6 Tháng</option>
                    <option value={12}>12 Tháng</option>
                  </select>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    onClick={() => setRenewUnit(null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={() => void handleRenewSubmit()}
                    disabled={isRenewing}
                    className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
                  >
                    {isRenewing ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu gia hạn'}
                  </button>
                </div>
                {renewError && <p role="alert" className="text-xs text-rose-700">{renewError}</p>}
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
                  Đã gửi yêu cầu ủy quyền
                </h3>
                <p className="text-xs text-slate-600">
                  Yêu cầu cấp quyền cho số <strong>{sharePhone}</strong> đã được chuyển cho nhân viên. Chưa có quyền truy cập nào được cấp cho đến khi được duyệt.
                </p>
                <button
                  onClick={() => {
                    setShareSuccess(false)
                    setShareModalUnit(null)
                    setSharePhone('')
                    setShareError(null)
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
                    <span className="text-xs text-slate-500">Gửi yêu cầu để nhân viên xác minh và cấp quyền</span>
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
                    type="button"
                    onClick={() => setShareModalUnit(null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingShare}
                    className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
                  >
                    {isSubmittingShare ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu xác minh'}
                  </button>
                </div>
                {shareError && <p role="alert" className="text-xs text-rose-700">{shareError}</p>}
              </form>
            )}
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
