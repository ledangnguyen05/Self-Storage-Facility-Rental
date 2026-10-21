import { api } from '../lib/axios'
import type { RequestOptions, User } from '../types'
import { normalizeUser, type RawUser } from '../utils/normalizeUser'

/** `AuthResponse` envelope. `user` is raw: AuthContext normalizes it with normalizeUser. */
export interface LoginResponse {
  success: boolean
  message: string
  data: {
    accessToken: string
    refreshToken?: string | null
    user: RawUser
  }
}

export interface RegisterPayload {
  /** Optional hint: the server always produces a unique username, so a taken one is never an error. */
  username?: string
  email: string
  password: string
  phone: string
  fullName: string
  captchaId?: string
  captchaCode?: string
}

export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

/** What the sign-in screens need to know before rendering (`GET /auth/public-config`). */
export interface PublicAuthConfig {
  /** The backend has a Google OAuth client id and will accept Google ID tokens. */
  googleEnabled: boolean
  /** Client id the web app must use for Google sign-in (the one the backend verifies against). */
  googleClientId?: string
  /** SMTP is configured, so the forgot-password email can really be delivered. */
  passwordResetAvailable: boolean
}

export const authService = {
  async login(emailOrUsername: string, password: string): Promise<LoginResponse> {
    const response = await api.post('/api/v1/auth/login', {
      email: emailOrUsername,
      password,
    })
    return response.data
  },

  async getCaptcha(): Promise<{ success: boolean; data: { captchaId: string; captchaImage: string } }> {
    const response = await api.get('/api/v1/auth/captcha')
    return response.data
  },

  async getPublicConfig(opts?: RequestOptions): Promise<PublicAuthConfig> {
    const response = await api.get('/api/v1/auth/public-config', { signal: opts?.signal })
    const data = response.data?.data as Partial<PublicAuthConfig> | undefined
    return {
      googleEnabled: Boolean(data?.googleEnabled && data.googleClientId),
      googleClientId: data?.googleClientId || undefined,
      passwordResetAvailable: data?.passwordResetAvailable !== false,
    }
  },

  async register(data: RegisterPayload): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/api/v1/auth/register', data)
    return response.data
  },

  /** Revokes the refresh token (HttpOnly cookie, or the body token when one is stored). Never throws. */
  async logout(refreshToken?: string | null) {
    try {
      await api.post('/api/v1/auth/logout', refreshToken ? { refreshToken } : {})
    } catch {
      // Ignore cleanup error
    }
  },

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/api/v1/auth/forgot-password', { email })
    return response.data
  },

  async resetPassword(data: {
    token: string
    newPassword: string
    confirmPassword: string
  }): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/api/v1/auth/reset-password', data)
    return response.data
  },

  /**
   * PUT /auth/change-password (signed-in users). On success the backend revokes every session of the
   * account, so the caller must clear the local session (AuthContext.changePassword does).
   */
  async changePassword(data: ChangePasswordRequest): Promise<{ success: boolean; message: string }> {
    const response = await api.put('/api/v1/auth/change-password', data)
    return response.data
  },

  /** PUT /auth/profile → normalized partial user (merge into the session user). */
  async updateProfile(data: { fullName: string; phone: string }): Promise<User> {
    const response = await api.put('/api/v1/auth/profile', data)
    return normalizeUser(response.data?.data as RawUser | undefined)
  },

  async googleLogin(idToken: string, mode: 'LOGIN' | 'REGISTER' = 'LOGIN'): Promise<LoginResponse> {
    const response = await api.post('/api/v1/auth/google', { idToken, mode })
    return response.data
  },
}
