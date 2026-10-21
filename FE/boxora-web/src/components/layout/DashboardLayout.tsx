import React, { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { STORAGE_KEYS } from '../../constants/storageKeys'
import { getString, setString } from '../../lib/storage'
import { AccountProfileModal } from '../common/AccountProfileModal'
import { BrandLogo } from '../common/BrandLogo'
import { LogoutConfirmModal } from '../common/LogoutConfirmModal'
import { WebSettingsModal } from '../common/WebSettingsModal'
import { Drawer, IconButton, type BreadcrumbItem } from '../ui'
import { cn } from '../ui/cn'
import type { DashboardOutletContext } from './dashboardContext'
import { FacilitySwitcher } from './FacilitySwitcher'
import { findActiveNav, getNavigation } from './navigation'
import { Sidebar, SidebarNav } from './Sidebar'
import { Topbar } from './Topbar'
import { useFacilityScope } from './useFacilityScope'

/**
 * localStorage: "true" when the desktop sidebar is collapsed to the icon rail.
 */
const SIDEBAR_COLLAPSED_KEY = STORAGE_KEYS.sidebarCollapsed

/** Portal app shell: sidebar + topbar + content area, and the facility scope for every portal page. */
export const DashboardLayout: React.FC = () => {
  const { user, role, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const scope = useFacilityScope({ user, role, pathname: location.pathname })
  const sections = useMemo(() => getNavigation(role), [role])
  const activeNav = findActiveNav(sections, location)

  // Browser tab / history entries name the portal page ("Quản lý người dùng · Boxora") instead of the static app title.
  const activeNavLabel = activeNav?.item.label
  useEffect(() => {
    if (!activeNavLabel) return undefined
    const previous = document.title
    document.title = `${activeNavLabel} · Boxora`
    return () => {
      document.title = previous
    }
  }, [activeNavLabel])

  const [collapsed, setCollapsed] = useState(() => getString(SIDEBAR_COLLAPSED_KEY) === 'true')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)

  // Close the mobile drawer whenever the route changes (adjusting state during render, no effect needed).
  const routeKey = `${location.pathname}${location.search}`
  const [lastRouteKey, setLastRouteKey] = useState(routeKey)
  if (routeKey !== lastRouteKey) {
    setLastRouteKey(routeKey)
    if (mobileNavOpen) setMobileNavOpen(false)
  }

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    setString(SIDEBAR_COLLAPSED_KEY, String(next))
  }

  const breadcrumbs: BreadcrumbItem[] = activeNav
    ? [...(activeNav.section.label ? [{ label: activeNav.section.label }] : []), { label: activeNav.item.label }]
    : []

  const { selectedFacility, setSelectedFacility, facilities, isFacilityScoped, isLoadingFacilities } = scope
  const outletContext = useMemo<DashboardOutletContext>(
    () => ({ selectedFacility, setSelectedFacility, facilities, isFacilityScoped, isLoadingFacilities }),
    [selectedFacility, setSelectedFacility, facilities, isFacilityScoped, isLoadingFacilities],
  )

  const facilitySlot =
    role && role !== 'CUSTOMER' ? (
      <FacilitySwitcher
        facilities={scope.facilities}
        selectedFacility={scope.selectedFacility}
        onSelect={scope.setSelectedFacility}
        isFacilityScoped={scope.isFacilityScoped}
        assignedFacilityLabel={scope.assignedFacilityLabel}
        requiresConcreteFacility={scope.requiresConcreteFacility}
        isLoading={scope.isLoadingFacilities}
        hasError={scope.facilitiesError}
        onRetry={scope.reloadFacilities}
      />
    ) : null

  return (
    <div className="min-h-screen bg-canvas text-fg">
      <a
        href="#main-content"
        className="sr-only z-400 rounded-md bg-surface px-3 py-2 text-sm font-medium text-fg shadow-md focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
      >
        Bỏ qua điều hướng
      </a>

      <Sidebar sections={sections} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />

      <Drawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        side="left"
        size="sm"
        hideCloseButton
        aria-label="Điều hướng"
        bodyClassName="flex flex-col p-0"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
          <BrandLogo size="sm" showText={false} imgClassName="h-8" onClick={() => setMobileNavOpen(false)} />
          <IconButton icon={X} size="sm" aria-label="Đóng menu điều hướng" onClick={() => setMobileNavOpen(false)} />
        </div>
        <SidebarNav sections={sections} onNavigate={() => setMobileNavOpen(false)} />
      </Drawer>

      <div className={cn('flex min-h-screen min-w-0 flex-col transition-[padding] duration-200', collapsed ? 'lg:pl-14' : 'lg:pl-60')}>
        <Topbar
          breadcrumbs={breadcrumbs}
          facilitySlot={facilitySlot}
          user={user}
          role={role}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenLogoutConfirm={() => setIsLogoutConfirmOpen(true)}
        />
        <main id="main-content" data-slot="main" tabIndex={-1} className="flex-1 bg-canvas p-4 outline-none md:p-6">
          <div className="mx-auto w-full min-w-0 max-w-content">
            <Outlet context={outletContext} />
          </div>
        </main>
      </div>

      <AccountProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      <WebSettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} />
      <LogoutConfirmModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={async () => {
          await logout()
          navigate('/login')
        }}
        userName={user?.fullName || user?.username}
        userEmail={user?.email}
        userRole={role || 'USER'}
      />
    </div>
  )
}

export default DashboardLayout
