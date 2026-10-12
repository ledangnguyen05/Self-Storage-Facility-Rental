import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  User,
  Mail,
  Phone,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Bot
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { authService } from '../../services/authService'

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  })

  // Anti-bot & Captcha states
  const [captchaId, setCaptchaId] = useState<string>('')
  const [captchaImage, setCaptchaImage] = useState<string>('')
  const [captchaInput, setCaptchaInput] = useState<string>('')
  const [isCaptchaLoading, setIsCaptchaLoading] = useState<boolean>(false)
  const [honeypot, setHoneypot] = useState<string>('') // Bot trap field
  const pageLoadedAt = useRef<number>(0)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

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
        <path d="M 5 20 Q 80 5 155 35" stroke="#fdba74" stroke-width="2" fill="none" opacity="0.6"/>
        <path d="M 10 35 Q 90 45 150 15" stroke="#94a3b8" stroke-width="1.5" fill="none" opacity="0.5"/>
        <text x="20" y="34" font-family="monospace, sans-serif" font-size="24" font-weight="bold" fill="#ea580c" letter-spacing="4">${code}</text>
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
      // Graceful fallback to client SVG if backend is starting or offline
      const fallback = generateFallbackCaptcha()
      setCaptchaId(fallback.id)
      setCaptchaImage(fallback.image)
    } finally {
      setIsCaptchaLoading(false)
    }
  }

  useEffect(() => {
    loadCaptcha()
    pageLoadedAt.current = Date.now()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // 1. Anti-bot honeypot detection
    if (honeypot) {
      setError('Hệ thống phát hiện hành vi tự động từ bot. Thao tác bị từ chối.')
      return
    }

    // 2. Anti-bot rapid submission check (must take at least 1.2s to fill out 6 fields)
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

    setIsLoading(true)
    try {
      await authService.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        phone: formData.phone,
        captchaId,
        captchaCode: captchaInput.trim().toUpperCase()
      })
      setSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 1800)
    } catch (err: any) {
      console.error(err)
      setError(err?.response?.data?.message || 'Đăng ký không thành công. Vui lòng thử lại.')
      // Refresh captcha on any failure to prevent brute forcing
      loadCaptcha()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-slate-50 min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 text-slate-900 font-sans antialiased text-left">
      <div className="max-w-md w-full space-y-6">
        
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-semibold text-orange-700 mb-2">
            BOXORA Self-Storage
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Tạo Tài Khoản Khách Thuê
          </h2>
          <p className="text-xs text-slate-500">
            Truy cập và quản lý kho tự quản thông minh 24/7 trực tuyến
          </p>
        </div>

        <Card className="p-7 bg-white border border-slate-200 shadow-sm rounded-2xl">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Đăng Ký Thành Công!</h3>
              <p className="text-xs text-slate-500">
                Đang chuyển hướng bạn tới trang đăng nhập...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <Input
                label="Họ và tên"
                value={formData.fullName}
                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                placeholder="Nguyễn Văn A"
                leftIcon={<User className="w-4 h-4" />}
                required
              />

              <Input
                label="Tên đăng nhập"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                placeholder="nguyenvana"
                required
              />

              <Input
                label="Địa chỉ Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="nguyen@example.com"
                leftIcon={<Mail className="w-4 h-4" />}
                required
              />

              <Input
                label="Số điện thoại"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="0912 345 678"
                leftIcon={<Phone className="w-4 h-4" />}
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Mật khẩu"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder="••••••••"
                  required
                />
                <Input
                  label="Xác nhận"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  placeholder="••••••••"
                  required
                />
              </div>

              {/* Anti-Bot Captcha Security Verification Box */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <ShieldCheck className="w-4 h-4 text-orange-600" />
                    <span>Xác thực chống Bot tự động</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                    <Bot className="w-3 h-3 text-slate-400" />
                    Bảo mật Captcha
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="relative flex-shrink-0 bg-white rounded-lg border border-slate-200 p-0.5 shadow-xs overflow-hidden h-[46px] flex items-center justify-center min-w-[140px]">
                    {captchaImage ? (
                      <img
                        src={captchaImage}
                        alt="Mã Captcha bảo mật"
                        className="h-full w-auto select-none pointer-events-none object-contain"
                      />
                    ) : (
                      <div className="text-[11px] text-slate-400 px-3 py-2 flex items-center gap-1">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Đang tải mã...
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={loadCaptcha}
                    disabled={isCaptchaLoading}
                    title="Đổi mã xác thực khác"
                    className="p-2.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isCaptchaLoading ? 'animate-spin text-orange-600' : ''}`} />
                  </button>

                  <div className="flex-1">
                    <input
                      type="text"
                      required
                      value={captchaInput}
                      onChange={(e) => setCaptchaInput(e.target.value.toUpperCase())}
                      placeholder="Nhập mã 5 ký tự"
                      maxLength={6}
                      className="w-full h-[46px] px-3 bg-white border border-slate-200 rounded-lg text-sm font-mono font-bold tracking-widest text-slate-800 placeholder:text-xs placeholder:font-sans placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all uppercase"
                    />
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 leading-tight">
                  Nhập chính xác các ký tự hiển thị trong hình ảnh trên để xác minh bạn là người dùng thật.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full mt-4 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-sm transition-all"
                size="lg"
                isLoading={isLoading}
              >
                Đăng Ký Tài Khoản
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          )}
        </Card>

        <p className="text-center text-xs text-slate-500">
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-semibold text-orange-600 hover:underline">
            Đăng nhập ngay
          </Link>
        </p>

      </div>
    </div>
  )
}

export default RegisterPage
