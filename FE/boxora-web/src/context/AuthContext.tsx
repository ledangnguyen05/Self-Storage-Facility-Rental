import React, { createContext, useContext, useState, useEffect } from 'react'
import { User, RoleType } from '../types'
import { authService } from '../services/authService'

interface AuthContextType {
  user: User | null
  role: RoleType | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (emailOrUsername: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setSessionUser: (user: User) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('boxora_access_token')
      const storedUser = localStorage.getItem('boxora_user')
      if (storedToken && storedUser) {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
      }
    } catch {
      localStorage.removeItem('boxora_access_token')
      localStorage.removeItem('boxora_user')
    } finally {
      setIsLoading(false)
    }
  }, [])

function parseJwtRole(token: string): RoleType | null {
  try {
    const base64Url = token.split('.')[1]
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

  const login = async (emailOrUsername: string, password: string) => {
    const res = await authService.login(emailOrUsername, password)
    if (res.data) {
      const { accessToken, refreshToken, user: rawUser } = res.data
      const jwtRole = parseJwtRole(accessToken)
      const enrichedUser: User = {
        ...rawUser,
        role: rawUser?.role || (jwtRole ? { name: jwtRole } : undefined)
      }
      localStorage.setItem('boxora_access_token', accessToken)
      localStorage.setItem('boxora_refresh_token', refreshToken)
      localStorage.setItem('boxora_user', JSON.stringify(enrichedUser))
      setToken(accessToken)
      setUser(enrichedUser)
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

  const role: RoleType | null = (user?.role?.name as RoleType) || null

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        setSessionUser,
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
