import React, { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AccessSection, type AccessTab } from './components/AccessSection'
import { FacilitiesSection } from './components/FacilitiesSection'

const ACCESS_TABS: readonly AccessTab[] = ['users', 'roles', 'logs']
const FACILITIES_TAB = 'facilities'

const isAccessTab = (value: string | null): value is AccessTab => ACCESS_TABS.includes(value as AccessTab)

/**
 * /portal/admin. The URL decides the screen (`?tab=`): branch configuration (`facilities`) or the
 * access console (`users`, `roles`, `logs`). The business manager only ever sees branch configuration.
 */
export const AdminDashboard: React.FC = () => {
  const { role } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const isBusinessManager = role === 'BUSINESS_MANAGER'

  // Keep the address bar honest for the business manager (the sidebar highlights by URL).
  useEffect(() => {
    if (isBusinessManager && requested !== FACILITIES_TAB) setSearchParams({ tab: FACILITIES_TAB }, { replace: true })
  }, [isBusinessManager, requested, setSearchParams])

  if (isBusinessManager || requested === FACILITIES_TAB) return <FacilitiesSection />

  const tab: AccessTab = isAccessTab(requested) ? requested : 'users'
  return <AccessSection tab={tab} onTabChange={next => setSearchParams({ tab: next }, { replace: true })} />
}
