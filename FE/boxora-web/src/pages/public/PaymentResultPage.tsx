import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { bookingService } from '../../services/bookingService'
import { paymentService } from '../../services/paymentService'
import { contractService } from '../../services/contractService'
import { activateCustomerRental } from '../../utils/rentalAccess'
import { Booking, RentalContract } from '../../types'
import { DocuSealSimulationModal } from '../../components/modals/DocuSealSimulationModal'

export const PaymentResultPage: React.FC = () => {
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

  const [reconcileAttempts, setReconcileAttempts] = useState(0)

  useEffect(() => {
    let isCurrent = true
    if (!bookingId) {
      setIsLoading(false)
      return
    }

    if (bookingId.startsWith('mock-')) {
      setErrorMessage('Giao dịch không hợp lệ hoặc chưa được thanh toán qua cổng VNPay.')
      setIsLoading(false)
      return
    }

    const checkStatus = () => {
      bookingService.getById(bookingId)
        .then((result) => {
          if (!isCurrent) return
          setBooking(result)
          const isConfirmed = result.status === 'CONFIRMED' || result.status === 'ACTIVE' || (result.depositPaid && Number(result.depositPaid) > 0)
          if (isConfirmed && user?.role?.name === 'CUSTOMER') {
            activateCustomerRental(user, result.unitCode, `Kho ${result.unitCode} • ${result.facilityName}`)
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
    }

    setIsLoading(true)
    checkStatus()

    // Nếu redirect trả về status=PAID nhưng backend chưa xác nhận xong webhook, poll mỗi 3 giây
    const interval = setInterval(() => {
      setReconcileAttempts(prev => {
        if (prev < 4) {
          checkStatus()
          return prev + 1
        }
        clearInterval(interval)
        return prev
      })
    }, 3000)

    return () => {
      isCurrent = false
      clearInterval(interval)
    }
  }, [bookingId, user])

  const retryPayment = async () => {
    if (!booking?.initialPaymentAmount) return
    setIsRetrying(true)
    setErrorMessage('')
    try {
      // Query backend status before retrying to prevent duplicate payment if already confirmed
      const latestBooking = await bookingService.getById(booking.id)
      if (
        latestBooking &&
        (latestBooking.status === 'CONFIRMED' ||
          latestBooking.status === 'ACTIVE' ||
          (latestBooking.depositPaid && Number(latestBooking.depositPaid) > 0))
      ) {
        setBooking(latestBooking)
        setIsRetrying(false)
        return
      }

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

  const handleOpenDocuSealModal = async () => {
    try {
      const res = await contractService.getMyContracts()
      const found = res?.content?.find(c => c.bookingId === bookingId || c.unitCode === booking?.unitCode)
      if (found) {
        setContractForDocuSealModal(found)
        return
      }
      setErrorMessage('Hợp đồng điện tử đang được hệ thống khởi tạo. Vui lòng thử lại sau giây lát hoặc kiểm tra danh sách hợp đồng trong trang cá nhân.')
    } catch (err: any) {
      console.warn('Could not fetch existing contract:', err)
      setErrorMessage('Không thể tải thông tin hợp đồng từ máy chủ. Vui lòng tải lại trang.')
    }
  }

  const handleContractSignedSuccess = (signed: RentalContract) => {
    setContractForDocuSealModal(null)
    setSignedContractSuccess(true)
    if (user?.role?.name === 'CUSTOMER') {
      const uCode = booking?.unitCode || searchParams.get('unitCode') || signed.unitCode
      activateCustomerRental(user, uCode, `Kho ${uCode} • ${signed.facilityName || 'Boxora'}`)
    }
  }

  const isServerConfirmedPaid = Boolean(
    booking && (
      booking.status === 'CONFIRMED' ||
      booking.status === 'ACTIVE' ||
      (booking.depositPaid && Number(booking.depositPaid) > 0)
    )
  )
  const isPaid = isServerConfirmedPaid && Boolean(txnRef) && !bookingId?.startsWith('mock-')
  const isPendingReconciliation = status === 'PAID' && !isServerConfirmedPaid && !errorMessage
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
        ) : isPendingReconciliation ? (
          <div className="space-y-5 py-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-xs">
              <span className="material-symbols-outlined text-4xl animate-pulse">sync</span>
            </div>
            <div>
              <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold uppercase tracking-wider inline-block">
                Đang Đối Soát Chữ Ký Giao Dịch
              </span>
              <h1 className="mt-2 text-2xl font-extrabold text-slate-900 tracking-tight">
                Đang Chờ Ngân Hàng Xác Thực
              </h1>
              <p className="mt-2 text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Hệ thống đã nhận được tín hiệu chuyển hướng từ VNPay (Mã GD: <strong className="text-slate-800 font-mono">{txnRef}</strong>) và đang chờ webhook HMAC-SHA512 xác thực số tiền {displayPaidAmount.toLocaleString('vi-VN')} ₫.
              </p>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-left text-xs text-blue-900 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-blue-600">info</span>
                Lưu ý an toàn thanh toán Boxora
              </div>
              <p className="text-[11px] text-blue-700 leading-normal">
                Hệ thống Boxora không coi redirect trình duyệt là bằng chứng thanh toán cuối cùng. Sau khi nhận webhook đối soát hợp lệ, kho của bạn sẽ được kích hoạt tức thì.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                Kiểm tra lại trạng thái
              </button>
            </div>
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
                <span className="font-mono font-bold text-slate-800">{txnRef || 'Chưa xác thực'}</span>
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
                <div className="pt-2">
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

