import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Box, User as UserIcon, LogOut, LayoutDashboard, ArrowRight, Menu, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { LogoutConfirmModal } from '../ui/LogoutConfirmModal'

export const Navbar: React.FC = () => {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)

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
      default:
        navigate('/portal/customer')
        break
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-[#FFFFFF]/95 backdrop-blur-md border-b border-[#E5E5E1] transition-all">
      <div className="max-w-[1280px] h-[68px] mx-auto px-4 sm:px-6 md:px-8 flex items-center justify-between">
        {/* Logo & Brand Signature */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5 text-slate-900 group" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-wider transition-transform group-hover:scale-95 shadow-sm">
              <Box size={18} className="text-orange-500" />
            </div>
            <span className="font-headline font-bold text-lg tracking-tight text-slate-900">
              BOXORA<span className="text-orange-600">.</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link to="/facilities" className="hover:text-slate-900 transition-colors">
              Hệ thống cơ sở
            </Link>
            <Link to="/#sizes" className="hover:text-slate-900 transition-colors">
              Kích cỡ &amp; Bảng giá
            </Link>
            <Link to="/#features" className="hover:text-slate-900 transition-colors">
              Tiện ích &amp; An ninh
            </Link>
          </nav>
        </div>

        {/* Desktop CTA / User State */}
        <div className="hidden sm:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handleDashboardRedirect}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer text-left"
              >
                <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                  {user.fullName ? user.fullName[0].toUpperCase() : user.username[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900 leading-tight">
                    {user.fullName || user.username}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                    {role}
                  </div>
                </div>
                <LayoutDashboard size={15} className="text-slate-500 ml-1" />
              </button>

              <button
                onClick={() => setIsLogoutModalOpen(true)}
                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                title="Đăng xuất"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link to="/login">
                <Button variant="secondary" size="sm">
                  Đăng nhập
                </Button>
              </Link>
              <Link to="/facilities">
                <Button variant="primary" size="sm" icon={<ArrowRight size={14} />}>
                  Thuê kho ngay
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
          <nav className="flex flex-col gap-3 font-medium text-slate-700 mb-5">
            <Link
              to="/facilities"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between"
            >
              <span>Hệ thống cơ sở</span>
              <ArrowRight size={14} className="text-slate-400" />
            </Link>
            <Link
              to="/#sizes"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between"
            >
              <span>Kích cỡ &amp; Bảng giá</span>
              <ArrowRight size={14} className="text-slate-400" />
            </Link>
            <Link
              to="/#features"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between"
            >
              <span>Tiện ích &amp; An ninh</span>
              <ArrowRight size={14} className="text-slate-400" />
            </Link>
          </nav>

          <div className="pt-4 border-t border-slate-100 flex flex-col gap-2.5">
            {user ? (
              <>
                <button
                  onClick={handleDashboardRedirect}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 text-white font-medium text-sm hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <LayoutDashboard size={16} />
                  <span>Vào bảng điều khiển ({role})</span>
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    setIsLogoutModalOpen(true)
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 font-medium text-sm transition-colors cursor-pointer"
                >
                  <LogOut size={16} />
                  <span>Đăng xuất</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="w-full">
                  <Button variant="secondary" className="w-full justify-center">
                    Đăng nhập
                  </Button>
                </Link>
                <Link to="/facilities" onClick={() => setIsMobileMenuOpen(false)} className="w-full">
                  <Button variant="primary" className="w-full justify-center" icon={<ArrowRight size={16} />}>
                    Thuê kho ngay
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* Logout Confirmation Dialog */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={async () => {
          await logout()
          navigate('/login')
        }}
        userName={user?.fullName || user?.username}
        userEmail={user?.email}
        role={role || undefined}
      />
    </header>
  )
}
