import React, { useEffect, useState } from 'react'
import axios from 'axios'
import QRCode from 'qrcode'
import { Booking, User } from '../../types'
import { useAuth } from '../../context/AuthContext'
import { bookingService } from '../../services/bookingService'
import { paymentService } from '../../services/paymentService'

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
}

type CheckoutStep = 1 | 2 | 3 | 4

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

export const BookingCheckoutModal: React.FC<BookingCheckoutModalProps> = ({ unit, user, onClose, existingBooking }) => {
  const { updateProfile } = useAuth()
  const [step, setStep] = useState<CheckoutStep>(() => existingBooking?.status === 'PENDING_PAYMENT' ? 4 : 1)
  const [rentalMonths, setRentalMonths] = useState(existingBooking?.rentalMonths || 1)
  const [startDate, setStartDate] = useState(existingBooking?.startDate || getToday)
  const [expectedArrivalDate, setExpectedArrivalDate] = useState(existingBooking?.expectedArrivalAt?.slice(0, 10) || existingBooking?.startDate || getToday())
  const [expectedArrivalTime, setExpectedArrivalTime] = useState(existingBooking?.expectedArrivalAt?.slice(11, 16) || '10:00')
  const [customerName, setCustomerName] = useState(user.fullName || '')
  const [customerPhone, setCustomerPhone] = useState(user.phone || '')
  const [signingMethod, setSigningMethod] = useState<'ONLINE' | 'IN_PERSON'>(
    (existingBooking?.signingMethod as 'ONLINE' | 'IN_PERSON') || 'ONLINE'
  )
  const [booking, setBooking] = useState<Booking | null>(existingBooking || null)
  const [paymentUrl, setPaymentUrl] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'vnpay' | 'qr'>('qr')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [approvalRejected, setApprovalRejected] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (booking?.status !== 'PENDING_APPROVAL') return

    let isCurrent = true
    const refreshRequest = async () => {
      try {
        const requests = await bookingService.getMyRequests()
        const latest = requests.find(request => request.id === booking.id)
        if (!isCurrent || !latest || latest.status === 'PENDING_APPROVAL') return
        setBooking(latest)
        if (latest.status === 'PENDING_PAYMENT') setStep(4)
        if (latest.status === 'CANCELLED') setApprovalRejected(true)
      } catch (error) {
        if (isCurrent) console.warn('Could not refresh booking approval status:', error)
      }
    }

    void refreshRequest()
    const intervalId = window.setInterval(() => void refreshRequest(), 10000)
    return () => {
      isCurrent = false
      window.clearInterval(intervalId)
    }
  }, [booking?.id, booking?.status])

  const paymentExpiresAt = booking?.paymentExpiresAt
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

  const monthlyPrice = booking && booking.rentalMonths > 0
    ? booking.totalRentalFee / booking.rentalMonths
    : unit.monthlyPrice
  const depositAmount = booking?.depositAmount ?? unit.depositAmount ?? unit.monthlyPrice
  const amountDue = booking?.initialPaymentAmount ?? monthlyPrice + depositAmount
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

      const created = await bookingService.createBooking({
        storageUnitId: unit.backendId,
        customerId: user.id,
        startDate,
        expectedArrivalAt: `${expectedArrivalDate}T${expectedArrivalTime}:00`,
        requiresManagerApproval: true,
        rentalMonths,
        signingMethod,
      })
      setBooking(created)
      setApprovalRejected(false)
      setStep(created.status === 'PENDING_PAYMENT' ? 4 : 3)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreatePayment = async () => {
    if (!booking || booking.status !== 'PENDING_PAYMENT') return
    setIsSubmitting(true)
    setErrorMessage('')
    try {
      const payment = await paymentService.createVNPayPayment({
        bookingId: booking.id,
        paymentType: 'BOOKING_PAYMENT',
        amount: booking.initialPaymentAmount || amountDue,
        orderInfo: `Thanh toan booking ${booking.bookingCode}`,
      })
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

  const steps = ['Thông tin', 'Xác nhận', 'Chờ duyệt', 'Thanh toán']

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="booking-checkout-title" className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-slate-900 px-6 py-5 text-white">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Boxora · Yêu cầu thuê kho</p>
            <h2 id="booking-checkout-title" className="mt-1 text-lg font-bold">
              {step === 3 ? 'Chờ quản lý xác nhận' : step === 4 ? 'Thanh toán & giữ kho' : 'Đăng ký thuê kho'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-50 px-3 py-3">
          {steps.map((label, index) => {
            const itemStep = index + 1
            return (
              <div key={label} className={`flex items-center justify-center gap-1.5 text-[10px] font-semibold ${step >= itemStep ? 'text-cyan-800' : 'text-slate-400'}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${step >= itemStep ? 'bg-cyan-700 text-white' : 'bg-slate-200 text-slate-500'}`}>{itemStep}</span>
                <span className="hidden sm:inline">{label}</span>
              </div>
            )
          })}
        </div>

        <div className="max-h-[72vh] space-y-5 overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="font-mono text-xs font-bold text-cyan-800">#{unit.code}</p>
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
              <label className="block space-y-1.5 text-xs font-semibold text-slate-700">Ngày bắt đầu thuê
                <input type="date" min={getToday()} value={startDate} onChange={event => setStartDate(event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" required />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5 text-xs font-semibold text-slate-700">Ngày dự kiến đến nhận kho
                  <input type="date" min={getToday()} value={expectedArrivalDate} onChange={event => setExpectedArrivalDate(event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" required />
                </label>
                <label className="block space-y-1.5 text-xs font-semibold text-slate-700">Giờ dự kiến đến
                  <input type="time" value={expectedArrivalTime} onChange={event => setExpectedArrivalTime(event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" required />
                </label>
              </div>
              <label className="block space-y-1.5 text-xs font-semibold text-slate-700">Kỳ hạn thuê
                <select value={rentalMonths} onChange={event => setRentalMonths(Number(event.target.value))} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100">
                  {[1, 3, 6, 12].map(months => <option key={months} value={months}>{months} tháng</option>)}
                </select>
              </label>

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
                      <span className="text-xs font-bold text-slate-900">Ký Online DocuSeal</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Quản lý duyệt &rarr; Thanh toán trước qua Sandbox VNPay &rarr; Nhận link ký số DocuSeal &rarr; Kích hoạt mã mở kho ngay.
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
                        <span className="material-symbols-outlined text-[16px]">storefront</span>
                      </div>
                      <span className="text-xs font-bold text-slate-900">Ký Trực Tiếp Tại Kho</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Giữ chỗ đến lịch hẹn ({startDate} {expectedArrivalTime}) + 1 giờ theo chính sách. Vị trí kho được xác nhận khi check-in.
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
                <div className="flex justify-between gap-3"><span className="text-slate-500">Lịch hẹn nhận kho</span><strong>{new Date(`${startDate}T${expectedArrivalTime || '09:00'}:00`).toLocaleString('vi-VN')}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Hạn giữ chỗ dự kiến</span><strong className="text-amber-800">Đến giờ hẹn + 1 giờ</strong></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Kỳ hạn thuê</span><strong>{rentalMonths} tháng</strong></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Tiền thuê kỳ hạn</span><strong>{formatVnd(monthlyPrice * rentalMonths)}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Tiền cọc an ninh</span><strong>{formatVnd(depositAmount)}</strong></div>
                <div className="flex justify-between gap-3 border-t border-slate-200 pt-2"><span className="font-bold text-slate-800">Tổng chi phí dự kiến</span><strong className="text-blue-600">{formatVnd(amountDue)}</strong></div>

                <div className="flex justify-between items-center gap-3 pt-1 border-t border-slate-100">
                  <span className="text-slate-500">Hình thức ký hợp đồng</span>
                  <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                    signingMethod === 'ONLINE' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-900'
                  }`}>
                    {signingMethod === 'ONLINE' ? '✍️ Ký Online DocuSeal (VNPay)' : '🏢 Ký trực tiếp tại cơ sở kho'}
                  </span>
                </div>
              </div>
              <p className="rounded-lg bg-cyan-50 p-3 text-xs leading-relaxed text-cyan-900">
                {signingMethod === 'ONLINE'
                  ? 'Gửi yêu cầu thuê kho tới Quản lý cơ sở. Khi được duyệt, bạn sẽ thanh toán VNPay và nhận link ký DocuSeal trực tuyến.'
                  : 'Gửi yêu cầu thuê kho tới Quản lý cơ sở. Quản lý sẽ duyệt và phân công nhân viên chi nhánh chuẩn bị kho, tiếp đón bạn tới xem kho và ký trực tiếp.'}
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center">
              {approvalRejected ? (
                <>
                  <span className="material-symbols-outlined text-5xl text-rose-500">info</span>
                  <h3 className="text-base font-bold text-slate-900">Yêu cầu chưa được duyệt</h3>
                  <p className="text-sm text-slate-600">Kho đã được trả về danh sách trống. Bạn có thể chọn kho khác hoặc liên hệ chi nhánh.</p>
                </>
              ) : (
                <>
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-100 border-t-cyan-700" />
                  <h3 className="text-base font-bold text-slate-900">Đã gửi yêu cầu {booking?.bookingCode ? `#${booking.bookingCode}` : ''}</h3>
                  <p className="text-sm text-slate-600">Đang chờ quản lý chi nhánh phản hồi. Không phát sinh thanh toán trước khi được duyệt.</p>
                  {secondsRemaining !== null && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Yêu cầu giữ kho hết hạn sau {formattedCountdown} nếu chưa có quyết định.</p>}
                </>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              {!paymentUrl ? (
                <div className="space-y-4 text-center">
                  <span className="material-symbols-outlined text-5xl text-emerald-600">task_alt</span>
                  <h3 className="text-base font-bold text-slate-900">Quản lý đã duyệt yêu cầu</h3>
                  <p className="text-sm text-slate-600">Bạn có thể tạo liên kết VNPay khi sẵn sàng thanh toán.</p>
                  {secondsRemaining !== null && <p className={`rounded-lg p-3 text-xs font-semibold ${isExpired ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>{isExpired ? 'Thời hạn thanh toán đã hết.' : `Thời hạn giữ kho còn ${formattedCountdown}.`}</p>}
                  <div className="text-lg font-bold text-cyan-800">Thanh toán ban đầu: {formatVnd(amountDue)}</div>
                  <button type="button" disabled={isSubmitting || isExpired} onClick={handleCreatePayment} className="w-full rounded-lg bg-cyan-700 py-3 text-sm font-bold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? 'Đang tạo liên kết...' : 'Tạo liên kết VNPay'}</button>
                </div>
              ) : (
                <>
                  <div className={`flex items-center justify-between rounded-xl p-3 text-xs font-semibold ${isExpired ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>
                    <span>{isExpired ? 'Đã hết thời hạn giữ kho' : `Thời hạn giữ kho còn ${formattedCountdown}`}</span><span>{formatVnd(amountDue)}</span>
                  </div>
                  <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1">
                    <button type="button" onClick={() => setPaymentMethod('qr')} className={`rounded-md py-2 text-xs font-bold ${paymentMethod === 'qr' ? 'bg-white text-cyan-800 shadow-sm' : 'text-slate-500'}`}>Quét mã QR</button>
                    <button type="button" onClick={() => setPaymentMethod('vnpay')} className={`rounded-md py-2 text-xs font-bold ${paymentMethod === 'vnpay' ? 'bg-white text-cyan-800 shadow-sm' : 'text-slate-500'}`}>VNPay</button>
                  </div>
                  {paymentMethod === 'qr' ? (
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 p-5 text-center">
                      {qrCode ? <img src={qrCode} alt="Mã QR mở trang thanh toán VNPay" className="h-56 w-56" /> : <div className="flex h-56 w-56 items-center justify-center text-xs text-slate-500">Đang tạo mã QR...</div>}
                      <p className="max-w-sm text-xs leading-relaxed text-slate-500">Quét mã hoặc tự mở trang VNPay. Boxora không tự mở ứng dụng khác.</p>
                      <button type="button" onClick={launchVNPay} disabled={isExpired} className="text-xs font-bold text-cyan-800 underline disabled:opacity-50">Mở VNPay trên thiết bị này</button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 p-5 text-center">
                      <span className="material-symbols-outlined text-4xl text-cyan-700">account_balance</span>
                      <p className="mt-2 text-sm font-bold text-slate-900">Thanh toán an toàn qua VNPay</p>
                      <p className="mt-1 text-xs text-slate-500">VNPay chỉ mở khi bạn nhấn nút bên dưới.</p>
                      <button type="button" disabled={isExpired} onClick={launchVNPay} className="mt-4 w-full rounded-lg bg-cyan-700 py-3 text-xs font-bold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">Tiếp tục đến VNPay</button>
                    </div>
                  )}
                  <button type="button" disabled={isSubmitting || isExpired} onClick={handleCreatePayment} className="w-full rounded-lg border border-slate-300 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{isSubmitting ? 'Đang tạo liên kết...' : 'Tạo liên kết VNPay mới'}</button>
                </>
              )}
            </div>
          )}

          {errorMessage && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{errorMessage}</p>}

          <div className="flex justify-between gap-3 pt-1">
            {step === 1 && <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700">Đóng</button>}
            {step === 2 && <button type="button" disabled={isSubmitting} onClick={() => setStep(1)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 disabled:opacity-50">Quay lại</button>}
            {step === 3 && <button type="button" onClick={onClose} className="ml-auto rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700">Đóng, yêu cầu vẫn được lưu</button>}
            {step === 4 && <button type="button" onClick={onClose} className="ml-auto rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700">Đóng</button>}
            {step === 1 && <button type="button" disabled={!isContactValid || !isDateValid} onClick={() => setStep(2)} className="rounded-lg bg-cyan-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">Tiếp tục</button>}
            {step === 2 && <button type="button" disabled={isSubmitting} onClick={handleSubmitRequest} className="rounded-lg bg-cyan-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu chờ duyệt'}</button>}
          </div>
        </div>
      </section>
    </div>
  )
}
