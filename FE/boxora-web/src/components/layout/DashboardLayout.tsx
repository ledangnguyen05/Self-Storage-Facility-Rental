import React, { useState } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { useAuth, ROLE_PRESETS } from '../../context/AuthContext'
import { RoleType } from '../../types'

export const DashboardLayout: React.FC = () => {
  const { user, role, logout, switchRole, isAuthenticated } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [selectedFacility, setSelectedFacility] = useState('tb')
  const [searchQuery, setSearchQuery] = useState('')
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)

  const topNavLinks: Array<{
    label: string
    shortLabel: string
    path: string
    allowedRoles: RoleType[]
  }> = [
    {
      label: 'Khách hàng / Đặt & Quản lý Kho',
      shortLabel: 'Khách hàng',
      path: '/portal/customer',
      allowedRoles: ['CUSTOMER', 'STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN']
    },
    {
      label: 'Nhân viên / Check-in & Bàn giao',
      shortLabel: 'Nhân viên',
      path: '/portal/staff',
      allowedRoles: ['STAFF', 'FACILITY_MANAGER', 'ADMIN']
    },
    {
      label: 'Quản lý Cơ sở / Sơ đồ mặt bằng',
      shortLabel: 'Quản lý Cơ sở',
      path: '/portal/facility-manager',
      allowedRoles: ['FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN']
    },
    {
      label: 'Giám đốc Vận hành & Doanh thu',
      shortLabel: 'GĐ Vận hành',
      path: '/portal/business-manager',
      allowedRoles: ['BUSINESS_MANAGER', 'ADMIN']
    },
    {
      label: 'Quản trị viên Hệ thống / RBAC',
      shortLabel: 'Quản trị RBAC',
      path: '/portal/admin',
      allowedRoles: ['ADMIN']
    },
  ]

  const isCurrentPath = (path: string) => location.pathname === path

  const handleSwitchRole = async (targetRole: RoleType, path: string) => {
    setIsSwitching(true)
    try {
      await switchRole(targetRole)
      setShowRoleMenu(false)
      navigate(path)
    } finally {
      setIsSwitching(false)
    }
  }

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
        <div className="w-full h-full px-6 flex items-center justify-between gap-4">
          
          {/* Logo & Facility Context */}
          <div className="flex items-center gap-6 shrink-0">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-orange-500 text-[24px]">warehouse</span>
              </div>
              <div className="flex flex-col text-left">
                <span className="font-headline text-lg font-bold text-slate-900 tracking-tight leading-none">
                  StorageOps <span className="text-orange-600">Pro</span>
                </span>
                <span className="font-mono text-[10px] text-slate-500 font-semibold tracking-wider uppercase mt-1">
                  Smart Self-Storage Network
                </span>
              </div>
            </Link>

            <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>

            {/* Facility Selector */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="material-symbols-outlined text-orange-600 text-[18px]">location_on</span>
              <div className="flex flex-col text-left">
                <span className="text-[10px] uppercase font-bold text-slate-500">Cơ sở trực thuộc</span>
                <select
                  value={selectedFacility}
                  onChange={(e) => setSelectedFacility(e.target.value)}
                  className="bg-transparent font-unit-code text-xs text-slate-800 font-semibold focus:outline-none cursor-pointer pr-2"
                >
                  <option value="tb">Cơ sở Tân Bình - Mega Central (TP.HCM)</option>
                  <option value="q7">Cơ sở Quận 7 - Nam Sài Gòn (TP.HCM)</option>
                  <option value="bt">Cơ sở Bình Thạnh - Landmark (TP.HCM)</option>
                  <option value="cg">Cơ sở Cầu Giấy - Hà Nội Hub (Hà Nội)</option>
                  <option value="hp">Cơ sở Hải Phòng - Hồng Bàng Port</option>
                </select>
              </div>
            </div>
          </div>

          {/* Top Role Navigation Tabs (Only Render Permitted Links) */}
          <nav className="hidden xl:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {topNavLinks
              .filter((item) => (role ? item.allowedRoles.includes(role) : false))
              .map((item) => {
                const active = isCurrentPath(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      active
                        ? 'bg-slate-900 text-white shadow-sm font-bold'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <span>{item.shortLabel}</span>
                  </Link>
                )
              })}
          </nav>

          {/* Right Tools: Role Switcher, Notifications, User Profile */}
          <div className="flex items-center gap-3 shrink-0">
            
            {/* Quick Role Switcher Dropdown (Interactive RBAC Demo) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 transition-colors text-xs font-bold shadow-xs"
                title="Đổi nhanh giữa 5 vai trò phân quyền để kiểm tra RBAC"
              >
                <span className="material-symbols-outlined text-[16px] text-orange-600">
                  switch_account
                </span>
                <span className="hidden sm:inline">Đổi Vai Trò</span>
                <span className="material-symbols-outlined text-[14px]">
                  {showRoleMenu ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {/* Dropdown Menu */}
              {showRoleMenu && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 p-2 z-50 text-left space-y-1">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <span className="font-mono text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Chọn vai trò thử nghiệm (RBAC)
                    </span>
                  </div>
                  {ROLE_PRESETS.map((p) => {
                    const isCurrent = role === p.role
                    return (
                      <button
                        key={p.role}
                        type="button"
                        disabled={isSwitching}
                        onClick={() => handleSwitchRole(p.role, p.portalPath)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                          isCurrent
                            ? 'bg-slate-900 text-white font-bold'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-bold">{p.label}</span>
                          <span className={`text-[10px] font-mono ${isCurrent ? 'text-slate-300' : 'text-slate-400'}`}>
                            {p.role}
                          </span>
                        </div>
                        {isCurrent && (
                          <span className="material-symbols-outlined text-[16px] text-emerald-400">
                            check_circle
                          </span>
                        )}
                      </button>
                    )
                  })}
                  <div className="pt-2 border-t border-slate-100 px-3 py-1">
                    <Link
                      to="/login"
                      onClick={() => setShowRoleMenu(false)}
                      className="text-[11px] text-orange-600 hover:underline font-semibold flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">login</span>
                      Mở trang Đăng nhập chi tiết
                    </Link>
                  </div>
                </div>
              )}
            </div>

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

      {/* Fixed Left Sidebar (256px / 16rem) */}
      <aside className="fixed left-0 top-20 bottom-0 w-64 bg-white z-40 border-r border-slate-200 flex flex-col justify-between py-4 shadow-[0_1px_8px_rgba(0,0,0,0.02)]">
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

          {/* Section 1: Điều hành Cơ sở (Only show items user has access to) */}
          {role && (
            <div>
              <div className="px-3 pb-2">
                <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  {role === 'CUSTOMER' ? 'Dịch Vụ Khách Thuê' : 'Điều hành Cơ sở'}
                </span>
              </div>
              <nav className="flex flex-col gap-1 text-left">
                {/* Sơ đồ kho & Mặt bằng: FACILITY_MANAGER, BUSINESS_MANAGER, ADMIN */}
                {['FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN'].includes(role) && (
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
                )}

                {/* Check-in & Bàn giao: STAFF, FACILITY_MANAGER, ADMIN */}
                {['STAFF', 'FACILITY_MANAGER', 'ADMIN'].includes(role) && (
                  <Link
                    to="/portal/staff"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      isCurrentPath('/portal/staff')
                        ? 'bg-slate-100 text-slate-900 font-bold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">badge</span>
                    <span>Check-in &amp; Bàn giao</span>
                  </Link>
                )}

                {/* Kiểm soát Cổng & IoT: All authenticated users */}
                <Link
                  to="/portal/customer"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isCurrentPath('/portal/customer')
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">sensor_door</span>
                  <span>Kiểm soát Cổng &amp; IoT</span>
                </Link>

                {/* Hợp đồng & Khách thuê: All authenticated users */}
                <Link
                  to="/portal/customer"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">folder_shared</span>
                  <span>Hợp đồng &amp; Khách thuê</span>
                </Link>
              </nav>
            </div>
          )}

          {/* Section 2: Kinh doanh & Quản trị (Only show if role has permission) */}
          {role && ['BUSINESS_MANAGER', 'ADMIN'].includes(role) && (
            <div>
              <div className="px-3 pb-2 pt-2 border-t border-slate-100">
                <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Kinh doanh &amp; Quản trị
                </span>
              </div>
              <nav className="flex flex-col gap-1 text-left">
                {/* Doanh thu & Lấp đầy: BUSINESS_MANAGER, ADMIN */}
                <Link
                  to="/portal/business-manager"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isCurrentPath('/portal/business-manager')
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">query_stats</span>
                  <span>Doanh thu &amp; Lấp đầy</span>
                </Link>

                {/* Phân quyền RBAC: Strictly ADMIN */}
                {role === 'ADMIN' && (
                  <Link
                    to="/portal/admin"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      isCurrentPath('/portal/admin')
                        ? 'bg-slate-100 text-slate-900 font-bold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                    <span>Phân quyền RBAC</span>
                  </Link>
                )}
              </nav>
            </div>
          )}


        </div>

        {/* Bottom Station IoT Online Status Widget */}
        <div className="px-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-1 text-left">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-slate-500 font-bold uppercase">Trạng thái Trạm</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <span className="font-unit-code text-xs text-slate-900 font-bold">Cổng &amp; Lưới khóa: Online</span>
            <span className="text-[11px] text-slate-500">240/256 Kho đang kết nối</span>
          </div>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <div className="pl-64 pt-20 flex-1 min-w-0">
        <main className="w-full min-h-[calc(100vh-5rem)] p-6 md:p-8 bg-[#F8FAFC]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
export default DashboardLayout
