import React, { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { GoogleAuthButton } from '../../components/auth/GoogleAuthButton'
import { TermsAndStandardsModal } from '../../components/common/TermsAndStandardsModal'
import { Alert, Button } from '../../components/ui'
import { buttonVariants } from '../../components/ui/buttonVariants'
import { getPortalForRole } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { resolveGoogleClientId, useAuthConfig } from '../../hooks/useAuthConfig'
import { RegisterForm } from './auth/RegisterForm'
import { describeAuthError } from './auth/authErrors'
import { AuthLayout } from './components/AuthLayout'
import { usePageTitle } from './components/usePageTitle'

/** State passed by the login page when a Google account has no Boxora account yet. */
interface RegisterLocationState {
  fromGoogleLogin?: boolean
  email?: string
  fullName?: string
  message?: string
}

export const RegisterPage: React.FC = () => {
  usePageTitle('Tạo tài khoản')
  const navigate = useNavigate()
  const location = useLocation()
  const { loginWithGoogle, isAuthenticated, role } = useAuth()
  // undefined while loading, null when the backend has no Google client id (the section is then hidden).
  const googleClientId = resolveGoogleClientId(useAuthConfig())
  const prefill = (location.state as RegisterLocationState | null) ?? {}

  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [isGoogleBusy, setIsGoogleBusy] = useState(false)

  if (isAuthenticated) return <Navigate to={getPortalForRole(role)} replace />

  const handleGoogleSuccess = async (idToken: string) => {
    setGoogleError(null)
    setIsGoogleBusy(true)
    try {
      await loginWithGoogle(idToken, 'REGISTER') // success: isAuthenticated flips and we redirect above
    } catch (err) {
      setGoogleError(describeAuthError(err, 'Đăng ký bằng Google không thành công. Vui lòng thử lại.'))
      setIsGoogleBusy(false)
    }
  }

  if (registeredEmail) {
    return (
      <AuthLayout title="Tạo tài khoản thành công" description="Tài khoản của bạn đã sẵn sàng.">
        <Alert tone="success" icon={CircleCheck} title="Đăng ký hoàn tất">
          Bạn có thể đăng nhập bằng <span className="font-medium text-fg">{registeredEmail}</span> và mật khẩu vừa tạo.
        </Alert>
        <Button
          size="lg"
          fullWidth
          className="mt-6"
          onClick={() => navigate('/login', { state: { email: registeredEmail } })}
        >
          Đăng nhập ngay
        </Button>
        <Link to="/" className={buttonVariants({ variant: 'ghost', size: 'lg', fullWidth: true, className: 'mt-2' })}>
          Về trang chủ
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      width="md"
      title="Tạo tài khoản"
      description="Đăng ký miễn phí để thuê kho, ký hợp đồng và thanh toán trực tuyến."
      footer={
        <>
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-medium text-accent-text hover:underline">
            Đăng nhập
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        {prefill.message ? <Alert tone="info">{prefill.message}</Alert> : null}
        {googleError ? <Alert tone="danger">{googleError}</Alert> : null}
        {isGoogleBusy ? <Alert tone="info">Đang tạo tài khoản bằng Google…</Alert> : null}

        {googleClientId !== null ? (
          <>
            <GoogleAuthButton mode="signup" disabled={isGoogleBusy} onSuccess={handleGoogleSuccess} onError={setGoogleError} />

            <div className="flex items-center gap-3 text-xs text-fg-subtle" role="separator" aria-label="hoặc">
              <span className="h-px flex-1 bg-line" />
              hoặc đăng ký bằng email
              <span className="h-px flex-1 bg-line" />
            </div>
          </>
        ) : null}

        <RegisterForm
          initialEmail={prefill.email}
          initialFullName={prefill.fullName}
          onRegistered={setRegisteredEmail}
          onOpenTerms={() => setTermsOpen(true)}
          termsAccepted={termsAccepted}
          onTermsAcceptedChange={setTermsAccepted}
        />
      </div>

      <TermsAndStandardsModal
        isOpen={termsOpen}
        onClose={() => setTermsOpen(false)}
        onAccept={() => setTermsAccepted(true)}
      />
    </AuthLayout>
  )
}

export default RegisterPage
