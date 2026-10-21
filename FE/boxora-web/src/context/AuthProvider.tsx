import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { APP_EVENTS, LEGACY_STORAGE_PREFIXES, STORAGE_KEYS } from '../constants/storageKeys'
import { useNotificationAlerts } from '../hooks/useNotificationAlerts'
import { clearAuthStorage, type SessionExpiredDetail } from '../lib/axios'
import {
  moveSession,
  persistSession,
  readAccessToken,
  readRefreshToken,
  readStoredUser,
  updateStoredUser,
} from '../lib/authSession'
import { removeByPrefix } from '../lib/storage'
import { authService, type LoginResponse } from '../services/authService'
import type { RoleType, User } from '../types'
import { normalizeUser, type RawUser } from '../utils/normalizeUser'
import { getWebSettings } from '../utils/webSettings'
import { AuthContext, type AuthContextType, type ChangePasswordPayload } from './authStore'

interface Session {
  token: string | null
  user: User | null
}

const EMPTY_SESSION: Session = { token: null, user: null }

/** Restores the stored session; purges legacy mock tokens and unreadable data. */
function readStoredSession(): Session {
  const token = readAccessToken()
  const storedUser = readStoredUser<RawUser | null>(null)
  if (!token || !storedUser) return EMPTY_SESSION
  if (token.startsWith('mock-token-') || token.length < 20 || typeof storedUser !== 'object') {
    clearAuthStorage()
    return EMPTY_SESSION
  }
  return { token, user: normalizeUser(storedUser, token) }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session>(readStoredSession)
  const [isLoading, setIsLoading] = useState(false)
  const [sessionNotice, setSessionNotice] = useState<string | null>(null)
  const { user, token } = session

  // In-app notifications (pushed by the staff workbench) can play a sound / show a browser notification.
  useNotificationAlerts(user?.id)

  useEffect(() => {
    // Leftovers of the removed client-side rental simulation.
    removeByPrefix(LEGACY_STORAGE_PREFIXES)
  }, [])

  // lib/axios dispatches this when the refresh token is rejected; another tab may log out too.
  useEffect(() => {
    const clear = () => setSession(EMPTY_SESSION)
    const onExpired = (event: Event) => {
      const detail = (event as CustomEvent<SessionExpiredDetail | undefined>).detail
      setSessionNotice(detail?.message ?? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.')
      clear()
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.accessToken && event.newValue === null) clear()
    }
    window.addEventListener(APP_EVENTS.sessionExpired, onExpired)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(APP_EVENTS.sessionExpired, onExpired)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const dismissSessionNotice = useCallback(() => setSessionNotice(null), [])

  // "Ghi nhớ phiên đăng nhập": switching it moves the current session between local and session storage.
  useEffect(() => {
    const onSettingsChanged = () => moveSession(getWebSettings().rememberSession)
    window.addEventListener(APP_EVENTS.settingsChanged, onSettingsChanged)
    return () => window.removeEventListener(APP_EVENTS.settingsChanged, onSettingsChanged)
  }, [])

  const establishSession = useCallback((data: LoginResponse['data']): User => {
    const { accessToken, refreshToken, user: rawUser } = data
    const nextUser = normalizeUser(rawUser, accessToken)
    persistSession({ accessToken, refreshToken, user: nextUser }, getWebSettings().rememberSession)
    setSession({ token: accessToken, user: nextUser })
    setSessionNotice(null)
    return nextUser
  }, [])

  const login = useCallback(
    async (emailOrUsername: string, password: string): Promise<User> => {
      setIsLoading(true)
      try {
        const res = await authService.login(emailOrUsername, password)
        if (res.data?.accessToken) return establishSession(res.data)
        throw new Error('Đăng nhập không thành công, vui lòng thử lại.')
      } finally {
        setIsLoading(false)
      }
    },
    [establishSession]
  )

  const loginWithGoogle = useCallback(
    async (idToken: string, mode: 'LOGIN' | 'REGISTER' = 'LOGIN'): Promise<User> => {
      setIsLoading(true)
      try {
        const res = await authService.googleLogin(idToken, mode)
        if (res.data?.accessToken) return establishSession(res.data)
        throw new Error('Đăng nhập với Google không thành công, vui lòng thử lại.')
      } finally {
        setIsLoading(false)
      }
    },
    [establishSession]
  )

  const logout = useCallback(async () => {
    // The refresh token normally lives in an HttpOnly cookie, so always call the endpoint.
    await authService.logout(readRefreshToken())
    clearAuthStorage()
    setSession(EMPTY_SESSION)
  }, [])

  const setSessionUser = useCallback((updatedUser: User) => {
    updateStoredUser(updatedUser)
    setSession((prev) => ({ ...prev, user: updatedUser }))
  }, [])

  const updateProfile = useCallback(
    async (profile: { fullName: string; phone: string }) => {
      if (!user) throw new Error('Bạn cần đăng nhập để cập nhật hồ sơ.')
      const updatedProfile = await authService.updateProfile({
        fullName: profile.fullName.trim(),
        phone: profile.phone.trim(),
      })
      const updatedUser: User = {
        ...user,
        ...updatedProfile,
        role: updatedProfile.role || user.role,
      }
      setSessionUser(updatedUser)
      return updatedUser
    },
    [user, setSessionUser]
  )

  const changePassword = useCallback(async (payload: ChangePasswordPayload) => {
    await authService.changePassword(payload)
    // Every session (including this one) was revoked server-side: drop the local copy too.
    clearAuthStorage()
    setSession(EMPTY_SESSION)
  }, [])

  const role: RoleType | null = user?.role?.name ?? null

  const hasPermission = useCallback(
    (allowedRoles: RoleType[]) => (role ? allowedRoles.includes(role) : false),
    [role]
  )

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      role,
      token,
      isLoading,
      isAuthenticated: !!user,
      sessionNotice,
      dismissSessionNotice,
      login,
      loginWithGoogle,
      logout,
      setSessionUser,
      updateProfile,
      changePassword,
      hasPermission,
    }),
    [
      user,
      role,
      token,
      isLoading,
      sessionNotice,
      dismissSessionNotice,
      login,
      loginWithGoogle,
      logout,
      setSessionUser,
      updateProfile,
      changePassword,
      hasPermission,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
