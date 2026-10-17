import React, { useEffect, useState } from 'react'
import axios from 'axios'
import QRCode from 'qrcode'
import { Booking, User } from '../../types'
import { useAuth } from '../../context/AuthContext'
import { bookingService } from '../../services/bookingService'
import { paymentService, PaymentItem } from '../../services/paymentService'
import { pricingService, PricingQuoteResponse } from '../../services/pricingService'

export interface BookingCheckoutUnit {
  backendId?: string
  code: string
  name: string
  facilityName?: string
  monthlyPrice: number
  depositAmount?: number
  size?: string
  address?: string
}

interface BookingCheckoutModalProps {
  unit: BookingCheckoutUnit
  user: User
  onClose: () => void
  existingBooking?: Booking
  existingPayments?: PaymentItem[]
}

type CheckoutStep = 1 | 2 | 3

const formatVnd = (amount: number) => `${Math.round(amount).toLocaleString('vi-VN')} ₫`

const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data?.message || error.message
  return error instanceof Error ? error.message : 'Không thể xử lý yêu cầu. Vui lòng thử lại.'
}

const getToday = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

export const BookingCheckoutModal: React.FC<BookingCheckoutModalProps> = ({ unit, user, onClose, existingBooking, existingPayments = [] }) => {
  const { updateProfile } = useAuth()
  const isExistingUnpaidBooking = Boolean(
    existingBooking && (existingBooking.status === 'PENDING_PAYMENT' || (existingBooking.status === 'CONFIRMED' && existingBooking.paymentStatus !== 'PAID'))
  )
  const [step, setStep] = useState<CheckoutStep>(() => isExistingUnpaidBooking ? 3 : 1)
  const [rentalMonths, setRentalMonths] = useState(existingBooking?.rentalMonths || 1)
  const [startDate, setStartDate] = useState(existingBooking?.startDate || getToday)
  const [checkInTime, setCheckInTime] = useState(existingBooking?.checkInTime || '09:00')
  const [customerName, setCustomerName] = useState(user.fullName || '')
  const [customerPhone, setCustomerPhone] = useState(user.phone || '')
  const [signingMethod, setSigningMethod] = useState<'ONLINE' | 'IN_PERSON'>(
    isExistingUnpaidBooking ? 'ONLINE' : ((existingBooking?.signingMethod as 'ONLINE' | 'IN_PERSON') || 'ONLINE')
  )
  const [booking, setBooking] = useState<Booking | null>(existingBooking || null)
  const [paymentUrl, setPaymentUrl] = useState('')
  const [authoritativePaymentAmount, setAuthoritativePaymentAmount] = useState<number | null>(null)
  const [qrCode, setQrCode] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'vnpay' | 'qr'>('qr')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [approvalRejected, setApprovalRejected] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null)
  const [serverQuote, setServerQuote] = useState<PricingQuoteResponse | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)

  useEffect(() => {
    if (!unit.backendId) return
    let isCurrent = true
    pricingService.getQuote({
      storageUnitId: unit.backendId,
      rentalMonths,
      startDate: startDate || undefined
    })
      .then(quote => {
        if (isCurrent) setServerQuote(quote)
      })
      .catch(err => {
        console.warn('Could not fetch server quote:', err)
      })
    return () => { isCurrent = false }
  }, [unit.backendId, rentalMonths, startDate])


  const paymentExpiresAt = booking?.paymentExpiresAt || booking?.holdExpiresAt
  useEffect(() => {
    if (!paymentExpiresAt) {
      setSecondsRemaining(null)
      return
    }

    const updateCountdown = () => {
      setSecondsRemaining(Math.max(0, Math.floor((new Date(paymentExpiresAt).getTime() - Date.now()) / 1000)))
    }
    updateCountdown()
    const intervalId = window.setInterval(updateCountdown, 1000)
    return () => window.clearInterval(intervalId)
  }, [paymentExpiresAt])

  useEffect(() => {
    if (!paymentUrl) return
    let isCurrent = true
    QRCode.toDataURL(paymentUrl, { width: 220, margin: 1, errorCorrectionLevel: 'M' })
      .then((dataUrl: string) => { if (isCurrent) setQrCode(dataUrl) })
      .catch((error: unknown) => { if (isCurrent) setErrorMessage(getErrorMessage(error)) })
    return () => { isCurrent = false }
  }, [paymentUrl])

  const monthlyPrice = serverQuote?.monthlyRate ?? (booking && booking.rentalMonths > 0
    ? booking.totalRentalFee / booking.rentalMonths
    : unit.monthlyPrice)
  const depositAmount = serverQuote?.depositAmount ?? booking?.depositAmount ?? unit.depositAmount ?? unit.monthlyPrice
  const totalInitialObligation = serverQuote?.initialPaymentAmount ?? booking?.initialPaymentAmount ?? (monthlyPrice + depositAmount)

  const allBookingPayments = booking
    ? existingPayments.filter(
        p =>
          ((p.bookingId && (p.bookingId === booking.id || p.bookingId === booking.bookingCode)) ||
            (p.bookingCode && (p.bookingCode === booking.bookingCode || p.bookingCode === booking.id))) &&
          (p.paymentType === 'DEPOSIT' || p.paymentType === 'RENTAL_FEE' || p.paymentType === 'BOOKING_PAYMENT') &&
          Number(p.amount || 0) > 0
      )
    : []

  const confirmedBookingPayments = allBookingPayments.filter(
    p => p.status === 'PAID' || p.status === 'SUCCESS'
  )
  // Only confirmed REFUNDED transactions are deducted from held money; REFUND_PENDING is NOT deducted
  const refundedBookingPayments = allBookingPayments.filter(
    p => p.status === 'REFUNDED'
  )
  const hasRefundedOrRefundPendingDepositTx = allBookingPayments.some(
    p =>
      (p.paymentType === 'DEPOSIT' || p.paymentType === 'BOOKING_PAYMENT') &&
      (p.status === 'REFUNDED' || p.status === 'REFUND_PENDING')
  )

  const paidDepositTx = confirmedBookingPayments
    .filter(p => p.paymentType === 'DEPOSIT')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const paidRentTx = confirmedBookingPayments
    .filter(p => p.paymentType === 'RENTAL_FEE')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const paidBookingTx = confirmedBookingPayments
    .filter(p => p.paymentType === 'BOOKING_PAYMENT')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)

  const refundedDepositTx = refundedBookingPayments
    .filter(p => p.paymentType === 'DEPOSIT')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const refundedRentTx = refundedBookingPayments
    .filter(p => p.paymentType === 'RENTAL_FEE')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const refundedBookingTx = refundedBookingPayments
    .filter(p => p.paymentType === 'BOOKING_PAYMENT')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)

  const isBookingCancelledOrRefunded =
    booking?.status === 'CANCELLED' || String(booking?.paymentStatus || '').toUpperCase() === 'REFUNDED'
  const canFallbackToBookingDepositField =
    !isBookingCancelledOrRefunded &&
    booking?.status !== 'PENDING_PAYMENT' &&
    !hasRefundedOrRefundPendingDepositTx &&
    String(booking?.paymentStatus || '').toUpperCase() !== 'UNPAID'

  const baseDepositPaid =
    paidDepositTx === 0 && paidBookingTx === 0
      ? canFallbackToBookingDepositField
        ? Math.max(0, Number(booking?.depositPaid || 0))
        : 0
      : paidDepositTx
  const unpaidDepositBeforeBookingTx = Math.max(0, depositAmount - baseDepositPaid)
  const allocatedBookingToDeposit = Math.min(paidBookingTx, unpaidDepositBeforeBookingTx)
  const remainingBookingTxForRent = Math.max(0, paidBookingTx - allocatedBookingToDeposit)

  const grossDepositPaid = isBookingCancelledOrRefunded ? 0 : baseDepositPaid + allocatedBookingToDeposit
  const grossRentPaid = isBookingCancelledOrRefunded ? 0 : paidRentTx + remainingBookingTxForRent

  const deductDeposit = Math.min(refundedDepositTx, grossDepositPaid)
  const excessDepositRefund = Math.max(0, refundedDepositTx - deductDeposit)
  const afterDepositRefund = Math.max(0, grossDepositPaid - deductDeposit)
  const afterRentRefund = Math.max(0, grossRentPaid - refundedRentTx - excessDepositRefund)

  const deductBookingFromDeposit = Math.min(refundedBookingTx, afterDepositRefund)
  const remBookingRefund = Math.max(0, refundedBookingTx - deductBookingFromDeposit)

  const alreadyPaidDeposit = Math.max(0, afterDepositRefund - deductBookingFromDeposit)
  const alreadyPaidRent = Math.max(0, afterRentRefund - remBookingRefund)
  const alreadyPaidTotal = alreadyPaidDeposit + alreadyPaidRent

  const depositRemaining = Math.max(0, depositAmount - alreadyPaidDeposit)
  const rentRemaining = Math.max(0, monthlyPrice - alreadyPaidRent)
  const calculatedRemainingDue = alreadyPaidTotal > 0 ? depositRemaining + rentRemaining : totalInitialObligation
  const amountDue = authoritativePaymentAmount ?? (calculatedRemainingDue > 0 ? calculatedRemainingDue : totalInitialObligation)

  const effectivePaymentType: 'BOOKING_PAYMENT' | 'RENTAL_FEE' | 'DEPOSIT' =
    alreadyPaidTotal > 0
      ? depositRemaining === 0 && rentRemaining > 0
        ? 'RENTAL_FEE'
        : rentRemaining === 0 && depositRemaining > 0
          ? 'DEPOSIT'
          : 'BOOKING_PAYMENT'
      : 'BOOKING_PAYMENT'

  const isExpired = secondsRemaining !== null && secondsRemaining <= 0
  const formattedCountdown = secondsRemaining === null
    ? ''
    : `${String(Math.floor(secondsRemaining / 3600)).padStart(2, '0')}:${String(Math.floor((secondsRemaining % 3600) / 60)).padStart(2, '0')}:${String(secondsRemaining % 60).padStart(2, '0')}`
  const normalizedPhone = customerPhone.replace(/[\s().-]/g, '')
  const isContactValid = customerName.trim().length >= 2 && /^(?:0\d{9}|\+84\d{9})$/.test(normalizedPhone)
  const isDateValid = !!startDate && startDate >= getToday()

  const handleSubmitRequest = async () => {
    setIsSubmitting(true)
    setErrorMessage('')
    try {
      if (!unit.backendId) throw new Error('Kho này chưa có dữ liệu từ hệ thống, vui lòng chọn kho khác.')
      if (!isContactValid || !isDateValid) throw new Error('Vui lòng kiểm tra họ tên, số điện thoại và ngày bắt đầu thuê.')

      const cleanPhone = normalizedPhone.startsWith('+84') ? `0${normalizedPhone.slice(3)}` : normalizedPhone
      if (customerName.trim() !== (user.fullName || '') || cleanPhone !== (user.phone || '').replace(/[\s().-]/g, '')) {
        await updateProfile({ fullName: customerName.trim(), phone: cleanPhone })
      }

      const expectedCheckInAt = `${startDate}T${checkInTime || '09:00'}:00`
      const created = await bookingService.createBooking({
        storageUnitId: unit.backendId,
        customerId: user.id,
        startDate,
        rentalMonths,
        signingMethod,
        checkInTime: checkInTime || '09:00',
        expectedCheckInAt,
      })
      setBooking(created)
      setApprovalRejected(false)
      setStep(3)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreatePayment = async () => {
    if (!booking || (booking.status !== 'PENDING_PAYMENT' && !(booking.status === 'CONFIRMED' && booking.paymentStatus !== 'PAID'))) return
    setIsSubmitting(true)
    setErrorMessage('')
    try {
      const payment = await paymentService.createVNPayPayment({
        bookingId: booking.id,
        paymentType: effectivePaymentType,
        amount: amountDue,
        orderInfo: `Thanh toan booking ${booking.bookingCode}`,
      })
      if (payment.amount && Number(payment.amount) > 0) {
        setAuthoritativePaymentAmount(Number(payment.amount))
      }
      setPaymentUrl(payment.paymentUrl)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const launchVNPay = () => {
    if (paymentUrl && !isExpired) window.open(paymentUrl, '_blank', 'noopener,noreferrer')
  }

  const steps = ['Thông tin', 'Xác nhận', signingMethod === 'ONLINE' ? 'Thanh toán trực tuyến' : 'Hoàn tất đặt chỗ']

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="booking-checkout-title" className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-slate-900 px-6 py-5 text-white">
          <div>
            <p className="text-[11px] font-semibold text-blue-400">Đặt giữ chỗ kho</p>
            <h2 id="booking-checkout-title" className="mt-1 text-lg font-bold">
              {step === 3 ? (signingMethod === 'ONLINE' ? 'Thanh toán & nhận kho' : 'Đặt kho thành công') : 'Đăng ký thuê kho'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 px-3 py-3">
          {steps.map((label, index) => {
            const itemStep = index + 1
            return (
              <div key={label} className={`flex items-center justify-center gap-1.5 text-xs font-semibold ${step >= itemStep ? 'text-blue-600' : 'text-slate-400'}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${step >= itemStep ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{itemStep}</span>
                <span className="hidden sm:inline">{label}</span>
              </div>
            )
          })}
        </div>

        <div className="max-h-[72vh] space-y-5 overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="font-mono text-xs font-bold text-blue-600">#{unit.code}</p>
              <h3 className="mt-1 text-sm font-bold text-slate-900">{unit.name}</h3>
              <p className="mt-1 text-xs text-slate-500">{unit.facilityName || 'Boxora'}{unit.size ? ` · ${unit.size}` : ''}</p>
              {unit.address && <p className="mt-1 text-xs text-slate-500">{unit.address}</p>}
            </div>
            <p className="shrink-0 text-right text-sm font-bold text-slate-900">{formatVnd(monthlyPrice)}<span className="block text-[10px] font-medium text-slate-500">/ tháng</span></p>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Thông tin người thuê</h3>
              <label className="block space-y-1.5 text-xs font-semibold text-slate-700">Họ và tên
                <input autoComplete="name" value={customerName} onChange={event => setCustomerName(event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" required />
              </label>
              <label className="block space-y-1.5 text-xs font-semibold text-slate-700">Email tài khoản
                <input type="email" value={user.email} readOnly className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500" />
              </label>
              <label className="block space-y-1.5 text-xs font-semibold text-slate-700">Số điện thoại
                <input type="tel" autoComplete="tel" value={customerPhone} onChange={event => setCustomerPhone(event.target.value)} placeholder="0901234567" className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" required />
              </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <label className="block space-y-1.5 text-xs font-semibold text-slate-700">Ngày check-in dự kiến
                  <input type="date" min={getToday()} value={startDate} onChange={event => setStartDate(event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" required />
                </label>
                 <label className="block space-y-1.5 text-xs font-semibold text-slate-700">Giờ hẹn nhận kho dự kiến
                   <select value={checkInTime} onChange={event => setCheckInTime(event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" required>
                     <option value="09:00">09:00</option>
                     <option value="13:00">13:00</option>
                     <option value="15:00">15:00</option>
                   </select>
                </label>
              </div>
              <label className="block space-y-1.5 text-xs font-semibold text-slate-700">Kỳ hạn thuê
                 <select value={rentalMonths} onChange={event => setRentalMonths(Number(event.target.value))} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100">
                   <option value={1}>1 tháng - Linh hoạt</option>
                   <option value={3}>3 tháng - Ưu đãi theo báo giá</option>
                   <option value={6}>6 tháng - Ưu đãi theo báo giá</option>
                   <option value={12}>12 tháng - Ưu đãi theo báo giá</option>
                   <option value={24}>24 tháng - Ưu đãi theo báo giá</option>
                 </select>
               </label>
               <p className="rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">Kỳ hạn 15 ngày và kỳ hạn tùy chỉnh chưa được chính sách hiện hành hỗ trợ trực tuyến. Ngày bắt đầu thuê chính thức chỉ được xác lập khi bàn giao thực tế và theo điều khoản hợp đồng.</p>

              {/* Lựa chọn hình thức ký hợp đồng */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-900">
                  Hình thức ký hợp đồng &amp; tiếp nhận kho
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setSigningMethod('ONLINE')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      signingMethod === 'ONLINE'
                        ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        signingMethod === 'ONLINE' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <span className="material-symbols-outlined text-[16px]">draw</span>
                      </div>
                      <span className="text-xs font-bold text-slate-900">Ký hợp đồng trực tuyến</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Thanh toán trực tuyến, sau đó ký hợp đồng điện tử. Mã PIN chỉ được kích hoạt sau khi hệ thống xác nhận đủ điều kiện bàn giao.
                    </p>
                  </div>

                  <div
                    onClick={() => setSigningMethod('IN_PERSON')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      signingMethod === 'IN_PERSON'
                        ? 'border-amber-600 bg-amber-50/70 ring-2 ring-amber-500/20 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        signingMethod === 'IN_PERSON' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <span className="material-symbols-outlined text-[16px]">bookmark</span>
                      </div>
                      <span className="text-xs font-bold text-slate-900">Giữ chỗ miễn phí theo lịch hẹn</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Giữ kho đến lịch hẹn ({startDate} {checkInTime}) + {serverQuote?.holdGraceHours || 24}h gia hạn theo chính sách. Xem kho thực tế, ký &amp; thanh toán tại quầy.
                    </p>
                  </div>
                </div>
              </div>

              {(!isContactValid || !isDateValid) && <p className="text-xs text-amber-700">Nhập họ tên, số điện thoại Việt Nam hợp lệ và ngày thuê từ hôm nay trở đi.</p>}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Xác nhận yêu cầu thuê</h3>
              <div className="space-y-2 rounded-xl border border-slate-200 p-4 text-xs">
                <div className="flex justify-between gap-3"><span className="text-slate-500">Người thuê</span><strong>{customerName.trim()}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Email / điện thoại</span><strong className="text-right">{user.email}<br />{normalizedPhone}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Lịch hẹn nhận kho</span><strong>{new Date(`${startDate}T${checkInTime || '09:00'}:00`).toLocaleString('vi-VN')}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Hạn giữ chỗ dự kiến</span><strong className="text-amber-800">Đến giờ hẹn + {serverQuote?.holdGraceHours || 24}h gia hạn</strong></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Kỳ hạn thuê</span><strong>{rentalMonths} tháng</strong></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Tiền thuê trước ưu đãi</span><strong>{formatVnd(serverQuote?.subtotalRentalFee ?? monthlyPrice * rentalMonths)}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Chiết khấu kỳ hạn</span><strong className="text-emerald-700">-{formatVnd(serverQuote?.discountAmount ?? 0)}{serverQuote?.discountPercentage ? ` (${serverQuote.discountPercentage}%)` : ''}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Tiền thuê sau ưu đãi</span><strong>{formatVnd(serverQuote?.totalRentalFee ?? monthlyPrice * rentalMonths)}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Tiền cọc an ninh</span><strong>{formatVnd(depositAmount)}</strong></div>
                <div className="flex justify-between gap-3 border-t border-slate-200 pt-2"><span className="font-bold text-slate-800">Tổng chi phí dự kiến</span><strong className="text-blue-600">{formatVnd(serverQuote?.totalContractValue ?? amountDue)}</strong></div>
                <div className="flex justify-between items-center gap-3 pt-1 border-t border-slate-100">
                  <span className="text-slate-500">Phương thức tiếp nhận &amp; ký</span>
                  <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                    signingMethod === 'ONLINE' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-900'
                  }`}>
                    {signingMethod === 'ONLINE' ? 'Ký hợp đồng và thanh toán trực tuyến' : 'Giữ chỗ theo lịch hẹn (Thanh toán tại quầy)'}
                  </span>
                </div>
              </div>
              <p className="rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
                {signingMethod === 'ONLINE'
                  ? 'Tạo yêu cầu thuê kho và tiến hành thanh toán trực tuyến. Hệ thống chỉ xác nhận thanh toán và chữ ký sau khi nhận kết quả từ máy chủ.'
                  : 'Tạo yêu cầu giữ chỗ thành công ngay. Kho được bảo lưu đến sau lịch hẹn của bạn kèm thời gian gia hạn theo chính sách. Quý khách thanh toán tại quầy cơ sở khi đến nhận kho.'}
              </p>
              <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700">
                <input type="checkbox" checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} className="mt-0.5" />
                <span>Tôi đã đọc kỳ hạn thuê, lịch nhận kho, cách xác lập ngày bắt đầu thuê, chi phí dự kiến và chính sách hủy/hoàn tiền áp dụng.</span>
              </label>
            </div>
          )}

          {step === 3 && (
            (signingMethod === 'IN_PERSON' || (booking?.status === 'CONFIRMED' && !isExistingUnpaidBooking)) ? (
              <div className="space-y-4 text-center py-2">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-3xl">task_alt</span>
                </div>
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
                    ĐÃ XÁC NHẬN GIỮ CHỖ THEO LỊCH HẸN
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    Đặt chỗ thành công! Mã đơn: #{booking?.bookingCode}
                  </h3>
                  <p className="mt-2 text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                    Hồ sơ giữ chỗ của bạn đã được chuyển thẳng vào danh sách tiếp đón tại <strong>Bàn Vận Hành Quầy &amp; Tiếp Đón</strong> của cơ sở <strong>{unit.facilityName || 'Boxora'}</strong>.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-left space-y-2">
                  <div className="flex justify-between"><span className="text-slate-500">Kho thuê:</span><strong className="font-mono text-cyan-800">#{unit.code}</strong></div>
                  <div className="flex justify-between"><span className="text-slate-500">Lịch hẹn nhận kho:</span><strong className="font-mono text-slate-900">{booking?.expectedCheckInAt ? new Date(booking.expectedCheckInAt).toLocaleString('vi-VN') : `${startDate} lúc ${checkInTime}`}</strong></div>
                  <div className="flex justify-between"><span className="text-slate-500">Hạn giữ chỗ:</span><strong className="font-mono text-amber-700">{booking?.holdExpiresAt ? new Date(booking.holdExpiresAt).toLocaleString('vi-VN') : 'Theo chính sách cơ sở'}</strong></div>
                  <div className="flex justify-between"><span className="text-slate-500">Trạng thái thanh toán:</span><span className="font-semibold text-slate-800">{booking?.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán (Thanh toán tại quầy cơ sở)'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Cọc dự kiến:</span><span className="font-mono font-bold text-slate-900">{formatVnd(depositAmount)}</span></div>
                </div>

                <div className="text-[11px] text-blue-900 bg-blue-50 border border-blue-200 p-3.5 rounded-xl leading-relaxed text-left flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-blue-600 shrink-0 mt-0.5">info</span>
                  <div>
                    <strong>Hướng dẫn nhận kho:</strong> Quý khách mang theo bản gốc <strong>CCCD / Hộ chiếu</strong> đến quầy tiếp đón của cơ sở trước thời hạn giữ chỗ. Nhân viên trực ca sẽ tra cứu mã <strong>#{booking?.bookingCode}</strong> để hướng dẫn xem kho, thanh toán (tiền mặt / chuyển khoản) và bàn giao kho.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-xl bg-slate-900 py-3 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm cursor-pointer"
                >
                  Đã hiểu &amp; Đóng
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {!paymentUrl ? (
                  <div className="space-y-4 text-center">
                    <span className="material-symbols-outlined text-5xl text-emerald-600">task_alt</span>
                    <h3 className="text-base font-bold text-slate-900">Đơn thuê đã được khởi tạo: #{booking?.bookingCode}</h3>
                    <p className="text-sm text-slate-600">
                      {alreadyPaidTotal > 0
                        ? 'Hệ thống đã đối soát khoản tiền bạn đã nộp và chỉ tạo liên kết cho phần nghĩa vụ còn thiếu.'
                        : 'Bạn có thể tạo liên kết thanh toán cho tiền cọc và tiền thuê đợt đầu.'}
                    </p>
                    {secondsRemaining !== null && <p className={`rounded-lg p-3 text-xs font-semibold ${isExpired ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>{isExpired ? 'Thời hạn thanh toán đã hết.' : `Thời hạn giữ kho còn ${formattedCountdown}.`}</p>}
                    {alreadyPaidTotal > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-left space-y-1.5">
                        <div className="flex justify-between text-slate-600">
                          <span>Tổng nghĩa vụ đợt đầu (cọc + thuê kỳ đầu):</span>
                          <strong>{formatVnd(totalInitialObligation)}</strong>
                        </div>
                        <div className="flex justify-between text-emerald-700">
                          <span>Đã thanh toán hợp lệ (đã xác nhận):</span>
                          <strong>-{formatVnd(alreadyPaidTotal)}</strong>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-cyan-800">
                          <span>Số tiền còn cần thanh toán:</span>
                          <span>{formatVnd(amountDue)}</span>
                        </div>
                      </div>
                    )}
                    <div className="text-lg font-bold text-cyan-800">
                      {alreadyPaidTotal > 0 ? `Cần thanh toán bổ sung: ${formatVnd(amountDue)}` : `Thanh toán ban đầu: ${formatVnd(amountDue)}`}
                    </div>
                    <button type="button" disabled={isSubmitting || isExpired} onClick={handleCreatePayment} className="w-full rounded-lg bg-cyan-700 py-3 text-sm font-bold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? 'Đang tạo liên kết...' : 'Thanh toán và ký hợp đồng trực tuyến ngay ->'}</button>
                  </div>
                ) : (
                  <>
                    <div className={`flex items-center justify-between rounded-xl p-3 text-xs font-semibold ${isExpired ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>
                      <span>{isExpired ? 'Đã hết thời hạn giữ kho' : secondsRemaining !== null ? `Thời hạn giữ kho còn ${formattedCountdown}` : 'Số tiền cần thanh toán'}</span><span>{formatVnd(amountDue)}</span>
                    </div>
                    <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1">
                      <button type="button" onClick={() => setPaymentMethod('qr')} className={`rounded-md py-2 text-xs font-bold ${paymentMethod === 'qr' ? 'bg-white text-cyan-800 shadow-sm' : 'text-slate-500'}`}>Quét mã QR</button>
                      <button type="button" onClick={() => setPaymentMethod('vnpay')} className={`rounded-md py-2 text-xs font-bold ${paymentMethod === 'vnpay' ? 'bg-white text-cyan-800 shadow-sm' : 'text-slate-500'}`}>Mở trang thanh toán</button>
                    </div>
                    {paymentMethod === 'qr' ? (
                      <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 p-5 text-center">
                        {qrCode ? <img src={qrCode} alt="Mã QR mở trang thanh toán" className="h-56 w-56" /> : <div className="flex h-56 w-56 items-center justify-center text-xs text-slate-500">Đang tạo mã QR...</div>}
                        <p className="max-w-sm text-xs leading-relaxed text-slate-500">Quét mã hoặc mở trang thanh toán trên thiết bị này.</p>
                        <button type="button" onClick={launchVNPay} disabled={isExpired} className="text-xs font-bold text-cyan-800 underline disabled:opacity-50">Mở trang thanh toán</button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 p-5 text-center">
                        <span className="material-symbols-outlined text-4xl text-cyan-700">account_balance</span>
                        <p className="mt-2 text-sm font-bold text-slate-900">Thanh toán an toàn</p>
                        <p className="mt-1 text-xs text-slate-500">Trang thanh toán chỉ mở khi bạn nhấn nút bên dưới.</p>
                        <button type="button" disabled={isExpired} onClick={launchVNPay} className="mt-4 w-full rounded-lg bg-cyan-700 py-3 text-xs font-bold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">Thanh toán và ký hợp đồng trực tuyến ngay -&gt;</button>
                      </div>
                    )}
                    <button type="button" disabled={isSubmitting || isExpired} onClick={handleCreatePayment} className="w-full rounded-lg border border-slate-300 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{isSubmitting ? 'Đang tạo liên kết...' : 'Tạo liên kết thanh toán mới'}</button>
                  </>
                )}
              </div>
            )
          )}

          {errorMessage && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{errorMessage}</p>}

          <div className="flex justify-between gap-3 pt-1">
            {step === 1 && <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700">Đóng</button>}
            {step === 2 && <button type="button" disabled={isSubmitting} onClick={() => setStep(1)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 disabled:opacity-50">Quay lại</button>}
            {step === 3 && signingMethod === 'ONLINE' && <button type="button" onClick={onClose} className="ml-auto rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700">Đóng, yêu cầu vẫn được lưu</button>}
            {step === 1 && <button type="button" disabled={!isContactValid || !isDateValid} onClick={() => setStep(2)} className="rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Tiếp tục</button>}
             {step === 2 && <button type="button" disabled={isSubmitting || !termsAccepted} onClick={handleSubmitRequest} className="rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? 'Đang khởi tạo...' : 'Xác nhận đặt kho'}</button>}
          </div>
        </div>
      </section>
    </div>
  )
}
