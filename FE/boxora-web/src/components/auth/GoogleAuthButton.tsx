import React, { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    google?: any
  }
}

export const GOOGLE_CLIENT_ID = '564968487479-aooibm2esqg9bic2iuu1a729ci4qfo3q.apps.googleusercontent.com'

interface GoogleAuthButtonProps {
  onSuccess: (idToken: string) => void
  onError: (error: string) => void
  text?: string
  disabled?: boolean
  mode?: 'signin' | 'signup'
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  onSuccess,
  onError,
  text,
  disabled = false,
  mode = 'signin'
}) => {
  const googleBtnContainerRef = useRef<HTMLDivElement>(null)
  const [isGsiLoaded, setIsGsiLoaded] = useState(false)

  const defaultText = text || (mode === 'signup' ? 'Đăng ký nhanh bằng tài khoản Google' : 'Đăng nhập nhanh bằng tài khoản Google')

  useEffect(() => {
    let checkInterval: any = null

    const initGsi = () => {
      if (window.google?.accounts?.id && googleBtnContainerRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (response: any) => {
              if (response?.credential) {
                onSuccess(response.credential)
              } else {
                onError('Không nhận được mã xác thực tài khoản từ Google.')
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true
          })

          googleBtnContainerRef.current.innerHTML = ''
          const parentWidth = googleBtnContainerRef.current.parentElement?.offsetWidth || 380
          const btnWidth = Math.min(Math.max(parentWidth, 240), 400)

          window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: mode === 'signup' ? 'signup_with' : 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: btnWidth,
            locale: 'vi'
          })

          setIsGsiLoaded(true)
          if (checkInterval) clearInterval(checkInterval)
        } catch (err) {
          console.error('Error initializing Google GIS:', err)
        }
      }
    }

    if (window.google?.accounts?.id) {
      initGsi()
    } else {
      checkInterval = setInterval(() => {
        if (window.google?.accounts?.id) {
          initGsi()
        }
      }, 200)
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval)
    }
  }, [onSuccess, onError, mode])

  const handleClickFallback = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed()) {
          console.warn('Google One Tap suppressed:', notification.getNotDisplayedReason())
        }
      })
    } else {
      onError('Đang tải thư viện Google Sign-In, vui lòng thử lại sau giây lát.')
    }
  }

  return (
    <div className={`w-full flex justify-center items-center my-0.5 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      {/* Official Google Identity Services Button Container */}
      <div
        ref={googleBtnContainerRef}
        className={`w-full flex justify-center items-center [&>div]:!mx-auto [&>div]:!w-full [&_iframe]:!mx-auto ${
          !isGsiLoaded ? 'hidden' : ''
        }`}
      />

      {/* Clean centered Fallback / Placeholder Button while GIS script loads */}
      {!isGsiLoaded && (
        <button
          type="button"
          disabled={disabled}
          onClick={handleClickFallback}
          className="w-full h-10 px-4 rounded-xl border border-slate-200 hover:border-cyan-400 bg-white hover:bg-slate-50 transition-all flex items-center justify-center gap-3 text-xs font-semibold text-slate-800 shadow-2xs cursor-pointer group disabled:opacity-60"
        >
          <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span>{defaultText}</span>
        </button>
      )}
    </div>
  )
}
