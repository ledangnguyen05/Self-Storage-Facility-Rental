import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { bookingService } from '../../services/bookingService'
import { paymentService, PaymentItem } from '../../services/paymentService'
import { contractService } from '../../services/contractService'
import { activateCustomerRental } from '../../utils/rentalAccess'
import { Booking, RentalContract } from '../../types'
import { DocuSealSimulationModal } from '../../components/modals/DocuSealSimulationModal'
import { ContractDocumentModal } from '../../components/modals/ContractDocumentModal'

function formatDateVi(dateStr?: string | null): string {
  if (!dateStr) return 'Chưa lên lịch'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatDateTimeVi(dateStr?: string | null): string {
  if (!dateStr) return 'Chưa lên lịch'
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export const PaymentResultPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const statusParam = searchParams.get('status')
  const bookingId = searchParams.get('bookingId')
  const txnRefParam = searchParams.get('txnRef') || searchParams.get('vnp_TxnRef') || ''
  const amountParam = searchParams.get('amount') || searchParams.get('vnp_Amount') || ''

  const [booking, setBooking] = useState<Booking | null>(null)
  const [contract, setContract] = useState<RentalContract | null>(null)
  const [authoritativePayment, setAuthoritativePayment] = useState<PaymentItem | null>(null)

  const [isLoading, setIsLoading] = useState(Boolean(bookingId))
  const [isRetrying, setIsRetrying] = useState(false)
  const [errorMessage, setErrorMessage] = useState(searchParams.get('error') || '')

  // Signature modal state
  const [contractForSigningModal, setContractForSigningModal] = useState<RentalContract | null>(null)
  const [signedContractSuccess, setSignedContractSuccess] = useState<boolean>(false)

  // Document viewer modal
  const [isViewContractModalOpen, setIsViewContractModalOpen] = useState(false)

  const [reconcileAttempts, setReconcileAttempts] = useState(0)

  useEffect(() => {
    let isCurrent = true
    if (!bookingId) {
      setIsLoading(false)
      return
    }

    if (bookingId.startsWith('mock-')) {
      setErrorMessage('Giao dịch không hợp lệ hoặc chưa được thanh toán trực tuyến.')
      setIsLoading(false)
      return
    }

    const checkStatus = async () => {
      try {
        // 1. Lấy thông tin booking chính thức từ backend
        const resultBooking = await bookingService.getById(bookingId)
        if (!isCurrent) return
        setBooking(resultBooking)

        const isConfirmed =
          resultBooking.status === 'CONFIRMED' ||
          resultBooking.status === 'ACTIVE' ||
          (resultBooking.depositPaid && Number(resultBooking.depositPaid) > 0)

        if (isConfirmed && user?.role?.name === 'CUSTOMER') {
          activateCustomerRental(
            user,
            resultBooking.unitCode,
            `Kho ${resultBooking.unitCode} • ${resultBooking.facilityName}`
          )
        }

        // 2. Lấy dữ liệu thanh toán đối soát chính thức từ database
        try {
          const payments = await paymentService.getByBookingId(bookingId)
          if (isCurrent && payments && payments.length > 0) {
            const paid = payments.find((p) => p.status === 'PAID')
            if (paid) {
              setAuthoritativePayment(paid)
            } else {
              setAuthoritativePayment(payments[0])
            }
          }
        } catch (payErr) {
          console.warn('Could not fetch authoritative payment info:', payErr)
        }

        // 3. Lấy dữ liệu hợp đồng chính thức từ backend
        try {
          let foundContract = await contractService.getContractByBookingId(bookingId)
          if (!foundContract) {
            const myContracts = await contractService.getMyContracts()
            foundContract =
              myContracts?.content?.find(
                (c) => c.bookingId === bookingId || c.unitCode === resultBooking.unitCode
              ) || null
          }

          if (isCurrent && foundContract) {
            setContract(foundContract)
            const isSigned =
              Boolean(foundContract.signedAt) ||
              foundContract.status === 'ACTIVE' ||
              foundContract.status === 'PENDING_ACTIVATION'
            if (isSigned) {
              setSignedContractSuccess(true)
            }
          }
        } catch (contractErr) {
          console.warn('Could not fetch contract info:', contractErr)
        }
      } catch (error: unknown) {
        if (!isCurrent) return
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
          setErrorMessage('Bạn không có quyền truy cập thông tin đặt kho này.')
        } else {
          const message = axios.isAxiosError<{ message?: string }>(error)
            ? error.response?.data?.message
            : undefined
          setErrorMessage(
            message || (error instanceof Error ? error.message : 'Không thể tải thông tin đặt kho từ máy chủ.')
          )
        }
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }

    setIsLoading(true)
    checkStatus()

    // Nếu redirect trả về status=PAID nhưng backend chưa xác nhận xong webhook, poll đối soát
    const interval = setInterval(() => {
      setReconcileAttempts((prev) => {
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
      setErrorMessage(message || (error instanceof Error ? error.message : 'Không thể khởi tạo lại giao dịch thanh toán.'))
      setIsRetrying(false)
    }
  }

  const handleOpenSigningModal = async () => {
    if (contract) {
      setContractForSigningModal(contract)
      return
    }

    try {
      if (bookingId) {
        const found = await contractService.getContractByBookingId(bookingId)
        if (found) {
          setContract(found)
          setContractForSigningModal(found)
          return
        }
      }
      const res = await contractService.getMyContracts()
      const found = res?.content?.find((c) => c.bookingId === bookingId || c.unitCode === booking?.unitCode)
      if (found) {
        setContract(found)
        setContractForSigningModal(found)
        return
      }
      setErrorMessage(
        'Hợp đồng điện tử đang được hệ thống khởi tạo. Vui lòng thử lại sau giây lát hoặc kiểm tra danh sách hợp đồng trong trang cá nhân.'
      )
    } catch (err: unknown) {
      console.warn('Could not fetch existing contract:', err)
      setErrorMessage('Không thể tải thông tin hợp đồng từ máy chủ. Vui lòng tải lại trang.')
    }
  }

  const handleContractSignedSuccess = (signed: RentalContract) => {
    setContractForSigningModal(null)
    setContract(signed)
    setSignedContractSuccess(true)
    if (user?.role?.name === 'CUSTOMER') {
      const uCode = booking?.unitCode || searchParams.get('unitCode') || signed.unitCode
      activateCustomerRental(user, uCode, `Kho ${uCode} • ${signed.facilityName || 'Boxora'}`)
    }
  }

  // Xác định trạng thái thanh toán từ backend đáng tin cậy
  const isServerConfirmedPaid = Boolean(
    authoritativePayment?.status === 'PAID' ||
      (booking &&
        (booking.status === 'CONFIRMED' ||
          booking.status === 'ACTIVE' ||
          (booking.depositPaid && Number(booking.depositPaid) > 0)))
  )
  const isPaid = isServerConfirmedPaid && !bookingId?.startsWith('mock-')
  const isPendingReconciliation = statusParam === 'PAID' && !isServerConfirmedPaid && !errorMessage

  // Xác định trạng thái ký hợp đồng từ backend đáng tin cậy
  const isContractSigned = Boolean(
    signedContractSuccess ||
      contract?.signedAt ||
      contract?.status === 'ACTIVE' ||
      contract?.status === 'PENDING_ACTIVATION'
  )

  const paymentExpired = booking?.paymentExpiresAt
    ? new Date(booking.paymentExpiresAt).getTime() <= Date.now()
    : false

  // Số tiền hiển thị dựa trên giao dịch thực tế
  const actualPaidAmount = authoritativePayment?.amount
    ? Number(authoritativePayment.amount)
    : booking?.depositPaid && Number(booking.depositPaid) > 0
    ? Number(booking.depositPaid)
    : Number(amountParam)
    ? Number(amountParam) > 100000000
      ? Math.round(Number(amountParam) / 100)
      : Number(amountParam)
    : booking?.initialPaymentAmount

  // Mã giao dịch thực tế từ backend
  const authoritativeTxnCode = authoritativePayment?.transactionId || txnRefParam || ''

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100/80 px-4 py-10">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-center shadow-xl">
        {isLoading ? (
          <div className="space-y-3 py-10">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
            <p className="text-sm font-semibold text-slate-700">Đang đối soát dữ liệu từ hệ thống máy chủ...</p>
          </div>
        ) : isPendingReconciliation ? (
          <div className="space-y-5 py-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-xs">
              <span className="material-symbols-outlined text-4xl animate-pulse">sync</span>
            </div>
            <div>
              <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold uppercase tracking-wider inline-block">
                Đang đối soát giao dịch
              </span>
              <h1 className="mt-2 text-2xl font-extrabold text-slate-900 tracking-tight">
                Đang chờ hệ thống xác thực thanh toán
              </h1>
              <p className="mt-2 text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Hệ thống đã nhận tín hiệu giao dịch{' '}
                {authoritativeTxnCode ? (
                  <>
                    (Mã: <strong className="text-slate-800 font-mono">{authoritativeTxnCode}</strong>)
                  </>
                ) : null}{' '}
                và đang chờ đối soát chính thức từ máy chủ.
              </p>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-left text-xs text-blue-900 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-blue-600">security</span>
                Xác thực an toàn Boxora
              </div>
              <p className="text-[11px] text-blue-700 leading-normal">
                Hệ thống Boxora đối soát trực tiếp với dữ liệu thanh toán đáng tin cậy của máy chủ. Khi hoàn tất đối
                soát, trạng thái đơn sẽ được tự động kích hoạt.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                Kiểm tra lại trạng thái
              </button>
            </div>
          </div>
        ) : isPaid ? (
          <div className="space-y-5">
            {isContractSigned ? (
              /* MÀN HÌNH XÁC NHẬN SAU KHI KÝ HỢP ĐỒNG THÀNH CÔNG */
              <div className="rounded-2xl border border-emerald-200 bg-white p-6 text-left shadow-sm space-y-5">
                <div className="text-center space-y-2 pb-3 border-b border-slate-100">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-xs">
                    <span className="material-symbols-outlined text-4xl">verified</span>
                  </div>
                  <div>
                    <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold uppercase tracking-wider inline-block">
                      Ký hợp đồng &amp; Thanh toán thành công
                    </span>
                    <h1 className="mt-2 text-2xl font-extrabold text-slate-900 tracking-tight">
                      Hợp đồng đã hoàn tất xác thực
                    </h1>
                    <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                      Hợp đồng điện tử đã được ký kết và tiền đặt cọc đã được xác nhận ghi nhận trên hệ thống Boxora.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Chi tiết hợp đồng &amp; Giao dịch
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[11px] text-slate-500 block">Mã đặt chỗ</span>
                      <strong className="font-mono text-slate-900 text-sm">
                        #{booking?.bookingCode || bookingId || 'Chưa có'}
                      </strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[11px] text-slate-500 block">Kho đã chọn</span>
                      <strong className="text-blue-700 text-sm">
                        #{booking?.unitCode || 'Chưa xác định'} · {booking?.facilityName || 'Boxora Facility'}
                      </strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[11px] text-slate-500 block">Trạng thái hợp đồng</span>
                      <strong className="text-emerald-700 text-sm">
                        {contract?.status === 'ACTIVE'
                          ? 'Đang hoạt động'
                          : contract?.status === 'PENDING_ACTIVATION'
                          ? 'Đã ký điện tử (Chờ kích hoạt)'
                          : 'Đã ký điện tử'}
                      </strong>
                      {contract?.contractCode && (
                        <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">
                          Mã HĐ: {contract.contractCode}
                        </span>
                      )}
                      {contract?.signedAt && (
                        <span className="text-[10px] text-slate-500 block font-mono">
                          Thời gian ký: {formatDateTimeVi(contract.signedAt)}
                        </span>
                      )}
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[11px] text-slate-500 block">Trạng thái thanh toán</span>
                      <strong className="text-emerald-700 text-sm">Đã xác nhận thanh toán</strong>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Phương thức: Thanh toán trực tuyến
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[11px] text-slate-500 block">Mã giao dịch</span>
                      <strong className="font-mono text-slate-800 text-xs break-all">
                        {authoritativeTxnCode || 'Chưa ghi nhận mã giao dịch'}
                      </strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[11px] text-slate-500 block">Số tiền thực tế đã thanh toán</span>
                      <strong className="font-mono text-emerald-700 text-sm">
                        {actualPaidAmount ? `${actualPaidAmount.toLocaleString('vi-VN')} ₫` : 'Đã thanh toán'}
                      </strong>
                    </div>
                  </div>

                  {/* Thông tin bàn giao kho */}
                  <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-blue-900">Trạng thái bàn giao kho:</span>
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                          booking?.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {booking?.status === 'ACTIVE'
                          ? 'Đã hoàn tất bàn giao'
                          : 'Chờ hoàn tất bàn giao tại cơ sở'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 text-[11px]">
                      <span>Lịch hẹn nhận kho / Ngày bắt đầu:</span>
                      <strong className="font-semibold text-slate-800">
                        {booking?.expectedCheckInAt
                          ? formatDateTimeVi(booking.expectedCheckInAt)
                          : booking?.startDate
                          ? formatDateVi(booking.startDate)
                          : 'Chưa lên lịch'}
                      </strong>
                    </div>
                    <p className="text-[11px] text-blue-800 leading-relaxed pt-0.5 border-t border-blue-200/50">
                      Quý khách vui lòng mang CCCD gốc đến cơ sở Boxora theo lịch hẹn để nhân viên đối soát, nghiệm thu ngăn kho và cấp chìa/quyền mở cửa.
                    </p>
                  </div>

                  {/* Mã PIN nhận bàn giao */}
                  <div className="p-3.5 rounded-xl bg-slate-100/80 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">Mã PIN nhận bàn giao:</span>
                      {booking?.accessPin ? (
                        <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono font-bold text-xs">
                          {booking.accessPin}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[11px]">
                          Chưa kích hoạt
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {booking?.accessPin
                        ? 'Mã PIN bảo mật đã được kích hoạt thành công.'
                        : 'Theo quy định bảo mật Boxora, mã PIN nhận bàn giao sẽ được cấp phát chính thức khi nhân viên hoàn tất thủ tục bàn giao check-in tại quầy cơ sở.'}
                    </p>
                  </div>
                </div>

                {/* Các hành động sau khi hoàn tất */}
                <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsViewContractModalOpen(true)}
                    className="flex-1 py-2.5 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                    <span>Xem hợp đồng đã ký</span>
                  </button>
                  <Link
                    to={`/portal/customer?tab=bookings&bookingId=${booking?.id || ''}`}
                    className="flex-1 py-2.5 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl text-center transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                    <span>Xem lịch bàn giao</span>
                  </Link>
                  <Link
                    to="/portal/customer"
                    className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl text-center transition-colors shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">dashboard</span>
                    <span>Về Dashboard</span>
                  </Link>
                </div>
              </div>
            ) : (
              /* TRƯỜNG HỢP: THANH TOÁN THÀNH CÔNG NHƯNG CHƯA KÝ HỢP ĐỒNG */
              <div className="space-y-5">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-xs">
                  <span className="material-symbols-outlined text-4xl">check_circle</span>
                </div>

                <div>
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold uppercase tracking-wider inline-block">
                    Thanh toán đã xác nhận
                  </span>
                  <h1 className="mt-2 text-2xl font-extrabold text-slate-900 tracking-tight">
                    Thanh toán thành công
                  </h1>
                  <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                    Hệ thống Boxora đã nhận được tiền đặt cọc và tiền thuê kho từ cổng thanh toán trực tuyến.
                  </p>
                </div>

                {/* Bảng chi tiết thanh toán */}
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 text-left text-xs space-y-2">
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Mã giao dịch:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {authoritativeTxnCode || 'Chưa ghi nhận mã giao dịch'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Số tiền đã thanh toán:</span>
                    <span className="font-mono font-bold text-emerald-600 text-sm">
                      {actualPaidAmount ? `${actualPaidAmount.toLocaleString('vi-VN')} ₫` : 'Đã xác nhận'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Mã đặt chỗ:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      #{booking?.bookingCode || bookingId || 'Đang cập nhật'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500">Ngăn kho tiếp nhận:</span>
                    <span className="font-bold text-blue-600">
                      #{booking?.unitCode || 'Đang cập nhật'} · {booking?.facilityName || 'Boxora Facility'}
                    </span>
                  </div>
                </div>

                {/* Bước tiếp theo: Ký hợp đồng điện tử trực tuyến */}
                <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-xl text-left space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-blue-950 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-blue-600">draw</span>
                      Bước tiếp theo: Ký hợp đồng trực tuyến
                    </span>
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                      Chờ hoàn tất chữ ký
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    Đơn kho đã được thanh toán đủ. Quý khách vui lòng hoàn tất chữ ký điện tử trực tuyến để hệ thống
                    chính thức xác nhận hợp đồng và bàn giao ngăn kho.
                  </p>
                  <div className="pt-2 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={handleOpenSigningModal}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-lg">draw</span>
                      <span>Ký hợp đồng trực tuyến ngay</span>
                    </button>
                    <Link
                      to="/portal/customer"
                      className="py-3 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl text-center transition-colors"
                    >
                      Về Dashboard
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* TRƯỜNG HỢP: THANH TOÁN THẤT BÀI / CHƯA HOÀN TẤT */
          <div className="space-y-4">
            <div
              className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
                statusParam === 'FAILED' || errorMessage
                  ? 'bg-rose-100 text-rose-600'
                  : 'bg-amber-100 text-amber-600'
              }`}
            >
              <span className="material-symbols-outlined text-4xl">
                {statusParam === 'FAILED' || errorMessage ? 'error' : 'schedule'}
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">
              {statusParam === 'FAILED'
                ? 'Giao dịch thanh toán chưa thành công'
                : errorMessage
                ? 'Không thể truy cập thông tin giao dịch'
                : 'Chưa xác nhận được thanh toán'}
            </h1>
            <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
              {errorMessage || 'Giao dịch chưa hoàn tất. Bạn có thể thử lại trong thời gian giữ chỗ còn hiệu lực.'}
            </p>
            {booking && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-left text-xs text-slate-600 space-y-1.5">
                <div className="flex justify-between">
                  <span>Mã booking:</span>
                  <strong className="font-mono text-slate-900">#{booking.bookingCode}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Trạng thái:</span>
                  <strong className="text-amber-600">{booking.status}</strong>
                </div>
              </div>
            )}
            {booking?.status === 'PENDING_PAYMENT' && !paymentExpired && (
              <button
                type="button"
                disabled={isRetrying}
                onClick={retryPayment}
                className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                {isRetrying ? 'Đang khởi tạo lại...' : 'Thử thanh toán lại'}
              </button>
            )}
            <div className="pt-2">
              <Link
                to="/portal/customer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 underline"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span>Về Dashboard</span>
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Modal ký hợp đồng điện tử trực tuyến */}
      {contractForSigningModal && (
        <DocuSealSimulationModal
          contract={contractForSigningModal}
          onClose={() => setContractForSigningModal(null)}
          onSignedSuccess={handleContractSignedSuccess}
        />
      )}

      {/* Modal xem hợp đồng đã ký */}
      {isViewContractModalOpen && contract && (
        <ContractDocumentModal
          contract={contract}
          onClose={() => setIsViewContractModalOpen(false)}
        />
      )}
    </main>
  )
}
