import { useState, type FormEvent } from 'react'
import { Alert, Button, DescriptionList, Field, Modal, Select, Textarea } from '@/components/ui'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatDate, formatDateTime } from '@/lib/format'
import { bookingService } from '@/services/bookingService'
import { userService } from '@/services/userService'
import type { Booking } from '@/types'

interface AssignReceptionDialogProps {
  open: boolean
  onClose: () => void
  booking: Booking
  facilityId: string
  /**
   * `assign` (default): pick the front-desk staff member of a confirmed booking.
   * `approve`: approve a request waiting for a decision; the staff member is optional.
   */
  mode?: 'assign' | 'approve'
  onAssigned: (booking: Booking) => void
}

/**
 * Assigns the front-desk staff member who will receive the customer of a confirmed booking, or approves a pending
 * request (POST /bookings/{id}/decision with approved=true, assignedStaffId and notes).
 */
export function AssignReceptionDialog(props: AssignReceptionDialogProps) {
  if (!props.open) return null
  return <AssignReceptionForm {...props} />
}

function AssignReceptionForm({ onClose, booking, facilityId, mode = 'assign', onAssigned }: AssignReceptionDialogProps) {
  const approving = mode === 'approve'
  const staffQuery = useAsyncData(
    async (signal) =>
      (await userService.getAllUsers({ role: 'STAFF', facilityId }, { signal })).data.filter(
        (member) => member.isActive !== false && (!member.facilityId || member.facilityId === facilityId),
      ),
    [facilityId],
  )
  const staff = staffQuery.data ?? []
  const [staffId, setStaffId] = useState(booking.assignedStaffId ?? '')
  const [notes, setNotes] = useState(booking.staffAssignmentNotes ?? '')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const staffError = touched && !staffId && !approving ? 'Chọn nhân viên tiếp đón.' : undefined

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!staffId && !approving) return
    setIsSubmitting(true)
    setError(null)
    try {
      onAssigned(await bookingService.decideRequest(booking.id, true, staffId || undefined, notes.trim() || undefined))
    } catch (err) {
      setError(getApiErrorMessage(err, approving ? 'Không thể duyệt yêu cầu thuê kho.' : 'Không thể phân công nhân viên tiếp đón.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!isSubmitting}
      title={approving ? 'Duyệt yêu cầu thuê kho' : 'Phân công nhân viên tiếp đón'}
      description={
        approving
          ? booking.signingMethod === 'IN_PERSON'
            ? 'Đơn chuyển sang đã xác nhận, khách đến quầy ký hợp đồng và đặt cọc.'
            : 'Đơn chuyển sang chờ thanh toán, khách thanh toán trực tuyến trong thời hạn giữ chỗ.'
          : 'Nhân viên được phân công sẽ đối soát giấy tờ, nghiệm thu kho và bàn giao mã PIN cho khách.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" form="assign-reception-form" loading={isSubmitting} disabled={!approving && staff.length === 0}>
            {approving ? 'Duyệt yêu cầu' : 'Phân công'}
          </Button>
        </>
      }
    >
      <form id="assign-reception-form" onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
        {error ? (
          <Alert tone="danger" title={approving ? 'Không thể duyệt' : 'Không thể phân công'} onDismiss={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        <DescriptionList
          items={[
            { label: 'Khách hàng', value: booking.customerName },
            { label: 'Mã đặt kho', value: booking.bookingCode, mono: true },
            { label: 'Kho', value: booking.unitCode, mono: true },
            {
              label: 'Ngày nhận',
              value: booking.expectedCheckInAt ? formatDateTime(booking.expectedCheckInAt) : formatDate(booking.startDate),
            },
          ]}
        />
        {staffQuery.error ? (
          <Alert
            tone="warning"
            title="Không tải được danh sách nhân viên"
            action={
              <Button size="sm" variant="secondary" onClick={() => void staffQuery.reload()}>
                Thử lại
              </Button>
            }
          >
            {getApiErrorMessage(staffQuery.error)}
          </Alert>
        ) : !staffQuery.isLoading && staff.length === 0 ? (
          <Alert tone="warning">Cơ sở chưa có nhân viên đang hoạt động để phân công.</Alert>
        ) : (
          <Field label="Nhân viên tiếp đón" required={!approving} optional={approving} error={staffError}>
            <Select
              value={staffId}
              onChange={(event) => setStaffId(event.target.value)}
              disabled={staffQuery.isLoading}
              placeholder={approving ? undefined : staffQuery.isLoading ? 'Đang tải nhân viên…' : 'Chọn nhân viên'}
              options={[
                ...(approving ? [{ value: '', label: 'Chưa phân công, chọn sau' }] : []),
                ...staff.map((member) => ({ value: member.id, label: `${member.fullName || member.username} (${member.email})` })),
              ]}
            />
          </Field>
        )}
        <Field label="Ghi chú cho nhân viên" optional>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Ví dụ: khách cần hỗ trợ vận chuyển, gọi trước 30 phút"
          />
        </Field>
      </form>
    </Modal>
  )
}
