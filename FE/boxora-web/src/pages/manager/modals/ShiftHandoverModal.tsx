import React, { useState, useEffect, useMemo } from 'react'
import { staffAssignmentService, StaffAssignmentResponse } from '../../../services/staffAssignmentService'
import { userService } from '../../../services/userService'
import { useAuth } from '../../../context/AuthContext'
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

type HandoverType = 'ROUTINE' | 'EMERGENCY' | 'RESPONSIBILITY_TRANSFER'

const formatDateLocal = (d: Date): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const getShiftLabel = (shift?: string) => {
  if (shift === 'MORNING') return 'Ca Sáng (06:00 - 14:00)'
  if (shift === 'AFTERNOON') return 'Ca Chiều (14:00 - 22:00)'
  if (shift === 'NIGHT') return 'Ca Đêm (22:00 - 06:00)'
  return 'Cả Ngày (08:00 - 17:00)'
}

const getNextShift = (current: 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'FULL_DAY'): 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'FULL_DAY' => {
  if (current === 'MORNING') return 'AFTERNOON'
  if (current === 'AFTERNOON') return 'NIGHT'
  if (current === 'NIGHT') return 'MORNING'
  return 'MORNING'
}

interface StaffOption {
  id: string
  fullName: string
  email: string
  roleName?: string
  shiftLabel?: string
  zone?: string
  isNextShift?: boolean
  isTodayAssigned?: boolean
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
  const { user } = useAuth()

  // Handover Type
  const [handoverType, setHandoverType] = useState<HandoverType>('ROUTINE')
  const targetShift = useMemo(() => getNextShift(currentShift), [currentShift])

  // Recipient selection state
  const [incomingStaffId, setIncomingStaffId] = useState<string>('')
  const [emergencyPendingDispatch, setEmergencyPendingDispatch] = useState<boolean>(false)
  const [emergencyReason, setEmergencyReason] = useState<string>('')

  // Transfer scopes for RESPONSIBILITY_TRANSFER
  const [selectedScopes, setSelectedScopes] = useState<{
    cashDrawer: boolean
    checkinCheckout: boolean
    tickets: boolean
    securityLock: boolean
  }>({
    cashDrawer: true,
    checkinCheckout: true,
    tickets: false,
    securityLock: true
  })

  // Candidates & Directory
  const [allFacilityStaff, setAllFacilityStaff] = useState<StaffOption[]>([])
  const [assignedRoster, setAssignedRoster] = useState<StaffAssignmentResponse[]>([])

  // Reconciliation inputs
  const [pendingTasks, setPendingTasks] = useState('')
  const [pendingTicketsCount, setPendingTicketsCount] = useState<number>(0)
  const [unresolvedBookingsCount, setUnresolvedBookingsCount] = useState<number>(0)
  const [cashInDrawer, setCashInDrawer] = useState<number>(1000000)
  const [cashCounted, setCashCounted] = useState<number>(1000000)
  const [cashDiscrepancyReason, setCashDiscrepancyReason] = useState<string>('')
  const [facilityStatusNote, setFacilityStatusNote] = useState('Khóa thông minh SmartLock và hệ thống camera an ninh hoạt động ổn định.')
  const [checklistCompleted, setChecklistCompleted] = useState(false)
  const [notes, setNotes] = useState('')

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Calculate Cash Discrepancy
  const cashDiscrepancy = useMemo(() => {
    return (cashCounted || 0) - (cashInDrawer || 0)
  }, [cashCounted, cashInDrawer])

  useEffect(() => {
    if (isOpen && facilityId) {
      void loadCandidates()
    }
  }, [isOpen, facilityId, currentShift])

  const loadCandidates = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const today = new Date()
      const todayStr = formatDateLocal(today)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = formatDateLocal(tomorrow)

      // 1. Fetch assignments for today & tomorrow (if night shift handing over to tomorrow morning)
      const targetDateStr = currentShift === 'NIGHT' ? tomorrowStr : todayStr
      const assignRes = await staffAssignmentService.getAllAssignments({
        facilityId,
        fromDate: todayStr,
        toDate: targetDateStr,
        size: 100
      })
      const assignmentsList: StaffAssignmentResponse[] = Array.isArray(assignRes?.content) ? assignRes.content : []
      setAssignedRoster(assignmentsList)

      // 2. Fetch all active staff & managers at this facility
      const staffRes = await userService.getAllUsers({
        facilityId,
        isActive: true,
        size: 100
      })
      const usersList: User[] = staffRes?.data || []

      // Normalize into unified option list
      const options: StaffOption[] = usersList
        .filter(u => u.id !== user?.id) // Exclude current user
        .map(u => {
          const matchedAssignment = assignmentsList.find(a =>
            a.staffId === u.id &&
            a.status !== 'CANCELLED' &&
            a.status !== 'ABSENT'
          )

          const isNext = matchedAssignment?.shift === targetShift &&
            (currentShift === 'NIGHT' ? matchedAssignment.assignedDate === targetDateStr : matchedAssignment.assignedDate === todayStr)

          return {
            id: u.id,
            fullName: u.fullName || u.username,
            email: u.email,
            roleName: u.roleName || (u.role?.name === 'FACILITY_MANAGER' ? 'Quản lý cơ sở' : 'Nhân viên'),
            shiftLabel: matchedAssignment ? getShiftLabel(matchedAssignment.shift) : undefined,
            zone: matchedAssignment?.assignedZone,
            isNextShift: isNext,
            isTodayAssigned: Boolean(matchedAssignment)
          }
        })

      // Sort: Next shift first, then today assigned, then others
      options.sort((a, b) => {
        if (a.isNextShift && !b.isNextShift) return -1
        if (!a.isNextShift && b.isNextShift) return 1
        if (a.isTodayAssigned && !b.isTodayAssigned) return -1
        if (!a.isTodayAssigned && b.isTodayAssigned) return 1
        return a.fullName.localeCompare(b.fullName)
      })

      setAllFacilityStaff(options)

      // Auto-select first next-shift candidate if available
      const nextCandidate = options.find(o => o.isNextShift)
      if (nextCandidate) {
        setIncomingStaffId(nextCandidate.id)
      } else if (options.length > 0) {
        setIncomingStaffId(options[0].id)
      } else {
        setIncomingStaffId('')
      }
    } catch (err) {
      console.warn('Failed to load candidate staff for handover:', err)
      setAllFacilityStaff([])
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  // Filter candidates based on handover type
  const availableCandidates = useMemo(() => {
    if (handoverType === 'ROUTINE') {
      const nextShiftCandidates = allFacilityStaff.filter(s => s.isNextShift)
      return nextShiftCandidates.length > 0 ? nextShiftCandidates : allFacilityStaff
    }
    return allFacilityStaff
  }, [handoverType, allFacilityStaff])

  const hasNextShiftAssigned = useMemo(() => {
    return allFacilityStaff.some(s => s.isNextShift)
  }, [allFacilityStaff])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 1. Validation according to Handover Type
    if (handoverType === 'EMERGENCY') {
      if (!emergencyReason.trim()) {
        setErrorMessage('Bắt buộc phải nhập lý do bàn giao đột xuất (sức khỏe, gia đình, tình huống khẩn cấp).')
        return
      }
      if (!emergencyPendingDispatch && !incomingStaffId) {
        setErrorMessage('Vui lòng chọn nhân sự tiếp nhận hoặc chọn "Gửi Quản lý cơ sở điều phối".')
        return
      }
    } else {
      if (!incomingStaffId) {
        setErrorMessage('Quy định bắt buộc: Vui lòng chọn nhân sự tiếp nhận bàn giao.')
        return
      }
    }

    if (!checklistCompleted) {
      setErrorMessage('Quy trình bắt buộc: Vui lòng kiểm tra và tích chọn xác nhận checklist bàn giao ca.')
      return
    }

    if (cashDiscrepancy !== 0 && !cashDiscrepancyReason.trim()) {
      setErrorMessage('Phát hiện chênh lệch tiền quỹ! Bắt buộc phải nhập giải trình lý do chênh lệch.')
      return
    }

    // Determine target assignment if any
    const matchedIncomingAssignment = assignedRoster.find(a =>
      a.staffId === incomingStaffId &&
      a.status !== 'CANCELLED' &&
      a.status !== 'ABSENT'
    )

    // Build transfer scope string
    const transferScopeArr: string[] = []
    if (selectedScopes.cashDrawer) transferScopeArr.push('CASH_DRAWER')
    if (selectedScopes.checkinCheckout) transferScopeArr.push('CHECKIN_CHECKOUT')
    if (selectedScopes.tickets) transferScopeArr.push('TICKETS')
    if (selectedScopes.securityLock) transferScopeArr.push('SECURITY_LOCK')

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const todayStr = formatDateLocal(new Date())
      const finalIncomingStaffId = (handoverType === 'EMERGENCY' && emergencyPendingDispatch)
        ? undefined
        : incomingStaffId

      await staffAssignmentService.createHandover({
        facilityId,
        handoverDate: todayStr,
        shift: currentShift,
        targetShift: handoverType === 'ROUTINE' ? targetShift : undefined,
        handoverType,
        incomingStaffId: finalIncomingStaffId,
        outgoingAssignmentId,
        incomingAssignmentId: matchedIncomingAssignment?.id,
        emergencyReason: handoverType === 'EMERGENCY' ? emergencyReason.trim() : undefined,
        transferScope: handoverType === 'RESPONSIBILITY_TRANSFER' ? transferScopeArr.join(',') : undefined,
        pendingTasks: pendingTasks.trim() || undefined,
        pendingTicketsCount,
        unresolvedBookingsCount,
        cashInDrawer,
        cashCounted,
        cashDiscrepancy,
        cashDiscrepancyReason: cashDiscrepancy !== 0 ? cashDiscrepancyReason.trim() : undefined,
        facilityStatusNote: facilityStatusNote.trim() || undefined,
        checklistCompleted: true,
        notes: notes.trim() || undefined
      })

      const successMsg = (handoverType === 'EMERGENCY' && emergencyPendingDispatch)
        ? 'Đã gửi yêu cầu bàn giao đột xuất tới Quản lý cơ sở điều phối nhân sự tiếp nhận!'
        : 'Lập biên bản bàn giao ca trực thành công! Ca tiếp nhận có thể xem và xác nhận tiếp nhận.'

      onSuccess(successMsg)
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Lỗi khi lưu biên bản bàn giao ca trực.'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const shiftNameVi = getShiftLabel(currentShift)
  const targetShiftNameVi = getShiftLabel(targetShift)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 text-left max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shadow-2xs">
              <span className="material-symbols-outlined text-[24px]">assignment_turned_in</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Lập Biên Bản Bàn Giao Ca Trực</h2>
              <p className="text-xs text-slate-500 font-medium">
                {facilityName} • Ca nguồn: <strong>{shiftNameVi}</strong>
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
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
            <span className="material-symbols-outlined text-[20px] shrink-0 text-rose-600">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          {/* 1. LOẠI BÀN GIAO (3 NGHIỆP VỤ) */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">
              Chọn Loại Hình Bàn Giao <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Type 1: ROUTINE */}
              <button
                type="button"
                onClick={() => {
                  setHandoverType('ROUTINE')
                  setEmergencyPendingDispatch(false)
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  handoverType === 'ROUTINE'
                    ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 text-blue-950 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-[18px] ${handoverType === 'ROUTINE' ? 'text-blue-600' : 'text-slate-400'}`}>
                    swap_horiz
                  </span>
                  <span className="font-bold text-xs">Định Kỳ Đổi Ca</span>
                </div>
                <p className="text-[11px] text-slate-500 font-normal leading-tight">
                  Bàn giao cho ca kế tiếp: <strong>{targetShiftNameVi.split(' ')[1]}</strong>
                </p>
              </button>

              {/* Type 2: EMERGENCY */}
              <button
                type="button"
                onClick={() => setHandoverType('EMERGENCY')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  handoverType === 'EMERGENCY'
                    ? 'bg-rose-50/80 border-rose-500 ring-2 ring-rose-500/20 text-rose-950 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-[18px] ${handoverType === 'EMERGENCY' ? 'text-rose-600' : 'text-slate-400'}`}>
                    emergency
                  </span>
                  <span className="font-bold text-xs">Bàn Giao Đột Xuất</span>
                </div>
                <p className="text-[11px] text-slate-500 font-normal leading-tight">
                  Rời ca trước giờ (khẩn cấp / sức khỏe / việc đột xuất)
                </p>
              </button>

              {/* Type 3: RESPONSIBILITY_TRANSFER */}
              <button
                type="button"
                onClick={() => {
                  setHandoverType('RESPONSIBILITY_TRANSFER')
                  setEmergencyPendingDispatch(false)
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  handoverType === 'RESPONSIBILITY_TRANSFER'
                    ? 'bg-purple-50/80 border-purple-500 ring-2 ring-purple-500/20 text-purple-950 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-[18px] ${handoverType === 'RESPONSIBILITY_TRANSFER' ? 'text-purple-600' : 'text-slate-400'}`}>
                    shield_person
                  </span>
                  <span className="font-bold text-xs">Chuyển Giao Trong Ca</span>
                </div>
                <p className="text-[11px] text-slate-500 font-normal leading-tight">
                  Chuyển quyền quầy / ticket / SmartLock cho đồng nghiệp
                </p>
              </button>
            </div>
          </div>

          {/* EMERGENCY REASON (Required if EMERGENCY) */}
          {handoverType === 'EMERGENCY' && (
            <div className="p-3.5 bg-rose-50/60 border border-rose-200 rounded-xl space-y-2">
              <label className="block text-rose-900 font-bold">
                Lý Do Bàn Giao Đột Xuất <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={2}
                value={emergencyReason}
                onChange={e => setEmergencyReason(e.target.value)}
                placeholder="Nêu rõ lý do khẩn cấp: sốt cao cần đi viện, sự cố gia đình đột xuất, tình huống khẩn cấp tại cơ sở..."
                className="w-full px-3 py-2 bg-white border border-rose-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-rose-500/20 resize-none"
              />
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={emergencyPendingDispatch}
                  onChange={e => setEmergencyPendingDispatch(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 h-4 w-4"
                />
                <span className="text-rose-950 text-xs font-semibold">
                  Hiện tại chưa có người tiếp nhận tại chỗ — Gửi Quản lý cơ sở điều phối nhân sự (Trạng thái: Chờ điều phối)
                </span>
              </label>
            </div>
          )}

          {/* SCOPE SELECTION (If RESPONSIBILITY_TRANSFER) */}
          {handoverType === 'RESPONSIBILITY_TRANSFER' && (
            <div className="p-3.5 bg-purple-50/60 border border-purple-200 rounded-xl space-y-2">
              <label className="block text-purple-900 font-bold">
                Chọn Phạm Vi Trách Nhiệm Cần Chuyển Giao <span className="text-purple-600">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 bg-white p-2 rounded-lg border border-purple-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedScopes.cashDrawer}
                    onChange={e => setSelectedScopes(prev => ({ ...prev, cashDrawer: e.target.checked }))}
                    className="rounded text-purple-600"
                  />
                  <span>Quỹ két quầy thu ngân</span>
                </label>
                <label className="flex items-center gap-2 bg-white p-2 rounded-lg border border-purple-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedScopes.checkinCheckout}
                    onChange={e => setSelectedScopes(prev => ({ ...prev, checkinCheckout: e.target.checked }))}
                    className="rounded text-purple-600"
                  />
                  <span>Khách nhận &amp; trả kho</span>
                </label>
                <label className="flex items-center gap-2 bg-white p-2 rounded-lg border border-purple-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedScopes.tickets}
                    onChange={e => setSelectedScopes(prev => ({ ...prev, tickets: e.target.checked }))}
                    className="rounded text-purple-600"
                  />
                  <span>Xử lý ticket &amp; sự cố</span>
                </label>
                <label className="flex items-center gap-2 bg-white p-2 rounded-lg border border-purple-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedScopes.securityLock}
                    onChange={e => setSelectedScopes(prev => ({ ...prev, securityLock: e.target.checked }))}
                    className="rounded text-purple-600"
                  />
                  <span>An ninh, thiết bị &amp; SmartLock</span>
                </label>
              </div>
            </div>
          )}

          {/* 2. INCOMING STAFF SELECTION */}
          {(!emergencyPendingDispatch || handoverType !== 'EMERGENCY') && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-bold">
                  Nhân Sự Tiếp Nhận Bàn Giao <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  Nhân sự khả dụng tại chi nhánh: {allFacilityStaff.length}
                </span>
              </div>

              {isLoading ? (
                <div className="text-slate-400 italic py-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  <span>Đang tải danh sách nhân sự tại cơ sở...</span>
                </div>
              ) : allFacilityStaff.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[20px] text-amber-600 shrink-0 mt-0.5">warning</span>
                  <div className="flex-1">
                    <p className="font-bold">Không tìm thấy nhân viên nào khác tại cơ sở {facilityName}!</p>
                    <p className="mt-1 text-[11px] text-amber-700 leading-relaxed">
                      Bạn có thể chuyển sang hình thức <strong>Bàn giao đột xuất</strong> để gửi Quản lý cơ sở điều phối nhân sự thay thế mà không bị gián đoạn.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setHandoverType('EMERGENCY')
                        setEmergencyPendingDispatch(true)
                      }}
                      className="mt-2 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Chuyển sang Bàn giao đột xuất</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {handoverType === 'ROUTINE' && !hasNextShiftAssigned && (
                    <div className="p-2.5 mb-2 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-800 text-[11px] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-blue-600">info</span>
                        <span>Ca tiếp theo ({targetShiftNameVi.split(' ')[1]}) chưa có nhân sự phân ca. Bạn có thể chọn đồng nghiệp hiện có tại cơ sở bên dưới.</span>
                      </div>
                    </div>
                  )}

                  <select
                    value={incomingStaffId}
                    onChange={e => setIncomingStaffId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                  >
                    <option value="">-- Chọn nhân sự tiếp nhận bàn giao --</option>
                    {availableCandidates.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.email}) — [{s.roleName}{s.isNextShift ? ` • Đã phân ca kế tiếp (${targetShift})` : s.shiftLabel ? ` • Đang có ${s.shiftLabel}` : ''}]
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}

          {/* 3. ĐỐI SOÁT TIỀN QUỸ & CHÊNH LỆCH */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">payments</span>
                <span>Đối Soát Quỹ Tiền Mặt Tại Quầy</span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Bắt buộc đối soát hai bên</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 font-bold mb-1">
                  Tiền sổ sách (VNĐ)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={cashInDrawer}
                  onChange={e => setCashInDrawer(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">
                  Tiền thực đếm (VNĐ)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={cashCounted}
                  onChange={e => setCashCounted(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">
                  Chênh lệch (VNĐ)
                </label>
                <div className={`px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center justify-between border ${
                  cashDiscrepancy === 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-300'
                }`}>
                  <span>{cashDiscrepancy > 0 ? `+${cashDiscrepancy.toLocaleString('vi-VN')}` : cashDiscrepancy.toLocaleString('vi-VN')} đ</span>
                  <span className="text-[10px] font-sans font-semibold">
                    {cashDiscrepancy === 0 ? 'Khớp quỹ' : cashDiscrepancy > 0 ? 'Thừa quỹ' : 'Thiếu quỹ'}
                  </span>
                </div>
              </div>
            </div>

            {cashDiscrepancy !== 0 && (
              <div className="space-y-1">
                <label className="block text-rose-700 font-bold">
                  Giải trình nguyên nhân chênh lệch quỹ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={cashDiscrepancyReason}
                  onChange={e => setCashDiscrepancyReason(e.target.value)}
                  placeholder="Ghi rõ lý do thừa / thiếu tiền két quầy..."
                  className="w-full px-3 py-2 bg-white border border-rose-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>
            )}
          </div>

          {/* 4. SỐ LIỆU VẬN HÀNH & CÔNG VIỆC TỒN ĐỌNG */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                Lịch hẹn / Đơn chờ nhận kho
              </label>
              <input
                type="number"
                min={0}
                value={unresolvedBookingsCount}
                onChange={e => setUnresolvedBookingsCount(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Nhiệm vụ tồn đọng cần bàn giao
            </label>
            <textarea
              rows={2}
              value={pendingTasks}
              onChange={e => setPendingTasks(e.target.value)}
              placeholder="Khách hẹn nhận kho lúc mấy giờ, kho nào cần bàn giao, chứng từ cần chuyển tiếp..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-normal outline-none focus:border-blue-500 focus:bg-white resize-none"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Tình trạng an ninh, thiết bị, SmartLock &amp; PCCC
            </label>
            <textarea
              rows={2}
              value={facilityStatusNote}
              onChange={e => setFacilityStatusNote(e.target.value)}
              placeholder="Ghi nhận hiện trạng cảm biến, pin khóa SmartLock, điều hòa, hệ thống PCCC cơ sở..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-normal outline-none focus:border-blue-500 focus:bg-white resize-none"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Ghi chú thêm
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Bàn giao chìa khóa dự phòng quầy, biên bản kiểm kê..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-normal outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          {/* CHECKLIST CONFIRMATION */}
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={checklistCompleted}
                onChange={e => setChecklistCompleted(e.target.checked)}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 h-4 w-4 shrink-0"
              />
              <span className="text-amber-950 text-xs font-semibold leading-relaxed">
                Tôi xác nhận đã kiểm tra thực tế tiền quỹ quầy, công việc tồn đọng, hệ thống khóa SmartLock và an toàn cơ sở theo đúng tiêu chuẩn bàn giao Boxora.
              </span>
            </label>
          </div>

          {/* ACTIONS */}
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
