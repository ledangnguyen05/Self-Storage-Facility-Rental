import React, { useState } from 'react'
import type { Booking, User } from '../../types'
import { useAuth } from '../../context/AuthContext'
import { bookingService } from '../../services/bookingService'
import { paymentService } from '../../services/paymentService'
import { pricingService } from '../../services/pricingService'
import { useAsyncData } from '../../hooks/useAsyncData'
import { getApiErrorMessage } from '../../lib/apiError'
import { todayISO } from '../../lib/format'
import { BOOKING_HOLD_DEFAULTS } from '../../utils/facilityPolicyDefaults'
import { Alert, Button, Modal, Stepper, useToast } from '../ui'
import { ConfirmedStep } from './checkout/ConfirmedStep'
import { DetailsStep } from './checkout/DetailsStep'
import { PaymentStep } from './checkout/PaymentStep'
import { ReviewStep } from './checkout/ReviewStep'
import { UnitSummary } from './checkout/UnitSummary'
import {
  DEFAULT_CHECK_IN_TIME,
  PHONE_PATTERN,
  getDefaultAppointment,
  isAppointmentPast,
  isSafeHttpUrl,
  stripPhoneSeparators,
  toLocalPhone,
  type BookingCheckoutUnit,
  type CheckoutForm,
  type CheckoutStep,
  type PaymentView,
} from './checkout/checkoutTypes'
import { useCountdown } from './checkout/useCountdown'
import { useQrDataUrl } from './checkout/useQrDataUrl'

export type { BookingCheckoutUnit }

interface BookingCheckoutModalProps {
  unit: BookingCheckoutUnit
  user: User
  onClose: () => void
  existingBooking?: Booking
}

export const BookingCheckoutModal: React.FC<BookingCheckoutModalProps> = ({ unit, user, onClose, existingBooking }) => {
  const { updateProfile } = useAuth()
  const toast = useToast()

  const [step, setStep] = useState<CheckoutStep>(() => (existingBooking?.status === 'PENDING_PAYMENT' ? 3 : 1))
  const [form, setForm] = useState<CheckoutForm>(() => {
    const appointment = getDefaultAppointment()
    return {
      customerName: user.fullName || '',
      customerPhone: user.phone || '',
      startDate: existingBooking?.startDate || appointment.startDate,
      checkInTime: existingBooking?.checkInTime || appointment.checkInTime,
      rentalMonths: existingBooking?.rentalMonths || 1,
      signingMethod: existingBooking?.signingMethod || 'ONLINE',
    }
  })
  const [touched, setTouched] = useState({ name: false, phone: false })
  const [booking, setBooking] = useState<Booking | null>(existingBooking || null)
  const [paymentUrl, setPaymentUrl] = useState('')
  const [paymentView, setPaymentView] = useState<PaymentView>('qr')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const { customerName, customerPhone, startDate, checkInTime, rentalMonths, signingMethod } = form
  const patchForm = (patch: Partial<CheckoutForm>) => setForm(current => ({ ...current, ...patch }))

  // ---- validation -------------------------------------------------------
  const normalizedPhone = stripPhoneSeparators(customerPhone)
  const cleanPhone = toLocalPhone(normalizedPhone)
  const errors = {
    name: customerName.trim().length >= 2 ? undefined : 'Nhập họ tên (ít nhất 2 ký tự).',
    phone: PHONE_PATTERN.test(normalizedPhone) ? undefined : 'Nhập số điện thoại Việt Nam hợp lệ, ví dụ 0901234567.',
    date: !startDate ? 'Chọn ngày nhận kho.' : startDate < todayISO() ? 'Ngày nhận kho phải từ hôm nay trở đi.' : undefined,
    time: undefined as string | undefined,
  }
  // Today's slots that have already passed can not be booked.
  if (!errors.date && startDate === todayISO() && isAppointmentPast(startDate, checkInTime)) {
    errors.time = 'Giờ hẹn này đã qua. Chọn khung giờ khác hoặc ngày khác.'
  }
  const isFormValid = !errors.name && !errors.phone && !errors.date && !errors.time
  const isUnitBookable = Boolean(unit.backendId)

  // The profile is only touched when the customer actually changed name or phone, and the UI says so.
  const profileChanges: string[] = []
  if (customerName.trim() !== (user.fullName || '')) profileChanges.push('họ tên')
  if (cleanPhone !== toLocalPhone(stripPhoneSeparators(user.phone || ''))) profileChanges.push('số điện thoại')
  const shouldUpdateProfile = isFormValid && profileChanges.length > 0

  // ---- server quote -----------------------------------------------------
  const quoteQuery = useAsyncData(
    (signal) => pricingService.getQuote({ storageUnitId: unit.backendId as string, rentalMonths, startDate: startDate || undefined }, { signal }),
    [unit.backendId, rentalMonths, startDate],
    // A quote for other terms must never be shown or confirmed: reset it whenever the inputs change.
    { enabled: isUnitBookable && !booking && !errors.date && step < 3, keepPreviousData: false },
  )
  const quote = quoteQuery.data

  const holdGraceHours = quote?.holdGraceHours ?? booking?.holdGraceHours ?? BOOKING_HOLD_DEFAULTS.holdGraceHours
  const monthlyPrice =
    quote?.monthlyRate ?? (booking && booking.rentalMonths > 0 ? booking.totalRentalFee / booking.rentalMonths : unit.monthlyPrice)
  const depositAmount = booking?.depositAmount ?? quote?.depositAmount ?? unit.depositAmount ?? null
  const amountDue = booking?.initialPaymentAmount ?? quote?.initialPaymentAmount ?? null
  const appointmentAt = `${startDate}T${checkInTime || DEFAULT_CHECK_IN_TIME}:00`

  // ---- payment ----------------------------------------------------------
  const secondsRemaining = useCountdown(booking?.paymentExpiresAt || booking?.holdExpiresAt)
  const isExpired = secondsRemaining !== null && secondsRemaining <= 0
  const { qrCode, error: qrError } = useQrDataUrl(paymentUrl)

  const handleSubmitRequest = async () => {
    setIsSubmitting(true)
    setErrorMessage('')
    try {
      if (!unit.backendId) throw new Error('Kho này chưa có dữ liệu từ hệ thống, vui lòng chọn kho khác.')
      if (!isFormValid) throw new Error('Vui lòng kiểm tra họ tên, số điện thoại và ngày nhận kho.')

      if (shouldUpdateProfile) {
        await updateProfile({ fullName: customerName.trim(), phone: cleanPhone })
        toast.success('Đã cập nhật hồ sơ tài khoản', `Đã lưu ${profileChanges.join(' và ')} mới của bạn.`)
      }

      const created = await bookingService.createBooking({
        storageUnitId: unit.backendId,
        customerId: user.id,
        startDate,
        rentalMonths,
        signingMethod,
        checkInTime: checkInTime || DEFAULT_CHECK_IN_TIME,
        expectedCheckInAt: appointmentAt,
      })
      setBooking(created)
      setStep(3)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không thể tạo đơn đặt kho. Vui lòng thử lại.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreatePayment = async () => {
    if (!booking || booking.status !== 'PENDING_PAYMENT') return
    const amount = booking.initialPaymentAmount || amountDue
    if (!amount) {
      setErrorMessage('Không xác định được số tiền thanh toán. Vui lòng đóng và mở lại đơn.')
      return
    }
    setIsSubmitting(true)
    setErrorMessage('')
    try {
      // The server computes the amount; `amount` only guards against a price change since the quote.
      const payment = await paymentService.createVNPayPayment({ bookingId: booking.id, amount })
      setPaymentUrl(payment.paymentUrl)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không thể tạo liên kết thanh toán. Vui lòng thử lại.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const launchPayment = () => {
    if (paymentUrl && !isExpired && isSafeHttpUrl(paymentUrl)) window.open(paymentUrl, '_blank', 'noopener,noreferrer')
  }

  // ---- layout -----------------------------------------------------------
  const isConfirmation = step === 3 && (signingMethod === 'IN_PERSON' || booking?.status === 'CONFIRMED')
  const stepLabels = ['Thông tin', 'Xác nhận', signingMethod === 'ONLINE' ? 'Thanh toán' : 'Hoàn tất']
  const title = step === 3 ? (isConfirmation ? 'Đặt kho thành công' : 'Thanh toán và nhận kho') : 'Đăng ký thuê kho'

  let footer: React.ReactNode
  if (step === 1) {
    footer = (
      <>
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
        <Button disabled={!isFormValid || !isUnitBookable} onClick={() => setStep(2)}>
          Tiếp tục
        </Button>
      </>
    )
  } else if (step === 2) {
    footer = (
      <>
        <Button variant="secondary" disabled={isSubmitting} onClick={() => setStep(1)}>
          Quay lại
        </Button>
        <Button loading={isSubmitting} disabled={!termsAccepted || !quote} onClick={() => void handleSubmitRequest()}>
          Xác nhận đặt kho
        </Button>
      </>
    )
  } else if (isConfirmation) {
    footer = <Button onClick={onClose}>Đã hiểu</Button>
  } else {
    footer = (
      <>
        <Button variant="secondary" onClick={onClose}>
          Đóng, đơn vẫn được lưu
        </Button>
        {paymentUrl ? (
          <Button disabled={isExpired} onClick={launchPayment}>
            Mở trang thanh toán
          </Button>
        ) : (
          <Button loading={isSubmitting} disabled={isExpired} onClick={() => void handleCreatePayment()}>
            Tạo liên kết thanh toán
          </Button>
        )}
      </>
    )
  }

  return (
    <Modal open onClose={onClose} size="md" title={title} dismissible={!isSubmitting} footer={footer}>
      <div className="flex flex-col gap-5">
        <Stepper current={isConfirmation ? stepLabels.length : step - 1} steps={stepLabels.map(label => ({ label }))} aria-label="Các bước đặt kho" />

        <UnitSummary unit={unit} monthlyPrice={monthlyPrice} />

        {!isUnitBookable ? (
          <Alert tone="warning" title="Kho chưa sẵn sàng để đặt">
            Kho này chưa có dữ liệu từ hệ thống, vui lòng chọn kho khác.
          </Alert>
        ) : null}

        {step === 1 ? (
          <DetailsStep
            email={user.email}
            form={form}
            onChange={patchForm}
            errors={errors}
            touched={touched}
            onTouch={field => setTouched(current => ({ ...current, [field]: true }))}
            profileChanges={shouldUpdateProfile ? profileChanges : []}
            holdGraceHours={holdGraceHours}
          />
        ) : null}

        {step === 2 ? (
          <ReviewStep
            customerName={customerName.trim()}
            email={user.email}
            phone={cleanPhone}
            appointmentAt={appointmentAt}
            rentalMonths={rentalMonths}
            signingMethod={signingMethod}
            holdGraceHours={holdGraceHours}
            profileChanges={shouldUpdateProfile ? profileChanges : []}
            quote={quote}
            isQuoteLoading={quoteQuery.isLoading}
            quoteError={quoteQuery.error}
            onReloadQuote={() => void quoteQuery.reload()}
            termsAccepted={termsAccepted}
            onTermsChange={setTermsAccepted}
          />
        ) : null}

        {step === 3 && isConfirmation ? (
          <ConfirmedStep
            booking={booking}
            unitCode={unit.code}
            facilityName={unit.facilityName}
            appointmentAt={appointmentAt}
            depositAmount={depositAmount}
          />
        ) : null}

        {step === 3 && !isConfirmation ? (
          <PaymentStep
            booking={booking}
            amountDue={amountDue}
            secondsRemaining={secondsRemaining}
            isExpired={isExpired}
            paymentUrl={paymentUrl}
            qrCode={qrCode}
            qrError={qrError}
            view={paymentView}
            onViewChange={setPaymentView}
            isSubmitting={isSubmitting}
            onCreatePayment={() => void handleCreatePayment()}
          />
        ) : null}

        {errorMessage ? (
          <Alert tone="danger" title="Chưa hoàn tất được thao tác">
            {errorMessage}
          </Alert>
        ) : null}

        {step === 1 && !isFormValid && isUnitBookable ? (
          <p className="text-dense text-fg-subtle">Nhập họ tên, số điện thoại Việt Nam hợp lệ và chọn lịch hẹn nhận kho còn hiệu lực để tiếp tục.</p>
        ) : null}
      </div>
    </Modal>
  )
}
