import { api } from '../lib/axios'
import { User } from '../types'

export interface LoginResponse {
  success: boolean
  message: string
  data: {
    accessToken: string
    refreshToken: string
    user: User
  }
}

export const authService = {
  async login(emailOrUsername: string, password: string):Promise<LoginResponse> {
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

  async register(data: {
    username: string
    email: string
    password: string
    phone: string
    fullName: string
    captchaId?: string
    captchaCode?: string
  }) {
    const response = await api.post('/api/v1/auth/register', data)
    return response.data
  },

  async logout(refreshToken: string) {
    try {
      await api.post('/api/v1/auth/logout', { refreshToken })
    } catch {
      // Ignore cleanup error
    }
  },
}
