import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { userService } from '../../../services/userService'
import { staffAssignmentService, StaffAssignmentResponse } from '../../../services/staffAssignmentService'
import { useAuth } from '../../../context/AuthContext'
import { User, Facility } from '../../../types'
import { STANDARD_SHIFTS_LIST, isShiftInPast, getFirstAvailableShiftForDate } from '../../../constants/shiftConstants'

interface ShiftAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  facilityId?: string
  facilities?: Facility[]
  targetRole?: 'STAFF' | 'FACILITY_MANAGER'
  onSaveShift: (summary: string) => void
}

const formatDateLocal = (d: Date): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const ShiftAssignmentModal: React.FC<ShiftAssignmentModalProps> = ({
  isOpen,
  onClose,
  facilityId,
  facilities = [],
  targetRole,
  onSaveShift
}) => {
  const { user } = useAuth()
  const userRole = (typeof user?.role === 'object' ? user?.role?.name : user?.role) || user?.roleName
  const isBusinessManager = userRole === 'BUSINESS_MANAGER'
  const activeTargetRole: 'STAFF' | 'FACILITY_MANAGER' = targetRole || (isBusinessManager ? 'FACILITY_MANAGER' : 'STAFF')

  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(facilityId || '')
  const [staffList, setStaffList] = useState<User[]>([])
  const [isLoadingStaff, setIsLoadingStaff] = useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [shiftType, setShiftType] = useState<'MORNING' | 'AFTERNOON' | 'NIGHT'>(() => getFirstAvailableShiftForDate(formatDateLocal(new Date())) || 'AFTERNOON')
  const [targetZone, setTargetZone] = useState('Phân khu A (Hành lang Aisle North)')
  const [assignmentDate, setAssignmentDate] = useState(() => formatDateLocal(new Date()))
  const [taskNotes, setTaskNotes] = useState(
    activeTargetRole === 'FACILITY_MANAGER'
      ? 'Trực điều hành cơ sở, giám sát an ninh, phê duyệt đổi ca và kiểm tra vận hành hệ thống.'
      : 'Tuần tra định kỳ 2 giờ/lần, kiểm tra pin SmartLock các kho nợ quá hạn và hỗ trợ khách bàn giao.'
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Danh sách các ca trực đã phân công trong ngày của cơ sở và nhân sự được chọn
  const [facilityDayAssignments, setFacilityDayAssignments] = useState<StaffAssignmentResponse[]>([])
  const [staffAssignedShifts, setStaffAssignedShifts] = useState<StaffAssignmentResponse[]>([])
  const [isLoadingExistingShifts, setIsLoadingExistingShifts] = useState(false)

  useEffect(() => {
    if (facilityId) {
      setSelectedFacilityId(facilityId)
    } else if (facilities.length > 0 && !selectedFacilityId) {
      setSelectedFacilityId(facilities[0].id)
    }
  }, [facilityId, facilities])

  useEffect(() => {
    if (isOpen) {
      const todayLocal = formatDateLocal(new Date())
      const nextDate = assignmentDate < todayLocal ? todayLocal : assignmentDate
      if (nextDate !== assignmentDate) {
        setAssignmentDate(nextDate)
      }
      if (isShiftInPast(nextDate, shiftType)) {
        const avail = getFirstAvailableShiftForDate(nextDate)
        if (avail) setShiftType(avail)
      }
      loadStaff()
    }
  }, [isOpen, selectedFacilityId, activeTargetRole])

  useEffect(() => {
    if (assignmentDate && isShiftInPast(assignmentDate, shiftType)) {
      const avail = getFirstAvailableShiftForDate(assignmentDate)
      if (avail) setShiftType(avail)
    }
  }, [assignmentDate])

  // Xóa thông báo lỗi cũ khi chuyển người hoặc đổi ca/ngày
  useEffect(() => {
    setErrorMessage(null)
  }, [selectedStaffId, shiftType, assignmentDate])

  const loadStaff = async () => {
    setIsLoadingStaff(true)
    setErrorMessage(null)
    try {
      const res = await userService.getAllUsers({
        role: activeTargetRole,
        facilityId: selectedFacilityId || undefined,
        size: 50
      })
      let users = res?.data || []

      // Quản lý cơ sở không được tự phân ca cho chính mình
      if (userRole === 'FACILITY_MANAGER') {
        users = users.filter(u => u.id !== user?.id)
      }

      setStaffList(users)
      if (users.length > 0) {
        setSelectedStaffId(prev => (users.some(u => u.id === prev) ? prev : users[0].id))
      } else {
        setSelectedStaffId('')
      }
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Không thể tải danh sách nhân sự từ hệ thống.')
    } finally {
      setIsLoadingStaff(false)
    }
  }

  // Tải danh sách phân ca trong ngày của cơ sở để hiển thị huy hiệu trên thẻ nhân viên
  const loadDayAssignments = useCallback(async (facId?: string, dateStr?: string) => {
    if (!dateStr) return
    try {
      const res = await staffAssignmentService.getAllAssignments({
        facilityId: facId || undefined,
        assignedDate: dateStr,
        size: 100
      })
      const list = res?.content || (Array.isArray(res) ? res : [])
      setFacilityDayAssignments(list.filter((a: StaffAssignmentResponse) => a.status !== 'CANCELLED'))
    } catch (err) {
      console.warn('Failed to load facility day assignments:', err)
      setFacilityDayAssignments([])
    }
  }, [])

  // Tải chi tiết các ca trực đã phân công của nhân viên được chọn trên ngày này
  const loadSelectedStaffShifts = useCallback(async (staffId?: string, dateStr?: string) => {
    if (!staffId || !dateStr) {
      setStaffAssignedShifts([])
      return
    }
    setIsLoadingExistingShifts(true)
    try {
      const res = await staffAssignmentService.getAllAssignments({
        staffId: staffId,
        assignedDate: dateStr,
        size: 50
      })
      const list = res?.content || (Array.isArray(res) ? res : [])
      setStaffAssignedShifts(list.filter((a: StaffAssignmentResponse) => a.status !== 'CANCELLED'))
    } catch (err) {
      console.warn('Failed to load staff assigned shifts:', err)
      setStaffAssignedShifts([])
    } finally {
      setIsLoadingExistingShifts(false)
    }
  }, [])

  // Tự động tải lại lịch trực khi mở modal hoặc thay đổi cơ sở / ngày trực
  useEffect(() => {
    if (isOpen && assignmentDate) {
      loadDayAssignments(selectedFacilityId, assignmentDate)
    }
  }, [isOpen, selectedFacilityId, assignmentDate, loadDayAssignments])

  // Tải lịch ca của nhân viên được chọn
  useEffect(() => {
    if (isOpen && selectedStaffId && assignmentDate) {
      loadSelectedStaffShifts(selectedStaffId, assignmentDate)
    } else {
      setStaffAssignedShifts([])
    }
  }, [isOpen, selectedStaffId, assignmentDate, loadSelectedStaffShifts])

  // Tổng hợp các ca mà nhân viên đã được phân công trên ngày này (bao gồm cả cùng cơ sở hoặc cơ sở khác)
  const assignedShiftTypes = useMemo(() => {
    const set = new Set<string>()
    staffAssignedShifts.forEach(a => {
      if (a.shift) set.add(a.shift)
    })
    facilityDayAssignments
      .filter(a => a.staffId === selectedStaffId)
      .forEach(a => {
        if (a.shift) set.add(a.shift)
      })
    return set
  }, [staffAssignedShifts, facilityDayAssignments, selectedStaffId])

  // Kiểm tra xem tất cả các ca trong ngày đã kín hoặc đã qua giờ chưa
  const isAllShiftsUnavailable = useMemo(() => {
    return STANDARD_SHIFTS_LIST.every(s =>
      isShiftInPast(assignmentDate, s.type) || assignedShiftTypes.has(s.type)
    )
  }, [assignmentDate, assignedShiftTypes])

  // Tự động chuyển lựa chọn sang ca khả dụng nếu ca hiện tại đã được phân hoặc đã qua giờ
  useEffect(() => {
    const isCurrentAssigned = assignedShiftTypes.has(shiftType)
    const isCurrentPast = isShiftInPast(assignmentDate, shiftType)
    if (isCurrentAssigned || isCurrentPast) {
      const nextAvailable = STANDARD_SHIFTS_LIST.find(
        s => !isShiftInPast(assignmentDate, s.type) && !assignedShiftTypes.has(s.type)
      )
      if (nextAvailable) {
        setShiftType(nextAvailable.type as 'MORNING' | 'AFTERNOON' | 'NIGHT')
      }
    }
  }, [assignedShiftTypes, assignmentDate, shiftType])

  if (!isOpen) return null

  const selectedStaffObj = staffList.find(s => s.id === selectedStaffId)
  const selectedStaffDisplayName = selectedStaffObj?.fullName || selectedStaffObj?.username || 'Nhân sự'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStaffId) {
      setErrorMessage(`Vui lòng chọn ${activeTargetRole === 'FACILITY_MANAGER' ? 'Quản lý cơ sở' : 'nhân viên'} trực ca.`)
      return
    }

    const effectiveFacId = selectedFacilityId || facilityId
    if (!effectiveFacId) {
      setErrorMessage('Vui lòng chọn cơ sở áp dụng.')
      return
    }
    const todayLocal = formatDateLocal(new Date())
    if (!assignmentDate || assignmentDate < todayLocal) {
      setErrorMessage('Không thể phân công ca trực cho ngày trong quá khứ. Chỉ phân được từ ngày hôm nay trở đi.')
      return
    }
    if (isShiftInPast(assignmentDate, shiftType)) {
      setErrorMessage('Khung giờ ca trực đã chọn đã trôi qua. Chỉ được phân ca cho thời gian hiện tại đến tương lai.')
      return
    }

    // Validate chủ động phía client: không cho phép phân công ca đã có
    if (assignedShiftTypes.has(shiftType)) {
      setErrorMessage(`Nhân viên đã được phân công ca trực vào thời gian này. Vui lòng chọn ca trực khác.`)
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const shiftLabel = shiftType === 'MORNING' ? 'Ca Sáng (06:00 - 14:00)' : shiftType === 'AFTERNOON' ? 'Ca Chiều (14:00 - 22:00)' : 'Ca Đêm (22:00 - 06:00)'

      await staffAssignmentService.createAssignment({
        staffId: selectedStaffId,
        facilityId: effectiveFacId,
        assignedDate: assignmentDate,
        shift: shiftType,
        assignedZone: targetZone,
        roleInShift: activeTargetRole === 'FACILITY_MANAGER' ? 'FACILITY_LEAD' : 'PRIMARY_STAFF',
        notes: taskNotes
      })

      onSaveShift(`Đã phân công ${selectedStaffDisplayName} (${activeTargetRole}) trực ${shiftLabel} tại ${targetZone}!`)
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Lỗi khi lưu phân công ca trực vào cơ sở dữ liệu.'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-800">
              <span className="material-symbols-outlined text-[26px]">
                {activeTargetRole === 'FACILITY_MANAGER' ? 'manage_accounts' : 'person_add'}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {activeTargetRole === 'FACILITY_MANAGER'
                  ? 'Phân Công Ca Quản Lý Cơ Sở'
                  : 'Phân Công Ca Trực Nhân Viên'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeTargetRole === 'FACILITY_MANAGER'
                  ? 'Dành riêng cho Business Manager điều phối Quản lý cơ sở'
                  : 'Điều phối nhân sự trực thuộc cơ sở phụ trách'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Assignment Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          {/* Facility Selector for Business Manager */}
          {isBusinessManager && facilities.length > 0 && (
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Cơ sở phân công
              </label>
              <select
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
              >
                {facilities.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Area & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Ngày trực
              </label>
              <input
                type="date"
                value={assignmentDate}
                min={formatDateLocal(new Date())}
                onChange={(e) => setAssignmentDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Khu vực phân công
              </label>
              <select
                value={targetZone}
                onChange={(e) => setTargetZone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
              >
                <option value="Phân khu A (Hành lang Aisle North)">Phân khu A (Aisle North)</option>
                <option value="Phân khu B (Hành lang Aisle South)">Phân khu B (Aisle South)</option>
                <option value="Phân khu C (Tầng 2 Kho Lạnh 18-22°C)">Phân khu C (Tầng 2 Climate)</option>
                <option value="Trạm Điều Hành Trung Tâm & Lễ Tân">Trạm Điều Hành &amp; Lễ Tân</option>
              </select>
            </div>
          </div>

          {/* Select Staff / FM */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-slate-700 font-semibold">
                {activeTargetRole === 'FACILITY_MANAGER'
                  ? 'Chọn Quản lý cơ sở (FACILITY_MANAGER)'
                  : 'Chọn nhân viên trực ca (STAFF)'}
              </label>
              {isLoadingStaff && (
                <span className="text-[11px] text-cyan-600 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                  Đang tải...
                </span>
              )}
            </div>

            {staffList.length === 0 && !isLoadingStaff ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-slate-500">
                {activeTargetRole === 'FACILITY_MANAGER'
                  ? 'Không tìm thấy Quản lý cơ sở nào thuộc cơ sở đã chọn.'
                  : 'Không tìm thấy nhân viên (STAFF) nào thuộc cơ sở này.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                {staffList.map(staff => {
                  const staffDayShifts = facilityDayAssignments.filter(a => a.staffId === staff.id)
                  const isSelected = selectedStaffId === staff.id

                  return (
                    <div
                      key={staff.id}
                      onClick={() => setSelectedStaffId(staff.id)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/10 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {staff.avatar ? (
                          <img
                            src={staff.avatar}
                            alt={staff.fullName || staff.username}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                            {(staff.fullName || staff.username).substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-slate-900 truncate">
                              {staff.fullName || staff.username}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border shrink-0 ${
                              (staff.roleName || staff.role?.name || targetRole) === 'FACILITY_MANAGER'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {(staff.roleName || staff.role?.name || targetRole)}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 truncate">
                            {staff.email}
                          </span>
                          {staffDayShifts.length > 0 ? (
                            <span className="text-[10px] font-semibold text-amber-700 mt-0.5 truncate flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px] text-amber-600">event_busy</span>
                              <span>
                                Đã có ca: {staffDayShifts.map(s => s.shift === 'MORNING' ? 'Sáng' : s.shift === 'AFTERNOON' ? 'Chiều' : 'Đêm').join(', ')}
                              </span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-600 font-medium mt-0.5 flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px]">check_circle</span>
                              <span>Chưa phân ca ngày này</span>
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="material-symbols-outlined text-slate-900 text-[18px] shrink-0">check</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Shift Type Selection with In-line Conflict Validation */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-slate-700 font-semibold">
                Ca làm việc
              </label>
              {isLoadingExistingShifts && (
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] animate-spin">sync</span>
                  Kiểm tra lịch ca...
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {STANDARD_SHIFTS_LIST.map(s => {
                const isPastShift = isShiftInPast(assignmentDate, s.type)
                const isAlreadyAssigned = assignedShiftTypes.has(s.type)
                const isCurrentSelected = shiftType === s.type
                const isDisabled = isPastShift || isAlreadyAssigned

                return (
                  <button
                    key={s.type}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      if (!isDisabled) {
                        setShiftType(s.type as 'MORNING' | 'AFTERNOON' | 'NIGHT')
                      }
                    }}
                    title={
                      isAlreadyAssigned
                        ? 'Nhân viên đã được phân công ca trực vào thời gian này'
                        : isPastShift
                        ? 'Khung giờ ca này đã trôi qua, không thể phân công'
                        : s.label
                    }
                    className={`p-2.5 rounded-xl border text-center transition-all relative ${
                      isAlreadyAssigned
                        ? 'bg-amber-50/80 border-amber-300 text-amber-900 cursor-not-allowed opacity-90 shadow-2xs'
                        : isPastShift
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                        : isCurrentSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm cursor-pointer ring-2 ring-slate-900/15'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 cursor-pointer hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 font-bold">
                      <span>{s.shortLabel}</span>
                      {isAlreadyAssigned && (
                        <span className="material-symbols-outlined text-[14px] text-amber-600" title="Đã được phân ca">
                          event_busy
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-[10px] block mt-0.5 font-medium ${
                        isAlreadyAssigned
                          ? 'text-amber-800 font-bold bg-amber-100/70 px-1 py-0.5 rounded'
                          : isPastShift
                          ? 'text-rose-500 font-semibold'
                          : isCurrentSelected
                          ? 'text-slate-300'
                          : 'text-slate-500'
                      }`}
                    >
                      {isAlreadyAssigned
                        ? 'Đã phân ca'
                        : isPastShift
                        ? `${s.timeRange} (Đã qua)`
                        : s.timeRange}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Thông báo trực quan nếu toàn bộ các ca trong ngày đã kín hoặc không khả dụng */}
            {isAllShiftsUnavailable && (
              <div className="mt-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0 mt-0.5">event_busy</span>
                <div>
                  <span className="font-bold">{selectedStaffDisplayName} đã được phân công tất cả các ca trong ngày {assignmentDate}. </span>
                  <p className="mt-0.5 text-[11px] text-amber-700">Vui lòng chọn ngày khác hoặc chọn nhân sự khác để phân công ca trực.</p>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Chỉ thị nhiệm vụ cụ thể
            </label>
            <textarea
              rows={2}
              value={taskNotes}
              onChange={(e) => setTaskNotes(e.target.value)}
              className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
              placeholder="Nhập nội dung giao việc..."
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all border border-slate-200 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                staffList.length === 0 ||
                !selectedStaffId ||
                isAllShiftsUnavailable ||
                assignedShiftTypes.has(shiftType) ||
                isShiftInPast(assignmentDate, shiftType)
              }
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-neutral-800 transition-all shadow-sm cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className={`material-symbols-outlined text-[16px] ${isSubmitting ? 'animate-spin' : ''}`}>
                {isSubmitting ? 'sync' : 'how_to_reg'}
              </span>
              <span>{isSubmitting ? 'Đang lưu vào CSDL...' : 'Lưu & Phát Lệnh Phân Công'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
