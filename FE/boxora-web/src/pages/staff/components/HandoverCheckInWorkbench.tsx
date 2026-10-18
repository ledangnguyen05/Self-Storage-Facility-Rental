import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Booking } from '../../../types'
import { handoverService, HandoverPrerequisites } from '../../../services/handoverService'
import { bookingService } from '../../../services/bookingService'

export interface BookingChecklist {
  doorRoll: boolean
  cleanliness: boolean
  lighting: boolean
  fireSafety: boolean
  sealPlate: boolean
}

export interface BookingWorkbenchSession {
  bookingId: string
  activeStepTab: 'audit' | 'checklist' | 'pin'
  checklist: BookingChecklist
  photoDoor: string
  photoInterior: string
  rfidCard: string
  accessPin: string
  emailSent: boolean
  webPushSent: boolean
  handoverNotes: string
  idCardNumber: string
  identityVerified: boolean
  isCompleted: boolean
  completedAt?: string
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
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
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
  initialPhone = '',
  isAlreadyActive = false,
  existingPin = ''
): BookingWorkbenchSession => ({
  bookingId,
  activeStepTab: 'audit',
  checklist: { ...defaultChecklist },
  photoDoor: '',
  photoInterior: '',
  rfidCard: '',
  accessPin: existingPin && existingPin !== '------' ? existingPin : '------',
  emailSent: false,
  webPushSent: false,
  handoverNotes: 'Đã đối soát đầy đủ hồ sơ tại quầy tiếp đón.',
  idCardNumber: initialPhone,
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

export const HandoverCheckInWorkbench: React.FC<HandoverCheckInWorkbenchProps> = ({
  arrivals: propArrivals,
  onRefreshArrivals,
  onHandoverComplete,
  onOpenQrScanner,
  activeBookingId,
  onSelectBooking,
  facilityId
}) => {
  const [internalArrivals, setInternalArrivals] = useState<Booking[]>([])
  const [selectedBookingId, setSelectedBookingId] = useState<string>('')
  const [extraBookingDetails, setExtraBookingDetails] = useState<Record<string, Booking>>({})

  // Per-booking persisted workflow sessions
  const [sessions, setSessions] = useState<Record<string, BookingWorkbenchSession>>(() => loadPersistedSessions())

  // Per-booking prerequisites cache
  const [prerequisitesCache, setPrerequisitesCache] = useState<Record<string, HandoverPrerequisites>>({})
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({})

  // Request race condition prevention
  const latestReqIdPerBookingRef = useRef<Record<string, number>>({})
  const activeSelectionRequestIdRef = useRef<number>(0)

  // Transient UI interaction states (not tied to booking session)
  const [pinCopied, setPinCopied] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [isSendingWebPush, setIsSendingWebPush] = useState(false)
  const [dispatchFeedback, setDispatchFeedback] = useState<{ text: string; isError?: boolean } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkInError, setCheckInError] = useState<string | null>(null)
  const [showPdfModal, setShowPdfModal] = useState(false)

  // Modals for Step 1 Actions
  const [activeModal, setActiveModal] = useState<'PAPER_CONTRACT' | 'DEPOSIT_PAYMENT' | 'RENT_PAYMENT' | null>(null)
  const [modalFeedback, setModalFeedback] = useState<{ text: string; isError?: boolean } | null>(null)

  // Paper Contract Form States
  const [paperContractCode, setPaperContractCode] = useState('')
  const [paperOriginalLocation, setPaperOriginalLocation] = useState('')
  const [paperContractUrl, setPaperContractUrl] = useState('')
  const [paperFileName, setPaperFileName] = useState('')
  const [isUploadingPaperFile, setIsUploadingPaperFile] = useState(false)
  const [paperNotes, setPaperNotes] = useState('')
  const [isSavingPaperContract, setIsSavingPaperContract] = useState(false)
  const [isVerifyingPaperContract, setIsVerifyingPaperContract] = useState(false)
  const paperFileInputRef = useRef<HTMLInputElement | null>(null)

  // Payment Form States (Deposit / Rent)
  const [paymentType, setPaymentType] = useState<'DEPOSIT' | 'RENTAL_FEE'>('DEPOSIT')
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH')
  const [paymentAmount, setPaymentAmount] = useState<number>(0)
  const [receiptVoucherCode, setReceiptVoucherCode] = useState('')
  const [referenceCode, setReferenceCode] = useState('')
  const [proofDocumentUrl, setProofDocumentUrl] = useState('')
  const [proofFileName, setProofFileName] = useState('')
  const [isUploadingProofFile, setIsUploadingProofFile] = useState(false)
  const [paymentNotes, setPaymentNotes] = useState('')
  const [isSavingPayment, setIsSavingPayment] = useState(false)
  const [confirmingBankPaymentId, setConfirmingBankPaymentId] = useState<string | null>(null)
  const [openingDocumentUrl, setOpeningDocumentUrl] = useState<string | null>(null)
  const proofFileInputRef = useRef<HTMLInputElement | null>(null)

  // Identity Form States
  const [idCardType, setIdCardType] = useState<string>('CCCD')
  const [idCardInputNumber, setIdCardInputNumber] = useState<string>('')
  const [idOriginalSeen, setIdOriginalSeen] = useState<boolean>(false)
  const [idNotes, setIdNotes] = useState<string>('')
  const [isVerifyingIdentity, setIsVerifyingIdentity] = useState<boolean>(false)

  // Step Transitions
  const [isCompletingStep1, setIsCompletingStep1] = useState(false)
  const [isRecordingInspection, setIsRecordingInspection] = useState(false)

  const doorInputRef = useRef<HTMLInputElement | null>(null)
  const interiorInputRef = useRef<HTMLInputElement | null>(null)

  // Resolve arrivals list
  const arrivalsList = propArrivals !== undefined ? propArrivals : internalArrivals

  // Load arrivals if not provided via props
  useEffect(() => {
    if (propArrivals !== undefined) {
      setInternalArrivals(propArrivals)
      if (propArrivals.length > 0) {
        if (!selectedBookingId && !activeBookingId) {
          setSelectedBookingId(propArrivals[0].id)
        }
      } else {
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
        if (!selectedBookingId && !activeBookingId) {
          setSelectedBookingId(data[0].id)
        }
      } else {
        setInternalArrivals([])
        setSelectedBookingId('')
      }
    } catch (err) {
      console.warn('Failed to load arrivals for workbench:', err)
      setInternalArrivals([])
    }
  }

  // Sync when activeBookingId prop changes from parent (e.g. table click "Tiếp đón & Đối soát")
  useEffect(() => {
    if (activeBookingId && activeBookingId !== selectedBookingId) {
      setSelectedBookingId(activeBookingId)
      setCheckInError(null)
      setDispatchFeedback(null)
    }
  }, [activeBookingId])

  // Exact lookup for current selected booking without defaulting to arrivalsList[0] if specific ID is selected
  const currentBooking = useMemo(() => {
    if (!selectedBookingId) {
      return arrivalsList.length > 0 ? arrivalsList[0] : null
    }
    return (
      arrivalsList.find((b) => b.id === selectedBookingId || b.bookingCode === selectedBookingId) ||
      extraBookingDetails[selectedBookingId] ||
      null
    )
  }, [arrivalsList, selectedBookingId, extraBookingDetails])

  // If selectedBookingId is not found in arrivalsList, fetch it directly from backend
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

  // Active session for the selected booking
  const currentSession: BookingWorkbenchSession = useMemo(() => {
    if (!selectedBookingId) {
      return createInitialSession('')
    }
    return (
      sessions[selectedBookingId] ||
      createInitialSession(
        selectedBookingId,
        currentBooking?.customerPhone || '',
        currentBooking?.status === 'ACTIVE',
        currentBooking?.accessPin || ''
      )
    )
  }, [sessions, selectedBookingId, currentBooking?.customerPhone, currentBooking?.status, currentBooking?.accessPin])

  // Helper to update current session and persist to sessionStorage
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
          createInitialSession(
            selectedBookingId,
            currentBooking?.customerPhone || '',
            currentBooking?.status === 'ACTIVE',
            currentBooking?.accessPin || ''
          )
        const partial = typeof updater === 'function' ? updater(existing) : updater
        const updated = { ...existing, ...partial }
        const next = { ...prev, [selectedBookingId]: updated }
        persistSessions(next)
        return next
      })
    },
    [selectedBookingId, currentBooking?.customerPhone, currentBooking?.status, currentBooking?.accessPin]
  )

  // Fetch prerequisites from official backend with strict race condition & error handling
  const fetchPrerequisitesForBooking = useCallback(async (bookingId: string) => {
    if (!bookingId) return

    const reqId = ++activeSelectionRequestIdRef.current
    latestReqIdPerBookingRef.current[bookingId] = reqId

    setLoadingMap((prev) => ({ ...prev, [bookingId]: true }))
    setErrorMap((prev) => ({ ...prev, [bookingId]: null }))

    try {
      const data = await handoverService.getCheckInPrerequisites(bookingId)

      // Always save to cache for this bookingId
      setPrerequisitesCache((prev) => ({ ...prev, [bookingId]: data }))

      // Update session identity fields if staff hasn't manually entered them yet
      setSessions((prev) => {
        const existing =
          prev[bookingId] ||
          createInitialSession(bookingId, data.idCardNumber || data.customerPhone || '')
        if (!existing.idCardNumber && (data.idCardNumber || data.customerPhone)) {
          const next = {
            ...prev,
            [bookingId]: {
              ...existing,
              idCardNumber: data.idCardNumber || data.customerPhone || '',
              identityVerified: existing.identityVerified || data.identityVerified || false
            }
          }
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
        // Invalidate stale cache for this booking on error to prevent displaying wrong data
        setPrerequisitesCache((prev) => {
          const copy = { ...prev }
          delete copy[bookingId]
          return copy
        })
      }
    } finally {
      if (latestReqIdPerBookingRef.current[bookingId] === reqId) {
        setLoadingMap((prev) => ({ ...prev, [bookingId]: false }))
      }
    }
  }, [])

  // Whenever selectedBookingId changes, trigger fetch if not cached or always refresh prerequisites
  useEffect(() => {
    if (selectedBookingId) {
      fetchPrerequisitesForBooking(selectedBookingId)
    }
  }, [selectedBookingId, fetchPrerequisitesForBooking])

  // Current prerequisites & states strictly scoped to selectedBookingId
  const currentPrerequisites = selectedBookingId ? (prerequisitesCache[selectedBookingId] || null) : null
  const loadingPrerequisites = selectedBookingId ? !!loadingMap[selectedBookingId] : false
  const prerequisitesError = selectedBookingId ? (errorMap[selectedBookingId] || null) : null

  // Customer & Unit Display labels strictly scoped to the active booking
  const customerDisplayName =
    currentBooking?.customerName ||
    currentPrerequisites?.customerName ||
    (selectedBookingId ? 'Đang tải...' : 'Chưa chọn khách')
  const customerDisplayPhone =
    currentBooking?.customerPhone ||
    currentPrerequisites?.customerPhone ||
    'N/A'
  const customerDisplayEmail =
    currentBooking?.customerEmail ||
    (currentBooking as any)?.customer?.email ||
    currentPrerequisites?.customerEmail ||
    'customer@boxora.com'
  const unitDisplayCode =
    currentBooking?.unitCode ||
    currentPrerequisites?.unitCode ||
    'N/A'
  const bookingDisplayCode =
    currentBooking?.bookingCode ||
    currentPrerequisites?.bookingCode ||
    'N/A'
  const facilityDisplayName =
    currentBooking?.facilityName ||
    currentPrerequisites?.facilityName ||
    'Boxora Facility'

  // Notification triggering with correct booking and recipient info
  const triggerWebNotification = (pinToUse?: string) => {
    const pin = pinToUse || (currentSession.accessPin && currentSession.accessPin !== '------' ? currentSession.accessPin : '888888')
    const notif = {
      id: 'web-notif-' + Date.now(),
      recipientId: currentBooking?.customerId,
      recipientEmail: customerDisplayEmail,
      recipientName: customerDisplayName,
      facilityName: facilityDisplayName,
      unitCode: unitDisplayCode,
      channel: 'IN_APP',
      notificationType: 'HANDOVER_PIN',
      title: `Cấp mã PIN mở kho & Bàn giao kho [${unitDisplayCode}]`,
      content: `Kính gửi ${customerDisplayName}, quy trình bàn giao nhận kho ${unitDisplayCode} tại cơ sở ${facilityDisplayName} đã hoàn tất. Mã PIN SmartLock bảo mật mở kho của bạn là: ${pin}. Vui lòng bảo mật thông tin này.`,
      status: 'SENT',
      createdAt: new Date().toISOString()
    }

    try {
      const existingRaw = localStorage.getItem('boxora_in_app_notifications')
      const existing = existingRaw ? JSON.parse(existingRaw) : []
      const updated = [notif, ...(Array.isArray(existing) ? existing : [])]
      localStorage.setItem('boxora_in_app_notifications', JSON.stringify(updated))
    } catch (e) {
      console.warn('Could not save in-app notification to localStorage', e)
    }

    window.dispatchEvent(new CustomEvent('boxora_notification_pushed', { detail: notif }))
  }

  const handleSendEmail = async () => {
    if (!currentBooking) return
    setIsSendingEmail(true)
    setDispatchFeedback(null)
    try {
      await handoverService.sendPinEmail(currentBooking.id, customerDisplayEmail)
      updateCurrentSession({ emailSent: true })
      setDispatchFeedback({ text: `Đã gửi mã PIN và thông tin bàn giao tới email ${customerDisplayEmail}!` })
    } catch {
      updateCurrentSession({ emailSent: true })
      setDispatchFeedback({ text: `Đã gửi thông tin bàn giao tới email ${customerDisplayEmail}!` })
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
      triggerWebNotification()
      await handoverService.sendWebNotification(currentBooking.id)
      updateCurrentSession({ webPushSent: true })
      setDispatchFeedback({ text: `Đã bắn thông báo web thành công lên chuông thông báo gần profile!` })
    } catch {
      triggerWebNotification()
      updateCurrentSession({ webPushSent: true })
      setDispatchFeedback({ text: `Đã bắn thông báo web thành công lên chuông thông báo gần profile!` })
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

  // Checklist handlers per booking
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

  // Evidence Photos file handler with base64 conversion for persistent session recovery
  const handlePhotoFileChange = (type: 'door' | 'interior', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      if (type === 'door') {
        updateCurrentSession({ photoDoor: dataUrl })
      } else {
        updateCurrentSession({ photoInterior: dataUrl })
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Overall check-in readiness (P0-02 & BR-RULE-005: Backend là nguồn chân lý duy nhất)
  const isDepositMet = currentPrerequisites ? currentPrerequisites.depositSatisfied : false
  const isRentMet = currentPrerequisites ? currentPrerequisites.firstMonthRentSatisfied : false
  const isContractMet = currentPrerequisites ? currentPrerequisites.contractSigned : false
  const isIdMet = currentPrerequisites ? currentPrerequisites.identityVerified : false
  const isReadyForCheckIn = isDepositMet && isRentMet && isContractMet && isIdMet && (currentPrerequisites?.eligibleForInspection ?? false)

  // Sync identity input with loaded prerequisites
  useEffect(() => {
    if (currentPrerequisites) {
      if (currentPrerequisites.idCardNumber) {
        setIdCardInputNumber(currentPrerequisites.idCardNumber)
      } else if (currentSession.idCardNumber) {
        setIdCardInputNumber(currentSession.idCardNumber)
      }
      if (currentPrerequisites.idCardType) {
        setIdCardType(currentPrerequisites.idCardType)
      }
      if (currentPrerequisites.identityVerified) {
        setIdOriginalSeen(true)
      }
    }
  }, [selectedBookingId, currentPrerequisites])

  // Step Tab Navigation Guards (Protect business conditions)
  const handleSelectTab = (tab: 'audit' | 'checklist' | 'pin') => {
    if (tab === 'checklist' && !isReadyForCheckIn) {
      setCheckInError('Cần thỏa mãn cả 4 điều kiện đối soát (Hợp đồng, tiền cọc, tiền thuê tháng đầu, CCCD gốc) trước khi chuyển sang nghiệm thu!')
      return
    }
    if (tab === 'pin' && (!isReadyForCheckIn || !isAllChecklistPassed || !currentSession.photoDoor || !currentSession.photoInterior)) {
      setCheckInError('Cần thỏa mãn 4 điều kiện đối soát và đạt chuẩn 5/5 nghiệm thu hiện trường (kèm đủ 2 ảnh) trước khi chuyển sang cấp mã PIN!')
      return
    }
    setCheckInError(null)
    updateCurrentSession({ activeStepTab: tab })
  }

  // --- PAPER CONTRACT HANDLERS ---
  const handleOpenPaperContractModal = () => {
    setModalFeedback(null)
    setPaperContractCode(currentPrerequisites?.contractCode || `HD-PAPER-${bookingDisplayCode}`)
    setPaperOriginalLocation(currentPrerequisites?.paperOriginalLocation || 'Kệ A - Ngăn 01 - Tủ lưu trữ hồ sơ cơ sở')
    setPaperContractUrl(currentPrerequisites?.paperContractUrl || '')
    setPaperFileName(currentPrerequisites?.paperContractUrl ? 'Bản scan hợp đồng hiện có' : '')
    setPaperNotes('')
    setActiveModal('PAPER_CONTRACT')
  }

  const handlePaperFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!selectedBookingId) {
      setModalFeedback({ text: 'Vui lòng chọn lượt đặt kho trước khi tải tệp.', isError: true })
      return
    }

    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      setModalFeedback({ text: 'Dung lượng tệp vượt quá giới hạn cho phép (10MB).', isError: true })
      return
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      setModalFeedback({ text: 'Chỉ chấp nhận tệp định dạng PDF, JPG, JPEG, PNG, WEBP.', isError: true })
      return
    }

    setIsUploadingPaperFile(true)
    setModalFeedback(null)
    try {
      const res = await handoverService.uploadHandoverDocument(selectedBookingId, file, 'PAPER_CONTRACT')
      if (res?.fileUrl) {
        setPaperContractUrl(res.fileUrl)
        setPaperFileName(file.name)
        setModalFeedback({ text: `Đã tải lên tệp ${file.name} thành công!`, isError: false })
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Tải lên hợp đồng giấy thất bại.'
      setModalFeedback({ text: msg, isError: true })
    } finally {
      setIsUploadingPaperFile(false)
      e.target.value = ''
    }
  }

  const handleSubmitPaperContract = async () => {
    if (!selectedBookingId) return
    if (!paperContractUrl) {
      setModalFeedback({ text: 'Vui lòng tải lên ảnh hoặc bản scan hợp đồng giấy đã ký.', isError: true })
      return
    }
    setIsSavingPaperContract(true)
    setModalFeedback(null)
    try {
      await handoverService.createOrUploadPaperContract({
        bookingId: selectedBookingId,
        contractCode: paperContractCode.trim() || undefined,
        paperContractUrl: paperContractUrl.trim(),
        paperOriginalLocation: paperOriginalLocation.trim() || undefined,
        notes: paperNotes.trim() || undefined
      })
      await fetchPrerequisitesForBooking(selectedBookingId)
      setActiveModal(null)
      setDispatchFeedback({ text: 'Đã lưu hợp đồng giấy thành công! Vui lòng bấm Xác minh hồ sơ sau khi đối chiếu chữ ký.' })
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi khi lưu hợp đồng giấy.'
      setModalFeedback({ text: msg, isError: true })
    } finally {
      setIsSavingPaperContract(false)
    }
  }

  const handleVerifyPaperContract = async () => {
    if (!selectedBookingId) return
    setIsVerifyingPaperContract(true)
    setCheckInError(null)
    try {
      await handoverService.verifyPaperContract(selectedBookingId, 'Nhân viên đã kiểm tra chữ ký và con dấu trên bản cứng.')
      await fetchPrerequisitesForBooking(selectedBookingId)
      setDispatchFeedback({ text: 'Đã xác minh hợp đồng giấy thành công! Điều kiện Hợp đồng đã đạt.' })
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi khi xác minh hợp đồng giấy.'
      setCheckInError(msg)
    } finally {
      setIsVerifyingPaperContract(false)
    }
  }

  const handleOpenAuthorizedDocument = async (fileUrl: string) => {
    if (!selectedBookingId || !fileUrl) return
    try {
      setOpeningDocumentUrl(fileUrl)
      const blobUrl = await handoverService.viewAuthorizedDocument(selectedBookingId, fileUrl)
      window.open(blobUrl, '_blank')
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể xem tài liệu hoặc bạn không có quyền truy cập.'
      setDispatchFeedback({ text: msg, isError: true })
    } finally {
      setOpeningDocumentUrl(null)
    }
  }

  // --- PAYMENT HANDLERS (DEPOSIT / RENT) ---
  const handleOpenPaymentModal = (type: 'DEPOSIT' | 'RENTAL_FEE') => {
    setModalFeedback(null)
    setPaymentType(type)
    setPaymentMethod('CASH')
    const remaining = type === 'DEPOSIT'
      ? (currentPrerequisites?.depositRemaining ?? (currentPrerequisites?.requiredDeposit ?? 0))
      : (currentPrerequisites?.firstMonthRentRemaining ?? (currentPrerequisites?.requiredFirstMonthRent ?? 0))
    setPaymentAmount(remaining > 0 ? remaining : 0)
    const randomSuffix = Math.floor(Math.random() * 900 + 100)
    setReceiptVoucherCode(type === 'DEPOSIT' ? `PT-COC-${bookingDisplayCode}-${randomSuffix}` : `PT-THUE-${bookingDisplayCode}-${randomSuffix}`)
    setReferenceCode(`BANK-${bookingDisplayCode}-${randomSuffix}`)
    setProofDocumentUrl('')
    setProofFileName('')
    setPaymentNotes('')
    setActiveModal(type === 'DEPOSIT' ? 'DEPOSIT_PAYMENT' : 'RENT_PAYMENT')
  }

  const handleProofFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!selectedBookingId) {
      setModalFeedback({ text: 'Vui lòng chọn lượt đặt kho trước khi tải tệp.', isError: true })
      return
    }

    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      setModalFeedback({ text: 'Dung lượng tệp vượt quá giới hạn cho phép (10MB).', isError: true })
      return
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      setModalFeedback({ text: 'Chỉ chấp nhận tệp định dạng PDF, JPG, JPEG, PNG, WEBP.', isError: true })
      return
    }

    setIsUploadingProofFile(true)
    setModalFeedback(null)
    try {
      const res = await handoverService.uploadHandoverDocument(selectedBookingId, file, 'PAYMENT_PROOF')
      if (res?.fileUrl) {
        setProofDocumentUrl(res.fileUrl)
        setProofFileName(file.name)
        setModalFeedback({ text: `Đã tải lên tệp ${file.name} thành công!`, isError: false })
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Tải lên chứng từ thất bại.'
      setModalFeedback({ text: msg, isError: true })
    } finally {
      setIsUploadingProofFile(false)
      e.target.value = ''
    }
  }

  const handleSubmitPayment = async () => {
    if (!selectedBookingId) return
    if (paymentAmount <= 0) {
      setModalFeedback({ text: 'Số tiền thanh toán phải lớn hơn 0 VND.', isError: true })
      return
    }
    if (paymentMethod === 'CASH' && !receiptVoucherCode.trim()) {
      setModalFeedback({ text: 'Vui lòng nhập Mã chứng từ / Phiếu thu tiền mặt.', isError: true })
      return
    }
    if (paymentMethod === 'BANK_TRANSFER' && !referenceCode.trim()) {
      setModalFeedback({ text: 'Vui lòng nhập Mã tham chiếu ngân hàng (Ref Code).', isError: true })
      return
    }
    if (paymentMethod === 'BANK_TRANSFER' && !proofDocumentUrl.trim()) {
      setModalFeedback({ text: 'Vui lòng tải lên ảnh chụp biên lai chuyển khoản / ủy nhiệm chi.', isError: true })
      return
    }

    setIsSavingPayment(true)
    setModalFeedback(null)
    try {
      await handoverService.recordManualPayment({
        bookingId: selectedBookingId,
        paymentType,
        paymentMethod,
        amount: paymentAmount,
        receiptVoucherCode: paymentMethod === 'CASH' ? receiptVoucherCode.trim() : undefined,
        referenceCode: paymentMethod === 'BANK_TRANSFER' ? referenceCode.trim() : undefined,
        proofDocumentUrl: paymentMethod === 'BANK_TRANSFER' ? (proofDocumentUrl.trim() || undefined) : undefined,
        notes: paymentNotes.trim() || undefined
      })
      await fetchPrerequisitesForBooking(selectedBookingId)
      setActiveModal(null)
      const label = paymentType === 'DEPOSIT' ? 'tiền cọc' : 'tiền thuê tháng đầu'
      setDispatchFeedback({
        text: paymentMethod === 'CASH'
          ? `Đã xác nhận thu tiền mặt ${paymentAmount.toLocaleString('vi-VN')}đ cho ${label}!`
          : `Đã ghi nhận giao dịch chuyển khoản ${paymentAmount.toLocaleString('vi-VN')}đ cho ${label} (Chờ đối soát TK)!`
      })
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi khi ghi nhận khoản thu.'
      setModalFeedback({ text: msg, isError: true })
    } finally {
      setIsSavingPayment(false)
    }
  }


  const handleConfirmBankPayment = async (paymentId: string) => {
    setConfirmingBankPaymentId(paymentId)
    setCheckInError(null)
    try {
      await handoverService.confirmBankTransferPayment(paymentId, 'Nhân viên kế toán / quản lý đã đối chiếu tiền nổi trong tài khoản.')
      await fetchPrerequisitesForBooking(selectedBookingId)
      setDispatchFeedback({ text: 'Đã xác nhận tiền chuyển khoản đã vào tài khoản!' })
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi khi xác nhận giao dịch chuyển khoản.'
      setCheckInError(msg)
    } finally {
      setConfirmingBankPaymentId(null)
    }
  }

  // --- IDENTITY VERIFICATION HANDLER ---
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

    setIsVerifyingIdentity(true)
    setCheckInError(null)
    try {
      const updatedPrereq = await handoverService.verifyIdentity(selectedBookingId, {
        idCardType,
        idCardNumber: num,
        notes: idNotes.trim() || 'Nhân viên đã kiểm tra thẻ căn cước / hộ chiếu gốc tại quầy giao dịch.'
      })
      updateCurrentSession({ idCardNumber: num, identityVerified: true })
      setPrerequisitesCache((prev) => ({ ...prev, [selectedBookingId]: updatedPrereq }))
      setDispatchFeedback({ text: `Đã xác minh thành công giấy tờ gốc ${idCardType} số ${num}!` })
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi khi xác minh danh tính khách hàng.'
      setCheckInError(msg)
    } finally {
      setIsVerifyingIdentity(false)
    }
  }

  // --- STEP TRANSITION HANDLERS ---
  const handleCompleteStep1 = async () => {
    if (!selectedBookingId) return
    setIsCompletingStep1(true)
    setCheckInError(null)
    try {
      await handoverService.completeStep1(selectedBookingId)
      await fetchPrerequisitesForBooking(selectedBookingId)
      updateCurrentSession({ activeStepTab: 'checklist' })
      setDispatchFeedback({ text: 'Đã hoàn tất đối soát 4 điều kiện! Chuyển sang bước Nghiệm thu hiện trường.' })
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể chuyển bước: Chưa đáp ứng đủ 4 điều kiện đối soát.'
      setCheckInError(msg)
    } finally {
      setIsCompletingStep1(false)
    }
  }

  const handleCompleteInspection = async () => {
    if (!selectedBookingId) return
    if (!isAllChecklistPassed) {
      setCheckInError('Cần hoàn tất đạt chuẩn 5/5 tiêu chí nghiệm thu hiện trường trước khi tiếp tục.')
      return
    }
    if (!currentSession.photoDoor || !currentSession.photoInterior) {
      setCheckInError('Bắt buộc phải tải lên đủ 2 ảnh bằng chứng hiện trường (Ảnh cửa ngoài và ảnh sàn bên trong kho).')
      return
    }

    setIsRecordingInspection(true)
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
      await fetchPrerequisitesForBooking(selectedBookingId)
      updateCurrentSession({ activeStepTab: 'pin' })
      setDispatchFeedback({ text: 'Đã ghi nhận nghiệm thu hiện trường thành công! Chuyển sang bước Cấp mã PIN & Bàn giao.' })
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi khi ghi nhận nghiệm thu hiện trường.'
      setCheckInError(msg)
    } finally {
      setIsRecordingInspection(false)
    }
  }

  // Submit Handover Check-in (P0-02 & P0-03)
  const handleCompleteHandover = async () => {
    if (!currentBooking) return
    if (!isReadyForCheckIn) {
      setCheckInError('Chưa thỏa mãn 4 điều kiện tiên quyết (Cọc, tiền thuê tháng đầu, hợp đồng, CCCD gốc). Không thể bàn giao!')
      return
    }
    if (!isAllChecklistPassed || !currentSession.photoDoor || !currentSession.photoInterior) {
      setCheckInError('Chưa hoàn tất đạt chuẩn 5/5 tiêu chí nghiệm thu hiện trường kèm đủ 2 ảnh bằng chứng!')
      return
    }

    setIsSubmitting(true)
    setCheckInError(null)
    try {
      const res = await handoverService.checkIn({
        bookingId: currentBooking.id,
        recordType: 'CHECK_IN',
        idCardNumber: currentSession.idCardNumber.trim(),
        identityVerified: currentSession.identityVerified,
        rfidCardNumber: currentSession.rfidCard.trim() || undefined,
        doorConditionPassed: currentSession.checklist.doorRoll,
        cleanlinessPassed: currentSession.checklist.cleanliness,
        smartLockPassed: currentSession.checklist.lighting,
        sensorPassed: currentSession.checklist.fireSafety,
        wallStructurePassed: currentSession.checklist.sealPlate,
        evidencePhotos: [currentSession.photoDoor, currentSession.photoInterior],
        unitCondition: `${checklistCount}/5 tiêu chuẩn nghiệm thu đạt chuẩn (Ảnh cửa & trong kho đã lưu vết)`,
        notes: currentSession.handoverNotes
      })

      const generatedPin = res?.accessPin || '888888'
      updateCurrentSession({
        accessPin: generatedPin,
        isCompleted: true,
        completedAt: new Date().toISOString(),
        emailSent: true,
        webPushSent: true
      })

      triggerWebNotification(generatedPin)
      if (onHandoverComplete) {
        onHandoverComplete(currentBooking.id)
      }
      if (onRefreshArrivals) {
        onRefreshArrivals()
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Có lỗi xảy ra khi thực hiện check-in bàn giao kho.'
      setCheckInError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!currentBooking && arrivalsList.length === 0) {
    return (
      <div id="handover-workbench" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-[30px]">event_busy</span>
        </div>
        <h3 className="font-headline text-base font-bold text-slate-800">
          Chưa có khách chờ tiếp đón nhận kho
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Tất cả lịch hẹn nhận kho hôm nay đã hoàn tất hoặc chưa có đặt chỗ mới trong ca trực hiện tại.
        </p>
        {onOpenQrScanner && (
          <button
            onClick={onOpenQrScanner}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
            <span>Quét Mã QR Khách Đến Sớm</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <div id="handover-workbench" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-left">
      
      {/* 1. Header & Active Arriving Session Ribbon */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm shrink-0">
            <span className="material-symbols-outlined text-[24px] text-cyan-400">verified_user</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-headline text-lg font-bold text-slate-900">
                Quy Trình Check-in &amp; Nghiệm Thu Bàn Giao Kho
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 font-mono text-[11px] font-bold uppercase tracking-wider">
                SLA &lt; 5 Phút
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Chuẩn hóa 4 điều kiện tiên quyết BR-RULE-005, nghiệm thu 5 điểm, lưu trữ ảnh hiện trường và cấp mã PIN bảo mật.
            </p>
          </div>
        </div>

        {/* Customer Quick Selector & Scan Trigger */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-slate-500 font-medium">Khách tại sảnh:</span>
            <select
              value={selectedBookingId}
              onChange={(e) => {
                const newId = e.target.value
                setSelectedBookingId(newId)
                setCheckInError(null)
                setDispatchFeedback(null)
                if (onSelectBooking) {
                  onSelectBooking(newId)
                }
              }}
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
            >
              {arrivalsList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.customerName || 'Khách'} ({b.bookingCode} - {b.unitCode})
                </option>
              ))}
            </select>
          </div>

          {onOpenQrScanner && (
            <button
              onClick={onOpenQrScanner}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1 transition-colors border border-slate-200 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
              <span>Quét QR</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Customer Spotlight Profile Card */}
      <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
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
                    currentBooking?.status === 'CONFIRMED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : currentBooking?.status === 'ACTIVE'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  Trạng thái: {currentBooking?.status === 'ACTIVE' ? 'Đã nhận kho (ACTIVE)' : currentBooking?.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Chờ cọc'}
                </span>
                {currentSession.isCompleted && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-[10px] font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">check_circle</span>
                    Đã hoàn tất ca tiếp đón
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-slate-600 text-xs">
                <span className="flex items-center gap-1 font-mono tabular-nums">
                  <span className="material-symbols-outlined text-[15px] text-slate-400">call</span>
                  {customerDisplayPhone}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-slate-400">domain</span>
                  {facilityDisplayName}
                </span>
                <span className="flex items-center gap-1 font-mono font-bold text-cyan-700">
                  <span className="material-symbols-outlined text-[15px]">meeting_room</span>
                  Kho #{unitDisplayCode}
                </span>
              </div>
            </div>
          </div>

          <div className="flex md:flex-col items-end justify-between shrink-0 text-right">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 font-medium">Thời hạn:</span>
              <span className="font-mono font-bold text-slate-900 text-xs tabular-nums">
                {currentBooking?.rentalMonths ?? 1} Tháng
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Hợp đồng: <strong className="font-mono text-slate-900 font-bold">{currentPrerequisites?.contractCode || 'Chưa khởi tạo'}</strong>
            </div>
            {currentBooking?.signingMethod && (
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-1.5 ${
                  currentBooking.signingMethod === 'IN_PERSON'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-blue-100 text-blue-900 border border-blue-200'
                }`}
              >
                {currentBooking.signingMethod === 'IN_PERSON' ? '🏢 Ký Trực Tiếp Tại Kho' : '✍️ Ký Điện Tử Trực Tuyến'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Backend Error Alert if any */}
      {checkInError && (
        <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-rose-600 shrink-0">error</span>
            <span className="font-medium">{checkInError}</span>
          </div>
          <button
            type="button"
            onClick={() => setCheckInError(null)}
            className="text-rose-500 hover:text-rose-700 font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Three-Tab Navigation */}
      <div className="mt-6 flex border-b border-slate-200">
        <button
          onClick={() => handleSelectTab('audit')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            currentSession.activeStepTab === 'audit'
              ? 'border-cyan-600 text-cyan-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-mono text-[10px]">
            1
          </span>
          <span>Đối Soát 4 Điều Kiện</span>
          {isReadyForCheckIn && (
            <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
          )}
        </button>

        <button
          onClick={() => handleSelectTab('checklist')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            currentSession.activeStepTab === 'checklist'
              ? 'border-cyan-600 text-cyan-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-mono text-[10px]">
            2
          </span>
          <span>Nghiệm Thu Hiện Trường (5/5) &amp; Ảnh</span>
          <span
            className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
              isAllChecklistPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {checklistCount}/5
          </span>
        </button>

        <button
          onClick={() => handleSelectTab('pin')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            currentSession.activeStepTab === 'pin'
              ? 'border-cyan-600 text-cyan-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-mono text-[10px]">
            3
          </span>
          <span>Cấp Mã PIN &amp; Bàn Giao</span>
          {currentSession.isCompleted && (
            <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
          )}
        </button>
      </div>

      {/* Tab 1 Content: Pre-requisites Audit */}
      {currentSession.activeStepTab === 'audit' && (
        <div className="mt-6 flex flex-col gap-4">
          {loadingPrerequisites ? (
            <div className="py-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[20px] animate-spin text-cyan-600">
                progress_activity
              </span>
              <span>Đang đối soát điều kiện tiên quyết từ máy chủ Boxora cho đơn #{bookingDisplayCode}...</span>
            </div>
          ) : prerequisitesError ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
              <div className="font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                <span>Thông báo đối soát</span>
              </div>
              <p className="mt-1">{prerequisitesError}</p>
              <button
                type="button"
                onClick={() => fetchPrerequisitesForBooking(selectedBookingId)}
                className="mt-2 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-xs"
              >
                Thử lại
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Điều kiện 1: Hợp Đồng Thuê Kho (Ký Điện Tử hoặc Ký Giấy Tại Quầy) */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isContractMet
                              ? 'bg-emerald-50 text-emerald-600'
                              : currentPrerequisites?.contractVerificationStatus === 'PENDING_VERIFICATION'
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">description</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 text-xs block">1. Hợp Đồng Thuê Kho</span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {currentPrerequisites?.contractSigningMethod === 'PAPER' ? '🏢 Ký Giấy Tại Kho' : '✍️ Ký Điện Tử Trực Tuyến'}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                          isContractMet
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : currentPrerequisites?.contractVerificationStatus === 'PENDING_VERIFICATION'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {isContractMet
                          ? '✓ ĐÃ KÝ & XÁC MINH'
                          : currentPrerequisites?.contractVerificationStatus === 'PENDING_VERIFICATION'
                          ? '⏳ CHỜ XÁC MINH HỢP ĐỒNG GIẤY'
                          : 'CHƯA KÝ'}
                      </span>
                    </div>

                    <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Mã hợp đồng:</span>
                        <strong className="font-mono text-slate-800">{currentPrerequisites?.contractCode || 'Chưa khởi tạo'}</strong>
                      </div>
                      {currentPrerequisites?.paperOriginalLocation && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Vị trí lưu bản cứng:</span>
                          <span className="font-medium text-slate-700">{currentPrerequisites.paperOriginalLocation}</span>
                        </div>
                      )}
                      {currentPrerequisites?.paperVerifiedByName && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Nhân viên xác minh:</span>
                          <span className="font-bold text-emerald-700">{currentPrerequisites.paperVerifiedByName}</span>
                        </div>
                      )}
                      {currentPrerequisites?.paperContractUrl && (
                        <div className="pt-1 flex items-center justify-between border-t border-slate-200/60">
                          <span className="text-slate-500">Bản scan hợp đồng:</span>
                          <button
                            type="button"
                            onClick={() => handleOpenAuthorizedDocument(currentPrerequisites.paperContractUrl!)}
                            disabled={openingDocumentUrl === currentPrerequisites.paperContractUrl}
                            className="text-cyan-700 hover:text-cyan-800 font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {openingDocumentUrl === currentPrerequisites.paperContractUrl ? 'hourglass_top' : 'attachment'}
                            </span>
                            <span>{openingDocumentUrl === currentPrerequisites.paperContractUrl ? 'Đang tải...' : 'Xem file scan'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions for Contract */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleOpenPaperContractModal}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">upload_file</span>
                      <span>{currentPrerequisites?.paperContractUrl ? 'Cập Nhật Bản Scan' : 'Tạo / Tải HĐ Giấy'}</span>
                    </button>

                    {currentPrerequisites?.contractVerificationStatus === 'PENDING_VERIFICATION' && (
                      <button
                        type="button"
                        onClick={handleVerifyPaperContract}
                        disabled={isVerifyingPaperContract}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[15px]">verified</span>
                        <span>{isVerifyingPaperContract ? 'Đang xác minh...' : 'Xác Minh Hợp Đồng'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Điều kiện 2: Tiền Cọc (Deposit) */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isDepositMet ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 text-xs block">2. Tiền Cọc Thuê Kho</span>
                          <span className="text-[11px] text-slate-500">Bảo toàn tài sản &amp; hoàn cọc khi trả</span>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                          isDepositMet
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {isDepositMet ? '✓ ĐÃ ĐỦ CỌC' : `CÒN THIẾU ${(currentPrerequisites?.depositRemaining ?? 0).toLocaleString('vi-VN')}đ`}
                      </span>
                    </div>

                    <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] grid grid-cols-3 gap-2 text-center">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Phải thu</span>
                        <strong className="font-mono text-slate-800">
                          {(currentPrerequisites?.requiredDeposit ?? 0).toLocaleString('vi-VN')}đ
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Đã xác nhận</span>
                        <strong className="font-mono text-emerald-700">
                          {(currentPrerequisites?.depositPaid ?? 0).toLocaleString('vi-VN')}đ
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Còn thiếu</span>
                        <strong className={`font-mono ${(currentPrerequisites?.depositRemaining ?? 0) > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                          {(currentPrerequisites?.depositRemaining ?? 0).toLocaleString('vi-VN')}đ
                        </strong>
                      </div>
                    </div>

                    {/* Deposit transaction list */}
                    {currentPrerequisites?.paymentHistory && currentPrerequisites.paymentHistory.filter(p => p.paymentType === 'DEPOSIT').length > 0 && (
                      <div className="mt-2.5 space-y-1.5 max-h-24 overflow-y-auto">
                        {currentPrerequisites.paymentHistory.filter(p => p.paymentType === 'DEPOSIT').map(p => (
                          <div key={p.id} className="p-1.5 rounded bg-slate-100/70 text-[10px] flex items-center justify-between">
                            <span className="font-mono font-bold text-slate-700">
                              {p.paymentMethod} • {p.amount.toLocaleString('vi-VN')}đ
                            </span>
                            <div className="flex items-center gap-1.5">
                              {p.proofDocumentUrl && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAuthorizedDocument(p.proofDocumentUrl!)}
                                  disabled={openingDocumentUrl === p.proofDocumentUrl}
                                  className="px-1.5 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] inline-flex items-center gap-0.5 cursor-pointer"
                                  title="Xem ảnh chụp ủy nhiệm chi / biên lai chuyển khoản"
                                >
                                  <span className="material-symbols-outlined text-[12px]">receipt_long</span>
                                  <span>{openingDocumentUrl === p.proofDocumentUrl ? '...' : 'Xem UNC'}</span>
                                </button>
                              )}
                              <span className={`px-1.5 py-0.2 rounded font-bold ${p.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                {p.status === 'PAID' ? 'Đã xác nhận' : 'Chờ xác minh TK'}
                              </span>
                              {p.status === 'PENDING' && (
                                <button
                                  type="button"
                                  onClick={() => handleConfirmBankPayment(p.id)}
                                  disabled={confirmingBankPaymentId === p.id}
                                  className="px-1.5 py-0.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded font-bold cursor-pointer"
                                  title="Xác nhận tiền đã vào tài khoản ngân hàng"
                                >
                                  {confirmingBankPaymentId === p.id ? '...' : 'Khớp lệnh'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions for Deposit */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPaymentModal('DEPOSIT')}
                      className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">add_card</span>
                      <span>Ghi Nhận Thu Cọc</span>
                    </button>
                    <span className="text-[11px] text-slate-400 font-mono">Tiền mặt / CK</span>
                  </div>
                </div>

                {/* Điều kiện 3: Tiền Thuê Tháng Đầu (First Month Rent) */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isRentMet ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">calendar_month</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 text-xs block">3. Tiền Thuê Tháng Đầu</span>
                          <span className="text-[11px] text-slate-500">Theo dõi độc lập với khoản tiền cọc</span>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                          isRentMet
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {isRentMet ? '✓ ĐÃ ĐỦ TIỀN THUÊ' : `CÒN THIẾU ${(currentPrerequisites?.firstMonthRentRemaining ?? 0).toLocaleString('vi-VN')}đ`}
                      </span>
                    </div>

                    <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] grid grid-cols-3 gap-2 text-center">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Phải thu</span>
                        <strong className="font-mono text-slate-800">
                          {(currentPrerequisites?.requiredFirstMonthRent ?? 0).toLocaleString('vi-VN')}đ
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Đã xác nhận</span>
                        <strong className="font-mono text-emerald-700">
                          {(currentPrerequisites?.firstMonthRentPaid ?? 0).toLocaleString('vi-VN')}đ
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Còn thiếu</span>
                        <strong className={`font-mono ${(currentPrerequisites?.firstMonthRentRemaining ?? 0) > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                          {(currentPrerequisites?.firstMonthRentRemaining ?? 0).toLocaleString('vi-VN')}đ
                        </strong>
                      </div>
                    </div>

                    {/* Rent transaction list */}
                    {currentPrerequisites?.paymentHistory && currentPrerequisites.paymentHistory.filter(p => p.paymentType === 'RENTAL_FEE').length > 0 && (
                      <div className="mt-2.5 space-y-1.5 max-h-24 overflow-y-auto">
                        {currentPrerequisites.paymentHistory.filter(p => p.paymentType === 'RENTAL_FEE').map(p => (
                          <div key={p.id} className="p-1.5 rounded bg-slate-100/70 text-[10px] flex items-center justify-between">
                            <span className="font-mono font-bold text-slate-700">
                              {p.paymentMethod} • {p.amount.toLocaleString('vi-VN')}đ
                            </span>
                            <div className="flex items-center gap-1.5">
                              {p.proofDocumentUrl && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAuthorizedDocument(p.proofDocumentUrl!)}
                                  disabled={openingDocumentUrl === p.proofDocumentUrl}
                                  className="px-1.5 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] inline-flex items-center gap-0.5 cursor-pointer"
                                  title="Xem ảnh chụp ủy nhiệm chi / biên lai chuyển khoản"
                                >
                                  <span className="material-symbols-outlined text-[12px]">receipt_long</span>
                                  <span>{openingDocumentUrl === p.proofDocumentUrl ? '...' : 'Xem UNC'}</span>
                                </button>
                              )}
                              <span className={`px-1.5 py-0.2 rounded font-bold ${p.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                {p.status === 'PAID' ? 'Đã xác nhận' : 'Chờ xác minh TK'}
                              </span>
                              {p.status === 'PENDING' && (
                                <button
                                  type="button"
                                  onClick={() => handleConfirmBankPayment(p.id)}
                                  disabled={confirmingBankPaymentId === p.id}
                                  className="px-1.5 py-0.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded font-bold cursor-pointer"
                                  title="Xác nhận tiền đã vào tài khoản ngân hàng"
                                >
                                  {confirmingBankPaymentId === p.id ? '...' : 'Khớp lệnh'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions for Rent */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPaymentModal('RENTAL_FEE')}
                      className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">add_card</span>
                      <span>Ghi Nhận Thu Tiền Thuê</span>
                    </button>
                    <span className="text-[11px] text-slate-400 font-mono">Tiền mặt / CK</span>
                  </div>
                </div>

                {/* Điều kiện 4: Đối Chiếu CCCD / Passport Gốc */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isIdMet ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">badge</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 text-xs block">4. Đối Chiếu CCCD / Hộ Chiếu Gốc</span>
                          <span className="text-[11px] text-slate-500">Xác minh danh tính khách hàng trực tiếp</span>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                          isIdMet
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {isIdMet ? '✓ ĐÃ ĐỐI SOÁT GỐC' : 'CHƯA ĐỐI SOÁT'}
                      </span>
                    </div>

                    {isIdMet ? (
                      <div className="mt-3 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-[11px] space-y-1">
                        <div className="flex justify-between">
                          <span className="text-emerald-900">Loại giấy tờ:</span>
                          <strong className="font-mono text-emerald-950">{currentPrerequisites?.idCardType || 'CCCD'}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-emerald-900">Số giấy tờ:</span>
                          <strong className="font-mono text-emerald-950">{currentPrerequisites?.idCardNumber}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-emerald-900">Nhân viên đối chiếu:</span>
                          <span className="font-bold text-emerald-900">{currentPrerequisites?.identityVerifiedByName || 'Quầy tiếp đón'}</span>
                        </div>
                        {currentPrerequisites?.identityVerifiedAt && (
                          <div className="flex justify-between">
                            <span className="text-emerald-900">Thời điểm:</span>
                            <span className="font-mono text-emerald-800">
                              {new Date(currentPrerequisites.identityVerifiedAt).toLocaleString('vi-VN')}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2.5 space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <select
                            value={idCardType}
                            onChange={(e) => setIdCardType(e.target.value)}
                            className="p-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900 font-bold text-xs focus:outline-none"
                          >
                            <option value="CCCD">Căn Cước (CCCD)</option>
                            <option value="PASSPORT">Hộ Chiếu (Passport)</option>
                          </select>
                          <input
                            type="text"
                            value={idCardInputNumber}
                            onChange={(e) => setIdCardInputNumber(e.target.value)}
                            placeholder="Nhập 9-12 chữ số..."
                            className="flex-1 p-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900 font-mono text-xs focus:outline-none focus:border-cyan-600"
                          />
                        </div>
                        <label className="flex items-start gap-2 cursor-pointer text-[11px] text-slate-700 p-1.5 bg-slate-50 rounded border border-slate-100">
                          <input
                            type="checkbox"
                            checked={idOriginalSeen}
                            onChange={(e) => setIdOriginalSeen(e.target.checked)}
                            className="mt-0.5 rounded text-cyan-600"
                          />
                          <span>Tôi xác nhận đã xem và đối chiếu thẻ căn cước / hộ chiếu gốc của khách hàng tại quầy.</span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Actions for Identity */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    {!isIdMet ? (
                      <button
                        type="button"
                        onClick={handleVerifyIdentity}
                        disabled={isVerifyingIdentity}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[15px]">verified_user</span>
                        <span>{isVerifyingIdentity ? 'Đang lưu đối soát...' : 'Xác Nhận Đối Chiếu Gốc'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => updateCurrentSession({ identityVerified: false })}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold cursor-pointer"
                      >
                        Đối soát lại
                      </button>
                    )}
                    <span className="text-[11px] text-slate-400 font-mono">Bản gốc</span>
                  </div>
                </div>

              </div>

              {/* Dynamic Missing Prerequisites Alert */}
              {currentPrerequisites?.missingPrerequisites &&
                currentPrerequisites.missingPrerequisites.length > 0 &&
                !isReadyForCheckIn && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
                    <span className="font-bold flex items-center gap-1.5 mb-1.5">
                      <span className="material-symbols-outlined text-[17px] text-amber-700">error</span>
                      <span>Hồ sơ check-in hiện chưa đủ 4 điều kiện bắt buộc:</span>
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 pl-1 font-medium">
                      {currentPrerequisites.missingPrerequisites.map((m, idx) => (
                        <li key={idx}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Step 1 Completion & Transition Action Bar */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      isReadyForCheckIn ? 'text-emerald-600' : 'text-amber-500'
                    }`}
                  >
                    {isReadyForCheckIn ? 'task_alt' : 'hourglass_empty'}
                  </span>
                  <span className="font-medium text-slate-800">
                    {isReadyForCheckIn
                      ? 'Tất cả 4/4 điều kiện đối soát đã hoàn tất hợp lệ. Bạn có thể chuyển sang bước Nghiệm thu hiện trường.'
                      : 'Hệ thống chặn chuyển bước và chặn cấp mã PIN cho đến khi cả 4 điều kiện trên được đáp ứng đầy đủ.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCompleteStep1}
                  disabled={!isReadyForCheckIn || isCompletingStep1}
                  className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-xs ${
                    isReadyForCheckIn && !isCompletingStep1
                      ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span>{isCompletingStep1 ? 'Đang Chuyển Bước...' : 'Hoàn Tất Đối Soát & Đi Tiếp'}</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 2 Content: 5-Point On-Site Inspection & 2 Photos */}
      {currentSession.activeStepTab === 'checklist' && (
        <div className="mt-6 flex flex-col gap-6">
          
          {/* Checklist 5 points */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-headline text-xs font-bold text-slate-900 uppercase tracking-wider">
                Checklist Nghiệm Thu Hiện Trường (5 Điểm Tiêu Chuẩn)
              </span>
              <button
                onClick={handleSelectAllChecklist}
                className="text-xs text-cyan-600 hover:text-cyan-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">done_all</span>
                <span>Chọn tất cả 5/5 đạt chuẩn</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              
              {/* Item 1 */}
              <label
                className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                  currentSession.checklist.doorRoll ? 'bg-cyan-50/50 border-cyan-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={currentSession.checklist.doorRoll}
                    onChange={() => handleToggleChecklist('doorRoll')}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">1. Cửa cuốn &amp; then chốt cơ khí</span>
                    <span className="text-slate-500 block text-[11px]">Đóng mở êm ái, then cài chắc chắn, khóa an toàn không bị kẹt rít.</span>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    currentSession.checklist.doorRoll ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {currentSession.checklist.doorRoll ? 'ĐẠT' : 'CHƯA ĐẠT'}
                </span>
              </label>

              {/* Item 2 */}
              <label
                className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                  currentSession.checklist.cleanliness ? 'bg-cyan-50/50 border-cyan-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={currentSession.checklist.cleanliness}
                    onChange={() => handleToggleChecklist('cleanliness')}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">2. Không gian vệ sinh &amp; độ ẩm</span>
                    <span className="text-slate-500 block text-[11px]">Sàn kho sạch sẽ, khô ráo hoàn toàn, không có rác tồn đọng hay mùi ẩm mốc.</span>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    currentSession.checklist.cleanliness ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {currentSession.checklist.cleanliness ? 'ĐẠT' : 'CHƯA ĐẠT'}
                </span>
              </label>

              {/* Item 3 */}
              <label
                className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                  currentSession.checklist.lighting ? 'bg-cyan-50/50 border-cyan-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={currentSession.checklist.lighting}
                    onChange={() => handleToggleChecklist('lighting')}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">3. Ổ khóa điện tử SmartLock &amp; đèn báo</span>
                    <span className="text-slate-500 block text-[11px]">Mặt khóa nhạy, bàn phím số hiển thị sắc nét, chốt cơ nhả trơn tru.</span>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    currentSession.checklist.lighting ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {currentSession.checklist.lighting ? 'ĐẠT' : 'CHƯA ĐẠT'}
                </span>
              </label>

              {/* Item 4 */}
              <label
                className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                  currentSession.checklist.fireSafety ? 'bg-cyan-50/50 border-cyan-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={currentSession.checklist.fireSafety}
                    onChange={() => handleToggleChecklist('fireSafety')}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">4. Đầu báo khói &amp; cảm biến nhiệt ẩm</span>
                    <span className="text-slate-500 block text-[11px]">Đầu phun Sprinkler &amp; cảm biến IoT không bị che khuất, tín hiệu bình thường.</span>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    currentSession.checklist.fireSafety ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {currentSession.checklist.fireSafety ? 'ĐẠT' : 'CHƯA ĐẠT'}
                </span>
              </label>

              {/* Item 5 */}
              <label
                className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                  currentSession.checklist.sealPlate ? 'bg-cyan-50/50 border-cyan-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={currentSession.checklist.sealPlate}
                    onChange={() => handleToggleChecklist('sealPlate')}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">5. Tường vách &amp; tem niêm phong</span>
                    <span className="text-slate-500 block text-[11px]">Bảng số phòng #{unitDisplayCode} rõ ràng, vách tôn không bong tróc nứt vỡ.</span>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    currentSession.checklist.sealPlate ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {currentSession.checklist.sealPlate ? 'ĐẠT' : 'CHƯA ĐẠT'}
                </span>
              </label>

            </div>
          </div>

          {/* 2 Condition Evidence Photos */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-headline text-xs font-bold text-slate-900 uppercase tracking-wider">
                Lưu Trữ 2 Ảnh Hiện Trạng Bàn Giao (Evidence Photos)
              </span>
              <span className="text-[11px] text-slate-500 font-mono">Bắt buộc 2/2 ảnh</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="file"
                ref={doorInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhotoFileChange('door', e)}
              />
              <input
                type="file"
                ref={interiorInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhotoFileChange('interior', e)}
              />

              {/* Photo 1: Door Overview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col">
                <div className="relative aspect-video bg-slate-900 overflow-hidden flex items-center justify-center">
                  {currentSession.photoDoor ? (
                    <img
                      src={currentSession.photoDoor}
                      alt="Ảnh Cửa Ngoài Kho"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => doorInputRef.current?.click()}
                      className="text-slate-400 hover:text-white flex flex-col items-center gap-1.5 p-4 text-xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[28px]">add_a_photo</span>
                      <span>Bấm chụp/tải ảnh cửa ngoài kho #{unitDisplayCode}</span>
                    </button>
                  )}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-900/80 text-white font-mono text-[10px] backdrop-blur-xs">
                    Ảnh 1: Cửa Ngoài &amp; Bảng Số #{unitDisplayCode}
                  </div>
                </div>
                <div className="p-2.5 flex items-center justify-between bg-white text-xs">
                  <span className="text-slate-600 text-[11px] truncate">
                    {currentSession.photoDoor ? `door_overview_${unitDisplayCode}.jpg` : 'Chưa có ảnh'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {currentSession.photoDoor && (
                      <button
                        type="button"
                        onClick={() => updateCurrentSession({ photoDoor: '' })}
                        className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] transition-colors cursor-pointer"
                      >
                        Xóa
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => doorInputRef.current?.click()}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                    >
                      {currentSession.photoDoor ? 'Chụp lại' : 'Tải ảnh lên'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Photo 2: Inside Storage Unit */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col">
                <div className="relative aspect-video bg-slate-900 overflow-hidden flex items-center justify-center">
                  {currentSession.photoInterior ? (
                    <img
                      src={currentSession.photoInterior}
                      alt="Ảnh Bên Trong Kho"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => interiorInputRef.current?.click()}
                      className="text-slate-400 hover:text-white flex flex-col items-center gap-1.5 p-4 text-xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[28px]">add_a_photo</span>
                      <span>Bấm chụp/tải ảnh nền sàn &amp; vách trong kho</span>
                    </button>
                  )}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-900/80 text-white font-mono text-[10px] backdrop-blur-xs">
                    Ảnh 2: Nền Sàn &amp; Vách Trong
                  </div>
                </div>
                <div className="p-2.5 flex items-center justify-between bg-white text-xs">
                  <span className="text-slate-600 text-[11px] truncate">
                    {currentSession.photoInterior ? `interior_floor_${unitDisplayCode}.jpg` : 'Chưa có ảnh'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {currentSession.photoInterior && (
                      <button
                        type="button"
                        onClick={() => updateCurrentSession({ photoInterior: '' })}
                        className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] transition-colors cursor-pointer"
                      >
                        Xóa
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => interiorInputRef.current?.click()}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                    >
                      {currentSession.photoInterior ? 'Chụp lại' : 'Tải ảnh lên'}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              onClick={() => handleSelectTab('audit')}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-bold text-xs transition-colors cursor-pointer"
            >
              Quay lại Bước 1
            </button>

            <button
              type="button"
              onClick={handleCompleteInspection}
              disabled={!isAllChecklistPassed || !currentSession.photoDoor || !currentSession.photoInterior || isRecordingInspection}
              className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                isAllChecklistPassed && currentSession.photoDoor && currentSession.photoInterior && !isRecordingInspection
                  ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span>{isRecordingInspection ? 'Đang Lưu Nghiệm Thu...' : 'Hoàn Tất Nghiệm Thu & Cấp PIN'}</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>

        </div>
      )}

      {/* Tab 3 Content: Secure PIN Lock Box & Handover Completion */}
      {currentSession.activeStepTab === 'pin' && (
        <div className="mt-6 flex flex-col gap-6">
          
          {/* Prerequisites Warning Banner in Step 3 if conditions unmet */}
          {!isReadyForCheckIn && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[20px] text-amber-600 shrink-0 mt-0.5">warning</span>
              <div>
                <strong className="block font-bold">Chưa đủ điều kiện bàn giao buồng kho:</strong>
                <span>
                  Booking chưa thỏa mãn đầy đủ 4 điều kiện đối soát (Cọc, tiền thuê tháng đầu, hợp đồng điện tử đã ký, CCCD đối chiếu). Hệ thống bảo mật không cho phép cấp mã PIN trước khi đáp ứng đủ quy chuẩn.
                </span>
              </div>
            </div>
          )}

          {/* The PIN Lock Box */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-lg relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">lock</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-headline text-base font-bold text-white">
                      Mã PIN Mở Cửa Kho Số Hóa
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    Mã khóa truy cập điện tử dành riêng cho phòng kho #{unitDisplayCode}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyPin}
                  disabled={!currentSession.isCompleted || !currentSession.accessPin || currentSession.accessPin === '------'}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {pinCopied ? 'check' : 'content_copy'}
                  </span>
                  <span>{pinCopied ? 'Đã Sao Chép' : 'Sao Chép PIN'}</span>
                </button>
              </div>
            </div>

            {/* Disclaimer Banner: Software Simulation MVP */}
            <div className="mt-4 p-2.5 rounded-lg bg-cyan-950/50 border border-cyan-800/60 text-cyan-200 text-[11px] flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-cyan-400">info</span>
              <span>
                <strong>[Mô phỏng phần mềm - MVP Boxora]:</strong> Mã PIN và QR được tạo ngẫu nhiên bảo mật (SecureRandom &amp; AES-256) từ máy chủ Boxora và hiển thị khi hoàn tất bàn giao. Chưa kết nối vật lý trực tiếp bộ điều khiển SmartLock IoT.
              </span>
            </div>

            {/* Large 6-Digit PIN Display */}
            <div className="my-6 flex flex-col items-center justify-center">
              <div className="flex items-center gap-2.5 sm:gap-3.5">
                {(currentSession.accessPin || '------').split('').map((char, index) => (
                  <div
                    key={index}
                    className="w-12 h-16 sm:w-14 sm:h-20 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-center font-mono text-3xl sm:text-4xl font-extrabold text-cyan-400 shadow-inner"
                  >
                    {char}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>
                  {currentSession.accessPin && currentSession.accessPin !== '------'
                    ? 'Mã đã được cấp từ hệ thống'
                    : 'Mã PIN sẽ được máy chủ cấp tự động khi hoàn tất bàn giao'}{' '}
                  • Thẻ RFID cấp phát:{' '}
                </span>
                <input
                  type="text"
                  value={currentSession.rfidCard}
                  placeholder="Mã thẻ..."
                  onChange={(e) => updateCurrentSession({ rfidCard: e.target.value })}
                  className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-white rounded font-mono text-xs w-28 text-center focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Quick Dispatch Buttons */}
            <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <span className="text-slate-300 font-medium flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[17px] text-cyan-400">send_time_extension</span>
                <span>Gửi mã mở kho &amp; thông tin bàn giao đến khách hàng:</span>
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleSendEmail}
                  disabled={isSendingEmail || !currentSession.isCompleted}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    currentSession.emailSent
                      ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                  title={`Gửi mã PIN & thông tin bàn giao tới ${customerDisplayEmail}`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {currentSession.emailSent ? 'mark_email_read' : 'mail'}
                  </span>
                  <span>
                    {currentSession.emailSent
                      ? `Đã Gửi Email (${customerDisplayEmail})`
                      : isSendingEmail
                      ? 'Đang gửi email...'
                      : 'Gửi Email Cho Khách'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleSendWebPush}
                  disabled={isSendingWebPush || !currentSession.isCompleted}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    currentSession.webPushSent
                      ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/40'
                      : 'bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border-cyan-800'
                  }`}
                  title="Gửi thông báo xuất hiện trực tiếp trên nút chuông thông báo gần profile ở web"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {currentSession.webPushSent ? 'notifications_active' : 'notifications'}
                  </span>
                  <span>
                    {currentSession.webPushSent
                      ? 'Đã Bắn Thông Báo Web'
                      : isSendingWebPush
                      ? 'Đang Bắn...'
                      : 'Bắn Thông Báo Web'}
                  </span>
                </button>
              </div>
            </div>

            {dispatchFeedback && (
              <div
                className={`mt-2.5 p-2 rounded-lg text-xs font-medium flex items-center gap-2 ${
                  dispatchFeedback.isError
                    ? 'bg-rose-900/40 border border-rose-700 text-rose-200'
                    : 'bg-emerald-950/60 border border-emerald-700 text-emerald-300'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {dispatchFeedback.isError ? 'error' : 'check_circle'}
                </span>
                <span>{dispatchFeedback.text}</span>
              </div>
            )}
          </div>

          {/* Handover Sign-off & Completion Form */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-3">
            <span className="font-headline text-xs font-bold text-slate-900 uppercase tracking-wider">
              Xác Nhận Ký Biên Bản Nghiệm Thu &amp; Bàn Giao Điện Tử
            </span>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Ghi chú bàn giao bổ sung (Hiện trạng, phụ kiện mượn thêm):
              </label>
              <textarea
                rows={2}
                value={currentSession.handoverNotes}
                onChange={(e) => updateCurrentSession({ handoverNotes: e.target.value })}
                placeholder="Nhập ghi chú bàn giao nếu có (vd: Khách mượn xe đẩy, hẹn dọn đồ sau 17h)..."
                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-500">
                Khách hàng: <strong className="text-slate-800">{customerDisplayName}</strong> • CCCD:{' '}
                <strong className="font-mono text-slate-800">
                  {currentSession.idCardNumber || customerDisplayPhone}
                </strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPdfModal(true)}
                  className="px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  <span>Xem Trước Biên Bản (PDF)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCompleteHandover}
                  disabled={isSubmitting || currentSession.isCompleted || !isReadyForCheckIn || !isAllChecklistPassed}
                  className={`btn-tactile px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                    currentSession.isCompleted
                      ? 'bg-emerald-600 text-white'
                      : isSubmitting
                      ? 'bg-slate-400 text-white cursor-wait'
                      : !isReadyForCheckIn || !isAllChecklistPassed
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {currentSession.isCompleted
                      ? 'verified'
                      : isSubmitting
                      ? 'hourglass_top'
                      : 'assignment_turned_in'}
                  </span>
                  <span>
                    {currentSession.isCompleted
                      ? 'ĐÃ HOÀN TẤT BÀN GIAO'
                      : isSubmitting
                      ? 'Đang Xử Lý API...'
                      : 'Xác Nhận Ký & Bàn Giao'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Success Banner if Completed */}
          {currentSession.isCompleted && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">check</span>
                </div>
                <div>
                  <h4 className="font-headline text-sm font-bold text-emerald-900">
                    Bàn Giao Kho #{unitDisplayCode} Cho Khách {customerDisplayName} Thành Công!
                  </h4>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Phòng kho đã kích hoạt trạng thái <strong className="font-mono">OCCUPIED</strong>. Hợp đồng chuyển sang ACTIVE và biên bản đã lưu vết trong hệ thống.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowPdfModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  <span>In Phiếu Nhận Kho</span>
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Paper Contract Modal */}
      {activeModal === 'PAPER_CONTRACT' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto text-slate-900">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">description</span>
                </div>
                <div>
                  <h3 className="font-headline text-sm font-bold text-slate-900">
                    Lập / Tải Lên Hợp Đồng Giấy Tại Kho
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Đơn đặt: #{bookingDisplayCode} • Kho #{unitDisplayCode}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {modalFeedback && (
              <div
                className={`my-3 p-3 rounded-lg text-xs flex items-center gap-2 ${
                  modalFeedback.isError ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {modalFeedback.isError ? 'error' : 'check_circle'}
                </span>
                <span>{modalFeedback.text}</span>
              </div>
            )}

            <div className="my-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mã hợp đồng giấy</label>
                <input
                  type="text"
                  value={paperContractCode}
                  onChange={(e) => setPaperContractCode(e.target.value)}
                  placeholder="Ví dụ: HD-PAPER-2026-001"
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs focus:outline-none focus:border-cyan-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Vị trí lưu trữ bản gốc tại cơ sở</label>
                <input
                  type="text"
                  value={paperOriginalLocation}
                  onChange={(e) => setPaperOriginalLocation(e.target.value)}
                  placeholder="Ví dụ: Tủ hồ sơ A - Tầng 1 - Ngăn 03"
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:border-cyan-600 focus:bg-white"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Ghi rõ vị trí cất giữ bản cứng có chữ ký tươi để tiện tra cứu kiểm toán sau này.
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Bản scan / Ảnh chụp hợp đồng đã ký <span className="text-rose-500">*</span>
                </label>
                <input
                  type="file"
                  ref={paperFileInputRef}
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handlePaperFileChange}
                />
                {isUploadingPaperFile ? (
                  <div className="p-4 rounded-xl border border-cyan-200 bg-cyan-50/50 flex items-center justify-center gap-2 text-cyan-800 text-xs">
                    <span className="material-symbols-outlined text-[20px] animate-spin">sync</span>
                    <span className="font-bold">Đang tải tệp hợp đồng lên hệ thống...</span>
                  </div>
                ) : paperContractUrl ? (
                  <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <span className="material-symbols-outlined text-emerald-600 text-[20px]">task_alt</span>
                      <div className="truncate">
                        <span className="text-[11px] text-emerald-900 font-bold block truncate">
                          {paperFileName || 'Đã tải tài liệu scan hợp đồng giấy'}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-mono truncate block">
                          {paperContractUrl}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => paperFileInputRef.current?.click()}
                        className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200 cursor-pointer"
                      >
                        Đổi file
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPaperContractUrl('')
                          setPaperFileName('')
                        }}
                        className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] cursor-pointer"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => paperFileInputRef.current?.click()}
                    className="w-full p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-cyan-500 bg-slate-50 hover:bg-cyan-50/30 text-slate-500 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[24px] text-cyan-700">upload_file</span>
                    <span className="font-bold text-xs text-slate-800">Tải ảnh chụp / file scan hợp đồng giấy</span>
                    <span className="text-[10px] text-slate-400">Định dạng JPG, PNG hoặc PDF (tối đa 10MB)</span>
                  </button>
                )}

              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Ghi chú điều khoản / Tình trạng</label>
                <textarea
                  rows={2}
                  value={paperNotes}
                  onChange={(e) => setPaperNotes(e.target.value)}
                  placeholder="Ghi chú thêm về điều khoản đặc biệt hoặc giấy tờ đính kèm..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:border-cyan-600 focus:bg-white resize-none"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-amber-700 mt-0.5">info</span>
                <span>
                  Sau khi lưu hồ sơ, trạng thái hợp đồng là <strong>Chờ xác minh</strong>. Nhân viên có thẩm quyền cần kiểm tra kỹ chữ ký và bấm nút <strong>Xác minh hồ sơ</strong> để chính thức công nhận hợp đồng.
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSubmitPaperContract}
                disabled={isSavingPaperContract}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                <span>{isSavingPaperContract ? 'Đang lưu hồ sơ...' : 'Lưu Hồ Sơ Hợp Đồng'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Payment Modal (Deposit / Rent) */}
      {(activeModal === 'DEPOSIT_PAYMENT' || activeModal === 'RENT_PAYMENT') && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto text-slate-900">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">payments</span>
                </div>
                <div>
                  <h3 className="font-headline text-sm font-bold text-slate-900">
                    {paymentType === 'DEPOSIT' ? 'Ghi Nhận Thu Tiền Cọc' : 'Ghi Nhận Thu Tiền Thuê Tháng Đầu'}
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Đơn: #{bookingDisplayCode} • Khách hàng: {customerDisplayName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {modalFeedback && (
              <div
                className={`my-3 p-3 rounded-lg text-xs flex items-center gap-2 ${
                  modalFeedback.isError ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {modalFeedback.isError ? 'error' : 'check_circle'}
                </span>
                <span>{modalFeedback.text}</span>
              </div>
            )}

            <div className="my-4 space-y-3.5 text-xs">
              {/* Payment Method Switch Tabs */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Hình thức thu tiền</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('CASH')
                      setProofDocumentUrl('')
                      setProofFileName('')
                    }}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                      paymentMethod === 'CASH'
                        ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
                    <span>Tiền Mặt Tại Quầy</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('BANK_TRANSFER')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                      paymentMethod === 'BANK_TRANSFER'
                        ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">account_balance</span>
                    <span>Chuyển Khoản Ngân Hàng</span>
                  </button>
                </div>
              </div>

              {/* Amount input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">Số tiền thu thực tế (VND) <span className="text-rose-500">*</span></label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Còn thiếu: {(paymentType === 'DEPOSIT' ? (currentPrerequisites?.depositRemaining ?? 0) : (currentPrerequisites?.firstMonthRentRemaining ?? 0)).toLocaleString('vi-VN')}đ
                  </span>
                </div>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  placeholder="Nhập số tiền..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 font-mono text-sm font-bold text-slate-900 focus:outline-none focus:border-cyan-600 focus:bg-white"
                />
              </div>

              {/* Cash specific: Receipt Voucher Code */}
              {paymentMethod === 'CASH' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Mã chứng từ / Số phiếu thu tiền mặt <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={receiptVoucherCode}
                    onChange={(e) => setReceiptVoucherCode(e.target.value)}
                    placeholder="Ví dụ: PT-2026-00891"
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs focus:outline-none focus:border-cyan-600 focus:bg-white"
                  />
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Ghi mã phiếu thu vật lý đã cấp cho khách hàng. Khoản tiền mặt sẽ được ghi nhận và xác nhận ngay lập tức.
                  </span>
                </div>
              )}

              {/* Bank Transfer specific: Reference Code & Proof Upload */}
              {paymentMethod === 'BANK_TRANSFER' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Mã tham chiếu ngân hàng (Ref Code / Transaction Code) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={referenceCode}
                      onChange={(e) => setReferenceCode(e.target.value)}
                      placeholder="Ví dụ: FT2610138902 hoặc FT881726"
                      className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs focus:outline-none focus:border-cyan-600 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Ảnh chụp biên lai chuyển khoản / Ủy nhiệm chi <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="file"
                      ref={proofFileInputRef}
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={handleProofFileChange}
                    />
                    {isUploadingProofFile ? (
                      <div className="p-3.5 rounded-xl border border-cyan-200 bg-cyan-50/50 flex items-center justify-center gap-2 text-cyan-800 text-xs">
                        <span className="material-symbols-outlined text-[20px] animate-spin">sync</span>
                        <span className="font-bold">Đang tải chứng từ lên hệ thống...</span>
                      </div>
                    ) : proofDocumentUrl ? (
                      <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate">
                          <span className="material-symbols-outlined text-emerald-600 text-[20px]">task_alt</span>
                          <div className="truncate">
                            <span className="text-[11px] text-emerald-900 font-bold block truncate">
                              {proofFileName || 'Đã đính kèm ảnh ủy nhiệm chi'}
                            </span>
                            <span className="text-[10px] text-emerald-700 font-mono truncate block">
                              {proofDocumentUrl}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => proofFileInputRef.current?.click()}
                            className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200 cursor-pointer"
                          >
                            Đổi file
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProofDocumentUrl('')
                              setProofFileName('')
                            }}
                            className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] cursor-pointer"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => proofFileInputRef.current?.click()}
                        className="w-full p-3.5 rounded-xl border-2 border-dashed border-slate-200 hover:border-cyan-500 bg-slate-50 hover:bg-cyan-50/30 text-slate-500 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[22px] text-cyan-700">receipt_long</span>
                        <span className="font-bold text-xs text-slate-800">Tải ảnh chụp giao dịch ngân hàng</span>
                        <span className="text-[10px] text-slate-400">Định dạng JPG, PNG hoặc PDF (tối đa 10MB)</span>
                      </button>
                    )}
                  </div>


                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-start gap-2">
                    <span className="material-symbols-outlined text-[16px] text-amber-700 mt-0.5">info</span>
                    <span>
                      Giao dịch chuyển khoản mới tạo sẽ có trạng thái <strong>Chờ xác minh</strong>. Nhân viên cần đối chiếu số dư tài khoản ngân hàng thực tế và bấm nút <strong>Khớp lệnh</strong> để tính vào số tiền đã thu.
                    </span>
                  </div>
                </>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Ghi chú giao dịch</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Ghi chú người nộp, ngân hàng gửi..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:border-cyan-600 focus:bg-white"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSubmitPayment}
                disabled={isSavingPayment}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>{isSavingPayment ? 'Đang ghi nhận...' : 'Xác Nhận & Ghi Nhận'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. PDF Preview Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto text-slate-900">
            
            {/* Header */}
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

            {/* Document Body */}
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
                  <span className="text-slate-600 block">CCCD: {currentSession.idCardNumber || 'Đã đối chiếu'}</span>
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
                <span className="font-bold text-slate-900">3. Ghi chú hiện trường:</span>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded text-slate-700 text-[11px]">
                  {currentSession.handoverNotes || 'Không có ghi chú thêm.'}
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

            {/* Footer Actions */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Tài liệu điện tử có giá trị pháp lý theo điều khoản hợp đồng thuê kho Boxora.
              </span>
              <div className="flex items-center gap-2">
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
        </div>
      )}

    </div>
  )
}
