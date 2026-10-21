import { useMemo, useState, type FormEvent } from 'react'
import { Alert, Button, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { SHIFT_OPTIONS, getStaffAssignmentStatusMeta } from '@/constants/statusMeta'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatDate, todayISO } from '@/lib/format'
import { getAssignmentStaffName, staffAssignmentService, type StaffAssignmentResponse } from '@/services/staffAssignmentService'
import type { Facility, User } from '@/types'
import { parseFacilityLayoutConfig } from '@/utils/facilityLayout'
import { allowedStatuses, canEditShiftDetails } from '../shifts/shiftRules'

type Shift = 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'FULL_DAY'
type AssignmentStatus = 'ASSIGNED' | 'CHECKED_IN' | 'COMPLETED' | 'ABSENT'

interface ShiftAssignmentModalProps {
  open: boolean
  onClose: () => void
  facilityId: string
  facility?: Facility
  /** Active staff of the facility, already loaded by the roster page (create mode). */
  staff: User[]
  defaultStaffId?: string
  defaultDate?: string
  /** Set to edit this assignment (PUT /staff-assignments/{id}) instead of creating a new one. */
  assignment?: StaffAssignmentResponse
  /** Called with the saved assignment, for both create and edit. */
  onAssigned: (assignment: StaffAssignmentResponse) => void
}

const FRONT_DESK_ZONE = 'Quầy tiếp đón'

/** Assigns one staff member to a shift and zone for a day (POST), or edits an existing assignment (PUT). */
export function ShiftAssignmentModal(props: ShiftAssignmentModalProps) {
  if (!props.open) return null
  return <ShiftAssignmentDialog {...props} />
}

function ShiftAssignmentDialog({
  onClose,
  facilityId,
  facility,
  staff,
  defaultStaffId,
  defaultDate,
  assignment,
  onAssigned,
}: ShiftAssignmentModalProps) {
  const today = todayISO()
  const isEdit = Boolean(assignment)
  /** Shift and zone are fixed once the shift started or ended; notes and status stay editable. */
  const detailsEditable = !assignment || canEditShiftDetails(assignment, today)

  const [staffId, setStaffId] = useState(defaultStaffId ?? '')
  const [shift, setShift] = useState<Shift>((assignment?.shift as Shift | undefined) ?? 'MORNING')
  const [date, setDate] = useState(defaultDate && defaultDate >= today ? defaultDate : today)
  const [zone, setZone] = useState(assignment?.assignedZone ?? '')
  const [status, setStatus] = useState<string>(assignment?.status ?? 'ASSIGNED')
  const [notes, setNotes] = useState(assignment?.notes ?? '')
  const [touched, setTouched] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const savedZone = assignment?.assignedZone
  const layoutConfig = facility?.layoutConfig
  const zoneOptions = useMemo(() => {
    const layout = parseFacilityLayoutConfig(layoutConfig)
    const names = [layout.zoneAName, layout.zoneBName, layout.zoneCName, FRONT_DESK_ZONE]
    // A zone saved earlier (for example from an older layout) must stay selectable.
    if (savedZone && !names.includes(savedZone)) names.push(savedZone)
    return [{ value: '', label: 'Không chỉ định' }, ...names.map((name) => ({ value: name, label: name }))]
  }, [layoutConfig, savedZone])

  const statusOptions = useMemo(
    () => (assignment ? allowedStatuses(assignment, today).map((value) => ({ value, label: getStaffAssignmentStatusMeta(value).label })) : []),
    [assignment, today],
  )

  const staffError = touched && !isEdit && !staffId ? 'Chọn nhân viên trực ca.' : undefined
  const dateError = touched && !isEdit && (!date || date < today) ? 'Chọn ngày từ hôm nay trở đi.' : undefined

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!assignment && (!staffId || !date || date < today)) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      if (assignment) {
        onAssigned(
          await staffAssignmentService.updateAssignment(assignment.id, {
            ...(detailsEditable ? { shift, assignedZone: zone } : {}),
            ...(status !== assignment.status ? { status: status as AssignmentStatus } : {}),
            notes: notes.trim(),
          }),
        )
        return
      }
      onAssigned(
        await staffAssignmentService.createAssignment({
          staffId,
          facilityId,
          assignedDate: date,
          shift,
          assignedZone: zone || undefined,
          roleInShift: 'PRIMARY_STAFF',
          notes: notes.trim() || undefined,
        }),
      )
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Không thể lưu phân công ca trực.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const facilityLabel = facility?.name ?? assignment?.facilityName

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!isSubmitting}
      title={isEdit ? 'Chỉnh sửa ca trực' : 'Phân công ca trực'}
      description={
        isEdit
          ? `${getAssignmentStaffName(assignment as StaffAssignmentResponse)} · ${formatDate(assignment?.assignedDate)}${facilityLabel ? ` · ${facilityLabel}` : ''}`
          : `Chọn nhân viên, ca và khu vực phụ trách cho một ngày${facilityLabel ? ` tại ${facilityLabel}` : ''}.`
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" form="shift-assignment-form" loading={isSubmitting} disabled={!isEdit && staff.length === 0}>
            {isEdit ? 'Lưu thay đổi' : 'Phân công'}
          </Button>
        </>
      }
    >
      <form id="shift-assignment-form" onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4" noValidate>
        {submitError ? (
          <Alert tone="danger" title={isEdit ? 'Không thể lưu thay đổi' : 'Không thể phân công'} onDismiss={() => setSubmitError(null)}>
            {submitError}
          </Alert>
        ) : null}
        {!isEdit && staff.length === 0 ? <Alert tone="warning">Cơ sở chưa có nhân viên đang hoạt động để phân công.</Alert> : null}
        {isEdit && !detailsEditable ? (
          <Alert tone="info">
            Ca này đã diễn ra hoặc đã vào ca nên không đổi được ca và khu vực. Bạn vẫn cập nhật được trạng thái và ghi chú.
          </Alert>
        ) : null}

        {isEdit ? (
          <Field label="Nhân viên">
            <Input value={getAssignmentStaffName(assignment as StaffAssignmentResponse)} disabled readOnly />
          </Field>
        ) : (
          <Field label="Nhân viên" required error={staffError}>
            <Select
              value={staffId}
              onChange={(event) => setStaffId(event.target.value)}
              disabled={staff.length === 0}
              placeholder="Chọn nhân viên"
              options={staff.map((member) => ({ value: member.id, label: `${member.fullName || member.username} (${member.email})` }))}
            />
          </Field>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Ca làm việc" required>
            <Select value={shift} onChange={(event) => setShift(event.target.value as Shift)} options={SHIFT_OPTIONS} disabled={!detailsEditable} />
          </Field>
          <Field label="Ngày trực" required error={dateError}>
            {isEdit ? (
              <Input type="date" value={assignment?.assignedDate ?? date} disabled readOnly />
            ) : (
              <Input type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} />
            )}
          </Field>
        </div>

        <Field label="Khu vực phụ trách" optional>
          <Select value={zone} onChange={(event) => setZone(event.target.value)} options={zoneOptions} disabled={!detailsEditable} />
        </Field>

        {isEdit ? (
          <Field
            label="Trạng thái"
            hint={statusOptions.length <= 1 ? 'Chưa thể đổi trạng thái ở thời điểm này.' : 'Chỉ đổi được theo thứ tự: đã phân công, vào ca, hoàn thành.'}
          >
            <Select value={status} onChange={(event) => setStatus(event.target.value)} options={statusOptions} disabled={statusOptions.length <= 1} />
          </Field>
        ) : null}

        <Field label="Ghi chú nhiệm vụ" optional>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Ví dụ: tuần tra khu A, hỗ trợ bàn giao buổi chiều"
          />
        </Field>
      </form>
    </Modal>
  )
}
