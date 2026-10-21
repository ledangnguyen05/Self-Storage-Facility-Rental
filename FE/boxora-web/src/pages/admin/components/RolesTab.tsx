import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Alert, Button, Card, CardHeader, EmptyState, Skeleton, cn } from '@/components/ui'
import { getRoleMeta } from '@/constants/statusMeta'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { permissionService } from '@/services/permissionService'
import { roleService } from '@/services/roleService'
import { describeRole } from '../lib/permissionGroups'
import { PermissionMatrix } from './PermissionMatrix'

/** Roles on the left, the permission matrix of the selected role on the right. Roles and permissions load in parallel. */
export function RolesTab() {
  const { data, error, isLoading, reload } = useAsyncData(async () => {
    const [roles, permissions] = await Promise.all([roleService.getAll({ size: 50 }), permissionService.getAll({ size: 100 })])
    return { roles: roles?.content ?? [], permissions: permissions?.content ?? [] }
  }, [])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (error) {
    return (
      <Alert
        tone="danger"
        title="Không tải được vai trò và quyền hạn"
        action={
          <Button size="sm" variant="secondary" onClick={() => void reload()}>
            Thử lại
          </Button>
        }
      >
        {getApiErrorMessage(error)}
      </Alert>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-busy="true">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full lg:col-span-2" />
      </div>
    )
  }

  if (data.roles.length === 0) {
    return <EmptyState icon={ShieldCheck} title="Chưa có vai trò nào" description="Vai trò được tạo cùng dữ liệu khởi tạo của hệ thống." />
  }

  const selectedRole = data.roles.find(role => role.id === selectedId) ?? data.roles[0]

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader divider title="Vai trò" description={`${data.roles.length} vai trò trong hệ thống`} />
        <ul className="flex flex-col gap-1 p-2">
          {data.roles.map(role => {
            const meta = getRoleMeta(role.name)
            const active = role.id === selectedRole.id
            return (
              <li key={role.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedId(role.id)}
                  className={cn(
                    'flex w-full flex-col gap-0.5 rounded-md border px-3 py-2.5 text-left transition-colors',
                    active ? 'border-accent-line bg-accent-subtle' : 'border-transparent hover:bg-surface-2',
                  )}
                >
                  <span className={cn('text-sm font-medium', active ? 'text-accent-text' : 'text-fg')}>{meta.label}</span>
                  <span className="text-dense text-fg-muted">{describeRole(role) || 'Chưa có mô tả'}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </Card>
      <div className="lg:col-span-2">
        <PermissionMatrix key={selectedRole.id} role={selectedRole} permissions={data.permissions} />
      </div>
    </div>
  )
}
