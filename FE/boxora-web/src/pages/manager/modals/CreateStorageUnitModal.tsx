import { useMemo, useState, type FormEvent } from 'react'
import { Alert, Button, DescriptionList, Field, Input, Modal, Select } from '@/components/ui'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatNumber } from '@/lib/format'
import { getUnitTypeLabel } from '@/data/storageUnitsData'
import { storageUnitService } from '@/services/storageUnitService'
import type { Facility, StorageUnit } from '@/types'

interface CreateStorageUnitModalProps {
  open: boolean
  onClose: () => void
  facilities: Facility[]
  /** Pre-selected facility (the one the manager is working in). */
  defaultFacilityId?: string
  onCreated: (unit: StorageUnit) => void
}

const FLOOR_OPTIONS = [
  { value: 'Tầng 1', label: 'Tầng 1' },
  { value: 'Tầng 2', label: 'Tầng 2' },
]

/** Same rule as the server: letters, digits, dash, underscore or dot, starting with a letter or digit (no spaces, no markup). */
const UNIT_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const UNIT_CODE_MAX_LENGTH = 30

interface FormErrors {
  unitCode?: string
  facilityId?: string
  unitTypeId?: string
  price?: string
}

/** Adds one storage unit to a facility. Price is optional; the unit type's standard price applies when empty. */
export function CreateStorageUnitModal(props: CreateStorageUnitModalProps) {
  if (!props.open) return null
  return <CreateStorageUnitDialog {...props} />
}

function CreateStorageUnitDialog({ onClose, facilities, defaultFacilityId, onCreated }: CreateStorageUnitModalProps) {
  const typesQuery = useAsyncData((signal) => storageUnitService.getUnitTypes({ signal }), [])
  const unitTypes = useMemo(() => typesQuery.data ?? [], [typesQuery.data])

  const [unitCode, setUnitCode] = useState('')
  const [facilityId, setFacilityId] = useState(defaultFacilityId ?? facilities[0]?.id ?? '')
  const [chosenTypeId, setChosenTypeId] = useState('')
  const [floorLevel, setFloorLevel] = useState(FLOOR_OPTIONS[0].value)
  const [price, setPrice] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const unitTypeId = chosenTypeId || unitTypes[0]?.id || ''
  const selectedType = unitTypes.find((type) => type.id === unitTypeId)

  const validate = (): { values: { code: string; price?: number } } | null => {
    const next: FormErrors = {}
    const code = unitCode.trim()
    if (!code) next.unitCode = 'Nhập mã kho, ví dụ A-101.'
    else if (code.length > UNIT_CODE_MAX_LENGTH) next.unitCode = `Mã kho tối đa ${UNIT_CODE_MAX_LENGTH} ký tự.`
    else if (!UNIT_CODE_PATTERN.test(code)) next.unitCode = 'Mã kho chỉ gồm chữ cái, chữ số, dấu gạch ngang, gạch dưới hoặc dấu chấm, không có khoảng trắng.'
    if (!facilityId) next.facilityId = 'Chọn cơ sở.'
    if (!unitTypeId) next.unitTypeId = 'Chọn loại kho.'
    let customPrice: number | undefined
    if (price.trim()) {
      customPrice = Number(price)
      if (!Number.isFinite(customPrice) || customPrice <= 0) next.price = 'Giá thuê phải lớn hơn 0.'
    }
    setErrors(next)
    return Object.keys(next).length > 0 ? null : { values: { code, price: customPrice } }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    // A server error from the previous attempt must not stay on screen next to fresh field errors.
    setSubmitError(null)
    const result = validate()
    if (!result) return
    setIsSubmitting(true)
    try {
      const created = await storageUnitService.createUnit({
        unitCode: result.values.code,
        floorLevel,
        facilityId,
        unitTypeId,
        ...(result.values.price !== undefined ? { pricePerMonth: result.values.price } : {}),
      })
      onCreated(created)
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Không thể thêm kho. Vui lòng thử lại.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!isSubmitting}
      title="Tạo kho mới"
      description="Nhập thông tin kho để đưa vào danh sách của cơ sở."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button
            type="submit"
            form="create-storage-unit-form"
            loading={isSubmitting}
            disabled={typesQuery.isLoading || unitTypes.length === 0}
          >
            Tạo kho
          </Button>
        </>
      }
    >
      <form id="create-storage-unit-form" onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4" noValidate>
        {submitError ? (
          <Alert tone="danger" title="Không thể tạo kho" onDismiss={() => setSubmitError(null)}>
            {submitError}
          </Alert>
        ) : null}
        {typesQuery.error ? (
          <Alert
            tone="danger"
            title="Không tải được danh sách loại kho"
            action={
              <Button size="sm" variant="secondary" onClick={() => void typesQuery.reload()}>
                Thử lại
              </Button>
            }
          >
            {getApiErrorMessage(typesQuery.error)}
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Mã kho" required error={errors.unitCode}>
            <Input
              value={unitCode}
              onChange={(event) => {
                setUnitCode(event.target.value)
                setErrors((current) => (current.unitCode ? { ...current, unitCode: undefined } : current))
              }}
              maxLength={UNIT_CODE_MAX_LENGTH}
              placeholder="Ví dụ: A-101"
              className="font-mono"
            />
          </Field>
          <Field label="Tầng" required hint="Tầng quyết định vị trí kho trên sơ đồ, không phụ thuộc mã kho.">
            <Select value={floorLevel} onChange={(event) => setFloorLevel(event.target.value)} options={FLOOR_OPTIONS} />
          </Field>
          <Field label="Cơ sở" required error={errors.facilityId}>
            <Select
              value={facilityId}
              onChange={(event) => setFacilityId(event.target.value)}
              disabled={facilities.length <= 1}
              placeholder="Chọn cơ sở"
              options={facilities.map((facility) => ({ value: facility.id, label: facility.name }))}
            />
          </Field>
          <Field label="Loại kho" required error={errors.unitTypeId}>
            <Select
              value={unitTypeId}
              onChange={(event) => setChosenTypeId(event.target.value)}
              disabled={typesQuery.isLoading || unitTypes.length === 0}
              placeholder={typesQuery.isLoading ? 'Đang tải loại kho…' : 'Chọn loại kho'}
              options={unitTypes.map((type) => ({ value: type.id, label: getUnitTypeLabel(type.typeName) }))}
            />
          </Field>
        </div>

        {selectedType ? (
          <div className="rounded-lg border border-line bg-surface-2 p-3">
            <DescriptionList
              columns={3}
              items={[
                { label: 'Diện tích', value: `${formatNumber(selectedType.areaSqm)} m²` },
                { label: 'Kích thước', value: selectedType.dimensions },
                { label: 'Giá chuẩn mỗi tháng', value: formatCurrency(selectedType.basePricePerMonth) },
              ]}
            />
          </div>
        ) : null}

        {!typesQuery.isLoading && !typesQuery.error && unitTypes.length === 0 ? (
          <Alert tone="warning">Hệ thống chưa có loại kho nào để chọn.</Alert>
        ) : null}

        <Field label="Giá thuê riêng mỗi tháng (₫)" optional error={errors.price} hint="Để trống để dùng giá chuẩn của loại kho.">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            step={1000}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder={selectedType ? String(selectedType.basePricePerMonth) : undefined}
            className="tabular-nums"
          />
        </Field>
      </form>
    </Modal>
  )
}
