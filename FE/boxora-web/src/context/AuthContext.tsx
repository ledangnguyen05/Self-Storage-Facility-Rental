import { api } from '../lib/axios'
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
    sublabel: 'Tự quản lý kho, tra cứu mã PIN 24/7 & Hợp đồng',
    email: 'customer@gmail.com',
    password: '123456',
    color: 'border-emerald-500 text-emerald-600 bg-emerald-50',
    portalPath: '/portal/customer'
  }
]

export const DEFAULT_PERMISSIONS_BY_ROLE: Record<RoleType, string[]> = {
  ADMIN: [
    'USER_VIEW', 'USER_CREATE', 'USER_UPDATE', 'USER_DELETE',
    'ROLE_VIEW', 'ROLE_CREATE', 'ROLE_UPDATE', 'ROLE_DELETE', 'ROLE_MANAGE',
    'ROLE_PERMISSION_VIEW', 'ROLE_PERMISSION_ASSIGN', 'ROLE_PERMISSION_REVOKE',
    'PERMISSION_VIEW', 'PERMISSION_CREATE', 'PERMISSION_UPDATE', 'PERMISSION_DELETE',
    'FACILITY_VIEW', 'FACILITY_CREATE', 'FACILITY_UPDATE', 'FACILITY_DELETE',
    'STORAGE_UNIT_VIEW', 'STORAGE_UNIT_CREATE', 'STORAGE_UNIT_UPDATE', 'STORAGE_UNIT_DELETE',
    'POLICY_VIEW', 'POLICY_CREATE', 'POLICY_UPDATE', 'POLICY_DELETE', 'POLICY_MANAGE',
    'BOOKING_VIEW', 'BOOKING_CREATE', 'BOOKING_UPDATE', 'BOOKING_CANCEL',
    'CONTRACT_VIEW', 'CONTRACT_CREATE', 'CONTRACT_UPDATE', 'CONTRACT_SIGNED', 'CONTRACT_EXTENDED',
    'HANDOVER_VIEW', 'HANDOVER_CREATE', 'HANDOVER_EXECUTE',
    'RENEWAL_APPROVE', 'REFUND_APPROVE', 'REFUND_REVIEW',
    'SUPPORT_TICKET_VIEW', 'SUPPORT_TICKET_ASSIGN', 'SUPPORT_TICKET_CLOSE',
    'OVERDUE_VIEW', 'SHIFT_VIEW', 'PAYMENT_VIEW', 'REPORT_VIEW', 'REVENUE_VIEW'
  ],
  BUSINESS_MANAGER: [
    'REVENUE_VIEW', 'REPORT_VIEW', 'PAYMENT_VIEW', 'PRICE_ADJUST', 'FEE_VIEW',
    'STORAGE_UNIT_VIEW', 'FACILITY_VIEW', 'FACILITY_UPDATE', 'POLICY_VIEW', 'POLICY_UPDATE',
    'OVERDUE_VIEW', 'SHIFT_VIEW', 'SUPPORT_TICKET_VIEW', 'CONTRACT_VIEW'
  ],
  FACILITY_MANAGER: [
    'STORAGE_UNIT_VIEW', 'STORAGE_UNIT_UPDATE', 'STORAGE_UNIT_STATUS_CHANGE',
    'FACILITY_VIEW', 'BOOKING_VIEW', 'BOOKING_CANCEL',
    'HANDOVER_VIEW', 'HANDOVER_EXECUTE', 'CHECKOUT_REQUEST', 'CHECKOUT_INSPECTION_COMPLETE',
    'RENEWAL_APPROVE', 'REFUND_APPROVE', 'REFUND_REVIEW',
    'OVERDUE_VIEW', 'SEALING_VIEW', 'SEALING_CREATE', 'SEALING_UNSEAL',
    'SHIFT_VIEW', 'SHIFT_ASSIGN', 'STAFF_SCHEDULE_VIEW',
    'PAYMENT_VIEW', 'CASHIER_VIEW', 'SUPPORT_TICKET_VIEW', 'SUPPORT_TICKET_ASSIGN'
  ],
  STAFF: [
    'STORAGE_UNIT_VIEW', 'BOOKING_VIEW', 'BOOKING_CREATE',
    'HANDOVER_VIEW', 'HANDOVER_EXECUTE', 'CHECKIN_VERIFIED',
    'CHECKOUT_REQUEST', 'CHECKOUT_INSPECTION_COMPLETE',
    'RENEWAL_APPROVE', 'CONTRACT_EXTENDED', 'CONTRACT_VIEW',
    'OVERDUE_VIEW', 'SEALING_VIEW',
    'SHIFT_VIEW', 'STAFF_SCHEDULE_VIEW',
    'PAYMENT_VIEW', 'CASHIER_VIEW', 'SUPPORT_TICKET_VIEW'
  ],
  CUSTOMER: [
    'BOOKING_VIEW', 'BOOKING_CREATE', 'BOOKING_CANCEL',
    'CONTRACT_VIEW', 'CONTRACT_SIGNED', 'CONTRACT_EXTENDED',
    'ACCESS_CREDENTIAL_VIEW', 'SUPPORT_TICKET_VIEW'
  ]
}

interface AuthContextType {
  user: User | null
  role: RoleType | null
  token: string | null
  permissions: string[]
  isLoading: boolean
  isAuthenticated: boolean
  login: (emailOrUsername: string, password: string) => Promise<User>
  loginWithGoogle: (idToken: string, mode?: 'LOGIN' | 'REGISTER') => Promise<User>
  logout: () => Promise<void>
  setSessionUser: (user: User) => void
  updateProfile: (profile: { fullName: string; phone: string }) => Promise<User>
  switchRole: (targetRole: RoleType) => Promise<User>
  hasPermission: (allowed: string | RoleType[] | string[]) => boolean
  hasAuthority: (permission: string) => boolean
  reloadPermissions: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [permissions, setPermissions] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem('boxora_user_permissions')
      return cached ? JSON.parse(cached) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    let isMounted = true

    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem('boxora_access_token')
        const storedUser = localStorage.getItem('boxora_user')

        if (storedToken && storedUser) {
          if (storedToken.startsWith('mock-token-') || storedToken.length < 20) {
            // Purge legacy mock tokens
            localStorage.removeItem('boxora_access_token')
            localStorage.removeItem('boxora_refresh_token')
            localStorage.removeItem('boxora_user')
            setToken(null)
            setUser(null)
            return
          }
          const parsed = JSON.parse(storedUser)
          if (isMounted) {
            setToken(storedToken)
            setUser(parsed)
          }
        }
      } catch {
        localStorage.removeItem('boxora_access_token')
        localStorage.removeItem('boxora_refresh_token')
        localStorage.removeItem('boxora_user')
        setToken(null)
        setUser(null)
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
        if (refreshToken) {
          localStorage.setItem('boxora_refresh_token', refreshToken)
        }
        localStorage.setItem('boxora_user', JSON.stringify(enrichedUser))
        setToken(accessToken)
        setUser(enrichedUser)
        return enrichedUser
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
          role: rawUser?.role || (jwtRole ? { name: jwtRole } : undefined)
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

    // Enforce real backend authentication for role switching
    return await login(preset.email, preset.password)
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

  const role: RoleType | null = (user?.role?.name as RoleType) || null

  const reloadPermissions = async (targetRole = role, roleId = user?.roleId || user?.role?.id) => {
    try {
      // 1. Thu thập quyền hạn phân bổ qua API backend
      const res = await api.get('/api/v1/role-permissions/my-permissions')
      if (res.data?.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
        setPermissions(res.data.data)
        localStorage.setItem('boxora_user_permissions', JSON.stringify(res.data.data))
        return
      }
    } catch {
      // Endpoint fallback
    }

    try {
      if (roleId) {
        const res2 = await api.get(`/api/v1/role-permissions/by-role/${roleId}`)
        if (res2.data?.data && Array.isArray(res2.data.data)) {
          const names = res2.data.data.map((rp: any) => rp.permission?.name || rp.permissionName).filter(Boolean)
          if (names.length > 0) {
            setPermissions(names)
            localStorage.setItem('boxora_user_permissions', JSON.stringify(names))
            return
          }
        }
      }
    } catch {}

    // Fallback sang danh mục quyền mặc định theo vai trò
    const current = targetRole || role
    if (current && DEFAULT_PERMISSIONS_BY_ROLE[current]) {
      setPermissions(DEFAULT_PERMISSIONS_BY_ROLE[current])
      localStorage.setItem('boxora_user_permissions', JSON.stringify(DEFAULT_PERMISSIONS_BY_ROLE[current]))
    }
  }

  useEffect(() => {
    if (user) {
      void reloadPermissions(role, user.roleId || user.role?.id)
    }
  }, [user?.id, role])

  // Lắng nghe sự kiện Admin lưu thay đổi phân quyền trong ma trận RBAC
  useEffect(() => {
    const handlePermUpdated = (e: any) => {
      const detail = e?.detail
      if (!detail?.roleName || detail?.roleName === role) {
        void reloadPermissions(role, detail?.roleId)
      }
    }
    window.addEventListener('boxora_permissions_updated', handlePermUpdated)
    return () => window.removeEventListener('boxora_permissions_updated', handlePermUpdated)
  }, [role, user?.roleId])

  const hasPermission = (check: string | RoleType[] | string[]): boolean => {
    if (!role) return false
    // Quản trị viên IT có toàn quyền tối cao trên hệ thống
    if (role === 'ADMIN') return true

    if (Array.isArray(check)) {
      const isRoleList = check.some(c => c === 'CUSTOMER' || c === 'STAFF' || c === 'FACILITY_MANAGER' || c === 'BUSINESS_MANAGER' || c === 'ADMIN')
      if (isRoleList) {
        return (check as RoleType[]).includes(role)
      }
      return check.some(p => permissions.includes(p))
    }

    // Kiểm tra tên quyền hạn trực tiếp (ví dụ: 'RENEWAL_APPROVE', 'STORAGE_UNIT_VIEW')
    return permissions.includes(check)
  }

  const hasAuthority = (permission: string): boolean => {
    if (!role) return false
    if (role === 'ADMIN') return true
    return permissions.includes(permission)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        permissions,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginWithGoogle,
        logout,
        setSessionUser,
        updateProfile,
        switchRole,
        hasPermission,
        hasAuthority,
        reloadPermissions
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

