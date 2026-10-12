import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// Request Interceptor: Attach JWT Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('boxora_access_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response Interceptor: Handle 401 & Token Refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = localStorage.getItem('boxora_refresh_token')
      try {
        // Send refresh token via HttpOnly Cookie (or body fallback if present)
        const payload = refreshToken ? { refreshToken } : {}
        const res = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh-token`, payload, {
          withCredentials: true,
        })
        const newAccessToken = res.data?.data?.accessToken
        if (newAccessToken) {
          localStorage.setItem('boxora_access_token', newAccessToken)
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
          return api(originalRequest)
        }
      } catch {
        // Token expired or invalid
        localStorage.removeItem('boxora_access_token')
        localStorage.removeItem('boxora_refresh_token')
        localStorage.removeItem('boxora_user')
      }
    }
    return Promise.reject(error)
  }
)
