import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Alert, Badge, Button, DescriptionList, Skeleton, useToast } from '@/components/ui'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage, getApiErrorStatus } from '@/lib/apiError'
import { formatCurrency } from '@/lib/format'
import { facilityPolicyService } from '@/services/facilityPolicyService'
import type { Facility, FacilityPolicy } from '@/types'
import { resolvePolicy } from '@/utils/facilityPolicyDefaults'
import { FacilityPolicyModal } from '../../operations/components/FacilityPolicyModal'

export interface PolicyPreviewProps {
  facility: Facility
  /** Business manager can create and edit the policy from here. */
  canEdit: boolean
}

/** Loads the policy of one facility; a facility without a policy (404) resolves to null. */
const loadPolicy = async (facilityId: string, signal: AbortSignal): Promise<FacilityPolicy | null> => {
  try {
    return await facilityPolicyService.getByFacilityId(facilityId, { signal })
  } catch (err) {
    if (getApiErrorStatus(err) === 404) return null
    throw err
  }
}

/** The operating policy of a facility inside its card. Missing numbers are shown from the system defaults. */
export function PolicyPreview({ facility, canEdit }: PolicyPreviewProps) {
  const toast = useToast()
  const { data: policy, error, isLoading, reload } = useAsyncData(signal => loadPolicy(facility.id, signal), [facility.id])
  const [editing, setEditing] = useState(false)

  if (error) {
    return (
      <Alert
        tone="danger"
        title="Không tải được chính sách"
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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    )
  }

  const resolved = resolvePolicy(policy, facility.id)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-fg">Chính sách vận hành</span>
        {!policy ? (
          <Badge tone="warning">Chưa cấu hình</Badge>
        ) : resolved.isActive ? (
          <Badge tone="success" dot>
            Đang áp dụng
          </Badge>
        ) : (
          <Badge tone="neutral" dot>
            Ngừng áp dụng
          </Badge>
        )}
      </div>

      {!policy ? <p className="text-dense text-fg-muted">Cơ sở chưa có chính sách riêng. Các số dưới đây là giá trị mặc định của hệ thống.</p> : null}

      <DescriptionList
        layout="inline"
        items={[
          { label: 'Tiền cọc', value: `${resolved.depositPercentage}% · thuê tối thiểu ${resolved.minimumRentalMonths} tháng` },
          { label: 'Gia hạn và trả kho', value: `Gia hạn trước ${resolved.renewalWindowDays} ngày · báo trả ${resolved.returnNoticeDays} ngày` },
          { label: 'Hủy đặt kho', value: `Hoàn 100% trước ${resolved.cancellationFullRefundHours} giờ · ${resolved.cancellationPartialRefundPercent}% trước ${resolved.cancellationPartialRefundHours} giờ` },
          { label: 'SLA hoàn cọc', value: `${resolved.depositRefundSlaDays} ngày` },
          { label: 'Phí quá hạn', value: `${formatCurrency(resolved.dailyLateFee)} mỗi ngày` },
          { label: 'Mốc quá hạn', value: `Ân hạn ${resolved.overdueGraceDays} ngày · khóa PIN sau ${resolved.overdueAccessDisableDays} ngày · niêm phong sau ${resolved.overdueSealingDays} ngày` },
        ]}
      />

      {canEdit ? (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" leftIcon={policy ? Pencil : Plus} onClick={() => setEditing(true)}>
            {policy ? 'Chỉnh sửa chính sách' : 'Tạo chính sách'}
          </Button>
        </div>
      ) : null}

      <FacilityPolicyModal
        isOpen={editing}
        onClose={() => setEditing(false)}
        facility={facility}
        existingPolicy={policy ?? null}
        onSuccess={(_saved, isNew) => {
          toast.success(isNew ? 'Đã ban hành chính sách cơ sở' : 'Đã cập nhật chính sách cơ sở')
          void reload()
        }}
      />
    </div>
  )
}
