import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Link, useSearchParams } from 'react-router-dom'
import { bookingService } from '../../services/bookingService'
import { paymentService, PaymentItem } from '../../services/paymentService'
import { contractService } from '../../services/contractService'
import { Booking, RentalContract } from '../../types'
import { ContractDocumentModal } from '../../components/modals/ContractDocumentModal'

const money = (value?: number | null) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString('vi-VN') : 'Chưa lên lịch'
const dateTime = (value?: string | null) => value
  ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Chưa lên lịch'

export const PaymentResultPage = () => {
  const [searchParams] = useSearchParams()
  const bookingId = searchParams.get('bookingId') || ''
  const txnRef = searchParams.get('txnRef') || searchParams.get('vnp_TxnRef') || ''
  const gatewayStatus = searchParams.get('status') || ''
  const [booking, setBooking] = useState<Booking | null>(null)
  const [contract, setContract] = useState<RentalContract | null>(null)
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(searchParams.get('error') || '')
  const [retrying, setRetrying] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [showContract, setShowContract] = useState(false)

  const refresh = useCallback(async (initial = false) => {
    if (!bookingId || bookingId.startsWith('mock-')) {
      setError('Không có mã đặt thuê hợp lệ để đối soát giao dịch.')
      setLoading(false)
      return
    }
    if (initial) setLoading(true)
    try {
      const [bookingResult, paymentResult, contractResult] = await Promise.all([
        bookingService.getById(bookingId),
        paymentService.getByBookingId(bookingId).catch(() => [] as PaymentItem[]),
        contractService.getContractByBookingId(bookingId),
      ])
      setBooking(bookingResult)
      setPayments(paymentResult)
      setContract(contractResult)
      setError('')
    } catch (requestError) {
      if (axios.isAxiosError<{ message?: string }>(requestError)) {
        if (requestError.response?.status === 401 || requestError.response?.status === 403) {
          setError('Bạn không có quyền truy cập hồ sơ đặt thuê này. Vui lòng đăng nhập đúng tài khoản khách hàng.')
        } else {
          setError(requestError.response?.data?.message || 'Không thể tải thông tin giao dịch từ máy chủ.')
        }
      } else {
        setError(requestError instanceof Error ? requestError.message : 'Không thể đối soát giao dịch.')
      }
    } finally {
      if (initial) setLoading(false)
    }
  }, [bookingId])

  useEffect(() => {
    void refresh(true)
  }, [refresh])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (attempts < 8) {
        setAttempts(value => value + 1)
        void refresh()
      }
    }, 3000)
    return () => window.clearInterval(timer)
  }, [attempts, refresh])

  const authoritativePayment = useMemo(() => {
    if (txnRef) return payments.find(payment => payment.transactionId === txnRef) || null
    return payments.find(payment => payment.status === 'PAID') || payments[0] || null
  }, [payments, txnRef])
  const paid = authoritativePayment?.status === 'PAID'
  const contractSigned = Boolean(contract?.signedAt)
    && (contract?.status === 'PENDING_ACTIVATION' || contract?.status === 'ACTIVE')
  const pendingReconciliation = !paid && (
    gatewayStatus.toUpperCase() === 'PAID'
    || authoritativePayment?.status === 'PENDING'
    || Boolean(txnRef && !authoritativePayment)
  )
  const paymentFailed = authoritativePayment?.status === 'FAILED' || authoritativePayment?.status === 'EXPIRED'
  const paymentExpired = booking?.paymentExpiresAt
    ? new Date(booking.paymentExpiresAt).getTime() <= Date.now()
    : false

  const retryPayment = async () => {
    if (!booking || !contractSigned || paymentExpired) return
    setRetrying(true)
    setError('')
    try {
      // This endpoint rechecks the signed contract and authoritative amount before creating/reusing a transaction.
      const result = await paymentService.createVNPayPayment({
        bookingId: booking.id,
        paymentType: 'BOOKING_PAYMENT',
        amount: Number(booking.totalRentalFee || 0) + Number(booking.depositAmount || 0),
        orderInfo: `Thanh toan booking ${booking.bookingCode}`,
      })
      window.location.assign(result.paymentUrl)
    } catch (requestError) {
      if (axios.isAxiosError<{ message?: string }>(requestError)) {
        setError(requestError.response?.data?.message || 'Không thể tạo giao dịch thanh toán. Vui lòng tải lại để đối soát.')
      } else {
        setError(requestError instanceof Error ? requestError.message : 'Không thể tạo lại giao dịch thanh toán.')
      }
      setRetrying(false)
      void refresh()
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-600">Đang đối soát thông tin với Boxora…</div>
        ) : paid && booking?.signingMethod === 'ONLINE' && !contractSigned ? (
          <div className="space-y-4 py-7 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700"><span className="material-symbols-outlined text-3xl">hourglass_top</span></div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Thanh toán đã xác nhận · Hợp đồng chưa xác minh</p>
            <h1 className="text-xl font-extrabold text-slate-900">Đơn đặt thuê chưa hoàn tất</h1>
            <p className="mx-auto max-w-md text-sm text-slate-600">Giao dịch này đã được backend xác nhận, nhưng Boxora chưa xác minh hợp đồng đã ký. Khoản thanh toán và lịch sử giao dịch vẫn được giữ để đối soát; trạng thái bàn giao chưa được kích hoạt.</p>
            <p className="font-mono text-xs text-slate-500">Mã đặt thuê: {booking?.bookingCode || bookingId} · Mã giao dịch: {authoritativePayment?.transactionId || txnRef}</p>
            <Link to={`/online-booking-contract?bookingId=${encodeURIComponent(bookingId)}`} className="inline-block rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white">Mở hợp đồng để tiếp tục</Link>
          </div>
        ) : paid ? (
          <div className="space-y-5">
            <header className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><span className="material-symbols-outlined text-3xl">check_circle</span></div>
              <p className="mt-3 text-xs font-bold uppercase tracking-wider text-emerald-700">Thanh toán đã được backend xác nhận</p>
              <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Đặt thuê và thanh toán thành công!</h1>
            </header>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Mã đặt thuê</dt><dd className="mt-1 font-mono font-bold">{booking?.bookingCode || bookingId}</dd></div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Kho và cơ sở</dt><dd className="mt-1 font-semibold">{booking?.unitCode || '—'} · {booking?.facilityName || '—'}</dd></div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Trạng thái hợp đồng</dt><dd className="mt-1 font-semibold text-emerald-700">{contractSigned ? 'Đã ký điện tử' : 'Chưa xác minh chữ ký'}</dd>{contract?.contractCode && <dd className="font-mono text-xs text-slate-500">{contract.contractCode}</dd>}</div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Trạng thái thanh toán</dt><dd className="mt-1 font-semibold text-emerald-700">Đã xác nhận</dd></div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Mã giao dịch</dt><dd className="mt-1 break-all font-mono text-xs font-semibold">{authoritativePayment?.transactionId || txnRef || 'Đã xác nhận'}</dd></div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Số tiền đã thanh toán</dt><dd className="mt-1 font-mono font-bold text-emerald-700">{money(authoritativePayment?.amount)}</dd></div>
            </dl>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
              <div className="flex flex-wrap justify-between gap-2"><strong>Trạng thái nhận kho</strong><span className="font-bold">{booking?.status === 'ACTIVE' ? 'Đã hoàn tất bàn giao' : 'Chờ hoàn tất bàn giao'}</span></div>
              <p className="mt-2 text-xs">Lịch hẹn nhận kho: <strong>{dateTime(booking?.expectedCheckInAt)}</strong></p>
              <p className="mt-1 text-xs leading-relaxed">Ngày bắt đầu và kết thúc thuê chính thức được Boxora ghi nhận khi hoàn tất check-in tại cơ sở. Thanh toán chưa tự kích hoạt PIN; PIN được cấp theo quy trình bàn giao.</p>
            </div>

            {!contractSigned && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Giao dịch cũ đã được xác nhận nhưng hợp đồng chưa được backend xác minh đã ký. Hãy tiếp tục tại trang hợp đồng; trạng thái thanh toán đã được giữ nguyên.
                <Link className="ml-1 font-bold underline" to={`/online-booking-contract?bookingId=${encodeURIComponent(bookingId)}`}>Mở hợp đồng</Link>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              {contractSigned && contract && <button type="button" onClick={() => setShowContract(true)} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-800">Xem hợp đồng đã ký</button>}
              <Link to={`/portal/customer?tab=bookings&bookingId=${encodeURIComponent(bookingId)}`} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-bold text-slate-800">Xem lịch nhận kho</Link>
              <Link to="/portal/customer" className="flex-1 rounded-xl bg-blue-700 px-4 py-3 text-center text-sm font-bold text-white">Về trang tổng quan</Link>
            </div>
          </div>
        ) : pendingReconciliation ? (
          <div className="py-8 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-amber-100 border-t-amber-600" />
            <h1 className="mt-4 text-xl font-bold text-slate-900">Đang xác minh giao dịch</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">Boxora chưa nhận được xác nhận cuối cùng từ cổng thanh toán. Trang quay về không được xem là bằng chứng đã thanh toán. Vui lòng chờ đối soát hoặc kiểm tra lại sau.</p>
            {txnRef && <p className="mt-3 font-mono text-xs text-slate-500">Mã giao dịch: {txnRef}</p>}
            <button type="button" onClick={() => { setAttempts(0); void refresh(true) }} className="mt-5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">Kiểm tra lại</button>
          </div>
        ) : (
          <div className="py-4 text-center">
            <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${paymentFailed || gatewayStatus === 'FAILED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}><span className="material-symbols-outlined text-3xl">{paymentFailed ? 'error' : 'schedule'}</span></div>
            <h1 className="mt-3 text-xl font-extrabold text-slate-900">{paymentFailed ? 'Thanh toán chưa thành công' : 'Chưa xác nhận được thanh toán'}</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{error || 'Không ghi nhận thanh toán thành công. Nếu bạn vừa hoàn tất giao dịch, hãy chờ đối soát trước khi thử lại.'}</p>
            {booking && <p className="mt-3 text-sm text-slate-600">Mã đặt thuê: <strong className="font-mono text-slate-900">{booking.bookingCode}</strong></p>}
            {contractSigned && booking?.status === 'PENDING_PAYMENT' && !paymentExpired && (paymentFailed || !txnRef) && (
              <button type="button" disabled={retrying} onClick={() => void retryPayment()} className="mt-5 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50 sm:w-auto">
                {retrying ? 'Đang mở cổng thanh toán…' : 'Thử thanh toán lại'}
              </button>
            )}
            {!contractSigned && booking && <Link to={`/online-booking-contract?bookingId=${encodeURIComponent(booking.id)}`} className="mt-5 inline-block rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white">Mở hợp đồng để ký</Link>}
            {paymentExpired && <p className="mt-3 text-xs text-amber-800">Thời hạn giữ kho/thanh toán đã kết thúc. Vui lòng liên hệ Boxora để được đối soát.</p>}
            <div className="mt-5"><Link to="/portal/customer" className="text-sm font-semibold text-slate-600 underline">Về trang tổng quan</Link></div>
          </div>
        )}
      </section>
      {showContract && contract && <ContractDocumentModal contract={contract} booking={booking} onClose={() => setShowContract(false)} />}
    </main>
  )
}
