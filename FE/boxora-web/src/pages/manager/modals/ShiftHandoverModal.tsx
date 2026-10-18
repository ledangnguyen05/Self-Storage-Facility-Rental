import React, { useState, useEffect } from 'react'
import { userService } from '../../../services/userService'
import { staffAssignmentService } from '../../../services/staffAssignmentService'
import { User } from '../../../types'

interface ShiftHandoverModalProps {
  isOpen: boolean
  onClose: () => void
  facilityId: string
  facilityName: string
  currentShift: 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'FULL_DAY'
  outgoingAssignmentId?: string
  onSuccess: (msg: string) => void
}

export const ShiftHandoverModal: React.FC<ShiftHandoverModalProps> = ({
  isOpen,
  onClose,
  facilityId,
  facilityName,
  currentShift,
  outgoingAssignmentId,
  onSuccess
}) => {
  const [candidateStaff, setCandidateStaff] = useState<User[]>([])
  const [incomingStaffId, setIncomingStaffId] = useState<string>('')
  const [pendingTasks, setPendingTasks] = useState('')
  const [pendingTicketsCount, setPendingTicketsCount] = useState<number>(0)
  const [unresolvedBookingsCount, setUnresolvedBookingsCount] = useState<number>(0)
  const [cashInDrawer, setCashInDrawer] = useState<number>(0)
  const [facilityStatusNote, setFacilityStatusNote] = useState('Khóa thông minh SmartLock và hệ thống camera an ninh hoạt động ổn định.')
  const [checklistCompleted, setChecklistCompleted] = useState(false)
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && facilityId) {
      loadStaff()
    }
  }, [isOpen, facilityId])

  const loadStaff = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const res = await userService.getAllUsers({ role: 'STAFF', facilityId, size: 50 })
      const list = res?.data || []
      setCandidateStaff(list)
      if (list.length > 0) {
        setIncomingStaffId(list[0].id)
      }
    } catch {
      // fallback
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!checklistCompleted) {
      setErrorMessage('Quy trình bắt buộc: Vui lòng hoàn tất và tích chọn xác nhận checklist bàn giao ca.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await staffAssignmentService.createHandover({
        facilityId,
        handoverDate: new Date().toISOString().split('T')[0],
        shift: currentShift,
        incomingStaffId: incomingStaffId || undefined,
        outgoingAssignmentId,
        pendingTasks: pendingTasks.trim() || undefined,
        pendingTicketsCount,
        unresolvedBookingsCount,
        cashInDrawer,
        facilityStatusNote: facilityStatusNote.trim() || undefined,
        checklistCompleted: true,
        notes: notes.trim() || undefined
      })

      onSuccess('Lập biên bản bàn giao ca trực thành công! Ca tiếp nhận có thể xem và xác nhận tiếp nhận.')
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Lỗi khi lưu biên bản bàn giao ca trực.'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const shiftNameVi =
    currentShift === 'MORNING'
      ? 'Ca Sáng (06:00 - 14:00)'
      : currentShift === 'AFTERNOON'
      ? 'Ca Chiều (14:00 - 22:00)'
      : currentShift === 'NIGHT'
      ? 'Ca Đêm (22:00 - 06:00)'
      : 'Cả Ngày (08:00 - 17:00)'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 text-left max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <span className="material-symbols-outlined text-[24px]">assignment_turned_in</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Lập Biên Bản Bàn Giao Ca Trực</h2>
              <p className="text-xs text-slate-500">{facilityName} • {shiftNameVi}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-xs">
          {/* Incoming Staff Selection */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Nhân sự ca tiếp nhận (Người nhận bàn giao)
            </label>
            {isLoading ? (
              <div className="text-slate-400 italic py-1">Đang tải nhân sự...</div>
            ) : (
              <select
                value={incomingStaffId}
                onChange={e => setIncomingStaffId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
              >
                <option value="">-- Chưa chỉ định (Ca nhận sẽ tự xác nhận tiếp nhận sau) --</option>
                {candidateStaff.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.fullName || s.username} ({s.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Counts Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Sự cố / Ticket chưa đóng
              </label>
              <input
                type="number"
                min={0}
                value={pendingTicketsCount}
                onChange={e => setPendingTicketsCount(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Lịch hẹn / Đơn chờ xử lý
              </label>
              <input
                type="number"
                min={0}
                value={unresolvedBookingsCount}
                onChange={e => setUnresolvedBookingsCount(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Tiền mặt quỹ quầy (VNĐ)
              </label>
              <input
                type="number"
                min={0}
                step={1000}
                value={cashInDrawer}
                onChange={e => setCashInDrawer(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Pending Tasks */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Nhiệm vụ tồn đọng cần bàn giao cho ca tiếp theo
            </label>
            <textarea
              rows={2}
              value={pendingTasks}
              onChange={e => setPendingTasks(e.target.value)}
              placeholder="Ghi rõ: khách hẹn nhận kho lúc mấy giờ, kho nào cần đối soát, việc phát sinh..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-normal outline-none focus:border-blue-500 focus:bg-white resize-none"
            />
          </div>

          {/* Facility Status Note */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Tình trạng an ninh, thiết bị &amp; PCCC cơ sở
            </label>
            <textarea
              rows={2}
              value={facilityStatusNote}
              onChange={e => setFacilityStatusNote(e.target.value)}
              placeholder="Ghi nhận hiện trạng cửa từ, cảm biến nhiệt ẩm, camera, hệ thống PCCC..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-normal outline-none focus:border-blue-500 focus:bg-white resize-none"
            />
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Ghi chú thêm
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Bàn giao chìa khóa vạn năng, biên bản kiểm kho số..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-normal outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          {/* Mandatory Checklist Confirmation */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl mt-1">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={checklistCompleted}
                onChange={e => setChecklistCompleted(e.target.checked)}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <span className="text-amber-900 text-xs font-semibold leading-relaxed">
                Tôi xác nhận đã hoàn tất đối soát số lượng buồng kho, két quỹ thu ngân, kiểm tra an toàn cơ sở và sẵn sàng chuyển giao ca trực theo đúng quy chuẩn Boxora.
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !checklistCompleted}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
              <span>Lưu biên bản bàn giao</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
