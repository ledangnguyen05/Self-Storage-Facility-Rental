import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LayoutDashboard } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext'
import { activateCustomerRental } from '../../utils/rentalAccess'
import { Booking, RentalContract } from '../../types'
import { bookingService } from '../../services/bookingService'
import { contractService } from '../../services/contractService'
import { paymentService, PaymentItem } from '../../services/paymentService'
import { ContractDocumentModal } from '../../components/modals/ContractDocumentModal'
import { DocuSealSimulationModal } from '../../components/modals/DocuSealSimulationModal'
import { facilityService } from '../../services/facilityService'
import { FacilityPolicy } from '../../types'
import { QuickThemeLanguageToggle } from '../../components/common/QuickThemeLanguageToggle'

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
  const { user } = useAuth()
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
  const [contractForSimulation, setContractForSimulation] = useState<RentalContract | null>(null)
  const [justSigned, setJustSigned] = useState(false)

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

  useEffect(() => {
    const mockId = searchParams.get('mockSignContractId')
    if (mockId && contract && contract.id === mockId && !isSigned(contract)) {
      setContractForSimulation(contract)
    }
  }, [searchParams, contract])

  const paidTransactions = payments.filter(payment => payment.status === 'PAID'
    && ['BOOKING_PAYMENT', 'DEPOSIT', 'RENTAL_FEE'].includes(payment.paymentType))
  const paidPayment = paidTransactions.find(payment => payment.paymentType === 'BOOKING_PAYMENT') || paidTransactions[0] || null
  const paidAmount = paidTransactions.reduce((total, payment) => total + Number(payment.amount || 0), 0)
  const paymentConfirmed = booking?.paymentStatus?.toUpperCase() === 'PAID'
  const signed = isSigned(contract)
  const payableTotal = Number(booking?.totalRentalFee || 0) + Number(booking?.depositAmount || 0)

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
    && (!paymentDeadline || new Date(paymentDeadline).getTime() <= Date.now())
  const canPay = !paymentConfirmed && !paymentExpired
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
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => void refresh(true)} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 transition">Thử tải lại</button>
            <Link to="/my-bookings" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition">
              <LayoutDashboard className="h-4 w-4 text-slate-500" />
              <span>Về trang tổng quan</span>
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
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Hợp đồng và thanh toán</h1>
          </div>
          <div className="flex items-center gap-2.5">
            <QuickThemeLanguageToggle />
          </div>
        </header>

        {justSigned && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 text-emerald-900 shadow-sm flex items-start gap-3 animate-in fade-in slide-in-from-top duration-300">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-2xl">verified</span>
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-emerald-950">
                  Xác nhận đã ký hợp đồng điện tử thành công!
                </h3>
                <span className="text-[10px] bg-emerald-200/80 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  {contract.contractCode}
                </span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Chữ ký số của quý khách đã được lưu trữ hợp lệ trên hệ thống Boxora. Quý khách vui lòng kiểm tra nghĩa vụ thanh toán bên dưới để hoàn tất giữ chỗ hoặc chuẩn bị đến cơ sở nhận bàn giao kho đúng lịch hẹn.
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

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {/* Staff Handling Policy Notice */}
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950 flex items-start gap-3 shadow-xs">
            <span className="material-symbols-outlined text-amber-700 text-2xl shrink-0 mt-0.5">verified_user</span>
            <div className="space-y-1">
              <p className="font-bold text-amber-900 text-sm">Quy định thủ tục ký hợp đồng &amp; thanh toán tại Boxora</p>
              <p className="text-xs leading-relaxed text-amber-800">
                Theo quy chuẩn an ninh và kiểm soát kho tự quản, <strong>thủ tục ký hợp đồng và thu phí thanh toán (tiền cọc + tiền thuê) do nhân viên tiếp đón (Staff) trực tiếp thực hiện tại cơ sở</strong> khi quý khách đến nhận buồng kho theo lịch hẹn. Khách hàng không cần và không được phép tự ký hoặc thanh toán trực tuyến.
              </p>
            </div>
          </div>


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
            <div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">Kho và cơ sở</span><p className="mt-1 font-semibold text-slate-900">{booking.unitCode ? `#${booking.unitCode}` : 'Vị trí kho sẽ được xác nhận khi nhận kho'} · {booking.facilityName}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">Mã hợp đồng</span><p className="mt-1 font-mono font-semibold text-slate-900">{contract.contractCode}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">Kỳ hạn thuê</span><p className="mt-1 font-semibold text-slate-900">{booking.rentalMonths} tháng · {date(booking.startDate)} – {date(booking.endDate)}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">Lịch hẹn nhận kho</span><p className="mt-1 font-semibold text-slate-900">{dateTime(booking.expectedCheckInAt)}</p></div>
            <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2">
              <span className="text-xs text-slate-500">Thông tin người thuê &amp; Giấy tờ định danh</span>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold text-slate-900 text-sm">
                <span>{contract.customerName || booking.customerName || 'Khách hàng'}</span>
                <span className="text-slate-300">|</span>
                <span>SĐT: {contract.customerPhone || booking.customerPhone || 'Theo hồ sơ'}</span>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1.5 text-blue-900">
                  <span className="text-xs text-slate-500 font-normal">{booking.identityCardType || contract.identityCardType || 'CCCD'}:</span>
                  <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                    {booking.identityCardNumber || contract.identityCardNumber || 'Chưa cung cấp'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-950">
            <p className="font-bold">Ngày bắt đầu thuê chính thức</p>
            <p className="mt-1 text-xs leading-relaxed">Ngày hẹn ở trên là lịch nhận kho dự kiến. Theo quy trình bàn giao hiện tại, thời hạn thuê và ngày kết thúc chính thức được xác lập khi nhân viên hoàn tất check-in tại cơ sở; việc ký hợp đồng hoặc thanh toán chưa kích hoạt PIN hay quyền vào kho.</p>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <p className="font-bold text-slate-900">Hủy đơn đặt giữ chỗ &amp; Chính sách thanh toán</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-slate-600">
              <li><strong>Hủy đơn đặt chỗ:</strong> Quý khách chưa thanh toán tiền cọc khi tạo đơn đặt chỗ online. Việc hủy đơn đặt chỗ trước khi check-in là <strong>hoàn toàn miễn phí và không có hoàn cọc</strong>.</li>
              <li><strong>Thanh toán cọc &amp; tiền thuê:</strong> Nhân viên Boxora sẽ trực tiếp đối soát CCCD, lập hợp đồng và thu tiền cọc cùng tiền thuê tại quầy khi quý khách đến check-in.</li>
              <li><strong>Hoàn cọc sau khi kết thúc hợp đồng:</strong> Tiền cọc được hoàn trả vào tài khoản của quý khách sau khi chấm dứt hợp đồng thuê và hoàn tất biên bản nghiệm thu trả kho.</li>
            </ul>
            <p className="mt-2 text-[11px] text-slate-500">Quý khách có thể hủy hoặc đổi lịch hẹn tiếp đón bất cứ lúc nào trong mục Quản lý đơn đặt chỗ.</p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowDocument(true)} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 cursor-pointer">
              {signed ? 'Xem hợp đồng đã ký' : 'Xem nội dung hợp đồng'}
            </button>
            <Link to="/my-bookings" className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 transition">
              <LayoutDashboard className="h-4 w-4" />
              <span>Về đơn đặt chỗ của tôi</span>
            </Link>
            {signed && paymentConfirmed ? (
              <Link to="/portal/customer" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition">
                <LayoutDashboard className="h-4 w-4" />
                <span>Vào Portal Quản Lý Kho (Khóa IoT)</span>
              </Link>
            ) : signed ? (
              <Link to="/my-bookings" className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 transition">
                <LayoutDashboard className="h-4 w-4" />
                <span>Về đơn đặt chỗ của tôi</span>
              </Link>
            ) : null}
          </div>
          {!signed && (
            <p className="mt-3 text-xs leading-relaxed text-slate-500">Quý khách vui lòng mang theo CCCD bản gốc khi đến nhận kho để nhân viên đối soát và hoàn tất thủ tục bàn giao.</p>
          )}
        </section>

        {(signed || canPay || paymentConfirmed) && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Thanh toán trực tuyến</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Nghĩa vụ thanh toán</h2>
                {contract.signedAt && <p className="mt-1 text-xs text-slate-500">Thời điểm xác nhận ký: {dateTime(contract.signedAt)}</p>}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${signed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                {signed ? 'Đã ký điện tử' : 'Chờ ký điện tử'}
              </span>
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
              <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-blue-600">storefront</span>
                <span>Thanh toán sẽ được thực hiện trực tiếp tại quầy cơ sở Boxora cùng nhân viên Staff khi quý khách đến nhận buồng kho.</span>
              </div>
            )}
            {!paymentConfirmed && !canPay && <p className="mt-3 text-xs text-amber-800">Đơn đặt thuê hiện không ở trạng thái có thể thanh toán. Vui lòng liên hệ Boxora để được đối soát.</p>}
          </section>
        )}

        {showDocument && (
          <ContractDocumentModal
            contract={contract}
            booking={booking}
            onClose={() => setShowDocument(false)}
            onSignNow={() => {
              setShowDocument(false)
              setContractForSimulation(contract)
            }}
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
              void refresh()
            }}
          />
        )}
      </section>
    </main>
  )
}
