import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  User,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Bot,
  Sliders,
  Box,
  Clock,
  Wifi,
  Cloud,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  X,
  ExternalLink
} from 'lucide-react'
import { authService } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'
import { AuthAnimatedBackground } from '../../components/auth/AuthAnimatedBackground'

import boxoraLogo from '../../assets/boxora-logo.png'
import { TermsAndStandardsModal } from '../../components/common/TermsAndStandardsModal'
import { GoogleAuthButton } from '../../components/auth/GoogleAuthButton'

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { loginWithGoogle } = useAuth()

  const googleRedirectState = location.state as {
    fromGoogleLogin?: boolean
    email?: string
    fullName?: string
    googleIdToken?: string
    message?: string
  } | null

  // Form data: Pre-filled automatically if redirected from Google Login
  const [formData, setFormData] = useState({
    fullName: googleRedirectState?.fullName || '',
    email: googleRedirectState?.email || '',
    phone: '',
    password: '',
    confirmPassword: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [googleNotice, setGoogleNotice] = useState<string | null>(
    googleRedirectState?.message || null
  )

  // Anti-bot & Captcha states
  const [captchaId, setCaptchaId] = useState<string>('')
  const [captchaImage, setCaptchaImage] = useState<string>('')
  const [captchaInput, setCaptchaInput] = useState<string>('')
  const [isCaptchaLoading, setIsCaptchaLoading] = useState<boolean>(false)
  const [honeypot, setHoneypot] = useState<string>('') // Bot trap field
  const pageLoadedAt = useRef<number>(0)

  // Circular toggle for terms
  const [agreeTerms, setAgreeTerms] = useState(true)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [socialNotice, setSocialNotice] = useState<string | null>(null)

  const handleGoogleSuccess = async (idToken: string) => {
    setError(null)
    setSocialNotice('Đang hoàn tất đăng ký tài khoản mới với Google...')
    try {
      const user = await loginWithGoogle(idToken, 'REGISTER')
      setSocialNotice(null)
      const userRole = user?.role?.name || 'CUSTOMER'
      if (userRole === 'ADMIN') {
        navigate('/portal/admin')
      } else {
        navigate('/portal/customer')
      }
    } catch (err: any) {
      console.error('Google register error:', err)
      setSocialNotice(null)
      const serverMsg = err?.response?.data?.message
      if (serverMsg) {
        setError(serverMsg)
      } else if (!err?.response) {
        setError('Không thể kết nối đến máy chủ Boxora (Backend). Vui lòng đảm bảo máy chủ đang hoạt động và thử lại.')
      } else {
        setError('Đăng ký nhanh qua tài khoản Google thất bại. Vui lòng thử lại.')
      }
    }
  }

  const handleGoogleError = (errMsg: string) => {
    setError(errMsg)
  }

  // Local client-side fallback SVG captcha in case network is offline
  const generateFallbackCaptcha = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
    let code = ''
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="160" height="50" viewBox="0 0 160 50">
        <rect width="160" height="50" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
        <path d="M 5 20 Q 80 5 155 35" stroke="#38bdf8" stroke-width="2" fill="none" opacity="0.6"/>
        <path d="M 10 35 Q 90 45 150 15" stroke="#94a3b8" stroke-width="1.5" fill="none" opacity="0.5"/>
        <text x="20" y="34" font-family="monospace, sans-serif" font-size="24" font-weight="bold" fill="#0284c7" letter-spacing="4">${code}</text>
      </svg>
    `.trim()
    const base64 = `data:image/svg+xml;base64,${btoa(svg)}`
    return { id: `local-${Date.now()}`, image: base64, code }
  }

  const loadCaptcha = async () => {
    setIsCaptchaLoading(true)
    setCaptchaInput('')
    try {
      const res = await authService.getCaptcha()
      if (res?.data?.captchaId && res?.data?.captchaImage) {
        setCaptchaId(res.data.captchaId)
        setCaptchaImage(res.data.captchaImage)
      } else {
        const fallback = generateFallbackCaptcha()
        setCaptchaId(fallback.id)
        setCaptchaImage(fallback.image)
      }
    } catch {
      const fallback = generateFallbackCaptcha()
      setCaptchaId(fallback.id)
      setCaptchaImage(fallback.image)
    } finally {
      setIsCaptchaLoading(false)
    }
  }

  useEffect(() => {
    const initCaptcha = async () => {
      await loadCaptcha()
      pageLoadedAt.current = Date.now()
    }
    initCaptcha()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // 1. Anti-bot honeypot detection
    if (honeypot) {
      setError('Hệ thống phát hiện hành vi tự động từ bot. Thao tác bị từ chối.')
      return
    }

    // 2. Anti-bot rapid submission check
    if (Date.now() - pageLoadedAt.current < 1200) {
      setError('Thao tác quá nhanh. Vui lòng kiểm tra lại thông tin và thử lại.')
      return
    }

    // 3. Password matching check
    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu nhập lại không trùng khớp. Vui lòng kiểm tra lại.')
      return
    }

    // 4. Captcha validation
    if (!captchaInput.trim()) {
      setError('Vui lòng nhập mã xác thực Captcha để hoàn tất đăng ký.')
      return
    }

    // 5. Terms check
    if (!agreeTerms) {
      setError('Vui lòng đồng ý với Điều khoản & Quy chuẩn an toàn kho Boxora.')
      return
    }

    // Derive username automatically from email
    const emailPrefix = formData.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()
    const derivedUsername = (emailPrefix.length >= 3 ? emailPrefix : `user_${Date.now().toString().slice(-6)}`).slice(0, 30)

    setIsLoading(true)
    try {
      await authService.register({
        username: derivedUsername,
        email: formData.email.trim(),
        password: formData.password,
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        captchaId,
        captchaCode: captchaInput.trim().toUpperCase()
      })
      setSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 1800)
    } catch (err: any) {
      console.error(err)
      setError(err?.response?.data?.message || 'Đăng ký không thành công. Vui lòng kiểm tra lại thông tin.')
      loadCaptcha()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full relative flex flex-col justify-between overflow-x-hidden font-sans text-slate-800 bg-[#f4f8ff]">
      
      {/* 1. BACKGROUND                                                */}
      {/* ============================================================ */}
      <AuthAnimatedBackground />

      {/* ============================================================ */}
      {/* 2. TOP BRAND & SECURITY HEADER                               */}
      {/* ============================================================ */}
      <header className="relative z-20 w-full px-6 sm:px-10 lg:px-14 py-4 sm:py-6 flex items-center justify-between">
        
        {/* Brand Logo & Slogan Glass Pill */}
        <div className="inline-flex items-center px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl bg-white/90 hover:bg-white/95 backdrop-blur-md border border-white/80 shadow-xs transition-all">
          <Link to="/" className="flex items-center group cursor-pointer" title="Về trang chủ Boxora">
            <img
              src={boxoraLogo}
              alt="BOXORA Smart Storage System"
              className="h-9 sm:h-11 w-auto object-contain drop-shadow-xs group-hover:scale-105 transition-transform"
            />
          </Link>

          {/* Vertical divider */}
          <div className="hidden sm:block h-7 w-[1.5px] bg-slate-200 mx-3" />

          {/* Slogan */}
          <div className="hidden sm:flex flex-col text-left justify-center">
            <span className="font-extrabold text-xs sm:text-[13px] text-slate-900 tracking-wider uppercase font-mono leading-tight">
              KHO TỰ QUẢN THÔNG MINH
            </span>
            <span className="text-[10px] font-bold text-teal-700 tracking-widest uppercase mt-0.5 leading-tight">
              IoT • AI • BẢO MẬT TUYỆT ĐỐI
            </span>
          </div>
        </div>

        {/* Security Badge (Top Right) */}
        <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/95 hover:bg-white backdrop-blur-md border border-teal-200 shadow-[0_4px_16px_rgba(15,23,42,0.08)] transition-all">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shrink-0">
            <Lock className="w-3.5 h-3.5" />
          </div>
          <div className="text-left leading-tight">
            <span className="block text-[11px] sm:text-xs font-black text-slate-900 font-mono">
              AES-256 GCM
            </span>
            <span className="block text-[9px] sm:text-[10px] font-semibold text-slate-500">
              Bảo mật cấp quân sự
            </span>
          </div>
        </div>

      </header>

      {/* ============================================================ */}
      {/* 3. MAIN CONTENT: 2-COLUMN BALANCED LAYOUT                    */}
      {/* ============================================================ */}
      <main className="auth-content-enter flex-1 w-full relative z-20 px-6 sm:px-10 lg:px-14 py-2 sm:py-4 flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12 max-w-[1580px] mx-auto">
        
        {/* ========================================================== */}
        {/* LEFT COLUMN: Glass status panel and Boxora content          */}
        {/* ========================================================== */}
        <div className="w-full lg:w-[52%] xl:w-[54%] flex flex-col justify-between py-2 sm:py-6 space-y-8 lg:space-y-10">
          
          {/* Translucent glass status panel */}
          <div className="w-full max-w-sm rounded-2xl bg-gradient-to-br from-white/90 via-white/75 to-teal-50/85 backdrop-blur-md border border-white/90 p-4 sm:p-4.5 shadow-[0_12px_36px_rgba(15,23,42,0.08),inset_0_1px_2px_rgba(255,255,255,0.7)] space-y-3.5 transition-all">
            
            {/* HUD Item 1: Hệ thống IoT */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shrink-0">
                  <Wifi className="w-4.5 h-4.5 stroke-[2.5]" />
                </div>
                <div className="text-left">
                  <p className="text-xs sm:text-[13px] font-black text-slate-900 tracking-wide">
                    Hệ thống IoT
                  </p>
                  <p className="text-[11px] text-slate-600 font-semibold">
                    Hoạt động ổn định
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-mono font-black">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse " />
                Hoạt động
              </span>
            </div>

            {/* HUD Item 2: Bảo mật */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shrink-0">
                  <ShieldCheck className="w-4.5 h-4.5 stroke-[2.5]" />
                </div>
                <div className="text-left">
                  <p className="text-xs sm:text-[13px] font-black text-slate-900 tracking-wide">
                    Bảo mật
                  </p>
                  <p className="text-[11px] text-slate-600 font-semibold">
                    AES-256 GCM
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-mono font-black">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Đã bật
              </span>
            </div>

            {/* HUD Item 3: Trạng thái kho */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shrink-0">
                  <Cloud className="w-4.5 h-4.5 stroke-[2.5]" />
                </div>
                <div className="text-left">
                  <p className="text-xs sm:text-[13px] font-black text-slate-900 tracking-wide">
                    Trạng thái kho
                  </p>
                  <p className="text-[11px] text-slate-600 font-semibold">
                    Đồng bộ real-time
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-mono font-black">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                100% online
              </span>
            </div>

          </div>

          {/* Hero Headlines & Content directly on canvas - no enclosing frame */}
          <div className="max-w-xl space-y-4 text-left">
            
            {/* Tagline label */}
            <div className="flex items-center gap-2.5 text-teal-700 font-black text-xs sm:text-sm tracking-[0.2em] uppercase font-mono ">
              <span>BOXORA</span>
              <span className="w-10 h-0.5 bg-teal-600 rounded-full shadow-[0_0_8px_rgba(13,148,136,0.25)]" />
            </div>

            {/* Clean & Punchy Headings directly on background */}
            <div className="space-y-2">
              <h1
                className="text-3xl sm:text-4xl lg:text-[42px] font-black text-slate-950 tracking-tight leading-[1.12]"
               
              >
                KHÔNG GIAN LƯU TRỮ THÔNG MINH
              </h1>
              <h2
                className="text-xl sm:text-2xl lg:text-[28px] font-black tracking-tight leading-snug text-teal-700"
               
              >
                AN TOÀN • TIỆN NGHI • HIỆN ĐẠI
              </h2>
            </div>

            {/* Description */}
            <p
              className="text-sm sm:text-[15px] text-slate-700 leading-relaxed font-medium max-w-lg"
             
            >
              Đăng ký tài khoản khách thuê chỉ trong 1 phút để sở hữu ô kho cá nhân an toàn, riêng tư tuyệt đối và trải nghiệm hệ sinh thái kho số tự động hóa toàn diện.
            </p>

            {/* Feature highlights */}
            <div className="flex flex-wrap items-center gap-y-3 pt-3">
              
              {/* Badge 1: Bảo mật đa lớp */}
              <div className="flex items-center gap-3 pr-4 sm:pr-6 border-r border-teal-200/80">
                <div className="w-8 h-8 rounded-xl bg-teal-50/80 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0 shadow-[0_2px_8px_rgba(13,148,136,0.12)]">
                  <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="text-left leading-tight">
                  <span
                    className="block text-xs sm:text-[13px] font-black text-slate-950"
                   
                  >
                    Bảo mật
                  </span>
                  <span
                    className="block text-[10px] sm:text-[11px] font-semibold text-slate-600"
                   
                  >
                    đa lớp
                  </span>
                </div>
              </div>

              {/* Badge 2: Quản lý thông minh */}
              <div className="flex items-center gap-3 px-4 sm:px-6 border-r border-teal-200/80">
                <div className="w-8 h-8 rounded-xl bg-teal-50/80 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0 shadow-[0_2px_8px_rgba(13,148,136,0.12)]">
                  <Sliders className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="text-left leading-tight">
                  <span
                    className="block text-xs sm:text-[13px] font-black text-slate-950"
                   
                  >
                    Quản lý
                  </span>
                  <span
                    className="block text-[10px] sm:text-[11px] font-semibold text-slate-600"
                   
                  >
                    thông minh
                  </span>
                </div>
              </div>

              {/* Badge 3: Tiết kiệm thời gian */}
              <div className="flex items-center gap-3 px-4 sm:px-6 border-r border-teal-200/80">
                <div className="w-8 h-8 rounded-xl bg-teal-50/80 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0 shadow-[0_2px_8px_rgba(13,148,136,0.12)]">
                  <Clock className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="text-left leading-tight">
                  <span
                    className="block text-xs sm:text-[13px] font-black text-slate-950"
                   
                  >
                    Tiết kiệm
                  </span>
                  <span
                    className="block text-[10px] sm:text-[11px] font-semibold text-slate-600"
                   
                  >
                    thời gian
                  </span>
                </div>
              </div>

              {/* Badge 4: Tối ưu không gian */}
              <div className="flex items-center gap-3 pl-4 sm:pl-6">
                <div className="w-8 h-8 rounded-xl bg-teal-50/80 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0 shadow-[0_2px_8px_rgba(13,148,136,0.12)]">
                  <Box className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="text-left leading-tight">
                  <span
                    className="block text-xs sm:text-[13px] font-black text-slate-950"
                   
                  >
                    Tối ưu
                  </span>
                  <span
                    className="block text-[10px] sm:text-[11px] font-semibold text-slate-600"
                   
                  >
                    không gian
                  </span>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* ========================================================== */}
        {/* RIGHT COLUMN: Floating Register Card                      */}
        {/* ========================================================== */}
        <div className="w-full max-w-[490px] lg:w-[470px] xl:w-[490px] shrink-0 my-auto">
          
          <div className="w-full bg-white/98 backdrop-blur-md rounded-[32px] sm:rounded-[36px] border-2 border-teal-100 shadow-[0_20px_50px_rgba(15,23,42,0.12),0_0_40px_rgba(13,148,136,0.08)] p-6 sm:p-8 lg:p-8 relative z-30 transition-all text-left space-y-3.5">
            
            {/* Top Logo inside the Card */}
            <div className="flex items-center justify-start">
              <img
                src={boxoraLogo}
                alt="BOXORA"
                className="h-10 sm:h-11 w-auto object-contain drop-shadow-xs"
              />
            </div>

            {/* Header Title */}
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-[28px] font-black text-slate-950 tracking-tight">
                Khởi tạo tài khoản kho
              </h2>
              <p className="text-xs sm:text-[13px] text-slate-600 font-medium">
                Sở hữu không gian lưu trữ số cá nhân an toàn chỉ sau 1 phút
              </p>
            </div>


            {/* Notice when redirected from Google Login */}
            {googleNotice && (
              <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 text-teal-950 text-xs flex items-start justify-between gap-2 shadow-xs animate-fadeIn">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4.5 h-4.5 shrink-0 text-teal-700 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900 block mb-0.5">Tài khoản chưa được đăng ký:</span>
                    <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                      {googleNotice}
                    </p>
                    <p className="text-[10px] text-teal-700 font-bold mt-1">
                      👉 Bạn có thể bấm nút <u>"Đăng ký bằng Google"</u> bên dưới để hoàn tất ngay, hoặc hoàn thiện thông tin form.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGoogleNotice(null)}
                  className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 shadow-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Success View */}
            {success ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-900">Đăng Ký Thành Công!</h3>
                  <p className="text-xs text-slate-600 max-w-xs mx-auto">
                    Tài khoản của bạn đã được kích hoạt. Đang chuyển hướng bạn tới trang đăng nhập...
                  </p>
                </div>
                <div className="pt-2">
                  <div className="w-6 h-6 border-2 border-teal-700 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                
                {/* Anti-bot invisible honeypot field */}
                <div className="hidden opacity-0 pointer-events-none absolute -left-[9999px]" aria-hidden="true">
                  <input
                    type="text"
                    name="bot_trap_company_field"
                    tabIndex={-1}
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    autoComplete="off"
                  />
                </div>

                {/* Field 1: Họ và tên */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-800">
                    Họ và tên
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="Nguyễn Văn A"
                      required
                      className="w-full h-10.5 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-all shadow-2xs font-medium"
                    />
                  </div>
                </div>

                {/* Field 2 & 3: Email & Số điện thoại (2 columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-800">
                      Địa chỉ Email
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3 text-slate-400 pointer-events-none">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="nguyen@gmail.com"
                        required
                        className="w-full h-10.5 pl-9 pr-3.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-all shadow-2xs font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-800">
                      Số điện thoại
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3 text-slate-400 pointer-events-none">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="0912 345 678"
                        required
                        className="w-full h-10.5 pl-9 pr-3.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-all shadow-2xs font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Field 4 & 5: Mật khẩu & Nhập lại mật khẩu (2 columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-800">
                      Mật khẩu
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3 text-slate-400 pointer-events-none">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="••••••••"
                        required
                        className="w-full h-10.5 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-all shadow-2xs font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-800">
                      Xác nhận mật khẩu
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3 text-slate-400 pointer-events-none">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        placeholder="••••••••"
                        required
                        className="w-full h-10.5 pl-9 pr-3.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-all shadow-2xs font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Anti-Bot Captcha Security Box */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                      <span>Xác thực Captcha chống bot</span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                      <Bot className="w-3 h-3 text-slate-400" />
                      Mã bảo vệ
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-shrink-0 bg-white rounded-lg border border-slate-200 p-0.5 shadow-2xs overflow-hidden h-[40px] flex items-center justify-center min-w-[120px]">
                      {captchaImage ? (
                        <img
                          src={captchaImage}
                          alt="Mã Captcha"
                          className="h-full w-auto select-none pointer-events-none object-contain"
                        />
                      ) : (
                        <div className="text-[10px] text-slate-400 px-2 py-1 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Đang tải mã...
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={loadCaptcha}
                      disabled={isCaptchaLoading}
                      title="Đổi mã khác"
                      className="p-2 text-slate-500 hover:text-teal-800 hover:bg-white bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isCaptchaLoading ? 'animate-spin text-teal-700' : ''}`} />
                    </button>

                    <div className="flex-1">
                      <input
                        type="text"
                        required
                        value={captchaInput}
                        onChange={(e) => setCaptchaInput(e.target.value.toUpperCase())}
                        placeholder="MÃ 5 KÝ TỰ"
                        maxLength={6}
                        className="w-full h-[40px] px-3 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold tracking-widest text-slate-800 placeholder:text-xs placeholder:font-sans placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-all uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* Circular Selection: Đồng ý với điều khoản kho Boxora */}
                <div
                  onClick={() => setAgreeTerms(!agreeTerms)}
                  className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700 font-medium select-none group pt-0.5"
                >
                  <div className={`w-4.5 h-4.5 mt-0.5 rounded-full flex items-center justify-center transition-all shrink-0 ${
                    agreeTerms ? 'bg-teal-700 text-white shadow-xs' : 'border-2 border-slate-300 bg-white group-hover:border-slate-400'
                  }`}>
                    {agreeTerms && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="leading-snug">
                    Tôi đồng ý với{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowTermsModal(true)
                      }}
                      className="text-teal-700 hover:text-teal-800 hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Điều khoản &amp; Quy chuẩn an toàn kho Boxora</span>
                      <ExternalLink className="w-3 h-3 text-teal-600 inline" />
                    </button>
                  </span>
                </div>

                {/* Submit CTA Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 sm:h-12 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xs sm:text-sm tracking-wider uppercase shadow-lg shadow-slate-900/15 hover:shadow-slate-900/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed mt-1.5"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>ĐĂNG KÝ TÀI KHOẢN MỚI</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </>
                  )}
                </button>

              </form>
            )}

            {!success && (
              <>
                {/* Divider */}
                <div className="relative py-1 text-center my-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative inline-block px-3 bg-white text-[10px] font-mono tracking-widest text-slate-400 uppercase font-bold">
                    HOẶC TIẾP TỤC VỚI
                  </div>
                </div>

                {/* Quick Google Register Button */}
                <GoogleAuthButton
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  mode="signup"
                  text="Đăng ký nhanh bằng tài khoản Google"
                  disabled={isLoading}
                />
              </>
            )}

            {/* Social notice feedback */}
            {socialNotice && (
              <div className="p-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-mono text-center flex items-center justify-between">
                <span>{socialNotice}</span>
                <button onClick={() => setSocialNotice(null)} className="text-teal-700 hover:text-slate-800">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Back to Login Link */}
            <div className="pt-2 border-t border-slate-100 text-center">
              <span className="text-xs text-slate-600">
                Đã có tài khoản lưu kho?{' '}
                <Link
                  to="/login"
                  className="font-bold text-teal-700 hover:text-teal-800 hover:underline inline-flex items-center gap-1"
                >
                  <span>Đăng nhập ngay</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </span>
            </div>

          </div>

        </div>

      </main>

      {/* ============================================================ */}
      {/* 4. FOOTER (CLEAN & PROFESSIONAL)                             */}
      {/* ============================================================ */}
      <footer className="relative z-20 w-full px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-600 font-mono">
        <span className="bg-white/75 backdrop-blur-md px-3.5 py-1 rounded-full border border-slate-200/60 shadow-2xs">
          BOXORA Smart Storage System • Tiêu chuẩn an ninh ISO/IEC 27001
        </span>
        <span className="text-slate-600 font-medium bg-white/75 backdrop-blur-md px-3.5 py-1 rounded-full border border-slate-200/60 shadow-2xs">
          Hotline hỗ trợ 24/7: <strong className="text-teal-700 font-bold">1900-6868</strong>
        </span>
      </footer>

      {/* Terms & Standards Dashboard Modal */}
      <TermsAndStandardsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => setAgreeTerms(true)}
      />

    </div>
  )
}

export default RegisterPage
