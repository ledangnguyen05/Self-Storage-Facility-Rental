import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { Booking } from '../../../types'
import { bookingService } from '../../../services/bookingService'

interface BookingApprovalModalProps {
  isOpen: boolean
  onClose: () => void
}

const formatVnd = (amount: number) => `${Math.round(amount || 0).toLocaleString('vi-VN')} ₫`

const errorMessage = (error: unknown) => {
  if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data?.message || error.message
  return error instanceof Error ? error.message : 'Không thể xử lý yêu cầu. Vui lòng thử lại.'
}

export const BookingApprovalModal: React.FC<BookingApprovalModalProps> = ({ isOpen, onClose }) => {
  const [requests, setRequests] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const loadRequests = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      setRequests(await bookingService.getPendingApprovals())
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) void loadRequests()
  }, [isOpen, loadRequests])

  if (!isOpen) return null

  const decide = async (booking: Booking, approved: boolean) => {
    setWorkingId(booking.id)
    setError('')
    try {
      await bookingService.decideRequest(booking.id, approved)
      setRequests(current => current.filter(request => request.id !== booking.id))
    } catch (decisionError) {
      setError(errorMessage(decisionError))
      void loadRequests()
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="booking-approval-title" className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 id="booking-approval-title" className="text-lg font-bold text-slate-900">Yêu cầu thuê kho</h2>
            <p className="mt-1 text-xs text-slate-500">Duyệt yêu cầu để khách hàng tiếp tục thanh toán.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void loadRequests()} disabled={isLoading} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Làm mới</button>
            <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </header>

        <div className="space-y-3 overflow-y-auto p-5">
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
          {isLoading && <p className="py-10 text-center text-sm text-slate-500">Đang tải yêu cầu…</p>}
          {!isLoading && requests.length === 0 && (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-300">inbox</span>
              <p className="mt-2 text-sm font-semibold text-slate-700">Chưa có yêu cầu chờ duyệt</p>
            </div>
          )}

          {!isLoading && requests.map(request => (
            <article key={request.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-bold text-cyan-800">{request.bookingCode}</p>
                  <h3 className="mt-1 text-sm font-bold text-slate-900">Kho #{request.unitCode} · {request.facilityName}</h3>
                  <p className="mt-1 text-xs text-slate-500">Bắt đầu {new Date(`${request.startDate}T00:00:00`).toLocaleDateString('vi-VN')} · {request.rentalMonths} tháng</p>
                </div>
                <p className="text-right text-sm font-bold text-slate-900">{formatVnd(request.totalRentalFee)}<span className="block text-[10px] font-medium text-slate-500">tiền thuê theo kỳ</span></p>
              </div>
              <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
                <span>Khách hàng: <strong className="text-slate-800">{request.customerName}</strong></span>
                <span>Điện thoại: <strong className="text-slate-800">{request.customerPhone}</strong></span>
                <span className="sm:col-span-2">Email: <strong className="text-slate-800">{request.customerEmail}</strong></span>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" disabled={workingId !== null} onClick={() => void decide(request, false)} className="rounded-lg border border-rose-200 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                  {workingId === request.id ? 'Đang xử lý…' : 'Từ chối'}
                </button>
                <button type="button" disabled={workingId !== null} onClick={() => void decide(request, true)} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
                  {workingId === request.id ? 'Đang xử lý…' : 'Duyệt yêu cầu'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
