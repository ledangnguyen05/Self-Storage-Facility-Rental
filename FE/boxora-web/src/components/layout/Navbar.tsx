import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Box, User as UserIcon, LogOut, LayoutDashboard, ArrowRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'

export const Navbar: React.FC = () => {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()

  const handleDashboardRedirect = () => {
    if (!role) return
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
    <header className="sticky top-0 z-40 w-full h-[68px] bg-[#FFFFFF]/90 backdrop-blur-md border-b border-[#E5E5E1] transition-all">
      <div className="max-w-[1280px] h-full mx-auto px-6 md:px-8 flex items-center justify-between">
        {/* Logo & Brand Signature */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5 text-[#111111] group">
            <div className="w-8 h-8 rounded-[6px] bg-[#111111] text-[#FFFFFF] flex items-center justify-center font-bold text-[14px] tracking-wider transition-transform group-hover:scale-95">
              <Box size={18} />
            </div>
            <span className="font-display font-bold text-[18px] tracking-[-0.04em]">
              BOXORA<span className="text-[#2457FF]">.</span>
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-[14px] font-medium text-[#555555]">
            <Link to="/facilities" className="hover:text-[#111111] transition-colors">
              Facilities
            </Link>
            <Link to="/#sizes" className="hover:text-[#111111] transition-colors">
              Unit Sizes & Rates
            </Link>
            <Link to="/#features" className="hover:text-[#111111] transition-colors">
              Security & Access
            </Link>
          </nav>
        </div>

        {/* Right CTA / User State */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handleDashboardRedirect}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-[8px] bg-[#F2F2EF] hover:bg-[#E5E5E1] border border-[#E5E5E1] transition-colors cursor-pointer text-left"
              >
                <div className="w-7 h-7 rounded-full bg-[#111111] text-white flex items-center justify-center text-[12px] font-medium">
                  {user.fullName ? user.fullName[0].toUpperCase() : user.username[0].toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <div className="text-[13px] font-semibold text-[#111111] leading-tight">
                    {user.fullName || user.username}
                  </div>
                  <div className="text-[11px] text-[#8A8A8A] uppercase tracking-wider font-mono">
                    {role}
                  </div>
                </div>
                <LayoutDashboard size={16} className="text-[#555555] ml-1" />
              </button>

              <button
                onClick={() => logout()}
                className="p-2 rounded-[8px] text-[#8A8A8A] hover:text-[#D64545] hover:bg-[#FDECEC] transition-colors cursor-pointer"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link to="/login">
                <Button variant="secondary" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/facilities">
                <Button variant="primary" size="sm" icon={<ArrowRight size={14} />}>
                  Find a Unit
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
