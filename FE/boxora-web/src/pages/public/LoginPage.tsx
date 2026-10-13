import React, { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  Clock,
  HelpCircle,
  X,
  Wifi,
  Cloud,
  Sliders,
  Box,
  Check,
  ChevronRight,
  AlertCircle,
  ExternalLink,
  CheckCircle2
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { authService } from '../../services/authService'

import boxoraLogo from '../../assets/boxora-logo.png'
import { TermsAndStandardsModal } from '../../components/common/TermsAndStandardsModal'
import { GoogleAuthButton } from '../../components/auth/GoogleAuthButton'
import { AuthAnimatedBackground } from '../../components/auth/AuthAnimatedBackground'

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect')
  const { login, loginWithGoogle, isLoading } = useAuth()

  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(true)
  const [agreeTerms, setAgreeTerms] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modals
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [socialNotice, setSocialNotice] = useState<string | null>(null)

  // Forgot password states
  const [forgotEmail, setForgotEmail] = useState('')
  const [isForgotLoading, setIsForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)

  const handleOpenForgotModal = () => {
    setForgotEmail(email.trim())
    setForgotSuccess(false)
    setForgotError(null)
    setShowForgotModal(true)
  }

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError(null)

    if (!forgotEmail.trim()) {
      setForgotError('Vui lòng nhập địa chỉ email của bạn.')
      return
    }

    setIsForgotLoading(true)
    try {
      await authService.forgotPassword(forgotEmail.trim())
      setForgotSuccess(true)
    } catch (err: any) {
      setForgotError(
        err?.response?.data?.message || 'Có lỗi xảy ra khi gửi yêu cầu khôi phục mật khẩu. Vui lòng thử lại sau.'
      )
    } finally {
      setIsForgotLoading(false)
    }
  }

  const handleGoogleSuccess = async (idToken: string) => {
    setError(null)
    setSocialNotice('Đang xác thực tài khoản Google với hệ thống Boxora...')
    try {
      const user = await loginWithGoogle(idToken, 'LOGIN')
      setSocialNotice(null)
      const userRole = user?.role?.name || 'CUSTOMER'

      const getPortalForRole = (r: string) => {
        switch (r) {
          case 'ADMIN':
            return '/portal/admin'
          case 'BUSINESS_MANAGER':
            return '/portal/business-manager'
          case 'FACILITY_MANAGER':
            return '/portal/facility-manager'
          case 'STAFF':
            return '/portal/staff'
          case 'CUSTOMER':
          default:
            return '/portal/customer'
        }
      }

      if (redirect) {
        const decoded = decodeURIComponent(redirect)
        const isAllowed =
          (decoded.startsWith('/portal/customer') && (userRole === 'CUSTOMER' || userRole === 'ADMIN')) ||
          (decoded.startsWith('/portal/staff') && (userRole === 'STAFF' || userRole === 'FACILITY_MANAGER' || userRole === 'ADMIN')) ||
          (decoded.startsWith('/portal/facility-manager') && (userRole === 'FACILITY_MANAGER' || userRole === 'BUSINESS_MANAGER' || userRole === 'ADMIN')) ||
          (decoded.startsWith('/portal/business-manager') && (userRole === 'BUSINESS_MANAGER' || userRole === 'ADMIN')) ||
          (decoded.startsWith('/portal/admin') && userRole === 'ADMIN') ||
          (!decoded.startsWith('/portal/'))

        if (isAllowed) {
          navigate(decoded)
          return
        }
      }

      navigate(getPortalForRole(userRole))
    } catch (err: any) {
      console.error('Google login error:', err)
      setSocialNotice(null)
      const errCode = err?.response?.data?.code
      const serverMsg = err?.response?.data?.message

      // Nếu tài khoản Google chưa đăng ký (code 306) -> Điều hướng người dùng sang trang Đăng ký!
      if (errCode === 306) {
        let googleEmail = ''
        let googleName = ''
        try {
          const payload = JSON.parse(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
          googleEmail = payload.email || ''
          googleName = payload.name || ''
        } catch {
          // ignore parsing error
        }

        navigate('/register', {
          state: {
            fromGoogleLogin: true,
            email: googleEmail,
            fullName: googleName,
            googleIdToken: idToken,
            message: `Tài khoản Google (${googleEmail || 'này'}) chưa được đăng ký trong hệ thống Boxora. Vui lòng đăng ký tài khoản dưới đây để tiếp tục.`
          }
        })
        return
      }

      if (serverMsg) {
        setError(serverMsg)
      } else if (!err?.response) {
        setError('Không thể kết nối đến máy chủ Boxora (Backend). Vui lòng đảm bảo máy chủ đang hoạt động và thử lại.')
      } else {
        setError('Đăng nhập bằng tài khoản Google thất bại. Vui lòng thử lại.')
      }
    }
  }

  const handleGoogleError = (errMsg: string) => {
    setError(errMsg)
  }

  // Submit login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ email đăng nhập và mật khẩu.')
      return
    }

    if (!agreeTerms) {
      setError('Vui lòng tích chọn đồng ý với Điều khoản & Quy chuẩn an toàn kho Boxora.')
      return
    }

    try {
      const user = await login(email.trim(), password)
      const userRole = user?.role?.name || 'CUSTOMER'

      const getPortalForRole = (r: string) => {
        switch (r) {
          case 'ADMIN':
            return '/portal/admin'
          case 'BUSINESS_MANAGER':
            return '/portal/business-manager'
          case 'FACILITY_MANAGER':
            return '/portal/facility-manager'
          case 'STAFF':
            return '/portal/staff'
          case 'CUSTOMER':
          default:
            return '/portal/customer'
        }
      }

      if (redirect) {
        const decoded = decodeURIComponent(redirect)
        const isAllowed =
          (decoded.startsWith('/portal/customer') && (userRole === 'CUSTOMER' || userRole === 'ADMIN')) ||
          (decoded.startsWith('/portal/staff') && (userRole === 'STAFF' || userRole === 'FACILITY_MANAGER' || userRole === 'ADMIN')) ||
          (decoded.startsWith('/portal/facility-manager') && (userRole === 'FACILITY_MANAGER' || userRole === 'BUSINESS_MANAGER' || userRole === 'ADMIN')) ||
          (decoded.startsWith('/portal/business-manager') && (userRole === 'BUSINESS_MANAGER' || userRole === 'ADMIN')) ||
          (decoded.startsWith('/portal/admin') && userRole === 'ADMIN') ||
          (!decoded.startsWith('/portal/'))

        if (isAllowed) {
          navigate(decoded)
          return
        }
      }

      navigate(getPortalForRole(userRole))
    } catch (err: any) {
      console.error('Login error:', err)
      setError(
        err?.response?.data?.message ||
        'Email đăng nhập hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.'
      )
    }
  }

  return (
    <div className="min-h-screen w-full relative flex flex-col justify-between overflow-x-hidden font-sans text-slate-800 bg-[#f4f8ff]">
      
      {/* ============================================================ */}
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
              Bảo Mật 24/7
            </span>
            <span className="block text-[9px] sm:text-[10px] font-semibold text-slate-500">
              Mã hóa dữ liệu an toàn
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
        <div className="w-full lg:w-[54%] xl:w-[56%] flex flex-col justify-between py-2 sm:py-6 space-y-8 lg:space-y-10">
          
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
                    Bảo mật đa lớp
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
              Công nghệ IoT hiện đại, bảo mật đa lớp và hệ thống quản lý thông minh mang đến trải nghiệm lưu trữ an toàn, tiện lợi và linh hoạt cho bạn.
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
        {/* RIGHT COLUMN: Floating Card Login Panel                   */}
        {/* ========================================================== */}
        <div className="w-full max-w-[460px] lg:w-[440px] xl:w-[460px] shrink-0 my-auto">
          
          <div className="w-full bg-white/98 backdrop-blur-md rounded-[32px] sm:rounded-[36px] border-2 border-teal-100 shadow-[0_20px_50px_rgba(15,23,42,0.12),0_0_40px_rgba(13,148,136,0.08)] p-6 sm:p-8 lg:p-9 relative z-30 transition-all text-left space-y-4">
            
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
                Đăng nhập tài khoản
              </h2>
              <p className="text-xs sm:text-[13px] text-slate-600 font-medium">
                Kết nối không gian lưu trữ thông minh &amp; quản lý ô kho của bạn
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 shadow-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              
              {/* Field 1: Email đăng nhập */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800">
                  Email đăng nhập
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Nhập email của bạn (ví dụ: customer@gmail.com)"
                    required
                    autoFocus
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-all shadow-2xs font-medium"
                  />
                </div>
              </div>

              {/* Field 2: Mật khẩu */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-slate-800">
                    Mật khẩu
                  </label>
                  <button
                    type="button"
                    onClick={handleOpenForgotModal}
                    className="text-teal-700 hover:text-teal-800 hover:underline font-semibold text-[11px] cursor-pointer"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu truy cập"
                    required
                    className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-all shadow-2xs font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Circular Selection 1: Ghi nhớ thiết bị an toàn */}
              <div
                onClick={() => setRememberDevice(!rememberDevice)}
                className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-700 font-medium select-none group pt-1"
              >
                <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center transition-all shrink-0 ${
                  rememberDevice ? 'bg-teal-700 text-white shadow-xs' : 'border-2 border-slate-300 bg-white group-hover:border-slate-400'
                }`}>
                  {rememberDevice && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>Ghi nhớ thiết bị an toàn</span>
              </div>

              {/* Circular Selection 2: Điều khoản & Quy chuẩn */}
              <div
                onClick={() => setAgreeTerms(!agreeTerms)}
                className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700 font-medium select-none group"
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
                className="w-full h-11 sm:h-12 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xs sm:text-sm tracking-wider uppercase shadow-lg shadow-slate-900/15 hover:shadow-slate-900/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>ĐĂNG NHẬP</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>

            </form>

            {/* Divider */}
            <div className="relative py-1 text-center my-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative inline-block px-3 bg-white text-[10px] font-mono tracking-widest text-slate-400 uppercase font-bold">
                HOẶC TIẾP TỤC VỚI
              </div>
            </div>

            {/* Quick Google Login Button */}
            <GoogleAuthButton
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              mode="signin"
              text="Đăng nhập nhanh bằng tài khoản Google"
              disabled={isLoading}
            />

            {/* Feedback notification */}
            {socialNotice && (
              <div className="p-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-mono text-center flex items-center justify-between">
                <span>{socialNotice}</span>
                <button onClick={() => setSocialNotice(null)} className="text-teal-700 hover:text-slate-800">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Registration Direct Link */}
            <div className="pt-2 border-t border-slate-100 text-center">
              <span className="text-xs text-slate-600">
                Chưa có tài khoản lưu kho?{' '}
                <Link
                  to="/register"
                  className="font-bold text-teal-700 hover:text-teal-800 hover:underline inline-flex items-center gap-1"
                >
                  <span>Đăng ký ngay</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </span>
            </div>

          </div>

        </div>

      </main>

      {/* ============================================================ */}
      {/* 4. FOOTER (CLEAN & PROFESSIONAL - NO TEST ACCOUNTS)         */}
      {/* ============================================================ */}
      <footer className="relative z-20 w-full px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-600 font-mono">
        <span className="bg-white/75 backdrop-blur-md px-3.5 py-1 rounded-full border border-slate-200/60 shadow-2xs">
          BOXORA Smart Storage System • Tiêu chuẩn an ninh ISO/IEC 27001
        </span>
        <span className="text-slate-600 font-medium bg-white/75 backdrop-blur-md px-3.5 py-1 rounded-full border border-slate-200/60 shadow-2xs">
          Hotline hỗ trợ 24/7: <strong className="text-teal-700 font-bold">1900-6868</strong>
        </span>
      </footer>


      {/* ============================================================ */}
      {/* 6. MODAL: QUÊN MẬT KHẨU (GỬI LINK RESET QUA EMAIL)           */}
      {/* ============================================================ */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-6 sm:p-7 space-y-4 shadow-2xl text-left animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-teal-700 font-mono text-xs font-bold">
                <HelpCircle className="w-4 h-4 text-teal-700" />
                <span>KHÔI PHỤC MẬT KHẨU BOXORA</span>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {forgotSuccess ? (
              <div className="space-y-4 py-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="text-center space-y-1.5">
                  <h4 className="text-sm font-black text-slate-900">
                    Đã Gửi Liên Kết Khôi Phục!
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-sans px-2">
                    Nếu email <strong className="text-slate-900">{forgotEmail}</strong> tồn tại trong hệ thống, chúng tôi đã gửi một liên kết đổi mật khẩu an toàn.
                  </p>
                  <p className="text-[11px] text-amber-600 bg-amber-50 rounded-xl p-2.5 font-medium border border-amber-200/60 mt-2">
                    Liên kết có hiệu lực trong <strong>15 phút</strong>. Vui lòng kiểm tra cả thư mục Thư rác (Spam) nếu không thấy trong Hộp thư đến.
                  </p>
                </div>
                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForgotSuccess(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Gửi lại email
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-800 to-teal-700 hover:from-teal-700 hover:to-teal-600 text-white font-bold text-xs transition-all shadow-md shadow-teal-700/15 cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Nhập địa chỉ email đăng ký tài khoản của bạn. Hệ thống Boxora sẽ gửi liên kết bảo mật để bạn thiết lập lại mật khẩu mới.
                </p>

                {forgotError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{forgotError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Email tài khoản Boxora
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="vidu@boxora.vn"
                      required
                      className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isForgotLoading}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-800 to-teal-700 hover:from-teal-700 hover:to-teal-600 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-teal-700/15 disabled:opacity-60 flex items-center justify-center gap-1.5"
                  >
                    {isForgotLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Đang gửi...</span>
                      </>
                    ) : (
                      <span>Gửi liên kết</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Terms & Standards Dashboard Modal */}
      <TermsAndStandardsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => setAgreeTerms(true)}
      />

    </div>
  )
}

export default LoginPage
