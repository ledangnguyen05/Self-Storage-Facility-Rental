import {
  Banknote,
  BuildingComplex,
  CalendarClock,
  ChartLine,
  CircleDollarSign,
  ConciergeBell,
  HandCoins,
  House,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  Package,
  ReceiptText,
  Search,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { RoleType } from '../../types'

export interface NavLocation {
  pathname: string
  search: string
}

export interface NavItem {
  id: string
  label: string
  /** Router target; may carry a `?tab=` query. */
  to: string
  icon: LucideIcon
  /**
   * Custom active test. Default: same pathname and every query param in `to`
   * has the same value in the current URL.
   */
  match?: (location: NavLocation) => boolean
}

export interface NavSection {
  id: string
  /** Small muted heading. Omit for an unlabeled group (rendered after a divider). */
  label?: string
  items: NavItem[]
}

const tabOf = (location: NavLocation) => new URLSearchParams(location.search).get('tab')

/* ---- Items shared by several roles ---- */

const cashier: NavItem = { id: 'cashier', label: 'Báo cáo thu ngân', to: '/portal/cashier', icon: Banknote }
const tickets: NavItem = { id: 'tickets', label: 'Xử lý sự cố tại chỗ', to: '/portal/tickets', icon: Wrench }
const overdue: NavItem = { id: 'overdue', label: 'Xử lý nợ cước quá hạn', to: '/portal/overdue', icon: CircleDollarSign }
const shifts: NavItem = { id: 'shifts', label: 'Xử lý trực ca', to: '/portal/shifts', icon: CalendarClock }
const finance: NavItem = { id: 'finance', label: 'Hoàn tiền & đối soát', to: '/portal/finance', icon: HandCoins }
const revenue: NavItem = { id: 'revenue', label: 'Báo cáo doanh thu', to: '/portal/business-manager', icon: ChartLine }
const branchConfig: NavItem = {
  id: 'branch-config',
  label: 'Cấu hình chi nhánh',
  to: '/portal/admin?tab=facilities',
  icon: BuildingComplex,
}
const facilityMap: NavItem = { id: 'facility-map', label: 'Sơ đồ cơ sở kho', to: '/portal/facility-manager', icon: LayoutGrid }

/** Sidebar navigation per role. Every `to` must exist in App.tsx. */
export const NAVIGATION: Record<RoleType, NavSection[]> = {
  CUSTOMER: [
    {
      id: 'customer-services',
      label: 'Dịch vụ khách thuê',
      items: [
        {
          id: 'my-units',
          label: 'Kho của tôi & mã PIN',
          to: '/portal/customer?tab=my-units',
          icon: Package,
          match: location => {
            const tab = tabOf(location)
            return location.pathname === '/portal/customer' && (!tab || tab === 'my-units')
          },
        },
        { id: 'explore', label: 'Tìm & thuê kho mới', to: '/portal/customer?tab=explore', icon: Search },
        { id: 'contracts', label: 'Hợp đồng & hóa đơn', to: '/portal/customer?tab=contracts', icon: ReceiptText },
        { id: 'support', label: 'Trung tâm hỗ trợ', to: '/portal/customer?tab=support', icon: LifeBuoy },
      ],
    },
    {
      id: 'customer-links',
      items: [{ id: 'home', label: 'Về trang chủ', to: '/', icon: House, match: () => false }],
    },
  ],
  STAFF: [
    {
      id: 'staff-desk',
      label: 'Nghiệp vụ quầy',
      items: [
        { id: 'desk', label: 'Bàn vận hành quầy & tiếp đón', to: '/portal/staff', icon: ConciergeBell },
        cashier,
        finance,
        tickets,
      ],
    },
  ],
  FACILITY_MANAGER: [
    {
      id: 'facility-management',
      label: 'Quản lý cơ sở',
      items: [
        { id: 'facility-overview', label: 'Tổng quan quản lý cơ sở', to: '/portal/facility-manager', icon: LayoutDashboard },
        overdue,
        shifts,
        cashier,
        finance,
        tickets,
      ],
    },
  ],
  BUSINESS_MANAGER: [
    {
      id: 'business',
      label: 'Điều hành & kinh doanh',
      items: [revenue, branchConfig, facilityMap, overdue, shifts, finance],
    },
  ],
  ADMIN: [
    {
      id: 'system-admin',
      label: 'Quản trị hệ thống',
      items: [
        branchConfig,
        {
          id: 'rbac',
          label: 'Phân quyền RBAC & người dùng',
          to: '/portal/admin?tab=users',
          icon: ShieldCheck,
          // Every admin tab except branch configuration belongs to this entry.
          match: location => location.pathname === '/portal/admin' && tabOf(location) !== 'facilities',
        },
      ],
    },
    {
      id: 'chain-operations',
      label: 'Vận hành toàn chuỗi',
      items: [
        revenue,
        facilityMap,
        overdue,
        shifts,
        { id: 'desk', label: 'Vận hành quầy bàn giao', to: '/portal/staff', icon: ConciergeBell },
        cashier,
        finance,
        tickets,
      ],
    },
  ],
}

export function getNavigation(role: RoleType | null | undefined): NavSection[] {
  return role ? (NAVIGATION[role] ?? []) : []
}

export function isNavItemActive(item: NavItem, location: NavLocation): boolean {
  if (item.match) return item.match(location)
  const target = new URL(item.to, 'http://boxora.local')
  if (target.pathname !== location.pathname) return false
  const current = new URLSearchParams(location.search)
  for (const [key, value] of target.searchParams) {
    if (current.get(key) !== value) return false
  }
  return true
}

/** The active section/item pair, used for the topbar page context. */
export function findActiveNav(sections: NavSection[], location: NavLocation) {
  for (const section of sections) {
    const item = section.items.find(candidate => isNavItemActive(candidate, location))
    if (item) return { section, item }
  }
  return null
}
