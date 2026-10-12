import React, { useState } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { RoleType } from '../../types'
import { FacilityScopingModal, FacilityScopingData } from '../modals/FacilityScopingModal'
import { BrandLogo } from '../common/BrandLogo'

export const DashboardLayout: React.FC = () => {
  const { user, role, logout, isAuthenticated } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [selectedFacility, setSelectedFacility] = useState('tb')
  const [searchQuery, setSearchQuery] = useState('')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isScopingModalOpen, setIsScopingModalOpen] = useState(false)
  const isCurrentPath = (path: string) => location.pathname === path

  const getRoleBadge = (r: RoleType | null) => {
    switch (r) {
      case 'ADMIN':
        return { label: 'Quản trị viên Hệ thống', bg: 'bg-rose-100 text-rose-700 border-rose-200' }
      case 'BUSINESS_MANAGER':
        return { label: 'Giám đốc Vận hành', bg: 'bg-violet-100 text-violet-700 border-violet-200' }
      case 'FACILITY_MANAGER':
        return { label: 'Quản lý Cơ sở', bg: 'bg-blue-100 text-blue-700 border-blue-200' }
      case 'STAFF':
        return { label: 'Nhân viên Quầy', bg: 'bg-amber-100 text-amber-700 border-amber-200' }
      case 'CUSTOMER':
      default:
        return { label: 'Khách hàng Thuê kho', bg: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
    }
  }

  const roleBadge = getRoleBadge(role)

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--on-surface)] flex flex-col antialiased">
      {/* Fixed Top Header (80px) */}
      <header className="fixed top-0 left-0 right-0 h-20 bg-white z-50 shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-slate-200">
        <div className="w-full h-full px-4 sm:px-6 flex items-center justify-between gap-3">
          
          {/* Logo & Mobile Menu Toggle */}
          <div className="flex items-center gap-3 sm:gap-6 shrink-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center"
              aria-label="Mở menu điều hướng"
            >
              <span className="material-symbols-outlined text-[24px]">
                {isMobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>

            <BrandLogo size="md" subtitle="AUTOMATED VAULT NETWORK" />

            <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>

            {/* Facility Selector & Scoping Modal Trigger (Only for internal staff/managers) */}
            {role && role !== 'CUSTOMER' && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                <span className="material-symbols-outlined text-cyan-600 text-[18px]">location_on</span>
                <div className="flex flex-col text-left">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Cơ sở trực thuộc</span>
                  <select
                    value={selectedFacility}
                    onChange={(e) => setSelectedFacility(e.target.value)}
                    className="bg-transparent font-mono text-xs text-slate-900 font-bold focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="tb">Cơ sở Tân Bình - Mega Central</option>
                    <option value="q7">Cơ sở Quận 7 - Nam Sài Gòn</option>
                    <option value="bt">Cơ sở Bình Thạnh - Landmark</option>
                    <option value="cg">Cơ sở Cầu Giấy - Hà Nội Hub</option>
                    <option value="hp">Cơ sở Hải Phòng - Hồng Bàng</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setIsScopingModalOpen(true)}
                  title="Mở bảng phân công cơ sở (Facility Scoping Modal)"
                  className="ml-1 p-1 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">domain_verification</span>
                </button>
              </div>
            )}
          </div>


          {/* Right Tools: Notifications, Search, User Profile */}
          <div className="flex items-center gap-3 shrink-0">

            {/* Quick search */}
            <div className="relative hidden md:block">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kho #ID, HĐ, khách..."
                className="w-44 lg:w-52 pl-8 pr-3 py-1.5 bg-slate-100 text-slate-900 text-xs rounded-lg border border-transparent focus:border-slate-300 focus:bg-white focus:outline-none transition-all"
              />
            </div>

            {/* Notification Badge */}
            <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] text-white font-bold leading-none">
                3
              </span>
            </div>

            <div className="h-8 w-[1px] bg-slate-200 hidden sm:block"></div>

            {/* User Profile & Logout */}
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  {user.fullName ? user.fullName.slice(0, 2).toUpperCase() : 'US'}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-900 leading-tight">
                    {user.fullName || user.username}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border ${roleBadge.bg}`}>
                      {role || 'USER'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => logout().then(() => navigate('/login'))}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Đăng xuất khỏi phiên làm việc"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                </button>
              </div>
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
      <aside className={`fixed left-0 top-20 bottom-0 w-64 bg-white z-40 border-r border-slate-200 flex flex-col justify-between py-4 shadow-[0_1px_8px_rgba(0,0,0,0.02)] transition-transform duration-200 ease-in-out ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex flex-col gap-4 px-3">
          
          {/* Active Account Summary Card */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-left">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[9px] uppercase font-bold text-slate-400">
                Phiên Đăng Nhập
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border ${roleBadge.bg}`}>
                {role || 'ANONYMOUS'}
              </span>
            </div>
            <div className="text-xs font-bold text-slate-900 truncate">
              {user?.fullName || 'Khách vãng lai'}
            </div>
            <div className="text-[11px] font-mono text-slate-500 truncate">
              {user?.email || 'Chưa đăng nhập'}
            </div>
          </div>

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
                <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Vận Hành Quầy
                </span>
              </div>
              <nav className="flex flex-col gap-1 text-left">
                <Link
                  to="/portal/staff"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isCurrentPath('/portal/staff')
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">badge</span>
                  <span>Check-in &amp; Bàn giao Kho</span>
                </Link>
              </nav>
            </div>
          )}

          {/* FACILITY_MANAGER NAVIGATION */}
          {role === 'FACILITY_MANAGER' && (
            <div>
              <div className="px-3 pb-2">
                <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Quản Lý Cơ Sở
                </span>
              </div>
              <nav className="flex flex-col gap-1 text-left">
                <Link
                  to="/portal/facility-manager"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isCurrentPath('/portal/facility-manager')
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">grid_view</span>
                  <span>Sơ đồ kho &amp; Mặt bằng</span>
                </Link>

                <Link
                  to="/portal/staff"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isCurrentPath('/portal/staff')
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">badge</span>
                  <span>Giám sát Quầy Bàn giao</span>
                </Link>
              </nav>
            </div>
          )}

          {/* BUSINESS_MANAGER NAVIGATION */}
          {role === 'BUSINESS_MANAGER' && (
            <div>
              <div className="px-3 pb-2">
                <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Điều Hành &amp; Kinh Doanh
                </span>
              </div>
              <nav className="flex flex-col gap-1 text-left">
                <Link
                  to="/portal/business-manager"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isCurrentPath('/portal/business-manager')
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">query_stats</span>
                  <span>Doanh thu &amp; Tỷ lệ Lấp đầy</span>
                </Link>

                <Link
                  to="/portal/facility-manager"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isCurrentPath('/portal/facility-manager')
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">apartment</span>
                  <span>Theo dõi Các Cơ sở Kho</span>
                </Link>
              </nav>
            </div>
          )}

          {/* ADMIN NAVIGATION */}
          {role === 'ADMIN' && (
            <>
              <div>
                <div className="px-3 pb-2">
                  <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Quản Trị Hệ Thống
                  </span>
                </div>
                <nav className="flex flex-col gap-1 text-left">
                  <Link
                    to="/portal/admin"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      isCurrentPath('/portal/admin')
                        ? 'bg-slate-100 text-slate-900 font-bold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                    <span>Phân quyền RBAC &amp; Users</span>
                  </Link>
                </nav>
              </div>

              <div>
                <div className="px-3 pb-2 pt-2 border-t border-slate-100">
                  <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Vận Hành Toàn Chuỗi
                  </span>
                </div>
                <nav className="flex flex-col gap-1 text-left">
                  <Link
                    to="/portal/business-manager"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      isCurrentPath('/portal/business-manager')
                        ? 'bg-slate-100 text-slate-900 font-bold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">query_stats</span>
                    <span>Báo cáo Doanh thu</span>
                  </Link>
                  <Link
                    to="/portal/facility-manager"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      isCurrentPath('/portal/facility-manager')
                        ? 'bg-slate-100 text-slate-900 font-bold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">grid_view</span>
                    <span>Sơ đồ Cơ sở Kho</span>
                  </Link>
                  <Link
                    to="/portal/staff"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      isCurrentPath('/portal/staff')
                        ? 'bg-slate-100 text-slate-900 font-bold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">badge</span>
                    <span>Vận hành Quầy Bàn giao</span>
                  </Link>
                </nav>
              </div>
            </>
          )}

        </div>

        {/* Bottom Status Widget */}
        <div className="px-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-1 text-left">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-slate-500 font-bold uppercase">
                {role === 'CUSTOMER' ? 'An Ninh Kho' : 'Trạng Thái Hệ Thống'}
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <span className="font-unit-code text-xs text-slate-900 font-bold">
              {role === 'CUSTOMER' ? 'Khóa bảo mật: Hoạt động' : 'Hệ thống trực tuyến'}
            </span>
            <span className="text-[11px] text-slate-500">
              {role === 'CUSTOMER' ? 'Hỗ trợ khách: 1900 6828' : 'Kết nối máy chủ ổn định'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <div className="lg:pl-64 pt-20 flex-1 min-w-0">
        <main className="w-full min-h-[calc(100vh-5rem)] p-4 sm:p-6 md:p-8 bg-[#F8FAFC]">
          <Outlet />
        </main>
      </div>
      {/* Facility Scoping Modal */}
      <FacilityScopingModal
        isOpen={isScopingModalOpen}
        onClose={() => setIsScopingModalOpen(false)}
        initialUser={{
          id: user?.id || 'u-active',
          fullName: user?.fullName || 'Người dùng hiện tại',
          email: user?.email || '',
          roleName: role || 'STAFF',
          facilityId: selectedFacility
        }}
        onSave={(data) => {
          setSelectedFacility(data.facilityId)
        }}
      />
    </div>
  )
}
export default DashboardLayout
