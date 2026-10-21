import { useState, type FormEvent } from 'react'
import { Alert, Button, DescriptionList, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatNumber } from '@/lib/format'
import { sealingService, type SealingRecordResponse } from '@/services/sealingService'
import { userService } from '@/services/userService'
import type { User } from '@/types'

export interface SealingTarget {
  unitCode: string
  unitId?: string
  contractId?: string
  contractCode?: string
  tenantName?: string
  /** From the overdue ledger; omitted when the unit is not in it. */
  overdueDays?: number
  totalDebt?: number
  /** Sealing day of the facility policy, for the copy. */
  sealingDays?: number
}

interface AssetSealingModalProps {
  open: boolean
  onClose: () => void
  target: SealingTarget
  /** Facility of the unit: witnesses must belong to it. */
  facilityId?: string
  onSealed: (record: SealingRecordResponse) => void
}

const SEAL_TAG_MAX = 50

/**
 * Creates the sealing protocol of an overdue unit (POST /sealing). The backend only accepts it from the sealing day of
 * the facility policy and requires a witness: active staff or manager of the same facility, not the signed-in user.
 */
export function AssetSealingModal(props: AssetSealingModalProps) {
  if (!props.open) return null
  return <AssetSealingDialog {...props} />
}

function AssetSealingDialog({ onClose, target, facilityId, onSealed }: AssetSealingModalProps) {
  const { user } = useAuth()
  const witnessesQuery = useAsyncData(
    async (signal): Promise<User[]> => {
      const [staff, managers] = await Promise.all([
        userService.getAllUsers({ role: 'STAFF', facilityId }, { signal }),
        userService.getAllUsers({ role: 'FACILITY_MANAGER', facilityId }, { signal }),
      ])
      return [...staff.data, ...managers.data].filter(
        (member) => member.isActive !== false && member.id !== user?.id && (!facilityId || member.facilityId === facilityId),
      )
    },
    [facilityId, user?.id],
    { enabled: Boolean(facilityId) },
  )
  const witnesses = witnessesQuery.data ?? []

  const [witnessId, setWitnessId] = useState('')
  const [sealTagNumber, setSealTagNumber] = useState('')
  const [reason, setReason] = useState(
    target.overdueDays !== undefined
      ? `Khách quá hạn thanh toán ${formatNumber(target.overdueDays)} ngày, đã đến mốc niêm phong của cơ sở.`
      : '',
  )
  const [inventorySummary, setInventorySummary] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [touched, setTouched] = useState(false)

  const noWitness = !witnessesQuery.isLoading && !witnessesQuery.error && witnesses.length === 0
  const witnessError = touched && !witnessId ? 'Chọn người chứng kiến tại hiện trường.' : undefined
  const reasonError = touched && !reason.trim() ? 'Nhập lý do niêm phong.' : undefined

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!reason.trim() || !witnessId) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const record = await sealingService.createSealing({
        contractId: target.contractId,
        unitId: target.contractId ? undefined : target.unitId,
        sealTagNumber: sealTagNumber.trim() || undefined,
        witnessId,
        reason: reason.trim(),
        inventorySummary: inventorySummary.trim() || undefined,
      })
      onSealed(record)
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Không thể lập biên bản niêm phong.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!isSubmitting}
      size="lg"
      title={
        <>
          Lập biên bản niêm phong kho <span className="whitespace-nowrap">{target.unitCode}</span>
        </>
      }
      description="Biên bản thu hồi mã PIN/QR của khách, khóa kho và gửi email thông báo cho khách thuê."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button
            type="submit"
            form="asset-sealing-form"
            variant="danger"
            loading={isSubmitting}
            disabled={noWitness || Boolean(witnessesQuery.error) || !facilityId}
          >
            Lập biên bản niêm phong
          </Button>
        </>
      }
    >
      <form id="asset-sealing-form" onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-5" noValidate>
        {submitError ? (
          <Alert tone="danger" title="Không thể niêm phong" onDismiss={() => setSubmitError(null)}>
            {submitError}
          </Alert>
        ) : null}

        <DescriptionList
          items={[
            { label: 'Kho', value: target.unitCode, mono: true },
            { label: 'Khách thuê', value: target.tenantName },
            { label: 'Hợp đồng', value: target.contractCode, mono: true },
            { label: 'Số ngày quá hạn', value: target.overdueDays !== undefined ? `${formatNumber(target.overdueDays)} ngày` : undefined },
            { label: 'Tổng nợ', value: target.totalDebt !== undefined ? formatCurrency(target.totalDebt) : undefined },
            {
              label: 'Mốc niêm phong',
              value: target.sealingDays !== undefined ? `Từ ngày quá hạn thứ ${formatNumber(target.sealingDays)}` : undefined,
            },
          ]}
        />

        {!facilityId ? (
          <Alert tone="warning">Không xác định được cơ sở của kho nên chưa thể chọn người chứng kiến.</Alert>
        ) : witnessesQuery.error ? (
          <Alert
            tone="warning"
            title="Không tải được danh sách người chứng kiến"
            action={
              <Button size="sm" variant="secondary" onClick={() => void witnessesQuery.reload()}>
                Thử lại
              </Button>
            }
          >
            {getApiErrorMessage(witnessesQuery.error)}
          </Alert>
        ) : noWitness ? (
          <Alert tone="warning" title="Chưa có người chứng kiến">
            Cơ sở chưa có nhân viên hoặc quản lý nào khác đang hoạt động để chứng kiến. Biên bản niêm phong cần hai người, hãy
            phân công thêm nhân sự trước khi niêm phong.
          </Alert>
        ) : (
          <Field label="Người chứng kiến tại hiện trường" required error={witnessError} hint="Nhân viên hoặc quản lý của cơ sở, khác người lập biên bản.">
            <Select
              value={witnessId}
              onChange={(event) => setWitnessId(event.target.value)}
              disabled={witnessesQuery.isLoading}
              placeholder={witnessesQuery.isLoading ? 'Đang tải nhân sự…' : 'Chọn người chứng kiến'}
              options={witnesses.map((member) => ({
                value: member.id,
                label: `${member.fullName || member.username} · ${member.roleName === 'FACILITY_MANAGER' || member.role?.name === 'FACILITY_MANAGER' ? 'Quản lý' : 'Nhân viên'} (${member.email})`,
              }))}
            />
          </Field>
        )}

        <Field
          label="Số tem niêm phong"
          optional
          hint={`Số in trên tem, tối đa ${SEAL_TAG_MAX} ký tự. Để trống để hệ thống cấp số, rồi ghi số đó lên tem tại hiện trường.`}
        >
          <Input value={sealTagNumber} onChange={(event) => setSealTagNumber(event.target.value)} maxLength={SEAL_TAG_MAX} className="font-mono" />
        </Field>

        <Field label="Lý do niêm phong" required error={reasonError}>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} />
        </Field>

        <Field label="Tình trạng hàng hóa bên trong" optional hint="Ghi nhanh những gì quan sát được trước khi niêm phong.">
          <Textarea value={inventorySummary} onChange={(event) => setInventorySummary(event.target.value)} rows={3} maxLength={4000} />
        </Field>
      </form>
    </Modal>
  )
}
