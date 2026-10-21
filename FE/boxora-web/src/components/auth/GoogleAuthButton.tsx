import React, { useEffect, useRef, useState } from 'react'
import { resolveGoogleClientId, useAuthConfig } from '../../hooks/useAuthConfig'
import { Button, Skeleton } from '../ui'
import { cn } from '../ui/cn'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const GIS_LOAD_TIMEOUT_MS = 10_000

interface GoogleCredentialResponse {
  credential?: string
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon'
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'large' | 'medium' | 'small'
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
      shape?: 'rectangular' | 'pill'
      logo_alignment?: 'left' | 'center'
      width?: number
      locale?: string
    },
  ) => void
}

const getGoogleId = (): GoogleAccountsId | undefined =>
  (window as unknown as { google?: { accounts?: { id?: GoogleAccountsId } } }).google?.accounts?.id

let scriptPromise: Promise<GoogleAccountsId> | null = null

/**
 * Loads Google Identity Services once, on demand (not from index.html), and
 * rejects after a timeout or a network error so the UI can offer a retry.
 */
function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  const ready = getGoogleId()
  if (ready) return Promise.resolve(ready)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true

    const fail = (reason: string) => {
      window.clearTimeout(timer)
      script.remove()
      scriptPromise = null
      reject(new Error(reason))
    }
    const timer = window.setTimeout(() => fail('GOOGLE_SCRIPT_TIMEOUT'), GIS_LOAD_TIMEOUT_MS)

    script.addEventListener('load', () => {
      const google = getGoogleId()
      if (!google) {
        fail('GOOGLE_SCRIPT_UNAVAILABLE')
        return
      }
      window.clearTimeout(timer)
      resolve(google)
    })
    script.addEventListener('error', () => fail('GOOGLE_SCRIPT_ERROR'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

interface GoogleAuthButtonProps {
  onSuccess: (idToken: string) => void
  onError: (error: string) => void
  /** Kept for API compatibility; Google renders its own label from `mode`. */
  text?: string
  disabled?: boolean
  mode?: 'signin' | 'signup'
}

/**
 * Official "Sign in with Google" button. The OAuth client id comes from the backend
 * (`GET /auth/public-config`, the same value it verifies tokens against), so there is no hard-coded id.
 * While the backend has no GOOGLE_CLIENT_ID the button is not rendered at all.
 */
export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = props => {
  const clientId = resolveGoogleClientId(useAuthConfig())
  if (clientId === undefined) {
    return (
      <div className="w-full">
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    )
  }
  if (clientId === null) return null
  return <GoogleSignInButton {...props} clientId={clientId} />
}

/**
 * Callbacks are read through refs, so a parent re-render (every keystroke in a form) never
 * re-initialises GIS or wipes the rendered button.
 */
const GoogleSignInButton: React.FC<GoogleAuthButtonProps & { clientId: string }> = ({
  onSuccess,
  onError,
  disabled = false,
  mode = 'signin',
  clientId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    onSuccessRef.current = onSuccess
    onErrorRef.current = onError
  })

  useEffect(() => {
    let cancelled = false

    loadGoogleIdentity()
      .then(google => {
        const container = containerRef.current
        if (cancelled || !container) return
        google.initialize({
          client_id: clientId,
          callback: response => {
            if (response.credential) onSuccessRef.current(response.credential)
            else onErrorRef.current('Không nhận được mã xác thực từ Google. Vui lòng thử lại.')
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        container.replaceChildren()
        const width = Math.min(Math.max(container.parentElement?.offsetWidth || 380, 240), 400)
        google.renderButton(container, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: mode === 'signup' ? 'signup_with' : 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width,
          locale: 'vi',
        })
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [mode, attempt, clientId])

  const retry = () => {
    setStatus('loading')
    setAttempt(value => value + 1)
  }

  return (
    <div className={cn('w-full', disabled && 'pointer-events-none opacity-60')}>
      <div ref={containerRef} className={cn('flex w-full justify-center', status !== 'ready' && 'hidden')} />
      {status === 'loading' ? <Skeleton className="h-10 w-full rounded-md" /> : null}
      {status === 'error' ? (
        <div className="space-y-2 text-center">
          <p className="text-dense text-fg-muted">Không tải được đăng nhập Google. Kiểm tra kết nối mạng rồi thử lại.</p>
          <Button variant="secondary" size="md" onClick={retry}>
            Thử lại
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export default GoogleAuthButton
