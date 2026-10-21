import { createContext } from 'react'
import type { RoleType, User } from '../types'

export interface ChangePasswordPayload {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

export interface AuthContextType {
  user: User | null
  role: RoleType | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  /**
   * Why the last session ended WITHOUT the user asking (expired, revoked, account locked). The login screen shows it
   * once so a forced logout never lands on a silent, unexplained form. Cleared by `dismissSessionNotice` and on login.
   */
  sessionNotice: string | null
  dismissSessionNotice: () => void
  login: (emailOrUsername: string, password: string) => Promise<User>
  loginWithGoogle: (idToken: string, mode?: 'LOGIN' | 'REGISTER') => Promise<User>
  logout: () => Promise<void>
  setSessionUser: (user: User) => void
  updateProfile: (profile: { fullName: string; phone: string }) => Promise<User>
  /**
   * Changes the signed-in user's password. The backend revokes every session on success, so the local session
   * is cleared as well and the user is sent back to the login screen by the route guards.
   */
  changePassword: (payload: ChangePasswordPayload) => Promise<void>
  hasPermission: (allowedRoles: RoleType[]) => boolean
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)
