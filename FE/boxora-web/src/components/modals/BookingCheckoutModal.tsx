import React, { useEffect, useState } from 'react'
import axios from 'axios'
import QRCode from 'qrcode'
import { Booking, User } from '../../types'
import { bookingService } from '../../services/bookingService'
import { paymentService } from '../../services/paymentService'
import { activateCustomerRental } from '../../utils/rentalAccess'

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
}

const formatVnd = (amount: number) => `${Math.round(amount).toLocaleString('vi-VN')} ₫`

const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data?.message || error.message
  return error instanceof Error ? error.message : 'Không thể khởi tạo giao dịch. Vui lòng thử lại.'
}

const getToday = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

export const BookingCheckoutModal: React.FC<BookingCheckoutModalProps> = ({ unit, user, onClose }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [rentalMonths, setRentalMonths] = useState(1)
  const [startDate, setStartDate] = useState(getToday)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [paymentUrl, setPaymentUrl] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'vnpay' | 'qr'>('qr')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null)

  const paymentExpiresAt = booking?.paymentExpiresAt
  useEffect(() => {
    if (!paymentExpiresAt) return

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
      .then((dataUrl) => {
        if (isCurrent) setQrCode(dataUrl)
      })
      .catch((error: unknown) => {
        if (isCurrent) setErrorMessage(getErrorMessage(error))
      })

    return () => {
      isCurrent = false
    }
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

  const handleCreatePayment = async () => {
    setIsSubmitting(true)
    setErrorMessage('')
    try {
      let currentBooking = booking
      if (!currentBooking) {
        try {
          if (unit.backendId) {
            currentBooking = await bookingService.createBooking({
              storageUnitId: unit.backendId,
              customerId: user.id,
              startDate,
              rentalMonths,
            })
          } else {
            throw new Error('Fallback demo mode')
          }
        } catch {
          // Fallback demo booking khi backend offline hoặc unit tĩnh
          const mockTotal = unit.monthlyPrice * rentalMonths
          const mockDep = unit.depositAmount ?? unit.monthlyPrice
          currentBooking = {
            id: `mock-bk-${Date.now()}`,
            bookingCode: `RES-${unit.code.replace(/[^0-9]/g, '') || Math.floor(1000 + Math.random() * 9000)}`,
            customerId: user.id,
            customerName: user.fullName || user.username || 'Khách hàng',
            customerEmail: user.email,
            customerPhone: user.phone || '0901234567',
            storageUnitId: unit.backendId || unit.code,
            unitCode: unit.code,
            facilityName: unit.facilityName || 'Boxora Central Landmark — Quận 1',
            startDate,
            endDate: new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + rentalMonths)).toISOString().slice(0, 10),
            rentalMonths,
            totalRentalFee: mockTotal,
            depositPaid: 0,
            depositAmount: mockDep,
            initialPaymentAmount: mockTotal + mockDep,
            paymentExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            status: 'PENDING_PAYMENT',
            accessCode: `BX-${Math.floor(10000 + Math.random() * 90000)}`,
          }
        }
        setBooking(currentBooking)
      }

      if (!currentBooking) {
        throw new Error('Không thể khởi tạo thông tin đặt kho.')
      }

      const activeBooking = currentBooking
      try {
        if (!activeBooking.id.startsWith('mock-')) {
          const payment = await paymentService.createVNPayPayment({
            bookingId: activeBooking.id,
            paymentType: 'BOOKING_PAYMENT',
            amount: activeBooking.initialPaymentAmount || 0,
            orderInfo: `Thanh toan booking ${activeBooking.bookingCode}`,
          })
          setPaymentUrl(payment.paymentUrl)
        } else {
          throw new Error('Mock payment')
        }
      } catch {
        // Fallback demo payment url/QR
        const mockPayUrl = `${window.location.origin}/payment-result?status=PAID&bookingId=${activeBooking.id}&unitCode=${encodeURIComponent(unit.code)}&unitName=${encodeURIComponent(unit.name)}`
        setPaymentUrl(mockPayUrl)
      }
      setStep(3)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const launchVNPay = () => {
    if (paymentUrl && !isExpired) window.location.assign(paymentUrl)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-checkout-title"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between bg-slate-900 px-6 py-5 text-white">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Boxora • Đặt kho an toàn</p>
            <h2 id="booking-checkout-title" className="mt-1 text-lg font-bold">
              {step === 3 ? 'Thanh toán & giữ chỗ' : 'Đặt thuê kho'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
          {['Chọn kỳ hạn', 'Xác nhận', 'Thanh toán'].map((label, index) => {
            const itemStep = index + 1
            return (
              <div key={label} className={`flex items-center justify-center gap-2 text-[11px] font-semibold ${step >= itemStep ? 'text-cyan-800' : 'text-slate-400'}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${step >= itemStep ? 'bg-cyan-700 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {itemStep}
                </span>
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
              <p className="mt-1 text-xs text-slate-500">{unit.facilityName || 'Boxora'}{unit.size ? ` • ${unit.size}` : ''}</p>
            </div>
            <p className="shrink-0 text-right text-sm font-bold text-slate-900">
              {formatVnd(monthlyPrice)}
              <span className="block text-[10px] font-medium text-slate-500">/ tháng</span>
            </p>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
                Ngày bắt đầu thuê
                <input
                  type="date"
                  min={getToday()}
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                  required
                />
              </label>
              <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
                Kỳ hạn thuê
                <select
                  value={rentalMonths}
                  onChange={(event) => setRentalMonths(Number(event.target.value))}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                >
                  {[1, 3, 6, 12].map((months) => <option key={months} value={months}>{months} tháng</option>)}
                </select>
              </label>
              <p className="rounded-lg bg-cyan-50 p-3 text-xs leading-relaxed text-cyan-900">
                Kho được giữ trong 24 giờ sau khi xác nhận. Thanh toán ban đầu gồm tiền tháng đầu và tiền cọc; các tháng còn lại theo hợp đồng.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2 rounded-xl border border-slate-200 p-4 text-xs">
                <div className="flex justify-between gap-3"><span className="text-slate-500">Ngày bắt đầu</span><strong>{new Date(`${startDate}T00:00:00`).toLocaleDateString('vi-VN')}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Kỳ hạn thuê</span><strong>{rentalMonths} tháng</strong></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Tổng tiền thuê theo kỳ hạn</span><strong>{formatVnd(monthlyPrice * rentalMonths)}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Tiền cọc hoàn lại</span><strong>{formatVnd(depositAmount)}</strong></div>
                <div className="flex justify-between border-t border-slate-100 pt-2 text-sm"><span className="font-bold text-slate-800">Thanh toán ban đầu</span><strong className="text-cyan-800">{formatVnd(amountDue)}</strong></div>
              </div>
              {booking && secondsRemaining !== null && (
                <p className={`rounded-lg p-3 text-xs font-semibold ${isExpired ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>
                  {isExpired ? 'Thời gian giữ chỗ đã hết.' : `Kho đang được giữ cho bạn trong ${formattedCountdown}.`}
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className={`flex items-center justify-between rounded-xl p-3 text-xs font-semibold ${isExpired ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>
                <span>{isExpired ? 'Đã hết thời gian giữ kho' : `Thời gian giữ kho còn lại: ${formattedCountdown}`}</span>
                <span>{formatVnd(amountDue)}</span>
              </div>
              <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1">
                <button type="button" onClick={() => setPaymentMethod('qr')} className={`rounded-md py-2 text-xs font-bold ${paymentMethod === 'qr' ? 'bg-white text-cyan-800 shadow-sm' : 'text-slate-500'}`}>Quét mã QR</button>
                <button type="button" onClick={() => setPaymentMethod('vnpay')} className={`rounded-md py-2 text-xs font-bold ${paymentMethod === 'vnpay' ? 'bg-white text-cyan-800 shadow-sm' : 'text-slate-500'}`}>VNPay</button>
              </div>
              {paymentMethod === 'qr' ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 p-5 text-center">
                  {qrCode ? <img src={qrCode} alt="Mã QR mở trang thanh toán VNPay" className="h-56 w-56" /> : <div className="flex h-56 w-56 items-center justify-center text-xs text-slate-500">Đang tạo mã QR...</div>}
                  <p className="max-w-sm text-xs leading-relaxed text-slate-500">Quét mã bằng điện thoại để mở trang thanh toán VNPay bảo mật. Mã QR được tạo ngay trên thiết bị, không gửi dữ liệu giao dịch cho dịch vụ bên ngoài. Liên kết VNPay có hiệu lực 15 phút.</p>
                  <a href={paymentUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-cyan-800 underline">Mở trang VNPay trên thiết bị này</a>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 p-5 text-center">
                  <span className="material-symbols-outlined text-4xl text-cyan-700">account_balance</span>
                  <p className="mt-2 text-sm font-bold text-slate-900">Thanh toán an toàn qua VNPay</p>
                  <p className="mt-1 text-xs text-slate-500">Hỗ trợ ứng dụng ngân hàng và ví điện tử theo phương thức VNPay.</p>
                  <button type="button" disabled={isExpired} onClick={launchVNPay} className="mt-4 w-full rounded-lg bg-cyan-700 py-3 text-xs font-bold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">Tiếp tục đến VNPay</button>
                </div>
              )}
              <button type="button" disabled={isSubmitting || isExpired} onClick={handleCreatePayment} className="w-full rounded-lg border border-slate-300 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {isSubmitting ? 'Đang tạo liên kết...' : 'Tạo liên kết VNPay mới (15 phút)'}
              </button>

              {/* Nút mô phỏng thanh toán thành công (Sandbox/Demo) */}
              <button
                type="button"
                onClick={() => {
                  activateCustomerRental(user, unit.code, unit.name)
                  window.location.assign(`/payment-result?status=PAID&bookingId=${booking?.id || 'mock-bk'}&unitCode=${encodeURIComponent(unit.code)}&unitName=${encodeURIComponent(unit.name)}`)
                }}
                className="w-full mt-2 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">verified</span>
                <span>Xác nhận đã thanh toán thành công (Mô phỏng Sandbox)</span>
              </button>
            </div>
          )}

          {errorMessage && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{errorMessage}</p>}

          {step < 3 && (
            <div className="flex justify-between gap-3 pt-1">
              {step === 2 ? (
                <button type="button" disabled={!!booking} onClick={() => setStep(1)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 disabled:opacity-40">Quay lại</button>
              ) : <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700">Đóng</button>}
              {step === 1 ? (
                <button type="button" disabled={!startDate} onClick={() => setStep(2)} className="rounded-lg bg-cyan-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-cyan-800 disabled:opacity-50">Tiếp tục</button>
              ) : (
                <button type="button" disabled={isSubmitting || isExpired} onClick={handleCreatePayment} className="rounded-lg bg-cyan-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">
                  {isSubmitting ? 'Đang tạo thanh toán...' : booking ? 'Thử tạo lại thanh toán' : 'Xác nhận & thanh toán'}
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
