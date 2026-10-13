import React, { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth, ROLE_PRESETS } from '../../context/AuthContext'
import { checkCustomerPortalAccess } from '../../utils/rentalAccess'
import { BrandLogo } from '../../components/common/BrandLogo'

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect')
  const { login, isLoading } = useAuth()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleQuickLogin = async (preset: typeof ROLE_PRESETS[0]) => {
    setError(null)
    setIdentifier(preset.email)
    setPassword(preset.password)
    try {
      const user = await login(preset.email, preset.password)
      const userRole = user?.role?.name || preset.role
      if (preset.role === 'CUSTOMER') {
        const customerAccess = checkCustomerPortalAccess(user)
        navigate(customerAccess.hasAccess ? '/portal/customer' : '/units')
      } else {
        navigate(preset.portalPath)
      }
    } catch (err: any) {
      console.error('Quick login error:', err)
      setError('Đăng nhập nhanh thất bại. Vui lòng thử lại.')
    }
  }

  const handleStandardSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const user = await login(identifier, password)
      const userRole = user?.role?.name || 'CUSTOMER'

      const getPortalForRole = (r: string, loggedInUser: any): string => {
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
            // Khách hàng mới hoặc chưa kích hoạt kho thì chuyển đến Dashboard tìm kiếm & thuê kho
            const customerAccess = checkCustomerPortalAccess(loggedInUser)
            return customerAccess.hasAccess ? '/portal/customer' : '/units'
          default:
            return '/units'
        }
      }

      if (redirect) {
        const decoded = decodeURIComponent(redirect)
        const isAllowed =
          (decoded.startsWith('/portal/customer') && (userRole === 'CUSTOMER' || userRole === 'ADMIN') && (userRole !== 'CUSTOMER' || checkCustomerPortalAccess(user).hasAccess)) ||
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

      navigate(getPortalForRole(userRole, user))
    } catch (err: any) {
      console.error('Login error:', err)
      setError(
        err?.response?.data?.message ||
        'Tài khoản hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.'
      )
    }
  }


  return (
    <div className="relative w-full min-h-screen grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-[var(--surface-canvas,#f8fafc)] selection:bg-[var(--brand-cyan,#06b6d4)] selection:text-white">
      
      {/* ============================================================ */}
      {/* LEFT PANEL: High-Tech Vault Visual Showcase (50% on Desktop) */}
      {/* ============================================================ */}
      <div className="hidden lg:flex lg:col-span-6 min-h-screen flex-col justify-between p-8 lg:p-14 overflow-hidden bg-slate-950 relative">
        
        {/* Full-bleed Background Image with Futuristic Vault Mood */}
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105 opacity-80"
          style={{
            backgroundImage: `url('https://lh3.googleusercontent.com/aida/AEtjO1WpXWU4-MiCijB27t4tqXDrKPJfgXkQ8CXQ8B2MINWg3Dyb1gHA7mUasFsYwxQhb-y3hYq8WtjdhOtX-W7LKgAeuGblLkeN5uLNb8X8yjzLJ13t9l8msjA02JA2zED32X63sHrjW6l0b9zppRUJPgRS6f2N4VyjBGQu-z_cPVSuCW7p_7Zb0sX6_F7FRhOS_YZ6Bo1yFTDiyfsNt80qp10d95zslNs_H9kMeiPpntU2')`
          }}
        />

        {/* Multi-layered Ambient Light & Cyber Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/75 to-slate-950/40 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/50 to-transparent" />
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[var(--brand-cyan,#06b6d4)]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 left-10 w-80 h-80 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />

        {/* Top Status Indicator */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-900/85 backdrop-blur-md shadow-lg border border-slate-700/60">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
            </span>
            <span className="font-mono text-[11px] uppercase text-cyan-300 tracking-widest font-semibold">
              BOXORA SECURE GRID // NODE #04
            </span>
          </div>

          <Link
            to="/"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900/70 hover:bg-slate-900/95 backdrop-blur-md border border-slate-700/60 text-slate-300 hover:text-white text-xs font-medium tracking-normal transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">home</span>
            <span className="hidden sm:inline">Trang chủ</span>
          </Link>
        </div>

        {/* Center Showcase Content (Uncluttered, High Contrast & Deliberate Rhythm) */}
        <div className="relative z-10 my-auto py-10 max-w-xl text-left space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono text-[11px] uppercase tracking-wider font-bold">
              HỆ THỐNG LƯU TRỮ THÔNG MINH THẾ HỆ MỚI
            </span>
          </div>

          <div className="space-y-3">
            <h1 className="font-headline text-3xl lg:text-4xl text-white font-extrabold tracking-tight leading-[1.2]">
              Kho Lưu Trữ Chuẩn Xác <br />
              <span className="text-[#06b6d4]">An Tâm Tuyệt Đối</span>
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed max-w-lg font-normal">
              Không gian lưu trữ cá nhân &amp; doanh nghiệp thế hệ mới: Khóa điện tử mã hóa AES-256, kiểm soát nhiệt ẩm 24/7 và xác thực đa lớp.
            </p>
          </div>

          {/* Telemetry Stats: Clean layout, monospace tabular figures */}
          <div className="grid grid-cols-3 gap-6 pt-5 border-t border-slate-800/80">
            <div>
              <div className="flex items-center gap-1.5 text-cyan-400 mb-1">
                <span className="material-symbols-outlined text-[18px]">shield</span>
                <span className="font-mono text-lg font-bold text-white tabular-nums tracking-tight">99.9%</span>
              </div>
              <p className="font-mono text-[10px] text-slate-400 uppercase tracking-wider font-medium">Độ an toàn</p>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-teal-400 mb-1">
                <span className="material-symbols-outlined text-[18px]">key</span>
                <span className="font-mono text-lg font-bold text-white tabular-nums tracking-tight">24/7</span>
              </div>
              <p className="font-mono text-[10px] text-slate-400 uppercase tracking-wider font-medium">Mã PIN Số Hóa</p>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-blue-400 mb-1">
                <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                <span className="font-mono text-lg font-bold text-white tabular-nums tracking-tight">+15.000</span>
              </div>
              <p className="font-mono text-[10px] text-slate-400 uppercase tracking-wider font-medium">Kho sẵn sàng</p>
            </div>
          </div>
        </div>

        {/* Left Bottom Metadata */}
        <div className="relative z-10 flex items-center justify-between text-slate-300 pt-4 border-t border-slate-800/60">
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="flex items-center gap-1.5 text-cyan-300">
              <span className="material-symbols-outlined text-[15px]">lock_open</span> Cửa tự động
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1.5 text-teal-300 tabular-nums">
              <span className="material-symbols-outlined text-[15px]">thermostat</span> 21.5°C / 45% RH
            </span>
          </div>
          <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">
            © 2026 BOXORA CLOUD
          </span>
        </div>

      </div>

      {/* ============================================================ */}
      {/* RIGHT PANEL: Precision Sign In Glass Panel (50% on Desktop) */}
      {/* ============================================================ */}
      <div className="col-span-12 lg:col-span-6 min-h-screen flex flex-col justify-center items-center px-6 sm:px-12 lg:px-16 py-10 lg:py-14 bg-white z-10 relative">
        
        {/* Ambient Subtle Glow */}
        <div className="absolute -top-40 right-0 w-96 h-96 rounded-full bg-cyan-100/60 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-32 right-1/4 w-80 h-80 rounded-full bg-sky-100/50 blur-[100px] pointer-events-none" />

        {/* Auth Form Container */}
        <div className="w-full max-w-md mx-auto space-y-6 relative z-20 text-left">
          
          {/* Header with Brand Logo & Title */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              
              {/* Brand Logo */}
              <BrandLogo subtitle="SMART STORAGE" />

              {/* Environment Badge */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold font-mono tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>ONLINE</span>
              </div>
            </div>

            <div className="pt-2">
              <h2 className="font-headline text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
                Chào mừng trở lại <span className="text-[var(--brand-teal,#0891b2)]">Không Gian Của Bạn!</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mt-1.5">
                Mở khóa kho lưu trữ, kiểm soát cảm biến môi trường và truy cập an toàn chỉ trong 1 chạm.
              </p>
            </div>
          </div>

          {/* Light Card Container */}
          <div className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] space-y-5">
            
            {error && (
              <div role="alert" aria-live="polite" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2 leading-relaxed">
                <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0">error</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleStandardSubmit} className="space-y-4">
              
              {/* Email / Identifier Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-800 tracking-tight" htmlFor="identifier">
                  Email hoặc Số điện thoại
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[var(--brand-teal,#0891b2)] transition-colors">
                    <span className="material-symbols-outlined text-[20px]">badge</span>
                  </div>
                  <input
                    id="identifier"
                    type="text"
                    required
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="vidu@boxora.vn hoặc 0912..."
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 text-slate-900 rounded-lg border border-slate-200 placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-[var(--brand-teal,#0891b2)] focus:ring-2 focus:ring-[var(--brand-teal,#0891b2)]/20 transition-all"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-800 tracking-tight" htmlFor="password">
                  Mật khẩu
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[var(--brand-teal,#0891b2)] transition-colors">
                    <span className="material-symbols-outlined text-[20px]">lock</span>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-11 pr-11 py-2.5 bg-slate-50 text-slate-900 rounded-lg border border-slate-200 placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-[var(--brand-teal,#0891b2)] focus:ring-2 focus:ring-[var(--brand-teal,#0891b2)]/20 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-[var(--brand-teal,#0891b2)] focus-visible:text-[var(--brand-teal,#0891b2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-teal,#0891b2)]/30 rounded transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Utilities: Remember Me & Forgot Password */}
              <div className="flex items-center justify-between pt-0.5 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[var(--brand-teal,#0891b2)] focus:ring-[var(--brand-teal,#0891b2)]/30 cursor-pointer"
                  />
                  <span className="text-slate-600 hover:text-slate-900 transition-colors font-normal">
                    Ghi nhớ phiên đăng nhập
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    alert('Vui lòng liên hệ hotline hỗ trợ 1900-BOXORA hoặc nhân viên kỹ thuật để cấp lại mật khẩu.')
                  }}
                  className="text-[var(--brand-teal,#0891b2)] hover:text-[var(--brand-teal-hover,#0e7490)] font-semibold hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-teal,#0891b2)]/30 rounded"
                >
                  Quên mật khẩu?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full relative group overflow-hidden py-3 px-6 rounded-lg bg-[var(--brand-teal,#0891b2)] hover:bg-[var(--brand-teal-hover,#0e7490)] active:scale-[0.99] text-white font-semibold text-xs sm:text-sm shadow-sm hover:shadow-md btn-tactile transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-teal,#0891b2)] focus-visible:ring-offset-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Đang xác thực hệ thống...</span>
                  </>
                ) : (
                  <>
                    <span className="tracking-wide">Đăng nhập vào hệ thống</span>
                    <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">
                      arrow_forward
                    </span>
                  </>
                )}
              </button>

            </form>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-4">
              <div className="w-full h-px bg-slate-200" />
              <span className="absolute bg-white px-3 font-mono text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                Đăng nhập nhanh theo 5 vai trò (1-Click Demo)
              </span>
            </div>

            {/* Quick Demo Role Selector */}
            <div className="grid grid-cols-2 gap-2">
              {ROLE_PRESETS.map((preset) => (
                <button
                  key={preset.role}
                  type="button"
                  onClick={() => handleQuickLogin(preset)}
                  disabled={isLoading}
                  className={`p-2.5 rounded-lg border text-left transition-all active:scale-[0.98] cursor-pointer hover:shadow-xs flex flex-col justify-between ${
                    preset.role === 'CUSTOMER' ? 'col-span-2 bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100/60' :
                    preset.role === 'ADMIN' ? 'bg-rose-50/70 border-rose-200 hover:bg-rose-100/60' :
                    preset.role === 'BUSINESS_MANAGER' ? 'bg-purple-50/70 border-purple-200 hover:bg-purple-100/60' :
                    preset.role === 'FACILITY_MANAGER' ? 'bg-blue-50/70 border-blue-200 hover:bg-blue-100/60' :
                    'bg-amber-50/70 border-amber-200 hover:bg-amber-100/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-900 tracking-tight">
                      {preset.label}
                    </span>
                    <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded font-semibold bg-white/80 border border-slate-200 text-slate-600">
                      {preset.role}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-slate-500 truncate mt-1">
                    {preset.email} • pass: {preset.password}
                  </div>
                </button>
              ))}
            </div>

          </div>

          {/* Footer Notice & Sign Up Link */}
          <div className="text-center space-y-2.5 pt-1">
            <p className="text-xs text-slate-600">
              Chưa có tài khoản kho lưu trữ?{' '}
              <Link to="/register" className="text-[var(--brand-teal,#0891b2)] hover:text-[var(--brand-teal-hover,#0e7490)] font-bold underline decoration-cyan-400 underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-teal,#0891b2)]/30 rounded">
                Đăng ký thuê kho ngay
              </Link>
            </p>

            {/* Cryptographic Assurance Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[11px]">
              <span className="material-symbols-outlined text-[14px] text-[var(--brand-teal,#0891b2)]">enhanced_encryption</span>
              <span className="font-medium">Bảo mật chuẩn mã hóa AES-256 GCM</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  )
}
