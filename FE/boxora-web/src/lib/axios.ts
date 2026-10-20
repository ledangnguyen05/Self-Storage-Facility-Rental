import axios from 'axios'

export const getApiBaseUrl = (): string => {
  const envUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const queryApi = params.get('api')
    if (queryApi) {
      const cleanUrl = queryApi.replace(/\/+$/, '')
      localStorage.setItem('boxora_api_url', cleanUrl)
      return cleanUrl
    }
    if (envUrl) {
      return envUrl
    }
    const saved = localStorage.getItem('boxora_api_url')
    if (saved) return saved.replace(/\/+$/, '')
  }
  return envUrl
}

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// Request Interceptor: Attach JWT Token and sync dynamic baseURL
api.interceptors.request.use(
  (config) => {
    config.baseURL = getApiBaseUrl()
    const token = localStorage.getItem('boxora_access_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response Interceptor: Handle 401 & Token Refresh
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (err: any) => void
}> = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token!)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // CRITICAL: NEVER treat 403 Forbidden as an auth/session expiration!
    // 403 means user is authenticated but not authorized for this specific operation.
    // Purging tokens on 403 breaks valid active sessions.
    const isUnauthorized = error.response?.status === 401

    if (
      isUnauthorized &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/api/v1/auth/')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (newToken: string) => {
              originalRequest.headers = originalRequest.headers || {}
              originalRequest.headers.Authorization = `Bearer ${newToken}`
              resolve(api(originalRequest))
            },
            reject: (err) => reject(err),
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('boxora_refresh_token')
      try {
        const res = await axios.post(
          `${getApiBaseUrl()}/api/v1/auth/refresh-token`,
          refreshToken ? { refreshToken } : {},
          { withCredentials: true }
        )
        const newAccessToken = res.data?.data?.accessToken
        const newRefreshToken = res.data?.data?.refreshToken
        if (newAccessToken) {
          localStorage.setItem('boxora_access_token', newAccessToken)
          if (newRefreshToken) {
            localStorage.setItem('boxora_refresh_token', newRefreshToken)
          }
          originalRequest.headers = originalRequest.headers || {}
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
          processQueue(null, newAccessToken)
          return api(originalRequest)
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null)
        localStorage.removeItem('boxora_access_token')
        localStorage.removeItem('boxora_refresh_token')
        localStorage.removeItem('boxora_user')
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)
