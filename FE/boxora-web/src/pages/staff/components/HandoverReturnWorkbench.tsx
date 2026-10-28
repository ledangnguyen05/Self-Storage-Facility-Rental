import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  ClipboardCheck,
  CalendarCheck,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  FileText,
  UserCheck,
  Send,
  Lock,
  Camera,
  Layers,
  Thermometer,
  RotateCcw,
  Sparkles,
  Search,
  CreditCard,
  Ban,
  Upload,
  Trash2,
  Eye,
  X,
  Wrench,
  Receipt,
  MessageSquareWarning,
  KeyRound,
  Warehouse,
  History,
  Save
} from 'lucide-react'
import { toast } from '../../../utils/toast'
import { handoverService, ReturnCase, ReturnInspectionPayload } from '../../../services/handoverService'
import type { Booking } from '../../../types'

export type ReturnStepStatus =
  | 'RETURN_REQUESTED'
  | 'INSPECTION_SCHEDULED'
  | 'INSPECTION_IN_PROGRESS'
  | 'INSPECTION_PASSED'
  | 'INSPECTION_ISSUE'
  | 'REFUND_PENDING_APPROVAL'
  | 'REFUND_APPROVED'
  | 'REFUND_PROCESSING'
  | 'REFUNDED'
  | 'COMPLETED'
  | 'DISPUTED'

export interface ReturnCaseItem {
  id: string
  bookingId: string
  bookingCode: string
  contractCode: string
  unitCode: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  facilityId?: string
  facilityName: string
  requestDate: string
  expectedReturnDate: string
  inspectionDate?: string
  reason: string
  bankName?: string
  bankAccountNumber?: string
  bankAccountName?: string
  depositAmount: number
  outstandingDebt: number
  cleaningFee: number
  damageFee: number
  doorFee?: number
  smartLockFee?: number
  smartLockIssueType?: string
  wallStructureFee?: number
  lostCardFee: number
  totalDeduction?: number
  approvedDeductions?: number
  netRefundAmount?: number
  additionalAmountDue?: number
  status: ReturnStepStatus
  inspectionStatus?: string
  approvalStatus?: string
  additionalPaymentStatus?: string
  additionalPaymentTxnRef?: string
  refundStatus?: string
  refundTxnRef?: string
  refundProcessedAt?: string
  inspectorName?: string
  approverName?: string
  approvedAt?: string
  approvalNotes?: string
  completedAt?: string
  historyNotes?: string[]

  // 7 Criteria
  doorPassed?: boolean
  doorNotes?: string
  doorFeeInput?: number

  cleanlinessPassed?: boolean
  cleanlinessNotes?: string
  cleaningFeeInput?: number

  damagePassed?: boolean
  damageNotes?: string
  damageFeeInput?: number

  smartLockPassed?: boolean
  smartLockNotes?: string
  smartLockFeeInput?: number

  assetsClearedPassed?: boolean
  assetsClearedNotes?: string

  photoUrls?: string[]

  envPassed?: boolean
  envNotes?: string

  // Physical & IoT status
  unitReturnedPhysically?: boolean
  returnedAt?: string
  accessRevoked?: boolean
  accessRevokedAt?: string
  isDisputed?: boolean
  disputeReason?: string
}

interface HandoverReturnWorkbenchProps {
  currentFacilityId?: string
  facilityName?: string
  userRole?: string
  userName?: string
  activeRentals?: Booking[]
  rawReturnRequests?: any[]
  initialStatusTabFilter?: string
  onReturnCompleted?: () => void
  onRefresh?: () => void
  onMetricsChange?: (metrics: { pending: number; inspecting: number; refunding: number; completed: number; total: number }) => void
}

const normalizeStatus = (
  rawStatus: any,
  inspectionStatus?: string,
  approvalStatus?: string,
  refundStatus?: string
): ReturnStepStatus => {
  const insp = String(inspectionStatus || '').toUpperCase()
  const app = String(approvalStatus || '').toUpperCase()
  const ref = String(refundStatus || '').toUpperCase()
  const st = String(rawStatus || '').toUpperCase()

  if (st === 'COMPLETED' || st === 'RESOLVED') return 'COMPLETED'
  if (ref === 'COMPLETED' || ref === 'REFUNDED' || st === 'REFUNDED') return 'REFUNDED'
  if (ref === 'PROCESSING' || ref === 'REFUND_PROCESSING' || st === 'REFUND_PROCESSING') return 'REFUND_PROCESSING'
  if (app === 'APPROVED' || app === 'REFUND_APPROVED' || st === 'REFUND_APPROVED') return 'REFUND_APPROVED'
  if (app === 'PENDING' || app === 'REFUND_PENDING_APPROVAL' || st === 'REFUND_PENDING_APPROVAL' || st === 'PENDING_APPROVAL') return 'REFUND_PENDING_APPROVAL'
  if (insp === 'ISSUE' || insp === 'INSPECTION_ISSUE' || st === 'INSPECTION_ISSUE') return 'INSPECTION_ISSUE'
  if (insp === 'PASSED' || insp === 'COMPLETED' || insp === 'INSPECTION_PASSED' || st === 'INSPECTION_PASSED' || st === 'INSPECTED') return 'INSPECTION_PASSED'
  if (insp === 'IN_PROGRESS' || insp === 'INSPECTING' || insp === 'INSPECTION_IN_PROGRESS' || st === 'INSPECTION_IN_PROGRESS' || st === 'INSPECTING') return 'INSPECTION_IN_PROGRESS'
  if (insp === 'SCHEDULED' || insp === 'INSPECTION_SCHEDULED' || st === 'INSPECTION_SCHEDULED') return 'INSPECTION_SCHEDULED'
  if (st === 'DISPUTED') return 'DISPUTED'
  return 'RETURN_REQUESTED'
}

const DEFAULT_PROOF_PHOTOS = [
  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=600&q=80'
]

const INSPECTION_DEFAULT_NOTES = {
  door: 'Đóng mở êm ái, ray dẫn thẳng, không móp méo cong vênh.',
  cleanliness: 'Đã quét sạch rác, bề mặt sàn khô ráo, không ẩm mốc.',
  damage: 'Vách ngăn composite, sàn và trần nguyên vẹn, không khoan đục.',
  smartLock: 'Khóa thông minh IoT nhạy, chốt khóa an toàn, pin 94%.',
  assetsCleared: 'Đã lấy toàn bộ thùng đồ & tài sản ra khỏi kho.',
  env: 'Cảm biến IoT: 23°C • Độ ẩm 46% RH (Đạt tiêu chuẩn bảo quản)',
}

const resolveInspectionNote = (passed: boolean, existingNotes: string | undefined | null, defaultText: string): string => {
  if (passed) {
    return existingNotes && existingNotes.trim() ? existingNotes : defaultText
  }
  // When not passed, clear if it currently matches the default passed note
  if (existingNotes && existingNotes.trim() !== defaultText.trim()) {
    return existingNotes
  }
  return ''
}

export const HandoverReturnWorkbench: React.FC<HandoverReturnWorkbenchProps> = ({
  currentFacilityId,
  facilityName = 'Boxora Thủ Đức',
  userRole = 'STAFF',
  userName = 'Nhân viên trực ca',
  activeRentals = [],
  rawReturnRequests = [],
  initialStatusTabFilter = 'PENDING',
  onReturnCompleted,
  onRefresh,
  onMetricsChange
}) => {
  const isFacilityManager = userRole === 'FACILITY_MANAGER' || userRole === 'ADMIN' || userRole === 'BUSINESS_MANAGER'
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [returnCases, setReturnCases] = useState<ReturnCaseItem[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState<string>('')
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [statusTabFilter, setStatusTabFilter] = useState<string>(initialStatusTabFilter || 'PENDING')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)

  useEffect(() => {
    if (initialStatusTabFilter) {
      setStatusTabFilter(initialStatusTabFilter)
    }
  }, [initialStatusTabFilter])

  // 7 Checklist items state for current case
  const [doorPassed, setDoorPassed] = useState(true)
  const [doorNotes, setDoorNotes] = useState(INSPECTION_DEFAULT_NOTES.door)
  const [doorFeeInput, setDoorFeeInput] = useState(0)

  const [cleanlinessPassed, setCleanlinessPassed] = useState(true)
  const [cleanlinessNotes, setCleanlinessNotes] = useState(INSPECTION_DEFAULT_NOTES.cleanliness)
  const [cleaningFeeInput, setCleaningFeeInput] = useState(0)

  const [damagePassed, setDamagePassed] = useState(true)
  const [damageNotes, setDamageNotes] = useState(INSPECTION_DEFAULT_NOTES.damage)
  const [damageFeeInput, setDamageFeeInput] = useState(0)

  const [smartLockPassed, setSmartLockPassed] = useState(true)
  const [smartLockNotes, setSmartLockNotes] = useState(INSPECTION_DEFAULT_NOTES.smartLock)
  const [smartLockFeeInput, setSmartLockFeeInput] = useState(0)
  const [smartLockIssueType, setSmartLockIssueType] = useState<string>('NORMAL_WEAR')

  const [assetsClearedPassed, setAssetsClearedPassed] = useState(true)
  const [assetsClearedNotes, setAssetsClearedNotes] = useState(INSPECTION_DEFAULT_NOTES.assetsCleared)

  const [photoUrls, setPhotoUrls] = useState<string[]>([])

  const [envPassed, setEnvPassed] = useState(true)
  const [envNotes, setEnvNotes] = useState(INSPECTION_DEFAULT_NOTES.env)

  // Modals & Navigation Guards
  type PendingNavType = 'TAB_FILTER' | 'SELECT_CASE' | 'REFRESH'
  const [pendingNavAction, setPendingNavAction] = useState<{
    type: PendingNavType
    targetFilter?: string
    targetCaseId?: string
  } | null>(null)
  const [showDraftConfirmModal, setShowDraftConfirmModal] = useState(false)
  const [isSavingDraftModal, setIsSavingDraftModal] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState<string>('')

  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null)
  const [showScheduleConfirmModal, setShowScheduleConfirmModal] = useState(false)
  const [scheduleDatetimeInput, setScheduleDatetimeInput] = useState('')
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [refundMethodSelect, setRefundMethodSelect] = useState<'BANK_TRANSFER' | 'VNPAY_REFUND' | 'CASH'>('BANK_TRANSFER')
  const [refundTxnInput, setRefundTxnInput] = useState('')
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false)

  // Dispute modal
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [disputeReasonInput, setDisputeReasonInput] = useState('')
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false)

  // Operational action states
  const [isFinishingHandover, setIsFinishingHandover] = useState(false)
  const [isRevokingAccess, setIsRevokingAccess] = useState(false)
  const [isConfirmingPhysical, setIsConfirmingPhysical] = useState(false)

  // 1. Fetch Real Cases from Backend API
  const fetchReturnCases = async (showToast: boolean = false) => {
    setIsRefreshing(true)
    try {
      const data = await handoverService.getReturnCases({
        facilityId: currentFacilityId
      })

      if (data && data.length > 0) {
        const mapped: ReturnCaseItem[] = data.map((item) => ({
          id: item.id || `RET-${item.bookingCode}`,
          bookingId: item.bookingId,
          bookingCode: item.bookingCode,
          contractCode: item.contractCode || `CTR-${item.bookingCode}`,
          unitCode: item.unitCode,
          customerName: item.customerName,
          customerPhone: item.customerPhone || 'Theo hồ sơ',
          customerEmail: item.customerEmail || '',
          facilityId: item.facilityId || currentFacilityId,
          facilityName: item.facilityName || facilityName,
          requestDate: item.requestDate || '',
          expectedReturnDate: item.expectedReturnDate || '',
          inspectionDate: item.inspectionDate || '',
          reason: item.reason || 'Đến hạn thanh lý hợp đồng & nghiệm thu hoàn cọc',
          bankName: item.bankName || 'Vietcombank',
          bankAccountNumber: item.bankAccountNumber || '',
          bankAccountName: item.bankAccountName || (item.customerName || '').toUpperCase(),
          depositAmount: item.depositAmount || 0,
          outstandingDebt: item.outstandingDebt || 0,
          cleaningFee: item.cleaningFee || 0,
          damageFee: item.damageFee || 0,
          doorFee: item.doorFee || 0,
          smartLockFee: item.smartLockFee || 0,
          smartLockIssueType: item.smartLockIssueType || 'NORMAL_WEAR',
          wallStructureFee: item.wallStructureFee || 0,
          lostCardFee: item.lostCardFee || 0,
          totalDeduction: item.totalDeduction || 0,
          approvedDeductions: item.approvedDeductions || 0,
          netRefundAmount: item.netRefundAmount || 0,
          additionalAmountDue: item.additionalAmountDue || 0,
          status: normalizeStatus(item.status, item.inspectionStatus, item.approvalStatus, item.refundStatus),
          inspectionStatus: item.inspectionStatus,
          approvalStatus: item.approvalStatus,
          additionalPaymentStatus: item.additionalPaymentStatus,
          additionalPaymentTxnRef: item.additionalPaymentTxnRef,
          refundStatus: item.refundStatus,
          refundTxnRef: item.refundTxnRef,
          refundProcessedAt: item.refundProcessedAt,
          inspectorName: item.inspectorName,
          approverName: item.approverName,
          approvedAt: item.approvedAt,
          approvalNotes: item.approvalNotes,
          completedAt: item.completedAt,
          historyNotes: item.historyNotes || [],

          doorPassed: item.doorPassed ?? true,
          doorNotes: resolveInspectionNote(item.doorPassed ?? true, item.doorNotes, INSPECTION_DEFAULT_NOTES.door),
          doorFeeInput: item.doorFeeInput || item.doorFee || 0,

          cleanlinessPassed: item.cleanlinessPassed ?? true,
          cleanlinessNotes: resolveInspectionNote(item.cleanlinessPassed ?? true, item.cleanlinessNotes, INSPECTION_DEFAULT_NOTES.cleanliness),
          cleaningFeeInput: item.cleaningFeeInput || item.cleaningFee || 0,

          damagePassed: item.damagePassed ?? true,
          damageNotes: resolveInspectionNote(item.damagePassed ?? true, item.damageNotes, INSPECTION_DEFAULT_NOTES.damage),
          damageFeeInput: item.damageFeeInput || item.damageFee || 0,

          smartLockPassed: item.smartLockPassed ?? true,
          smartLockNotes: resolveInspectionNote(item.smartLockPassed ?? true, item.smartLockNotes, INSPECTION_DEFAULT_NOTES.smartLock),
          smartLockFeeInput: item.smartLockFeeInput || item.smartLockFee || 0,

          assetsClearedPassed: item.assetsClearedPassed ?? true,
          assetsClearedNotes: resolveInspectionNote(item.assetsClearedPassed ?? true, item.assetsClearedNotes, INSPECTION_DEFAULT_NOTES.assetsCleared),

          photoUrls: item.photoUrls || [],

          envPassed: item.envPassed ?? true,
          envNotes: resolveInspectionNote(item.envPassed ?? true, item.envNotes, INSPECTION_DEFAULT_NOTES.env),

          unitReturnedPhysically: item.unitReturnedPhysically ?? false,
          returnedAt: item.returnedAt,
          accessRevoked: item.accessRevoked ?? false,
          accessRevokedAt: item.accessRevokedAt
        }))
        setReturnCases(mapped)
        setSelectedCaseId((prev) => (prev && mapped.some((c) => c.id === prev) ? prev : mapped[0]?.id || ''))
        if (showToast) toast.success(`Đã đồng bộ ${mapped.length} hồ sơ trả kho từ máy chủ!`)
      } else {
        // Fallback to synthesizing activeRentals or rawReturnRequests if database has no records yet
        const fallbackList: ReturnCaseItem[] = []
        if (rawReturnRequests && rawReturnRequests.length > 0) {
          rawReturnRequests.forEach((req, idx) => {
            fallbackList.push({
              id: req.id || `RET-REQ-${idx}`,
              bookingId: req.bookingId || req.id,
              bookingCode: req.bookingCode || `BX-${idx}`,
              contractCode: req.contractCode || `CTR-${idx}`,
              unitCode: req.unitCode || 'TD-B102',
              customerName: req.customerName || 'Khách hàng',
              customerPhone: req.customerPhone || 'Theo hồ sơ',
              customerEmail: req.customerEmail || '',
              facilityId: req.facilityId || currentFacilityId,
              facilityName: req.facilityName || facilityName,
              requestDate: req.requestDate || new Date().toISOString().split('T')[0],
              expectedReturnDate: req.expectedReturnDate || '',
              inspectionDate: req.inspectionDate || '',
              reason: req.reason || 'Đến hạn thanh lý hợp đồng & nghiệm thu hoàn cọc',
              bankName: req.bankName || 'Vietcombank',
              bankAccountNumber: req.bankAccountNumber || '',
              bankAccountName: req.bankAccountName || '',
              depositAmount: req.depositAmount || req.depositPaid || 3500000,
              outstandingDebt: req.outstandingDebt || 0,
              cleaningFee: 0,
              damageFee: 0,
              doorFee: 0,
              smartLockFee: 0,
              smartLockIssueType: 'NORMAL_WEAR',
              lostCardFee: 0,
              status: normalizeStatus(req.status),
              inspectorName: 'Phan Van Hau',
              historyNotes: ['Khách hàng gửi yêu cầu qua Boxora Portal'],
              doorPassed: true,
              doorNotes: 'Đóng mở êm ái, ray dẫn thẳng, không móp méo cong vênh.',
              doorFeeInput: 0,
              cleanlinessPassed: true,
              cleanlinessNotes: 'Đã quét sạch rác, bề mặt sàn khô ráo, không ẩm mốc.',
              cleaningFeeInput: 0,
              damagePassed: true,
              damageNotes: 'Vách ngăn composite, sàn và trần nguyên vẹn, không khoan đục.',
              damageFeeInput: 0,
              smartLockPassed: true,
              smartLockNotes: 'Khóa thông minh IoT nhạy, chốt khóa an toàn, pin 94%.',
              smartLockFeeInput: 0,
              assetsClearedPassed: true,
              assetsClearedNotes: 'Đã lấy toàn bộ thùng đồ & tài sản ra khỏi kho.',
              photoUrls: [],
              envPassed: true,
              envNotes: 'Cảm biến IoT: 23°C • Độ ẩm 46% RH (Đạt tiêu chuẩn bảo quản)'
            })
          })
        } else if (activeRentals && activeRentals.length > 0) {
          activeRentals.slice(0, 5).forEach((r, idx) => {
            fallbackList.push({
              id: `RET-ACT-${r.id}`,
              bookingId: r.id,
              bookingCode: r.bookingCode || `BX-2026-${idx}`,
              contractCode: r.contractCode || `CTR-${r.bookingCode || r.id}`,
              unitCode: r.unitCode || `TD-A10${idx + 1}`,
              customerName: r.customerName || 'Khách thuê',
              customerPhone: r.customerPhone || '0987654321',
              customerEmail: r.customerEmail || 'khach@gmail.com',
              facilityId: r.facilityId || currentFacilityId,
              facilityName: r.facilityName || facilityName,
              requestDate: new Date().toISOString().split('T')[0],
              expectedReturnDate: r.endDate || '',
              inspectionDate: '',
              reason: 'Đến hạn thanh lý hợp đồng & nghiệm thu hoàn cọc',
              bankName: 'MB Bank',
              bankAccountNumber: '098765432199',
              bankAccountName: (r.customerName || 'KHACH THUE').toUpperCase(),
              depositAmount: r.depositPaid || r.depositAmount || 3000000,
              outstandingDebt: 0,
              cleaningFee: 0,
              damageFee: 0,
              doorFee: 0,
              smartLockFee: 0,
              smartLockIssueType: 'NORMAL_WEAR',
              lostCardFee: 0,
              status: 'RETURN_REQUESTED',
              inspectorName: 'Phan Van Hau',
              historyNotes: ['Hệ thống ghi nhận đơn đến hạn trả kho'],
              doorPassed: true,
              doorNotes: INSPECTION_DEFAULT_NOTES.door,
              doorFeeInput: 0,
              cleanlinessPassed: true,
              cleanlinessNotes: INSPECTION_DEFAULT_NOTES.cleanliness,
              cleaningFeeInput: 0,
              damagePassed: true,
              damageNotes: INSPECTION_DEFAULT_NOTES.damage,
              damageFeeInput: 0,
              smartLockPassed: true,
              smartLockNotes: INSPECTION_DEFAULT_NOTES.smartLock,
              smartLockFeeInput: 0,
              assetsClearedPassed: true,
              assetsClearedNotes: INSPECTION_DEFAULT_NOTES.assetsCleared,
              photoUrls: [],
              envPassed: true,
              envNotes: INSPECTION_DEFAULT_NOTES.env
            })
          })
        }
        setReturnCases(fallbackList)
        setSelectedCaseId(fallbackList[0]?.id || '')
      }
    } catch (err: any) {
      console.warn('Could not load return cases from backend:', err)
      toast.error('Lỗi kết nối máy chủ khi nạp danh sách trả kho.')
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchReturnCases(false)
  }, [currentFacilityId])

  const handleRefreshWorkbench = () => {
    fetchReturnCases(true)
    if (onRefresh) onRefresh()
  }

  // Filtered cases
  const filteredCases = useMemo(() => {
    return returnCases.filter((c) => {
      const st = String(c.status || '').toUpperCase()
      if (statusTabFilter !== 'ALL') {
        if (statusTabFilter === 'PENDING' && !(st === 'RETURN_REQUESTED' || st === 'PENDING')) return false
        if (
          statusTabFilter === 'INSPECTING' &&
          !(
            st === 'INSPECTION_IN_PROGRESS' ||
            st === 'INSPECTION_SCHEDULED' ||
            st === 'INSPECTION_ISSUE' ||
            st === 'INSPECTION_PASSED' ||
            st === 'INSPECTING'
          )
        )
          return false
        if (
          statusTabFilter === 'REFUNDING' &&
          !(
            st === 'REFUND_PENDING_APPROVAL' ||
            st === 'REFUND_APPROVED' ||
            st === 'REFUND_PROCESSING' ||
            st === 'REFUNDED'
          )
        )
          return false
        if (statusTabFilter === 'COMPLETED' && st !== 'COMPLETED') return false
      }
      if (searchFilter.trim()) {
        const q = searchFilter.trim().toLowerCase()
        const matchUnit = c.unitCode.toLowerCase().includes(q)
        const matchCust = c.customerName.toLowerCase().includes(q)
        const matchPhone = c.customerPhone.includes(q)
        const matchCode = c.bookingCode.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
        if (!matchUnit && !matchCust && !matchPhone && !matchCode) return false
      }
      return true
    })
  }, [returnCases, statusTabFilter, searchFilter])

  const currentCase = useMemo(() => {
    if (filteredCases.length === 0) return null
    const found = filteredCases.find((c) => c.id === selectedCaseId)
    return found || filteredCases[0] || null
  }, [filteredCases, selectedCaseId])

  useEffect(() => {
    if (filteredCases.length > 0) {
      if (!selectedCaseId || !filteredCases.some((c) => c.id === selectedCaseId)) {
        setSelectedCaseId(filteredCases[0].id)
      }
    } else {
      setSelectedCaseId('')
    }
  }, [statusTabFilter, filteredCases, selectedCaseId])

  const updateCurrentCase = (updates: Partial<ReturnCaseItem>) => {
    if (!currentCase) return
    setReturnCases((prev) => prev.map((c) => (c.id === currentCase.id ? { ...c, ...updates } : c)))
  }

  const syncInspectionFormFromCase = (target: ReturnCaseItem | null) => {
    if (!target) return
    const isDoorOk = target.doorPassed !== undefined ? target.doorPassed : true
    const dNotes = resolveInspectionNote(isDoorOk, target.doorNotes, INSPECTION_DEFAULT_NOTES.door)
    const dFee = target.doorFeeInput || target.doorFee || 0
    setDoorPassed(isDoorOk)
    setDoorNotes(dNotes)
    setDoorFeeInput(dFee)

    const isCleanOk = target.cleanlinessPassed !== undefined ? target.cleanlinessPassed : true
    const cNotes = resolveInspectionNote(isCleanOk, target.cleanlinessNotes, INSPECTION_DEFAULT_NOTES.cleanliness)
    const cFee = target.cleaningFeeInput || target.cleaningFee || 0
    setCleanlinessPassed(isCleanOk)
    setCleanlinessNotes(cNotes)
    setCleaningFeeInput(cFee)

    const isDamageOk = target.damagePassed !== undefined ? target.damagePassed : true
    const dmgNotes = resolveInspectionNote(isDamageOk, target.damageNotes, INSPECTION_DEFAULT_NOTES.damage)
    const dmgFee = target.damageFeeInput || target.damageFee || 0
    setDamagePassed(isDamageOk)
    setDamageNotes(dmgNotes)
    setDamageFeeInput(dmgFee)

    const isLockOk = target.smartLockPassed !== undefined ? target.smartLockPassed : true
    const lockNotes = resolveInspectionNote(isLockOk, target.smartLockNotes, INSPECTION_DEFAULT_NOTES.smartLock)
    const lockFee = target.smartLockFeeInput || target.smartLockFee || 0
    const lockIssue = target.smartLockIssueType || 'NORMAL_WEAR'
    setSmartLockPassed(isLockOk)
    setSmartLockNotes(lockNotes)
    setSmartLockFeeInput(lockFee)
    setSmartLockIssueType(lockIssue)

    const isAssetsOk = target.assetsClearedPassed !== undefined ? target.assetsClearedPassed : true
    const aNotes = resolveInspectionNote(isAssetsOk, target.assetsClearedNotes, INSPECTION_DEFAULT_NOTES.assetsCleared)
    setAssetsClearedPassed(isAssetsOk)
    setAssetsClearedNotes(aNotes)

    const pUrls = target.photoUrls || []
    setPhotoUrls(pUrls)

    const isEnvOk = target.envPassed !== undefined ? target.envPassed : true
    const eNotes = resolveInspectionNote(isEnvOk, target.envNotes, INSPECTION_DEFAULT_NOTES.env)
    setEnvPassed(isEnvOk)
    setEnvNotes(eNotes)

    const snap = JSON.stringify({
      doorPassed: isDoorOk,
      doorNotes: dNotes,
      doorFeeInput: dFee,
      cleanlinessPassed: isCleanOk,
      cleanlinessNotes: cNotes,
      cleaningFeeInput: cFee,
      damagePassed: isDamageOk,
      damageNotes: dmgNotes,
      damageFeeInput: dmgFee,
      smartLockPassed: isLockOk,
      smartLockNotes: lockNotes,
      smartLockFeeInput: lockFee,
      smartLockIssueType: lockIssue,
      assetsClearedPassed: isAssetsOk,
      assetsClearedNotes: aNotes,
      photoUrls: pUrls.join('|'),
      envPassed: isEnvOk,
      envNotes: eNotes
    })
    setSavedSnapshot(snap)
  }

  // Synchronize state when switching selectedCaseId
  useEffect(() => {
    syncInspectionFormFromCase(currentCase)
  }, [currentCase?.id])

  const createSnapshot = () =>
    JSON.stringify({
      doorPassed,
      doorNotes,
      doorFeeInput,
      cleanlinessPassed,
      cleanlinessNotes,
      cleaningFeeInput,
      damagePassed,
      damageNotes,
      damageFeeInput,
      smartLockPassed,
      smartLockNotes,
      smartLockFeeInput,
      smartLockIssueType,
      assetsClearedPassed,
      assetsClearedNotes,
      photoUrls: photoUrls.join('|'),
      envPassed,
      envNotes
    })

  const currentMarkedIssues = useMemo(() => {
    const issues: { title: string; fee?: number }[] = []
    if (!doorPassed) issues.push({ title: '1. Cửa cuốn & Ray trượt: Có vấn đề', fee: doorFeeInput })
    if (!cleanlinessPassed) issues.push({ title: '2. Vệ sinh kho & Sàn nhà: Chưa dọn', fee: cleaningFeeInput })
    if (!damagePassed) issues.push({ title: '3. Kết cấu tường vách: Có hư hỏng', fee: damageFeeInput })
    if (!smartLockPassed) issues.push({ title: '4. Ổ khóa SmartLock IoT: Báo lỗi', fee: smartLockFeeInput })
    if (!assetsClearedPassed) issues.push({ title: '5. Chưa dọn trống đồ đạc của khách' })
    if (!envPassed) issues.push({ title: '7. Cảm biến môi trường Boxora IoT: Chưa đạt' })
    return issues
  }, [
    doorPassed,
    doorFeeInput,
    cleanlinessPassed,
    cleaningFeeInput,
    damagePassed,
    damageFeeInput,
    smartLockPassed,
    smartLockFeeInput,
    assetsClearedPassed,
    envPassed
  ])

  const shouldPromptDraftSave = (): boolean => {
    if (!currentCase) return false
    if (currentCase.status === 'RETURN_REQUESTED') return false
    // Chỉ hỏi lưu bản nháp khi CÓ DỮ LIỆU THAY ĐỔI trong 7 mục thẩm định so với bản gốc/lần lưu nháp gần nhất
    if (!savedSnapshot) return false
    const currentSnap = createSnapshot()
    return currentSnap !== savedSnapshot
  }

  const handleRequestChangeFilter = (targetFilter: string) => {
    if (statusTabFilter === targetFilter) return
    if (shouldPromptDraftSave()) {
      setPendingNavAction({ type: 'TAB_FILTER', targetFilter })
      setShowDraftConfirmModal(true)
      return
    }
    setStatusTabFilter(targetFilter)
  }

  const handleRequestSelectCase = (targetCaseId: string) => {
    if (targetCaseId === currentCase?.id) return
    if (shouldPromptDraftSave()) {
      setPendingNavAction({ type: 'SELECT_CASE', targetCaseId })
      setShowDraftConfirmModal(true)
      return
    }
    setSelectedCaseId(targetCaseId)
  }

  const handleRequestRefresh = () => {
    if (shouldPromptDraftSave()) {
      setPendingNavAction({ type: 'REFRESH' })
      setShowDraftConfirmModal(true)
      return
    }
    handleRefreshWorkbench()
  }

  const handleConfirmSaveDraftAndProceed = async () => {
    setIsSavingDraftModal(true)
    try {
      const ok = await handleSaveInspection('ISSUE', true)
      if (ok) {
        if (pendingNavAction) {
          if (pendingNavAction.type === 'TAB_FILTER' && pendingNavAction.targetFilter) {
            setStatusTabFilter(pendingNavAction.targetFilter)
          } else if (pendingNavAction.type === 'SELECT_CASE' && pendingNavAction.targetCaseId) {
            setSelectedCaseId(pendingNavAction.targetCaseId)
          } else if (pendingNavAction.type === 'REFRESH') {
            await fetchReturnCases(true)
          }
        }
        setShowDraftConfirmModal(false)
        setPendingNavAction(null)
      }
    } finally {
      setIsSavingDraftModal(false)
    }
  }

  const handleDiscardDraftAndProceed = async () => {
    await fetchReturnCases(false)
    if (pendingNavAction) {
      if (pendingNavAction.type === 'TAB_FILTER' && pendingNavAction.targetFilter) {
        setStatusTabFilter(pendingNavAction.targetFilter)
      } else if (pendingNavAction.type === 'SELECT_CASE' && pendingNavAction.targetCaseId) {
        setSelectedCaseId(pendingNavAction.targetCaseId)
      } else if (pendingNavAction.type === 'REFRESH') {
        handleRefreshWorkbench()
      }
    }
    syncInspectionFormFromCase(currentCase)
    setShowDraftConfirmModal(false)
    setPendingNavAction(null)
  }

  const handleCancelNavigation = () => {
    setShowDraftConfirmModal(false)
    setPendingNavAction(null)
  }

  // Handle actual file upload to server
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !currentCase) return
    const fileList = Array.from(files)

    setIsUploadingPhoto(true)
    let uploadedCount = 0

    for (const file of fileList) {
      if (file.size > 10 * 1024 * 1024) {
        toast.warning(`Tệp ${file.name} vượt quá 10MB cho phép.`)
        continue
      }
      try {
        if (currentCase.bookingId && !currentCase.bookingId.startsWith('LOCAL-')) {
          const res = await handoverService.uploadHandoverDocument(currentCase.bookingId, file, 'CHECKIN_EVIDENCE')
          if (res?.fileUrl) {
            setPhotoUrls((prev) => {
              const next = [...prev, res.fileUrl]
              updateCurrentCase({ photoUrls: next })
              return next
            })
            uploadedCount++
          }
        } else {
          // In-memory reader for test fallback
          const reader = new FileReader()
          reader.onload = (loadEvt) => {
            const result = loadEvt.target?.result
            if (typeof result === 'string') {
              setPhotoUrls((prev) => {
                const next = [...prev, result]
                updateCurrentCase({ photoUrls: next })
                return next
              })
            }
          }
          reader.readAsDataURL(file)
          uploadedCount++
        }
      } catch (err: any) {
        toast.error(`Không thể tải lên ảnh ${file.name}: ${err.response?.data?.message || err.message}`)
      }
    }

    setIsUploadingPhoto(false)
    e.target.value = ''
    if (uploadedCount > 0) {
      toast.success(`Đã tải lên ${uploadedCount} ảnh bằng chứng hiện trường thành công!`)
    }
  }

  const handleRemovePhoto = (indexToRemove: number) => {
    setPhotoUrls((prev) => {
      const next = prev.filter((_, idx) => idx !== indexToRemove)
      updateCurrentCase({ photoUrls: next })
      return next
    })
    toast.info('Đã gỡ ảnh khỏi biên bản.')
  }

  // Financial calculations
  const deposit = currentCase?.depositAmount || 0
  const cleaningFee = cleanlinessPassed ? 0 : cleaningFeeInput
  const doorFee = doorPassed ? 0 : doorFeeInput
  const damageFee = damagePassed ? 0 : damageFeeInput
  // SmartLock fee is ONLY charged to customer if it is CUSTOMER_FAULT!
  const isCustomerFaultLock = !smartLockPassed && smartLockIssueType === 'CUSTOMER_FAULT'
  const smartLockFee = isCustomerFaultLock ? smartLockFeeInput : 0
  const lostCardFee = currentCase?.lostCardFee || 0
  const outstandingDebt = currentCase?.outstandingDebt || 0

  // 1. Tổng khấu trừ bồi thường của khách
  const totalDeduction = cleaningFee + doorFee + damageFee + smartLockFee + lostCardFee
  const totalVerifiedRepairCost = totalDeduction + outstandingDebt
  const isOverDeposit = totalVerifiedRepairCost > deposit
  const deductedDepositAmount = Math.min(deposit, totalVerifiedRepairCost)
  const customerPayableAmount = Math.max(0, totalVerifiedRepairCost - deposit)
  const netRefundAmount = currentCase ? Math.max(0, deposit - totalVerifiedRepairCost) : 0

  // KPI Metrics
  const metrics = useMemo(() => {
    let pending = 0
    let inspecting = 0
    let refunding = 0
    let completed = 0
    returnCases.forEach((c) => {
      const st = String(c.status || '').toUpperCase()
      if (st === 'RETURN_REQUESTED' || st === 'PENDING' || !st) {
        pending++
      } else if (
        st === 'INSPECTION_IN_PROGRESS' ||
        st === 'INSPECTION_SCHEDULED' ||
        st === 'INSPECTION_ISSUE' ||
        st === 'INSPECTION_PASSED' ||
        st === 'INSPECTING'
      ) {
        inspecting++
      } else if (
        st === 'REFUND_PENDING_APPROVAL' ||
        st === 'REFUND_APPROVED' ||
        st === 'REFUND_PROCESSING' ||
        st === 'REFUNDED' ||
        st === 'REFUNDING'
      ) {
        refunding++
      } else if (st === 'COMPLETED' || st === 'RESOLVED') {
        completed++
      } else {
        pending++
      }
    })
    return { pending, inspecting, refunding, completed, total: returnCases.length }
  }, [returnCases])

  useEffect(() => {
    if (onMetricsChange) {
      onMetricsChange(metrics)
    }
  }, [metrics, onMetricsChange])

  // =========================================================================
  // WORKFLOW ACTION HANDLERS (FULL BACKEND INTEGRATION)
  // =========================================================================

  // Step 1: Schedule Inspection
  const handleOpenScheduleModal = () => {
    if (!currentCase) return
    const now = new Date()
    const defaultTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`
    setScheduleDatetimeInput(currentCase.inspectionDate || defaultTime)
    setShowScheduleConfirmModal(true)
  }

  const confirmScheduleInspection = async (scheduledTime?: string) => {
    if (!currentCase) return
    const inspectTime = scheduledTime || new Date().toLocaleString('vi-VN')

    try {
      if (currentCase.bookingId && !currentCase.bookingId.startsWith('LOCAL-')) {
        await handoverService.scheduleInspection(
          currentCase.bookingId,
          inspectTime,
          `Tiếp nhận và hẹn lịch nghiệm thu bởi ${userName}`
        )
      }
      updateCurrentCase({
        status: 'INSPECTION_SCHEDULED',
        inspectionStatus: 'SCHEDULED',
        inspectionDate: inspectTime
      })
      setSelectedCaseId(currentCase.id)
      setShowScheduleConfirmModal(false)
      setStatusTabFilter('INSPECTING')
      toast.success(`Đã lên lịch nghiệm thu kho #${currentCase.unitCode} lúc ${inspectTime}!`)
      await fetchReturnCases()
    } catch (err: any) {
      toast.error(`Lỗi lên lịch: ${err.response?.data?.message || err.message}`)
    }
  }

  // Step 2: Start Inspection
  const handleStartInspection = async () => {
    if (!currentCase) return
    try {
      if (currentCase.bookingId && !currentCase.bookingId.startsWith('LOCAL-')) {
        await handoverService.startInspection(currentCase.bookingId)
      }
      updateCurrentCase({
        status: 'INSPECTION_IN_PROGRESS',
        inspectorName: userName,
        historyNotes: [
          ...(currentCase.historyNotes || []),
          `Bắt đầu kiểm tra hiện trường kho #${currentCase.unitCode} bởi ${userName}`
        ]
      })
      if (statusTabFilter === 'PENDING') {
        setStatusTabFilter('ALL')
      }
      toast.info(`Bắt đầu nghiệm thu kho #${currentCase.unitCode}. Trạng thái: Đang nghiệm thu.`)
    } catch (err: any) {
      toast.error(`Lỗi bắt đầu nghiệm thu: ${err.response?.data?.message || err.message}`)
    }
  }

  // Step 3: Save Inspection (Draft or Official)
  const handleSaveInspection = async (resultType: 'PASSED' | 'ISSUE', isDraft: boolean = false): Promise<boolean> => {
    if (!currentCase) return false

    // Pre-condition validations
    if (!isDraft) {
      const missingNotes: string[] = []
      if (!doorPassed && !doorNotes.trim()) missingNotes.push('1. Cửa cuốn & Ray trượt')
      if (!cleanlinessPassed && !cleanlinessNotes.trim()) missingNotes.push('2. Vệ sinh kho & Sàn nhà')
      if (!damagePassed && !damageNotes.trim()) missingNotes.push('3. Kết cấu tường vách & Sàn trần')
      if (!smartLockPassed && !smartLockNotes.trim()) missingNotes.push('4. Ổ khóa SmartLock IoT')
      if (!assetsClearedPassed && !assetsClearedNotes.trim()) missingNotes.push('5. Xác nhận dọn trống tài sản')
      if (!envPassed && !envNotes.trim()) missingNotes.push('7. Cảm biến môi trường Boxora IoT')

      if (missingNotes.length > 0) {
        toast.error(`Bắt buộc nhập mô tả chi tiết hư hại/sự cố cho: ${missingNotes.join(', ')}`)
        return false
      }

      if (resultType === 'PASSED') {
        if (photoUrls.length < 2) {
          toast.error('Quy định Boxora bắt buộc: Cần tối thiểu 2 ảnh bằng chứng hiện trường trước khi lưu nghiệm thu ĐẠT CHUẨN!')
          return false
        }
        if (!assetsClearedPassed) {
          toast.error('Kho chưa dọn trống tài sản của khách hàng! Không thể lập biên bản ĐẠT CHUẨN.')
          return false
        }
        if (!doorPassed || !cleanlinessPassed || !damagePassed || !smartLockPassed || !envPassed) {
          toast.error('Có tiêu chí chưa đạt! Vui lòng chọn "Lập biên bản có hư hại" hoặc chuyển các tiêu chí sang Đạt.')
          return false
        }
      }
    }

    const payload: ReturnInspectionPayload = {
      bookingId: currentCase.bookingId,
      isDraft,
      doorConditionPassed: doorPassed,
      doorFee: doorPassed ? 0 : doorFeeInput,
      doorNotes,
      cleanlinessPassed,
      cleaningFee: cleanlinessPassed ? 0 : cleaningFeeInput,
      cleanlinessNotes,
      wallStructurePassed: damagePassed,
      damageFee: damagePassed ? 0 : damageFeeInput,
      damageNotes,
      smartLockPassed,
      smartLockFee: smartLockPassed || smartLockIssueType !== 'CUSTOMER_FAULT' ? 0 : smartLockFeeInput,
      smartLockNotes,
      smartLockIssueType,
      assetsClearedPassed,
      assetsClearedNotes,
      sensorPassed: envPassed,
      sensorNotes: envNotes,
      evidencePhotos: photoUrls,
      notes: isDraft ? 'Lưu bản nháp nghiệm thu' : `Biên bản nghiệm thu: [${resultType === 'PASSED' ? 'ĐẠT CHUẨN' : 'CÓ HƯ HẠI'}]`
    }

    try {
      if (currentCase.bookingId && !currentCase.bookingId.startsWith('LOCAL-')) {
        await handoverService.saveReturnInspection(payload)
      }
      toast.success(isDraft ? 'Đã lưu bản nháp nghiệm thu thành công!' : 'Đã lưu biên bản nghiệm thu hiện trường!')
      await fetchReturnCases()
      setSavedSnapshot(createSnapshot())
      return true
    } catch (err: any) {
      toast.error(`Lỗi lưu biên bản: ${err.response?.data?.message || err.message}`)
      return false
    }
  }

  // Step 4: Submit for Approval
  const handleSubmitRefundApproval = async () => {
    if (!currentCase) return
    try {
      if (currentCase.bookingId && !currentCase.bookingId.startsWith('LOCAL-')) {
        await handoverService.submitDeductionsForApproval(
          currentCase.bookingId,
          `Nhân viên ${userName} trình duyệt quyết toán: Khấu trừ ${totalDeduction.toLocaleString('vi-VN')}đ`
        )
      }
      toast.success('Đã trình duyệt quyết toán lên Quản lý cơ sở (Facility Manager)!')
      await fetchReturnCases()
    } catch (err: any) {
      toast.error(`Lỗi trình duyệt: ${err.response?.data?.message || err.message}`)
    }
  }

  // Step 5: Manager Approve or Reject
  const handleApproveSettlement = async (action: 'APPROVE' | 'REJECT') => {
    if (!currentCase) return
    if (!isFacilityManager) {
      toast.error('Chỉ Quản lý cơ sở (FACILITY_MANAGER) hoặc cấp thẩm quyền mới được phê duyệt quyết toán!')
      return
    }

    try {
      if (currentCase.bookingId && !currentCase.bookingId.startsWith('LOCAL-')) {
        await handoverService.approveSettlement(currentCase.bookingId, {
          approvalAction: action,
          approvedDeductionAmount: action === 'APPROVE' ? totalDeduction : 0,
          notes: action === 'APPROVE' ? `Quản lý ${userName} phê duyệt quyết toán.` : `Quản lý ${userName} từ chối / yêu cầu thẩm định lại.`
        })
      }
      if (action === 'APPROVE') {
        toast.success('Đã phê duyệt quyết toán thành công!')
      } else {
        toast.warning('Đã từ chối và yêu cầu kiểm tra lại hiện trường.')
      }
      await fetchReturnCases()
    } catch (err: any) {
      toast.error(`Lỗi phê duyệt: ${err.response?.data?.message || err.message}`)
    }
  }

  // Step 6: Customer Dispute
  const handleRecordDispute = async () => {
    if (!currentCase || !disputeReasonInput.trim()) {
      toast.warning('Vui lòng nhập lý do khách hàng khiếu nại.')
      return
    }
    setIsSubmittingDispute(true)
    try {
      if (currentCase.bookingId && !currentCase.bookingId.startsWith('LOCAL-')) {
        await handoverService.recordCustomerDispute(currentCase.bookingId, disputeReasonInput.trim())
      }
      toast.warning(`Đã ghi nhận tranh chấp cho hồ sơ #${currentCase.unitCode}!`)
      setShowDisputeModal(false)
      setDisputeReasonInput('')
      await fetchReturnCases()
    } catch (err: any) {
      toast.error(`Lỗi ghi nhận tranh chấp: ${err.response?.data?.message || err.message}`)
    } finally {
      setIsSubmittingDispute(false)
    }
  }

  // Step 7: Execute Refund or Collect Additional Payment
  const handleExecuteFinancialAction = async () => {
    if (!currentCase) return
    setIsSubmittingRefund(true)

    try {
      if (isOverDeposit) {
        // Collect additional payment
        const txnRef = refundTxnInput.trim() || `REC-COMP-${Date.now().toString().slice(-6)}`
        if (currentCase.bookingId && !currentCase.bookingId.startsWith('LOCAL-')) {
          await handoverService.collectAdditionalPayment(currentCase.bookingId, {
            additionalPaymentMethod: refundMethodSelect,
            additionalPaymentTxnRef: txnRef,
            notes: `Thu bổ sung ${customerPayableAmount.toLocaleString('vi-VN')}đ tại quầy`
          })
        }
        toast.success(`Đã xác nhận thu đủ khoản bồi thường ${customerPayableAmount.toLocaleString('vi-VN')}đ!`)
      } else {
        // Execute refund
        const txnRef = refundTxnInput.trim() || `REF-TXN-${Date.now().toString().slice(-6)}`
        if (currentCase.bookingId && !currentCase.bookingId.startsWith('LOCAL-')) {
          await handoverService.executeRefund(currentCase.bookingId, {
            refundMethod: refundMethodSelect,
            notes: `Hoàn tiền cọc ${netRefundAmount.toLocaleString('vi-VN')}đ qua ${refundMethodSelect} (${txnRef})`
          })
        }
        toast.success(`Đã thực hiện lệnh hoàn tiền cọc ${netRefundAmount.toLocaleString('vi-VN')}đ cho khách!`)
      }
      setShowRefundModal(false)
      setRefundTxnInput('')
      await fetchReturnCases()
    } catch (err: any) {
      toast.error(`Giao dịch thất bại: ${err.response?.data?.message || err.message}`)
    } finally {
      setIsSubmittingRefund(false)
    }
  }

  // Step 8: Confirm Physical Return of Storage Unit
  const handleConfirmPhysicalReturn = async () => {
    if (!currentCase) return
    if (!assetsClearedPassed) {
      toast.error('Khách chưa lấy hết tài sản ra khỏi kho! Không thể nhận lại kho.')
      return
    }

    setIsConfirmingPhysical(true)
    try {
      if (currentCase.bookingId && !currentCase.bookingId.startsWith('LOCAL-')) {
        await handoverService.confirmPhysicalReturn(currentCase.bookingId, {
          notes: `Nhân viên ${userName} đã kiểm tra hiện trường và nhận lại buồng kho vật lý #${currentCase.unitCode}.`
        })
      }
      toast.success(`Đã xác nhận nhận lại kho #${currentCase.unitCode} từ khách hàng!`)
      await fetchReturnCases()
    } catch (err: any) {
      toast.error(`Lỗi nhận lại kho: ${err.response?.data?.message || err.message}`)
    } finally {
      setIsConfirmingPhysical(false)
    }
  }

  // Step 9: Revoke SmartLock Access
  const handleRevokeSmartLock = async () => {
    if (!currentCase) return
    setIsRevokingAccess(true)
    try {
      if (currentCase.bookingId && !currentCase.bookingId.startsWith('LOCAL-')) {
        await handoverService.revokeAccess(currentCase.bookingId)
      }
      toast.success(`Đã thu hồi mã PIN SmartLock và hủy quyền truy cập kho #${currentCase.unitCode}!`)
      await fetchReturnCases()
    } catch (err: any) {
      toast.error(`Lỗi thu hồi SmartLock: ${err.response?.data?.message || err.message}`)
    } finally {
      setIsRevokingAccess(false)
    }
  }

  // Step 10: Complete Handover & Close Contract
  const handleCompleteHandoverAndRelease = async () => {
    if (!currentCase) return

    // Pre-condition validations
    if (!currentCase.unitReturnedPhysically) {
      toast.warning('Cần nhấn "Xác Nhận Nhận Lại Kho Vật Lý" trước khi hoàn tất hồ sơ!')
      return
    }
    if (!currentCase.accessRevoked) {
      toast.warning('Cần nhấn "Thu Hồi Mã SmartLock" để đảm bảo an toàn buồng kho trước khi hoàn tất!')
      return
    }
    if (isOverDeposit && currentCase.additionalPaymentStatus !== 'PAID') {
      toast.warning('Khoản bồi thường vượt cọc chưa được thanh toán! Vui lòng thu tiền tại quầy hoặc ghi nhận.')
      return
    }

    setIsFinishingHandover(true)
    try {
      if (currentCase.bookingId && !currentCase.bookingId.startsWith('LOCAL-')) {
        await handoverService.completeReturn(currentCase.bookingId)
      }
      toast.success(
        `Đã hoàn tất thanh lý hợp đồng & giải phóng kho #${currentCase.unitCode} về trạng thái sẵn sàng!`,
        { title: 'Thanh lý thành công' }
      )
      if (onReturnCompleted) onReturnCompleted()
      await fetchReturnCases()
    } catch (err: any) {
      toast.error(`Lỗi hoàn tất hồ sơ: ${err.response?.data?.message || err.message}`)
    } finally {
      setIsFinishingHandover(false)
    }
  }

  const renderStatusBadge = (st: ReturnStepStatus) => {
    switch (st) {
      case 'RETURN_REQUESTED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">Chờ xử lý</span>
      case 'INSPECTION_SCHEDULED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-300">Đã hẹn lịch</span>
      case 'INSPECTION_IN_PROGRESS':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-300 animate-pulse">Đang nghiệm thu</span>
      case 'INSPECTION_PASSED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">Nghiệm thu ĐẠT</span>
      case 'INSPECTION_ISSUE':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300">Có hư hại / Khấu trừ</span>
      case 'REFUND_PENDING_APPROVAL':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-950 border border-amber-400">Chờ duyệt cọc</span>
      case 'REFUND_APPROVED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-100 text-teal-900 border border-teal-300">Đã duyệt quyết toán</span>
      case 'REFUND_PROCESSING':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-900 border border-sky-300">Đang hoàn tiền</span>
      case 'REFUNDED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300">Đã hoàn tiền</span>
      case 'DISPUTED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-900 border border-red-300 animate-pulse">Đang khiếu nại</span>
      case 'COMPLETED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">Đã bàn giao xong</span>
      default:
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">Chờ xử lý</span>
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-amber-900 via-slate-900 to-indigo-950 text-white shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
            <RotateCcw size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-headline font-bold">
                Quy Trình Nghiệm Thu &amp; Trả Kho Thực Địa (Boxora Warehouse Return)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                SLA HOÀN CỌC CHUẨN BOXORA
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Thẩm định 7 tiêu chí hiện trường, phân tách trách nhiệm IoT, quyết toán chống cọc âm, nhận lại ô kho và thu hồi SmartLock.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleRequestRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold border border-white/20 text-white flex items-center gap-1.5 cursor-pointer transition shadow-2xs disabled:opacity-50"
            title="Làm mới danh sách hồ sơ trả kho từ máy chủ"
          >
            <RotateCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Đang nạp...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Bar */}
      <div id="return-kpi-metrics-bar" className="grid grid-cols-2 lg:grid-cols-4 gap-3 scroll-mt-24">
        <div
          id="pending-return-kpi-card"
          onClick={() => handleRequestChangeFilter('PENDING')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusTabFilter === 'PENDING'
              ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/50 shadow-xs'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-amber-800">
            <span>1. Yêu Cầu Chờ Xử Lý</span>
            <Clock size={16} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-headline text-2xl font-extrabold text-amber-950">{metrics.pending}</span>
            <span className="text-xs text-amber-700">hồ sơ mới</span>
          </div>
        </div>

        <div
          onClick={() => handleRequestChangeFilter('INSPECTING')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusTabFilter === 'INSPECTING'
              ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-400/50 shadow-xs'
              : 'bg-white border-slate-200 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-indigo-800">
            <span>2. Đang Nghiệm Thu</span>
            <Layers size={16} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-headline text-2xl font-extrabold text-indigo-950">{metrics.inspecting}</span>
            <span className="text-xs text-indigo-700">đang kiểm tra</span>
          </div>
        </div>

        <div
          onClick={() => handleRequestChangeFilter('REFUNDING')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusTabFilter === 'REFUNDING'
              ? 'bg-teal-50 border-teal-400 ring-2 ring-teal-400/50 shadow-xs'
              : 'bg-white border-slate-200 hover:border-teal-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-teal-800">
            <span>3. Duyệt &amp; Quyết Toán</span>
            <DollarSign size={16} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-headline text-2xl font-extrabold text-teal-950">{metrics.refunding}</span>
            <span className="text-xs text-teal-700">đối soát tài chính</span>
          </div>
        </div>

        <div
          onClick={() => handleRequestChangeFilter('COMPLETED')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusTabFilter === 'COMPLETED'
              ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/50 shadow-xs'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
            <span>4. Đã Bàn Giao Xong</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-headline text-2xl font-extrabold text-emerald-950">{metrics.completed}</span>
            <span className="text-xs text-emerald-700">đã giải phóng kho</span>
          </div>
        </div>
      </div>

      {/* 3. Main Return Operations Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column (4 Cols): Danh Sách Yêu Cầu Trả Kho */}
        <div className="xl:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <RotateCcw size={16} className="text-amber-600" />
                <span>Danh Sách Hồ Sơ Trả Kho ({filteredCases.length})</span>
              </h3>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Tìm mã kho, tên khách, SĐT, mã đơn..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-amber-400 transition"
              />
            </div>

            {/* List Items */}
            <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
              {filteredCases.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100">
                  <RotateCcw size={28} className={`mx-auto mb-2 opacity-50 ${isRefreshing ? 'animate-spin text-amber-600' : ''}`} />
                  <p className="font-bold text-slate-600">Không có hồ sơ trả kho phù hợp</p>
                  <p className="text-[11px] mt-1">Thử đổi từ khóa hoặc bấm làm mới danh sách.</p>
                </div>
              ) : (
                filteredCases.map((c) => {
                  const isSelected = c.id === currentCase?.id
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleRequestSelectCase(c.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/40 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-blue-100 text-blue-900 border border-blue-200">
                            #{c.unitCode}
                          </span>
                          <span className="font-bold text-xs text-slate-900 truncate max-w-[130px]">
                            {c.customerName}
                          </span>
                        </div>
                        {renderStatusBadge(c.status)}
                      </div>

                      <div className="mt-2 text-[11px] text-slate-600 line-clamp-1">
                        Lý do: <span className="font-medium text-slate-800">{c.reason}</span>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>HĐ: {c.contractCode}</span>
                        <span className="font-bold text-slate-700">Cọc: {c.depositAmount.toLocaleString('vi-VN')}đ</span>
                      </div>

                      {/* Quick action button for pending cases */}
                      {c.status === 'RETURN_REQUESTED' && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-amber-700 font-medium italic">Chưa tiếp nhận</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (shouldPromptDraftSave()) {
                                handleRequestSelectCase(c.id)
                                return
                              }
                              setSelectedCaseId(c.id)
                              handleOpenScheduleModal()
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white font-bold text-[11px] border border-amber-300 hover:border-amber-600 transition flex items-center gap-1 cursor-pointer"
                          >
                            <CalendarCheck size={12} />
                            <span>Tiếp nhận &amp; Lên lịch</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column (8 Cols): Chi Tiết Hồ Sơ Nghiệm Thu 4 Khối A, B, C, D */}
        <div className="xl:col-span-8 space-y-6">
          {!currentCase ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-xs text-slate-400">
              <ClipboardCheck size={36} className="mx-auto mb-2 text-slate-300" />
              <p className="font-bold text-slate-700 text-sm">Vui lòng chọn một hồ sơ trả kho từ danh sách bên trái</p>
              <p className="text-xs text-slate-400 mt-1">Hệ thống sẽ tải toàn bộ biên bản kiểm định 7 tiêu chí và bảng đối soát hoàn tiền.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* KHỐI A: HỒ SƠ TRẢ KHO */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 font-mono font-bold text-xs flex items-center justify-center">
                      A
                    </span>
                    <h3 className="font-bold text-sm text-slate-900">
                      Hồ Sơ Yêu Cầu Trả Kho &amp; Thanh Lý Buồng Kho
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-500">{currentCase.id}</span>
                    {renderStatusBadge(currentCase.status)}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Khách Hàng</span>
                    <strong className="text-slate-900 text-sm font-bold block mt-0.5">{currentCase.customerName}</strong>
                    <span className="text-[11px] text-slate-500 font-mono">{currentCase.customerPhone}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Kho Trả</span>
                    <strong className="text-blue-700 text-sm font-mono font-extrabold block mt-0.5">#{currentCase.unitCode}</strong>
                    <span className="text-[11px] text-slate-500">{currentCase.facilityName}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Hợp Đồng</span>
                    <strong className="text-slate-900 text-xs font-mono font-bold block mt-0.5">{currentCase.contractCode}</strong>
                    <span className="text-[11px] text-emerald-600 font-medium">Đang thuê hợp lệ</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Lịch Nghiệm Thu</span>
                    <strong className="text-amber-800 text-xs font-mono font-bold block mt-0.5">
                      {currentCase.inspectionDate || currentCase.expectedReturnDate || 'Chưa hẹn'}
                    </strong>
                    <span className="text-[10px] text-slate-400 font-mono">Gửi: {currentCase.requestDate}</span>
                  </div>
                </div>

                {/* Reason Banner */}
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-900">
                  <span className="font-bold">Lý do trả kho: </span>
                  <span>{currentCase.reason}</span>
                </div>

                {currentCase.status === 'RETURN_REQUESTED' && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t border-slate-100 gap-3 bg-amber-50/70 p-3.5 rounded-xl border border-amber-200">
                    <div>
                      <span className="text-xs font-bold text-amber-950 block">
                        Yêu cầu trả kho đang chờ nhân viên tiếp nhận
                      </span>
                      <span className="text-[11px] text-amber-700 mt-0.5 block">
                        Nhấn nút bên cạnh để xác nhận lịch hẹn và chuyển hồ sơ sang giai đoạn <strong>Đang Nghiệm Thu</strong>.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenScheduleModal}
                      className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-xs transition flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <CalendarCheck size={15} />
                      <span>Tiếp Nhận &amp; Lên Lịch Nghiệm Thu</span>
                    </button>
                  </div>
                )}

                {currentCase.status === 'INSPECTION_SCHEDULED' && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2 bg-indigo-50/70 p-3 rounded-xl border border-indigo-100">
                    <div>
                      <span className="text-xs font-bold text-indigo-950 block">
                        ✓ Đã lên lịch nghiệm thu: <span className="font-mono">{currentCase.inspectionDate || currentCase.expectedReturnDate}</span>
                      </span>
                      <span className="text-[11px] text-indigo-700 mt-0.5 block">
                        Nhân viên có mặt tại buồng kho #{currentCase.unitCode} bấm nút để bắt đầu thẩm định 7 tiêu chí.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleStartInspection}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition"
                    >
                      <ClipboardCheck size={16} />
                      <span>Bắt Đầu Nghiệm Thu Hiện Trường</span>
                    </button>
                  </div>
                )}
              </div>

              {/* KHỐI B & C & D: Chỉ kích hoạt khi đã qua giai đoạn tiếp nhận */}
              {currentCase.status === 'RETURN_REQUESTED' ? (
                <div className="p-8 rounded-2xl bg-white border border-dashed border-amber-300 shadow-xs text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <Lock size={26} />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-slate-900">
                      Biên Bản Thẩm Định Hiện Trường (7 Tiêu Chuẩn) &amp; Quyết Toán Cọc Chưa Kích Hoạt
                    </h4>
                    <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1.5 leading-relaxed">
                      Hồ sơ buồng kho <strong className="text-blue-700 font-mono">#{currentCase.unitCode}</strong> của khách hàng <strong className="text-slate-800">{currentCase.customerName}</strong> đang ở trạng thái <strong>Chờ xử lý</strong>.
                      <br />
                      Vui lòng bấm <strong>"Tiếp Nhận &amp; Lên Lịch Nghiệm Thu"</strong> để chuyển sang giai đoạn <strong>2. Đang Nghiệm Thu</strong> trước khi bắt đầu kiểm tra hiện trường và đối soát cọc.
                    </p>
                  </div>
              
                </div>
              ) : (
                <>
                  {/* KHỐI B: BIÊN BẢN THẨM ĐỊNH HIỆN TRƯỜNG (CHECKLIST 7 HẠNG MỤC) */}
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 font-mono font-bold text-xs flex items-center justify-center">
                          B
                        </span>
                        <div>
                          <h3 className="font-bold text-sm text-slate-900">
                            Biên Bản Thẩm Định Hiện Trường (7 Tiêu Chuẩn Nghiệm Thu)
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            Kiểm tra thực tế hiện trạng buồng kho trước khi lập biên bản hoàn cọc.
                          </p>
                        </div>
                      </div>

                      {currentCase.status === 'INSPECTION_IN_PROGRESS' && (
                        <span className="px-3 py-1 rounded-xl bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
                          <span>Đang nghiệm thu hiện trường</span>
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      {/* 1. Cửa cuốn & Ray trượt */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2.5 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">1. Cửa cuốn &amp; Ray trượt</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${doorPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {doorPassed ? '✓ Đạt chuẩn' : '⚠️ Có vấn đề'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setDoorPassed(true)
                                setDoorFeeInput(0)
                                const defaultNote = INSPECTION_DEFAULT_NOTES.door
                                setDoorNotes(defaultNote)
                                updateCurrentCase({ doorPassed: true, doorFeeInput: 0, doorFee: 0, doorNotes: defaultNote })
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${doorPassed ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                            >
                              Đạt
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDoorPassed(false)
                                const newFee = doorFeeInput > 0 ? doorFeeInput : 300000
                                setDoorFeeInput(newFee)
                                const newNotes = doorNotes.trim() === INSPECTION_DEFAULT_NOTES.door ? '' : doorNotes
                                setDoorNotes(newNotes)
                                updateCurrentCase({ doorPassed: false, doorFeeInput: newFee, doorFee: newFee, doorNotes: newNotes })
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${!doorPassed ? 'bg-rose-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                            >
                              Hư hại
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <input
                            type="text"
                            value={doorNotes}
                            onChange={(e) => {
                              setDoorNotes(e.target.value)
                              updateCurrentCase({ doorNotes: e.target.value })
                            }}
                            className={`w-full text-xs rounded-lg p-2 text-slate-800 focus:outline-none transition ${
                              !doorPassed && !doorNotes.trim()
                                ? 'bg-rose-50/40 border-2 border-rose-400 focus:border-rose-500 ring-1 ring-rose-200'
                                : 'bg-white border border-slate-200 focus:border-amber-400'
                            }`}
                            placeholder={
                              doorPassed
                                ? 'Gợi ý: Đóng mở êm ái, ray dẫn thẳng, không móp méo cong vênh.'
                                : '* Bắt buộc: Mô tả cụ thể lỗi cửa cuốn (cong vênh, kẹt ray, móp méo...)'
                            }
                          />
                          {!doorPassed && !doorNotes.trim() && (
                            <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                              * Bắt buộc nhập mô tả chi tiết hư hại cửa cuốn khi Chưa đạt
                            </span>
                          )}
                        </div>

                        {!doorPassed && (
                          <div className="p-2.5 rounded-lg bg-rose-50/70 border border-rose-200 flex items-center gap-2 flex-wrap text-xs">
                            <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                            <span className="font-bold text-rose-800">Phí khắc phục hư hại cửa cuốn dự kiến:</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                value={doorFeeInput}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0
                                  setDoorFeeInput(val)
                                  updateCurrentCase({ doorFeeInput: val, doorFee: val })
                                }}
                                className="w-32 p-1.5 text-xs border border-rose-300 rounded-lg bg-white font-mono font-bold text-rose-900 focus:outline-none focus:ring-1 focus:ring-rose-400"
                                placeholder="300000"
                              />
                              <span className="font-bold text-rose-700">VNĐ</span>
                            </div>
                            <span className="text-[11px] text-rose-600 font-medium">(Khấu trừ trực tiếp vào tiền cọc)</span>
                          </div>
                        )}
                      </div>

                      {/* 2. Vệ sinh kho */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2.5 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">2. Vệ sinh kho &amp; Sàn nhà</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${cleanlinessPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                              {cleanlinessPassed ? '✓ Sạch sẽ' : '⚠️ Chưa dọn'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setCleanlinessPassed(true)
                                setCleaningFeeInput(0)
                                const defaultNote = INSPECTION_DEFAULT_NOTES.cleanliness
                                setCleanlinessNotes(defaultNote)
                                updateCurrentCase({ cleanlinessPassed: true, cleaningFeeInput: 0, cleaningFee: 0, cleanlinessNotes: defaultNote })
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${cleanlinessPassed ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                            >
                              Sạch
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCleanlinessPassed(false)
                                const newFee = cleaningFeeInput > 0 ? cleaningFeeInput : 150000
                                setCleaningFeeInput(newFee)
                                const newNotes = cleanlinessNotes.trim() === INSPECTION_DEFAULT_NOTES.cleanliness ? '' : cleanlinessNotes
                                setCleanlinessNotes(newNotes)
                                updateCurrentCase({ cleanlinessPassed: false, cleaningFeeInput: newFee, cleaningFee: newFee, cleanlinessNotes: newNotes })
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${!cleanlinessPassed ? 'bg-amber-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                            >
                              Chưa dọn
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <input
                            type="text"
                            value={cleanlinessNotes}
                            onChange={(e) => {
                              setCleanlinessNotes(e.target.value)
                              updateCurrentCase({ cleanlinessNotes: e.target.value })
                            }}
                            className={`w-full text-xs rounded-lg p-2 text-slate-800 focus:outline-none transition ${
                              !cleanlinessPassed && !cleanlinessNotes.trim()
                                ? 'bg-rose-50/40 border-2 border-rose-400 focus:border-rose-500 ring-1 ring-rose-200'
                                : 'bg-white border border-slate-200 focus:border-amber-400'
                            }`}
                            placeholder={
                              cleanlinessPassed
                                ? 'Gợi ý: Đã quét sạch rác, bề mặt sàn khô ráo, không ẩm mốc.'
                                : '* Bắt buộc: Mô tả tình trạng vệ sinh (rác tồn đọng, vết dầu mỡ, ẩm mốc...)'
                            }
                          />
                          {!cleanlinessPassed && !cleanlinessNotes.trim() && (
                            <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                              * Bắt buộc nhập mô tả tình trạng vệ sinh khi Chưa đạt
                            </span>
                          )}
                        </div>

                        {!cleanlinessPassed && (
                          <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200 flex items-center gap-2 flex-wrap text-xs">
                            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                            <span className="font-bold text-amber-900">Phí dịch vụ dọn vệ sinh:</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                value={cleaningFeeInput}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0
                                  setCleaningFeeInput(val)
                                  updateCurrentCase({ cleaningFeeInput: val, cleaningFee: val })
                                }}
                                className="w-32 p-1.5 text-xs border border-amber-300 rounded-lg bg-white font-mono font-bold text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-400"
                                placeholder="150000"
                              />
                              <span className="font-bold text-amber-800">VNĐ</span>
                            </div>
                            <span className="text-[11px] text-amber-700 font-medium">(Khấu trừ trực tiếp vào tiền cọc)</span>
                          </div>
                        )}
                      </div>

                      {/* 3. Hư hại vách sàn trần */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2.5 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">3. Kết cấu tường vách &amp; Sàn trần</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${damagePassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {damagePassed ? '✓ Nguyên vẹn' : '⚠️ Có hư hỏng'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setDamagePassed(true)
                                setDamageFeeInput(0)
                                const defaultNote = INSPECTION_DEFAULT_NOTES.damage
                                setDamageNotes(defaultNote)
                                updateCurrentCase({ damagePassed: true, damageFeeInput: 0, damageFee: 0, damageNotes: defaultNote })
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${damagePassed ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                            >
                              Nguyên vẹn
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDamagePassed(false)
                                const newFee = damageFeeInput > 0 ? damageFeeInput : 500000
                                setDamageFeeInput(newFee)
                                const newNotes = damageNotes.trim() === INSPECTION_DEFAULT_NOTES.damage ? '' : damageNotes
                                setDamageNotes(newNotes)
                                updateCurrentCase({ damagePassed: false, damageFeeInput: newFee, damageFee: newFee, damageNotes: newNotes })
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${!damagePassed ? 'bg-rose-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                            >
                              Hư hại
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <input
                            type="text"
                            value={damageNotes}
                            onChange={(e) => {
                              setDamageNotes(e.target.value)
                              updateCurrentCase({ damageNotes: e.target.value })
                            }}
                            className={`w-full text-xs rounded-lg p-2 text-slate-800 focus:outline-none transition ${
                              !damagePassed && !damageNotes.trim()
                                ? 'bg-rose-50/40 border-2 border-rose-400 focus:border-rose-500 ring-1 ring-rose-200'
                                : 'bg-white border border-slate-200 focus:border-amber-400'
                            }`}
                            placeholder={
                              damagePassed
                                ? 'Gợi ý: Vách ngăn composite, sàn và trần nguyên vẹn, không khoan đục.'
                                : '* Bắt buộc: Mô tả chi tiết hư hại vách/sàn/trần (khoan đục, móp méo, trầy xước...)'
                            }
                          />
                          {!damagePassed && !damageNotes.trim() && (
                            <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                              * Bắt buộc nhập mô tả hư hại tường vách / sàn trần khi Chưa đạt
                            </span>
                          )}
                        </div>

                        {!damagePassed && (
                          <div className="p-2.5 rounded-lg bg-rose-50/70 border border-rose-200 flex items-center gap-2 flex-wrap text-xs">
                            <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                            <span className="font-bold text-rose-800">Phí khắc phục hư hại kho dự kiến:</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                value={damageFeeInput}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0
                                  setDamageFeeInput(val)
                                  updateCurrentCase({ damageFeeInput: val, damageFee: val })
                                }}
                                className="w-32 p-1.5 text-xs border border-rose-300 rounded-lg bg-white font-mono font-bold text-rose-900 focus:outline-none focus:ring-1 focus:ring-rose-400"
                                placeholder="500000"
                              />
                              <span className="font-bold text-rose-700">VNĐ</span>
                            </div>
                            <span className="text-[11px] text-rose-600 font-medium">(Cần quản lý cơ sở phê duyệt)</span>
                          </div>
                        )}
                      </div>

                      {/* 4. Khóa Smart Lock IoT (BẢO VỆ NGHIỆP VỤ 5.2: TÁCH LỖI KHÁCH VỚI HAO MÒN/LỖI THIẾT BỊ) */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2.5 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">4. Ổ khóa SmartLock IoT</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${smartLockPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {smartLockPassed ? '✓ Pin 94% • Hoạt động tốt' : '⚠️ Báo lỗi / Sự cố'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setSmartLockPassed(true)
                                setSmartLockFeeInput(0)
                                const defaultNote = INSPECTION_DEFAULT_NOTES.smartLock
                                setSmartLockNotes(defaultNote)
                                updateCurrentCase({ smartLockPassed: true, smartLockFeeInput: 0, smartLockFee: 0, smartLockNotes: defaultNote })
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${smartLockPassed ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                            >
                              Bình thường
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSmartLockPassed(false)
                                const newNotes = smartLockNotes.trim() === INSPECTION_DEFAULT_NOTES.smartLock ? '' : smartLockNotes
                                setSmartLockNotes(newNotes)
                                updateCurrentCase({ smartLockPassed: false, smartLockNotes: newNotes })
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${!smartLockPassed ? 'bg-rose-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                            >
                              Báo lỗi
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <input
                            type="text"
                            value={smartLockNotes}
                            onChange={(e) => {
                              setSmartLockNotes(e.target.value)
                              updateCurrentCase({ smartLockNotes: e.target.value })
                            }}
                            className={`w-full text-xs rounded-lg p-2 text-slate-800 focus:outline-none transition ${
                              !smartLockPassed && !smartLockNotes.trim()
                                ? 'bg-rose-50/40 border-2 border-rose-400 focus:border-rose-500 ring-1 ring-rose-200'
                                : 'bg-white border border-slate-200 focus:border-amber-400'
                            }`}
                            placeholder={
                              smartLockPassed
                                ? 'Gợi ý: Khóa thông minh IoT nhạy, chốt khóa an toàn, pin 94%.'
                                : '* Bắt buộc: Mô tả sự cố khóa SmartLock (kẹt chốt, pin chai, cạy phá, lỗi kết nối...)'
                            }
                          />
                          {!smartLockPassed && !smartLockNotes.trim() && (
                            <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                              * Bắt buộc nhập mô tả sự cố khóa SmartLock khi Chưa đạt
                            </span>
                          )}
                        </div>

                        {!smartLockPassed && (
                          <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-300 space-y-2 text-xs">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="font-bold text-amber-950 flex items-center gap-1.5">
                                <KeyRound size={15} className="text-amber-700" />
                                <span>Phân loại nguyên nhân sự cố SmartLock:</span>
                              </span>
                              <select
                                value={smartLockIssueType}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setSmartLockIssueType(val)
                                  if (val !== 'CUSTOMER_FAULT') {
                                    setSmartLockFeeInput(0)
                                    updateCurrentCase({ smartLockIssueType: val, smartLockFeeInput: 0, smartLockFee: 0 })
                                  } else {
                                    const initialFee = smartLockFeeInput > 0 ? smartLockFeeInput : 4000000
                                    setSmartLockFeeInput(initialFee)
                                    updateCurrentCase({ smartLockIssueType: val, smartLockFeeInput: initialFee, smartLockFee: initialFee })
                                  }
                                }}
                                className="p-1.5 bg-white border border-amber-300 rounded-lg font-bold text-amber-900 text-xs focus:ring-1 focus:ring-amber-400"
                              >
                                <option value="NORMAL_WEAR">Hao mòn tự nhiên (Boxora chịu)</option>
                                <option value="DEVICE_ERROR">Lỗi phần cứng / Hết pin (Bảo hành Boxora)</option>
                                <option value="CONNECTION_ERROR">Mất kết nối mạng IoT (Kỹ thuật xử lý)</option>
                                <option value="PENDING_VERIFICATION">Chờ xác minh nguyên nhân (Không trừ tiền khách)</option>
                                <option value="CUSTOMER_FAULT">Khách làm hư hại / Cạy phá (Khách bồi thường)</option>
                              </select>
                            </div>

                            {smartLockIssueType !== 'CUSTOMER_FAULT' ? (
                              <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-[11px] flex items-center gap-2">
                                <ShieldCheck size={16} className="text-blue-600 shrink-0" />
                                <span>
                                  <strong>Chính sách Boxora:</strong> Lỗi thiết bị, pin yếu, mất kết nối hoặc chưa xác minh <strong>tuyệt đối không khấu trừ vào tiền cọc</strong> của khách hàng. Boxora bảo trì kỹ thuật miễn phí.
                                </span>
                              </div>
                            ) : (
                              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2 flex-wrap text-xs">
                                <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                                <span className="font-bold text-rose-800">Khoản bồi thường SmartLock do khách gây hư hại:</span>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    value={smartLockFeeInput}
                                    onChange={(e) => {
                                      const val = Number(e.target.value) || 0
                                      setSmartLockFeeInput(val)
                                      updateCurrentCase({ smartLockFeeInput: val, smartLockFee: val })
                                    }}
                                    className="w-32 p-1.5 text-xs border border-rose-300 rounded-lg bg-white font-mono font-bold text-rose-900 focus:outline-none focus:ring-1 focus:ring-rose-400"
                                    placeholder="4000000"
                                  />
                                  <span className="font-bold text-rose-700">VNĐ</span>
                                </div>
                                <span className="text-[11px] text-rose-600 font-medium">(Yêu cầu ảnh bằng chứng và phê duyệt quản lý)</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 5. Tài sản còn lại */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">5. Xác nhận không còn đồ đạc trong kho</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${assetsClearedPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {assetsClearedPassed ? '✓ Kho đã dọn trống' : '⚠️ Vẫn còn đồ của khách'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setAssetsClearedPassed(true)
                                const defaultNote = INSPECTION_DEFAULT_NOTES.assetsCleared
                                setAssetsClearedNotes(defaultNote)
                                updateCurrentCase({ assetsClearedPassed: true, assetsClearedNotes: defaultNote })
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${assetsClearedPassed ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                            >
                              Đã dọn trống
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAssetsClearedPassed(false)
                                const newNotes = assetsClearedNotes.trim() === INSPECTION_DEFAULT_NOTES.assetsCleared ? '' : assetsClearedNotes
                                setAssetsClearedNotes(newNotes)
                                updateCurrentCase({ assetsClearedPassed: false, assetsClearedNotes: newNotes })
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${!assetsClearedPassed ? 'bg-rose-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                            >
                              Còn đồ
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={assetsClearedNotes}
                            onChange={(e) => {
                              setAssetsClearedNotes(e.target.value)
                              updateCurrentCase({ assetsClearedNotes: e.target.value })
                            }}
                            className={`w-full text-xs rounded-lg p-2 text-slate-800 focus:outline-none transition ${
                              !assetsClearedPassed && !assetsClearedNotes.trim()
                                ? 'bg-rose-50/40 border-2 border-rose-400 focus:border-rose-500 ring-1 ring-rose-200'
                                : 'bg-white border border-slate-200 focus:border-amber-400'
                            }`}
                            placeholder={
                              assetsClearedPassed
                                ? 'Gợi ý: Đã lấy toàn bộ thùng đồ & tài sản ra khỏi kho.'
                                : '* Bắt buộc: Ghi rõ tài sản/đồ đạc của khách còn để lại trong kho...'
                            }
                          />
                          {!assetsClearedPassed && !assetsClearedNotes.trim() && (
                            <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                              * Bắt buộc ghi rõ tài sản/đồ đạc còn để lại trong kho
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 6. Ảnh chụp hiện trường có Upload thật (TỐI THIỂU 2 ẢNH) */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleImageUpload}
                        />
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">6. Ảnh bằng chứng hiện trường (Tối thiểu 2 ảnh)</span>
                            {photoUrls.length >= 2 ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                ✓ Đủ {photoUrls.length}/2 ảnh (Hợp lệ)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                                ⚠️ Cần tối thiểu 2 ảnh (hiện có {photoUrls.length}/2 ảnh)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploadingPhoto}
                              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition disabled:opacity-50"
                            >
                              <Upload size={14} className={isUploadingPhoto ? 'animate-spin' : ''} />
                              <span>{isUploadingPhoto ? 'Đang tải lên...' : '+ Tải ảnh hiện trường'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const demo = [...DEFAULT_PROOF_PHOTOS]
                                setPhotoUrls(demo)
                                updateCurrentCase({ photoUrls: demo })
                                toast.info('[DEMO] Đã nạp 2 ảnh mẫu cho môi trường kiểm thử.')
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-medium text-xs cursor-pointer transition"
                              title="Chỉ dùng trong môi trường kiểm thử"
                            >
                              [Demo] Ảnh mẫu
                            </button>

                            {photoUrls.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPhotoUrls([])
                                  updateCurrentCase({ photoUrls: [] })
                                  toast.info('Đã xóa tất cả ảnh hiện trường.')
                                }}
                                className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-medium cursor-pointer transition"
                              >
                                Xóa hết
                              </button>
                            )}
                          </div>
                        </div>

                        {photoUrls.length === 0 ? (
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            className="p-8 border-2 border-dashed border-blue-200 hover:border-blue-500 bg-blue-50/30 hover:bg-blue-50/60 rounded-xl text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group"
                          >
                            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition shadow-2xs">
                              <Camera size={24} />
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 text-sm">Nhấp vào đây để chọn ảnh hoặc chụp ảnh hiện trường</p>
                              <p className="text-xs text-slate-500 mt-1">Yêu cầu tối thiểu 2 ảnh: Toàn cảnh kho và Chi tiết khóa / sàn nhà</p>
                            </div>
                            <span className="mt-1 px-4 py-1.5 rounded-lg bg-blue-600 group-hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs">
                              <Upload size={14} />
                              <span>Chọn tệp ảnh từ máy</span>
                            </span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                            {photoUrls.map((url, i) => (
                              <div
                                key={i}
                                className="group relative rounded-xl overflow-hidden h-28 bg-slate-100 border border-slate-200 shadow-2xs cursor-pointer"
                                onClick={() => setPreviewImageModal(url)}
                              >
                                <img src={url} alt={`Hiện trường ${i + 1}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 bg-slate-900/80 text-white text-[10px] rounded font-mono font-medium truncate max-w-[80%]">
                                  Ảnh {i + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRemovePhoto(i)
                                  }}
                                  className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-md bg-rose-600/90 hover:bg-rose-700 text-white text-[10px] font-bold shadow-xs transition cursor-pointer"
                                  title="Gỡ ảnh này"
                                >
                                  ✕ Xóa
                                </button>
                              </div>
                            ))}

                            <div
                              onClick={() => fileInputRef.current?.click()}
                              className="h-28 rounded-xl border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/20 hover:bg-blue-50/50 flex flex-col items-center justify-center cursor-pointer transition text-blue-600 hover:text-blue-700 gap-1"
                            >
                              <Upload size={20} />
                              <span className="text-xs font-bold">+ Thêm ảnh</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 7. Cảm biến môi trường Boxora IoT */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2.5 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Thermometer size={16} className={envPassed ? 'text-cyan-600' : 'text-rose-600'} />
                            <span className="font-bold text-slate-900 text-sm">7. Cảm biến môi trường Boxora IoT</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${envPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {envPassed ? '✓ Đạt chuẩn' : '⚠️ Chưa đạt'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEnvPassed(true)
                                const defaultNote = INSPECTION_DEFAULT_NOTES.env
                                setEnvNotes(defaultNote)
                                updateCurrentCase({ envPassed: true, envNotes: defaultNote })
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${envPassed ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                            >
                              Đạt
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEnvPassed(false)
                                const newNotes = envNotes.trim() === INSPECTION_DEFAULT_NOTES.env ? '' : envNotes
                                setEnvNotes(newNotes)
                                updateCurrentCase({ envPassed: false, envNotes: newNotes })
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${!envPassed ? 'bg-rose-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                            >
                              Chưa đạt
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <input
                            type="text"
                            value={envNotes}
                            onChange={(e) => {
                              setEnvNotes(e.target.value)
                              updateCurrentCase({ envNotes: e.target.value })
                            }}
                            className={`w-full text-xs rounded-lg p-2 text-slate-800 focus:outline-none transition ${
                              !envPassed && !envNotes.trim()
                                ? 'bg-rose-50/40 border-2 border-rose-400 focus:border-rose-500 ring-1 ring-rose-200'
                                : 'bg-white border border-slate-200 focus:border-amber-400'
                            }`}
                            placeholder={
                              envPassed
                                ? 'Gợi ý: Cảm biến IoT: 23°C • Độ ẩm 46% RH (Đạt tiêu chuẩn bảo quản)'
                                : '* Bắt buộc: Ghi chú chỉ số bất thường hoặc sự cố cảm biến môi trường...'
                            }
                          />
                          {!envPassed && !envNotes.trim() && (
                            <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                              * Bắt buộc ghi nhận chỉ số hoặc sự cố cảm biến khi Chưa đạt
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Nút hành động Bước B */}
                    <div className="pt-3 flex items-center justify-end gap-2 flex-wrap border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleSaveInspection('ISSUE', true)}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 cursor-pointer flex items-center gap-1.5 transition"
                      >
                        <FileText size={14} />
                        <span>Lưu Bản Nháp</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const hasIssue = currentMarkedIssues.length > 0 || totalDeduction > 0 || !doorPassed || !cleanlinessPassed || !damagePassed || !smartLockPassed || !envPassed || !assetsClearedPassed
                          handleSaveInspection(hasIssue ? 'ISSUE' : 'PASSED', false)
                        }}
                        className={`px-4 py-2 rounded-xl text-white font-bold text-xs cursor-pointer shadow-xs flex items-center gap-1.5 transition ${
                          currentMarkedIssues.length > 0 || totalDeduction > 0
                            ? 'bg-rose-600 hover:bg-rose-700'
                            : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        <CheckCircle2 size={15} />
                        <span>
                          {currentMarkedIssues.length > 0 || totalDeduction > 0
                            ? 'Lưu Biên Bản Có Hư Hại / Khấu Trừ'
                            : 'Lưu Biên Bản Nghiệm Thu ĐẠT CHUẨN'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* KHỐI C: ĐỐI SOÁT TIỀN CỌC & KHẤU TRỪ */}
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 font-mono font-bold text-xs flex items-center justify-center">
                          C
                        </span>
                        <h3 className="font-bold text-sm text-slate-900">
                          Đối Soát Tiền Cọc, Khấu Trừ &amp; Khoản Hoàn Trả Khách Hàng
                        </h3>
                      </div>
                      <span className="text-xs font-mono text-slate-500">
                        Tiền hoàn = max(0, Tiền cọc - Khấu trừ - Công nợ)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Cột 1: Chi tiết phép tính */}
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span>1. Tiền cọc ban đầu:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {deposit.toLocaleString('vi-VN')}đ
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-600">
                          <span>2. Phí vệ sinh dọn kho:</span>
                          <span className={`font-mono font-bold ${cleaningFee > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            -{cleaningFee.toLocaleString('vi-VN')}đ
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-600">
                          <span>3. Phí hư hại cửa cuốn &amp; ray:</span>
                          <span className={`font-mono font-bold ${doorFee > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            -{doorFee.toLocaleString('vi-VN')}đ
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-600">
                          <span>4. Phí hư hại kho (vách, sàn, trần):</span>
                          <span className={`font-mono font-bold ${damageFee > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            -{damageFee.toLocaleString('vi-VN')}đ
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-600">
                          <span>5. Phí SmartLock (do khách cạy phá):</span>
                          <span className={`font-mono font-bold ${smartLockFee > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            -{smartLockFee.toLocaleString('vi-VN')}đ
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-600">
                          <span>6. Công nợ / Cước trễ hạn:</span>
                          <span className={`font-mono font-bold ${outstandingDebt > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            -{outstandingDebt.toLocaleString('vi-VN')}đ
                          </span>
                        </div>

                        {/* KẾT QUẢ ĐỐI SOÁT */}
                        {!isOverDeposit ? (
                          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-extrabold text-slate-900 bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
                            <span className="flex items-center gap-1.5 text-emerald-950 font-bold">
                              <CheckCircle2 size={16} className="text-emerald-600" />
                              Tiền Dự Kiến Hoàn Trả:
                            </span>
                            <span className="font-mono text-emerald-600 text-base font-extrabold">
                              {netRefundAmount.toLocaleString('vi-VN')}đ
                            </span>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-slate-200 space-y-2">
                            <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5 text-amber-950 font-bold">
                                <Wrench size={14} className="text-amber-600 shrink-0" />
                                <span>Chi phí sửa chữa được xác minh</span>
                              </div>
                              <span className="font-mono font-extrabold text-amber-900 text-sm">
                                {totalVerifiedRepairCost.toLocaleString('vi-VN')}đ
                              </span>
                            </div>

                            <div className="p-2.5 bg-blue-50/80 border border-blue-200/80 rounded-xl flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5 text-blue-950 font-bold">
                                <ShieldCheck size={14} className="text-blue-600 shrink-0" />
                                <span>Tiền cọc được khấu trừ (100%)</span>
                              </div>
                              <span className="font-mono font-extrabold text-blue-900 text-sm">
                                {deductedDepositAmount.toLocaleString('vi-VN')}đ
                              </span>
                            </div>

                            <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-xl flex items-center justify-between text-xs shadow-xs">
                              <div className="flex items-center gap-1.5">
                                <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                                <div>
                                  <span className="font-extrabold text-rose-950 block text-xs uppercase tracking-tight">
                                    Khoản Khách Cần Thanh Toán Bổ Sung
                                  </span>
                                  <span className="text-[10px] text-rose-600 font-medium">
                                    (Chi phí sửa chữa vượt quá số tiền cọc)
                                  </span>
                                </div>
                              </div>
                              <span className="font-mono font-black text-rose-600 text-base">
                                {customerPayableAmount.toLocaleString('vi-VN')}đ
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Cột 2: Thông tin tài khoản nhận hoàn hoặc thu bồi thường */}
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                        {!isOverDeposit ? (
                          <>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Thông Tin Nhận Tiền Cọc Của Khách Hàng
                            </span>
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Ngân hàng:</span>
                                <strong className="text-slate-900 font-bold">{currentCase.bankName || 'Vietcombank'}</strong>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Số tài khoản:</span>
                                <strong className="text-slate-900 font-mono font-bold">{currentCase.bankAccountNumber || '1029384756'}</strong>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Chủ tài khoản:</span>
                                <strong className="text-slate-900 font-bold">{currentCase.bankAccountName || currentCase.customerName.toUpperCase()}</strong>
                              </div>
                              <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                                <span className="text-slate-500">Trạng thái hoàn tiền:</span>
                                <strong className="text-indigo-700 font-bold">
                                  {currentCase.refundTxnRef ? `Đã hoàn (${currentCase.refundTxnRef})` : 'Chờ thực hiện'}
                                </strong>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-bold text-rose-700">
                                Quyết Toán Khấu Trừ Cọc &amp; Thu Bồi Thường
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                Cọc không đủ bù hư hại
                              </span>
                            </div>

                            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 space-y-1 text-slate-700">
                              <p className="font-semibold text-rose-900">
                                Toàn bộ tiền cọc ({deductedDepositAmount.toLocaleString('vi-VN')}đ) đã được khấu trừ.
                              </p>
                              <p className="text-[11px] text-rose-800">
                                Khách hàng cần thanh toán bổ sung số tiền <strong className="font-mono text-rose-900">{customerPayableAmount.toLocaleString('vi-VN')}đ</strong> tại quầy lễ tân hoặc chuyển khoản trước khi giải phóng kho.
                              </p>
                            </div>

                            <div className="space-y-1.5 pt-1 border-t border-slate-200">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Hình thức thu:</span>
                                <strong className="text-slate-800 font-bold">Tiền mặt / QR POS tại quầy</strong>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Khách hàng:</span>
                                <strong className="text-slate-900 font-bold">{currentCase.customerName} ({currentCase.customerPhone})</strong>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Trạng thái thanh toán bù:</span>
                                <strong className={currentCase.additionalPaymentStatus === 'PAID' ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                                  {currentCase.additionalPaymentStatus === 'PAID' ? `Đã thu (${currentCase.additionalPaymentTxnRef || 'Hợp lệ'})` : `Chưa thu (${customerPayableAmount.toLocaleString('vi-VN')}đ)`}
                                </strong>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* KHỐI BỔ SUNG: BÀN GIAO VẬT LÝ & THU HỒI SMARTLOCK (YÊU CẦU 9 & 10) */}
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-800 font-mono font-bold text-xs flex items-center justify-center">
                          E
                        </span>
                        <h3 className="font-bold text-sm text-slate-900">
                          Bàn Giao Vật Lý &amp; Thu Hồi SmartLock IoT
                        </h3>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Bắt buộc hoàn tất trước khi đóng hợp đồng
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* 1. Nhận lại kho vật lý */}
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between gap-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Warehouse size={16} className="text-indigo-600" />
                            <div>
                              <strong className="block text-slate-900">1. Nhận Lại Kho Vật Lý</strong>
                              <span className="text-[11px] text-slate-500">
                                Xác nhận kho đã lấy hết đồ đạc và nhân viên đã tiếp quản.
                              </span>
                            </div>
                          </div>
                          {currentCase.unitReturnedPhysically ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Đã nhận kho
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              Chưa xác nhận
                            </span>
                          )}
                        </div>

                        {!currentCase.unitReturnedPhysically && (
                          <button
                            type="button"
                            onClick={handleConfirmPhysicalReturn}
                            disabled={isConfirmingPhysical || !assetsClearedPassed}
                            className="mt-1 w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs cursor-pointer transition flex items-center justify-center gap-1.5"
                          >
                            <Warehouse size={14} />
                            <span>{isConfirmingPhysical ? 'Đang xác nhận...' : 'Xác Nhận Đã Nhận Lại Kho'}</span>
                          </button>
                        )}
                      </div>

                      {/* 2. Thu hồi mã PIN SmartLock IoT */}
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between gap-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <KeyRound size={16} className="text-amber-600" />
                            <div>
                              <strong className="block text-slate-900">2. Thu Hồi Mã SmartLock PIN</strong>
                              <span className="text-[11px] text-slate-500">
                                Vô hiệu hóa PIN và giải phóng khóa IoT buồng kho.
                              </span>
                            </div>
                          </div>
                          {currentCase.accessRevoked ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Đã thu hồi PIN
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              Chưa thu hồi
                            </span>
                          )}
                        </div>

                        {!currentCase.accessRevoked && (
                          <button
                            type="button"
                            onClick={handleRevokeSmartLock}
                            disabled={isRevokingAccess}
                            className="mt-1 w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs cursor-pointer transition flex items-center justify-center gap-1.5"
                          >
                            <KeyRound size={14} />
                            <span>{isRevokingAccess ? 'Đang thu hồi...' : 'Thu Hồi Mã SmartLock Ngay'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* KHỐI D: LỊCH SỬ XỬ LÝ & NÚT HÀNH ĐỘNG THEO VAI TRÒ */}
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-mono font-bold text-xs flex items-center justify-center">
                          D
                        </span>
                        <h3 className="font-bold text-sm text-slate-900">
                          Lịch Sử Xử Lý &amp; Quyết Định Nghiệp Vụ
                        </h3>
                      </div>
                    </div>

                    {/* Timeline Notes */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs max-h-36 overflow-y-auto">
                      {currentCase.historyNotes && currentCase.historyNotes.length > 0 ? (
                        currentCase.historyNotes.map((note, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            <span>{note}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-slate-400">Chưa có bản ghi lịch sử xử lý.</span>
                      )}
                    </div>

                    {/* Action Buttons tailored by Role & Status */}
                    <div className="pt-2 flex items-center justify-between gap-3 flex-wrap border-t border-slate-100">
                      {/* Nút Ghi Nhận Khiếu Nại (Luôn có sẵn khi chưa hoàn tất) */}
                      {currentCase.status !== 'COMPLETED' && (
                        <button
                          type="button"
                          onClick={() => setShowDisputeModal(true)}
                          className="px-3 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs cursor-pointer flex items-center gap-1.5 transition"
                        >
                          <MessageSquareWarning size={14} />
                          <span>Ghi Nhận Khiếu Nại</span>
                        </button>
                      )}

                      <div className="flex items-center gap-2 flex-wrap ml-auto">
                        {/* STAFF action: Trình duyệt hoàn cọc hoặc quyết toán bồi thường */}
                        {(currentCase.status === 'INSPECTION_PASSED' || currentCase.status === 'INSPECTION_ISSUE') && (
                          <button
                            type="button"
                            onClick={handleSubmitRefundApproval}
                            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                          >
                            <Send size={15} />
                            <span>
                              {isOverDeposit
                                ? `Trình Duyệt Bồi Thường (Thu Thêm ${customerPayableAmount.toLocaleString('vi-VN')}đ)`
                                : `Trình Duyệt Quyết Toán Hoàn Cọc (${netRefundAmount.toLocaleString('vi-VN')}đ)`}
                            </span>
                          </button>
                        )}

                        {/* FACILITY_MANAGER action: Phê duyệt hoàn cọc */}
                        {currentCase.status === 'REFUND_PENDING_APPROVAL' && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleApproveSettlement('REJECT')}
                              className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs cursor-pointer transition"
                            >
                              Yêu Cầu Kiểm Tra Lại
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproveSettlement('APPROVE')}
                              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                            >
                              <ShieldCheck size={16} />
                              <span>
                                {isOverDeposit
                                  ? `Phê Duyệt Khấu Trừ & Thu Thêm (${customerPayableAmount.toLocaleString('vi-VN')}đ)`
                                  : `Phê Duyệt Hoàn Cọc (${netRefundAmount.toLocaleString('vi-VN')}đ)`}
                              </span>
                            </button>
                          </div>
                        )}

                        {/* Action: Thực hiện hoàn tiền hoặc thu tiền bồi thường */}
                        {(currentCase.status === 'REFUND_APPROVED' || (currentCase.status === 'INSPECTION_PASSED' && totalDeduction === 0)) && (
                          <button
                            type="button"
                            onClick={() => setShowRefundModal(true)}
                            className={`px-4 py-2 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition ${
                              isOverDeposit ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            {isOverDeposit ? <Receipt size={15} /> : <CreditCard size={15} />}
                            <span>
                              {isOverDeposit
                                ? `Thu Tiền Bồi Thường Tại Quầy (${customerPayableAmount.toLocaleString('vi-VN')}đ)`
                                : `Thực Hiện Hoàn Tiền Cho Khách (${netRefundAmount.toLocaleString('vi-VN')}đ)`}
                            </span>
                          </button>
                        )}

                        {/* Final Action: Hoàn tất hồ sơ & Giải phóng kho */}
                        {(currentCase.status === 'REFUNDED' || currentCase.status === 'REFUND_APPROVED') && (
                          <button
                            type="button"
                            onClick={handleCompleteHandoverAndRelease}
                            disabled={isFinishingHandover}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20 transition"
                          >
                            <Lock size={15} />
                            <span>{isFinishingHandover ? 'Đang hoàn tất...' : 'Hoàn Tất Hồ Sơ & Giải Phóng Kho'}</span>
                          </button>
                        )}

                        {currentCase.status === 'COMPLETED' && (
                          <div className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs flex items-center gap-1.5">
                            <CheckCircle2 size={16} className="text-emerald-600" />
                            <span>Hồ sơ đã hoàn tất thanh lý &amp; buồng kho đã sẵn sàng cho thuê mới.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL THỰC HIỆN HOÀN TIỀN HOẶC THU TIỀN BỒI THƯỜNG */}
      {showRefundModal && currentCase && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                {isOverDeposit ? <Receipt size={20} className="text-rose-600" /> : <CreditCard size={20} className="text-blue-600" />}
                <h3 className="font-bold text-base text-slate-900">
                  {isOverDeposit ? 'Thu Khoản Chênh Lệch Bồi Thường Tại Quầy' : 'Thực Hiện Hoàn Tiền Cọc'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className={`p-3 border rounded-xl space-y-1 ${isOverDeposit ? 'bg-rose-50 border-rose-200' : 'bg-blue-50 border-blue-200'}`}>
                <span className={`text-[10px] uppercase font-bold block ${isOverDeposit ? 'text-rose-700' : 'text-blue-700'}`}>
                  {isOverDeposit ? 'Số Tiền Bồi Thường Cần Thu Thêm' : 'Số Tiền Hoàn Trả Đã Duyệt'}
                </span>
                <span className={`text-xl font-extrabold font-mono block ${isOverDeposit ? 'text-rose-950' : 'text-blue-950'}`}>
                  {(isOverDeposit ? customerPayableAmount : netRefundAmount).toLocaleString('vi-VN')} VNĐ
                </span>
                <span className="text-slate-600 text-[11px] block">
                  {isOverDeposit ? (
                    <>Khách nộp: <strong>{currentCase.customerName}</strong> ({currentCase.customerPhone})</>
                  ) : (
                    <>Khách nhận: <strong>{currentCase.customerName}</strong> ({currentCase.bankAccountNumber} - {currentCase.bankName})</>
                  )}
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isOverDeposit ? 'Hình thức thu tiền bồi thường' : 'Phương thức hoàn tiền'}
                </label>
                <select
                  value={refundMethodSelect}
                  onChange={(e) => setRefundMethodSelect(e.target.value as any)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
                >
                  {isOverDeposit ? (
                    <>
                      <option value="CASH">Thu tiền mặt trực tiếp tại quầy Boxora</option>
                      <option value="BANK_TRANSFER">Chuyển khoản QR tài khoản cơ sở</option>
                      <option value="VNPAY_REFUND">Quẹt thẻ ngân hàng qua máy POS quầy</option>
                    </>
                  ) : (
                    <>
                      <option value="BANK_TRANSFER">Chuyển khoản ngân hàng (Ủy nhiệm chi)</option>
                      <option value="VNPAY_REFUND">Hoàn qua cổng VNPay / Thẻ ngân hàng</option>
                      <option value="CASH">Chi tiền mặt tại quầy cơ sở</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isOverDeposit ? 'Mã biên lai / Hóa đơn thu tiền' : 'Mã tham chiếu / Mã giao dịch ngân hàng'}
                </label>
                <input
                  type="text"
                  value={refundTxnInput}
                  onChange={(e) => setRefundTxnInput(e.target.value)}
                  placeholder={isOverDeposit ? 'VD: REC-COMP-2026-001...' : 'VD: FT2630018942 hoặc REF-VNPAY-9921...'}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 text-xs"
                />
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                {isOverDeposit
                  ? 'Hệ thống sẽ lưu mã biên lai thu, số tiền đã thu và nhân viên thực hiện vào audit log của hợp đồng trước khi cho phép giải phóng kho.'
                  : 'Hệ thống sẽ lưu mã tham chiếu, thời điểm và tài khoản thực hiện vào audit log của giao dịch hoàn cọc.'}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleExecuteFinancialAction}
                disabled={isSubmittingRefund}
                className={`px-4 py-2 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition ${
                  isOverDeposit ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <CheckCircle2 size={15} />
                <span>
                  {isSubmittingRefund
                    ? 'Đang ghi nhận...'
                    : isOverDeposit
                    ? `Xác Nhận Đã Thu ${customerPayableAmount.toLocaleString('vi-VN')}đ`
                    : 'Xác Nhận Đã Hoàn Tiền'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GHI NHẬN KHIẾU NẠI CỦA KHÁCH HÀNG */}
      {showDisputeModal && currentCase && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600">
                <MessageSquareWarning size={20} />
                <h3 className="font-bold text-base text-slate-900">Ghi Nhận Khiếu Nại Của Khách Hàng</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDisputeModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Ghi nhận nội dung khiếu nại của khách hàng <strong>{currentCase.customerName}</strong> đối với chi phí khấu trừ hoặc biên bản nghiệm thu buồng kho <strong>#{currentCase.unitCode}</strong>.
              </p>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Lý do khiếu nại:</label>
                <textarea
                  rows={4}
                  value={disputeReasonInput}
                  onChange={(e) => setDisputeReasonInput(e.target.value)}
                  placeholder="Khách hàng không đồng ý với chi phí sửa chữa cửa cuốn, đề nghị cung cấp hóa đơn bảo trì..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:bg-white focus:border-red-400"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-900 text-[11px]">
                Hồ sơ sẽ chuyển sang trạng thái <strong>TRANH CHẤP (DISPUTED)</strong> và thông báo cho Quản lý cơ sở để tiến hành hòa giải.
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDisputeModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleRecordDispute}
                disabled={isSubmittingDispute}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition disabled:opacity-50"
              >
                <CheckCircle2 size={15} />
                <span>{isSubmittingDispute ? 'Đang lưu...' : 'Xác Nhận Khiếu Nại'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM ẢNH PHÓNG TO */}
      {previewImageModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImageModal(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full p-4 shadow-2xl border border-slate-200 space-y-3 cursor-default animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-bold text-xs text-slate-900">Ảnh Bằng Chứng Nghiệm Thu Hiện Trường</span>
              <button
                type="button"
                onClick={() => setPreviewImageModal(null)}
                className="text-slate-400 hover:text-slate-700 text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="rounded-xl overflow-hidden max-h-[70vh] flex items-center justify-center bg-slate-900">
              <img src={previewImageModal} alt="Preview" className="max-w-full max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN TIẾP NHẬN & LÊN LỊCH NGHIỆM THU */}
      {showScheduleConfirmModal && currentCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <CalendarCheck size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Xác Nhận Tiếp Nhận &amp; Lên Lịch Nghiệm Thu</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Tiếp nhận yêu cầu thanh lý trả kho và lên lịch thẩm định hiện trường</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduleConfirmModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center text-lg cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Thông tin hồ sơ tóm tắt */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Khách hàng:</span>
                <strong className="text-slate-900">{currentCase.customerName} ({currentCase.customerPhone})</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Buồng kho trả:</span>
                <strong className="font-mono text-blue-700 font-bold">#{currentCase.unitCode} ({currentCase.facilityName})</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Mã hợp đồng:</span>
                <strong className="font-mono text-slate-800">{currentCase.contractCode}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tiền cọc giữ chỗ:</span>
                <strong className="font-mono text-amber-700 font-bold">{currentCase.depositAmount.toLocaleString('vi-VN')}đ</strong>
              </div>
              <div className="pt-2 border-t border-slate-200 flex flex-col gap-1.5">
                <label className="text-slate-700 font-bold">Thời gian hẹn nghiệm thu hiện trường:</label>
                <input
                  type="text"
                  value={scheduleDatetimeInput}
                  onChange={(e) => setScheduleDatetimeInput(e.target.value)}
                  placeholder="Ví dụ: 10:00 28/10/2026"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-700 shrink-0 mt-0.5" />
              <span>
                Sau khi xác nhận, hồ sơ sẽ chuyển sang trạng thái <strong>Đang nghiệm thu</strong> để nhân viên tiến hành thẩm định 7 tiêu chuẩn hiện trường buồng kho và đối soát hoàn cọc.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowScheduleConfirmModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => confirmScheduleInspection(scheduleDatetimeInput)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
              >
                <CheckCircle2 size={15} />
                <span>Xác Nhận &amp; Bắt Đầu Nghiệm Thu</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL XÁC NHẬN LƯU BẢN NHÁP KHI RỜI KHỎI ĐANG NGHIỆM THU */}
      {showDraftConfirmModal && currentCase && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Save size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Lưu Bản Nháp Nghiệm Thu?
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Kho #{currentCase.unitCode} • {currentCase.customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelNavigation}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center text-lg cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-700 leading-relaxed">
                Bạn đang thao tác tại mục <strong>2. Đang Nghiệm Thu</strong> cho hồ sơ buồng kho{' '}
                <strong className="text-blue-700 font-mono">#{currentCase.unitCode}</strong>.
                <br />
                Bạn có muốn lưu lại kết quả thẩm định hiện trường này thành <strong>Bản Nháp</strong> trước khi chuyển sang mục khác không?
              </p>

              {/* Tóm tắt các lỗi / chi phí đã ghi nhận nếu có */}
              {currentMarkedIssues.length > 0 ? (
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                    <span>Hạng mục ghi nhận ({currentMarkedIssues.length}):</span>
                    <span>Khấu trừ dự kiến</span>
                  </div>
                  <div className="space-y-1">
                    {currentMarkedIssues.map((issue, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] text-slate-700">
                        <span className="truncate max-w-[240px]">• {issue.title}</span>
                        {issue.fee !== undefined && issue.fee > 0 ? (
                          <span className="font-mono font-bold text-rose-700">
                            -{issue.fee.toLocaleString('vi-VN')}đ
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">0đ</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {totalVerifiedRepairCost > 0 && (
                    <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs font-bold text-slate-900">
                      <span>Tổng chi phí phát sinh:</span>
                      <span className="font-mono text-rose-700">{totalVerifiedRepairCost.toLocaleString('vi-VN')}đ</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
                  Biên bản hiện tại ghi nhận các tiêu chí đạt chuẩn. Bạn có thể lưu bản nháp hoặc tiếp tục rời đi.
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelNavigation}
                disabled={isSavingDraftModal}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer transition disabled:opacity-50 text-center"
              >
                Ở lại tiếp tục
              </button>
              <button
                type="button"
                onClick={handleDiscardDraftAndProceed}
                disabled={isSavingDraftModal}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300 font-bold text-xs cursor-pointer transition disabled:opacity-50 text-center"
              >
                Không lưu &amp; Rời đi
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveDraftAndProceed}
                disabled={isSavingDraftModal}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition disabled:opacity-50 text-center"
              >
                {isSavingDraftModal ? (
                  <>
                    <RotateCcw size={14} className="animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>Lưu Bản Nháp &amp; Tiếp Tục</span>
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
