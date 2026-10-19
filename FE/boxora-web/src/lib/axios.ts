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
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const isAuthError = error.response?.status === 401 || error.response?.status === 403
    if (isAuthError && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = localStorage.getItem('boxora_refresh_token')
      if (refreshToken) {
        try {
          const res = await axios.post(`${getApiBaseUrl()}/api/v1/auth/refresh-token`, {
            refreshToken,
          })
          const newAccessToken = res.data?.data?.accessToken
          if (newAccessToken) {
            localStorage.setItem('boxora_access_token', newAccessToken)
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
            return api(originalRequest)
          }
        } catch {
          // Token expired or invalid
        }
      }

      // If refresh token fails or does not exist, purge stored auth and reject
      localStorage.removeItem('boxora_access_token')
      localStorage.removeItem('boxora_refresh_token')
      localStorage.removeItem('boxora_user')
    }
    return Promise.reject(error)
  }
)
