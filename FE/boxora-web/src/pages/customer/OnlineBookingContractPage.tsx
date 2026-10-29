import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LayoutDashboard, CheckCircle2, CreditCard, FileText, Lock } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext'
import { activateCustomerRental, checkCustomerPortalAccess } from '../../utils/rentalAccess'
import { Booking, RentalContract, FacilityPolicy } from '../../types'
import { bookingService } from '../../services/bookingService'
import { contractService } from '../../services/contractService'
import { paymentService, PaymentItem } from '../../services/paymentService'
import { ContractDocumentModal } from '../../components/modals/ContractDocumentModal'
import { DocuSealSimulationModal } from '../../components/modals/DocuSealSimulationModal'
import { facilityService } from '../../services/facilityService'
import { QuickThemeLanguageToggle } from '../../components/common/QuickThemeLanguageToggle'

const money = (value?: number | null) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString('vi-VN') : 'Chưa xác định'
const dateTime = (value?: string | null) => value
  ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Chưa xác định'

function isSigned(contract: RentalContract | null) {
  if (!contract || contract.status === 'SUPERSEDED' || contract.status === 'PENDING_SIGNATURE' || contract.status === 'CANCELLED') {
    return false
  }
  return Boolean(contract?.signedAt)
    || contract?.status === 'PENDING_ACTIVATION'
    || contract?.status === 'ACTIVE'
}

export const OnlineBookingContractPage = () => {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const bookingId = searchParams.get('bookingId') || ''
  const [booking, setBooking] = useState<Booking | null>(null)
  const [contract, setContract] = useState<RentalContract | null>(null)
  const [, setPolicy] = useState<FacilityPolicy | null>(null)
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [showDocument, setShowDocument] = useState(false)
  const [contractForSimulation, setContractForSimulation] = useState<RentalContract | null>(null)
  const [justSigned, setJustSigned] = useState(false)
  const [autoSignTriggered, setAutoSignTriggered] = useState(false)

  const refresh = useCallback(async (initial = false) => {
    if (!bookingId) {
      setError('Thiếu mã đặt thuê để mở hồ sơ.')
      setLoading(false)
      return
    }
    if (initial) setLoading(true)
    try {
      const [bookingResult, contractResult, paymentResult] = await Promise.all([
        bookingService.getById(bookingId),
        contractService.getContractByBookingId(bookingId).catch(() => null),
        paymentService.getByBookingId(bookingId).catch(() => [] as PaymentItem[]),
      ])
      setBooking(bookingResult)
      if (contractResult) setContract(contractResult)
      setPayments(paymentResult)
      setError('')
    } catch (requestError) {
      if (axios.isAxiosError<{ message?: string }>(requestError)) {
        setError(requestError.response?.data?.message || 'Không thể tải thông tin đơn đặt thuê. Vui lòng thử lại.')
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
  const paymentConfirmed = booking?.paymentStatus?.toUpperCase() === 'PAID' || Boolean(paidPayment) || paidAmount > 0
  const signed = isSigned(contract) || (Boolean(booking?.contractSigned) && contract?.status !== 'SUPERSEDED' && contract?.status !== 'PENDING_SIGNATURE' && booking?.status !== 'PENDING_SIGNATURE')
  const payableTotal = Number(booking?.totalRentalFee || 0) + Number(booking?.depositAmount || 0)

  // Auto-open signing modal when paymentConfirmed is true and autoSign=true or mockSignContractId is present
  useEffect(() => {
    if (!paymentConfirmed || !contract || signed || autoSignTriggered) return
    const mockId = searchParams.get('mockSignContractId')
    const autoSign = searchParams.get('autoSign') === 'true'
    if ((mockId && contract.id === mockId) || autoSign) {
      setAutoSignTriggered(true)
      setContractForSimulation(contract)
    }
  }, [searchParams, contract, paymentConfirmed, signed, autoSignTriggered])

  useEffect(() => {
    if (signed && paymentConfirmed && booking && user) {
      activateCustomerRental(
        user,
        booking.unitCode || 'KHO-BX',
        booking.facilityName || 'Boxora Smart Storage',
        contract?.contractCode
      )
    }
  }, [signed, paymentConfirmed, booking, user, contract?.contractCode])

  const paymentDeadline = booking?.paymentExpiresAt || booking?.holdExpiresAt
  const paymentExpired = booking?.status === 'PENDING_PAYMENT'
    && Boolean(paymentDeadline && new Date(paymentDeadline).getTime() <= Date.now())
  const canPay = !paymentConfirmed && !paymentExpired
    && (booking?.status === 'PENDING_PAYMENT' || booking?.status === 'CONFIRMED')

  const startPayment = async () => {
    if (!booking || !canPay) return
    setPaying(true)
    setError('')
    try {
      const payment = await paymentService.createVNPayPayment({
        bookingId: booking.id,
        paymentType: 'BOOKING_PAYMENT',
        amount: payableTotal,
        orderInfo: `Thanh toan booking ${booking.bookingCode}`,
        returnUrl: `${window.location.origin}/payment-result`,
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
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-slate-600">Đang tải thông tin đơn đặt thuê…</p>
      </main>
    )
  }

  if (!booking) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <section className="mx-auto mt-16 max-w-xl rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Chưa mở được hồ sơ đặt thuê</h1>
          <p className="mt-3 text-sm text-rose-700">{error || 'Không tìm thấy đơn đặt thuê này.'}</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => void refresh(true)} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 transition cursor-pointer">Thử tải lại</button>
            <Link to="/portal/customer?tab=bookings" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition">
              <LayoutDashboard className="h-4 w-4 text-slate-500" />
              <span>Về đơn đặt chỗ của tôi</span>
            </Link>
          </div>
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
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
              {paymentConfirmed ? 'Ký hợp đồng điện tử' : 'Thanh toán đơn đặt thuê'}
            </h1>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              to="/portal/customer?tab=bookings"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>Đơn đặt chỗ của tôi</span>
            </Link>
            <QuickThemeLanguageToggle />
          </div>
        </header>

        {/* 2-Step Progress Indicator: Step 1 (Thanh toán) -> Step 2 (Ký hợp đồng điện tử) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className={`rounded-2xl border p-4 flex items-center gap-3.5 ${
            paymentConfirmed
              ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950'
              : 'border-blue-500 bg-blue-50/80 text-blue-950 ring-2 ring-blue-500/15'
          }`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
              paymentConfirmed ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
            }`}>
              {paymentConfirmed ? <CheckCircle2 className="h-5 w-5" /> : <CreditCard className="h-4 w-4" />}
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider opacity-75 block">Bước 1</span>
              <p className="font-bold text-sm">
                {paymentConfirmed ? 'Đã hoàn tất thanh toán' : 'Thanh toán đơn đặt thuê'}
              </p>
            </div>
          </div>

          <div className={`rounded-2xl border p-4 flex items-center gap-3.5 ${
            !paymentConfirmed
              ? 'border-slate-200 bg-slate-100/80 text-slate-400'
              : signed
                ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950'
                : 'border-blue-500 bg-blue-50/80 text-blue-950 ring-2 ring-blue-500/15'
          }`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
              !paymentConfirmed
                ? 'bg-slate-200 text-slate-500'
                : signed
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 text-white'
            }`}>
              {!paymentConfirmed ? <Lock className="h-4 w-4" /> : signed ? <CheckCircle2 className="h-5 w-5" /> : <FileText className="h-4 w-4" />}
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider opacity-75 block">Bước 2</span>
              <p className="font-bold text-sm">
                {!paymentConfirmed
                  ? 'Ký hợp đồng điện tử (Mở sau khi thanh toán)'
                  : signed
                    ? 'Đã ký hợp đồng điện tử'
                    : 'Ký hợp đồng điện tử'}
              </p>
            </div>
          </div>
        </div>

        {justSigned && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 text-emerald-900 shadow-sm flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-2xl">verified</span>
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-emerald-950">
                  Xác nhận đã ký hợp đồng điện tử thành công!
                </h3>
                {contract?.contractCode && (
                  <span className="text-[10px] bg-emerald-200/80 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                    {contract.contractCode}
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Chữ ký số của quý khách đã được lưu trữ hợp lệ trên hệ thống Boxora. Đơn đặt thuê của quý khách đã hoàn tất đầy đủ thanh toán và ký hợp đồng trực tuyến.
              </p>
            </div>
            <button
              onClick={() => setJustSigned(false)}
              className="text-emerald-700 hover:text-emerald-900 p-1 rounded-lg cursor-pointer"
              title="Đóng thông báo"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        )}

        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

        {/* =========================================================================
           TRƯỜNG HỢP 1: CHƯA THANH TOÁN (!paymentConfirmed)
           -> Chỉ hiển thị thông tin đơn & nút Thanh toán VNPay (KHÔNG hiện hợp đồng ra cho ký trước khi thanh toán)
           ========================================================================= */}
        {!paymentConfirmed ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs text-slate-500">Mã đơn đặt thuê</p>
                <h2 className="font-mono text-lg font-bold text-slate-900">{booking.bookingCode}</h2>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                Chờ thanh toán
              </span>
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-xs text-slate-500">Kho và cơ sở</span>
                <p className="mt-1 font-semibold text-slate-900">
                  {booking.unitCode ? `#${booking.unitCode}` : 'Kho tiêu chuẩn'} · {booking.facilityName}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-xs text-slate-500">Kỳ hạn thuê</span>
                <p className="mt-1 font-semibold text-slate-900">
                  {booking.rentalMonths} tháng · {date(booking.startDate)} – {date(booking.endDate)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-xs text-slate-500">Lịch hẹn nhận kho</span>
                <p className="mt-1 font-semibold text-slate-900">{dateTime(booking.expectedCheckInAt)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-xs text-slate-500">Khách hàng &amp; CCCD</span>
                <p className="mt-1 font-semibold text-slate-900">
                  {booking.customerName || 'Khách hàng'} · {booking.identityCardNumber || 'Đã lưu'}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Chi tiết thanh toán</h3>
              <dl className="divide-y divide-slate-100 text-sm">
                <div className="flex justify-between py-2.5">
                  <dt className="text-slate-600">Tiền thuê ({booking.rentalMonths} tháng)</dt>
                  <dd className="font-semibold text-slate-900">{money(booking.totalRentalFee)}</dd>
                </div>
                <div className="flex justify-between py-2.5">
                  <dt className="text-slate-600">Tiền cọc giữ chỗ (1 tháng)</dt>
                  <dd className="font-semibold text-slate-900">{money(booking.depositAmount)}</dd>
                </div>
                <div className="flex justify-between pt-3 font-bold text-base">
                  <dt className="text-slate-900">Tổng thanh toán</dt>
                  <dd className="text-blue-700 font-mono">{money(payableTotal)}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 leading-relaxed flex items-start gap-2.5">
              <Lock className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Lưu ý quy trình:</strong> Hợp đồng điện tử chỉ được mở để ký sau khi quý khách hoàn tất thanh toán đơn đặt thuê. Sau khi thanh toán qua VNPay thành công, hệ thống sẽ hiển thị ngay hợp đồng điện tử để quý khách ký xác nhận.
              </span>
            </div>

            {paymentExpired ? (
              <p className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900">
                Thời hạn giữ chỗ thanh toán của đơn này đã hết. Vui lòng tạo đơn đặt thuê mới hoặc liên hệ Boxora để được hỗ trợ.
              </p>
            ) : canPay ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={paying}
                  onClick={() => void startPayment()}
                  className="w-full sm:w-auto rounded-xl bg-blue-600 hover:bg-blue-700 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-600/20 disabled:opacity-50 cursor-pointer transition"
                >
                  {paying ? 'Đang kết nối cổng VNPay...' : `Thanh toán trực tuyến qua VNPay (${money(payableTotal)})`}
                </button>
              </div>
            ) : (
              <p className="text-xs text-amber-800">
                Đơn đặt thuê hiện không ở trạng thái có thể thanh toán trực tuyến.
              </p>
            )}
          </section>
        ) : (
          /* =========================================================================
             TRƯỜNG HỢP 2: ĐÃ THANH TOÁN THÀNH CÔNG (paymentConfirmed === true)
             -> Hiển thị xác nhận thanh toán & mở Hợp đồng điện tử cho khách ký
             ========================================================================= */
          <>
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-950">Đã thanh toán thành công đơn đặt thuê #{booking.bookingCode}</p>
                  <p className="text-xs text-emerald-800">
                    Mã giao dịch: <span className="font-mono font-semibold">{paidPayment?.transactionId || 'Đã xác nhận'}</span> · Số tiền: <strong>{money(paidAmount || payableTotal)}</strong>
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                Đã thanh toán
              </span>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs text-slate-500">Hợp đồng thuê kho điện tử</p>
                  <h2 className="font-mono text-lg font-bold text-slate-900">
                    {contract?.contractCode || `CTR-${booking.bookingCode}`}
                  </h2>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-bold ${signed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                  Hợp đồng: {signed ? 'Đã ký điện tử' : 'Chờ ký điện tử'}
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <span className="text-xs text-slate-500">Kho và cơ sở</span>
                  <p className="mt-1 font-semibold text-slate-900">
                    {booking.unitCode ? `#${booking.unitCode}` : 'Kho tiêu chuẩn'} · {booking.facilityName}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <span className="text-xs text-slate-500">Mã đơn đặt thuê</span>
                  <p className="mt-1 font-mono font-semibold text-slate-900">{booking.bookingCode}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <span className="text-xs text-slate-500">Kỳ hạn thuê</span>
                  <p className="mt-1 font-semibold text-slate-900">
                    {booking.rentalMonths} tháng · {date(booking.startDate)} – {date(booking.endDate)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <span className="text-xs text-slate-500">Lịch hẹn nhận kho</span>
                  <p className="mt-1 font-semibold text-slate-900">{dateTime(booking.expectedCheckInAt)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2">
                  <span className="text-xs text-slate-500">Thông tin người thuê &amp; Giấy tờ định danh</span>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold text-slate-900 text-sm">
                    <span>{contract?.customerName || booking.customerName || 'Khách hàng'}</span>
                    <span className="text-slate-300">|</span>
                    <span>SĐT: {contract?.customerPhone || booking.customerPhone || 'Theo hồ sơ'}</span>
                    <span className="text-slate-300">|</span>
                    <span className="flex items-center gap-1.5 text-blue-900">
                      <span className="text-xs text-slate-500 font-normal">{booking.identityCardType || contract?.identityCardType || 'CCCD'}:</span>
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                        {booking.identityCardNumber || contract?.identityCardNumber || 'Chưa cung cấp'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-950">
                <p className="font-bold">Hiệu lực hợp đồng &amp; Bàn giao kho</p>
                <p className="mt-1 text-xs leading-relaxed">
                  {signed
                    ? `Hợp đồng điện tử đã ký kết thành công và có hiệu lực ngay lập tức! Hệ thống đã tự động gán ô kho ${booking.unitCode ? `số #${booking.unitCode}` : ''} và gửi email thông tin nhận kho cùng mã khóa thông minh IoT thẳng đến email của quý khách.`
                    : 'Hợp đồng điện tử có giá trị pháp lý ngay sau khi quý khách ký xác nhận trực tuyến. Hệ thống sẽ tự động gán ô kho vật lý và gửi email mã khóa thông minh IoT ngay lập tức cho quý khách.'}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2.5">
                {!signed && contract && (
                  <button
                    type="button"
                    onClick={() => setContractForSimulation(contract)}
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 cursor-pointer transition"
                  >
                    Ký hợp đồng điện tử ngay
                  </button>
                )}
                {contract && (
                  <button
                    type="button"
                    onClick={() => setShowDocument(true)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 cursor-pointer transition"
                  >
                    {signed ? 'Xem hợp đồng đã ký' : 'Xem nội dung hợp đồng'}
                  </button>
                )}
                <Link
                  to="/portal/customer?tab=bookings"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Về đơn đặt chỗ của tôi</span>
                </Link>
                {signed && (
                  <Link
                    to="/portal/customer"
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Vào Portal Quản Lý Kho</span>
                  </Link>
                )}
              </div>
            </section>
          </>
        )}

        {showDocument && contract && (
          <ContractDocumentModal
            contract={contract}
            booking={booking}
            onClose={() => setShowDocument(false)}
            onSignNow={!signed && paymentConfirmed ? () => {
              setShowDocument(false)
              setContractForSimulation(contract)
            } : undefined}
          />
        )}
        {contractForSimulation && paymentConfirmed && (
          <DocuSealSimulationModal
            contract={contractForSimulation}
            booking={booking}
            onClose={() => setContractForSimulation(null)}
            onSignedSuccess={(updated) => {
              setContract(updated)
              setContractForSimulation(null)
              setJustSigned(true)
              void refresh()
            }}
          />
        )}
      </section>
    </main>
  )
}
