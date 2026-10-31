import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { ContractRenewal, ContractRenewalStatus, Facility } from '../../types'
import { contractService } from '../../services/contractService'
import { userService } from '../../services/userService'
import { staffAssignmentService } from '../../services/staffAssignmentService'
import { useAuth } from '../../context/AuthContext'
import { toast } from '../../utils/toast'
import { RenewalAddendumModal } from '../modals/RenewalAddendumModal'

interface ContractRenewalsManagementPanelProps {
  currentFacilityId?: string
  facilities?: Facility[]
  userRole?: string | null
  showChainWideFilter?: boolean
}

function formatDate(val?: string) {
  if (!val) return '—'
  try {
    const d = new Date(val)
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return val
  }
}

function formatDateTime(val?: string) {
  if (!val) return '—'
  try {
    const d = new Date(val)
    return d.toLocaleString('vi-VN')
  } catch {
    return val
  }
}

export interface CheckInTimeEvaluation {
  isAllowed: boolean
  status: 'BEFORE_DATE' | 'BEFORE_TIME' | 'ON_TIME' | 'LATE'
  badgeLabel: string
  badgeClass: string
  actionAdvice: string
  detailMessage: string
  formattedAppointment: string
}

export function evaluateCheckInTimeStatus(
  appointmentDate?: string,
  appointmentTime?: string
): CheckInTimeEvaluation {
  if (!appointmentDate) {
    return {
      isAllowed: true,
      status: 'ON_TIME',
      badgeLabel: 'Sẵn sàng',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      actionAdvice: 'Tiến hành tiếp nhận',
      detailMessage: 'Không yêu cầu lịch hẹn quầy cố định',
      formattedAppointment: '—'
    }
  }

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const dateStr = appointmentDate.split('T')[0]
  const timeStr = appointmentTime?.trim() || ''

  const formattedDate = formatDate(dateStr)
  const formattedAppointment = timeStr ? `${formattedDate} (${timeStr})` : formattedDate

  // 1. Chưa đến ngày check-in -> Không cho phép -> Hiển thị thời điểm được phép nhận kho
  if (todayStr < dateStr) {
    return {
      isAllowed: false,
      status: 'BEFORE_DATE',
      badgeLabel: `Chưa đến ngày (${formattedDate})`,
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-300 font-bold',
      actionAdvice: 'Hiển thị thời điểm được phép nhận kho',
      detailMessage: `Chưa đến ngày check-in. Thời điểm được phép nhận kho / tiếp đón từ: ${formattedAppointment}`,
      formattedAppointment
    }
  }

  // 2. Đúng ngày
  if (todayStr === dateStr) {
    if (timeStr) {
      const currentHours = now.getHours()
      const currentMinutes = now.getMinutes()
      const [targetH, targetM] = timeStr.split(':').map((v) => parseInt(v, 10))

      if (!isNaN(targetH) && !isNaN(targetM)) {
        const currentTotalMinutes = currentHours * 60 + currentMinutes
        const targetTotalMinutes = targetH * 60 + targetM

        // Đúng ngày nhưng chưa đến giờ check-in -> Không cho phép -> Chờ đến giờ hợp lệ
        if (currentTotalMinutes < targetTotalMinutes) {
          return {
            isAllowed: false,
            status: 'BEFORE_TIME',
            badgeLabel: `Chờ đến ${timeStr}`,
            badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 font-bold',
            actionAdvice: 'Chờ đến giờ hợp lệ',
            detailMessage: `Đúng ngày nhưng chưa đến giờ check-in (Lịch hẹn lúc ${timeStr}). Vui lòng chờ đến giờ hợp lệ.`,
            formattedAppointment
          }
        }
      }
    }

    // Đã đến giờ check-in -> Có thể -> Kiểm tra các điều kiện bàn giao còn lại
    return {
      isAllowed: true,
      status: 'ON_TIME',
      badgeLabel: 'Đã đến giờ hẹn',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
      actionAdvice: 'Kiểm tra các điều kiện bàn giao còn lại',
      detailMessage: 'Đã đến giờ check-in hợp lệ. Vui lòng kiểm tra các điều kiện đối soát còn lại.',
      formattedAppointment
    }
  }

  // 4. Khách đến muộn (todayStr > dateStr) -> Có thể -> Cho bàn giao nếu hợp đồng, lịch hẹn và các điều kiện khác vẫn hợp lệ
  return {
    isAllowed: true,
    status: 'LATE',
    badgeLabel: `Khách đến muộn (Hẹn: ${formattedDate})`,
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-300 font-bold',
    actionAdvice: 'Cho bàn giao nếu hợp đồng, lịch hẹn và các điều kiện khác vẫn hợp lệ',
    detailMessage: `Khách đến muộn so với lịch hẹn (${formattedAppointment}). Cho phép tiếp nhận nếu hợp đồng, lịch hẹn và các điều kiện khác vẫn hợp lệ.`,
    formattedAppointment
  }
}

export type RenewalFilterType =
  | 'ALL'
  | 'PENDING_REVIEW'
  | 'PENDING_SIGNATURE'
  | 'PENDING_PAYMENT'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CAN_RE_REVIEW_3D'

export function isEligibleForReReview3d(renewal?: { status?: string; createdAt?: string } | null): boolean {
  if (!renewal || renewal.status !== 'REJECTED' || !renewal.createdAt) return false
  const createdTime = new Date(renewal.createdAt).getTime()
  if (isNaN(createdTime)) return false
  const elapsedMs = Date.now() - createdTime
  return elapsedMs >= 3 * 24 * 60 * 60 * 1000
}

export const ContractRenewalsManagementPanel: React.FC<ContractRenewalsManagementPanelProps> = ({
  currentFacilityId,
  facilities = [],
  userRole,
  showChainWideFilter = false,
}) => {
  const { user } = useAuth()
  const roleName = (userRole || user?.role?.name || (typeof user?.role === 'string' ? user?.role : '') || '').toUpperCase()
  const isAdmin = roleName === 'ADMIN' || roleName === 'SYSTEM_ADMIN'
  const isManager = !isAdmin && (roleName === 'FACILITY_MANAGER' || roleName === 'BUSINESS_MANAGER')
  const isStaff = !isAdmin && roleName === 'STAFF'
  const isBusinessManager = !isAdmin && roleName === 'BUSINESS_MANAGER'

  // Query & Filter States
  const [selectedFacility, setSelectedFacility] = useState<string>(currentFacilityId || 'all')
  const [activeStatusFilter, setActiveStatusFilter] = useState<RenewalFilterType>('ALL')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const pageSize = 10

  // Data States
  const [renewals, setRenewals] = useState<ContractRenewal[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Action Modals State
  const [selectedRenewalForDetail, setSelectedRenewalForDetail] = useState<ContractRenewal | null>(null)
  const [selectedRenewalForAddendum, setSelectedRenewalForAddendum] = useState<ContractRenewal | null>(null)

  // 1. Phê duyệt (Approval)
  const [approvalTarget, setApprovalTarget] = useState<ContractRenewal | null>(null)
  const [approvalNotes, setApprovalNotes] = useState<string>('')
  const [isSubmittingApproval, setIsSubmittingApproval] = useState<boolean>(false)

  // 2. Từ chối (Rejection)
  const [rejectTarget, setRejectTarget] = useState<ContractRenewal | null>(null)
  const [rejectReason, setRejectReason] = useState<string>('')
  const [rejectError, setRejectError] = useState<string | null>(null)
  const [isSubmittingReject, setIsSubmittingReject] = useState<boolean>(false)

  // 3. Thu cước quầy đơn giản (Counter Payment cũ)
  const [counterPaymentTarget, setCounterPaymentTarget] = useState<ContractRenewal | null>(null)
  const [counterPaymentMethod, setCounterPaymentMethod] = useState<'BANK_TRANSFER'>('BANK_TRANSFER')
  const [receiptVoucherCode, setReceiptVoucherCode] = useState<string>('')
  const [counterPaymentNotes, setCounterPaymentNotes] = useState<string>('')
  const [counterPaymentError, setCounterPaymentError] = useState<string | null>(null)
  const [isSubmittingCounterPayment, setIsSubmittingCounterPayment] = useState<boolean>(false)

  // 4. Bỏ duyệt (Undo Approval)
  const [undoApprovalTarget, setUndoApprovalTarget] = useState<ContractRenewal | null>(null)
  const [undoApprovalReason, setUndoApprovalReason] = useState<string>('')
  const [undoApprovalError, setUndoApprovalError] = useState<string | null>(null)
  const [isSubmittingUndoApproval, setIsSubmittingUndoApproval] = useState<boolean>(false)

  // 5. Phân công nhân viên tiếp nhận (Assign Staff)
  const [assignStaffTarget, setAssignStaffTarget] = useState<ContractRenewal | null>(null)
  const [facilityStaffList, setFacilityStaffList] = useState<any[]>([])
  const [onDutyStaffList, setOnDutyStaffList] = useState<any[]>([])
  const [offDutyStaffList, setOffDutyStaffList] = useState<any[]>([])
  const [targetShiftInfo, setTargetShiftInfo] = useState<{
    shift: 'MORNING' | 'AFTERNOON' | 'NIGHT'
    label: string
    timeRange: string
  }>({ shift: 'MORNING', label: 'Ca Sáng (06:00 - 14:00)', timeRange: '06:00 - 14:00' })
  const [autoCreateShift, setAutoCreateShift] = useState<boolean>(true)
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [assignNotes, setAssignNotes] = useState<string>('')
  const [assignError, setAssignError] = useState<string | null>(null)
  const [isLoadingStaffList, setIsLoadingStaffList] = useState<boolean>(false)
  const [isSubmittingAssign, setIsSubmittingAssign] = useState<boolean>(false)

  // 6. Quy trình tiếp nhận 6 tiêu chí tại quầy (6-Point Professional Reception)
  const [receptionTarget, setReceptionTarget] = useState<ContractRenewal | null>(null)
  const [currentStaffShiftInfo, setCurrentStaffShiftInfo] = useState<{
    checkedIn: boolean
    shiftName?: string
    notes?: string
  }>({ checkedIn: false })
  const [receptionIdentityVerified, setReceptionIdentityVerified] = useState<boolean>(false)
  const [receptionIdentityDocType, setReceptionIdentityDocType] = useState<string>('CCCD')
  const [receptionIdentityNumber, setReceptionIdentityNumber] = useState<string>('')
  const [receptionIdentityNotes, setReceptionIdentityNotes] = useState<string>('')
  const [receptionUnitAudited, setReceptionUnitAudited] = useState<boolean>(false)
  const [receptionUnitAuditNotes, setReceptionUnitAuditNotes] = useState<string>('')
  const [receptionNoBlockingIssues, setReceptionNoBlockingIssues] = useState<boolean>(false)
  const [receptionBlockingNotes, setReceptionBlockingNotes] = useState<string>('')
  const [receptionTermsConfirmed, setReceptionTermsConfirmed] = useState<boolean>(false)
  const [receptionTermsNotes, setReceptionTermsNotes] = useState<string>('')
  const [receptionPaymentConfirmed, setReceptionPaymentConfirmed] = useState<boolean>(false)
  const [receptionPaymentMethod, setReceptionPaymentMethod] = useState<'BANK_TRANSFER'>('BANK_TRANSFER')
  const [receptionReceiptVoucherCode, setReceptionReceiptVoucherCode] = useState<string>('')
  const [receptionNotes, setReceptionNotes] = useState<string>('')
  const [receptionSignatureData, setReceptionSignatureData] = useState<string>('')
  const [receptionError, setReceptionError] = useState<string | null>(null)
  const [isSubmittingReception, setIsSubmittingReception] = useState<boolean>(false)

  // Canvas Drawing
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef<boolean>(false)

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    isDrawingRef.current = true
    const { x, y } = getCanvasCoords(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { x, y } = getCanvasCoords(e)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1e3a8a'
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    const canvas = canvasRef.current
    if (!canvas) return
    setReceptionSignatureData(canvas.toDataURL('image/png'))
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setReceptionSignatureData('')
  }

  // Fetch renewals from backend (loads full facility dataset so KPI counters remain accurate and unskewed)
  const fetchRenewals = useCallback(async () => {
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const facilityIdParam =
        selectedFacility !== 'all' && selectedFacility ? selectedFacility : (currentFacilityId && !showChainWideFilter ? currentFacilityId : undefined)

      const res = await contractService.getRenewals({
        facilityId: facilityIdParam,
        size: 300,
        sortBy: 'createdAt',
        sortDir: 'desc',
      })
      setRenewals(res.content || [])
    } catch (err: any) {
      console.error('Lỗi khi tải danh sách gia hạn:', err)
      const msg = err?.response?.data?.message || err?.message || 'Không thể tải danh sách gia hạn hợp đồng.'
      setErrorMsg(msg)
      setRenewals([])
    } finally {
      setIsLoading(false)
    }
  }, [selectedFacility, currentFacilityId, showChainWideFilter])

  useEffect(() => {
    fetchRenewals()
  }, [fetchRenewals])

  // Shift & Attendance check for reception desk
  const checkUserShiftStatus = useCallback(async (facId?: string) => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const effectiveFacId = facId || currentFacilityId || user?.facilityId
      const assignments = await staffAssignmentService.getAllAssignments({
        staffId: user?.id,
        facilityId: effectiveFacId && effectiveFacId !== 'all' ? effectiveFacId : undefined,
        assignedDate: today,
        size: 10,
      })
      const list = assignments?.content || (Array.isArray(assignments) ? assignments : [])
      const checkedInAssignment = list.find((a: any) => a.status === 'CHECKED_IN')
      if (checkedInAssignment) {
        setCurrentStaffShiftInfo({
          checkedIn: true,
          shiftName: checkedInAssignment.shift,
          notes: checkedInAssignment.notes,
        })
      } else {
        const isAdminRole = roleName === 'ADMIN' || roleName === 'SYSTEM_ADMIN' || roleName === 'BUSINESS_MANAGER'
        setCurrentStaffShiftInfo({
          checkedIn: isAdminRole,
          shiftName: isAdminRole ? 'Quyền Quản Trị Hệ Thống' : undefined,
        })
      }
    } catch {
      const isAdminRole = roleName === 'ADMIN' || roleName === 'SYSTEM_ADMIN' || roleName === 'BUSINESS_MANAGER'
      setCurrentStaffShiftInfo({ checkedIn: isAdminRole })
    }
  }, [currentFacilityId, user?.facilityId, user?.id, roleName])

  // Calculated Metrics (always computed on full facility dataset so numbers never change when filtering or changing pages)
  const metrics = useMemo(() => {
    const total = renewals.length
    const pendingReview = renewals.filter((r) => r.status === 'PENDING_REVIEW').length
    const pendingSignature = renewals.filter((r) => r.status === 'PENDING_SIGNATURE').length
    const pendingPayment = renewals.filter((r) => r.status === 'PENDING_PAYMENT').length
    const completed = renewals.filter((r) => r.status === 'COMPLETED').length
    const rejected = renewals.filter((r) => r.status === 'REJECTED').length
    const canReReview3d = renewals.filter(isEligibleForReReview3d).length

    const expectedRevenue = renewals
      .filter((r) => r.status !== 'CANCELLED' && r.status !== 'REJECTED')
      .reduce((sum, r) => sum + (Number(r.renewalFee) || 0), 0)

    const confirmedCollectedRevenue = renewals
      .filter((r) => r.status === 'COMPLETED')
      .reduce((sum, r) => sum + (Number(r.renewalFee) || 0), 0)

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    return {
      total,
      pendingReview,
      pendingSignature,
      pendingPayment,
      completed,
      rejected,
      canReReview3d,
      expectedRevenue,
      confirmedCollectedRevenue,
      completionRate,
    }
  }, [renewals])

  // Filtered dataset according to active status card, search term, and date range
  const filteredRenewals = useMemo(() => {
    let list = renewals

    if (activeStatusFilter === 'PENDING_REVIEW') {
      list = list.filter((r) => r.status === 'PENDING_REVIEW')
    } else if (activeStatusFilter === 'PENDING_SIGNATURE') {
      list = list.filter((r) => r.status === 'PENDING_SIGNATURE')
    } else if (activeStatusFilter === 'PENDING_PAYMENT') {
      list = list.filter((r) => r.status === 'PENDING_PAYMENT')
    } else if (activeStatusFilter === 'COMPLETED') {
      list = list.filter((r) => r.status === 'COMPLETED')
    } else if (activeStatusFilter === 'REJECTED') {
      list = list.filter((r) => r.status === 'REJECTED')
    } else if (activeStatusFilter === 'CAN_RE_REVIEW_3D') {
      list = list.filter(isEligibleForReReview3d)
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase()
      list = list.filter((r) => {
        return (
          r.id?.toLowerCase().includes(term) ||
          r.contractCode?.toLowerCase().includes(term) ||
          r.unitCode?.toLowerCase().includes(term) ||
          r.customerName?.toLowerCase().includes(term) ||
          r.customerEmail?.toLowerCase().includes(term) ||
          r.facilityName?.toLowerCase().includes(term) ||
          r.receiptVoucherCode?.toLowerCase().includes(term)
        )
      })
    }

    if (fromDate) {
      const fromTime = new Date(fromDate).setHours(0, 0, 0, 0)
      list = list.filter((r) => r.createdAt && new Date(r.createdAt).getTime() >= fromTime)
    }
    if (toDate) {
      const toTime = new Date(toDate).setHours(23, 59, 59, 999)
      list = list.filter((r) => r.createdAt && new Date(r.createdAt).getTime() <= toTime)
    }

    return list
  }, [renewals, activeStatusFilter, searchTerm, fromDate, toDate])

  const totalItems = filteredRenewals.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages)

  const paginatedRenewals = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize
    return filteredRenewals.slice(startIndex, startIndex + pageSize)
  }, [filteredRenewals, safeCurrentPage, pageSize])

  const handleFilterSelect = (filterKey: RenewalFilterType) => {
    setActiveStatusFilter(filterKey)
    setCurrentPage(1)
  }

  // Reset pagination to page 1 whenever any filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedFacility, activeStatusFilter, searchTerm, fromDate, toDate])

  // Handlers
  const handleApprove = async () => {
    if (!approvalTarget) return
    setIsSubmittingApproval(true)
    setErrorMsg(null)
    try {
      await contractService.approveRenewal(approvalTarget.id, approvalNotes)
      setSuccessMsg(`Đã phê duyệt yêu cầu gia hạn #${approvalTarget.contractCode} thành công. Khách hàng có thể ký phụ lục.`)
      setApprovalTarget(null)
      setApprovalNotes('')
      await fetchRenewals()
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Phê duyệt thất bại. Vui lòng kiểm tra lại quyền hạn.'
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setIsSubmittingApproval(false)
    }
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    if (!rejectReason.trim()) {
      setRejectError('Bắt buộc phải nhập lý do từ chối yêu cầu gia hạn.')
      return
    }
    setIsSubmittingReject(true)
    setRejectError(null)
    try {
      await contractService.rejectRenewal(rejectTarget.id, rejectReason.trim())
      setSuccessMsg(`Đã từ chối yêu cầu gia hạn #${rejectTarget.contractCode}. Khách hàng có thể kích hoạt duyệt lại sau 3 ngày.`)
      setRejectTarget(null)
      setRejectReason('')
      await fetchRenewals()
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Từ chối yêu cầu thất bại.'
      setRejectError(msg)
    } finally {
      setIsSubmittingReject(false)
    }
  }

  const handleReactivate = async (renewal: ContractRenewal) => {
    if (!window.confirm(`Bạn có chắc chắn muốn kích hoạt duyệt lại yêu cầu gia hạn #${renewal.contractCode}?`)) return
    try {
      await contractService.reactivateRenewal(renewal.id)
      setSuccessMsg(`Đã kích hoạt duyệt lại yêu cầu gia hạn #${renewal.contractCode} thành công. Trạng thái đã chuyển về Chờ QL Duyệt.`)
      await fetchRenewals()
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể kích hoạt duyệt lại yêu cầu gia hạn.'
      setErrorMsg(msg)
      toast.error(msg)
    }
  }

  const handleUndoApprovalSubmit = async () => {
    if (!undoApprovalTarget) return
    setIsSubmittingUndoApproval(true)
    setUndoApprovalError(null)
    try {
      await contractService.undoApproval(undoApprovalTarget.id, undoApprovalReason.trim() || undefined)
      setSuccessMsg(`Đã thu hồi phê duyệt yêu cầu #${undoApprovalTarget.contractCode}. Trạng thái đã quay về Chờ xét duyệt.`)
      setUndoApprovalTarget(null)
      setUndoApprovalReason('')
      await fetchRenewals()
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể bỏ duyệt yêu cầu gia hạn.'
      setUndoApprovalError(msg)
    } finally {
      setIsSubmittingUndoApproval(false)
    }
  }

  const handleOpenAssignStaff = async (r: ContractRenewal) => {
    setAssignStaffTarget(r)
    setSelectedStaffId(r.assignedStaffId || '')
    setAssignNotes('')
    setAssignError(null)
    setAutoCreateShift(true)
    setIsLoadingStaffList(true)

    // Xác định ca trực bao phủ giờ hẹn của khách
    const appointmentDate = r.counterAppointmentDate || new Date().toISOString().split('T')[0]
    const appointmentTime = r.counterAppointmentTime || ''
    let shift: 'MORNING' | 'AFTERNOON' | 'NIGHT' = 'MORNING'
    let label = 'Ca Sáng (06:00 - 14:00)'
    let timeRange = '06:00 - 14:00'

    if (appointmentTime) {
      const hour = parseInt(appointmentTime.split(':')[0], 10)
      if (!isNaN(hour)) {
        if (hour >= 6 && hour < 14) {
          shift = 'MORNING'
          label = 'Ca Sáng (06:00 - 14:00)'
          timeRange = '06:00 - 14:00'
        } else if (hour >= 14 && hour < 22) {
          shift = 'AFTERNOON'
          label = 'Ca Chiều (14:00 - 22:00)'
          timeRange = '14:00 - 22:00'
        } else {
          shift = 'NIGHT'
          label = 'Ca Đêm (22:00 - 06:00)'
          timeRange = '22:00 - 06:00'
        }
      }
    }
    setTargetShiftInfo({ shift, label, timeRange })

    try {
      // 1. Lấy toàn bộ nhân sự (STAFF và FACILITY_MANAGER) thuộc cơ sở
      const res = await userService.getAllUsers({ facilityId: r.facilityId, size: 100 })
      const rawUsers = res?.data || (Array.isArray(res) ? res : (res as any)?.content || [])
      const eligibleUsers = rawUsers.filter((u: any) => {
        const role = (u.roleName || u.role?.name || '').toUpperCase()
        return u.isActive !== false && (role === 'STAFF' || role === 'FACILITY_MANAGER')
      })
      setFacilityStaffList(eligibleUsers)

      // 2. Lấy bảng ca trực của cơ sở vào ngày hẹn
      let dailyBoard: any[] = []
      try {
        dailyBoard = (await staffAssignmentService.getDailyBoard(r.facilityId, appointmentDate)) || []
      } catch {
        dailyBoard = []
      }

      // Phân nhóm: Đang trong ca trực vs Chưa có ca trực (Gợi ý)
      const onDuty = eligibleUsers.filter((u: any) =>
        dailyBoard.some((b: any) =>
          b.staffId === u.id &&
          (b.shift === shift || b.shift === 'FULL_DAY') &&
          b.status !== 'CANCELLED' &&
          b.status !== 'ABSENT'
        )
      )

      const offDuty = eligibleUsers.filter((u: any) => !onDuty.some((od: any) => od.id === u.id))

      setOnDutyStaffList(onDuty)
      setOffDutyStaffList(offDuty)

      // Chọn mặc định nhân sự
      if (r.assignedStaffId && eligibleUsers.some((u: any) => u.id === r.assignedStaffId)) {
        setSelectedStaffId(r.assignedStaffId)
      } else if (onDuty.length > 0) {
        setSelectedStaffId(onDuty[0].id)
      } else if (offDuty.length > 0) {
        setSelectedStaffId(offDuty[0].id)
      } else {
        setSelectedStaffId('')
      }
    } catch {
      setFacilityStaffList([])
      setOnDutyStaffList([])
      setOffDutyStaffList([])
    } finally {
      setIsLoadingStaffList(false)
    }
  }

  const handleAssignStaffSubmit = async () => {
    if (!assignStaffTarget || !selectedStaffId) return
    setIsSubmittingAssign(true)
    setAssignError(null)
    try {
      await contractService.assignStaff(assignStaffTarget.id, {
        staffId: selectedStaffId,
        notes: assignNotes.trim() || undefined,
        autoCreateShift: autoCreateShift,
      })
      const chosen = facilityStaffList.find((u: any) => u.id === selectedStaffId)
      const chosenName = chosen?.fullName || chosen?.username || 'nhân sự'
      setSuccessMsg(`Đã phân tiếp đón cho ${chosenName} (Hợp đồng #${assignStaffTarget.contractCode}) thành công.`)
      setAssignStaffTarget(null)
      await fetchRenewals()
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Phân tiếp đón nhân viên thất bại.'
      setAssignError(msg)
    } finally {
      setIsSubmittingAssign(false)
    }
  }

  const handleOpenReception = (r: ContractRenewal) => {
    setReceptionTarget(r)
    setReceptionIdentityVerified(false)
    setReceptionIdentityDocType('CCCD')
    setReceptionIdentityNumber('')
    setReceptionIdentityNotes('')
    setReceptionUnitAudited(false)
    setReceptionUnitAuditNotes('')
    setReceptionNoBlockingIssues(false)
    setReceptionBlockingNotes('')
    setReceptionTermsConfirmed(false)
    setReceptionTermsNotes('')
    setReceptionPaymentConfirmed(false)
    setReceptionPaymentMethod('BANK_TRANSFER')
    setReceptionReceiptVoucherCode(`PT-${Date.now().toString().slice(-6)}`)
    setReceptionNotes('')
    setReceptionSignatureData('')
    setReceptionError(null)
    void checkUserShiftStatus(r.facilityId)
  }

  const handleReceptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!receptionTarget) return

    const timeEval = evaluateCheckInTimeStatus(receptionTarget.counterAppointmentDate, receptionTarget.counterAppointmentTime)
    if (!timeEval.isAllowed) {
      setReceptionError(timeEval.detailMessage)
      return
    }

    if (!receptionIdentityVerified || !receptionUnitAudited || !receptionNoBlockingIssues || !receptionTermsConfirmed || !receptionPaymentConfirmed) {
      setReceptionError('Bắt buộc phải đối soát và tích chọn xác nhận đầy đủ 5 tiêu chí bắt buộc trước khi hoàn tất tiếp nhận.')
      return
    }

    setIsSubmittingReception(true)
    setReceptionError(null)
    try {
      await contractService.completeReception(receptionTarget.id, {
        identityVerified: receptionIdentityVerified,
        identityDocType: receptionIdentityDocType,
        identityNumber: receptionIdentityNumber.trim() || undefined,
        identityNotes: receptionIdentityNotes.trim() || undefined,
        unitAudited: receptionUnitAudited,
        unitAuditNotes: receptionUnitAuditNotes.trim() || undefined,
        noBlockingIssues: receptionNoBlockingIssues,
        blockingNotes: receptionBlockingNotes.trim() || undefined,
        termsConfirmed: receptionTermsConfirmed,
        termsNotes: receptionTermsNotes.trim() || undefined,
        paymentConfirmed: receptionPaymentConfirmed,
        paymentMethod: receptionPaymentMethod,
        receiptVoucherCode: receptionReceiptVoucherCode.trim() || undefined,
        signatureData: receptionSignatureData.trim() || undefined,
        receptionNotes: receptionNotes.trim() || undefined,
      })

      setSuccessMsg(`Đã tiếp nhận và hoàn tất gia hạn hợp đồng #${receptionTarget.contractCode} thành công! Hợp đồng đã kéo dài đến ${formatDate(receptionTarget.newEndDate)}.`)
      setReceptionTarget(null)
      await fetchRenewals()
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Tiếp nhận gia hạn thất bại. Vui lòng kiểm tra ca trực và điều kiện đối soát.'
      setReceptionError(msg)
    } finally {
      setIsSubmittingReception(false)
    }
  }

  const handleCounterPayment = async () => {
    if (!counterPaymentTarget) return
    setIsSubmittingCounterPayment(true)
    setCounterPaymentError(null)
    try {
      await contractService.recordCounterPayment(counterPaymentTarget.id, {
        paymentMethod: counterPaymentMethod,
        receiptVoucherCode: receiptVoucherCode.trim() || undefined,
        notes: counterPaymentNotes.trim() || undefined,
      })
      setSuccessMsg(`Ghi nhận thu cước gia hạn #${counterPaymentTarget.contractCode} tại quầy thành công!`)
      setCounterPaymentTarget(null)
      setReceiptVoucherCode('')
      setCounterPaymentNotes('')
      await fetchRenewals()
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể ghi nhận thu cước tại quầy.'
      setCounterPaymentError(msg)
    } finally {
      setIsSubmittingCounterPayment(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Alert banners */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">check_circle</span>
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-600">error</span>
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-700 hover:text-rose-900 cursor-pointer">✕</button>
        </div>
      )}

      {/* KPI Overview Cards - Interactive Filter Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          {
            key: 'ALL' as RenewalFilterType,
            title: 'Tổng YC Gia Hạn',
            count: metrics.total,
            icon: 'autorenew',
            subtext: `Tỷ lệ: ${metrics.completionRate}% xong`,
            activeClass: 'ring-2 ring-slate-800 border-slate-800 bg-slate-100 shadow-md',
            inactiveClass: 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs',
            countClass: 'text-slate-900',
            iconClass: 'text-slate-500',
            subtextClass: 'text-slate-500',
            badgeClass: 'bg-slate-800 text-white',
          },
          {
            key: 'PENDING_REVIEW' as RenewalFilterType,
            title: 'Chờ QL Duyệt',
            count: metrics.pendingReview,
            icon: 'pending_actions',
            subtext: 'Cần thẩm định',
            activeClass: 'ring-2 ring-amber-500 border-amber-500 bg-amber-50 shadow-md',
            inactiveClass: 'border-amber-200 bg-amber-50/20 hover:border-amber-300 hover:bg-amber-50/50 shadow-2xs',
            countClass: 'text-amber-900',
            iconClass: 'text-amber-600',
            subtextClass: 'text-amber-700',
            badgeClass: 'bg-amber-600 text-white',
          },
          {
            key: 'PENDING_SIGNATURE' as RenewalFilterType,
            title: 'Chờ Ký Phụ Lục',
            count: metrics.pendingSignature,
            icon: 'draw',
            subtext: 'Đã duyệt • Tiếp nhận',
            activeClass: 'ring-2 ring-blue-600 border-blue-600 bg-blue-50 shadow-md',
            inactiveClass: 'border-blue-200 bg-blue-50/20 hover:border-blue-300 hover:bg-blue-50/50 shadow-2xs',
            countClass: 'text-blue-900',
            iconClass: 'text-blue-600',
            subtextClass: 'text-blue-700',
            badgeClass: 'bg-blue-600 text-white',
          },
          {
            key: 'PENDING_PAYMENT' as RenewalFilterType,
            title: 'Chờ Thanh Toán',
            count: metrics.pendingPayment,
            icon: 'payments',
            subtext: 'Online / Tại quầy',
            activeClass: 'ring-2 ring-indigo-600 border-indigo-600 bg-indigo-50 shadow-md',
            inactiveClass: 'border-indigo-200 bg-indigo-50/20 hover:border-indigo-300 hover:bg-indigo-50/50 shadow-2xs',
            countClass: 'text-indigo-900',
            iconClass: 'text-indigo-600',
            subtextClass: 'text-indigo-700',
            badgeClass: 'bg-indigo-600 text-white',
          },
          {
            key: 'COMPLETED' as RenewalFilterType,
            title: 'Đã Hoàn Tất',
            count: metrics.completed,
            icon: 'check_circle',
            subtext: `${metrics.confirmedCollectedRevenue.toLocaleString('vi-VN')} ₫`,
            activeClass: 'ring-2 ring-emerald-600 border-emerald-600 bg-emerald-50 shadow-md',
            inactiveClass: 'border-emerald-200 bg-emerald-50/20 hover:border-emerald-300 hover:bg-emerald-50/50 shadow-2xs',
            countClass: 'text-emerald-900',
            iconClass: 'text-emerald-600',
            subtextClass: 'text-emerald-700',
            badgeClass: 'bg-emerald-600 text-white',
          },
          {
            key: 'REJECTED' as RenewalFilterType,
            title: 'Bị Từ Chối',
            count: metrics.rejected,
            icon: 'cancel',
            subtext: 'Tất cả đơn từ chối',
            activeClass: 'ring-2 ring-rose-500 border-rose-500 bg-rose-50 shadow-md',
            inactiveClass: 'border-rose-200 bg-rose-50/20 hover:border-rose-300 hover:bg-rose-50/50 shadow-2xs',
            countClass: 'text-rose-900',
            iconClass: 'text-rose-600',
            subtextClass: 'text-rose-700',
            badgeClass: 'bg-rose-600 text-white',
          },
          {
            key: 'CAN_RE_REVIEW_3D' as RenewalFilterType,
            title: 'Duyệt lại sau 3d',
            count: metrics.canReReview3d,
            icon: 'history',
            subtext: 'Đủ điều kiện xét lại',
            activeClass: 'ring-2 ring-purple-600 border-purple-600 bg-purple-50 shadow-md',
            inactiveClass: 'border-purple-200 bg-purple-50/20 hover:border-purple-300 hover:bg-purple-50/50 shadow-2xs',
            countClass: 'text-purple-900',
            iconClass: 'text-purple-600',
            subtextClass: 'text-purple-700',
            badgeClass: 'bg-purple-600 text-white',
          },
        ].map((card) => {
          const isActive = activeStatusFilter === card.key
          return (
            <button
              key={card.key}
              type="button"
              role="button"
              aria-pressed={isActive}
              onClick={() => handleFilterSelect(card.key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleFilterSelect(card.key)
                }
              }}
              className={`p-3.5 rounded-xl border text-left transition-all duration-150 relative flex flex-col justify-between cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 select-none ${
                isActive ? card.activeClass : card.inactiveClass
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className={`text-[11px] font-bold uppercase tracking-wider block truncate ${card.countClass}`}>
                  {card.title}
                </span>
                {isActive && (
                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold ${card.badgeClass}`}>
                    <span className="material-symbols-outlined text-[10px]">check</span>
                    <span>Lọc</span>
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-baseline justify-between">
                <span className={`text-xl sm:text-2xl font-mono font-extrabold ${card.countClass}`}>
                  {card.count}
                </span>
                <span className={`material-symbols-outlined text-[20px] sm:text-[22px] ${card.iconClass}`}>
                  {card.icon}
                </span>
              </div>
              <span className={`text-[10px] mt-1 block truncate font-medium ${card.subtextClass}`}>
                {card.subtext}
              </span>
            </button>
          )
        })}
      </div>

      {/* Financial Summary Card for Manager / Business Operations */}
      <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-400 text-[20px]">account_balance_wallet</span>
            <h4 className="font-headline text-sm font-bold text-white">Doanh Số Gia Hạn Hợp Đồng</h4>
          </div>
          <p className="text-xs text-slate-400">
            Phân định rõ ràng giữa tổng doanh thu dự kiến và tiền mặt/chuyển khoản đã thực thu vào tài khoản cơ sở
          </p>
        </div>
        <div className="flex items-center gap-6 divide-x divide-slate-800 font-mono">
          <div>
            <span className="text-[10px] uppercase text-slate-400 block font-sans">Doanh Thu Dự Kiến</span>
            <span className="text-base sm:text-lg font-bold text-blue-300">
              {metrics.expectedRevenue.toLocaleString('vi-VN')} ₫
            </span>
          </div>
          <div className="pl-6">
            <span className="text-[10px] uppercase text-emerald-400 block font-sans">Đã Thu Thực Tế</span>
            <span className="text-base sm:text-lg font-extrabold text-emerald-400">
              {metrics.confirmedCollectedRevenue.toLocaleString('vi-VN')} ₫
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar (old status dropdown completely removed, filtering handled via status cards above) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          {/* Facility Filter */}
          {(showChainWideFilter || isBusinessManager) && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
              <span className="material-symbols-outlined text-[16px] text-slate-500">store</span>
              <select
                value={selectedFacility}
                onChange={(e) => setSelectedFacility(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                {showChainWideFilter && <option value="all">Tất cả cơ sở</option>}
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Term */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl flex-1 min-w-[200px]">
            <span className="material-symbols-outlined text-[16px] text-slate-400">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo mã HĐ, mã kho, tên/email khách hàng..."
              className="bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none w-full"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Date Filter Range */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
            <span className="material-symbols-outlined text-[16px] text-slate-500">calendar_today</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              title="Từ ngày"
              className="bg-transparent text-slate-700 focus:outline-none cursor-pointer text-xs"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              title="Đến ngày"
              className="bg-transparent text-slate-700 focus:outline-none cursor-pointer text-xs"
            />
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setFromDate('')
                  setToDate('')
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer ml-0.5 text-[11px]"
                title="Xóa lọc ngày"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchRenewals}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="Tải lại dữ liệu mới nhất từ máy chủ"
          >
            <span className="material-symbols-outlined text-[15px]">refresh</span>
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Renewals Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-mono uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Mã YC / Ngày Yêu Cầu</th>
                <th className="py-3 px-4 font-semibold">Khách Hàng</th>
                <th className="py-3 px-4 font-semibold">Hợp Đồng / Kho</th>
                <th className="py-3 px-4 font-semibold">Cơ Sở / Phân Tiếp Đón</th>
                <th className="py-3 px-4 font-semibold">Thời Hạn Mới</th>
                <th className="py-3 px-4 font-semibold text-right">Phí Gia Hạn</th>
                <th className="py-3 px-4 font-semibold text-center">Trạng Thái</th>
                <th className="py-3 px-4 font-semibold text-right">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    <div className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                      <span>Đang nạp dữ liệu gia hạn hợp đồng từ cơ sở dữ liệu...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRenewals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[32px] text-slate-300">filter_alt_off</span>
                      <span>Không tìm thấy yêu cầu gia hạn nào phù hợp với bộ lọc hiện tại.</span>
                      {activeStatusFilter !== 'ALL' && (
                        <button
                          type="button"
                          onClick={() => handleFilterSelect('ALL')}
                          className="mt-1 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition cursor-pointer"
                        >
                          Xem tất cả ({metrics.total} yêu cầu)
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRenewals.map((r) => {
                  const timeEval = r.paymentMethod === 'COUNTER' ? evaluateCheckInTimeStatus(r.counterAppointmentDate, r.counterAppointmentTime) : null

                  return (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-slate-900">#{r.id.slice(0, 8)}...</div>
                      <div className="text-[11px] text-slate-400">{formatDateTime(r.createdAt)}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{r.customerName}</div>
                      <div className="text-[11px] text-slate-500">{r.customerEmail}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-blue-600">#{r.contractCode}</div>
                      <div className="text-[11px] text-slate-500 font-medium">Kho #{r.unitCode}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-800 font-medium">{r.facilityName || 'Boxora Facility'}</div>
                      {r.assignedStaffName ? (
                        <div className="text-[11px] text-purple-700 font-bold flex items-center gap-1 mt-0.5">
                          <span className="material-symbols-outlined text-[13px]">person_check</span>
                          <span>NV tiếp đón: {r.assignedStaffName}</span>
                        </div>
                      ) : r.paymentMethod === 'COUNTER' ? (
                        <div className="text-[10px] text-amber-700 font-medium mt-0.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px] text-amber-600">person_alert</span>
                          <span>Chưa phân tiếp đón</span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-blue-600 mt-0.5 font-medium flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px] text-blue-500">public</span>
                          <span>Trực tuyến (Không cần tiếp đón)</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-emerald-700">{formatDate(r.newEndDate)}</div>
                      <div className="text-[11px] text-slate-500">+{r.cycleMonths} tháng (từ {formatDate(r.oldEndDate)})</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-right">
                      {Number(r.renewalFee || 0).toLocaleString('vi-VN')} ₫
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {r.status === 'PENDING_REVIEW' && (
                        <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                          Chờ QL Duyệt
                        </span>
                      )}
                      {r.status === 'PENDING_SIGNATURE' && (
                        <div>
                          <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-300">
                            Chờ Ký Phụ Lục
                          </span>
                          {r.paymentMethod === 'COUNTER' && timeEval ? (
                            <div className="mt-1 flex flex-col items-center gap-0.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] border ${timeEval.badgeClass}`}>
                                <span className="material-symbols-outlined text-[12px]">
                                  {timeEval.status === 'BEFORE_DATE' ? 'event_busy' : timeEval.status === 'BEFORE_TIME' ? 'hourglass_top' : timeEval.status === 'LATE' ? 'history_toggle_off' : 'storefront'}
                                </span>
                                <span>Hẹn: {timeEval.formattedAppointment}</span>
                              </span>
                              <span className="text-[9px] font-semibold text-slate-500">
                                {timeEval.badgeLabel}
                              </span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-blue-600 font-medium mt-0.5">
                              Trực tuyến
                            </div>
                          )}
                        </div>
                      )}
                      {r.status === 'PENDING_PAYMENT' && (
                        <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-300">
                          Chờ Thanh Toán
                        </span>
                      )}
                      {r.status === 'COMPLETED' && (
                        <div>
                          <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Hoàn Tất Gia Hạn
                          </span>
                          {r.handledByName && (
                            <div className="text-[10px] text-emerald-800 mt-0.5 font-semibold">
                              Tiếp nhận: {r.handledByName}
                            </div>
                          )}
                        </div>
                      )}
                      {r.status === 'REJECTED' && (
                        <div>
                          <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Bị Từ Chối
                          </span>
                          {r.rejectionReason && (
                            <div className="text-[10px] text-rose-600 mt-0.5 max-w-[150px] truncate" title={r.rejectionReason}>
                              {r.rejectionReason}
                            </div>
                          )}
                        </div>
                      )}
                      {r.status === 'CANCELLED' && (
                        <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Đã Hủy
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Phụ lục hợp đồng: Không hiển thị cho đơn đã hủy hoặc bị từ chối */}
                        {r.status !== 'CANCELLED' && r.status !== 'REJECTED' && (
                          <button
                            type="button"
                            onClick={() => setSelectedRenewalForAddendum(r)}
                            className={`px-2.5 py-1 ${
                              r.status === 'COMPLETED'
                                ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200'
                                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                            } border rounded-md font-bold text-xs flex items-center gap-1 transition cursor-pointer`}
                            title={r.status === 'COMPLETED' ? 'Xem văn bản Phụ lục gia hạn hợp đồng & chữ ký điện tử' : 'Xem dự thảo phụ lục gia hạn hợp đồng'}
                          >
                            <span className="material-symbols-outlined text-[14px]">description</span>
                            <span>{r.status === 'COMPLETED' ? 'Phụ lục' : 'Dự thảo'}</span>
                          </button>
                        )}

                        {/* Chi tiết button */}
                        <button
                          type="button"
                          onClick={() => setSelectedRenewalForDetail(r)}
                          className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-bold text-xs transition cursor-pointer"
                          title="Xem chi tiết"
                        >
                          Xem chi tiết
                        </button>

                        {/* Phê duyệt & Từ chối: dành cho Facility Manager / Business Manager */}
                        {isManager && r.status === 'PENDING_REVIEW' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setApprovalTarget(r)
                                setApprovalNotes('')
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-xs shadow-2xs flex items-center gap-1 transition cursor-pointer"
                              title="Phê duyệt yêu cầu gia hạn"
                            >
                              <span className="material-symbols-outlined text-[14px]">check</span>
                              <span>Duyệt</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectTarget(r)
                                setRejectReason('')
                                setRejectError(null)
                              }}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md font-bold text-xs border border-rose-200 transition cursor-pointer"
                              title="Từ chối yêu cầu gia hạn"
                            >
                              Từ chối
                            </button>
                          </>
                        )}

                        {/* Kích hoạt duyệt lại: dành cho Quản lý khi đơn bị từ chối */}
                        {(isManager || isAdmin) && r.status === 'REJECTED' && (
                          <button
                            type="button"
                            onClick={() => handleReactivate(r)}
                            disabled={!isEligibleForReReview3d(r)}
                            className={`px-2 py-1 rounded-md font-bold text-xs transition cursor-pointer flex items-center gap-1 ${
                              isEligibleForReReview3d(r)
                                ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                            }`}
                            title={
                              isEligibleForReReview3d(r)
                                ? 'Kích hoạt duyệt lại yêu cầu gia hạn này'
                                : 'Chưa đủ 3 ngày kể từ ngày gửi đơn, chưa thể kích hoạt duyệt lại'
                            }
                          >
                            <span className="material-symbols-outlined text-[13px]">refresh</span>
                            <span>Kích hoạt lại</span>
                          </button>
                        )}

                        {/* Bỏ duyệt: dành cho Facility Manager khi PENDING_SIGNATURE và chưa ký */}
                        {isManager && r.status === 'PENDING_SIGNATURE' && !r.signedAt && !r.signatureData && (
                          <button
                            type="button"
                            onClick={() => {
                              setUndoApprovalTarget(r)
                              setUndoApprovalReason('')
                              setUndoApprovalError(null)
                            }}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-md font-bold text-xs border border-amber-300 transition cursor-pointer"
                            title="Bỏ duyệt yêu cầu gia hạn để xem xét lại"
                          >
                            Bỏ duyệt
                          </button>
                        )}

                        {/* Phân tiếp đón nhân viên: CHỈ khi là tại quầy (COUNTER) */}
                        {isManager && r.paymentMethod === 'COUNTER' && (r.status === 'PENDING_SIGNATURE' || r.status === 'PENDING_REVIEW' || r.status === 'PENDING_PAYMENT') && (
                          <button
                            type="button"
                            onClick={() => handleOpenAssignStaff(r)}
                            className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-md font-semibold text-xs border border-purple-200 transition cursor-pointer flex items-center gap-1"
                            title="Phân tiếp đón nhân viên xử lý thủ tục gia hạn tại quầy"
                          >
                            <span className="material-symbols-outlined text-[13px]">badge</span>
                            <span>{r.assignedStaffName ? 'Đổi tiếp đón' : 'Phân tiếp đón'}</span>
                          </button>
                        )}

                        {/* Tiếp nhận 6 tiêu chí tại quầy: CHỈ khi là nhân viên hoặc quản lý trực tiếp tại quầy (COUNTER) */}
                        {!isAdmin && (isStaff || isManager) && r.paymentMethod === 'COUNTER' && (r.status === 'PENDING_SIGNATURE' || r.status === 'PENDING_PAYMENT') && (
                          <button
                            type="button"
                            onClick={() => handleOpenReception(r)}
                            className={`px-2.5 py-1 rounded-md font-bold text-xs shadow-2xs flex items-center gap-1 transition cursor-pointer ${
                              timeEval?.isAllowed
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300'
                            }`}
                            title={timeEval ? timeEval.detailMessage : 'Tiếp nhận khách hàng tới gia hạn tại quầy theo 6 tiêu chí'}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {timeEval?.isAllowed ? 'how_to_reg' : 'event_busy'}
                            </span>
                            <span>{timeEval?.isAllowed ? 'Tiếp nhận' : 'Xem lịch hẹn'}</span>
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

        {/* Pagination Bar */}
        {totalItems > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-500 font-medium">
              Hiển thị <span className="font-bold text-slate-800">{(safeCurrentPage - 1) * pageSize + 1}</span> -{' '}
              <span className="font-bold text-slate-800">{Math.min(safeCurrentPage * pageSize, totalItems)}</span> trên{' '}
              <span className="font-bold text-slate-800">{totalItems}</span> yêu cầu
              {activeStatusFilter !== 'ALL' && (
                <span className="ml-1 text-slate-400">
                  (lọc theo thẻ trạng thái)
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition cursor-pointer"
                aria-label="Trang trước"
              >
                <span className="material-symbols-outlined text-[15px]">chevron_left</span>
                <span className="hidden sm:inline">Trước</span>
              </button>

              <div className="flex items-center gap-1 mx-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  if (
                    totalPages > 7 &&
                    page !== 1 &&
                    page !== totalPages &&
                    Math.abs(page - safeCurrentPage) > 1
                  ) {
                    if (page === 2 || page === totalPages - 1) {
                      return <span key={page} className="px-1 text-slate-400 font-mono">...</span>
                    }
                    return null
                  }

                  const isCurrent = page === safeCurrentPage
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[32px] h-8 rounded-lg font-mono text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                        isCurrent
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                      aria-current={isCurrent ? 'page' : undefined}
                    >
                      {page}
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition cursor-pointer"
                aria-label="Trang tiếp"
              >
                <span className="hidden sm:inline">Tiếp</span>
                <span className="material-symbols-outlined text-[15px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Phê Duyệt Gia Hạn */}
      {approvalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">verified</span>
              </div>
              <div>
                <h3 className="font-headline text-base font-bold text-slate-900">Phê Duyệt Gia Hạn Hợp Đồng</h3>
                <p className="text-xs text-slate-500">Hợp đồng #{approvalTarget.contractCode} • Kho #{approvalTarget.unitCode}</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Khách hàng:</span>
                <span className="font-bold text-slate-800">{approvalTarget.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Thời hạn hiện tại:</span>
                <span className="font-mono text-slate-800">{formatDate(approvalTarget.oldEndDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Thời hạn mới đề xuất:</span>
                <span className="font-mono font-bold text-emerald-700">{formatDate(approvalTarget.newEndDate)} (+{approvalTarget.cycleMonths} tháng)</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="font-semibold text-slate-700">Tổng phí gia hạn:</span>
                <span className="font-mono font-bold text-blue-700">{Number(approvalTarget.renewalFee || 0).toLocaleString('vi-VN')} ₫</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Ghi chú phê duyệt (tùy chọn)</label>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Ví dụ: Đã kiểm tra tình trạng kho, đủ điều kiện tái ký..."
                rows={3}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setApprovalTarget(null)}
                disabled={isSubmittingApproval}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isSubmittingApproval}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingApproval ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <span>Đang duyệt...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">check</span>
                    <span>Xác Nhận Phê Duyệt</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Từ Chối Gia Hạn (Lý do bắt buộc) */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">cancel</span>
              </div>
              <div>
                <h3 className="font-headline text-base font-bold text-slate-900">Từ Chối Yêu Cầu Gia Hạn</h3>
                <p className="text-xs text-slate-500">Hợp đồng #{rejectTarget.contractCode} • Kho #{rejectTarget.unitCode}</p>
              </div>
            </div>

            {rejectError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{rejectError}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Lý do từ chối <span className="text-rose-500">* (Bắt buộc)</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Nhập chi tiết lý do từ chối (Ví dụ: kho thuộc diện bảo trì, khách hàng chưa thanh toán công nợ cũ...)"
                rows={3}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-rose-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Lưu ý: Khách hàng sẽ nhận được thông báo kèm lý do và có thể kích hoạt duyệt lại sau 3 ngày kể từ ngày gửi đơn.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                disabled={isSubmittingReject}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isSubmittingReject || !rejectReason.trim()}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingReject ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">block</span>
                    <span>Xác Nhận Từ Chối</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Bỏ Duyệt Gia Hạn (Undo Approval) */}
      {undoApprovalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">undo</span>
              </div>
              <div>
                <h3 className="font-headline text-base font-bold text-slate-900">Thu Hồi Phê Duyệt Gia Hạn</h3>
                <p className="text-xs text-slate-500">Hợp đồng #{undoApprovalTarget.contractCode} • Kho #{undoApprovalTarget.unitCode}</p>
              </div>
            </div>

            {undoApprovalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{undoApprovalError}</span>
              </div>
            )}

            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn bỏ duyệt yêu cầu gia hạn này? Yêu cầu sẽ quay lại trạng thái <strong>Chờ Quản lý cơ sở duyệt</strong> để điều chỉnh phương án trước khi khách hàng ký và thanh toán.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Lý do thu hồi phê duyệt (tùy chọn)</label>
              <textarea
                value={undoApprovalReason}
                onChange={(e) => setUndoApprovalReason(e.target.value)}
                placeholder="Ví dụ: Cần điều chỉnh lại thời hạn thuê hoặc kiểm tra lại lịch bảo dưỡng kho..."
                rows={3}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUndoApprovalTarget(null)}
                disabled={isSubmittingUndoApproval}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleUndoApprovalSubmit}
                disabled={isSubmittingUndoApproval}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingUndoApproval ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">undo</span>
                    <span>Xác Nhận Bỏ Duyệt</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Phân Tiếp Đón Nhân Viên / Quản Lý Cơ Sở (Assign Staff & Shift Matching) */}
      {assignStaffTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">assignment_ind</span>
              </div>
              <div>
                <h3 className="font-headline text-base font-bold text-slate-900">Phân Tiếp Đón Khách Gia Hạn Tại Quầy</h3>
                <p className="text-xs text-slate-500">
                  Hợp đồng <span className="font-mono font-bold text-blue-600">#{assignStaffTarget.contractCode}</span> • Kho <span className="font-mono font-bold text-slate-700">#{assignStaffTarget.unitCode}</span> • {assignStaffTarget.facilityName}
                </p>
              </div>
            </div>

            {/* Thông tin lịch hẹn & khung ca trực yêu cầu */}
            <div className="bg-gradient-to-br from-slate-50 to-purple-50/40 p-3.5 rounded-xl border border-purple-100/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-purple-600">event</span>
                  <span>Ngày hẹn check-in:</span>
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {formatDate(assignStaffTarget.counterAppointmentDate)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-purple-600">schedule</span>
                  <span>Giờ hẹn khách tới:</span>
                </span>
                <span className="font-mono font-bold text-purple-700">
                  {assignStaffTarget.counterAppointmentTime ? assignStaffTarget.counterAppointmentTime : 'Chưa định giờ (Mặc định ca sáng)'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-purple-100">
                <span className="text-slate-600 font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-indigo-600">nest_clock_farsight_analog</span>
                  <span>Ca trực bao phủ giờ hẹn:</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  {targetShiftInfo.label}
                </span>
              </div>
            </div>

            {assignError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{assignError}</span>
              </div>
            )}

            {/* Danh sách lựa chọn nhân sự: Đang trong ca vs Gợi ý */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2">
                Chọn Nhân Sự Tiếp Đón (Staff / Quản Lý Cơ Sở) <span className="text-rose-500">*</span>
              </label>

              {isLoadingStaffList ? (
                <div className="p-5 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Đang tải danh sách nhân sự và kiểm tra ca trực...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Mục 1: Nhân sự đang có ca trực trong khung giờ hẹn */}
                  <div className="border border-emerald-200 bg-emerald-50/30 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-emerald-600">verified_user</span>
                        <span>Nhân sự đang có ca trực phù hợp ({onDutyStaffList.length})</span>
                      </span>
                      {onDutyStaffList.length > 0 && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Khuyến nghị
                        </span>
                      )}
                    </div>

                    {onDutyStaffList.length > 0 ? (
                      <div className="space-y-1.5">
                        {onDutyStaffList.map((st) => {
                          const isSelected = selectedStaffId === st.id
                          const roleName = (st.roleName || st.role?.name || '').toUpperCase()
                          const isFM = roleName === 'FACILITY_MANAGER'

                          return (
                            <div
                              key={st.id}
                              onClick={() => setSelectedStaffId(st.id)}
                              className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                                isSelected
                                  ? 'bg-white border-purple-500 ring-2 ring-purple-400 shadow-sm'
                                  : 'bg-white/80 border-slate-200 hover:border-purple-300'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="radio"
                                  name="assignStaffChoice"
                                  checked={isSelected}
                                  onChange={() => setSelectedStaffId(st.id)}
                                  className="w-4 h-4 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-900 truncate">
                                      {st.fullName || st.username}
                                    </span>
                                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                      isFM ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                      {isFM ? 'Quản lý cơ sở' : 'Nhân viên'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">{st.email}</div>
                                </div>
                              </div>
                              <span className="shrink-0 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span>Đang có ca ({targetShiftInfo.timeRange})</span>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="p-2 text-xs text-amber-800 bg-amber-50/80 rounded-lg border border-amber-200 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-amber-600 shrink-0">info</span>
                        <span>Không có nhân viên nào có ca trực bao phủ khung giờ này. Vui lòng chọn mục gợi ý bên dưới.</span>
                      </div>
                    )}
                  </div>

                  {/* Mục 2: Gợi ý phân tiếp đón (Nhân sự chưa có ca trực) */}
                  <div className="border border-slate-200 bg-slate-50/50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-indigo-600">lightbulb</span>
                        <span>Gợi ý phân tiếp đón (Nhân sự chưa có ca trực) ({offDutyStaffList.length})</span>
                      </span>
                    </div>

                    {offDutyStaffList.length > 0 ? (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {offDutyStaffList.map((st) => {
                          const isSelected = selectedStaffId === st.id
                          const roleName = (st.roleName || st.role?.name || '').toUpperCase()
                          const isFM = roleName === 'FACILITY_MANAGER'

                          return (
                            <div
                              key={st.id}
                              onClick={() => setSelectedStaffId(st.id)}
                              className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                                isSelected
                                  ? 'bg-white border-purple-500 ring-2 ring-purple-400 shadow-sm'
                                  : 'bg-white/80 border-slate-200 hover:border-purple-300'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="radio"
                                  name="assignStaffChoice"
                                  checked={isSelected}
                                  onChange={() => setSelectedStaffId(st.id)}
                                  className="w-4 h-4 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-900 truncate">
                                      {st.fullName || st.username}
                                    </span>
                                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                      isFM ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'
                                    }`}>
                                      {isFM ? 'Quản lý cơ sở' : 'Nhân viên'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">{st.email}</div>
                                </div>
                              </div>
                              <span className="shrink-0 text-[10px] font-medium text-slate-500">
                                Ngoài ca trực
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">Không có nhân sự nào khác tại cơ sở này.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Thông báo gợi ý & Tự động tạo ca trực nếu nhân sự ngoài ca được chọn */}
            {selectedStaffId && offDutyStaffList.some((st) => st.id === selectedStaffId) && (
              <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2 animate-in fade-in">
                <div className="flex items-start gap-2 text-xs text-indigo-900">
                  <span className="material-symbols-outlined text-[18px] text-indigo-600 shrink-0 mt-0.5">notification_add</span>
                  <div>
                    <div className="font-bold">Quy trình phân tiếp đón ngoài ca:</div>
                    <ul className="list-disc list-inside text-[11px] space-y-0.5 mt-1 text-indigo-800">
                      <li>Hệ thống sẽ <strong>gửi thông báo xác nhận</strong> tới nhân sự được phân công.</li>
                      <li>Tự động <strong>khởi tạo ca làm việc {targetShiftInfo.label}</strong> ({targetShiftInfo.timeRange}) vào ngày {formatDate(assignStaffTarget.counterAppointmentDate)} trên bảng phân ca.</li>
                    </ul>
                  </div>
                </div>

                <label className="flex items-center gap-2 pt-1 border-t border-indigo-100 cursor-pointer text-xs font-bold text-indigo-950">
                  <input
                    type="checkbox"
                    checked={autoCreateShift}
                    onChange={(e) => setAutoCreateShift(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>Tự động tạo lịch làm việc ({targetShiftInfo.label}) cho nhân sự này</span>
                </label>
              </div>
            )}

            {/* Ghi chú giao việc */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Ghi chú giao việc tiếp đón (tùy chọn)</label>
              <textarea
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                placeholder="Ví dụ: Khách hẹn giờ này, vui lòng chuẩn bị phụ lục giấy và kiểm tra kho trước khi đón khách..."
                rows={2}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAssignStaffTarget(null)}
                disabled={isSubmittingAssign}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleAssignStaffSubmit}
                disabled={isSubmittingAssign || !selectedStaffId}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingAssign ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <span>Đang phân tiếp đón...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">assignment_ind</span>
                    <span>Xác Nhận Phân Tiếp Đón</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: BIÊN BẢN TIẾP NHẬN GIA HẠN HỢP ĐỒNG TẠI QUẦY (6 TIÊU CHÍ CHUYÊN NGHIỆP BOXORA) */}
      {receptionTarget && (() => {
        const receptionTimeEval = evaluateCheckInTimeStatus(receptionTarget.counterAppointmentDate, receptionTarget.counterAppointmentTime)

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-200 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                    <span className="material-symbols-outlined text-[28px]">how_to_reg</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-headline text-base sm:text-lg font-bold text-slate-900">
                        Biên Bản Tiếp Nhận Gia Hạn Hợp Đồng Tại Quầy
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                        Chuẩn BR-RULE 6 Tiêu Chí
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Cơ sở: <strong>{receptionTarget.facilityName}</strong> • Hợp đồng #{receptionTarget.contractCode} • Kho #{receptionTarget.unitCode}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReceptionTarget(null)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Error banner */}
              {receptionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{receptionError}</span>
                </div>
              )}

              {/* Shift & Staff Attendance Status Check */}
              <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                currentStaffShiftInfo.checkedIn
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">
                    {currentStaffShiftInfo.checkedIn ? 'verified_user' : 'warning'}
                  </span>
                  <div>
                    <span className="font-bold">Nhân viên tiếp nhận: {user?.fullName || user?.username}</span>
                    <div className="text-[11px] text-slate-600">
                      {currentStaffShiftInfo.checkedIn ? (
                        <span className="text-emerald-700 font-semibold">
                          ✓ Đã điểm danh vào ca trực hôm nay ({currentStaffShiftInfo.shiftName || 'Hợp lệ'}) - Đủ điều kiện tiếp nhận
                        </span>
                      ) : (
                        <span className="text-amber-800 font-semibold">
                          ⚠️ Chưa ghi nhận điểm danh ca trực hôm nay. Vui lòng check-in ca trực trước khi tiếp nhận!
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  currentStaffShiftInfo.checkedIn ? 'bg-emerald-200 text-emerald-950' : 'bg-amber-200 text-amber-950'
                }`}>
                  {currentStaffShiftInfo.checkedIn ? 'Đã Vào Ca' : 'Chưa Check-in'}
                </span>
              </div>

                  {/* Check-in Appointment Time Policy Card (4 Tình Huống Nghiệp Vụ) */}
                  <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                    receptionTimeEval.status === 'BEFORE_DATE'
                      ? 'bg-rose-50 border-rose-300 text-rose-950'
                      : receptionTimeEval.status === 'BEFORE_TIME'
                      ? 'bg-amber-50 border-amber-300 text-amber-950'
                      : receptionTimeEval.status === 'LATE'
                      ? 'bg-sky-50 border-sky-300 text-sky-950'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className={`material-symbols-outlined text-[24px] shrink-0 mt-0.5 ${
                          receptionTimeEval.status === 'BEFORE_DATE'
                            ? 'text-rose-600'
                            : receptionTimeEval.status === 'BEFORE_TIME'
                            ? 'text-amber-600'
                            : receptionTimeEval.status === 'LATE'
                            ? 'text-sky-600'
                            : 'text-emerald-600'
                        }`}>
                          {receptionTimeEval.status === 'BEFORE_DATE'
                            ? 'event_busy'
                            : receptionTimeEval.status === 'BEFORE_TIME'
                            ? 'hourglass_top'
                            : receptionTimeEval.status === 'LATE'
                            ? 'history_toggle_off'
                            : 'verified'}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs">
                              Lịch Hẹn Check-in Tiếp Đón: {receptionTimeEval.formattedAppointment}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              receptionTimeEval.isAllowed ? 'bg-emerald-200 text-emerald-950' : 'bg-rose-200 text-rose-950'
                            }`}>
                              {receptionTimeEval.isAllowed ? 'Có thể bàn giao' : 'Không cho phép bàn giao'}
                            </span>
                          </div>
                          <p className="mt-1 font-medium text-[11px] leading-relaxed">
                            {receptionTimeEval.detailMessage}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold">
                            <span className="opacity-75">Quy tắc xử lý:</span>
                            <span className="underline decoration-dotted">{receptionTimeEval.actionAdvice}</span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                          receptionTimeEval.status === 'BEFORE_DATE'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : receptionTimeEval.status === 'BEFORE_TIME'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : receptionTimeEval.status === 'LATE'
                            ? 'bg-sky-100 text-sky-800 border-sky-300'
                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        }`}>
                          {receptionTimeEval.badgeLabel}
                        </span>
                      </div>
                    </div>
                  </div>

            <form onSubmit={handleReceptionSubmit} className="space-y-4">
              {/* Tiêu chí 1: Danh tính và quyền gia hạn */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                receptionIdentityVerified ? 'bg-emerald-50/40 border-emerald-300' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">1</span>
                    <h4 className="font-bold text-xs text-slate-900">Xác Minh Danh Tính &amp; Quyền Gia Hạn</h4>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-emerald-800">
                    <input
                      type="checkbox"
                      checked={receptionIdentityVerified}
                      onChange={(e) => setReceptionIdentityVerified(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Xác nhận danh tính hợp lệ</span>
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-500 font-medium block mb-0.5">Loại giấy tờ</label>
                    <select
                      value={receptionIdentityDocType}
                      onChange={(e) => setReceptionIdentityDocType(e.target.value)}
                      className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 text-xs"
                    >
                      <option value="CCCD">CCCD Gắn Chip</option>
                      <option value="PASSPORT">Hộ Chiếu</option>
                      <option value="CMND">CMND 9/12 Số</option>
                      <option value="AUTHORIZED_REP">Giấy Ủy Quyền Hợp Pháp</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-medium block mb-0.5">Số CCCD / Định danh</label>
                    <input
                      type="text"
                      value={receptionIdentityNumber}
                      onChange={(e) => setReceptionIdentityNumber(e.target.value)}
                      placeholder="Nhập số CCCD..."
                      className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-medium block mb-0.5">Ghi chú đối chiếu</label>
                    <input
                      type="text"
                      value={receptionIdentityNotes}
                      onChange={(e) => setReceptionIdentityNotes(e.target.value)}
                      placeholder="Khớp CCCD gốc của khách..."
                      className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Khách hàng: <strong>{receptionTarget.customerName}</strong></span>
                  <span>Email: <strong>{receptionTarget.customerEmail}</strong></span>
                </div>
              </div>

              {/* Tiêu chí 2: Hợp đồng và kho được đối soát chính xác */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                receptionUnitAudited ? 'bg-emerald-50/40 border-emerald-300' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">2</span>
                    <h4 className="font-bold text-xs text-slate-900">Đối Soát Hợp Đồng &amp; Hiện Trạng Kho</h4>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-emerald-800">
                    <input
                      type="checkbox"
                      checked={receptionUnitAudited}
                      onChange={(e) => setReceptionUnitAudited(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Xác nhận kho &amp; khóa đạt chuẩn</span>
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Mã kho &amp; Trạng thái ổ khóa</span>
                    <span className="font-mono font-bold text-blue-700">Kho #{receptionTarget.unitCode} (SmartLock sẵn sàng)</span>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={receptionUnitAuditNotes}
                      onChange={(e) => setReceptionUnitAuditNotes(e.target.value)}
                      placeholder="Ghi chú: Đã kiểm tra cửa cuộn và khóa hoạt động tốt..."
                      className="w-full h-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Tiêu chí 3: Không có trạng thái chặn gia hạn chưa được xử lý */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                receptionNoBlockingIssues ? 'bg-emerald-50/40 border-emerald-300' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">3</span>
                    <h4 className="font-bold text-xs text-slate-900">Kiểm Tra Trạng Thái An Toàn &amp; Chặn Gia Hạn</h4>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-emerald-800">
                    <input
                      type="checkbox"
                      checked={receptionNoBlockingIssues}
                      onChange={(e) => setReceptionNoBlockingIssues(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Xác nhận không bị chặn</span>
                  </label>
                </div>
                <p className="text-[11px] text-slate-600">
                  Đối soát hệ thống: Kho không bị niêm phong khóa quá hạn, không có tranh chấp pháp lý và không có phiếu sự cố chưa giải quyết.
                </p>
              </div>

              {/* Tiêu chí 4: Giá, thời hạn và các khoản phí đã được xác nhận */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                receptionTermsConfirmed ? 'bg-emerald-50/40 border-emerald-300' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">4</span>
                    <h4 className="font-bold text-xs text-slate-900">Xác Nhận Đơn Giá, Thời Hạn &amp; Cước Phí</h4>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-emerald-800">
                    <input
                      type="checkbox"
                      checked={receptionTermsConfirmed}
                      onChange={(e) => setReceptionTermsConfirmed(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Khách đã đồng ý thỏa thuận</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Thời hạn gia hạn</span>
                    <span className="font-bold text-blue-700">+{receptionTarget.cycleMonths} tháng</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Hạn cũ</span>
                    <span className="font-mono">{formatDate(receptionTarget.oldEndDate)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Hạn mới sau gia hạn</span>
                    <span className="font-mono font-bold text-emerald-700">{formatDate(receptionTarget.newEndDate)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Tổng tiền gia hạn</span>
                    <span className="font-mono font-extrabold text-blue-700 text-sm">
                      {Number(receptionTarget.renewalFee || 0).toLocaleString('vi-VN')} ₫
                    </span>
                  </div>
                </div>
              </div>

              {/* Tiêu chí 5: Thanh toán và Ký xác nhận phụ lục */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                receptionPaymentConfirmed ? 'bg-emerald-50/40 border-emerald-300' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">5</span>
                    <h4 className="font-bold text-xs text-slate-900">Thanh Toán &amp; Ký Phụ Lục Tại Quầy</h4>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-emerald-800">
                    <input
                      type="checkbox"
                      checked={receptionPaymentConfirmed}
                      onChange={(e) => setReceptionPaymentConfirmed(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Đã thu đủ cước &amp; Ký nhận</span>
                  </label>
                </div>

                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[11px] text-slate-500 font-medium block mb-1">Phương thức thu tiền</label>
                      <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-blue-700">account_balance</span>
                        <span>Chuyển khoản ngân hàng (BANK_TRANSFER)</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-500 font-medium block mb-1">Mã phiếu thu biên lai</label>
                      <input
                        type="text"
                        value={receptionReceiptVoucherCode}
                        onChange={(e) => setReceptionReceiptVoucherCode(e.target.value)}
                        placeholder="Mã phiếu thu..."
                        className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Canvas Signature Pad for touchscreen / tablet / mouse */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-blue-600">draw</span>
                        <span>Khách hàng ký xác nhận trên màn hình / tablet</span>
                      </label>
                      <button
                        type="button"
                        onClick={clearSignature}
                        className="text-[11px] text-slate-500 hover:text-rose-600 font-semibold cursor-pointer"
                      >
                        Xóa &amp; Ký lại
                      </button>
                    </div>
                    <div className="border border-slate-300 rounded-xl bg-white overflow-hidden shadow-2xs">
                      <canvas
                        ref={canvasRef}
                        width={600}
                        height={120}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="w-full h-28 touch-none bg-white cursor-crosshair"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Ghi chú tiếp nhận chung */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Ghi chú lưu vết tiếp nhận (tùy chọn)</label>
                <input
                  type="text"
                  value={receptionNotes}
                  onChange={(e) => setReceptionNotes(e.target.value)}
                  placeholder="Ghi chú thêm về buổi làm việc tiếp nhận khách..."
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 gap-2">
                <span className="text-[11px] text-slate-500">
                  Tiêu chí 6: Hệ thống sẽ tự động lưu vết nhân viên thực hiện, thời điểm và cập nhật hợp đồng.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReceptionTarget(null)}
                    disabled={isSubmittingReception}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isSubmittingReception ||
                      !receptionTimeEval.isAllowed ||
                      !receptionIdentityVerified ||
                      !receptionUnitAudited ||
                      !receptionNoBlockingIssues ||
                      !receptionTermsConfirmed ||
                      !receptionPaymentConfirmed
                    }
                    className={`px-6 py-2.5 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer ${
                      !receptionTimeEval.isAllowed
                        ? 'bg-rose-100 text-rose-700 border border-rose-300 cursor-not-allowed opacity-90'
                        : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white'
                    }`}
                  >
                    {!receptionTimeEval.isAllowed ? (
                      <>
                        <span className="material-symbols-outlined text-[17px]">event_busy</span>
                        <span>
                          {receptionTimeEval.status === 'BEFORE_DATE'
                            ? `Chưa Đến Ngày Check-in (${formatDate(receptionTarget.counterAppointmentDate)})`
                            : `Chờ Đến Giờ Check-in (${receptionTarget.counterAppointmentTime})`}
                        </span>
                      </>
                    ) : isSubmittingReception ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        <span>Đang lưu biên bản &amp; kích hoạt...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[17px]">how_to_reg</span>
                        <span>Hoàn Tất Tiếp Nhận &amp; Gia Hạn Hợp Đồng</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
        )
      })()}

      {/* MODAL 6: Ghi Nhận Thu Cước Tại Quầy (Counter Payment Legacy) */}
      {counterPaymentTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">point_of_sale</span>
              </div>
              <div>
                <h3 className="font-headline text-base font-bold text-slate-900">Thu Cước Gia Hạn Tại Quầy</h3>
                <p className="text-xs text-slate-500">Hợp đồng #{counterPaymentTarget.contractCode} • Kho #{counterPaymentTarget.unitCode}</p>
              </div>
            </div>

            {counterPaymentError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{counterPaymentError}</span>
              </div>
            )}

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Khách nộp tiền:</span>
                <span className="font-bold text-slate-800">{counterPaymentTarget.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Thời gian gia hạn thêm:</span>
                <span className="font-mono font-bold text-slate-800">{counterPaymentTarget.cycleMonths} tháng</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="font-semibold text-slate-700">Số tiền phải thu:</span>
                <span className="font-mono text-base font-extrabold text-blue-700">
                  {Number(counterPaymentTarget.renewalFee || 0).toLocaleString('vi-VN')} ₫
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Phương thức thu tiền</label>
                <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-indigo-700">account_balance</span>
                  <div>
                    <div>Chuyển khoản ngân hàng (BANK_TRANSFER)</div>
                    <div className="text-[11px] font-normal text-indigo-700">Khách quét mã QR / chuyển khoản vào tài khoản ngân hàng cơ sở</div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mã phiếu thu / biên lai cơ sở</label>
                <input
                  type="text"
                  value={receiptVoucherCode}
                  onChange={(e) => setReceiptVoucherCode(e.target.value)}
                  placeholder="Ví dụ: PT-2026-001..."
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Ghi chú thu ngân (tùy chọn)</label>
                <input
                  type="text"
                  value={counterPaymentNotes}
                  onChange={(e) => setCounterPaymentNotes(e.target.value)}
                  placeholder="Ghi chú thêm về giao dịch..."
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCounterPaymentTarget(null)}
                disabled={isSubmittingCounterPayment}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleCounterPayment}
                disabled={isSubmittingCounterPayment}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingCounterPayment ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <span>Đang ghi nhận...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Xác Nhận Đã Thu Tiền</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: Chi Tiết Yêu Cầu Gia Hạn */}
      {selectedRenewalForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-[22px]">description</span>
                <h3 className="font-headline text-base font-bold text-slate-900">Chi Tiết Yêu Cầu Gia Hạn</h3>
              </div>
              <button
                onClick={() => setSelectedRenewalForDetail(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between"><span className="text-slate-500">Mã yêu cầu:</span><span className="font-mono font-bold text-slate-900">#{selectedRenewalForDetail.id}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Mã hợp đồng:</span><span className="font-mono font-bold text-blue-600">#{selectedRenewalForDetail.contractCode}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Khách hàng:</span><span className="font-bold text-slate-900">{selectedRenewalForDetail.customerName} ({selectedRenewalForDetail.customerEmail})</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Cơ sở / Kho:</span><span className="font-bold text-slate-900">{selectedRenewalForDetail.facilityName} / Kho #{selectedRenewalForDetail.unitCode}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Thời hạn cũ:</span><span className="font-mono text-slate-700">{formatDate(selectedRenewalForDetail.oldEndDate)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Thời hạn mới:</span><span className="font-mono font-bold text-emerald-700">{formatDate(selectedRenewalForDetail.newEndDate)} (+{selectedRenewalForDetail.cycleMonths} tháng)</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Hình thức thực hiện:</span><span className="font-bold text-slate-800">{selectedRenewalForDetail.paymentMethod === 'COUNTER' ? 'Trực tiếp tại quầy cơ sở' : 'Trực tuyến (DocuSeal / VNPay)'}</span></div>
                {selectedRenewalForDetail.counterAppointmentDate && (
                  <div className="flex justify-between"><span className="text-slate-500">Lịch hẹn đến cơ sở:</span><span className="font-mono font-bold text-emerald-700">{formatDate(selectedRenewalForDetail.counterAppointmentDate)}{selectedRenewalForDetail.counterAppointmentTime ? ` lúc ${selectedRenewalForDetail.counterAppointmentTime}` : ''}</span></div>
                )}
                <div className="flex justify-between"><span className="text-slate-500">Nhân viên tiếp đón:</span><span className="font-bold text-purple-700">{selectedRenewalForDetail.assignedStaffName || 'Chưa phân tiếp đón'}</span></div>
                <div className="flex justify-between pt-1 border-t border-slate-200"><span className="font-semibold text-slate-700">Phí gia hạn:</span><span className="font-mono font-bold text-blue-700 text-sm">{Number(selectedRenewalForDetail.renewalFee || 0).toLocaleString('vi-VN')} ₫</span></div>
              </div>

              {/* Audit history section */}
              <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                <h5 className="font-bold uppercase tracking-wider text-slate-700 text-[11px]">Nhật ký xử lý &amp; Thẩm định</h5>
                <div className="flex justify-between"><span className="text-slate-500">Người phê duyệt:</span><span className="font-semibold text-slate-800">{selectedRenewalForDetail.reviewedByName || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Thời gian duyệt:</span><span className="font-mono text-slate-800">{formatDateTime(selectedRenewalForDetail.reviewedAt)}</span></div>
                {selectedRenewalForDetail.rejectionReason && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
                    <strong>Lý do từ chối:</strong> {selectedRenewalForDetail.rejectionReason}
                  </div>
                )}
                {selectedRenewalForDetail.status === 'REJECTED' && (isManager || isAdmin) && isEligibleForReReview3d(selectedRenewalForDetail) && (
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-purple-900 text-xs">Đủ điều kiện xét duyệt lại</div>
                      <div className="text-[11px] text-purple-700">Đơn đã quá 3 ngày từ ngày gửi, có thể mở lại để quản lý thẩm định.</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedRenewalForDetail
                        setSelectedRenewalForDetail(null)
                        handleReactivate(target)
                      }}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">refresh</span>
                      <span>Kích hoạt lại</span>
                    </button>
                  </div>
                )}
                {selectedRenewalForDetail.notes && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                    <strong>Ghi chú:</strong> {selectedRenewalForDetail.notes}
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-slate-100"><span className="text-slate-500">Người tiếp nhận hoàn tất:</span><span className="font-semibold text-slate-800">{selectedRenewalForDetail.handledByName || selectedRenewalForDetail.cashierStaffName || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Thời điểm hoàn tất:</span><span className="font-mono text-slate-800">{formatDateTime(selectedRenewalForDetail.handledAt || selectedRenewalForDetail.paidAt)}</span></div>
                {selectedRenewalForDetail.status === 'COMPLETED' && (
                  <div className="flex justify-between"><span className="text-slate-500">Phiếu thu biên lai:</span><span className="font-mono font-bold text-indigo-700">{selectedRenewalForDetail.receiptVoucherCode || '—'}</span></div>
                )}
                {selectedRenewalForDetail.identityVerified && (
                  <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 text-[11px]">
                    ✓ <strong>Đã đối soát 6 tiêu chí tiếp nhận:</strong> Xác minh {selectedRenewalForDetail.identityDocType} ({selectedRenewalForDetail.identityNumber || 'Đã kiểm tra'})
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {selectedRenewalForDetail.status !== 'CANCELLED' && selectedRenewalForDetail.status !== 'REJECTED' && (
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedRenewalForDetail
                    setSelectedRenewalForDetail(null)
                    setSelectedRenewalForAddendum(target)
                  }}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">description</span>
                  <span>
                    {selectedRenewalForDetail.status === 'COMPLETED'
                      ? 'Xem Văn Bản Phụ Lục Gia Hạn'
                      : 'Xem Dự Thảo Phụ Lục Gia Hạn'}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedRenewalForDetail(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer ml-auto"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedRenewalForAddendum && (
        <RenewalAddendumModal
          renewal={selectedRenewalForAddendum}
          readOnly={true}
          onClose={() => setSelectedRenewalForAddendum(null)}
        />
      )}
    </div>
  )
}
