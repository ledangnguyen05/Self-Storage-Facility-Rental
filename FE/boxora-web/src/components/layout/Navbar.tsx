import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, LayoutDashboard, ArrowRight, Menu, X, Pencil, Compass } from 'lucide-react'
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
    <header className="sticky top-0 z-40 w-full bg-[#FFFFFF]/95 backdrop-blur-md border-b border-[#E5E5E1] transition-all">
      <div className="max-w-[1280px] h-[68px] mx-auto px-4 sm:px-6 md:px-8 flex items-center justify-between">
        {/* Logo & Brand Signature */}
        <div className="flex items-center gap-8">
          <BrandLogo onClick={() => setIsMobileMenuOpen(false)} />

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link to="/units" className="text-cyan-800 font-bold hover:text-cyan-900 transition-colors flex items-center gap-1">
              <span>{t('Tìm & Thuê Kho', 'Find & Rent Units')}</span>
            </Link>
            <Link to="/facilities" className="hover:text-slate-900 transition-colors">
              {t('Hệ thống cơ sở')}
            </Link>
            <Link to="/#process" className="hover:text-slate-900 transition-colors">
              {t('Quy trình 3 bước')}
            </Link>
            <Link to="/#iot-access" className="hover:text-slate-900 transition-colors">
              {t('Khóa IoT & An ninh')}
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
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer text-left ${
                  !canAccessPortal
                    ? 'bg-amber-50/80 hover:bg-amber-100/90 border-amber-200 text-amber-900'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-900'
                }`}
              >
                {!canAccessPortal ? (
                  <Compass size={16} className="text-amber-700" />
                ) : (
                  <LayoutDashboard size={16} className="text-slate-700" />
                )}
                <div className="flex flex-col">
                  <span className="text-xs font-bold leading-tight">
                    {!canAccessPortal ? t('Khám Phá Thuê Kho') : t('Vào Portal')}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider font-mono text-slate-500 leading-none">
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
            <div className="flex items-center gap-3">
              <Link to="/login">
                <Button variant="secondary" size="sm">
                  {t('Đăng nhập')}
                </Button>
              </Link>
              <Link to="/facilities">
                <Button variant="primary" size="sm" icon={<ArrowRight size={14} />}>
                  {t('Thuê kho ngay')}
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
              className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold"
              title="Vào trang quản lý"
            >
              {user.fullName ? user.fullName[0].toUpperCase() : user.username[0].toUpperCase()}
            </button>
          )}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="sm:hidden border-t border-slate-200 bg-white px-4 py-5 shadow-xl animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-500">{t('Giao diện & Ngôn ngữ')}</span>
            <QuickThemeLanguageToggle />
          </div>
          <nav className="flex flex-col gap-3 font-medium text-slate-700 mb-5">
            {user && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileModalOpen(true)
                    setIsMobileMenuOpen(false)
                  }}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-left text-sm font-semibold"
                >
                  <Pencil size={16} />
                  {t('Chỉnh sửa hồ sơ')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsModalOpen(true)
                    setIsMobileMenuOpen(false)
                  }}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-left text-sm font-semibold text-slate-700"
                >
                  <span className="material-symbols-outlined text-[18px]">settings</span>
                  {t('Cài đặt web & hệ thống')}
                </button>
              </>
            )}
            <Link
              to="/facilities"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between"
            >
              <span>{t('Hệ thống cơ sở')}</span>
              <ArrowRight size={14} className="text-slate-400" />
            </Link>
            <Link
              to="/#process"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between"
            >
              <span>{t('Quy trình 3 bước')}</span>
              <ArrowRight size={14} className="text-slate-400" />
            </Link>
            <Link
              to="/#iot-access"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between"
            >
              <span>{t('Khóa IoT & An ninh')}</span>
              <ArrowRight size={14} className="text-slate-400" />
            </Link>
          </nav>

          <div className="pt-4 border-t border-slate-100 flex flex-col gap-2.5">
            {user ? (
              <>
                <button
                  onClick={handleDashboardRedirect}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-white font-medium text-sm transition-colors cursor-pointer ${
                    !canAccessPortal ? 'bg-amber-700 hover:bg-amber-800' : 'bg-slate-900 hover:bg-slate-800'
                  }`}
                >
                  {!canAccessPortal ? (
                    <Compass size={16} />
                  ) : (
                    <LayoutDashboard size={16} />
                  )}
                  <span>{canAccessPortal ? `${t('Vào bảng điều khiển')} (${role})` : t('Khám Phá & Đăng Ký Thuê Kho')}</span>
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    setIsLogoutConfirmOpen(true)
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 font-medium text-sm transition-colors cursor-pointer"
                >
                  <LogOut size={16} />
                  <span>{t('Đăng xuất')}</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="w-full">
                  <Button variant="secondary" className="w-full justify-center">
                    {t('Đăng nhập')}
                  </Button>
                </Link>
                <Link to="/facilities" onClick={() => setIsMobileMenuOpen(false)} className="w-full">
                  <Button variant="primary" className="w-full justify-center" icon={<ArrowRight size={16} />}>
                    {t('Thuê kho ngay')}
                  </Button>
                </Link>
              </>
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
