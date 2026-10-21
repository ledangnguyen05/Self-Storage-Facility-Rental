import { useContext } from 'react'
import { AuthContext, type AuthContextType } from './authStore'

export { AuthProvider } from './AuthProvider'
export { AuthContext } from './authStore'
export type { AuthContextType } from './authStore'

/** Current session. Must be used inside <AuthProvider>. */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
