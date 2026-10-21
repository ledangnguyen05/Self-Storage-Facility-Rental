import { useEffect, useState } from 'react'
import { authService, type PublicAuthConfig } from '../services/authService'

export type AuthConfigState =
  | { status: 'loading'; config: null }
  | { status: 'ready'; config: PublicAuthConfig }
  | { status: 'error'; config: null }

/** One request per page load, shared by the login page, the register page and the Google button. */
let cached: Promise<PublicAuthConfig> | null = null

function loadAuthConfig(): Promise<PublicAuthConfig> {
  if (!cached) {
    cached = authService.getPublicConfig().catch((err: unknown) => {
      cached = null // allow a retry on the next mount
      throw err
    })
  }
  return cached
}

/**
 * Public sign-in settings from the backend: whether Google sign-in is enabled (and with which client id)
 * and whether password-reset email can really be delivered.
 */
export function useAuthConfig(): AuthConfigState {
  const [state, setState] = useState<AuthConfigState>({ status: 'loading', config: null })

  useEffect(() => {
    let cancelled = false
    loadAuthConfig().then(
      (config) => {
        if (!cancelled) setState({ status: 'ready', config })
      },
      () => {
        if (!cancelled) setState({ status: 'error', config: null })
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  return state
}

/**
 * Google client id to use, or `null` when Google sign-in is off. The backend is the source of truth; the
 * `VITE_GOOGLE_CLIENT_ID` override is only used when the backend cannot be reached.
 */
export function resolveGoogleClientId(state: AuthConfigState): string | null | undefined {
  if (state.status === 'loading') return undefined // still deciding
  if (state.status === 'ready') return state.config.googleEnabled ? (state.config.googleClientId ?? null) : null
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || null
}
