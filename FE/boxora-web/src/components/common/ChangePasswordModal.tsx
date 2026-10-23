import React, { useState } from 'react'
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { authService } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'

interface ChangePasswordModalProps {
  isOpen: boolean
  onClose: () => void
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleResetForm = () => {
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowOldPassword(false)
    setShowNewPassword(false)
    setShowConfirmPassword(false)
    setError(null)
    setIsSuccess(false)
  }

  const handleClose = () => {
    handleResetForm()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!oldPassword) {
      setError('Vui lòng nhập mật khẩu hiện tại của bạn.')
      return
    }

    if (newPassword.length < 5) {
      setError('Mật khẩu mới phải có tối thiểu 5 ký tự.')
      return
    }

    if (newPassword === oldPassword) {
      setError('Mật khẩu mới không được trùng với mật khẩu hiện tại.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp với mật khẩu mới.')
      return
    }

    setIsLoading(true)
    try {
      await authService.changePassword({
        oldPassword,
        newPassword,
        confirmPassword
      })
      setIsSuccess(true)
      setTimeout(() => {
        handleClose()
      }, 2000)
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error
      if (msg && msg.toLowerCase().includes('old password')) {
        setError('Mật khẩu hiện tại không chính xác. Vui lòng kiểm tra lại.')
      } else if (msg && msg.toLowerCase().includes('same')) {
        setError('Mật khẩu mới không được trùng với mật khẩu cũ.')
      } else if (msg && msg.toLowerCase().includes('mismatch')) {
        setError('Mật khẩu xác nhận không khớp.')
      } else {
        setError(msg || 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại thông tin.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Đổi mật khẩu tài khoản"
      description="Cập nhật mật khẩu bảo mật mới cho tài khoản Boxora của bạn."
      maxWidth="sm"
    >
      {isSuccess ? (
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-sm animate-scaleUp">
            <CheckCircle2 size={32} />
          </div>
          <h4 className="text-base font-bold text-slate-900 dark:text-white">
            Đổi Mật Khẩu Thành Công!
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
            Mật khẩu của bạn đã được cập nhật an toàn. Cửa sổ này sẽ tự đóng trong giây lát.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2 animate-fadeIn">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-100 dark:border-slate-800">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
              <KeyRound size={18} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                {user?.fullName || user?.username}
              </div>
              <div className="truncate text-[11px] text-slate-500 font-mono">
                {user?.email}
              </div>
            </div>
          </div>

          {/* Mật khẩu hiện tại */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Mật khẩu hiện tại
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3 text-slate-400 pointer-events-none">
                <Lock size={15} />
              </div>
              <input
                type={showOldPassword ? 'text' : 'password'}
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 pl-9 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowOldPassword(!showOldPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showOldPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Mật khẩu mới */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Mật khẩu mới
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3 text-slate-400 pointer-events-none">
                <KeyRound size={15} />
              </div>
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                minLength={5}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 5 ký tự"
                className="w-full h-10 pl-9 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Xác nhận mật khẩu mới */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Xác nhận mật khẩu mới
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3 text-slate-400 pointer-events-none">
                <Lock size={15} />
              </div>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={5}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                className="w-full h-10 pl-9 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="pt-3 flex gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading}
              className="flex-1 justify-center py-2.5 text-xs font-bold"
            >
              {isLoading ? 'Đang cập nhật...' : 'Lưu mật khẩu mới'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

export default ChangePasswordModal
