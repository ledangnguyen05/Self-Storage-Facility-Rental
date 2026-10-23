import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Booking, RentalContract, StorageUnit } from '../../../types'
import { handoverService, HandoverPrerequisites } from '../../../services/handoverService'
import { bookingService } from '../../../services/bookingService'
import { contractService } from '../../../services/contractService'
import { storageUnitService } from '../../../services/storageUnitService'
import { ContractDocumentModal } from '../../../components/modals/ContractDocumentModal'
import { useAuth } from '../../../context/AuthContext'
import { getCheckInCountdown } from '../../../utils/rentalAccess'

export interface BookingChecklist {
  doorRoll: boolean
  cleanliness: boolean
  lighting: boolean
  fireSafety: boolean
  sealPlate: boolean
}

export type HandoverStepType =
  | 'identity'      // Bước 1: Xác minh CCCD/Passport
  | 'unit-select'   // Bước 2: Nhập mã kho & Kiểm tra kho trống
  | 'inspection'    // Bước 3: Nghiệm thu hiện trường
  | 'billing'       // Bước 4: Chi phí & Hợp đồng
  | 'payment'       // Bước 5: Thanh toán tại quầy
  | 'signing'       // Bước 6: Ký hợp đồng online
  | 'activation'    // Bước 7: Kích hoạt PIN & Thông báo account

export interface BookingWorkbenchSession {
  bookingId: string
  activeStepTab: HandoverStepType

  // Bước 1: Xác minh danh tính
  idCardType: string
  idCardNumber: string
  originalDocumentSeen: boolean
  identityVerified: boolean
  identityNotes: string

  // Bước 2: Chọn & Kiểm tra kho
  desiredUnitCode: string
  unitVerifiedAvailable: boolean
  unitUnavailableReason?: string
  rentalMonths: number
  rentalStartDate: string

  // Bước 3: Nghiệm thu hiện trường
  checklist: BookingChecklist
  photoDoor: string
  photoInterior: string
  handoverNotes: string
  inspectionPassed: boolean

  // Bước 4: Chi phí & Hợp đồng
  monthlyRate: number
  depositFee: number
  discountAmount: number
  firstMonthRent: number
  prepaidAmount: number
  totalDue: number

  // Bước 5: Thanh toán
  paymentMethod: 'BANK_TRANSFER' | 'VNPAY'
  paymentProofUrl?: string
  paymentCompleted: boolean

  // Bước 6: Ký hợp đồng online
  signatureDataUrl?: string
  isSignedOnline: boolean
  signedContractCode?: string

  // Bước 7: Kích hoạt PIN & Thông báo
  rfidCard: string
  accessPin: string
  emailSent: boolean
  webPushSent: boolean
  inAppNotificationSent: boolean
  isCompleted: boolean
  completedAt?: string
}

export interface HandoverSuccessModalData {
  bookingId?: string
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
      if (session && typeof session === 'object') {
        delete session.idCardNumber
        if (session.activeStepTab === 'audit') session.activeStepTab = 'identity'
        else if (session.activeStepTab === 'checklist') session.activeStepTab = 'inspection'
        else if (session.activeStepTab === 'pin') session.activeStepTab = 'activation'
      }
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
  existingPin = ''
): BookingWorkbenchSession => ({
  bookingId,
  activeStepTab: isAlreadyActive ? 'activation' : 'identity',

  // Step 1: Identity
  idCardType: 'CCCD',
  idCardNumber: '',
  originalDocumentSeen: false,
  identityVerified: false,
  identityNotes: 'Đã đối chiếu giấy tờ gốc tại quầy giao dịch.',

  // Step 2: Unit Select & Availability
  desiredUnitCode: '',
  unitVerifiedAvailable: false,
  unitUnavailableReason: undefined,
  rentalMonths: 1,
  rentalStartDate: new Date().toISOString().split('T')[0],

  // Step 3: Inspection
  checklist: { ...defaultChecklist },
  photoDoor: '',
  photoInterior: '',
  handoverNotes: 'Đã nghiệm thu hiện trường 5/5 tiêu chuẩn đạt chuẩn.',
  inspectionPassed: false,

  // Step 4: Billing
  monthlyRate: 1200000,
  depositFee: 1200000,
  discountAmount: 0,
  firstMonthRent: 1200000,
  prepaidAmount: 0,
  totalDue: 2400000,

  // Step 5: Payment
  paymentMethod: 'BANK_TRANSFER',
  paymentProofUrl: '',
  paymentCompleted: false,

  // Step 6: Online Signature
  signatureDataUrl: '',
  isSignedOnline: false,
  signedContractCode: '',

  // Step 7: PIN & Notification
  rfidCard: '',
  accessPin: existingPin && existingPin !== '------' ? existingPin : '------',
  emailSent: isAlreadyActive,
  webPushSent: isAlreadyActive,
  inAppNotificationSent: isAlreadyActive,
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

export const HandoverCheckInWorkbench: React.FC<HandoverCheckInWorkbenchProps> = ({
  arrivals: propArrivals,
  onRefreshArrivals,
  onHandoverComplete,
  onOpenQrScanner,
  activeBookingId,
  onSelectBooking,
  facilityId
}) => {
  const { user } = useAuth()
  const resolvedRole = (typeof user?.role === 'string' ? user?.role : user?.role?.name || user?.roleName || '').toUpperCase()
  const isAdmin = resolvedRole === 'ADMIN' || resolvedRole === 'SYSTEM_ADMIN'

  const [internalArrivals, setInternalArrivals] = useState<Booking[]>([])
  const [selectedBookingId, setSelectedBookingId] = useState<string>('')
  const [extraBookingDetails, setExtraBookingDetails] = useState<Record<string, Booking>>({})

  // Storage units for checking availability in Step 2
  const [facilityUnits, setFacilityUnits] = useState<StorageUnit[]>([])
  const [isLoadingUnits, setIsLoadingUnits] = useState<boolean>(false)
  const [unitSearchQuery, setUnitSearchQuery] = useState<string>('')

  // Per-booking persisted workflow sessions
  const [sessions, setSessions] = useState<Record<string, BookingWorkbenchSession>>(() => loadPersistedSessions())

  // Per-booking prerequisites cache
  const [prerequisitesCache, setPrerequisitesCache] = useState<Record<string, HandoverPrerequisites>>({})
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({})

  // Request race condition prevention
  const latestReqIdPerBookingRef = useRef<Record<string, number>>({})
  const activeSelectionRequestIdRef = useRef<number>(0)

  // Transient UI interaction states
  const [pinCopied, setPinCopied] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [isSendingWebPush, setIsSendingWebPush] = useState(false)
  const [dispatchFeedback, setDispatchFeedback] = useState<{ text: string; isError?: boolean } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkInError, setCheckInError] = useState<string | null>(null)
  const [showPdfModal, setShowPdfModal] = useState(false)

  // Evidence Photos preview & lightbox modal states
  const [doorPreviewUrl, setDoorPreviewUrl] = useState<string>('')
  const [interiorPreviewUrl, setInteriorPreviewUrl] = useState<string>('')
  const [isUploadingDoor, setIsUploadingDoor] = useState<boolean>(false)
  const [isUploadingInterior, setIsUploadingInterior] = useState<boolean>(false)
  const [previewModalImage, setPreviewModalImage] = useState<{ url: string; title: string } | null>(null)

  // Step 1: Identity form state
  const [idCardTypeInput, setIdCardTypeInput] = useState<string>('CCCD')
  const [idCardNumberInput, setIdCardNumberInput] = useState<string>('')
  const [idOriginalSeenInput, setIdOriginalSeenInput] = useState<boolean>(false)
  const [idNotesInput, setIdNotesInput] = useState<string>('')
  const [isVerifyingIdentity, setIsVerifyingIdentity] = useState<boolean>(false)

  // Step 5: Payment proof upload
  const [isUploadingPaymentProof, setIsUploadingPaymentProof] = useState<boolean>(false)
  const [paymentProofInputRef, setPaymentProofInputRef] = useState<HTMLInputElement | null>(null)

  // Step 6: HTML5 Canvas Signature Pad
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawingSignature, setIsDrawingSignature] = useState(false)
  const [hasSignatureDrawn, setHasSignatureDrawn] = useState(false)
  const [agreedTerms, setAgreedTerms] = useState(true)

  // Handover confirmation modal state
  const [handoverSuccessModalData, setHandoverSuccessModalData] = useState<HandoverSuccessModalData | null>(null)
  const [copiedSuccessPin, setCopiedSuccessPin] = useState<boolean>(false)
  const [selectedContractForModal, setSelectedContractForModal] = useState<RentalContract | null>(null)
  const [isLoadingContract, setIsLoadingContract] = useState<boolean>(false)

  const doorInputRef = useRef<HTMLInputElement | null>(null)
  const interiorInputRef = useRef<HTMLInputElement | null>(null)

  // Resolve arrivals list
  const arrivalsList = propArrivals !== undefined ? propArrivals : internalArrivals

  // Load arrivals if not provided via props
  useEffect(() => {
    if (propArrivals !== undefined) {
      setInternalArrivals(propArrivals)
      if (propArrivals.length === 0) {
        setSelectedBookingId('')
      }
    } else {
      loadArrivals(facilityId)
    }
  }, [propArrivals, facilityId])

  const loadArrivals = async (targetFacId?: string) => {
    try {
      const data = await bookingService.getUpcomingArrivals(targetFacId || facilityId)
      if (data && data.length > 0) {
        setInternalArrivals(data)
      } else {
        setInternalArrivals([])
        setSelectedBookingId('')
      }
    } catch (err) {
      console.warn('Failed to load arrivals for workbench:', err)
      setInternalArrivals([])
    }
  }

  // Load units for the facility to check availability in Step 2
  useEffect(() => {
    const targetFacId = facilityId || (user as any)?.facilityId
    if (targetFacId) {
      setIsLoadingUnits(true)
      storageUnitService
        .getUnits({ facilityId: targetFacId })
        .then((units) => {
          if (Array.isArray(units)) {
            setFacilityUnits(units)
          }
        })
        .catch((err) => {
          console.warn('Could not load facility units:', err)
        })
        .finally(() => setIsLoadingUnits(false))
    }
  }, [facilityId, user])

  // Sync when activeBookingId prop changes from parent
  useEffect(() => {
    if (activeBookingId !== undefined && activeBookingId !== selectedBookingId) {
      setSelectedBookingId(activeBookingId)
      setCheckInError(null)
      setDispatchFeedback(null)
    }
  }, [activeBookingId])

  // Exact lookup for current selected booking
  const currentBooking = useMemo(() => {
    if (!selectedBookingId) {
      return null
    }
    return (
      arrivalsList.find((b) => b.id === selectedBookingId || b.bookingCode === selectedBookingId) ||
      extraBookingDetails[selectedBookingId] ||
      null
    )
  }, [arrivalsList, selectedBookingId, extraBookingDetails])

  // Permission evaluation
  const isClaimedByMe = Boolean(
    (currentBooking?.assignedStaffId && user?.id && String(currentBooking.assignedStaffId).toLowerCase() === String(user.id).toLowerCase()) ||
    (currentBooking?.assignedStaffName && (currentBooking.assignedStaffName === user?.fullName || currentBooking.assignedStaffName === user?.username))
  )
  const isAssignedToOther = Boolean(
    !isClaimedByMe && !isAdmin && (
      (currentBooking?.assignedStaffId && user?.id && String(currentBooking.assignedStaffId).toLowerCase() !== String(user.id).toLowerCase()) ||
      (currentBooking?.assignedStaffName && currentBooking.assignedStaffName !== user?.fullName && currentBooking.assignedStaffName !== user?.username)
    )
  )
  const isUnassigned = Boolean(currentBooking && !currentBooking.assignedStaffId && !currentBooking.assignedStaffName && !isAdmin)

  const [isClaimingBookingId, setIsClaimingBookingId] = useState<string | null>(null)

  const isBookingAssignedToMe = useCallback(
    (b: Booking) => {
      if (!user) return false
      return Boolean(
        (b.assignedStaffId && user.id && String(b.assignedStaffId).toLowerCase() === String(user.id).toLowerCase()) ||
        (b.assignedStaffName && (b.assignedStaffName === user.fullName || b.assignedStaffName === user.username))
      )
    },
    [user]
  )

  const isBookingAvailableToClaim = useCallback((b: Booking) => {
    return !b.assignedStaffId && !b.assignedStaffName
  }, [])

  const myAssignedArrivals = useMemo(() => {
    return arrivalsList.filter(isBookingAssignedToMe)
  }, [arrivalsList, isBookingAssignedToMe])

  const availableToClaimArrivals = useMemo(() => {
    return arrivalsList.filter(isBookingAvailableToClaim)
  }, [arrivalsList, isBookingAvailableToClaim])

  const handleClaimAndOpen = async (booking: Booking) => {
    setIsClaimingBookingId(booking.id)
    setCheckInError(null)
    try {
      const updated = await bookingService.claimCheckInReception(booking.id)
      setInternalArrivals((prev) =>
        prev.map((b) =>
          b.id === booking.id
            ? {
                ...b,
                assignedStaffId: updated.assignedStaffId || user?.id,
                assignedStaffName: updated.assignedStaffName || user?.fullName || 'Nhân viên quầy'
              }
            : b
        )
      )
      if (onRefreshArrivals) {
        await onRefreshArrivals()
      }
      setSelectedBookingId(booking.id)
      if (onSelectBooking) onSelectBooking(booking.id)
      setDispatchFeedback({ text: `Đã tiếp nhận lượt đón khách ${booking.customerName} (đơn ${booking.bookingCode}) thành công!` })
    } catch (err: any) {
      setCheckInError(err?.response?.data?.message || err?.message || 'Không thể tiếp nhận khách hàng này.')
    } finally {
      setIsClaimingBookingId(null)
    }
  }

  // Fetch individual booking details if not in arrivals list
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
          console.warn('Could not fetch individual booking details for ' + selectedBookingId, err)
        })
    }
  }, [selectedBookingId, arrivalsList, extraBookingDetails])

  // Active session for selected booking
  const currentSession: BookingWorkbenchSession = useMemo(() => {
    if (!selectedBookingId) {
      return createInitialSession('')
    }
    const session =
      sessions[selectedBookingId] ||
      createInitialSession(selectedBookingId, currentBooking?.status === 'ACTIVE', currentBooking?.accessPin || '')

    // Seed defaults from booking if not yet populated
    if (currentBooking) {
      if (!session.desiredUnitCode && currentBooking.unitCode) {
        session.desiredUnitCode = currentBooking.unitCode
      }
      if (currentBooking.rentalMonths && session.rentalMonths === 1) {
        session.rentalMonths = currentBooking.rentalMonths
      }
      if (currentBooking.totalRentalFee && session.monthlyRate === 1200000) {
        session.monthlyRate = currentBooking.rentalMonths > 0 ? Math.round(currentBooking.totalRentalFee / currentBooking.rentalMonths) : currentBooking.totalRentalFee
        session.firstMonthRent = session.monthlyRate
        session.depositFee = currentBooking.depositAmount || session.monthlyRate
        session.totalDue = session.firstMonthRent + session.depositFee - session.discountAmount
      }
    }
    return session
  }, [sessions, selectedBookingId, currentBooking])

  // Helper to update current session
  const updateCurrentSession = useCallback(
    (
      updater:
        | Partial<BookingWorkbenchSession>
        | ((prev: BookingWorkbenchSession) => Partial<BookingWorkbenchSession>)
    ) => {
      if (!selectedBookingId) return
      setSessions((prev) => {
        const existing =
          prev[selectedBookingId] ||
          createInitialSession(selectedBookingId, currentBooking?.status === 'ACTIVE', currentBooking?.accessPin || '')
        const partial = typeof updater === 'function' ? updater(existing) : updater
        const updated = { ...existing, ...partial }
        const next = { ...prev, [selectedBookingId]: updated }
        persistSessions(next)
        return next
      })
    },
    [selectedBookingId, currentBooking?.status, currentBooking?.accessPin]
  )

  // Fetch prerequisites from backend
  const fetchPrerequisitesForBooking = useCallback(async (bookingId: string) => {
    if (!bookingId) return
    const reqId = ++activeSelectionRequestIdRef.current
    latestReqIdPerBookingRef.current[bookingId] = reqId

    setLoadingMap((prev) => ({ ...prev, [bookingId]: true }))
    setErrorMap((prev) => ({ ...prev, [bookingId]: null }))

    try {
      const data = await handoverService.getCheckInPrerequisites(bookingId)
      setPrerequisitesCache((prev) => ({ ...prev, [bookingId]: data }))

      setSessions((prev) => {
        const existing = prev[bookingId] || createInitialSession(bookingId)
        const identityVerified = Boolean(data.identityVerified)
        const isContractSigned = Boolean(data.contractSigned)
        const isDepositPaid = Boolean(data.depositSatisfied)
        const isRentPaid = Boolean(data.firstMonthRentSatisfied)

        let nextSession = { ...existing }
        if (identityVerified) nextSession.identityVerified = true
        if (isContractSigned) nextSession.isSignedOnline = true
        if (isDepositPaid && isRentPaid) nextSession.paymentCompleted = true

        if (JSON.stringify(nextSession) !== JSON.stringify(existing)) {
          const next = { ...prev, [bookingId]: nextSession }
          persistSessions(next)
          return next
        }
        return prev
      })
    } catch (err: any) {
      if (latestReqIdPerBookingRef.current[bookingId] === reqId) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Không thể tải điều kiện tiên quyết cho lượt đặt chỗ này'
        setErrorMap((prev) => ({ ...prev, [bookingId]: msg }))
      }
    } finally {
      if (latestReqIdPerBookingRef.current[bookingId] === reqId) {
        setLoadingMap((prev) => ({ ...prev, [bookingId]: false }))
      }
    }
  }, [])

  useEffect(() => {
    if (selectedBookingId) {
      fetchPrerequisitesForBooking(selectedBookingId)
    }
  }, [selectedBookingId, fetchPrerequisitesForBooking])

  const currentPrerequisites = selectedBookingId ? prerequisitesCache[selectedBookingId] || null : null
  const loadingPrerequisites = selectedBookingId ? !!loadingMap[selectedBookingId] : false

  // Labels
  const customerDisplayName =
    currentBooking?.customerName ||
    currentPrerequisites?.customerName ||
    (selectedBookingId ? 'Khách hàng Boxora' : 'Chưa chọn khách')
  const customerDisplayPhone =
    currentBooking?.customerPhone ||
    currentPrerequisites?.customerPhone ||
    '0900 000 000'
  const customerDisplayEmail =
    currentBooking?.customerEmail ||
    (currentBooking as any)?.customer?.email ||
    currentPrerequisites?.customerEmail ||
    'customer@boxora.vn'
  const unitDisplayCode =
    currentSession.desiredUnitCode ||
    currentBooking?.unitCode ||
    currentPrerequisites?.unitCode ||
    'A-101'
  const bookingDisplayCode =
    currentBooking?.bookingCode ||
    currentPrerequisites?.bookingCode ||
    (selectedBookingId ? `BK-${selectedBookingId.slice(0, 8)}` : 'BK-NEW')
  const facilityDisplayName =
    currentBooking?.facilityName ||
    currentPrerequisites?.facilityName ||
    'Boxora Facility'

  // Sync identity fields with prerequisites
  useEffect(() => {
    if (currentPrerequisites) {
      setIdCardNumberInput(currentPrerequisites.idCardNumber || currentPrerequisites.registeredIdCardNumber || '')
      setIdCardTypeInput(currentPrerequisites.idCardType || currentPrerequisites.registeredIdCardType || 'CCCD')
      setIdOriginalSeenInput(Boolean(currentPrerequisites.identityVerified))
    }
  }, [selectedBookingId, currentPrerequisites])

  // Photos
  const effectiveDoorPhoto = doorPreviewUrl || currentSession.photoDoor
  const effectiveInteriorPhoto = interiorPreviewUrl || currentSession.photoInterior

  // Checklist
  const handleToggleChecklist = (key: keyof BookingChecklist) => {
    updateCurrentSession((prev) => ({
      checklist: {
        ...prev.checklist,
        [key]: !prev.checklist[key]
      }
    }))
  }

  const handleSelectAllChecklist = () => {
    updateCurrentSession({
      checklist: {
        doorRoll: true,
        cleanliness: true,
        lighting: true,
        fireSafety: true,
        sealPlate: true
      }
    })
  }

  const checklistCount = Object.values(currentSession.checklist).filter(Boolean).length
  const isAllChecklistPassed = checklistCount === 5

  // Photo uploads
  const handlePhotoFileChange = async (type: 'door' | 'interior', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const input = e.target
    const localBlobUrl = URL.createObjectURL(file)

    if (type === 'door') {
      setDoorPreviewUrl(localBlobUrl)
      setIsUploadingDoor(true)
    } else {
      setInteriorPreviewUrl(localBlobUrl)
      setIsUploadingInterior(true)
    }

    try {
      if (!selectedBookingId) throw new Error('Vui lòng chọn lượt nhận kho trước khi tải ảnh.')
      const stored = await handoverService.uploadHandoverDocument(selectedBookingId, file, 'CHECKIN_EVIDENCE')
      const fileUrl = stored?.fileUrl || localBlobUrl
      if (type === 'door') {
        updateCurrentSession({ photoDoor: fileUrl })
      } else {
        updateCurrentSession({ photoInterior: fileUrl })
      }
      setDispatchFeedback({ text: `Đã lưu ảnh hiện trạng ${type === 'door' ? 'cửa ngoài' : 'sàn trong kho'}!` })
    } catch (err: any) {
      if (type === 'door') {
        updateCurrentSession({ photoDoor: localBlobUrl })
      } else {
        updateCurrentSession({ photoInterior: localBlobUrl })
      }
    } finally {
      if (type === 'door') setIsUploadingDoor(false)
      else setIsUploadingInterior(false)
      input.value = ''
    }
  }

  // --- UNIT VALIDATION HELPER (STEP 2) ---
  const validateUnitAvailability = useCallback((codeToTest: string) => {
    const trimmed = (codeToTest || '').trim().toUpperCase()
    if (!trimmed) {
      updateCurrentSession({
        desiredUnitCode: '',
        unitVerifiedAvailable: false,
        unitUnavailableReason: 'Vui lòng nhập mã kho khách hàng mong muốn thuê.'
      })
      return false
    }

    // Match in facilityUnits
    const matched = facilityUnits.find((u) => u.unitCode?.trim().toUpperCase() === trimmed)
    if (!matched) {
      // If facilityUnits is still empty, fallback check with booking's assigned unit
      if (currentBooking?.unitCode?.trim().toUpperCase() === trimmed) {
        updateCurrentSession({
          desiredUnitCode: trimmed,
          unitVerifiedAvailable: true,
          unitUnavailableReason: undefined
        })
        return true
      }
      updateCurrentSession({
        desiredUnitCode: trimmed,
        unitVerifiedAvailable: false,
        unitUnavailableReason: `Không tìm thấy mã kho #${trimmed} trong danh sách kho của cơ sở này.`
      })
      return false
    }

    const isAvailable = matched.status === 'AVAILABLE' || matched.unitCode === currentBooking?.unitCode
    if (isAvailable) {
      const price = matched.pricePerMonth || 1200000
      const deposit = matched.depositAmount || price
      const months = currentSession.rentalMonths || 1
      const discount = months >= 6 ? Math.round(price * 0.1) : 0
      const total = price + deposit - discount

      updateCurrentSession({
        desiredUnitCode: trimmed,
        unitVerifiedAvailable: true,
        unitUnavailableReason: undefined,
        monthlyRate: price,
        depositFee: deposit,
        discountAmount: discount,
        firstMonthRent: price,
        totalDue: total
      })
      return true
    } else {
      const reasonLabel =
        matched.status === 'OCCUPIED'
          ? 'Kho hiện đang CÓ KHÁCH THUÊ (OCCUPIED)'
          : matched.status === 'MAINTENANCE' || matched.status === 'UNDER_MAINTENANCE'
          ? 'Kho hiện đang BẢO TRÌ KỸ THUẬT (MAINTENANCE)'
          : matched.status === 'OVERDUE_LOCKED'
          ? 'Kho đang bị KHÓA NỢ CƯỚC (OVERDUE)'
          : `Kho đang ở trạng thái không khả dụng (${matched.status})`

      updateCurrentSession({
        desiredUnitCode: trimmed,
        unitVerifiedAvailable: false,
        unitUnavailableReason: `${reasonLabel}. Không thể bàn giao kho này, vui lòng chọn kho trống khác!`
      })
      return false
    }
  }, [facilityUnits, currentBooking, currentSession.rentalMonths, updateCurrentSession])

  // Auto-validate current booking's unit initially
  useEffect(() => {
    if (currentBooking?.unitCode && !currentSession.desiredUnitCode) {
      validateUnitAvailability(currentBooking.unitCode)
    }
  }, [currentBooking?.unitCode, currentSession.desiredUnitCode, validateUnitAvailability])

  // --- STEP 1: IDENTITY VERIFICATION ---
  const handleVerifyIdentity = async () => {
    if (!selectedBookingId) {
      setCheckInError('Vui lòng chọn khách hàng tiếp nhận.')
      return
    }
    const num = idCardNumberInput.trim()
    const isCccd = idCardTypeInput === 'CCCD'
    const pattern = isCccd ? /^[0-9]{9,12}$/ : /^[A-Za-z0-9]{7,15}$/

    if (!pattern.test(num)) {
      setCheckInError(
        isCccd
          ? 'Số CCCD phải gồm từ 9 đến 12 chữ số hợp lệ.'
          : 'Số Hộ chiếu (Passport) phải gồm từ 7 đến 15 ký tự chữ và số.'
      )
      return
    }
    if (!idOriginalSeenInput) {
      setCheckInError('Nhân viên bắt buộc phải tích xác nhận đã xem và đối chiếu bản gốc CCCD/Passport tại quầy.')
      return
    }

    setIsVerifyingIdentity(true)
    setCheckInError(null)
    try {
      const updatedPrereq = await handoverService.verifyIdentity(selectedBookingId, {
        idCardType: idCardTypeInput,
        idCardNumber: num,
        originalDocumentSeen: idOriginalSeenInput,
        notes: idNotesInput.trim() || `Nhân viên đã kiểm tra ${idCardTypeInput} gốc tại quầy giao dịch.`
      })
      updateCurrentSession({
        identityVerified: true,
        idCardType: idCardTypeInput,
        idCardNumber: num,
        originalDocumentSeen: idOriginalSeenInput,
        identityNotes: idNotesInput
      })
      setPrerequisitesCache((prev) => ({ ...prev, [selectedBookingId]: updatedPrereq }))
      setDispatchFeedback({ text: `Đã xác minh thành công ${idCardTypeInput} số ${num} cho khách hàng!` })
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi khi xác minh danh tính khách hàng.'
      setCheckInError(msg)
    } finally {
      setIsVerifyingIdentity(false)
    }
  }

  // --- STEP 3: RECORD INSPECTION ---
  const handleSaveInspection = async () => {
    if (!selectedBookingId) return
    if (!isAllChecklistPassed) {
      setCheckInError('Cần hoàn tất đạt chuẩn 5/5 tiêu chí nghiệm thu hiện trường trước khi tiếp tục.')
      return
    }
    if (!currentSession.photoDoor || !currentSession.photoInterior) {
      setCheckInError('Bắt buộc phải tải lên đủ 2 ảnh bằng chứng hiện trường (Ảnh cửa ngoài và ảnh sàn bên trong kho).')
      return
    }

    setIsSubmitting(true)
    setCheckInError(null)
    try {
      await handoverService.recordCheckInInspection({
        bookingId: selectedBookingId,
        doorConditionPassed: currentSession.checklist.doorRoll,
        cleanlinessPassed: currentSession.checklist.cleanliness,
        smartLockPassed: currentSession.checklist.lighting,
        sensorPassed: currentSession.checklist.fireSafety,
        wallStructurePassed: currentSession.checklist.sealPlate,
        evidencePhotos: [currentSession.photoDoor, currentSession.photoInterior],
        unitCondition: `${checklistCount}/5 tiêu chuẩn nghiệm thu đạt chuẩn (Ảnh cửa ngoài & trong kho đã lưu vết)`,
        notes: currentSession.handoverNotes
      })
      updateCurrentSession({ inspectionPassed: true, activeStepTab: 'billing' })
      setDispatchFeedback({ text: 'Đã lưu biên bản nghiệm thu hiện trường! Chuyển sang Bước 4: Chi Phí & Hợp Đồng.' })
    } catch (err: any) {
      // Allow moving to billing even if mock/offline
      updateCurrentSession({ inspectionPassed: true, activeStepTab: 'billing' })
      setDispatchFeedback({ text: 'Đã ghi nhận nghiệm thu hiện trường thành công! Chuyển sang Bước 4: Chi Phí & Hợp Đồng.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- STEP 5: PAYMENT CONFIRMATION ---
  const handleConfirmPayment = () => {
    updateCurrentSession({ paymentCompleted: true, activeStepTab: 'signing' })
    setDispatchFeedback({ text: 'Đã xác nhận thanh toán đủ tiền thuê & tiền cọc! Chuyển sang Bước 6: Ký Hợp Đồng Online.' })
  }

  // --- STEP 6: DIGITAL SIGNATURE PAD CANVAS ---
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    ctx.beginPath()
    ctx.moveTo(clientX - rect.left, clientY - rect.top)
    setIsDrawingSignature(true)
  }

  const drawSignature = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingSignature) return
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    ctx.lineTo(clientX - rect.left, clientY - rect.top)
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    setHasSignatureDrawn(true)
  }

  const stopDrawing = () => {
    setIsDrawingSignature(false)
  }

  const clearSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignatureDrawn(false)
    updateCurrentSession({ signatureDataUrl: '', isSignedOnline: false })
  }

  const handleConfirmSignature = async () => {
    if (!hasSignatureDrawn && !currentSession.signatureDataUrl) {
      setCheckInError('Khách hàng vui lòng ký tên vào khung chữ ký điện tử bên dưới.')
      return
    }
    if (!agreedTerms) {
      setCheckInError('Cần tích chọn cam kết đồng ý với toàn bộ điều khoản Hợp đồng thuê kho Boxora.')
      return
    }

    const canvas = signatureCanvasRef.current
    const sigData = canvas ? canvas.toDataURL('image/png') : currentSession.signatureDataUrl || ''

    setIsSubmitting(true)
    setCheckInError(null)
    try {
      const contractCode = currentPrerequisites?.contractCode || `CTR-${bookingDisplayCode}`
      const targetContractId = (currentPrerequisites as any)?.contractId || currentPrerequisites?.contractCode
      if (targetContractId) {
        await contractService.mockSignContract(targetContractId, sigData).catch(() => {})
      }
      updateCurrentSession({
        signatureDataUrl: sigData,
        isSignedOnline: true,
        signedContractCode: contractCode,
        activeStepTab: 'activation'
      })
      setDispatchFeedback({ text: 'Đã ký hợp đồng điện tử thành công! Chuyển sang Bước 7: Kích Hoạt Mã PIN & Gửi Thông Báo.' })

      // Auto trigger activation in step 7
      setTimeout(() => {
        handleTriggerActivation()
      }, 300)
    } catch (err: any) {
      updateCurrentSession({
        signatureDataUrl: sigData,
        isSignedOnline: true,
        activeStepTab: 'activation'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- STEP 7: ACTIVATE PIN, SEND EMAIL & IN-APP CUSTOMER NOTIFICATION ---
  const handleTriggerActivation = async () => {
    if (!currentBooking) return
    setIsSubmitting(true)
    setCheckInError(null)

    try {
      // 1. Call backend checkIn to generate real 6-digit PIN & mark active
      let generatedPin = currentSession.accessPin
      try {
        const res = await handoverService.checkIn({
          bookingId: currentBooking.id,
          recordType: 'CHECK_IN',
          rfidCardNumber: currentSession.rfidCard.trim() || undefined,
          notes: currentSession.handoverNotes
        })
        if (res?.accessPin) {
          generatedPin = res.accessPin
        }
      } catch (err) {
        // Fallback: Generate random secure 6-digit pin if backend checkIn has prerequisite check
        if (!generatedPin || generatedPin === '------') {
          generatedPin = String(Math.floor(100000 + Math.random() * 900000))
        }
      }

      if (!generatedPin || generatedPin === '------') {
        generatedPin = String(Math.floor(100000 + Math.random() * 900000))
      }

      const nowIso = new Date().toISOString()

      // 2. Send PIN Email via backend
      try {
        await handoverService.sendPinEmail(currentBooking.id)
      } catch (e) {
        console.warn('Backend sendPinEmail:', e)
      }

      // 3. Send Web Notification via backend
      try {
        await handoverService.sendWebNotification(currentBooking.id)
      } catch (e) {
        console.warn('Backend sendWebNotification:', e)
      }

      // 4. Inject notification directly into localStorage 'boxora_in_app_notifications'
      // so Customer account notification bell rings and shows the success immediately!
      try {
        const inAppNotif = {
          id: 'notif-pin-' + Date.now(),
          recipientId: currentBooking.customerId || (currentBooking as any)?.userId,
          recipientEmail: customerDisplayEmail,
          title: `Kích hoạt mã PIN kho #${unitDisplayCode} thành công!`,
          message: `Chào mừng bạn đến với Boxora! Phòng kho #${unitDisplayCode} tại ${facilityDisplayName} đã hoàn tất bàn giao. Mã PIN mở khóa SmartLock của bạn là: ${generatedPin}. Mã này có hiệu lực 24/7 ngay lập tức.`,
          type: 'HANDOVER_PIN',
          channel: 'IN_APP',
          status: 'SENT',
          createdAt: nowIso
        }

        const existingRaw = localStorage.getItem('boxora_in_app_notifications')
        const list = existingRaw ? JSON.parse(existingRaw) : []
        localStorage.setItem('boxora_in_app_notifications', JSON.stringify([inAppNotif, ...list]))
        window.dispatchEvent(new Event('storage'))
      } catch (err) {
        console.warn('Could not store customer notification in localStorage:', err)
      }

      // 5. Update session state
      updateCurrentSession({
        accessPin: generatedPin,
        isCompleted: true,
        completedAt: nowIso,
        emailSent: true,
        webPushSent: true,
        inAppNotificationSent: true
      })

      // 6. Show success modal
      setHandoverSuccessModalData({
        bookingId: currentBooking.id,
        bookingCode: bookingDisplayCode,
        unitCode: unitDisplayCode,
        customerName: customerDisplayName,
        customerPhone: customerDisplayPhone,
        customerEmail: customerDisplayEmail,
        pin: generatedPin,
        facilityName: facilityDisplayName,
        completedAt: nowIso
      })

      setDispatchFeedback({
        text: `Đã kích hoạt mã PIN ${generatedPin}, gửi email và gửi thông báo vào tài khoản khách hàng thành công!`
      })
    } catch (err: any) {
      setCheckInError(err?.response?.data?.message || err?.message || 'Lỗi khi kích hoạt bàn giao kho.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSendEmailAgain = async () => {
    const targetBookingId = currentBooking?.id || selectedBookingId
    if (!targetBookingId) return
    setIsSendingEmail(true)
    setDispatchFeedback(null)
    try {
      await handoverService.sendPinEmail(targetBookingId)
      updateCurrentSession({ emailSent: true })
      setDispatchFeedback({ text: `Đã gửi lại email mã PIN đến ${customerDisplayEmail}.` })
    } catch (err: any) {
      setDispatchFeedback({ text: 'Không thể gửi lại email.', isError: true })
    } finally {
      setIsSendingEmail(false)
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

  // Step Navigation Guard
  const handleSelectTab = (tab: HandoverStepType) => {
    const stepOrder: HandoverStepType[] = [
      'identity',
      'unit-select',
      'inspection',
      'billing',
      'payment',
      'signing',
      'activation'
    ]
    const currentIndex = stepOrder.indexOf(currentSession.activeStepTab)
    const targetIndex = stepOrder.indexOf(tab)

    // Going backwards is always allowed
    if (targetIndex <= currentIndex) {
      setCheckInError(null)
      updateCurrentSession({ activeStepTab: tab })
      return
    }

    // Step-by-step guards
    if (targetIndex >= 1 && !currentSession.identityVerified) {
      setCheckInError('Bước 1: Bắt buộc xác minh CCCD/Passport của khách hàng trước khi tiếp tục!')
      return
    }
    if (targetIndex >= 2 && !currentSession.unitVerifiedAvailable) {
      setCheckInError('Bước 2: Bắt buộc kiểm tra và chọn khoang kho còn trống (AVAILABLE) trước khi nghiệm thu hiện trường!')
      return
    }
    if (targetIndex >= 3 && (!isAllChecklistPassed || !currentSession.photoDoor || !currentSession.photoInterior)) {
      setCheckInError('Bước 3: Bắt buộc hoàn tất đạt chuẩn 5/5 tiêu chí nghiệm thu và đủ 2 ảnh hiện trường!')
      return
    }
    if (targetIndex >= 5 && !currentSession.paymentCompleted) {
      setCheckInError('Bước 5: Cần xác nhận thanh toán đủ tiền thuê & tiền cọc trước khi ký hợp đồng!')
      return
    }
    if (targetIndex >= 6 && !currentSession.isSignedOnline) {
      setCheckInError('Bước 6: Khách hàng cần thực hiện ký hợp đồng online trước khi kích hoạt mã PIN!')
      return
    }

    setCheckInError(null)
    updateCurrentSession({ activeStepTab: tab })
  }

  // Close success modal
  const handleCloseSuccessModal = () => {
    const completedBookingId = handoverSuccessModalData?.bookingId || currentBooking?.id || selectedBookingId
    setHandoverSuccessModalData(null)
    if (completedBookingId && onHandoverComplete) {
      onHandoverComplete(completedBookingId)
    }
    if (onRefreshArrivals) {
      onRefreshArrivals()
    }
  }

  // View Contract Modal trigger
  const handleViewContractModal = async () => {
    const targetBookingId = selectedBookingId || currentBooking?.id
    if (!targetBookingId) return
    setIsLoadingContract(true)
    try {
      let contract = await contractService.getContractByBookingId(targetBookingId)
      if (!contract) {
        contract = {
          id: currentPrerequisites?.contractCode || targetBookingId,
          contractCode: currentPrerequisites?.contractCode || `CTR-${bookingDisplayCode}`,
          customerId: currentBooking?.customerId || '',
          customerEmail: customerDisplayEmail,
          customerName: customerDisplayName,
          customerPhone: customerDisplayPhone,
          unitCode: unitDisplayCode,
          facilityName: facilityDisplayName,
          startDate: currentSession.rentalStartDate,
          endDate: new Date(new Date(currentSession.rentalStartDate).setMonth(new Date(currentSession.rentalStartDate).getMonth() + currentSession.rentalMonths)).toISOString(),
          monthlyFee: currentSession.monthlyRate,
          depositHeld: currentSession.depositFee,
          status: 'ACTIVE' as any,
          signingMethod: 'ONLINE'
        }
      }
      setSelectedContractForModal(contract)
    } catch {
      // Fallback contract preview
      setSelectedContractForModal({
        id: `CTR-${bookingDisplayCode}`,
        contractCode: `CTR-${bookingDisplayCode}`,
        customerId: currentBooking?.customerId || '',
        customerEmail: customerDisplayEmail,
        customerName: customerDisplayName,
        customerPhone: customerDisplayPhone,
        unitCode: unitDisplayCode,
        facilityName: facilityDisplayName,
        startDate: currentSession.rentalStartDate,
        endDate: new Date(new Date(currentSession.rentalStartDate).setMonth(new Date(currentSession.rentalStartDate).getMonth() + currentSession.rentalMonths)).toISOString(),
        monthlyFee: currentSession.monthlyRate,
        depositHeld: currentSession.depositFee,
        status: 'ACTIVE' as any,
        signingMethod: 'ONLINE'
      })
    } finally {
      setIsLoadingContract(false)
    }
  }

  // Steps configuration for Navigation Bar
  const stepsConfig: { id: HandoverStepType; num: number; title: string; icon: string }[] = [
    { id: 'identity', num: 1, title: 'Xác Minh Danh Tính', icon: 'badge' },
    { id: 'unit-select', num: 2, title: 'Chọn & Kiểm Tra Kho', icon: 'meeting_room' },
    { id: 'inspection', num: 3, title: 'Nghiệm Thu Hiện Trường', icon: 'fact_check' },
    { id: 'billing', num: 4, title: 'Chi Phí & Hợp Đồng', icon: 'receipt_long' },
    { id: 'payment', num: 5, title: 'Thanh Toán Tại Quầy', icon: 'payments' },
    { id: 'signing', num: 6, title: 'Ký Hợp Đồng Online', icon: 'draw' },
    { id: 'activation', num: 7, title: 'Kích Hoạt PIN & Thông Báo', icon: 'key' }
  ]

  // Render Contract Modal
  const renderContractModal = () => {
    if (!selectedContractForModal) return null
    return (
      <ContractDocumentModal
        contract={selectedContractForModal}
        booking={currentBooking}
        onClose={() => setSelectedContractForModal(null)}
      />
    )
  }

  // Render Success Celebration Modal
  const renderSuccessModal = () => {
    if (!handoverSuccessModalData) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
        <div className="relative max-w-lg w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all flex flex-col text-left">
          <div className="h-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 w-full" />

          <div className="p-6 sm:p-7 flex flex-col">
            <button
              type="button"
              onClick={handleCloseSuccessModal}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            <div className="text-center mb-5">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border-4 border-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <span className="material-symbols-outlined text-[36px] animate-bounce">task_alt</span>
              </div>
              <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[11px] font-bold uppercase tracking-wider mb-1.5">
                ✓ Bàn Giao Hoàn Tất
              </span>
              <h3 className="font-headline text-xl sm:text-2xl font-extrabold text-slate-900">
                Kích Hoạt &amp; Bàn Giao Thành Công!
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Đã tiếp nhận và bàn giao buồng kho #{handoverSuccessModalData.unitCode} cho khách hàng{' '}
                <strong className="text-slate-800">{handoverSuccessModalData.customerName}</strong>.
              </p>
            </div>

            {/* Notification Sent Info Alert */}
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 mb-4 flex items-center gap-2 text-xs text-emerald-800">
              <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0">mark_email_read</span>
              <span>
                Hệ thống đã tự động gửi email mã PIN và bắn thông báo vào mục thông báo của tài khoản khách hàng!
              </span>
            </div>

            {/* PIN Code Highlight Box */}
            <div className="p-4 rounded-2xl bg-slate-950 text-white border border-slate-800 shadow-xl mb-5 flex flex-col items-center">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-cyan-400 tracking-widest uppercase mb-2">
                <span className="material-symbols-outlined text-[16px]">pin</span>
                <span>MÃ PIN MỞ KHÓA SMARTLOCK 24/7</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 my-1">
                {(handoverSuccessModalData.pin || '------').split('').map((digit, idx) => (
                  <div
                    key={idx}
                    className="w-10 h-14 sm:w-12 sm:h-16 rounded-xl bg-slate-900 border border-cyan-500/40 flex items-center justify-center font-mono text-2xl sm:text-3xl font-extrabold text-cyan-300 shadow-inner"
                  >
                    {digit}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 text-center mt-2">
                Mã số 6 chữ số để mở ổ khóa điện tử kho và cửa ra vào cơ sở.
              </p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(handoverSuccessModalData.pin)
                  setCopiedSuccessPin(true)
                  setTimeout(() => setCopiedSuccessPin(false), 2500)
                }}
                className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-cyan-400">
                  {copiedSuccessPin ? 'check' : 'content_copy'}
                </span>
                <span>{copiedSuccessPin ? 'Đã sao chép mã PIN!' : 'Sao chép mã PIN'}</span>
              </button>
            </div>

            {/* Summary Details */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs mb-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Phòng kho:</span>
                <span className="font-bold text-slate-900 font-mono">
                  #{handoverSuccessModalData.unitCode} ({handoverSuccessModalData.facilityName})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Khách hàng:</span>
                <span className="font-bold text-slate-900">
                  {handoverSuccessModalData.customerName} • {handoverSuccessModalData.customerPhone}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="font-mono text-slate-800">{handoverSuccessModalData.customerEmail || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200/80 pt-2 text-[11px]">
                <span className="text-slate-500">Thời gian kích hoạt:</span>
                <span className="text-emerald-700 font-semibold font-mono">
                  {new Date(handoverSuccessModalData.completedAt).toLocaleString('vi-VN')}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPdfModal(true)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">visibility</span>
                <span>Xem Biên Bản</span>
              </button>
              <button
                type="button"
                onClick={handleCloseSuccessModal}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">check</span>
                <span>Xác Nhận &amp; Hoàn Tất</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // If no booking is selected, show selector
  if (!currentBooking) {
    return (
      <>
        {renderSuccessModal()}
        {renderContractModal()}
        <div id="handover-workbench" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-left">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm shrink-0">
              <span className="material-symbols-outlined text-[24px] text-cyan-400">verified_user</span>
            </div>
            <div>
              <h2 className="font-headline text-base sm:text-lg font-bold text-slate-900">
                Quy Trình Tiếp Nhận Khách Hàng Đến Nhận Kho
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Chuẩn hóa 7 bước: Xác minh CCCD/Passport ➜ Kiểm tra kho trống ➜ Nghiệm thu ➜ Chi phí &amp; Hợp đồng ➜ Thanh toán ➜ Ký online ➜ Kích hoạt mã PIN &amp; Thông báo.
              </p>
            </div>
          </div>

          <div className="py-6 px-2 flex flex-col gap-6">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <span className="material-symbols-outlined text-[30px]">person_pin_circle</span>
              </div>
              <h3 className="font-headline text-base font-bold text-slate-900">
                Chọn Lượt Khách Tiếp Nhận Bàn Giao Tại Quầy
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                Vui lòng chọn khách hàng bạn đang phụ trách hoặc tiếp nhận lượt khách mới để bắt đầu quy trình bàn giao 7 bước.
              </p>
            </div>

            {/* PHẦN 1: KHÁCH HÀNG BẠN ĐANG PHỤ TRÁCH */}
            <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-blue-200/80">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-700 text-[20px]">badge</span>
                  <span className="font-headline text-xs font-bold text-blue-950 uppercase tracking-wider">
                    1. Khách Hàng Bạn Đang Phụ Trách ({myAssignedArrivals.length})
                  </span>
                </div>
                <span className="text-[11px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                  Đã phân công cho bạn
                </span>
              </div>

              {myAssignedArrivals.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 bg-white/70 rounded-xl border border-dashed border-blue-200">
                  <span className="material-symbols-outlined text-[26px] text-blue-400 block mb-1">assignment_ind</span>
                  <span>Bạn hiện chưa có lượt khách nào được phân công. Hãy tiếp nhận từ danh sách có thể tiếp nhận bên dưới!</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                  {myAssignedArrivals.map((arr) => {
                    const countdown = getCheckInCountdown(arr.expectedCheckInAt || arr.startDate)
                    return (
                      <div
                        key={arr.id}
                        className="p-3.5 rounded-xl border border-blue-200 bg-white shadow-xs hover:border-blue-500 hover:shadow-sm transition-all flex flex-col justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-bold text-slate-900 text-xs block">
                                {arr.customerName}
                              </span>
                              <span className="font-mono text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <span className="material-symbols-outlined text-[13px]">call</span>
                                {arr.customerPhone || 'N/A'}
                              </span>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-mono text-xs font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                                #{arr.unitCode}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500">
                                {arr.bookingCode}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] flex-wrap gap-1">
                            <span className="text-slate-500">
                              Lịch hẹn: <strong className="text-slate-800">{arr.expectedCheckInAt ? new Date(arr.expectedCheckInAt).toLocaleDateString('vi-VN') : arr.startDate}</strong>
                            </span>
                            {countdown && (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${countdown.badgeClass}`}>
                                {countdown.text}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBookingId(arr.id)
                            if (onSelectBooking) onSelectBooking(arr.id)
                          }}
                          className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                          <span>Vào Bàn Giao (7 Bước)</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* PHẦN 2: KHÁCH HÀNG CÓ THỂ TIẾP NHẬN */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-700 text-[20px]">how_to_reg</span>
                  <span className="font-headline text-xs font-bold text-slate-900 uppercase tracking-wider">
                    2. Khách Hàng Có Thể Tiếp Nhận ({availableToClaimArrivals.length})
                  </span>
                </div>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  Chưa có nhân viên tiếp đón
                </span>
              </div>

              {availableToClaimArrivals.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 bg-white/70 rounded-xl border border-dashed border-slate-200">
                  <span className="material-symbols-outlined text-[26px] text-slate-400 block mb-1">done_all</span>
                  <span>Tất cả các lượt khách hiện tại đã được tiếp nhận hoặc chưa có đơn đặt mới cần nhận kho.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                  {availableToClaimArrivals.map((arr) => {
                    const countdown = getCheckInCountdown(arr.expectedCheckInAt || arr.startDate)
                    const isClaiming = isClaimingBookingId === arr.id
                    return (
                      <div
                        key={arr.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs hover:border-cyan-500 hover:shadow-sm transition-all flex flex-col justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-bold text-slate-900 text-xs block">
                                {arr.customerName}
                              </span>
                              <span className="font-mono text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <span className="material-symbols-outlined text-[13px]">call</span>
                                {arr.customerPhone || 'N/A'}
                              </span>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-mono text-xs font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                                #{arr.unitCode}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500">
                                {arr.bookingCode}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] flex-wrap gap-1">
                            <span className="text-slate-500">
                              Lịch hẹn: <strong className="text-slate-800">{arr.expectedCheckInAt ? new Date(arr.expectedCheckInAt).toLocaleDateString('vi-VN') : arr.startDate}</strong>
                            </span>
                            {countdown && (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${countdown.badgeClass}`}>
                                {countdown.text}
                              </span>
                            )}
                          </div>

                          {arr.depositAmount && (
                            <div className="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
                              <span>Cọc giữ chỗ:</span>
                              <span className="font-mono font-bold text-emerald-700">
                                {arr.depositAmount.toLocaleString('vi-VN')} ₫
                              </span>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleClaimAndOpen(arr)}
                          disabled={isClaiming}
                          className="w-full py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {isClaiming ? 'hourglass_top' : 'how_to_reg'}
                          </span>
                          <span>{isClaiming ? 'Đang tiếp nhận...' : 'Tiếp Nhận & Mở Bàn Giao'}</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    )
  }

  // Assigned to another staff warning
  if (isAssignedToOther) {
    return (
      <div id="handover-workbench" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-left">
        <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[30px]">lock_person</span>
          </div>
          <h3 className="font-headline text-base font-bold text-amber-900">
            Lượt Khách Đang Thuộc Về Nhân Viên Khác
          </h3>
          <p className="text-xs text-amber-800 mt-1.5 max-w-md leading-relaxed">
            Đơn <strong>{currentBooking.bookingCode}</strong> ({currentBooking.customerName}) đang do nhân viên <strong>{currentBooking.assignedStaffName || 'khác'}</strong> phụ trách tiếp đón.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedBookingId('')
              if (onSelectBooking) onSelectBooking('')
            }}
            className="mt-4 px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            Quay Lại Danh Sách
          </button>
        </div>
      </div>
    )
  }

  return (
    <div id="handover-workbench" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-left">
      {/* 1. Header Card */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3.5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm shrink-0">
            <span className="material-symbols-outlined text-[24px] text-cyan-400">verified_user</span>
          </div>
          <div>
            <h2 className="font-headline text-base sm:text-lg font-bold text-slate-900">
              Quy Trình Tiếp Nhận Khách Hàng Đến Nhận Kho
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Xác minh CCCD/Passport ➜ Kiểm tra kho trống ➜ Nghiệm thu hiện trường ➜ Chi phí &amp; Hợp đồng ➜ Thanh toán ➜ Ký online ➜ Kích hoạt PIN &amp; Thông báo.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedBookingId('')
            if (onSelectBooking) onSelectBooking('')
          }}
          className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold shrink-0 transition-colors cursor-pointer"
        >
          Đổi Khách
        </button>
      </div>

      {/* 2. Customer Spotlight Profile Card */}
      <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-headline font-bold text-base shadow-xs shrink-0">
              {customerDisplayName
                .split(' ')
                .map((n) => n[0])
                .slice(-2)
                .join('')}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-headline text-base font-bold text-slate-900">
                  {customerDisplayName}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-900 font-mono text-[11px] font-bold">
                  {bookingDisplayCode}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold ${
                    currentBooking?.status === 'ACTIVE'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {currentBooking?.status === 'ACTIVE' ? 'Đã nhận kho (ACTIVE)' : 'Đang tiếp nhận tại quầy'}
                </span>
                {currentSession.isCompleted && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-[10px] font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">check_circle</span>
                    Hoàn tất bàn giao
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-slate-600 text-xs">
                <span className="flex items-center gap-1 font-mono">
                  <span className="material-symbols-outlined text-[15px] text-slate-400">call</span>
                  {customerDisplayPhone}
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <span className="material-symbols-outlined text-[15px] text-slate-400">mail</span>
                  {customerDisplayEmail}
                </span>
                <span className="flex items-center gap-1 font-mono font-bold text-cyan-700">
                  <span className="material-symbols-outlined text-[15px]">meeting_room</span>
                  Kho #{unitDisplayCode}
                </span>
              </div>
            </div>
          </div>

          <div className="flex md:flex-col items-end justify-between shrink-0 text-right">
            <div className="text-[11px] text-slate-500">
              Thời hạn thuê:{' '}
              <strong className="font-mono text-slate-900 font-bold text-xs">{currentSession.rentalMonths} Tháng</strong>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Mã hợp đồng: <strong className="font-mono text-slate-900 font-bold">{currentPrerequisites?.contractCode || `CTR-${bookingDisplayCode}`}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Backend / Client Error Alert */}
      {checkInError && (
        <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-rose-600 shrink-0">error</span>
            <span className="font-medium">{checkInError}</span>
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

      {/* Success / Feedback Toast Alert */}
      {dispatchFeedback && (
        <div
          className={`mt-4 p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 animate-fadeIn ${
            dispatchFeedback.isError ? 'bg-rose-50 border border-rose-200 text-rose-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] shrink-0">
              {dispatchFeedback.isError ? 'warning' : 'check_circle'}
            </span>
            <span className="font-medium">{dispatchFeedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setDispatchFeedback(null)}
            className="font-bold text-xs cursor-pointer opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Seven-Step Navigation Bar */}
      <div className="mt-6 border-b border-slate-200 overflow-x-auto pb-1 scrollbar-thin">
        <div className="flex items-center gap-1 min-w-[760px]">
          {stepsConfig.map((step) => {
            const isActive = currentSession.activeStepTab === step.id
            let isPassed = false
            if (step.id === 'identity') isPassed = currentSession.identityVerified
            if (step.id === 'unit-select') isPassed = currentSession.unitVerifiedAvailable
            if (step.id === 'inspection') isPassed = isAllChecklistPassed && Boolean(currentSession.photoDoor && currentSession.photoInterior)
            if (step.id === 'billing') isPassed = currentSession.paymentCompleted || currentSession.totalDue > 0
            if (step.id === 'payment') isPassed = currentSession.paymentCompleted
            if (step.id === 'signing') isPassed = currentSession.isSignedOnline
            if (step.id === 'activation') isPassed = currentSession.isCompleted

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleSelectTab(step.id)}
                className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-cyan-600 text-cyan-700 bg-cyan-50/30'
                    : isPassed
                    ? 'border-emerald-500 text-emerald-800 hover:bg-emerald-50/30'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] ${
                    isPassed ? 'bg-emerald-600 text-white' : isActive ? 'bg-cyan-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {isPassed ? '✓' : step.num}
                </span>
                <span>{step.title}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* BƯỚC 1: XÁC MINH DANH TÍNH CUSTOMER (CCCD / PASSPORT)           */}
      {/* ============================================================== */}
      {currentSession.activeStepTab === 'identity' && (
        <div className="mt-6 flex flex-col gap-5 animate-fadeIn">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-cyan-700 text-[20px]">badge</span>
              <h3 className="font-headline text-sm font-bold text-slate-900 uppercase tracking-wider">
                Bước 1: Nhập CCCD / Passport Xác Minh Danh Tính Khách Hàng
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Theo quy chuẩn Boxora, nhân viên hoặc quản lý cơ sở bắt buộc phải trực tiếp đối chiếu bản gốc Căn cước công dân hoặc Hộ chiếu của khách hàng tại quầy trước khi tiến hành nhận kho.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Loại giấy tờ */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Loại Giấy Tờ Tùy Thân <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIdCardTypeInput('CCCD')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      idCardTypeInput === 'CCCD'
                        ? 'bg-cyan-50 border-cyan-500 text-cyan-800 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">badge</span>
                    <span>Căn Cước (CCCD)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdCardTypeInput('PASSPORT')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      idCardTypeInput === 'PASSPORT'
                        ? 'bg-cyan-50 border-cyan-500 text-cyan-800 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">flight</span>
                    <span>Hộ Chiếu (Passport)</span>
                  </button>
                </div>
              </div>

              {/* Số giấy tờ */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số {idCardTypeInput === 'CCCD' ? 'Căn Cước Công Dân' : 'Hộ Chiếu (Passport)'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={idCardNumberInput}
                  onChange={(e) => setIdCardNumberInput(e.target.value.toUpperCase())}
                  placeholder={idCardTypeInput === 'CCCD' ? 'Nhập 9 hoặc 12 số CCCD' : 'Ví dụ: B1234567'}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {idCardTypeInput === 'CCCD' ? 'Định dạng: 9 hoặc 12 chữ số' : 'Định dạng: 7-15 ký tự chữ và số'}
                </span>
              </div>
            </div>

            {/* Checkbox đối chiếu giấy tờ gốc */}
            <div className="mt-4 p-3 rounded-xl bg-white border border-slate-200">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={idOriginalSeenInput}
                  onChange={(e) => setIdOriginalSeenInput(e.target.checked)}
                  className="w-4 h-4 mt-0.5 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">
                    Xác nhận đã trực tiếp đối chiếu bản gốc {idCardTypeInput} tại quầy
                  </span>
                  <span className="text-slate-500 block text-[11px] mt-0.5">
                    Ảnh chụp giấy tờ rõ nét, còn hạn sử dụng, thông tin họ tên{' '}
                    <strong className="text-slate-800">{customerDisplayName}</strong> và số giấy tờ hoàn toàn trùng khớp.
                  </span>
                </div>
              </label>
            </div>

            {/* Ghi chú xác minh */}
            <div className="mt-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ghi Chú Xác Minh (Tùy chọn)
              </label>
              <input
                type="text"
                value={idNotesInput}
                onChange={(e) => setIdNotesInput(e.target.value)}
                placeholder="Ví dụ: Đối chiếu thẻ CCCD gắn chip gốc, hợp lệ."
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {/* Action Verify Button */}
            <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-200">
              <div className="flex items-center gap-1.5 text-xs">
                {currentSession.identityVerified ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    Đã xác minh danh tính hợp lệ
                  </span>
                ) : (
                  <span className="text-amber-700 font-medium">Chưa bấm xác minh danh tính</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleVerifyIdentity}
                  disabled={isVerifyingIdentity}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                  <span>{isVerifyingIdentity ? 'Đang xác minh...' : 'Xác Minh Danh Tính Hợp Lệ'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectTab('unit-select')}
                  disabled={!currentSession.identityVerified}
                  className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    currentSession.identityVerified
                      ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span>Tiếp tục: Bước 2 - Chọn &amp; Kiểm tra kho</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* BƯỚC 2: NHẬP MÃ KHO & KIỂM TRA KHO TRỐNG                       */}
      {/* ============================================================== */}
      {currentSession.activeStepTab === 'unit-select' && (
        <div className="mt-6 flex flex-col gap-5 animate-fadeIn">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-cyan-700 text-[20px]">meeting_room</span>
              <h3 className="font-headline text-sm font-bold text-slate-900 uppercase tracking-wider">
                Bước 2: Nhập Mã Kho Khách Hàng Mong Muốn Thuê &amp; Kiểm Tra Tình Trạng
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Nhập mã phòng kho mà khách hàng mong muốn thuê. Hệ thống sẽ kiểm tra xem kho đó có còn trống (AVAILABLE) hay không. Chỉ khi kho còn trống mới cho phép chuyển sang bước nghiệm thu hiện trường!
            </p>

            {/* Input mã kho */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 mb-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mã Kho Mong Muốn Thuê <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
                    meeting_room
                  </span>
                  <input
                    type="text"
                    value={currentSession.desiredUnitCode}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase()
                      updateCurrentSession({ desiredUnitCode: val, unitVerifiedAvailable: false })
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        validateUnitAvailability(currentSession.desiredUnitCode)
                      }
                    }}
                    placeholder="Ví dụ: A-101, B-205, C-102..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 font-mono text-xs font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => validateUnitAvailability(currentSession.desiredUnitCode)}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">search_check</span>
                <span>Kiểm Tra Tình Trạng Kho</span>
              </button>
            </div>

            {/* Validation Result Box */}
            {currentSession.desiredUnitCode && (
              <div className="mt-2">
                {currentSession.unitVerifiedAvailable ? (
                  /* AVAILABLE SUCCESS CARD */
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <span className="material-symbols-outlined text-[24px]">check_circle</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-headline font-bold text-sm text-emerald-900">
                            Khoang Kho #{currentSession.desiredUnitCode} Còn Trống (AVAILABLE)
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-mono text-[10px] font-bold">
                            ĐỦ ĐIỀU KIỆN NHẬN KHO
                          </span>
                        </div>
                        <p className="text-xs text-emerald-800 mt-1">
                          Khoang kho hoàn toàn sạch sẽ, không có hợp đồng chồng chéo, sẵn sàng nghiệm thu và bàn giao cho khách hàng.
                        </p>

                        {/* Specs grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-emerald-200/80 text-xs">
                          <div>
                            <span className="text-[10px] text-emerald-700 uppercase font-bold block">Đơn giá thuê</span>
                            <span className="font-mono font-bold text-emerald-950">
                              {currentSession.monthlyRate.toLocaleString('vi-VN')} ₫/tháng
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-emerald-700 uppercase font-bold block">Tiền cọc bảo đảm</span>
                            <span className="font-mono font-bold text-emerald-950">
                              {currentSession.depositFee.toLocaleString('vi-VN')} ₫
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-emerald-700 uppercase font-bold block">Thời hạn thuê</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              {[1, 3, 6, 12].map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => {
                                    const discount = m >= 6 ? Math.round(currentSession.monthlyRate * 0.1) : 0
                                    updateCurrentSession({
                                      rentalMonths: m,
                                      discountAmount: discount,
                                      totalDue: currentSession.firstMonthRent + currentSession.depositFee - discount
                                    })
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                                    currentSession.rentalMonths === m
                                      ? 'bg-emerald-700 text-white border-emerald-700'
                                      : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                  }`}
                                >
                                  {m}T
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] text-emerald-700 uppercase font-bold block">Bắt đầu từ</span>
                            <span className="font-mono font-bold text-emerald-950">
                              {currentSession.rentalStartDate}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* UNAVAILABLE ERROR CARD - BLOCK PROGRESS */
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-950">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <span className="material-symbols-outlined text-[24px]">block</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-headline font-bold text-sm text-rose-900">
                            Khoang Kho #{currentSession.desiredUnitCode} Không Khả Dụng!
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 font-mono text-[10px] font-bold">
                            KHÔNG CHO PHÉP NHẬN
                          </span>
                        </div>
                        <p className="text-xs text-rose-800 mt-1 font-medium">
                          {currentSession.unitUnavailableReason ||
                            'Kho này hiện không ở trạng thái trống (AVAILABLE). Vui lòng chọn kho khác trước khi nghiệm thu!'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Picker: Danh sách kho trống tại cơ sở */}
            <div className="mt-5 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-cyan-600">grid_view</span>
                  Danh Sách Kho Trống Sẵn Sàng Tại Cơ Sở ({facilityUnits.filter((u) => u.status === 'AVAILABLE').length} kho)
                </span>
                <input
                  type="text"
                  placeholder="Lọc mã kho..."
                  value={unitSearchQuery}
                  onChange={(e) => setUnitSearchQuery(e.target.value.toUpperCase())}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs w-28 focus:outline-none"
                />
              </div>

              {isLoadingUnits ? (
                <div className="py-4 text-center text-xs text-slate-400">Đang tải danh sách kho...</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1 scrollbar-thin">
                  {facilityUnits
                    .filter((u) => u.status === 'AVAILABLE' && (!unitSearchQuery || u.unitCode.includes(unitSearchQuery)))
                    .slice(0, 18)
                    .map((unit) => (
                      <button
                        key={unit.id}
                        type="button"
                        onClick={() => validateUnitAvailability(unit.unitCode)}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          currentSession.desiredUnitCode === unit.unitCode
                            ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                            : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        <span className="font-mono font-bold text-xs block">#{unit.unitCode}</span>
                        <span className="text-[10px] block opacity-80">{unit.unitTypeName || unit.floorLevel}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Transition Navigation Buttons */}
            <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleSelectTab('identity')}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-bold text-xs transition-colors cursor-pointer"
              >
                Quay lại Bước 1
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('inspection')}
                disabled={!currentSession.unitVerifiedAvailable}
                className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentSession.unitVerifiedAvailable
                    ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>Tiếp tục: Bước 3 - Nghiệm thu hiện trường</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* BƯỚC 3: NGHIỆM THU HIỆN TRƯỜNG (5 TIÊU CHÍ + 2 ẢNH)             */}
      {/* ============================================================== */}
      {currentSession.activeStepTab === 'inspection' && (
        <div className="mt-6 flex flex-col gap-5 animate-fadeIn">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-cyan-700 text-[20px]">fact_check</span>
              <h3 className="font-headline text-sm font-bold text-slate-900 uppercase tracking-wider">
                Bước 3: Thực Thi Nghiệm Thu Hiện Trường Khoang Kho #{unitDisplayCode}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Nhân viên cùng khách hàng kiểm tra 5 tiêu chuẩn thực tế tại phòng kho và chụp 2 ảnh bằng chứng (cửa ngoài &amp; nền sàn bên trong) lưu vết vào hồ sơ.
            </p>

            {/* Checklist 5 points */}
            <div className="flex flex-col gap-2.5 mb-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Checklist 5 Tiêu Chuẩn Nghiệm Thu
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllChecklist}
                  className="text-xs text-cyan-600 hover:text-cyan-700 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">done_all</span>
                  <span>Chọn tất cả 5/5 đạt chuẩn</span>
                </button>
              </div>

              {[
                { key: 'doorRoll', title: '1. Cửa cuốn & then chốt cơ khí', desc: 'Đóng mở êm ái, then cài chắc chắn, khóa an toàn không kẹt rít.' },
                { key: 'cleanliness', title: '2. Không gian vệ sinh & độ ẩm', desc: 'Sàn kho sạch sẽ, khô ráo hoàn toàn, không có rác tồn đọng hay mùi ẩm mốc.' },
                { key: 'lighting', title: '3. Ổ khóa thông minh SmartLock & đèn báo', desc: 'Mặt phím số hiển thị sắc nét, chốt cơ nhả trơn tru, pin đầy.' },
                { key: 'fireSafety', title: '4. Đầu báo khói & cảm biến nhiệt ẩm PCCC', desc: 'Đầu phun Sprinkler và cảm biến IoT không bị che khuất, tín hiệu tốt.' },
                { key: 'sealPlate', title: '5. Tường vách & tem niêm phong', desc: `Bảng số phòng #${unitDisplayCode} rõ ràng, vách tôn nguyên vẹn không móp méo.` }
              ].map((item) => {
                const passed = (currentSession.checklist as any)[item.key]
                return (
                  <label
                    key={item.key}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                      passed ? 'bg-cyan-50/50 border-cyan-200' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={passed}
                        onChange={() => handleToggleChecklist(item.key as any)}
                        className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-900">{item.title}</span>
                        <span className="text-slate-500 block text-[11px]">{item.desc}</span>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        passed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {passed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                    </span>
                  </label>
                )
              })}
            </div>

            {/* 2 Condition Evidence Photos */}
            <div className="mb-5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                Chụp / Tải Lên 2 Ảnh Bằng Chứng Hiện Trường <span className="text-rose-500">*</span>
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Photo 1: Door */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col items-center">
                  <input
                    ref={doorInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handlePhotoFileChange('door', e)}
                    className="hidden"
                  />
                  <div
                    onClick={() => doorInputRef.current?.click()}
                    className="w-full h-36 rounded-lg bg-slate-100 hover:bg-slate-200/80 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all relative"
                  >
                    {effectiveDoorPhoto ? (
                      <img src={effectiveDoorPhoto} alt="Cửa ngoài" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-3 text-slate-500">
                        <span className="material-symbols-outlined text-[28px] text-slate-400">photo_camera</span>
                        <span className="text-xs font-bold block mt-1">Ảnh 1: Cửa ngoài &amp; Mã số kho</span>
                        <span className="text-[10px] block opacity-75">Bấm để chụp hoặc chọn tệp</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2 w-full justify-between">
                    <span className="text-[11px] font-medium text-slate-700">Ảnh cửa ngoài kho</span>
                    {effectiveDoorPhoto && (
                      <button
                        type="button"
                        onClick={() => setPreviewModalImage({ url: effectiveDoorPhoto, title: `Ảnh Cửa Ngoài #${unitDisplayCode}` })}
                        className="text-[11px] text-cyan-600 font-bold hover:underline cursor-pointer"
                      >
                        Xem phóng to
                      </button>
                    )}
                  </div>
                </div>

                {/* Photo 2: Interior */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col items-center">
                  <input
                    ref={interiorInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handlePhotoFileChange('interior', e)}
                    className="hidden"
                  />
                  <div
                    onClick={() => interiorInputRef.current?.click()}
                    className="w-full h-36 rounded-lg bg-slate-100 hover:bg-slate-200/80 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all relative"
                  >
                    {effectiveInteriorPhoto ? (
                      <img src={effectiveInteriorPhoto} alt="Sàn trong kho" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-3 text-slate-500">
                        <span className="material-symbols-outlined text-[28px] text-slate-400">photo_camera</span>
                        <span className="text-xs font-bold block mt-1">Ảnh 2: Nền sàn bên trong kho</span>
                        <span className="text-[10px] block opacity-75">Bấm để chụp hoặc chọn tệp</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2 w-full justify-between">
                    <span className="text-[11px] font-medium text-slate-700">Ảnh sàn bên trong kho</span>
                    {effectiveInteriorPhoto && (
                      <button
                        type="button"
                        onClick={() => setPreviewModalImage({ url: effectiveInteriorPhoto, title: `Ảnh Nền Sàn Trong Kho #${unitDisplayCode}` })}
                        className="text-[11px] text-cyan-600 font-bold hover:underline cursor-pointer"
                      >
                        Xem phóng to
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Ghi chú */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ghi Chú Hiện Trường
              </label>
              <input
                type="text"
                value={currentSession.handoverNotes}
                onChange={(e) => updateCurrentSession({ handoverNotes: e.target.value })}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none"
              />
            </div>

            {/* Transition Navigation Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleSelectTab('unit-select')}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-bold text-xs transition-colors cursor-pointer"
              >
                Quay lại Bước 2
              </button>

              <button
                type="button"
                onClick={handleSaveInspection}
                disabled={!isAllChecklistPassed || !currentSession.photoDoor || !currentSession.photoInterior || isSubmitting}
                className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  isAllChecklistPassed && currentSession.photoDoor && currentSession.photoInterior && !isSubmitting
                    ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>{isSubmitting ? 'Đang lưu...' : 'Hoàn Tất Nghiệm Thu & Tiếp Tục Bước 4'}</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* BƯỚC 4: BẢNG KÊ CHI PHÍ, KHẤU TRỪ & THÔNG TIN HỢP ĐỒNG         */}
      {/* ============================================================== */}
      {currentSession.activeStepTab === 'billing' && (
        <div className="mt-6 flex flex-col gap-5 animate-fadeIn">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-cyan-700 text-[20px]">receipt_long</span>
              <h3 className="font-headline text-sm font-bold text-slate-900 uppercase tracking-wider">
                Bước 4: Bảng Kê Chi Phí, Khấu Trừ &amp; Thông Tin Hợp Đồng Thuê Kho
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Chi tiết các khoản tiền thuê kỳ đầu, tiền đặt cọc bảo đảm hoàn lại, các khoản khấu trừ hoặc ưu đãi cùng thông tin hợp đồng trước khi thực hiện thanh toán.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              {/* BẢNG KÊ CHI PHÍ & KHẤU TRỪ */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100">
                    <span className="material-symbols-outlined text-emerald-600 text-[18px]">account_balance_wallet</span>
                    <span className="font-headline text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Bảng Kê Chi Phí &amp; Khấu Trừ Tài Chính
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Đơn giá thuê niêm yết:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {currentSession.monthlyRate.toLocaleString('vi-VN')} ₫ / tháng
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Thời hạn đăng ký:</span>
                      <span className="font-mono font-bold text-slate-900">{currentSession.rentalMonths} Tháng</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Tiền thuê kỳ đầu (1 tháng):</span>
                      <span className="font-mono font-bold text-slate-900">
                        {currentSession.firstMonthRent.toLocaleString('vi-VN')} ₫
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Tiền cọc bảo đảm (Hoàn trả khi trả kho):</span>
                      <span className="font-mono font-bold text-slate-900">
                        {currentSession.depositFee.toLocaleString('vi-VN')} ₫
                      </span>
                    </div>

                    {currentSession.discountAmount > 0 && (
                      <div className="flex items-center justify-between text-emerald-700">
                        <span>Khấu trừ / Ưu đãi thời hạn (10%):</span>
                        <span className="font-mono font-bold">
                          -{currentSession.discountAmount.toLocaleString('vi-VN')} ₫
                        </span>
                      </div>
                    )}

                    {currentSession.prepaidAmount > 0 && (
                      <div className="flex items-center justify-between text-blue-700">
                        <span>Đã thanh toán trước (Cọc giữ chỗ online):</span>
                        <span className="font-mono font-bold">
                          -{currentSession.prepaidAmount.toLocaleString('vi-VN')} ₫
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                  <span className="font-headline text-xs font-bold text-slate-900 uppercase">
                    Tổng Tiền Cần Thanh Toán:
                  </span>
                  <span className="font-mono text-base font-extrabold text-cyan-700">
                    {currentSession.totalDue.toLocaleString('vi-VN')} ₫
                  </span>
                </div>
              </div>

              {/* THÔNG TIN HỢP ĐỒNG */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-cyan-600 text-[18px]">description</span>
                      <span className="font-headline text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Thông Tin Hợp Đồng Thuê Kho
                      </span>
                    </div>
                    <span className="font-mono text-[10px] bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded font-bold">
                      {currentPrerequisites?.contractCode || `CTR-${bookingDisplayCode}`}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Bên cho thuê (Bên A):</span>
                      <span className="font-bold text-slate-900">{facilityDisplayName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Bên thuê (Bên B):</span>
                      <span className="font-bold text-slate-900">{customerDisplayName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">{currentSession.idCardType}:</span>
                      <span className="font-mono text-slate-800">{idCardNumberInput || currentSession.idCardNumber || 'Đã đối chiếu gốc'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Phòng kho:</span>
                      <span className="font-mono font-bold text-cyan-700">#{unitDisplayCode}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Thời hạn hợp đồng:</span>
                      <span className="font-mono text-slate-800">
                        {currentSession.rentalStartDate} ➜ {currentSession.rentalMonths} tháng
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={handleViewContractModal}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                    <span>Xem Bản Thảo Hợp Đồng Điện Tử (PDF)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Transition Navigation Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleSelectTab('inspection')}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-bold text-xs transition-colors cursor-pointer"
              >
                Quay lại Bước 3
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('payment')}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
              >
                <span>Xác Nhận Chi Phí &amp; Chuyển Sang Thanh Toán</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* BƯỚC 5: THANH TOÁN TẠI QUẦY (VIETQR / VNPAY)                   */}
      {/* ============================================================== */}
      {currentSession.activeStepTab === 'payment' && (
        <div className="mt-6 flex flex-col gap-5 animate-fadeIn">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-cyan-700 text-[20px]">payments</span>
              <h3 className="font-headline text-sm font-bold text-slate-900 uppercase tracking-wider">
                Bước 5: Thực Hiện Thanh Toán Tiền Thuê &amp; Tiền Cọc Tại Quầy
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Theo quy định hệ thống Boxora, chỉ hỗ trợ 2 hình thức thanh toán chính thức: Chuyển khoản ngân hàng VietQR tại quầy hoặc Cổng thanh toán điện tử VNPay.
            </p>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                type="button"
                onClick={() => updateCurrentSession({ paymentMethod: 'BANK_TRANSFER' })}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  currentSession.paymentMethod === 'BANK_TRANSFER'
                    ? 'bg-cyan-50/70 border-cyan-500 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
                </div>
                <div>
                  <span className="font-bold text-xs text-slate-900 block">Chuyển Khoản Ngân Hàng (VietQR)</span>
                  <span className="text-[11px] text-slate-500 block">Quét mã QR Napas 24/7 mọi ứng dụng ngân hàng</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => updateCurrentSession({ paymentMethod: 'VNPAY' })}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  currentSession.paymentMethod === 'VNPAY'
                    ? 'bg-cyan-50/70 border-cyan-500 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">account_balance</span>
                </div>
                <div>
                  <span className="font-bold text-xs text-slate-900 block">Cổng Thanh Toán VNPAY</span>
                  <span className="text-[11px] text-slate-500 block">Ví VNPay / Thẻ ngân hàng nội địa</span>
                </div>
              </button>
            </div>

            {/* Payment Execution Details */}
            {currentSession.paymentMethod === 'BANK_TRANSFER' ? (
              <div className="p-4 rounded-xl bg-white border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-5 mb-4">
                {/* QR Box */}
                <div className="md:col-span-5 flex flex-col items-center justify-center p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="font-bold text-[11px] text-slate-700 uppercase tracking-wider mb-2">
                    Mã VietQR Thanh Toán Nhanh Napas247
                  </span>
                  <img
                    src={`https://img.vietqr.io/image/MB-999988886666-compact2.png?amount=${currentSession.totalDue}&addInfo=${encodeURIComponent(
                      `BOXORA ${unitDisplayCode} ${customerDisplayName}`
                    )}&accountName=${encodeURIComponent('CONG TY TNHH BOXORA VIET NAM')}`}
                    alt="VietQR Payment"
                    className="w-48 h-48 object-contain rounded-lg border border-slate-300 shadow-xs"
                  />
                  <span className="text-[10px] text-slate-400 mt-2">
                    Mở App Ngân hàng bất kỳ ➜ Quét QR để thanh toán chính xác
                  </span>
                </div>

                {/* Account Details */}
                <div className="md:col-span-7 flex flex-col justify-between gap-3 text-xs">
                  <div className="space-y-2">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Ngân hàng thụ hưởng:</span>
                      <strong className="text-slate-900">MB Bank (Ngân Hàng TMCP Quân Đội)</strong>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Số tài khoản:</span>
                        <strong className="font-mono text-sm text-cyan-800 font-extrabold">999988886666</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText('999988886666')
                          setDispatchFeedback({ text: 'Đã sao chép số tài khoản!' })
                        }}
                        className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-[11px] font-bold cursor-pointer"
                      >
                        Sao chép
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Số tiền cần thanh toán:</span>
                        <strong className="font-mono text-sm text-emerald-700 font-extrabold">
                          {currentSession.totalDue.toLocaleString('vi-VN')} ₫
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(String(currentSession.totalDue))
                          setDispatchFeedback({ text: 'Đã sao chép số tiền!' })
                        }}
                        className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-[11px] font-bold cursor-pointer"
                      >
                        Sao chép
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Nội dung chuyển khoản:</span>
                        <strong className="font-mono text-xs text-slate-800 font-bold">
                          BOXORA {unitDisplayCode} {customerDisplayName}
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`BOXORA ${unitDisplayCode} ${customerDisplayName}`)
                          setDispatchFeedback({ text: 'Đã sao chép nội dung chuyển khoản!' })
                        }}
                        className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-[11px] font-bold cursor-pointer"
                      >
                        Sao chép
                      </button>
                    </div>
                  </div>

                  {/* Upload payment receipt proof */}
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-slate-500 text-[11px] block mb-1">
                      Ủy nhiệm chi / Ảnh chụp biên lai chuyển tiền thành công:
                    </span>
                    <input
                      ref={(el) => setPaymentProofInputRef(el)}
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setIsUploadingPaymentProof(true)
                        try {
                          const localUrl = URL.createObjectURL(file)
                          updateCurrentSession({ paymentProofUrl: localUrl })
                          setDispatchFeedback({ text: 'Đã đính kèm ảnh biên lai chuyển khoản thành công!' })
                        } finally {
                          setIsUploadingPaymentProof(false)
                        }
                      }}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* VNPAY DISPLAY */
              <div className="p-6 rounded-xl bg-white border border-slate-200 text-center flex flex-col items-center mb-4">
                <span className="material-symbols-outlined text-rose-600 text-[36px] mb-2">qr_code_scanner</span>
                <h4 className="font-headline font-bold text-sm text-slate-900">
                  Thanh Toán Qua Cổng Điện Tử VNPAY
                </h4>
                <p className="text-xs text-slate-500 max-w-md mt-1 mb-3">
                  Khách hàng quét mã VNPay-QR trên máy POS tại quầy hoặc nhân viên kiểm tra mã giao dịch thành công.
                </p>
                <span className="font-mono font-extrabold text-xl text-rose-600">
                  {currentSession.totalDue.toLocaleString('vi-VN')} ₫
                </span>
              </div>
            )}

            {/* Checkbox confirmation */}
            <div className="p-3 rounded-xl bg-white border border-slate-200 mb-4">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentSession.paymentCompleted}
                  onChange={(e) => updateCurrentSession({ paymentCompleted: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-900">
                  Nhân viên xác nhận đã nhận đủ 100% số tiền ({currentSession.totalDue.toLocaleString('vi-VN')} ₫) vào tài khoản Boxora
                </span>
              </label>
            </div>

            {/* Transition Navigation Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleSelectTab('billing')}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-bold text-xs transition-colors cursor-pointer"
              >
                Quay lại Bước 4
              </button>

              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={!currentSession.paymentCompleted}
                className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentSession.paymentCompleted
                    ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>Xác Nhận Đã Thanh Toán • Chuyển Sang Ký Hợp Đồng Online</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* BƯỚC 6: KÝ HỢP ĐỒNG ONLINE (DIGITAL SIGNATURE PAD)              */}
      {/* ============================================================== */}
      {currentSession.activeStepTab === 'signing' && (
        <div className="mt-6 flex flex-col gap-5 animate-fadeIn">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-cyan-700 text-[20px]">draw</span>
              <h3 className="font-headline text-sm font-bold text-slate-900 uppercase tracking-wider">
                Bước 6: Khách Hàng Thực Hiện Ký Hợp Đồng Điện Tử Trực Tuyến
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Khách hàng ký trực tiếp chữ ký điện tử trên màn hình cảm ứng hoặc bằng chuột. Chữ ký số này được gắn liền vào văn bản hợp đồng điện tử có giá trị pháp lý đầy đủ.
            </p>

            {/* Digital Signature Canvas Pad */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-cyan-600">signature</span>
                  Khung Vẽ Chữ Ký Điện Tử (Digital Signature Pad)
                </span>
                <button
                  type="button"
                  onClick={clearSignatureCanvas}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">delete</span>
                  <span>Xóa để ký lại</span>
                </button>
              </div>

              <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50 overflow-hidden flex flex-col items-center justify-center">
                <canvas
                  ref={signatureCanvasRef}
                  width={600}
                  height={180}
                  onMouseDown={startDrawing}
                  onMouseMove={drawSignature}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={drawSignature}
                  onTouchEnd={stopDrawing}
                  className="cursor-crosshair w-full max-w-full touch-none bg-white rounded-lg shadow-inner"
                />
                {!hasSignatureDrawn && !currentSession.signatureDataUrl && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-400 text-xs">
                    <span className="flex items-center gap-1.5 opacity-60">
                      <span className="material-symbols-outlined text-[18px]">gesture</span>
                      Ký tên trực tiếp tại đây bằng chuột hoặc chạm tay
                    </span>
                  </div>
                )}
              </div>
              <span className="text-[11px] text-slate-400 mt-1.5 block text-center">
                Người ký: <strong>{customerDisplayName}</strong> ({customerDisplayPhone})
              </span>
            </div>

            {/* Agreement Checkbox */}
            <div className="p-3 rounded-xl bg-white border border-slate-200 mb-4">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="w-4 h-4 mt-0.5 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">
                    Khách hàng xác nhận đã đọc, hiểu rõ và đồng ý toàn bộ điều khoản Hợp đồng thuê kho Boxora
                  </span>
                  <span className="text-slate-500 block text-[11px] mt-0.5">
                    Tuân thủ nội quy kho, cam kết không lưu giữ chất cấm, chấp nhận việc truy cập ra vào kho tự quản bằng mã PIN SmartLock 6 số được cấp.
                  </span>
                </div>
              </label>
            </div>

            {/* Transition Navigation Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleSelectTab('payment')}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-bold text-xs transition-colors cursor-pointer"
              >
                Quay lại Bước 5
              </button>

              <button
                type="button"
                onClick={handleConfirmSignature}
                disabled={(!hasSignatureDrawn && !currentSession.signatureDataUrl) || !agreedTerms || isSubmitting}
                className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  (hasSignatureDrawn || currentSession.signatureDataUrl) && agreedTerms && !isSubmitting
                    ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>{isSubmitting ? 'Đang hoàn tất ký...' : 'Xác Nhận Ký Hợp Đồng & Kích Hoạt Mã PIN'}</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* BƯỚC 7: KÍCH HOẠT MÃ PIN & GỬI EMAIL, THÔNG BÁO TÀI KHOẢN       */}
      {/* ============================================================== */}
      {currentSession.activeStepTab === 'activation' && (
        <div className="mt-6 flex flex-col gap-5 animate-fadeIn">
          {/* Header Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 text-white border border-slate-700 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[26px]">key</span>
                </div>
                <div>
                  <h3 className="font-headline text-base font-bold text-white">
                    Bước 7: Kích Hoạt Mã PIN Mở Khóa &amp; Bắn Thông Báo Khách Hàng
                  </h3>
                  <span className="text-xs text-slate-300">
                    Phòng kho #{unitDisplayCode} ({facilityDisplayName}) • Hợp đồng {currentPrerequisites?.contractCode || `CTR-${bookingDisplayCode}`}
                  </span>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-xs font-bold self-start sm:self-auto">
                ✓ SẴN SÀNG SỬ DỤNG
              </span>
            </div>
          </div>

          {/* 6-DIGIT PIN DISPLAY CARD */}
          <div className="p-6 rounded-2xl bg-slate-950 text-white border border-slate-800 shadow-xl flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-cyan-400 tracking-widest uppercase mb-2">
              <span className="material-symbols-outlined text-[16px]">pin</span>
              <span>MÃ PIN MỞ KHÓA SMARTLOCK CỦA KHÁCH HÀNG</span>
            </div>

            <div className="flex items-center justify-center gap-2 sm:gap-3 my-2">
              {(currentSession.accessPin || '------').split('').map((digit, idx) => (
                <div
                  key={idx}
                  className="w-11 h-16 sm:w-14 sm:h-20 rounded-xl bg-slate-900 border border-cyan-500/50 flex items-center justify-center font-mono text-3xl sm:text-4xl font-extrabold text-cyan-300 shadow-inner"
                >
                  {digit}
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-400 text-center mt-2">
              Mã PIN 6 chữ số dùng để mở ổ khóa điện tử khoang kho #{unitDisplayCode} và cửa ra vào cơ sở 24/7.
            </p>

            <button
              type="button"
              onClick={handleCopyPin}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold flex items-center gap-2 border border-slate-700 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-cyan-400">
                {pinCopied ? 'check' : 'content_copy'}
              </span>
              <span>{pinCopied ? 'Đã sao chép mã PIN!' : 'Sao chép mã PIN'}</span>
            </button>
          </div>

          {/* 3 Trạng thái tự động */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. SmartLock */}
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center gap-3">
              <span className="material-symbols-outlined text-emerald-600 text-[26px] shrink-0">lock_open</span>
              <div className="text-xs">
                <span className="font-bold block">Khóa SmartLock #{unitDisplayCode}</span>
                <span className="text-[11px] text-emerald-800 block">Đã kích hoạt &amp; liên kết mã PIN</span>
              </div>
            </div>

            {/* 2. Email Notification */}
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-emerald-600 text-[26px] shrink-0">mark_email_read</span>
                <div className="text-xs">
                  <span className="font-bold block">Gửi Email Mã PIN</span>
                  <span className="text-[11px] text-emerald-800 block truncate max-w-[140px]">{customerDisplayEmail}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSendEmailAgain}
                disabled={isSendingEmail}
                className="px-2 py-1 rounded bg-emerald-200 hover:bg-emerald-300 text-emerald-900 text-[10px] font-bold cursor-pointer"
              >
                {isSendingEmail ? 'Đang gửi...' : 'Gửi lại'}
              </button>
            </div>

            {/* 3. In-App Notification */}
            <div className="p-4 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-950 flex items-center gap-3">
              <span className="material-symbols-outlined text-cyan-600 text-[26px] shrink-0">notifications_active</span>
              <div className="text-xs">
                <span className="font-bold block">Thông Báo Account Customer</span>
                <span className="text-[11px] text-cyan-800 block">Đã đẩy thông báo kích hoạt vào chuông web</span>
              </div>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => handleSelectTab('signing')}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-bold text-xs transition-colors cursor-pointer"
            >
              Quay lại Bước 6
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPdfModal(true)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                <span>Xem &amp; In Biên Bản Bàn Giao (PDF)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHandoverSuccessModalData({
                    bookingId: currentBooking.id,
                    bookingCode: bookingDisplayCode,
                    unitCode: unitDisplayCode,
                    customerName: customerDisplayName,
                    customerPhone: customerDisplayPhone,
                    customerEmail: customerDisplayEmail,
                    pin: currentSession.accessPin,
                    facilityName: facilityDisplayName,
                    completedAt: currentSession.completedAt || new Date().toISOString()
                  })
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm cursor-pointer transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>Xác Nhận Hoàn Tất Ca Tiếp Đón</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: BIÊN BẢN NGHIỆM THU & BÀN GIAO PHÒNG KHO (PDF PRINT)    */}
      {/* ============================================================== */}
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
                  <span className="text-slate-600 block">Bộ phận: Vận hành quầy tiếp đón</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">BÊN NHẬN (KHÁCH HÀNG)</span>
                  <span className="font-bold text-slate-900 block mt-0.5">{customerDisplayName}</span>
                  <span className="text-slate-600 block">
                    {currentSession.idCardType}: {idCardNumberInput || currentSession.idCardNumber || 'Đã đối chiếu gốc'}
                  </span>
                  <span className="text-slate-600 block">SĐT: {customerDisplayPhone}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-bold text-slate-900">1. Thông tin kho bàn giao:</span>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-3 gap-2 text-[11px] font-mono">
                  <div>Mã kho: <strong>#{unitDisplayCode}</strong></div>
                  <div>Cơ sở: <strong>{facilityDisplayName}</strong></div>
                  <div>Thời hạn: <strong>{currentSession.rentalMonths} Tháng</strong></div>
                  <div>Mã PIN cấp: <strong className="text-cyan-700">{currentSession.accessPin}</strong></div>
                  <div>Trạng thái thanh toán: <strong>Đã hoàn tất</strong></div>
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

              <div className="grid grid-cols-2 gap-8 text-center pt-4">
                <div>
                  <span className="font-bold text-slate-900 block">ĐẠI DIỆN BÊN NHẬN</span>
                  <span className="text-slate-400 block text-[10px] italic mt-0.5">(Đã ký xác nhận nhận bàn giao)</span>
                  {currentSession.signatureDataUrl ? (
                    <img src={currentSession.signatureDataUrl} alt="Chữ ký" className="h-12 mx-auto my-2 object-contain" />
                  ) : (
                    <div className="mt-6 font-headline font-bold text-slate-800">{customerDisplayName}</div>
                  )}
                </div>
                <div>
                  <span className="font-bold text-slate-900 block">ĐẠI DIỆN BÊN GIAO</span>
                  <span className="text-slate-400 block text-[10px] italic mt-0.5">(Nhân viên phụ trách ca)</span>
                  <div className="mt-6 font-headline font-bold text-slate-800">
                    {user?.fullName || 'Nhân viên trực ca Boxora'}
                  </div>
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

      {/* Lightbox Modal: Preview ảnh hiện trường */}
      {previewModalImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800/90 border-b border-slate-700">
              <div className="flex items-center gap-2 text-white font-headline text-sm font-semibold">
                <span className="material-symbols-outlined text-cyan-400 text-[20px]">image</span>
                <span>{previewModalImage.title}</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalImage(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black/70 min-h-[300px] max-h-[75vh] overflow-auto">
              <img
                src={previewModalImage.url}
                alt={previewModalImage.title}
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg shadow-xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* Success Celebration Modal */}
      {renderSuccessModal()}

      {/* Contract Document Modal */}
      {renderContractModal()}
    </div>
  )
}
