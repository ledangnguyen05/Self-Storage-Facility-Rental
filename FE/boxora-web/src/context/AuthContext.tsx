import React, { createContext, useContext, useState, useEffect } from 'react'
import { User, RoleType } from '../types'
import { authService } from '../services/authService'

export interface RolePreset {
  role: RoleType
  label: string
  sublabel: string
  email: string
  password: string
  color: string
  portalPath: string
}

export const ROLE_PRESETS: RolePreset[] = [
  {
    role: 'ADMIN',
    label: 'Quản trị viên Hệ thống',
    sublabel: 'Toàn quyền kiểm soát, cấp phát RBAC & Audit Log',
    email: 'admin@gmail.com',
    password: '123456',
    color: 'border-rose-500 text-rose-600 bg-rose-50',
    portalPath: '/portal/admin'
  },
  {
    role: 'BUSINESS_MANAGER',
    label: 'Giám đốc Vận hành & Doanh thu',
    sublabel: 'Báo cáo C-Level, đối chuẩn 5 chi nhánh & ma trận giá',
    email: 'business@gmail.com',
    password: '123456',
    color: 'border-violet-500 text-violet-600 bg-violet-50',
    portalPath: '/portal/business-manager'
  },
  {
    role: 'FACILITY_MANAGER',
    label: 'Quản lý Cơ sở Chi nhánh',
    sublabel: 'Sơ đồ kho 2 tầng, ma trận hành lang & khóa cưỡng chế',
    email: 'facility1q1@gmail.com',
    password: '123456',
    color: 'border-blue-500 text-blue-600 bg-blue-50',
    portalPath: '/portal/facility-manager'
  },
  {
    role: 'STAFF',
    label: 'Nhân viên Tiếp đón & Bàn giao',
    sublabel: 'Check-in CCCD/RFID, nghiệm thu trả kho & hoàn cọc',
    email: 'staff1q1@gmail.com',
    password: '123456',
    color: 'border-amber-500 text-amber-600 bg-amber-50',
    portalPath: '/portal/staff'
  },
  {
    role: 'CUSTOMER',
    label: 'Khách hàng Thuê kho',
    sublabel: 'Tự quản lý kho, mở khóa từ xa IoT 24/7 & Hợp đồng',
    email: 'customer@gmail.com',
    password: '123456',
    color: 'border-emerald-500 text-emerald-600 bg-emerald-50',
    portalPath: '/portal/customer'
  }
]

interface AuthContextType {
  user: User | null
  role: RoleType | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (emailOrUsername: string, password: string) => Promise<User>
  loginWithGoogle: (idToken: string, mode?: 'LOGIN' | 'REGISTER') => Promise<User>
  logout: () => Promise<void>
  setSessionUser: (user: User) => void
  updateProfile: (profile: { fullName: string; phone: string }) => Promise<User>
  switchRole: (targetRole: RoleType) => Promise<User>
  hasPermission: (allowedRoles: RoleType[]) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    let isMounted = true

    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem('boxora_access_token')
        const storedUser = localStorage.getItem('boxora_user')

        if (storedToken && storedUser) {
          const parsed = JSON.parse(storedUser)
          const isMock = storedToken.startsWith('mock-token-')

          if (isMock) {
            // Find appropriate account to authenticate against backend
            const email = parsed.email || (parsed.roleName === 'BUSINESS_MANAGER' ? 'business@gmail.com' : 'admin@gmail.com')
            const preset = ROLE_PRESETS.find(
              p => p.email.toLowerCase() === email.toLowerCase() ||
                   p.role === parsed.roleName ||
                   p.role === parsed.role?.name
            )
            const emailToUse = preset?.email || email
            const passwordToUse = preset?.password || '123456'

            try {
              const res = await authService.login(emailToUse, passwordToUse)
              if (res.data?.accessToken && isMounted) {
                const { accessToken, refreshToken, user: rawUser } = res.data
                const jwtRole = parseJwtRole(accessToken)
                const enriched: User = {
                  ...rawUser,
                  role: rawUser?.role || { name: (rawUser?.roleName || jwtRole || preset?.role || 'ADMIN') as RoleType },
                  roleName: rawUser?.roleName || jwtRole || preset?.role,
                  roleId: rawUser?.roleId,
                  facilityId: rawUser?.facilityId,
                  facilityName: rawUser?.facilityName,
                  facilityCode: rawUser?.facilityCode
                }
                localStorage.setItem('boxora_access_token', accessToken)
                if (refreshToken) localStorage.setItem('boxora_refresh_token', refreshToken)
                localStorage.setItem('boxora_user', JSON.stringify(enriched))
                setToken(accessToken)
                setUser(enriched)
                return
              }
            } catch (autoLoginErr) {
              console.warn('Auto-upgrade to real DB token failed, keeping existing session:', autoLoginErr)
            }
          }

          if (isMounted) {
            setToken(storedToken)
            setUser(parsed)
          }
        }
      } catch {
        localStorage.removeItem('boxora_access_token')
        localStorage.removeItem('boxora_user')
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void initAuth()

    return () => {
      isMounted = false
    }
  }, [])

  function parseJwtRole(jwtToken: string): RoleType | null {
    try {
      const base64Url = jwtToken.split('.')[1]
      if (!base64Url) return null
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
      const payload = JSON.parse(jsonPayload)
      return (payload.role as RoleType) || null
    } catch {
      return null
    }
  }

  const login = async (emailOrUsername: string, password: string): Promise<User> => {
    setIsLoading(true)
    try {
<<<<<<< Updated upstream
      try {
        const res = await authService.login(emailOrUsername, password)
        if (res.data) {
          const { accessToken, refreshToken, user: rawUser } = res.data
          const jwtRole = parseJwtRole(accessToken)
          const enrichedUser: User = {
            ...rawUser,
            role: rawUser?.role || (rawUser?.roleName ? {
              id: rawUser.roleId,
              name: rawUser.roleName as RoleType,
              description: rawUser.roleName
            } : (jwtRole ? { name: jwtRole } : undefined)),
            roleName: (rawUser?.roleName || rawUser?.role?.name || jwtRole || undefined) as (RoleType | string | undefined),
            roleId: rawUser?.roleId || rawUser?.role?.id || undefined,
            facilityId: rawUser?.facilityId || undefined,
            facilityName: rawUser?.facilityName || undefined,
            facilityCode: rawUser?.facilityCode || undefined
          }
          localStorage.setItem('boxora_access_token', accessToken)
=======
      const res = await authService.login(emailOrUsername, password)
      if (res.data) {
        const { accessToken, refreshToken, user: rawUser } = res.data
        const jwtRole = parseJwtRole(accessToken)
        const enrichedUser: User = {
          ...rawUser,
          role: rawUser?.role || (rawUser?.roleName ? {
            id: rawUser.roleId,
            name: rawUser.roleName as RoleType,
            description: rawUser.roleName
          } : (jwtRole ? { name: jwtRole } : undefined)),
          roleName: (rawUser?.roleName || rawUser?.role?.name || jwtRole || undefined) as (RoleType | string | undefined),
          roleId: rawUser?.roleId || rawUser?.role?.id || undefined,
          facilityId: rawUser?.facilityId || undefined,
          facilityName: rawUser?.facilityName || undefined,
          facilityCode: rawUser?.facilityCode || undefined,
          identityCardNumber: (rawUser as any)?.identityCardNumber || localStorage.getItem('boxora_user_cccd_' + rawUser?.email) || localStorage.getItem('boxora_user_cccd') || undefined,
          identityCardType: (rawUser as any)?.identityCardType || 'CCCD'
        }
        localStorage.setItem('boxora_access_token', accessToken)
        if (refreshToken) {
>>>>>>> Stashed changes
          localStorage.setItem('boxora_refresh_token', refreshToken)
          localStorage.setItem('boxora_user', JSON.stringify(enrichedUser))
          setToken(accessToken)
          setUser(enrichedUser)
          return enrichedUser
        }
      } catch (backendError: any) {
        if (backendError?.response) {
          throw backendError
        }
        console.warn('Backend authentication offline, falling back to mock session:', backendError)
        const matchedPreset = ROLE_PRESETS.find(
          p => p.email.toLowerCase() === emailOrUsername.toLowerCase() ||
               p.role.toLowerCase() === emailOrUsername.toLowerCase() ||
               p.email.split('@')[0].toLowerCase() === emailOrUsername.toLowerCase()
        )
        if (matchedPreset) {
          const mockUser: User = {
            id: `mock-${matchedPreset.role.toLowerCase()}`,
            username: matchedPreset.email.split('@')[0],
            email: matchedPreset.email,
            fullName: matchedPreset.role === 'ADMIN' ? 'Nguyễn Quỳnh Anh' :
                      matchedPreset.role === 'BUSINESS_MANAGER' ? 'Hoàng Minh Trí' :
                      matchedPreset.role === 'FACILITY_MANAGER' ? 'Phạm Quốc Đạt' :
                      matchedPreset.role === 'STAFF' ? 'Trần Văn Hậu' : 'Lê Đăng Nguyên',
            role: { name: matchedPreset.role, description: matchedPreset.label }
          }
          const fakeToken = `mock-token-${matchedPreset.role.toLowerCase()}`
          localStorage.setItem('boxora_access_token', fakeToken)
          localStorage.setItem('boxora_user', JSON.stringify(mockUser))
          setToken(fakeToken)
          setUser(mockUser)
          return mockUser
        }
        throw backendError
      }
      throw new Error('Đăng nhập không thành công, vui lòng thử lại.')
    } finally {
      setIsLoading(false)
    }
  }

  const loginWithGoogle = async (idToken: string, mode: 'LOGIN' | 'REGISTER' = 'LOGIN'): Promise<User> => {
    setIsLoading(true)
    try {
      const res = await authService.googleLogin(idToken, mode)
      if (res.data) {
        const { accessToken, refreshToken, user: rawUser } = res.data
        const jwtRole = parseJwtRole(accessToken)
        const enrichedUser: User = {
          ...rawUser,
          role: rawUser?.role || (jwtRole ? { name: jwtRole } : undefined),
          identityCardNumber: (rawUser as any)?.identityCardNumber || localStorage.getItem('boxora_user_cccd_' + rawUser?.email) || localStorage.getItem('boxora_user_cccd') || undefined,
          identityCardType: (rawUser as any)?.identityCardType || 'CCCD'
        }
        localStorage.setItem('boxora_access_token', accessToken)
        if (refreshToken) {
          localStorage.setItem('boxora_refresh_token', refreshToken)
        }
        localStorage.setItem('boxora_user', JSON.stringify(enrichedUser))
        setToken(accessToken)
        setUser(enrichedUser)
        return enrichedUser
      }
      throw new Error('Đăng nhập với Google không thành công, vui lòng thử lại.')
    } finally {
      setIsLoading(false)
    }
  }

  const switchRole = async (targetRole: RoleType): Promise<User> => {
    const preset = ROLE_PRESETS.find(p => p.role === targetRole)
    if (!preset) throw new Error(`Role ${targetRole} not found`)

    try {
      // Try backend authentication first
      return await login(preset.email, preset.password)
    } catch (err: any) {
      if (err?.response) {
        throw err
      }
      console.warn('Backend login fallback to mock session for preset:', targetRole, err)
      // Fallback session only when backend is completely offline
      const mockUser: User = {
        id: `mock-${targetRole.toLowerCase()}`,
        username: preset.email.split('@')[0],
        email: preset.email,
        fullName: targetRole === 'ADMIN' ? 'Nguyễn Quỳnh Anh' :
                  targetRole === 'BUSINESS_MANAGER' ? 'Hoàng Minh Trí' :
                  targetRole === 'FACILITY_MANAGER' ? 'Phạm Quốc Đạt' :
                  targetRole === 'STAFF' ? 'Trần Văn Hậu' : 'Lê Đăng Nguyên',
        role: { name: targetRole, description: preset.label }
      }
      const fakeToken = `mock-token-${targetRole.toLowerCase()}`
      localStorage.setItem('boxora_access_token', fakeToken)
      localStorage.setItem('boxora_user', JSON.stringify(mockUser))
      setToken(fakeToken)
      setUser(mockUser)
      return mockUser
    }
  }

  const logout = async () => {
    const refreshToken = localStorage.getItem('boxora_refresh_token')
    if (refreshToken) {
      await authService.logout(refreshToken)
    }
    localStorage.removeItem('boxora_access_token')
    localStorage.removeItem('boxora_refresh_token')
    localStorage.removeItem('boxora_user')
    setToken(null)
    setUser(null)
  }

  const setSessionUser = (updatedUser: User) => {
    setUser(updatedUser)
    localStorage.setItem('boxora_user', JSON.stringify(updatedUser))
  }

  const updateProfile = async (profile: { fullName: string; phone: string }) => {
    if (!user) throw new Error('Bạn cần đăng nhập để cập nhật hồ sơ.')

    if (user.id.startsWith('mock-')) {
      const updatedUser = { ...user, fullName: profile.fullName.trim(), phone: profile.phone.trim() }
      setSessionUser(updatedUser)
      return updatedUser
    }

    const updatedProfile = await authService.updateProfile({
      fullName: profile.fullName.trim(),
      phone: profile.phone.trim()
    })
    const updatedUser: User = {
      ...user,
      ...updatedProfile,
      role: updatedProfile.role || user.role
    }
    setSessionUser(updatedUser)
    return updatedUser
  }

  const role: RoleType | null = (user?.role?.name || user?.roleName || null) as RoleType | null

  const hasPermission = (allowedRoles: RoleType[]): boolean => {
    if (!role) return false
    return allowedRoles.includes(role)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginWithGoogle,
        logout,
        setSessionUser,
        updateProfile,
        switchRole,
        hasPermission
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

