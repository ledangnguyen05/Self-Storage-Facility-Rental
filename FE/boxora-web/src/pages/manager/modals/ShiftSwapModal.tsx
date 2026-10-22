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

const formatDateLocal = (d: Date): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const formatDateVi = (dStr: string): string => {
  if (!dStr) return ''
  try {
    const parts = dStr.split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
  } catch {}
  return dStr
}

interface BusyPeerInfo {
  id: string
  fullName: string
  username: string
  email: string
  shift: string
  shiftLabel: string
  zone?: string
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
  const targetFacilityId = facilityId || assignment?.facilityId || user?.facilityId

  // 1. Date selection state (Defaults to assignment date or today, strictly >= today)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (assignment?.assignedDate && assignment.assignedDate >= todayStr) {
      return assignment.assignedDate
    }
    return todayStr
  })

  // 2. User's assignments state
  const [userAssignments, setUserAssignments] = useState<StaffAssignmentResponse[]>([])
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('')

  // 3. Candidates state for the selected date (free vs busy)
  const [freeStaff, setFreeStaff] = useState<User[]>([])
  const [busyStaff, setBusyStaff] = useState<BusyPeerInfo[]>([])
  const [selectedTargetId, setSelectedTargetId] = useState<string>('')
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)

  // 4. Form inputs
  const [reason, setReason] = useState('')
  const [isAgreed, setIsAgreed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Fetch current user's upcoming assignments (strictly >= todayStr)
  const fetchUserUpcomingAssignments = async () => {
    if (!user?.id || !targetFacilityId) return
    setIsLoadingAssignments(true)
    try {
      const res = await staffAssignmentService.getAllAssignments({
        staffId: user.id,
        facilityId: targetFacilityId,
        fromDate: todayStr,
        size: 100
      })
      const list = (res?.content || []).filter((a: StaffAssignmentResponse) =>
        a.assignedDate >= todayStr && a.status === 'ASSIGNED'
      )
      setUserAssignments(list)
    } catch {
      setUserAssignments([])
    } finally {
      setIsLoadingAssignments(false)
    }
  }

  // Load user assignments when modal opens
  useEffect(() => {
    if (isOpen) {
      setReason('')
      setIsAgreed(false)
      setErrorMessage(null)

      let initialDate = todayStr
      if (assignment?.assignedDate && assignment.assignedDate >= todayStr && assignment.status === 'ASSIGNED') {
        initialDate = assignment.assignedDate
        setSelectedAssignmentId(assignment.id)
      } else {
        setSelectedAssignmentId('')
      }
      setSelectedDate(initialDate)
      void fetchUserUpcomingAssignments()
    }
  }, [isOpen, assignment, targetFacilityId, todayStr])

  // Shifts of current user on selectedDate
  const myShiftsOnDate = useMemo(() => {
    return userAssignments.filter(a => a.assignedDate === selectedDate && a.status === 'ASSIGNED')
  }, [userAssignments, selectedDate])

  // Active assignment being swapped
  const activeAssignment = useMemo(() => {
    if (selectedAssignmentId) {
      const found = myShiftsOnDate.find(a => a.id === selectedAssignmentId)
      if (found) return found
    }
    return myShiftsOnDate[0] || null
  }, [selectedAssignmentId, myShiftsOnDate])

  // Update selectedAssignmentId when shifts on date change
  useEffect(() => {
    if (myShiftsOnDate.length > 0) {
      if (!selectedAssignmentId || !myShiftsOnDate.some(a => a.id === selectedAssignmentId)) {
        setSelectedAssignmentId(myShiftsOnDate[0].id)
      }
    } else {
      setSelectedAssignmentId('')
    }
  }, [myShiftsOnDate, selectedAssignmentId])

  // Distinct dates user has upcoming shifts for quick chips
  const userUpcomingDates = useMemo(() => {
    const dates = Array.from(new Set(userAssignments.map(a => a.assignedDate)))
    return dates.sort((a, b) => a.localeCompare(b))
  }, [userAssignments])

  // Handler for changing date
  const handleDateChange = (newDate: string) => {
    if (!newDate) return
    if (newDate < todayStr) {
      setErrorMessage('Không được tạo đổi ca ở những lịch trong quá khứ.')
      setSelectedDate(todayStr)
      return
    }
    setErrorMessage(null)
    setSelectedDate(newDate)
  }

  // Load candidate peers for selectedDate (grouped into Free vs Busy)
  useEffect(() => {
    if (isOpen && selectedDate && targetFacilityId) {
      void loadCandidateStaffForDate(selectedDate)
    }
  }, [isOpen, selectedDate, targetFacilityId, effectiveRole])

  const loadCandidateStaffForDate = async (date: string) => {
    setIsLoadingCandidates(true)
    setErrorMessage(null)
    try {
      // 1. Fetch all peers of role in facility
      const usersRes = await userService.getAllUsers({
        role: effectiveRole,
        facilityId: targetFacilityId,
        size: 100
      })
      const currentStaffId = activeAssignment?.staffId || user?.id
      const allPeers = (usersRes?.data || []).filter(u => u.id !== currentStaffId && u.id !== user?.id && Boolean(u.isActive))

      // 2. Fetch daily assignments on this date to know who is working
      const dailyRes = await staffAssignmentService.getDailyBoard(targetFacilityId, date)
      let dailyList: StaffAssignmentResponse[] = Array.isArray(dailyRes) ? dailyRes : []
      if (dailyList.length === 0) {
        const altRes = await staffAssignmentService.getAllAssignments({
          facilityId: targetFacilityId,
          assignedDate: date,
          size: 100
        })
        dailyList = altRes?.content || []
      }
      const activeDaily = dailyList.filter(a => a.status !== 'CANCELLED' && a.status !== 'ABSENT')

      // 3. Separate into free vs busy
      const free: User[] = []
      const busy: BusyPeerInfo[] = []

      for (const peer of allPeers) {
        const peerShift = activeDaily.find(a => a.staffId === peer.id)
        if (peerShift) {
          busy.push({
            id: peer.id,
            fullName: peer.fullName || peer.username,
            username: peer.username,
            email: peer.email,
            shift: peerShift.shift,
            shiftLabel: getShiftLabel(peerShift.shift),
            zone: peerShift.assignedZone
          })
        } else {
          free.push(peer)
        }
      }

      setFreeStaff(free)
      setBusyStaff(busy)

      // Auto-select first free staff if available, else first busy staff
      if (free.length > 0) {
        setSelectedTargetId(free[0].id)
      } else if (busy.length > 0) {
        setSelectedTargetId(busy[0].id)
      } else {
        setSelectedTargetId('')
      }
    } catch (err) {
      console.warn('Failed to load candidate staff for date:', err)
      setFreeStaff([])
      setBusyStaff([])
    } finally {
      setIsLoadingCandidates(false)
    }
  }

  // Selected candidate detail
  const selectedCandidateInfo = useMemo(() => {
    if (!selectedTargetId) return null
    const freeFound = freeStaff.find(s => s.id === selectedTargetId)
    if (freeFound) {
      return {
        id: freeFound.id,
        fullName: freeFound.fullName || freeFound.username,
        email: freeFound.email,
        isFree: true,
        shiftLabel: 'Chưa có ca',
        isSameShiftConflict: false
      }
    }
    const busyFound = busyStaff.find(s => s.id === selectedTargetId)
    if (busyFound) {
      const isSameShiftConflict = Boolean(activeAssignment && busyFound.shift === activeAssignment.shift)
      return {
        id: busyFound.id,
        fullName: busyFound.fullName,
        email: busyFound.email,
        isFree: false,
        shiftLabel: busyFound.shiftLabel,
        isSameShiftConflict
      }
    }
    return null
  }, [selectedTargetId, freeStaff, busyStaff, activeAssignment])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedDate < todayStr) {
      setErrorMessage('Không được tạo đổi ca ở những lịch trong quá khứ.')
      return
    }
    if (!activeAssignment) {
      setErrorMessage(`Bạn không có ca làm việc nào được phân công vào ngày ${formatDateVi(selectedDate)} để đổi.`)
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
    if (selectedCandidateInfo?.isSameShiftConflict) {
      setErrorMessage(`Đồng nghiệp đã có ca trực cùng khung giờ (${selectedCandidateInfo.shiftLabel}) vào ngày này. Không thể nhận trùng ca.`)
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

      const targetName = selectedCandidateInfo?.fullName || 'đồng nghiệp'
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

  const roleBadgeText = isManager ? 'Vai trò: Facility Manager' : 'Vai trò: Nhân viên'

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
                  : 'Quy tắc: Nhân viên chỉ đổi ca với Nhân viên cùng chi nhánh và gửi Quản lý duyệt'}
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

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          {/* BƯỚC 1: CHỌN NGÀY MUỐN ĐỔI CA */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-slate-700 font-bold">
                1. Chọn ngày muốn đổi ca <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] font-medium text-slate-400">
                Chỉ được đổi từ hôm nay ({formatDateVi(todayStr)}) trở đi
              </span>
            </div>

            <input
              type="date"
              min={todayStr}
              value={selectedDate}
              onChange={e => handleDateChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
            />

            {/* Quick shift date suggestions from upcoming assignments */}
            {userUpcomingDates.length > 0 && (
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-500 font-medium">Lịch trực sắp tới của bạn:</span>
                {userUpcomingDates.map(dStr => (
                  <button
                    key={dStr}
                    type="button"
                    onClick={() => handleDateChange(dStr)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                      selectedDate === dStr
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {formatDateVi(dStr)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ca trực của bạn vào ngày này */}
          {isLoadingAssignments ? (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              <span>Đang kiểm tra lịch ca trực của bạn...</span>
            </div>
          ) : myShiftsOnDate.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0 mt-0.5">event_busy</span>
              <div>
                <p className="font-bold">Bạn không có ca làm việc nào vào ngày {formatDateVi(selectedDate)}!</p>
                <p className="mt-1 text-[11px] text-amber-700 leading-relaxed">
                  Vui lòng chọn một ngày bạn có lịch trực (trạng thái Đã phân công) từ hôm nay trở đi để tạo yêu cầu đổi ca.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {myShiftsOnDate.length > 1 && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Chọn ca trực của bạn cần đổi <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedAssignmentId}
                    onChange={e => setSelectedAssignmentId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                  >
                    {myShiftsOnDate.map(a => (
                      <option key={a.id} value={a.id}>
                        {getShiftLabel(a.shift)} • {a.assignedZone || 'Khu vực cơ sở'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeAssignment && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Người trực ca hiện tại:</span>
                    <span className="font-bold text-slate-800">
                      {activeAssignment.staffFullName || user?.fullName || user?.username}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Khung giờ ca trực:</span>
                    <span className="font-semibold text-blue-700">{getShiftLabel(activeAssignment.shift)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Ngày trực:</span>
                    <span className="font-mono font-semibold text-slate-700">{formatDateVi(activeAssignment.assignedDate)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Phân khu đảm trách:</span>
                    <span className="text-slate-700">{activeAssignment.assignedZone || 'Chung tại cơ sở'}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BƯỚC 2: CHỌN ĐỒNG NGHIỆP TIẾP NHẬN (CÓ CA VS KHÔNG CÓ CA LÀM) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-slate-700 font-bold">
                2. {isManager ? 'Quản lý cơ sở tiếp nhận ca' : 'Nhân viên tiếp nhận ca'} <span className="text-rose-500">*</span>
              </label>
              {selectedDate && !isLoadingCandidates && (
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                    Rảnh: {freeStaff.length}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                    Đã có ca: {busyStaff.length}
                  </span>
                </div>
              )}
            </div>

            {isLoadingCandidates ? (
              <div className="text-slate-400 italic py-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                <span>Đang tra cứu lịch làm việc của nhân sự ngày {formatDateVi(selectedDate)}...</span>
              </div>
            ) : (freeStaff.length === 0 && busyStaff.length === 0) ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs italic">
                {isManager
                  ? 'Không tìm thấy Quản lý cơ sở nào khác cùng chi nhánh để đổi ca.'
                  : 'Không tìm thấy nhân viên nào khác cùng chi nhánh để đổi ca.'}
              </div>
            ) : (
              <select
                value={selectedTargetId}
                onChange={e => setSelectedTargetId(e.target.value)}
                disabled={!activeAssignment}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white cursor-pointer disabled:opacity-50"
              >
                <option value="">-- Chọn đồng nghiệp tiếp nhận ca trực --</option>
                {freeStaff.length > 0 && (
                  <optgroup label={`🟢 NHÂN VIÊN CHƯA CÓ CA LÀM NGÀY NÀY (Đang rảnh - Ưu tiên nhận: ${freeStaff.length} người)`}>
                    {freeStaff.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.fullName || s.username} ({s.email}) — [Chưa có ca / Rảnh]
                      </option>
                    ))}
                  </optgroup>
                )}
                {busyStaff.length > 0 && (
                  <optgroup label={`🟡 NHÂN VIÊN ĐÃ CÓ CA LÀM NGÀY NÀY (Đang bận ca trực: ${busyStaff.length} người)`}>
                    {busyStaff.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.fullName || s.username} ({s.email}) — [Đang trực: {s.shiftLabel}{s.zone ? ` • ${s.zone}` : ''}]
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}

            {/* Dynamic indicator badge for selected candidate */}
            {selectedCandidateInfo && (
              <div className="mt-2">
                {selectedCandidateInfo.isFree ? (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0">check_circle</span>
                    <span><strong>{selectedCandidateInfo.fullName}</strong> chưa có ca làm vào ngày {formatDateVi(selectedDate)}, sẵn sàng nhận ca thay thế bạn.</span>
                  </div>
                ) : selectedCandidateInfo.isSameShiftConflict ? (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0">cancel</span>
                    <span><strong>{selectedCandidateInfo.fullName}</strong> đã có ca làm cùng khung giờ ({selectedCandidateInfo.shiftLabel}) ngày {formatDateVi(selectedDate)}. Hệ thống không thể gán trùng ca.</span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0">info</span>
                    <span><strong>{selectedCandidateInfo.fullName}</strong> đã có ca trực ({selectedCandidateInfo.shiftLabel}) ngày này. Đồng nghiệp sẽ trực thêm ca hoặc cần thỏa thuận đổi chéo.</span>
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-slate-400 mt-1">
              {isManager
                ? 'ℹ️ Quy định: Quản lý cơ sở chỉ được đổi ca với Quản lý cơ sở cùng chi nhánh.'
                : 'ℹ️ Quy định: Nhân viên chỉ được đổi ca với Nhân viên cùng chi nhánh.'}
            </p>
          </div>

          {/* BƯỚC 3: LÝ DO ĐỔI CA */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              3. Lý do xin đổi ca <span className="text-rose-500">*</span>
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

          {/* Cam kết */}
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
              disabled={
                isSubmitting ||
                !activeAssignment ||
                !selectedTargetId ||
                Boolean(selectedCandidateInfo?.isSameShiftConflict) ||
                (freeStaff.length === 0 && busyStaff.length === 0) ||
                selectedDate < todayStr
              }
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
