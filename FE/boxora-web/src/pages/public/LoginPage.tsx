import React, { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Warehouse
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'

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
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  {
    role: 'STAFF',
    roleLabel: 'Nhân viên quầy',
    email: 'staff@gmail.com',
    pass: 'staff',
    color: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  {
    role: 'FACILITY_MANAGER',
    roleLabel: 'Quản lý cơ sở',
    email: 'facility@gmail.com',
    pass: 'facility',
    color: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  {
    role: 'BUSINESS_MANAGER',
    roleLabel: 'Giám đốc vận hành',
    email: 'business@gmail.com',
    pass: 'business',
    color: 'bg-purple-50 text-purple-700 border-purple-200'
  },
  {
    role: 'ADMIN',
    roleLabel: 'Quản trị viên',
    email: 'admin@gmail.com',
    pass: 'admin',
    color: 'bg-rose-50 text-rose-700 border-rose-200'
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
    <div className="bg-slate-50 min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 text-slate-900 font-sans antialiased text-left">
      <div className="max-w-md w-full space-y-6">
        
        {/* Brand & Title */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-semibold text-orange-700 mb-2 shadow-2xs">
            <Warehouse className="w-3.5 h-3.5 text-orange-600" />
            <span>BOXORA Self-Storage</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Đăng Nhập Tài Khoản
          </h2>
          <p className="text-xs text-slate-500">
            Truy cập và quản lý kho tự quản thông minh 24/7 trực tuyến
          </p>
        </div>

        {/* Central Login Form Card */}
        <Card className="p-7 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
                <Lock className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Xác Thực Tài Khoản
                </h3>
                <p className="text-[11px] text-slate-400">
                  Nhập tài khoản để vào không gian lưu trữ
                </p>
              </div>
            </div>
            {selectedRoleHint && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-200">
                {selectedRoleHint}
              </span>
            )}
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleStandardSubmit} className="space-y-4">
            {/* Email or Username */}
            <Input
              label="Email hoặc Tên đăng nhập"
              type="text"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setSelectedRoleHint(null)
              }}
              placeholder="Nhập email hoặc tên đăng nhập"
              leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
              required
              autoFocus
            />

            {/* Password with Show/Hide toggle */}
            <div className="w-full text-left">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[13px] font-medium text-slate-900 tracking-tight">
                  Mật khẩu
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-slate-500 hover:text-orange-600 transition-colors cursor-pointer flex items-center gap-1 font-medium"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPassword ? 'Ẩn' : 'Hiện'}</span>
                </button>
              </div>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-[46px] pl-10 pr-3.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full mt-4 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-sm transition-all"
              size="lg"
              isLoading={isLoading}
            >
              Đăng Nhập
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center">
            <span className="text-xs text-slate-500">
              Chưa có tài khoản khách thuê?{' '}
              <Link to="/register" className="font-semibold text-orange-600 hover:underline">
                Đăng ký ngay
              </Link>
            </span>
          </div>
        </Card>

        {/* Demo/Test Accounts Box (Light theme) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs text-left space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <div className="w-5 h-5 rounded bg-orange-100 text-orange-600 flex items-center justify-center">
                <KeyRound className="w-3 h-3 text-orange-600" />
              </div>
              <span>Tài khoản kiểm thử nhanh (Demo Accounts)</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Bấm để điền mẫu</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {TEST_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => handleFillAccount(acc)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 hover:bg-orange-50/60 border border-slate-200 hover:border-orange-200 transition-all text-left group cursor-pointer"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 group-hover:text-orange-600 transition-colors">
                      {acc.roleLabel}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${acc.color}`}>
                      {acc.role}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 mt-0.5 truncate">
                    <span>{acc.email}</span>
                    <span className="mx-1.5 text-slate-300">|</span>
                    <span>pass: <span className="text-slate-700 font-semibold">{acc.pass}</span></span>
                  </div>
                </div>

                <div className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 text-[10px] font-bold text-slate-600 transition-all shrink-0 shadow-2xs">
                  Điền
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-center text-[11px] text-slate-400">
          BOXORA Self-Storage Facility Management System • Hotline: 1900-6868
        </p>

      </div>
    </div>
  )
}

export default LoginPage
