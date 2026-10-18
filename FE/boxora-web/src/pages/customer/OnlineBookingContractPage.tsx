import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { Booking, RentalContract } from '../../types'
import { bookingService } from '../../services/bookingService'
import { contractService } from '../../services/contractService'
import { paymentService, PaymentItem } from '../../services/paymentService'
import { ContractDocumentModal } from '../../components/modals/ContractDocumentModal'
import { ContractOtpModal } from '../../components/modals/ContractOtpModal'
import { facilityService } from '../../services/facilityService'
import { FacilityPolicy } from '../../types'

const money = (value?: number | null) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString('vi-VN') : 'Chưa xác định'
const dateTime = (value?: string | null) => value
  ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Chưa xác định'

function isSigned(contract: RentalContract | null) {
  return Boolean(contract?.signedAt)
    && (contract?.status === 'PENDING_ACTIVATION' || contract?.status === 'ACTIVE')
}

export const OnlineBookingContractPage = () => {
  const [searchParams] = useSearchParams()
  const bookingId = searchParams.get('bookingId') || ''
  const [booking, setBooking] = useState<Booking | null>(null)
  const [contract, setContract] = useState<RentalContract | null>(null)
  const [policy, setPolicy] = useState<FacilityPolicy | null>(null)
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [showDocument, setShowDocument] = useState(false)
  const [showOtp, setShowOtp] = useState(false)

  const refresh = useCallback(async (initial = false) => {
    if (!bookingId) {
      setError('Thiếu mã đặt thuê để mở hợp đồng.')
      setLoading(false)
      return
    }
    if (initial) setLoading(true)
    try {
      const [bookingResult, contractResult, paymentResult] = await Promise.all([
        bookingService.getById(bookingId),
        contractService.getContractByBookingId(bookingId),
        paymentService.getByBookingId(bookingId).catch(() => [] as PaymentItem[]),
      ])
      setBooking(bookingResult)
      setContract(contractResult)
      setPayments(paymentResult)
      setError('')
    } catch (requestError) {
      if (axios.isAxiosError<{ message?: string }>(requestError)) {
        setError(requestError.response?.data?.message || 'Không thể tải đơn đặt thuê hoặc hợp đồng. Vui lòng thử lại.')
      } else {
        setError(requestError instanceof Error ? requestError.message : 'Không thể tải thông tin đặt thuê.')
      }
    } finally {
      if (initial) setLoading(false)
    }
  }, [bookingId])

  useEffect(() => {
    void refresh(true)
  }, [refresh])

  useEffect(() => {
    if (!booking?.facilityId) return
    let active = true
    facilityService.getPolicyByFacilityId(booking.facilityId)
      .then(value => { if (active) setPolicy(value) })
      .catch(() => { if (active) setPolicy(null) })
    return () => { active = false }
  }, [booking?.facilityId])

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 4000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const paidTransactions = payments.filter(payment => payment.status === 'PAID'
    && ['BOOKING_PAYMENT', 'DEPOSIT', 'RENTAL_FEE'].includes(payment.paymentType))
  const paidPayment = paidTransactions.find(payment => payment.paymentType === 'BOOKING_PAYMENT') || paidTransactions[0] || null
  const paidAmount = paidTransactions.reduce((total, payment) => total + Number(payment.amount || 0), 0)
  const paymentConfirmed = booking?.paymentStatus?.toUpperCase() === 'PAID'
  const signed = isSigned(contract)
  const payableTotal = Number(booking?.totalRentalFee || 0) + Number(booking?.depositAmount || 0)
  const paymentDeadline = booking?.paymentExpiresAt || booking?.holdExpiresAt
  const paymentExpired = booking?.status === 'PENDING_PAYMENT'
    && (!paymentDeadline || new Date(paymentDeadline).getTime() <= Date.now())
  const canPay = signed && !paymentConfirmed && !paymentExpired
    && (booking?.status === 'PENDING_PAYMENT' || booking?.status === 'CONFIRMED')

  const startPayment = async () => {
    if (!booking || !canPay) return
    setPaying(true)
    setError('')
    try {
      // Backend validates the confirmed DocuSeal signature and recalculates the payable amount.
      const payment = await paymentService.createVNPayPayment({
        bookingId: booking.id,
        paymentType: 'BOOKING_PAYMENT',
        amount: payableTotal,
        orderInfo: `Thanh toan booking ${booking.bookingCode}`,
      })
      window.location.assign(payment.paymentUrl)
    } catch (requestError) {
      if (axios.isAxiosError<{ message?: string }>(requestError)) {
        setError(requestError.response?.data?.message || 'Không thể tạo giao dịch thanh toán. Vui lòng thử lại.')
      } else {
        setError(requestError instanceof Error ? requestError.message : 'Không thể tạo giao dịch thanh toán.')
      }
      setPaying(false)
      void refresh()
    }
  }

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6"><p className="text-sm text-slate-600">Đang tải thông tin hợp đồng…</p></main>
  }

  if (!booking || !contract) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <section className="mx-auto mt-16 max-w-xl rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Chưa mở được hồ sơ đặt thuê</h1>
          <p className="mt-3 text-sm text-rose-700">{error || 'Không tìm thấy hợp đồng cho đơn đặt thuê này.'}</p>
          <button onClick={() => void refresh(true)} className="mt-5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Thử tải lại</button>
          <Link to="/portal/customer" className="mt-4 block text-sm text-slate-600 underline">Về trang tổng quan</Link>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-4xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Boxora · Đặt thuê trực tuyến</p>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Hợp đồng và thanh toán</h1>
          </div>
          <Link to="/portal/customer" className="text-sm font-semibold text-slate-600 underline">Trang tổng quan</Link>
        </header>

        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs text-slate-500">Mã đặt thuê</p>
              <h2 className="font-mono text-lg font-bold text-slate-900">{booking.bookingCode}</h2>
            </div>
            <div className={`rounded-full px-3 py-1 text-xs font-bold ${signed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
              Hợp đồng: {signed ? 'Đã ký điện tử' : contract.status === 'CANCELLED' ? 'Đã hủy' : 'Chờ ký'}
            </div>
          </div>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">Kho và cơ sở</span><p className="mt-1 font-semibold text-slate-900">{booking.unitCode} · {booking.facilityName}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">Mã hợp đồng</span><p className="mt-1 font-mono font-semibold text-slate-900">{contract.contractCode}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">Kỳ hạn thuê</span><p className="mt-1 font-semibold text-slate-900">{booking.rentalMonths} tháng · {date(booking.startDate)} – {date(booking.endDate)}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">Lịch hẹn nhận kho</span><p className="mt-1 font-semibold text-slate-900">{dateTime(booking.expectedCheckInAt)}</p></div>
          </div>

          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-950">
            <p className="font-bold">Ngày bắt đầu thuê chính thức</p>
            <p className="mt-1 text-xs leading-relaxed">Ngày hẹn ở trên là lịch nhận kho dự kiến. Theo quy trình bàn giao hiện tại, thời hạn thuê và ngày kết thúc chính thức được xác lập khi nhân viên hoàn tất check-in tại cơ sở; việc ký hợp đồng hoặc thanh toán chưa kích hoạt PIN hay quyền vào kho.</p>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <p className="font-bold text-slate-900">Hủy, chấm dứt và hoàn tiền</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600">
              <li>Hủy trước lịch nhận kho từ {policy?.cancellationFullRefundHours ?? 48} giờ: hoàn 100% tiền cọc đã thanh toán.</li>
              <li>Từ {policy?.cancellationPartialRefundHours ?? 24} đến dưới {policy?.cancellationFullRefundHours ?? 48} giờ: hoàn {policy?.cancellationPartialRefundPercent ?? 50}% tiền cọc đã thanh toán.</li>
              <li>Dưới {policy?.cancellationPartialRefundHours ?? 24} giờ hoặc sau lịch hẹn: không hoàn tiền cọc theo chính sách hủy hiện hành.</li>
              <li>Chấm dứt sau khi thuê và hoàn cọc tuân theo hợp đồng đã ký, quy trình trả kho/kiểm tra hiện trạng và hồ sơ hoàn tiền của Boxora.</li>
            </ul>
            <p className="mt-2 text-[11px] text-slate-500">Mốc hủy được tính theo lịch hẹn nhận kho; số tiền hoàn chỉ áp dụng với khoản cọc đã thanh toán và được backend tính lại khi gửi yêu cầu hủy.</p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowDocument(true)} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50">
              {signed ? 'Xem hợp đồng đã ký' : 'Xem nội dung hợp đồng'}
            </button>
            {!signed && contract.status !== 'CANCELLED' && (
              <button type="button" onClick={() => setShowOtp(true)} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800">
                Tiếp tục ký điện tử
              </button>
            )}
          </div>
          {!signed && (
            <p className="mt-3 text-xs leading-relaxed text-slate-500">Sau khi ký trên DocuSeal, hãy quay lại trang này. Boxora chỉ mở bước thanh toán khi webhook đã xác thực trạng thái ký.</p>
          )}
        </section>

        {signed && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Hợp đồng đã ký</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Nghĩa vụ thanh toán</h2>
                {contract.signedAt && <p className="mt-1 text-xs text-slate-500">Thời điểm xác nhận ký: {dateTime(contract.signedAt)}</p>}
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Đã ký điện tử</span>
            </div>
            <dl className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
              <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-slate-600">Tiền thuê ({booking.rentalMonths} tháng)</dt><dd className="font-semibold text-slate-900">{money(booking.totalRentalFee)}</dd></div>
              <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-slate-600">Tiền cọc</dt><dd className="font-semibold text-slate-900">{money(booking.depositAmount)}</dd></div>
              <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-slate-600">Phí khác</dt><dd className="font-semibold text-slate-900">Không có khoản phí khác trong booking</dd></div>
              <div className="flex justify-between gap-4 py-3 text-sm"><dt className="font-bold text-slate-900">Tổng thanh toán</dt><dd className="font-extrabold text-blue-800">{money(payableTotal)}</dd></div>
            </dl>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <span>Phương thức hỗ trợ: VNPay · Thanh toán trực tuyến</span>
              <span>Trạng thái thanh toán: {paymentConfirmed ? 'Đã xác nhận' : payments.some(p => p.status === 'PENDING') ? 'Đang chờ xác minh' : booking.paymentStatus?.toUpperCase() === 'PARTIALLY_PAID' ? 'Đã thanh toán một phần' : 'Chưa hoàn tất'}</span>
            </div>
            {paymentExpired && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">Thời hạn giữ kho hiện tại đã hết. Không mở giao dịch mới; hãy liên hệ Boxora để đối soát trạng thái booking và hợp đồng.</p>}

            {paymentConfirmed ? (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="font-bold">Đặt thuê và thanh toán thành công!</p>
                <p className="mt-1">Mã giao dịch: <span className="font-mono">{paidPayment?.transactionId || 'Đã xác nhận'}</span> · Số tiền: {money(paidAmount)}</p>
                <p className="mt-1 text-xs">Trạng thái nhận kho: chờ hoàn tất bàn giao tại cơ sở. PIN chỉ được cấp theo quy trình check-in.</p>
              </div>
            ) : (
              <button type="button" disabled={!canPay || paying} onClick={() => void startPayment()} className="mt-5 w-full rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
                {paying ? 'Đang chuyển đến VNPay…' : payments.some(p => p.status === 'PENDING') ? 'Tiếp tục thanh toán trực tuyến' : 'Thanh toán trực tuyến'}
              </button>
            )}
            {!paymentConfirmed && !canPay && <p className="mt-3 text-xs text-amber-800">Đơn đặt thuê hiện không ở trạng thái có thể thanh toán. Vui lòng liên hệ Boxora để được đối soát.</p>}
          </section>
        )}

        {showDocument && <ContractDocumentModal contract={contract} booking={booking} onClose={() => setShowDocument(false)} onSignNow={() => { setShowDocument(false); setShowOtp(true) }} />}
        {showOtp && <ContractOtpModal contract={contract} allowSimulation={false} onClose={() => setShowOtp(false)} />}
      </section>
    </main>
  )
}
