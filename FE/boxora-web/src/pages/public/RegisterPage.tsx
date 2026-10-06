import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Mail, Phone, Lock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react'
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
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu nhập lại không trùng khớp. Vui lòng kiểm tra lại.')
      return
    }

    setIsLoading(true)
    try {
      await authService.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        phone: formData.phone
      })
      setSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 1800)
    } catch (err: any) {
      console.error(err)
      setError(err?.response?.data?.message || 'Đăng ký không thành công. Vui lòng thử lại.')
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

              <Button
                type="submit"
                className="w-full mt-4 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-sm"
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
