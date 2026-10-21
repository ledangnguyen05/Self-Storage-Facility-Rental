import { useMemo, useState, type FormEvent } from 'react'
import { Alert, Button, Field, Modal, Select, Textarea } from '@/components/ui'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import type { SupportTicketRecord } from '@/services/supportTicketService'
import { userService } from '@/services/userService'
import { TicketSummary } from '../components/TicketSummary'
import { TICKET_PRIORITY_OPTIONS } from '../constants'
import type { AssignPayload } from '../hooks/useIncidentTickets'
import { getTicketCode, normalizePriority } from '../ticketUtils'

interface AssignTicketModalProps {
  ticket: SupportTicketRecord
  /** Facility whose staff can be assigned: the ticket's own facility, else the manager's. */
  fallbackFacilityId?: string
  onClose: () => void
  onSubmit: (ticket: SupportTicketRecord, payload: AssignPayload) => Promise<boolean>
}

export function AssignTicketModal({ ticket, fallbackFacilityId, onClose, onSubmit }: AssignTicketModalProps) {
  const facilityId = ticket.facilityId || fallbackFacilityId
  const staffQuery = useAsyncData(
    async signal => (await userService.getAllUsers({ role: 'STAFF', facilityId }, { signal })).data,
    [facilityId]
  )

  const [staffId, setStaffId] = useState(ticket.assignedStaffId ?? '')
  const [priority, setPriority] = useState(normalizePriority(ticket.priority))
  const [notes, setNotes] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  const staffOptions = useMemo(
    () =>
      (staffQuery.data ?? []).map(staff => ({
        value: staff.id,
        label: `${staff.fullName || staff.username} (${staff.email})`,
      })),
    [staffQuery.data]
  )
  const hasNoStaff = !staffQuery.isLoading && !staffQuery.error && staffOptions.length === 0

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!staffId) return
    setSaving(true)
    const ok = await onSubmit(ticket, {
      assignedStaffId: staffId,
      notes: notes.trim() || undefined,
      priority,
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
      title={`Phân công ${getTicketCode(ticket)}`}
      description={`Chọn nhân viên phụ trách tại ${ticket.facilityName || 'cơ sở này'}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" form="assign-ticket-form" loading={saving} disabled={staffQuery.isLoading || hasNoStaff}>
            Phân công
          </Button>
        </>
      }
    >
      <form id="assign-ticket-form" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <TicketSummary ticket={ticket} />

        {staffQuery.error ? (
          <Alert
            tone="danger"
            title="Không tải được danh sách nhân viên"
            action={
              <Button size="sm" variant="secondary" onClick={() => void staffQuery.reload()}>
                Thử lại
              </Button>
            }
          >
            {getApiErrorMessage(staffQuery.error)}
          </Alert>
        ) : null}
        {hasNoStaff ? (
          <Alert tone="warning" title="Chưa có nhân viên">
            Cơ sở này chưa có nhân viên vận hành để phân công.
          </Alert>
        ) : null}

        <Field
          label="Nhân viên phụ trách"
          required
          error={touched && !staffId ? 'Chọn nhân viên phụ trách.' : undefined}
        >
          <Select
            value={staffId}
            onChange={event => setStaffId(event.target.value)}
            options={staffOptions}
            placeholder={staffQuery.isLoading ? 'Đang tải nhân viên…' : 'Chọn nhân viên'}
            disabled={staffQuery.isLoading || hasNoStaff}
          />
        </Field>

        <Field label="Mức ưu tiên">
          <Select value={priority} onChange={event => setPriority(event.target.value)} options={TICKET_PRIORITY_OPTIONS} />
        </Field>

        <Field label="Ghi chú phân công" optional>
          <Textarea
            rows={3}
            value={notes}
            onChange={event => setNotes(event.target.value)}
            placeholder="Chỉ đạo cho nhân viên. Ví dụ: kiểm tra nguồn khóa kho A-101 và pin dự phòng."
          />
        </Field>
      </form>
    </Modal>
  )
}
