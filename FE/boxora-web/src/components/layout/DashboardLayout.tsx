import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { RoleType, Facility } from '../../types'
import { facilityService } from '../../services/facilityService'
import { BrandLogo } from '../common/BrandLogo'
import { AccountProfileModal } from '../common/AccountProfileModal'
import { LogoutConfirmModal } from '../common/LogoutConfirmModal'
import { WebSettingsModal } from '../common/WebSettingsModal'
import { UserAvatarDropdown } from '../common/UserAvatarDropdown'
import { QuickThemeLanguageToggle } from '../common/QuickThemeLanguageToggle'
import { FacilityScopingModal } from '../modals/FacilityScopingModal'
import NotificationCenter from './NotificationCenter'
import { useLanguage } from '../../context/LanguageContext'

export const DashboardLayout: React.FC = () => {
  const { user, role, logout, isAuthenticated } = useAuth()
  const { t } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const isFacilityScopedRole = role === 'FACILITY_MANAGER' || role === 'STAFF'
  const assignedFacilityId = user?.facilityId

  const [facilities, setFacilities] = useState<Facility[]>([])
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [selectedFacility, setSelectedFacility] = useState<string>(
    isFacilityScopedRole && assignedFacilityId ? assignedFacilityId : 'ALL'
  )
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [isScopingModalOpen, setIsScopingModalOpen] = useState(false)
  const isCurrentPath = (path: string) => location.pathname === path
  const isFacilityManagerPage = location.pathname.includes('/facility-manager')

  useEffect(() => {
    let isActive = true
    const checkBackend = async () => {
      try {
        const res = await facilityService.getFacilities()
        if (!isActive) return
        let list = res?.content || []
        if (isFacilityScopedRole && assignedFacilityId) {
          const matched = list.filter(f => f.id === assignedFacilityId)
          if (matched.length > 0) {
            list = matched
          } else if (user?.facilityName) {
            list = [{
              id: assignedFacilityId,
              name: user.facilityName,
              code: user.facilityCode || 'FAC',
              address: '',
              city: '',
              phone: '',
              email: '',
              status: 'ACTIVE' as const
            } as unknown as Facility]
          }
        }
        setFacilities(list)
        setBackendStatus('online')

        if (isFacilityScopedRole && assignedFacilityId) {
          setSelectedFacility(assignedFacilityId)
        } else if (list.length > 0) {
          setSelectedFacility(current => {
            if (location.pathname.includes('/facility-manager')) {
              if (current && current !== 'ALL' && list.some(f => f.id === current)) return current
              return list[0].id
            }
            if (current && (current === 'ALL' || list.some(f => f.id === current))) return current
            return 'ALL'
          })
        }
      } catch (err) {
        if (!isActive) return
        setFacilities([])
        setBackendStatus('offline')
        console.warn('Failed to load facilities in DashboardLayout:', err)
      }
    }

    setBackendStatus('checking')
    void checkBackend()
    const intervalId = window.setInterval(() => void checkBackend(), 60_000)
    return () => {
      isActive = false
      window.clearInterval(intervalId)
    }
  }, [location.pathname, isFacilityScopedRole, assignedFacilityId, user?.facilityName, user?.facilityCode])

  useEffect(() => {
    if (isFacilityScopedRole && assignedFacilityId) {
      if (selectedFacility !== assignedFacilityId) {
        setSelectedFacility(assignedFacilityId)
      }
    } else if (isFacilityManagerPage && selectedFacility === 'ALL' && facilities.length > 0) {
      setSelectedFacility(facilities[0].id)
    }
  }, [isFacilityScopedRole, assignedFacilityId, isFacilityManagerPage, selectedFacility, facilities])

  const handleSetSelectedFacility = (facId: string) => {
    if (isFacilityScopedRole && assignedFacilityId) {
      setSelectedFacility(assignedFacilityId)
      return
    }
    setSelectedFacility(facId)
  }

  const assignedFacilityDisplayName = useMemo(() => {
    if (user?.facilityName) {
      return `${user.facilityName.replace(/StoreHub\s*/gi, 'Boxora ')}${user.facilityCode ? ` (${user.facilityCode})` : ''}`
    }
    const found = facilities.find(f => f.id === assignedFacilityId)
    if (found) {
      return `${found.name.replace(/StoreHub\s*/gi, 'Boxora ')} (${found.code})`
    }
    return t('Cơ sở được phân công', 'Assigned Facility')
  }, [user?.facilityName, user?.facilityCode, facilities, assignedFacilityId, t])

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname, location.search])

  const getRoleBadge = (r: RoleType | null) => {
    switch (r) {
      case 'ADMIN':
        return { label: t('Quản trị viên Hệ thống'), bg: 'bg-rose-50 text-rose-700 border-rose-200' }
      case 'BUSINESS_MANAGER':
        return { label: t('Giám đốc Vận hành'), bg: 'bg-slate-100 text-slate-800 border-slate-300' }
      case 'FACILITY_MANAGER':
        return { label: t('Quản lý Cơ sở'), bg: 'bg-blue-50 text-blue-700 border-blue-200' }
      case 'STAFF':
        return { label: t('Nhân viên Quầy'), bg: 'bg-amber-50 text-amber-800 border-amber-200' }
      case 'CUSTOMER':
      default:
        return { label: t('Khách hàng Thuê kho'), bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    }
  }

  const roleBadge = getRoleBadge(role)

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--on-surface)] flex flex-col antialiased">
      {/* Fixed Top Header (64px) */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-50 border-b border-slate-200/80 dark:border-slate-800 shadow-2xs transition-colors">
        <div className="w-full h-full px-4 sm:px-6 flex items-center justify-between gap-3">
          
          {/* Logo & Mobile Menu Toggle */}
          <div className="flex items-center gap-3 sm:gap-6 shrink-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center"
              aria-label="Mở menu điều hướng"
            >
              <span className="material-symbols-outlined text-[24px]">
                {isMobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>

            <BrandLogo size="md" subtitle={t('KHO TỰ QUẢN THÔNG MINH', 'SMART SELF-STORAGE')} />

            <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>

            {/* Facility Selector & Scoping Modal Trigger (Only for internal staff/managers) */}
            {role && role !== 'CUSTOMER' && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                <span className="material-symbols-outlined text-blue-600 text-[18px]">location_on</span>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-semibold text-slate-400">
                    {t('Cơ sở trực thuộc', 'Assigned Facility')}
                  </span>
                  {isFacilityScopedRole ? (
                    <div className="text-xs text-slate-900 font-semibold pr-1">
                      <span>{assignedFacilityDisplayName}</span>
                    </div>
                  ) : (
                    <select
                      value={selectedFacility}
                      onChange={(e) => handleSetSelectedFacility(e.target.value)}
                      className="bg-transparent text-xs text-slate-900 font-semibold focus:outline-none cursor-pointer pr-1"
                    >
                      {!isFacilityManagerPage && (
                        <option value="ALL">{t('Toàn hệ thống (Tất cả cơ sở)', 'All Facilities System')}</option>
                      )}
                      {facilities.length > 0 ? (
                        facilities.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.name.replace(/StoreHub\s*/gi, 'Boxora ')} ({f.code})
                          </option>
                        ))
                      ) : (
                        <option value="">{t('Đang tải danh sách cơ sở...', 'Loading facilities...')}</option>
                      )}
                    </select>
                  )}
                </div>
                {!isFacilityScopedRole && (
                  <button
                    type="button"
                    onClick={() => setIsScopingModalOpen(true)}
                    title={t('Mở bảng phân công cơ sở')}
                    className="ml-1 p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">domain_verification</span>
                  </button>
                )}
              </div>
            )}
          </div>


          {/* Right Tools: Notifications, User Profile */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <QuickThemeLanguageToggle />
            <NotificationCenter userId={user?.id} />

            <div className="h-8 w-[1px] bg-slate-200 hidden sm:block"></div>

            {/* User Profile Dropdown & Logout */}
            {isAuthenticated && user ? (
              <UserAvatarDropdown
                user={user}
                role={role}
                onOpenProfile={() => setIsProfileModalOpen(true)}
                onOpenSettings={() => setIsSettingsModalOpen(true)}
                onOpenLogoutConfirm={() => setIsLogoutConfirmOpen(true)}
              />
            ) : (
              <Link
                to="/login"
                className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">login</span>
                <span>Đăng nhập</span>
              </Link>
            )}

          </div>

        </div>
      </header>

      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar (Responsive drawer on mobile, fixed column on lg) */}
      <aside className={`fixed left-0 top-16 bottom-0 w-64 bg-white dark:bg-slate-900 z-40 border-r border-slate-200 dark:border-slate-800 flex flex-col py-4 shadow-2xs transition-transform duration-200 ease-in-out ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-4">
          
          {/* Active Account Summary Card */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 text-left">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                Phiên đăng nhập
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${roleBadge.bg}`}>
                {role || 'ANONYMOUS'}
              </span>
            </div>
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
              {user?.fullName || 'Khách vãng lai'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {user?.email || 'Chưa đăng nhập'}
            </div>
          </div>

          {/* Mobile Facility Selector */}
          {role && role !== 'CUSTOMER' && (
            <div className="sm:hidden p-3 rounded-xl bg-slate-50 border border-slate-200 text-left">
              <span className="text-[10px] font-semibold text-slate-400 block mb-1">
                Cơ sở trực thuộc
              </span>
              {isFacilityScopedRole ? (
                <div className="text-xs text-slate-900 font-semibold p-2 bg-white rounded-lg border border-slate-200">
                  <span>{assignedFacilityDisplayName}</span>
                </div>
              ) : (
                <select
                  value={selectedFacility}
                  onChange={(e) => handleSetSelectedFacility(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-xs text-slate-900 font-bold focus:outline-none cursor-pointer"
                >
                  {!isFacilityManagerPage && (
                    <option value="ALL">Toàn hệ thống (Tất cả cơ sở)</option>
                  )}
                  {facilities.length > 0 && facilities.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name.replace(/StoreHub\s*/gi, 'Boxora ')} ({f.code})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* CUSTOMER NAVIGATION */}
          {role === 'CUSTOMER' && (
            <div>
              <div className="px-3 pb-2">
                <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Dịch Vụ Khách Thuê
                </span>
              </div>
              <nav className="flex flex-col gap-1 text-left">
                <Link
                  to="/portal/customer?tab=my-units"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isCurrentPath('/portal/customer') && (!new URLSearchParams(location.search).get('tab') || new URLSearchParams(location.search).get('tab') === 'my-units')
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                  <span>Kho của tôi &amp; Mã PIN</span>
                </Link>

                <Link
                  to="/my-bookings"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isCurrentPath('/my-bookings')

                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">pending_actions</span>
                  <span>Đơn đặt giữ chỗ</span>
                </Link>


                <Link
                  to="/portal/customer?tab=explore"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isCurrentPath('/portal/customer') && new URLSearchParams(location.search).get('tab') === 'explore'
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">travel_explore</span>
                  <span>Tìm &amp; Thuê kho mới</span>
                </Link>

                <Link
                  to="/portal/customer?tab=contracts"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isCurrentPath('/portal/customer') && new URLSearchParams(location.search).get('tab') === 'contracts'
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                  <span>Hợp đồng &amp; Hóa đơn</span>
                </Link>

                <Link
                  to="/portal/customer?tab=support"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isCurrentPath('/portal/customer') && new URLSearchParams(location.search).get('tab') === 'support'
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">support_agent</span>
                  <span>Trung tâm hỗ trợ</span>
                </Link>

                <div className="pt-2 mt-2 border-t border-slate-100">
                  <Link
                    to="/"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">home</span>
                    <span>Về trang chủ</span>
                  </Link>
                </div>
              </nav>
            </div>
          )}

          {/* STAFF NAVIGATION */}
          {role === 'STAFF' && (
            <div>
              <div className="px-3 pb-2">
                <span className="text-[11px] font-semibold tracking-wide text-slate-400">
                  Nghiệp vụ quầy
                </span>
              </div>
              <nav className="flex flex-col gap-1 text-left">
                <Link
                  to="/portal/facility-manager"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    isCurrentPath('/portal/facility-manager')
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">grid_view</span>
                  <span>{t('SƠ ĐỒ CƠ SỞ KHO')}</span>
                </Link>

                <Link
                  to="/portal/staff"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isCurrentPath('/portal/staff')
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">badge</span>
                  <span>{t('Bàn vận hành quầy & tiếp đón')}</span>
                </Link>

                <Link
                  to="/portal/staff/shifts"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isCurrentPath('/portal/staff/shifts')
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                  <span>{t('Ca làm')}</span>
                </Link>

                <Link
                  to="/portal/facility-manager"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isCurrentPath('/portal/facility-manager')
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">apartment</span>
                  <span>{t('Sơ đồ cơ sở kho')}</span>
                </Link>

                <Link
                  to="/portal/cashier"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isCurrentPath('/portal/cashier')
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
                  <span>{t('Báo cáo thu ngân')}</span>
                </Link>

                <Link
                  to="/portal/tickets"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isCurrentPath('/portal/tickets')
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">build_circle</span>
                  <span>{t('Xử lý sự cố tại chỗ')}</span>
                </Link>
              </nav>
            </div>
          )}

          {/* FACILITY_MANAGER NAVIGATION (QUẢN LÝ CƠ SỞ ĐỒNG BỘ) */}
          {role === 'FACILITY_MANAGER' && (
            <div>
              <div className="px-3 pb-2">
                <span className="text-[11px] font-semibold tracking-wide text-slate-400">
                  Quản lý cơ sở
                </span>
              </div>
              <nav className="flex flex-col gap-1 text-left">
                <Link
                  to="/portal/facility-manager"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isCurrentPath('/portal/facility-manager')
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">analytics</span>
                  <span>{t('Tổng quan quản lý cơ sở')}</span>
                </Link>

                <Link
                  to="/portal/overdue"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isCurrentPath('/portal/overdue')
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">money_off</span>
                  <span>{t('Xử lý nợ cước quá hạn')}</span>
                </Link>

                <Link
                  to="/portal/shifts"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isCurrentPath('/portal/shifts')
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">schedule</span>
                  <span>{t('Xử lý trực ca')}</span>
                </Link>

                <Link
                  to="/portal/cashier"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isCurrentPath('/portal/cashier')
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
                  <span>{t('Báo cáo thu ngân')}</span>
                </Link>

                <Link
                  to="/portal/tickets"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isCurrentPath('/portal/tickets')
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">build_circle</span>
                  <span>{t('Xử lý sự cố tại chỗ')}</span>
                </Link>
              </nav>
            </div>
          )}

          {/* BUSINESS_MANAGER NAVIGATION */}
          {role === 'BUSINESS_MANAGER' && (
            <div>
              <div className="px-3 pb-2">
                <span className="text-[11px] font-semibold tracking-wide text-slate-400">
                  Điều hành &amp; kinh doanh
                </span>
              </div>
              <nav className="flex flex-col gap-1 text-left">
                <Link
                  to="/portal/business-manager"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isCurrentPath('/portal/business-manager')
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">query_stats</span>
                  <span>{t('Báo cáo doanh thu')}</span>
                </Link>

                <Link
                  to="/portal/shifts"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isCurrentPath('/portal/shifts')
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">event_note</span>
                  <span>{t('Giám sát ca toàn chuỗi')}</span>
                </Link>

                <Link
                  to="/portal/admin?tab=facilities"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isCurrentPath('/portal/admin') && new URLSearchParams(location.search).get('tab') === 'facilities'
                      ? 'bg-blue-50 text-blue-800 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">domain</span>
                  <span>{t('Cấu hình chi nhánh', 'Branch configuration')}</span>
                </Link>

                <Link
                  to="/portal/facility-manager"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isCurrentPath('/portal/facility-manager')
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">apartment</span>
                  <span>{t('Sơ đồ cơ sở kho')}</span>
                </Link>

                <Link
                  to="/portal/tickets"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isCurrentPath('/portal/tickets')
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">troubleshoot</span>
                  <span>{t('Giám sát sự cố & SLA')}</span>
                </Link>
              </nav>
            </div>
          )}

          {/* ADMIN NAVIGATION */}
          {/* ADMIN NAVIGATION */}
          {role === 'ADMIN' && (
            <>
              <div>
                <div className="px-3 pb-2">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400">
                    {t('Quản trị hệ thống', 'System administration')}
                  </span>
                </div>
                <nav className="flex flex-col gap-1 text-left">
                  <Link
                    to="/portal/admin?tab=facilities"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isCurrentPath('/portal/admin') && new URLSearchParams(location.search).get('tab') === 'facilities'
                        ? 'bg-blue-50 text-blue-800 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">domain</span>
                    <span>{t('Chi nhánh', 'Branches')}</span>
                  </Link>
                  <Link
                    to="/portal/admin?tab=users"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isCurrentPath('/portal/admin') && (new URLSearchParams(location.search).get('tab') === 'users' || !new URLSearchParams(location.search).get('tab'))
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                    <span>{t('Người dùng, vai trò & phân quyền', 'Users, roles and permissions')}</span>
                  </Link>
                  <Link
                    to="/portal/admin?tab=logs"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isCurrentPath('/portal/admin') && new URLSearchParams(location.search).get('tab') === 'logs'
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">history</span>
                    <span>{t('Nhật ký kiểm toán hệ thống')}</span>
                  </Link>
                </nav>
              </div>

              <div>
                <div className="px-3 pb-2 pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400">
                    {t('Giám sát nghiệp vụ', 'Authorized oversight')}
                  </span>
                </div>
                <nav className="flex flex-col gap-1 text-left">
                  <Link
                    to="/portal/business-manager"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isCurrentPath('/portal/business-manager')
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">query_stats</span>
                    <span>{t('Báo cáo kinh doanh', 'Business reports')}</span>
                  </Link>
                  <Link
                    to="/portal/cashier"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isCurrentPath('/portal/cashier')
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                    <span>{t('Nhật ký giao dịch', 'Transaction journal')}</span>
                  </Link>
                  <Link
                    to="/portal/tickets"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isCurrentPath('/portal/tickets')
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">troubleshoot</span>
                    <span>{t('Giám sát sự cố', 'Ticket oversight')}</span>
                  </Link>
                </nav>
              </div>
            </>
          )}

        </div>

        {/* Bottom Status Widget */}
        <div className="mt-auto px-4 pt-3">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-1 text-left">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-slate-500 font-bold uppercase">
                {role === 'CUSTOMER' ? t('Phiên tài khoản', 'Account session') : t('Trạng Thái Hệ Thống', 'System status')}
              </span>
              <span className={`h-2 w-2 rounded-full ${role === 'CUSTOMER' || backendStatus === 'online' ? 'bg-emerald-500' : backendStatus === 'checking' ? 'bg-amber-400 animate-pulse' : 'bg-rose-500'}`}></span>
            </div>
            <span className="font-unit-code text-xs text-slate-900 font-bold">
              {role === 'CUSTOMER'
                ? t('Phiên đăng nhập đang hoạt động', 'Signed-in session active')
                : backendStatus === 'online'
                  ? t('API và dữ liệu cơ sở sẵn sàng', 'Facility API and data available')
                  : backendStatus === 'checking'
                    ? t('Đang kiểm tra kết nối', 'Checking connection')
                    : t('Không kết nối được API', 'Facility API unavailable')}
            </span>
            <span className="text-[11px] text-slate-500">
              {role === 'CUSTOMER' ? t('Hỗ trợ khách: 1900 6828') : t('Kiểm tra từ API cơ sở mỗi 60 giây', 'Checked through the facility API every 60 seconds')}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <div className="lg:pl-64 pt-16 flex-1 min-w-0">
        <main className="min-h-[calc(100vh-4rem)] w-full bg-slate-50/70 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 transition-colors">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet context={{
              selectedFacility: isFacilityScopedRole && assignedFacilityId ? assignedFacilityId : selectedFacility,
              setSelectedFacility: handleSetSelectedFacility,
              facilities
            }} />
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
      {!isFacilityScopedRole && (
        <FacilityScopingModal
          isOpen={isScopingModalOpen}
          onClose={() => setIsScopingModalOpen(false)}
          initialUser={{
            id: user?.id || 'u-active',
            fullName: user?.fullName || 'Người dùng hiện tại',
            email: user?.email || '',
            roleName: role || 'STAFF',
            facilityId: selectedFacility,
          }}
          onSave={(data) => {
            handleSetSelectedFacility(data.facilityId)
          }}
        />
      )}
    </div>
  )
}
export default DashboardLayout
