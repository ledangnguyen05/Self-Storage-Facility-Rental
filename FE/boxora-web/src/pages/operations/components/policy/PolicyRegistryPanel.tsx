import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Alert, Button, ConfirmDialog, useToast } from '@/components/ui'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { facilityPolicyService } from '@/services/facilityPolicyService'
import type { Facility, FacilityPolicy } from '@/types'
import { FacilityPolicyModal } from '../FacilityPolicyModal'
import { PolicyExceptionDialog } from './PolicyExceptionDialog'
import { PolicyRegistryTable } from './PolicyRegistryTable'

export interface PolicyRegistryPanelProps {
  facilities: readonly Facility[]
  canManage: boolean
}

interface EditorState {
  facility: Facility | null
  policy: FacilityPolicy | null
}

const POLICY_PAGE_SIZE = 100

/** Policy registry: loads every facility policy and wires the create, edit, switch, grant and delete flows. */
export function PolicyRegistryPanel({ facilities, canManage }: PolicyRegistryPanelProps) {
  const toast = useToast()
  const { data, error, isLoading, reload } = useAsyncData(
    signal => facilityPolicyService.getAll({ size: POLICY_PAGE_SIZE }, { signal }),
    [],
  )
  const policies = useMemo(() => data?.content ?? [], [data])

  const [editor, setEditor] = useState<EditorState | null>(null)
  const [exceptionTarget, setExceptionTarget] = useState<{ facility: Facility; policy: FacilityPolicy } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ facility: Facility; policy: FacilityPolicy } | null>(null)

  const facilitiesWithoutPolicy = useMemo(
    () => facilities.filter(facility => !policies.some(policy => policy.facilityId === facility.id)),
    [facilities, policies],
  )

  const handleToggleActive = async (policy: FacilityPolicy) => {
    const nextActive = policy.isActive === false
    try {
      await facilityPolicyService.update(policy.id, { isActive: nextActive })
      toast.success(nextActive ? 'Đã kích hoạt chính sách' : 'Đã ngừng áp dụng chính sách')
      await reload()
    } catch (err) {
      toast.error('Không thể đổi trạng thái chính sách', getApiErrorMessage(err))
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await facilityPolicyService.delete(deleteTarget.policy.id)
      toast.success('Đã xóa chính sách cơ sở')
      setDeleteTarget(null)
      await reload()
    } catch (err) {
      toast.error('Không thể xóa chính sách', getApiErrorMessage(err))
    }
  }

  const createButton = (
    <Button
      leftIcon={Plus}
      size="sm"
      disabled={facilitiesWithoutPolicy.length === 0}
      title={facilitiesWithoutPolicy.length === 0 && !isLoading ? 'Mọi cơ sở đều đã có chính sách' : undefined}
      onClick={() => setEditor({ facility: null, policy: null })}
    >
      Tạo chính sách
    </Button>
  )

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-dense text-fg-muted">
          Quy định cọc, hủy hoàn tiền, SLA hoàn cọc và xử lý quá hạn của từng cơ sở. Cơ sở chưa có chính sách dùng giá trị mặc định của hệ thống.
        </p>
        {canManage ? (
          createButton
        ) : (
          <Alert tone="info" className="sm:max-w-xs">
            Chỉ Giám đốc vận hành được thay đổi chính sách.
          </Alert>
        )}
      </div>

      <PolicyRegistryTable
        facilities={facilities}
        policies={policies}
        isLoading={isLoading}
        error={error}
        onRetry={() => void reload()}
        canManage={canManage}
        onCreate={facility => setEditor({ facility, policy: null })}
        onEdit={(facility, policy) => setEditor({ facility, policy })}
        onToggleActive={policy => void handleToggleActive(policy)}
        onGrantExceptions={(facility, policy) => setExceptionTarget({ facility, policy })}
        onDelete={(facility, policy) => setDeleteTarget({ facility, policy })}
      />

      <FacilityPolicyModal
        isOpen={editor !== null}
        onClose={() => setEditor(null)}
        facility={editor?.facility ?? null}
        existingPolicy={editor?.policy ?? null}
        availableFacilities={editor?.policy ? [] : facilitiesWithoutPolicy}
        onSuccess={(_saved, isNew) => {
          toast.success(isNew ? 'Đã ban hành chính sách cơ sở' : 'Đã cập nhật chính sách cơ sở')
          void reload()
        }}
      />

      {exceptionTarget ? <PolicyExceptionDialog facility={exceptionTarget.facility} policy={exceptionTarget.policy} onClose={() => setExceptionTarget(null)} /> : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        tone="danger"
        title={`Xóa chính sách của ${deleteTarget?.facility.name ?? 'cơ sở'}?`}
        description="Cơ sở sẽ dùng lại giá trị mặc định của hệ thống. Thao tác này không thể hoàn tác."
        confirmLabel="Xóa chính sách"
        onConfirm={handleDelete}
      />
    </div>
  )
}
