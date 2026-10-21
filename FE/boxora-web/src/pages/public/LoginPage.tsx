import React, { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { GoogleAuthButton } from '../../components/auth/GoogleAuthButton'
import { Alert, Button, Field, Input } from '../../components/ui'
import { getPostLoginPath } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { resolveGoogleClientId, useAuthConfig } from '../../hooks/useAuthConfig'
import { getApiErrorCode } from '../../lib/apiError'
import { decodeJwtPayload } from '../../lib/jwt'
import { ForgotPasswordModal } from './auth/ForgotPasswordModal'
import { describeAuthError } from './auth/authErrors'
import { validateEmail } from './auth/credentialRules'
import { AuthLayout } from './components/AuthLayout'
import { PasswordInput } from './components/PasswordInput'
import { usePageTitle } from './components/usePageTitle'

/** `GOOGLE_ACCOUNT_NOT_REGISTERED` from the backend: send the visitor to registration. */
const GOOGLE_NOT_REGISTERED_CODE = 306

interface LoginLocationState {
  /** Pre-filled by the registration success screen. */
  email?: string
}

const readString = (value: unknown): string => (typeof value === 'string' ? value : '')

export const LoginPage: React.FC = () => {
  usePageTitle('Đăng nhập')
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect')
  const { login, loginWithGoogle, isAuthenticated, role, sessionNotice, dismissSessionNotice } = useAuth()
  // undefined while loading, null when the backend has no Google client id (the section is then hidden).
  const googleClientId = resolveGoogleClientId(useAuthConfig())

  const [email, setEmail] = useState((location.state as LoginLocationState | null)?.email ?? '')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [requestError, setRequestError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleBusy, setIsGoogleBusy] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  // Signed-in visitors (and the moment login succeeds) go straight to where they were headed.
  if (isAuthenticated) return <Navigate to={getPostLoginPath(role, redirect)} replace />

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const nextErrors = {
      email: validateEmail(email) ?? undefined,
      password: password ? undefined : 'Vui lòng nhập mật khẩu.',
    }
    setErrors(nextErrors)
    setRequestError(null)
    if (nextErrors.email || nextErrors.password) return

    setIsSubmitting(true)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setRequestError(describeAuthError(err, 'Đăng nhập chưa thành công. Vui lòng thử lại.'))
      setIsSubmitting(false)
    }
  }

  const handleGoogleSuccess = async (idToken: string) => {
    setRequestError(null)
    setIsGoogleBusy(true)
    try {
      await loginWithGoogle(idToken, 'LOGIN')
    } catch (err) {
      setIsGoogleBusy(false)
      if (getApiErrorCode(err) === GOOGLE_NOT_REGISTERED_CODE) {
        const payload = decodeJwtPayload(idToken)
        const googleEmail = readString(payload?.email)
        navigate('/register', {
          state: {
            fromGoogleLogin: true,
            email: googleEmail,
            fullName: readString(payload?.name),
            message: `Tài khoản Google ${googleEmail || 'này'} chưa được đăng ký tại Boxora. Hoàn tất thông tin bên dưới để tạo tài khoản.`,
          },
        })
        return
      }
      setRequestError(describeAuthError(err, 'Đăng nhập bằng Google không thành công. Vui lòng thử lại.'))
    }
  }

  return (
    <AuthLayout
      title="Đăng nhập"
      description="Chào mừng bạn trở lại. Đăng nhập để quản lý kho, hợp đồng và thanh toán."
      footer={
        <>
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-medium text-accent-text hover:underline">
            Tạo tài khoản
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {sessionNotice && !requestError ? (
          <Alert tone="warning" onDismiss={dismissSessionNotice}>
            {sessionNotice}
          </Alert>
        ) : null}
        {requestError ? <Alert tone="danger">{requestError}</Alert> : null}
        {isGoogleBusy ? <Alert tone="info">Đang xác thực tài khoản Google…</Alert> : null}

        <Field label="Email" required error={errors.email}>
          <Input
            type="email"
            size="lg"
            leftIcon={Mail}
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="email@vidu.vn"
            autoComplete="username"
            autoFocus
          />
        </Field>

        <Field
          label="Mật khẩu"
          required
          error={errors.password}
          labelAction={
            <Button type="button" variant="link" size="sm" onClick={() => setForgotOpen(true)}>
              Quên mật khẩu?
            </Button>
          }
        >
          <PasswordInput
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Nhập mật khẩu"
            autoComplete="current-password"
          />
        </Field>

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Đăng nhập
        </Button>
      </form>

      {googleClientId !== null ? (
        <>
          <div className="my-6 flex items-center gap-3 text-xs text-fg-subtle" role="separator" aria-label="hoặc">
            <span className="h-px flex-1 bg-line" />
            hoặc
            <span className="h-px flex-1 bg-line" />
          </div>

          <GoogleAuthButton mode="signin" disabled={isSubmitting || isGoogleBusy} onSuccess={handleGoogleSuccess} onError={setRequestError} />
        </>
      ) : null}

      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} initialEmail={email.trim()} />
    </AuthLayout>
  )
}

export default LoginPage
