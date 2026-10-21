import React, { useState } from 'react'
import type { Booking, BookingRescheduleEligibility, BookingRescheduleResponse } from '../../types'
import { bookingService } from '../../services/bookingService'
import { useAsyncData } from '../../hooks/useAsyncData'
import { getApiErrorMessage } from '../../lib/apiError'
import { formatCurrency, formatDate, formatDateTime, formatTime } from '../../lib/format'
import { BOOKING_HOLD_DEFAULTS } from '../../utils/facilityPolicyDefaults'
import { Alert, Button, DescriptionList, Field, Input, Modal, Skeleton } from '../ui'
import { AppointmentPanel } from './reschedule/AppointmentPanel'
import { addHoursToAppointment, addMonthsToISODate, getDefaultAppointmentDate } from './reschedule/helpers'
import { ModalSuccess } from './shared/ModalSuccess'
import { ReasonPicker } from './shared/ReasonPicker'
import { EMPTY_REASON, RESCHEDULE_REASON_PRESETS, resolveReason, type ReasonValue } from './shared/reason'

interface BookingRescheduleModalProps {
  isOpen: boolean
  booking: Booking | null
  onClose: () => void
  onSuccess: (updatedBooking: Booking) => void | Promise<void>
}

const FORM_ID = 'booking-reschedule-form'
const DEFAULT_OPEN_TIME = '08:00'
const DEFAULT_CLOSE_TIME = '20:00'
const DEFAULT_APPOINTMENT_TIME = '09:00'

export const BookingRescheduleModal: React.FC<BookingRescheduleModalProps> = ({ isOpen, booking, onClose, onSuccess }) => {
  if (!isOpen || !booking) return null
  return <RescheduleDialog booking={booking} onClose={onClose} onSuccess={onSuccess} />
}

interface RescheduleDialogProps {
  booking: Booking
  onClose: () => void
  onSuccess: BookingRescheduleModalProps['onSuccess']
}

function RescheduleDialog({ booking, onClose, onSuccess }: RescheduleDialogProps) {
  const eligibilityQuery = useAsyncData((signal) => bookingService.getRescheduleEligibility(booking.id, { signal }), [booking.id])
  const eligibility = eligibilityQuery.data

  const [dateInput, setDateInput] = useState('')
  const [timeInput, setTimeInput] = useState(DEFAULT_APPOINTMENT_TIME)
  const [reason, setReason] = useState<ReasonValue>(EMPTY_REASON)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<BookingRescheduleResponse | null>(null)

  const newDate = dateInput || (eligibility ? getDefaultAppointmentDate(eligibility.allowedMinDate) : '')
  const openTime = eligibility?.facilityOpenTime ? formatTime(eligibility.facilityOpenTime) : DEFAULT_OPEN_TIME
  const closeTime = eligibility?.facilityCloseTime ? formatTime(eligibility.facilityCloseTime) : DEFAULT_CLOSE_TIME

  let dateError: string | undefined
  if (!newDate) dateError = 'Chọn ngày hẹn nhận kho mới.'
  else if (eligibility?.allowedMinDate && newDate < eligibility.allowedMinDate) dateError = 'Ngày hẹn phải từ ngày cho phép sớm nhất.'
  else if (eligibility?.allowedMaxDate && newDate > eligibility.allowedMaxDate) dateError = 'Ngày hẹn vượt quá thời hạn cho phép.'

  let timeError: string | undefined
  if (!timeInput) timeError = 'Chọn giờ hẹn nhận kho.'
  else if (timeInput < openTime || timeInput > closeTime) timeError = `Giờ hẹn phải nằm trong khung giờ ${openTime} - ${closeTime}.`

  const canSubmit = !dateError && !timeError && !isSubmitting

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const response = await bookingService.rescheduleBooking(booking.id, {
        newStartDate: newDate,
        newExpectedCheckInAt: `${newDate}T${timeInput}:00`,
        newCheckInTime: timeInput,
        reason: resolveReason(reason, 'Khách hàng điều chỉnh lịch hẹn nhận kho'),
      })
      setResult(response)
      // The appointment is already saved: a failed refresh in the parent must not look like a failed reschedule.
      void Promise.resolve(onSuccess(response.booking)).catch(() => undefined)
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Đổi lịch hẹn nhận kho thất bại. Vui lòng kiểm tra lại thời gian hoặc liên hệ hỗ trợ.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const showForm = Boolean(eligibility?.eligible) && !result
  const footer = showForm ? (
    <>
      <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
        Hủy
      </Button>
      <Button type="submit" form={FORM_ID} loading={isSubmitting} disabled={!canSubmit}>
        Xác nhận đổi lịch
      </Button>
    </>
  ) : (
    <Button variant={result ? 'primary' : 'secondary'} onClick={onClose}>
      Đóng
    </Button>
  )

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Đổi lịch hẹn nhận kho"
      description={`Đơn ${booking.bookingCode} · Kho ${booking.unitCode} · ${booking.facilityName || 'Boxora'}`}
      dismissible={!isSubmitting}
      footer={footer}
    >
      {result ? (
        <RescheduleSuccess result={result} />
      ) : eligibilityQuery.isLoading ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
          <Skeleton className="h-16" />
          <Skeleton className="h-24" />
        </div>
      ) : !eligibility ? (
        <Alert
          tone="danger"
          title="Không kiểm tra được điều kiện đổi lịch"
          action={
            <Button size="sm" variant="secondary" onClick={() => void eligibilityQuery.reload()}>
              Thử lại
            </Button>
          }
        >
          {getApiErrorMessage(eligibilityQuery.error, 'Không thể kiểm tra điều kiện đổi lịch.')}
        </Alert>
      ) : !eligibility.eligible ? (
        <IneligibleNotice eligibility={eligibility} />
      ) : (
        <form id={FORM_ID} onSubmit={event => void handleSubmit(event)} className="flex flex-col gap-5" noValidate>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <AppointmentPanel
              title="Lịch hẹn hiện tại"
              badge="Đang áp dụng"
              headline={formatDateTime(eligibility.currentAppointmentAt)}
              items={[
                { label: 'Kỳ hạn dự kiến', value: `${formatDate(eligibility.expectedStartDate)} → ${formatDate(eligibility.expectedEndDate)}` },
                { label: 'Hạn giữ chỗ', value: formatDateTime(eligibility.holdExpiresAt) },
              ]}
            />
            <AppointmentPanel
              title="Lịch hẹn mới"
              badge="Dự kiến"
              emphasis
              headline={newDate && timeInput ? `${formatDate(newDate)} · ${timeInput}` : '—'}
              items={[
                {
                  label: 'Kỳ hạn dự kiến',
                  value: `${formatDate(newDate)} → ${formatDate(addMonthsToISODate(newDate, eligibility.rentalMonths))}`,
                },
                ...buildHoldItem(booking, newDate, timeInput),
              ]}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Ngày hẹn nhận kho mới"
              required
              error={dateError}
              hint={`Cho phép từ ${formatDate(eligibility.allowedMinDate)} đến ${formatDate(eligibility.allowedMaxDate)}`}
            >
              <Input
                type="date"
                min={eligibility.allowedMinDate}
                max={eligibility.allowedMaxDate}
                value={newDate}
                onChange={event => setDateInput(event.target.value)}
                disabled={isSubmitting}
              />
            </Field>
            <Field label="Giờ hẹn nhận kho" required error={timeError} hint={`Khung giờ của cơ sở: ${openTime} - ${closeTime}`}>
              <Input
                type="time"
                min={openTime}
                max={closeTime}
                value={timeInput}
                onChange={event => setTimeInput(event.target.value)}
                disabled={isSubmitting}
              />
            </Field>
          </div>

          <ReasonPicker
            label="Lý do đổi lịch"
            presets={RESCHEDULE_REASON_PRESETS}
            value={reason}
            onChange={setReason}
            notePlaceholder="Nhập thêm chi tiết lý do đổi lịch nếu cần"
            disabled={isSubmitting}
          />

          <ScheduleNotice eligibility={eligibility} />

          {submitError ? (
            <Alert tone="danger" title="Chưa đổi được lịch hẹn">
              {submitError}
            </Alert>
          ) : null}
        </form>
      )}
    </Modal>
  )
}

/** "Hạn giữ chỗ" for the proposed appointment, from the booking's effective grace hours. */
function buildHoldItem(booking: Booking, date: string, time: string) {
  const graceHours = booking.holdGraceHours ?? BOOKING_HOLD_DEFAULTS.holdGraceHours
  const holdUntil = addHoursToAppointment(date, time, graceHours)
  return [{ label: `Hạn giữ chỗ (+${graceHours} giờ)`, value: holdUntil ? formatDateTime(holdUntil) : null }]
}

function IneligibleNotice({ eligibility }: { eligibility: BookingRescheduleEligibility }) {
  const restrictions = eligibility.restrictions ?? []
  return (
    <Alert tone="warning" title="Đơn này hiện không thể đổi lịch hẹn">
      <p>{eligibility.reasonIfNotEligible || 'Trạng thái đơn hiện tại không cho phép đổi lịch hẹn nhận kho.'}</p>
      {restrictions.length > 0 ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-dense">
          {restrictions.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </Alert>
  )
}

/** Fee / term guarantees. The rules come from the eligibility response; no policy figures are hard-coded. */
function ScheduleNotice({ eligibility }: { eligibility: BookingRescheduleEligibility }) {
  const restrictions = eligibility.restrictions ?? []
  return (
    <Alert tone="info" title="Điều kiện khi đổi lịch" icon={null}>
      <ul className="list-disc space-y-1 pl-4 text-dense">
        <li>
          Giá thuê {formatCurrency(eligibility.monthlyFee)}/tháng, tiền cọc {formatCurrency(eligibility.depositAmount)} và kỳ hạn{' '}
          {eligibility.rentalMonths} tháng giữ nguyên.
        </li>
        {restrictions.map(item => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Alert>
  )
}

function RescheduleSuccess({ result }: { result: BookingRescheduleResponse }) {
  const updated = result.booking
  return (
    <ModalSuccess title="Đã đổi lịch hẹn nhận kho" description={result.message}>
      <div className="rounded-lg border border-line p-4">
        <DescriptionList
          layout="inline"
          items={[
            { label: 'Lịch hẹn mới', value: <span className="tabular-nums">{formatDateTime(updated.expectedCheckInAt)}</span> },
            {
              label: 'Kỳ hạn thuê dự kiến',
              value: (
                <span className="tabular-nums">
                  {formatDate(updated.startDate)} → {formatDate(updated.endDate)} ({updated.rentalMonths} tháng)
                </span>
              ),
            },
            { label: 'Hạn giữ chỗ', value: <span className="tabular-nums">{formatDateTime(updated.holdExpiresAt)}</span> },
          ]}
        />
      </div>
    </ModalSuccess>
  )
}

export default BookingRescheduleModal
