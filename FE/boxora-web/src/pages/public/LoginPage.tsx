import React, { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth, ROLE_PRESETS } from '../../context/AuthContext'
import { RoleType } from '../../types'

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect')
  const { login, switchRole, isLoading } = useAuth()

  const [email, setEmail] = useState('admin@gmail.com')
  const [password, setPassword] = useState('admin')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeRoleLoggingIn, setActiveRoleLoggingIn] = useState<string | null>(null)

  const handleStandardSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const user = await login(email, password)
      const userRole = user?.role?.name || 'CUSTOMER'

      if (redirect) {
        navigate(decodeURIComponent(redirect))
      } else if (userRole === 'ADMIN') {
        navigate('/portal/admin')
      } else if (userRole === 'BUSINESS_MANAGER') {
        navigate('/portal/business-manager')
      } else if (userRole === 'FACILITY_MANAGER') {
        navigate('/portal/facility-manager')
      } else if (userRole === 'STAFF') {
        navigate('/portal/staff')
      } else {
        navigate('/portal/customer')
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(
        err?.response?.data?.message ||
        'Tài khoản hoặc mật khẩu không chính xác, hoặc máy chủ backend chưa khởi động.'
      )
    }
  }

  const handleQuickRoleLogin = async (targetRole: RoleType, portalPath: string) => {
    setActiveRoleLoggingIn(targetRole)
    setError(null)
    try {
      await switchRole(targetRole)
      if (redirect) {
        navigate(decodeURIComponent(redirect))
      } else {
        navigate(portalPath)
      }
    } catch (err: any) {
      console.error('Quick switch error:', err)
      setError(`Lỗi đăng nhập vai trò ${targetRole}: ${err.message}`)
    } finally {
      setActiveRoleLoggingIn(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-slate-100 antialiased selection:bg-orange-500 selection:text-white relative overflow-hidden">
      
      {/* Background Ambience / Industrial Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[350px] bg-gradient-to-b from-orange-600/10 via-orange-600/5 to-transparent blur-3xl pointer-events-none" />

      <div className="max-w-4xl w-full mx-auto space-y-8 relative z-10">
        
        {/* Brand & Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-slate-800/80 border border-slate-700/80 backdrop-blur shadow-inner">
            <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center font-bold shadow-md">
              <span className="material-symbols-outlined text-[20px]">warehouse</span>
            </div>
            <span className="font-headline font-bold text-base tracking-tight text-white">
              StorageOps <span className="text-orange-500">Pro</span>
            </span>
            <span className="h-4 w-[1px] bg-slate-700"></span>
            <span className="font-mono text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Backend API :8080 Online
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Cổng Đăng Nhập &amp; Phân Quyền Vận Hành
          </h1>
          <p className="max-w-2xl mx-auto text-sm text-slate-400">
            Hệ thống quản lý chuỗi kho tự quản thông minh. Vui lòng chọn tài khoản theo vai trò (RBAC) để trải nghiệm các phân hệ chuyên biệt.
          </p>
        </div>

        {/* Two-Column Grid: Demo Role Quick Switcher (Left) & Standard Login Form (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: 1-Click RBAC Demo Accounts (7 Cols) */}
          <div className="lg:col-span-7 bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 backdrop-blur-md shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500 text-[20px]">badge</span>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  1-Click Demo Login (5 Vai Trò RBAC)
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">MongoDB Seeded</span>
            </div>

            <p className="text-xs text-slate-300">
              Nhấp vào bất kỳ vai trò nào bên dưới để hệ thống tự động xác thực và chuyển hướng đến phân hệ tương ứng:
            </p>

            <div className="space-y-2.5">
              {ROLE_PRESETS.map((preset) => {
                const isLogging = activeRoleLoggingIn === preset.role
                return (
                  <button
                    key={preset.role}
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleQuickRoleLogin(preset.role, preset.portalPath)}
                    className="w-full text-left p-3.5 rounded-xl border border-slate-700/80 bg-slate-900/60 hover:bg-slate-750 hover:border-orange-500/60 hover:shadow-lg transition-all group relative overflow-hidden flex items-center justify-between"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 group-hover:border-orange-500/40 transition-colors">
                        <span className="material-symbols-outlined text-[22px] text-slate-300 group-hover:text-orange-400">
                          {preset.role === 'ADMIN' ? 'admin_panel_settings' :
                           preset.role === 'BUSINESS_MANAGER' ? 'finance' :
                           preset.role === 'FACILITY_MANAGER' ? 'apartment' :
                           preset.role === 'STAFF' ? 'badge' : 'person'}
                        </span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white group-hover:text-orange-400 transition-colors">
                            {preset.label}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {preset.role}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 truncate mt-0.5">
                          {preset.sublabel}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 mt-0.5">
                          Tài khoản: {preset.email} (mk: {preset.password})
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 pl-3">
                      {isLogging ? (
                        <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
                      ) : (
                        <span className="material-symbols-outlined text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all text-[20px]">
                          arrow_forward
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right: Traditional Email & Password Form (5 Cols) */}
          <div className="lg:col-span-5 bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 backdrop-blur-md shadow-2xl space-y-5 text-left">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-700/60">
              <span className="material-symbols-outlined text-orange-500 text-[20px]">vpn_key</span>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Đăng Nhập Thủ Công
              </h3>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] text-rose-400 shrink-0">error</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleStandardSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Email hoặc Tên đăng nhập</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    mail
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@gmail.com"
                    required
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Mật khẩu
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    lock
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-orange-600/20 transition-all flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Đang kiểm tra thông tin...</span>
                  </>
                ) : (
                  <>
                    <span>Đăng Nhập Vào Hệ Thống</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            <div className="pt-3 border-t border-slate-700/60 text-center space-y-2">
              <span className="text-[11px] text-slate-400 block">
                Chưa có tài khoản khách thuê?{' '}
                <Link to="/register" className="text-orange-400 hover:underline font-semibold">
                  Đăng ký trực tuyến
                </Link>
              </span>
              <span className="text-[11px] text-slate-500 block">
                Gặp vấn đề xác thực? Vui lòng liên hệ Hotline IT: 1900-6868
              </span>
            </div>
          </div>

        </div>

        {/* Footer Note */}
        <div className="text-center text-xs text-slate-500 pt-4">
          StorageOps Pro v2.4.0 • Enterprise Cloud Architecture • Spring Boot 3.4 &amp; MongoDB &amp; React 18
        </div>

      </div>
    </div>
  )
}
export default LoginPage
