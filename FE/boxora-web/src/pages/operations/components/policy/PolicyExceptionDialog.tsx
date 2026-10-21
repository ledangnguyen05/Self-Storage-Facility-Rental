import { useState } from 'react'
import { UserX } from 'lucide-react'
import { Alert, Avatar, Button, EmptyState, Modal, Skeleton, Switch, useToast } from '@/components/ui'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { facilityPolicyService } from '@/services/facilityPolicyService'
import { userService } from '@/services/userService'
import type { Facility, FacilityPolicy } from '@/types'

export interface PolicyExceptionDialogProps {
  facility: Facility
  policy: FacilityPolicy
  onClose: () => void
}

/** Lets the business manager grant or revoke the right of each facility manager to edit this policy. */
export function PolicyExceptionDialog({ facility, policy, onClose }: PolicyExceptionDialogProps) {
  const toast = useToast()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const { data, error, isLoading, reload, setData } = useAsyncData(
    async signal => {
      const [managers, grantedIds] = await Promise.all([
        // Only active managers of this facility can hold a grant; a locked account would fail with a 403.
        userService.getAllUsers({ role: 'FACILITY_MANAGER', facilityId: facility.id, isActive: true }, { signal }),
        facilityPolicyService.getExceptionGrants(policy.id, { signal }),
      ])
      return { managers: managers.data, grantedIds: Array.isArray(grantedIds) ? grantedIds : [] }
    },
    [facility.id, policy.id],
  )

  const managers = data?.managers ?? []
  const grantedIds = data?.grantedIds ?? []

  const toggle = async (managerId: string, granted: boolean) => {
    setPendingId(managerId)
    try {
      await facilityPolicyService.setExceptionGrant(policy.id, managerId, granted)
      setData(current => {
        if (!current) return current
        const rest = current.grantedIds.filter(id => id !== managerId)
        return { ...current, grantedIds: granted ? [...rest, managerId] : rest }
      })
      toast.success(granted ? 'Đã cấp quyền sửa ngoại lệ' : 'Đã thu hồi quyền sửa ngoại lệ')
    } catch (err) {
      toast.error('Không thể cập nhật quyền ngoại lệ', getApiErrorMessage(err))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Quyền sửa ngoại lệ chính sách"
      description={facility.name}
      footer={<Button onClick={onClose}>Xong</Button>}
    >
      <div className="flex flex-col gap-4">
        <Alert tone="info">
          Quản lý cơ sở mặc định chỉ xem chính sách. Cấp quyền ngoại lệ để người đó được điều chỉnh quy định riêng của cơ sở này khi cần.
        </Alert>

        {error ? (
          <Alert
            tone="danger"
            title="Không tải được danh sách quản lý cơ sở"
            action={
              <Button size="sm" variant="secondary" onClick={() => void reload()}>
                Thử lại
              </Button>
            }
          >
            {getApiErrorMessage(error)}
          </Alert>
        ) : isLoading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : managers.length === 0 ? (
          <EmptyState icon={UserX} size="sm" title="Chưa có quản lý cơ sở đang hoạt động" description="Phân công hoặc kích hoạt một tài khoản vai trò Quản lý cơ sở cho cơ sở này để cấp quyền." />
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
            {managers.map(manager => {
              const granted = grantedIds.includes(manager.id)
              return (
                <li key={manager.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={manager.fullName || manager.username} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-fg">{manager.fullName || manager.username}</div>
                      <div className="truncate text-dense text-fg-subtle">{manager.email}</div>
                    </div>
                  </div>
                  <Switch
                    size="sm"
                    labelPosition="start"
                    label={granted ? 'Đã cấp quyền' : 'Chưa cấp'}
                    checked={granted}
                    disabled={pendingId === manager.id}
                    onCheckedChange={next => void toggle(manager.id, next)}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Modal>
  )
}
