import React, { FormEvent, useEffect, useState } from 'react'
import { UserRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface AccountProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

const vietnamesePhonePattern = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/

export const AccountProfileModal: React.FC<AccountProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setFullName(user?.fullName || '')
    setPhone(user?.phone || '')
    setError('')
  }, [isOpen, user])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedName = fullName.trim()
    const normalizedPhone = phone.trim()

    if (normalizedName.length < 3 || normalizedName.length > 30) {
      setError('Tên phải có từ 3 đến 30 ký tự.')
      return
    }
    if (!vietnamesePhonePattern.test(normalizedPhone)) {
      setError('Vui lòng nhập số điện thoại Việt Nam hợp lệ.')
      return
    }

    setIsSaving(true)
    setError('')
    try {
      await updateProfile({ fullName: normalizedName, phone: normalizedPhone })
      onClose()
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
        requestError?.message ||
        'Không thể lưu hồ sơ. Vui lòng thử lại.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Thông tin hồ sơ"
      description="Cập nhật tên và số điện thoại cho tài khoản của bạn."
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <UserRound size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">{user?.fullName || user?.username}</div>
            <div className="truncate text-xs text-slate-500">{user?.email}</div>
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Họ và tên</span>
          <input
            autoComplete="name"
            required
            minLength={3}
            maxLength={30}
            value={fullName}
            onChange={event => setFullName(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Số điện thoại</span>
          <input
            autoComplete="tel"
            inputMode="tel"
            type="tel"
            required
            value={phone}
            onChange={event => setPhone(event.target.value)}
            placeholder="0912345678"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          <span className="block text-xs text-slate-500">Email tài khoản không thể chỉnh sửa tại đây.</span>
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Hủy
          </Button>
          <Button type="submit" isLoading={isSaving}>
            Lưu hồ sơ
          </Button>
        </div>
      </form>
    </Modal>
  )
}
