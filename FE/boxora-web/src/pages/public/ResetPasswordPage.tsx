import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  ArrowLeft
} from 'lucide-react'
import { authService } from '../../services/authService'
import boxoraLogo from '../../assets/boxora-logo.png'
import futuristicBoxoraBg from '../../assets/Futuristic BOXORA Smart Warehouse.png'
import { QuickThemeLanguageToggle } from '../../components/common/QuickThemeLanguageToggle'

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('Mã xác thực (Token) không tồn tại hoặc liên kết không hợp lệ. Vui lòng kiểm tra lại liên kết trong email.')
      return
    }

    if (newPassword.length < 5) {
      setError('Mật khẩu mới phải có tối thiểu 5 ký tự.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp với mật khẩu mới.')
      return
    }

    setIsLoading(true)
    try {
      await authService.resetPassword({
        token,
        newPassword,
        confirmPassword
      })
      setIsSuccess(true)
    } catch (err: any) {
      console.error('Reset password error:', err)
      const msg = err?.response?.data?.message
      if (msg && msg.toLowerCase().includes('token')) {
        setError('Liên kết đặt lại mật khẩu đã hết hạn (quá 15 phút) hoặc đã được sử dụng. Vui lòng yêu cầu gửi lại email mới.')
      } else if (msg && msg.toLowerCase().includes('same')) {
        setError('Mật khẩu mới không được trùng với mật khẩu cũ.')
      } else {
        setError(msg || 'Không thể đặt lại mật khẩu. Vui lòng kiểm tra lại liên kết hoặc thử lại sau.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full relative flex flex-col justify-between overflow-x-hidden font-sans text-slate-800 bg-[#f1f5f9]">
      {/* Background Graphic with Crisp Overlay */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none">
        <img
          src={futuristicBoxoraBg}
          alt="Hệ thống kho tự quản thông minh Boxora"
          className="w-full h-full object-cover object-center scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/80 to-slate-950/90" />
      </div>

      {/* Top Header */}
      <header className="relative z-10 w-full px-6 sm:px-10 py-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src={boxoraLogo} alt="BOXORA" className="h-8 w-auto object-contain" />
          <span className="hidden sm:inline text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase">
            • SECURE ACCESS
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <QuickThemeLanguageToggle />
          <Link
            to="/login"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span>Về trang đăng nhập</span>
          </Link>
        </div>
      </header>

      {/* Main Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-4">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-2xl space-y-6 text-left">
          
          {/* Header icon & title */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-200/80 text-cyan-600 flex items-center justify-center mx-auto shadow-xs">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {isSuccess ? 'Đổi Mật Khẩu Thành Công' : 'Đặt Lại Mật Khẩu'}
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
              {isSuccess
                ? 'Mật khẩu của bạn đã được cập nhật thành công trên toàn bộ hệ thống.'
                : 'Thiết lập mật khẩu mới bảo mật chuẩn ngân hàng cho tài khoản lưu kho Boxora.'}
            </p>
          </div>

          {/* Missing Token Warning */}
          {!token && !isSuccess && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Thiếu mã token xác thực</span>
              </div>
              <p className="text-rose-600 leading-relaxed">
                Liên kết này không chứa mã xác thực hợp lệ. Vui lòng mở lại liên kết từ email của bạn hoặc gửi lại yêu cầu quên mật khẩu.
              </p>
              <div className="pt-1">
                <Link
                  to="/login"
                  className="font-bold underline text-rose-800 hover:text-rose-950"
                >
                  Yêu cầu cấp lại liên kết mới &rarr;
                </Link>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* SUCCESS STATE */}
          {isSuccess ? (
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>An toàn 100%</span>
                </div>
                <p className="leading-relaxed">
                  Mật khẩu mới đã được kích hoạt. Mọi phiên đăng nhập cũ trên các thiết bị khác đã được thu hồi để đảm bảo an toàn.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-sky-600 via-cyan-500 to-teal-400 hover:from-sky-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-cyan-500/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Đăng nhập ngay bây giờ</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* FORM STATE */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Field 1: Mật khẩu mới */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Mật khẩu mới
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Tối thiểu 5 ký tự"
                    required
                    disabled={!token || isLoading}
                    className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/15 transition-all disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Field 2: Xác nhận mật khẩu mới */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Xác nhận lại mật khẩu
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    required
                    disabled={!token || isLoading}
                    className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/15 transition-all disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Security Hint */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-600 shrink-0" />
                <span>Mật khẩu được mã hóa an toàn BCrypt Salted Hash trước khi lưu trữ.</span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!token || isLoading}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-sky-600 via-cyan-500 to-teal-400 hover:from-sky-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-cyan-500/25 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Đang cập nhật...</span>
                  </>
                ) : (
                  <>
                    <span>Cập nhật mật khẩu mới</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-5 text-center text-xs text-slate-400">
        &copy; 2026 Boxora Smart Storage. Hỗ trợ khẩn cấp: 1980-6868
      </footer>
    </div>
  )
}

