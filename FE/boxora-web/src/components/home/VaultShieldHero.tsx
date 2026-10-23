import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap,
  LockKeyhole,
  Fingerprint,
  ArrowRightCircle,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  Thermometer,
  KeyRound,
  CheckCircle2,
  Sparkles,
  Warehouse,
  ExternalLink,
  ChevronDown,
  Radio,
  Lock,
  Unlock,
  BatteryCharging,
  Cuboid,
  SlidersHorizontal,
  RotateCw,
  Cpu,
  ShieldAlert,
  Check,
  Activity,
  Layers
} from 'lucide-react'
import { BoxoraKineticVault3D } from './BoxoraKineticVault3D'

export interface BoxoraHeroProps {
  onStartForFree?: () => void
  onSignIn?: () => void
  onGetItFree?: () => void
  isAuthenticated?: boolean
  userName?: string
  userRole?: string
  hideHeader?: boolean
}

export const BoxoraHero: React.FC<BoxoraHeroProps> = ({
  onStartForFree,
  onSignIn,
  onGetItFree,
  isAuthenticated,
  userName,
  userRole,
  hideHeader = false
}) => {
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [heroMode, setHeroMode] = useState<'smartlock' | 'kinetic3d'>('smartlock')
  
  // Interactive SmartLock Terminal State
  const [simulatedUnlocked, setSimulatedUnlocked] = useState(false)
  const [pinCode, setPinCode] = useState('849-204')
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [keypadInput, setKeypadInput] = useState('')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

  // Countdown timer for simulated auto-lock (12s after unlock)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    if (simulatedUnlocked && countdown !== null && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(prev => (prev !== null ? prev - 1 : null))
      }, 1000)
    } else if (countdown === 0 && simulatedUnlocked) {
      setSimulatedUnlocked(false)
      setCountdown(null)
      setKeypadInput('')
      setFeedbackMsg('Hệ thống tự động kích hoạt chốt khóa sau 12 giây.')
      setTimeout(() => setFeedbackMsg(null), 3500)
    }
    return () => clearTimeout(timer)
  }, [simulatedUnlocked, countdown])

  // Boxora Navigation Links (used when standalone header is rendered)
  const navLinks = [
    { name: 'Phòng Kho & Bảng Giá', href: '/units', isRoute: true },
    { name: 'Quy Trình 3 Bước', href: '#process', isRoute: false },
    { name: 'Khóa IoT 24/7', href: '#iot-access', isRoute: false },
    { name: 'Dịch Vụ & Tiện Ích', href: '#services', isRoute: false },
    { name: 'Hỏi Đáp (FAQ)', href: '#faq', isRoute: false }
  ]

  const handleStartForFree = () => {
    if (onStartForFree) {
      onStartForFree()
    } else {
      navigate('/units')
    }
  }

  const handleSignIn = () => {
    if (onSignIn) {
      onSignIn()
    } else {
      navigate(isAuthenticated ? '/portal' : '/login')
    }
  }

  const handleGetItFree = () => {
    if (onGetItFree) {
      onGetItFree()
    } else {
      navigate('/units')
    }
  }

  // Interactive SmartLock Unlock Sequence
  const handleSimulateUnlock = () => {
    if (isUnlocking) return
    setIsUnlocking(true)
    setFeedbackMsg('Đang xác thực thông tin bảo mật...')
    
    setTimeout(() => {
      if (!simulatedUnlocked) {
        const randomPin = `${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`
        setPinCode(randomPin)
        setKeypadInput(randomPin)
        setSimulatedUnlocked(true)
        setCountdown(12)
        setFeedbackMsg('Mở khóa thành công! Chốt khóa mở trong 12s.')
      } else {
        setSimulatedUnlocked(false)
        setCountdown(null)
        setKeypadInput('')
        setFeedbackMsg('Đã khóa lại chốt buồng kho B-12 an toàn.')
      }
      setIsUnlocking(false)
      setTimeout(() => setFeedbackMsg(null), 3000)
    }, 650)
  }

  const handleKeyPress = (num: string) => {
    if (isUnlocking || simulatedUnlocked) return
    if (keypadInput.length < 7) {
      const next = keypadInput + num
      setKeypadInput(next)
      if (next.replace('-', '').length >= 6) {
        // Auto trigger validation
        setIsUnlocking(true)
        setFeedbackMsg('Đang kiểm tra mã PIN...')
        setTimeout(() => {
          setSimulatedUnlocked(true)
          setPinCode(next)
          setCountdown(12)
          setIsUnlocking(false)
          setFeedbackMsg('Mã PIN hợp lệ! Chốt khóa đã mở.')
          setTimeout(() => setFeedbackMsg(null), 3000)
        }, 500)
      }
    }
  }

  const handleClearKeypad = () => {
    if (!isUnlocking) {
      setKeypadInput('')
      setFeedbackMsg(null)
    }
  }

  // Framer Motion Staggered Variants
  const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.12,
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1] as const
      }
    })
  }

  return (
    <div
      className={`relative w-full ${hideHeader ? 'min-h-[calc(100vh-4.5rem)] lg:min-h-[92vh]' : 'min-h-screen'} overflow-hidden flex flex-col justify-between select-none bg-slate-950`}
      style={{
        fontFamily: 'var(--font-body, "Be Vietnam Pro", sans-serif)',
        color: 'var(--color-text, #0f172a)'
      }}
    >
      {/* ============================================================ */}
      {/* 1. CINEMATIC HIGH-TECH SMART WAREHOUSE ANIMATED BACKGROUND   */}
      {/* ============================================================ */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        
        {/* Crystal Clear Smart Warehouse Scene with Breathing Ken-Burns Zoom */}
        <motion.img
          src="/smart-warehouse-clean.jpg"
          alt="BOXORA Smart Warehouse"
          className="absolute inset-0 w-full h-full object-cover object-center"
          initial={{ scale: 1.02 }}
          animate={{ scale: [1.02, 1.06, 1.02] }}
          transition={{
            duration: 26,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut'
          }}
        />

        {/* Cyber Holographic Isometric Grid */}
        <div 
          className="absolute inset-0 opacity-[0.32] mix-blend-screen pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(6, 182, 212, 0.14) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(6, 182, 212, 0.14) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px'
          }}
        />

        {/* Animated Laser Scanning Beam across the Floor */}
        <motion.div
          className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_24px_#06b6d4] pointer-events-none"
          animate={{
            top: ['42%', '68%', '42%'],
            opacity: [0.4, 0.9, 0.4]
          }}
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />

        {/* Ambient Fluid Aurora Glow (Cyan & Teal Fluid Lights) */}
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[400px] bg-gradient-to-tr from-cyan-500/25 via-teal-400/20 to-sky-500/15 rounded-full blur-[110px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[350px] bg-gradient-to-br from-teal-500/20 via-cyan-400/15 to-blue-500/15 rounded-full blur-[100px]" />

        {/* Studio High-Key Mask: Guarantees 100% Crisp Legibility on Text while showcasing Warehouse Scene */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/97 via-white/88 to-white/30 md:from-white/96 md:via-white/84 md:to-white/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-white/35" />

        {/* ========================================================== */}
        {/* ANIMATED AGV ROBOT STREAM TRAVELING ACROSS WAREHOUSE FLOOR */}
        {/* ========================================================== */}
        <motion.div
          className="hidden md:flex absolute bottom-8 z-10 items-center gap-3 px-4 py-2 rounded-2xl bg-white/90 backdrop-blur-md border border-cyan-300/80 shadow-lg"
          initial={{ left: '-20%', opacity: 0 }}
          animate={{
            left: ['-20%', '25%', '65%', '110%'],
            opacity: [0, 0.95, 0.95, 0]
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: 'linear'
          }}
        >
          <div className="w-8 h-8 rounded-xl bg-cyan-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            <span className="material-symbols-outlined text-[18px]">precision_manufacturing</span>
          </div>
          <div className="flex flex-col text-left">
            <span className="font-mono text-[9px] font-bold text-cyan-900 uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              AGV ROBOT #04 • ĐIỀU PHỐI TỰ ĐỘNG
            </span>
            <span className="text-[11px] font-bold text-slate-900">
              Chuyển kiện hàng Boxora tới buồng B-12
            </span>
          </div>
          <span className="material-symbols-outlined text-cyan-600 text-[18px] animate-pulse">arrow_forward</span>
        </motion.div>



      </div>

      {/* ============================================================ */}
      {/* 2. STANDALONE TOP NAVBAR (Only if !hideHeader)               */}
      {/* ============================================================ */}
      {!hideHeader && (
        <header className="relative z-30 w-full">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-4 sm:py-5 flex items-center justify-between">
            <Link
              to="/"
              className="flex items-center gap-3 group transition-transform hover:scale-102"
              title="BOXORA - Smart Storage System"
            >
              <img
                src="/logo.png"
                alt="BOXORA"
                className="h-9 sm:h-10 w-auto object-contain drop-shadow-sm group-hover:scale-105 transition-transform"
              />
              <div className="hidden sm:flex flex-col text-left">
                <span
                  className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-none"
                  style={{ fontFamily: 'var(--font-heading, "Be Vietnam Pro", sans-serif)' }}
                >
                  BOXORA
                </span>
                <span className="text-[9px] font-mono font-bold tracking-widest text-cyan-800 uppercase mt-0.5">
                  KHO TỰ QUẢN THÔNG MINH
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-7 lg:gap-8">
              {navLinks.map((link) => (
                link.isRoute ? (
                  <Link
                    key={link.name}
                    to={link.href}
                    className="text-sm font-semibold text-slate-700 transition-colors hover:text-cyan-700 cursor-pointer"
                  >
                    {link.name}
                  </Link>
                ) : (
                  <a
                    key={link.name}
                    href={link.href}
                    className="text-sm font-semibold text-slate-700 transition-colors hover:text-cyan-700 cursor-pointer"
                  >
                    {link.name}
                  </a>
                )
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-3">
              {isAuthenticated ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(userRole === 'CUSTOMER' ? '/portal/customer' : '/portal')}
                    className="px-5 py-2.5 rounded-full text-white text-sm font-semibold transition-all hover:brightness-110 active:scale-95 cursor-pointer shadow-sm shadow-cyan-600/30 flex items-center gap-2"
                    style={{ backgroundColor: 'var(--color-accent, #0891b2)' }}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Vào Portal</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSignIn}
                    className="px-4 py-2.5 rounded-full text-sm font-semibold transition-all hover:bg-slate-200/80 active:scale-95 cursor-pointer border border-slate-200/80 text-slate-800"
                    style={{ backgroundColor: 'var(--color-login-bg, #f1f5f9)' }}
                  >
                    {userName || 'Tài Khoản'}
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleStartForFree}
                    className="px-5 py-2.5 rounded-full text-white text-sm font-semibold transition-all hover:brightness-110 active:scale-95 cursor-pointer shadow-sm shadow-cyan-600/25 flex items-center gap-1.5"
                    style={{ backgroundColor: 'var(--color-accent, #0891b2)' }}
                  >
                    <span>Thuê Kho Ngay</span>
                    <ChevronRight size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={handleSignIn}
                    className="px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:brightness-95 active:scale-95 cursor-pointer shadow-2xs border border-slate-200/80 text-slate-800"
                    style={{ backgroundColor: 'var(--color-login-bg, #f1f5f9)' }}
                  >
                    Đăng Nhập
                  </button>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-800 hover:bg-black/5 transition-colors cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-6 h-6 stroke-[2.2]" />
            </button>
          </div>
        </header>
      )}

      {/* ============================================================ */}
      {/* 3. HERO CONTENT & INTERACTIVE HOLOGRAPHIC STATION            */}
      {/* ============================================================ */}
      <main className="relative z-20 w-full max-w-[1280px] mx-auto px-5 sm:px-8 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center py-8 lg:py-14">
          
          {/* Left Column: Heading, Subtext, Badges & CTA Buttons */}
          <div className="lg:col-span-7 max-w-[590px] text-left">
            
            {/* Top Pill Badge */}
            <motion.div
              custom={0}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-100/95 border border-cyan-300 text-cyan-950 font-mono text-[11px] font-bold uppercase tracking-wider mb-5 shadow-xs"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-600 animate-ping" />
              <span>HỆ THỐNG KHO TỰ QUẢN THÔNG MINH // CẤP MÃ PIN 60 GIÂY</span>
            </motion.div>

            {/* Hero Main Heading with Inline Lucide Icons (24px) */}
            <motion.h1
              custom={1}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="font-bold mb-5 text-slate-900 tracking-tight"
              style={{
                fontFamily: 'var(--font-heading, "Be Vietnam Pro", sans-serif)',
                fontSize: 'clamp(1.85rem, 5.2vw, 3.25rem)',
                lineHeight: 1.12
              }}
            >
              <Zap
                size={26}
                className="inline-block align-middle relative -top-[2px] text-cyan-600 mr-2"
                strokeWidth={2.4}
              />
              <span>Kho Tự Quản Thông Minh </span>
              <LockKeyhole
                size={26}
                className="inline-block align-middle relative -top-[2px] text-cyan-600 mx-2"
                strokeWidth={2.4}
              />
              <span>Kiên Cố, An Toàn &amp; Vào Kho 24/7</span>
              <Fingerprint
                size={26}
                className="inline-block align-middle relative -top-[2px] text-cyan-600 ml-2"
                strokeWidth={2.4}
              />
            </motion.h1>

            {/* Hero Subtext */}
            <motion.p
              custom={2}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="mb-8 font-normal text-slate-700 leading-relaxed text-base sm:text-lg"
              style={{
                fontFamily: 'var(--font-body, "Be Vietnam Pro", sans-serif)',
                maxWidth: '560px'
              }}
            >
              Đột phá với hệ thống tự động hóa IoT, bảo mật vân tay &amp; mã hóa đa tầng. Boxora mang lại giải pháp lưu kho cá nhân và doanh nghiệp linh hoạt, riêng tư và chuẩn xác từng giây.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              custom={3}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="flex flex-wrap items-center gap-4 pt-1"
            >
              <motion.button
                type="button"
                onClick={handleGetItFree}
                whileHover={{ scale: 1.04, filter: 'brightness(1.08)' }}
                whileTap={{ scale: 0.96 }}
                className="inline-flex items-center justify-between text-white font-semibold cursor-pointer transition-all shadow-lg"
                style={{
                  backgroundColor: 'var(--color-accent, #0891b2)',
                  borderRadius: '50px',
                  padding: '17px 28px',
                  fontFamily: 'var(--font-body, "Be Vietnam Pro", sans-serif)',
                  fontSize: 'clamp(0.95rem, 2vw, 1.05rem)',
                  boxShadow: '0 6px 24px rgba(8, 145, 178, 0.38)',
                  minWidth: '230px',
                  gap: '28px'
                }}
              >
                <span>Thuê Buồng Kho Ngay</span>
                <ArrowRightCircle size={20} className="w-5 h-5 shrink-0" strokeWidth={2.2} />
              </motion.button>

              <a
                href="#process"
                className="inline-flex items-center gap-2 px-6 py-4 rounded-full bg-white/95 hover:bg-white text-slate-800 font-semibold text-sm border border-slate-300 shadow-xs hover:shadow-md transition-all cursor-pointer"
              >
                <span>Xem Quy Trình 3 Bước</span>
                <ChevronRight size={18} className="text-cyan-700" />
              </a>
            </motion.div>

            {/* Quick Trust Highlights */}
            <motion.div
              custom={4}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="flex flex-wrap items-center gap-4 sm:gap-6 pt-7 text-xs font-semibold text-slate-700"
            >
              <div className="flex items-center gap-2 bg-white/85 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                <ShieldCheck size={16} className="text-cyan-600" />
                <span>Bảo mật đa tầng</span>
              </div>
              <div className="flex items-center gap-2 bg-white/85 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                <KeyRound size={16} className="text-emerald-600" />
                <span>Cấp mã PIN tức thì</span>
              </div>
              <div className="flex items-center gap-2 bg-white/85 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                <Thermometer size={16} className="text-teal-600" />
                <span>Nhiệt độ &amp; Độ ẩm ổn định</span>
              </div>
            </motion.div>

          </div>

          {/* Right Column: Holographic Interactive SmartLock Pod & 3D Switcher */}
          <div className="lg:col-span-5 w-full">
            <motion.div
              custom={2}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="relative p-5 sm:p-7 rounded-3xl bg-white/92 backdrop-blur-xl border border-cyan-200/90 shadow-2xl shadow-cyan-950/15 space-y-4 text-left transition-all hover:border-cyan-400"
            >
              {/* Pod Header with Mode Switcher */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-700">
                    <Warehouse size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Buồng Kho B-12</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-100/80 text-cyan-900 font-mono">10 M³</span>
                    </h3>
                    <p className="text-[10px] font-mono text-cyan-800 font-semibold">CHI NHÁNH QUẬN 7 • NAM SÀI GÒN</p>
                  </div>
                </div>

                {/* Mode Selector Tabs: SmartLock Terminal vs 3D Kinetic Vault */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl text-[10px] font-mono font-bold">
                  <button
                    type="button"
                    onClick={() => setHeroMode('smartlock')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      heroMode === 'smartlock'
                        ? 'bg-white text-cyan-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <KeyRound size={12} />
                    <span>Khóa Số</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeroMode('kinetic3d')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      heroMode === 'kinetic3d'
                        ? 'bg-white text-cyan-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Cuboid size={12} />
                    <span>3D Vault</span>
                  </button>
                </div>
              </div>

              {/* Mode 1: Interactive SmartLock Terminal */}
              {heroMode === 'smartlock' ? (
                <>
                  {/* Status Indicator Card */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    simulatedUnlocked
                      ? 'bg-emerald-50/80 border-emerald-300 shadow-md ring-2 ring-emerald-500/20'
                      : 'bg-slate-900 border-slate-800 shadow-md'
                  }`}>
                    
                    <div className="flex items-center justify-between mb-2.5">
                      <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${simulatedUnlocked ? 'text-emerald-800' : 'text-slate-400'}`}>
                        {simulatedUnlocked ? 'CHỐT KHÓA: ĐÃ MỞ (UNLOCKED)' : 'CHỐT KHÓA: ĐANG BẢO VỆ (ARMED)'}
                      </span>
                      <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-slate-300">
                        <BatteryCharging size={13} className="text-emerald-400" />
                        <span className={simulatedUnlocked ? 'text-emerald-900' : 'text-slate-200'}>PIN: 98%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform ${
                        simulatedUnlocked ? 'bg-emerald-500 text-white scale-105 shadow-md shadow-emerald-500/30' : 'bg-slate-800 text-cyan-400'
                      }`}>
                        {simulatedUnlocked ? <Unlock size={24} /> : <Lock size={24} />}
                      </div>

                      <div className="flex-1">
                        <div className={`text-[11px] font-semibold ${simulatedUnlocked ? 'text-emerald-800' : 'text-slate-400'}`}>
                          {simulatedUnlocked ? 'Mã PIN đã xác thực thành công:' : 'Nhập mã PIN hoặc bấm mở thử:'}
                        </div>
                        <div className={`text-lg font-mono font-extrabold tracking-wider ${simulatedUnlocked ? 'text-emerald-950' : 'text-white'}`}>
                          {simulatedUnlocked ? pinCode : (keypadInput ? keypadInput : '•••• - ••••')}
                        </div>
                      </div>

                      {simulatedUnlocked && countdown !== null && (
                        <div className="text-center px-2 py-1 rounded-lg bg-emerald-100 border border-emerald-300 font-mono text-[10px] text-emerald-800 font-bold">
                          Đóng sau
                          <div className="text-xs font-black">{countdown}s</div>
                        </div>
                      )}
                    </div>

                    {/* Feedback Toast */}
                    {feedbackMsg && (
                      <div className={`mt-2.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-semibold text-center transition-all ${
                        simulatedUnlocked ? 'bg-emerald-200/80 text-emerald-900' : 'bg-slate-800 text-cyan-300'
                      }`}>
                        {feedbackMsg}
                      </div>
                    )}
                  </div>

                  {/* Interactive Digital Keypad */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="font-mono text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        BÀN PHÍM CẢM ỨNG IOT
                      </span>
                      <button
                        type="button"
                        onClick={handleClearKeypad}
                        className="text-[10px] font-mono font-bold text-cyan-700 hover:text-cyan-900 cursor-pointer"
                      >
                        Xóa [C]
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 font-mono">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleKeyPress(num)}
                          disabled={simulatedUnlocked || isUnlocking}
                          className="py-1.5 rounded-lg bg-white hover:bg-cyan-50 active:bg-cyan-100 border border-slate-200/90 text-xs font-bold text-slate-800 shadow-2xs transition-all hover:scale-102 cursor-pointer disabled:opacity-50"
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={handleClearKeypad}
                        disabled={simulatedUnlocked || isUnlocking}
                        className="py-1.5 rounded-lg bg-white hover:bg-rose-50 border border-slate-200/90 text-[10px] font-bold text-rose-600 shadow-2xs transition-all cursor-pointer"
                      >
                        CLR
                      </button>
                      <button
                        type="button"
                        onClick={() => handleKeyPress('0')}
                        disabled={simulatedUnlocked || isUnlocking}
                        className="py-1.5 rounded-lg bg-white hover:bg-cyan-50 border border-slate-200/90 text-xs font-bold text-slate-800 shadow-2xs transition-all cursor-pointer"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={handleSimulateUnlock}
                        disabled={isUnlocking}
                        className="py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] font-bold shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <KeyRound size={12} />
                        <span>MỞ</span>
                      </button>
                    </div>
                  </div>

                  {/* Climate Telemetry Monitor */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="text-[9px] font-mono text-slate-500 uppercase font-semibold">Vi Khí Hậu Nhiệt Độ</div>
                      <div className="text-sm font-bold font-mono text-slate-900 mt-0.5 flex items-center justify-between">
                        <span>21.5°C</span>
                        <span className="text-[9px] text-emerald-600 font-semibold font-sans">Ổn định</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="text-[9px] font-mono text-slate-500 uppercase font-semibold">Độ Ẩm Kiểm Soát</div>
                      <div className="text-sm font-bold font-mono text-slate-900 mt-0.5 flex items-center justify-between">
                        <span>45% RH</span>
                        <span className="text-[9px] text-teal-600 font-semibold font-sans">Chống mốc</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Mode 2: Interactive 3D Kinetic Vault */
                <div className="relative w-full h-[320px] rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-cyan-400/30 overflow-hidden flex flex-col items-center justify-center">
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-400/40 text-[9px] font-mono text-cyan-300">
                    <RotateCw size={11} className="animate-spin text-cyan-400" />
                    <span>XOAY 360° KÉO THẢ CHUỘT</span>
                  </div>
                  <BoxoraKineticVault3D />
                </div>
              )}

              {/* Action Link to Units */}
              <Link
                to="/units"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
              >
                <span>Xem Bản Đồ &amp; Đặt Thuê Buồng Này</span>
                <ExternalLink size={14} />
              </Link>

            </motion.div>
          </div>

        </div>
      </main>

      {/* Subtle Scroll Down Prompt with Dynamic Laser Line extending downward */}
      <div className="relative z-20 pb-4 flex flex-col items-center justify-center gap-1 pointer-events-none">
        <a href="#telemetry" className="pointer-events-auto flex flex-col items-center gap-1 group">
          <span className="text-[10px] font-mono font-bold tracking-widest text-slate-500 group-hover:text-cyan-700 uppercase transition-colors">
            Cuộn xuống để khám phá chi tiết
          </span>
          <div className="w-5 h-8 rounded-full border-2 border-slate-300 group-hover:border-cyan-500 flex items-start justify-center p-1 transition-colors">
            <div className="w-1.5 h-2 bg-cyan-600 rounded-full animate-bounce" />
          </div>
        </a>
      </div>

      {/* ============================================================ */}
      {/* 4. MOBILE MENU SHEET (ANIMATEPRESENCE + FRAMER MOTION)       */}
      {/* ============================================================ */}
      {!hideHeader && (
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[4px]"
              />

              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{
                  duration: 0.45,
                  ease: [0.22, 1, 0.36, 1] as const
                }}
                className="fixed right-0 top-0 z-50 h-[100dvh] bg-white shadow-[-12px_0_48px_rgba(15,23,42,0.18)] p-6 sm:p-7 flex flex-col justify-between"
                style={{
                  width: 'min(88vw, 360px)',
                  color: 'var(--color-text, #0f172a)',
                  fontFamily: 'var(--font-body, "Be Vietnam Pro", sans-serif)'
                }}
              >
                <div>
                  <div className="flex items-center justify-between pb-2">
                    <div className="flex items-center gap-2.5">
                      <img
                        src="/logo.png"
                        alt="BOXORA"
                        className="h-8 w-auto object-contain"
                      />
                      <div className="flex flex-col text-left">
                        <span
                          className="text-lg font-black tracking-tight text-slate-900"
                          style={{ fontFamily: 'var(--font-heading, "Be Vietnam Pro", sans-serif)' }}
                        >
                          BOXORA
                        </span>
                        <span className="text-[8px] font-mono font-bold tracking-wider text-cyan-800 uppercase">
                          KHO TỰ QUẢN THÔNG MINH
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer text-slate-700"
                      aria-label="Close menu"
                    >
                      <X className="w-5 h-5 stroke-[2.2]" />
                    </button>
                  </div>

                  <div className="w-full h-[1px] bg-slate-200 my-4" />

                  <nav className="flex flex-col gap-3.5 py-2">
                    {navLinks.map((link, i) => (
                      link.isRoute ? (
                        <motion.div
                          key={link.name}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            delay: 0.18 + i * 0.07,
                            duration: 0.35,
                            ease: [0.22, 1, 0.36, 1] as const
                          }}
                        >
                          <Link
                            to={link.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className="block text-base font-semibold text-slate-800 hover:text-cyan-700 transition-colors py-1"
                          >
                            {link.name}
                          </Link>
                        </motion.div>
                      ) : (
                        <motion.a
                          key={link.name}
                          href={link.href}
                          onClick={() => setMobileMenuOpen(false)}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            delay: 0.18 + i * 0.07,
                            duration: 0.35,
                            ease: [0.22, 1, 0.36, 1] as const
                          }}
                          className="text-base font-semibold text-slate-800 hover:text-cyan-700 transition-colors py-1"
                        >
                          {link.name}
                        </motion.a>
                      )
                    ))}
                  </nav>
                </div>

                <div className="flex flex-col gap-3 pt-6 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      handleStartForFree()
                    }}
                    className="w-full py-3 px-5 rounded-full text-white text-sm font-semibold transition-all hover:brightness-110 active:scale-95 cursor-pointer shadow-sm"
                    style={{ backgroundColor: 'var(--color-accent, #0891b2)' }}
                  >
                    Thuê Kho Ngay
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      handleSignIn()
                    }}
                    className="w-full py-3 px-5 rounded-full text-sm font-semibold transition-all hover:bg-slate-200/80 active:scale-95 cursor-pointer border border-slate-200 text-slate-800"
                    style={{ backgroundColor: 'var(--color-login-bg, #f1f5f9)' }}
                  >
                    {isAuthenticated ? 'Vào Portal' : 'Đăng Nhập'}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}

// Re-export as VaultShieldHero for backward compatibility
export const VaultShieldHero = BoxoraHero
