import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { bookingService } from '../../services/bookingService'
import { paymentService } from '../../services/paymentService'
import { activateCustomerRental } from '../../utils/rentalAccess'
import { Booking } from '../../types'

export const PaymentResultPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const status = searchParams.get('status')
  const bookingId = searchParams.get('bookingId')
  const [booking, setBooking] = useState<Booking | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(bookingId))
  const [isRetrying, setIsRetrying] = useState(false)
  const [errorMessage, setErrorMessage] = useState(searchParams.get('error') || '')

  useEffect(() => {
    let isCurrent = true
    if (!bookingId) {
      setIsLoading(false)
      return
    }

    if (bookingId.startsWith('mock-')) {
      const mockUnitCode = searchParams.get('unitCode') || 'BX-101'
      const mockUnitName = searchParams.get('unitName') || 'Locker Mini A1'
      const mockResult: any = {
        id: bookingId,
        bookingCode: `RES-${mockUnitCode.replace(/[^0-9]/g, '') || Math.floor(1000 + Math.random() * 9000)}`,
        unitCode: mockUnitCode,
        facilityName: 'StoreHub District 1 — Quận 1',
        status: 'CONFIRMED',
        initialPaymentAmount: 1700000,
        createdAt: new Date().toISOString()
      }
      setBooking(mockResult)
      if (status === 'PAID' && user?.role?.name === 'CUSTOMER') {
        activateCustomerRental(user, mockUnitCode, `${mockUnitName} • StoreHub District 1`)
      }
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    bookingService.getById(bookingId)
      .then((result) => {
        if (!isCurrent) return
        setBooking(result)
        if (status === 'PAID') {
          if (result.status !== 'CONFIRMED' && result.status !== 'ACTIVE') {
            setErrorMessage('VNPay đã trả kết quả nhưng booking chưa được xác nhận. Vui lòng tải lại sau ít phút hoặc liên hệ hỗ trợ.')
            return
          }
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
  }, [bookingId, status, user])

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

  const isPaid = status === 'PAID' && (booking?.status === 'CONFIRMED' || booking?.status === 'ACTIVE')
  const paymentExpired = booking?.paymentExpiresAt
    ? new Date(booking.paymentExpiresAt).getTime() <= Date.now()
    : true

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
        {isLoading ? (
          <div className="space-y-3 py-8">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-100 border-t-cyan-700" />
            <p className="text-sm font-semibold text-slate-600">Đang xác minh kết quả thanh toán...</p>
          </div>
        ) : isPaid ? (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <span className="material-symbols-outlined text-4xl">check_circle</span>
            </div>
            <h1 className="mt-4 text-xl font-extrabold text-slate-900">Thanh toán thành công</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Kho <strong>{booking?.unitCode}</strong> tại {booking?.facilityName} đã được xác nhận. Bạn có thể truy cập Customer Portal để xem booking.
            </p>
            {booking && <p className="mt-4 rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-600">Mã booking: {booking.bookingCode}</p>}
            <Link to="/portal/customer" className="mt-6 inline-flex rounded-lg bg-cyan-700 px-5 py-3 text-xs font-bold text-white hover:bg-cyan-800">Vào Customer Portal</Link>
          </>
        ) : (
          <>
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${status === 'FAILED' || errorMessage ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
              <span className="material-symbols-outlined text-4xl">{status === 'FAILED' || errorMessage ? 'error' : 'schedule'}</span>
            </div>
            <h1 className="mt-4 text-xl font-extrabold text-slate-900">
              {status === 'FAILED' ? 'Giao dịch chưa thành công' : 'Chưa xác nhận được thanh toán'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {errorMessage || 'Bạn có thể thử lại trong thời gian giữ chỗ còn hiệu lực.'}
            </p>
            {booking && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-left text-xs text-slate-600">
                <div className="flex justify-between gap-3"><span>Mã booking</span><strong>{booking.bookingCode}</strong></div>
                <div className="mt-2 flex justify-between gap-3"><span>Trạng thái</span><strong>{booking.status}</strong></div>
              </div>
            )}
            {booking?.status === 'PENDING_PAYMENT' && !paymentExpired && (
              <button type="button" disabled={isRetrying} onClick={retryPayment} className="mt-6 w-full rounded-lg bg-cyan-700 px-5 py-3 text-xs font-bold text-white hover:bg-cyan-800 disabled:opacity-50">
                {isRetrying ? 'Đang tạo giao dịch...' : 'Thử thanh toán lại qua VNPay'}
              </button>
            )}
            {booking?.status === 'PENDING_PAYMENT' && paymentExpired && (
              <p className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">Đã hết 24 giờ giữ chỗ. Vui lòng quay lại danh sách để đặt kho mới.</p>
            )}
            <Link to="/units" className="mt-4 inline-flex text-xs font-semibold text-slate-600 underline">Quay lại danh sách kho</Link>
          </>
        )}
      </section>
    </main>
  )
}
