import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, LayoutDashboard, ArrowRight, Menu, X, Pencil, Compass, Box } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/Button'
import { checkCustomerPortalAccess } from '../../utils/rentalAccess'
import { BrandLogo } from '../common/BrandLogo'
import { AccountProfileModal } from '../common/AccountProfileModal'
import { LogoutConfirmModal } from '../common/LogoutConfirmModal'
import { WebSettingsModal } from '../common/WebSettingsModal'
import { UserAvatarDropdown } from '../common/UserAvatarDropdown'
import { QuickThemeLanguageToggle } from '../common/QuickThemeLanguageToggle'
import { useLanguage } from '../../context/LanguageContext'

export const Navbar: React.FC = () => {
  const { user, role, logout } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)

  const isCustomer = role === 'CUSTOMER'
  const customerAccess = checkCustomerPortalAccess(user)
  const canAccessPortal = !isCustomer || customerAccess.hasAccess

  const handleDashboardRedirect = () => {
    if (!role) return
    setIsMobileMenuOpen(false)
    switch (role) {
      case 'ADMIN':
        navigate('/portal/admin')
        break
      case 'FACILITY_MANAGER':
        navigate('/portal/facility-manager')
        break
      case 'BUSINESS_MANAGER':
        navigate('/portal/business-manager')
        break
      case 'STAFF':
        navigate('/portal/staff')
        break
      case 'CUSTOMER':
      default: {
        if (!canAccessPortal) {
          navigate('/units')
        } else {
          navigate('/portal/customer')
        }
        break
      }
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl h-16 mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Logo & Brand Signature */}
        <div className="flex items-center gap-8">
          <BrandLogo onClick={() => setIsMobileMenuOpen(false)} />

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <Link
              to="/units"
              className="text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center gap-1.5"
            >
              <Box size={16} />
              <span>{t('Tìm & Thuê Kho', 'Find & Rent Units')}</span>
            </Link>
            <Link to="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              {t('Quy định & Tiêu chuẩn', 'Terms & Standards')}
            </Link>
            <Link to="/#process" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              {t('Quy trình thuê', 'How It Works')}
            </Link>
            <Link to="/#iot-access" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              {t('Khóa IoT & An ninh', 'Smart IoT Access')}
            </Link>
          </nav>
        </div>

        {/* Desktop CTA / User State */}
        <div className="hidden sm:flex items-center gap-3">
          <QuickThemeLanguageToggle />
          {user ? (
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleDashboardRedirect}
                title={canAccessPortal ? t('Vào Portal') : t('Khám Phá Thuê Kho')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer text-left ${
                  !canAccessPortal
                    ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800/50 dark:text-amber-300'
                    : 'bg-slate-100 hover:bg-slate-200/80 border-slate-200 text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {!canAccessPortal ? (
                  <Compass size={15} className="text-amber-700 dark:text-amber-400" />
                ) : (
                  <LayoutDashboard size={15} className="text-slate-700 dark:text-slate-300" />
                )}
                <div className="flex flex-col">
                  <span className="text-xs font-semibold leading-tight">
                    {!canAccessPortal ? t('Khám Phá Thuê Kho') : t('Vào Portal')}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400 leading-none">
                    {!canAccessPortal ? t('Chưa Có Kho') : (role || 'PORTAL')}
                  </span>
                </div>
              </button>

              <UserAvatarDropdown
                user={user}
                role={role}
                onOpenProfile={() => setIsProfileModalOpen(true)}
                onOpenSettings={() => setIsSettingsModalOpen(true)}
                onOpenLogoutConfirm={() => setIsLogoutConfirmOpen(true)}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Link to="/login">
                <Button variant="secondary" size="sm">
                  {t('Đăng nhập', 'Log In')}
                </Button>
              </Link>
              <Link to="/units">
                <Button variant="primary" size="sm" icon={<ArrowRight size={14} />}>
                  {t('Thuê kho ngay', 'Rent Now')}
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex sm:hidden items-center gap-2">
          {user && (
            <button
              onClick={handleDashboardRedirect}
              className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold"
              title="Vào trang quản lý"
            >
              {user.fullName ? user.fullName[0].toUpperCase() : user.username[0].toUpperCase()}
            </button>
          )}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="sm:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-5 shadow-xl animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('Giao diện & Ngôn ngữ')}</span>
            <QuickThemeLanguageToggle />
          </div>
          <nav className="flex flex-col gap-2 font-medium text-slate-700 dark:text-slate-200 mb-5">
            {user && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileModalOpen(true)
                    setIsMobileMenuOpen(false)
                  }}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-left text-sm font-semibold"
                >
                  <Pencil size={15} />
                  {t('Chỉnh sửa hồ sơ')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsModalOpen(true)
                    setIsMobileMenuOpen(false)
                  }}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-left text-sm font-semibold"
                >
                  <span className="material-symbols-outlined text-[18px]">settings</span>
                  {t('Cài đặt web & hệ thống')}
                </button>
              </>
            )}
            <Link
              to="/units"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between text-blue-600 dark:text-blue-400 font-semibold"
            >
              <span>{t('Tìm & Thuê Kho')}</span>
              <ArrowRight size={14} className="text-blue-500" />
            </Link>
            <Link
              to="/terms"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
            >
              <span>{t('Quy định & Tiêu chuẩn')}</span>
              <ArrowRight size={14} className="text-slate-400" />
            </Link>
            <Link
              to="/#process"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
            >
              <span>{t('Quy trình 3 bước')}</span>
              <ArrowRight size={14} className="text-slate-400" />
            </Link>
          </nav>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
            {user ? (
              <>
                <button
                  onClick={handleDashboardRedirect}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-white font-medium text-sm transition-colors cursor-pointer ${
                    !canAccessPortal ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {!canAccessPortal ? <Compass size={16} /> : <LayoutDashboard size={16} />}
                  <span>{canAccessPortal ? `${t('Vào bảng điều khiển')} (${role})` : t('Khám Phá & Đăng Ký Thuê Kho')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    setIsLogoutConfirmOpen(true)
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-rose-600 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 font-medium text-sm transition-colors cursor-pointer"
                >
                  <LogOut size={16} />
                  <span>{t('Đăng xuất')}</span>
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="w-full">
                  <Button variant="secondary" className="w-full justify-center">
                    {t('Đăng nhập')}
                  </Button>
                </Link>
                <Link to="/units" onClick={() => setIsMobileMenuOpen(false)} className="w-full">
                  <Button variant="primary" className="w-full justify-center" icon={<ArrowRight size={16} />}>
                    {t('Thuê kho ngay')}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
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
    </header>
  )
}
