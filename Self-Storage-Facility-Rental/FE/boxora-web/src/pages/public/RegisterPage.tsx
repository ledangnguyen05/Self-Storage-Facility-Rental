import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authService } from '../../services/authService'
import { markUserAsNewCustomer } from '../../utils/rentalAccess'

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedUnit = searchParams.get('unit')

  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  })
  const [agreeTerms, setAgreeTerms] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!agreeTerms) {
      setError('Vui lòng đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của Boxora.')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu nhập lại không trùng khớp. Vui lòng kiểm tra lại.')
      return
    }

    if (formData.password.length < 6) {
      setError('Mật khẩu phải có độ dài tối thiểu 6 ký tự.')
      return
    }

    setIsLoading(true)
    try {
      const res = await authService.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        phone: formData.phone
      })
      const userId = (res as any)?.data?.id || (res as any)?.data?.user?.id || formData.username
      markUserAsNewCustomer(userId, formData.username, formData.email)
      setSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 1800)
    } catch (err: any) {
      console.error(err)
      setError(err?.response?.data?.message || 'Đăng ký không thành công. Vui lòng kiểm tra lại thông tin.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative w-full min-h-screen grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-[var(--surface-canvas,#f8fafc)] selection:bg-[#0891b2] selection:text-white">
      
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

        {/* Ambient Dark Gradients */}
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
              BOXORA ONBOARDING // VAULT GRID
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

        {/* Center Showcase Content */}
        <div className="relative z-10 my-auto py-10 max-w-xl text-left space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono text-[11px] uppercase tracking-wider font-bold">
              ĐĂNG KÝ KHÁCH THUÊ KHO TỰ QUẢN
            </span>
          </div>

          <div className="space-y-3">
            <h1 className="font-headline text-3xl lg:text-4xl text-white font-extrabold tracking-tight leading-[1.2]">
              Khởi Tạo Không Gian <br />
              <span className="text-[#06b6d4]">Lưu Trữ Chuẩn Xác</span>
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed max-w-lg font-normal">
              Mở tài khoản khách thuê chỉ trong 60 giây: Nhận mã PIN tức thời, cấp quyền ra vào 24/7 và bảo chứng an ninh đa lớp cho tài sản của bạn.
            </p>
          </div>

          {/* Telemetry Stats */}
          <div className="grid grid-cols-3 gap-6 pt-5 border-t border-slate-800/80">
            <div>
              <div className="flex items-center gap-1.5 text-cyan-400 mb-1">
                <span className="material-symbols-outlined text-[18px]">timer</span>
                <span className="font-mono text-lg font-bold text-white tabular-nums tracking-tight">60 Giây</span>
              </div>
              <p className="font-mono text-[10px] text-slate-400 uppercase tracking-wider font-medium">Cấp mã PIN</p>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-teal-400 mb-1">
                <span className="material-symbols-outlined text-[18px]">key</span>
                <span className="font-mono text-lg font-bold text-white tabular-nums tracking-tight">24/7</span>
              </div>
              <p className="font-mono text-[10px] text-slate-400 uppercase tracking-wider font-medium">Vào kho tự do</p>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-blue-400 mb-1">
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
                <span className="font-mono text-lg font-bold text-white tabular-nums tracking-tight">100%</span>
              </div>
              <p className="font-mono text-[10px] text-slate-400 uppercase tracking-wider font-medium">Bảo hiểm tài sản</p>
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
      {/* RIGHT PANEL: Registration Form (50% on Desktop)             */}
      {/* ============================================================ */}
      <div className="col-span-12 lg:col-span-6 min-h-screen flex flex-col justify-center items-center px-6 sm:px-10 lg:px-14 py-10 lg:py-14 bg-white z-10 relative">
        
        {/* Auth Form Container */}
        <div className="w-full max-w-xl mx-auto space-y-6 relative z-20 text-left">
          
          {/* Header with Brand Logo & Title */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              
              {/* Brand Logo */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--brand-teal,#0891b2)] flex items-center justify-center text-white font-bold shadow-md shadow-cyan-600/20">
                  <span className="material-symbols-outlined text-[22px]">lock</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-headline text-xl font-bold tracking-tight text-slate-900 leading-none">
                    Boxora<span className="text-[var(--brand-teal,#0891b2)]">.</span>
                  </span>
                  <span className="font-mono text-[10px] text-cyan-800 font-semibold uppercase tracking-widest mt-1">
                    Smart Storage
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold font-mono tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>ONLINE</span>
              </div>
            </div>

            <div className="pt-2">
              <h2 className="font-headline text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
                Tạo Tài Khoản <span className="text-[var(--brand-teal,#0891b2)]">Khách Thuê Kho</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mt-1">
                Điền thông tin bên dưới để đăng ký phòng kho và nhận mã PIN vào cửa 24/7 tức thì.
              </p>
            </div>
          </div>

          {/* Preselected Unit Notice if coming from Home Page */}
          {preselectedUnit && (
            <div className="p-3.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-950 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[var(--brand-teal,#0891b2)]">warehouse</span>
                <span>Đang đăng ký giữ chỗ phòng kho: <strong className="font-mono text-cyan-950 font-bold">{preselectedUnit}</strong></span>
              </div>
              <span className="font-mono text-[10px] uppercase font-bold text-[var(--brand-teal,#0891b2)] bg-white px-2 py-0.5 rounded border border-cyan-200">
                Ưu tiên
              </span>
            </div>
          )}

          {/* Form Container */}
          <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] space-y-5">
            
            {error && (
              <div role="alert" aria-live="polite" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2 leading-relaxed">
                <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0">error</span>
                <span>{error}</span>
              </div>
            )}

            {success ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-[28px]">check_circle</span>
                </div>
                <h3 className="font-headline text-lg font-bold text-slate-900">Đăng Ký Thành Công!</h3>
                <p className="text-xs text-slate-600">
                  Tài khoản đã sẵn sàng. Đang tự động chuyển hướng bạn tới trang đăng nhập...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Row 1: Full Name & Username */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-800 tracking-tight" htmlFor="fullName">
                      Họ và tên *
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[var(--brand-teal,#0891b2)] transition-colors">
                        <span className="material-symbols-outlined text-[18px]">person</span>
                      </div>
                      <input
                        id="fullName"
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                        placeholder="Nguyễn Văn A"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 text-slate-900 rounded-lg border border-slate-200 placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-[var(--brand-teal,#0891b2)] focus:ring-2 focus:ring-[var(--brand-teal,#0891b2)]/20 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-800 tracking-tight" htmlFor="username">
                      Tên đăng nhập *
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[var(--brand-teal,#0891b2)] transition-colors">
                        <span className="material-symbols-outlined text-[18px]">badge</span>
                      </div>
                      <input
                        id="username"
                        type="text"
                        required
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                        placeholder="nguyenvana"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 text-slate-900 rounded-lg border border-slate-200 placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-[var(--brand-teal,#0891b2)] focus:ring-2 focus:ring-[var(--brand-teal,#0891b2)]/20 transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 2: Email & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-800 tracking-tight" htmlFor="email">
                      Địa chỉ Email *
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[var(--brand-teal,#0891b2)] transition-colors">
                        <span className="material-symbols-outlined text-[18px]">mail</span>
                      </div>
                      <input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        placeholder="nguyen@example.com"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 text-slate-900 rounded-lg border border-slate-200 placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-[var(--brand-teal,#0891b2)] focus:ring-2 focus:ring-[var(--brand-teal,#0891b2)]/20 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-800 tracking-tight" htmlFor="phone">
                      Số điện thoại
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[var(--brand-teal,#0891b2)] transition-colors">
                        <span className="material-symbols-outlined text-[18px]">call</span>
                      </div>
                      <input
                        id="phone"
                        type="tel"
                        autoComplete="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        placeholder="0912 345 678"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 text-slate-900 rounded-lg border border-slate-200 placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-[var(--brand-teal,#0891b2)] focus:ring-2 focus:ring-[var(--brand-teal,#0891b2)]/20 transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 3: Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-800 tracking-tight" htmlFor="password">
                      Mật khẩu *
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[var(--brand-teal,#0891b2)] transition-colors">
                        <span className="material-symbols-outlined text-[18px]">lock</span>
                      </div>
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        placeholder="••••••••••••"
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 text-slate-900 rounded-lg border border-slate-200 placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-[var(--brand-teal,#0891b2)] focus:ring-2 focus:ring-[var(--brand-teal,#0891b2)]/20 transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        aria-pressed={showPassword}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-[var(--brand-teal,#0891b2)] focus-visible:text-[var(--brand-teal,#0891b2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-teal,#0891b2)]/30 rounded transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-800 tracking-tight" htmlFor="confirmPassword">
                      Xác nhận mật khẩu *
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[var(--brand-teal,#0891b2)] transition-colors">
                        <span className="material-symbols-outlined text-[18px]">verified</span>
                      </div>
                      <input
                        id="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                        placeholder="••••••••••••"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 text-slate-900 rounded-lg border border-slate-200 placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-[var(--brand-teal,#0891b2)] focus:ring-2 focus:ring-[var(--brand-teal,#0891b2)]/20 transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Agreement Checkbox */}
                <div className="pt-1">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[var(--brand-teal,#0891b2)] focus:ring-[var(--brand-teal,#0891b2)]/30 cursor-pointer"
                    />
                    <span className="text-xs text-slate-600 leading-relaxed">
                      Tôi đồng ý với{' '}
                      <span className="text-[var(--brand-teal,#0891b2)] font-semibold hover:underline">
                        Điều khoản dịch vụ
                      </span>{' '}
                      và{' '}
                      <span className="text-[var(--brand-teal,#0891b2)] font-semibold hover:underline">
                        Chính sách bảo mật kho Boxora
                      </span>.
                    </span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full relative group overflow-hidden py-3 px-6 rounded-lg bg-[var(--brand-teal,#0891b2)] hover:bg-[var(--brand-teal-hover,#0e7490)] active:scale-[0.99] text-white font-semibold text-xs sm:text-sm shadow-sm hover:shadow-md btn-tactile transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-teal,#0891b2)] focus-visible:ring-offset-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Đang tạo tài khoản...</span>
                    </>
                  ) : (
                    <>
                      <span className="tracking-wide">Đăng Ký Tài Khoản Khách Thuê</span>
                      <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">
                        arrow_forward
                      </span>
                    </>
                  )}
                </button>

              </form>
            )}

            {/* Divider */}
            <div className="relative flex items-center justify-center my-4">
              <div className="w-full h-px bg-slate-200" />
              <span className="absolute bg-white px-3 font-mono text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                Hoặc tiếp tục với
              </span>
            </div>

            {/* Social Google */}
            <button
              type="button"
              onClick={() => alert('Khởi tạo liên kết an toàn qua Google Identity Services với hệ thống Boxora.')}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-medium transition-all active:scale-[0.99] shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <svg aria-hidden="true" className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.665-5.17 3.665-9.12z" fill="#4285F4" />
                <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.13C3.25 21.31 7.33 24 12 24z" fill="#34A853" />
                <path d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.26C.46 8.18 0 9.99 0 12s.46 3.82 1.26 5.42l4.02-3.13z" fill="#FBBC05" />
                <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.69 1.26 6.58l4.02 3.13c.95-2.83 3.6-4.96 6.72-4.96z" fill="#EA4335" />
              </svg>
              <span>Đăng ký với Google</span>
            </button>

          </div>

          {/* Footer Notice & Sign In Link */}
          <div className="text-center space-y-2.5 pt-1">
            <p className="text-xs text-slate-600">
              Đã có tài khoản kho lưu trữ?{' '}
              <Link to="/login" className="text-[var(--brand-teal,#0891b2)] hover:text-[var(--brand-teal-hover,#0e7490)] font-bold underline decoration-cyan-400 underline-offset-4">
                Đăng nhập ngay
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

export default RegisterPage
