import { useMemo, useState, type FormEvent } from 'react'
import { Alert, Button, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import {
  masterKeyService,
  type MasterKeyOverrideCategory,
  type MasterKeyOverrideRecord,
  type MasterKeyOverrideSeverity,
} from '@/services/masterKeyService'
import { userService } from '@/services/userService'
import type { StorageUnit, User } from '@/types'
import { MASTER_KEY_CATEGORY_OPTIONS, MASTER_KEY_SEVERITY_OPTIONS } from '../dashboard/masterKeyModel'
import { compareUnitCodes } from '../dashboard/unitModel'

interface MasterKeyOverrideModalProps {
  open: boolean
  onClose: () => void
  facilityId: string
  units: StorageUnit[]
  onRecorded: (record: MasterKeyOverrideRecord) => void
}

/**
 * Records one use of the physical master key (POST /master-key/override). Two-person rule: the witness, staff or
 * manager of the same facility, types their own password on this device; it is only verified, never stored.
 */
export function MasterKeyOverrideModal(props: MasterKeyOverrideModalProps) {
  if (!props.open) return null
  return <MasterKeyOverrideForm {...props} />
}

function MasterKeyOverrideForm({ onClose, facilityId, units, onRecorded }: MasterKeyOverrideModalProps) {
  const { user } = useAuth()
  const witnessesQuery = useAsyncData(
    async (signal): Promise<User[]> => {
      const [staff, managers] = await Promise.all([
        userService.getAllUsers({ role: 'STAFF', facilityId }, { signal }),
        userService.getAllUsers({ role: 'FACILITY_MANAGER', facilityId }, { signal }),
      ])
      return [...staff.data, ...managers.data].filter(
        (member) => member.isActive !== false && member.id !== user?.id && member.facilityId === facilityId,
      )
    },
    [facilityId, user?.id],
  )
  const witnesses = witnessesQuery.data ?? []
  const unitOptions = useMemo(
    () => [
      { value: '', label: 'Không gắn với kho cụ thể' },
      ...[...units].sort(compareUnitCodes).map((unit) => ({ value: unit.id, label: `${unit.unitCode}${unit.tenantName ? ` · ${unit.tenantName}` : ''}` })),
    ],
    [units],
  )

  const [unitId, setUnitId] = useState('')
  const [category, setCategory] = useState<MasterKeyOverrideCategory | ''>('')
  const [severity, setSeverity] = useState<MasterKeyOverrideSeverity>('STANDARD')
  const [reason, setReason] = useState('')
  const [documentReference, setDocumentReference] = useState('')
  const [witnessId, setWitnessId] = useState('')
  const [witnessPassword, setWitnessPassword] = useState('')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const errors = {
    category: touched && !category ? 'Chọn loại tình huống.' : undefined,
    reason: touched && !reason.trim() ? 'Nhập lý do sử dụng chìa khóa tổng.' : undefined,
    witness: touched && !witnessId ? 'Chọn người chứng kiến.' : undefined,
    password: touched && !witnessPassword ? 'Người chứng kiến cần nhập mật khẩu của mình.' : undefined,
  }
  const noWitness = !witnessesQuery.isLoading && !witnessesQuery.error && witnesses.length === 0

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!category || !reason.trim() || !witnessId || !witnessPassword) return
    setIsSubmitting(true)
    setError(null)
    try {
      const record = await masterKeyService.executeOverride({
        facilityId,
        category,
        severity,
        witnessUserId: witnessId,
        witnessPassword,
        reason: reason.trim(),
        documentReference: documentReference.trim() || undefined,
        resourceType: unitId ? 'STORAGE_UNIT' : undefined,
        resourceId: unitId || undefined,
      })
      setWitnessPassword('')
      onRecorded(record)
    } catch (err) {
      setWitnessPassword('')
      setError(getApiErrorMessage(err, 'Không ghi nhận được lần sử dụng chìa khóa tổng.'))
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
      title="Ghi nhận sử dụng chìa khóa tổng"
      description="Dùng sau khi mở kho bằng chìa khóa cơ tổng. Hệ thống không mở khóa từ xa; bản ghi được lưu vết và gửi cảnh báo tới quản lý kinh doanh, quản trị viên."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" form="master-key-form" loading={isSubmitting} disabled={noWitness}>
            Ghi nhận
          </Button>
        </>
      }
    >
      <form id="master-key-form" onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate autoComplete="off">
        {error ? (
          <Alert tone="danger" title="Không thể ghi nhận" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Kho được mở" optional>
            <Select value={unitId} onChange={(event) => setUnitId(event.target.value)} options={unitOptions} />
          </Field>
          <Field label="Mức độ khẩn cấp" required>
            <Select
              value={severity}
              onChange={(event) => setSeverity(event.target.value as MasterKeyOverrideSeverity)}
              options={MASTER_KEY_SEVERITY_OPTIONS}
            />
          </Field>
        </div>
        <Field label="Loại tình huống" required error={errors.category}>
          <Select
            value={category}
            onChange={(event) => setCategory(event.target.value as MasterKeyOverrideCategory)}
            options={MASTER_KEY_CATEGORY_OPTIONS}
            placeholder="Chọn loại tình huống"
          />
        </Field>
        <Field label="Lý do" required error={errors.reason}>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} />
        </Field>
        <Field label="Số văn bản tham chiếu" optional hint="Ví dụ: số quyết định, số biên bản niêm phong hoặc phiếu sự cố.">
          <Input value={documentReference} onChange={(event) => setDocumentReference(event.target.value)} maxLength={100} />
        </Field>

        {witnessesQuery.error ? (
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
          <Alert tone="warning">Cơ sở chưa có nhân viên hoặc quản lý khác đang hoạt động để làm người chứng kiến.</Alert>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Người chứng kiến" required error={errors.witness}>
              <Select
                value={witnessId}
                onChange={(event) => setWitnessId(event.target.value)}
                disabled={witnessesQuery.isLoading}
                placeholder={witnessesQuery.isLoading ? 'Đang tải nhân sự…' : 'Chọn người chứng kiến'}
                options={witnesses.map((member) => ({ value: member.id, label: member.fullName || member.username }))}
              />
            </Field>
            <Field
              label="Mật khẩu người chứng kiến"
              required
              error={errors.password}
              hint="Người chứng kiến tự nhập. Chỉ dùng để xác thực, không được lưu. Sai 5 lần sẽ bị khóa 15 phút."
            >
              <Input
                type="password"
                autoComplete="off"
                value={witnessPassword}
                onChange={(event) => setWitnessPassword(event.target.value)}
              />
            </Field>
          </div>
        )}
      </form>
    </Modal>
  )
}
