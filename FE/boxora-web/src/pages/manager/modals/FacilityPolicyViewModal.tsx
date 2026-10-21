import { useState, type FormEvent } from 'react'
import { Alert, Badge, Button, Field, Input, Modal, Skeleton, useToast } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage, getApiErrorStatus } from '@/lib/apiError'
import { formatNumber } from '@/lib/format'
import { facilityPolicyService } from '@/services/facilityPolicyService'
import type { FacilityPolicy } from '@/types'
import { resolvePolicy, type FacilityPolicyValues } from '@/utils/facilityPolicyDefaults'
import { PolicySummary } from '../shared/PolicySummary'

interface FacilityPolicyViewModalProps {
  isOpen: boolean
  onClose: () => void
  facilityId: string
  facilityName: string
  /** Edit rights: an exception grant for a facility manager, management rights for the admin panel. */
  canEdit?: boolean
  /** Called after a policy was created or updated. */
  onSaved?: (policy: FacilityPolicy) => void
}

type NumericPolicyKey = Exclude<keyof FacilityPolicyValues, 'isActive'>

const EDITABLE_FIELDS: { key: NumericPolicyKey; label: string; min: number; max: number }[] = [
  { key: 'depositPercentage', label: 'Tỷ lệ tiền cọc (%)', min: 0, max: 100 },
  { key: 'minimumRentalMonths', label: 'Thuê tối thiểu (tháng)', min: 1, max: 36 },
  { key: 'renewalWindowDays', label: 'Mở gia hạn trước (ngày)', min: 0, max: 365 },
  { key: 'cancellationFullRefundHours', label: 'Hoàn 100% khi hủy trước (giờ)', min: 0, max: 720 },
  { key: 'cancellationPartialRefundHours', label: 'Hoàn một phần khi hủy trước (giờ)', min: 0, max: 720 },
  { key: 'cancellationPartialRefundPercent', label: 'Tỷ lệ hoàn một phần (%)', min: 0, max: 100 },
  { key: 'returnNoticeDays', label: 'Báo trước khi trả kho (ngày)', min: 0, max: 365 },
  { key: 'depositRefundSlaDays', label: 'Hạn hoàn cọc (ngày)', min: 0, max: 365 },
  { key: 'dailyLateFee', label: 'Phí trễ hạn mỗi ngày (₫)', min: 0, max: 100_000_000 },
  { key: 'overdueGraceDays', label: 'Ân hạn quá hạn (ngày)', min: 0, max: 365 },
  { key: 'overdueAccessDisableDays', label: 'Khóa truy cập từ ngày quá hạn thứ', min: 1, max: 365 },
  { key: 'overdueSealingDays', label: 'Niêm phong từ ngày quá hạn thứ', min: 1, max: 365 },
]

/** Facility policy as applied today. Edits an existing policy (exception grant) or creates one (business manager only). */
export function FacilityPolicyViewModal(props: FacilityPolicyViewModalProps) {
  if (!props.isOpen) return null
  return <FacilityPolicyDialog {...props} />
}

function FacilityPolicyDialog({ onClose, facilityId, facilityName, canEdit = false, onSaved }: FacilityPolicyViewModalProps) {
  const toast = useToast()
  const { role } = useAuth()
  const policyQuery = useAsyncData(
    async (signal): Promise<FacilityPolicy | null> => {
      try {
        return await facilityPolicyService.getByFacilityId(facilityId, { signal })
      } catch (error) {
        if (getApiErrorStatus(error) === 404) return null
        throw error
      }
    },
    [facilityId],
    { keepPreviousData: false },
  )

  const [isEditing, setIsEditing] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const stored = policyQuery.data ?? null
  const resolved = resolvePolicy(stored, facilityId)
  const isLoaded = !policyQuery.isLoading && !policyQuery.error
  const canUpdate = canEdit && Boolean(stored?.id)
  const canCreate = canEdit && isLoaded && !stored && role === 'BUSINESS_MANAGER'

  const startEditing = () => {
    setValues(Object.fromEntries(EDITABLE_FIELDS.map(({ key }) => [key, String(resolved[key])])))
    setFieldErrors({})
    setSubmitError(null)
    setIsEditing(true)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const errors: Record<string, string> = {}
    const parsed: Partial<Record<NumericPolicyKey, number>> = {}
    for (const { key, min, max } of EDITABLE_FIELDS) {
      const raw = (values[key] ?? '').trim()
      const value = Number(raw)
      if (raw === '' || !Number.isFinite(value) || value < min || value > max) {
        errors[key] = `Nhập số từ ${formatNumber(min)} đến ${formatNumber(max)}.`
      } else {
        parsed[key] = value
      }
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setIsSaving(true)
    setSubmitError(null)
    try {
      const payload = parsed as Required<Record<NumericPolicyKey, number>>
      const saved = stored?.id
        ? await facilityPolicyService.update(stored.id, payload)
        : await facilityPolicyService.create({ facilityId, isActive: true, ...payload })
      policyQuery.setData(saved)
      setIsEditing(false)
      toast.success(stored?.id ? 'Đã lưu chính sách cơ sở' : 'Đã tạo chính sách cơ sở')
      onSaved?.(saved)
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Không thể lưu chính sách.'))
    } finally {
      setIsSaving(false)
    }
  }

  const footer = isEditing ? (
    <>
      <Button variant="secondary" onClick={() => setIsEditing(false)} disabled={isSaving}>
        Hủy
      </Button>
      <Button type="submit" form="facility-policy-form" loading={isSaving}>
        {stored?.id ? 'Lưu thay đổi' : 'Tạo chính sách'}
      </Button>
    </>
  ) : (
    <>
      <Button variant="secondary" onClick={onClose}>
        Đóng
      </Button>
      {canUpdate ? <Button onClick={startEditing}>Sửa ngoại lệ</Button> : null}
      {canCreate ? <Button onClick={startEditing}>Tạo chính sách</Button> : null}
    </>
  )

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!isSaving}
      size="lg"
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          Chính sách {facilityName}
          {isLoaded && stored?.isActive === false ? <Badge tone="danger">Ngừng áp dụng</Badge> : null}
        </span>
      }
      description="Quy định nghiệp vụ áp dụng tại cơ sở: tiền cọc, hủy đặt kho, trả kho, quá hạn và niêm phong."
      footer={footer}
    >
      {policyQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-40" />
          ))}
        </div>
      ) : policyQuery.error ? (
        <Alert
          tone="danger"
          title="Không tải được chính sách"
          action={
            <Button size="sm" variant="secondary" onClick={() => void policyQuery.reload()}>
              Thử lại
            </Button>
          }
        >
          {getApiErrorMessage(policyQuery.error)}
        </Alert>
      ) : (
        <div className="flex flex-col gap-4">
          {!stored ? (
            <Alert tone="info" title="Cơ sở chưa có chính sách riêng">
              Đang hiển thị quy định mặc định của hệ thống.{' '}
              {canCreate
                ? 'Bạn có thể tạo chính sách riêng từ các giá trị này.'
                : 'Chưa thể chỉnh sửa cho đến khi giám đốc vận hành tạo chính sách.'}
            </Alert>
          ) : stored.isActive === false ? (
            <Alert tone="warning" title="Chính sách đã ngừng áp dụng">
              Cơ sở đang dùng quy định mặc định cho đến khi chính sách được kích hoạt lại.
            </Alert>
          ) : null}

          {isEditing ? (
            <form id="facility-policy-form" onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4" noValidate>
              {submitError ? (
                <Alert tone="danger" title="Không thể lưu" onDismiss={() => setSubmitError(null)}>
                  {submitError}
                </Alert>
              ) : null}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {EDITABLE_FIELDS.map(({ key, label, min, max }) => (
                  <Field key={key} label={label} error={fieldErrors[key]}>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={min}
                      max={max}
                      value={values[key] ?? ''}
                      onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                      className="tabular-nums"
                    />
                  </Field>
                ))}
              </div>
            </form>
          ) : (
            <PolicySummary policy={resolved} />
          )}
        </div>
      )}
    </Modal>
  )
}
