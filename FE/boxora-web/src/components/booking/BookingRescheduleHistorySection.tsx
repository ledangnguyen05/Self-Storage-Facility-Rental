import React, { useState, useEffect } from 'react'
import { BookingRescheduleHistory } from '../../types'
import { bookingService } from '../../services/bookingService'

interface BookingRescheduleHistorySectionProps {
  bookingId: string
  refreshKey?: number
}

export const BookingRescheduleHistorySection: React.FC<BookingRescheduleHistorySectionProps> = ({
  bookingId,
  refreshKey,
}) => {
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<BookingRescheduleHistory[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadHistory = async () => {
    if (!bookingId) return
    setLoading(true)
    setError(null)
    try {
      const res = await bookingService.getRescheduleHistory(bookingId)
      setHistory(res)
    } catch (err: any) {
      console.warn('Load reschedule history error:', err)
      const msg = err?.response?.data?.message || err?.message || 'Không thể tải lịch sử đổi lịch hẹn.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadHistory()
  }, [bookingId, refreshKey])

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
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

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
          <span className="material-symbols-outlined text-amber-600 text-base">history</span>
          <span>Lịch sử đổi lịch check-in</span>
          {history.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700">
              {history.length}
            </span>
          )}
        </h4>
        <button
          type="button"
          onClick={() => void loadHistory()}
          disabled={loading}
          className="text-[11px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer"
        >
          <span className={`material-symbols-outlined text-[14px] ${loading ? 'animate-spin' : ''}`}>
            sync
          </span>
          <span>Làm mới</span>
        </button>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></span>
          <span>Đang tải lịch sử đổi lịch...</span>
        </div>
      ) : error ? (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadHistory()}
            className="text-[11px] underline font-bold cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      ) : history.length === 0 ? (
        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-center space-y-1">
          <span className="material-symbols-outlined text-slate-300 text-2xl">history_toggle_off</span>
          <p className="text-xs font-medium text-slate-600">Chưa có lần đổi lịch hẹn nào</p>
          <p className="text-[11px] text-slate-400">Lịch hẹn ban đầu được bảo lưu giữ chỗ an toàn.</p>
        </div>
      ) : (
        <div className="relative pl-5 border-l-2 border-slate-200 space-y-4">
          {history.map((item, index) => (
            <div key={item.id || index} className="relative group text-xs">
              {/* Dot icon */}
              <div className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white shadow-xs"></div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 hover:bg-slate-100/60 transition-colors">
                {/* Header row */}
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      Lần đổi #{history.length - index}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {item.outcome === 'CONFIRMED' ? 'Thành công' : item.outcome}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {formatDateTime(item.requestTimestamp || item.createdAt)}
                  </span>
                </div>

                {/* Appointment change compare */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="p-2 bg-white rounded-lg border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">
                      Lịch hẹn trước đây
                    </span>
                    <span className="font-semibold text-slate-700 line-through">
                      {formatDateTime(item.previousAppointmentAt)}
                    </span>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Kỳ hạn: {formatDate(item.previousExpectedStartDate)} → {formatDate(item.previousExpectedEndDate)}
                    </div>
                  </div>

                  <div className="p-2 bg-blue-50/80 rounded-lg border border-blue-200/80">
                    <span className="text-[10px] text-blue-600 uppercase font-bold block mb-0.5">
                      Lịch hẹn mới được duyệt
                    </span>
                    <span className="font-bold text-blue-900">
                      {formatDateTime(item.acceptedAppointmentAt || item.requestedAppointmentAt)}
                    </span>
                    <div className="text-[10px] text-blue-800 mt-0.5 font-medium">
                      Kỳ hạn: {formatDate(item.newExpectedStartDate)} → {formatDate(item.newExpectedEndDate)}
                    </div>
                  </div>
                </div>

                {/* Reason & Requester info */}
                <div className="pt-1 border-t border-slate-200/60 text-[11px] text-slate-600 space-y-1">
                  {item.reason && (
                    <div className="flex items-start gap-1">
                      <span className="text-slate-400 font-medium shrink-0">Lý do:</span>
                      <span className="italic font-medium text-slate-800">"{item.reason}"</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                    <span>
                      Yêu cầu bởi: <strong>{item.requesterName || 'Khách hàng'}</strong> ({item.requesterRole || 'CUSTOMER'})
                    </span>
                    <span>
                      Xử lý: <strong>{item.processorName || 'Hệ thống Boxora'}</strong>
                    </span>
                  </div>

                  {item.contractAmendmentNotes && (
                    <div className="p-2 bg-amber-50/70 border border-amber-200/60 rounded-lg text-[10px] text-amber-900 flex items-start gap-1.5 mt-1">
                      <span className="material-symbols-outlined text-amber-700 text-xs shrink-0 mt-0.5">verified_user</span>
                      <span>{item.contractAmendmentNotes}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
