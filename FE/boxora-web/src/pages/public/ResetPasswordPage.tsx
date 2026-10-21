import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { Alert, Button, Field } from '../../components/ui'
import { buttonVariants } from '../../components/ui/buttonVariants'
import { useAuth } from '../../context/AuthContext'
import { getApiErrorCode, getApiErrorMessage } from '../../lib/apiError'
import { authService } from '../../services/authService'
import { PASSWORD_HINT, validatePassword, validatePasswordConfirmation } from './auth/credentialRules'
import { AuthLayout } from './components/AuthLayout'
import { PasswordInput } from './components/PasswordInput'
import { usePageTitle } from './components/usePageTitle'

/** Backend `ErrorCode`s of the reset endpoint. */
const ERROR_PASSWORD_MISMATCH = 500
const ERROR_NEW_PASSWORD_SAME_AS_OLD = 502
const ERROR_INVALID_RESET_TOKEN = 503

export const ResetPasswordPage: React.FC = () => {
  usePageTitle('Đặt lại mật khẩu')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { logout } = useAuth()
  // The emailed link is /reset-password?token=<jwt>; surrounding whitespace from copy/paste is ignored.
  const token = (searchParams.get('token') ?? '').trim()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({})
  const [requestError, setRequestError] = useState<string | null>(null)
  const [linkInvalid, setLinkInvalid] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDone, setIsDone] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const nextErrors = {
      newPassword: validatePassword(newPassword) ?? undefined,
      confirmPassword: validatePasswordConfirmation(newPassword, confirmPassword) ?? undefined,
    }
    setErrors(nextErrors)
    setRequestError(null)
    if (nextErrors.newPassword || nextErrors.confirmPassword) return

    setIsSubmitting(true)
    try {
      await authService.resetPassword({ token, newPassword, confirmPassword })
      // The backend revoked every session of this account: forget any stale session kept in this browser.
      await logout()
      setIsDone(true)
    } catch (err) {
      const code = getApiErrorCode(err)
      if (code === ERROR_INVALID_RESET_TOKEN) {
        setLinkInvalid(true)
      } else if (code === ERROR_NEW_PASSWORD_SAME_AS_OLD) {
        setRequestError('Mật khẩu mới phải khác mật khẩu hiện tại.')
      } else if (code === ERROR_PASSWORD_MISMATCH) {
        setRequestError('Mật khẩu nhập lại không khớp.')
      } else {
        setRequestError(getApiErrorMessage(err, 'Không thể đặt lại mật khẩu. Vui lòng thử lại.'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isDone) {
    return (
      <AuthLayout title="Đã đổi mật khẩu" description="Mật khẩu mới đã được cập nhật.">
        <Alert tone="success" icon={CircleCheck} title="Đặt lại mật khẩu thành công">
          Các phiên đăng nhập cũ đã bị thu hồi. Hãy đăng nhập lại bằng mật khẩu mới.
        </Alert>
        <Button size="lg" fullWidth className="mt-6" onClick={() => navigate('/login')}>
          Đăng nhập
        </Button>
      </AuthLayout>
    )
  }

  if (!token || linkInvalid) {
    return (
      <AuthLayout title="Liên kết không dùng được" description="Liên kết đặt lại mật khẩu thiếu mã xác thực, đã hết hạn hoặc đã được dùng.">
        <Alert tone="warning" title="Cần yêu cầu liên kết mới">
          Liên kết trong email có hiệu lực 15 phút và chỉ dùng được một lần. Hãy quay lại trang đăng nhập và chọn &ldquo;Quên mật khẩu&rdquo; để
          nhận liên kết mới.
        </Alert>
        <Link to="/login" className={buttonVariants({ size: 'lg', fullWidth: true, className: 'mt-6' })}>
          Về trang đăng nhập
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Đặt lại mật khẩu"
      description="Nhập mật khẩu mới cho tài khoản Boxora của bạn."
      footer={
        <Link to="/login" className="font-medium text-accent-text hover:underline">
          Về trang đăng nhập
        </Link>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {requestError ? <Alert tone="danger">{requestError}</Alert> : null}

        <Field label="Mật khẩu mới" required error={errors.newPassword} hint={PASSWORD_HINT}>
          <PasswordInput
            value={newPassword}
            onChange={event => setNewPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="Nhập mật khẩu mới"
            autoFocus
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

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Cập nhật mật khẩu
        </Button>
      </form>
    </AuthLayout>
  )
}

export default ResetPasswordPage
