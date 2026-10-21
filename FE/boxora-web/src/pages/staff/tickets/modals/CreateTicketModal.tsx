import { useMemo, useState, type FormEvent } from 'react'
import { Button, Field, Input, Modal, Select, Textarea, useToast } from '@/components/ui'
import { getUnitStatusMeta } from '@/constants/statusMeta'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { storageUnitService } from '@/services/storageUnitService'
import type { CreateSupportTicketRequest } from '@/services/supportTicketService'
import { supportTicketService } from '@/services/supportTicketService'
import type { Facility } from '@/types'
import { formatFloor, sortFloors } from '../../dashboard/utils/frontDesk'
import { EvidencePicker } from '../components/EvidencePicker'
import { TICKET_CATEGORY_OPTIONS, TICKET_PRIORITY_OPTIONS } from '../constants'

interface CreateTicketModalProps {
  facilities: Facility[]
  defaultFacilityId: string
  /** Staff and facility managers can only report for their own facility. */
  lockFacility: boolean
  onClose: () => void
  onSubmit: (payload: CreateSupportTicketRequest) => Promise<boolean>
}

interface FormErrors {
  title?: string
  description?: string
}

export function CreateTicketModal({ facilities, defaultFacilityId, lockFacility, onClose, onSubmit }: CreateTicketModalProps) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<string>(TICKET_CATEGORY_OPTIONS[0].value)
  const [priority, setPriority] = useState<string>('MEDIUM')
  const [facilityId, setFacilityId] = useState(defaultFacilityId)
  const [unitId, setUnitId] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  const unitsQuery = useAsyncData(signal => storageUnitService.getUnits({ facilityId }, { signal }), [facilityId], {
    enabled: Boolean(facilityId),
    keepPreviousData: false,
  })
  const units = unitsQuery.data
  const selectedUnit = units?.find(unit => unit.id === unitId)

  // ~50 units in one flat list is hard to scan: group them by floor (in floor order), then by unit code.
  const unitGroups = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof units>>()
    for (const unit of units ?? []) {
      const label = formatFloor(unit.floorLevel) || 'Chưa rõ tầng'
      groups.set(label, [...(groups.get(label) ?? []), unit])
    }
    const labels = sortFloors(Array.from(groups.keys()).filter(label => label !== 'Chưa rõ tầng'))
    if (groups.has('Chưa rõ tầng')) labels.push('Chưa rõ tầng')
    return labels.map(label => ({
      label,
      units: [...(groups.get(label) ?? [])].sort((a, b) => a.unitCode.localeCompare(b.unitCode, 'vi', { numeric: true })),
    }))
  }, [units])

  const facilityOptions = useMemo(() => {
    const options = facilities.map(f => ({ value: f.id, label: f.name }))
    // The assigned facility may be missing from the list while it loads.
    if (defaultFacilityId && !options.some(option => option.value === defaultFacilityId)) {
      options.unshift({ value: defaultFacilityId, label: 'Cơ sở được phân công' })
    }
    return options
  }, [facilities, defaultFacilityId])

  const errors: FormErrors = touched
    ? {
        title: title.trim() ? undefined : 'Nhập tiêu đề sự cố.',
        description: description.trim() ? undefined : 'Mô tả hiện trạng để người xử lý nắm được tình hình.',
      }
    : {}

  const unitHint = unitsQuery.error
    ? 'Không tải được danh sách kho. Bạn có thể bỏ qua và ghi vị trí trong phần mô tả.'
    : selectedUnit
      ? selectedUnit.bookingId
        ? 'Ticket sẽ liên kết với đơn thuê hiện tại của kho này.'
        : 'Kho này chưa có đơn thuê nên ticket được ghi theo cơ sở; mã kho được thêm vào mô tả.'
      : undefined

  const handleFacilityChange = (nextId: string) => {
    setFacilityId(nextId)
    setUnitId('')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!title.trim() || !description.trim()) return

    setSaving(true)
    let evidenceUrls: string[] = []
    try {
      for (const file of files) {
        const uploaded = await supportTicketService.uploadEvidence(file)
        evidenceUrls = [...evidenceUrls, uploaded.fileUrl]
      }
    } catch (err) {
      toast.error('Không thể tải ảnh lên', getApiErrorMessage(err))
      setSaving(false)
      return
    }

    const unitNote = selectedUnit && !selectedUnit.bookingId ? `Kho liên quan: ${selectedUnit.unitCode}` : ''
    const ok = await onSubmit({
      category,
      title: title.trim(),
      description: [description.trim(), unitNote].filter(Boolean).join('\n\n'),
      priority,
      facilityId: selectedUnit?.facilityId || facilityId || undefined,
      bookingId: selectedUnit?.bookingId || undefined,
      evidenceUrls: evidenceUrls.length > 0 ? evidenceUrls : undefined,
    })
    if (ok) onClose()
    else setSaving(false)
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      size="md"
      title="Tạo ticket sự cố"
      description="Ghi nhận sự cố tại hiện trường để điều phối xử lý."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" form="create-ticket-form" loading={saving}>
            Tạo ticket
          </Button>
        </>
      }
    >
      <form id="create-ticket-form" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Tiêu đề" required error={errors.title}>
          <Input value={title} onChange={event => setTitle(event.target.value)} placeholder="Ví dụ: kẹt cửa cuốn kho A-102" />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Danh mục">
            <Select value={category} onChange={event => setCategory(event.target.value)} options={TICKET_CATEGORY_OPTIONS} />
          </Field>
          <Field label="Mức ưu tiên">
            <Select value={priority} onChange={event => setPriority(event.target.value)} options={TICKET_PRIORITY_OPTIONS} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Cơ sở">
            <Select
              value={facilityId}
              onChange={event => handleFacilityChange(event.target.value)}
              options={facilityOptions}
              disabled={lockFacility || facilityOptions.length <= 1}
            />
          </Field>
          <Field label="Kho liên quan" optional hint={unitHint}>
            <Select
              value={unitId}
              onChange={event => setUnitId(event.target.value)}
              options={[{ value: '', label: 'Không gắn kho cụ thể (khu vực chung)' }]}
              disabled={!facilityId || unitsQuery.isLoading}
            >
              {unitGroups.map(group => (
                <optgroup key={group.label} label={`${group.label} · ${group.units.length} kho`}>
                  {group.units.map(unit => (
                    <option key={unit.id} value={unit.id}>
                      {`${unit.unitCode} · ${getUnitStatusMeta(unit.status).label}`}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Mô tả hiện trường" required error={errors.description}>
          <Textarea
            rows={3}
            value={description}
            onChange={event => setDescription(event.target.value)}
            placeholder="Nguyên nhân, hiện trạng hư hỏng hoặc yêu cầu phối hợp kỹ thuật."
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-fg">
            Ảnh minh chứng <span className="font-normal text-fg-subtle">(không bắt buộc)</span>
          </p>
          <EvidencePicker files={files} onChange={setFiles} disabled={saving} />
          <p className="text-xs text-fg-subtle">Tối đa 3 ảnh JPG, PNG hoặc WEBP, mỗi ảnh dưới 10 MB.</p>
        </div>
      </form>
    </Modal>
  )
}
