import React, { useState, useEffect } from 'react'
import { userService } from '../../../services/userService'
import { staffAssignmentService, StaffAssignmentResponse } from '../../../services/staffAssignmentService'
import { User } from '../../../types'

interface ShiftSwapModalProps {
  isOpen: boolean
  onClose: () => void
  assignment: StaffAssignmentResponse
  facilityId?: string
  onSuccess: (msg: string) => void
}

export const ShiftSwapModal: React.FC<ShiftSwapModalProps> = ({
  isOpen,
  onClose,
  assignment,
  facilityId,
  onSuccess
}) => {
  const [candidateStaff, setCandidateStaff] = useState<User[]>([])
  const [selectedTargetId, setSelectedTargetId] = useState<string>('')
  const [reason, setReason] = useState('')
  const [isAgreed, setIsAgreed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadCandidates()
    }
  }, [isOpen, facilityId, assignment])

  const loadCandidates = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const res = await userService.getAllUsers({
        role: 'STAFF',
        facilityId: facilityId || assignment.facilityId,
        size: 50
      })
      const list = (res?.data || []).filter(u => u.id !== assignment.staffId)
      setCandidateStaff(list)
      if (list.length > 0) {
        setSelectedTargetId(list[0].id)
      } else {
        setSelectedTargetId('')
      }
    } catch {
      setErrorMessage('Không thể tải danh sách nhân sự thay thế.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTargetId) {
      setErrorMessage('Vui lòng chọn nhân viên tiếp nhận ca.')
      return
    }
    if (!reason.trim()) {
      setErrorMessage('Vui lòng nhập lý do xin đổi ca.')
      return
    }
    if (!isAgreed) {
      setErrorMessage('Vui lòng xác nhận đã trao đổi với đồng nghiệp tiếp nhận.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await staffAssignmentService.createSwapRequest({
        assignmentId: assignment.id,
        targetStaffId: selectedTargetId,
        reason: reason.trim()
      })

      const target = candidateStaff.find(s => s.id === selectedTargetId)
      const targetName = target?.fullName || target?.username || 'đồng nghiệp'
      onSuccess(`Đã gửi yêu cầu đổi ca sang nhân viên ${targetName}. Chờ Quản lý cơ sở phê duyệt!`)
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Không thể gửi yêu cầu đổi ca. Vui lòng kiểm tra lại.'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const shiftLabel =
    assignment.shift === 'MORNING'
      ? 'Ca Sáng (06:00 - 14:00)'
      : assignment.shift === 'AFTERNOON'
      ? 'Ca Chiều (14:00 - 22:00)'
      : assignment.shift === 'NIGHT'
      ? 'Ca Đêm (22:00 - 06:00)'
      : 'Cả Ngày (08:00 - 17:00)'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 text-left">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
              <span className="material-symbols-outlined text-[24px]">swap_horiz</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Yêu Cầu Đổi Ca Trực</h2>
              <p className="text-xs text-slate-500">Đề xuất đồng nghiệp trực thay &amp; gửi phê duyệt tới Quản lý</p>
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

        {/* Current Shift Summary Card */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Nhân sự hiện tại:</span>
            <span className="font-bold text-slate-800">{assignment.staffFullName || assignment.staffUsername}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Khung giờ ca:</span>
            <span className="font-semibold text-blue-700">{shiftLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Ngày trực:</span>
            <span className="font-mono font-semibold text-slate-700">{assignment.assignedDate}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Phân khu đảm trách:</span>
            <span className="text-slate-700">{assignment.assignedZone || 'Chung tại cơ sở'}</span>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Nhân viên tiếp nhận ca thay thế <span className="text-rose-500">*</span>
            </label>
            {isLoading ? (
              <div className="text-slate-400 italic py-2">Đang tải danh sách nhân sự...</div>
            ) : candidateStaff.length === 0 ? (
              <div className="text-amber-600 italic py-2">Không có nhân sự nào khác khả dụng tại cơ sở này.</div>
            ) : (
              <select
                value={selectedTargetId}
                onChange={e => setSelectedTargetId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
              >
                {candidateStaff.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.fullName || s.username} ({s.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Lý do xin đổi ca <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Nêu rõ lý do cần đổi ca (việc gia đình, sức khỏe, lịch đào tạo...)"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-normal outline-none focus:border-blue-500 focus:bg-white resize-none"
            />
          </div>

          <label className="flex items-start gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isAgreed}
              onChange={e => setIsAgreed(e.target.checked)}
              className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-slate-600 text-[11px] leading-tight">
              Tôi xác nhận đã trao đổi trước và được sự đồng thuận của đồng nghiệp tiếp nhận ca trực này.
            </span>
          </label>

          {/* Action buttons */}
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
              disabled={isSubmitting || candidateStaff.length === 0}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
              <span>Gửi yêu cầu đổi ca</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
