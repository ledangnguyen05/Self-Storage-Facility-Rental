import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, LayoutGrid, Menu } from 'lucide-react'
import { AccountProfileModal } from '../../../components/common/AccountProfileModal'
import { BrandLogo } from '../../../components/common/BrandLogo'
import { LogoutConfirmModal } from '../../../components/common/LogoutConfirmModal'
import { QuickThemeLanguageToggle } from '../../../components/common/QuickThemeLanguageToggle'
import { UserAvatarDropdown } from '../../../components/common/UserAvatarDropdown'
import { WebSettingsModal } from '../../../components/common/WebSettingsModal'
import { Drawer, IconButton, cn } from '../../../components/ui'
import { buttonVariants } from '../../../components/ui/buttonVariants'
import { canRoleAccessPath, getPortalForRole } from '../../../constants/routes'
import { useAuth } from '../../../context/AuthContext'
import { PUBLIC_NAV } from '../../../data/homeContent'

const FACILITY_MAP_PATH = '/portal/facility-manager'

const isNavActive = (to: string, pathname: string) =>
  to === '/units' && (pathname.startsWith('/units') || pathname.startsWith('/explore-units'))

/** Sticky marketing header shared by every public page. */
export function PublicHeader() {
  const { isAuthenticated, user, role, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)

  const portalPath = getPortalForRole(role)
  const isCustomer = role === 'CUSTOMER'
  // Only roles allowed on the facility map see the extra link (and not when it is their own portal).
  const showFacilityMap = canRoleAccessPath(role, FACILITY_MAP_PATH) && portalPath !== FACILITY_MAP_PATH

  const accountMenu = isAuthenticated ? (
    <UserAvatarDropdown
      user={user}
      role={role}
      onOpenProfile={() => setProfileOpen(true)}
      onOpenSettings={() => setSettingsOpen(true)}
      onOpenLogoutConfirm={() => setLogoutOpen(true)}
      extraActions={
        <div className="flex flex-col gap-2">
          <Link to={portalPath} className={buttonVariants({ fullWidth: true })}>
            <LayoutDashboard size={16} strokeWidth={1.75} aria-hidden="true" />
            {isCustomer ? 'Vào cổng khách hàng' : 'Vào cổng làm việc'}
          </Link>
          {showFacilityMap ? (
            <Link to={FACILITY_MAP_PATH} className={buttonVariants({ variant: 'secondary', fullWidth: true })}>
              <LayoutGrid size={16} strokeWidth={1.75} aria-hidden="true" />
              Sơ đồ kho
            </Link>
          ) : null}
        </div>
      }
    />
  ) : null

  return (
    <header data-slot="public-header" className="sticky top-0 z-30 border-b border-line bg-surface print:hidden">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <BrandLogo size="sm" subtitle="Kho tự quản thông minh" />

        <nav aria-label="Điều hướng chính" className="ml-4 hidden items-center gap-1 lg:flex">
          {PUBLIC_NAV.map(item => {
            const active = isNavActive(item.to, pathname)
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <QuickThemeLanguageToggle />
          <span aria-hidden="true" className="mx-1 h-6 w-px bg-line" />
          {isAuthenticated ? (
            accountMenu
          ) : (
            <>
              <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'md' })}>
                Đăng nhập
              </Link>
              <Link to="/register" className={buttonVariants({ variant: 'secondary', size: 'md' })}>
                Tạo tài khoản
              </Link>
              <Link to="/units" className={buttonVariants({ size: 'md' })}>
                Thuê kho ngay
              </Link>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1 lg:hidden">
          <QuickThemeLanguageToggle showLanguage={false} />
          {accountMenu}
          <IconButton icon={Menu} aria-label="Mở menu điều hướng" onClick={() => setMobileOpen(true)} />
        </div>
      </div>

      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} title="Menu" size="sm">
        <nav aria-label="Điều hướng chính" className="flex flex-col gap-1">
          {PUBLIC_NAV.map(item => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-fg hover:bg-surface-2"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
          <QuickThemeLanguageToggle showTheme={false} />
          {isAuthenticated ? null : (
            <>
              <Link to="/units" onClick={() => setMobileOpen(false)} className={buttonVariants({ size: 'lg', fullWidth: true })}>
                Thuê kho ngay
              </Link>
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className={buttonVariants({ variant: 'secondary', size: 'lg', fullWidth: true })}
              >
                Đăng nhập
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileOpen(false)}
                className={buttonVariants({ variant: 'ghost', size: 'lg', fullWidth: true })}
              >
                Tạo tài khoản
              </Link>
            </>
          )}
        </div>
      </Drawer>

      <AccountProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
      <WebSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LogoutConfirmModal
        isOpen={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={async () => {
          await logout()
          navigate('/login')
        }}
        userName={user?.fullName || user?.username}
        userEmail={user?.email}
        userRole={role ?? undefined}
      />
    </header>
  )
}

export default PublicHeader
