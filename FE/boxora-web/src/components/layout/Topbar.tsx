import React from 'react'
import { Link } from 'react-router-dom'
import { LogIn, Menu } from 'lucide-react'
import { BrandLogo } from '../common/BrandLogo'
import { QuickThemeLanguageToggle } from '../common/QuickThemeLanguageToggle'
import { UserAvatarDropdown } from '../common/UserAvatarDropdown'
import { Breadcrumbs, IconButton, type BreadcrumbItem } from '../ui'
import { buttonVariants } from '../ui/buttonVariants'
import type { RoleType, User } from '../../types'
import NotificationCenter from './NotificationCenter'

interface TopbarProps {
  breadcrumbs: BreadcrumbItem[]
  /** Facility switcher (internal roles only). */
  facilitySlot?: React.ReactNode
  user: User | null
  role: RoleType | null
  onOpenMobileNav: () => void
  onOpenProfile: () => void
  onOpenSettings: () => void
  onOpenLogoutConfirm: () => void
}

/** 56px app bar: mobile menu, page context, facility scope, notifications, theme and account. */
export function Topbar({
  breadcrumbs,
  facilitySlot,
  user,
  role,
  onOpenMobileNav,
  onOpenProfile,
  onOpenSettings,
  onOpenLogoutConfirm,
}: TopbarProps) {
  return (
    <header
      data-slot="topbar"
      className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:px-4 md:px-6"
    >
      <IconButton icon={Menu} aria-label="Mở menu điều hướng" onClick={onOpenMobileNav} className="lg:hidden" />
      <div className="lg:hidden">
        <BrandLogo size="sm" showText={false} imgClassName="h-7" />
      </div>
      {breadcrumbs.length > 0 ? <Breadcrumbs items={breadcrumbs} className="hidden md:block" /> : null}

      <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
        {facilitySlot}
        <NotificationCenter userId={user?.id} />
        <QuickThemeLanguageToggle showLanguage={false} />
        <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-line sm:block" />
        {user ? (
          <UserAvatarDropdown
            user={user}
            role={role}
            onOpenProfile={onOpenProfile}
            onOpenSettings={onOpenSettings}
            onOpenLogoutConfirm={onOpenLogoutConfirm}
          />
        ) : (
          <Link to="/login" className={buttonVariants({ size: 'sm' })}>
            <LogIn size={14} strokeWidth={1.75} aria-hidden="true" />
            Đăng nhập
          </Link>
        )}
      </div>
    </header>
  )
}
