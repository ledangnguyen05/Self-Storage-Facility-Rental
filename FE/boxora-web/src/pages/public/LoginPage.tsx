import React, { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

interface TestAccount {
  role: string
  roleLabel: string
  email: string
  pass: string
  color: string
}

const TEST_ACCOUNTS: TestAccount[] = [
  {
    role: 'CUSTOMER',
    roleLabel: 'Khách hàng',
    email: 'customer@gmail.com',
    pass: 'customer',
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
  },
  {
    role: 'STAFF',
    roleLabel: 'Nhân viên quầy',
    email: 'staff@gmail.com',
    pass: 'staff',
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
  },
  {
    role: 'FACILITY_MANAGER',
    roleLabel: 'Quản lý cơ sở',
    email: 'facility@gmail.com',
    pass: 'facility',
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
  },
  {
    role: 'BUSINESS_MANAGER',
    roleLabel: 'Giám đốc vận hành',
    email: 'business@gmail.com',
    pass: 'business',
    color: 'bg-violet-500/10 text-violet-400 border-violet-500/30'
  },
  {
    role: 'ADMIN',
    roleLabel: 'Quản trị viên',
    email: 'admin@gmail.com',
    pass: 'admin',
    color: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
  }
]

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect')
  const { login, isLoading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRoleHint, setSelectedRoleHint] = useState<string | null>(null)

  const handleStandardSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const user = await login(email, password)
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
        'Tài khoản hoặc mật khẩu không chính xác. Vui lòng thử lại.'
      )
    }
  }

  const handleFillAccount = (acc: TestAccount) => {
    setEmail(acc.email)
    setPassword(acc.pass)
    setSelectedRoleHint(acc.role)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-slate-100 antialiased selection:bg-orange-500 selection:text-white relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-orange-600/15 via-orange-600/5 to-transparent blur-3xl pointer-events-none" />

      <div className="max-w-md w-full mx-auto space-y-6 relative z-10">
        
        {/* Brand & Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 backdrop-blur shadow-inner">
            <div className="w-7 h-7 rounded-lg bg-orange-600 text-white flex items-center justify-center font-bold shadow-md">
              <span className="material-symbols-outlined text-[18px]">warehouse</span>
            </div>
            <span className="font-headline font-bold text-sm tracking-tight text-white">
              BOXORA<span className="text-orange-500">.</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Đăng Nhập Hệ Thống
          </h1>
          <p className="text-xs text-slate-400">
            Hệ thống quản trị và cho thuê kho tự quản thông minh BOXORA.
          </p>
        </div>

        {/* Central Login Form */}
        <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 sm:p-7 backdrop-blur-md shadow-2xl space-y-5 text-left">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-500 text-[20px]">lock</span>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Xác Thực Tài Khoản
              </h3>
            </div>
            {selectedRoleHint && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">
                Đã chọn: {selectedRoleHint}
              </span>
            )}
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] text-rose-400 shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleStandardSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Email hoặc Tên đăng nhập
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                  mail
                </span>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setSelectedRoleHint(null)
                  }}
                  placeholder="Nhập email hoặc tên đăng nhập"
                  required
                  autoFocus
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
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
                  className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
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
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-orange-600/20 transition-all flex items-center justify-center gap-2 mt-3 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Đang kiểm tra thông tin...</span>
                </>
              ) : (
                <>
                  <span>Đăng Nhập</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-slate-700/60 text-center space-y-1">
            <span className="text-[11px] text-slate-400 block">
              Chưa có tài khoản khách thuê?{' '}
              <Link to="/register" className="text-orange-400 hover:underline font-semibold">
                Đăng ký trực tuyến
              </Link>
            </span>
          </div>
        </div>

        {/* Test Accounts Box (For Testing) */}
        <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-5 backdrop-blur-md shadow-xl text-left space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-700/50">
            <div className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-wider">
              <span className="material-symbols-outlined text-[18px]">key</span>
              <span>Tài khoản kiểm thử (Test Accounts)</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Bấm để điền nhanh</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {TEST_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => handleFillAccount(acc)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-900/90 border border-slate-700/60 hover:border-orange-500/50 transition-all text-left group cursor-pointer"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white group-hover:text-orange-400 transition-colors">
                      {acc.roleLabel}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border ${acc.color}`}>
                      {acc.role}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">
                    <span>{acc.email}</span>
                    <span className="mx-1.5 text-slate-600">|</span>
                    <span>pass: <span className="text-slate-300 font-semibold">{acc.pass}</span></span>
                  </div>
                </div>

                <div className="px-2.5 py-1 rounded-lg bg-slate-800 group-hover:bg-orange-600 text-[10px] font-bold text-slate-400 group-hover:text-white transition-all shrink-0">
                  Điền
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center text-[11px] text-slate-500">
          BOXORA Self-Storage Facility Management System • Hotline: 1900-6868
        </div>

      </div>
    </div>
  )
}

export default LoginPage
