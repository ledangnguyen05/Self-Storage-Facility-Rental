import { checkCustomerPortalAccess } from '../../utils/rentalAccess'
import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { activateCustomerRental } from '../../utils/rentalAccess'
import { bookingService } from '../../services/bookingService'
import { paymentService, PaymentItem } from '../../services/paymentService'
import { contractService } from '../../services/contractService'
import { Booking, RentalContract, ContractRenewal } from '../../types'
import { ContractDocumentModal } from '../../components/modals/ContractDocumentModal'
import { DocuSealSimulationModal } from '../../components/modals/DocuSealSimulationModal'
import { RenewalDocumentModal } from '../../components/modals/RenewalDocumentModal'
import { QuickThemeLanguageToggle } from '../../components/common/QuickThemeLanguageToggle'
import { LayoutDashboard } from 'lucide-react'

const money = (value?: number | string | null) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString('vi-VN') : 'Chưa lên lịch'
const dateTime = (value?: string | null) => value
  ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Chưa lên lịch'

const getVNPayFailureMessage = (code?: string | null) => {
  switch (code) {
    case '24': return 'Giao dịch đã bị hủy bởi khách hàng trên cổng thanh toán VNPay.'
    case '11': return 'Giao dịch không thành công do hết hạn chờ thanh toán.'
    case '51': return 'Tài khoản của bạn không đủ số dư để hoàn tất thanh toán.'
    case '65': return 'Tài khoản của bạn đã vượt hạn mức giao dịch trong ngày.'
    case '75': return 'Ngân hàng thanh toán đang bảo trì hệ thống.'
    case '79': return 'Nhập sai mã OTP xác thực quá số lần quy định.'
    default: return null
  }
}

export const PaymentResultPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const rawBookingId = searchParams.get('bookingId') || ''
  const bookingId = rawBookingId && rawBookingId !== 'null' && rawBookingId !== 'undefined' ? rawBookingId : ''
  const rawContractId = searchParams.get('contractId') || ''
  const contractIdParam = rawContractId && rawContractId !== 'null' && rawContractId !== 'undefined' ? rawContractId : ''
  const paymentTypeParam = searchParams.get('paymentType') || ''
  const amountParam = searchParams.get('amount') || ''
  const txnRef = searchParams.get('txnRef') || searchParams.get('vnp_TxnRef') || ''
  const vnpResponseCode = searchParams.get('responseCode') || searchParams.get('vnp_ResponseCode') || ''
  const vnpTransactionStatus = searchParams.get('vnp_TransactionStatus') || ''
  const vnpSecureHash = searchParams.get('vnp_SecureHash') || ''
  const vnpAmountRaw = searchParams.get('vnp_Amount') || ''
  const effectiveAmountParam = amountParam || (vnpAmountRaw ? String(Math.round(Number(vnpAmountRaw) / 100)) : '')
  const gatewayStatus = searchParams.get('status') || (vnpResponseCode === '00' && (!vnpTransactionStatus || vnpTransactionStatus === '00') ? 'PAID' : (vnpResponseCode ? 'FAILED' : ''))

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
  const [contractForSimulation, setContractForSimulation] = useState<RentalContract | null>(null)
  const [justSigned, setJustSigned] = useState(false)
  const [openingSignModal, setOpeningSignModal] = useState(false)

  const refresh = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    try {
      let resolvedPayment: PaymentItem | null = null
      let targetContractId = contractIdParam
      let targetBookingId = bookingId

      // 0. If VNPay redirected directly to /payment-result with vnp_SecureHash, verify & commit payment on backend first
      if (vnpSecureHash || vnpResponseCode) {
        try {
          const verified = await paymentService.verifyVNPayReturn(window.location.search)
          if (verified) {
            resolvedPayment = verified
            setPayments([verified])
            if (verified.contractId) targetContractId = verified.contractId
            if (verified.bookingId) targetBookingId = verified.bookingId
          }
        } catch (verifyErr) {
          console.warn('VNPay verify call warning:', verifyErr)
        }
      }

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
      if (!resolvedPayment && txnRef) {
        const isUrlSuccess = gatewayStatus.toUpperCase() === 'PAID' || vnpResponseCode === '00'
        const isUrlFailed = gatewayStatus.toUpperCase() === 'FAILED' || (Boolean(vnpResponseCode) && vnpResponseCode !== '00')
        const derivedStatus = isUrlSuccess ? 'PAID' : (isUrlFailed ? 'FAILED' : 'PENDING')
        const fallbackPayment: PaymentItem = {
          id: txnRef,
          transactionId: txnRef,
          amount: Number(effectiveAmountParam || 0),
          status: derivedStatus,
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
  }, [bookingId, contractIdParam, txnRef, gatewayStatus, effectiveAmountParam, paymentTypeParam, vnpSecureHash, vnpResponseCode])

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

  const paid = authoritativePayment?.status === 'PAID'
    || gatewayStatus.toUpperCase() === 'PAID'
    || booking?.paymentStatus === 'PAID'
    || booking?.status === 'PAID_PENDING_ASSIGNMENT'
    || booking?.status === 'PAID_AND_SIGNED'
    || booking?.status === 'CONFIRMED'
    || booking?.status === 'READY_FOR_CHECKIN'

  useEffect(() => {
    if (!paid) return
    const targetCode = booking?.bookingCode || authoritativePayment?.bookingCode
    const targetBId = booking?.id || authoritativePayment?.bookingId || bookingId
    if (!targetCode && !targetBId) return
    try {
      const raw = localStorage.getItem('boxora_guest_reservations')
      if (raw) {
        const list = JSON.parse(raw)
        if (Array.isArray(list)) {
          let changed = false
          const updated = list.map((item: any) => {
            if (
              (targetCode && item.bookingCode === targetCode) ||
              (targetBId && (item.id === targetBId || item.backendBookingId === targetBId))
            ) {
              changed = true
              return {
                ...item,
                paymentStatus: 'PAID',
                status: item.status === 'PENDING_CONTACT' || item.status === 'PENDING_PAYMENT' ? 'CONFIRMED' : item.status,
                depositPaid: booking?.depositAmount || authoritativePayment?.amount || item.depositAmount || 0,
                paidAt: new Date().toISOString(),
              }
            }
            return item
          })
          if (changed) {
            localStorage.setItem('boxora_guest_reservations', JSON.stringify(updated))
            window.dispatchEvent(new CustomEvent('boxora_reservation_status_changed'))
            window.dispatchEvent(new CustomEvent('boxora_rental_updated'))
          }
        }
      }
    } catch (e) {
      console.warn('Failed to sync local reservation paid state:', e)
    }
  }, [paid, booking, authoritativePayment, bookingId])

  const isRenewal = authoritativePayment?.paymentType === 'RENEWAL_FEE'
    || paymentTypeParam === 'RENEWAL_FEE'
    || Boolean(matchingRenewal)
    || Boolean(contract && !booking && !bookingId && !authoritativePayment?.bookingId)

  const contractSigned = Boolean(contract?.signedAt)
    || contract?.status === 'PENDING_ACTIVATION'
    || contract?.status === 'ACTIVE'
    || Boolean(booking?.contractSigned)

  const handleOpenSignContract = async () => {
    if (contract) {
      setContractForSimulation(contract)
      return
    }
    const targetBId = booking?.id || authoritativePayment?.bookingId || bookingId
    if (!targetBId) return
    setOpeningSignModal(true)
    try {
      const fetchedContract = await contractService.getContractByBookingId(targetBId)
      if (fetchedContract) {
        setContract(fetchedContract)
        setContractForSimulation(fetchedContract)
        return
      }
    } catch (err) {
      console.warn('Could not load contract directly on payment-result, navigating:', err)
    } finally {
      setOpeningSignModal(false)
    }
    navigate(`/online-booking-contract?bookingId=${encodeURIComponent(targetBId)}&autoSign=true`)
  }




  const isGatewaySuccess = gatewayStatus.toUpperCase() === 'PAID' || vnpResponseCode === '00'
  const isGatewayFailed = gatewayStatus.toUpperCase() === 'FAILED' || (Boolean(vnpResponseCode) && vnpResponseCode !== '00')
  const paymentFailed = authoritativePayment?.status === 'FAILED' || authoritativePayment?.status === 'EXPIRED' || (!paid && isGatewayFailed)

  const pendingReconciliation = !paid && !paymentFailed && (
    gatewayStatus.toUpperCase() === 'PAID'
    || authoritativePayment?.status === 'PENDING'
    || (Boolean(txnRef) && !authoritativePayment && !isGatewayFailed)
  )



  const paymentExpired = booking?.paymentExpiresAt
    ? new Date(booking.paymentExpiresAt).getTime() <= Date.now()
    : false

  const retryPayment = async () => {
    if (!booking || paymentExpired) return
    setRetrying(true)
    setError('')
    try {
      const result = await paymentService.createVNPayPayment({
        bookingId: booking.id,
        paymentType: 'BOOKING_PAYMENT',
        amount: Number(booking.totalRentalFee || 0) + Number(booking.depositAmount || 0),
        orderInfo: `Thanh toan booking ${booking.bookingCode}`,
        returnUrl: `${window.location.origin}/payment-result`,
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
                    {money(authoritativePayment?.amount || effectiveAmountParam)}
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
                  Giao dịch đã được ghi nhận thành công
                </p>
                <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
                  Đặt thuê và thanh toán thành công!
                </h1>
              </header>

              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Mã đặt thuê</dt><dd className="mt-1 font-mono font-bold">{booking?.bookingCode || bookingId}</dd></div>
                <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Kho và cơ sở</dt><dd className="mt-1 font-semibold">{booking?.unitCode ? `Kho #${booking.unitCode}` : (booking?.unitTypeName ? `Kích thước: ${booking.unitTypeName} (Chờ nhân viên bàn giao)` : 'Chờ nhân viên bàn giao')} · {booking?.facilityName || authoritativePayment?.facilityName || 'Boxora Facility'}</dd></div>
                <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Trạng thái hợp đồng</dt><dd className="mt-1 font-semibold text-emerald-700">{contractSigned ? 'Đã ký điện tử' : 'Chờ ký điện tử'}</dd>{contract?.contractCode && <dd className="font-mono text-xs text-slate-500">{contract.contractCode}</dd>}</div>
                <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Trạng thái thanh toán</dt><dd className="mt-1 font-semibold text-emerald-700">Đã xác nhận</dd></div>
                <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Mã giao dịch</dt><dd className="mt-1 break-all font-mono text-xs font-semibold">{authoritativePayment?.transactionId || txnRef || 'Đã xác nhận'}</dd></div>
                <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Số tiền đã thanh toán</dt><dd className="mt-1 font-mono font-bold text-emerald-700">{money(authoritativePayment?.amount || effectiveAmountParam)}</dd></div>
              </dl>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                <div className="flex flex-wrap justify-between gap-2"><strong>Trạng thái nhận kho</strong><span className="font-bold">{booking?.status === 'ACTIVE' ? 'Đã hoàn tất bàn giao' : 'Chờ hoàn tất bàn giao'}</span></div>
                <p className="mt-2 text-xs">Lịch hẹn nhận kho: <strong>{dateTime(booking?.expectedCheckInAt)}</strong></p>
                <p className="mt-1 text-xs leading-relaxed">
                  {booking?.status === 'PAID_PENDING_ASSIGNMENT' || booking?.status === 'PAID_AND_SIGNED'
                    ? 'Đơn đặt thuê đã được thanh toán và ký hợp đồng thành công! Nhân viên cơ sở đang gán ô kho vật lý cụ thể. Hệ thống sẽ gửi email chứa mã ô kho và mã khóa PIN/QR IoT ngay sau khi nhân viên hoàn tất.'
                    : 'Ngày bắt đầu và kết thúc thuê chính thức được Boxora ghi nhận khi hoàn tất check-in tại cơ sở. Mã PIN/QR được cấp theo quy trình bàn giao.'}
                </p>
              </div>

              {justSigned && (
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 text-emerald-900 shadow-sm flex items-start gap-3">
                  <span className="material-symbols-outlined text-2xl text-emerald-600 shrink-0">verified</span>
                  <div className="flex-1 text-xs leading-relaxed">
                    <strong className="block text-sm text-emerald-950 mb-0.5">Đã ký hợp đồng điện tử thành công!</strong>
                    Hợp đồng thuê kho #{contract?.contractCode} đã được lưu chữ ký số hợp lệ. Đơn đặt thuê của bạn đã hoàn tất đầy đủ thủ tục trực tuyến.
                  </div>
                </div>
              )}

              {!contractSigned ? (
                <div className="rounded-2xl border-2 border-blue-500 bg-blue-50/90 p-5 sm:p-6 text-sm text-blue-950 shadow-md">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 font-bold text-base text-blue-900">
                      <span className="material-symbols-outlined text-[24px] text-blue-600">draw</span>
                      <span>Bước tiếp theo: Ký hợp đồng điện tử</span>
                    </div>
                    {contract?.contractCode && (
                      <span className="font-mono text-xs font-bold bg-white/80 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200">
                        {contract.contractCode}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-blue-800 leading-relaxed">
                    Thanh toán của bạn đã được xác nhận thành công! Hợp đồng điện tử đã được khởi tạo theo thông tin đặt kho của bạn. Vui lòng kiểm tra và ký xác nhận hợp đồng điện tử ngay bên dưới để hoàn tất thủ tục.
                  </p>
                  <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      disabled={openingSignModal}
                      onClick={() => void handleOpenSignContract()}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 py-3.5 px-5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all cursor-pointer disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-[20px]">draw</span>
                      <span>{openingSignModal ? 'Đang mở hợp đồng...' : 'Ký hợp đồng điện tử ngay'}</span>
                    </button>
                    {contract && (
                      <button
                        type="button"
                        onClick={() => setShowContract(true)}
                        className="rounded-xl border border-blue-300 bg-white hover:bg-blue-50 py-3.5 px-4 text-sm font-bold text-blue-800 transition-all cursor-pointer"
                      >
                        Xem nội dung hợp đồng
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 sm:flex-row">
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
                    to="/my-bookings"
                    className="flex-1 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 px-4 py-3 text-center text-sm font-bold text-blue-800 transition cursor-pointer"
                  >
                    Đơn đặt chỗ của tôi
                  </Link>
                  {checkCustomerPortalAccess(user).hasAccess ? (
                    <Link
                      to="/portal/customer"
                      className="flex-1 rounded-xl bg-blue-700 hover:bg-blue-800 px-4 py-3 text-center text-sm font-bold text-white transition cursor-pointer"
                    >
                      Về trang tổng quan
                    </Link>
                  ) : null}
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
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{error || getVNPayFailureMessage(vnpResponseCode) || 'Không ghi nhận thanh toán thành công. Nếu bạn vừa hoàn tất giao dịch, hãy chờ đối soát trước khi thử lại.'}</p>
            {(booking?.bookingCode || authoritativePayment?.bookingCode) && (
              <p className="mt-3 text-sm text-slate-600">Mã đặt thuê: <strong className="font-mono text-slate-900">{booking?.bookingCode || authoritativePayment?.bookingCode}</strong></p>
            )}
            {booking && (booking.status === 'PENDING_PAYMENT' || booking.status === 'PENDING_SIGNATURE' || booking.status === 'SIGNED_PENDING_PAYMENT') && !paymentExpired && (paymentFailed || !txnRef) && (
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
          onSignNow={!contractSigned ? () => {
            setShowContract(false)
            setContractForSimulation(contract)
          } : undefined}
        />
      )}

      {contractForSimulation && (
        <DocuSealSimulationModal
          contract={contractForSimulation}
          booking={booking}
          onClose={() => setContractForSimulation(null)}
          onSignedSuccess={(updated) => {
            setContract(updated)
            setContractForSimulation(null)
            setJustSigned(true)
            if (booking && user) {
              activateCustomerRental(
                user,
                booking.unitCode || 'KHO-BX',
                booking.facilityName || 'Boxora Smart Storage',
                updated.contractCode
              )
            }
            void refresh()
          }}
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
