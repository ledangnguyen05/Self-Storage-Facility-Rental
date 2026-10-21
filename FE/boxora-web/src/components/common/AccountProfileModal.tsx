import React, { FormEvent, useId, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getApiErrorCode, getApiErrorMessage } from '../../lib/apiError'
import {
  PASSWORD_HINT,
  validateFullName,
  validatePassword,
  validatePasswordConfirmation,
} from '../../pages/public/auth/credentialRules'
import { PasswordInput } from '../../pages/public/components/PasswordInput'
import { Alert, Avatar, Button, Field, Input, Modal, Tabs, useToast } from '../ui'

interface AccountProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

type DialogTab = 'profile' | 'password'

const vietnamesePhonePattern = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/

/** Backend `ErrorCode`s of PUT /auth/change-password. */
const ERROR_INVALID_OLD_PASSWORD = 501
const ERROR_NEW_PASSWORD_SAME_AS_OLD = 502

/** Edit the signed-in user's name and phone number, or change the password. */
export const AccountProfileModal: React.FC<AccountProfileModalProps> = ({ isOpen, onClose }) =>
  // Mounted only while open, so the forms always start from the current profile.
  isOpen ? <AccountDialog onClose={onClose} /> : null

function AccountDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const profileFormId = useId()
  const passwordFormId = useId()
  const [tab, setTab] = useState<DialogTab>('profile')
  const [isSaving, setIsSaving] = useState(false)

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Tài khoản của tôi"
      description={tab === 'profile' ? 'Cập nhật tên và số điện thoại cho tài khoản của bạn.' : 'Đặt mật khẩu mới cho tài khoản của bạn.'}
      dismissible={!isSaving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Hủy
          </Button>
          <Button type="submit" form={tab === 'profile' ? profileFormId : passwordFormId} loading={isSaving}>
            {tab === 'profile' ? 'Lưu thay đổi' : 'Cập nhật mật khẩu'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 p-3">
          <Avatar name={user?.fullName || user?.username} src={user?.avatar} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-fg">{user?.fullName || user?.username}</p>
            <p className="truncate text-dense text-fg-muted">{user?.email}</p>
          </div>
        </div>

        <Tabs
          variant="segmented"
          aria-label="Thông tin tài khoản"
          value={tab}
          onValueChange={next => {
            if (!isSaving) setTab(next as DialogTab)
          }}
          items={[
            { value: 'profile', label: 'Hồ sơ' },
            { value: 'password', label: 'Đổi mật khẩu' },
          ]}
          fullWidth
        />

        {tab === 'profile' ? (
          <ProfileForm formId={profileFormId} onSavingChange={setIsSaving} onDone={onClose} />
        ) : (
          <PasswordForm formId={passwordFormId} onSavingChange={setIsSaving} onDone={onClose} />
        )}
      </div>
    </Modal>
  )
}

interface FormProps {
  formId: string
  onSavingChange: (saving: boolean) => void
  onDone: () => void
}

function ProfileForm({ formId, onSavingChange, onDone }: FormProps) {
  const { user, updateProfile } = useAuth()
  const toast = useToast()
  const [fullName, setFullName] = useState(user?.fullName || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [nameError, setNameError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [requestError, setRequestError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedName = fullName.trim()
    const normalizedPhone = phone.trim()
    const nextNameError = validateFullName(normalizedName) ?? ''
    const nextPhoneError = vietnamesePhonePattern.test(normalizedPhone) ? '' : 'Vui lòng nhập số điện thoại Việt Nam hợp lệ.'
    setNameError(nextNameError)
    setPhoneError(nextPhoneError)
    setRequestError('')
    if (nextNameError || nextPhoneError) return

    onSavingChange(true)
    try {
      await updateProfile({ fullName: normalizedName, phone: normalizedPhone })
      toast.success('Đã lưu hồ sơ')
      onDone()
    } catch (error) {
      setRequestError(getApiErrorMessage(error, 'Không thể lưu hồ sơ. Vui lòng thử lại.'))
    } finally {
      onSavingChange(false)
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {!user?.phone ? (
        <Alert tone="info" title="Bổ sung số điện thoại">
          Tài khoản của bạn chưa có số điện thoại. Hãy nhập số để nhận mã PIN, thông báo và liên hệ khi cần.
        </Alert>
      ) : null}

      <Field label="Họ và tên" required error={nameError}>
        <Input
          autoComplete="name"
          maxLength={30}
          value={fullName}
          onChange={event => setFullName(event.target.value)}
          size="lg"
        />
      </Field>

      <Field label="Số điện thoại" required error={phoneError} hint="Email tài khoản không thể chỉnh sửa tại đây.">
        <Input
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="0912345678"
          value={phone}
          onChange={event => setPhone(event.target.value)}
          size="lg"
        />
      </Field>

      {requestError ? <Alert tone="danger">{requestError}</Alert> : null}
    </form>
  )
}

function PasswordForm({ formId, onSavingChange, onDone }: FormProps) {
  const { changePassword } = useAuth()
  const toast = useToast()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<{ oldPassword?: string; newPassword?: string; confirmPassword?: string }>({})
  const [requestError, setRequestError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = {
      oldPassword: oldPassword ? undefined : 'Vui lòng nhập mật khẩu hiện tại.',
      newPassword:
        validatePassword(newPassword) ?? (newPassword === oldPassword ? 'Mật khẩu mới phải khác mật khẩu hiện tại.' : undefined),
      confirmPassword: validatePasswordConfirmation(newPassword, confirmPassword) ?? undefined,
    }
    setErrors(nextErrors)
    setRequestError('')
    if (nextErrors.oldPassword || nextErrors.newPassword || nextErrors.confirmPassword) return

    onSavingChange(true)
    try {
      // Succeeds => every session of the account is revoked and the local one is cleared (route guards go to /login).
      await changePassword({ oldPassword, newPassword, confirmPassword })
      toast.success('Đã đổi mật khẩu', 'Vui lòng đăng nhập lại bằng mật khẩu mới.')
      onDone()
    } catch (error) {
      const code = getApiErrorCode(error)
      if (code === ERROR_INVALID_OLD_PASSWORD) {
        setErrors({ oldPassword: 'Mật khẩu hiện tại không chính xác.' })
      } else if (code === ERROR_NEW_PASSWORD_SAME_AS_OLD) {
        setErrors({ newPassword: 'Mật khẩu mới phải khác mật khẩu hiện tại.' })
      } else {
        setRequestError(getApiErrorMessage(error, 'Không thể đổi mật khẩu. Vui lòng thử lại.'))
      }
    } finally {
      onSavingChange(false)
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Field label="Mật khẩu hiện tại" required error={errors.oldPassword}>
        <PasswordInput
          value={oldPassword}
          onChange={event => setOldPassword(event.target.value)}
          autoComplete="current-password"
          placeholder="Nhập mật khẩu hiện tại"
        />
      </Field>

      <Field label="Mật khẩu mới" required error={errors.newPassword} hint={PASSWORD_HINT}>
        <PasswordInput
          value={newPassword}
          onChange={event => setNewPassword(event.target.value)}
          autoComplete="new-password"
          placeholder="Nhập mật khẩu mới"
        />
      </Field>

      <Field label="Nhập lại mật khẩu mới" required error={errors.confirmPassword}>
        <PasswordInput
          value={confirmPassword}
          onChange={event => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu mới"
        />
      </Field>

      <Alert tone="info">Sau khi đổi, mọi phiên đăng nhập (kể cả thiết bị này) sẽ bị đăng xuất và bạn cần đăng nhập lại.</Alert>

      {requestError ? <Alert tone="danger">{requestError}</Alert> : null}
    </form>
  )
}
