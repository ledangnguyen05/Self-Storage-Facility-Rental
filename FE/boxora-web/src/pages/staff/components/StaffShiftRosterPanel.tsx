import React, { useState, useEffect, useMemo } from 'react'
import { userService } from '../../../services/userService'
import { facilityService } from '../../../services/facilityService'
import {
  staffAssignmentService,
  StaffAssignmentResponse,
  ShiftSwapRequest,
  ShiftHandover,
  isShiftAbsent,
  isShiftForgottenCheckout,
  calculateShiftWorkHours
} from '../../../services/staffAssignmentService'
import { useAuth } from '../../../context/AuthContext'
import { Facility, User } from '../../../types'
import { ShiftSwapModal } from '../../manager/modals/ShiftSwapModal'
import { ShiftHandoverModal } from '../../manager/modals/ShiftHandoverModal'
import { canCheckInShift, formatShiftTimeRange } from '../../../constants/shiftConstants'

export interface StaffShiftRosterPanelProps {
  facilityId?: string
  facilityName?: string
  facilities?: Facility[]
  onShiftCountChange?: (count: number) => void
  onPendingSwapsChange?: (count: number) => void
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

const getDayOfWeekVN = (dateStr?: string | null): string => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
    return days[d.getDay()] || ''
  } catch {
    return ''
  }
}

const formatDateTime = (dtStr?: string | null): string => {
  if (!dtStr) return '—'
  try {
    const d = new Date(dtStr)
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  } catch {
    return dtStr
  }
}

const getWeekRange = (refDate: Date): { from: string; to: string } => {
  const d = new Date(refDate)
  const day = d.getDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diffToMon)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { from: formatDateLocal(mon), to: formatDateLocal(sun) }
}

export const StaffShiftRosterPanel: React.FC<StaffShiftRosterPanelProps> = ({
  facilityId,
  facilityName,
  facilities = [],
  onShiftCountChange,
  onPendingSwapsChange
}) => {
  const { user } = useAuth()

  const todayStr = useMemo(() => formatDateLocal(new Date()), [])
  const initialWeek = useMemo(() => getWeekRange(new Date()), [])

  const currentFacilityId = facilityId || user?.facilityId || (facilities.length > 0 ? facilities[0].id : '')
  const currentFacilityName = useMemo(() => {
    if (facilityName) return facilityName
    const f = facilities.find(fac => fac.id === currentFacilityId)
    return f ? f.name : (user?.facilityName || 'Cơ sở Boxora')
  }, [facilityName, facilities, currentFacilityId, user?.facilityName])

  // Date Range States - Defaults to THIS_WEEK
  const [startDate, setStartDate] = useState<string>(() => initialWeek.from)
  const [endDate, setEndDate] = useState<string>(() => initialWeek.to)
  const [appliedStartDate, setAppliedStartDate] = useState<string>(() => initialWeek.from)
  const [appliedEndDate, setAppliedEndDate] = useState<string>(() => initialWeek.to)
  const [dateShortcut, setDateShortcut] = useState<'LAST_WEEK' | 'THIS_WEEK' | 'NEXT_WEEK' | 'TODAY' | 'THIS_MONTH' | 'CUSTOM'>('THIS_WEEK')
  const [dateRangeError, setDateRangeError] = useState<string | null>(null)

  // Sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'ROSTER' | 'SWAPS' | 'HANDOVERS' | 'STAFF'>('ROSTER')

  // Real Data States
  const [assignments, setAssignments] = useState<StaffAssignmentResponse[]>([])
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequest[]>([])
  const [handovers, setHandovers] = useState<ShiftHandover[]>([])
  const [staffList, setStaffList] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Filters & Search for Roster Table
  const [searchTerm, setSearchTerm] = useState('')
  const [filterShift, setFilterShift] = useState<string>('ALL')
  const [filterStaff, setFilterStaff] = useState<string>('ALL')
  const [filterZone, setFilterZone] = useState<string>('ALL')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // Swap Requests Sub-filter
  const [swapScopeFilter, setSwapScopeFilter] = useState<'ALL' | 'INCOMING' | 'OUTGOING'>('ALL')

  // Modals & Action States
  const [selectedAssignmentForSwap, setSelectedAssignmentForSwap] = useState<StaffAssignmentResponse | null>(null)
  const [showShiftSwapModal, setShowShiftSwapModal] = useState(false)
  const [selectedAssignmentForDetail, setSelectedAssignmentForDetail] = useState<StaffAssignmentResponse | null>(null)
  const [showHandoverModal, setShowHandoverModal] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Target Staff Respond to Swap Modal
  const [respondSwapModal, setRespondSwapModal] = useState<{
    swap: ShiftSwapRequest
    accept: boolean
  } | null>(null)
  const [respondSwapNotes, setRespondSwapNotes] = useState('')
  const [isRespondingSwap, setIsRespondingSwap] = useState(false)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Date shortcuts handler
  const applyShortcut = (shortcut: 'LAST_WEEK' | 'THIS_WEEK' | 'NEXT_WEEK' | 'TODAY' | 'THIS_MONTH') => {
    setDateShortcut(shortcut)
    setDateRangeError(null)
    const now = new Date()
    let s = ''
    let e = ''
    if (shortcut === 'TODAY') {
      s = formatDateLocal(now)
      e = s
    } else if (shortcut === 'THIS_WEEK') {
      const w = getWeekRange(now)
      s = w.from
      e = w.to
    } else if (shortcut === 'LAST_WEEK') {
      const prevWeek = new Date(now)
      prevWeek.setDate(prevWeek.getDate() - 7)
      const w = getWeekRange(prevWeek)
      s = w.from
      e = w.to
    } else if (shortcut === 'NEXT_WEEK') {
      const nextWeek = new Date(now)
      nextWeek.setDate(nextWeek.getDate() + 7)
      const w = getWeekRange(nextWeek)
      s = w.from
      e = w.to
    } else if (shortcut === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      s = formatDateLocal(firstDay)
      e = formatDateLocal(lastDay)
    }
    setStartDate(s)
    setEndDate(e)
    setAppliedStartDate(s)
    setAppliedEndDate(e)
    setCurrentPage(1)
  }

  const handleApplyCustomDate = () => {
    if (startDate > endDate) {
      setDateRangeError('Ngày bắt đầu không được lớn hơn ngày kết thúc!')
      showToast('Lỗi: Ngày bắt đầu không được lớn hơn ngày kết thúc!')
      return
    }
    setDateRangeError(null)
    setAppliedStartDate(startDate)
    setAppliedEndDate(endDate)
    setCurrentPage(1)
    showToast(`Đã áp dụng bộ lọc từ ${formatVN(startDate)} đến ${formatVN(endDate)}`)
  }

  const handleResetDate = () => {
    applyShortcut('THIS_WEEK')
  }

  // Fetch all operational shift data for this facility
  const fetchData = async () => {
    setIsLoading(true)
    try {
      const targetFacilityId = (!currentFacilityId || currentFacilityId === 'ALL') ? undefined : currentFacilityId

      // 1. Shift assignments in range
      const assignRes = await staffAssignmentService.getAllAssignments({
        facilityId: targetFacilityId,
        fromDate: appliedStartDate,
        toDate: appliedEndDate,
        size: 300
      })
      let assignList: StaffAssignmentResponse[] = []
      if (assignRes?.content && Array.isArray(assignRes.content)) {
        assignList = assignRes.content
      } else if (Array.isArray(assignRes)) {
        assignList = assignRes
      }
      if (targetFacilityId) {
        assignList = assignList.filter(a => a.facilityId === targetFacilityId)
      }
      setAssignments(assignList)
      onShiftCountChange?.(assignList.length)

      // 2. Staff list in facility
      const staffRes = await userService.getAllUsers({
        role: 'STAFF',
        facilityId: targetFacilityId,
        size: 100
      })
      setStaffList(staffRes.data || [])

      // 3. Shift swap requests in range
      try {
        const swapRes = await staffAssignmentService.getSwapRequests({
          facilityId: targetFacilityId,
          fromDate: appliedStartDate,
          toDate: appliedEndDate,
          size: 100
        })
        let swapList: ShiftSwapRequest[] = []
        if (swapRes?.content && Array.isArray(swapRes.content)) {
          swapList = swapRes.content
        } else if (Array.isArray(swapRes)) {
          swapList = swapRes
        }
        if (targetFacilityId) {
          swapList = swapList.filter(s => s.facilityId === targetFacilityId)
        }
        setSwapRequests(swapList)

        // Count pending swaps where target is this user
        const incomingCount = swapList.filter(
          s => s.targetStaffId === user?.id && s.status === 'MANAGER_APPROVED'
        ).length
        onPendingSwapsChange?.(incomingCount)
      } catch (swapErr) {
        // Fallback to my requests if facility endpoint restricted
        try {
          const mySwaps = await staffAssignmentService.getMySwapRequests()
          setSwapRequests(Array.isArray(mySwaps) ? mySwaps : [])
        } catch {
          setSwapRequests([])
        }
      }

      // 4. Shift handovers in range
      try {
        const handoverRes = await staffAssignmentService.getHandovers({
          facilityId: targetFacilityId,
          fromDate: appliedStartDate,
          toDate: appliedEndDate,
          size: 100
        })
        let handoverList: ShiftHandover[] = []
        if (handoverRes?.content && Array.isArray(handoverRes.content)) {
          handoverList = handoverRes.content
        } else if (Array.isArray(handoverRes)) {
          handoverList = handoverRes
        }
        if (targetFacilityId) {
          handoverList = handoverList.filter(h => h.facilityId === targetFacilityId)
        }
        setHandovers(handoverList)
      } catch {
        setHandovers([])
      }
    } catch (err) {
      console.warn('Failed to load staff roster data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [currentFacilityId, appliedStartDate, appliedEndDate])

  // Real KPI calculations
  const totalStaffCount = staffList.length
  const checkedInCount = useMemo(() => assignments.filter(a => a.status === 'CHECKED_IN').length, [assignments])
  const assignedCount = useMemo(() => assignments.filter(a => a.status === 'ASSIGNED' && !isShiftAbsent(a)).length, [assignments])
  const absentCount = useMemo(() => assignments.filter(a => isShiftAbsent(a)).length, [assignments])
  const completedCount = useMemo(() => assignments.filter(a => a.status === 'COMPLETED').length, [assignments])
  const pendingSwapCount = useMemo(() => swapRequests.filter(s => s.status === 'PENDING').length, [swapRequests])
  const myPendingIncomingSwaps = useMemo(() => {
    return swapRequests.filter(s => s.targetStaffId === user?.id && s.status === 'MANAGER_APPROVED')
  }, [swapRequests, user?.id])
  const myOutgoingSwaps = useMemo(() => {
    return swapRequests.filter(s => s.requesterId === user?.id)
  }, [swapRequests, user?.id])

  const distinctShiftsCount = useMemo(() => {
    const shifts = new Set(assignments.map(a => a.shift))
    return shifts.size
  }, [assignments])

  // Filtered Roster Assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => {
      const staffName = a.staffFullName || a.staffUsername || ''
      const matchSearch =
        staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.staffEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.assignedZone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.notes?.toLowerCase().includes(searchTerm.toLowerCase())

      if (!matchSearch) return false
      if (filterShift !== 'ALL' && a.shift !== filterShift) return false
      if (filterStaff !== 'ALL' && a.staffId !== filterStaff) return false
      if (filterZone !== 'ALL' && a.assignedZone !== filterZone) return false
      if (filterStatus !== 'ALL') {
        const isAbsent = isShiftAbsent(a)
        if (filterStatus === 'ABSENT') {
          if (!isAbsent) return false
        } else if (filterStatus === 'ASSIGNED') {
          if (a.status !== 'ASSIGNED' || isAbsent) return false
        } else {
          if (a.status !== filterStatus) return false
        }
      }
      return true
    })
  }, [assignments, searchTerm, filterShift, filterStaff, filterZone, filterStatus])

  const availableZones = useMemo(() => {
    const defaultZones = ['Quầy tiếp tân', 'Phân khu A', 'Phân khu B', 'Phân khu C']
    const extracted = assignments.map(a => a.assignedZone).filter(Boolean) as string[]
    return Array.from(new Set([...defaultZones, ...extracted]))
  }, [assignments])

  // Filtered Swap Requests
  const filteredSwapRequests = useMemo(() => {
    if (swapScopeFilter === 'INCOMING') {
      return swapRequests.filter(s => s.targetStaffId === user?.id)
    }
    if (swapScopeFilter === 'OUTGOING') {
      return swapRequests.filter(s => s.requesterId === user?.id)
    }
    return swapRequests
  }, [swapRequests, swapScopeFilter, user?.id])

  // Direct Staff Attendance Actions
  const handleCheckIn = async (assignment: StaffAssignmentResponse) => {
    if (!canCheckInShift(assignment)) {
      showToast('Chỉ có thể điểm danh trong khung giờ của ca trực được phân công.')
      return
    }
    const confirmed = window.confirm(
      '⚠️ QUY ĐỊNH CHẤM CÔNG BẮT BUỘC:\n\n' +
      'Khi kết thúc ca làm việc, bạn BẮT BUỘC PHẢI BẤM "RA CA" (Check-out).\n' +
      'Nếu quên ra ca trước 23:59:59 của ngày làm việc, hệ thống sẽ tự động hủy tính công và ghi nhận là KHÔNG ĐI LÀM (VẮNG MẶT - 0 công).\n\n' +
      'Bạn có chắc chắn muốn xác nhận vào ca làm việc ngay bây giờ?'
    )
    if (!confirmed) return

    setActionLoadingId(assignment.id)
    try {
      await staffAssignmentService.checkIn(assignment.id, 'Điểm danh vào ca trực tại quầy')
      showToast(`Điểm danh vào ca thành công! Chúc bạn một ca làm việc hiệu quả.`)
      await fetchData()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Không thể điểm danh vào ca.')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleCheckOut = async (assignment: StaffAssignmentResponse) => {
    setActionLoadingId(assignment.id)
    try {
      await staffAssignmentService.checkOut(assignment.id, 'Hoàn thành nhiệm vụ ca trực')
      showToast(`Hoàn tất kết thúc ca trực thành công!`)
      await fetchData()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Không thể kết thúc ca trực.')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Staff Cancel Own Pending Swap
  const handleCancelSwap = async (swapId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy yêu cầu đổi ca này?')) return
    setActionLoadingId(swapId)
    try {
      await staffAssignmentService.cancelSwapRequest(swapId)
      showToast('Đã hủy yêu cầu đổi ca thành công.')
      await fetchData()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Không thể hủy yêu cầu đổi ca.')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Target Staff Respond to Swap (Accept / Decline)
  const handleTargetSubmitResponse = async () => {
    if (!respondSwapModal) return
    setIsRespondingSwap(true)
    try {
      await staffAssignmentService.respondToSwapRequest(respondSwapModal.swap.id, {
        accept: respondSwapModal.accept,
        notes: respondSwapNotes.trim() || undefined
      })
      showToast(
        respondSwapModal.accept
          ? 'Đã xác nhận chấp nhận tiếp nhận ca trực! Ca đã được chuyển sang lịch của bạn.'
          : 'Đã từ chối tiếp nhận ca trực.'
      )
      setRespondSwapModal(null)
      setRespondSwapNotes('')
      await fetchData()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Lỗi khi phản hồi yêu cầu đổi ca.')
    } finally {
      setIsRespondingSwap(false)
    }
  }

  // Handover Acknowledge Action
  const handleAcknowledgeHandover = async (handoverId: string) => {
    setActionLoadingId(handoverId)
    try {
      await staffAssignmentService.acknowledgeHandover(handoverId, {
        status: 'ACKNOWLEDGED',
        notes: 'Nhân viên trực ca tiếp nhận đầy đủ theo biên bản'
      })
      showToast('Đã xác nhận tiếp nhận bàn giao ca thành công!')
      await fetchData()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Lỗi khi xác nhận bàn giao.')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Pagination for Roster
  const totalRosterPages = Math.ceil(filteredAssignments.length / itemsPerPage) || 1
  const paginatedAssignments = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredAssignments.slice(start, start + itemsPerPage)
  }, [filteredAssignments, currentPage, itemsPerPage])

  const isSingleDay = appliedStartDate === appliedEndDate
  const dateRangeLabel = isSingleDay
    ? `${getDayOfWeekVN(appliedStartDate)}, ${formatVN(appliedStartDate)}`
    : `${formatVN(appliedStartDate)} – ${formatVN(appliedEndDate)}`

  // My upcoming active assignment to prefill "Xin đổi ca"
  const myUpcomingAssignment = useMemo(() => {
    return assignments.find(
      a => a.staffId === user?.id && a.status === 'ASSIGNED' && !isShiftAbsent(a) && a.assignedDate >= todayStr
    )
  }, [assignments, user?.id, todayStr])

  // Current shift in facility for quick handover modal
  const currentDutyShift = useMemo(() => {
    const checked = assignments.find(a => a.staffId === user?.id && a.status === 'CHECKED_IN')
    if (checked) return checked
    return assignments.find(a => a.staffId === user?.id) || null
  }, [assignments, user?.id])

  return (
    <div className="flex flex-col gap-6 w-full text-left">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <span className="material-symbols-outlined text-emerald-400">check_circle</span>
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[28px]">schedule</span>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Lịch Trực Ca &amp; Đổi Ca Chi Nhánh
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {currentFacilityName}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                  {dateRangeLabel}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Vai trò: Nhân viên quầy
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Theo dõi lịch phân ca toàn chi nhánh, thực hiện điểm danh vào/ra ca, đề xuất đổi ca giữa nhân viên (yêu cầu Quản lý duyệt) và bàn giao ca trực.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={fetchData}
              disabled={isLoading}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <span className={`material-symbols-outlined text-[16px] ${isLoading ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>Làm mới</span>
            </button>

            {/* Shift Swap Button for Staff */}
            <button
              type="button"
              id="btn-staff-xin-doi-ca"
              onClick={() => {
                setSelectedAssignmentForSwap(myUpcomingAssignment || null)
                setShowShiftSwapModal(true)
              }}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Xin đổi ca trực với nhân viên khác cùng cơ sở (yêu cầu Quản lý cơ sở duyệt)"
            >
              <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
              <span>Xin đổi ca</span>
            </button>

            {/* Handover Button */}
            <button
              type="button"
              onClick={() => setShowHandoverModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add_task</span>
              <span>Bàn giao ca</span>
            </button>
          </div>
        </div>

        {/* Date Range Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Shortcuts */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold flex-wrap">
            <button
              type="button"
              onClick={() => applyShortcut('LAST_WEEK')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                dateShortcut === 'LAST_WEEK'
                  ? 'bg-white text-blue-700 font-bold shadow-md shadow-slate-900/10 border border-slate-200/80 ring-1 ring-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tuần trước
            </button>
            <button
              type="button"
              onClick={() => applyShortcut('THIS_WEEK')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                dateShortcut === 'THIS_WEEK'
                  ? 'bg-white text-blue-700 font-bold shadow-md shadow-slate-900/10 border border-slate-200/80 ring-1 ring-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tuần này
            </button>
            <button
              type="button"
              onClick={() => applyShortcut('NEXT_WEEK')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                dateShortcut === 'NEXT_WEEK'
                  ? 'bg-white text-blue-700 font-bold shadow-md shadow-slate-900/10 border border-slate-200/80 ring-1 ring-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tuần sau
            </button>
            <button
              type="button"
              onClick={() => applyShortcut('TODAY')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                dateShortcut === 'TODAY'
                  ? 'bg-white text-blue-700 font-bold shadow-md shadow-slate-900/10 border border-slate-200/80 ring-1 ring-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => applyShortcut('THIS_MONTH')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                dateShortcut === 'THIS_MONTH'
                  ? 'bg-white text-blue-700 font-bold shadow-md shadow-slate-900/10 border border-slate-200/80 ring-1 ring-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tháng này
            </button>
          </div>

          {/* Custom Date Inputs */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
              <span className="text-slate-400 font-medium">Từ:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value)
                  setDateShortcut('CUSTOM')
                  setDateRangeError(null)
                }}
                className="bg-transparent font-semibold text-slate-800 outline-none text-xs"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
              <span className="text-slate-400 font-medium">Đến:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value)
                  setDateShortcut('CUSTOM')
                  setDateRangeError(null)
                }}
                className="bg-transparent font-semibold text-slate-800 outline-none text-xs"
              />
            </div>

            <button
              type="button"
              onClick={handleApplyCustomDate}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">check</span>
              <span>Áp dụng</span>
            </button>

            <button
              type="button"
              onClick={handleResetDate}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              Đặt lại
            </button>
          </div>
        </div>

        {dateRangeError && (
          <div className="text-xs text-rose-600 font-semibold flex items-center gap-1 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{dateRangeError}</span>
          </div>
        )}
      </div>

      {/* 5 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* KPI 1: Tổng nhân sự cơ sở */}
        <div
          onClick={() => setActiveSubTab('STAFF')}
          className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-slate-400 hover:shadow-xs transition-all cursor-pointer group"
          title="Bấm để xem danh sách đồng nghiệp tại chi nhánh"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Tổng nhân sự cơ sở</span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-slate-200 transition-colors">
              <span className="material-symbols-outlined text-[18px]">group</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {totalStaffCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Nhân viên thuộc cơ sở {currentFacilityName}
            </div>
          </div>
        </div>

        {/* KPI 2: Đang trực ca */}
        <div
          onClick={() => {
            setActiveSubTab('ROSTER')
            setFilterStatus('CHECKED_IN')
            setCurrentPage(1)
          }}
          className={`p-4 rounded-xl bg-white border shadow-2xs flex flex-col justify-between transition-all cursor-pointer group ${
            filterStatus === 'CHECKED_IN' ? 'ring-2 ring-emerald-500 border-emerald-400' : 'border-slate-200 hover:border-emerald-300'
          }`}
          title="Bấm để lọc ca đang trực"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span>Đang trực ca</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Thời gian thực
              </span>
            </div>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
              <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-700 tracking-tight flex items-center gap-2">
              <span>{checkedInCount}</span>
              {checkedInCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  Có mặt tại quầy
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Đã điểm danh vào ca và đang có mặt làm nhiệm vụ
            </div>
          </div>
        </div>

        {/* KPI 3: Chưa vào ca */}
        <div
          onClick={() => {
            setActiveSubTab('ROSTER')
            setFilterStatus('ASSIGNED')
            setCurrentPage(1)
          }}
          className={`p-4 rounded-xl bg-white border shadow-2xs flex flex-col justify-between transition-all cursor-pointer group ${
            filterStatus === 'ASSIGNED' ? 'ring-2 ring-amber-500 border-amber-400' : 'border-slate-200 hover:border-amber-300'
          }`}
          title="Bấm để lọc ca chưa vào"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span>Chưa vào ca</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Khoảng ngày
              </span>
            </div>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors">
              <span className="material-symbols-outlined text-[18px]">pending_actions</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-700 tracking-tight flex items-center gap-2">
              <span>{assignedCount}</span>
              {assignedCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                  Chờ tới giờ
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Phân công sắp tới chưa bắt đầu
            </div>
          </div>
        </div>

        {/* KPI 4: Không đi làm (Vắng mặt) */}
        <div
          onClick={() => {
            setActiveSubTab('ROSTER')
            setFilterStatus('ABSENT')
            setCurrentPage(1)
          }}
          className={`p-4 rounded-xl bg-white border shadow-2xs flex flex-col justify-between transition-all cursor-pointer group ${
            filterStatus === 'ABSENT'
              ? 'ring-2 ring-rose-500 border-rose-400'
              : absentCount > 0
              ? 'border-rose-200 hover:border-rose-300 bg-rose-50/20'
              : 'border-slate-200 hover:border-rose-300'
          }`}
          title="Bấm để lọc ca vắng mặt"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className={absentCount > 0 ? 'text-rose-700 font-bold' : ''}>Không đi làm</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                Khoảng ngày
              </span>
            </div>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 group-hover:bg-rose-100 transition-colors">
              <span className="material-symbols-outlined text-[18px]">person_off</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-700 tracking-tight flex items-center gap-2">
              <span>{absentCount}</span>
              {absentCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                  Vắng mặt
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Hết giờ ca trực nhưng không điểm danh
            </div>
          </div>
        </div>

        {/* KPI 5: Ca trực & Hoàn thành */}
        <div
          onClick={() => {
            setActiveSubTab('ROSTER')
            setFilterStatus('ALL')
            setCurrentPage(1)
          }}
          className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-blue-300 transition-all cursor-pointer group"
          title="Bấm để xem tất cả ca trực"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span>Ca trực &amp; Hoàn thành</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Khoảng ngày
              </span>
            </div>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
              <span className="material-symbols-outlined text-[18px]">calendar_view_day</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-blue-700 tracking-tight">
              {assignments.length} ca trực
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {completedCount} hoàn thành • {distinctShiftsCount} khung ca • {pendingSwapCount} yêu cầu đổi ca
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveSubTab('ROSTER')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'ROSTER'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">view_timeline</span>
          <span>Bảng Lịch Trực &amp; Chấm Công ({assignments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('SWAPS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer relative ${
            activeSubTab === 'SWAPS'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
          <span>Yêu Cầu Đổi Ca ({swapRequests.length})</span>
          {myPendingIncomingSwaps.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold animate-pulse">
              {myPendingIncomingSwaps.length} cần xác nhận
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('HANDOVERS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'HANDOVERS'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
          <span>Biên Bản Bàn Giao Ca ({handovers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('STAFF')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'STAFF'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">badge</span>
          <span>Danh Sách Nhân Sự Cơ Sở ({staffList.length})</span>
        </button>
      </div>

      {/* SUB-TAB 1: ROSTER TABLE */}
      {activeSubTab === 'ROSTER' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-5">
          {/* Controls & Filter Bar */}
          <div className="flex flex-col gap-3 pb-3 border-b border-slate-100">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Shift Quick Filter */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['ALL', 'MORNING', 'AFTERNOON', 'NIGHT', 'FULL_DAY'] as const).map(sh => {
                  const label =
                    sh === 'ALL'
                      ? 'Tất cả ca'
                      : sh === 'MORNING'
                      ? 'Ca Sáng'
                      : sh === 'AFTERNOON'
                      ? 'Ca Chiều'
                      : sh === 'NIGHT'
                      ? 'Ca Đêm'
                      : 'Cả Ngày'
                  return (
                    <button
                      key={sh}
                      type="button"
                      onClick={() => {
                        setFilterShift(sh)
                        setCurrentPage(1)
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        filterShift === sh
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* Status and Zone dropdowns */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={filterStatus}
                  onChange={e => {
                    setFilterStatus(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="CHECKED_IN">Đang trực ca</option>
                  <option value="ASSIGNED">Chưa vào ca</option>
                  <option value="COMPLETED">Đã hoàn thành</option>
                  <option value="ABSENT">Không đi làm</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>

                <select
                  value={filterZone}
                  onChange={e => {
                    setFilterZone(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="ALL">Tất cả khu vực</option>
                  {availableZones.map(z => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>

                <select
                  value={filterStaff}
                  onChange={e => {
                    setFilterStaff(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="ALL">Tất cả nhân viên</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.fullName || s.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Box */}
            <div className="relative">
              <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Tìm kiếm theo tên nhân viên, email, khu vực trực, ghi chú..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:border-blue-500 transition"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>
          </div>

          {/* Roster Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Nhân sự</th>
                  <th className="py-3 px-4">Ngày trực</th>
                  <th className="py-3 px-4">Ca trực &amp; Khung giờ</th>
                  <th className="py-3 px-4">Khu vực &amp; Vai trò</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4 text-center">Chấm công</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                        <span className="material-symbols-outlined text-[24px]">calendar_today</span>
                      </div>
                      <p className="font-semibold text-slate-600 text-xs">Không tìm thấy ca trực nào phù hợp</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Thử đổi bộ lọc ngày hoặc khung giờ ca trực.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedAssignments.map(assignment => {
                    const isAbsent = isShiftAbsent(assignment)
                    const isCheckedIn = assignment.status === 'CHECKED_IN'
                    const isCompleted = assignment.status === 'COMPLETED'
                    const isAssigned = assignment.status === 'ASSIGNED' && !isAbsent
                    const isToday = assignment.assignedDate === todayStr
                    const isMyShift = user?.id === assignment.staffId
                    const isLoadingAction = actionLoadingId === assignment.id
                    const shiftTimeStr = formatShiftTimeRange(assignment)

                    return (
                      <tr
                        key={assignment.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isMyShift ? 'bg-blue-50/30' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              <div className={`w-9 h-9 rounded-full ${isMyShift ? 'bg-blue-600 ring-2 ring-blue-300' : 'bg-slate-800'} text-white font-bold flex items-center justify-center text-xs`}>
                                {(assignment.staffFullName || assignment.staffUsername || 'NV').slice(0, 2).toUpperCase()}
                              </div>
                              <span
                                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                                  isCheckedIn ? 'bg-emerald-500' : isCompleted ? 'bg-slate-400' : isAbsent ? 'bg-rose-500' : 'bg-amber-400'
                                }`}
                              />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                                <span>{assignment.staffFullName || assignment.staffUsername}</span>
                                {isMyShift && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                    Bạn
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                ID: {assignment.staffId || assignment.staffUsername}
                              </div>
                              <div className="text-[10px] text-slate-500">{assignment.staffEmail}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 font-mono">
                              {formatVN(assignment.assignedDate)}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 px-1.5 py-0.5 rounded bg-slate-100">
                              {getDayOfWeekVN(assignment.assignedDate)}
                            </span>
                          </div>
                          {isToday && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              Hôm nay
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800">
                            {assignment.shift === 'MORNING'
                              ? 'Ca Sáng'
                              : assignment.shift === 'AFTERNOON'
                              ? 'Ca Chiều'
                              : assignment.shift === 'NIGHT'
                              ? 'Ca Đêm (Qua đêm)'
                              : 'Cả Ngày'}
                          </div>
                          <div className="text-[11px] text-blue-600 font-mono font-semibold">{shiftTimeStr}</div>
                          {assignment.notes && (
                            <div className="text-[10px] text-slate-500 italic mt-0.5 max-w-xs truncate" title={assignment.notes}>
                              {assignment.notes}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-slate-800 font-medium">{assignment.assignedZone || 'Khu vực quầy tiếp tân'}</div>
                          <span className="inline-block px-2 py-0.5 mt-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                            {assignment.roleInShift || 'PRIMARY_STAFF'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          {isShiftForgottenCheckout(assignment) ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-rose-50 text-rose-700 border border-rose-200" title="Quên ra ca sau 23:59:59 ngày làm việc -> Ghi nhận không đi làm (0 công)">
                              Không đi làm (Quên ra ca)
                            </span>
                          ) : isAbsent ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-rose-50 text-rose-700 border border-rose-200">
                              Không đi làm
                            </span>
                          ) : isCheckedIn ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Đang trực ca
                            </span>
                          ) : isCompleted ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                              Đã hoàn thành
                            </span>
                          ) : assignment.status === 'CANCELLED' ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-rose-50 text-rose-700 border border-rose-200">
                              Đã hủy ca
                            </span>
                          ) : (
                            <span className="inline-block px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-amber-50 text-amber-700 border border-amber-200">
                              Chưa vào ca
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {assignment.checkedInAt ? (
                            <div className="text-[11px] font-mono text-emerald-700 font-semibold">
                              Vào: {new Date(assignment.checkedInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          ) : (
                            <div className={`text-[11px] font-mono ${isAbsent ? 'text-rose-500 font-semibold' : 'text-slate-400'}`}>
                              {isAbsent ? 'Vắng mặt' : 'Chưa vào'}
                            </div>
                          )}
                          {assignment.checkedOutAt ? (
                            <div className="text-[11px] font-mono text-slate-600">
                              Ra: {new Date(assignment.checkedOutAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          ) : isCheckedIn ? (
                            <div className="text-[10px] text-emerald-500 font-semibold">Đang trực...</div>
                          ) : null}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Detail Button */}
                            <button
                              type="button"
                              onClick={() => setSelectedAssignmentForDetail(assignment)}
                              className="p-1.5 hover:bg-blue-50 text-slate-500 hover:text-blue-700 rounded-lg transition-colors cursor-pointer"
                              title="Xem chi tiết ca trực"
                            >
                              <span className="material-symbols-outlined text-[16px]">visibility</span>
                            </button>

                            {/* Check-in: Only for caller's own shift within valid window */}
                            {isMyShift && isAssigned && canCheckInShift(assignment) && (
                              <button
                                type="button"
                                disabled={isLoadingAction}
                                onClick={() => handleCheckIn(assignment)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                                title="Điểm danh vào ca trực"
                              >
                                <span className="material-symbols-outlined text-[14px]">how_to_reg</span>
                                <span>Vào ca</span>
                              </button>
                            )}

                            {/* Check-out: Only for caller's own checked-in shift */}
                            {isMyShift && isCheckedIn && !isShiftForgottenCheckout(assignment) && (
                              <button
                                type="button"
                                disabled={isLoadingAction}
                                onClick={() => handleCheckOut(assignment)}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                                title="Kết thúc ca làm việc"
                              >
                                <span className="material-symbols-outlined text-[14px]">logout</span>
                                <span>Ra ca</span>
                              </button>
                            )}

                            {/* Swap Shift: Quick button for caller's own upcoming valid shift */}
                            {isMyShift && !isAbsent && assignment.status === 'ASSIGNED' && assignment.assignedDate >= todayStr && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAssignmentForSwap(assignment)
                                  setShowShiftSwapModal(true)
                                }}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                                title="Đề xuất đổi ca với đồng nghiệp"
                              >
                                <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                                <span>Đổi ca</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredAssignments.length > itemsPerPage && (
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-3 pt-3.5 border-t border-slate-100 text-xs text-slate-500">
              <div className="text-center md:text-left">
                Hiển thị <span className="font-semibold text-slate-800 font-mono">{paginatedAssignments.length}</span> trên{' '}
                <span className="font-semibold text-slate-800 font-mono">{filteredAssignments.length}</span> ca trực
              </div>
              <div className="flex items-center justify-center gap-2 md:absolute md:left-1/2 md:-translate-x-1/2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-semibold transition-colors"
                >
                  Trang trước
                </button>
                <span className="font-mono font-bold text-slate-900 px-2 py-1 rounded-md bg-slate-100 border border-slate-200">
                  {currentPage} / {totalRosterPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalRosterPages, p + 1))}
                  disabled={currentPage === totalRosterPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-semibold transition-colors"
                >
                  Trang sau
                </button>
              </div>
              <div className="hidden md:block w-28 pointer-events-none" aria-hidden="true" />
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: SWAPS (Yêu cầu đổi ca) */}
      {activeSubTab === 'SWAPS' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-slate-900">Quản Lý Đổi Ca Trực Giữa Nhân Viên</h2>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAssignmentForSwap(myUpcomingAssignment || null)
                    setShowShiftSwapModal(true)
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                  <span>Xin đổi ca</span>
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Nhân viên có thể đề xuất đổi ca trực với đồng nghiệp cùng chi nhánh. Đơn đổi ca bắt buộc phải được Quản lý cơ sở phê duyệt trước khi có hiệu lực.
              </p>
            </div>

            {/* Sub-filter: All / Incoming / Outgoing */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setSwapScopeFilter('ALL')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  swapScopeFilter === 'ALL'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ({swapRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setSwapScopeFilter('INCOMING')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  swapScopeFilter === 'INCOMING'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Gửi cho bạn ({swapRequests.filter(s => s.targetStaffId === user?.id).length})
              </button>
              <button
                type="button"
                onClick={() => setSwapScopeFilter('OUTGOING')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  swapScopeFilter === 'OUTGOING'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đơn bạn gửi ({myOutgoingSwaps.length})
              </button>
            </div>
          </div>

          {/* Regulatory Notice Banner */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-amber-600 shrink-0 mt-0.5">info</span>
            <div>
              <p className="font-bold text-amber-950">Quy trình đổi ca trực nhân sự (Staff-to-Staff Swap):</p>
              <p className="mt-0.5 text-amber-800 leading-relaxed">
                1. Nhân viên gửi đơn đề xuất đổi ca cho đồng nghiệp cùng chi nhánh. Trạng thái ban đầu: <strong>Chờ Quản lý cơ sở duyệt</strong>.<br />
                2. Quản lý cơ sở (Facility Manager) xem xét và phê duyệt đơn. Khi đã duyệt, trạng thái chuyển sang: <strong>QL đã duyệt • Chờ NV xác nhận</strong>.<br />
                3. Đồng nghiệp được chỉ định bấm <strong>[Chấp nhận]</strong> để hệ thống tự động hoán đổi ca trên bảng trực.
              </p>
            </div>
          </div>

          {filteredSwapRequests.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Hiện tại không có yêu cầu đổi ca nào phù hợp trong danh sách.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Người đề xuất</th>
                    <th className="py-3 px-4">Ca xin đổi</th>
                    <th className="py-3 px-4">Người tiếp nhận</th>
                    <th className="py-3 px-4">Lý do &amp; Ý kiến Quản lý</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSwapRequests.map(swap => {
                    const isPending = swap.status === 'PENDING'
                    const isManagerApproved = swap.status === 'MANAGER_APPROVED'
                    const isApproved = swap.status === 'APPROVED'
                    const isRejected = swap.status === 'REJECTED'
                    const isCancelled = swap.status === 'CANCELLED'
                    const isLoadingAction = actionLoadingId === swap.id
                    const isRequester = swap.requesterId === user?.id
                    const isTarget = swap.targetStaffId === user?.id

                    const isPast = Boolean(swap.assignmentDate && swap.assignmentDate < todayStr)
                    const isOverdue = (isPast && (isPending || isManagerApproved)) ||
                      (isCancelled && (Boolean(swap.managerNotes?.includes('Quá hạn')) || isPast))

                    return (
                      <tr
                        key={swap.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isTarget && isManagerApproved ? 'bg-amber-50/40 font-semibold' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <span>{swap.requesterName || swap.requesterUsername}</span>
                            {isRequester && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                Bạn
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">{swap.requesterEmail}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-blue-700">{swap.assignmentShift}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{formatVN(swap.assignmentDate)}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <span>{swap.targetStaffName || swap.targetStaffUsername}</span>
                            {isTarget && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                Bạn
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">{swap.targetStaffEmail}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-slate-700 max-w-xs truncate" title={swap.reason}>
                            {swap.reason}
                          </div>
                          {swap.managerNotes && (
                            <div className="text-[10px] text-emerald-700 italic mt-0.5">
                              ✓ QL: {swap.managerNotes}
                            </div>
                          )}
                          {swap.targetStaffNotes && (
                            <div className="text-[10px] text-blue-700 italic mt-0.5">
                              Phản hồi NV: {swap.targetStaffNotes}
                            </div>
                          )}
                          {isPending && (
                            <div className="text-[10px] text-amber-600 font-medium mt-0.5">
                              ⏳ Đang chờ Quản lý chi nhánh phê duyệt trước khi có hiệu lực
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
                              isOverdue
                                ? 'bg-slate-100 text-slate-700 border-slate-300'
                                : isApproved
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isManagerApproved
                                ? 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-300'
                                : isPending
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : isRejected
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            {isOverdue
                              ? 'Quá hạn đổi'
                              : isApproved
                              ? 'Đã hoàn tất đổi ca'
                              : isManagerApproved
                              ? 'QL đã duyệt • Chờ bạn xác nhận'
                              : isPending
                              ? 'Chờ Quản lý cơ sở duyệt'
                              : isRejected
                              ? 'Đã từ chối'
                              : 'Đã hủy'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          {isOverdue ? (
                            <span className="text-[11px] font-semibold text-slate-400 italic">
                              Hết hiệu lực
                            </span>
                          ) : isTarget && isManagerApproved ? (
                            /* Target staff confirms or rejects after manager approved */
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={isLoadingAction}
                                onClick={() => setRespondSwapModal({ swap, accept: true })}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                              >
                                <span className="material-symbols-outlined text-[15px]">check</span>
                                <span>Chấp nhận</span>
                              </button>
                              <button
                                type="button"
                                disabled={isLoadingAction}
                                onClick={() => setRespondSwapModal({ swap, accept: false })}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 rounded-lg font-semibold text-xs transition-colors cursor-pointer"
                              >
                                Từ chối
                              </button>
                            </div>
                          ) : isRequester && isPending ? (
                            /* Requester can cancel pending request */
                            <button
                              type="button"
                              disabled={isLoadingAction}
                              onClick={() => handleCancelSwap(swap.id)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg font-semibold text-xs transition-colors cursor-pointer"
                            >
                              Hủy yêu cầu
                            </button>
                          ) : isTarget && isPending ? (
                            <span className="text-[11px] text-amber-700 font-medium italic">
                              Chờ Quản lý duyệt trước
                            </span>
                          ) : isApproved ? (
                            <span className="text-[11px] text-emerald-600 font-semibold flex items-center justify-end gap-1">
                              <span className="material-symbols-outlined text-[14px]">done_all</span>
                              Đã đổi ca
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              Chỉ xem
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: HANDOVERS */}
      {activeSubTab === 'HANDOVERS' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Biên Bản Bàn Giao Ca Trực Chi Nhánh</h2>
              <p className="text-xs text-slate-500">Đối soát trách nhiệm vận hành, sự cố chưa đóng và két tiền mặt quầy giữa các ca làm việc</p>
            </div>
            <button
              type="button"
              onClick={() => setShowHandoverModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <span className="material-symbols-outlined text-[18px]">add_task</span>
              <span>Lập biên bản bàn giao ca</span>
            </button>
          </div>

          {handovers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Chưa có biên bản bàn giao ca nào tại cơ sở này trong khoảng thời gian đã chọn.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Ngày &amp; Ca</th>
                    <th className="py-3 px-4">Loại hình</th>
                    <th className="py-3 px-4">Người giao &rarr; Người nhận</th>
                    <th className="py-3 px-4">Việc tồn đọng &amp; Sự cố</th>
                    <th className="py-3 px-4 text-right">Két quầy</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {handovers.map(h => {
                    const isAck = h.status === 'ACKNOWLEDGED'
                    const isIncoming = h.incomingStaffId === user?.id
                    const isSubmitted = h.status === 'SUBMITTED'
                    const isLoadingAction = actionLoadingId === h.id

                    return (
                      <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{h.shift}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{formatVN(h.handoverDate)}</div>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded-md font-bold text-[10px] border ${
                            h.handoverType === 'EMERGENCY' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {h.handoverType === 'EMERGENCY' ? 'Bàn giao đột xuất' : 'Định kỳ đổi ca'}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">
                            <strong>{h.outgoingStaffName || h.outgoingStaffUsername}</strong>
                          </div>
                          <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                            <span>{h.incomingStaffName || h.incomingStaffUsername || '(Chờ nhận ca)'}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-slate-800 max-w-xs truncate" title={h.pendingTasks || 'Không có việc tồn đọng'}>
                            {h.pendingTasks || 'Không có việc tồn đọng'}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Ticket: <strong className="text-rose-600">{h.pendingTicketsCount}</strong> • Đơn chờ: <strong className="text-blue-600">{h.unresolvedBookingsCount}</strong>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="font-mono font-bold text-slate-900">
                            {Number(h.cashInDrawer || 0).toLocaleString('vi-VN')} đ
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                            isAck
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {isAck ? 'Đã nhận bàn giao' : 'Chờ xác nhận'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          {isIncoming && isSubmitted && !isAck ? (
                            <button
                              type="button"
                              disabled={isLoadingAction}
                              onClick={() => handleAcknowledgeHandover(h.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer"
                            >
                              Xác nhận tiếp nhận
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {isAck ? 'Hoàn tất' : 'Đang xử lý'}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: STAFF LIST */}
      {activeSubTab === 'STAFF' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Danh Sách Nhân Sự Cơ Sở {currentFacilityName}</h2>
              <p className="text-xs text-slate-500">Đồng nghiệp đang công tác tại chi nhánh có thể liên hệ hoặc đề xuất đổi ca</p>
            </div>
            <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold font-mono">
              {staffList.length} nhân viên
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Nhân viên</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Số điện thoại</th>
                  <th className="py-3 px-4">Vai trò</th>
                  <th className="py-3 px-4 text-center">Trạng thái tài khoản</th>
                  <th className="py-3 px-4 text-right">Đổi ca</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Không có nhân sự nào trong danh sách.
                    </td>
                  </tr>
                ) : (
                  staffList.map(s => {
                    const isMe = s.id === user?.id
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs">
                              {(s.fullName || s.username || 'NV').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                <span>{s.fullName || s.username}</span>
                                {isMe && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                    Bạn
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">ID: {s.id.slice(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{s.email || '—'}</td>
                        <td className="py-3 px-4 text-slate-600 font-mono">{s.phone || '—'}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                            STAFF
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            s.isActive !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {s.isActive !== false ? 'Hoạt động' : 'Tạm khóa'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {!isMe && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAssignmentForSwap(myUpcomingAssignment || null)
                                setShowShiftSwapModal(true)
                              }}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              Xin đổi ca
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: SHIFT DETAIL MODAL */}
      {selectedAssignmentForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">calendar_month</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Chi Tiết Ca Trực Nhân Viên</h3>
                  <p className="text-xs text-slate-500">Thông tin ca, nhật ký chấm công và phân bổ quầy</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAssignmentForDetail(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Nhân sự:</span>
                  <strong className="text-slate-900">
                    {selectedAssignmentForDetail.staffFullName || selectedAssignmentForDetail.staffUsername}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Ngày trực:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {formatVN(selectedAssignmentForDetail.assignedDate)} ({getDayOfWeekVN(selectedAssignmentForDetail.assignedDate)})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Khung giờ ca:</span>
                  <span className="font-bold text-blue-700 font-mono">
                    {formatShiftTimeRange(selectedAssignmentForDetail)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Khu vực phân công:</span>
                  <span className="text-slate-800 font-medium">
                    {selectedAssignmentForDetail.assignedZone || 'Quầy tiếp tân'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Trạng thái:</span>
                  <span className="font-bold text-slate-900">
                    {isShiftForgottenCheckout(selectedAssignmentForDetail)
                      ? 'Không đi làm (Quên ra ca)'
                      : isShiftAbsent(selectedAssignmentForDetail)
                      ? 'Không đi làm'
                      : selectedAssignmentForDetail.status}
                  </span>
                </div>
              </div>

              {/* Attendance timestamps */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Nhật ký chấm công
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <span className="text-slate-500">Vào thực tế:</span>{' '}
                    <strong className="text-emerald-700 font-mono">
                      {formatDateTime(selectedAssignmentForDetail.checkedInAt)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Ra thực tế:</span>{' '}
                    <strong className="text-blue-700 font-mono">
                      {selectedAssignmentForDetail.checkedOutAt
                        ? formatDateTime(selectedAssignmentForDetail.checkedOutAt)
                        : isShiftForgottenCheckout(selectedAssignmentForDetail)
                        ? 'Quên ra ca (>23:59:59)'
                        : '—'}
                    </strong>
                  </div>
                </div>
              </div>

              {selectedAssignmentForDetail.notes && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Ghi chú chỉ dẫn
                  </div>
                  <p className="text-slate-700 italic">{selectedAssignmentForDetail.notes}</p>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedAssignmentForDetail(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TARGET STAFF RESPOND TO SWAP REQUEST */}
      {respondSwapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 text-left">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className={`p-2.5 rounded-xl border ${respondSwapModal.accept ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                <span className="material-symbols-outlined text-[24px]">
                  {respondSwapModal.accept ? 'check_circle' : 'cancel'}
                </span>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {respondSwapModal.accept ? 'Xác Nhận Tiếp Nhận Đổi Ca' : 'Từ Chối Tiếp Nhận Đổi Ca'}
                </h3>
                <p className="text-xs text-slate-500">
                  {respondSwapModal.accept
                    ? 'Quản lý cơ sở đã phê duyệt đề xuất này. Bạn xác nhận tiếp quản ca trực?'
                    : 'Gửi phản hồi từ chối tiếp nhận ca trực này'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Đồng nghiệp đề xuất:</span>
                <strong className="text-slate-900">
                  {respondSwapModal.swap.requesterName || respondSwapModal.swap.requesterUsername}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Ca trực:</span>
                <span className="font-bold text-blue-700">
                  {respondSwapModal.swap.assignmentShift} ({formatVN(respondSwapModal.swap.assignmentDate)})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Lý do xin đổi:</span>
                <span className="text-slate-800 italic">{respondSwapModal.swap.reason}</span>
              </div>
              {respondSwapModal.swap.managerNotes && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Quản lý cơ sở duyệt:</span>
                  <span className="text-emerald-700 font-semibold">{respondSwapModal.swap.managerNotes}</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Ghi chú phản hồi (Tùy chọn):
              </label>
              <textarea
                value={respondSwapNotes}
                onChange={e => setRespondSwapNotes(e.target.value)}
                placeholder={respondSwapModal.accept ? 'Tôi đồng ý tiếp nhận ca trực này...' : 'Lý do từ chối...'}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-blue-500 resize-none h-20"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isRespondingSwap}
                onClick={() => setRespondSwapModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={isRespondingSwap}
                onClick={handleTargetSubmitResponse}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs ${
                  respondSwapModal.accept
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isRespondingSwap ? (
                  <span>Đang xử lý...</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">
                      {respondSwapModal.accept ? 'check' : 'close'}
                    </span>
                    <span>{respondSwapModal.accept ? 'Xác nhận nhận ca' : 'Từ chối đổi ca'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SHIFT SWAP (STAFF ONLY SWAPS WITH STAFF) */}
      {(showShiftSwapModal || selectedAssignmentForSwap) && (
        <ShiftSwapModal
          isOpen={showShiftSwapModal || !!selectedAssignmentForSwap}
          onClose={() => {
            setShowShiftSwapModal(false)
            setSelectedAssignmentForSwap(null)
          }}
          assignment={selectedAssignmentForSwap}
          facilityId={currentFacilityId}
          targetRole="STAFF"
          availableAssignments={
            assignments.filter(
              a => a.staffId === user?.id && a.status === 'ASSIGNED' && a.assignedDate >= todayStr && !isShiftAbsent(a)
            )
          }
          onSuccess={msg => {
            showToast(msg)
            void fetchData()
          }}
        />
      )}

      {/* MODAL: SHIFT HANDOVER */}
      {showHandoverModal && (
        <ShiftHandoverModal
          isOpen={showHandoverModal}
          onClose={() => setShowHandoverModal(false)}
          facilityId={currentFacilityId}
          facilityName={currentFacilityName}
          currentShift={currentDutyShift?.shift || 'MORNING'}
          outgoingAssignmentId={currentDutyShift?.id}
          onSuccess={msg => {
            showToast(msg)
            void fetchData()
          }}
        />
      )}
    </div>
  )
}
