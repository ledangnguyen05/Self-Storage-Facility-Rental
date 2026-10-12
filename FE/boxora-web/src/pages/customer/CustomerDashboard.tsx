import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { contractService, RentalContract } from '../../services/contractService'

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // Real database contracts state
  const [contracts, setContracts] = useState<RentalContract[]>([])
  const [loadingContracts, setLoadingContracts] = useState<boolean>(true)

  useEffect(() => {
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
    fetchContracts()
  }, [user])

  const activeContracts = contracts.filter(c => c.status === 'ACTIVE')
  const nearestEndDate = activeContracts
    .map(c => c.endDate)
    .filter(Boolean)
    .sort()[0] || '--'

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
  const [selectedBookingUnit, setSelectedBookingUnit] = useState<{ id: string; name: string; price: string } | null>(null)
  const [bookingSuccess, setBookingSuccess] = useState(false)

  // Renewal Modal
  const [renewUnit, setRenewUnit] = useState<{ id: string; price: string } | null>(null)
  const [renewMonths, setRenewMonths] = useState(3)
  const [renewSuccess, setRenewSuccess] = useState(false)

  // Share Access Modal
  const [shareModalUnit, setShareModalUnit] = useState<string | null>(null)
  const [sharePhone, setSharePhone] = useState('')
  const [shareSuccess, setShareSuccess] = useState(false)

  // Support Ticket Form State
  const [ticketUnit, setTicketUnit] = useState('A-108')
  const [ticketType, setTicketType] = useState('lock')
  const [ticketContent, setTicketContent] = useState('')
  const [ticketSubmitted, setTicketSubmitted] = useState(false)

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

  const handleRemoteUnlock = (unitId: string) => {
    setUnlockingUnit(unitId)
    setTimeout(() => {
      setUnlockingUnit(null)
      setUnlockedSuccess(unitId)
      setTimeout(() => setUnlockedSuccess(null), 4000)
    }, 1200)
  }

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setTicketSubmitted(true)
    setTimeout(() => {
      setTicketSubmitted(false)
      setTicketContent('')
    }, 3000)
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
              <span className="font-mono text-xl font-bold text-slate-900 mt-0.5">{activeContracts.length} Kho Hoạt Động</span>
              <span className="text-xs text-slate-500 truncate">
                {activeContracts.length > 0 ? activeContracts.map(c => `#${c.unitCode}`).join(' & ') : 'Chưa có kho hoạt động'}
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
              <span className="font-mono text-xl font-bold text-slate-900 mt-0.5">{nearestEndDate}</span>
              <span className="text-xs text-amber-700 font-semibold truncate">
                {nearestEndDate !== '--' ? `Hạn kết thúc hợp đồng: ${nearestEndDate}` : 'Không có hợp đồng sắp hết hạn'}
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
            {activeContracts.length}
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
          {loadingContracts ? (
            <div className="p-12 text-center text-slate-500 text-xs">Đang tải dữ liệu kho từ hệ thống database...</div>
          ) : activeContracts.length === 0 ? (
            <div className="stitch-card p-12 text-center flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-cyan-50 text-cyan-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-[36px]">warehouse</span>
              </div>
              <div className="max-w-md">
                <h3 className="font-headline text-lg font-bold text-slate-900 mb-1">Bạn chưa có kho đang thuê nào</h3>
                <p className="text-xs text-slate-500">
                  Hãy khám phá hệ thống 56 vị trí kho thông minh của Boxora để tìm kích thước và địa điểm phù hợp nhất.
                </p>
              </div>
              <button
                onClick={() => handleTabChange('explore')}
                className="stitch-btn-primary text-xs"
              >
                <span className="material-symbols-outlined text-[18px]">travel_explore</span>
                <span>Tìm &amp; Thuê Kho Ngay</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {activeContracts.map((c) => {
                const pin = (c.id.replace(/\D/g, '').slice(0, 6) || '849204').padEnd(6, '9')
                const isRevealed = revealedPins[c.unitCode]
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
                          <span className="font-mono text-xs font-bold text-slate-900">{c.endDate}</span>
                          <span className="text-[10px] text-emerald-600 font-semibold block">Đã thanh toán</span>
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
                          48% RH
                        </span>
                        <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                          <span className="material-symbols-outlined text-[15px] text-emerald-600">security</span>
                          Smart Lock: SECURE
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
                            <span className="material-symbols-outlined text-[12px]">lock</span> AES-256 Vault
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
                              onClick={() => togglePinReveal(c.unitCode)}
                              className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">visibility</span>
                              <span>Xem mã PIN</span>
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-700 text-white font-bold">OTP</span>
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
                                  onClick={() => togglePinReveal(c.unitCode)}
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
                              <span className="text-cyan-700 text-[10px]">Áp dụng: Cổng Hub &amp; Cửa {c.unitCode}</span>
                            </div>
                          </div>
                        )}

                        {/* Remote Unlock CTA */}
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => handleRemoteUnlock(c.unitCode)}
                            disabled={isUnlocking}
                            className={`w-full font-bold text-xs rounded-lg py-2.5 px-4 flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer ${
                              isUnlocked ? 'bg-emerald-600 text-white' : 'stitch-btn-primary'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {isUnlocked ? 'lock_open' : 'key'}
                            </span>
                            <span>
                              {isUnlocking ? 'Đang gửi lệnh mở IoT...' :
                               isUnlocked ? 'CỬA ĐÃ MỞ (TỰ KHÓA SAU 30 GIÂY)' : 'Mở Khóa Từ Xa (Smart Lock)'}
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
                        onClick={() => setRenewUnit({ id: c.unitCode, price: Number(c.monthlyFee || 0).toLocaleString('vi-VN') })}
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

      {/* 4. TAB 2: TÌM & THUÊ THÊM KHO (EXPLORE & BOOK) */}
      {activeTab === 'explore' && (
        <div className="flex flex-col gap-6">
          {/* Quick Filter */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-600">tune</span>
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Lọc kho trống</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <select
                value={filterFacility}
                onChange={(e) => setFilterFacility(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg focus:outline-none focus:border-slate-400"
              >
                <option value="all">Tất cả cơ sở</option>
                <option value="tb">Cơ sở Tân Bình (TP.HCM)</option>
                <option value="q7">Cơ sở Quận 7 (TP.HCM)</option>
                <option value="bt">Cơ sở Bình Thạnh (TP.HCM)</option>
                <option value="cg">Cơ sở Cầu Giấy (Hà Nội)</option>
              </select>

              <select
                value={filterSize}
                onChange={(e) => setFilterSize(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg focus:outline-none focus:border-slate-400"
              >
                <option value="all">Tất cả kích cỡ</option>
                <option value="mini">Kho Mini (2 - 5 m²)</option>
                <option value="family">Kho Gia Đình (6 - 10 m²)</option>
                <option value="business">Kho Doanh Nghiệp (15 - 30 m²)</option>
              </select>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            
            {/* Card 1: Kho Mini Standard #A-112 */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div>
                <div className="relative h-44 overflow-hidden bg-slate-800">
                  <div 
                    className="w-full h-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105 opacity-90"
                    style={{ backgroundImage: "url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80')" }}
                  ></div>
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    <span className="bg-slate-900/90 backdrop-blur text-white font-unit-code text-xs px-2 py-1 rounded-md">
                      #A-112
                    </span>
                    <span className="bg-orange-600 text-white font-mono text-[10px] uppercase font-bold px-2 py-1 rounded-md">
                      Tầng Trệt
                    </span>
                  </div>
                  <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur px-2.5 py-1 rounded-md text-slate-900 text-xs font-semibold flex items-center gap-1 shadow-sm">
                    <span className="material-symbols-outlined text-orange-600 text-[16px]">thermostat</span>
                    22°C Ổn định
                  </div>
                </div>

                <div className="p-5 flex flex-col gap-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-headline text-base font-bold text-slate-900">Kho Mini Standard</span>
                    <span className="font-headline text-base font-bold text-orange-600">
                      1.850.000 đ<span className="text-xs font-normal text-slate-500">/tháng</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Phù hợp lưu trữ đồ gia dụng, vali cá nhân, thiết bị văn phòng cỡ vừa.
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">aspect_ratio</span>
                      <span className="font-data-tabular text-slate-700">2.0m × 2.5m (5m²)</span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">deployed_code</span>
                      <span className="font-data-tabular text-slate-700">Thể tích 15m³</span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">pin</span>
                      <span className="text-slate-700 font-medium">Cửa cuốn + Smart PIN</span>
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
                  onClick={() => setSelectedBookingUnit({ id: 'A-112', name: 'Kho Mini Standard 5m²', price: '1.850.000' })}
                  className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <span>Đặt Giữ Chỗ Ngay</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </div>

            {/* Card 2: Kho Gia Đình Plus #B-104 */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div>
                <div className="relative h-44 overflow-hidden bg-slate-800">
                  <div 
                    className="w-full h-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105 opacity-90"
                    style={{ backgroundImage: "url('https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=800&q=80')" }}
                  ></div>
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    <span className="bg-slate-900/90 backdrop-blur text-white font-unit-code text-xs px-2 py-1 rounded-md">
                      #B-104
                    </span>
                    <span className="bg-blue-600 text-white font-mono text-[10px] uppercase font-bold px-2 py-1 rounded-md">
                      Tầng 2 (Thang tải)
                    </span>
                  </div>
                  <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur px-2.5 py-1 rounded-md text-slate-900 text-xs font-semibold flex items-center gap-1 shadow-sm">
                    <span className="material-symbols-outlined text-blue-600 text-[16px]">ac_unit</span>
                    Lạnh 20-22°C
                  </div>
                </div>

                <div className="p-5 flex flex-col gap-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-headline text-base font-bold text-slate-900">Kho Gia Đình Plus</span>
                    <span className="font-headline text-base font-bold text-orange-600">
                      3.400.000 đ<span className="text-xs font-normal text-slate-500">/tháng</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Lưu kho nội thất căn hộ 2 phòng ngủ, nệm, sofa, đàn piano chống ẩm tiêu chuẩn.
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">aspect_ratio</span>
                      <span className="font-data-tabular text-slate-700">3.0m × 3.0m (9m²)</span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">deployed_code</span>
                      <span className="font-data-tabular text-slate-700">Thể tích 27m³</span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">sensors</span>
                      <span className="text-slate-700 font-medium">Khóa Thông Minh</span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">dry</span>
                      <span className="text-slate-700 font-medium">Độ ẩm &lt; 55% RH</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 pt-0">
                <button
                  onClick={() => setSelectedBookingUnit({ id: 'B-104', name: 'Kho Gia Đình Plus 9m²', price: '3.400.000' })}
                  className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <span>Đặt Giữ Chỗ Ngay</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </div>

            {/* Card 3: Kho Doanh Nghiệp Pro #C-005 */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div>
                <div className="relative h-44 overflow-hidden bg-slate-800">
                  <div 
                    className="w-full h-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105 opacity-90"
                    style={{ backgroundImage: "url('https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80')" }}
                  ></div>
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    <span className="bg-slate-900/90 backdrop-blur text-white font-unit-code text-xs px-2 py-1 rounded-md">
                      #C-005
                    </span>
                    <span className="bg-emerald-600 text-white font-mono text-[10px] uppercase font-bold px-2 py-1 rounded-md">
                      Cửa đôi xe tải
                    </span>
                  </div>
                  <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur px-2.5 py-1 rounded-md text-slate-900 text-xs font-semibold flex items-center gap-1 shadow-sm">
                    <span className="material-symbols-outlined text-orange-600 text-[16px]">forklift</span>
                    Xe tải vào tận cửa
                  </div>
                </div>

                <div className="p-5 flex flex-col gap-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-headline text-base font-bold text-slate-900">Kho Doanh Nghiệp Pro</span>
                    <span className="font-headline text-base font-bold text-orange-600">
                      6.900.000 đ<span className="text-xs font-normal text-slate-500">/tháng</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Dành cho công ty thương mại điện tử, nhập khẩu phụ tùng hoặc hàng hóa lưu kho.
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">aspect_ratio</span>
                      <span className="font-data-tabular text-slate-700">4.0m × 5.0m (20m²)</span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">deployed_code</span>
                      <span className="font-data-tabular text-slate-700">Thể tích 65m³</span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">security</span>
                      <span className="text-slate-700 font-medium">Bảo hiểm tài sản 200tr</span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-orange-600 text-[18px]">pallet</span>
                      <span className="text-slate-700 font-medium">Sức chứa 6 Pallet</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 pt-0">
                <button
                  onClick={() => setSelectedBookingUnit({ id: 'C-005', name: 'Kho Doanh Nghiệp Pro 20m²', price: '6.900.000' })}
                  className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <span>Đặt Giữ Chỗ Ngay</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </div>

          </div>
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
              {activeContracts.length} Hợp đồng đang hiệu lực
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-mono uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 rounded-l-lg">Mã Hợp Đồng</th>
                  <th className="py-3 px-4">Mã Kho</th>
                  <th className="py-3 px-4">Cơ Sở</th>
                  <th className="py-3 px-4">Kỳ Hạn Thuê</th>
                  <th className="py-3 px-4">Cước Hàng Tháng</th>
                  <th className="py-3 px-4">Tiền Cọc</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4 rounded-r-lg text-right">Tác Vụ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {contracts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                      Chưa có hợp đồng nào trong hồ sơ của bạn.
                    </td>
                  </tr>
                ) : (
                  contracts.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-4 font-unit-code text-xs font-bold text-slate-900">#{c.contractCode}</td>
                      <td className="py-4 px-4 font-bold text-orange-600">#{c.unitCode}</td>
                      <td className="py-4 px-4 text-slate-700">{c.facilityName}</td>
                      <td className="py-4 px-4 text-slate-700">{c.startDate} — {c.endDate}</td>
                      <td className="py-4 px-4 font-data-tabular font-bold text-slate-900">
                        {Number(c.monthlyFee || 0).toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-4 px-4 font-data-tabular text-slate-700">
                        {Number(c.depositHeld || 0).toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === 'ACTIVE' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {c.status === 'ACTIVE' ? 'Đang hiệu lực' : c.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => alert(`Xem chi tiết hợp đồng #${c.contractCode} tại cơ sở ${c.facilityName}`)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md font-semibold text-xs transition-colors"
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
                      <option value="A-108">Kho #A-108 (Cơ sở Tân Bình)</option>
                      <option value="B-205">Kho #B-205 (Cơ sở Tân Bình)</option>
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
                      className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">send</span>
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
                    className="text-slate-400 hover:text-slate-600"
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
                  <select className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400">
                    <option value="1">1 Tháng</option>
                    <option value="3">3 Tháng (Giảm 5%)</option>
                    <option value="6">6 Tháng (Giảm 10%)</option>
                    <option value="12">12 Tháng (Giảm 15%)</option>
                  </select>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    onClick={() => setSelectedBookingUnit(null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={() => setBookingSuccess(true)}
                    className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
                  >
                    Ký Online &amp; Thanh Toán
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
                  Hạn thuê kho #{renewUnit.id} đã được tự động cộng thêm {renewMonths} tháng.
                </p>
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
                    <span className="text-xs text-slate-500">Cơ sở Tân Bình - Mega Central</span>
                  </div>
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
                    <option value={1}>1 Tháng (+1.850.000 đ)</option>
                    <option value={3}>3 Tháng (+5.272.500 đ - Tiết kiệm 5%)</option>
                    <option value={6}>6 Tháng (+9.990.000 đ - Tiết kiệm 10%)</option>
                    <option value={12}>12 Tháng (+18.870.000 đ - Tiết kiệm 15%)</option>
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
                    onClick={() => setRenewSuccess(true)}
                    className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
                  >
                    Xác Nhận Gia Hạn
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
