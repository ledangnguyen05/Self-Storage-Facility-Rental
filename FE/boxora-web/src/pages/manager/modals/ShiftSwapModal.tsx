import React, { useState, useEffect, useMemo } from 'react'
import { userService } from '../../../services/userService'
import { staffAssignmentService, StaffAssignmentResponse } from '../../../services/staffAssignmentService'
import { useAuth } from '../../../context/AuthContext'
import { User } from '../../../types'

export interface ShiftSwapModalProps {
  isOpen: boolean
  onClose: () => void
  assignment?: StaffAssignmentResponse | null
  facilityId?: string
  targetRole?: 'STAFF' | 'FACILITY_MANAGER'
  availableAssignments?: StaffAssignmentResponse[]
  onSuccess: (msg: string) => void
}

const getShiftLabel = (shift?: string) => {
  if (shift === 'MORNING') return 'Ca Sáng (06:00 - 14:00)'
  if (shift === 'AFTERNOON') return 'Ca Chiều (14:00 - 22:00)'
  if (shift === 'NIGHT') return 'Ca Đêm (22:00 - 06:00)'
  return 'Cả Ngày (08:00 - 17:00)'
}

export const ShiftSwapModal: React.FC<ShiftSwapModalProps> = ({
  isOpen,
  onClose,
  assignment,
  facilityId,
  targetRole,
  availableAssignments = [],
  onSuccess
}) => {
  const { user } = useAuth()

  // Business rule: STAFF only swaps with STAFF; FACILITY_MANAGER only swaps with FACILITY_MANAGER
  const effectiveRole: 'STAFF' | 'FACILITY_MANAGER' = useMemo(() => {
    if (targetRole) return targetRole
    const userRoleName = typeof user?.role === 'object' ? user?.role?.name : user?.role
    if (userRoleName === 'FACILITY_MANAGER') return 'FACILITY_MANAGER'
    return 'STAFF'
  }, [targetRole, user?.role])

  const isManager = effectiveRole === 'FACILITY_MANAGER'

  // Filter swappable assignments (only upcoming / active assignments)
  const validAssignments = useMemo(() => {
    const list = assignment ? [assignment] : availableAssignments
    return list.filter(a => a.status !== 'COMPLETED' && a.status !== 'CANCELLED')
  }, [assignment, availableAssignments])

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('')
  const [candidateStaff, setCandidateStaff] = useState<User[]>([])
  const [selectedTargetId, setSelectedTargetId] = useState<string>('')
  const [reason, setReason] = useState('')
  const [isAgreed, setIsAgreed] = useState(false)
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false)
  const [fetchedUserAssignments, setFetchedUserAssignments] = useState<StaffAssignmentResponse[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Determine current active assignment
  const allAvailableAssignments = useMemo(() => {
    if (validAssignments.length > 0) return validAssignments
    return fetchedUserAssignments
  }, [validAssignments, fetchedUserAssignments])

  const activeAssignment = useMemo(() => {
    if (selectedAssignmentId) {
      const found = allAvailableAssignments.find(a => a.id === selectedAssignmentId)
      if (found) return found
    }
    return allAvailableAssignments[0] || null
  }, [selectedAssignmentId, allAvailableAssignments])

  // Reset or initialize when modal opens
  useEffect(() => {
    if (isOpen) {
      setReason('')
      setIsAgreed(false)
      setErrorMessage(null)

      if (assignment) {
        setSelectedAssignmentId(assignment.id)
      } else if (availableAssignments.length > 0) {
        const first = availableAssignments.find(a => a.status !== 'COMPLETED' && a.status !== 'CANCELLED')
        setSelectedAssignmentId(first ? first.id : '')
      } else {
        setSelectedAssignmentId('')
        // Try fetching current user's assignments
        void fetchUserUpcomingAssignments()
      }
    }
  }, [isOpen, assignment, availableAssignments])

  const fetchUserUpcomingAssignments = async () => {
    if (!user?.id) return
    setIsLoadingAssignments(true)
    try {
      const effFacility = facilityId || user.facilityId
      const res = await staffAssignmentService.getAllAssignments({
        staffId: user.id,
        facilityId: effFacility,
        size: 50
      })
      const list = (res?.content || []).filter((a: StaffAssignmentResponse) => a.status !== 'COMPLETED' && a.status !== 'CANCELLED')
      setFetchedUserAssignments(list)
      if (list.length > 0) {
        setSelectedAssignmentId(list[0].id)
      }
    } catch {
      // Ignored
    } finally {
      setIsLoadingAssignments(false)
    }
  }

  // Load candidate peers (strictly filtered by role: STAFF -> STAFF, FACILITY_MANAGER -> FACILITY_MANAGER)
  useEffect(() => {
    if (isOpen) {
      void loadCandidates()
    }
  }, [isOpen, facilityId, activeAssignment, effectiveRole])

  const loadCandidates = async () => {
    setIsLoadingCandidates(true)
    setErrorMessage(null)
    try {
      const targetFacilityId = facilityId || activeAssignment?.facilityId || user?.facilityId
      const res = await userService.getAllUsers({
        role: effectiveRole,
        facilityId: targetFacilityId,
        size: 50
      })

      // Exclude current user and current assignment's owner
      const currentStaffId = activeAssignment?.staffId || user?.id
      const list = (res?.data || []).filter(u => u.id !== currentStaffId && u.id !== user?.id)
      setCandidateStaff(list)
      if (list.length > 0) {
        setSelectedTargetId(list[0].id)
      } else {
        setSelectedTargetId('')
      }
    } catch {
      setErrorMessage(
        isManager
          ? 'Không thể tải danh sách Quản lý cơ sở tiếp nhận.'
          : 'Không thể tải danh sách nhân viên tiếp nhận.'
      )
    } finally {
      setIsLoadingCandidates(false)
    }
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!activeAssignment) {
      setErrorMessage('Vui lòng chọn ca làm việc cần đổi.')
      return
    }
    if (!selectedTargetId) {
      setErrorMessage(
        isManager
          ? 'Vui lòng chọn Quản lý cơ sở tiếp nhận ca.'
          : 'Vui lòng chọn nhân viên tiếp nhận ca.'
      )
      return
    }
    if (!reason.trim()) {
      setErrorMessage('Vui lòng nhập lý do xin đổi ca.')
      return
    }
    if (!isAgreed) {
      setErrorMessage(
        isManager
          ? 'Vui lòng xác nhận đề xuất đổi ca với Quản lý cơ sở.'
          : 'Vui lòng xác nhận quy trình gửi Quản lý phê duyệt.'
      )
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await staffAssignmentService.createSwapRequest({
        assignmentId: activeAssignment.id,
        targetStaffId: selectedTargetId,
        reason: reason.trim()
      })

      const target = candidateStaff.find(s => s.id === selectedTargetId)
      const targetName = target?.fullName || target?.username || 'đồng nghiệp'
      onSuccess(
        isManager
          ? `Đã gửi yêu cầu đổi ca sang Quản lý cơ sở ${targetName}. Đang chờ đối ứng và hệ thống xử lý!`
          : `Đã gửi yêu cầu đổi ca sang nhân viên ${targetName}. Đang gửi tới Quản lý cơ sở phê duyệt trước khi chuyển tiếp cho đồng nghiệp!`
      )
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Không thể gửi yêu cầu đổi ca. Vui lòng kiểm tra lại.'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const roleBadgeText = isManager ? 'Vai trò: Facility Manager' : 'Vai trò: Staff'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 text-left max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${isManager ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
              <span className="material-symbols-outlined text-[24px]">swap_horiz</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {isManager ? 'Xin Đổi Ca Trực (Quản Lý Cơ Sở)' : 'Xin Đổi Ca Trực (Nhân Viên)'}
                </h2>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isManager ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'}`}>
                  {roleBadgeText}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isManager
                  ? 'Quy tắc: Facility Manager chỉ đổi ca với Facility Manager cùng chi nhánh'
                  : 'Quy tắc: Staff chỉ đổi ca với Staff cùng chi nhánh và gửi Quản lý duyệt'}
              </p>
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

        {/* Warning if no valid assignment */}
        {!activeAssignment && !isLoadingAssignments && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[20px] shrink-0 text-amber-600">warning</span>
            <div>
              <p className="font-bold">Không tìm thấy ca trực khả dụng để xin đổi!</p>
              <p className="mt-1">
                Bạn hiện chưa có ca trực nào được phân công hoặc các ca hiện có đã hoàn thành/hủy. Vui lòng phân công ca trực trước khi thực hiện đổi ca.
              </p>
            </div>
          </div>
        )}

        {/* Assignment Selection if multiple are available */}
        {allAvailableAssignments.length > 1 && (
          <div>
            <label className="block text-slate-700 font-bold text-xs mb-1">
              Chọn ca trực cần xin đổi <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedAssignmentId}
              onChange={e => setSelectedAssignmentId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
            >
              {allAvailableAssignments.map(a => (
                <option key={a.id} value={a.id}>
                  {getShiftLabel(a.shift)} • {a.assignedDate} • {a.assignedZone || 'Khu vực cơ sở'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Current Shift Summary Card */}
        {activeAssignment && (
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Người trực ca hiện tại:</span>
              <span className="font-bold text-slate-800">
                {activeAssignment.staffFullName || activeAssignment.staffUsername || user?.fullName || user?.username}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Khung giờ ca trực:</span>
              <span className="font-semibold text-blue-700">{getShiftLabel(activeAssignment.shift)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Ngày trực:</span>
              <span className="font-mono font-semibold text-slate-700">{activeAssignment.assignedDate}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Phân khu đảm trách:</span>
              <span className="text-slate-700">{activeAssignment.assignedZone || 'Chung tại cơ sở'}</span>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              {isManager
                ? 'Quản lý cơ sở tiếp nhận ca thay thế (Facility Manager)'
                : 'Nhân viên tiếp nhận ca thay thế (Staff)'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            {isLoadingCandidates ? (
              <div className="text-slate-400 italic py-2">Đang tải danh sách nhân sự {isManager ? 'quản lý' : 'nhân viên'}...</div>
            ) : candidateStaff.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs italic">
                {isManager
                  ? 'Không tìm thấy Quản lý cơ sở nào khác cùng chi nhánh để đổi ca.'
                  : 'Không tìm thấy nhân viên nào khác cùng chi nhánh để đổi ca.'}
              </div>
            ) : (
              <select
                value={selectedTargetId}
                onChange={e => setSelectedTargetId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
              >
                {candidateStaff.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.fullName || s.username} ({s.email}) — [{isManager ? 'Facility Manager' : 'Staff'}]
                  </option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              {isManager
                ? 'ℹ️ Quy định: Quản lý cơ sở chỉ được đổi ca với Quản lý cơ sở cùng chi nhánh.'
                : 'ℹ️ Quy định: Nhân viên chỉ được đổi ca với Nhân viên cùng chi nhánh.'}
            </p>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Lý do xin đổi ca <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={
                isManager
                  ? 'Nêu rõ lý do cần đổi ca quản lý cơ sở (lịch họp ban giám đốc, đào tạo, việc cá nhân...)'
                  : 'Nêu rõ lý do cần đổi ca (việc gia đình, sức khỏe, lịch đào tạo...)'
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-normal outline-none focus:border-blue-500 focus:bg-white resize-none"
            />
          </div>

          <label className="flex items-start gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isAgreed}
              onChange={e => setIsAgreed(e.target.checked)}
              className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-slate-600 text-[11px] leading-tight">
              {isManager
                ? 'Tôi xác nhận đề xuất đổi ca này với Quản lý cơ sở đồng nghiệp cùng chi nhánh và chịu trách nhiệm về bàn giao công việc.'
                : 'Tôi xác nhận gửi yêu cầu này tới Quản lý cơ sở phê duyệt trước. Khi Quản lý đồng ý, hệ thống sẽ tự động chuyển tiếp tới đồng nghiệp tiếp nhận.'}
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
              disabled={isSubmitting || candidateStaff.length === 0 || !activeAssignment}
              className={`px-4 py-2 font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-white ${
                isManager ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-600 hover:bg-amber-700'
              }`}
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
