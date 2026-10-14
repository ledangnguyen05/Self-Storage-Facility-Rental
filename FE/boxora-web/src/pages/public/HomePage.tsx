import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, MotionConfig, useInView } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { checkCustomerPortalAccess } from '../../utils/rentalAccess'
import { FloatingContactWidget } from '../../components/common/FloatingContactWidget'
import { facilityService } from '../../services/facilityService'
import { storageUnitService } from '../../services/storageUnitService'
import { BrandLogo } from '../../components/common/BrandLogo'
import { SmartLockerDynamicHero } from '../../components/home/SmartLockerDynamicHero'
import { AccountProfileModal } from '../../components/common/AccountProfileModal'

// ============================================================================
// ANIMATED COUNTER COMPONENT (Counts up smoothly when scrolled into view)
// ============================================================================
interface AnimatedCounterProps {
  value: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 1.4,
  decimals = 0,
  prefix = '',
  suffix = ''
}) => {
  const [displayValue, setDisplayValue] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.3 })

  useEffect(() => {
    if (!inView) return
    let startTimestamp: number | null = null
    const startValue = 0
    const endValue = value

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1)
      const easeProgress = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      const current = startValue + (endValue - startValue) * easeProgress
      setDisplayValue(current)
      if (progress < 1) {
        frameId = window.requestAnimationFrame(step)
      } else {
        setDisplayValue(endValue)
      }
    }
    let frameId = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(frameId)
  }, [inView, value, duration])

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {decimals > 0 ? displayValue.toFixed(decimals) : Math.round(displayValue)}
      {suffix}
    </span>
  )
}

// ============================================================================
// MAIN HOMEPAGE COMPONENT
// ============================================================================
const headerNavigationItems = [
  { href: '#services', label: 'Dịch vụ' },
  { href: '#process', label: 'Cách hoạt động' },
  { href: '#iot-access', label: 'Công nghệ' },
  { href: '#faq', label: 'Hỗ trợ' }
]

export const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, user, logout } = useAuth()
  const [dropdown1Open, setDropdown1Open] = useState(false)
  const [notifySetting, setNotifySetting] = useState(true)
  const [soundSetting, setSoundSetting] = useState(true)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [headerScrolled, setHeaderScrolled] = useState(false)

  useEffect(() => {
    const updateHeaderScrollState = () => setHeaderScrolled(window.scrollY > 20)

    updateHeaderScrollState()
    window.addEventListener('scroll', updateHeaderScrollState, { passive: true })
    window.addEventListener('resize', updateHeaderScrollState)
    return () => {
      window.removeEventListener('scroll', updateHeaderScrollState)
      window.removeEventListener('resize', updateHeaderScrollState)
    }
  }, [])

  // Real Database Metrics State
  const [telemetry, setTelemetry] = useState({
    totalUnits: 56,
    availableUnits: 14,
    facilitiesCount: 3
  })

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const [facRes, unitRes] = await Promise.all([
          facilityService.getFacilities({ size: 100 }),
          storageUnitService.getUnits()
        ])
        const facList = facRes?.content || []
        const unitList = Array.isArray(unitRes) ? unitRes : []
        if (unitList.length > 0) {
          const avail = unitList.filter(u => u.status === 'AVAILABLE').length
          setTelemetry({
            totalUnits: unitList.length,
            availableUnits: avail,
            facilitiesCount: facList.length || 3
          })
        }
      } catch (e) {
        console.error('Failed to load real telemetry in HomePage:', e)
      }
    }
    fetchTelemetry()
  }, [])

  // Customer rental access state
  const isCustomer = user?.role?.name === 'CUSTOMER'
  const [customerAccess, setCustomerAccess] = useState(() => checkCustomerPortalAccess(user))
  const canAccessPortal = !isCustomer || customerAccess.hasAccess

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

  // Interactive Size Guide State
  const [selectedSizeTier, setSelectedSizeTier] = useState<'LOCKER' | 'STANDARD' | 'LARGE' | 'ENTERPRISE'>('STANDARD')

  // Policies active tab state
  const [activePolicyTab, setActivePolicyTab] = useState<'deposit' | 'insurance' | 'contract' | 'prohibited'>('deposit')

  // FAQ active filter and item state
  const [faqFilter, setFaqFilter] = useState<'ALL' | 'IOT' | 'CONTRACT' | 'FACILITY'>('ALL')
  const [activeFaqIndex, setActiveFaqIndex] = useState<number | null>(0)

  // Motion animation presets
  const sectionFadeIn = {
    hidden: { opacity: 0, y: 22 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const }
    }
  }

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.04
      }
    }
  }

  const cardItem = {
    hidden: { opacity: 0, y: 14 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const }
    }
  }

  // Size Tier Specifications Data
  const sizeTierData = {
    LOCKER: {
      name: 'Locker Mini & Đồ Cá Nhân',
      area: '1.5 – 3.0 m²',
      volume: '4.0 – 8.0 m³',
      dims: '1.2m x 1.5m • Cao 2.7m',
      desc: 'Giải pháp nhỏ gọn, tối ưu chi phí lưu giữ tư trang cá nhân, vali du lịch lớn, tài liệu công việc và đồ thể thao.',
      fits: ['4–6 Vali lớn', '10 Thùng carton tiêu chuẩn', 'Đồ thể thao, máy ảnh, laptop', 'Giấy tờ hồ sơ đóng hộp'],
      rate: 'Từ 450.000đ / tháng',
      door: 'Cửa thép đơn khóa IoT mã PIN',
      bestFor: 'Sinh viên, cá nhân, người đi công tác, chuyên gia',
      color: 'cyan'
    },
    STANDARD: {
      name: 'Buồng Kho Tiêu Chuẩn',
      area: '4.0 – 6.0 m²',
      volume: '11.0 – 16.0 m³',
      dims: '2.0m x 2.5m • Cao 2.7m',
      desc: 'Không gian đa dụng nhất: Chứa được xe máy, nội thất gia đình tháo lắp, tủ kệ mini và hàng chục thùng đồ gia dụng.',
      fits: ['1–2 Xe máy hoặc xe đạp điện', 'Bàn làm việc, ghế công thái học', 'Tủ quần áo mini, kệ sách', '25–30 Thùng carton đồ đạc'],
      rate: 'Từ 950.000đ / tháng',
      door: 'Cửa bản lề rộng 1.0m, mở 180°',
      bestFor: 'Gia đình sửa nhà, chuyển trọ, shop bán hàng online',
      color: 'emerald'
    },
    LARGE: {
      name: 'Buồng Kho Lớn Đa Năng',
      area: '8.0 – 12.0 m²',
      volume: '22.0 – 32.0 m³',
      dims: '3.0m x 3.5m • Cao 2.7m',
      desc: 'Dung tích rộng rãi cho đồ đạc nguyên căn hộ, nội thất cồng kềnh, thiết bị tổ chức sự kiện hoặc máy móc văn phòng.',
      fits: ['Sofa chữ L, giường đệm Queen/King', 'Tủ lạnh side-by-side, máy giặt', 'Bộ bàn ăn 6 ghế, tủ kệ lớn', '50–70 Thùng hàng hóa'],
      rate: 'Từ 1.850.000đ / tháng',
      door: 'Cửa thép đôi rộng 1.6m tiện bốc xếp',
      bestFor: 'Cải tạo toàn bộ nhà ở, đi định cư nước ngoài, studio ảnh',
      color: 'blue'
    },
    ENTERPRISE: {
      name: 'Kho Doanh Nghiệp & Sỉ',
      area: '15.0 – 25.0 m²',
      volume: '45.0 – 75.0 m³',
      dims: '4.0m x 5.0m • Cao 3.0m',
      desc: 'Thiết kế cửa cuốn tự động riêng biệt, chịu tải trọng lớn, xe tải 2.5T – 5T đỗ bốc dỡ hàng trực tiếp tại sảnh có mái che.',
      fits: ['6–10 Pallet hàng tiêu chuẩn', 'Hồ sơ chứng từ lưu trữ 10 năm', 'Hàng tồn kho E-commerce số lượng lớn', 'Thiết bị triển lãm, hội chợ'],
      rate: 'Từ 3.600.000đ / tháng',
      door: 'Cửa cuốn motor tự động 2.4m',
      bestFor: 'Doanh nghiệp thương mại, công ty phân phối, đại lý bán sỉ',
      color: 'lime'
    }
  }

  // FAQ Items Data with Category Tags
  const faqList = [
    {
      cat: 'IOT',
      q: 'Tôi có thể ra vào buồng kho vào ban đêm hoặc ngày Lễ/Tết không?',
      a: 'Hoàn toàn ĐƯỢC. Boxora ứng dụng công nghệ khóa số IoT thông minh độc lập cho từng buồng kho, hoạt động liên tục 24/7/365. Bạn có thể tự do mở cửa buồng kho của mình vào bất kỳ lúc nào lúc nửa đêm, sáng sớm hay ngày Lễ Tết chỉ bằng mã PIN cá nhân hoặc ứng dụng điện thoại mà không cần báo trước hay đợi nhân viên mở cửa.'
    },
    {
      cat: 'CONTRACT',
      q: 'Thời hạn thuê kho tối thiểu tại Boxora là bao lâu?',
      a: 'Thời hạn thuê tối thiểu là 01 tháng. Bạn có thể chọn thuê theo tháng lẻ, theo quý hoặc ký hợp đồng dài hạn 6–12 tháng để nhận mức chiết khấu tiết kiệm từ 5% đến 15% tổng chi phí.'
    },
    {
      cat: 'CONTRACT',
      q: 'Tôi có thể đổi sang buồng kho lớn hơn hoặc nhỏ hơn khi đang thuê không?',
      a: 'Hoàn toàn thuận tiện. Khách hàng có thể yêu cầu nâng cấp hoặc thu nhỏ buồng kho bất kỳ lúc nào trên Dashboard. Hệ thống sẽ tự động đối soát số dư tiền thuê và tiền cọc còn lại của hợp đồng cũ sang buồng kho mới ngay trong ngày mà không mất phí chuyển đổi buồng.'
    },
    {
      cat: 'IOT',
      q: 'Mã PIN của tôi có bảo mật không? Nhân viên Boxora có biết mã mở khóa không?',
      a: 'Mã PIN mở khóa được mã hóa theo kiến trúc Zero-Knowledge Encryption (AES-256 GCM). Nhân viên Boxora và nhân sự quản trị cơ sở không thể xem được mã PIN cá nhân của bạn. Chỉ duy nhất bạn sở hữu mã và có thể chủ động đổi mã số mới trực tiếp trên điện thoại bất cứ lúc nào.'
    },
    {
      cat: 'FACILITY',
      q: 'Cơ sở có sẵn xe đẩy hàng và thang nâng hàng hỗ trợ chuyển đồ không?',
      a: 'CÓ. Tất cả các cơ sở Boxora đều trang bị sẵn xe đẩy hàng 4 bánh tải trọng 300kg, xe nâng tay thủy lực và thang tải trọng 2 tấn chuyên dụng tại khu vực đón bốc dỡ hàng, phục vụ khách hàng hoàn toàn miễn phí.'
    }
  ]

  const filteredFaqs = faqFilter === 'ALL' ? faqList : faqList.filter(f => f.cat === faqFilter)

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-600 selection:text-white overflow-x-clip">
      
      {/* ============================================================ */}
      {/* 1. TOP UNIFIED NAVIGATION BAR (STICKY WITH BACKDROP BLUR)    */}
      {/* ============================================================ */}
      <header
        className={`sticky top-0 z-[100] border-b backdrop-blur-xl transition-all duration-300 ${
          headerScrolled
            ? 'border-cyan-100/80 bg-white/95 shadow-[0_10px_32px_rgba(8,102,245,0.13)] ring-1 ring-inset ring-cyan-500/10'
            : 'border-slate-200/70 bg-white/90 shadow-none'
        }`}
      >
        <div
          className={`mx-auto flex max-w-[1440px] items-center justify-between px-4 transition-all duration-300 sm:px-6 lg:px-10 ${
            headerScrolled ? 'h-14' : 'h-16'
          }`}
        >
          
          {/* Brand Logo */}
          <div
            className={`origin-left transition-transform duration-300 motion-reduce:transition-none ${
              headerScrolled ? 'translate-x-1 scale-[.96]' : 'translate-x-0 scale-100'
            }`}
          >
            <BrandLogo size="sm" subtitle="KHO TỰ QUẢN THÔNG MINH" />
          </div>

          {/* Nav Links (Desktop) */}
          <nav aria-label="Điều hướng chính" className="hidden items-center gap-7 text-[13px] font-medium text-slate-600 lg:flex">
            {headerNavigationItems.map((item, index) => (
              <a
                key={item.href}
                href={item.href}
                style={{ transitionDelay: `${headerScrolled ? index * 45 : (headerNavigationItems.length - index - 1) * 35}ms` }}
                className={`transition-all duration-300 hover:text-slate-950 motion-reduce:transition-none ${
                  headerScrolled ? '-translate-y-1 scale-[.97]' : 'translate-y-0 scale-100'
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Action CTAs */}
          <div className={`flex items-center gap-3 transition-transform duration-300 motion-reduce:transition-none ${headerScrolled ? '-translate-x-1 scale-[.96]' : 'translate-x-0 scale-100'}`}>
            {isAuthenticated ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdown1Open(prev => !prev)}
                  className={`flex items-center gap-2.5 p-1.5 pr-3 rounded-full border shadow-2xs transition-all cursor-pointer text-left focus:outline-none ${
                  !canAccessPortal
                    ? 'bg-lime-50/90 hover:bg-lime-100 border-lime-200 focus:ring-2 focus:ring-lime-500/30'
                    : 'bg-white hover:bg-slate-50 border-slate-200 focus:ring-2 focus:ring-cyan-500/30'
                }`}
              >
                <div className="relative">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-2xs ${
                      !canAccessPortal ? 'bg-lime-700 text-white' : 'bg-slate-900 text-white'
                    }`}
                  >
                    {user?.fullName ? user.fullName[0].toUpperCase() : user?.username ? user.username[0].toUpperCase() : 'U'}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                      !canAccessPortal ? 'bg-lime-500' : 'bg-emerald-500'
                    }`}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900 leading-tight">
                    {user?.fullName || user?.username || 'Khách Hàng'}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-semibold ${
                      !canAccessPortal ? 'text-lime-800' : 'text-cyan-800'
                    }`}
                  >
                    {!canAccessPortal ? 'Khách Mới • Thuê Kho' : (user?.role?.name || 'CUSTOMER')}
                  </span>
                </div>
                <span
                  className={`material-symbols-outlined text-[18px] transition-transform duration-150 ${
                    !canAccessPortal ? 'text-lime-700' : 'text-slate-400'
                  } ${dropdown1Open ? 'rotate-180' : ''}`}
                >
                  expand_more
                </span>
              </button>

              {/* Dropdown 1 Popover */}
              {dropdown1Open && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-4 animate-in fade-in slide-in-from-top-1 duration-150 flex flex-col gap-3">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-xs ${
                        !canAccessPortal ? 'bg-lime-700 text-white' : 'bg-slate-900 text-white'
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
                            ? 'bg-lime-50 text-lime-900 border-lime-200'
                            : 'bg-cyan-50 text-cyan-900 border-cyan-200'
                        }`}
                      >
                        {!canAccessPortal ? 'KHÁCH HÀNG MỚI (CHƯA CÓ KHO)' : (user?.role?.name || 'CUSTOMER')}
                      </span>
                    </div>
                  </div>

                  {!canAccessPortal ? (
                    <div className="p-3.5 rounded-xl bg-lime-50/90 border border-lime-200/80 text-left space-y-2.5">
                      <div className="flex items-center gap-1.5 text-lime-900 font-bold text-xs">
                        <span className="material-symbols-outlined text-[18px] text-lime-700">info</span>
                        <span>Tài Khoản Chưa Kích Hoạt Kho</span>
                      </div>
                      <p className="text-[11px] text-lime-900 leading-relaxed font-normal">
                        Quý khách hiện chưa có hợp đồng kho đang hoạt động. Vui lòng truy cập Dashboard tìm kiếm &amp; thuê kho để định vị khoảng cách, chọn phòng kho và nhận mã PIN mở app.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setDropdown1Open(false)
                          navigate('/units')
                        }}
                        className="w-full py-2 px-3 rounded-lg bg-lime-700 hover:bg-lime-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
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

                  <button
                    type="button"
                    onClick={() => {
                      setDropdown1Open(false)
                      setIsProfileModalOpen(true)
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Chỉnh sửa hồ sơ
                  </button>

                  <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Cài Đặt Trang Web &amp; Vận Hành
                    </span>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-700 flex items-center gap-1.5 font-medium">
                        <span className="material-symbols-outlined text-[16px] text-slate-500">notifications</span>
                        Thông báo IoT &amp; Sự kiện
                      </span>
                      <button
                        type="button"
                        aria-pressed={notifySetting}
                        onClick={() => setNotifySetting(prev => !prev)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${notifySetting ? 'bg-cyan-600' : 'bg-slate-300'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${notifySetting ? 'translate-x-4' : 'translate-x-0'}`}></div>
                      </button>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-700 flex items-center gap-1.5 font-medium">
                        <span className="material-symbols-outlined text-[16px] text-slate-500">volume_up</span>
                        Âm thanh cảnh báo khẩn
                      </span>
                      <button
                        type="button"
                        aria-pressed={soundSetting}
                        onClick={() => setSoundSetting(prev => !prev)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${soundSetting ? 'bg-cyan-600' : 'bg-slate-300'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${soundSetting ? 'translate-x-4' : 'translate-x-0'}`}></div>
                      </button>
                    </div>
                  </div>

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
            <Link to="/login" className="header-login-button">
              <span className="header-login-button__dots-border" aria-hidden="true" />
              <span className="header-login-button__text">Đăng Nhập</span>
            </Link>
          )}
        </div>

      </div>

      {/* Keep the restored navigation available on tablet and mobile widths. */}
      <nav
        aria-label="Điều hướng chính trên màn hình nhỏ"
        className={`flex max-w-full items-center gap-5 overflow-x-auto border-t border-slate-200/70 px-4 text-xs font-medium text-slate-600 transition-all duration-300 [scrollbar-width:none] lg:hidden ${
          headerScrolled ? 'bg-white/95 py-1.5' : 'py-2'
        }`}
      >
        {headerNavigationItems.map((item, index) => (
          <a
            key={item.href}
            href={item.href}
            style={{ transitionDelay: `${headerScrolled ? index * 45 : (headerNavigationItems.length - index - 1) * 35}ms` }}
            className={`shrink-0 transition-all duration-300 hover:text-slate-950 motion-reduce:transition-none ${
              headerScrolled ? '-translate-y-1 scale-[.97]' : 'translate-y-0 scale-100'
            }`}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </header>

    {/* ============================================================ */}
    {/* 2. BOXORA AUTONOMOUS INTERACTIVE HERO                         */}
    {/* ============================================================ */}
    <SmartLockerDynamicHero onBookNow={() => navigate('/units')} />

    <AccountProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />

    {/* ============================================================ */}
    {/* 3. REALTIME TELEMETRY STRIP (LIVE DATABASE METRICS HUD)      */}
    {/* ============================================================ */}
    <section id="telemetry" className="scroll-mt-16 relative bg-gradient-to-b from-[#eff7ff] via-[#f3fbff] to-white py-8 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={staggerContainer}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto"
        >
          {/* Card 1: Facilities */}
          <motion.div
            variants={cardItem}
            whileHover={{ y: -6, scale: 1.02 }}
            className="p-5 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-sm hover:shadow-lg hover:border-cyan-300 text-left space-y-1.5 transition-all group cursor-default"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 font-bold">Cơ Sở Trực Tuyến</span>
              <span className="material-symbols-outlined text-[20px] text-cyan-600 group-hover:scale-110 transition-transform">power</span>
            </div>
            <div className="font-mono text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-baseline gap-1">
              <AnimatedCounter value={telemetry.facilitiesCount} />
              <span className="text-base sm:text-lg font-sans font-semibold text-slate-600">Chi Nhánh</span>
            </div>
            <p className="text-xs text-slate-500 font-normal flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Hệ thống cơ sở Boxora</span>
            </p>
          </motion.div>

          {/* Card 2: Units Ready */}
          <motion.div
            variants={cardItem}
            whileHover={{ y: -6, scale: 1.02 }}
            className="p-5 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-sm hover:shadow-lg hover:border-cyan-300 text-left space-y-1.5 transition-all group cursor-default"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 font-bold">Kho Phòng Sẵn Sàng</span>
              <span className="material-symbols-outlined text-[20px] text-cyan-600 group-hover:scale-110 transition-transform">warehouse</span>
            </div>
            <div className="font-mono text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-baseline gap-1">
              <AnimatedCounter value={telemetry.availableUnits} />
              <span className="text-slate-400 font-light">/</span>
              <span className="text-slate-700">{telemetry.totalUnits}</span>
            </div>
            <p className="text-xs text-slate-500 font-normal">
              Buồng còn trống trên toàn hệ thống
            </p>
          </motion.div>

          {/* Card 3: Climate Sensor */}
          <motion.div
            variants={cardItem}
            whileHover={{ y: -6, scale: 1.02 }}
            className="p-5 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-sm hover:shadow-lg hover:border-cyan-300 text-left space-y-1.5 transition-all group cursor-default"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 font-bold">Ra Vào Linh Hoạt</span>
              <span className="material-symbols-outlined text-[20px] text-blue-600 group-hover:scale-110 transition-transform">schedule</span>
            </div>
            <div className="font-mono text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              24/7
            </div>
            <p className="text-xs text-slate-500 font-normal">
              Ra vào bằng mã PIN cá nhân
            </p>
          </motion.div>

          {/* Card 4: Security Standard */}
          <motion.div
            variants={cardItem}
            whileHover={{ y: -6, scale: 1.02 }}
            className="p-5 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-sm hover:shadow-lg hover:border-cyan-300 text-left space-y-1.5 transition-all group cursor-default"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 font-bold">Giá Thuê Tham Khảo</span>
              <span className="material-symbols-outlined text-[20px] text-blue-600 group-hover:scale-110 transition-transform">payments</span>
            </div>
            <div className="font-mono text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              450.000đ
            </div>
            <p className="text-xs text-slate-500 font-normal">
              Giá khởi điểm mỗi tháng
            </p>
          </motion.div>

        </motion.div>
      </div>
    </section>

    {/* ============================================================ */}
    {/* 4. DỊCH VỤ LƯU TRỮ BOXORA (SERVICES)                         */}
    {/* ============================================================ */}
    <section id="services" className="py-20 lg:py-24 border-b border-slate-200/80 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionFadeIn}
          className="text-center max-w-3xl mx-auto space-y-3"
        >
          <span className="text-[var(--brand-teal,#0866f5)] font-mono text-xs font-bold tracking-wider uppercase inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200">
            <span className="w-2 h-2 rounded-full bg-cyan-600 animate-pulse" />
            DANH MỤC DỊCH VỤ // THE PRECISION VAULT
          </span>
          <h2 className="font-headline text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Kho cá nhân, kho mát và giải pháp cho doanh nghiệp
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Xem sức chứa và giá tham khảo để chọn loại kho phù hợp.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left"
        >
          {/* Service 1 */}
          <motion.div
            variants={cardItem}
            whileHover={{ y: -6, scale: 1.02 }}
            className="p-7 rounded-3xl bg-white border border-slate-200/80 hover:border-cyan-400 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between space-y-6"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-[var(--brand-teal,#0866f5)] flex items-center justify-center">
                <span className="material-symbols-outlined text-[26px]">lock_person</span>
              </div>
              <div>
                <span className="font-mono text-[10px] text-cyan-800 font-bold uppercase tracking-wider block">TIỆN ÍCH CÁ NHÂN</span>
                <h3 className="font-headline text-lg font-bold text-slate-900 mt-0.5">Kho Cá Nhân 24/7</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Cất đồ theo mùa, vali, đồ đạc khi sửa nhà hoặc vật dụng cá nhân; ra vào kho 24/7.
              </p>
              <div className="space-y-2 pt-2 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[15px] text-[var(--brand-teal,#0866f5)]">check_circle</span>
                  <span>Diện tích linh hoạt từ 1.5m²</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[15px] text-[var(--brand-teal,#0866f5)]">check_circle</span>
                  <span>Mã PIN số hóa cá nhân độc quyền</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[15px] text-[var(--brand-teal,#0866f5)]">check_circle</span>
                  <span>Miễn phí xe đẩy hàng tại chỗ</span>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-cyan-800">
              <span>Thuê theo tháng linh hoạt</span>
              <span className="font-mono text-[11px] bg-cyan-50 px-2 py-0.5 rounded text-cyan-800">Từ 450.000đ/tháng</span>
            </div>
          </motion.div>

          {/* Service 2 */}
          <motion.div
            variants={cardItem}
            whileHover={{ y: -6, scale: 1.02 }}
            className="p-7 rounded-3xl bg-white border border-cyan-200/90 hover:border-cyan-400 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between space-y-6 ring-1 ring-cyan-500/10"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[26px]">ac_unit</span>
              </div>
              <div>
                <span className="font-mono text-[10px] text-blue-700 font-bold uppercase tracking-wider block">KIỂM SOÁT NHIỆT ẨM</span>
                <h3 className="font-headline text-lg font-bold text-slate-900 mt-0.5">Kho Mát Vi Khí Hậu</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Dành cho máy ảnh, đồ da, tài liệu và thiết bị điện tử cần môi trường nhiệt độ, độ ẩm được kiểm soát.
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
              <span className="font-mono text-[11px] bg-blue-50 px-2 py-0.5 rounded text-blue-800">Chuẩn cao cấp</span>
            </div>
          </motion.div>

          {/* Service 3 */}
          <motion.div
            variants={cardItem}
            whileHover={{ y: -6, scale: 1.02 }}
            className="p-7 rounded-3xl bg-white border border-slate-200/80 hover:border-cyan-400 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between space-y-6"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[26px]">corporate_fare</span>
              </div>
              <div>
                <span className="font-mono text-[10px] text-blue-700 font-bold uppercase tracking-wider block">DOANH NGHIỆP &amp; E-COMMERCE</span>
                <h3 className="font-headline text-lg font-bold text-slate-900 mt-0.5">Kho Doanh Nghiệp &amp; Hồ Sơ</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Lưu hồ sơ, thiết bị hoặc hàng tồn kho; hỗ trợ hợp đồng doanh nghiệp và hóa đơn VAT điện tử.
              </p>
              <div className="space-y-2 pt-2 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[15px] text-blue-600">check_circle</span>
                  <span>Cửa cuốn &amp; Bãi xe tải 2.5 tấn</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[15px] text-blue-600">check_circle</span>
                  <span>Hóa đơn VAT &amp; Ký HĐ điện tử</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[15px] text-blue-600">check_circle</span>
                  <span>Cấp mã PIN phụ cho shipper/nhân viên</span>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-800">
              <span>Hợp đồng pháp lý chuẩn</span>
              <span className="font-mono text-[11px] bg-blue-50 px-2 py-0.5 rounded text-blue-800">VAT đầy đủ</span>
            </div>
          </motion.div>

          {/* Service 4 */}
          <motion.div
            variants={cardItem}
            whileHover={{ y: -6, scale: 1.02 }}
            className="p-7 rounded-3xl bg-white border border-slate-200/80 hover:border-cyan-400 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between space-y-6"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-lime-50 text-lime-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[26px]">local_shipping</span>
              </div>
              <div>
                <span className="font-mono text-[10px] text-lime-700 font-bold uppercase tracking-wider block">HẬU CẦN &amp; TIẾP VẬN</span>
                <h3 className="font-headline text-lg font-bold text-slate-900 mt-0.5">Tiếp Vận &amp; Đóng Gói</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Có vật tư đóng gói tại chỗ và hỗ trợ tiếp nhận, bốc dỡ hàng theo nhu cầu.
              </p>
              <div className="space-y-2 pt-2 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[15px] text-lime-600">check_circle</span>
                  <span>Vật tư đóng gói tiêu chuẩn tại chỗ</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[15px] text-lime-600">check_circle</span>
                  <span>Nhận ký gửi hàng thay khách 24/7</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[15px] text-lime-600">check_circle</span>
                  <span>Sảnh bốc dỡ hàng có mái che</span>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-lime-800">
              <span>Hỗ trợ trọn gói tận nơi</span>
              <span className="font-mono text-[11px] bg-lime-50 px-2 py-0.5 rounded text-lime-800">Tiện ích kèm theo</span>
            </div>
          </motion.div>

        </motion.div>

      </div>
    </section>

    {/* ============================================================ */}
    {/* 5. SEAMLESS 3-STEP PROCESS (QUY TRÌNH THUÊ KHO KHÉP KÍN)     */}
    {/* ============================================================ */}
    <section id="process" className="py-20 lg:py-24 border-b border-slate-200/80 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
        
        {/* Section Heading */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionFadeIn}
          className="text-center max-w-2xl mx-auto space-y-3"
        >
          <span className="text-[var(--brand-teal,#0866f5)] font-mono text-xs font-bold tracking-wider uppercase inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200">
            <span className="w-2 h-2 rounded-full bg-cyan-600 animate-pulse" />
            THUÊ KHO TRỰC TUYẾN // 3 BƯỚC
          </span>
          <h2 className="font-headline text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Thuê kho qua 3 bước đơn giản
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Chọn kho, hoàn tất hợp đồng và nhận quyền truy cập ngay trên hệ thống.
          </p>
        </motion.div>

        {/* 3-Step Process */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left relative">
          
          {/* Step 1 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            whileHover={{ y: -6 }}
            className="p-7 rounded-3xl border border-slate-200/80 bg-slate-50 shadow-xs transition-all hover:border-cyan-300 relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-600 text-white font-mono font-black flex items-center justify-center text-base shadow-md shadow-cyan-600/30">
                01
              </div>
              <span className="text-[10px] font-mono font-bold text-cyan-800 bg-cyan-100/80 px-2.5 py-1 rounded-full">
                BƯỚC 1
              </span>
            </div>

            <h3 className="font-headline text-lg font-bold text-slate-900 mb-2">
              Chọn cơ sở và kích thước
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Xem các buồng còn trống, rồi chọn địa điểm và diện tích phù hợp với đồ cần lưu trữ.
            </p>

            <div className="pt-3 border-t border-slate-200/70 text-[11px] font-mono font-semibold text-cyan-800 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">location_on</span>
              <span>So sánh diện tích và sức chứa</span>
            </div>
          </motion.div>

          {/* Step 2 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            whileHover={{ y: -6 }}
            className="p-7 rounded-3xl border border-slate-200/80 bg-slate-50 shadow-xs transition-all hover:border-cyan-300 relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-600 text-white font-mono font-black flex items-center justify-center text-base shadow-md shadow-cyan-600/30">
                02
              </div>
              <span className="text-[10px] font-mono font-bold text-cyan-800 bg-cyan-100/80 px-2.5 py-1 rounded-full">
                BƯỚC 2
              </span>
            </div>

            <h3 className="font-headline text-lg font-bold text-slate-900 mb-2">
              Ký hợp đồng và thanh toán
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Đọc điều khoản, ký hợp đồng điện tử và thanh toán theo hướng dẫn trên hệ thống.
            </p>

            <div className="pt-3 border-t border-slate-200/70 text-[11px] font-mono font-semibold text-emerald-800 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>Điều khoản và chi phí rõ ràng</span>
            </div>
          </motion.div>

          {/* Step 3 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            whileHover={{ y: -6 }}
            className="p-7 rounded-3xl border border-slate-200/80 bg-slate-50 shadow-xs transition-all hover:border-cyan-300 relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-600 text-white font-mono font-black flex items-center justify-center text-base shadow-md shadow-cyan-600/30">
                03
              </div>
              <span className="text-[10px] font-mono font-bold text-cyan-800 bg-cyan-100/80 px-2.5 py-1 rounded-full">
                BƯỚC 3
              </span>
            </div>

            <h3 className="font-headline text-lg font-bold text-slate-900 mb-2">
              Nhận mã PIN và sử dụng kho
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Nhận mã PIN sau khi hoàn tất thuê, rồi chủ động ra vào kho 24/7 theo quyền truy cập của bạn.
            </p>

            <div className="pt-3 border-t border-slate-200/70 text-[11px] font-mono font-semibold text-blue-800 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">key</span>
              <span>Ra vào kho bằng mã PIN cá nhân</span>
            </div>
          </motion.div>

        </div>

      </div>
    </section>

    {/* ============================================================ */}
    {/* 6. IOT ACCESS & SMART SECURITY ARCHITECTURE                  */}
    {/* ============================================================ */}
    <section id="iot-access" className="py-20 lg:py-24 border-b border-slate-200/80 bg-[var(--surface-canvas,#f8fafc)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
        
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionFadeIn}
          className="text-center max-w-3xl mx-auto space-y-3"
        >
          <span className="text-[var(--brand-teal,#0866f5)] font-mono text-xs font-bold tracking-wider uppercase inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200">
            <span className="w-2 h-2 rounded-full bg-cyan-600 animate-pulse" />
            AN NINH CHUẨN XÁC // THE PRECISION VAULT
          </span>
          <h2 className="font-headline text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Công Nghệ Khóa Điện Tử IoT &amp; Bảo Mật Đa Tầng
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Mỗi buồng có khóa điện tử; bạn dùng mã PIN hoặc ứng dụng để ra vào. Cảm biến ghi nhận trạng thái cửa và môi trường lưu trữ.
          </p>
        </motion.div>

        {/* 4 Core IoT Security Pillars Grid */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left"
        >
          {/* Pillar 1 */}
          <motion.div
            variants={cardItem}
            whileHover={{ y: -6, scale: 1.02 }}
            className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs hover:border-cyan-400 hover:shadow-xl transition-all flex flex-col justify-between space-y-4 group"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-[var(--brand-teal,#0866f5)] flex items-center justify-center group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-[26px]">pin</span>
              </div>
              <div>
                <span className="font-mono text-[10px] text-cyan-800 font-bold uppercase tracking-wider block">KHÔNG CẦN CHÌA KHÓA</span>
                <h3 className="font-headline text-base font-bold text-slate-900 mt-0.5">Mã PIN &amp; Mở Qua App</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Dùng mã PIN riêng hoặc ứng dụng để mở kho, không cần mang theo chìa khóa cơ.
              </p>
            </div>
            <div className="font-mono text-[11px] text-cyan-800 bg-cyan-50 px-2.5 py-1.5 rounded-xl border border-cyan-100 font-semibold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-cyan-600">check_circle</span>
              <span>Mã hóa chuẩn AES-256</span>
            </div>
          </motion.div>

          {/* Pillar 2 */}
          <motion.div
            variants={cardItem}
            whileHover={{ y: -6, scale: 1.02 }}
            className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs hover:border-emerald-400 hover:shadow-xl transition-all flex flex-col justify-between space-y-4 group"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-[26px]">lock_clock</span>
              </div>
              <div>
                <span className="font-mono text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">CHỐNG QUÊN CỬA</span>
                <h3 className="font-headline text-base font-bold text-slate-900 mt-0.5">Tự Động Chốt Khóa Sau Đóng</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Cửa tự khóa sau khi đóng. Hệ thống ghi nhận trạng thái cửa và gửi cảnh báo khi cửa chưa đóng đúng cách.
              </p>
            </div>
            <div className="font-mono text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-100 font-semibold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-emerald-600">check_circle</span>
              <span>Tự động khóa sau 3 giây</span>
            </div>
          </motion.div>

          {/* Pillar 3 */}
          <motion.div
            variants={cardItem}
            whileHover={{ y: -6, scale: 1.02 }}
            className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs hover:border-blue-400 hover:shadow-xl transition-all flex flex-col justify-between space-y-4 group"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-[26px]">share</span>
              </div>
              <div>
                <span className="font-mono text-[10px] text-blue-800 font-bold uppercase tracking-wider block">CHIA SẺ TIỆN LỢI</span>
                <h3 className="font-headline text-base font-bold text-slate-900 mt-0.5">Cấp Mã Phụ Dùng Một Lần</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tạo mã tạm thời cho người thân hoặc nhân viên, rồi thu hồi quyền truy cập khi không còn cần dùng.
              </p>
            </div>
            <div className="font-mono text-[11px] text-blue-800 bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-100 font-semibold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-blue-600">check_circle</span>
              <span>Quản lý &amp; Thu hồi tức thì</span>
            </div>
          </motion.div>

          {/* Pillar 4 */}
          <motion.div
            variants={cardItem}
            whileHover={{ y: -6, scale: 1.02 }}
            className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs hover:border-lime-400 hover:shadow-xl transition-all flex flex-col justify-between space-y-4 group"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-lime-50 text-lime-600 flex items-center justify-center group-hover:bg-lime-600 group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-[26px]">sensors</span>
              </div>
              <div>
                <span className="font-mono text-[10px] text-lime-800 font-bold uppercase tracking-wider block">VI KHÍ HẬU &amp; NHẬT KÝ</span>
                <h3 className="font-headline text-base font-bold text-slate-900 mt-0.5">Cảm Biến Môi Trường</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Theo dõi nhiệt độ, độ ẩm và lịch sử ra vào trên ứng dụng để bạn tiện kiểm tra tình trạng kho.
              </p>
            </div>
            <div className="font-mono text-[11px] text-lime-800 bg-lime-50 px-2.5 py-1.5 rounded-xl border border-lime-100 font-semibold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-lime-600">check_circle</span>
              <span>21.5°C • 45% RH • Nhật ký 24/7</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Infrastructure Security Callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="p-6 sm:p-7 rounded-3xl bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl border border-slate-800"
        >
          <div className="flex items-center gap-4 text-left">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
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
          <div className="flex items-center gap-2 font-mono text-xs px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-cyan-300 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>TIÊU CHUẨN ISO/IEC 27001</span>
          </div>
        </motion.div>

      </div>
    </section>

    {/* ============================================================ */}
    {/* 7. VISUAL STORAGE UNIT SIZE SPECIFICATIONS & CALCULATOR       */}
    {/* ============================================================ */}
    <section id="size-guide" className="py-20 lg:py-24 border-b border-slate-200/80 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionFadeIn}
          className="text-center max-w-3xl mx-auto space-y-3"
        >
          <span className="text-[var(--brand-teal,#0866f5)] font-mono text-xs font-bold tracking-wider uppercase inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200">
            <span className="w-2 h-2 rounded-full bg-cyan-600 animate-pulse" />
            QUY CÁCH BUỒNG KHO // THE PRECISION VAULT
          </span>
          <h2 className="font-headline text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Bộ Ước Tính Kích Cỡ &amp; Sức Chứa Buồng Kho Chuẩn
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Chiều cao trần tiêu chuẩn từ 2.7m – 3.0m giúp tối ưu thể tích lưu trữ theo chiều dọc. Chọn kích cỡ buồng kho bên dưới để xem trực quan những vật dụng thực tế có thể cất giữ.
          </p>
        </motion.div>

        {/* Interactive Size Category Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-3xl mx-auto">
          {(['LOCKER', 'STANDARD', 'LARGE', 'ENTERPRISE'] as const).map((tierKey) => {
            const tier = sizeTierData[tierKey]
            const isSelected = selectedSizeTier === tierKey
            return (
              <button
                key={tierKey}
                type="button"
                onClick={() => setSelectedSizeTier(tierKey)}
                className={`py-2.5 px-4 sm:px-5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20 scale-102'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                }`}
              >
                <span>{tier.name}</span>
                <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-200 text-slate-600'}`}>
                  {tier.area}
                </span>
              </button>
            )
          })}
        </div>

        {/* Dynamic Visual Compartment Interactive Blueprint Box */}
        <motion.div
          key={selectedSizeTier}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="p-7 sm:p-9 rounded-3xl bg-slate-50 border border-slate-200/90 shadow-sm max-w-5xl mx-auto text-left grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
        >
          {/* Blueprint Specs Left */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-cyan-100 text-cyan-900 border border-cyan-200">
                QUY CÁCH: {sizeTierData[selectedSizeTier].area}
              </span>
              <span className="font-mono text-xs text-slate-500 font-semibold">
                Thể Tích: {sizeTierData[selectedSizeTier].volume}
              </span>
            </div>

            <h3 className="font-headline text-2xl font-black text-slate-900">
              {sizeTierData[selectedSizeTier].name}
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {sizeTierData[selectedSizeTier].desc}
            </p>

            <div className="pt-2">
              <span className="text-xs font-bold text-slate-800 block mb-2">Vật dụng có thể cất giữ thực tế:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                {sizeTierData[selectedSizeTier].fits.map((fitItem, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="material-symbols-outlined text-[16px] text-cyan-600">check_circle</span>
                    <span>{fitItem}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 flex flex-wrap items-center gap-4 text-xs">
              <div className="text-slate-600">
                Loại cửa: <strong className="text-slate-900">{sizeTierData[selectedSizeTier].door}</strong>
              </div>
              <div className="text-slate-600">
                Phù hợp cho: <strong className="text-slate-900">{sizeTierData[selectedSizeTier].bestFor}</strong>
              </div>
            </div>
          </div>

          {/* Blueprint Specs Right: Action Box */}
          <div className="lg:col-span-5 p-6 rounded-2xl bg-white border border-slate-200 shadow-md space-y-4 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="font-mono text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                MỨC GIÁ THAM KHẢO
              </span>
              <div className="text-2xl font-black font-mono text-cyan-800">
                {sizeTierData[selectedSizeTier].rate}
              </div>
              <p className="text-[11px] text-slate-500">
                Đã bao gồm điện, bảo mật IoT 24/7 và bảo hiểm tài sản cơ bản
              </p>
            </div>

            <div className="p-3 rounded-xl bg-cyan-50/60 border border-cyan-100 text-xs text-cyan-900 space-y-1 font-mono">
              <div className="flex justify-between">
                <span>Chiều cao trần:</span>
                <span className="font-bold">2.7m – 3.0m</span>
              </div>
              <div className="flex justify-between">
                <span>Khóa an ninh:</span>
                <span className="font-bold">IoT Mã PIN AES-256</span>
              </div>
              <div className="flex justify-between">
                <span>Ra vào kho:</span>
                <span className="font-bold text-emerald-700">Tự do 24/7</span>
              </div>
            </div>

            <Link
              to={`/units?type=${selectedSizeTier}`}
              className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
            >
              <span>Xem Các Buồng Trống Hạng Này</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
        </motion.div>

      </div>
    </section>

    {/* ============================================================ */}
    {/* 8. CHÍNH SÁCH DỊCH VỤ MINH BẠCH (POLICIES)                  */}
    {/* ============================================================ */}
    <section id="policies" className="py-20 lg:py-24 border-b border-slate-200/80 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionFadeIn}
          className="text-center max-w-3xl mx-auto space-y-3"
        >
          <span className="text-[var(--brand-teal,#0866f5)] font-mono text-xs font-bold tracking-wider uppercase inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200">
            <span className="w-2 h-2 rounded-full bg-cyan-600 animate-pulse" />
            CHÍNH SÁCH MINH BẠCH // BẢO VỆ KHÁCH HÀNG
          </span>
          <h2 className="font-headline text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Chính Sách Thuê Kho Rõ Ràng &amp; Minh Bạch Tuyệt Đối
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Boxora cam kết đặt quyền lợi và sự an tâm của khách hàng lên hàng đầu. Mọi điều khoản về tài chính, an toàn và bảo hiểm đều được quy định minh bạch và bảo hộ pháp lý.
          </p>
        </motion.div>

        {/* Interactive Policy Tabs Card */}
        <div className="max-w-5xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          
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
              <span className="material-symbols-outlined text-[18px] text-[var(--brand-teal,#0866f5)]">payments</span>
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
              <span className="material-symbols-outlined text-[18px] text-blue-600">history_edu</span>
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

          {/* Animated Tab Body */}
          <AnimatePresence mode="wait">
            {activePolicyTab === 'deposit' && (
              <motion.div
                key="deposit"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="p-7 sm:p-10 space-y-6 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-50 text-[var(--brand-teal,#0866f5)] flex items-center justify-center font-bold">
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
                    <div className="font-mono text-xs font-bold text-blue-800">03 // KHÔNG CHI PHÍ ẨN</div>
                    <div className="text-sm font-bold text-slate-800">Trọn Gói Minh Bạch</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Giá niêm yết đã bao gồm tiền điện chiếu sáng, điều hòa thông gió, phí an ninh 24/7, bảo trì khóa IoT và vệ sinh hành lang.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activePolicyTab === 'insurance' && (
              <motion.div
                key="insurance"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="p-7 sm:p-10 space-y-6 text-left"
              >
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
              </motion.div>
            )}

            {activePolicyTab === 'contract' && (
              <motion.div
                key="contract"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="p-7 sm:p-10 space-y-6 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
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
                    <div className="font-mono text-xs font-bold text-blue-800">THỜI HẠN TỐI THIỂU</div>
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
              </motion.div>
            )}

            {activePolicyTab === 'prohibited' && (
              <motion.div
                key="prohibited"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="p-7 sm:p-10 space-y-6 text-left"
              >
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
              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>
    </section>

    {/* ============================================================ */}
    {/* 9. HỎI ĐÁP & HỖ TRỢ KHÁCH HÀNG (FAQ & SUPPORT)               */}
    {/* ============================================================ */}
    <section id="faq" className="py-20 lg:py-24 border-b border-slate-200/80 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
        
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionFadeIn}
          className="text-center max-w-3xl mx-auto space-y-3"
        >
          <span className="text-[var(--brand-teal,#0866f5)] font-mono text-xs font-bold tracking-wider uppercase inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200">
            <span className="w-2 h-2 rounded-full bg-cyan-600 animate-pulse" />
            THÔNG TIN CẦN BIẾT // HỎI ĐÁP &amp; HỖ TRỢ
          </span>
          <h2 className="font-headline text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Câu Hỏi Thường Gặp &amp; Kênh Hỗ Trợ Khách Hàng
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Giải đáp nhanh những băn khoăn phổ biến nhất của người dùng khi bắt đầu thuê buồng kho tự quản tại Boxora.
          </p>
        </motion.div>

        {/* FAQ Category Filter Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto">
          {[
            { id: 'ALL', label: 'Tất Cả Câu Hỏi' },
            { id: 'IOT', label: 'Khóa IoT & Ra Vào 24/7' },
            { id: 'CONTRACT', label: 'Hợp Đồng & Chi Phí' },
            { id: 'FACILITY', label: 'Cơ Sở & Vận Chuyển' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFaqFilter(tab.id as any)}
              className={`py-2 px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                faqFilter === tab.id
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Fluid Animated FAQ Accordion */}
        <div className="max-w-4xl mx-auto space-y-3.5 text-left">
          {filteredFaqs.map((faq, idx) => {
            const isOpen = activeFaqIndex === idx
            return (
              <div
                key={faq.q}
                className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50/60 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setActiveFaqIndex(isOpen ? null : idx)}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 font-headline text-base sm:text-lg font-bold text-slate-900 cursor-pointer hover:text-cyan-800 transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 shrink-0" />
                    <span>{faq.q}</span>
                  </span>
                  <span className={`material-symbols-outlined text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-cyan-600' : ''}`}>
                    expand_more
                  </span>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] as const }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 sm:px-6 pb-6 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-200/60 pt-4 bg-white">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
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
              <div className="w-10 h-10 rounded-xl bg-cyan-100 text-[var(--brand-teal,#0866f5)] flex items-center justify-center">
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

            {/* Channel 4: Reception */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-lime-100 text-lime-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">schedule</span>
              </div>
              <div>
                <span className="font-mono text-[10px] text-lime-800 font-bold uppercase tracking-wider block">GIỜ TRỰC TẠI QUẦY</span>
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
    {/* 10. BOTTOM CONVERSION CTA BANNER                             */}
    {/* ============================================================ */}
    <section className="py-20 lg:py-24 bg-[var(--surface-canvas,#f8fafc)] text-center relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-cyan-100 text-[var(--brand-teal,#0866f5)] font-mono text-[11px] font-bold uppercase shadow-2xs"
        >
          <span className="material-symbols-outlined text-[15px]">verified</span>
          <span>ƯU ĐÃI THÁNG ĐẦU TIÊN CHO KHÁCH HÀNG MỚI</span>
        </motion.div>

        <h2 className="font-headline text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Sẵn Sàng Mở Rộng Không Gian Sống Của Bạn?
        </h2>
        <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
          Đặt giữ chỗ trực tuyến ngay hôm nay để nhận mã PIN tự động và bắt đầu lưu kho an toàn trong 60 giây.
        </p>

        <div className="flex flex-wrap justify-center gap-3.5 pt-2">
          <Link
            to="/units"
            className="px-7 py-3.5 rounded-xl bg-[var(--brand-teal,#0866f5)] hover:bg-[var(--brand-teal-hover,#0752c9)] text-white font-semibold text-sm btn-tactile shadow-md hover:shadow-xl transition-all flex items-center gap-2"
          >
            <span>Vào Dashboard Tìm &amp; Thuê Kho</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>

          <a
            href="tel:1900BOXORA"
            className="px-6 py-3.5 rounded-xl bg-white border border-slate-300 hover:border-slate-400 text-slate-800 font-semibold text-sm btn-tactile shadow-xs transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px] text-[var(--brand-teal,#0866f5)]">call</span>
            <span>Hotline 1900-BOXORA</span>
          </a>
        </div>
      </div>
    </section>

    {/* ============================================================ */}
    {/* 11. SITE FOOTER (4 COLUMNS ENTERPRISE ARCHITECTURE)          */}
    {/* ============================================================ */}
    <footer className="pt-16 pb-12 border-t border-slate-200 bg-white text-xs text-slate-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 text-left">
          
          {/* Column 1: Brand & Credentials */}
          <div className="space-y-4">
            <BrandLogo size="md" subtitle="SMART STORAGE SYSTEMS" />
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
    </MotionConfig>
  )
}
