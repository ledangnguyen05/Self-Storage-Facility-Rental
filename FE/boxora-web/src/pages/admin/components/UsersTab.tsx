import { useState } from 'react'
import { Building2, Ellipsis, Lock, LockOpen, Pencil, RefreshCw, ShieldCheck, UserCheck, UserSearch, Users } from 'lucide-react'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  IconButton,
  Modal,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableError,
  TableHead,
  TableHeader,
  TableLoading,
  TableRow,
  useToast,
} from '@/components/ui'
import { ALL_FACILITIES, useDashboardContext } from '@/components/layout/dashboardContext'
import { ROLE_OPTIONS, getRoleMeta } from '@/constants/statusMeta'
import { useAuth } from '@/context/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { usePagination } from '@/hooks/usePagination'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatDate, formatNumber } from '@/lib/format'
import { FacilityScopingModal } from '@/components/modals/FacilityScopingModal'
import { roleService } from '@/services/roleService'
import { userService } from '@/services/userService'
import type { User } from '@/types'
import { getUserRoleName, roleNeedsFacility } from '../lib/userForm'
import { UserFormModal } from './UserFormModal'

export interface UsersTabProps {
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
}

type StatusFilter = '' | 'active' | 'inactive'

/** The backend page the table is filled from. */
const USER_LIMIT = 100
const COLUMN_COUNT = 7

const ROLE_FILTER_OPTIONS = [{ value: '', label: 'Mọi vai trò' }, ...ROLE_OPTIONS]
const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Mọi trạng thái' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'inactive', label: 'Tạm khóa' },
]

function FacilityCell({ user }: { user: User }) {
  const roleName = getUserRoleName(user)
  if (user.facilityName) {
    return (
      <div>
        <div className="text-fg">{user.facilityName}</div>
        {user.facilityCode ? <div className="font-mono text-xs text-fg-subtle">{user.facilityCode}</div> : null}
      </div>
    )
  }
  if (roleName === 'ADMIN' || roleName === 'BUSINESS_MANAGER') return <span className="text-fg-muted">Toàn hệ thống</span>
  if (roleNeedsFacility(roleName)) return <Badge tone="warning">Chưa phân công</Badge>
  return <span className="text-fg-subtle">—</span>
}

/** Account list with server-side search and filters, plus create, edit, assign-facility and lock actions. */
export function UsersTab({ createOpen, onCreateOpenChange }: UsersTabProps) {
  const toast = useToast()
  const { user: currentUser } = useAuth()
  const { facilities, selectedFacility, setSelectedFacility } = useDashboardContext()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const debouncedSearch = useDebouncedValue(search.trim())
  const facilityFilter = selectedFacility === ALL_FACILITIES ? '' : selectedFacility

  const users = useAsyncData(
    (signal) =>
      userService.getAllUsers(
        {
          role: roleFilter || undefined,
          facilityId: facilityFilter || undefined,
          search: debouncedSearch || undefined,
          isActive: statusFilter === '' ? undefined : statusFilter === 'active',
          size: USER_LIMIT,
        },
        { signal },
      ),
    [roleFilter, facilityFilter, debouncedSearch, statusFilter],
  )
  // KPI strip: counted by the server for the same filters, so it stays right beyond the first page.
  const summary = useAsyncData(
    (signal) =>
      userService.getSummary(
        {
          role: roleFilter || undefined,
          facilityId: facilityFilter || undefined,
          search: debouncedSearch || undefined,
          isActive: statusFilter === '' ? undefined : statusFilter === 'active',
        },
        { signal },
      ),
    [roleFilter, facilityFilter, debouncedSearch, statusFilter],
  )
  const roles = useAsyncData(async () => (await roleService.getAll({ size: 50 }))?.content ?? [], [])

  const reloadAll = async () => {
    await Promise.all([users.reload(), summary.reload()])
  }

  const rows = users.data?.data ?? []
  const pager = usePagination({ items: rows })
  const pageRows = pager.slice(rows)
  const hasFilters = Boolean(search || roleFilter || facilityFilter || statusFilter)

  const [editing, setEditing] = useState<User | null>(null)
  const [scoping, setScoping] = useState<User | null>(null)
  const [lockTarget, setLockTarget] = useState<User | null>(null)

  const clearFilters = () => {
    setSearch('')
    setRoleFilter('')
    setStatusFilter('')
    setSelectedFacility(ALL_FACILITIES)
    pager.reset()
  }

  const toggleActive = async (user: User) => {
    const willActivate = user.isActive === false
    try {
      await userService.toggleActive(user.id)
      toast.success(willActivate ? 'Đã kích hoạt tài khoản' : 'Đã khóa tài khoản', user.fullName || user.username)
      await reloadAll()
    } catch (err) {
      toast.error('Không thể đổi trạng thái tài khoản', getApiErrorMessage(err))
    }
  }

  const byRole = summary.data?.byRole ?? {}
  const kpiLoading = summary.isLoading && !summary.data
  const kpiValue = (value: number | undefined) => (summary.error && !summary.data ? '—' : formatNumber(value ?? 0))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tài khoản" value={kpiValue(summary.data?.total)} icon={Users} loading={kpiLoading} hint={hasFilters ? 'Theo bộ lọc hiện tại' : 'Toàn hệ thống'} />
        <StatCard label="Quản lý cơ sở" value={kpiValue(byRole.FACILITY_MANAGER)} icon={ShieldCheck} tone="info" loading={kpiLoading} />
        <StatCard label="Nhân viên" value={kpiValue(byRole.STAFF)} icon={UserCheck} tone="success" loading={kpiLoading} />
        <StatCard label="Tạm khóa" value={kpiValue(summary.data?.inactive)} icon={Lock} tone="danger" loading={kpiLoading} />
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <SearchInput
            value={search}
            onValueChange={value => {
              setSearch(value)
              pager.reset()
            }}
            placeholder="Tìm theo tên, email, tên đăng nhập…"
            className="lg:w-80"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Lọc theo cơ sở"
              className="w-56"
              value={selectedFacility}
              onChange={event => {
                setSelectedFacility(event.target.value)
                pager.reset()
              }}
              options={[{ value: ALL_FACILITIES, label: 'Mọi cơ sở' }, ...facilities.map(facility => ({ value: facility.id, label: facility.name }))]}
            />
            <Select
              aria-label="Lọc theo vai trò"
              className="w-44"
              value={roleFilter}
              onChange={event => {
                setRoleFilter(event.target.value)
                pager.reset()
              }}
              options={ROLE_FILTER_OPTIONS}
            />
            <Select
              aria-label="Lọc theo trạng thái"
              className="w-44"
              value={statusFilter}
              onChange={event => {
                setStatusFilter(event.target.value as StatusFilter)
                pager.reset()
              }}
              options={STATUS_FILTER_OPTIONS}
            />
            {hasFilters ? (
              <Button variant="link" size="sm" onClick={clearFilters}>
                Xóa bộ lọc
              </Button>
            ) : null}
          </div>
          <Button
            variant="secondary"
            leftIcon={RefreshCw}
            loading={users.isRefreshing || summary.isRefreshing}
            onClick={() => void reloadAll()}
            className="lg:ml-auto"
          >
            Làm mới
          </Button>
        </div>

        {rows.length >= USER_LIMIT ? (
          <div className="border-b border-line p-4">
            <Alert tone="info">Chỉ hiển thị {USER_LIMIT} tài khoản đầu tiên. Dùng tìm kiếm hoặc bộ lọc để thu hẹp danh sách.</Alert>
          </div>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Người dùng</TableHead>
              <TableHead>Tên đăng nhập</TableHead>
              <TableHead>Vai trò</TableHead>
              <TableHead>Cơ sở</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead align="right">
                <span className="sr-only">Thao tác</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.isLoading ? (
              <TableLoading colSpan={COLUMN_COUNT} rows={6} />
            ) : users.error ? (
              <TableError colSpan={COLUMN_COUNT} message={getApiErrorMessage(users.error)} onRetry={() => void users.reload()} />
            ) : pageRows.length === 0 ? (
              <TableEmpty
                colSpan={COLUMN_COUNT}
                icon={UserSearch}
                title={hasFilters ? 'Không có tài khoản khớp bộ lọc' : 'Chưa có tài khoản nào'}
                description={hasFilters ? 'Thử đổi từ khóa hoặc bỏ bớt bộ lọc.' : 'Tạo tài khoản đầu tiên để bắt đầu.'}
                action={
                  hasFilters ? (
                    <Button variant="secondary" size="sm" onClick={clearFilters}>
                      Xóa bộ lọc
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => onCreateOpenChange(true)}>
                      Tạo tài khoản
                    </Button>
                  )
                }
              />
            ) : (
              pageRows.map(user => {
                const roleMeta = getRoleMeta(getUserRoleName(user))
                const isActive = user.isActive !== false
                const isSelf = user.id === currentUser?.id
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={user.fullName || user.username} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-fg">{user.fullName || 'Chưa cập nhật tên'}</div>
                          <div className="truncate text-xs text-fg-subtle">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-dense text-fg-muted">{user.username}</TableCell>
                    <TableCell>
                      <Badge tone={roleMeta.tone}>{roleMeta.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <FacilityCell user={user} />
                    </TableCell>
                    <TableCell>
                      <Badge tone={isActive ? 'success' : 'neutral'} dot>
                        {isActive ? 'Đang hoạt động' : 'Tạm khóa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-fg-muted">{formatDate(user.createdAt)}</TableCell>
                    <TableCell align="right">
                      <DropdownMenu trigger={<IconButton icon={Ellipsis} size="sm" aria-label={`Thao tác với ${user.fullName || user.username}`} />}>
                        <DropdownMenuItem icon={Pencil} onSelect={() => setEditing(user)}>
                          Chỉnh sửa
                        </DropdownMenuItem>
                        {roleNeedsFacility(getUserRoleName(user)) ? (
                          <DropdownMenuItem icon={Building2} onSelect={() => setScoping(user)}>
                            Gán cơ sở trực thuộc
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        {isActive ? (
                          <DropdownMenuItem icon={Lock} tone="danger" disabled={isSelf} description={isSelf ? 'Không thể khóa chính bạn' : undefined} onSelect={() => setLockTarget(user)}>
                            Khóa tài khoản
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem icon={LockOpen} onSelect={() => void toggleActive(user)}>
                            Kích hoạt lại
                          </DropdownMenuItem>
                        )}
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {rows.length > 0 ? (
          <div className="border-t border-line px-4 py-3">
            <Pagination page={pager.page} pageCount={pager.pageCount} total={pager.total} pageSize={pager.pageSize} onPageChange={pager.setPage} onPageSizeChange={pager.setPageSize} />
          </div>
        ) : null}

        {createOpen && roles.data ? (
          <UserFormModal mode="create" roles={roles.data} facilities={facilities} onClose={() => onCreateOpenChange(false)} onSaved={() => void reloadAll()} />
        ) : null}
        {editing && roles.data ? <UserFormModal mode="edit" user={editing} roles={roles.data} facilities={facilities} onClose={() => setEditing(null)} onSaved={() => void reloadAll()} /> : null}
        {(createOpen || editing) && !roles.data ? (
          <Modal
            open
            size="sm"
            title="Đang chuẩn bị biểu mẫu"
            onClose={() => {
              onCreateOpenChange(false)
              setEditing(null)
            }}
            footer={
              <Button
                variant="secondary"
                onClick={() => {
                  onCreateOpenChange(false)
                  setEditing(null)
                }}
              >
                Đóng
              </Button>
            }
          >
            {roles.error ? (
              <Alert
                tone="danger"
                title="Không tải được danh sách vai trò"
                action={
                  <Button size="sm" variant="secondary" onClick={() => void roles.reload()}>
                    Thử lại
                  </Button>
                }
              >
                {getApiErrorMessage(roles.error)}
              </Alert>
            ) : (
              <Skeleton className="h-16 w-full" />
            )}
          </Modal>
        ) : null}

        <FacilityScopingModal
          isOpen={scoping !== null}
          onClose={() => setScoping(null)}
          initialUser={
            scoping
              ? {
                  id: scoping.id,
                  fullName: scoping.fullName || scoping.username,
                  email: scoping.email,
                  roleName: getUserRoleName(scoping) ?? 'STAFF',
                  facilityId: scoping.facilityId,
                }
              : null
          }
          onSave={async data => {
            if (!scoping) return
            // FacilityScopingModal shows the success toast itself; a second one here made every save say it twice.
            await userService.updateUser(scoping.id, { facilityId: data.facilityId })
            await reloadAll()
          }}
        />

        <ConfirmDialog
          open={lockTarget !== null}
          onClose={() => setLockTarget(null)}
          tone="danger"
          title={`Khóa tài khoản ${lockTarget?.fullName || lockTarget?.username || ''}?`}
          description="Người này sẽ không đăng nhập được cho đến khi bạn kích hoạt lại."
          confirmLabel="Khóa tài khoản"
          onConfirm={async () => {
            if (lockTarget) await toggleActive(lockTarget)
            setLockTarget(null)
          }}
        />
      </Card>
    </div>
  )
}
