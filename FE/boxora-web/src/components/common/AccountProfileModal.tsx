import React, { FormEvent, useEffect, useState } from 'react'
import { UserRound, ShieldCheck, CreditCard, KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { authService } from '../../services/authService'
import {
  IdCardType,
  CCCD_PATTERN,
  PASSPORT_PATTERN,
  loadUserSavedIdDoc,
  saveUserSavedIdDoc
} from '../../utils/userIdDocument'

interface AccountProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

type TabId = 'profile' | 'security'

const PHONE_PATTERN = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (pw.length >= 12) score++
  if (score <= 1) return { score, label: 'Rất yếu', color: 'bg-rose-500' }
  if (score === 2) return { score, label: 'Yếu', color: 'bg-orange-400' }
  if (score === 3) return { score, label: 'Trung bình', color: 'bg-amber-400' }
  if (score === 4) return { score, label: 'Mạnh', color: 'bg-emerald-400' }
  return { score, label: 'Rất mạnh', color: 'bg-emerald-600' }
}

const PasswordInput: React.FC<{
  value: string
  onChange: (v: string) => void
  placeholder?: string
  icon?: React.ReactNode
  showStrength?: boolean
  autoComplete?: string
}> = ({ value, onChange, placeholder = '••••••••', icon, showStrength, autoComplete }) => {
  const [show, setShow] = useState(false)
  const strength = showStrength ? getPasswordStrength(value) : null

  return (
    <div className="space-y-1.5">
      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-3 text-slate-400 pointer-events-none">{icon}</div>
        )}
        <input
          type={show ? 'text' : 'password'}
          required
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full h-10 pl-9 pr-10 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
          tabIndex={-1}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {showStrength && value && strength && (
        <div className="space-y-1">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-full transition-colors ${i <= strength.score ? strength.color : 'bg-slate-200'}`}
              />
            ))}
          </div>
          <p className={`text-[10px] font-semibold ${
            strength.score <= 1 ? 'text-rose-600'
            : strength.score <= 2 ? 'text-orange-500'
            : strength.score <= 3 ? 'text-amber-600'
            : 'text-emerald-600'
          }`}>
            Độ mạnh: {strength.label}
          </p>
        </div>
      )}
    </div>
  )
}

export const AccountProfileModal: React.FC<AccountProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('profile')

  // Profile tab
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [idCardType, setIdCardType] = useState<IdCardType>('CCCD')
  const [cccdNumber, setCccdNumber] = useState('')
  const [passportNumber, setPassportNumber] = useState('')
  const [profileError, setProfileError] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  // Security tab
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [isSavingPw, setIsSavingPw] = useState(false)
  const [pwSuccess, setPwSuccess] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setActiveTab('profile')
    setFullName(user?.fullName || '')
    setPhone(user?.phone || '')
    const doc = loadUserSavedIdDoc(user)
    setIdCardType(doc.preferredType)
    setCccdNumber(doc.cccd)
    setPassportNumber(doc.passport)
    setProfileError('')
    setProfileSaved(false)
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPwError(null)
    setPwSuccess(false)
  }, [isOpen, user])

  const handleProfileSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = fullName.trim()
    const ph = phone.trim()
    const activeIdNum = idCardType === 'CCCD' ? cccdNumber.trim() : passportNumber.trim()

    if (name.length < 3 || name.length > 30) {
      setProfileError('Tên phải có từ 3 đến 30 ký tự.')
      return
    }
    if (!PHONE_PATTERN.test(ph)) {
      setProfileError('Vui lòng nhập số điện thoại Việt Nam hợp lệ.')
      return
    }
    if (activeIdNum) {
      if (idCardType === 'CCCD' && !CCCD_PATTERN.test(activeIdNum)) {
        setProfileError('Số CCCD phải gồm đúng 12 chữ số.')
        return
      }
      if (idCardType === 'PASSPORT' && !PASSPORT_PATTERN.test(activeIdNum)) {
        setProfileError('Số hộ chiếu không hợp lệ (VD: B1234567).')
        return
      }
    }

    setIsSavingProfile(true)
    setProfileError('')
    try {
      await updateProfile({ fullName: name, phone: ph })
      if (user) {
        saveUserSavedIdDoc(user, idCardType, cccdNumber.trim(), passportNumber.trim())
        window.dispatchEvent(
          new CustomEvent('boxora_id_document_updated', {
            detail: { type: idCardType, cccd: cccdNumber.trim(), passport: passportNumber.trim() }
          })
        )
      }
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2500)
    } catch (err: any) {
      setProfileError(
        err?.response?.data?.message ||
        err?.message ||
        'Không thể lưu hồ sơ. Vui lòng thử lại.'
      )
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPwError(null)

    if (!oldPassword) { setPwError('Vui lòng nhập mật khẩu hiện tại.'); return }
    if (newPassword.length < 5) { setPwError('Mật khẩu mới phải ít nhất 5 ký tự.'); return }
    if (newPassword === oldPassword) { setPwError('Mật khẩu mới không được trùng mật khẩu hiện tại.'); return }
    if (newPassword !== confirmPassword) { setPwError('Xác nhận mật khẩu không khớp.'); return }

    setIsSavingPw(true)
    try {
      await authService.changePassword({ oldPassword, newPassword, confirmPassword })
      setPwSuccess(true)
      setTimeout(() => {
        setPwSuccess(false)
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }, 2500)
    } catch (err: any) {
      const msg: string = err?.response?.data?.message || err?.response?.data?.error || ''
      if (msg.toLowerCase().includes('old password') || msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('wrong')) {
        setPwError('Mật khẩu hiện tại không chính xác.')
      } else if (msg.toLowerCase().includes('same')) {
        setPwError('Mật khẩu mới không được trùng mật khẩu cũ.')
      } else {
        setPwError(msg || 'Đổi mật khẩu thất bại. Vui lòng thử lại.')
      }
    } finally {
      setIsSavingPw(false)
    }
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Hồ Sơ', icon: <UserRound size={14} /> },
    { id: 'security', label: 'Đổi mật khẩu', icon: <ShieldCheck size={14} /> },
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tài khoản của bạn"
      description="Quản lý thông tin cá nhân và bảo mật tài khoản."
      maxWidth="sm"
    >
      {/* User banner */}
      <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm shadow-sm shrink-0">
          {(user?.fullName || user?.username || 'U').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-slate-900">{user?.fullName || user?.username}</div>
          <div className="truncate text-xs text-slate-500">{user?.email}</div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB HỒ SƠ ── */}
      {activeTab === 'profile' && (
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          {/* Họ tên */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Họ và tên</label>
            <input
              autoComplete="name"
              required
              minLength={3}
              maxLength={30}
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Số điện thoại */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Số điện thoại</label>
            <input
              autoComplete="tel"
              inputMode="tel"
              type="tel"
              required
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="0912345678"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Email (readonly) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-400">Email tài khoản</label>
            <input
              type="email"
              readOnly
              value={user?.email || ''}
              className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-400 outline-none cursor-not-allowed"
            />
            <p className="text-[10px] text-slate-400">Email không thể chỉnh sửa tại đây.</p>
          </div>

          {/* CCCD / Hộ chiếu */}
          <div className="space-y-2 p-3 rounded-xl border border-slate-200 bg-slate-50/60">
            <div className="flex items-center gap-1.5">
              <CreditCard size={13} className="text-slate-500" />
              <span className="text-xs font-bold text-slate-700">CCCD / Hộ chiếu</span>
            </div>

            <div className="flex gap-1.5">
              {(['CCCD', 'PASSPORT'] as IdCardType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setIdCardType(t)
                    setProfileError('')
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    idCardType === t
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {t === 'CCCD' ? '🪪 CCCD' : '📘 Hộ chiếu'}
                </button>
              ))}
            </div>

            <input
              type="text"
              inputMode={idCardType === 'CCCD' ? 'numeric' : 'text'}
              maxLength={idCardType === 'CCCD' ? 12 : 9}
              value={idCardType === 'CCCD' ? cccdNumber : passportNumber}
              onChange={e => {
                const raw = e.target.value
                if (idCardType === 'CCCD') {
                  setCccdNumber(raw.replace(/\D/g, '').slice(0, 12))
                } else {
                  setPassportNumber(raw.toUpperCase().slice(0, 9))
                }
                setProfileError('')
              }}
              placeholder={idCardType === 'CCCD' ? '12 chữ số (VD: 079201012345)' : 'VD: B1234567'}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 font-mono outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            <p className="text-[10px] text-slate-400">
              Dùng để xác thực khi làm thủ tục nhận/trả kho.
            </p>
          </div>

          {/* Error */}
          {profileError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {profileError}
            </div>
          )}


          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSavingProfile}>
              Hủy
            </Button>
            <Button type="submit" isLoading={isSavingProfile}>
              Lưu hồ sơ
            </Button>
          </div>
        </form>
      )}

      {/* ── TAB BẢO MẬT ── */}
      {activeTab === 'security' && (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          {pwSuccess ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-sm">
                <CheckCircle2 size={30} />
              </div>
              <h4 className="text-base font-bold text-slate-900">Đổi mật khẩu thành công!</h4>
              <p className="text-xs text-slate-500 max-w-xs">
                Mật khẩu của bạn đã được cập nhật an toàn.
              </p>
            </div>
          ) : (
            <>
              {pwError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  {pwError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Mật khẩu hiện tại</label>
                <PasswordInput
                  value={oldPassword}
                  onChange={setOldPassword}
                  placeholder="Nhập mật khẩu hiện tại"
                  icon={<Lock size={14} />}
                  autoComplete="current-password"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Mật khẩu mới</label>
                <PasswordInput
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="Tối thiểu 5 ký tự"
                  icon={<KeyRound size={14} />}
                  showStrength
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Xác nhận mật khẩu mới</label>
                <PasswordInput
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Nhập lại mật khẩu mới"
                  icon={<Lock size={14} />}
                  autoComplete="new-password"
                />
                {confirmPassword && newPassword && (
                  <p className={`text-[10px] font-semibold flex items-center gap-1 ${
                    confirmPassword === newPassword ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {confirmPassword === newPassword
                      ? <><CheckCircle2 size={11} /> Mật khẩu khớp</>
                      : <><AlertCircle size={11} /> Mật khẩu chưa khớp</>
                    }
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button type="button" variant="secondary" onClick={onClose} disabled={isSavingPw}>
                  Hủy
                </Button>
                <Button type="submit" isLoading={isSavingPw}>
                  Lưu mật khẩu mới
                </Button>
              </div>
            </>
          )}
        </form>
      )}
    </Modal>
  )
}
