import { useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardContent, CardFooter, CardHeader, Checkbox, ConfirmDialog, Skeleton, useToast } from '@/components/ui'
import { getRoleMeta } from '@/constants/statusMeta'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { roleService } from '@/services/roleService'
import type { Role } from '@/types'
import { describePermission, groupPermissions, type PermissionRecord } from '../lib/permissionGroups'

export interface PermissionMatrixProps {
  role: Role
  permissions: readonly PermissionRecord[]
}

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => a.size === b.size && [...a].every(id => b.has(id))

/**
 * Permission checkboxes of one role. The server's assignment is loaded first; nothing is editable
 * (or savable) until it is, so a failed load can never overwrite a real role with guessed permissions.
 * Mount it with `key={role.id}` so each role starts from its own state.
 */
export function PermissionMatrix({ role, permissions }: PermissionMatrixProps) {
  const toast = useToast()
  const assigned = useAsyncData(async () => ((await roleService.getPermissionsByRoleId(role.id)) ?? []).map(item => item.permissionId), [role.id])
  const serverIds = useMemo(() => new Set(assigned.data ?? []), [assigned.data])

  /** Local edits; null means "as on the server". */
  const [edited, setEdited] = useState<Set<string> | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmRemoval, setConfirmRemoval] = useState(false)
  const current = edited ?? serverIds
  const isDirty = edited !== null && !sameSet(edited, serverIds)
  const removedCount = [...serverIds].filter(id => !current.has(id)).length
  const addedCount = [...current].filter(id => !serverIds.has(id)).length
  const groups = useMemo(() => groupPermissions(permissions), [permissions])
  const roleMeta = getRoleMeta(role.name)

  const toggle = (permissionId: string) => {
    setEdited(() => {
      const next = new Set(current)
      if (next.has(permissionId)) next.delete(permissionId)
      else next.add(permissionId)
      return next
    })
  }

  const toggleGroup = (ids: string[], checked: boolean) => {
    setEdited(() => {
      const next = new Set(current)
      for (const id of ids) {
        if (checked) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  const save = async () => {
    const sent = new Set(current)
    setIsSaving(true)
    try {
      // The backend replaces the role's whole set: what is unchecked here is revoked, and an empty set is valid.
      const saved = await roleService.bulkAssignPermissions(role.id, [...sent])
      const savedIds = new Set(saved.map(item => item.permissionId))
      if (!sameSet(savedIds, sent)) {
        // Never report success for something the server did not apply.
        toast.error('Phân quyền chưa được áp dụng đầy đủ', 'Dữ liệu trên máy chủ khác với lựa chọn của bạn. Hãy kiểm tra lại.')
      } else {
        toast.success('Đã lưu phân quyền', `${roleMeta.label}: cấp thêm ${addedCount}, thu hồi ${removedCount} quyền.`)
      }
      setEdited(null)
      await assigned.reload()
    } catch (err) {
      toast.error('Không lưu được phân quyền', getApiErrorMessage(err, 'Thay đổi chưa được áp dụng.'))
    } finally {
      setIsSaving(false)
    }
  }

  const requestSave = () => {
    if (removedCount > 0) setConfirmRemoval(true)
    else void save()
  }

  return (
    <Card className="flex flex-col">
      <CardHeader
        divider
        title={
          <span className="flex flex-wrap items-center gap-2">
            Quyền của vai trò
            <Badge tone={roleMeta.tone}>{roleMeta.label}</Badge>
          </span>
        }
        description="Chọn các quyền chi tiết vai trò này được cấp thêm."
        actions={
          assigned.data ? (
            <span className="text-dense tabular-nums text-fg-muted">
              {current.size}/{permissions.length} quyền
            </span>
          ) : null
        }
      />
      <CardContent className="flex flex-col gap-6">
        <Alert tone="info">
          Quyền ở đây là quyền chi tiết được cấp thêm cho cả vai trò. Một số chức năng vẫn mặc định cho phép theo vai trò, nên gỡ một quyền chỉ
          chặn được các chức năng kiểm tra theo quyền chi tiết này.
        </Alert>
        {assigned.error ? (
          <Alert
            tone="danger"
            title="Không tải được quyền hiện tại của vai trò"
            action={
              <Button size="sm" variant="secondary" onClick={() => void assigned.reload()}>
                Thử lại
              </Button>
            }
          >
            {getApiErrorMessage(assigned.error)} Để tránh ghi đè sai, bạn chưa thể chỉnh sửa vai trò này.
          </Alert>
        ) : assigned.isLoading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : permissions.length === 0 ? (
          <p className="text-sm text-fg-muted">Hệ thống chưa có quyền hạn nào để phân.</p>
        ) : (
          groups.map(group => {
            const ids = group.permissions.map(permission => permission.id)
            const checkedCount = ids.filter(id => current.has(id)).length
            return (
              <fieldset key={group.key} className="flex flex-col gap-3">
                <legend className="sr-only">{group.label}</legend>
                <Checkbox
                  label={<span className="font-semibold">{group.label}</span>}
                  description={`${checkedCount}/${ids.length} quyền`}
                  checked={checkedCount === ids.length}
                  indeterminate={checkedCount > 0 && checkedCount < ids.length}
                  disabled={isSaving}
                  onCheckedChange={checked => toggleGroup(ids, checked)}
                />
                <div className="grid grid-cols-1 gap-2 pl-6 sm:grid-cols-2">
                  {group.permissions.map(permission => (
                    <Checkbox
                      key={permission.id}
                      label={<span className="font-mono text-dense">{permission.name}</span>}
                      description={describePermission(permission)}
                      checked={current.has(permission.id)}
                      disabled={isSaving}
                      onCheckedChange={() => toggle(permission.id)}
                    />
                  ))}
                </div>
              </fieldset>
            )
          })
        )}
      </CardContent>
      <CardFooter className="justify-between">
        <span className="text-dense text-fg-muted">
          {isDirty
            ? `Chưa lưu: cấp thêm ${addedCount}, thu hồi ${removedCount} quyền.`
            : 'Thay đổi có hiệu lực ngay ở thao tác kế tiếp của người dùng thuộc vai trò này.'}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" disabled={!isDirty || isSaving} onClick={() => setEdited(null)}>
            Hoàn tác
          </Button>
          <Button disabled={!isDirty} loading={isSaving} onClick={requestSave}>
            Lưu thay đổi
          </Button>
        </div>
      </CardFooter>

      <ConfirmDialog
        open={confirmRemoval}
        onClose={() => setConfirmRemoval(false)}
        tone="danger"
        title={`Thu hồi ${removedCount} quyền của ${roleMeta.label}?`}
        description="Mọi người dùng thuộc vai trò này sẽ mất các quyền đã bỏ chọn ngay ở thao tác kế tiếp."
        confirmLabel="Lưu và thu hồi"
        onConfirm={async () => {
          setConfirmRemoval(false)
          await save()
        }}
      />
    </Card>
  )
}
