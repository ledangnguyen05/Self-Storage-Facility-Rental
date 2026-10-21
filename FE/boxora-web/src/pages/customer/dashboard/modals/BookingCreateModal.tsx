import { useId, useState, type FormEvent } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Alert, Badge, Button, Checkbox, DescriptionList, Field, Input, Modal, Select, Stepper } from '@/components/ui'
import { getApiErrorMessage } from '@/lib/apiError'
import { addDays, formatCurrency, formatDate, formatDateTime, toLocalISODate, todayISO } from '@/lib/format'
import { bookingService } from '@/services/bookingService'
import type { Booking, StorageUnit } from '@/types'
import { BOOKING_HOLD_DEFAULTS } from '@/utils/facilityPolicyDefaults'
import { formatFacilityName } from '@/components/layout/useFacilityScope'
import { BookingQuoteSummary } from '../components/BookingQuoteSummary'
import { ChoiceCard } from '../components/ChoiceCard'
import {
  BOOKING_PACKAGES,
  BOOKING_WINDOW_DAYS,
  CHECK_IN_TIME_OPTIONS,
  CUSTOM_DAYS_MAX,
  CUSTOM_DAYS_MIN,
  type BookingPackageId,
} from '../constants'
import { useBookingQuote } from '../hooks/useBookingQuote'
import { formatArea, formatFloor } from '../lib/portal'

type Workflow = 'HOLD_ONLY' | 'ONLINE_NOW'

export interface BookingCreatedResult {
  booking: Booking
  /** True when the customer chose to pay online now (open the payment step next). */
  payOnline: boolean
  /** The quote's initial payment, the amount the payment step charges. */
  initialPaymentAmount?: number
}

interface BookingCreateModalProps {
  unit: StorageUnit
  onClose: () => void
  onCreated: (result: BookingCreatedResult) => void
  onViewBookings: () => void
}

const STEPS = [{ label: 'Kỳ hạn và lịch hẹn' }, { label: 'Xác nhận đặt chỗ' }]

/**
 * Booking wizard for an available unit. Mount it with `key={unit.id}` so each
 * opening starts with a fresh quote and no previous result.
 */
export function BookingCreateModal({ unit, onClose, onCreated, onViewBookings }: BookingCreateModalProps) {
  const today = todayISO()
  const maxDate = toLocalISODate(addDays(new Date(), BOOKING_WINDOW_DAYS))
  const timeSelectId = useId()
  const [step, setStep] = useState(0)
  const [packageId, setPackageId] = useState<BookingPackageId>('3m')
  const [customDays, setCustomDays] = useState(45)
  // Untouched defaults agree: the contract starts on the day the customer is expected to pick up the unit.
  const [defaultCheckIn] = useState(() => toLocalISODate(addDays(new Date(), 3)))
  const [startDate, setStartDate] = useState(defaultCheckIn)
  const [checkInDate, setCheckInDate] = useState(defaultCheckIn)
  // Until the customer edits the start date themselves, it follows the pick-up date.
  const [startDateEdited, setStartDateEdited] = useState(false)
  const [checkInTime, setCheckInTime] = useState(CHECK_IN_TIME_OPTIONS[0].value)
  const [workflow, setWorkflow] = useState<Workflow>('HOLD_ONLY')
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [created, setCreated] = useState<Booking | null>(null)

  const { term, quote, error: quoteError, isLoading: quoteLoading, isRefreshing: quoteRefreshing, reload: reloadQuote } =
    useBookingQuote(unit.id, packageId, customDays, startDate)
  const quoteReady = Boolean(quote) && !quoteLoading && !quoteRefreshing && !quoteError
  const holdGraceHours = quote?.holdGraceHours ?? BOOKING_HOLD_DEFAULTS.holdGraceHours

  const startDateError = !startDate || startDate < today || startDate > maxDate ? `Chọn ngày từ ${formatDate(today)} đến ${formatDate(maxDate)}.` : undefined
  const checkInError = !checkInDate || checkInDate < today || checkInDate > maxDate ? `Chọn ngày từ ${formatDate(today)} đến ${formatDate(maxDate)}.` : undefined
  const datesValid = !startDateError && !checkInError
  const facilityName = formatFacilityName(unit.facilityName || '') || '—'

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    if (step === 0) {
      if (datesValid) setStep(1)
      return
    }
    if (!quote || !quoteReady || !policyAccepted || !datesValid) return
    setSubmitting(true)
    setSubmitError(null)
    const payOnline = workflow === 'ONLINE_NOW'
    try {
      const booking = await bookingService.createBooking({
        storageUnitId: unit.id,
        startDate,
        rentalMonths: Math.max(1, Math.round(quote.rentalMonths || term.months)),
        totalRentalFee: quote.totalRentalFee,
        depositPaid: payOnline ? quote.depositAmount : 0,
        signingMethod: payOnline ? 'ONLINE' : 'IN_PERSON',
        checkInTime,
        expectedCheckInAt: `${checkInDate}T${checkInTime}:00`,
      })
      if (!booking?.id) throw new Error('Hệ thống không trả về mã đơn đặt kho hợp lệ.')
      onCreated({ booking, payOnline, initialPaymentAmount: quote.initialPaymentAmount })
      if (!payOnline) setCreated(booking)
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Không thể đặt giữ kho này. Kho có thể vừa được người khác đặt.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Đã giữ chỗ thành công"
        description={`Mã đặt chỗ ${created.bookingCode || '—'}`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Đóng
            </Button>
            <Button onClick={onViewBookings}>Xem đơn đặt chỗ</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Alert tone="success" icon={CheckCircle2} title="Kho đã được giữ cho bạn">
            Mang CCCD gốc đến cơ sở trước hạn giữ chỗ để xem kho, ký hợp đồng và thanh toán tại quầy.
          </Alert>
          <DescriptionList
            layout="inline"
            items={[
              { label: 'Kho', value: created.unitCode || unit.unitCode, mono: true },
              { label: 'Cơ sở', value: formatFacilityName(created.facilityName || unit.facilityName || '') || '—' },
              { label: 'Lịch hẹn nhận kho', value: created.expectedCheckInAt ? formatDateTime(created.expectedCheckInAt) : `${formatDate(checkInDate)} ${checkInTime}` },
              {
                label: 'Hạn giữ chỗ',
                value: created.holdExpiresAt ? formatDateTime(created.holdExpiresAt) : `${holdGraceHours} giờ sau giờ hẹn`,
              },
              {
                label: 'Thời hạn thuê',
                // The billed term (a 15-day package is billed as 1 month), the same wording as the quote in step 2.
                value: `${quote?.rentalMonths || term.months} tháng (${formatDate(startDate)} → ${formatDate(quote?.endDate)})`,
              },
              { label: 'Thanh toán', value: 'Tại quầy khi nhận kho' },
            ]}
          />
        </div>
      </Modal>
    )
  }

  const footer =
    step === 0 ? (
      <>
        <Button variant="secondary" onClick={onClose}>
          Hủy
        </Button>
        <Button onClick={() => setStep(1)} disabled={!datesValid}>
          Tiếp tục
        </Button>
      </>
    ) : (
      <>
        <Button variant="secondary" onClick={() => setStep(0)} disabled={submitting}>
          Quay lại
        </Button>
        <Button type="submit" form="booking-create-form" loading={submitting} disabled={!quoteReady || !policyAccepted || !datesValid}>
          {workflow === 'ONLINE_NOW' ? 'Đặt chỗ và thanh toán' : 'Xác nhận giữ chỗ'}
        </Button>
      </>
    )

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!submitting}
      title={`Đặt giữ chỗ kho ${unit.unitCode}`}
      description={`${unit.unitTypeName || 'Kho tiêu chuẩn'} · ${facilityName} · ${formatFloor(unit.floorLevel)} · ${formatArea(unit.areaSqMeters)}`}
      size="lg"
      footer={footer}
    >
      <form id="booking-create-form" onSubmit={submit} className="flex flex-col gap-5">
        <Stepper current={step} steps={STEPS} />

        {step === 0 ? (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium text-fg">Thời hạn thuê</legend>
              <div role="radiogroup" aria-label="Thời hạn thuê" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {BOOKING_PACKAGES.map(pkg => (
                  <ChoiceCard
                    key={pkg.id}
                    name="booking-package"
                    value={pkg.id}
                    checked={packageId === pkg.id}
                    onSelect={value => setPackageId(value as BookingPackageId)}
                    label={pkg.label}
                    description={pkg.hint}
                  />
                ))}
              </div>
              {packageId === 'custom' ? (
                <Field label="Số ngày thuê" hint={`Từ ${CUSTOM_DAYS_MIN} đến ${CUSTOM_DAYS_MAX} ngày, tính tương đương ${term.months} tháng.`} className="sm:max-w-xs">
                  <Input
                    type="number"
                    min={CUSTOM_DAYS_MIN}
                    max={CUSTOM_DAYS_MAX}
                    value={customDays}
                    onChange={event => {
                      const value = Number.parseInt(event.target.value, 10)
                      setCustomDays(Number.isNaN(value) ? CUSTOM_DAYS_MIN : Math.max(CUSTOM_DAYS_MIN, Math.min(CUSTOM_DAYS_MAX, value)))
                    }}
                  />
                </Field>
              ) : null}
              {packageId === '15d' ? (
                <p className="text-dense text-fg-muted">
                  {quote?.endDate
                    ? `Gói 15 ngày được tính tối thiểu 1 tháng: tiền thuê và ngày kết thúc theo kỳ hạn 1 tháng (đến ${formatDate(quote.endDate)}).`
                    : 'Gói 15 ngày được tính tối thiểu 1 tháng: tiền thuê và ngày kết thúc theo kỳ hạn 1 tháng.'}
                </p>
              ) : null}
              <p className="text-dense text-fg-muted">Mức giảm theo kỳ hạn là ưu đãi hiện hành; số tiền cuối cùng do máy chủ báo giá.</p>
            </fieldset>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Ngày bắt đầu thuê" required error={startDateError} hint="Ngày chính thức được xác lập khi bàn giao kho.">
                <Input
                  type="date"
                  min={today}
                  max={maxDate}
                  value={startDate}
                  onChange={event => {
                    setStartDate(event.target.value)
                    setStartDateEdited(true)
                  }}
                />
              </Field>
              <Field label="Lịch hẹn nhận kho" required error={checkInError}>
                <div className="grid grid-cols-5 gap-2">
                  <Input
                    type="date"
                    min={today}
                    max={maxDate}
                    value={checkInDate}
                    onChange={event => {
                      const value = event.target.value
                      setCheckInDate(value)
                      if (!startDateEdited && value) setStartDate(value)
                    }}
                    className="col-span-3"
                  />
                  <Select
                    id={timeSelectId}
                    invalid={false}
                    aria-label="Giờ hẹn"
                    value={checkInTime}
                    onChange={event => setCheckInTime(event.target.value)}
                    options={CHECK_IN_TIME_OPTIONS}
                    className="col-span-2"
                  />
                </div>
              </Field>
            </div>

            {datesValid && checkInDate > startDate ? (
              <Alert tone="warning" title="Ngày nhận kho sau ngày bắt đầu thuê">
                Hợp đồng bắt đầu trước khi bạn nhận kho. Hãy xác nhận cách tính tiền cho khoảng chênh lệch với cơ sở trước khi ký.
              </Alert>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-4 py-3">
              <span className="text-dense text-fg-muted">Tổng giá trị hợp đồng dự kiến</span>
              <span className="text-base font-semibold tabular-nums text-fg">
                {quoteError ? '—' : quote && !quoteRefreshing ? formatCurrency(quote.totalContractValue) : 'Đang tính…'}
              </span>
            </div>
          </>
        ) : (
          <>
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-fg">Chi phí theo báo giá</h3>
              <BookingQuoteSummary quote={quote} isLoading={quoteLoading || quoteRefreshing} error={quoteError} onRetry={() => void reloadQuote()} />
            </section>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium text-fg">Cách hoàn tất thủ tục</legend>
              <div role="radiogroup" aria-label="Cách hoàn tất thủ tục" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <ChoiceCard
                  name="booking-workflow"
                  value="HOLD_ONLY"
                  checked={workflow === 'HOLD_ONLY'}
                  onSelect={() => setWorkflow('HOLD_ONLY')}
                  label="Giữ chỗ theo lịch hẹn"
                  meta={<Badge tone="success">Miễn phí giữ chỗ</Badge>}
                  description={`Giữ kho đến giờ hẹn (${formatDate(checkInDate)} ${checkInTime}) thêm ${holdGraceHours} giờ. Xem kho, ký hợp đồng và thanh toán tại quầy.`}
                  footer={<span className="text-dense text-fg-muted">Thanh toán ngay: {formatCurrency(0)}</span>}
                />
                <ChoiceCard
                  name="booking-workflow"
                  value="ONLINE_NOW"
                  checked={workflow === 'ONLINE_NOW'}
                  onSelect={() => setWorkflow('ONLINE_NOW')}
                  label="Thanh toán trực tuyến"
                  description="Thanh toán tiền cọc và tiền thuê đợt đầu qua VNPay, sau đó ký hợp đồng điện tử."
                  footer={
                    <span className="text-dense text-fg-muted">
                      Thanh toán ngay: <span className="font-medium tabular-nums text-fg">{quote ? formatCurrency(quote.initialPaymentAmount) : '—'}</span>
                    </span>
                  }
                />
              </div>
            </fieldset>

            <Alert tone="info" title="Mã PIN">
              Mã PIN chỉ có hiệu lực sau khi hợp đồng, thanh toán và thủ tục bàn giao hoàn tất. Thanh toán thành công chưa có nghĩa là mã PIN đã hoạt động.
            </Alert>

            {submitError ? (
              <Alert tone="danger" title="Không thể đặt chỗ" onDismiss={() => setSubmitError(null)}>
                {submitError}
              </Alert>
            ) : null}

            <Checkbox
              checked={policyAccepted}
              onCheckedChange={setPolicyAccepted}
              label="Tôi đã đọc và đồng ý với điều kiện đặt chỗ"
              description="Kỳ hạn thuê, cách xác lập ngày bắt đầu thuê khi bàn giao, chi phí và tiền cọc, thời gian giữ chỗ, điều kiện hủy và hoàn cọc."
            />
          </>
        )}
      </form>
    </Modal>
  )
}
