import React, { useId, useState } from 'react'
import { CircleCheck, Mail } from 'lucide-react'
import { Alert, Button, Field, Input, Modal } from '../../../components/ui'
import { useAuthConfig } from '../../../hooks/useAuthConfig'
import { getApiErrorMessage } from '../../../lib/apiError'
import { authService } from '../../../services/authService'
import { validateEmail } from './credentialRules'

interface ForgotPasswordModalProps {
  open: boolean
  onClose: () => void
  /** Pre-fills the email the visitor already typed on the login form. */
  initialEmail?: string
}

/** Mounted only while open, so every opening starts from a clean form. */
export function ForgotPasswordModal({ open, onClose, initialEmail = '' }: ForgotPasswordModalProps) {
  if (!open) return null
  return <ForgotPasswordDialog onClose={onClose} initialEmail={initialEmail} />
}

function ForgotPasswordDialog({ onClose, initialEmail }: { onClose: () => void; initialEmail: string }) {
  const formId = useId()
  const [email, setEmail] = useState(initialEmail)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  // Honest about delivery: when the server has no mail settings the link cannot be sent at all.
  const authConfig = useAuthConfig()
  const mailUnavailable = authConfig.status === 'ready' && !authConfig.config.passwordResetAvailable

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const error = validateEmail(email)
    setFieldError(error)
    setRequestError(null)
    if (error) return

    setIsSubmitting(true)
    try {
      await authService.forgotPassword(email.trim())
      setSentTo(email.trim())
    } catch (err) {
      setRequestError(getApiErrorMessage(err, 'Không thể gửi yêu cầu khôi phục mật khẩu. Vui lòng thử lại sau.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Quên mật khẩu"
      description={sentTo ? undefined : 'Nhập email đăng ký, Boxora sẽ gửi liên kết đặt lại mật khẩu cho bạn.'}
      dismissible={!isSubmitting}
      footer={
        sentTo ? (
          <Button onClick={onClose}>Đóng</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Hủy
            </Button>
            <Button type="submit" form={formId} loading={isSubmitting} disabled={mailUnavailable}>
              Gửi liên kết
            </Button>
          </>
        )
      }
    >
      {sentTo ? (
        <Alert tone="success" icon={CircleCheck} title="Đã gửi yêu cầu">
          Nếu <span className="font-medium text-fg">{sentTo}</span> đã đăng ký, bạn sẽ nhận được email hướng dẫn đặt lại mật khẩu. Liên kết có
          hiệu lực trong 15 phút.
        </Alert>
      ) : (
        <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
          {mailUnavailable ? (
            <Alert tone="warning" title="Chưa gửi được email">
              Hệ thống chưa cấu hình dịch vụ gửi email nên tạm thời không thể gửi liên kết đặt lại mật khẩu. Vui lòng liên hệ quản trị viên hoặc
              bộ phận hỗ trợ.
            </Alert>
          ) : null}
          {requestError ? <Alert tone="danger">{requestError}</Alert> : null}
          <Field label="Email" required error={fieldError}>
            <Input
              type="email"
              size="lg"
              leftIcon={Mail}
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="email@vidu.vn"
              autoComplete="email"
            />
          </Field>
        </form>
      )}
    </Modal>
  )
}
