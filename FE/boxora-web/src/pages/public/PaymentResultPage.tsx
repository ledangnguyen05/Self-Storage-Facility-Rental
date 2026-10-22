import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { bookingService } from '../../services/bookingService'
import { paymentService } from '../../services/paymentService'
import { contractService } from '../../services/contractService'
<<<<<<< Updated upstream
import { activateCustomerRental } from '../../utils/rentalAccess'
import { Booking, RentalContract } from '../../types'
import { DocuSealSimulationModal } from '../../components/modals/DocuSealSimulationModal'

export const PaymentResultPage: React.FC = () => {
=======
import { Booking, RentalContract, ContractRenewal } from '../../types'
import { ContractDocumentModal } from '../../components/modals/ContractDocumentModal'
import { RenewalDocumentModal } from '../../components/modals/RenewalDocumentModal'
import { QuickThemeLanguageToggle } from '../../components/common/QuickThemeLanguageToggle'
import { LayoutDashboard } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { activateCustomerRental } from '../../utils/rentalAccess'

const money = (value?: number | string | null) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString('vi-VN') : 'Chưa lên lịch'
const dateTime = (value?: string | null) => value
  ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Chưa lên lịch'

export const PaymentResultPage = () => {
  const { user } = useAuth()
>>>>>>> Stashed changes
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const status = searchParams.get('status')
  const bookingId = searchParams.get('bookingId')
  const txnRef = searchParams.get('txnRef') || searchParams.get('vnp_TxnRef') || ''
  const amountParam = searchParams.get('amount') || searchParams.get('vnp_Amount') || ''

  const [booking, setBooking] = useState<Booking | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(bookingId))
  const [isRetrying, setIsRetrying] = useState(false)
  const [errorMessage, setErrorMessage] = useState(searchParams.get('error') || '')

  // DocuSeal electronic signature modal
  const [contractForDocuSealModal, setContractForDocuSealModal] = useState<RentalContract | null>(null)
  const [signedContractSuccess, setSignedContractSuccess] = useState<boolean>(false)

  useEffect(() => {
    let isCurrent = true
    if (!bookingId) {
      setIsLoading(false)
      return
    }

    if (bookingId.startsWith('mock-')) {
      const mockUnitCode = searchParams.get('unitCode') || 'BX-101'
      const mockFacility = searchParams.get('facilityName') || 'Boxora District 1'
      const mockResult: any = {
        id: bookingId,
        bookingCode: `BX-2026-${mockUnitCode.replace(/[^0-9]/g, '') || Math.floor(1000 + Math.random() * 9000)}`,
        unitCode: mockUnitCode,
        facilityName: mockFacility,
        status: 'CONFIRMED',
        initialPaymentAmount: Number(amountParam) || 2400000,
        createdAt: new Date().toISOString()
      }
      setBooking(mockResult)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    bookingService.getById(bookingId)
      .then((result) => {
        if (!isCurrent) return
        setBooking(result)
        if (status === 'PAID') {
          if (user?.role?.name === 'CUSTOMER') {
            activateCustomerRental(user, result.unitCode, `Kho ${result.unitCode} • ${result.facilityName}`)
          }
        }
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        const message = axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message : undefined
        setErrorMessage(message || (error instanceof Error ? error.message : 'Không thể tải thông tin booking.'))
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [bookingId, status, user, amountParam])

  const retryPayment = async () => {
    if (!booking?.initialPaymentAmount) return
    setIsRetrying(true)
    setErrorMessage('')
    try {
      const payment = await paymentService.createVNPayPayment({
        bookingId: booking.id,
        paymentType: 'BOOKING_PAYMENT',
        amount: booking.initialPaymentAmount,
        orderInfo: `Thanh toan booking ${booking.bookingCode}`,
      })
      window.location.assign(payment.paymentUrl)
    } catch (error) {
      const message = axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message : undefined
      setErrorMessage(message || (error instanceof Error ? error.message : 'Không thể tạo lại giao dịch VNPay.'))
      setIsRetrying(false)
    }
  }

<<<<<<< Updated upstream
  const handleOpenDocuSealModal = async () => {
    try {
      const res = await contractService.getMyContracts()
      const found = res?.content?.find(c => c.bookingId === bookingId || c.unitCode === booking?.unitCode)
      if (found) {
        setContractForDocuSealModal(found)
        return
      }
    } catch (err) {
      console.warn('Could not fetch existing contract:', err)
    }

    // Fallback contract data for immediate signature simulation
    const uCode = booking?.unitCode || searchParams.get('unitCode') || 'TD-B101'
    const fName = booking?.facilityName || searchParams.get('facilityName') || 'Boxora Thu Duc'
    const rawAmt = Number(amountParam) || Number(booking?.initialPaymentAmount) || 2400000

    setContractForDocuSealModal({
      id: booking?.id || `CTR-${Date.now()}`,
      contractCode: `CTR-2026-${uCode.replace(/[^0-9A-Z]/g, '') || '9042'}`,
      customerId: user?.id || 'CUST-DEMO',
      customerEmail: user?.email || 'customer@boxora.vn',
      customerName: user?.fullName || 'Khách hàng Boxora',
      customerPhone: user?.phone || '0912 345 678',
      unitCode: uCode,
      facilityName: fName,
      startDate: booking?.startDate || new Date().toISOString().split('T')[0],
      endDate: booking?.endDate || new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
      monthlyFee: Math.round(rawAmt / 2),
      depositHeld: Math.round(rawAmt / 2),
      status: 'PENDING_SIGNATURE',
      signingMethod: 'ONLINE'
    })
  }

  const handleContractSignedSuccess = (signed: RentalContract) => {
    setContractForDocuSealModal(null)
    setSignedContractSuccess(true)
    if (user?.role?.name === 'CUSTOMER' && booking?.id && !booking.id.startsWith('mock-')) {
      const uCode = booking?.unitCode || searchParams.get('unitCode') || signed.unitCode
      activateCustomerRental(user, uCode, `Kho ${uCode} • ${signed.facilityName || 'Boxora'}`)
    }
  }

  const isPaid = status === 'PAID'
=======
  useEffect(() => {
    if (paid && contractSigned && user) {
      const uCode = booking?.unitCode || contract?.unitCode || 'KHO-BX'
      const fName = booking?.facilityName || contract?.facilityName || 'Boxora Smart Storage'
      activateCustomerRental(user, uCode, fName, contract?.contractCode)
    }
  }, [paid, contractSigned, user, booking, contract])

  const pendingReconciliation = !paid && (
    gatewayStatus.toUpperCase() === 'PAID'
    || authoritativePayment?.status === 'PENDING'
    || Boolean(txnRef && !authoritativePayment)
  )
  const paymentFailed = authoritativePayment?.status === 'FAILED' || authoritativePayment?.status === 'EXPIRED'
>>>>>>> Stashed changes
  const paymentExpired = booking?.paymentExpiresAt
    ? new Date(booking.paymentExpiresAt).getTime() <= Date.now()
    : false

  const displayPaidAmount = Number(amountParam) 
    ? (Number(amountParam) > 100000000 ? Math.round(Number(amountParam) / 100) : Number(amountParam))
    : (booking?.initialPaymentAmount || 2400000)

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100/80 px-4 py-10">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-center shadow-xl">
        {isLoading ? (
          <div className="space-y-3 py-10">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
            <p className="text-sm font-semibold text-slate-700">Đang xác minh kết quả thanh toán từ cổng VNPay Sandbox...</p>
          </div>
        ) : isPaid ? (
          <div className="space-y-5">
            {/* Success Icon */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-xs">
              <span className="material-symbols-outlined text-4xl">check_circle</span>
            </div>

            <div>
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold uppercase tracking-wider inline-block">
                Giao Dịch Thành Công
              </span>
              <h1 className="mt-2 text-2xl font-extrabold text-slate-900 tracking-tight">
                Thanh Toán Thành Công Qua VNPay!
              </h1>
              <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                Hệ thống Boxora đã nhận được tiền đặt cọc và tiền thuê kho từ cổng thanh toán trực tuyến.
              </p>
            </div>

            {/* Financial & Unit Details Sheet */}
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 text-left text-xs space-y-2">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Mã giao dịch VNPay:</span>
                <span className="font-mono font-bold text-slate-800">{txnRef || 'BOX-VNPAY-ONLINE'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Số tiền đã thanh toán:</span>
                <span className="font-mono font-bold text-emerald-600 text-sm">
                  {displayPaidAmount.toLocaleString('vi-VN')} ₫
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Mã đặt chỗ:</span>
                <span className="font-mono font-semibold text-slate-800">
                  #{booking?.bookingCode || searchParams.get('bookingId') || 'BX-2026-9042'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Ngăn kho tiếp nhận:</span>
                <span className="font-bold text-blue-600">
                  Kho #{booking?.unitCode || searchParams.get('unitCode') || 'TD-B101'} · {booking?.facilityName || searchParams.get('facilityName') || 'Boxora Smart Storage'}
                </span>
              </div>
            </div>

            {/* Signature Status or Contract Signed Box */}
            {signedContractSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-left space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                  <span className="material-symbols-outlined text-lg text-emerald-600">verified</span>
                  Hợp Đồng Đã Ký Số DocuSeal Thành Công!
                </div>
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  Chữ ký tay điện tử của bạn đã được chứng thực toàn vẹn số liệu và lưu trữ an toàn trên Boxora Cloud. Mã PIN mở kho thông minh đã sẵn sàng.
                </p>
<<<<<<< Updated upstream
                <div className="pt-2">
=======
                <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
                  Đặt thuê và thanh toán thành công!
                </h1>
              </header>

              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Mã đặt thuê</dt><dd className="mt-1 font-mono font-bold">{booking?.bookingCode || bookingId}</dd></div>
                <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Kho và cơ sở</dt><dd className="mt-1 font-semibold">{booking?.unitCode ? `#${booking.unitCode}` : 'Vị trí kho xác nhận khi nhận kho'} · {booking?.facilityName || '—'}</dd></div>
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
>>>>>>> Stashed changes
                  <Link
                    to="/portal/customer?tab=my-units"
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>Vào Danh Sách Kho Của Tôi &amp; Lấy Mã PIN</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-xl text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-blue-950 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-blue-600">draw</span>
                    Bước 2: Ký Hợp Đồng Điện Tử DocuSeal
                  </span>
                  <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                    Chờ ký tay bằng chuột
                  </span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Vui lòng ký tay trực tiếp bằng chuột hoặc màn hình cảm ứng để kích hoạt hợp đồng điện tử và nhận mã PIN mở kho thông minh ngay lập tức.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handleOpenDocuSealModal}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">draw</span>
                    <span>Ký Hợp Đồng DocuSeal Ngay (Ký Chuột)</span>
                  </button>
                  <Link
                    to="/portal/customer?tab=contracts"
                    className="px-4 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center transition-colors"
                  >
                    Vào Customer Portal
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${status === 'FAILED' || errorMessage ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
              <span className="material-symbols-outlined text-4xl">{status === 'FAILED' || errorMessage ? 'error' : 'schedule'}</span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">
              {status === 'FAILED' ? 'Giao dịch thanh toán chưa thành công' : 'Chưa xác nhận được thanh toán'}
            </h1>
            <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
              {errorMessage || 'Giao dịch qua cổng VNPay chưa hoàn tất. Bạn có thể thử lại trong thời gian giữ chỗ còn hiệu lực.'}
            </p>
            {booking && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-left text-xs text-slate-600 space-y-1.5">
                <div className="flex justify-between"><span>Mã booking:</span><strong className="font-mono text-slate-900">#{booking.bookingCode}</strong></div>
                <div className="flex justify-between"><span>Trạng thái:</span><strong className="text-amber-600">{booking.status}</strong></div>
              </div>
            )}
            {booking?.status === 'PENDING_PAYMENT' && !paymentExpired && (
              <button
                type="button"
                disabled={isRetrying}
                onClick={retryPayment}
                className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                {isRetrying ? 'Đang khởi tạo lại...' : 'Thử thanh toán lại qua VNPay'}
              </button>
            )}
            <div className="pt-2">
              <Link to="/portal/customer" className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline">
                Quay lại Customer Portal
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* DocuSeal Electronic Signature Modal with Mouse Drawing Canvas */}
      {contractForDocuSealModal && (
        <DocuSealSimulationModal
          contract={contractForDocuSealModal}
          onClose={() => setContractForDocuSealModal(null)}
          onSignedSuccess={handleContractSignedSuccess}
        />
      )}
    </main>
  )
}

