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
  Receipt
} from 'lucide-react'
import { toast } from '../../../utils/toast'
import { handoverService } from '../../../services/handoverService'
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
  lostCardFee: number
  status: ReturnStepStatus
  inspectorName?: string
  approverName?: string
  refundTxnRef?: string
  refundProcessedAt?: string
  completedAt?: string
  historyNotes?: string[]

  // Per-profile inspection state
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
}

interface HandoverReturnWorkbenchProps {
  currentFacilityId?: string
  facilityName?: string
  userRole?: string
  userName?: string
  activeRentals: Booking[]
  rawReturnRequests?: any[]
  onReturnCompleted?: () => void
  onRefresh?: () => void
}

const normalizeStatus = (rawStatus: any): ReturnStepStatus => {
  const st = String(rawStatus || '').toUpperCase()
  if (st === 'PENDING' || st === 'RETURN_REQUESTED' || !st) return 'RETURN_REQUESTED'
  if (st === 'INSPECTION_SCHEDULED') return 'INSPECTION_SCHEDULED'
  if (st === 'INSPECTING' || st === 'INSPECTION_IN_PROGRESS') return 'INSPECTION_IN_PROGRESS'
  if (st === 'INSPECTION_PASSED') return 'INSPECTION_PASSED'
  if (st === 'INSPECTION_ISSUE') return 'INSPECTION_ISSUE'
  if (st === 'REFUND_PENDING_APPROVAL') return 'REFUND_PENDING_APPROVAL'
  if (st === 'REFUND_APPROVED') return 'REFUND_APPROVED'
  if (st === 'REFUND_PROCESSING') return 'REFUND_PROCESSING'
  if (st === 'REFUNDED') return 'REFUNDED'
  if (st === 'COMPLETED' || st === 'RESOLVED') return 'COMPLETED'
  return 'RETURN_REQUESTED'
}

const STATUS_RANK: Record<ReturnStepStatus, number> = {
  RETURN_REQUESTED: 1,
  INSPECTION_SCHEDULED: 2,
  INSPECTION_IN_PROGRESS: 3,
  INSPECTION_PASSED: 4,
  INSPECTION_ISSUE: 4,
  REFUND_PENDING_APPROVAL: 5,
  REFUND_APPROVED: 6,
  REFUND_PROCESSING: 6,
  REFUNDED: 7,
  COMPLETED: 8
}

const DEFAULT_PROOF_PHOTOS = [
  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=600&q=80'
]

// Pure helper function to merge and preserve return cases across renders and reloads
const syncReturnCases = (
  currentList: ReturnCaseItem[],
  incomingRequests: any[],
  incomingRentals: Booking[],
  fallbackFacilityId?: string,
  fallbackFacilityName: string = 'Boxora Thủ Đức'
): ReturnCaseItem[] => {
  const savedMap: Record<string, ReturnCaseItem> = {}

  // 1. Read existing saved dossiers from localStorage
  try {
    const raw = localStorage.getItem('boxora_checkout_return_cases_v4')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        parsed.forEach((item: ReturnCaseItem) => {
          if (item && item.id) {
            savedMap[item.id] = item
            if (item.bookingId) savedMap[item.bookingId] = item
            if (item.bookingCode) savedMap[item.bookingCode] = item
            if (item.unitCode) savedMap[item.unitCode] = item
          }
        })
      }
    }
  } catch {}

  // Merge any in-memory state
  currentList.forEach((item) => {
    if (item && item.id) {
      savedMap[item.id] = { ...(savedMap[item.id] || {}), ...item }
      if (item.bookingId) savedMap[item.bookingId] = savedMap[item.id]
      if (item.bookingCode) savedMap[item.bookingCode] = savedMap[item.id]
      if (item.unitCode) savedMap[item.unitCode] = savedMap[item.id]
    }
  })

  const list: ReturnCaseItem[] = []
  const processedIds = new Set<string>()

  // 2. Synthesize from incomingRequests (customerReturnRequests)
  if (incomingRequests && incomingRequests.length > 0) {
    incomingRequests.forEach((req, idx) => {
      const candidateId = req.id || `RET-2026-${7100 + idx}`
      const candidateBookingId = req.bookingId || req.id
      const saved =
        savedMap[candidateId] ||
        (candidateBookingId ? savedMap[candidateBookingId] : undefined) ||
        (req.bookingCode ? savedMap[req.bookingCode] : undefined) ||
        (req.unitCode ? savedMap[req.unitCode] : undefined)

      if (saved) {
        const savedSt = normalizeStatus(saved.status)
        const incomingSt = normalizeStatus(req.status)
        const finalStatus = (STATUS_RANK[savedSt] || 1) >= (STATUS_RANK[incomingSt] || 1) ? savedSt : incomingSt

        list.push({
          ...saved,
          status: finalStatus,
          depositAmount: saved.depositAmount || req.depositAmount || req.depositPaid || 3500000,
          unitCode: req.unitCode || saved.unitCode || 'TD-B102',
          customerName: req.customerName || saved.customerName || 'Khách hàng',
          customerPhone: req.customerPhone || saved.customerPhone || 'Theo hồ sơ',
          contractCode: saved.contractCode || req.contractCode || `CTR-${req.bookingCode || candidateId}`,
          reason: saved.reason || req.reason || 'Đến hạn thanh lý hợp đồng & nghiệm thu hoàn cọc'
        })
        processedIds.add(saved.id)
        if (candidateId) processedIds.add(candidateId)
        if (candidateBookingId) processedIds.add(candidateBookingId)
      } else {
        list.push({
          id: candidateId,
          bookingId: candidateBookingId || '',
          bookingCode: req.bookingCode || `BX-2026-${4000 + idx}`,
          contractCode: req.contractCode || `CTR-BX-2026-${4000 + idx}`,
          unitCode: req.unitCode || 'TD-B102',
          customerName: req.customerName || 'Khách hàng',
          customerPhone: req.customerPhone || 'Theo hồ sơ',
          customerEmail: req.customerEmail || 'khach@gmail.com',
          facilityId: req.facilityId || fallbackFacilityId,
          facilityName: req.facilityName || fallbackFacilityName,
          requestDate: req.requestDate || new Date().toISOString().split('T')[0],
          expectedReturnDate: req.expectedReturnDate || '28/10/2026',
          inspectionDate: req.inspectionDate || '28/10/2026 10:00',
          reason: req.reason || 'Đến hạn thanh lý hợp đồng & nghiệm thu hoàn cọc',
          bankName: req.bankName || 'Vietcombank',
          bankAccountNumber: req.bankAccountNumber || '1029384756',
          bankAccountName: req.bankAccountName || (req.customerName || 'KHACH HANG').toUpperCase(),
          depositAmount: req.depositAmount || req.depositPaid || 3500000,
          outstandingDebt: req.outstandingDebt || 0,
          cleaningFee: 0,
          damageFee: 0,
          doorFee: 0,
          smartLockFee: 0,
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
        processedIds.add(candidateId)
        if (candidateBookingId) processedIds.add(candidateBookingId)
      }
    })
  }

  // 3. Synthesize from incomingRentals (activeRentals) if not already added
  if (incomingRentals && incomingRentals.length > 0) {
    incomingRentals.forEach((r, idx) => {
      const candidateId = `ACT-RET-${r.id}`
      if (
        processedIds.has(candidateId) ||
        processedIds.has(r.id) ||
        (r.unitCode && list.some((item) => item.unitCode === r.unitCode))
      ) {
        return
      }

      const saved = savedMap[candidateId] || savedMap[r.id] || (r.unitCode ? savedMap[r.unitCode] : undefined)
      if (saved) {
        list.push({ ...saved, status: normalizeStatus(saved.status) })
        processedIds.add(saved.id)
      } else if (list.length < 5) {
        list.push({
          id: candidateId,
          bookingId: r.id,
          bookingCode: r.bookingCode || '',
          contractCode: r.contractCode || `CTR-${r.bookingCode || r.id}`,
          unitCode: r.unitCode || `TD-A10${idx + 1}`,
          customerName: r.customerName || 'Khách thuê',
          customerPhone: r.customerPhone || '0987654321',
          customerEmail: r.customerEmail || 'khach@gmail.com',
          facilityId: r.facilityId || fallbackFacilityId,
          facilityName: r.facilityName || fallbackFacilityName,
          requestDate: '27/10/2026',
          expectedReturnDate: r.endDate || '28/10/2026',
          inspectionDate: '28/10/2026 14:00',
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
          lostCardFee: 0,
          status: 'RETURN_REQUESTED',
          inspectorName: 'Phan Van Hau',
          historyNotes: ['Hệ thống ghi nhận đơn đến hạn trả kho'],
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
        processedIds.add(candidateId)
      }
    })
  }

  // 4. IMPORTANT: If incomingRequests and incomingRentals were empty, preserve previously saved items!
  if (list.length === 0) {
    Object.values(savedMap).forEach((savedItem) => {
      if (savedItem && savedItem.id && !processedIds.has(savedItem.id)) {
        list.push({ ...savedItem, status: normalizeStatus(savedItem.status) })
        processedIds.add(savedItem.id)
      }
    })
  }

  // 5. Persist to localStorage only when list has items (NEVER overwrite with empty array!)
  if (list.length > 0) {
    try {
      localStorage.setItem('boxora_checkout_return_cases_v4', JSON.stringify(list))
    } catch {}
  }

  return list
}

export const HandoverReturnWorkbench: React.FC<HandoverReturnWorkbenchProps> = ({
  currentFacilityId,
  facilityName = 'Boxora Thủ Đức',
  userRole = 'STAFF',
  userName = 'Nhân viên trực ca',
  activeRentals = [],
  rawReturnRequests = [],
  onReturnCompleted,
  onRefresh
}) => {
  const isFacilityManager = userRole === 'FACILITY_MANAGER' || userRole === 'ADMIN' || userRole === 'BUSINESS_MANAGER'
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initialize return cases on mount
  const [returnCases, setReturnCases] = useState<ReturnCaseItem[]>(() =>
    syncReturnCases([], rawReturnRequests, activeRentals, currentFacilityId, facilityName)
  )
  const [selectedCaseId, setSelectedCaseId] = useState<string>(() => returnCases[0]?.id || '')
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [statusTabFilter, setStatusTabFilter] = useState<string>('ALL')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // CRITICAL: Synchronize state whenever rawReturnRequests or activeRentals props update from parent
  useEffect(() => {
    const updated = syncReturnCases(returnCases, rawReturnRequests, activeRentals, currentFacilityId, facilityName)
    if (updated.length > 0) {
      setReturnCases(updated)
      setSelectedCaseId((prev) => {
        if (prev && updated.some((c) => c.id === prev)) return prev
        return updated[0]?.id || ''
      })
    }
  }, [rawReturnRequests, activeRentals, currentFacilityId, facilityName])

  // Explicit refresh handler
  const handleRefreshWorkbench = () => {
    setIsRefreshing(true)
    if (onRefresh) {
      onRefresh()
    } else if (onReturnCompleted) {
      onReturnCompleted()
    }
    const updated = syncReturnCases(returnCases, rawReturnRequests, activeRentals, currentFacilityId, facilityName)
    if (updated.length > 0) {
      setReturnCases(updated)
      setSelectedCaseId((prev) => (prev && updated.some((c) => c.id === prev) ? prev : updated[0]?.id || ''))
    }
    setTimeout(() => {
      setIsRefreshing(false)
      toast.success('Đã làm mới danh sách hồ sơ trả kho!')
    }, 400)
  }

  const currentCase = useMemo(() => {
    return returnCases.find((c) => c.id === selectedCaseId) || returnCases[0] || null
  }, [returnCases, selectedCaseId])

  // Save changes helper that persists to localStorage immediately
  const updateCurrentCase = (updates: Partial<ReturnCaseItem>) => {
    if (!currentCase) return
    setReturnCases((prev) => {
      const updated = prev.map((c) => (c.id === currentCase.id ? { ...c, ...updates } : c))
      try {
        localStorage.setItem('boxora_checkout_return_cases_v4', JSON.stringify(updated))
      } catch {
        // Ignore storage errors
      }
      return updated
    })
  }

  // 7 Checklist items state for current case
  const [doorPassed, setDoorPassed] = useState(true)
  const [doorNotes, setDoorNotes] = useState('Đóng mở êm ái, ray dẫn thẳng, không móp méo cong vênh.')
  const [doorFeeInput, setDoorFeeInput] = useState(0)

  const [cleanlinessPassed, setCleanlinessPassed] = useState(true)
  const [cleanlinessNotes, setCleanlinessNotes] = useState('Đã quét sạch rác, bề mặt sàn khô ráo, không ẩm mốc.')
  const [cleaningFeeInput, setCleaningFeeInput] = useState(0)

  const [damagePassed, setDamagePassed] = useState(true)
  const [damageNotes, setDamageNotes] = useState('Vách ngăn composite, sàn và trần nguyên vẹn, không khoan đục.')
  const [damageFeeInput, setDamageFeeInput] = useState(0)

  const [smartLockPassed, setSmartLockPassed] = useState(true)
  const [smartLockNotes, setSmartLockNotes] = useState('Khóa thông minh IoT nhạy, chốt khóa an toàn, pin 94%.')
  const [smartLockFeeInput, setSmartLockFeeInput] = useState(0)

  const [assetsClearedPassed, setAssetsClearedPassed] = useState(true)
  const [assetsClearedNotes, setAssetsClearedNotes] = useState('Đã lấy toàn bộ thùng đồ & tài sản ra khỏi kho.')

  const [photoUrls, setPhotoUrls] = useState<string[]>([])

  const [envPassed, setEnvPassed] = useState(true)
  const [envNotes, setEnvNotes] = useState('Cảm biến IoT: 23°C • Độ ẩm 46% RH (Đạt tiêu chuẩn bảo quản)')

  // Preview modal for full-size image
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null)

  // Synchronize state when switching selectedCaseId
  useEffect(() => {
    if (!currentCase) return
    setDoorPassed(currentCase.doorPassed !== undefined ? currentCase.doorPassed : true)
    setDoorNotes(currentCase.doorNotes || 'Đóng mở êm ái, ray dẫn thẳng, không móp méo cong vênh.')
    setDoorFeeInput(currentCase.doorFeeInput || currentCase.doorFee || 0)

    setCleanlinessPassed(currentCase.cleanlinessPassed !== undefined ? currentCase.cleanlinessPassed : true)
    setCleanlinessNotes(currentCase.cleanlinessNotes || 'Đã quét sạch rác, bề mặt sàn khô ráo, không ẩm mốc.')
    setCleaningFeeInput(currentCase.cleaningFeeInput || currentCase.cleaningFee || 0)

    setDamagePassed(currentCase.damagePassed !== undefined ? currentCase.damagePassed : true)
    setDamageNotes(currentCase.damageNotes || 'Vách ngăn composite, sàn và trần nguyên vẹn, không khoan đục.')
    setDamageFeeInput(currentCase.damageFeeInput || currentCase.damageFee || 0)

    setSmartLockPassed(currentCase.smartLockPassed !== undefined ? currentCase.smartLockPassed : true)
    setSmartLockNotes(currentCase.smartLockNotes || 'Khóa thông minh IoT nhạy, chốt khóa an toàn, pin 94%.')
    setSmartLockFeeInput(currentCase.smartLockFeeInput || currentCase.smartLockFee || 0)

    setAssetsClearedPassed(currentCase.assetsClearedPassed !== undefined ? currentCase.assetsClearedPassed : true)
    setAssetsClearedNotes(currentCase.assetsClearedNotes || 'Đã lấy toàn bộ thùng đồ & tài sản ra khỏi kho.')

    setPhotoUrls(currentCase.photoUrls || [])

    setEnvPassed(currentCase.envPassed !== undefined ? currentCase.envPassed : true)
    setEnvNotes(currentCase.envNotes || 'Cảm biến IoT: 23°C • Độ ẩm 46% RH (Đạt tiêu chuẩn bảo quản)')
  }, [currentCase?.id])

  // Handle actual file upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const fileList = Array.from(files)

    fileList.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (loadEvent) => {
        const result = loadEvent.target?.result
        if (typeof result === 'string') {
          setPhotoUrls((prev) => {
            const next = [...prev, result]
            updateCurrentCase({ photoUrls: next })
            return next
          })
        }
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
    toast.success(`Đã tải lên ${fileList.length} ảnh hiện trường!`)
  }

  const handleRemovePhoto = (indexToRemove: number) => {
    setPhotoUrls((prev) => {
      const next = prev.filter((_, idx) => idx !== indexToRemove)
      updateCurrentCase({ photoUrls: next })
      return next
    })
    toast.info('Đã gỡ ảnh khỏi biên bản.')
  }

  // Refund execution modal
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [refundMethodSelect, setRefundMethodSelect] = useState<'BANK_TRANSFER' | 'VNPAY_REFUND' | 'CASH'>('BANK_TRANSFER')
  const [refundTxnInput, setRefundTxnInput] = useState('')
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false)

  // Handover finish modal
  const [isFinishingHandover, setIsFinishingHandover] = useState(false)

  // Financial calculations
  const deposit = currentCase?.depositAmount || 0
  const cleaningFee = cleanlinessPassed ? 0 : cleaningFeeInput
  const doorFee = doorPassed ? 0 : doorFeeInput
  const damageFee = damagePassed ? 0 : damageFeeInput
  const smartLockFee = smartLockPassed ? 0 : smartLockFeeInput
  const lostCardFee = currentCase?.lostCardFee || 0
  const outstandingDebt = currentCase?.outstandingDebt || 0

  // 1. Tổng chi phí bồi thường hư hại & dịch vụ tại kho (chưa tính nợ)
  const totalDeduction = cleaningFee + doorFee + damageFee + smartLockFee + lostCardFee

  // 2. Chi phí sửa chữa & bảo trì được xác minh (Tổng chi phí khấu trừ gồm hư hại + công nợ)
  const totalVerifiedRepairCost = totalDeduction + outstandingDebt

  // 3. Điều kiện: Chi phí sửa chữa và bảo trì vượt quá tiền cọc
  const isOverDeposit = totalVerifiedRepairCost > deposit

  // 4. Tiền cọc được khấu trừ (cấn trừ tối đa bằng đúng tiền cọc ban đầu)
  const deductedDepositAmount = Math.min(deposit, totalVerifiedRepairCost)

  // 5. Khoản khách còn phải thanh toán (chênh lệch khách nợ thêm sau khi đã khấu trừ hết cọc)
  const customerPayableAmount = Math.max(0, totalVerifiedRepairCost - deposit)

  // 6. Tiền dự kiến hoàn trả (nếu chi phí sửa chữa <= tiền cọc)
  const netRefundAmount = currentCase ? Math.max(0, deposit - totalVerifiedRepairCost) : 0

  // Filtered cases for list
  const filteredCases = useMemo(() => {
    return returnCases.filter((c) => {
      const st = String(c.status || '').toUpperCase()
      if (statusTabFilter !== 'ALL') {
        if (statusTabFilter === 'PENDING' && !(st === 'RETURN_REQUESTED' || st === 'INSPECTION_SCHEDULED' || st === 'PENDING')) return false
        if (statusTabFilter === 'INSPECTING' && !(st === 'INSPECTION_IN_PROGRESS' || st === 'INSPECTION_ISSUE' || st === 'INSPECTION_PASSED' || st === 'INSPECTING')) return false
        if (statusTabFilter === 'REFUNDING' && !(st === 'REFUND_PENDING_APPROVAL' || st === 'REFUND_APPROVED' || st === 'REFUND_PROCESSING' || st === 'REFUNDED')) return false
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

  // Count metrics correctly for all 4 phases
  const metrics = useMemo(() => {
    let pending = 0
    let inspecting = 0
    let refunding = 0
    let completed = 0
    returnCases.forEach((c) => {
      const st = String(c.status || '').toUpperCase()
      if (st === 'RETURN_REQUESTED' || st === 'INSPECTION_SCHEDULED' || st === 'PENDING' || !st) {
        pending++
      } else if (st === 'INSPECTION_IN_PROGRESS' || st === 'INSPECTION_ISSUE' || st === 'INSPECTION_PASSED' || st === 'INSPECTING') {
        inspecting++
      } else if (st === 'REFUND_PENDING_APPROVAL' || st === 'REFUND_APPROVED' || st === 'REFUND_PROCESSING' || st === 'REFUNDED' || st === 'REFUNDING') {
        refunding++
      } else if (st === 'COMPLETED' || st === 'RESOLVED') {
        completed++
      } else {
        pending++
      }
    })
    return { pending, inspecting, refunding, completed, total: returnCases.length }
  }, [returnCases])

  // Modal states for scheduling inspection
  const [showScheduleConfirmModal, setShowScheduleConfirmModal] = useState(false)
  const [scheduleDatetimeInput, setScheduleDatetimeInput] = useState('')

  const handleOpenScheduleModal = () => {
    if (!currentCase) return
    const now = new Date()
    const defaultTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`
    setScheduleDatetimeInput(currentCase.inspectionDate || defaultTime)
    setShowScheduleConfirmModal(true)
  }

  const confirmScheduleInspection = (scheduledTime?: string) => {
    if (!currentCase) return
    const inspectTime = scheduledTime || new Date().toLocaleString('vi-VN')
    updateCurrentCase({
      status: 'INSPECTION_SCHEDULED',
      inspectionDate: inspectTime,
      historyNotes: [
        ...(currentCase.historyNotes || []),
        `Nhân viên ${userName} đã tiếp nhận hồ sơ & lên lịch nghiệm thu vào ${inspectTime}`
      ]
    })
    setShowScheduleConfirmModal(false)
    toast.success('Đã tiếp nhận hồ sơ & lên lịch nghiệm thu hiện trường!')
  }

  const handleStartInspection = () => {
    if (!currentCase) return
    const updatedStatus: ReturnStepStatus = 'INSPECTION_IN_PROGRESS'
    updateCurrentCase({
      status: updatedStatus,
      inspectorName: userName,
      historyNotes: [
        ...(currentCase.historyNotes || []),
        `Bắt đầu kiểm tra hiện trường kho #${currentCase.unitCode} bởi ${userName}`
      ]
    })

    // If currently filtered by PENDING, switch to ALL so this dossier stays active and does not jump away!
    if (statusTabFilter === 'PENDING') {
      setStatusTabFilter('ALL')
    }

    toast.info(`Bắt đầu nghiệm thu kho #${currentCase.unitCode}. Trạng thái: Đang nghiệm thu.`, {
      title: 'Tiến trình kiểm định'
    })
  }

  const handleSaveInspection = (resultType: 'PASSED' | 'ISSUE') => {
    if (!currentCase) return
    const isCleanIssue = !cleanlinessPassed && cleaningFeeInput > 0
    const isDamageIssue = !damagePassed && damageFeeInput > 0
    const isDoorIssue = !doorPassed && doorFeeInput > 0
    const isLockIssue = !smartLockPassed && smartLockFeeInput > 0
    const finalResult: ReturnStepStatus =
      resultType === 'PASSED' &&
      !isCleanIssue &&
      !isDamageIssue &&
      !isDoorIssue &&
      !isLockIssue &&
      doorPassed &&
      cleanlinessPassed &&
      damagePassed &&
      smartLockPassed &&
      assetsClearedPassed &&
      envPassed
        ? 'INSPECTION_PASSED'
        : 'INSPECTION_ISSUE'

    const updatedCaseData: Partial<ReturnCaseItem> = {
      status: finalResult,
      doorPassed,
      doorNotes,
      doorFeeInput: doorPassed ? 0 : doorFeeInput,
      doorFee: doorPassed ? 0 : doorFeeInput,
      cleanlinessPassed,
      cleanlinessNotes,
      cleaningFeeInput: cleanlinessPassed ? 0 : cleaningFeeInput,
      cleaningFee: cleanlinessPassed ? 0 : cleaningFeeInput,
      damagePassed,
      damageNotes,
      damageFeeInput: damagePassed ? 0 : damageFeeInput,
      damageFee: damagePassed ? 0 : damageFeeInput,
      smartLockPassed,
      smartLockNotes,
      smartLockFeeInput: smartLockPassed ? 0 : smartLockFeeInput,
      smartLockFee: smartLockPassed ? 0 : smartLockFeeInput,
      assetsClearedPassed,
      assetsClearedNotes,
      photoUrls,
      envPassed,
      envNotes,
      inspectorName: userName,
      inspectionDate: new Date().toLocaleString('vi-VN'),
      historyNotes: [
        ...(currentCase.historyNotes || []),
        `Lưu biên bản nghiệm thu: [${finalResult === 'INSPECTION_PASSED' ? 'ĐẠT CHUẨN' : 'CÓ HƯ HẠI/KHẤU TRỪ'}]. Tổng khấu trừ: ${totalDeduction.toLocaleString('vi-VN')}đ bởi ${userName}`
      ]
    }
    updateCurrentCase(updatedCaseData)
    toast.success('Đã lưu biên bản nghiệm thu và hiện trạng hồ sơ thành công!')
  }

  const handleSubmitRefundApproval = () => {
    if (!currentCase) return
    const noteMsg = isOverDeposit
      ? `Nhân viên ${userName} đã trình duyệt quyết toán: Khấu trừ 100% cọc (${deductedDepositAmount.toLocaleString('vi-VN')}đ) và thu bổ sung ${customerPayableAmount.toLocaleString('vi-VN')}đ chi phí hư hại`
      : `Nhân viên ${userName} đã trình duyệt khoản hoàn trả ${netRefundAmount.toLocaleString('vi-VN')}đ`

    updateCurrentCase({
      status: 'REFUND_PENDING_APPROVAL',
      historyNotes: [...(currentCase.historyNotes || []), noteMsg]
    })
    toast.success('Đã trình duyệt quyết toán lên Quản lý cơ sở (Facility Manager)!')
  }

  const handleApproveRefund = () => {
    if (!currentCase) return
    const noteMsg = isOverDeposit
      ? `Quản lý cơ sở ${userName} đã phê duyệt khấu trừ hết cọc và thu thêm ${customerPayableAmount.toLocaleString('vi-VN')}đ từ khách hàng`
      : `Quản lý cơ sở ${userName} đã phê duyệt số tiền hoàn cọc ${netRefundAmount.toLocaleString('vi-VN')}đ`

    updateCurrentCase({
      status: 'REFUND_APPROVED',
      approverName: userName,
      historyNotes: [...(currentCase.historyNotes || []), noteMsg]
    })
    if (isOverDeposit) {
      toast.success(`Đã phê duyệt quyết toán! Cần thu thêm ${customerPayableAmount.toLocaleString('vi-VN')}đ từ khách hàng.`)
    } else {
      toast.success(`Đã phê duyệt hoàn cọc ${netRefundAmount.toLocaleString('vi-VN')}đ!`)
    }
  }

  const handleExecuteRefund = () => {
    if (!currentCase) return
    setIsSubmittingRefund(true)
    setTimeout(() => {
      const generatedRef = refundTxnInput.trim() || `${isOverDeposit ? 'REC-COMP' : 'TXN-REF'}-${Date.now().toString().slice(-6)}`
      const historyMsg = isOverDeposit
        ? `Đã thu đủ khoản bồi thường bổ sung ${customerPayableAmount.toLocaleString('vi-VN')}đ từ khách qua [${refundMethodSelect}], mã biên lai: ${generatedRef}`
        : `Đã thực hiện lệnh hoàn tiền qua [${refundMethodSelect}], mã giao dịch: ${generatedRef}, số tiền: ${netRefundAmount.toLocaleString('vi-VN')}đ`

      updateCurrentCase({
        status: 'REFUNDED',
        refundTxnRef: generatedRef,
        refundProcessedAt: new Date().toLocaleString('vi-VN'),
        historyNotes: [
          ...(currentCase.historyNotes || []),
          historyMsg
        ]
      })
      setIsSubmittingRefund(false)
      setShowRefundModal(false)
      if (isOverDeposit) {
        toast.success(`Đã xác nhận thu đủ khoản bồi thường ${customerPayableAmount.toLocaleString('vi-VN')}đ thành công!`)
      } else {
        toast.success(`Đã hoàn tất chuyển tiền cọc ${netRefundAmount.toLocaleString('vi-VN')}đ cho khách hàng!`)
      }
    }, 600)
  }

  const handleCompleteHandoverAndRelease = async () => {
    if (!currentCase) return
    setIsFinishingHandover(true)
    try {
      // Call backend return settlement if bookingId is valid
      if (currentCase.bookingId && !currentCase.bookingId.startsWith('LOCAL-')) {
        await handoverService.processReturnSettlement({
          bookingId: currentCase.bookingId,
          recordType: 'RETURN',
          doorConditionPassed: doorPassed,
          cleanlinessPassed: cleanlinessPassed,
          smartLockPassed: smartLockPassed,
          sensorPassed: envPassed,
          wallStructurePassed: damagePassed,
          depositSettled: currentCase.depositAmount,
          deductionAmount: totalDeduction,
          damageFee: (damagePassed ? 0 : damageFeeInput) + (doorPassed ? 0 : doorFeeInput) + (smartLockPassed ? 0 : smartLockFeeInput),
          cleaningFee: cleanlinessPassed ? 0 : cleaningFeeInput,
          lostCardFee: currentCase.lostCardFee || 0,
          refundMethod: refundMethodSelect,
          notes: `Trả kho hoàn tất. Mã GD hoàn cọc: ${currentCase.refundTxnRef || 'ĐÃ DUYỆT'}`
        })
      }
    } catch (e: any) {
      console.warn('Backend return settlement call notice:', e)
    }

    updateCurrentCase({
      status: 'COMPLETED',
      completedAt: new Date().toLocaleString('vi-VN'),
      historyNotes: [
        ...(currentCase.historyNotes || []),
        `Thu hồi mã SmartLock, giải phóng buồng kho #${currentCase.unitCode} về trạng thái SẴN SÀNG, hợp đồng đã thanh lý hoàn tất.`
      ]
    })
    setIsFinishingHandover(false)
    toast.success(`Đã hoàn tất bàn giao kho #${currentCase.unitCode}, thu hồi mã PIN IoT và giải phóng buồng kho thành công!`, {
      title: 'Thanh lý hợp đồng & Trả kho thành công'
    })
    if (onReturnCompleted) {
      onReturnCompleted()
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
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">2. Nghiệm thu ĐẠT</span>
      case 'INSPECTION_ISSUE':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300">2. Có hư hại / Khấu trừ</span>
      case 'REFUND_PENDING_APPROVAL':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-950 border border-amber-400">3. Chờ duyệt cọc</span>
      case 'REFUND_APPROVED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-100 text-teal-900 border border-teal-300">3. Đã duyệt hoàn</span>
      case 'REFUND_PROCESSING':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-900 border border-sky-300">3. Đang hoàn tiền</span>
      case 'REFUNDED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300">3. Đã hoàn tiền</span>
      case 'COMPLETED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">✓ 4. Đã bàn giao xong</span>
      default:
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">1. Chờ xử lý</span>
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
                Quy Trình Nghiệm Thu &amp; Trả Kho Thực Địa
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                SLA HOÀN CỌC CHUẨN BOXORA
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Tiếp nhận yêu cầu, kiểm định 7 tiêu chí hiện trường, quyết toán khấu trừ cọc và bàn giao giải phóng buồng kho.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleRefreshWorkbench}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold border border-white/20 text-white flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
            title="Làm mới danh sách hồ sơ trả kho từ cơ sở"
          >
            <RotateCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          onClick={() => setStatusTabFilter('PENDING')}
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
          onClick={() => setStatusTabFilter('INSPECTING')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusTabFilter === 'INSPECTING'
              ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-400/50 shadow-xs'
              : 'bg-white border-slate-200 hover:border-indigo-300'
          }`}
        >
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-headline text-2xl font-extrabold text-indigo-950">{metrics.inspecting}</span>
            <span className="text-xs text-indigo-700">đang kiểm tra</span>
          </div>
        </div>

        <div
          onClick={() => setStatusTabFilter('REFUNDING')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusTabFilter === 'REFUNDING'
              ? 'bg-teal-50 border-teal-400 ring-2 ring-teal-400/50 shadow-xs'
              : 'bg-white border-slate-200 hover:border-teal-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-teal-800">
            <span>3. Duyệt &amp; Hoàn Cọc</span>
            <DollarSign size={16} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-headline text-2xl font-extrabold text-teal-950">{metrics.refunding}</span>
            <span className="text-xs text-teal-700">đối soát hoàn tiền</span>
          </div>
        </div>

        <div
          onClick={() => setStatusTabFilter('COMPLETED')}
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshWorkbench}
                  className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-slate-100 transition cursor-pointer"
                  title="Làm mới danh sách"
                >
                  <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-amber-600' : ''} />
                </button>
                {statusTabFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setStatusTabFilter('ALL')}
                    className="text-xs text-amber-600 hover:underline font-bold cursor-pointer"
                  >
                    Xem tất cả
                  </button>
                )}
              </div>
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
                  <p className="text-[11px] mt-1">Thử đổi từ khóa, xóa bộ lọc hoặc bấm làm mới danh sách.</p>
                  <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                    {statusTabFilter !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => setStatusTabFilter('ALL')}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer"
                      >
                        Xem tất cả
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleRefreshWorkbench}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                    >
                      <RotateCcw size={13} className={isRefreshing ? 'animate-spin' : ''} />
                      <span>Làm mới danh sách</span>
                    </button>
                  </div>
                </div>
              ) : (
                filteredCases.map((c) => {
                  const isSelected = c.id === currentCase?.id
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCaseId(c.id)}
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
                      {currentCase.inspectionDate || currentCase.expectedReturnDate}
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
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                    <span className="text-xs text-slate-500">
                      Hồ sơ mới gửi từ khách hàng. Nhân viên chi nhánh cần xác nhận lịch hẹn nghiệm thu hiện trường.
                    </span>
                    <button
                      type="button"
                      onClick={handleOpenScheduleModal}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-xs transition flex items-center gap-1.5"
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

                {currentCase.status === 'INSPECTION_IN_PROGRESS' && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2 bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                      <span className="text-xs font-bold text-emerald-950">
                        Hồ sơ đang trong tiến trình nghiệm thu thực địa 7 tiêu chuẩn.
                      </span>
                    </div>
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200 animate-pulse">
                      Đang nghiệm thu hiện trường
                    </span>
                  </div>
                )}
              </div>

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

                  {currentCase.status === 'INSPECTION_SCHEDULED' && (
                    <button
                      type="button"
                      onClick={handleStartInspection}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                    >
                      <ClipboardCheck size={14} />
                      <span>Bắt Đầu Nghiệm Thu Hiện Trường</span>
                    </button>
                  )}

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
                            updateCurrentCase({ doorPassed: true, doorFeeInput: 0, doorFee: 0 })
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
                            updateCurrentCase({ doorPassed: false, doorFeeInput: newFee, doorFee: newFee })
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${!doorPassed ? 'bg-rose-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                        >
                          Hư hại
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={doorNotes}
                      onChange={(e) => {
                        setDoorNotes(e.target.value)
                        updateCurrentCase({ doorNotes: e.target.value })
                      }}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-amber-400"
                      placeholder="Ghi chú tình trạng đóng mở, ray dẫn, biến dạng..."
                    />

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
                            updateCurrentCase({ cleanlinessPassed: true, cleaningFeeInput: 0, cleaningFee: 0 })
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
                            updateCurrentCase({ cleanlinessPassed: false, cleaningFeeInput: newFee, cleaningFee: newFee })
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${!cleanlinessPassed ? 'bg-amber-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                        >
                          Chưa dọn
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={cleanlinessNotes}
                      onChange={(e) => {
                        setCleanlinessNotes(e.target.value)
                        updateCurrentCase({ cleanlinessNotes: e.target.value })
                      }}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-amber-400"
                      placeholder="Ghi chú vệ sinh, rác thừa, vết dầu mỡ..."
                    />

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
                            updateCurrentCase({ damagePassed: true, damageFeeInput: 0, damageFee: 0 })
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${damagePassed ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                        >
                          Nguyên vẹn
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDamagePassed(false)
                            const newFee = damageFeeInput > 0 ? damageFeeInput : 5000000
                            setDamageFeeInput(newFee)
                            updateCurrentCase({ damagePassed: false, damageFeeInput: newFee, damageFee: newFee })
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${!damagePassed ? 'bg-rose-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                        >
                          Hư hại
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={damageNotes}
                      onChange={(e) => {
                        setDamageNotes(e.target.value)
                        updateCurrentCase({ damageNotes: e.target.value })
                      }}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-amber-400"
                      placeholder="Ghi chú hư hại, móp vách, nứt sàn..."
                    />

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
                            placeholder="5000000"
                          />
                          <span className="font-bold text-rose-700">VNĐ</span>
                        </div>
                        <span className="text-[11px] text-rose-600 font-medium">(Cần quản lý cơ sở phê duyệt)</span>
                      </div>
                    )}
                  </div>

                  {/* 4. Khóa Smart Lock IoT */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2.5 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">4. Ổ khóa SmartLock IoT</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${smartLockPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {smartLockPassed ? '✓ Pin 94% • Hoạt động tốt' : '⚠️ Lỗi khóa / Hết pin'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setSmartLockPassed(true)
                            setSmartLockFeeInput(0)
                            updateCurrentCase({ smartLockPassed: true, smartLockFeeInput: 0, smartLockFee: 0 })
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${smartLockPassed ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                        >
                          Bình thường
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSmartLockPassed(false)
                            const newFee = smartLockFeeInput > 0 ? smartLockFeeInput : 400000
                            setSmartLockFeeInput(newFee)
                            updateCurrentCase({ smartLockPassed: false, smartLockFeeInput: newFee, smartLockFee: newFee })
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${!smartLockPassed ? 'bg-rose-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                        >
                          Báo lỗi
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={smartLockNotes}
                      onChange={(e) => {
                        setSmartLockNotes(e.target.value)
                        updateCurrentCase({ smartLockNotes: e.target.value })
                      }}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-amber-400"
                      placeholder="Ghi chú tình trạng khóa số, pin, độ nhạy cảm biến..."
                    />

                    {!smartLockPassed && (
                      <div className="p-2.5 rounded-lg bg-rose-50/70 border border-rose-200 flex items-center gap-2 flex-wrap text-xs">
                        <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                        <span className="font-bold text-rose-800">Phí khắc phục / thay thế SmartLock dự kiến:</span>
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
                            placeholder="400000"
                          />
                          <span className="font-bold text-rose-700">VNĐ</span>
                        </div>
                        <span className="text-[11px] text-rose-600 font-medium">(Khấu trừ trực tiếp vào tiền cọc)</span>
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
                            updateCurrentCase({ assetsClearedPassed: true })
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${assetsClearedPassed ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                        >
                          Đã dọn trống
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAssetsClearedPassed(false)
                            updateCurrentCase({ assetsClearedPassed: false })
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${!assetsClearedPassed ? 'bg-rose-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                        >
                          Còn đồ
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={assetsClearedNotes}
                      onChange={(e) => {
                        setAssetsClearedNotes(e.target.value)
                        updateCurrentCase({ assetsClearedNotes: e.target.value })
                      }}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-amber-400"
                      placeholder="Xác nhận khách đã mang toàn bộ đồ đạc cá nhân ra khỏi ô kho..."
                    />
                  </div>

                  {/* 6. Ảnh chụp hiện trường có Upload thật */}
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
                            ✓ Đủ {photoUrls.length}/2 ảnh (Đạt tiêu chuẩn)
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
                          className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                        >
                          <Upload size={14} />
                          <span>+ Tải ảnh hiện trường lên</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const demo = [...DEFAULT_PROOF_PHOTOS]
                            setPhotoUrls(demo)
                            updateCurrentCase({ photoUrls: demo })
                            toast.info('Đã tải 2 ảnh hiện trường mẫu.')
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium text-xs cursor-pointer transition"
                          title="Nạp nhanh 2 ảnh mẫu để kiểm thử biên bản"
                        >
                          Dùng ảnh mẫu
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
                              Ảnh {i + 1} • {i === 0 ? 'Toàn cảnh' : i === 1 ? 'Khóa & sàn' : 'Chi tiết'}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemovePhoto(i)
                              }}
                              className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-md bg-rose-600/90 hover:bg-rose-700 text-white text-[10px] font-bold shadow-xs transition cursor-pointer flex items-center gap-0.5"
                              title="Gỡ ảnh này"
                            >
                              ✕ Xóa
                            </button>
                          </div>
                        ))}

                        {/* Ô thêm ảnh trực tiếp trong grid */}
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

                  {/* 7. Cảm biến môi trường Boxora IoT có button Đạt và Chưa đạt */}
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
                            const defaultNote = 'Cảm biến IoT: 23°C • Độ ẩm 46% RH (Đạt tiêu chuẩn bảo quản)'
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
                            const alertNote = 'Cảm biến IoT: 32°C • Độ ẩm 78% RH (Vượt ngưỡng an toàn - Cần bảo trì buồng kho)'
                            setEnvNotes(alertNote)
                            updateCurrentCase({ envPassed: false, envNotes: alertNote })
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${!envPassed ? 'bg-rose-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                        >
                          Chưa đạt
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={envNotes}
                      onChange={(e) => {
                        setEnvNotes(e.target.value)
                        updateCurrentCase({ envNotes: e.target.value })
                      }}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-amber-400"
                      placeholder="Ghi chú chỉ số cảm biến môi trường (nhiệt độ, độ ẩm)..."
                    />

                    {!envPassed && (
                      <div className="p-2.5 rounded-lg bg-rose-50/80 border border-rose-200 flex items-center gap-2 flex-wrap text-xs">
                        <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                        <span className="font-bold text-rose-800">Cảnh báo môi trường kho không đạt chuẩn:</span>
                        <span className="text-[11px] text-rose-700 font-medium">
                          Chỉ số môi trường không đạt yêu cầu. Buồng kho sẽ được đưa vào diện BẢO TRÌ (UNDER_MAINTENANCE) sau khi bàn giao để kỹ thuật xử lý.
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Nút lưu biên bản B */}
                <div className="pt-2 flex items-center justify-end gap-2 flex-wrap border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleSaveInspection('ISSUE')}
                    className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 cursor-pointer flex items-center gap-1.5 transition"
                  >
                    <AlertTriangle size={15} />
                    <span>Lập Biên Bản Có Hư Hại / Khấu Trừ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveInspection('PASSED')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs flex items-center gap-1.5 transition"
                  >
                    <CheckCircle2 size={15} />
                    <span>Lưu Biên Bản Nghiệm Thu ĐẠT CHUẨN</span>
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
                    Công thức: Tiền hoàn = Tiền cọc - Khấu trừ - Công nợ
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
                      <span>3. Phí khắc phục hư hại cửa cuốn &amp; ray:</span>
                      <span className={`font-mono font-bold ${doorFee > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        -{doorFee.toLocaleString('vi-VN')}đ
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span>4. Phí bồi thường hư hại kho (vách, sàn, trần):</span>
                      <span className={`font-mono font-bold ${damageFee > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        -{damageFee.toLocaleString('vi-VN')}đ
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span>5. Phí sửa chữa / thay thế khóa SmartLock:</span>
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

                    {/* KẾT QUẢ ĐỐI SOÁT THEO 2 TRƯỜNG HỢP */}
                    {!isOverDeposit ? (
                      /* Trường hợp 1: Số tiền sửa chữa và bảo trì <= tiền cọc */
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
                      /* Trường hợp 2: Số tiền sửa chữa và bảo trì >= tiền cọc */
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
                            <span>Tiền cọc được khấu trừ</span>
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
                                Khoản khách còn phải thanh toán
                              </span>
                              <span className="text-[10px] text-rose-600 font-medium">
                                (Tổng chi phí sửa chữa vượt quá số tiền cọc)
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

                  {/* Cột 2: Thông tin tài khoản nhận hoàn cọc hoặc Thu bù khoản chênh lệch */}
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
                            <strong className="text-indigo-700 font-bold">{currentCase.refundTxnRef ? `Đã hoàn (${currentCase.refundTxnRef})` : 'Chờ hoàn tiền'}</strong>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-rose-700">
                            Quyết Toán Cấn Trừ Cọc &amp; Thu Bồi Thường
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            Cọc không đủ bù hư hại
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 space-y-1 text-slate-700">
                          <p className="font-semibold text-rose-900">
                            Toàn bộ tiền cọc ({deductedDepositAmount.toLocaleString('vi-VN')}đ) đã được khấu trừ 100%.
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
                            <strong className={currentCase.refundTxnRef ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                              {currentCase.refundTxnRef ? `Đã thu (${currentCase.refundTxnRef})` : `Chưa thu (${customerPayableAmount.toLocaleString('vi-VN')}đ)`}
                            </strong>
                          </div>
                        </div>
                      </>
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
                  <span className="text-xs text-slate-400">Audit Trail Boxora</span>
                </div>

                {/* Timeline Notes */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                  {(currentCase.historyNotes && currentCase.historyNotes.length > 0) ? (
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
                  <div className="text-xs text-slate-500">
                    Vai trò hiện tại: <strong className="text-slate-800">{userRole} ({userName})</strong>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
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
                            : `Trình Duyệt Khoản Hoàn Trả (${netRefundAmount.toLocaleString('vi-VN')}đ)`}
                        </span>
                      </button>
                    )}

                    {/* FACILITY_MANAGER action: Phê duyệt hoàn cọc */}
                    {currentCase.status === 'REFUND_PENDING_APPROVAL' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            updateCurrentCase({
                              status: 'INSPECTION_ISSUE',
                              historyNotes: [...(currentCase.historyNotes || []), `Quản lý ${userName} yêu cầu thẩm định lại`]
                            })
                            toast.warning('Đã yêu cầu nhân viên đối soát lại hiện trường.')
                          }}
                          className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs cursor-pointer transition"
                        >
                          Yêu Cầu Kiểm Tra Lại
                        </button>
                        <button
                          type="button"
                          onClick={handleApproveRefund}
                          className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                        >
                          <ShieldCheck size={16} />
                          <span>
                            {isOverDeposit
                              ? `Phê Duyệt Khấu Trừ Hết Cọc & Thu Thêm (${customerPayableAmount.toLocaleString('vi-VN')}đ)`
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

                    {/* Final Action: Bàn giao & Giải phóng kho */}
                    {(currentCase.status === 'REFUNDED' || currentCase.status === 'REFUND_APPROVED') && (
                      <button
                        type="button"
                        onClick={handleCompleteHandoverAndRelease}
                        disabled={isFinishingHandover}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20 transition"
                      >
                        <Lock size={15} />
                        <span>{isFinishingHandover ? 'Đang hoàn tất...' : 'Xác Nhận Bàn Giao & Giải Phóng Kho'}</span>
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
                onClick={handleExecuteRefund}
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
                Sau khi xác nhận, hồ sơ sẽ chuyển sang trạng thái <strong>Đã lên lịch nghiệm thu</strong>. Bạn có thể nhấn <strong>Bắt Đầu Nghiệm Thu Hiện Trường</strong> để tiến hành kiểm định 7 tiêu chí buồng kho.
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
                <span>Xác Nhận &amp; Lên Lịch Nghiệm Thu</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
