import React from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import {
  Box,
  LayoutDashboard,
  KeyRound,
  FileText,
  HelpCircle,
  ClipboardCheck,
  Building2,
  Users,
  ShieldCheck,
  LogOut,
  Sliders,
  DollarSign,
  Layers,
  ArrowLeft,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/Badge'

export interface DashboardLayoutProps {
  children?: React.ReactNode
  title?: string
  subtitle?: string
  action?: React.ReactNode
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title = 'Boxora Management Console',
  subtitle,
  action,
}) => {
  const { user, role, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Define sidebar navigation items based on user role
  const getNavItems = () => {
    switch (role) {
      case 'ADMIN':
        return [
          { label: 'User Directory', path: '/portal/admin', icon: Users },
          { label: 'Roles & Permissions', path: '/portal/admin', icon: ShieldCheck },
          { label: 'Audit & System Logs', path: '/portal/admin', icon: FileText },
        ]
      case 'BUSINESS_MANAGER':
        return [
          { label: 'Multi-Facility Network', path: '/portal/business-manager', icon: Building2 },
          { label: 'Pricing & Fee Rules', path: '/portal/business-manager', icon: Sliders },
          { label: 'Revenue Analytics', path: '/portal/business-manager', icon: DollarSign },
        ]
      case 'FACILITY_MANAGER':
        return [
          { label: 'Storage Unit Map', path: '/portal/facility-manager', icon: Layers },
          { label: 'Contracts & Overdue', path: '/portal/facility-manager', icon: FileText },
          { label: 'Staff Work Orders', path: '/portal/facility-manager', icon: Users },
        ]
      case 'STAFF':
        return [
          { label: 'Today’s Handover Queue', path: '/portal/staff', icon: ClipboardCheck },
          { label: 'Unit Inspection', path: '/portal/staff', icon: Layers },
          { label: 'Report Incident', path: '/portal/staff', icon: HelpCircle },
        ]
      case 'CUSTOMER':
      default:
        return [
          { label: 'My Storage Units', path: '/portal/customer', icon: KeyRound },
          { label: 'Explore & Book Units', path: '/facilities', icon: Box },
          { label: 'Support Requests', path: '/portal/customer', icon: HelpCircle },
        ]
    }
  }

  const navItems = getNavItems()

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F7F7F5]">
      {/* Sidebar */}
      <aside className="w-full md:w-[260px] md:min-h-screen bg-[#FFFFFF] border-r border-[#E5E5E1] flex flex-col shrink-0">
        {/* Top Logo */}
        <div className="h-[68px] px-6 flex items-center justify-between border-b border-[#E5E5E1]">
          <Link to="/" className="flex items-center gap-2.5 text-[#111111]">
            <div className="w-7 h-7 rounded-[6px] bg-[#111111] text-[#FFFFFF] flex items-center justify-center font-bold text-[13px]">
              <Box size={16} />
            </div>
            <span className="font-display font-bold text-[17px] tracking-[-0.04em]">
              BOXORA<span className="text-[#2457FF]">.</span>
            </span>
          </Link>
          <Badge variant="accent" size="sm">
            {role || 'PORTAL'}
          </Badge>
        </div>

        {/* User Badge Info */}
        <div className="p-5 border-b border-[#E5E5E1] bg-[#F7F7F5]/50 text-left">
          <div className="text-[13px] font-semibold text-[#111111] truncate">
            {user?.fullName || user?.username || 'User'}
          </div>
          <div className="text-[12px] text-[#8A8A8A] truncate font-mono mt-0.5">
            {user?.email}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1.5 flex-1 text-left">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-[8px] text-[13.5px] font-medium transition-all duration-150',
                  isActive
                    ? 'bg-[#111111] text-[#FFFFFF] font-semibold shadow-subtle'
                    : 'text-[#555555] hover:text-[#111111] hover:bg-[#F2F2EF]'
                )}
              >
                <Icon size={18} className={isActive ? 'text-[#FFFFFF]' : 'text-[#8A8A8A]'} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-[#E5E5E1] space-y-2">
          <Link
            to="/"
            className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#555555] hover:text-[#111111] hover:bg-[#F2F2EF] rounded-[6px] transition-colors text-left"
          >
            <ArrowLeft size={16} />
            <span>Public Home</span>
          </Link>
          <button
            onClick={() => logout().then(() => navigate('/login'))}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#D64545] hover:bg-[#FDECEC] rounded-[6px] transition-colors cursor-pointer text-left"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Page Top Header */}
        <div className="h-[68px] px-8 bg-[#FFFFFF] border-b border-[#E5E5E1] flex items-center justify-between shrink-0">
          <div className="text-left">
            <h1 className="font-display text-[18px] font-bold text-[#111111] tracking-tight">
              {title}
            </h1>
            {subtitle && <p className="text-[12px] text-[#555555]">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>

        {/* Page Body */}
        <div className="p-6 md:p-8 flex-1 overflow-y-auto max-w-[1280px] w-full mx-auto">
          {children || <Outlet />}
        </div>
      </main>
    </div>
  )
}
