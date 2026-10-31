import React, { useState, useEffect, useMemo } from 'react'
import { useOutletContext, useSearchParams, useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth, DEFAULT_PERMISSIONS_BY_ROLE } from '../../context/AuthContext'
import { userService } from '../../services/userService'
import { roleService } from '../../services/roleService'
import { permissionService } from '../../services/permissionService'
import { getRoleMeta, formatPermission, ROLE_VIETNAMESE_MAP } from '../../utils/rbacTranslations'
import { activityLogService } from '../../services/activityLogService'
import { facilityService } from '../../services/facilityService'
import { authService } from '../../services/authService'
import { useLanguage } from '../../context/LanguageContext'
import { User, RoleType, Role, Permission, ActivityLog, Facility } from '../../types'
import { FacilityScopingModal } from '../../components/modals/FacilityScopingModal'
import { FacilityConfigurationPanel } from './FacilityConfigurationPanel'

interface DashboardOutletContextType {
  selectedFacility?: string
  setSelectedFacility?: (facilityId: string) => void
  facilities?: Facility[]
}

type AdminDashboardTab = 'users' | 'roles' | 'logs' | 'facilities'

const isDashboardTab = (tab: string | null): tab is AdminDashboardTab =>
  tab === 'users' || tab === 'roles' || tab === 'logs' || tab === 'facilities'

export const AdminDashboard: React.FC = () => {
  const { role, user } = useAuth()
  const { t } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const outletContext = useOutletContext<DashboardOutletContextType | undefined>()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const isFacilitiesRoute = location.pathname.includes('/facilities')
  const [activeTab, setActiveTabState] = useState<AdminDashboardTab>(
    isFacilitiesRoute
      ? 'facilities'
      : (role === 'ADMIN' && requestedTab === 'facilities')
      ? 'users'
      : (role === 'BUSINESS_MANAGER'
      ? 'facilities'
      : (isDashboardTab(requestedTab) ? requestedTab : 'users'))
  )
  const setActiveTab = (tab: AdminDashboardTab) => {
    setActiveTabState(tab)
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      next.set('tab', tab)
      return next
    }, { replace: true })
  }

  useEffect(() => {
    if (role === 'BUSINESS_MANAGER') {
      if (location.pathname === '/portal/admin') {
        navigate('/portal/facilities', { replace: true })
        return
      }
      if (activeTab !== 'facilities') {
        setActiveTabState('facilities')
      }
    } else {
      if (isFacilitiesRoute) {
        if (activeTab !== 'facilities') setActiveTabState('facilities')
      } else if (isDashboardTab(requestedTab)) {
        setActiveTabState(requestedTab)
      } else {
        setActiveTabState('users')
      }
    }
  }, [role, requestedTab, isFacilitiesRoute, activeTab, location.pathname, navigate])

  // Facility state
  const [facilities, setFacilities] = useState<Facility[]>(outletContext?.facilities || [])
  const [facilityFilter, setFacilityFilter] = useState<string>(outletContext?.selectedFacility || 'ALL')

  // User state
  const [users, setUsers] = useState<User[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false)
  const [isSampleUserData, setIsSampleUserData] = useState(false)
  const [isSampleRoleData, setIsSampleRoleData] = useState(false)
  const [permSearch, setPermSearch] = useState('')
  const [permFilterMode, setPermFilterMode] = useState<'all' | 'assigned'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const pageSize = 10

  // Facility Scoping Modal State (Stitch Feature)
  const [scopingUser, setScopingUser] = useState<User | null>(null)
  const [isScopingModalOpen, setIsScopingModalOpen] = useState(false)

  // Create User Modal
  const [roleEditUser, setRoleEditUser] = useState<User | null>(null)
  const [selectedNewRole, setSelectedNewRole] = useState<RoleType>('STAFF')
  const [editFacilityId, setEditFacilityId] = useState<string>('')
  const [isRoleEditing, setIsRoleEditing] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    fullName: '',
    phone: '',
    password: '',
    roleName: 'STAFF' as RoleType,
    facilityId: ''
  })
  const [createSuccess, setCreateSuccess] = useState(false)

  // Roles & Permissions state
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [assignedPermIds, setAssignedPermIds] = useState<string[]>([])
  const [roleSaving, setRoleSaving] = useState(false)
  const [roleSaveSuccess, setRoleSaveSuccess] = useState(false)
  const [roleSaveError, setRoleSaveError] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [userActionLoadingId, setUserActionLoadingId] = useState<string | null>(null)

  // Activity Log state
  const fallbackRoles: Role[] = [
    { id: 'r-1', name: 'ADMIN', description: 'Toàn quyền quản trị tài khoản, vai trò người dùng, ma trận phân quyền RBAC và cấu hình bảo mật hệ thống.' },
    { id: 'r-2', name: 'BUSINESS_MANAGER', description: 'Quản lý danh mục cơ sở, thiết lập bảng giá, chính sách cho thuê, phê duyệt chiết khấu & khuyến mãi và báo cáo doanh thu toàn chuỗi.' },
    { id: 'r-3', name: 'FACILITY_MANAGER', description: 'Điều hành vận hành buồng kho, giám sát ca trực nhân viên, duyệt ngoại lệ, kiểm tra đối soát hoàn tiền và xử lý giao nhận kho tại cơ sở.' },
    { id: 'r-4', name: 'STAFF', description: 'Thực hiện thủ tục check-in tiếp nhận kho, nghiệm thu trả kho, thu ngân quầy cơ sở, hỗ trợ khách hàng và xử lý sự cố tại chỗ.' },
    { id: 'r-5', name: 'CUSTOMER', description: 'Khách hàng sử dụng dịch vụ lưu trữ: đặt giữ chỗ kho, thanh toán trực tuyến, ký hợp đồng điện tử và quản lý buồng kho cá nhân.' },
  ]

  const fallbackPermissions: Permission[] = [
    { id: 'p-1', name: 'Xem người dùng', code: 'USER_READ', module: 'USER' },
    { id: 'p-2', name: 'Tạo / Sửa người dùng', code: 'USER_WRITE', module: 'USER' },
    { id: 'p-3', name: 'Phân quyền vai trò', code: 'ROLE_MANAGE', module: 'ROLE' },
    { id: 'p-4', name: 'Xem cơ sở & kho', code: 'FACILITY_READ', module: 'FACILITY' },
    { id: 'p-5', name: 'Cấu hình giá & chính sách', code: 'POLICY_MANAGE', module: 'POLICY' },
    { id: 'p-6', name: 'Check-in & Nghiệm thu', code: 'HANDOVER_EXECUTE', module: 'HANDOVER' },
    { id: 'p-7', name: 'Xem báo cáo doanh thu', code: 'REPORT_REVENUE', module: 'REPORT' },
    { id: 'p-8', name: 'Xem nhật ký kiểm toán', code: 'AUDIT_LOG_READ', module: 'AUDIT' },
  ]

  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [logsError, setLogsError] = useState(false)
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [logTypeFilter, setLogTypeFilter] = useState<string>('ALL')
  const [logSearch, setLogSearch] = useState('')
  const [isLoginHistoryMode, setIsLoginHistoryMode] = useState(false)
  const [logsPage, setLogsPage] = useState(0)
  const [logsTotalPages, setLogsTotalPages] = useState(1)
  const [logsTotalElements, setLogsTotalElements] = useState(0)

  // Sync facilities and selectedFacility from DashboardLayout outlet context
  useEffect(() => {
    if (outletContext?.facilities && outletContext.facilities.length > 0) {
      setFacilities(outletContext.facilities)
    } else {
      facilityService.getFacilities()
        .then(res => {
          if (res?.content && res.content.length > 0) {
            setFacilities(res.content)
          }
        })
        .catch(err => console.warn('Could not fetch facilities in AdminDashboard:', err))
    }
  }, [outletContext?.facilities])

  useEffect(() => {
    if (outletContext?.selectedFacility !== undefined) {
      setFacilityFilter(outletContext.selectedFacility)
    }
  }, [outletContext?.selectedFacility])

  useEffect(() => {
    fetchUsers(facilityFilter)
  }, [facilityFilter])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, roleFilter, facilityFilter])

  useEffect(() => {
    fetchRolesAndPermissions()
    fetchLogs()
  }, [])

  // Re-fetch data when the active tab changes so each tab always shows fresh data
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers(facilityFilter)
    } else if (activeTab === 'roles') {
      fetchRolesAndPermissions()
    } else if (activeTab === 'logs') {
      fetchLogs(isLoginHistoryMode, logsPage)
    } else if (activeTab === 'facilities') {
      facilityService.getFacilities()
        .then(res => {
          if (res?.content && res.content.length > 0) {
            setFacilities(res.content)
          }
        })
        .catch(err => console.warn('Could not refresh facilities on tab switch:', err))
    }
  }, [activeTab])

  const fetchUsers = async (targetFacilityId?: string) => {
    setIsLoadingUsers(true)
    const fac = targetFacilityId !== undefined ? targetFacilityId : facilityFilter
    const effectiveFacId = (fac && fac !== 'ALL' && fac.trim() !== '') ? fac : undefined

    try {
      const res = await userService.getAllUsers({ facilityId: effectiveFacId })
      if (res?.data && Array.isArray(res.data)) {
        setUsers(res.data)
        setIsSampleUserData(false)
        setFeedbackMessage(null)
      } else {
        setUsers([])
        setIsSampleUserData(false)
      }
    } catch (err: any) {
      console.warn('Initial fetch users failed:', err)
      setFeedbackMessage('Không thể kết nối danh sách tài khoản từ máy chủ. Vui lòng bấm làm mới.')
      setIsSampleUserData(false)
    } finally {
      setIsLoadingUsers(false)
    }
  }

  const fetchRolesAndPermissions = async () => {
    try {
      const rRes = await roleService.getAll({ size: 50 })
      const pRes = await permissionService.getAll({ size: 100 })
      const loadedRoles = rRes?.content || []
      const loadedPerms = pRes?.content || []
      setIsSampleRoleData(false)
      setRoles(loadedRoles)
      setPermissions(loadedPerms)
      if (loadedRoles.length > 0) {
        void selectRole(loadedRoles[0], loadedPerms)
      }
    } catch {
      setIsSampleRoleData(false)
      setRoles([])
      setPermissions([])
    }
  }

  const selectRole = async (role: Role, availablePermissions = permissions) => {
    setRoleSaveError(null)
    setRoleSaveSuccess(false)
    setSelectedRole(role)

    const roleKey = (role.name || '').toUpperCase() as RoleType
    const standardCodes = DEFAULT_PERMISSIONS_BY_ROLE[roleKey] || []

    try {
      const rolePerms = await roleService.getPermissionsByRoleId(role.id)
      if (rolePerms && Array.isArray(rolePerms) && rolePerms.length > 0) {
        // Chỉ lấy các quyền thực sự active từ cơ sở dữ liệu
        const activePerms = rolePerms.filter((rp: any) => {
          if (typeof rp.isActive === 'boolean') return rp.isActive
          if (typeof rp.active === 'boolean') return rp.active
          return false
        })
        if (activePerms.length > 0) {
          setAssignedPermIds(activePerms.map((rp: any) => rp.permissionId))
          return
        }
      }
    } catch {
      // Fallback bên dưới
    }

    // Tự động gán quyền chuẩn hóa theo vai trò nếu API chưa trả về
    const standardIds = availablePermissions
      .filter((p: Permission) => {
        const code = (p.code || p.name || '').toUpperCase()
        return standardCodes.includes(code)
      })
      .map((p: Permission) => p.id)

    setAssignedPermIds(standardIds)
  }

  const filteredPermissions = useMemo(() => {
    return permissions.filter((p: Permission) => {
      const isAssigned = assignedPermIds.includes(p.id)
      if (permFilterMode === 'assigned' && !isAssigned) return false

      if (!permSearch.trim()) return true
      const meta = formatPermission(p)
      const q = permSearch.toLowerCase()
      return (
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (meta.title && meta.title.toLowerCase().includes(q)) ||
        (meta.description && meta.description.toLowerCase().includes(q))
      )
    })
  }, [permissions, assignedPermIds, permFilterMode, permSearch])

  const togglePermission = (permId: string) => {
    setAssignedPermIds(prev => 
      prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
    )
  }

  const handleSaveRolePermissions = async () => {
    if (!selectedRole) return
    setRoleSaving(true)
    try {
      await roleService.bulkAssignPermissions(selectedRole.id, assignedPermIds)
      setRoleSaveSuccess(true)
      setRoleSaveError(null)
      setTimeout(() => setRoleSaveSuccess(false), 2500)

      // Phát sự kiện toàn hệ thống để các Dashboard khác cập nhật ngay các quyền vừa phân
      window.dispatchEvent(new CustomEvent('boxora_permissions_updated', {
        detail: {
          roleId: selectedRole.id,
          roleName: selectedRole.name,
          permissionIds: assignedPermIds
        }
      }))
    } catch {
      setRoleSaveError('Không lưu được phân quyền. Thay đổi chưa được áp dụng.')
    } finally {
      setRoleSaving(false)
    }
  }

  const fetchLogs = async (loginHistoryMode = isLoginHistoryMode, page = logsPage) => {
    setLogsError(false)
    setIsLoadingLogs(true)
    try {
      if (loginHistoryMode) {
        const res = await activityLogService.getLoginHistory({ page, size: 20 })
        setLogs(res?.content || [])
        setLogsTotalPages(res?.totalPages || 1)
        setLogsTotalElements(res?.totalElements || 0)
      } else {
        const res = await activityLogService.getAll({ page, size: 20 })
        setLogs(res?.content || [])
        setLogsTotalPages(res?.totalPages || 1)
        setLogsTotalElements(res?.totalElements || 0)
      }
    } catch {
      setLogs([])
      setLogsError(true)
    } finally {
      setIsLoadingLogs(false)
    }
  }

  const handleRoleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roleEditUser) return
    setIsRoleEditing(true)
    try {
      const targetRole = roles.find(r => r.name.toUpperCase() === selectedNewRole.toUpperCase())
      const roleId = targetRole?.id || null
      const payload: any = {
        roleId,
        roleName: selectedNewRole
      }
      if (selectedNewRole === 'STAFF' || selectedNewRole === 'FACILITY_MANAGER') {
        if (editFacilityId) {
          payload.facilityId = editFacilityId
        }
      }
      await userService.updateUser(roleEditUser.id, payload)
      setUsers(current => current.map(u => u.id === roleEditUser.id ? ({
        ...u,
        roleName: selectedNewRole,
        role: (targetRole || { id: roleId || '', name: selectedNewRole, description: '' }) as Role,
        facilityId: (selectedNewRole === 'STAFF' || selectedNewRole === 'FACILITY_MANAGER') ? (editFacilityId || u.facilityId) : null,
        facility: (selectedNewRole === 'STAFF' || selectedNewRole === 'FACILITY_MANAGER') 
          ? (facilities.find(f => f.id === editFacilityId) || (u as any).facility) 
          : undefined
      } as unknown as User) : u))
      setFeedbackMessage(`Đã cập nhật vai trò cho "${roleEditUser.fullName || roleEditUser.username}" thành ${getRoleMeta(selectedNewRole).title}.`)
      setTimeout(() => setFeedbackMessage(null), 3500)
      setRoleEditUser(null)
    } catch (err: any) {
      setFeedbackMessage(err?.response?.data?.message || 'Không thể cập nhật vai trò người dùng.')
    } finally {
      setIsRoleEditing(false)
    }
  }

  const handleDeleteUser = async (targetUser: User) => {
    if (user?.id === targetUser.id) {
      setFeedbackMessage('Bạn không thể xóa tài khoản hiện đang đăng nhập của chính mình.')
      return
    }
    const confirmDelete = window.confirm(
      `Bạn có chắc chắn muốn xóa tài khoản "${targetUser.fullName || targetUser.username}" (${targetUser.email})?\nThao tác này sẽ xóa vĩnh viễn hoặc vô hiệu hóa tài khoản khỏi hệ thống.`
    )
    if (!confirmDelete) return

    setUserActionLoadingId(targetUser.id)
    try {
      await userService.deleteUser(targetUser.id)
      setUsers(prev => prev.filter(u => u.id !== targetUser.id))
      setFeedbackMessage(`Đã xóa tài khoản "${targetUser.fullName || targetUser.username}" thành công.`)
      setTimeout(() => setFeedbackMessage(null), 3000)
    } catch (err: any) {
      setFeedbackMessage(err?.response?.data?.message || 'Không thể xóa tài khoản. Vui lòng kiểm tra lại.')
    } finally {
      setUserActionLoadingId(null)
    }
  }

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const emailBase = (newUser.email || '').split('@')[0].replace(/[^a-zA-Z0-9_]/g, '')
      const generatedUsername = emailBase.length >= 3 ? emailBase : `user_${emailBase || Date.now().toString().slice(-4)}`
      const targetRole = roles.find(r => r.name.toUpperCase() === newUser.roleName.toUpperCase())

      const payload = {
        username: generatedUsername,
        email: newUser.email.trim(),
        fullName: newUser.fullName.trim(),
        phone: newUser.phone.trim(),
        password: newUser.password,
        roleId: targetRole?.id || null,
        roleName: newUser.roleName,
        facilityId: (newUser.roleName === 'STAFF' || newUser.roleName === 'FACILITY_MANAGER')
          ? (newUser.facilityId || null)
          : null
      }
      await userService.createUser(payload)
      setCreateSuccess(true)
      setTimeout(() => {
        setCreateSuccess(false)
        setIsCreateModalOpen(false)
        setNewUser({
          username: '',
          email: '',
          fullName: '',
          phone: '',
          password: '',
          roleName: 'STAFF' as RoleType,
          facilityId: ''
        })
        fetchUsers()
      }, 1200)
    } catch (err: any) {
      setFeedbackMessage(err?.response?.data?.message || 'Không tạo được tài khoản. Dữ liệu chưa được lưu; hãy kiểm tra kết nối và thử lại.')
    }
  }

  const filteredUsers = users.filter(u => {
    const matchQuery = (u.fullName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                       u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       u.username.toLowerCase().includes(searchQuery.toLowerCase())
    const userRole = u.role?.name || u.roleName
    const matchRole = roleFilter === 'ALL' || userRole === roleFilter
    const matchFacility = facilityFilter === 'ALL' || u.facilityId === facilityFilter
    return matchQuery && matchRole && matchFacility
  })

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const filteredLogs = logs.filter(l => {
    const userDisplay = l.userName || l.userFullName || l.userEmail || l.emailAttempted || l.username || ''
    const matchSearch = (l.description?.toLowerCase() || l.details?.toLowerCase() || '').includes(logSearch.toLowerCase()) ||
                        userDisplay.toLowerCase().includes(logSearch.toLowerCase()) ||
                        (l.userRole?.toLowerCase() || '').includes(logSearch.toLowerCase()) ||
                        (l.action?.toLowerCase() || '').includes(logSearch.toLowerCase()) ||
                        (l.ipAddress?.toLowerCase() || '').includes(logSearch.toLowerCase())
    const matchType = logTypeFilter === 'ALL' || l.logType === logTypeFilter || (logTypeFilter === 'SUPPORT_TICKET' && ((l.action && l.action.startsWith('SUPPORT_TICKET_')) || l.logType === 'SUPPORT_TICKET'))
    return matchSearch && matchType
  })

  const selectedFacilityObj = facilities.find(f => f.id === facilityFilter)
  const currentFacilityName = facilityFilter === 'ALL' ? 'Toàn hệ thống' : (selectedFacilityObj?.name || 'Cơ sở đã chọn')

  const summaryCards = [
    {
      label: 'Tài khoản đang hiển thị',
      value: filteredUsers.length,
      helper: `Dữ liệu thật DB (${currentFacilityName})`,
      icon: 'group',
      tone: 'cyan',
    },
    {
      label: 'Quản lý cơ sở',
      value: filteredUsers.filter(user => (user.role?.name || user.roleName) === 'FACILITY_MANAGER').length,
      helper: 'Vai trò Facility Manager',
      icon: 'badge',
      tone: 'teal',
    },
    {
      label: 'Nhân viên trạm',
      value: filteredUsers.filter(user => (user.role?.name || user.roleName) === 'STAFF').length,
      helper: 'Vai trò Staff tiếp đón',
      icon: 'badge',
      tone: 'indigo',
    },
    {
      label: 'Tài khoản không hoạt động',
      value: filteredUsers.filter(user => user.isActive === false).length,
      helper: 'Đang tạm khóa hoặc ngưng',
      icon: 'gpp_bad',
      tone: 'rose',
    },
  ]
  const summaryToneClasses: Record<string, string> = {
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    teal: 'bg-teal-50 text-teal-700 border-teal-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
  }

  const facilitySummaryCards = [
    {
      label: 'Tổng số chi nhánh',
      value: facilities.length,
      helper: 'Mạng lưới kho Boxora toàn quốc',
      icon: 'domain',
      tone: 'cyan',
    },
    {
      label: 'Đang hoạt động',
      value: facilities.filter(f => f.status === 'ACTIVE' || !f.status).length,
      helper: 'Chi nhánh mở cửa vận hành',
      icon: 'check_circle',
      tone: 'teal',
    },
    {
      label: 'Tạm ngưng / Bảo trì',
      value: facilities.filter(f => f.status === 'INACTIVE' || f.status === 'MAINTENANCE').length,
      helper: 'Đang sửa chữa hoặc tạm khóa',
      icon: 'engineering',
      tone: 'rose',
    },
    {
      label: 'Đã định vị GPS',
      value: facilities.filter(f => f.latitude != null && f.longitude != null).length,
      helper: 'Đã gắn tọa độ bản đồ',
      icon: 'location_on',
      tone: 'indigo',
    },
  ]

  const getRoleBadge = (roleName?: string) => {
    switch (roleName) {
      case 'ADMIN':
        return 'bg-rose-50 text-rose-700 border-rose-200'
      case 'FACILITY_MANAGER':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'BUSINESS_MANAGER':
        return 'bg-orange-50 text-orange-700 border-orange-200'
      case 'STAFF':
        return 'bg-amber-50 text-amber-800 border-amber-200'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const isFacilityScopedRole = (roleName?: string) => {
    const norm = (roleName || '').toUpperCase()
    return norm === 'STAFF' || norm === 'FACILITY_MANAGER'
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {feedbackMessage && (
        <div role="alert" className="fixed right-5 top-24 z-50 flex max-w-sm items-start gap-2 rounded-xl border border-rose-200 bg-white px-4 py-3 text-xs font-semibold text-rose-700 shadow-lg">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{feedbackMessage}</span>
          <button type="button" aria-label="Đóng thông báo" onClick={() => setFeedbackMessage(null)} className="ml-2 text-slate-400 hover:text-slate-700">×</button>
        </div>
      )}
      {(isFacilitiesRoute || activeTab === 'facilities') ? (
        /* ========================================================
           PHẦN 1: CẤU HÌNH CHI NHÁNH & CHÍNH SÁCH GIÁ
           URL: /portal/facilities
           ======================================================== */
        <div className="flex flex-col gap-6 w-full">
          {/* Top Banner - Chi Nhánh */}
          <div className="relative w-full overflow-hidden rounded-2xl bg-white p-5 sm:p-6 shadow-md border border-slate-200/90">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
               
                <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-headline">
                  {t('Cấu hình chi nhánh & cơ sở', 'Branch & Facility Configuration')}
                </h1>
                <p className="text-sm text-slate-600 mt-1 max-w-3xl">
                  {t(
                    'Thêm mới và quản lý thông tin chi nhánh, địa chỉ, vị trí GPS bản đồ và cấu hình sơ đồ mặt bằng các tầng kho bãi Boxora.',
                    'Add and manage branch details, addresses, GPS map coordinates, and floor layout configs.'
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    facilityService.getFacilities({ size: 100 })
                      .then((res) => {
                        if (res?.content) {
                          setFacilities(res.content)
                          setFeedbackMessage('Đã làm mới danh sách chi nhánh thành công.')
                          setTimeout(() => setFeedbackMessage(null), 3000)
                        }
                      })
                      .catch((err) => {
                        setFeedbackMessage('Không thể tải lại danh sách chi nhánh: ' + (err?.message || ''))
                      })
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px] text-cyan-700">refresh</span>
                  <span>{t('Làm mới', 'Refresh')}</span>
                </button>
              </div>
            </div>

            {/* KPI Cards Chi Nhánh */}
            <div className="mt-6 grid grid-cols-1 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2 xl:grid-cols-4">
              {facilitySummaryCards.map((card) => (
                <div key={card.label} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition-all shadow-xs hover:shadow-sm hover:border-slate-300">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${summaryToneClasses[card.tone]}`}>
                    <span className="material-symbols-outlined text-[21px]">{card.icon}</span>
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-slate-500" title={card.label}>{card.label}</div>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-mono text-2xl font-extrabold tabular-nums text-slate-900">{card.value}</span>
                      <span className="text-[11px] text-slate-500">{card.helper}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Panel chi tiết cấu hình chi nhánh */}
          <FacilityConfigurationPanel facilities={facilities} onFacilitiesChange={setFacilities} />
        </div>
      ) : (
        /* ========================================================
           PHẦN 2: PHÂN QUYỀN RBAC & USERS (Hoàn toàn độc lập)
           URL: /portal/admin
           ======================================================== */
        <div className="flex flex-col gap-6 w-full">
          {/* Top Banners tailored per Tab */}
          {activeTab === 'users' && (
            <div className="relative w-full overflow-hidden rounded-2xl bg-white p-5 sm:p-6 shadow-md border border-slate-200/90">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-2">
                    <span>Hệ thống phân quyền &amp; quản trị tài khoản</span>
                  </div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
                    Danh sách người dùng
                  </h1>
                  <p className="text-sm text-slate-600 mt-1 max-w-3xl">
                    Quản lý toàn bộ vòng đời tài khoản (tạo mới, cấp quyền, đổi vai trò, khóa, xóa) và gán cơ sở trực thuộc cho từng cá nhân.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                  <button 
                    type="button" 
                    onClick={() => fetchUsers(facilityFilter)}
                    disabled={isLoadingUsers}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Tải lại dữ liệu từ cơ sở dữ liệu"
                  >
                    <span className={`material-symbols-outlined text-[16px] text-blue-600 ${isLoadingUsers ? 'animate-spin' : ''}`}>
                      refresh
                    </span>
                    <span>{isLoadingUsers ? 'Đang tải...' : 'Làm mới'}</span>
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="stitch-btn-primary text-xs"
                  >
                    <span className="material-symbols-outlined text-[18px]">person_add</span>
                    <span>Cấp tài khoản mới</span>
                  </button>
                </div>
              </div>

              {/* Tóm tắt tài khoản: số liệu lấy từ danh sách đang hiển thị */}
              <div className="mt-6 grid grid-cols-1 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => (
                  <div key={card.label} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition-all shadow-xs hover:shadow-sm hover:border-slate-300">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${summaryToneClasses[card.tone]}`}>
                      <span className="material-symbols-outlined text-[21px]">{card.icon}</span>
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-500" title={card.label}>{card.label}</div>
                      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-2xl font-bold text-slate-900">{card.value}</span>
                        <span className="text-[11px] text-slate-500">{card.helper}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="relative w-full overflow-hidden rounded-2xl bg-white p-5 sm:p-6 shadow-md border border-slate-200/90">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-2">
                    <span className="material-symbols-outlined text-[14px]">security</span>
                    <span>Bảo mật &amp; Quản trị vai trò (RBAC)</span>
                  </div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
                    Ma trận phân quyền (RBAC)
                  </h1>
                  <p className="text-sm text-slate-600 mt-1 max-w-3xl">
                    Giao diện chuyên sâu để thiết lập và cấu hình quyền hạn truy cập dữ liệu, định nghĩa rõ vai trò nào được phép thực thi các chức năng nghiệp vụ trong hệ thống Boxora.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                  <button 
                    type="button" 
                    onClick={() => fetchRolesAndPermissions()}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Tải lại ma trận quyền"
                  >
                    <span className="material-symbols-outlined text-[16px] text-indigo-600">refresh</span>
                    <span>Làm mới ma trận</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="relative w-full overflow-hidden rounded-2xl bg-white p-5 sm:p-6 shadow-md border border-slate-200/90">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold mb-2">
                    <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                    <span>Truy vết an ninh &amp; kiểm toán</span>
                  </div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
                    Nhật ký kiểm toán (Audit logs)
                  </h1>
                  <p className="text-sm text-slate-600 mt-1 max-w-3xl">
                    Bảng theo dõi lịch sử đăng nhập và truy vết mọi thao tác thay đổi dữ liệu quan trọng trên hệ thống của tất cả người dùng, đảm bảo tính minh bạch và an toàn bảo mật.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                  <button 
                    type="button" 
                    onClick={() => fetchLogs()}
                    disabled={isLoadingLogs}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span className={`material-symbols-outlined text-[16px] text-blue-600 ${isLoadingLogs ? 'animate-spin' : ''}`}>
                      refresh
                    </span>
                    <span>{isLoadingLogs ? 'Đang tải...' : 'Làm mới'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

      {/* TAB 1: USERS */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-md">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                <input
                  type="text"
                  placeholder="Tìm theo tên, email, tên tài khoản..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Facility Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-mono uppercase font-semibold">Cơ sở:</span>
                <select
                  value={facilityFilter}
                  onChange={(e) => {
                    const newFac = e.target.value
                    setFacilityFilter(newFac)
                    if (outletContext?.setSelectedFacility) {
                      outletContext.setSelectedFacility(newFac)
                    }
                  }}
                  className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 font-medium focus:outline-none cursor-pointer max-w-[240px]"
                >
                  <option value="ALL">Toàn hệ thống ({facilities.length} cơ sở)</option>
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Role Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-semibold">Vai trò:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 font-medium focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Tất cả vai trò</option>
                  <option value="ADMIN">Quản trị viên (ADMIN)</option>
                  <option value="BUSINESS_MANAGER">Quản lý kinh doanh (BUSINESS_MANAGER)</option>
                  <option value="FACILITY_MANAGER">Quản lý cơ sở (FACILITY_MANAGER)</option>
                  <option value="STAFF">Nhân viên trực ca (STAFF)</option>
                  <option value="CUSTOMER">Khách hàng (CUSTOMER)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 bg-slate-50/80">
                  <th className="py-3 px-4 font-semibold">Người dùng</th>
                  <th className="py-3 px-4 font-semibold">Tên đăng nhập</th>
                  <th className="py-3 px-4 font-semibold">Vai trò</th>
                  <th className="py-3 px-4 font-semibold">Cơ sở trực thuộc</th>
                  <th className="py-3 px-4 font-semibold">Trạng thái</th>
                  <th className="py-3 px-4 font-semibold">Ngày tạo</th>
                  <th className="py-3 px-4 font-semibold text-right">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs uppercase">
                          {user.fullName ? user.fullName.substring(0, 2) : user.username.substring(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{user.fullName || 'Chưa cập nhật tên'}</div>
                          <div className="text-slate-500 text-[11px]">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{user.username}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border ${getRoleBadge(user.role?.name || (user.roleName as string))}`}>
                        {getRoleMeta(user.role?.name || (user.roleName as string)).title}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {(() => {
                        const rName = (user.role?.name || user.roleName || '').toUpperCase()
                        if (rName === 'CUSTOMER') {
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              <span className="material-symbols-outlined text-[13px] text-slate-400">person</span>
                              Không áp dụng
                            </span>
                          )
                        }
                        if (rName === 'ADMIN' || rName === 'SYSTEM_ADMIN' || rName === 'BUSINESS_MANAGER') {
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <span className="material-symbols-outlined text-[13px] text-indigo-500">public</span>
                              Toàn hệ thống
                            </span>
                          )
                        }
                        if (user.facilityName) {
                          return (
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-800 text-xs flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px] text-blue-600">location_on</span>
                                {user.facilityName}
                              </span>
                              {user.facilityCode && (
                                <span className="text-[10px] text-slate-500 font-mono ml-4">
                                  #{user.facilityCode}
                                </span>
                              )}
                            </div>
                          )
                        }
                        return (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="material-symbols-outlined text-[13px] text-amber-500">warning</span>
                            Chưa phân cơ sở
                          </span>
                        )
                      })()}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        user.isActive !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.isActive !== false ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        {user.isActive !== false ? 'Đang hoạt động' : 'Tạm khóa'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('vi-VN') : '—'}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isFacilityScopedRole(user.role?.name || (user.roleName as string)) && (
                          <button
                            type="button"
                            onClick={() => {
                              setScopingUser(user)
                              setIsScopingModalOpen(true)
                            }}
                            title="Gán cơ sở trực thuộc cho tài khoản"
                            className="text-blue-700 hover:text-blue-900 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[15px]">domain_verification</span>
                            <span>Phân công</span>
                          </button>
                        )}
                        
                        <button
                          type="button"
                          onClick={() => {
                            setRoleEditUser(user)
                            setSelectedNewRole((user.role?.name || user.roleName || 'STAFF') as RoleType)
                            setEditFacilityId(user.facilityId || '')
                          }}
                          title="Chỉnh sửa vai trò phân quyền cho tài khoản"
                          className="text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">manage_accounts</span>
                          <span>Đổi vai trò</span>
                        </button>
                        <button
                          type="button"
                          disabled={userActionLoadingId === user.id}
                          onClick={async () => {
                            const nextIsActive = user.isActive === false
                            setUserActionLoadingId(user.id)
                            try {
                              await userService.toggleActive(user.id)
                              setUsers(current => current.map(u => u.id === user.id ? { ...u, isActive: nextIsActive } : u))
                            } catch {
                              setFeedbackMessage('Không cập nhật được trạng thái tài khoản. Trạng thái trên hệ thống chưa thay đổi.')
                            } finally {
                              setUserActionLoadingId(null)
                            }
                          }}
                          className="text-slate-500 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          {userActionLoadingId === user.id ? 'Đang lưu...' : user.isActive !== false ? 'Khóa' : 'Kích hoạt'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredUsers.length === 0 && (
              <div className="p-8 text-center flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-slate-300 text-[48px] mb-2">person_search</span>
                <h4 className="text-sm font-bold text-slate-700">Không tìm thấy tài khoản nào</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Không có tài khoản người dùng nào khớp với bộ lọc cơ sở ({currentFacilityName}) hoặc vai trò ({roleFilter}).
                </p>
              </div>
            )}

            {/* Pagination Controls - Centered */}
            {filteredUsers.length > 0 && (
              <div className="relative flex flex-col md:flex-row items-center justify-between gap-4 px-4 py-3.5 border-t border-slate-200 bg-slate-50/70 text-xs text-slate-600">
                <div className="text-slate-600 text-center md:text-left">
                  Hiển thị <span className="font-semibold text-slate-900 font-mono">{(currentPage - 1) * pageSize + 1}</span> - <span className="font-semibold text-slate-900 font-mono">{Math.min(currentPage * pageSize, filteredUsers.length)}</span> trong tổng số <span className="font-semibold text-slate-900 font-mono">{filteredUsers.length}</span> tài khoản
                </div>

                <div className="flex items-center justify-center gap-1 md:absolute md:left-1/2 md:-translate-x-1/2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold transition-colors cursor-pointer flex items-center gap-0.5"
                    title="Trang đầu"
                  >
                    <span className="material-symbols-outlined text-[16px]">first_page</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold transition-colors cursor-pointer flex items-center gap-0.5"
                    title="Trang trước"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                    <span className="hidden sm:inline">Trước</span>
                  </button>

                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                      .reduce<(number | string)[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                          acc.push('...')
                        }
                        acc.push(p)
                        return acc
                      }, [])
                      .map((p, idx) => typeof p === 'string' ? (
                        <span key={`dots-${idx}`} className="px-1 text-slate-400">...</span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`w-7 h-7 rounded-md text-xs font-mono font-bold transition-colors cursor-pointer flex items-center justify-center ${
                            p === currentPage
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold transition-colors cursor-pointer flex items-center gap-0.5"
                    title="Trang sau"
                  >
                    <span className="hidden sm:inline">Sau</span>
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold transition-colors cursor-pointer flex items-center gap-0.5"
                    title="Trang cuối"
                  >
                    <span className="material-symbols-outlined text-[16px]">last_page</span>
                  </button>
                </div>

                <div className="hidden md:block w-28 pointer-events-none" aria-hidden="true" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ROLES & PERMISSION MATRIX */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {isSampleRoleData && (
            <div className="lg:col-span-12 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              Đang hiển thị vai trò và quyền minh họa vì chưa tải được dữ liệu hệ thống. Không thể lưu thay đổi ở chế độ này.
            </div>
          )}
          {/* Roles list (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/90 p-5 shadow-md">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
              <span>Danh Sách Vai Trò</span>
              <span className="text-xs text-slate-500 font-mono font-medium">{roles.length} vai trò</span>
            </h3>
            <div className="space-y-2.5">
              {roles.map((r) => {
                const roleMeta = getRoleMeta(r.name as string, r.description)
                return (
                  <div
                    key={r.id}
                    onClick={() => selectRole(r)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selectedRole?.id === r.id
                        ? 'border-orange-500 bg-orange-50/60 shadow-xs ring-1 ring-orange-500/30'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold text-xs text-slate-900 truncate">{roleMeta.title}</span>
                        <span className="font-mono text-[10px] text-slate-400 shrink-0">({r.name})</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold ${getRoleBadge(r.name as string)}`}>
                        HOẠT ĐỘNG
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{roleMeta.description}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Permission Matrix for selected role (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/90 p-5 shadow-md flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-4 gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Phân Quyền Cho Vai Trò:{' '}
                    <span className="text-orange-600 font-bold">
                      {selectedRole ? getRoleMeta(selectedRole.name, selectedRole.description).title : ''}
                    </span>
                    {selectedRole && <span className="text-xs text-slate-400 font-mono ml-1.5 font-normal">({selectedRole.name})</span>}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Các quyền hạn chức năng mà vai trò này được phép thực thi trong toàn hệ thống.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    {assignedPermIds.length} / {permissions.length} quyền
                  </div>
                </div>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">search</span>
                  <input
                    type="text"
                    placeholder="Tìm kiếm quyền theo mã hoặc tên..."
                    value={permSearch}
                    onChange={(e) => setPermSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPermFilterMode('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      permFilterMode === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Tất cả ({permissions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPermFilterMode('assigned')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      permFilterMode === 'assigned'
                        ? 'bg-orange-600 text-white'
                        : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
                    }`}
                  >
                    Đã tick ({assignedPermIds.length})
                  </button>
                </div>
              </div>

              {roleSaveSuccess && (
                <div className="p-3 mb-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>Đã lưu ma trận phân quyền thành công qua RolePermission API!</span>
                </div>
              )}
              {roleSaveError && (
                <div role="alert" className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{roleSaveError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-2">
                {filteredPermissions.map((p) => {
                  const isChecked = assignedPermIds.includes(p.id)
                  const permMeta = formatPermission(p)
                  return (
                    <label
                      key={p.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'border-slate-800 bg-slate-50/80 shadow-2xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePermission(p.id)}
                        className="mt-1 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                      />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs text-slate-900">{permMeta.title}</span>
                          <span className="text-[10px] font-mono font-medium text-slate-500 px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200">
                            {permMeta.code}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{permMeta.description}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="pt-4 mt-6 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Lưu ý: Thay đổi phân quyền sẽ có hiệu lực ngay trong phiên đăng nhập tiếp theo.
              </span>
              <button
                type="button"
                onClick={handleSaveRolePermissions}
                disabled={roleSaving || isSampleRoleData}
                title={isSampleRoleData ? 'Không thể lưu dữ liệu vai trò minh họa' : undefined}
                className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                <span>{roleSaving ? 'Đang lưu...' : 'Lưu Thay Đổi Quyền'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ACTIVITY & AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-md">
          {logsError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">Không tải được nhật ký hệ thống. Danh sách hiện không có dữ liệu mới.</p>}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                <input
                  type="text"
                  placeholder="Tìm theo hành vi, người dùng, IP..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const nextMode = !isLoginHistoryMode
                  setIsLoginHistoryMode(nextMode)
                  void fetchLogs(nextMode)
                }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  isLoginHistoryMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {isLoginHistoryMode ? 'Chỉ lịch sử Login' : 'Tất cả thao tác'}
              </button>

              <select
                value={logTypeFilter}
                onChange={(e) => setLogTypeFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 font-medium focus:outline-none"
              >
                <option value="ALL">Tất cả loại log</option>
                <option value="SUPPORT_TICKET">SUPPORT_TICKET (Sự cố &amp; Hỗ trợ)</option>
                <option value="AUTH">AUTH (Đăng nhập / Token)</option>
                <option value="SECURITY">SECURITY (Phân quyền RBAC)</option>
                <option value="HANDOVER">HANDOVER (Bàn giao)</option>
                <option value="POLICY">POLICY (Chính sách giá)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-mono uppercase tracking-wider bg-slate-50">
                  <th className="py-3 px-4 font-semibold">Thời Gian</th>
                  <th className="py-3 px-4 font-semibold">Tài Khoản</th>
                  <th className="py-3 px-4 font-semibold">Vai Trò</th>
                  <th className="py-3 px-4 font-semibold">Loại Log / Hành Vi</th>
                  <th className="py-3 px-4 font-semibold">Chi Tiết Thao Tác</th>
                  <th className="py-3 px-4 font-semibold">Địa Chỉ IP</th>
                  <th className="py-3 px-4 font-semibold">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const accountName = log.userName || log.userFullName || log.userEmail || log.emailAttempted || log.username || 'Hệ thống'
                  const emailSub = (log.userEmail || log.emailAttempted) && (log.userName || log.userFullName) ? (log.userEmail || log.emailAttempted) : null

                  const getRoleBadgeStyle = (r?: string) => {
                    switch (r) {
                      case 'ADMIN': return 'bg-rose-50 text-rose-700 border-rose-200'
                      case 'BUSINESS_MANAGER': return 'bg-slate-100 text-slate-800 border-slate-300'
                      case 'FACILITY_MANAGER': return 'bg-blue-50 text-blue-700 border-blue-200'
                      case 'STAFF': return 'bg-amber-50 text-amber-800 border-amber-200'
                      case 'CUSTOMER': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      default: return 'bg-slate-50 text-slate-500 border-slate-200'
                    }
                  }

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">{log.createdAt}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-slate-900 text-xs">{accountName}</span>
                          {emailSub && (
                            <span className="text-[10px] text-slate-400 font-mono">{emailSub}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRoleBadgeStyle(log.userRole)}`}>
                          {log.userRole ? (ROLE_VIETNAMESE_MAP[log.userRole]?.title || log.userRole) : 'HỆ THỐNG'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold font-mono">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 text-xs">{log.description || log.details || log.action}</td>
                      <td className="py-3 px-4 text-slate-400 font-mono">{log.ipAddress || '—'}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {log.status === 'SUCCESS' ? '✓ Thành công' : '✕ Thất bại'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {filteredLogs.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center font-sans text-slate-500">{logsError ? 'Không thể hiển thị nhật ký khi dịch vụ chưa phản hồi.' : 'Không có nhật ký phù hợp với bộ lọc.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls - Centered */}
          {logsTotalPages > 1 && (
            <div className="relative px-4 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 text-center md:text-left">
                Hiển thị trang <strong>{logsPage + 1}</strong> / <strong>{logsTotalPages}</strong> (Tổng số: {logsTotalElements} nhật ký)
              </span>
              <div className="flex items-center justify-center gap-1.5 md:absolute md:left-1/2 md:-translate-x-1/2">
                <button
                  type="button"
                  disabled={logsPage === 0}
                  onClick={() => {
                    const next = Math.max(0, logsPage - 1)
                    setLogsPage(next)
                    fetchLogs(isLoginHistoryMode, next)
                  }}
                  className="px-2.5 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-medium"
                >
                  ‹ Trước
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, logsTotalPages) }, (_, i) => {
                    let pageNum = i
                    if (logsTotalPages > 5) {
                      if (logsPage > 2) {
                        pageNum = Math.min(logsPage - 2 + i, logsTotalPages - 1)
                      }
                    }
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => {
                          setLogsPage(pageNum)
                          fetchLogs(isLoginHistoryMode, pageNum)
                        }}
                        className={logsPage === pageNum ? "w-7 h-7 rounded text-xs font-semibold flex items-center justify-center transition-colors bg-blue-600 text-white" : "w-7 h-7 rounded text-xs font-semibold flex items-center justify-center transition-colors bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"}
                      >
                        {pageNum + 1}
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  disabled={logsPage >= logsTotalPages - 1}
                  onClick={() => {
                    const next = Math.min(logsTotalPages - 1, logsPage + 1)
                    setLogsPage(next)
                    fetchLogs(isLoginHistoryMode, next)
                  }}
                  className="px-2.5 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-medium"
                >
                  Sau ›
                </button>
              </div>

              <div className="hidden md:block w-28 pointer-events-none" aria-hidden="true" />
            </div>
          )}
        </div>
      )}
        </div>
      )}

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Cấp Tài Khoản Hệ Thống Mới</h3>
              <button 
                type="button" 
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {createSuccess ? (
              <div className="py-6 text-center space-y-2">
                <span className="material-symbols-outlined text-emerald-600 text-[48px]">check_circle</span>
                <h4 className="text-sm font-bold text-slate-900">Đã cấp tài khoản thành công!</h4>
                <p className="text-xs text-slate-500">Thông tin đăng nhập đã được ghi nhận vào cơ sở dữ liệu Boxora.</p>
              </div>
            ) : (
              <form onSubmit={handleCreateUserSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Họ và Tên</label>
                  <input
                    type="text"
                    value={newUser.fullName}
                    onChange={(e) => setNewUser({...newUser, fullName: e.target.value})}
                    placeholder="Nguyễn Văn B"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
                    placeholder="0911223344"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email liên hệ</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    placeholder="vanb@boxora.com"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mật khẩu ban đầu</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phân quyền vai trò</label>
                  <select
                    value={newUser.roleName}
                    onChange={(e: any) => setNewUser({...newUser, roleName: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 font-medium focus:outline-none"
                  >
                    <option value="CUSTOMER">Storage Customer (Khách hàng thuê kho)</option>
                    <option value="STAFF">Facility Staff (Nhân viên vận hành quầy)</option>
                    <option value="FACILITY_MANAGER">Facility Manager (Quản lý cơ sở)</option>
                    <option value="BUSINESS_MANAGER">Business Operations Manager (Giám đốc kinh doanh)</option>
                    <option value="ADMIN">System Administrator (Quản trị viên hệ thống IT)</option>
                  </select>
                </div>

                {(newUser.roleName === 'STAFF' || newUser.roleName === 'FACILITY_MANAGER') && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Cơ sở trực thuộc</label>
                    <select
                      value={newUser.facilityId}
                      onChange={(e) => setNewUser({...newUser, facilityId: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 font-medium focus:outline-none cursor-pointer"
                    >
                      <option value="">Chọn cơ sở trực thuộc...</option>
                      {facilities.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-all"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all shadow-sm"
                  >
                    Tạo Tài Khoản
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      
      {/* Modal Đổi Vai Trò Phân Quyền */}
      {roleEditUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700">
                  <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                </span>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Đổi vai trò người dùng</h3>
                  <p className="text-xs text-slate-500">Cập nhật phân quyền theo chuẩn doanh nghiệp Boxora</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setRoleEditUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleRoleEditSubmit} className="p-6 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-500">Tài khoản được chọn</div>
                <div className="font-semibold text-slate-800 text-sm mt-0.5">
                  {roleEditUser.fullName || roleEditUser.username}
                </div>
                <div className="text-xs font-mono text-slate-500">{roleEditUser.email}</div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Vai trò hiện tại:</span>
                  <span className="font-semibold text-slate-700">
                    {getRoleMeta(roleEditUser.role?.name || roleEditUser.roleName).title}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Chọn vai trò mới:
                </label>
                <select
                  value={selectedNewRole}
                  onChange={(e) => setSelectedNewRole(e.target.value as RoleType)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm cursor-pointer"
                >
                  <option value="CUSTOMER">Storage Customer (Khách hàng thuê kho)</option>
                  <option value="STAFF">Facility Staff (Nhân viên vận hành quầy)</option>
                  <option value="FACILITY_MANAGER">Facility Manager (Quản lý cơ sở)</option>
                  <option value="BUSINESS_MANAGER">Business Operations Manager (Giám đốc kinh doanh)</option>
                  <option value="ADMIN">System Administrator (Quản trị viên hệ thống IT)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  {getRoleMeta(selectedNewRole).description}
                </p>
              </div>

              {(selectedNewRole === 'STAFF' || selectedNewRole === 'FACILITY_MANAGER') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Gán chi nhánh / cơ sở:
                  </label>
                  <select
                    value={editFacilityId}
                    onChange={(e) => setEditFacilityId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm cursor-pointer"
                  >
                    <option value="">-- Chưa gán cơ sở nào --</option>
                    {facilities.map(f => (
                      <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Nhân viên & Quản lý cơ sở cần được liên kết với một cơ sở cụ thể để vận hành.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRoleEditUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isRoleEditing}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  {isRoleEditing ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">check</span>
                      <span>Lưu thay đổi</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Facility Scoping Modal */}
      <FacilityScopingModal
        isOpen={isScopingModalOpen}
        onClose={() => {
          setIsScopingModalOpen(false)
          setScopingUser(null)
        }}
        initialUser={scopingUser ? {
          id: scopingUser.id,
          fullName: scopingUser.fullName || scopingUser.username || 'Người dùng',
          email: scopingUser.email,
          roleName: (scopingUser.role?.name || scopingUser.roleName || 'STAFF') as string,
          facilityId: scopingUser.facilityId
        } : null}
        onSave={async (data) => {
          if (!scopingUser) return
          await userService.updateUser(scopingUser.id, { facilityId: data.facilityId })
          await fetchUsers(facilityFilter)
        }}
      />
    </div>
  )
}
