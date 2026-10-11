import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { checkCustomerPortalAccess } from '../../utils/rentalAccess'
import { FloatingContactWidget } from '../../components/common/FloatingContactWidget'

const TELEMETRY_METRICS = [
  { label: 'Cơ sở trực tuyến', value: '100%', detail: 'Hoạt động liên tục 24/7', icon: 'power' },
  { label: 'Kho phòng sẵn sàng', value: '1.280', detail: 'Tỷ lệ trống 28% khả dụng', icon: 'warehouse' },
  { label: 'Vi khí hậu tối ưu', value: '21.5°C', detail: 'Độ ẩm kiểm soát 45% RH', icon: 'thermostat' },
  { label: 'Chuẩn bảo mật', value: 'AES-256', detail: 'Khóa IoT & Mã PIN số hóa', icon: 'encrypted' }
]

export const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, user, logout } = useAuth()
  const [dropdown1Open, setDropdown1Open] = useState(false)
  const [notifySetting, setNotifySetting] = useState(true)
  const [soundSetting, setSoundSetting] = useState(true)
  const [langSetting, setLangSetting] = useState<'vi' | 'en'>('vi')

  // Customer rental access state
  const isCustomer = user?.role?.name === 'CUSTOMER'
  const [customerAccess, setCustomerAccess] = useState(() => checkCustomerPortalAccess(user))
  const canAccessPortal = !isCustomer || customerAccess.hasAccess

  // Listen to rental update events
  useEffect(() => {
    const handleRentalChange = () => {
      setCustomerAccess(checkCustomerPortalAccess(user))
    }
    window.addEventListener('boxora_rental_updated', handleRentalChange)
    return () => window.removeEventListener('boxora_rental_updated', handleRentalChange)
  }, [user])

  useEffect(() => {
    setCustomerAccess(checkCustomerPortalAccess(user))
  }, [user])

  // Policies active tab state
  const [activePolicyTab, setActivePolicyTab] = useState<'deposit' | 'insurance' | 'contract' | 'prohibited'>('deposit')

  // FAQ active item state
  const [activeFaqIndex, setActiveFaqIndex] = useState<number | null>(0)

  return (
    <div className="min-h-screen bg-[var(--surface-canvas,#f8fafc)] text-slate-900 font-sans selection:bg-[#0891b2] selection:text-white">
      
      {/* ============================================================ */}
      {/* 1. TOP NAVIGATION BAR                                        */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/90 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand-teal,#0891b2)] flex items-center justify-center text-white font-bold shadow-sm group-hover:bg-[var(--brand-teal-hover,#0e7490)] transition-colors">
              <span className="material-symbols-outlined text-[22px]">lock</span>
            </div>
            <div className="flex flex-col text-left">
              <span className="font-headline text-xl font-bold tracking-tight text-slate-900 leading-none">
                Boxora<span className="text-[var(--brand-teal,#0891b2)]">.</span>
              </span>
              <span className="font-mono text-[10px] text-cyan-800 font-semibold uppercase tracking-widest mt-1">
                Smart Storage
              </span>
            </div>
          </Link>

          {/* Nav Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-5 text-xs font-semibold text-slate-700">
            <a href="#process" className="hover:text-[var(--brand-teal,#0891b2)] transition-colors">
              Quy Trình 3 Bước
            </a>
            <a href="#iot-access" className="hover:text-[var(--brand-teal,#0891b2)] transition-colors">
              Khóa IoT
            </a>
            <a href="#services" className="hover:text-[var(--brand-teal,#0891b2)] transition-colors">
              Dịch Vụ
            </a>
            <a href="#size-guide" className="hover:text-[var(--brand-teal,#0891b2)] transition-colors">
              Ước Tính Kích Cỡ
            </a>
            <a href="#policies" className="hover:text-[var(--brand-teal,#0891b2)] transition-colors">
              Chính Sách
            </a>
            <a href="#faq" className="hover:text-[var(--brand-teal,#0891b2)] transition-colors">
              Hỏi Đáp &amp; Hỗ Trợ
            </a>
            <Link
              to="/units"
              className="px-3 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-800 font-bold border border-cyan-200 transition-colors flex items-center gap-1 shadow-2xs"
            >
              <span className="material-symbols-outlined text-[15px]">travel_explore</span>
              <span>Dashboard Tìm Kho</span>
            </Link>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdown1Open(prev => !prev)}
                  className={`flex items-center gap-2.5 p-1.5 pr-3 rounded-full border shadow-2xs transition-all cursor-pointer text-left focus:outline-none ${
                  !canAccessPortal
                    ? 'bg-amber-50/90 hover:bg-amber-100 border-amber-200 focus:ring-2 focus:ring-amber-500/30'
                    : 'bg-white hover:bg-slate-50 border-slate-200 focus:ring-2 focus:ring-cyan-500/30'
                }`}
              >
                <div className="relative">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-2xs ${
                      !canAccessPortal ? 'bg-amber-700 text-white' : 'bg-slate-900 text-white'
                    }`}
                  >
                    {user?.fullName ? user.fullName[0].toUpperCase() : user?.username ? user.username[0].toUpperCase() : 'U'}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                      !canAccessPortal ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900 leading-tight">
                    {user?.fullName || user?.username || 'Khách Hàng'}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-semibold ${
                      !canAccessPortal ? 'text-amber-800' : 'text-cyan-800'
                    }`}
                  >
                    {!canAccessPortal ? 'Khách Mới • Thuê Kho' : (user?.role?.name || 'CUSTOMER')}
                  </span>
                </div>
                <span
                  className={`material-symbols-outlined text-[18px] transition-transform duration-150 ${
                    !canAccessPortal ? 'text-amber-700' : 'text-slate-400'
                  } ${dropdown1Open ? 'rotate-180' : ''}`}
                >
                  expand_more
                </span>
              </button>

              {/* Dropdown 1 Popover */}
              {dropdown1Open && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-4 animate-in fade-in slide-in-from-top-1 duration-150 flex flex-col gap-3">
                  {/* User Header Profile */}
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-xs ${
                        !canAccessPortal ? 'bg-amber-700 text-white' : 'bg-slate-900 text-white'
                      }`}
                    >
                      {user?.fullName ? user.fullName[0].toUpperCase() : user?.username ? user.username[0].toUpperCase() : 'U'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {user?.fullName || user?.username || 'Khách Hàng'}
                      </span>
                      <span className="text-[11px] text-slate-500 truncate">
                        {user?.email || 'customer@boxora.vn'}
                      </span>
                      <span
                        className={`mt-0.5 inline-block px-1.5 py-0.2 rounded font-mono text-[9px] font-bold border w-fit ${
                          !canAccessPortal
                            ? 'bg-amber-50 text-amber-900 border-amber-200'
                            : 'bg-cyan-50 text-cyan-900 border-cyan-200'
                        }`}
                      >
                        {!canAccessPortal ? 'KHÁCH HÀNG MỚI (CHƯA CÓ KHO)' : (user?.role?.name || 'CUSTOMER')}
                      </span>
                    </div>
                  </div>

                  {/* Primary Portal or Rental Action */}
                  {!canAccessPortal ? (
                    <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-left space-y-2.5">
                      <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                        <span className="material-symbols-outlined text-[18px] text-amber-700">info</span>
                        <span>Tài Khoản Chưa Kích Hoạt Kho</span>
                      </div>
                      <p className="text-[11px] text-amber-900 leading-relaxed font-normal">
                        Quý khách hiện chưa có hợp đồng kho đang hoạt động. Vui lòng truy cập Dashboard tìm kiếm &amp; thuê kho để định vị khoảng cách, chọn phòng kho và nhận mã PIN mở app.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setDropdown1Open(false)
                          navigate('/units')
                        }}
                        className="w-full py-2 px-3 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">travel_explore</span>
                        <span>Đi Đến Dashboard Tìm &amp; Thuê Kho</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDropdown1Open(false)
                        navigate(isCustomer ? '/portal/customer' : '/portal')
                      }}
                      className="w-full py-2.5 px-3.5 rounded-xl bg-slate-900 text-white font-semibold text-xs flex items-center justify-between hover:bg-neutral-800 transition-all shadow-xs cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-emerald-400">dashboard</span>
                        <span>{isCustomer ? 'Vào Portal Quản Lý Kho' : 'Vào Trang Điều Hành Portal'}</span>
                      </span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  )}

                  {/* Website & App Settings */}
                  <div className="flex flex-col gap-2 pt-1 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Cài Đặt Trang Web &amp; Vận Hành
                    </span>

                    {/* Setting 1: Notifications */}
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-700 flex items-center gap-1.5 font-medium">
                        <span className="material-symbols-outlined text-[16px] text-slate-500">notifications</span>
                        Thông báo IoT &amp; Sự kiện
                      </span>
                      <button
                        type="button"
                        onClick={() => setNotifySetting(prev => !prev)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${notifySetting ? 'bg-cyan-600' : 'bg-slate-300'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${notifySetting ? 'translate-x-4' : 'translate-x-0'}`}></div>
                      </button>
                    </div>

                    {/* Setting 2: Emergency Alert Sound */}
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-700 flex items-center gap-1.5 font-medium">
                        <span className="material-symbols-outlined text-[16px] text-slate-500">volume_up</span>
                        Âm thanh cảnh báo khẩn
                      </span>
                      <button
                        type="button"
                        onClick={() => setSoundSetting(prev => !prev)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${soundSetting ? 'bg-cyan-600' : 'bg-slate-300'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${soundSetting ? 'translate-x-4' : 'translate-x-0'}`}></div>
                      </button>
                    </div>

                    {/* Setting 3: Language */}
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-700 flex items-center gap-1.5 font-medium">
                        <span className="material-symbols-outlined text-[16px] text-slate-500">language</span>
                        Ngôn ngữ hiển thị
                      </span>
                      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setLangSetting('vi')}
                          className={`px-2 py-0.5 rounded cursor-pointer ${langSetting === 'vi' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                        >
                          VI
                        </button>
                        <button
                          type="button"
                          onClick={() => setLangSetting('en')}
                          className={`px-2 py-0.5 rounded cursor-pointer ${langSetting === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                        >
                          EN
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Logout Action */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <Link
                      to="/portal/facility-manager"
                      onClick={() => setDropdown1Open(false)}
                      className="text-[11px] font-semibold text-cyan-800 hover:underline"
                    >
                      Sơ đồ kho Tầng 1 &amp; 2
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setDropdown1Open(false)
                        logout()
                      }}
                      className="px-2.5 py-1 rounded-lg text-rose-700 hover:bg-rose-50 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">logout</span>
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
                <Link
                  to="/login"
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-[var(--brand-teal,#0891b2)] transition-colors"
                >
                  Đăng Nhập
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-lg bg-[var(--brand-teal,#0891b2)] hover:bg-[var(--brand-teal-hover,#0e7490)] text-white text-xs font-semibold btn-tactile shadow-xs transition-all flex items-center gap-1.5"
                >
                  <span>Thuê Kho Ngay</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </>
            )}
          </div>

        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. HERO SECTION — THE PRECISION VAULT                        */}
      {/* ============================================================ */}
      <section className="relative pt-12 pb-16 lg:pt-20 lg:pb-24 border-b border-slate-200/80 bg-gradient-to-b from-white via-slate-50 to-[var(--surface-canvas,#f8fafc)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          
          {/* Top Security Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-50 border border-cyan-200 text-[var(--brand-teal,#0891b2)] font-mono text-[11px] font-semibold uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            <span>HỆ THỐNG KHO TỰ QUẢN CHUẨN XÁC // CẤP MÃ PIN TỨC THỜI</span>
          </div>

          {/* Hero Main Heading */}
          <div className="max-w-4xl mx-auto space-y-4">
            <h1 className="font-headline text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.18]">
              Kho Lưu Trữ Tự Quản Thông Minh <br />
              <span className="text-[var(--brand-teal,#0891b2)]">Kiên Cố, An Toàn &amp; Vào Kho 24/7</span>
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Giải phóng không gian sống và làm việc với hệ thống phòng kho hiện đại: Khóa điện tử IoT mã hóa AES-256 GCM, kiểm soát nhiệt ẩm 24/7 và nhận mã PIN vào kho trong 60 giây.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
            <Link
              to="/units"
              className="px-6 py-3.5 rounded-lg bg-[var(--brand-teal,#0891b2)] hover:bg-[var(--brand-teal-hover,#0e7490)] text-white font-semibold text-sm shadow-sm hover:shadow-md btn-tactile transition-all flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-teal,#0891b2)] focus-visible:ring-offset-2"
            >
              <span className="material-symbols-outlined text-[18px]">travel_explore</span>
              <span>Vào Dashboard Tìm &amp; Thuê Kho</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>

            <a
              href="#process"
              className="px-5 py-3.5 rounded-lg bg-white border border-slate-300 hover:border-slate-400 text-slate-800 font-semibold text-sm btn-tactile shadow-xs transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <span className="material-symbols-outlined text-[18px] text-[var(--brand-teal,#0891b2)]">info</span>
              <span>Tìm Hiểu Quy Trình 3 Bước</span>
            </a>
          </div>

          {/* Telemetry Strip (HUD) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto pt-8">
            {TELEMETRY_METRICS.map((m) => (
              <div
                key={m.label}
                className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 shadow-xs text-left space-y-1 transition-all hover:border-slate-300"
              >
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{m.label}</span>
                  <span className="material-symbols-outlined text-[18px] text-[var(--brand-teal,#0891b2)]">{m.icon}</span>
                </div>
                <div className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums tracking-tight">
                  {m.value}
                </div>
                <p className="text-xs text-slate-500 font-normal">{m.detail}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. SEAMLESS 3-STEP PROCESS (QUY TRÌNH THUÊ KHO KHÉP KÍN)     */}
      {/* ============================================================ */}
      <section id="process" className="py-20 lg:py-24 border-b border-slate-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-[var(--brand-teal,#0891b2)] font-mono text-xs font-semibold tracking-wider uppercase">
              QUY TRÌNH THUÊ KHO KHÉP KÍN // 3 BƯỚC ĐƠN GIẢN
            </span>
            <h2 className="font-headline text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Bắt Đầu Thuê Kho Chỉ Trong 3 Bước
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Không thủ tục giấy tờ rườm rà. Toàn bộ quy trình hoàn tất trực tuyến minh bạch, chuẩn xác và bảo mật.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            
            {/* Step 1 */}
            <div className="p-7 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 hover:border-cyan-300 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 text-[var(--brand-teal,#0891b2)] font-mono font-bold flex items-center justify-center text-sm">
                01
              </div>
              <h3 className="font-headline text-lg font-bold text-slate-900">
                Tìm Kho &amp; Đo Khoảng Cách
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Định vị vị trí của bạn trên Dashboard, đo cự ly di chuyển tới từng cơ sở Boxora và lựa chọn kích thước buồng kho phù hợp nhất với nhu cầu cất giữ.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-7 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 hover:border-cyan-300 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 text-[var(--brand-teal,#0891b2)] font-mono font-bold flex items-center justify-center text-sm">
                02
              </div>
              <h3 className="font-headline text-lg font-bold text-slate-900">
                Ký Hợp Đồng &amp; Đặt Cọc Số Hóa
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ký kết thỏa thuận hợp đồng điện tử bảo chứng pháp lý, thanh toán an toàn qua cổng ngân hàng bảo mật và nhận hóa đơn VAT điện tử tự động.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-7 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 hover:border-cyan-300 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 text-[var(--brand-teal,#0891b2)] font-mono font-bold flex items-center justify-center text-sm">
                03
              </div>
              <h3 className="font-headline text-lg font-bold text-slate-900">
                Nhận Mã PIN &amp; Vào Kho 24/7
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Hệ thống tự động cấp mã PIN số hóa bảo mật AES-256 tức thì. Bạn có thể tự do mở cửa kho và quản lý tài sản bất kỳ lúc nào ngày hay đêm qua app.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. IOT ACCESS & SMART SECURITY ARCHITECTURE                  */}
      {/* ============================================================ */}
      <section id="iot-access" className="py-20 lg:py-24 border-b border-slate-200/80 bg-[var(--surface-canvas,#f8fafc)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-[var(--brand-teal,#0891b2)] font-mono text-xs font-semibold tracking-wider uppercase">
              AN NINH CHUẨN XÁC // THE PRECISION VAULT
            </span>
            <h2 className="font-headline text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Công Nghệ Khóa Điện Tử IoT &amp; Bảo Mật Đa Tầng
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Mỗi buồng kho Boxora đều được tích hợp khóa điện tử kết nối mạng độc lập và hệ thống cảm biến môi trường, đảm bảo tài sản của bạn luôn an toàn tuyệt đối mà không cần sử dụng chìa khóa cơ truyền thống.
            </p>
          </div>

          {/* 4 Core IoT Security Pillars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            
            {/* Pillar 1 */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-cyan-300 transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-50 text-[var(--brand-teal,#0891b2)] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[26px]">pin</span>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-cyan-800 font-bold uppercase tracking-wider block">KHÔNG CẦN CHÌA KHÓA</span>
                  <h3 className="font-headline text-base font-bold text-slate-900">Mã PIN &amp; Mở Qua Ứng Dụng</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Cấp mã PIN số hóa bảo mật ngay sau khi thuê. Ra vào kho 24/7 chỉ với mã số trên bàn phím cảm ứng hoặc một chạm trên điện thoại mà không lo thất lạc chìa khóa.
                </p>
              </div>
              <div className="font-mono text-[11px] text-cyan-800 bg-cyan-50 px-2.5 py-1 rounded border border-cyan-100 font-semibold">
                ✓ Mã hóa chuẩn AES-256
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-cyan-300 transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[26px]">lock_clock</span>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">CHỐNG QUÊN CỬA</span>
                  <h3 className="font-headline text-base font-bold text-slate-900">Tự Động Chốt Khóa Sau Đóng</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Cảm biến từ tính phát hiện trạng thái cánh cửa và tự động kích hoạt chốt khóa sau 3 giây. Hệ thống sẽ phát cảnh báo âm thanh và gửi thông báo nếu bạn vô tình để hở cửa quá lâu.
                </p>
              </div>
              <div className="font-mono text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-100 font-semibold">
                ✓ Tự động khóa sau 3 giây
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-cyan-300 transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[26px]">share</span>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-indigo-800 font-bold uppercase tracking-wider block">CHIA SẺ TIỆN LỢI</span>
                  <h3 className="font-headline text-base font-bold text-slate-900">Cấp Mã Phụ Dùng Một Lần</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Dễ dàng tạo mã PIN tạm thời hoặc mã 1 lần gửi cho người thân, shipper hoặc nhân viên khi cần nhờ nhận hoặc lấy đồ, và chủ động thu hồi quyền bất kỳ lúc nào.
                </p>
              </div>
              <div className="font-mono text-[11px] text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-100 font-semibold">
                ✓ Quản lý &amp; Thu hồi tức thì
              </div>
            </div>

            {/* Pillar 4 */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-cyan-300 transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[26px]">sensors</span>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-amber-800 font-bold uppercase tracking-wider block">VI KHÍ HẬU &amp; NHẬT KÝ</span>
                  <h3 className="font-headline text-base font-bold text-slate-900">Cảm Biến Môi Trường &amp; Lịch Sử</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Duy trì nhiệt độ 20-22°C và độ ẩm dưới 50% RH chống ẩm mốc đồ đạc. Toàn bộ mốc thời gian mở và khóa cửa đều được ghi nhận minh bạch trên nhật ký ứng dụng.
                </p>
              </div>
              <div className="font-mono text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-100 font-semibold">
                ✓ 21.5°C • 45% RH • Nhật ký 24/7
              </div>
            </div>

          </div>

          {/* Infrastructure Security Callout */}
          <div className="p-6 sm:p-7 rounded-2xl bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="flex items-center gap-4 text-left">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[28px]">shield</span>
              </div>
              <div className="space-y-1">
                <h4 className="font-headline text-base font-bold text-white">
                  An Ninh Đa Lớp: Camera AI, PCCC Tự Động &amp; Tuần Tra 24/7
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                  Ngoài khóa IoT tại từng buồng, toàn bộ hành lang cơ sở Boxora đều được giám sát bằng camera nhận diện chuyển động, vòi phun PCCC đạt chuẩn và nhân sự kiểm soát ra vào 24/7/365.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-cyan-300 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>TIÊU CHUẨN ISO/IEC 27001</span>
            </div>
          </div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* 4. DỊCH VỤ LƯU TRỮ BOXORA (SERVICES)                         */}
      {/* ============================================================ */}
      <section id="services" className="py-20 lg:py-24 border-b border-slate-200/80 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-[var(--brand-teal,#0891b2)] font-mono text-xs font-semibold tracking-wider uppercase">
              DANH MỤC DỊCH VỤ // THE PRECISION VAULT
            </span>
            <h2 className="font-headline text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Giải Pháp Lưu Trữ Toàn Diện Cho Cá Nhân &amp; Doanh Nghiệp
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Mỗi buồng kho tại Boxora được thiết kế chuyên biệt theo tiêu chuẩn quốc tế, đáp ứng linh hoạt từ nhu cầu cất giữ tư trang cá nhân đến kho logistics trung chuyển hàng hóa.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            
            {/* Service 1 */}
            <div className="p-7 rounded-2xl bg-white border border-slate-200/80 hover:border-cyan-400 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-50 text-[var(--brand-teal,#0891b2)] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[26px]">lock_person</span>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-cyan-800 font-bold uppercase tracking-wider block">TIỆN ÍCH CÁ NHÂN</span>
                  <h3 className="font-headline text-lg font-bold text-slate-900 mt-0.5">Kho Cá Nhân 24/7</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Lưu giữ an toàn đồ dùng theo mùa, vali du lịch, nội thất khi sửa nhà, bộ sưu tập cá nhân. Ra vào tự do mọi lúc không cần đặt lịch hẹn trước.
                </p>
                <div className="space-y-2 pt-2 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-[var(--brand-teal,#0891b2)]">check_circle</span>
                    <span>Diện tích linh hoạt từ 1.5m²</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-[var(--brand-teal,#0891b2)]">check_circle</span>
                    <span>Mã PIN số hóa cá nhân độc quyền</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-[var(--brand-teal,#0891b2)]">check_circle</span>
                    <span>Miễn phí xe đẩy hàng tại chỗ</span>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-cyan-800">
                <span>Thuê theo tháng linh hoạt</span>
                <span className="font-mono text-[11px] bg-cyan-50 px-2 py-0.5 rounded text-cyan-800">Từ 450k/tháng</span>
              </div>
            </div>

            {/* Service 2 */}
            <div className="p-7 rounded-2xl bg-white border border-cyan-200/90 hover:border-cyan-400 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-6 ring-1 ring-cyan-500/10">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[26px]">ac_unit</span>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-blue-700 font-bold uppercase tracking-wider block">KIỂM SOÁT NHIỆT ẨM</span>
                  <h3 className="font-headline text-lg font-bold text-slate-900 mt-0.5">Kho Mát Vi Khí Hậu</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Duy trì ổn định 16°C – 22°C và độ ẩm 45% – 55% RH liên tục 24/7. Giải pháp tối ưu chống nấm mốc cho máy ảnh, đồ da, tài liệu, tranh ảnh và thiết bị điện tử.
                </p>
                <div className="space-y-2 pt-2 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-blue-600">check_circle</span>
                    <span>16°C – 22°C // Độ ẩm &lt; 50% RH</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-blue-600">check_circle</span>
                    <span>Cảm biến IoT cảnh báo lệch nhiệt</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-blue-600">check_circle</span>
                    <span>Lọc khí khử ẩm đa tầng</span>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-800">
                <span>Bảo quản chuẩn studio</span>
                <span className="font-mono text-[11px] bg-blue-50 px-2 py-0.5 rounded text-blue-800">Chuẩn bảo quản cao cấp</span>
              </div>
            </div>

            {/* Service 3 */}
            <div className="p-7 rounded-2xl bg-white border border-slate-200/80 hover:border-cyan-400 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[26px]">corporate_fare</span>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-indigo-700 font-bold uppercase tracking-wider block">DOANH NGHIỆP &amp; E-COMMERCE</span>
                  <h3 className="font-headline text-lg font-bold text-slate-900 mt-0.5">Kho Doanh Nghiệp &amp; Hồ Sơ</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Lưu trữ hồ sơ chứng từ kế toán 10 năm, thiết bị sự kiện, hàng tồn kho bán lẻ trực tuyến. Hỗ trợ hợp đồng pháp nhân, xuất hóa đơn VAT điện tử nhanh chóng.
                </p>
                <div className="space-y-2 pt-2 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-indigo-600">check_circle</span>
                    <span>Cửa cuốn &amp; Bãi xe tải 2.5 tấn</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-indigo-600">check_circle</span>
                    <span>Hóa đơn VAT &amp; Ký HĐ điện tử</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-indigo-600">check_circle</span>
                    <span>Cấp mã PIN phụ cho shipper/nhân viên</span>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-800">
                <span>Hợp đồng pháp lý chuẩn</span>
                <span className="font-mono text-[11px] bg-indigo-50 px-2 py-0.5 rounded text-indigo-800">VAT đầy đủ</span>
              </div>
            </div>

            {/* Service 4 */}
            <div className="p-7 rounded-2xl bg-white border border-slate-200/80 hover:border-cyan-400 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[26px]">local_shipping</span>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-amber-700 font-bold uppercase tracking-wider block">HẬU CẦN &amp; TIẾP VẬN</span>
                  <h3 className="font-headline text-lg font-bold text-slate-900 mt-0.5">Tiếp Vận &amp; Đóng Gói</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Cung ứng thùng carton chịu lực 5 lớp, màng cuốn PE, bọc bóng khí bubble wrap. Hỗ trợ nhận hàng ký gửi thay khách từ các đơn vị vận chuyển đối tác.
                </p>
                <div className="space-y-2 pt-2 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-amber-600">check_circle</span>
                    <span>Vật tư đóng gói tiêu chuẩn tại chỗ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-amber-600">check_circle</span>
                    <span>Nhận ký gửi hàng thay khách 24/7</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-amber-600">check_circle</span>
                    <span>Sảnh bốc dỡ hàng có mái che</span>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-amber-800">
                <span>Hỗ trợ trọn gói tận nơi</span>
                <span className="font-mono text-[11px] bg-amber-50 px-2 py-0.5 rounded text-amber-800">Tiện ích kèm theo</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* 5. VISUAL STORAGE UNIT SIZE SPECIFICATIONS                   */}
      {/* ============================================================ */}
      <section id="size-guide" className="py-20 lg:py-24 border-b border-slate-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-[var(--brand-teal,#0891b2)] font-mono text-xs font-semibold tracking-wider uppercase">
              QUY CÁCH BUỒNG KHO // THE PRECISION VAULT
            </span>
            <h2 className="font-headline text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Bảng Kích Thước &amp; Sức Chứa Buồng Kho Chuẩn
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Mỗi buồng kho Boxora đều có chiều cao trần tiêu chuẩn từ 2.7m – 3.0m giúp tối ưu thể tích lưu trữ theo chiều dọc. Dưới đây là 4 quy mô buồng kho thực tế để bạn lựa chọn đúng diện tích theo lượng đồ đạc cần cất giữ.
            </p>
          </div>

          {/* 4 Visual Size Tiers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            
            {/* Tier 1: Mini Locker */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-cyan-300 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[22px]">inventory_2</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                    1.5 – 3.0 m²
                  </span>
                </div>
                <div>
                  <h3 className="font-headline text-lg font-bold text-slate-900">Locker Mini &amp; Đồ Cá Nhân</h3>
                  <span className="font-mono text-xs text-cyan-800 font-semibold block mt-0.5">
                    Kích thước: 1.2m x 1.5m • Trần 2.7m (~4 – 8 m³)
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Thiết kế nhỏ gọn, tối ưu chi phí lưu giữ tư trang cá nhân, vali du lịch lớn, tài liệu công việc và đồ dùng mùa vụ.
                </p>
                <div className="space-y-2 pt-1 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-[var(--brand-teal,#0891b2)]">check_circle</span>
                    <span>4–6 Vali lớn + 10 Thùng carton</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-[var(--brand-teal,#0891b2)]">check_circle</span>
                    <span>Đồ thể thao, đồ phượt, máy tính</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-[var(--brand-teal,#0891b2)]">check_circle</span>
                    <span>Cá nhân, sinh viên, người đi công tác</span>
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-200/70">
                <Link
                  to="/units?type=LOCKER"
                  className="w-full py-2 px-3 rounded-lg bg-white hover:bg-cyan-50 border border-slate-300 hover:border-cyan-300 text-cyan-900 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                >
                  <span>Xem Kho Trống Hạng Này</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Tier 2: Standard Storage */}
            <div className="p-6 rounded-2xl bg-cyan-50/30 border border-cyan-200/90 hover:border-cyan-400 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between space-y-5 ring-1 ring-cyan-500/10">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500 text-white flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[22px]">garage_home</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-cyan-900 bg-white px-2.5 py-1 rounded-lg border border-cyan-200">
                    4.0 – 6.0 m²
                  </span>
                </div>
                <div>
                  <h3 className="font-headline text-lg font-bold text-slate-900">Buồng Kho Tiêu Chuẩn</h3>
                  <span className="font-mono text-xs text-cyan-800 font-semibold block mt-0.5">
                    Kích thước: 2.0m x 2.5m • Trần 2.7m (~11 – 16 m³)
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Không gian buồng kho đa dụng nhất: Chứa được xe máy, nội thất văn phòng, tủ kệ tháo lắp và hàng chục thùng đồ đóng gói.
                </p>
                <div className="space-y-2 pt-1 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-[var(--brand-teal,#0891b2)]">check_circle</span>
                    <span>1–2 Xe máy + Bàn ghế + Tủ mini</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-[var(--brand-teal,#0891b2)]">check_circle</span>
                    <span>25–30 Thùng carton đồ đạc</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-[var(--brand-teal,#0891b2)]">check_circle</span>
                    <span>Chuyển nơi ở, sửa nhà từng phần, shop online</span>
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-cyan-200/70">
                <Link
                  to="/units?type=STANDARD"
                  className="w-full py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                >
                  <span>Xem Kho Trống Hạng Này</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Tier 3: Large Family Storage */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-cyan-300 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[22px]">warehouse</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                    8.0 – 12.0 m²
                  </span>
                </div>
                <div>
                  <h3 className="font-headline text-lg font-bold text-slate-900">Buồng Kho Lớn Đa Năng</h3>
                  <span className="font-mono text-xs text-indigo-800 font-semibold block mt-0.5">
                    Kích thước: 3.0m x 3.5m • Trần 2.7m (~22 – 32 m³)
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Dung tích rộng rãi cho đồ đạc gia đình cỡ lớn, nội thất cồng kềnh, thiết bị sự kiện triển lãm hoặc máy móc bán tải.
                </p>
                <div className="space-y-2 pt-1 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-indigo-600">check_circle</span>
                    <span>Sofa chữ L + Giường đệm + Tủ 3 cánh</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-indigo-600">check_circle</span>
                    <span>Tủ lạnh side-by-side + 50 thùng hàng</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-indigo-600">check_circle</span>
                    <span>Cải tạo toàn bộ nhà ở, đi định cư nước ngoài</span>
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-200/70">
                <Link
                  to="/units?type=LARGE"
                  className="w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 hover:border-slate-400 text-slate-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                >
                  <span>Xem Kho Trống Hạng Này</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Tier 4: Enterprise Bulk Storage */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-cyan-300 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[22px]">domain</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                    15.0 – 25.0 m²
                  </span>
                </div>
                <div>
                  <h3 className="font-headline text-lg font-bold text-slate-900">Kho Doanh Nghiệp &amp; Sỉ</h3>
                  <span className="font-mono text-xs text-amber-800 font-semibold block mt-0.5">
                    Kích thước: 4.0m x 5.0m • Trần 3.0m (~45 – 75 m³)
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Thiết kế cửa cuốn độc lập, chịu tải trọng lớn, bốc dỡ hàng trực tiếp từ xe tải vận tải 2.5T – 5T có mái che chuyên dụng.
                </p>
                <div className="space-y-2 pt-1 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-amber-700">check_circle</span>
                    <span>6–10 Pallet hàng tiêu chuẩn</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-amber-700">check_circle</span>
                    <span>Cửa cuốn riêng &amp; Bãi đỗ xe tải 2.5T</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-amber-700">check_circle</span>
                    <span>Doanh nghiệp E-commerce, kho hồ sơ kế toán</span>
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-200/70">
                <Link
                  to="/units?type=ENTERPRISE"
                  className="w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 hover:border-slate-400 text-slate-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                >
                  <span>Xem Kho Trống Hạng Này</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
            </div>

          </div>

          {/* Quick Specification Reference Table */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left border-b border-slate-200/80 pb-4">
              <div>
                <span className="font-mono text-xs font-bold text-[var(--brand-teal,#0891b2)] uppercase tracking-wider block">
                  BẢNG ĐỐI CHIẾU THÔNG SỐ KỸ THUẬT
                </span>
                <h3 className="font-headline text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
                  So Sánh Chi Tiết Kích Thước &amp; Tiêu Chuẩn Từng Hạng Kho
                </h3>
              </div>
              <Link
                to="/units"
                className="px-4 py-2 rounded-xl bg-[var(--brand-teal,#0891b2)] hover:bg-[var(--brand-teal-hover,#0e7490)] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs"
              >
                <span>Vào Dashboard Chọn Buồng Kho</span>
                <span className="material-symbols-outlined text-[15px]">open_in_new</span>
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 font-mono text-[11px] text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-3">Hạng Buồng Kho</th>
                    <th className="py-3 px-3">Diện Tích Sàn</th>
                    <th className="py-3 px-3">Chiều Cao Trần</th>
                    <th className="py-3 px-3">Thể Tích Chứa</th>
                    <th className="py-3 px-3">Loại Cửa Ra Vào</th>
                    <th className="py-3 px-3">Tiếp Cận Vận Chuyển</th>
                    <th className="py-3 px-3 text-right">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-slate-700 font-sans">
                  <tr className="hover:bg-white/60 transition-colors">
                    <td className="py-3.5 px-3 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-500" />
                      <span>Locker Mini</span>
                    </td>
                    <td className="py-3.5 px-3 font-mono font-semibold">1.5 – 3.0 m²</td>
                    <td className="py-3.5 px-3 font-mono">2.7 m</td>
                    <td className="py-3.5 px-3 font-mono font-bold text-cyan-800">4.0 – 8.0 m³</td>
                    <td className="py-3.5 px-3">Cửa thép đơn khóa IoT</td>
                    <td className="py-3.5 px-3">Xe đẩy 4 bánh miễn phí</td>
                    <td className="py-3.5 px-3 text-right">
                      <Link to="/units?type=LOCKER" className="text-cyan-800 font-semibold hover:underline">Chọn kho →</Link>
                    </td>
                  </tr>

                  <tr className="hover:bg-white/60 transition-colors bg-cyan-50/20">
                    <td className="py-3.5 px-3 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Kho Tiêu Chuẩn</span>
                    </td>
                    <td className="py-3.5 px-3 font-mono font-semibold">4.0 – 6.0 m²</td>
                    <td className="py-3.5 px-3 font-mono">2.7 m</td>
                    <td className="py-3.5 px-3 font-mono font-bold text-cyan-800">11.0 – 16.0 m³</td>
                    <td className="py-3.5 px-3">Cửa bản lề rộng 1.0m</td>
                    <td className="py-3.5 px-3">Xe máy, bán tải, thang tải 2T</td>
                    <td className="py-3.5 px-3 text-right">
                      <Link to="/units?type=STANDARD" className="text-cyan-800 font-semibold hover:underline">Chọn kho →</Link>
                    </td>
                  </tr>

                  <tr className="hover:bg-white/60 transition-colors">
                    <td className="py-3.5 px-3 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      <span>Kho Lớn Đa Năng</span>
                    </td>
                    <td className="py-3.5 px-3 font-mono font-semibold">8.0 – 12.0 m²</td>
                    <td className="py-3.5 px-3 font-mono">2.7 m</td>
                    <td className="py-3.5 px-3 font-mono font-bold text-cyan-800">22.0 – 32.0 m³</td>
                    <td className="py-3.5 px-3">Cửa thép đôi rộng 1.6m</td>
                    <td className="py-3.5 px-3">Xe nâng tay, xe tải nhỏ</td>
                    <td className="py-3.5 px-3 text-right">
                      <Link to="/units?type=LARGE" className="text-cyan-800 font-semibold hover:underline">Chọn kho →</Link>
                    </td>
                  </tr>

                  <tr className="hover:bg-white/60 transition-colors">
                    <td className="py-3.5 px-3 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>Kho Doanh Nghiệp</span>
                    </td>
                    <td className="py-3.5 px-3 font-mono font-semibold">15.0 – 25.0 m²</td>
                    <td className="py-3.5 px-3 font-mono">3.0 m</td>
                    <td className="py-3.5 px-3 font-mono font-bold text-cyan-800">45.0 – 75.0 m³</td>
                    <td className="py-3.5 px-3">Cửa cuốn tự động 2.4m</td>
                    <td className="py-3.5 px-3">Bãi xe tải 2.5T – 5T tiếp cận</td>
                    <td className="py-3.5 px-3 text-right">
                      <Link to="/units?type=ENTERPRISE" className="text-cyan-800 font-semibold hover:underline">Chọn kho →</Link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* 6. CHÍNH SÁCH DỊCH VỤ MINH BẠCH (POLICIES)                  */}
      {/* ============================================================ */}
      <section id="policies" className="py-20 lg:py-24 border-b border-slate-200/80 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-[var(--brand-teal,#0891b2)] font-mono text-xs font-semibold tracking-wider uppercase">
              CHÍNH SÁCH MINH BẠCH // BẢO VỆ KHÁCH HÀNG
            </span>
            <h2 className="font-headline text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Chính Sách Thuê Kho Rõ Ràng &amp; Minh Bạch Tuyệt Đối
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Boxora cam kết đặt quyền lợi và sự an tâm của khách hàng lên hàng đầu. Mọi điều khoản về tài chính, an toàn và bảo hiểm đều được quy định minh bạch và bảo hộ pháp lý.
            </p>
          </div>

          {/* Interactive Policy Tabs */}
          <div className="max-w-5xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            
            {/* Tabs Navigation Header */}
            <div className="grid grid-cols-2 md:grid-cols-4 border-b border-slate-200 bg-slate-100/70 p-1.5 gap-1.5">
              <button
                type="button"
                onClick={() => setActivePolicyTab('deposit')}
                className={`py-3 px-4 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activePolicyTab === 'deposit'
                    ? 'bg-white text-cyan-900 shadow-2xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] text-[var(--brand-teal,#0891b2)]">payments</span>
                <span>Hoàn Cọc &amp; Chi Phí</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePolicyTab('insurance')}
                className={`py-3 px-4 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activePolicyTab === 'insurance'
                    ? 'bg-white text-cyan-900 shadow-2xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] text-emerald-600">verified_user</span>
                <span>Bảo Hiểm Tài Sản</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePolicyTab('contract')}
                className={`py-3 px-4 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activePolicyTab === 'contract'
                    ? 'bg-white text-cyan-900 shadow-2xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] text-indigo-600">history_edu</span>
                <span>Gia Hạn &amp; Hủy HĐ</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePolicyTab('prohibited')}
                className={`py-3 px-4 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activePolicyTab === 'prohibited'
                    ? 'bg-white text-cyan-900 shadow-2xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] text-rose-600">block</span>
                <span>Hàng Cấm &amp; PCCC</span>
              </button>
            </div>

            {/* Tab 1: Hoàn cọc & Chi phí */}
            {activePolicyTab === 'deposit' && (
              <div className="p-7 sm:p-10 space-y-6 text-left animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-50 text-[var(--brand-teal,#0891b2)] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[24px]">savings</span>
                  </div>
                  <div>
                    <h3 className="font-headline text-lg sm:text-xl font-bold text-slate-900">
                      Chính Sách Đặt Cọc &amp; Hoàn Trả Tiền Cọc 100% Trong 24 Giờ
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">ÁP DỤNG CHO TOÀN BỘ KHÁCH HÀNG CÁ NHÂN VÀ DOANH NGHIỆP</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-mono text-xs font-bold text-cyan-800">01 // TIỀN CỌC CHUẨN</div>
                    <div className="text-sm font-bold text-slate-800">Chỉ 01 Tháng Tiền Thuê</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Tiền cọc giữ chỗ và bảo đảm buồng kho cố định tương đương 01 tháng tiền thuê, được niêm phong trong tài khoản ký quỹ riêng biệt.
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-mono text-xs font-bold text-emerald-800">02 // HOÀN TIỀN TRONG 24H</div>
                    <div className="text-sm font-bold text-slate-800">Chuyển Khoản Trực Tiếp</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Khi thanh lý hợp đồng và nghiệm thu buồng kho còn nguyên vẹn, Boxora cam kết hoàn trả 100% tiền cọc vào tài khoản ngân hàng trong vòng 24h làm việc.
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-mono text-xs font-bold text-indigo-800">03 // KHÔNG CHI PHÍ ẨN</div>
                    <div className="text-sm font-bold text-slate-800">Trọn Gói Minh Bạch</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Giá niêm yết đã bao gồm tiền điện chiếu sáng, điều hòa thông gió, phí an ninh 24/7, bảo trì khóa IoT và vệ sinh hành lang.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Bảo hiểm */}
            {activePolicyTab === 'insurance' && (
              <div className="p-7 sm:p-10 space-y-6 text-left animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[24px]">verified_user</span>
                  </div>
                  <div>
                    <h3 className="font-headline text-lg sm:text-xl font-bold text-slate-900">
                      Gói Bảo Hiểm Tài Sản &amp; Cơ Chế Đền Bù Minh Bạch
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">BẢO TRỢ BỞI CÁC CÔNG TY BẢO HIỂM TÀI SẢN UY TÍN HÀNG ĐẦU</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-mono text-xs font-bold text-emerald-800">GÓI TIÊU CHUẨN // MIỄN PHÍ</div>
                    <div className="text-sm font-bold text-slate-800">Bồi Thường Đến 50 Triệu VNĐ</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Mỗi buồng kho ký hợp đồng đều được tự động kích hoạt gói bảo hiểm cơ bản lên đến 50.000.000 VNĐ cho rủi ro cháy nổ, ngập úng hoặc sự cố kỹ thuật.
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-mono text-xs font-bold text-cyan-800">GÓI MỞ RỘNG // THEO YÊU CẦU</div>
                    <div className="text-sm font-bold text-slate-800">Bảo Vệ Lên Đến 500 Triệu VNĐ</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Dành cho doanh nghiệp hoặc cá nhân cất giữ hàng hóa giá trị cao, thiết bị quang học, máy móc chính xác với mức phí phụ trợ cực kỳ ưu đãi.
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-mono text-xs font-bold text-slate-800">QUY TRÌNH BỒI THƯỜNG</div>
                    <div className="text-sm font-bold text-slate-800">Giải Quyết Nhanh Chóng</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Khi có sự cố khách quan được xác nhận bởi đơn vị giám định độc lập, biên bản bồi thường được giải quyết và chi trả trong vòng 7 - 14 ngày làm việc.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Gia hạn & Hủy hợp đồng */}
            {activePolicyTab === 'contract' && (
              <div className="p-7 sm:p-10 space-y-6 text-left animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[24px]">history_edu</span>
                  </div>
                  <div>
                    <h3 className="font-headline text-lg sm:text-xl font-bold text-slate-900">
                      Thời Hạn Thuê Linh Hoạt, Tự Động Gia Hạn &amp; Chấm Dứt Hợp Đồng Dễ Dàng
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">ĐIỀU KHOẢN THỰC HIỆN HỢP ĐỒNG MINH BẠCH VÀ CHỦ ĐỘNG</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-mono text-xs font-bold text-indigo-800">THỜI HẠN TỐI THIỂU</div>
                    <div className="text-sm font-bold text-slate-800">Chỉ Từ 01 Tháng</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Khách hàng có thể thuê ngắn hạn từng tháng để sửa nhà, đi công tác, hoặc ký dài hạn từ 6 - 12 tháng để nhận chiết khấu lên đến 15%.
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-mono text-xs font-bold text-cyan-800">GIA HẠN TỰ ĐỘNG</div>
                    <div className="text-sm font-bold text-slate-800">Thông Báo Trước 5 Ngày</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Hệ thống tự động nhắc hạn thanh toán qua Email/SMS 5 ngày trước ngày kết thúc kỳ thuê. Khách hàng dễ dàng thanh toán gia hạn trực tiếp trên ứng dụng.
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-mono text-xs font-bold text-rose-800">CHỦ ĐỘNG HỦY HỢP ĐỒNG</div>
                    <div className="text-sm font-bold text-slate-800">Báo Trước 07 Ngày</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Bạn có quyền kết thúc hợp đồng bất kỳ khi nào có nhu cầu, chỉ cần gửi thông báo trước 07 ngày trên portal quản lý mà không phát sinh bất kỳ khoản phí phạt nào.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Hàng cấm & PCCC */}
            {activePolicyTab === 'prohibited' && (
              <div className="p-7 sm:p-10 space-y-6 text-left animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[24px]">gavel</span>
                  </div>
                  <div>
                    <h3 className="font-headline text-lg sm:text-xl font-bold text-slate-900">
                      Danh Mục Hàng Hóa Nghiêm Cấm &amp; Tiêu Chuẩn An Toàn PCCC
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">BẢO VỆ TUYỆT ĐỐI AN TOÀN TÍNH MẠNG VÀ TÀI SẢN TOÀN HỆ THỐNG</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  <div className="p-5 rounded-2xl bg-rose-50/50 border border-rose-200 space-y-2">
                    <div className="font-mono text-xs font-bold text-rose-700">CHẤT DỄ CHÁY NỔ &amp; HÓA CHẤT</div>
                    <div className="text-sm font-bold text-slate-900">Tuyệt Đối Nghiêm Cấm</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Cấm lưu trữ xăng dầu, bình gas, pháo hoa, pin lithium hỏng/lỗi, dung môi sơn, hóa chất ăn mòn và các chất nguy hại dễ bắt lửa.
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl bg-rose-50/50 border border-rose-200 space-y-2">
                    <div className="font-mono text-xs font-bold text-rose-700">HÀNG HÓA BẤT HỢP PHÁP</div>
                    <div className="text-sm font-bold text-slate-900">Tuân Thủ Pháp Luật</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Cấm động vật sống, xác động vật, thực phẩm tươi sống dễ ôi thiu phát sinh mùi hôi, vũ khí, hàng lậu hoặc đồ vật vi phạm pháp luật Việt Nam.
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-mono text-xs font-bold text-cyan-800">CƠ CHẾ GIÁM SÁT PCCC</div>
                    <div className="text-sm font-bold text-slate-800">Cảm Biến Khói Nhiệt Tự Động</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      100% buồng kho trang bị đầu dò khói nhiệt thông minh kết nối trung tâm PCCC TP. Hồ Chí Minh. Hệ thống phun sương tự động sẵn sàng 24/7.
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* 7. HỎI ĐÁP & HỖ TRỢ KHÁCH HÀNG (FAQ & SUPPORT)               */}
      {/* ============================================================ */}
      <section id="faq" className="py-20 lg:py-24 border-b border-slate-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-[var(--brand-teal,#0891b2)] font-mono text-xs font-semibold tracking-wider uppercase">
              THÔNG TIN CẦN BIẾT // HỎI ĐÁP &amp; HỖ TRỢ
            </span>
            <h2 className="font-headline text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Câu Hỏi Thường Gặp &amp; Kênh Hỗ Trợ Khách Hàng
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Giải đáp nhanh những băn khoăn phổ biến nhất của người dùng khi bắt đầu thuê buồng kho tự quản tại Boxora.
            </p>
          </div>

          {/* FAQ Accordion */}
          <div className="max-w-4xl mx-auto space-y-4 text-left">
            
            {/* Question 1 */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50/50 transition-colors">
              <button
                type="button"
                onClick={() => setActiveFaqIndex(activeFaqIndex === 0 ? null : 0)}
                className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 font-headline text-base sm:text-lg font-bold text-slate-900 cursor-pointer hover:text-cyan-800"
              >
                <span>Tôi có thể ra vào buồng kho vào ban đêm hoặc ngày Lễ/Tết không?</span>
                <span className="material-symbols-outlined text-slate-400 shrink-0 transition-transform">
                  {activeFaqIndex === 0 ? 'expand_less' : 'expand_more'}
                </span>
              </button>
              {activeFaqIndex === 0 && (
                <div className="px-5 sm:px-6 pb-6 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-200/60 pt-4 bg-white">
                  Hoàn toàn <strong>ĐƯỢC</strong>. Boxora ứng dụng công nghệ khóa số IoT thông minh độc lập cho từng buồng kho, hoạt động liên tục 24/7/365. Bạn có thể tự do mở cửa buồng kho của mình vào bất kỳ lúc nào lúc nửa đêm, sáng sớm hay ngày Lễ Tết chỉ bằng mã PIN cá nhân hoặc ứng dụng điện thoại mà không cần báo trước hay đợi nhân viên mở cửa.
                </div>
              )}
            </div>

            {/* Question 2 */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50/50 transition-colors">
              <button
                type="button"
                onClick={() => setActiveFaqIndex(activeFaqIndex === 1 ? null : 1)}
                className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 font-headline text-base sm:text-lg font-bold text-slate-900 cursor-pointer hover:text-cyan-800"
              >
                <span>Thời hạn thuê kho tối thiểu tại Boxora là bao lâu?</span>
                <span className="material-symbols-outlined text-slate-400 shrink-0 transition-transform">
                  {activeFaqIndex === 1 ? 'expand_less' : 'expand_more'}
                </span>
              </button>
              {activeFaqIndex === 1 && (
                <div className="px-5 sm:px-6 pb-6 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-200/60 pt-4 bg-white">
                  Thời hạn thuê tối thiểu là <strong>01 tháng</strong>. Bạn có thể chọn thuê theo tháng lẻ, theo quý hoặc ký hợp đồng dài hạn 6–12 tháng để nhận mức chiết khấu tiết kiệm từ 5% đến 15% tổng chi phí.
                </div>
              )}
            </div>

            {/* Question 3 */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50/50 transition-colors">
              <button
                type="button"
                onClick={() => setActiveFaqIndex(activeFaqIndex === 2 ? null : 2)}
                className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 font-headline text-base sm:text-lg font-bold text-slate-900 cursor-pointer hover:text-cyan-800"
              >
                <span>Tôi có thể đổi sang buồng kho lớn hơn hoặc nhỏ hơn khi đang thuê không?</span>
                <span className="material-symbols-outlined text-slate-400 shrink-0 transition-transform">
                  {activeFaqIndex === 2 ? 'expand_less' : 'expand_more'}
                </span>
              </button>
              {activeFaqIndex === 2 && (
                <div className="px-5 sm:px-6 pb-6 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-200/60 pt-4 bg-white">
                  Hoàn toàn thuận tiện. Khách hàng có thể yêu cầu nâng cấp hoặc thu nhỏ buồng kho bất kỳ lúc nào trên Dashboard. Hệ thống sẽ tự động đối soát số dư tiền thuê và tiền cọc còn lại của hợp đồng cũ sang buồng kho mới ngay trong ngày mà không mất phí chuyển đổi buồng.
                </div>
              )}
            </div>

            {/* Question 4 */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50/50 transition-colors">
              <button
                type="button"
                onClick={() => setActiveFaqIndex(activeFaqIndex === 3 ? null : 3)}
                className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 font-headline text-base sm:text-lg font-bold text-slate-900 cursor-pointer hover:text-cyan-800"
              >
                <span>Mã PIN của tôi có bảo mật không? Nhân viên Boxora có biết mã mở khóa không?</span>
                <span className="material-symbols-outlined text-slate-400 shrink-0 transition-transform">
                  {activeFaqIndex === 3 ? 'expand_less' : 'expand_more'}
                </span>
              </button>
              {activeFaqIndex === 3 && (
                <div className="px-5 sm:px-6 pb-6 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-200/60 pt-4 bg-white">
                  Mã PIN mở khóa được mã hóa theo kiến trúc <strong>Zero-Knowledge Encryption (AES-256 GCM)</strong>. Nhân viên Boxora và nhân sự quản trị cơ sở <strong>không thể xem được mã PIN cá nhân của bạn</strong>. Chỉ duy nhất bạn sở hữu mã và có thể chủ động đổi mã số mới trực tiếp trên điện thoại bất cứ lúc nào.
                </div>
              )}
            </div>

            {/* Question 5 */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50/50 transition-colors">
              <button
                type="button"
                onClick={() => setActiveFaqIndex(activeFaqIndex === 4 ? null : 4)}
                className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 font-headline text-base sm:text-lg font-bold text-slate-900 cursor-pointer hover:text-cyan-800"
              >
                <span>Cơ sở có sẵn xe đẩy hàng và thang nâng hàng hỗ trợ chuyển đồ không?</span>
                <span className="material-symbols-outlined text-slate-400 shrink-0 transition-transform">
                  {activeFaqIndex === 4 ? 'expand_less' : 'expand_more'}
                </span>
              </button>
              {activeFaqIndex === 4 && (
                <div className="px-5 sm:px-6 pb-6 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-200/60 pt-4 bg-white">
                  <strong>CÓ</strong>. Tất cả các cơ sở Boxora đều trang bị sẵn xe đẩy hàng 4 bánh tải trọng 300kg, xe nâng tay thủy lực và thang tải trọng 2 tấn chuyên dụng tại khu vực đón bốc dỡ hàng, phục vụ khách hàng hoàn toàn miễn phí.
                </div>
              )}
            </div>

          </div>

          {/* 4 Multi-Channel Support Touchpoints */}
          <div className="max-w-5xl mx-auto pt-4">
            <div className="text-center mb-6">
              <span className="font-mono text-xs text-slate-500 font-bold uppercase tracking-wider">
                CÁC KÊNH KẾT NỐI &amp; HỖ TRỢ TRỰC TIẾP
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 text-left">
              
              {/* Channel 1: Hotline */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-100 text-[var(--brand-teal,#0891b2)] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">call</span>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-cyan-800 font-bold uppercase tracking-wider block">TỔNG ĐÀI KHẨN CẤP</span>
                  <div className="text-base font-bold text-slate-900 mt-0.5">1900-BOXORA</div>
                  <div className="font-mono text-[11px] text-slate-500">1900 269 672 • 24/7/365</div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Trực kỹ thuật IoT và tiếp nhận hỗ trợ sự cố khẩn cấp mọi lúc, mọi nơi.
                </p>
              </div>

              {/* Channel 2: Email */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">mail</span>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-blue-800 font-bold uppercase tracking-wider block">HÒM THƯ TIẾP NHẬN</span>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">support@boxora.vn</div>
                  <div className="font-mono text-[11px] text-slate-500">Phản hồi trong 60 phút</div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Tiếp nhận yêu cầu hợp đồng doanh nghiệp, hóa đơn VAT và phản hồi ý kiến.
                </p>
              </div>

              {/* Channel 3: Zalo OA */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">chat</span>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">ZALO DOANH NGHIỆP</span>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">Boxora Smart Storage</div>
                  <div className="font-mono text-[11px] text-slate-500">Zalo Official Account</div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Tư vấn viên gửi hình ảnh buồng kho thực tế và hướng dẫn qua tin nhắn tiện lợi.
                </p>
              </div>

              {/* Channel 4: Lễ tân */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">schedule</span>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-amber-800 font-bold uppercase tracking-wider block">GIỜ TRỰC TẠI QUẦY</span>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">08:00 – 20:00 Hàng Ngày</div>
                  <div className="font-mono text-[11px] text-slate-500">Cả T7, CN &amp; Ngày Lễ</div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Nhân viên trực tiếp đón khách xem buồng kho mẫu và hỗ trợ đóng gói.
                </p>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ============================================================ */}
      {/* 8. BOTTOM CONVERSION CTA BANNER                              */}
      {/* ============================================================ */}
      <section className="py-20 lg:py-24 bg-[var(--surface-canvas,#f8fafc)] text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-100 text-[var(--brand-teal,#0891b2)] font-mono text-[11px] font-semibold uppercase">
            <span className="material-symbols-outlined text-[14px]">verified</span>
            <span>ƯU ĐÃI THÁNG ĐẦU TIÊN CHO KHÁCH HÀNG MỚI</span>
          </div>

          <h2 className="font-headline text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Sẵn Sàng Mở Rộng Không Gian Sống Của Bạn?
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
            Đặt giữ chỗ trực tuyến ngay hôm nay để nhận mã PIN tự động và bắt đầu lưu kho an toàn trong 60 giây.
          </p>

          <div className="flex flex-wrap justify-center gap-3.5 pt-2">
            <Link
              to="/units"
              className="px-7 py-3.5 rounded-lg bg-[var(--brand-teal,#0891b2)] hover:bg-[var(--brand-teal-hover,#0e7490)] text-white font-semibold text-sm btn-tactile shadow-sm hover:shadow-md transition-all flex items-center gap-2"
            >
              <span>Vào Dashboard Tìm &amp; Thuê Kho</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>

            <a
              href="tel:1900BOXORA"
              className="px-6 py-3.5 rounded-lg bg-white border border-slate-300 hover:border-slate-400 text-slate-800 font-semibold text-sm btn-tactile shadow-xs transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px] text-[var(--brand-teal,#0891b2)]">call</span>
              <span>Hotline 1900-BOXORA</span>
            </a>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 9. SITE FOOTER (4 COLUMNS ENTERPRISE ARCHITECTURE)           */}
      {/* ============================================================ */}
      <footer className="pt-16 pb-12 border-t border-slate-200 bg-white text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 text-left">
            
            {/* Column 1: Brand & Credentials */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--brand-teal,#0891b2)] flex items-center justify-center text-white font-bold">
                  <span className="material-symbols-outlined text-[20px]">lock</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-headline text-lg font-bold text-slate-900 leading-none">
                    Boxora<span className="text-[var(--brand-teal,#0891b2)]">.</span>
                  </span>
                  <span className="font-mono text-[9px] text-cyan-800 font-semibold uppercase tracking-wider mt-0.5">
                    Smart Storage Systems
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Hệ thống phòng kho tự quản thông minh đầu tiên tại Việt Nam ứng dụng khóa bảo mật IoT, kiểm soát vi khí hậu 24/7 và cấp mã PIN truy cập số hóa tức thời.
              </p>
              <div className="inline-flex items-center gap-2 font-mono text-[11px] px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-emerald-700 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>CHỨNG NHẬN ISO/IEC 27001 SECURE</span>
              </div>
            </div>

            {/* Column 2: Danh Mục Dịch Vụ */}
            <div className="space-y-4">
              <h4 className="font-headline text-sm font-bold text-slate-900 uppercase tracking-wider">
                Danh Mục Dịch Vụ
              </h4>
              <ul className="space-y-2.5 text-xs text-slate-600">
                <li>
                  <a href="#services" className="hover:text-cyan-800 transition-colors flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-cyan-700">chevron_right</span>
                    <span>Kho Cá Nhân 24/7</span>
                  </a>
                </li>
                <li>
                  <a href="#services" className="hover:text-cyan-800 transition-colors flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-cyan-700">chevron_right</span>
                    <span>Kho Mát Vi Khí Hậu (16–22°C)</span>
                  </a>
                </li>
                <li>
                  <a href="#services" className="hover:text-cyan-800 transition-colors flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-cyan-700">chevron_right</span>
                    <span>Kho Doanh Nghiệp &amp; Hồ Sơ</span>
                  </a>
                </li>
                <li>
                  <a href="#services" className="hover:text-cyan-800 transition-colors flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-cyan-700">chevron_right</span>
                    <span>Dịch Vụ Tiếp Vận &amp; Đóng Gói</span>
                  </a>
                </li>
                <li>
                  <a href="#size-guide" className="hover:text-cyan-800 transition-colors flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-cyan-700">chevron_right</span>
                    <span>Bộ Ước Tính Kích Cỡ Kho</span>
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3: Chính Sách & Quy Định */}
            <div className="space-y-4">
              <h4 className="font-headline text-sm font-bold text-slate-900 uppercase tracking-wider">
                Chính Sách &amp; Quy Định
              </h4>
              <ul className="space-y-2.5 text-xs text-slate-600">
                <li>
                  <a href="#policies" onClick={() => setActivePolicyTab('deposit')} className="hover:text-cyan-800 transition-colors flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-cyan-700">chevron_right</span>
                    <span>Chính Sách Hoàn Cọc Trong 24h</span>
                  </a>
                </li>
                <li>
                  <a href="#policies" onClick={() => setActivePolicyTab('insurance')} className="hover:text-cyan-800 transition-colors flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-cyan-700">chevron_right</span>
                    <span>Bảo Hiểm Tài Sản 50–200 Triệu</span>
                  </a>
                </li>
                <li>
                  <a href="#policies" onClick={() => setActivePolicyTab('contract')} className="hover:text-cyan-800 transition-colors flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-cyan-700">chevron_right</span>
                    <span>Gia Hạn &amp; Hủy Hợp Đồng</span>
                  </a>
                </li>
                <li>
                  <a href="#policies" onClick={() => setActivePolicyTab('prohibited')} className="hover:text-cyan-800 transition-colors flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-cyan-700">chevron_right</span>
                    <span>Danh Mục Hàng Cấm &amp; PCCC</span>
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-cyan-800 transition-colors flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-cyan-700">chevron_right</span>
                    <span>Câu Hỏi Thường Gặp (FAQs)</span>
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 4: Hệ Thống Cơ Sở & Liên Hệ */}
            <div className="space-y-4">
              <h4 className="font-headline text-sm font-bold text-slate-900 uppercase tracking-wider">
                Hệ Thống Cơ Sở
              </h4>
              <div className="space-y-3 text-xs text-slate-600">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-800">Cơ Sở 1 // Thủ Đức Hub:</div>
                  <p className="text-slate-500">Lô D2, Khu Công Nghệ Cao, P. Tăng Nhơn Phú B, TP. Thủ Đức, TP.HCM</p>
                </div>
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-800">Cơ Sở 2 // Nam Sài Gòn (Q.7):</div>
                  <p className="text-slate-500">120 Đường Số 7, KDC Trung Sơn, Xã Bình Hưng, TP.HCM</p>
                </div>
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-800">Cơ Sở 3 // Tân Bình Hub:</div>
                  <p className="text-slate-500">45 Bạch Đằng, Phường 2, Quận Tân Bình, TP.HCM</p>
                </div>
                <div className="pt-2 text-cyan-800 font-mono font-bold text-xs">
                  Hotline: 1900-BOXORA (24/7)
                </div>
              </div>
            </div>

          </div>

          {/* Sub-footer Bottom Line */}
          <div className="pt-8 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px] text-slate-500">
            <div>
              © 2026 Boxora Smart Storage. Tất cả các quyền được bảo lưu // The Precision Vault.
            </div>
            <div className="flex items-center gap-6">
              <Link to="/units" className="hover:text-slate-900 text-cyan-800 font-bold transition-colors">
                Dashboard Tìm Kho
              </Link>
              <Link to="/login" className="hover:text-slate-900 transition-colors">
                Đăng Nhập
              </Link>
              <Link to="/register" className="hover:text-slate-900 transition-colors">
                Đăng Ký
              </Link>
            </div>
          </div>

        </div>
      </footer>

      {/* Floating Action Speed-Dial Widget (Scroll Top, Zalo, Hotline, Maps) */}
      <FloatingContactWidget />

    </div>
  )
}