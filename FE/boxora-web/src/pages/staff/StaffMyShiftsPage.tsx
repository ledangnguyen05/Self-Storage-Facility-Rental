import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  staffAssignmentService,
  StaffAssignmentResponse,
  ShiftSwapRequest,
  ShiftHandover,
  isShiftAbsent,
  isShiftForgottenCheckout,
  calculateShiftWorkHours
} from '../../services/staffAssignmentService'
import { ShiftSwapModal } from '../manager/modals/ShiftSwapModal'
import { ShiftHandoverModal } from '../manager/modals/ShiftHandoverModal'
import { canCheckInShift, BOXORA_SHIFTS } from '../../constants/shiftConstants'
import {
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  LogOut,
  LogIn,
  FileText,
  ChevronLeft,
  ChevronRight,
  Send,
  Building2,
  MapPin,
  CalendarDays,
  CalendarRange,
  Check,
  X,
  AlertTriangle
} from 'lucide-react'

// Utilities for date handling
const formatYMD = (d: Date): string => {
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

const formatTime = (timeStr?: string | null): string => {
  if (!timeStr) return '—'
  return timeStr.slice(0, 5)
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

const SHIFT_LABELS: Record<string, { label: string; time: string; color: string; bg: string }> = {
  MORNING: { label: 'Ca Sáng', time: '06:00 – 14:00', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  AFTERNOON: { label: 'Ca Chiều', time: '14:00 – 22:00', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  NIGHT: { label: 'Ca Đêm', time: '22:00 – 06:00', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  FULL_DAY: { label: 'Cả Ngày', time: '08:00 – 17:00', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' }
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  ASSIGNED: { label: 'Chờ trực', color: 'text-slate-700', bg: 'bg-slate-100 border-slate-300' },
  CHECKED_IN: { label: 'Đang trực', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300 animate-pulse' },
  COMPLETED: { label: 'Hoàn thành', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  ABSENT: { label: 'Không đi làm', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  CANCELLED: { label: 'Đã hủy', color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200' }
}

// Calculate week bounds (Monday to Sunday)
const getWeekRange = (refDate: Date): { from: string; to: string } => {
  const d = new Date(refDate)
  const day = d.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { from: formatYMD(monday), to: formatYMD(sunday) }
}

export const StaffMyShiftsPage: React.FC = () => {
  const { user } = useAuth()

  // Filter state
  const [filterMode, setFilterMode] = useState<string>('THIS_WEEK')
  const [fromDate, setFromDate] = useState<string>(() => getWeekRange(new Date()).from)
  const [toDate, setToDate] = useState<string>(() => getWeekRange(new Date()).to)
  const [customFrom, setCustomFrom] = useState<string>(() => getWeekRange(new Date()).from)
  const [customTo, setCustomTo] = useState<string>(() => getWeekRange(new Date()).to)
  const [dateError, setDateError] = useState<string | null>(null)

  // View state
  const [mainTab, setMainTab] = useState<'ROSTER' | 'SWAPS' | 'ATTENDANCE'>('ROSTER')
  const [rosterView, setRosterView] = useState<'LIST' | 'WEEK' | 'MONTH'>('LIST')
  const [weekRefDate, setWeekRefDate] = useState<Date>(new Date())
  const [monthRefDate, setMonthRefDate] = useState<Date>(new Date())

  // Data states
  const [assignments, setAssignments] = useState<StaffAssignmentResponse[]>([])
  const [mySwaps, setMySwaps] = useState<ShiftSwapRequest[]>([])
  const [handovers, setHandovers] = useState<ShiftHandover[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // Action / Modal states
  const [selectedShiftForDetail, setSelectedShiftForDetail] = useState<StaffAssignmentResponse | null>(null)
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [shiftForSwap, setShiftForSwap] = useState<StaffAssignmentResponse | null>(null)
  const [showHandoverModal, setShowHandoverModal] = useState(false)
  const [shiftForHandover, setShiftForHandover] = useState<StaffAssignmentResponse | null>(null)

  // Direct Check-in / Check-out modals
  const [checkInModalShift, setCheckInModalShift] = useState<StaffAssignmentResponse | null>(null)
  const [checkInNote, setCheckInNote] = useState('')
  const [checkOutModalShift, setCheckOutModalShift] = useState<StaffAssignmentResponse | null>(null)
  const [checkOutNote, setCheckOutNote] = useState('')
  const [isPunching, setIsPunching] = useState(false)

  // Shift Swap Sub-tabs & Response modal
  const [swapSubTab, setSwapSubTab] = useState<'INCOMING' | 'OUTGOING'>('INCOMING')
  const [swapResponseModal, setSwapResponseModal] = useState<{
    swap: ShiftSwapRequest
    accept: boolean
  } | null>(null)
  const [swapResponseNote, setSwapResponseNote] = useState('')
  const [isRespondingSwap, setIsRespondingSwap] = useState(false)
  const [cancelSwapTarget, setCancelSwapTarget] = useState<ShiftSwapRequest | null>(null)
  const [isCancellingSwap, setIsCancellingSwap] = useState(false)
  const todayStr = useMemo(() => formatYMD(new Date()), [])

  // Reject Handover Modal state
  const [rejectHandoverTarget, setRejectHandoverTarget] = useState<ShiftHandover | null>(null)
  const [rejectHandoverReason, setRejectHandoverReason] = useState('')
  const [isRejectingHandover, setIsRejectingHandover] = useState(false)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 4000)
  }

  // Handle shortcut date filter changes
  const applyShortcutFilter = (mode: string) => {
    setFilterMode(mode)
    setDateError(null)
    const today = new Date()

    switch (mode) {
      case 'YESTERDAY': {
        const y = new Date(today)
        y.setDate(today.getDate() - 1)
        const s = formatYMD(y)
        setFromDate(s)
        setToDate(s)
        break
      }
      case 'TODAY': {
        const s = formatYMD(today)
        setFromDate(s)
        setToDate(s)
        break
      }
      case 'TOMORROW': {
        const t = new Date(today)
        t.setDate(today.getDate() + 1)
        const s = formatYMD(t)
        setFromDate(s)
        setToDate(s)
        break
      }
      case 'THIS_WEEK': {
        const r = getWeekRange(today)
        setFromDate(r.from)
        setToDate(r.to)
        break
      }
      case 'LAST_WEEK': {
        const d = new Date(today)
        d.setDate(today.getDate() - 7)
        const r = getWeekRange(d)
        setFromDate(r.from)
        setToDate(r.to)
        break
      }
      case 'NEXT_WEEK': {
        const d = new Date(today)
        d.setDate(today.getDate() + 7)
        const r = getWeekRange(d)
        setFromDate(r.from)
        setToDate(r.to)
        break
      }
      case 'THIS_MONTH': {
        const first = new Date(today.getFullYear(), today.getMonth(), 1)
        const last = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        setFromDate(formatYMD(first))
        setToDate(formatYMD(last))
        break
      }
      case 'LAST_MONTH': {
        const first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const last = new Date(today.getFullYear(), today.getMonth(), 0)
        setFromDate(formatYMD(first))
        setToDate(formatYMD(last))
        break
      }
      case 'NEXT_MONTH': {
        const first = new Date(today.getFullYear(), today.getMonth() + 1, 1)
        const last = new Date(today.getFullYear(), today.getMonth() + 2, 0)
        setFromDate(formatYMD(first))
        setToDate(formatYMD(last))
        break
      }
      case 'ALL': {
        setFromDate('2020-01-01')
        setToDate('2035-12-31')
        break
      }
      case 'CUSTOM': {
        break
      }
    }
  }

  const handleApplyCustomDate = () => {
    if (!customFrom || !customTo) {
      setDateError('Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc.')
      return
    }
    if (customFrom > customTo) {
      setDateError('Ngày bắt đầu không được lớn hơn ngày kết thúc.')
      return
    }
    setDateError(null)
    setFilterMode('CUSTOM')
    setFromDate(customFrom)
    setToDate(customTo)
  }

  const handleResetFilter = () => {
    applyShortcutFilter('THIS_WEEK')
  }

  // Fetch all staff data
  const fetchData = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    setErrorMsg(null)
    try {
      // 1. Fetch staff assignments with date range
      const assignRes = await staffAssignmentService.getAllAssignments({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page: 0,
        size: 100
      })
      const list = assignRes?.content || (Array.isArray(assignRes) ? assignRes : [])
      setAssignments(list)

      // 2. Fetch my shift swap requests
      const swapsRes = await staffAssignmentService.getMySwapRequests()
      setMySwaps(swapsRes || [])

      // 3. Fetch recent facility handovers
      const handoverRes = await staffAssignmentService.getRecentFacilityHandovers(user.facilityId)
      setHandovers(handoverRes || [])

      setLastUpdated(new Date())
    } catch (err: any) {
      console.error('Failed to load staff shifts:', err)
      setErrorMsg(err?.response?.data?.message || err?.message || 'Lỗi khi tải dữ liệu ca làm việc.')
    } finally {
      setIsLoading(false)
    }
  }, [user, fromDate, toDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Swap splits
  const incomingSwaps = useMemo(() => {
    return mySwaps.filter(s => s.targetStaffId === user?.id)
  }, [mySwaps, user])

  const outgoingSwaps = useMemo(() => {
    return mySwaps.filter(s => s.requesterId === user?.id)
  }, [mySwaps, user])

  const pendingIncomingCount = useMemo(() => {
    return incomingSwaps.filter(s => {
      const isPast = Boolean(s.assignmentDate && s.assignmentDate < todayStr)
      return s.status === 'MANAGER_APPROVED' && !isPast
    }).length
  }, [incomingSwaps, todayStr])

  // KPIs calculated from real data
  const kpis = useMemo(() => {
    const upcoming = assignments.filter(a => a.status === 'ASSIGNED' && a.assignedDate >= todayStr).length
    const active = assignments.filter(a => a.status === 'CHECKED_IN').length
    const completed = assignments.filter(a => a.status === 'COMPLETED').length
    const pendingSwaps = pendingIncomingCount + outgoingSwaps.filter(s => {
      const isPast = Boolean(s.assignmentDate && s.assignmentDate < todayStr)
      return (s.status === 'PENDING' || s.status === 'MANAGER_APPROVED') && !isPast
    }).length

    return { upcoming, active, completed, pendingSwaps, pendingIncomingCount }
  }, [assignments, pendingIncomingCount, outgoingSwaps, todayStr])

  // Check-In Action
  const handleConfirmCheckIn = async () => {
    if (!checkInModalShift) return
    if (!canCheckInShift(checkInModalShift)) {
      showToast('Chỉ có thể điểm danh trong khung giờ của ca trực được phân công.')
      setCheckInModalShift(null)
      return
    }
    setIsPunching(true)
    try {
      await staffAssignmentService.checkIn(checkInModalShift.id, checkInNote)
      showToast('Điểm danh vào ca trực thành công!')
      setCheckInModalShift(null)
      setCheckInNote('')
      await fetchData()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Không thể điểm danh vào ca lúc này.')
    } finally {
      setIsPunching(false)
    }
  }

  // Check-Out Action
  const handleConfirmCheckOut = async () => {
    if (!checkOutModalShift) return
    setIsPunching(true)
    try {
      await staffAssignmentService.checkOut(checkOutModalShift.id, checkOutNote)
      showToast('Hoàn thành và kết thúc ca trực thành công!')
      setCheckOutModalShift(null)
      setCheckOutNote('')
      await fetchData()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Không thể kết thúc ca trực lúc này.')
    } finally {
      setIsPunching(false)
    }
  }

  // Cancel Swap Action (Triggered from modal confirm)
  const handleConfirmCancelSwap = async () => {
    if (!cancelSwapTarget) return
    setIsCancellingSwap(true)
    try {
      await staffAssignmentService.cancelSwapRequest(cancelSwapTarget.id)
      showToast('Đã hủy yêu cầu đổi ca thành công.')
      setCancelSwapTarget(null)
      await fetchData()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Không thể hủy yêu cầu.')
    } finally {
      setIsCancellingSwap(false)
    }
  }

  // Respond to Shift Swap (Accept or Decline)
  const handleConfirmSwapResponse = async () => {
    if (!swapResponseModal) return
    setIsRespondingSwap(true)
    try {
      await staffAssignmentService.respondToSwapRequest(swapResponseModal.swap.id, {
        accept: swapResponseModal.accept,
        notes: swapResponseNote.trim() || undefined
      })
      showToast(
        swapResponseModal.accept
          ? 'Đã chấp nhận tiếp nhận ca trực thành công!'
          : 'Đã từ chối tiếp nhận ca trực.'
      )
      setSwapResponseModal(null)
      setSwapResponseNote('')
      await fetchData()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Có lỗi xảy ra khi xử lý phản hồi.')
    } finally {
      setIsRespondingSwap(false)
    }
  }

  // Acknowledge Handover Action
  const handleAcknowledgeHandover = async (handoverId: string) => {
    try {
      await staffAssignmentService.acknowledgeHandover(handoverId, {
        status: 'ACKNOWLEDGED',
        notes: 'Tiếp nhận ca đầy đủ theo biên bản bàn giao'
      })
      showToast('Đã xác nhận tiếp nhận ca thành công!')
      await fetchData()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Không thể tiếp nhận ca.')
    }
  }

  // Reject Handover Action
  const handleRejectHandover = async () => {
    if (!rejectHandoverTarget) return
    if (!rejectHandoverReason.trim()) {
      showToast('Vui lòng nhập lý do từ chối nhận bàn giao ca.')
      return
    }
    setIsRejectingHandover(true)
    try {
      await staffAssignmentService.acknowledgeHandover(rejectHandoverTarget.id, {
        status: 'REJECTED',
        notes: rejectHandoverReason.trim()
      })
      showToast('Đã từ chối nhận ca và thông báo lại cho người bàn giao!')
      setRejectHandoverTarget(null)
      setRejectHandoverReason('')
      await fetchData()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Không thể từ chối nhận ca.')
    } finally {
      setIsRejectingHandover(false)
    }
  }

  // WEEK VIEW DATA
  const weekDays = useMemo(() => {
    const range = getWeekRange(weekRefDate)
    const start = new Date(range.from)
    const days: { dateStr: string; label: string; dateObj: Date }[] = []
    const dayLabels = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật']
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      days.push({
        dateStr: formatYMD(d),
        label: dayLabels[i],
        dateObj: d
      })
    }
    return days
  }, [weekRefDate])

  // MONTH VIEW DATA
  const monthCalendar = useMemo(() => {
    const year = monthRefDate.getFullYear()
    const month = monthRefDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
    const totalDays = lastDay.getDate()
    
    const days: ({ dayNum: number; dateStr: string; isCurrentMonth: boolean })[] = []
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i
      const dateStr = formatYMD(new Date(year, month - 1, d))
      days.push({ dayNum: d, dateStr, isCurrentMonth: false })
    }
    for (let i = 1; i <= totalDays; i++) {
      const dateStr = formatYMD(new Date(year, month, i))
      days.push({ dayNum: i, dateStr, isCurrentMonth: true })
    }
    const remaining = (7 - (days.length % 7)) % 7
    for (let i = 1; i <= remaining; i++) {
      const dateStr = formatYMD(new Date(year, month + 1, i))
      days.push({ dayNum: i, dateStr, isCurrentMonth: false })
    }
    return days
  }, [monthRefDate])

  const [selectedMonthDateShifts, setSelectedMonthDateShifts] = useState<{ date: string; shifts: StaffAssignmentResponse[] } | null>(null)

  return (
    <div className="flex flex-col gap-6 w-full text-left max-w-7xl mx-auto pb-12">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* 1. HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Ca làm của tôi
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {user?.facilityName || 'Cơ sở phân công'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Nhân viên: <strong className="text-slate-800">{user?.fullName || user?.username}</strong>
              {user?.email && <span className="ml-1 text-slate-400">({user.email})</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setShiftForSwap(null)
              setShowSwapModal(true)
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-2xs transition active:scale-95 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Xin đổi ca trực</span>
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => void fetchData()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Làm mới dữ liệu</span>
          </button>
        </div>
      </div>

      {/* 2. KPI METRICS CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Ca Sắp Tới */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 font-mono">
              Ca Sắp Tới
            </span>
            <span className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <CalendarDays className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
              {kpis.upcoming}
            </span>
            <p className="text-xs text-slate-500 mt-1">Ca chờ trực trong phạm vi lọc</p>
          </div>
        </div>

        {/* KPI 2: Ca Đang Diễn Ra */}
        <div className="p-5 rounded-2xl bg-white border border-emerald-200 shadow-2xs flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-700 font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Đang Trực Ca
            </span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-emerald-700 tracking-tight font-mono">
              {kpis.active}
            </span>
            <p className="text-xs text-emerald-600 mt-1">Đã check-in điểm danh hiện tại</p>
          </div>
        </div>

        {/* KPI 3: Ca Đã Hoàn Thành */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 font-mono">
              Ca Đã Hoàn Thành
            </span>
            <span className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <CheckCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
              {kpis.completed}
            </span>
            <p className="text-xs text-slate-500 mt-1">Đã check-out và chốt công</p>
          </div>
        </div>

        {/* KPI 4: Yêu Cầu Đổi Ca */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 font-mono">
              Đổi Ca Chờ Xử Lý
            </span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Send className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-amber-700 tracking-tight font-mono">
              {kpis.pendingSwaps}
            </span>
            <p className="text-xs text-slate-500 mt-1">Đơn đề xuất đang chờ Quản lý duyệt</p>
          </div>
        </div>
      </section>

      {/* 3. TIME FILTER SECTION */}
      <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Phạm Vi Lịch Ca:
            </span>
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {filterMode === 'ALL' ? 'Tất cả lịch ca' : `${formatVN(fromDate)} — ${formatVN(toDate)}`}
            </span>
          </div>

          {/* Quick shortcuts */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'YESTERDAY', label: 'Hôm qua' },
              { id: 'TODAY', label: 'Hôm nay' },
              { id: 'TOMORROW', label: 'Ngày mai' },
              { id: 'THIS_WEEK', label: 'Tuần này' },
              { id: 'LAST_WEEK', label: 'Tuần trước' },
              { id: 'NEXT_WEEK', label: 'Tuần sau' },
              { id: 'THIS_MONTH', label: 'Tháng này' },
              { id: 'ALL', label: 'Tất cả' }
            ].map(btn => (
              <button
                key={btn.id}
                type="button"
                onClick={() => applyShortcutFilter(btn.id)}
                className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition ${
                  filterMode === btn.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Từ ngày:</span>
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Đến ngày:</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
          <button
            type="button"
            onClick={handleApplyCustomDate}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs"
          >
            Áp dụng khoảng ngày
          </button>
          <button
            type="button"
            onClick={handleResetFilter}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold transition"
          >
            Đặt lại
          </button>
        </div>

        {dateError && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{dateError}</span>
          </div>
        )}
      </section>

      {/* 4. MAIN NAVIGATION TABS */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-1 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {[
            { id: 'ROSTER', label: 'Lịch Ca Làm Việc', count: assignments.length, icon: Calendar },
            { id: 'SWAPS', label: 'Yêu Cầu Đổi Ca', count: mySwaps.length, icon: Send },
            { id: 'ATTENDANCE', label: 'Lịch Sử Chấm Công', count: assignments.filter(a => a.checkedInAt).length, icon: CheckCircle }
          ].map(tab => {
            const Icon = tab.icon
            const active = mainTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMainTab(tab.id as any)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.count}
                </span>
                {tab.id === 'SWAPS' && pendingIncomingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                    {pendingIncomingCount} cần xác nhận
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* View Switcher only in ROSTER tab */}
        {mainTab === 'ROSTER' && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {[
              { id: 'LIST', label: 'Danh sách' },
              { id: 'WEEK', label: 'Lịch tuần' },
              { id: 'MONTH', label: 'Lịch tháng' }
            ].map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => setRosterView(v.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  rosterView === v.id
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => void fetchData()}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold text-xs hover:bg-rose-700"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* 5. CONTENT TABS */}

      {/* ==================== TAB 1: ROSTER ==================== */}
      {mainTab === 'ROSTER' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          {/* VIEW A: LIST / TABLE */}
          {rosterView === 'LIST' && (
            <div className="flex flex-col gap-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Ngày làm việc</th>
                      <th className="py-3 px-4">Tên ca &amp; Giờ quy định</th>
                      <th className="py-3 px-4">Cơ sở / Phân khu</th>
                      <th className="py-3 px-4">Trạng thái ca</th>
                      <th className="py-3 px-4">Chấm công thực tế</th>
                      <th className="py-3 px-4 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {assignments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <CalendarDays className="w-10 h-10 text-slate-300" />
                            <p className="font-semibold text-slate-700">Chưa có ca làm việc nào được phân công</p>
                            <p className="text-xs text-slate-400 max-w-sm">
                              Không tìm thấy ca trực trong phạm vi ngày đã chọn. Bạn có thể đổi khoảng ngày hoặc liên hệ Quản lý cơ sở để được sắp lịch.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      assignments.map(item => {
                        const isAbsent = isShiftAbsent(item)
                        const effectiveStatus = isAbsent ? 'ABSENT' : item.status
                        const shiftInfo = SHIFT_LABELS[item.shift] || { label: item.shift, time: '', color: 'text-slate-700', bg: 'bg-slate-50' }
                        const statusInfo = STATUS_LABELS[effectiveStatus] || { label: effectiveStatus, color: 'text-slate-700', bg: 'bg-slate-50' }
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                              {formatVN(item.assignedDate)}
                            </td>

                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${shiftInfo.bg} ${shiftInfo.color}`}>
                                {shiftInfo.label}
                              </span>
                              <p className="text-[11px] text-slate-500 font-mono mt-1">
                                {item.startTime && item.endTime
                                  ? `${formatTime(item.startTime)} – ${formatTime(item.endTime)}`
                                  : shiftInfo.time}
                              </p>
                            </td>

                            <td className="py-3.5 px-4">
                              <p className="font-semibold text-slate-800">{item.facilityName || 'Cơ sở'}</p>
                              <p className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {item.assignedZone ? `Khu vực: ${item.assignedZone}` : 'Toàn cơ sở'}
                              </p>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusInfo.bg} ${statusInfo.color}`}>
                                {statusInfo.label}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-[11px] font-mono">
                              <div>Vào: <strong className="text-slate-800">{item.checkedInAt ? formatDateTime(item.checkedInAt) : (isAbsent ? 'Không điểm danh' : 'Chưa điểm danh')}</strong></div>
                              <div className="mt-0.5">Ra: <strong className="text-slate-800">{item.checkedOutAt ? formatDateTime(item.checkedOutAt) : (isAbsent ? 'Không điểm danh' : 'Chưa kết thúc')}</strong></div>
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {item.status === 'ASSIGNED' && !isAbsent && canCheckInShift(item) && (
                                  <button
                                    type="button"
                                    onClick={() => setCheckInModalShift(item)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1 shadow-2xs"
                                    title="Điểm danh vào ca"
                                  >
                                    <LogIn className="w-3.5 h-3.5" />
                                    <span>Vào ca</span>
                                  </button>
                                )}

                                {item.status === 'CHECKED_IN' && (
                                  <button
                                    type="button"
                                    onClick={() => setCheckOutModalShift(item)}
                                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs inline-flex items-center gap-1 shadow-2xs"
                                    title="Kết thúc ca trực"
                                  >
                                    <LogOut className="w-3.5 h-3.5" />
                                    <span>Ra ca</span>
                                  </button>
                                )}

                                {item.status === 'ASSIGNED' && !isAbsent && item.assignedDate >= todayStr && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShiftForSwap(item)
                                      setShowSwapModal(true)
                                    }}
                                    className="px-2 py-1 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs inline-flex items-center gap-1 cursor-pointer"
                                    title="Gửi yêu cầu xin đổi ca trực"
                                  >
                                    <Send className="w-3 h-3" />
                                    <span>Đổi ca</span>
                                  </button>
                                )}

                                {!isAbsent && (item.status === 'CHECKED_IN' || item.status === 'COMPLETED') && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShiftForHandover(item)
                                      setShowHandoverModal(true)
                                    }}
                                    className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs inline-flex items-center gap-1"
                                    title="Lập biên bản bàn giao ca"
                                  >
                                    <FileText className="w-3 h-3 text-cyan-700" />
                                    <span>Bàn giao</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setSelectedShiftForDetail(item)}
                                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
                                  title="Xem chi tiết ca trực"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>
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

          {/* VIEW B: WEEK VIEW */}
          {rosterView === 'WEEK' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(weekRefDate)
                      d.setDate(d.getDate() - 7)
                      setWeekRefDate(d)
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeekRefDate(new Date())}
                    className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
                  >
                    Tuần hiện tại
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(weekRefDate)
                      d.setDate(d.getDate() + 7)
                      setWeekRefDate(d)
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-xs font-bold font-mono text-slate-800">
                  {formatVN(weekDays[0].dateStr)} – {formatVN(weekDays[6].dateStr)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                {weekDays.map(day => {
                  const dayShifts = assignments.filter(a => a.assignedDate === day.dateStr)
                  const isToday = day.dateStr === formatYMD(new Date())
                  return (
                    <div
                      key={day.dateStr}
                      className={`flex flex-col rounded-xl border p-3 min-h-[160px] ${
                        isToday ? 'border-blue-300 bg-blue-50/20 shadow-2xs' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className={`text-xs font-bold ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>
                          {day.label}
                        </span>
                        <span className={`text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                          isToday ? 'bg-blue-600 text-white font-bold' : 'text-slate-500'
                        }`}>
                          {formatVN(day.dateStr).slice(0, 5)}
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 mt-2.5 flex-1">
                        {dayShifts.length === 0 ? (
                          <div className="flex-1 flex items-center justify-center text-[11px] text-slate-400 italic">
                            Nghỉ ca
                          </div>
                        ) : (
                          dayShifts.map(s => {
                            const isAbsent = isShiftAbsent(s)
                            const effectiveStatus = isAbsent ? 'ABSENT' : s.status
                            const shiftInfo = SHIFT_LABELS[s.shift] || { label: s.shift, color: 'text-slate-700', bg: 'bg-slate-100' }
                            const statusInfo = STATUS_LABELS[effectiveStatus] || { label: effectiveStatus, color: 'text-slate-700', bg: 'bg-slate-100' }
                            return (
                              <div
                                key={s.id}
                                onClick={() => setSelectedShiftForDetail(s)}
                                className="p-2 rounded-lg border border-slate-200 bg-slate-50/80 hover:bg-blue-50/60 hover:border-blue-200 transition cursor-pointer text-left shadow-2xs"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className={`text-[10px] font-extrabold ${shiftInfo.color}`}>
                                    {shiftInfo.label}
                                  </span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${statusInfo.bg} ${statusInfo.color}`}>
                                    {statusInfo.label}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-mono mt-1">
                                  {formatTime(s.startTime)} – {formatTime(s.endTime)}
                                </p>
                                {s.assignedZone && (
                                  <p className="text-[9px] text-slate-400 truncate mt-0.5">
                                    {s.assignedZone}
                                  </p>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* VIEW C: MONTH VIEW */}
          {rosterView === 'MONTH' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(monthRefDate)
                      d.setMonth(d.getMonth() - 1)
                      setMonthRefDate(d)
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonthRefDate(new Date())}
                    className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
                  >
                    Tháng hiện tại
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(monthRefDate)
                      d.setMonth(d.getMonth() + 1)
                      setMonthRefDate(d)
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-sm font-bold text-slate-800">
                  Tháng {monthRefDate.getMonth() + 1} / {monthRefDate.getFullYear()}
                </span>
              </div>

              <div className="grid grid-cols-7 gap-1 border border-slate-200 rounded-xl overflow-hidden bg-slate-200">
                {['Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7', 'CN'].map(header => (
                  <div key={header} className="bg-slate-100 p-2 text-center text-[11px] font-bold text-slate-600 uppercase">
                    {header}
                  </div>
                ))}
                {monthCalendar.map((cell, idx) => {
                  const dayShifts = assignments.filter(a => a.assignedDate === cell.dateStr)
                  const isToday = cell.dateStr === formatYMD(new Date())
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (dayShifts.length > 0) {
                          setSelectedMonthDateShifts({ date: cell.dateStr, shifts: dayShifts })
                        }
                      }}
                      className={`min-h-[75px] p-1.5 bg-white flex flex-col justify-between transition ${
                        cell.isCurrentMonth ? 'text-slate-900' : 'text-slate-400 bg-slate-50/50'
                      } ${dayShifts.length > 0 ? 'cursor-pointer hover:bg-blue-50/40' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-mono font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                          isToday ? 'bg-blue-600 text-white' : ''
                        }`}>
                          {cell.dayNum}
                        </span>
                        {dayShifts.length > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700">
                            {dayShifts.length} ca
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col gap-1 mt-1">
                        {dayShifts.slice(0, 2).map(s => {
                          const shiftInfo = SHIFT_LABELS[s.shift] || { label: s.shift, color: 'text-slate-700' }
                          return (
                            <div key={s.id} className="text-[9px] truncate px-1 rounded bg-slate-100 text-slate-700 font-semibold">
                              {shiftInfo.label}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {selectedMonthDateShifts && (
                <div className="mt-4 p-4 rounded-xl bg-blue-50/50 border border-blue-200">
                  <div className="flex items-center justify-between pb-2 border-b border-blue-100">
                    <span className="text-xs font-bold text-blue-900">
                      Ca trực ngày {formatVN(selectedMonthDateShifts.date)} ({selectedMonthDateShifts.shifts.length} ca)
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedMonthDateShifts(null)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800"
                    >
                      Đóng
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    {selectedMonthDateShifts.shifts.map(s => (
                      <div
                        key={s.id}
                        onClick={() => setSelectedShiftForDetail(s)}
                        className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-blue-300 transition cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-blue-700">
                            {SHIFT_LABELS[s.shift]?.label || s.shift}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isShiftAbsent(s) ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {STATUS_LABELS[isShiftAbsent(s) ? 'ABSENT' : s.status]?.label || s.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono mt-1">
                          {formatTime(s.startTime)} – {formatTime(s.endTime)} · {s.facilityName}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: SWAPS ==================== */}
      {mainTab === 'SWAPS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-slate-900">Quản Lý Đổi Ca Trực</h2>
                <button
                  type="button"
                  id="btn-staff-xin-doi-ca"
                  onClick={() => {
                    const upcoming = assignments.find(a => a.status === 'ASSIGNED' && !isShiftAbsent(a) && a.assignedDate >= todayStr)
                    setShiftForSwap(upcoming || null)
                    setShowSwapModal(true)
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                  <span>Xin đổi ca</span>
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Xử lý yêu cầu đổi ca nhận từ đồng nghiệp và theo dõi các yêu cầu do bạn đề xuất (Staff chỉ đổi với Staff)
              </p>
            </div>
          </div>

          {/* Sub-Tabs: INCOMING vs OUTGOING */}
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <button
              type="button"
              onClick={() => setSwapSubTab('INCOMING')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                swapSubTab === 'INCOMING'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Yêu cầu gửi đến tôi</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                swapSubTab === 'INCOMING' ? 'bg-blue-200/80 text-blue-900' : 'bg-slate-200 text-slate-700'
              }`}>
                {incomingSwaps.length}
              </span>
              {pendingIncomingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                  {pendingIncomingCount} cần xác nhận
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSwapSubTab('OUTGOING')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                swapSubTab === 'OUTGOING'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Yêu cầu tôi đã gửi</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                swapSubTab === 'OUTGOING' ? 'bg-blue-200/80 text-blue-900' : 'bg-slate-200 text-slate-700'
              }`}>
                {outgoingSwaps.length}
              </span>
            </button>
          </div>

          {/* SUB-TAB 1: INCOMING REQUESTS */}
          {swapSubTab === 'INCOMING' && (
            <div className="flex flex-col gap-4">
              {pendingIncomingCount > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 text-amber-900 font-medium">
                    <span className="material-symbols-outlined text-[20px] text-amber-600">notifications_active</span>
                    <span>Bạn có <strong>{pendingIncomingCount}</strong> yêu cầu đổi ca trực từ đồng nghiệp đã được Quản lý duyệt và đang chờ bạn xác nhận tiếp nhận.</span>
                  </div>
                </div>
              )}

              {incomingSwaps.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Send className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">Chưa có yêu cầu đổi ca nào gửi đến bạn</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    Khi đồng nghiệp đề xuất bạn trực thay và yêu cầu được Quản lý cơ sở phê duyệt, đơn sẽ hiển thị tại đây để bạn xác nhận.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold uppercase text-[11px]">
                        <th className="py-3 px-4">Đồng nghiệp gửi yêu cầu</th>
                        <th className="py-3 px-4">Ca trực đề xuất nhận</th>
                        <th className="py-3 px-4">Lý do xin đổi</th>
                        <th className="py-3 px-4">Quản lý phê duyệt</th>
                        <th className="py-3 px-4">Trạng thái</th>
                        <th className="py-3 px-4 text-right">Phản hồi của bạn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {incomingSwaps.map(swap => {
                        const isManagerApproved = swap.status === 'MANAGER_APPROVED'
                        const isApproved = swap.status === 'APPROVED'
                        const isRejected = swap.status === 'REJECTED'
                        const isPast = Boolean(swap.assignmentDate && swap.assignmentDate < todayStr)
                        const isOverdue = (isPast && (swap.status === 'PENDING' || swap.status === 'MANAGER_APPROVED')) ||
                          (swap.status === 'CANCELLED' && (Boolean(swap.managerNotes?.includes('Quá hạn')) || isPast))

                        return (
                          <tr key={swap.id} className={`transition-colors ${isManagerApproved && !isOverdue ? 'bg-amber-50/30 hover:bg-amber-50/60' : 'hover:bg-slate-50/80'}`}>
                            <td className="py-3 px-4">
                              <strong className="text-slate-900 block text-xs">{swap.requesterName || swap.requesterUsername}</strong>
                              {swap.requesterEmail && <span className="text-slate-400 text-[11px] block">{swap.requesterEmail}</span>}
                            </td>

                            <td className="py-3 px-4">
                              <div className="font-semibold text-blue-700">{swap.assignmentShift || 'Ca trực'}</div>
                              <div className="font-mono text-slate-800 text-[11px] font-bold">{formatVN(swap.assignmentDate)}</div>
                              {swap.assignedZone && <div className="text-slate-400 text-[10px]">{swap.assignedZone}</div>}
                            </td>

                            <td className="py-3 px-4 max-w-xs text-slate-700">
                              {swap.reason}
                            </td>

                            <td className="py-3 px-4 text-[11px] text-slate-600 max-w-xs">
                              {isOverdue && !swap.managerNotes && (
                                <p className="italic text-slate-500 mb-0.5">Hệ thống tự động hủy: Quá hạn ngày đổi ca trực</p>
                              )}
                              {swap.reviewedByName && (
                                <div>Duyệt bởi: <strong className="text-slate-800">{swap.reviewedByName}</strong></div>
                              )}
                              {swap.managerNotes && (
                                <p className="italic text-emerald-700 mt-0.5">"{swap.managerNotes}"</p>
                              )}
                              {swap.reviewedAt && (
                                <span className="text-[10px] text-slate-400 block">{formatDateTime(swap.reviewedAt)}</span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                isOverdue
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : isManagerApproved
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : isApproved
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : isRejected
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-slate-50 text-slate-600 border-slate-200'
                              }`}>
                                {isOverdue
                                  ? 'Quá hạn đổi'
                                  : isManagerApproved
                                  ? 'Quản lý đã duyệt • Chờ bạn xác nhận'
                                  : isApproved
                                  ? 'Bạn đã chấp nhận • Đổi ca thành công'
                                  : isRejected
                                  ? 'Bạn đã từ chối'
                                  : 'Đã hủy'}
                              </span>
                              {swap.targetStaffNotes && (
                                <p className="text-[10px] text-slate-500 italic mt-1">Ghi chú: {swap.targetStaffNotes}</p>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right">
                              {isOverdue ? (
                                <span className="text-[11px] text-slate-400 italic">Quá hạn</span>
                              ) : isManagerApproved ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSwapResponseModal({ swap, accept: true })
                                      setSwapResponseNote('')
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Chấp nhận</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSwapResponseModal({ swap, accept: false })
                                      setSwapResponseNote('')
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Từ chối</span>
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">Đã xử lý</span>
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

          {/* SUB-TAB 2: OUTGOING REQUESTS */}
          {swapSubTab === 'OUTGOING' && (
            <div className="flex flex-col gap-4">
              {outgoingSwaps.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Send className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">Bạn chưa gửi yêu cầu đổi ca nào</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Khi cần thay đổi ca trực, bạn có thể tạo yêu cầu từ danh sách ca làm việc.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold uppercase text-[11px]">
                        <th className="py-3 px-4">Ngày ca cần đổi</th>
                        <th className="py-3 px-4">Ca trực</th>
                        <th className="py-3 px-4">Đồng nghiệp tiếp nhận</th>
                        <th className="py-3 px-4">Lý do xin đổi</th>
                        <th className="py-3 px-4">Trạng thái</th>
                        <th className="py-3 px-4">Phê duyệt / Ghi chú</th>
                        <th className="py-3 px-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {outgoingSwaps.map(swap => {
                        const isPending = swap.status === 'PENDING'
                        const isManagerApproved = swap.status === 'MANAGER_APPROVED'
                        const isApproved = swap.status === 'APPROVED'
                        const isRejected = swap.status === 'REJECTED'
                        const isCancelled = swap.status === 'CANCELLED'

                        const isPast = Boolean(swap.assignmentDate && swap.assignmentDate < todayStr)
                        const isOverdue = (isPast && (isPending || isManagerApproved)) ||
                          (isCancelled && (Boolean(swap.managerNotes?.includes('Quá hạn')) || isPast))

                        return (
                          <tr key={swap.id} className="hover:bg-slate-50/80">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">
                              {formatVN(swap.assignmentDate)}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-slate-800">{swap.assignmentShift || 'Ca trực'}</span>
                              {swap.assignedZone && <span className="text-slate-400 block text-[11px]">{swap.assignedZone}</span>}
                            </td>
                            <td className="py-3 px-4">
                              <strong className="text-slate-900">{swap.targetStaffName || swap.targetStaffUsername}</strong>
                              {swap.targetStaffEmail && <span className="text-slate-400 block text-[11px]">{swap.targetStaffEmail}</span>}
                            </td>
                            <td className="py-3 px-4 max-w-xs text-slate-600">
                              {swap.reason}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                isOverdue ? 'bg-slate-100 text-slate-700 border-slate-300' :
                                isPending ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                isManagerApproved ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                isRejected ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                'bg-slate-50 text-slate-600 border-slate-200'
                              }`}>
                                {isOverdue ? 'Quá hạn đổi' :
                                 isPending ? 'Chờ Quản lý duyệt' :
                                 isManagerApproved ? 'Quản lý đã duyệt • Chờ đồng nghiệp phản hồi' :
                                 isApproved ? 'Đồng nghiệp đã nhận • Đổi ca thành công' :
                                 isRejected ? 'Bị từ chối' : 'Đã hủy'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[11px] text-slate-500">
                              {isOverdue && !swap.managerNotes && (
                                <p className="italic text-slate-500 mb-0.5">Hệ thống tự động hủy: Quá hạn ngày đổi ca trực</p>
                              )}
                              {swap.reviewedByName && (
                                <div>Quản lý duyệt: <strong className="text-slate-800">{swap.reviewedByName}</strong></div>
                              )}
                              {swap.managerNotes && (
                                <p className="italic text-slate-600 mt-0.5">{swap.managerNotes}</p>
                              )}
                              {swap.targetStaffNotes && (
                                <p className="italic text-blue-600 mt-0.5">Ghi chú đồng nghiệp: {swap.targetStaffNotes}</p>
                              )}
                              {swap.reviewedAt && (
                                <span className="text-[10px] text-slate-400 block">{formatDateTime(swap.reviewedAt)}</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {(isPending || isManagerApproved) && !isOverdue ? (
                                <button
                                  type="button"
                                  onClick={() => setCancelSwapTarget(swap)}
                                  className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold cursor-pointer transition-colors"
                                >
                                  Hủy yêu cầu
                                </button>
                              ) : (
                                <span className="text-slate-300 font-mono text-xs">—</span>
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
        </div>
      )}

      {/* ==================== TAB 4: ATTENDANCE HISTORY ==================== */}
      {mainTab === 'ATTENDANCE' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col gap-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-base font-bold text-slate-900">Lịch sử chấm công &amp; Điểm danh</h2>
              <p className="text-xs text-slate-500">
                Đối chiếu giờ check-in và check-out thực tế so với kế hoạch phân ca. Dữ liệu được bảo toàn tự động.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>In Phiếu Chấm Công</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold uppercase text-[11px]">
                  <th className="py-3 px-4">Ngày</th>
                  <th className="py-3 px-4">Ca trực</th>
                  <th className="py-3 px-4">Giờ quy định</th>
                  <th className="py-3 px-4">Check-in thực tế</th>
                  <th className="py-3 px-4">Check-out thực tế</th>
                  <th className="py-3 px-4 text-center">Giờ công</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignments.filter(a => a.checkedInAt || a.status === 'COMPLETED').length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400 italic">
                      Chưa có dữ liệu chấm công hoàn tất trong khoảng thời gian này.
                    </td>
                  </tr>
                ) : (
                  assignments.filter(a => a.checkedInAt || a.status === 'COMPLETED').map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{formatVN(item.assignedDate)}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{SHIFT_LABELS[item.shift]?.label || item.shift}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {item.startTime && item.endTime ? `${formatTime(item.startTime)} – ${formatTime(item.endTime)}` : 'Theo ca'}
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-700 font-semibold">
                        {item.checkedInAt ? formatDateTime(item.checkedInAt) : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-blue-700 font-semibold">
                        {item.checkedOutAt ? (
                          formatDateTime(item.checkedOutAt)
                        ) : isShiftForgottenCheckout(item) ? (
                          <span className="text-rose-600 font-bold font-mono">Quên ra ca (&gt;23:59:59)</span>
                        ) : (
                          'Chưa ra ca'
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        <span className={calculateShiftWorkHours(item) > 0 ? 'text-emerald-700' : 'text-slate-400'}>
                          {calculateShiftWorkHours(item).toFixed(1)}h
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isShiftForgottenCheckout(item)
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {isShiftForgottenCheckout(item) ? 'Không đi làm (Quên ra ca)' : (STATUS_LABELS[item.status]?.label || item.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate">
                        {item.checkInNote || item.checkOutNote || item.notes || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs">
            💡 Lưu ý: Lịch sử chấm công đã xác nhận không thể tự sửa trực tiếp. Nếu có sai sót về giờ vào/ra ca, vui lòng liên hệ Quản lý cơ sở để gửi yêu cầu đối soát.
          </div>
        </div>
      )}

      {/* ==================== MODALS ==================== */}

      {/* MODAL 1: SHIFT DETAIL MODAL */}
      {selectedShiftForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 text-left relative flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900">Chi tiết ca làm việc</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedShiftForDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Ngày làm</span>
                <p className="font-mono font-bold text-slate-900 mt-0.5">{formatVN(selectedShiftForDetail.assignedDate)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Ca trực</span>
                <p className="font-bold text-blue-700 mt-0.5">{SHIFT_LABELS[selectedShiftForDetail.shift]?.label || selectedShiftForDetail.shift}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Giờ quy định</span>
                <p className="font-mono font-semibold text-slate-800 mt-0.5">
                  {selectedShiftForDetail.startTime && selectedShiftForDetail.endTime
                    ? `${formatTime(selectedShiftForDetail.startTime)} – ${formatTime(selectedShiftForDetail.endTime)}`
                    : 'Theo quy định ca'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Trạng thái</span>
                <p className={`font-bold mt-0.5 ${isShiftAbsent(selectedShiftForDetail) ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {STATUS_LABELS[isShiftAbsent(selectedShiftForDetail) ? 'ABSENT' : selectedShiftForDetail.status]?.label || selectedShiftForDetail.status}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Cơ sở kho</span>
                <p className="font-semibold text-slate-900 mt-0.5">{selectedShiftForDetail.facilityName}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Phân khu / Nhiệm vụ</span>
                <p className="font-semibold text-slate-800 mt-0.5">{selectedShiftForDetail.assignedZone || 'Toàn cơ sở'}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Chấm công thực tế</span>
              <div className="grid grid-cols-2 gap-2 mt-1 font-mono">
                <div>Check-in: <strong className="text-slate-800">{selectedShiftForDetail.checkedInAt ? formatDateTime(selectedShiftForDetail.checkedInAt) : 'Chưa điểm danh'}</strong></div>
                <div>Check-out: <strong className="text-slate-800">{selectedShiftForDetail.checkedOutAt ? formatDateTime(selectedShiftForDetail.checkedOutAt) : 'Chưa kết thúc'}</strong></div>
              </div>
              {selectedShiftForDetail.checkInNote && (
                <p className="mt-1 text-slate-600 italic">Ghi chú check-in: {selectedShiftForDetail.checkInNote}</p>
              )}
              {selectedShiftForDetail.checkOutNote && (
                <p className="mt-1 text-slate-600 italic">Ghi chú check-out: {selectedShiftForDetail.checkOutNote}</p>
              )}
            </div>

            {selectedShiftForDetail.notes && (
              <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100 text-xs">
                <span className="text-blue-900 font-bold block mb-1">Ghi chú phân công:</span>
                <p className="text-slate-700">{selectedShiftForDetail.notes}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedShiftForDetail(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CHECK-IN MODAL */}
      {checkInModalShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-left relative flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                <LogIn className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Điểm danh vào ca trực</h3>
                <p className="text-xs text-slate-500">Xác nhận có mặt và bắt đầu ca làm việc tại cơ sở</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs flex flex-col gap-1">
              <div>Ca làm: <strong className="text-slate-900">{SHIFT_LABELS[checkInModalShift.shift]?.label || checkInModalShift.shift}</strong></div>
              <div>Ngày làm: <strong className="font-mono text-slate-900">{formatVN(checkInModalShift.assignedDate)}</strong></div>
              <div>Khung giờ: <strong className="font-mono text-slate-900">{formatTime(checkInModalShift.startTime)} – {formatTime(checkInModalShift.endTime)}</strong></div>
            </div>

            {/* CẢNH BÁO QUY ĐỊNH BẮT BUỘC RA CA */}
            <div className="p-3.5 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-950 text-xs flex gap-2.5 items-start">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-rose-800 uppercase tracking-wide text-[11px]">
                  ⚠️ LƯU Ý BẮT BUỘC VỀ CHẤM CÔNG & RA CA:
                </p>
                <p className="leading-relaxed text-[11.5px] text-rose-900">
                  Khi kết thúc ca làm việc, bạn <strong>bắt buộc phải bấm "Ra ca" (Check-out)</strong>.
                </p>
                <p className="leading-relaxed text-[11.5px] text-rose-700 font-bold bg-white/70 p-1.5 rounded-lg border border-rose-200">
                  Nếu quên ra ca trước 23:59:59 của ngày làm việc, hệ thống sẽ tự động hủy tính công và ghi nhận là KHÔNG ĐI LÀM (VẮNG MẶT - 0 công).
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Ghi chú check-in (tùy chọn):</label>
              <textarea
                rows={3}
                value={checkInNote}
                onChange={e => setCheckInNote(e.target.value)}
                placeholder="Ví dụ: Đã có mặt tại quầy tiếp đón A đúng giờ, thiết bị đầy đủ..."
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isPunching}
                onClick={() => setCheckInModalShift(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isPunching}
                onClick={handleConfirmCheckIn}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {isPunching ? 'Đang ghi nhận...' : 'Xác nhận vào ca'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CHECK-OUT MODAL */}
      {checkOutModalShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-left relative flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Kết thúc ca trực (Check-out)</h3>
                <p className="text-xs text-slate-500">Xác nhận hoàn thành phiên trực và lưu giờ thực tế</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 text-xs flex flex-col gap-1">
              <div>Ca làm: <strong className="text-slate-900">{SHIFT_LABELS[checkOutModalShift.shift]?.label || checkOutModalShift.shift}</strong></div>
              <div>Ngày làm: <strong className="font-mono text-slate-900">{formatVN(checkOutModalShift.assignedDate)}</strong></div>
              <div>Thời điểm vào ca: <strong className="font-mono text-slate-900">{formatDateTime(checkOutModalShift.checkedInAt)}</strong></div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Ghi chú bàn giao / Hoàn thành ca:</label>
              <textarea
                rows={3}
                value={checkOutNote}
                onChange={e => setCheckOutNote(e.target.value)}
                placeholder="Ví dụ: Đã kiểm tra khóa kho, quầy thu ngân đối soát khớp, sẵn sàng giao ca..."
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isPunching}
                onClick={() => setCheckOutModalShift(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isPunching}
                onClick={handleConfirmCheckOut}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {isPunching ? 'Đang lưu...' : 'Xác nhận kết thúc ca'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: SHIFT SWAP MODAL */}
      {showSwapModal && (
        <ShiftSwapModal
          isOpen={showSwapModal}
          onClose={() => {
            setShowSwapModal(false)
            setShiftForSwap(null)
          }}
          assignment={shiftForSwap}
          facilityId={user?.facilityId}
          targetRole="STAFF"
          availableAssignments={assignments.filter(a => a.status !== 'COMPLETED' && a.status !== 'CANCELLED')}
          onSuccess={msg => {
            showToast(msg)
            void fetchData()
          }}
        />
      )}

      {/* MODAL 5: SHIFT HANDOVER MODAL */}
      {shiftForHandover && (
        <ShiftHandoverModal
          isOpen={showHandoverModal}
          onClose={() => {
            setShowHandoverModal(false)
            setShiftForHandover(null)
          }}
          facilityId={shiftForHandover.facilityId}
          facilityName={shiftForHandover.facilityName || user?.facilityName || 'Cơ sở'}
          currentShift={shiftForHandover.shift}
          outgoingAssignmentId={shiftForHandover.id}
          onSuccess={msg => {
            showToast(msg)
            void fetchData()
          }}
        />
      )}

      {/* MODAL 6: TARGET STAFF SWAP RESPONSE MODAL */}
      {swapResponseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-left relative flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                swapResponseModal.accept
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : 'bg-rose-50 text-rose-600 border-rose-200'
              }`}>
                {swapResponseModal.accept ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  {swapResponseModal.accept ? 'Tiếp Nhận Ca Trực Thay' : 'Từ Chối Nhận Ca Trực'}
                </h3>
                <p className="text-xs text-slate-500">
                  {swapResponseModal.accept
                    ? 'Xác nhận bạn sẽ trực thay ca này theo đề xuất của đồng nghiệp'
                    : 'Ghi nhận phản hồi không nhận ca trực này'}
                </p>
              </div>
            </div>

            {/* Shift info preview */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Đồng nghiệp gửi:</span>
                <strong className="text-slate-800">{swapResponseModal.swap.requesterName || swapResponseModal.swap.requesterUsername}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Ca trực:</span>
                <span className="font-semibold text-blue-700">{swapResponseModal.swap.assignmentShift}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Ngày làm:</span>
                <span className="font-mono font-bold text-slate-800">{formatVN(swapResponseModal.swap.assignmentDate)}</span>
              </div>
              <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-200/60">
                <span className="text-slate-500">Lý do đổi:</span>
                <span className="text-slate-700 text-right italic">{swapResponseModal.swap.reason}</span>
              </div>
              {swapResponseModal.swap.managerNotes && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-500">Quản lý duyệt:</span>
                  <span className="text-emerald-700 text-right italic">{swapResponseModal.swap.managerNotes}</span>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                {swapResponseModal.accept ? 'Ghi chú / Lời nhắn (không bắt buộc):' : 'Lý do từ chối (không bắt buộc):'}
              </label>
              <textarea
                rows={3}
                value={swapResponseNote}
                onChange={e => setSwapResponseNote(e.target.value)}
                placeholder={
                  swapResponseModal.accept
                    ? 'Ví dụ: Tôi đã sẵn sàng nhận ca này...'
                    : 'Ví dụ: Bận lịch đột xuất không thể trực thay...'
                }
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isRespondingSwap}
                onClick={() => {
                  setSwapResponseModal(null)
                  setSwapResponseNote('')
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isRespondingSwap}
                onClick={handleConfirmSwapResponse}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer transition-colors ${
                  swapResponseModal.accept
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isRespondingSwap ? 'Đang xử lý...' : (swapResponseModal.accept ? 'Xác nhận nhận ca' : 'Xác nhận từ chối')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: CANCEL SWAP CONFIRM MODAL */}
      {cancelSwapTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-left relative flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Xác nhận hủy yêu cầu đổi ca</h3>
                <p className="text-xs text-slate-500">Thao tác này sẽ hủy bỏ đề xuất đổi ca bạn đã gửi</p>
              </div>
            </div>

            {/* Info Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Ngày ca cần đổi:</span>
                <span className="font-mono font-bold text-slate-900">{formatVN(cancelSwapTarget.assignmentDate)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Ca trực:</span>
                <span className="font-semibold text-blue-700">
                  {cancelSwapTarget.assignmentShift || 'Ca trực'}
                  {cancelSwapTarget.assignedZone ? ` • ${cancelSwapTarget.assignedZone}` : ''}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Đồng nghiệp tiếp nhận:</span>
                <strong className="text-slate-800">{cancelSwapTarget.targetStaffName || cancelSwapTarget.targetStaffUsername}</strong>
              </div>
              <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-200/60">
                <span className="text-slate-500 shrink-0">Lý do xin đổi:</span>
                <span className="text-slate-700 text-right italic">{cancelSwapTarget.reason}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Sau khi hủy, yêu cầu đổi ca sẽ chuyển sang trạng thái <strong>Đã hủy</strong> và đồng nghiệp cũng như Quản lý không thể tiếp tục xử lý đơn này.
              </span>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isCancellingSwap}
                onClick={() => setCancelSwapTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-50 cursor-pointer transition-colors"
              >
                Không, giữ lại
              </button>
              <button
                type="button"
                disabled={isCancellingSwap}
                onClick={handleConfirmCancelSwap}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer transition-colors inline-flex items-center gap-1.5"
              >
                {isCancellingSwap ? 'Đang hủy...' : 'Xác nhận hủy yêu cầu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT HANDOVER MODAL */}
      {rejectHandoverTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Từ Chối Nhận Bàn Giao Ca</h3>
                  <p className="text-xs text-slate-500">
                    Biên bản {SHIFT_LABELS[rejectHandoverTarget.shift]?.label || rejectHandoverTarget.shift} · {formatVN(rejectHandoverTarget.handoverDate)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectHandoverTarget(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 space-y-1">
                <div>Người bàn giao: <strong>{rejectHandoverTarget.outgoingStaffName || rejectHandoverTarget.outgoingStaffUsername}</strong></div>
                <div>Cơ sở: <strong>{rejectHandoverTarget.facilityName}</strong></div>
                <div>Tiền sổ sách: <strong className="font-mono text-blue-700">{Number(rejectHandoverTarget.cashInDrawer || 0).toLocaleString('vi-VN')} ₫</strong></div>
                <div>Tiền thực đếm: <strong className="font-mono text-slate-900">{rejectHandoverTarget.cashCounted !== undefined && rejectHandoverTarget.cashCounted !== null ? `${Number(rejectHandoverTarget.cashCounted).toLocaleString('vi-VN')} ₫` : 'Chưa đối soát'}</strong></div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  Lý do từ chối nhận ca <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={rejectHandoverReason}
                  onChange={(e) => setRejectHandoverReason(e.target.value)}
                  placeholder="Ví dụ: Chênh lệch quỹ tiền mặt thực tế chưa được giải trình rõ, thiếu chìa khóa tủ kho, trang thiết bị bàn giao bị hư hỏng..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-hidden transition text-xs"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Lý do này sẽ được ghi vào biên bản bàn giao để gửi lại người giao ca và Quản lý cơ sở nắm bắt.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectHandoverTarget(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 font-bold transition text-xs cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isRejectingHandover || !rejectHandoverReason.trim()}
                onClick={handleRejectHandover}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold transition text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {isRejectingHandover ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Xác nhận từ chối</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StaffMyShiftsPage
