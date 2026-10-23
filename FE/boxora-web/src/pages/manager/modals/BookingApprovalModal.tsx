import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { Booking, User } from '../../../types'
import { bookingService } from '../../../services/bookingService'
import { userService } from '../../../services/userService'

interface BookingApprovalModalProps {
  isOpen: boolean
  onClose: () => void
  focusBookingId?: string
  onPendingCountChange?: (count: number) => void
}

const formatVnd = (amount: number) => `${Math.round(amount || 0).toLocaleString('vi-VN')} ₫`

const ApprovalCountdown: React.FC<{ request: Booking }> = ({ request }) => {
  const expiresAt = request.paymentExpiresAt ? new Date(request.paymentExpiresAt).getTime() : NaN
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!Number.isFinite(expiresAt)) return
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [expiresAt])

  if (!Number.isFinite(expiresAt)) return null

  const secondsRemaining = Math.max(0, Math.floor((expiresAt - now) / 1000))
  const isExpired = secondsRemaining === 0
  const formattedCountdown = [
    Math.floor(secondsRemaining / 3600),
    Math.floor((secondsRemaining % 3600) / 60),
    secondsRemaining % 60
  ].map(value => String(value).padStart(2, '0')).join(':')

  return (
    <p className={`mt-1.5 inline-flex items-center gap-1 text-xs font-bold ${isExpired ? 'text-rose-700' : 'text-orange-700'}`}>
      <span className="material-symbols-outlined text-[15px]">timer</span>
      {isExpired ? 'Đã hết hạn xử lý yêu cầu' : `Còn ${formattedCountdown} để duyệt yêu cầu`}
    </p>
  )
}

const errorMessage = (error: unknown) => {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    if (error.response?.status === 403) {
      return error.response?.data?.message || 'Bạn không có quyền thực hiện trên cơ sở này hoặc phiên làm việc cần làm mới.'
    }
    return error.response?.data?.message || error.message
  }
  return error instanceof Error ? error.message : 'Không thể xử lý yêu cầu. Vui lòng thử lại.'
}

export const BookingApprovalModal: React.FC<BookingApprovalModalProps> = ({ isOpen, onClose, focusBookingId, onPendingCountChange }) => {
  const [requests, setRequests] = useState<Booking[]>([])
  const [staffList, setStaffList] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // State for Staff Assignment sub-modal
  const [approvingBooking, setApprovingBooking] = useState<Booking | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [staffNotes, setStaffNotes] = useState<string>('')

  const loadRequests = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const [bookingsData, staffData] = await Promise.all([
        bookingService.getPendingApprovals(),
        userService.getAllUsers({ role: 'STAFF', size: 100 }).catch(() => ({ data: [] })),
      ])
      setRequests(bookingsData)
      onPendingCountChange?.(bookingsData.length)
      setStaffList(staffData.data || [])
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [onPendingCountChange])

  useEffect(() => {
    if (isOpen) {
      setSuccessMsg('')
      setApprovingBooking(null)
      void loadRequests()
    }
  }, [isOpen, loadRequests])

  if (!isOpen) return null

  const handleOpenApproveDialog = (booking: Booking) => {
    setApprovingBooking(booking)
    // Pre-select first staff of the same facility if possible
    const facilityStaff = staffList.filter(s => !booking.facilityId || !s.facilityId || s.facilityId === booking.facilityId)
    setSelectedStaffId(facilityStaff.length > 0 ? facilityStaff[0].id : '')
    setStaffNotes(
      booking.signingMethod === 'IN_PERSON'
        ? 'Tiếp đón khách hàng đến xem kho thực tế, kiểm tra thiết bị Smart Lock và chuẩn bị bàn giao kho tại quầy.'
        : 'Chuẩn bị hồ sơ kho điện tử và hỗ trợ khách hàng kích hoạt mã khóa Smart Lock từ xa.'
    )
  }

  const handleConfirmApprove = async () => {
    if (!approvingBooking) return
    setWorkingId(approvingBooking.id)
    setError('')
    setSuccessMsg('')
    try {
      await bookingService.decideRequest(
        approvingBooking.id,
        true,
        selectedStaffId || undefined,
        staffNotes.trim() || undefined
      )
      setRequests(current => current.filter(r => r.id !== approvingBooking.id))
      onPendingCountChange?.(Math.max(0, requests.length - 1))
      setSuccessMsg(
        `Đã duyệt yêu cầu thuê kho #${approvingBooking.unitCode} (${approvingBooking.bookingCode}) và phân công nhân viên phụ trách thành công!`
      )
      setApprovingBooking(null)
    } catch (decisionError) {
      setError(errorMessage(decisionError))
    } finally {
      setWorkingId(null)
    }
  }

  const handleReject = async (booking: Booking) => {
    if (!window.confirm(`Bạn có chắc chắn muốn từ chối yêu cầu thuê kho #${booking.unitCode} (${booking.bookingCode})?`)) {
      return
    }
    setWorkingId(booking.id)
    setError('')
    setSuccessMsg('')
    try {
      await bookingService.decideRequest(booking.id, false)
      setRequests(current => current.filter(r => r.id !== booking.id))
      onPendingCountChange?.(Math.max(0, requests.length - 1))
      setSuccessMsg(`Đã từ chối yêu cầu thuê kho #${booking.unitCode}. Kho đã được giải phóng trạng thái.`)
    } catch (decisionError) {
      setError(errorMessage(decisionError))
      void loadRequests()
    } finally {
      setWorkingId(null)
    }
  }

  // Filter staff by booking's facility if available
  const availableStaff = staffList.filter(s => 
    !approvingBooking?.facilityId || !s.facilityId || s.facilityId === approvingBooking.facilityId
  )

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="booking-approval-title" className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-5 bg-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-700 text-[20px]">assignment_turned_in</span>
              <h2 id="booking-approval-title" className="text-lg font-bold text-slate-900">
                Yêu Cầu Thuê Kho Chờ Phê Duyệt
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Phê duyệt và phân công nhân viên tiếp đón khách hàng hoặc chuẩn bị hợp đồng.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void loadRequests()} disabled={isLoading} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              Làm mới
            </button>
            <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="space-y-4 overflow-y-auto p-5">
          {successMsg && (
            <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
              <span>{successMsg}</span>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {error}
            </p>
          )}

          {isLoading && <p className="py-10 text-center text-sm text-slate-500">Đang tải danh sách yêu cầu…</p>}

          {!isLoading && requests.length === 0 && (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-300">inbox</span>
              <p className="mt-2 text-sm font-semibold text-slate-700">Hiện không có yêu cầu nào chờ duyệt</p>
            </div>
          )}

          {!isLoading && [...requests]
            .sort((left, right) => Number(right.id === focusBookingId) - Number(left.id === focusBookingId))
            .map(request => {
            const isOnline = request.signingMethod !== 'IN_PERSON'

            return (
              <article key={request.id} className={`rounded-xl border p-4 bg-white hover:border-slate-300 transition-all shadow-sm ${request.id === focusBookingId ? 'border-cyan-500 ring-2 ring-cyan-100' : 'border-slate-200'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-cyan-800">#{request.bookingCode}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                        isOnline
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        <span className="material-symbols-outlined text-[13px]">{isOnline ? 'draw' : 'storefront'}</span>
                        <span>{isOnline ? 'Ký Điện Tử Trực Tuyến' : 'Ký Trực Tiếp Tại Kho'}</span>
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900">
                      Kho #{request.unitCode} &bull; {request.facilityName || 'Boxora Facility'}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 font-mono">
                      Dự kiến đến: {request.expectedArrivalAt
                        ? new Date(request.expectedArrivalAt).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
                        : new Date(`${request.startDate}T00:00:00`).toLocaleDateString('vi-VN')}
                      {' '}&bull; Bắt đầu thuê {new Date(`${request.startDate}T00:00:00`).toLocaleDateString('vi-VN')} &bull; Kỳ hạn {request.rentalMonths} tháng
                    </p>
                    {request.status === 'PENDING_APPROVAL' && <ApprovalCountdown request={request} />}
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{formatVnd(request.totalRentalFee)}</p>
                    <span className="block text-[10px] font-medium text-slate-500">Tiền thuê theo kỳ</span>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
                  <span>Khách hàng: <strong className="text-slate-900">{request.customerName}</strong></span>
                  <span>Điện thoại: <strong className="text-slate-900">{request.customerPhone}</strong></span>
                  <span className="sm:col-span-2">Email: <strong className="text-slate-900">{request.customerEmail}</strong></span>
                </div>

                {/* Assigned Staff Preview if any */}
                {request.assignedStaffName && (
                  <div className="mt-2 text-xs text-emerald-800 bg-emerald-50/70 p-2 rounded-md flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">badge</span>
                    <span>Nhân viên phụ trách: <strong>{request.assignedStaffName}</strong></span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={workingId !== null}
                    onClick={() => void handleReject(request)}
                    className="rounded-lg border border-rose-200 px-3.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
                  >
                    {workingId === request.id ? 'Đang xử lý…' : 'Từ chối'}
                  </button>

                  <button
                    type="button"
                    disabled={workingId !== null}
                    onClick={() => handleOpenApproveDialog(request)}
                    className="rounded-lg bg-emerald-700 hover:bg-emerald-800 px-4 py-1.5 text-xs font-bold text-white shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Duyệt &amp; Phân Công Nhân Viên</span>
                  </button>
                </div>
              </article>
            )
          })}
        </div>

        {/* Modal Sub-dialog: Staff Assignment & Notes */}
        {approvingBooking && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-400 text-[18px]">how_to_reg</span>
                    <span>Phê Duyệt &amp; Giao Việc Nhân Viên</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Kho #{approvingBooking.unitCode} &bull; Khách: {approvingBooking.customerName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setApprovingBooking(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                {/* Method info banner */}
                <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                  approvingBooking.signingMethod === 'IN_PERSON'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}>
                  <span className="material-symbols-outlined text-[20px] shrink-0">
                    {approvingBooking.signingMethod === 'IN_PERSON' ? 'storefront' : 'draw'}
                  </span>
                  <div>
                    <strong>
                      {approvingBooking.signingMethod === 'IN_PERSON'
                        ? 'Khách hàng chọn Ký Trực Tiếp Tại Kho'
                        : 'Khách hàng chọn Ký Điện Tử Trực Tuyến'}
                    </strong>
                    <p className="text-[11px] mt-0.5 opacity-90">
                      {approvingBooking.signingMethod === 'IN_PERSON'
                        ? 'Nhân viên được phân công sẽ đón khách, hướng dẫn kiểm tra kho thực tế và chuẩn bị biên bản check-in.'
                        : 'Sau khi duyệt, khách hàng sẽ thanh toán cọc qua cổng thanh toán trực tuyến và hoàn tất ký hợp đồng điện tử.'}
                    </p>
                  </div>
                </div>

                {/* Staff Select Dropdown */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-800">
                    Chọn nhân viên chi nhánh phụ trách tiếp nhận:
                  </label>
                  <select
                    value={selectedStaffId}
                    onChange={e => setSelectedStaffId(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-300 rounded-lg text-xs font-medium focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 outline-none"
                  >
                    <option value="">-- Chọn nhân viên (Tùy chọn) --</option>
                    {availableStaff.map(staff => (
                      <option key={staff.id} value={staff.id}>
                        {staff.fullName || staff.username} ({staff.email || staff.phone || 'Staff'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assignment Notes Textarea */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-800">
                    Ghi chú &amp; Hướng dẫn dặn dò nhân viên:
                  </label>
                  <textarea
                    rows={3}
                    value={staffNotes}
                    onChange={e => setStaffNotes(e.target.value)}
                    placeholder="Nhập dặn dò nhân viên tiếp đón khách, kiểm tra Smart Lock hoặc hỗ trợ khách nhận kho..."
                    className="w-full p-3 border border-slate-300 rounded-lg text-xs focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 outline-none resize-none"
                  />
                </div>
              </div>

              {/* Sub-dialog Actions */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setApprovingBooking(null)}
                  disabled={workingId !== null}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmApprove()}
                  disabled={workingId !== null}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">task_alt</span>
                  <span>{workingId ? 'Đang duyệt…' : 'Xác Nhận Duyệt & Giao Việc'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </section>
    </div>
  )
}
