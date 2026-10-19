import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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

// Response Interceptor: Handle 401 & Token Refresh safely
let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const isUnauthorized = error.response?.status === 401
    const isAuthEndpoint = originalRequest?.url?.includes('/api/v1/auth/')

    // Only attempt token refresh on 401 Unauthorized for non-auth endpoints
    // Never treat 403 Forbidden as session expiration
    if (isUnauthorized && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true
      const refreshToken = localStorage.getItem('boxora_refresh_token')

      if (!refreshToken) {
        localStorage.removeItem('boxora_access_token')
        localStorage.removeItem('boxora_refresh_token')
        localStorage.removeItem('boxora_user')
        return Promise.reject(error)
      }

      if (!isRefreshing) {
        isRefreshing = true
        refreshPromise = (async () => {
          try {
            const res = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh-token`, {
              refreshToken,
            })
            const newAccessToken = res.data?.data?.accessToken
            if (newAccessToken) {
              localStorage.setItem('boxora_access_token', newAccessToken)
              return newAccessToken
            }
            return null
          } catch {
            return null
          } finally {
            isRefreshing = false
          }
        })()
      }

      const newAccessToken = await refreshPromise
      if (newAccessToken) {
        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return api(originalRequest)
      } else {
        localStorage.removeItem('boxora_access_token')
        localStorage.removeItem('boxora_refresh_token')
        localStorage.removeItem('boxora_user')
      }
    }
    return Promise.reject(error)
  }
)
