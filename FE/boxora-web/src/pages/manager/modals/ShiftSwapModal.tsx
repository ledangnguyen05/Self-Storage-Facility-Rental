import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { userService } from '../../../services/userService'
import { staffAssignmentService, StaffAssignmentResponse, isShiftAbsent, isShiftStarted } from '../../../services/staffAssignmentService'
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

const formatDateLocal = (d: Date): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const formatVN = (dateStr?: string | null): string => {
  if (!dateStr) return '—'
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dateStr
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
  const todayStr = useMemo(() => formatDateLocal(new Date()), [])

  // Business rule: STAFF only swaps with STAFF; FACILITY_MANAGER only swaps with FACILITY_MANAGER
  const effectiveRole: 'STAFF' | 'FACILITY_MANAGER' = useMemo(() => {
    if (targetRole) return targetRole
    const userRoleName = typeof user?.role === 'object' ? user?.role?.name : user?.role
    if (userRoleName === 'FACILITY_MANAGER') return 'FACILITY_MANAGER'
    return 'STAFF'
  }, [targetRole, user?.role])

  const isManager = effectiveRole === 'FACILITY_MANAGER'

  // Selected date to swap shift
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)
  const [userAssignments, setUserAssignments] = useState<StaffAssignmentResponse[]>([])
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('')

  // Candidates & Busy staff states
  const [candidateStaff, setCandidateStaff] = useState<User[]>([])
  const [facilityShiftsOnDate, setFacilityShiftsOnDate] = useState<StaffAssignmentResponse[]>([])
  const [selectedTargetId, setSelectedTargetId] = useState<string>('')
  const [reason, setReason] = useState('')
  const [isAgreed, setIsAgreed] = useState(false)
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false)
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Initialize modal state on open
  useEffect(() => {
    if (isOpen) {
      setReason('')
      setIsAgreed(false)
      setErrorMessage(null)

      const initialDate = assignment?.assignedDate || (availableAssignments.length > 0 ? availableAssignments[0].assignedDate : todayStr)
      setSelectedDate(initialDate)

      if (assignment) {
        setSelectedAssignmentId(assignment.id)
      } else if (availableAssignments.length > 0) {
        setSelectedAssignmentId(availableAssignments[0].id)
      } else {
        setSelectedAssignmentId('')
      }

      void fetchUserUpcomingAssignments()
    }
  }, [isOpen, assignment, availableAssignments, todayStr])

  // Fetch all upcoming swappable assignments of current user
  const fetchUserUpcomingAssignments = async () => {
    if (!user?.id) return
    setIsLoadingAssignments(true)
    try {
      const effFacility = facilityId || user.facilityId
      const res = await staffAssignmentService.getAllAssignments({
        staffId: user.id,
        facilityId: effFacility,
        fromDate: todayStr,
        size: 100
      })
      let list = (res?.content || []).filter(
        (a: StaffAssignmentResponse) => a.status === 'ASSIGNED' && !isShiftAbsent(a) && !isShiftStarted(a)
      )

      // Merge with passed assignment or availableAssignments if any
      if (assignment && !list.some((a: StaffAssignmentResponse) => a.id === assignment.id)) {
        list = [assignment, ...list]
      }
      availableAssignments.forEach(a => {
        if (!list.some((existing: StaffAssignmentResponse) => existing.id === a.id)) {
          list.push(a)
        }
      })

      setUserAssignments(list)

      // If no assignment was previously selected, default to first on selected date
      const onDate = list.filter((a: StaffAssignmentResponse) => a.assignedDate === selectedDate)
      if (onDate.length > 0) {
        setSelectedAssignmentId(onDate[0].id)
      }
    } catch {
      // Fallback to local assignments
      const fallbackList = assignment ? [assignment] : availableAssignments
      setUserAssignments(fallbackList)
    } finally {
      setIsLoadingAssignments(false)
    }
  }

  // Swappable shifts of current user on the chosen selectedDate
  const shiftsOnDate = useMemo(() => {
    return userAssignments.filter(
      a => a.assignedDate === selectedDate && a.status === 'ASSIGNED' && !isShiftAbsent(a) && !isShiftStarted(a)
    )
  }, [userAssignments, selectedDate])

  // Distinct dates where user has available shifts
  const userShiftDates = useMemo(() => {
    const dates = Array.from(new Set(userAssignments.map(a => a.assignedDate))).filter(Boolean) as string[]
    return dates.sort()
  }, [userAssignments])

  // Active assignment being swapped
  const activeAssignment = useMemo(() => {
    if (selectedAssignmentId) {
      const found = shiftsOnDate.find(a => a.id === selectedAssignmentId)
      if (found) return found
    }
    return shiftsOnDate[0] || null
  }, [selectedAssignmentId, shiftsOnDate])

  // When selectedDate changes, adjust selectedAssignmentId
  useEffect(() => {
    if (shiftsOnDate.length > 0) {
      if (!shiftsOnDate.some(a => a.id === selectedAssignmentId)) {
        setSelectedAssignmentId(shiftsOnDate[0].id)
      }
    } else {
      setSelectedAssignmentId('')
    }
  }, [shiftsOnDate, selectedAssignmentId])

  // Load candidate peers and facility shifts on selected date to check conflicts
  const loadCandidatesAndConflicts = useCallback(async () => {
    if (!activeAssignment || !isOpen) return
    setIsLoadingCandidates(true)
    setErrorMessage(null)
    try {
      const targetFacilityId = facilityId || activeAssignment.facilityId || user?.facilityId

      // 1. Fetch peers of the same role in this facility
      const peerRes = await userService.getAllUsers({
        role: effectiveRole,
        facilityId: targetFacilityId,
        size: 100
      })
      const currentStaffId = activeAssignment.staffId || user?.id
      const peers = (peerRes?.data || []).filter(u => u.id !== currentStaffId && u.id !== user?.id && u.isActive !== false)
      setCandidateStaff(peers)

      // 2. Fetch all assignments in the facility on activeAssignment's date to find conflicts
      const facilityShiftsRes = await staffAssignmentService.getAllAssignments({
        facilityId: targetFacilityId,
        fromDate: activeAssignment.assignedDate,
        toDate: activeAssignment.assignedDate,
        size: 100
      })
      const fShifts = (facilityShiftsRes?.content || []).filter(
        (a: StaffAssignmentResponse) => a.status !== 'CANCELLED'
      )
      setFacilityShiftsOnDate(fShifts)
    } catch {
      setErrorMessage(
        isManager
          ? 'Không thể tải danh sách Quản lý cơ sở tiếp nhận.'
          : 'Không thể tải danh sách nhân viên tiếp nhận.'
      )
    } finally {
      setIsLoadingCandidates(false)
    }
  }, [activeAssignment, isOpen, facilityId, user?.facilityId, user?.id, effectiveRole, isManager])

  useEffect(() => {
    if (activeAssignment) {
      void loadCandidatesAndConflicts()
    }
  }, [activeAssignment, loadCandidatesAndConflicts])

  // Check peer availability: A peer is busy if they already have an assignment on this date & shift slot
  const { availableCandidates, busyCandidates } = useMemo(() => {
    if (!activeAssignment) return { availableCandidates: [], busyCandidates: [] }

    const busyStaffIds = new Set(
      facilityShiftsOnDate
        .filter(a => a.shift === activeAssignment.shift)
        .map(a => a.staffId)
    )

    const available: User[] = []
    const busy: User[] = []

    candidateStaff.forEach(peer => {
      if (busyStaffIds.has(peer.id)) {
        busy.push(peer)
      } else {
        available.push(peer)
      }
    })

    return { availableCandidates: available, busyCandidates: busy }
  }, [activeAssignment, facilityShiftsOnDate, candidateStaff])

  // Auto-select first available candidate
  useEffect(() => {
    if (availableCandidates.length > 0) {
      if (!availableCandidates.some(c => c.id === selectedTargetId)) {
        setSelectedTargetId(availableCandidates[0].id)
      }
    } else {
      setSelectedTargetId('')
    }
  }, [availableCandidates, selectedTargetId])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!activeAssignment) {
      setErrorMessage('Vui lòng chọn ca làm việc hợp lệ cần đổi.')
      return
    }
    if (!selectedTargetId) {
      setErrorMessage(
        isManager
          ? 'Không có Quản lý cơ sở khả dụng để nhận ca này.'
          : 'Không có nhân viên khả dụng để nhận ca này.'
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

      const target = availableCandidates.find(s => s.id === selectedTargetId)
      const targetName = target?.fullName || target?.username || 'đồng nghiệp'
      onSuccess(
        isManager
          ? `Đã gửi yêu cầu đổi ca sang Quản lý cơ sở ${targetName}. Chờ Business Manager xem xét phê duyệt!`
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

        {/* 1. DATE SELECTION */}
        <div>
          <label className="block text-slate-700 font-bold text-xs mb-1">
            Chọn ngày muốn đổi ca trực <span className="text-rose-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              min={todayStr}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
            />
          </div>

          {/* Quick shortcuts for user's upcoming shift dates */}
          {userShiftDates.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 font-medium">Ngày bạn có ca trực:</span>
              {userShiftDates.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDate(d)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    selectedDate === d
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {formatVN(d)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2. NOTICE IF NO SHIFTS ON SELECTED DATE */}
        {shiftsOnDate.length === 0 && !isLoadingAssignments && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[20px] shrink-0 text-amber-600">event_busy</span>
            <div>
              <p className="font-bold">Không có ca làm việc trong ngày {formatVN(selectedDate)}</p>
              <p className="mt-1 text-amber-700">
                Bạn không được phân công ca trực nào trong ngày này để xin đổi ca. Vui lòng chọn một ngày khác mà bạn có ca trực sắp tới.
              </p>
            </div>
          </div>
        )}

        {/* 3. SHIFT SELECTION IF MULTIPLE SHIFTS ON THAT DATE */}
        {shiftsOnDate.length > 1 && (
          <div>
            <label className="block text-slate-700 font-bold text-xs mb-1">
              Chọn ca trực trong ngày {formatVN(selectedDate)} cần đổi <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedAssignmentId}
              onChange={e => setSelectedAssignmentId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
            >
              {shiftsOnDate.map(a => (
                <option key={a.id} value={a.id}>
                  {getShiftLabel(a.shift)} • {a.assignedZone || 'Khu vực cơ sở'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 4. CURRENT SHIFT SUMMARY CARD */}
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
              <span className="font-mono font-semibold text-slate-700">{formatVN(activeAssignment.assignedDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Phân khu đảm trách:</span>
              <span className="text-slate-700">{activeAssignment.assignedZone || 'Chung tại cơ sở'}</span>
            </div>
          </div>
        )}

        {/* Error message banner */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form fields only active if there is an active shift */}
        {activeAssignment && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-xs">
            {/* 5. TARGET STAFF SELECTION WITH CONFLICT VALIDATION */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                {isManager
                  ? 'Quản lý cơ sở tiếp nhận ca thay thế (Facility Manager)'
                  : 'Nhân viên tiếp nhận ca thay thế (Staff)'}{' '}
                <span className="text-rose-500">*</span>
              </label>

              {isLoadingCandidates ? (
                <div className="text-slate-400 italic py-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                  <span>Đang kiểm tra lịch trực của các {isManager ? 'Quản lý' : 'nhân viên'}...</span>
                </div>
              ) : availableCandidates.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col gap-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800">
                    <span className="material-symbols-outlined text-[18px] text-amber-600">block</span>
                    <span>Không có {isManager ? 'Quản lý cơ sở' : 'nhân viên'} nào khả dụng để nhận ca này!</span>
                  </div>
                  {busyCandidates.length > 0 ? (
                    <p className="text-[11px] text-amber-700">
                      Tất cả {isManager ? 'Quản lý cơ sở' : 'nhân viên'} khác tại chi nhánh đã có ca trực vào khung giờ <strong>{getShiftLabel(activeAssignment.shift)} ngày {formatVN(activeAssignment.assignedDate)}</strong> ({busyCandidates.map(c => c.fullName || c.username).join(', ')}).
                    </p>
                  ) : (
                    <p className="text-[11px] text-amber-700">
                      Chi nhánh hiện không có nhân sự cùng vai trò ({isManager ? 'Facility Manager' : 'Staff'}) nào khác để thực hiện đổi ca.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <select
                    value={selectedTargetId}
                    onChange={e => setSelectedTargetId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                  >
                    {availableCandidates.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.fullName || s.username} ({s.email}) — [Trống lịch, sẵn sàng nhận ca]
                      </option>
                    ))}
                  </select>

                  {/* Note about busy staff excluded */}
                  {busyCandidates.length > 0 && (
                    <p className="text-[11px] text-slate-400 mt-1 italic">
                      * Đã loại trừ {busyCandidates.length} nhân sự đã có lịch trực vào khung giờ này ({busyCandidates.map(c => c.fullName || c.username).join(', ')}).
                    </p>
                  )}
                </>
              )}

              <p className="text-[11px] text-slate-400 mt-1">
                {isManager
                  ? 'ℹ️ Quy định: Quản lý cơ sở chỉ được đổi ca với Quản lý cơ sở cùng chi nhánh (Facility Manager đổi với Facility Manager).'
                  : 'ℹ️ Quy định: Nhân viên chỉ được đổi ca với Nhân viên cùng chi nhánh (Staff đổi với Staff).'}
              </p>
            </div>

            {/* 6. REASON */}
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

            {/* 7. AGREEMENT CHECKBOX */}
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

            {/* 8. ACTION BUTTONS */}
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
                disabled={isSubmitting || availableCandidates.length === 0 || !activeAssignment}
                className={`px-4 py-2 font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-white ${
                  isManager ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {isSubmitting && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                <span>Gửi yêu cầu đổi ca</span>
              </button>
            </div>
          </form>
        )}

        {/* If no active assignment, provide close button */}
        {!activeAssignment && (
          <div className="flex items-center justify-end pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
