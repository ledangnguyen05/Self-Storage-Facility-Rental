import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Box,
  Layers,
  Filter,
  Check,
  CheckCircle2,
  AlertCircle,
  Key,
  ShieldCheck,
  Mail,
  ArrowRight,
  ArrowLeft,
  Upload,
  FileText,
  Smartphone,
  RefreshCw,
  Eye,
  QrCode,
  Lock,
  Printer,
  Send
} from 'lucide-react'
import { Booking, StorageUnit } from '../../../types'
import { storageUnitService } from '../../../services/storageUnitService'
import { handoverService, HandoverPrerequisites } from '../../../services/handoverService'
import { bookingService } from '../../../services/bookingService'
import { paymentService } from '../../../services/paymentService'
import { EarlyCheckInConfirmModal } from '../../../components/modals/EarlyCheckInConfirmModal'
import { useAuth } from '../../../context/AuthContext'

export interface BookingChecklist {
  doorRoll: boolean
  cleanliness: boolean
  lighting: boolean
  fireSafety: boolean
  sealPlate: boolean
}

export type HandoverStepTab = 'verify' | 'assign' | 'contract_payment' | 'pin' | 'audit' | 'checklist'

export interface BookingWorkbenchSession {
  bookingId: string
  assignedUnitCode?: string
  activeStepTab: HandoverStepTab
  checklist: BookingChecklist
  photoDoor: string
  photoInterior: string
  rfidCard: string
  accessPin: string
  emailSent: boolean
  webPushSent: boolean
  handoverNotes: string
  identityVerified: boolean
  isCompleted: boolean
  completedAt?: string
  paymentProofUrl?: string
  paymentProofName?: string
  paperContractUrl?: string
  paperContractName?: string
}

export interface HandoverSuccessModalData {
  bookingCode: string
  unitCode: string
  customerName: string
  customerPhone: string
  customerEmail: string
  pin: string
  facilityName: string
  completedAt: string
}

const STORAGE_KEY = 'boxora_handover_workbench_sessions'

export const defaultChecklist: BookingChecklist = {
  doorRoll: true,
  cleanliness: true,
  lighting: true,
  fireSafety: true,
  sealPlate: true
}

export const loadPersistedSessions = (): Record<string, BookingWorkbenchSession> => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    Object.values(parsed).forEach((session: any) => {
      if (session && typeof session === 'object') delete session.idCardNumber
    })
    return parsed
  } catch (err) {
    console.warn('Failed to parse persisted handover sessions', err)
    return {}
  }
}

export const persistSessions = (sessions: Record<string, BookingWorkbenchSession>) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch (err) {
    console.warn('Failed to persist handover sessions to sessionStorage', err)
  }
}

export const createInitialSession = (
  bookingId: string,
  isAlreadyActive = false,
  existingPin = '',
  initialUnitCode = ''
): BookingWorkbenchSession => ({
  bookingId,
  assignedUnitCode: initialUnitCode || undefined,
  activeStepTab: 'verify',
  checklist: { ...defaultChecklist },
  photoDoor: '',
  photoInterior: '',
  rfidCard: '',
  accessPin: existingPin && existingPin !== '------' ? existingPin : '------',
  emailSent: false,
  webPushSent: false,
  handoverNotes: 'Đã đối soát đầy đủ hồ sơ tại quầy tiếp đón.',
  identityVerified: false,
  isCompleted: isAlreadyActive
})

interface HandoverCheckInWorkbenchProps {
  arrivals?: Booking[]
  onRefreshArrivals?: () => Promise<void> | void
  onHandoverComplete?: (bookingId: string) => void
  onOpenQrScanner?: () => void
  activeBookingId?: string
  onSelectBooking?: (bookingId: string) => void
  facilityId?: string
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const EQUIVALENT_TYPE_GROUPS: string[][] = [
  ['10000000-0000-0000-0000-000000000001', '5a11bcbb-f3a1-44f6-89a6-fb461be8158c'], // Mini/Locker
  ['10000000-0000-0000-0000-000000000002', 'e56d6554-5a81-4af1-a392-29db319252c1'], // Medium
  ['10000000-0000-0000-0000-000000000003', 'fedddc98-983a-4925-81cf-dbf8da4d5a4e'], // Standard
  ['10000000-0000-0000-0000-000000000004', 'ce41ba29-16d6-4af0-99b1-a2407cbe1345'], // Extra Large
  ['10000000-0000-0000-0000-000000000005'], // Cold Storage
]

type SizeCategory = 'MINI' | 'MEDIUM' | 'STANDARD' | 'LARGE' | 'COLD' | null

function classifyByTypeAndText(typeId?: string | null, text?: string | null, areaSqMeters?: number | null): SizeCategory {
  if (typeId) {
    if (EQUIVALENT_TYPE_GROUPS[0].includes(typeId)) return 'MINI'
    if (EQUIVALENT_TYPE_GROUPS[1].includes(typeId)) return 'MEDIUM'
    if (EQUIVALENT_TYPE_GROUPS[2].includes(typeId)) return 'STANDARD'
    if (EQUIVALENT_TYPE_GROUPS[3].includes(typeId)) return 'LARGE'
    if (EQUIVALENT_TYPE_GROUPS[4].includes(typeId)) return 'COLD'
  }

  if (text) {
    const t = text.toLowerCase().trim()
    if (t.includes('kho lạnh') || t.includes('cold storage')) return 'COLD'

    const numMatch = t.match(/(\d+(?:[.,]\d+)?)\s*m(?:³|3|²|2)?/i)
    if (numMatch) {
      const val = parseFloat(numMatch[1].replace(',', '.'))
      if (!Number.isNaN(val)) {
        if (val <= 2) return 'MINI'
        if (val <= 4.5) return 'MEDIUM'
        if (val <= 8.5) return 'STANDARD'
        return 'LARGE'
      }
    }

    if (t.includes('mini') || t.includes('locker') || t.includes('tủ cá nhân')) return 'MINI'
    if (t.includes('vừa') || t.includes('medium') || t.includes('studio') || t.includes('nhỏ')) return 'MEDIUM'
    if (t.includes('tiêu chuẩn') || t.includes('standard') || t.includes('phòng ngủ')) return 'STANDARD'
    if (t.includes('lớn') || t.includes('commercial') || t.includes('extra') || t.includes('thương mại') || t.includes('doanh nghiệp')) return 'LARGE'
  }

  if (typeof areaSqMeters === 'number' && areaSqMeters > 0) {
    if (areaSqMeters <= 1.8) return 'MINI'
    if (areaSqMeters <= 4.5) return 'MEDIUM'
    if (areaSqMeters <= 8.5) return 'STANDARD'
    return 'LARGE'
  }

  return null
}

function isUnitMatchingBookedSize(u: StorageUnit, targetTypeId?: string | null, targetName?: string | null): boolean {
  if (targetTypeId && u.unitTypeId) {
    if (u.unitTypeId === targetTypeId) return true
    for (const group of EQUIVALENT_TYPE_GROUPS) {
      if (group.includes(targetTypeId) && group.includes(u.unitTypeId)) return true
    }
  }

  if (targetName && u.unitTypeName) {
    const t = targetName.toLowerCase().trim()
    const n = u.unitTypeName.toLowerCase().trim()
    if (t && n && (t === n || n.includes(t) || t.includes(n))) return true
  }

  const targetCategory = classifyByTypeAndText(targetTypeId, targetName, null)
  const unitCategory = classifyByTypeAndText(u.unitTypeId, u.unitTypeName, u.areaSqMeters)
  if (targetCategory && unitCategory && targetCategory === unitCategory) {
    return true
  }

  return false
}

export const HandoverCheckInWorkbench: React.FC<HandoverCheckInWorkbenchProps> = ({
  arrivals: propArrivals,
  onRefreshArrivals,
  onHandoverComplete,
  onOpenQrScanner,
  activeBookingId: propActiveBookingId,
  onSelectBooking,
  facilityId
}) => {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<Record<string, BookingWorkbenchSession>>(() => loadPersistedSessions())
  const [selectedBookingId, setSelectedBookingId] = useState<string>('')
  const [extraBookingDetails, setExtraBookingDetails] = useState<Record<string, Booking>>({})
  const [isVerifyingIdentity, setIsVerifyingIdentity] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkInError, setCheckInError] = useState<string | null>(null)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [isSendingWebPush, setIsSendingWebPush] = useState(false)
  const [pinCopied, setPinCopied] = useState(false)
  const [dispatchFeedback, setDispatchFeedback] = useState<{ text: string; isError?: boolean } | null>(null)

  // Document modal State
  const [showPdfModal, setShowPdfModal] = useState(false)

  // Identity Form States (Step 1)
  const [idCardType, setIdCardType] = useState<string>('CCCD')
  const [idCardInputNumber, setIdCardInputNumber] = useState<string>('')
  const [idOriginalSeen, setIdOriginalSeen] = useState<boolean>(false)
  const [idNotes, setIdNotes] = useState<string>('')

  // Handover confirmation modal state
  const [handoverSuccessModalData, setHandoverSuccessModalData] = useState<HandoverSuccessModalData | null>(null)
  const [copiedSuccessPin, setCopiedSuccessPin] = useState<boolean>(false)

  // Prerequisites Cache
  const [prerequisitesCache, setPrerequisitesCache] = useState<Record<string, HandoverPrerequisites>>({})
  const [loadingPrerequisites, setLoadingPrerequisites] = useState<boolean>(false)

  // Step 2: Available Units State
  const [availableUnits, setAvailableUnits] = useState<StorageUnit[]>([])
  const [loadingAvailableUnits, setLoadingAvailableUnits] = useState<boolean>(false)
  const [assignFloorFilter, setAssignFloorFilter] = useState<string>('ALL')
  const [assignSearchTerm, setAssignSearchTerm] = useState<string>('')
  const [assignShowAllSizes, setAssignShowAllSizes] = useState<boolean>(false)
  const [selectedAssignUnitId, setSelectedAssignUnitId] = useState<string>('')
  const [isAssigningPhysicalUnit, setIsAssigningPhysicalUnit] = useState<boolean>(false)
  const [isChangingAssignedUnit, setIsChangingAssignedUnit] = useState<boolean>(false)

  // Step 3: Upload Proofs State
  const [isUploadingPaymentProof, setIsUploadingPaymentProof] = useState<boolean>(false)
  const [isUploadingPaperContractScan, setIsUploadingPaperContractScan] = useState<boolean>(false)
  const [isCreatingVNPayLink, setIsCreatingVNPayLink] = useState<boolean>(false)
  const paymentProofInputRef = useRef<HTMLInputElement | null>(null)
  const paperContractScanInputRef = useRef<HTMLInputElement | null>(null)

  // Shift & Early Check-In States
  const [isEarlyCheckInConfirmed, setIsEarlyCheckInConfirmed] = useState<boolean>(false)
  const [showEarlyCheckInModal, setShowEarlyCheckInModal] = useState<boolean>(false)

  const arrivalsList = propArrivals || []

  // Sync selected booking ID
  useEffect(() => {
    if (propActiveBookingId) {
      setSelectedBookingId(propActiveBookingId)
    } else if (arrivalsList.length > 0 && !selectedBookingId) {
      setSelectedBookingId(arrivalsList[0].id)
    }
  }, [propActiveBookingId, arrivalsList, selectedBookingId])

  // Persist sessions to sessionStorage
  useEffect(() => {
    persistSessions(sessions)
  }, [sessions])

  const currentBooking: Booking | null = useMemo(() => {
    if (!selectedBookingId) return null
    return (
      arrivalsList.find((b) => b.id === selectedBookingId || b.bookingCode === selectedBookingId) ||
      extraBookingDetails[selectedBookingId] ||
      null
    )
  }, [arrivalsList, selectedBookingId, extraBookingDetails])

  // Fallback fetch individual booking if not in arrivals list
  useEffect(() => {
    if (
      selectedBookingId &&
      !arrivalsList.some((b) => b.id === selectedBookingId || b.bookingCode === selectedBookingId) &&
      !extraBookingDetails[selectedBookingId]
    ) {
      bookingService
        .getById(selectedBookingId)
        .then((b) => {
          if (b) {
            setExtraBookingDetails((prev) => ({ ...prev, [selectedBookingId]: b }))
          }
        })
        .catch((err) => {
          console.warn('Could not fetch booking details for ' + selectedBookingId, err)
        })
    }
  }, [selectedBookingId, arrivalsList, extraBookingDetails])

  const currentPrerequisites: HandoverPrerequisites | null = useMemo(() => {
    if (!selectedBookingId) return null
    return prerequisitesCache[selectedBookingId] || null
  }, [prerequisitesCache, selectedBookingId])

  // Fetch prerequisites when booking selection changes
  const fetchPrerequisitesForBooking = useCallback(
    async (bookingId: string) => {
      if (!bookingId) return
      setLoadingPrerequisites(true)
      try {
        const prereq = await handoverService.getCheckInPrerequisites(bookingId)
        setPrerequisitesCache((prev) => ({ ...prev, [bookingId]: prereq }))
      } catch (err: any) {
        console.warn('Không thể tải điều kiện đối soát:', err)
      } finally {
        setLoadingPrerequisites(false)
      }
    },
    []
  )

  useEffect(() => {
    if (selectedBookingId && !prerequisitesCache[selectedBookingId]) {
      fetchPrerequisitesForBooking(selectedBookingId)
    }
  }, [selectedBookingId, prerequisitesCache, fetchPrerequisitesForBooking])

  // Ensure session exists for current booking
  useEffect(() => {
    if (!selectedBookingId) return

    setSessions((prev) => {
      if (prev[selectedBookingId]) {
        return prev
      }
      const isAlreadyActive =
        currentBooking?.status === 'ACTIVE' ||
        currentBooking?.status === 'COMPLETED'
      const existingPin = currentBooking?.accessPin || ''
      const existingUnitCode = currentBooking?.unitCode || ''
      return {
        ...prev,
        [selectedBookingId]: createInitialSession(
          selectedBookingId,
          isAlreadyActive,
          existingPin,
          existingUnitCode
        )
      }
    })
  }, [selectedBookingId, currentBooking])

  const currentSession: BookingWorkbenchSession = useMemo(() => {
    if (!selectedBookingId || !sessions[selectedBookingId]) {
      const isAlreadyActive =
        currentBooking?.status === 'ACTIVE' ||
        currentBooking?.status === 'COMPLETED'
      return createInitialSession(
        selectedBookingId,
        isAlreadyActive,
        currentBooking?.accessPin || '',
        currentBooking?.unitCode || ''
      )
    }
    return sessions[selectedBookingId]
  }, [selectedBookingId, sessions, currentBooking])

  const updateCurrentSession = useCallback(
    (patch: Partial<BookingWorkbenchSession> | ((prev: BookingWorkbenchSession) => Partial<BookingWorkbenchSession>)) => {
      if (!selectedBookingId) return
      setSessions((prev) => {
        const old = prev[selectedBookingId] || createInitialSession(selectedBookingId)
        const updated = typeof patch === 'function' ? patch(old) : patch
        return {
          ...prev,
          [selectedBookingId]: {
            ...old,
            ...updated
          }
        }
      })
    },
    [selectedBookingId]
  )

  // Normalized active tab
  const activeTab: 'verify' | 'assign' | 'contract_payment' | 'pin' = useMemo(() => {
    const raw = currentSession.activeStepTab
    if (raw === 'audit') return 'verify'
    if (raw === 'checklist') return 'assign'
    return (raw as any) || 'verify'
  }, [currentSession.activeStepTab])

  // Computed business conditions
  const isDepositMet = currentPrerequisites ? Boolean(currentPrerequisites.depositSatisfied) : false
  const isRentMet = currentPrerequisites ? Boolean(currentPrerequisites.firstMonthRentSatisfied) : false
  const isContractMet = currentPrerequisites ? Boolean(currentPrerequisites.contractSigned) : false
  const isIdMet = currentPrerequisites ? Boolean(currentPrerequisites.identityVerified) : currentSession.identityVerified
  const isCheckInTimeMet = currentPrerequisites ? (currentPrerequisites.checkInTimeMet ?? true) : false

  const unitDisplayCode =
    currentSession?.assignedUnitCode ||
    currentBooking?.unitCode ||
    currentPrerequisites?.unitCode ||
    'N/A'

  const isUnitAssigned = Boolean(
    (unitDisplayCode && unitDisplayCode !== 'N/A' && unitDisplayCode !== 'Chưa gán ô kho vật lý' && !unitDisplayCode.includes('Chưa gán')) ||
    currentSession.assignedUnitCode
  )

  const isContractAndPaymentSatisfied = Boolean(
    (isDepositMet && isRentMet && isContractMet) ||
    (Boolean(currentSession.paymentProofUrl) && Boolean(currentSession.paperContractUrl || isContractMet))
  )

  const customerDisplayName =
    currentBooking?.customerName ||
    (currentBooking as any)?.customer?.fullName ||
    currentPrerequisites?.customerName ||
    'Khách Hàng Boxora'

  const customerDisplayPhone =
    currentBooking?.customerPhone ||
    (currentBooking as any)?.customer?.phone ||
    currentPrerequisites?.customerPhone ||
    'N/A'

  const customerDisplayEmail =
    currentBooking?.customerEmail ||
    (currentBooking as any)?.customer?.email ||
    currentPrerequisites?.customerEmail ||
    ''

  const customerCccd =
    currentPrerequisites?.idCardNumber ||
    currentPrerequisites?.registeredIdCardNumber ||
    currentBooking?.identityCardNumber ||
    (currentBooking as any)?.customer?.identityCardNumber ||
    ''

  const unitTypeName =
    currentPrerequisites?.unitTypeName ||
    currentBooking?.unitTypeName ||
    (currentBooking as any)?.storageUnit?.unitTypeName ||
    (currentBooking as any)?.unitType?.typeName ||
    'Kho tiêu chuẩn'

  const unitArea =
    currentPrerequisites?.areaSqMeters ||
    currentBooking?.areaSqMeters ||
    (currentBooking as any)?.storageUnit?.areaSqMeters ||
    (currentBooking as any)?.unitType?.areaSqm ||
    '---'

  const bookingDisplayCode =
    currentBooking?.bookingCode ||
    currentPrerequisites?.bookingCode ||
    'N/A'

  const facilityDisplayName =
    currentBooking?.facilityName ||
    currentPrerequisites?.facilityName ||
    'Boxora Facility'

  const bookedUnitTypeId = currentBooking?.unitTypeId
  const bookedUnitTypeName = useMemo(() => {
    if (!currentBooking) return ''
    if (currentBooking.unitTypeName) return currentBooking.unitTypeName
    const rawAny = currentBooking as any
    if (rawAny.tier?.name) return rawAny.tier.name
    if (rawAny.sizeName) return rawAny.sizeName
    if (rawAny.size?.name) return rawAny.size.name
    if (rawAny.size?.volumeText) return rawAny.size.volumeText
    return unitTypeName || ''
  }, [currentBooking, unitTypeName])

  // Sync identity input with loaded prerequisites
  useEffect(() => {
    if (currentPrerequisites) {
      setIdCardInputNumber(currentPrerequisites.idCardNumber || currentPrerequisites.registeredIdCardNumber || '')
      setIdCardType(currentPrerequisites.idCardType || currentPrerequisites.registeredIdCardType || 'CCCD')
      setIdOriginalSeen(Boolean(currentPrerequisites.identityVerified))
    } else {
      setIdCardInputNumber('')
      setIdOriginalSeen(false)
    }
  }, [selectedBookingId, currentPrerequisites])

  // Fetch available units for assignment (Step 2)
  const targetFacilityId = useMemo(() => {
    if (currentBooking?.facilityId && UUID_REGEX.test(currentBooking.facilityId)) return currentBooking.facilityId
    if (facilityId && facilityId !== 'ALL' && UUID_REGEX.test(facilityId)) return facilityId
    return currentBooking?.facilityId || (facilityId !== 'ALL' ? facilityId : undefined)
  }, [currentBooking?.facilityId, facilityId])

  useEffect(() => {
    if (!selectedBookingId) {
      setAvailableUnits([])
      return
    }
    setLoadingAvailableUnits(true)
    storageUnitService
      .getUnits({
        facilityId: targetFacilityId,
        status: 'AVAILABLE',
      })
      .then((data) => {
        const avail = (data || []).filter(
          (u) => u.status === 'AVAILABLE' || (u.status as string) === 'Trống'
        )
        setAvailableUnits(avail)
      })
      .catch((err) => {
        console.warn('Could not fetch available units:', err)
      })
      .finally(() => {
        setLoadingAvailableUnits(false)
      })
  }, [selectedBookingId, targetFacilityId])

  // Filter available units for assignment
  const filteredAvailableUnits = useMemo(() => {
    return availableUnits.filter((u) => {
      if (assignFloorFilter !== 'ALL' && u.floorLevel !== assignFloorFilter) {
        return false
      }
      if (assignSearchTerm.trim()) {
        const term = assignSearchTerm.toLowerCase().trim()
        const codeMatch = u.unitCode.toLowerCase().includes(term)
        const nameMatch = (u.unitTypeName || '').toLowerCase().includes(term)
        if (!codeMatch && !nameMatch) return false
      }
      if (!assignShowAllSizes) {
        return isUnitMatchingBookedSize(u, bookedUnitTypeId, bookedUnitTypeName)
      }
      return true
    })
  }, [availableUnits, assignFloorFilter, assignSearchTerm, assignShowAllSizes, bookedUnitTypeId, bookedUnitTypeName])

  // Step Tab Navigation Guards
  const handleSelectTab = (tab: 'verify' | 'assign' | 'contract_payment' | 'pin') => {
    if (tab === 'assign' && !isIdMet) {
      setCheckInError('Cần xác minh CCCD/Hộ chiếu gốc của khách hàng tại quầy ở Bước 1 trước khi chuyển sang chọn ô kho.')
      return
    }
    if (tab === 'contract_payment' && (!isIdMet || !isUnitAssigned)) {
      if (!isIdMet) {
        setCheckInError('Cần xác minh CCCD khách hàng ở Bước 1 trước khi tiếp tục.')
        return
      }
      setCheckInError('Cần chọn và gán ô kho vật lý cho khách hàng ở Bước 2 trước khi chuyển sang ký hợp đồng.')
      return
    }
    if (tab === 'pin' && (!isIdMet || !isUnitAssigned || !isContractAndPaymentSatisfied)) {
      if (!isIdMet) {
        setCheckInError('Chưa xác thực CCCD khách hàng ở Bước 1.')
        return
      }
      if (!isUnitAssigned) {
        setCheckInError('Chưa gán ô kho vật lý ở Bước 2.')
        return
      }
      setCheckInError('Cần thỏa mãn đầy đủ hợp đồng và thanh toán (trực tuyến hoặc tải chứng từ tại cơ sở) trước khi cấp mã PIN.')
      return
    }

    setCheckInError(null)
    updateCurrentSession({ activeStepTab: tab })
  }

  // --- IDENTITY VERIFICATION HANDLER (Step 1) ---
  const handleVerifyIdentity = async () => {
    if (!selectedBookingId) return
    const num = idCardInputNumber.trim()
    if (!/^[0-9]{9,12}$/.test(num)) {
      setCheckInError('Số CCCD / Hộ chiếu phải gồm từ 9 đến 12 chữ số hợp lệ.')
      return
    }
    if (!idOriginalSeen) {
      setCheckInError('Nhân viên bắt buộc phải tích chọn xác nhận đã trực tiếp xem giấy tờ gốc tại quầy.')
      return
    }

    const expectedId = (currentPrerequisites?.registeredIdCardNumber || currentPrerequisites?.idCardNumber || '').trim()
    if (expectedId && expectedId !== num) {
      setCheckInError(`Số ${idCardType} đối chiếu (${num}) không trùng khớp với số ${currentPrerequisites?.registeredIdCardType || 'CCCD'} đã đăng ký trong hồ sơ đặt giữ chỗ (${expectedId}). Vui lòng kiểm tra lại giấy tờ gốc của khách hàng.`)
      return
    }

    setIsVerifyingIdentity(true)
    setCheckInError(null)
    try {
      const updatedPrereq = await handoverService.verifyIdentity(selectedBookingId, {
        idCardType,
        idCardNumber: num,
        originalDocumentSeen: idOriginalSeen,
        notes: idNotes.trim() || 'Nhân viên đã kiểm tra thẻ căn cước / hộ chiếu gốc tại quầy giao dịch.'
      })
      updateCurrentSession({ identityVerified: true })
      setPrerequisitesCache((prev) => ({ ...prev, [selectedBookingId]: updatedPrereq }))
      setDispatchFeedback({ text: `✓ Đã xác minh thành công giấy tờ gốc ${idCardType} số ${num}!` })
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi khi xác minh danh tính khách hàng.'
      setCheckInError(msg)
    } finally {
      setIsVerifyingIdentity(false)
    }
  }

  // --- UNIT ASSIGNMENT HANDLER (Step 2) ---
  const handleConfirmUnitAssignment = async (unitToAssign?: StorageUnit) => {
    const unit = unitToAssign || availableUnits.find((u) => u.id === selectedAssignUnitId)
    if (!unit || !selectedBookingId) {
      setCheckInError('Vui lòng chọn một ô kho còn trống để gán.')
      return
    }

    setIsAssigningPhysicalUnit(true)
    setCheckInError(null)
    try {
      const updatedPrereq = await handoverService.assignUnit(selectedBookingId, unit.unitCode)
      updateCurrentSession({ assignedUnitCode: unit.unitCode })
      setPrerequisitesCache((prev) => ({ ...prev, [selectedBookingId]: updatedPrereq }))
      setIsChangingAssignedUnit(false)
      setSelectedAssignUnitId('')
      if (onRefreshArrivals) onRefreshArrivals()
      setDispatchFeedback({ text: `✓ Đã gán ô kho ${unit.unitCode} (${unit.unitTypeName || 'Tiêu chuẩn'}) thành công!` })
    } catch (err: any) {
      try {
        await bookingService.assignUnitAndProvision(selectedBookingId, unit.id, 'Gán kho tại quầy tiếp đón')
        updateCurrentSession({ assignedUnitCode: unit.unitCode })
        await fetchPrerequisitesForBooking(selectedBookingId)
        setIsChangingAssignedUnit(false)
        setSelectedAssignUnitId('')
        if (onRefreshArrivals) onRefreshArrivals()
        setDispatchFeedback({ text: `✓ Đã gán ô kho ${unit.unitCode} thành công!` })
      } catch (fallbackErr: any) {
        const msg = err?.response?.data?.message || fallbackErr?.response?.data?.message || err?.message || 'Không thể gán ô kho vật lý.'
        setCheckInError(msg)
      }
    } finally {
      setIsAssigningPhysicalUnit(false)
    }
  }

  // --- STEP 3: PAYMENT PROOF UPLOAD HANDLER ---
  const handlePaymentProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedBookingId) return

    setIsUploadingPaymentProof(true)
    setCheckInError(null)
    try {
      const res = await handoverService.uploadHandoverDocument(selectedBookingId, file, 'PAYMENT_PROOF')
      if (res?.fileUrl) {
        updateCurrentSession({
          paymentProofUrl: res.fileUrl,
          paymentProofName: file.name
        })

        const reqDeposit = currentPrerequisites?.depositRemaining || 0
        const reqRent = currentPrerequisites?.firstMonthRentRemaining || 0

        if (reqDeposit > 0) {
          await handoverService.recordManualPayment({
            bookingId: selectedBookingId,
            paymentType: 'DEPOSIT',
            paymentMethod: 'BANK_TRANSFER',
            amount: reqDeposit,
            proofDocumentUrl: res.fileUrl,
            referenceCode: `PROOF-DEP-${bookingDisplayCode}`,
            notes: 'Thanh toán tiền cọc có chứng từ kèm theo tại cơ sở'
          })
        }
        if (reqRent > 0) {
          await handoverService.recordManualPayment({
            bookingId: selectedBookingId,
            paymentType: 'RENTAL_FEE',
            paymentMethod: 'BANK_TRANSFER',
            amount: reqRent,
            proofDocumentUrl: res.fileUrl,
            referenceCode: `PROOF-RENT-${bookingDisplayCode}`,
            notes: 'Thanh toán tiền thuê tháng đầu có chứng từ kèm theo tại cơ sở'
          })
        }

        await fetchPrerequisitesForBooking(selectedBookingId)
        setDispatchFeedback({ text: `✓ Đã tải lên và ghi nhận chứng từ thanh toán ${file.name} thành công!` })
      }
    } catch (err: any) {
      setCheckInError(err?.response?.data?.message || err?.message || 'Lỗi khi tải chứng từ thanh toán.')
    } finally {
      setIsUploadingPaymentProof(false)
      e.target.value = ''
    }
  }

  // --- STEP 3: PAPER CONTRACT SCAN UPLOAD HANDLER ---
  const handlePaperContractScanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedBookingId) return

    setIsUploadingPaperContractScan(true)
    setCheckInError(null)
    try {
      const res = await handoverService.uploadHandoverDocument(selectedBookingId, file, 'PAPER_CONTRACT')
      if (res?.fileUrl) {
        updateCurrentSession({
          paperContractUrl: res.fileUrl,
          paperContractName: file.name
        })

        await handoverService.createOrUploadPaperContract({
          bookingId: selectedBookingId,
          contractCode: currentPrerequisites?.contractCode || `HD-PAPER-${bookingDisplayCode}`,
          paperContractUrl: res.fileUrl,
          paperOriginalLocation: 'Tủ lưu trữ hồ sơ cơ sở Boxora',
          notes: 'Khách hàng ký hợp đồng trực tiếp tại quầy và nhân viên đã lưu bản scan.'
        })

        await fetchPrerequisitesForBooking(selectedBookingId)
        setDispatchFeedback({ text: `✓ Đã lưu bản scan hợp đồng giấy ${file.name} thành công!` })
      }
    } catch (err: any) {
      setCheckInError(err?.response?.data?.message || err?.message || 'Lỗi khi lưu ảnh hợp đồng giấy.')
    } finally {
      setIsUploadingPaperContractScan(false)
      e.target.value = ''
    }
  }

  // Quick VNPay Link Creator for Step 3
  const handleCreateCounterVNPayLink = async () => {
    if (!currentBooking) return
    setIsCreatingVNPayLink(true)
    setCheckInError(null)
    try {
      const payableTotal =
        (currentPrerequisites?.depositRemaining || 0) +
        (currentPrerequisites?.firstMonthRentRemaining || 0) ||
        (currentBooking.totalRentalFee || 0) + (currentBooking.depositAmount || 0) ||
        1000000

      const res = await paymentService.createVNPayPayment({
        bookingId: currentBooking.id,
        amount: payableTotal,
        paymentType: 'RENTAL_FEE',
        orderInfo: `Thanh toan checkin tai quay don ${bookingDisplayCode}`
      })
      if (res?.paymentUrl) {
        window.open(res.paymentUrl, '_blank')
        setDispatchFeedback({ text: 'Đã mở cổng thanh toán VNPay trên tab mới để khách quét mã QR.' })
      } else {
        throw new Error('Máy chủ không trả về liên kết thanh toán VNPay.')
      }
    } catch (err: any) {
      setCheckInError(err?.response?.data?.message || err?.message || 'Không thể tạo liên kết VNPay.')
    } finally {
      setIsCreatingVNPayLink(false)
    }
  }

  // Direct Contract View Handler
  const handleViewContractDocument = async () => {
    if (!selectedBookingId) return
    const docUrl = currentPrerequisites?.signedDocumentUrl || currentPrerequisites?.paperContractUrl
    if (docUrl) {
      try {
        const blobUrl = await handoverService.viewAuthorizedDocument(selectedBookingId, docUrl)
        window.open(blobUrl, '_blank')
      } catch {
        window.open(docUrl, '_blank')
      }
    } else {
      setShowPdfModal(true)
    }
  }

  // --- STEP 4: COMPLETE HANDOVER & PIN ACTIVATION ---
  const handleCompleteHandover = async () => {
    if (!currentBooking) return

    if (!isIdMet) {
      setCheckInError('Bước 1: Cần xác thực CCCD/Hộ chiếu khách hàng trước khi bàn giao!')
      return
    }
    if (!isUnitAssigned) {
      setCheckInError('Bước 2: Cần chọn và gán ô kho vật lý trước khi bàn giao!')
      return
    }
    if (!isContractMet && !currentSession.paperContractUrl) {
      setCheckInError('Bước 3: Chưa hoàn tất ký hợp đồng thuê kho!')
      return
    }
    if ((!isDepositMet || !isRentMet) && !currentSession.paymentProofUrl) {
      setCheckInError('Bước 3: Chưa hoàn tất thanh toán cọc và tiền thuê tháng đầu!')
      return
    }

    if (!isCheckInTimeMet && !isEarlyCheckInConfirmed) {
      setShowEarlyCheckInModal(true)
      return
    }

    setIsSubmitting(true)
    setCheckInError(null)
    try {
      try {
        await handoverService.recordCheckInInspection({
          bookingId: currentBooking.id,
          doorConditionPassed: true,
          cleanlinessPassed: true,
          smartLockPassed: true,
          sensorPassed: true,
          wallStructurePassed: true,
          evidencePhotos: [
            currentSession.photoDoor || '/uploads/sample-door.jpg',
            currentSession.photoInterior || '/uploads/sample-interior.jpg'
          ],
          unitCondition: '5/5 tiêu chuẩn nghiệm thu đạt chuẩn (Kiểm tra tại quầy tiếp đón)',
          notes: currentSession.handoverNotes || 'Tiếp nhận và bàn giao kho tại cơ sở.'
        })
      } catch (inspErr) {
        console.warn('Inspection auto-persist note:', inspErr)
      }

      const res = await handoverService.checkIn({
        bookingId: currentBooking.id,
        requestedUnitCode: currentSession?.assignedUnitCode || (unitDisplayCode !== 'N/A' ? unitDisplayCode : undefined),
        recordType: 'CHECK_IN',
        rfidCardNumber: currentSession.rfidCard.trim() || undefined,
        earlyCheckInConfirmed: isEarlyCheckInConfirmed || !isCheckInTimeMet,
        earlyCheckInReason: !isCheckInTimeMet ? 'Khách nhận kho sớm có xác nhận của nhân viên' : undefined,
        notes: currentSession.handoverNotes
      })

      const generatedPin = res?.accessPin
      if (!generatedPin) throw new Error('Check-in hoàn tất nhưng máy chủ không trả về mã PIN SmartLock.')
      const nowIso = new Date().toISOString()

      let emailSentSuccess = false
      let webPushSentSuccess = false

      // 1. Tự động gửi Email chứa mã PIN cho khách hàng
      try {
        await handoverService.sendPinEmail(currentBooking.id)
        emailSentSuccess = true
      } catch (eErr) {
        console.warn('Send PIN email failed:', eErr)
      }

      // 2. Tự động bắn thông báo web vào mục thông báo trên hệ thống
      try {
        await handoverService.sendWebNotification(currentBooking.id)
        webPushSentSuccess = true
      } catch (wErr) {
        console.warn('Send web notification failed:', wErr)
      }

      window.dispatchEvent(new Event('boxora:notifications-refresh'))

      updateCurrentSession({
        accessPin: generatedPin,
        isCompleted: true,
        completedAt: nowIso,
        emailSent: emailSentSuccess,
        webPushSent: webPushSentSuccess
      })

      setHandoverSuccessModalData({
        bookingCode: bookingDisplayCode,
        unitCode: currentSession.assignedUnitCode || unitDisplayCode,
        customerName: customerDisplayName,
        customerPhone: customerDisplayPhone,
        customerEmail: customerDisplayEmail,
        pin: generatedPin,
        facilityName: facilityDisplayName,
        completedAt: nowIso
      })

      if (onHandoverComplete) onHandoverComplete(currentBooking.id)
      if (onRefreshArrivals) onRefreshArrivals()
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi thực hiện check-in bàn giao kho.'
      setCheckInError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSendEmail = async () => {
    if (!currentBooking) return
    if (!customerDisplayEmail) {
      setDispatchFeedback({ text: 'Khách hàng chưa có địa chỉ email hợp lệ.', isError: true })
      return
    }
    setIsSendingEmail(true)
    setDispatchFeedback(null)
    try {
      await handoverService.sendPinEmail(currentBooking.id)
      updateCurrentSession({ emailSent: true })
      setDispatchFeedback({ text: `✓ Đã gửi email chứa mã PIN tới ${customerDisplayEmail}!` })
    } catch (err: any) {
      setDispatchFeedback({ text: err?.response?.data?.message || err?.message || 'Không thể gửi email PIN.', isError: true })
    } finally {
      setIsSendingEmail(false)
      setTimeout(() => setDispatchFeedback(null), 4000)
    }
  }

  const handleSendWebPush = async () => {
    if (!currentBooking) return
    setIsSendingWebPush(true)
    setDispatchFeedback(null)
    try {
      await handoverService.sendWebNotification(currentBooking.id)
      window.dispatchEvent(new Event('boxora:notifications-refresh'))
      updateCurrentSession({ webPushSent: true })
      setDispatchFeedback({ text: '✓ Đã bắn thông báo vào mục thông báo trên hệ thống của khách!' })
    } catch (err: any) {
      setDispatchFeedback({ text: err?.response?.data?.message || err?.message || 'Không thể bắn thông báo web.', isError: true })
    } finally {
      setIsSendingWebPush(false)
      setTimeout(() => setDispatchFeedback(null), 4000)
    }
  }

  const handleCopyPin = () => {
    if (currentSession.accessPin && currentSession.accessPin !== '------') {
      navigator.clipboard.writeText(currentSession.accessPin)
      setPinCopied(true)
      setTimeout(() => setPinCopied(false), 2000)
    }
  }

  if (!currentBooking) {
    return (
      <div id="handover-workbench" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-left">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm shrink-0">
            <span className="material-symbols-outlined text-[26px]">desk</span>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Quy Trình Tiếp Nhận &amp; Bàn Giao Kho Tại Cơ Sở
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Vui lòng chọn một lượt đặt kho trong danh sách Đón tiếp hôm nay hoặc bấm "Tiếp nhận" ở bảng trên để bắt đầu quy trình 4 bước.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div id="handover-workbench" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-left">
      {/* 1. Header Card with Booking Details & Feedback */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm shrink-0">
            <span className="material-symbols-outlined text-[26px]">desk</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900">
                Tiếp Nhận &amp; Bàn Giao Kho: #{bookingDisplayCode}
              </h2>
              {currentSession.isCompleted && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  <span>ĐÃ BÀN GIAO</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Khách hàng: <strong className="text-slate-800">{customerDisplayName}</strong> ({customerDisplayPhone}) • Cơ sở: <strong className="text-slate-800">{facilityDisplayName}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center">
          <button
            type="button"
            onClick={() => fetchPrerequisitesForBooking(selectedBookingId)}
            disabled={loadingPrerequisites}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer transition shadow-2xs"
            title="Tải lại điều kiện đối soát"
          >
            <RefreshCw size={13} className={loadingPrerequisites ? 'animate-spin' : ''} />
            <span>Đối soát lại</span>
          </button>
          {onOpenQrScanner && (
            <button
              type="button"
              onClick={onOpenQrScanner}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
            >
              <QrCode size={14} />
              <span>Quét QR Đơn</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Feedback Banner */}
      {dispatchFeedback && (
        <div
          className={`mt-4 p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 ${
            dispatchFeedback.isError
              ? 'bg-rose-50 border border-rose-200 text-rose-800'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            <span className="material-symbols-outlined text-[18px]">
              {dispatchFeedback.isError ? 'error' : 'check_circle'}
            </span>
            <span>{dispatchFeedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setDispatchFeedback(null)}
            className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Alert */}
      {checkInError && (
        <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle size={18} className="text-rose-600 shrink-0" />
            <span>{checkInError}</span>
          </div>
          <button
            type="button"
            onClick={() => setCheckInError(null)}
            className="text-rose-500 hover:text-rose-700 font-bold text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Four-Step Workflow Navigation Header */}
      <div className="mt-6 flex border-b border-slate-200 overflow-x-auto">
        <button
          type="button"
          onClick={() => handleSelectTab('verify')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'verify'
              ? 'border-cyan-600 text-cyan-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] ${
            isIdMet ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
          }`}>
            1
          </span>
          <span>1. Xác Thực Khách Hàng</span>
          {isIdMet && <CheckCircle2 size={14} className="text-emerald-600" />}
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('assign')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'assign'
              ? 'border-cyan-600 text-cyan-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] ${
            isUnitAssigned ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
          }`}>
            2
          </span>
          <span>2. Gán Kho Vật Lý</span>
          {isUnitAssigned && <CheckCircle2 size={14} className="text-emerald-600" />}
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('contract_payment')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'contract_payment'
              ? 'border-cyan-600 text-cyan-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] ${
            isContractAndPaymentSatisfied ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
          }`}>
            3
          </span>
          <span>3. Hợp Đồng &amp; Thanh Toán</span>
          {isContractAndPaymentSatisfied && <CheckCircle2 size={14} className="text-emerald-600" />}
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('pin')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'pin'
              ? 'border-cyan-600 text-cyan-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] ${
            currentSession.isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
          }`}>
            4
          </span>
          <span>4. Cấp PIN &amp; Bàn Giao</span>
          {currentSession.isCompleted && <CheckCircle2 size={14} className="text-emerald-600" />}
        </button>
      </div>

      {/* =========================================================================
          STEP 1 CONTENT: XÁC THỰC KHÁCH HÀNG (CUSTOMER VERIFICATION)
         ========================================================================= */}
      {activeTab === 'verify' && (
        <div className="mt-6 space-y-6">
          <div className="p-4 rounded-xl bg-sky-50/80 border border-sky-200 text-xs text-sky-950 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <ShieldCheck size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm text-sky-900">
                Bước 1: Xác Thực Khách Hàng (Customer Verification)
              </h3>
              <p className="mt-0.5 text-sky-800 leading-relaxed">
                Khách hàng đến cơ sở để làm thủ tục nhận kho. Nhân viên đối chiếu thông tin cá nhân và số CCCD/Hộ chiếu thực tế với dữ liệu đăng ký trong đơn trước khi tiếp tục.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Thông Tin Khách Hàng &amp; Đơn Đặt Kho
              </span>
              <span className="font-mono text-xs font-bold text-cyan-700 bg-cyan-50 px-2.5 py-0.5 rounded-full border border-cyan-100">
                #{bookingDisplayCode}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Họ &amp; Tên Khách Hàng</span>
                <span className="font-bold text-slate-900 text-sm block mt-0.5">{customerDisplayName}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Số Điện Thoại</span>
                <span className="font-mono font-bold text-slate-800 block mt-0.5">{customerDisplayPhone}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Email Nhận Mã PIN</span>
                <span className="font-mono text-slate-800 block mt-0.5 truncate">{customerDisplayEmail || 'Chưa cập nhật'}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Cơ Sở Lưu Trữ</span>
                <span className="font-bold text-slate-800 block mt-0.5">{facilityDisplayName}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Gói &amp; Diện Tích Đặt</span>
                <span className="font-bold text-slate-800 block mt-0.5">
                  {unitTypeName} • {unitArea}m²
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Thời Hạn Hợp Đồng</span>
                <span className="font-bold text-slate-800 block mt-0.5">
                  {currentBooking?.startDate || '---'} đến {currentBooking?.endDate || '---'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl border flex items-center justify-between gap-2 bg-slate-50 border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Trạng Thái Thanh Toán</span>
                  <span className="font-bold text-xs text-slate-800">
                    {isDepositMet && isRentMet ? 'ĐÃ THANH TOÁN TRỰC TUYẾN (PAID)' : 'CHỜ THANH TOÁN TẠI CƠ SỞ (PENDING_PAYMENT)'}
                  </span>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                  isDepositMet && isRentMet
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  {isDepositMet && isRentMet ? '✓ Đã Thanh Toán' : '⏳ Chưa Thu Đủ'}
                </span>
              </div>

              <div className="p-3 rounded-xl border flex items-center justify-between gap-2 bg-slate-50 border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Trạng Thái Hợp Đồng</span>
                  <span className="font-bold text-xs text-slate-800">
                    {isContractMet ? 'ĐÃ KÝ ĐIỆN TỬ TRỰC TUYẾN' : 'CHƯA KÝ / KÝ TẠI CƠ SỞ'}
                  </span>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                  isContractMet
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  {isContractMet ? '✓ Đã Ký' : '⏳ Chờ Ký'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-blue-600">badge</span>
                <span className="font-bold text-slate-900 text-sm">
                  Đối Soát CCCD / Hộ Chiếu Gốc
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                isIdMet ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {isIdMet ? '✓ ĐÃ ĐỐI SOÁT' : 'CHƯA ĐỐI SOÁT'}
              </span>
            </div>

            {customerCccd && (
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-blue-900 font-medium">
                  <span className="material-symbols-outlined text-[18px] text-blue-600">info</span>
                  <span>
                    CCCD đăng ký trong đơn: <strong className="font-mono font-bold text-blue-950">{customerCccd}</strong>
                  </span>
                </div>
                {idCardInputNumber !== customerCccd && (
                  <button
                    type="button"
                    onClick={() => setIdCardInputNumber(customerCccd)}
                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] cursor-pointer transition flex items-center gap-1 self-start sm:self-auto"
                  >
                    <span>💡 Gợi ý: Điền nhanh số này</span>
                  </button>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Loại giấy tờ</label>
                  <select
                    value={idCardType}
                    onChange={(e) => setIdCardType(e.target.value)}
                    disabled={isIdMet}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold text-xs focus:outline-none focus:border-cyan-600 focus:bg-white"
                  >
                    <option value="CCCD">Căn Cước Công Dân (CCCD)</option>
                    <option value="PASSPORT">Hộ Chiếu (Passport)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Số CCCD / Hộ chiếu thực tế của khách <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={idCardInputNumber}
                    onChange={(e) => setIdCardInputNumber(e.target.value)}
                    disabled={isIdMet}
                    placeholder="Nhập 9-12 chữ số trên thẻ CCCD gốc..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 font-bold text-xs focus:outline-none focus:border-cyan-600 focus:bg-white"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer select-none text-xs text-slate-800 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200">
                <input
                  type="checkbox"
                  checked={idOriginalSeen}
                  onChange={(e) => setIdOriginalSeen(e.target.checked)}
                  disabled={isIdMet}
                  className="mt-0.5 rounded text-cyan-600 focus:ring-cyan-500"
                />
                <span className="font-semibold leading-relaxed">
                  Tôi xác nhận đã xem và đối chiếu thẻ căn cước / hộ chiếu gốc của khách hàng tại quầy giao dịch.
                </span>
              </label>

              {!isIdMet ? (
                <button
                  type="button"
                  onClick={handleVerifyIdentity}
                  disabled={isVerifyingIdentity || !idCardInputNumber.trim() || !idOriginalSeen}
                  className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <ShieldCheck size={16} />
                  <span>{isVerifyingIdentity ? 'Đang đối soát danh tính...' : 'Xác Nhận Đúng CCCD'}</span>
                </button>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span>✓ Đã xác thực danh tính khách hàng thành công ({idCardInputNumber})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateCurrentSession({ identityVerified: false })}
                    className="text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
                  >
                    Đối chiếu lại
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => handleSelectTab('assign')}
              disabled={!isIdMet}
              className="py-2.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <span>Chuyển sang Bước 2: Gán kho vật lý</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 2 CONTENT: GÁN KHO VẬT LÝ (UNIT ASSIGNMENT)
         ========================================================================= */}
      {activeTab === 'assign' && (
        <div className="mt-6 space-y-6">
          <div className="p-4 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-950 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Box size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm text-indigo-900">
                Bước 2: Chọn Vị Trí Kho &amp; Gán Mã Kho (Unit Selection &amp; Assignment)
              </h3>
              <p className="mt-0.5 text-indigo-800 leading-relaxed">
                Nhân viên kiểm tra danh sách các ô kho còn trống tại cơ sở <strong>{facilityDisplayName}</strong>, dẫn khách xem các ô kho vật lý phù hợp với gói <strong>{bookedUnitTypeName || 'đã đặt'}</strong> và thực hiện gán kho.
              </p>
            </div>
          </div>

          {isUnitAssigned && !isChangingAssignedUnit ? (
            <div className="p-6 rounded-2xl bg-emerald-50/70 border border-emerald-300 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0 font-bold font-mono text-lg">
                    <Key size={22} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-emerald-800 tracking-wider block">
                      ✓ ĐÃ GÁN Ô KHO VẬT LÝ
                    </span>
                    <h3 className="text-xl font-extrabold font-mono text-emerald-950 mt-0.5">
                      #{unitDisplayCode}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsChangingAssignedUnit(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
                >
                  <RefreshCw size={13} />
                  <span>Đổi ô kho khác</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Cơ Sở</span>
                  <span className="font-bold text-emerald-950 block mt-0.5">{facilityDisplayName}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Loại Kho</span>
                  <span className="font-bold text-emerald-950 block mt-0.5">{unitTypeName}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Diện Tích</span>
                  <span className="font-bold text-emerald-950 block mt-0.5">{unitArea}m²</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Trạng Thái Kho</span>
                  <span className="font-bold text-emerald-950 block mt-0.5">Sẵn sàng bàn giao</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Filter size={16} className="text-blue-600" />
                    <span>Chọn Ô Kho Vật Lý Khả Dụng ({bookedUnitTypeName || 'Đã đặt'})</span>
                  </h3>
                  <span className="text-xs text-slate-500 mt-0.5 block">
                    Đang tìm kho trống tại <strong>{facilityDisplayName}</strong> • Khách đặt gói <strong>{bookedUnitTypeName} ({unitArea}m²)</strong>
                  </span>
                </div>

                {isChangingAssignedUnit && (
                  <button
                    type="button"
                    onClick={() => setIsChangingAssignedUnit(false)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer self-start sm:self-auto"
                  >
                    Hủy đổi kho
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-600 text-[11px]">Tầng:</span>
                    <select
                      value={assignFloorFilter}
                      onChange={(e) => setAssignFloorFilter(e.target.value)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white font-medium text-xs focus:outline-none"
                    >
                      <option value="ALL">Tất cả tầng</option>
                      <option value="Floor 1">Tầng 1</option>
                      <option value="Floor 2">Tầng 2</option>
                      <option value="Floor 3">Tầng 3</option>
                      <option value="Basement">Tầng hầm</option>
                    </select>
                  </div>

                  <input
                    type="text"
                    value={assignSearchTerm}
                    onChange={(e) => setAssignSearchTerm(e.target.value)}
                    placeholder="Tìm mã kho (vd: A-101)..."
                    className="p-1.5 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setAssignShowAllSizes((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                    assignShowAllSizes
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Layers size={13} />
                  <span>{assignShowAllSizes ? 'Đang xem tất cả ô trống' : 'Chỉ xem đúng loại đã đặt'}</span>
                </button>
              </div>

              {loadingAvailableUnits ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="inline-block animate-spin mr-2">⟳</span>
                  Đang tải danh sách ô kho trống tại cơ sở...
                </div>
              ) : filteredAvailableUnits.length === 0 ? (
                <div className="p-6 text-center text-xs bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                  <div className="flex items-center justify-center gap-1.5 text-amber-800 font-bold">
                    <AlertCircle size={16} />
                    <span>Hiện không tìm thấy ô kho nào phù hợp với bộ lọc tại cơ sở này.</span>
                  </div>
                  <p className="text-amber-700">
                    Thử chuyển sang chế độ "Xem tất cả ô trống" hoặc liên hệ quản lý cơ sở để bố trí buồng kho.
                  </p>
                  {!assignShowAllSizes && (
                    <button
                      type="button"
                      onClick={() => setAssignShowAllSizes(true)}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                    >
                      <Layers size={13} />
                      <span>Xem tất cả ({availableUnits.length} ô kho trống)</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-72 overflow-y-auto p-1">
                    {filteredAvailableUnits.map((u) => {
                      const isSelected = selectedAssignUnitId === u.id
                      const isMatchBooked = isUnitMatchingBookedSize(u, bookedUnitTypeId, bookedUnitTypeName)

                      return (
                        <div
                          key={u.id}
                          onClick={() => setSelectedAssignUnitId(u.id)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-400/40'
                              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-mono font-extrabold text-sm tracking-wide">
                                {u.unitCode}
                              </span>
                              {isMatchBooked && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                  isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  Đúng Chuẩn
                                </span>
                              )}
                            </div>
                            <span className={`text-[11px] block truncate font-medium ${
                              isSelected ? 'text-blue-100' : 'text-slate-500'
                            }`}>
                              {u.floorLevel || 'Tầng 1'} • {u.unitTypeName || 'Tiêu chuẩn'}
                            </span>
                            <span className={`text-[11px] block font-mono mt-0.5 ${
                              isSelected ? 'text-white' : 'text-slate-700'
                            }`}>
                              {u.areaSqMeters || '---'}m²
                            </span>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-current/10 flex items-center justify-between text-[11px]">
                            <span className="font-bold">
                              {u.pricePerMonth ? `${u.pricePerMonth.toLocaleString('vi-VN')}đ` : 'N/A'}
                            </span>
                            <span className={`text-[10px] uppercase font-bold ${
                              isSelected ? 'text-blue-100' : 'text-emerald-700'
                            }`}>
                              Trống
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
                    <span className="text-xs text-slate-500">
                      {selectedAssignUnitId ? (
                        <>
                          Đã chọn ô:{' '}
                          <strong className="text-slate-900 font-mono">
                            {availableUnits.find((u) => u.id === selectedAssignUnitId)?.unitCode}
                          </strong>
                        </>
                      ) : (
                        'Vui lòng nhấp chọn 1 ô kho ở danh sách trên để gán.'
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleConfirmUnitAssignment()}
                      disabled={!selectedAssignUnitId || isAssigningPhysicalUnit}
                      className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer self-start sm:self-auto"
                    >
                      <Check size={16} />
                      <span>{isAssigningPhysicalUnit ? 'Đang gán ô kho...' : 'Xác Nhận Gán Kho Này'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => handleSelectTab('verify')}
              className="py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={15} />
              <span>Quay lại Bước 1</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab('contract_payment')}
              disabled={!isUnitAssigned}
              className="py-2.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <span>Chuyển sang Bước 3: Hợp đồng &amp; Thanh toán</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 3 CONTENT: HỢP ĐỒNG & THANH TOÁN (CONTRACT & PAYMENT)
         ========================================================================= */}
      {activeTab === 'contract_payment' && (
        <div className="mt-6 space-y-6">
          <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <FileText size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm text-emerald-900">
                Bước 3: Ký Hợp Đồng &amp; Hoàn Tất Thanh Toán (Contract &amp; Payment)
              </h3>
              <p className="mt-0.5 text-emerald-800 leading-relaxed">
                Kiểm tra hợp đồng thuê kho và các khoản thanh toán (Tiền cọc + Tiền thuê tháng đầu). Với trường hợp chưa ký hoặc chọn thanh toán tại cơ sở, nhân viên tải lên ảnh thanh toán và bản scan hợp đồng đã ký.
              </p>
            </div>
          </div>

          {/* TRƯỜNG HỢP 1: ĐÃ KÝ & THANH TOÁN TRỰC TUYẾN ĐỦ */}
          {isContractMet && isDepositMet && isRentMet ? (
            <div className="p-6 rounded-2xl bg-white border border-emerald-300 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <CheckCircle2 size={20} className="text-emerald-600" />
                <span>Khách hàng đã hoàn thành ký hợp đồng và thanh toán trực tuyến đầy đủ!</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-950">1. Hợp Đồng Thuê Kho</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-900">
                      ✓ ĐÃ KÝ ĐIỆN TỬ
                    </span>
                  </div>
                  <p className="text-slate-600 font-mono text-[11px]">
                    Mã HĐ: {currentPrerequisites?.contractCode || `CTR-${bookingDisplayCode}`}
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    Phương thức: Ký số điện tử trực tuyến (DocuSeal / OTP SMS)
                  </p>
                  <button
                    type="button"
                    onClick={handleViewContractDocument}
                    className="mt-1 px-3 py-1.5 rounded-lg bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Eye size={14} />
                    <span>Xem Hợp Đồng</span>
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-950">2. Tiền Cọc &amp; Tiền Thuê</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-900">
                      ✓ ĐÃ ĐỦ TIỀN
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Tiền cọc bảo đảm:</span>
                    <span className="font-mono font-bold text-emerald-900">
                      {(currentPrerequisites?.depositPaid || 0).toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Tiền thuê tháng đầu:</span>
                    <span className="font-mono font-bold text-emerald-900">
                      {(currentPrerequisites?.firstMonthRentPaid || 0).toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                  <div className="pt-1 border-t border-emerald-200 flex items-center justify-between font-bold text-emerald-950">
                    <span>Còn thiếu:</span>
                    <span className="font-mono">0đ</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-emerald-100/50 rounded-xl text-emerald-900 text-xs flex items-center gap-2">
                <Check size={16} className="text-emerald-700 shrink-0" />
                <span>Không cần bổ sung chứng từ giấy tại cơ sở. Có thể tiến hành cấp mã PIN và bàn giao ngay.</span>
              </div>
            </div>
          ) : (
            /* TRƯỜNG HỢP 2: CHƯA KÝ HOẶC CHƯA THANH TOÁN -> HIỂN THỊ 2 PHẦN UPLOAD */
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Tiền Cọc Cần Thu:</span>
                  <span className="font-mono font-bold text-amber-950 text-sm">
                    {(currentPrerequisites?.depositRemaining || 0).toLocaleString('vi-VN')}đ
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Tiền Thuê Tháng Đầu Cần Thu:</span>
                  <span className="font-mono font-bold text-amber-950 text-sm">
                    {(currentPrerequisites?.firstMonthRentRemaining || 0).toLocaleString('vi-VN')}đ
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Tổng Tiền Thu Tại Cơ Sở:</span>
                  <span className="font-mono font-extrabold text-rose-700 text-sm">
                    {((currentPrerequisites?.depositRemaining || 0) + (currentPrerequisites?.firstMonthRentRemaining || 0)).toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>

              {/* PHẦN 1: UPLOAD ẢNH THANH TOÁN THÀNH CÔNG */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <Upload size={16} className="text-cyan-600" />
                      <span>Phần 1: Upload Ảnh Thanh Toán Thành Công</span>
                    </h3>
                    <span className="text-xs text-slate-500 mt-0.5 block">
                      Tải lên chứng từ chuyển khoản ngân hàng hoặc phiếu thu tiền mặt tại cơ sở.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateCounterVNPayLink}
                    disabled={isCreatingVNPayLink}
                    className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
                  >
                    <Smartphone size={14} />
                    <span>{isCreatingVNPayLink ? 'Đang tạo link VNPay...' : 'Tạo link VNPay cho khách'}</span>
                  </button>
                </div>

                <input
                  type="file"
                  ref={paymentProofInputRef}
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handlePaymentProofUpload}
                />

                {isUploadingPaymentProof ? (
                  <div className="p-6 rounded-xl border border-cyan-200 bg-cyan-50/50 flex items-center justify-center gap-2 text-cyan-800 text-xs">
                    <RefreshCw size={16} className="animate-spin" />
                    <span className="font-bold">Đang tải và xác thực chứng từ thanh toán...</span>
                  </div>
                ) : currentSession.paymentProofUrl ? (
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-800 block">✓ ĐÃ LƯU CHỨNG TỪ THANH TOÁN</span>
                        <span className="font-bold text-xs text-emerald-950 block">
                          {currentSession.paymentProofName || 'Chung-tu-thanh-toan.jpg'}
                        </span>
                        <span className="font-mono text-[10px] text-emerald-700 truncate block">
                          {currentSession.paymentProofUrl}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => paymentProofInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
                      >
                        Đổi ảnh khác
                      </button>
                      <button
                        type="button"
                        onClick={() => updateCurrentSession({ paymentProofUrl: undefined, paymentProofName: undefined })}
                        className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs cursor-pointer"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => paymentProofInputRef.current?.click()}
                    className="w-full p-6 rounded-xl border-2 border-dashed border-slate-200 hover:border-cyan-500 bg-slate-50 hover:bg-cyan-50/30 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Upload size={24} className="text-cyan-700" />
                    <span className="font-bold text-xs text-slate-800">
                      Bấm để chọn ảnh chứng từ chuyển khoản / biên nhận thu tiền
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Chấp nhận file ảnh JPG, PNG, WEBP hoặc tài liệu PDF (tối đa 10MB)
                    </span>
                  </button>
                )}
              </div>

              {/* PHẦN 2: UPLOAD ẢNH / SCAN HỢP ĐỒNG */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <FileText size={16} className="text-cyan-600" />
                      <span>Phần 2: Upload Ảnh / Scan Hợp Đồng Ký Tại Cơ Sở</span>
                    </h3>
                    <span className="text-xs text-slate-500 mt-0.5 block">
                      Tải lên bản chụp hoặc scan hợp đồng giấy đã có chữ ký của hai bên.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (currentPrerequisites?.contractCode) {
                        setShowPdfModal(true)
                      } else {
                        setCheckInError('Chưa có mã hợp đồng để mở phiên ký tại quầy.')
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
                  >
                    <FileText size={14} />
                    <span>In Hợp Đồng Cho Khách Ký</span>
                  </button>
                </div>

                <input
                  type="file"
                  ref={paperContractScanInputRef}
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handlePaperContractScanUpload}
                />

                {isUploadingPaperContractScan ? (
                  <div className="p-6 rounded-xl border border-cyan-200 bg-cyan-50/50 flex items-center justify-center gap-2 text-cyan-800 text-xs">
                    <RefreshCw size={16} className="animate-spin" />
                    <span className="font-bold">Đang tải và lưu bản scan hợp đồng...</span>
                  </div>
                ) : currentSession.paperContractUrl ? (
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-800 block">✓ ĐÃ LƯU BẢN SCAN HỢP ĐỒNG GIẤY</span>
                        <span className="font-bold text-xs text-emerald-950 block">
                          {currentSession.paperContractName || 'Hop-dong-giay-da-ky.pdf'}
                        </span>
                        <span className="font-mono text-[10px] text-emerald-700 truncate block">
                          {currentSession.paperContractUrl}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => paperContractScanInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
                      >
                        Đổi file khác
                      </button>
                      <button
                        type="button"
                        onClick={() => updateCurrentSession({ paperContractUrl: undefined, paperContractName: undefined })}
                        className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs cursor-pointer"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => paperContractScanInputRef.current?.click()}
                    className="w-full p-6 rounded-xl border-2 border-dashed border-slate-200 hover:border-cyan-500 bg-slate-50 hover:bg-cyan-50/30 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Upload size={24} className="text-cyan-700" />
                    <span className="font-bold text-xs text-slate-800">
                      Bấm để tải ảnh chụp hoặc file scan hợp đồng giấy đã ký
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Chấp nhận file ảnh JPG, PNG, WEBP hoặc tài liệu PDF (tối đa 10MB)
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => handleSelectTab('assign')}
              className="py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={15} />
              <span>Quay lại Bước 2</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab('pin')}
              disabled={!isContractAndPaymentSatisfied}
              className="py-2.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <span>Chuyển sang Bước 4: Cấp PIN &amp; Bàn giao</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 4 CONTENT: CẤP MÃ PIN & BÀN GIAO (PIN ACTIVATION & COMPLETION)
         ========================================================================= */}
      {activeTab === 'pin' && (
        <div className="mt-6 space-y-6">
          <div className="p-4 rounded-xl bg-purple-50/80 border border-purple-200 text-xs text-purple-950 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Key size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm text-purple-900">
                Bước 4: Kích Hoạt Mã PIN &amp; Hoàn Tất Bàn Giao
              </h3>
              <p className="mt-0.5 text-purple-800 leading-relaxed">
                Kiểm tra ca hẹn check-in hợp lệ, sinh mã PIN bảo mật 6 số cho khóa thông minh SmartLock, đồng thời tự động gửi email và thông báo trong hệ thống cho khách hàng.
              </p>
            </div>
          </div>

          {/* Quy Tắc Nghiệp Vụ Thời Điểm Check-In (Ca Hẹn) */}
          {(() => {
            const checkInStatus = currentPrerequisites?.checkInTimeStatus || 'ON_TIME'
            const checkInMet = currentPrerequisites?.checkInTimeMet ?? true
            const checkInMsg = currentPrerequisites?.checkInTimeMessage || 'Đã đến thời điểm hợp lệ để nhận kho'
            const expDateStr = currentPrerequisites?.expectedCheckInAt || currentBooking?.expectedCheckInAt || currentBooking?.startDate

            let statusBadgeLabel = 'Đã đến giờ check-in'
            let actionAdvice = 'Kiểm tra các điều kiện bàn giao và thực hiện cấp mã PIN'
            let cardClass = 'bg-emerald-50 border-emerald-300 text-emerald-950'
            let iconName = 'verified'
            let iconColor = 'text-emerald-600'

            if (checkInStatus === 'BEFORE_DATE' || checkInStatus === 'BEFORE_TIME') {
              statusBadgeLabel = checkInStatus === 'BEFORE_DATE' ? 'Chưa đến ngày check-in' : 'Chưa đến giờ check-in'
              actionAdvice = 'Nên theo quy trình tiếp nhận đúng lịch. Tuy nhiên, nếu cơ sở có đủ điều kiện phục vụ và khách cần nhận kho gấp thì nhân viên được phân quyền có thể xác nhận tiếp nhận sớm.'
              cardClass = 'bg-amber-50 border-amber-300 text-amber-950'
              iconName = checkInStatus === 'BEFORE_DATE' ? 'event_upcoming' : 'hourglass_top'
              iconColor = 'text-amber-600'
            } else if (checkInStatus === 'LATE') {
              statusBadgeLabel = 'Khách đến muộn'
              actionAdvice = 'Cho bàn giao nếu hợp đồng, lịch hẹn và các điều kiện khác vẫn hợp lệ'
              cardClass = 'bg-sky-50 border-sky-300 text-sky-950'
              iconName = 'history_toggle_off'
              iconColor = 'text-sky-600'
            }

            return (
              <div className={`p-4 rounded-xl border text-xs shadow-xs space-y-2 ${cardClass}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-white/80 shadow-2xs ${iconColor}`}>
                      <span className="material-symbols-outlined text-[24px]">{iconName}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs">
                          Lịch Hẹn Check-in Nhận Kho: {expDateStr ? new Date(expDateStr).toLocaleString('vi-VN') : 'Theo ngày hợp đồng'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          checkInMet || isEarlyCheckInConfirmed ? 'bg-emerald-200 text-emerald-950' : 'bg-rose-200 text-rose-950'
                        }`}>
                          {checkInMet || isEarlyCheckInConfirmed ? 'Có thể bàn giao' : 'Không cho phép bàn giao'}
                        </span>
                      </div>
                      <p className="mt-1 font-medium text-[11px] leading-relaxed">
                        {checkInMsg}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold">
                        <span className="opacity-75">Quy tắc xử lý:</span>
                        <span className="underline decoration-dotted">{actionAdvice}</span>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="inline-block px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-white/90 border border-current shadow-2xs">
                      {statusBadgeLabel}
                    </span>
                  </div>
                </div>

                {(!checkInMet && !isEarlyCheckInConfirmed) && (
                  <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between">
                    <span className="text-[11px] text-amber-900 font-medium">
                      Cần xác nhận thẩm quyền của nhân viên nếu khách có mặt sớm hơn ca hẹn.
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowEarlyCheckInModal(true)}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                    >
                      Xác Nhận Tiếp Nhận Sớm
                    </button>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Handover Summary Overview Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-2">
              Hồ Sơ Bàn Giao Sẵn Sàng
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Khách Hàng</span>
                <span className="font-bold text-slate-900 block mt-0.5">{customerDisplayName}</span>
                <span className="text-[11px] font-mono text-slate-500 block">{customerDisplayPhone}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">CCCD Đã Xác Thực</span>
                <span className="font-bold text-slate-900 font-mono block mt-0.5">{customerCccd || 'Đã đối soát'}</span>
                <span className="text-[11px] text-emerald-700 block font-semibold">✓ Đã xác minh</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Ô Kho Vật Lý</span>
                <span className="font-bold text-blue-900 font-mono text-sm block mt-0.5">#{unitDisplayCode}</span>
                <span className="text-[11px] text-slate-500 block">{unitTypeName}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Cơ Sở Lưu Trữ</span>
                <span className="font-bold text-slate-900 block mt-0.5">{facilityDisplayName}</span>
                <span className="text-[11px] text-slate-500 block">Hợp đồng: {currentPrerequisites?.contractCode || 'Hợp lệ'}</span>
              </div>
            </div>
          </div>

          {currentSession.isCompleted ? (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border-2 border-emerald-400 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
                    <CheckCircle2 size={26} />
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase text-emerald-800 tracking-wider block">
                      ✓ ĐÃ BÀN GIAO KHO THÀNH CÔNG
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                      Khách hàng: {customerDisplayName} • Ô kho #{unitDisplayCode}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPdfModal(true)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer self-start sm:self-auto"
                >
                  <Printer size={15} />
                  <span>In Phiếu Bàn Giao</span>
                </button>
              </div>

              <div className="p-5 bg-white rounded-2xl border border-emerald-200 text-center space-y-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Mã PIN Mở Khóa SmartLock IoT
                </span>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-3xl font-extrabold tracking-widest text-slate-900 bg-slate-100 px-6 py-2.5 rounded-2xl border border-slate-200">
                    {currentSession.accessPin || '------'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPin}
                    className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                    title="Sao chép mã PIN"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {pinCopied ? 'done' : 'content_copy'}
                    </span>
                  </button>
                </div>
                {pinCopied && (
                  <span className="text-xs text-emerald-700 font-bold block">✓ Đã sao chép mã PIN vào bộ nhớ tạm!</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white rounded-xl border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-emerald-600" />
                    <div>
                      <span className="font-bold text-slate-900 block">Email Mã PIN Cho Khách</span>
                      <span className="text-[11px] text-slate-500 font-mono truncate block max-w-[180px]">
                        {customerDisplayEmail || 'Đã gửi'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendEmail}
                    disabled={isSendingEmail}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-200 cursor-pointer"
                  >
                    {isSendingEmail ? 'Đang gửi...' : 'Gửi lại'}
                  </button>
                </div>

                <div className="p-3 bg-white rounded-xl border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Send size={16} className="text-emerald-600" />
                    <div>
                      <span className="font-bold text-slate-900 block">Thông Báo Trên Hệ Thống</span>
                      <span className="text-[11px] text-slate-500 block">Tài khoản khách hàng</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendWebPush}
                    disabled={isSendingWebPush}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-200 cursor-pointer"
                  >
                    {isSendingWebPush ? 'Đang bắn...' : 'Bắn lại'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm">
                <Lock size={18} className="text-cyan-600" />
                <span>Kích Hoạt Khóa &amp; Bàn Giao Buồng Kho</span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Hệ thống sẽ cấp một mã PIN 6 số duy nhất gửi đến email và tài khoản của khách hàng, đồng thời đổi trạng thái đơn đặt và buồng kho <strong>#{unitDisplayCode}</strong> sang <strong>ĐANG HOẠT ĐỘNG (ACTIVE)</strong>.
              </p>

              <button
                type="button"
                onClick={handleCompleteHandover}
                disabled={isSubmitting || (!isCheckInTimeMet && !isEarlyCheckInConfirmed)}
                className="w-full py-3 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition cursor-pointer"
              >
                <Key size={18} />
                <span>{isSubmitting ? 'Đang kích hoạt mã PIN & hoàn tất...' : 'Kích Hoạt Mã PIN & Hoàn Tất Bàn Giao'}</span>
              </button>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => handleSelectTab('contract_payment')}
              className="py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={15} />
              <span>Quay lại Bước 3</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          HELPER MODALS
         ========================================================================= */}

      {/* Modal: In Biên Bản Bàn Giao (PDF Preview) */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto text-slate-900">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-700 text-[26px]">contract</span>
                <div>
                  <h3 className="font-headline text-base font-bold text-slate-900">
                    BIÊN BẢN NGHIỆM THU &amp; BÀN GIAO PHÒNG KHO TỰ QUẢN
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Mã biên bản: #BB-BG-{bookingDisplayCode} • Hệ thống Boxora
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="my-5 flex flex-col gap-4 text-xs">
              <div className="text-center pb-2 border-b border-dashed border-slate-200">
                <span className="font-bold uppercase text-slate-700 block">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</span>
                <span className="text-slate-500 block text-[10px]">Độc lập - Tự do - Hạnh phúc</span>
                <span className="font-headline font-bold text-sm text-cyan-800 mt-2 block">
                  BIÊN BẢN BÀN GIAO MẶT BẰNG &amp; CẤP MÃ MỞ CỬA KHO
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">BÊN GIAO (BOXORA FACILITY)</span>
                  <span className="font-bold text-slate-900 block mt-0.5">{facilityDisplayName}</span>
                  <span className="text-slate-600 block">Bộ phận: Vận hành trực ca quầy tiếp đón</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">BÊN NHẬN (KHÁCH HÀNG)</span>
                  <span className="font-bold text-slate-900 block mt-0.5">{customerDisplayName}</span>
                  <span className="text-slate-600 block">CCCD: {currentPrerequisites?.identityVerified ? 'Đã đối chiếu giấy tờ gốc' : 'N/A'}</span>
                  <span className="text-slate-600 block">SĐT: {customerDisplayPhone}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-bold text-slate-900">1. Thông tin kho bàn giao:</span>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-3 gap-2 text-[11px] font-mono">
                  <div>Mã kho: <strong>#{unitDisplayCode}</strong></div>
                  <div>Cơ sở: <strong>{facilityDisplayName}</strong></div>
                  <div>Thời hạn: <strong>{currentBooking?.rentalMonths ?? 1} Tháng</strong></div>
                  <div>Mã PIN cấp: <strong className="text-cyan-700">{currentSession.accessPin}</strong></div>
                  <div>Thẻ từ RFID: <strong>{currentSession.rfidCard || 'N/A'}</strong></div>
                  <div>Mã đơn: <strong>{bookingDisplayCode}</strong></div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-bold text-slate-900">2. Kết quả kiểm định hiện trường (5/5 tiêu chí):</span>
                <ul className="list-disc list-inside text-slate-600 space-y-1 text-[11px] pl-1">
                  <li>Cửa cuốn và then chốt cơ khí hoạt động êm ái, khóa nhạy.</li>
                  <li>Không gian bên trong sạch sẽ, nền khô ráo, không mùi ẩm mốc.</li>
                  <li>Khóa điện tử SmartLock và bàn phím hoạt động chuẩn xác.</li>
                  <li>Đầu báo khói và đầu phun PCCC không bị che khuất.</li>
                  <li>Tường vách kho và tem niêm phong Boxora nguyên vẹn.</li>
                </ul>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-bold text-slate-900">3. Ghi chú tiếp nhận:</span>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded text-slate-700 text-[11px]">
                  {currentSession.handoverNotes || 'Đã đối soát thông tin và bàn giao kho tại cơ sở.'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 text-center pt-4">
                <div>
                  <span className="font-bold text-slate-900 block">ĐẠI DIỆN BÊN NHẬN</span>
                  <span className="text-slate-400 block text-[10px] italic mt-0.5">(Đã ký xác nhận nhận bàn giao)</span>
                  <div className="mt-6 font-headline font-bold text-slate-800">{customerDisplayName}</div>
                </div>
                <div>
                  <span className="font-bold text-slate-900 block">ĐẠI DIỆN BÊN GIAO</span>
                  <span className="text-slate-400 block text-[10px] italic mt-0.5">(Nhân viên phụ trách ca)</span>
                  <div className="mt-6 font-headline font-bold text-slate-800">Nhân viên trực ca Boxora</div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Tài liệu điện tử có giá trị pháp lý theo điều khoản hợp đồng thuê kho Boxora.
              </span>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                <span>In Biên Bản Ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Xác Nhận Tiếp Nhận Sớm Hơn Lịch Hẹn */}
      <EarlyCheckInConfirmModal
        isOpen={showEarlyCheckInModal}
        booking={currentBooking}
        actionType="ENTER_RECEPTION"
        onConfirm={() => {
          setIsEarlyCheckInConfirmed(true)
          setShowEarlyCheckInModal(false)
        }}
        onClose={() => setShowEarlyCheckInModal(false)}
      />

      {/* Modal: Xác Nhận Bàn Giao Thành Công & Cấp Mã PIN Giữa Màn Hình */}
      {handoverSuccessModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
          <div className="relative max-w-lg w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all flex flex-col text-left">
            <div className="h-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 w-full" />

            <div className="p-6 sm:p-7 flex flex-col">
              <button
                type="button"
                onClick={() => setHandoverSuccessModalData(null)}
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                title="Đóng cửa sổ"
              >
                ✕
              </button>

              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shadow-xs mb-3">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="font-extrabold text-lg sm:text-xl text-slate-900 tracking-tight">
                  Kích Hoạt Mã PIN &amp; Bàn Giao Thành Công!
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Đã bàn giao phòng kho #{handoverSuccessModalData.unitCode} cho khách hàng{' '}
                  <strong className="text-slate-800">{handoverSuccessModalData.customerName}</strong>.
                </p>
              </div>

              {/* Monospace PIN Blocks */}
              <div className="my-5 p-4 rounded-2xl bg-slate-900 text-white flex flex-col items-center justify-center shadow-inner relative overflow-hidden">
                <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase mb-2">
                  MÃ PIN SMARTLOCK MỞ CỬA KHO
                </span>
                <div className="flex items-center gap-2">
                  {(handoverSuccessModalData.pin || '------').split('').map((digit, idx) => (
                    <div
                      key={idx}
                      className="w-10 h-12 rounded-xl bg-slate-800 border border-slate-700 font-mono text-2xl font-black text-white flex items-center justify-center shadow-sm"
                    >
                      {digit}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(handoverSuccessModalData.pin)
                    setCopiedSuccessPin(true)
                    setTimeout(() => setCopiedSuccessPin(false), 2500)
                  }}
                  className="mt-3 text-[11px] font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {copiedSuccessPin ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedSuccessPin ? 'Đã sao chép vào bộ nhớ!' : 'Sao chép mã PIN'}</span>
                </button>
              </div>

              {/* Handover Details */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Phòng kho:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    #{handoverSuccessModalData.unitCode} ({handoverSuccessModalData.facilityName})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Khách nhận:</span>
                  <span className="font-bold text-slate-900">
                    {handoverSuccessModalData.customerName} • {handoverSuccessModalData.customerPhone}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-mono text-slate-800">{handoverSuccessModalData.customerEmail || 'Chưa cập nhật'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Mã đơn đặt:</span>
                  <span className="font-mono text-slate-700">{handoverSuccessModalData.bookingCode}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200/80 pt-2 text-[11px]">
                  <span className="text-slate-500">Thời điểm bàn giao:</span>
                  <span className="text-slate-700 font-mono">
                    {new Date(handoverSuccessModalData.completedAt).toLocaleString('vi-VN')}
                  </span>
                </div>
              </div>

              {/* Auto notifications status */}
              <div className="mt-3.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-900">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>Đã tự động gửi email và thông báo trong hệ thống kèm mã PIN cho khách hàng!</span>
              </div>

              {/* Buttons */}
              <div className="mt-5 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPdfModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer size={15} />
                  <span>In Phiếu Nhận Kho</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHandoverSuccessModalData(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <span>Hoàn Tất &amp; Đóng</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
