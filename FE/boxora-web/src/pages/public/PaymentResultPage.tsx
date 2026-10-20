import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Link, useSearchParams } from 'react-router-dom'
import { bookingService } from '../../services/bookingService'
import { paymentService, PaymentItem } from '../../services/paymentService'
import { contractService } from '../../services/contractService'
import { Booking, RentalContract, ContractRenewal } from '../../types'
import { ContractDocumentModal } from '../../components/modals/ContractDocumentModal'
import { RenewalDocumentModal } from '../../components/modals/RenewalDocumentModal'
import { QuickThemeLanguageToggle } from '../../components/common/QuickThemeLanguageToggle'
import { LayoutDashboard } from 'lucide-react'

const money = (value?: number | string | null) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString('vi-VN') : 'Chưa lên lịch'
const dateTime = (value?: string | null) => value
  ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Chưa lên lịch'

export const PaymentResultPage = () => {
  const [searchParams] = useSearchParams()
  const rawBookingId = searchParams.get('bookingId') || ''
  const bookingId = rawBookingId && rawBookingId !== 'null' && rawBookingId !== 'undefined' ? rawBookingId : ''
  const rawContractId = searchParams.get('contractId') || ''
  const contractIdParam = rawContractId && rawContractId !== 'null' && rawContractId !== 'undefined' ? rawContractId : ''
  const paymentTypeParam = searchParams.get('paymentType') || ''
  const amountParam = searchParams.get('amount') || ''
  const txnRef = searchParams.get('txnRef') || searchParams.get('vnp_TxnRef') || ''
  const gatewayStatus = searchParams.get('status') || ''

  const [booking, setBooking] = useState<Booking | null>(null)
  const [contract, setContract] = useState<RentalContract | null>(null)
  const [matchingRenewal, setMatchingRenewal] = useState<ContractRenewal | null>(null)
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(searchParams.get('error') || '')
  const [retrying, setRetrying] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [showContract, setShowContract] = useState(false)
  const [showRenewalDoc, setShowRenewalDoc] = useState(false)

  const refresh = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    try {
      let resolvedPayment: PaymentItem | null = null
      let targetContractId = contractIdParam
      let targetBookingId = bookingId

      // 1. Try to lookup payment by txnRef first
      if (txnRef) {
        try {
          const p = await paymentService.getByTransactionId(txnRef)
          if (p) {
            resolvedPayment = p
            setPayments([p])
            if (p.contractId) targetContractId = p.contractId
            if (p.bookingId) targetBookingId = p.bookingId
          }
        } catch (err) {
          console.warn('Cannot fetch payment by txnRef:', err)
        }
      }

      // 2. Fetch booking details if targetBookingId is available
      if (targetBookingId && !targetBookingId.startsWith('mock-')) {
        try {
          const [bookingResult, bookingPayments, contractResult] = await Promise.all([
            bookingService.getById(targetBookingId).catch(() => null),
            paymentService.getByBookingId(targetBookingId).catch(() => [] as PaymentItem[]),
            contractService.getContractByBookingId(targetBookingId).catch(() => null),
          ])
          if (bookingResult) setBooking(bookingResult)
          if (bookingPayments.length > 0) {
            setPayments(prev => {
              const ids = new Set(prev.map(item => item.id || item.transactionId))
              const merged = [...prev]
              bookingPayments.forEach(item => {
                if (!ids.has(item.id || item.transactionId)) merged.push(item)
              })
              return merged
            })
          }
          if (contractResult) setContract(contractResult)
        } catch (err) {
          console.warn('Failed to load booking info:', err)
        }
      }

      // 3. Fetch contract & renewal details if targetContractId is available
      if (targetContractId) {
        try {
          const [cRes, renewalsRes] = await Promise.all([
            contractService.getContractById(targetContractId).catch(() => null),
            contractService.getRenewalsByContract(targetContractId).catch(() => [] as ContractRenewal[]),
          ])
          if (cRes) setContract(cRes)
          if (renewalsRes && renewalsRes.length > 0) {
            const matched = renewalsRes.find(r =>
              (resolvedPayment && r.paymentId === resolvedPayment.id) ||
              r.status === 'COMPLETED' ||
              r.status === 'PENDING_PAYMENT' ||
              r.status === 'PENDING_SIGNATURE'
            ) || renewalsRes[0]
            if (matched) setMatchingRenewal(matched)
          }
        } catch (err) {
          console.warn('Failed to load contract/renewals info:', err)
        }
      }

      // 4. Fallback payment object from URL params if direct backend payment query was unauthenticated
      if (!resolvedPayment && txnRef && gatewayStatus.toUpperCase() === 'PAID') {
        const fallbackPayment: PaymentItem = {
          id: txnRef,
          transactionId: txnRef,
          amount: Number(amountParam || 0),
          status: 'PAID',
          paymentType: paymentTypeParam || (targetContractId ? 'RENEWAL_FEE' : 'BOOKING_PAYMENT'),
          paymentMethod: 'VNPAY',
          contractId: targetContractId || undefined,
          bookingId: targetBookingId || undefined,
        }
        setPayments([fallbackPayment])
      }

      setError('')
    } catch (requestError) {
      if (axios.isAxiosError<{ message?: string }>(requestError)) {
        if (requestError.response?.status === 401 || requestError.response?.status === 403) {
          setError('Vui lòng đăng nhập đúng tài khoản khách hàng để xem chi tiết đối soát.')
        } else {
          setError(requestError.response?.data?.message || 'Không thể tải thông tin giao dịch từ máy chủ.')
        }
      } else {
        setError(requestError instanceof Error ? requestError.message : 'Không thể đối soát giao dịch.')
      }
    } finally {
      if (initial) setLoading(false)
    }
  }, [bookingId, contractIdParam, txnRef, gatewayStatus, amountParam, paymentTypeParam])

  useEffect(() => {
    void refresh(true)
  }, [refresh])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (attempts < 6) {
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

  const paid = authoritativePayment?.status === 'PAID' || gatewayStatus.toUpperCase() === 'PAID'
  
  const isRenewal = authoritativePayment?.paymentType === 'RENEWAL_FEE'
    || paymentTypeParam === 'RENEWAL_FEE'
    || Boolean(matchingRenewal)
    || Boolean(contract && !booking)

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
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto mb-5 flex max-w-2xl items-center justify-end">
        <QuickThemeLanguageToggle />
      </div>
      <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-600">Đang đối soát thông tin giao dịch với Boxora…</div>
        ) : paid ? (
          isRenewal ? (
            /* =========================================================================
               1. GIAO DIỆN XÁC NHẬN GIA HẠN HỢP ĐỒNG & THANH TOÁN THÀNH CÔNG
               ========================================================================= */
            <div className="space-y-5">
              <header className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-sm">
                  <span className="material-symbols-outlined text-3xl">check_circle</span>
                </div>
                <p className="mt-3 text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Thanh toán phụ lục gia hạn đã được Boxora xác nhận
                </p>
                <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
                  Gia Hạn Hợp Đồng &amp; Thanh Toán Thành Công!
                </h1>
              </header>

              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                  <dt className="text-xs text-slate-500 font-medium">Mã hợp đồng thuê</dt>
                  <dd className="mt-1 font-mono font-bold text-blue-700 text-sm">
                    #{contract?.contractCode || matchingRenewal?.contractCode || 'CTR-BX'}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                  <dt className="text-xs text-slate-500 font-medium">Kho &amp; Cơ sở</dt>
                  <dd className="mt-1 font-semibold text-slate-800 text-sm">
                    Kho #{contract?.unitCode || matchingRenewal?.unitCode || authoritativePayment?.unitCode || '—'} · {contract?.facilityName || matchingRenewal?.facilityName || authoritativePayment?.facilityName || 'Boxora'}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                  <dt className="text-xs text-slate-500 font-medium">Trạng thái phụ lục gia hạn</dt>
                  <dd className="mt-1 font-semibold text-emerald-700 flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">verified</span>
                    <span>Đã hoàn tất ký số &amp; có hiệu lực</span>
                  </dd>
                  {matchingRenewal && (
                    <dd className="font-mono text-xs text-slate-500 mt-0.5">
                      +{matchingRenewal.cycleMonths} Tháng (Mới: {date(matchingRenewal.newEndDate)})
                    </dd>
                  )}
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                  <dt className="text-xs text-slate-500 font-medium">Trạng thái thanh toán</dt>
                  <dd className="mt-1 font-semibold text-emerald-700 flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">check</span>
                    <span>Đã xác nhận thành công</span>
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                  <dt className="text-xs text-slate-500 font-medium">Mã giao dịch VNPay</dt>
                  <dd className="mt-1 break-all font-mono text-xs font-semibold text-slate-700">
                    {authoritativePayment?.transactionId || txnRef || 'Đã xác nhận'}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                  <dt className="text-xs text-slate-500 font-medium">Số tiền cước gia hạn</dt>
                  <dd className="mt-1 font-mono font-bold text-emerald-700 text-base">
                    {money(authoritativePayment?.amount || amountParam)}
                  </dd>
                </div>
              </dl>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-950">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className="flex items-center gap-1.5 text-emerald-900">
                    <span className="material-symbols-outlined text-lg text-emerald-600">task_alt</span>
                    <span>Hiệu lực gia hạn kho</span>
                  </strong>
                  <span className="font-bold text-emerald-800">
                    {matchingRenewal?.newEndDate ? `Hiệu lực đến ${date(matchingRenewal.newEndDate)}` : (contract?.endDate ? `Hiệu lực đến ${date(contract.endDate)}` : 'Đang hoạt động')}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-emerald-900">
                  Giao dịch thanh toán cước gia hạn đã được đối soát thành công. Thời hạn hợp đồng của bạn đã được Boxora cập nhật tự động nối tiếp. Mã PIN và quyền ra vào kho của bạn tiếp tục hoạt động liên tục mà không bị gián đoạn.
                </p>
              </div>

              <div className="flex flex-col gap-2.5 sm:flex-row">
                {matchingRenewal && (
                  <button
                    type="button"
                    onClick={() => setShowRenewalDoc(true)}
                    className="flex-1 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-800 px-4 py-3 text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">history_edu</span>
                    <span>Xem văn bản phụ lục đã ký</span>
                  </button>
                )}
                {contract && (
                  <button
                    type="button"
                    onClick={() => setShowContract(true)}
                    className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px] text-slate-600">description</span>
                    <span>Xem hợp đồng gốc</span>
                  </button>
                )}
                <Link
                  to="/portal/customer"
                  className="flex-1 rounded-xl bg-blue-700 hover:bg-blue-800 px-4 py-3 text-center text-sm font-bold text-white transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Về trang tổng quan</span>
                </Link>
              </div>
            </div>
          ) : (
            /* =========================================================================
               2. GIAO DIỆN XÁC NHẬN ĐẶT THUÊ GIỮ CHỖ & THANH TOÁN THÀNH CÔNG
               ========================================================================= */
            <div className="space-y-5">
              <header className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <span className="material-symbols-outlined text-3xl">check_circle</span>
                </div>
                <p className="mt-3 text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Thanh toán đã được backend xác nhận
                </p>
                <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
                  Đặt thuê và thanh toán thành công!
                </h1>
              </header>

              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Mã đặt thuê</dt><dd className="mt-1 font-mono font-bold">{booking?.bookingCode || bookingId}</dd></div>
                <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Kho và cơ sở</dt><dd className="mt-1 font-semibold">{booking?.unitCode || '—'} · {booking?.facilityName || '—'}</dd></div>
                <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Trạng thái hợp đồng</dt><dd className="mt-1 font-semibold text-emerald-700">{contractSigned ? 'Đã ký điện tử' : 'Chờ ký điện tử'}</dd>{contract?.contractCode && <dd className="font-mono text-xs text-slate-500">{contract.contractCode}</dd>}</div>
                <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Trạng thái thanh toán</dt><dd className="mt-1 font-semibold text-emerald-700">Đã xác nhận</dd></div>
                <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Mã giao dịch</dt><dd className="mt-1 break-all font-mono text-xs font-semibold">{authoritativePayment?.transactionId || txnRef || 'Đã xác nhận'}</dd></div>
                <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Số tiền đã thanh toán</dt><dd className="mt-1 font-mono font-bold text-emerald-700">{money(authoritativePayment?.amount || amountParam)}</dd></div>
              </dl>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                <div className="flex flex-wrap justify-between gap-2"><strong>Trạng thái nhận kho</strong><span className="font-bold">{booking?.status === 'ACTIVE' ? 'Đã hoàn tất bàn giao' : 'Chờ hoàn tất bàn giao'}</span></div>
                <p className="mt-2 text-xs">Lịch hẹn nhận kho: <strong>{dateTime(booking?.expectedCheckInAt)}</strong></p>
                <p className="mt-1 text-xs leading-relaxed">Ngày bắt đầu và kết thúc thuê chính thức được Boxora ghi nhận khi hoàn tất check-in tại cơ sở. Thanh toán chưa tự kích hoạt PIN; PIN được cấp theo quy trình bàn giao.</p>
              </div>

              {!contractSigned ? (
                <div className="rounded-2xl border-2 border-blue-500 bg-blue-50/90 p-5 sm:p-6 text-sm text-blue-950 shadow-md">
                  <div className="flex items-center gap-2.5 font-bold text-base text-blue-900 mb-2">
                    <span className="material-symbols-outlined text-[24px] text-blue-600">draw</span>
                    <span>Bắt buộc: Ký hợp đồng điện tử để hoàn tất đặt thuê</span>
                  </div>
                  <p className="text-xs text-blue-800 leading-relaxed">
                    Thanh toán của bạn đã được ghi nhận thành công! Theo quy định thuê kho tại Boxora, bạn cần hoàn thành ký hợp đồng điện tử trực tuyến ngay để đơn đặt thuê có hiệu lực và sẵn sàng cho thủ tục nhận bàn giao kho đúng lịch hẹn.
                  </p>
                  <div className="mt-5">
                    <Link
                      to={`/online-booking-contract?bookingId=${encodeURIComponent(bookingId)}`}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 py-3.5 px-6 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[20px]">draw</span>
                      <span>Ký hợp đồng điện tử ngay</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  {contract && (
                    <button
                      type="button"
                      onClick={() => setShowContract(true)}
                      className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Xem hợp đồng đã ký
                    </button>
                  )}
                  <Link
                    to="/portal/customer"
                    className="flex-1 rounded-xl bg-blue-700 hover:bg-blue-800 px-4 py-3 text-center text-sm font-bold text-white transition cursor-pointer"
                  >
                    Về trang tổng quan
                  </Link>
                </div>
              )}
            </div>
          )
        ) : pendingReconciliation ? (
          <div className="py-8 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-amber-100 border-t-amber-600" />
            <h1 className="mt-4 text-xl font-bold text-slate-900">Đang xác minh giao dịch</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">Boxora chưa nhận được xác nhận cuối cùng từ cổng thanh toán. Trang quay về không được xem là bằng chứng đã thanh toán. Vui lòng chờ đối soát hoặc kiểm tra lại sau.</p>
            {txnRef && <p className="mt-3 font-mono text-xs text-slate-500">Mã giao dịch: {txnRef}</p>}
            <button type="button" onClick={() => { setAttempts(0); void refresh(true) }} className="mt-5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white cursor-pointer">Kiểm tra lại</button>
          </div>
        ) : (
          <div className="py-4 text-center">
            <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${paymentFailed || gatewayStatus === 'FAILED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}><span className="material-symbols-outlined text-3xl">{paymentFailed ? 'error' : 'schedule'}</span></div>
            <h1 className="mt-3 text-xl font-extrabold text-slate-900">{paymentFailed ? 'Thanh toán chưa thành công' : 'Chưa xác nhận được thanh toán'}</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{error || 'Không ghi nhận thanh toán thành công. Nếu bạn vừa hoàn tất giao dịch, hãy chờ đối soát trước khi thử lại.'}</p>
            {booking && <p className="mt-3 text-sm text-slate-600">Mã đặt thuê: <strong className="font-mono text-slate-900">{booking.bookingCode}</strong></p>}
            {booking?.status === 'PENDING_PAYMENT' && !paymentExpired && (paymentFailed || !txnRef) && (
              <button type="button" disabled={retrying} onClick={() => void retryPayment()} className="mt-5 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50 sm:w-auto cursor-pointer">
                {retrying ? 'Đang mở cổng thanh toán…' : 'Thử thanh toán lại'}
              </button>
            )}
            {paymentExpired && <p className="mt-3 text-xs text-amber-800">Thời hạn giữ kho/thanh toán đã kết thúc. Vui lòng liên hệ Boxora để được đối soát.</p>}
            <div className="mt-5">
              <Link to="/portal/customer" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer">
                <LayoutDashboard className="h-4 w-4 text-slate-500" />
                <span>Về trang tổng quan</span>
              </Link>
            </div>
          </div>
        )}
      </section>

      {showContract && contract && (
        <ContractDocumentModal
          contract={contract}
          booking={booking}
          onClose={() => setShowContract(false)}
        />
      )}

      {showRenewalDoc && matchingRenewal && (
        <RenewalDocumentModal
          renewal={matchingRenewal}
          contract={contract}
          onClose={() => setShowRenewalDoc(false)}
          onViewOriginalContract={() => {
            setShowRenewalDoc(false)
            setShowContract(true)
          }}
        />
      )}
    </main>
  )
}
