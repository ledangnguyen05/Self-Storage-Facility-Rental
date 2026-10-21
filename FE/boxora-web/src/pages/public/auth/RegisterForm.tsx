import React, { useState } from 'react'
import { Mail, Phone, UserRound } from 'lucide-react'
import { Alert, Button, Checkbox, Field, Input } from '../../../components/ui'
import { useAsyncData } from '../../../hooks/useAsyncData'
import { authService } from '../../../services/authService'
import { PasswordInput } from '../components/PasswordInput'
import { CaptchaField } from './CaptchaField'
import { describeAuthError } from './authErrors'
import {
  FULL_NAME_MAX_LENGTH,
  PASSWORD_HINT,
  validateEmail,
  validateFullName,
  validatePassword,
  validatePasswordConfirmation,
  validatePhone,
} from './credentialRules'

/** A human needs more than this to read the captcha and fill the form. */
const MIN_FILL_MS = 1200

interface RegisterFormProps {
  initialEmail?: string
  initialFullName?: string
  onRegistered: (email: string) => void
  onOpenTerms: () => void
  /** Set by the terms modal's "Tôi đồng ý" button. */
  termsAccepted: boolean
  onTermsAcceptedChange: (accepted: boolean) => void
}

type FieldName = 'fullName' | 'email' | 'phone' | 'password' | 'confirmPassword' | 'captcha' | 'terms'
type FieldErrors = Partial<Record<FieldName, string>>

export function RegisterForm({
  initialEmail = '',
  initialFullName = '',
  onRegistered,
  onOpenTerms,
  termsAccepted,
  onTermsAcceptedChange,
}: RegisterFormProps) {
  const [values, setValues] = useState({
    fullName: initialFullName,
    email: initialEmail,
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [captchaCode, setCaptchaCode] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [requestError, setRequestError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [openedAt] = useState(() => Date.now())

  const captcha = useAsyncData(async () => {
    const response = await authService.getCaptcha()
    if (!response?.data?.captchaId || !response.data.captchaImage) throw new Error('Máy chủ không trả về mã xác thực.')
    return response.data
  }, [])

  const setValue = (name: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues(prev => ({ ...prev, [name]: event.target.value }))

  const refreshCaptcha = () => {
    setCaptchaCode('')
    void captcha.reload()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setRequestError(null)

    // Bot traps: a filled hidden field, or a form submitted implausibly fast.
    if (honeypot || Date.now() - openedAt < MIN_FILL_MS) {
      setRequestError('Thao tác bị từ chối vì nghi ngờ tự động. Vui lòng thử lại.')
      return
    }

    const nextErrors: FieldErrors = {
      fullName: validateFullName(values.fullName) ?? undefined,
      email: validateEmail(values.email) ?? undefined,
      phone: validatePhone(values.phone) ?? undefined,
      password: validatePassword(values.password) ?? undefined,
      confirmPassword: validatePasswordConfirmation(values.password, values.confirmPassword) ?? undefined,
      captcha: captchaCode.trim() ? undefined : 'Vui lòng nhập mã xác thực.',
      terms: termsAccepted ? undefined : 'Bạn cần đồng ý với điều khoản để tạo tài khoản.',
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return

    const captchaData = captcha.data
    if (!captchaData) {
      setRequestError('Chưa có mã xác thực. Hãy tải lại mã rồi thử lại.')
      return
    }

    setIsSubmitting(true)
    try {
      // No username is sent: the server derives a unique one, so a taken e-mail prefix never blocks sign-up.
      await authService.register({
        email: values.email.trim(),
        password: values.password,
        fullName: values.fullName.trim(),
        phone: values.phone.trim(),
        captchaId: captchaData.captchaId,
        captchaCode: captchaCode.trim().toUpperCase(),
      })
      onRegistered(values.email.trim())
    } catch (err) {
      setRequestError(describeAuthError(err, 'Đăng ký chưa thành công. Vui lòng kiểm tra lại thông tin.'))
      refreshCaptcha() // a captcha is single-use
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {requestError ? <Alert tone="danger">{requestError}</Alert> : null}

      <Field label="Họ và tên" required error={errors.fullName}>
        <Input
          size="lg"
          leftIcon={UserRound}
          value={values.fullName}
          onChange={setValue('fullName')}
          maxLength={FULL_NAME_MAX_LENGTH}
          placeholder="Nguyễn Văn A"
          autoComplete="name"
        />
      </Field>

      <Field label="Email" required error={errors.email}>
        <Input
          type="email"
          size="lg"
          leftIcon={Mail}
          value={values.email}
          onChange={setValue('email')}
          placeholder="email@vidu.vn"
          autoComplete="email"
        />
      </Field>

      <Field label="Số điện thoại" required error={errors.phone}>
        <Input
          type="tel"
          size="lg"
          leftIcon={Phone}
          value={values.phone}
          onChange={setValue('phone')}
          placeholder="0912345678"
          autoComplete="tel"
          inputMode="tel"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mật khẩu" required error={errors.password} hint={PASSWORD_HINT}>
          <PasswordInput value={values.password} onChange={setValue('password')} autoComplete="new-password" placeholder="Nhập mật khẩu" />
        </Field>
        <Field label="Nhập lại mật khẩu" required error={errors.confirmPassword}>
          <PasswordInput
            value={values.confirmPassword}
            onChange={setValue('confirmPassword')}
            autoComplete="new-password"
            placeholder="Nhập lại mật khẩu"
          />
        </Field>
      </div>

      <CaptchaField
        image={captcha.data?.captchaImage}
        isLoading={captcha.isLoading || captcha.isRefreshing}
        loadError={captcha.error}
        value={captchaCode}
        onChange={setCaptchaCode}
        onRefresh={refreshCaptcha}
        error={errors.captcha}
      />

      {/* Honeypot: invisible to people and to assistive tech, irresistible to naive bots. */}
      <div aria-hidden="true" className="sr-only">
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={event => setHoneypot(event.target.value)} />
        </label>
      </div>

      <div className="space-y-1.5">
        <Checkbox
          checked={termsAccepted}
          onCheckedChange={onTermsAcceptedChange}
          label={
            <>
              Tôi đã đọc và đồng ý với{' '}
              <Button type="button" variant="link" size="sm" onClick={onOpenTerms} className="align-baseline">
                Điều khoản và quy chuẩn
              </Button>{' '}
              của Boxora
            </>
          }
        />
        {errors.terms ? <p className="text-dense text-danger">{errors.terms}</p> : null}
      </div>

      <Button type="submit" size="lg" fullWidth loading={isSubmitting} disabled={Boolean(captcha.error) && !captcha.data}>
        Tạo tài khoản
      </Button>
    </form>
  )
}
