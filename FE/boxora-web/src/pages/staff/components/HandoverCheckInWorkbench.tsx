import React, { useState, useEffect, useRef } from 'react'
import { Booking } from '../../../types'
import { handoverService, HandoverPrerequisites } from '../../../services/handoverService'
import { bookingService } from '../../../services/bookingService'
<<<<<<< Updated upstream
=======
import { contractService } from '../../../services/contractService'
import { ContractDocumentModal } from '../../../components/modals/ContractDocumentModal'
import { useAuth } from '../../../context/AuthContext'
import { storageUnitService } from '../../../services/storageUnitService'
import { StorageUnit } from '../../../types'

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
  requestedUnitCode?: string
  identityVerified: boolean
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
  requestedUnitCode: '',
  identityVerified: false,
  isCompleted: isAlreadyActive
})
>>>>>>> Stashed changes

interface HandoverCheckInWorkbenchProps {
  arrivals?: Booking[]
  onRefreshArrivals?: () => Promise<void> | void
  onHandoverComplete?: (bookingId: string) => void
  activeBookingId?: string
}

export const HandoverCheckInWorkbench: React.FC<HandoverCheckInWorkbenchProps> = ({
  arrivals: propArrivals,
  onRefreshArrivals,
  onHandoverComplete,
  activeBookingId
}) => {
<<<<<<< Updated upstream
  const [internalArrivals, setInternalArrivals] = useState<Booking[]>([])
  const [selectedBookingId, setSelectedBookingId] = useState<string>('')
  const [prerequisites, setPrerequisites] = useState<HandoverPrerequisites | null>(null)
  const [loadingPrerequisites, setLoadingPrerequisites] = useState(false)
  const [prerequisitesError, setPrerequisitesError] = useState<string | null>(null)
=======
  const { user } = useAuth()
  const resolvedRole = (typeof user?.role === 'string' ? user?.role : user?.role?.name || user?.roleName || '').toUpperCase()
  const canReceiveCheckIn = resolvedRole === 'STAFF' || resolvedRole === 'FACILITY_MANAGER'

  const [internalArrivals, setInternalArrivals] = useState<Booking[]>([])
  const [selectedBookingId, setSelectedBookingId] = useState<string>('')
  const [extraBookingDetails, setExtraBookingDetails] = useState<Record<string, Booking>>({})
  const [availableUnitChoices, setAvailableUnitChoices] = useState<StorageUnit[]>([])
>>>>>>> Stashed changes

  // Form & Hardware Inputs
  const [rfidCard, setRfidCard] = useState('RF-409')
  const [accessPin, setAccessPin] = useState('739215')
  const [pinCopied, setPinCopied] = useState(false)
  const [smsSent, setSmsSent] = useState(false)
  const [appPushSent, setAppPushSent] = useState(false)
  const [handoverNotes, setHandoverNotes] = useState('Đã đối soát đầy đủ hồ sơ tại quầy tiếp đón.')

  // Counter manual verification overrides
  const [firstMonthRentConfirmed, setFirstMonthRentConfirmed] = useState(false)
  const [contractConfirmed, setContractConfirmed] = useState(false)
  const [idCardNumber, setIdCardNumber] = useState('')
  const [identityVerified, setIdentityVerified] = useState(true)

<<<<<<< HEAD
  // 5-Point On-Site Handover Checklist
  const [checklist, setChecklist] = useState({
    doorRoll: true,
    cleanliness: true,
    lighting: true,
    fireSafety: true,
    sealPlate: true
  })
=======
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

  // Payment Proof Upload States
  const [isUploadingPaymentProof, setIsUploadingPaymentProof] = useState<boolean>(false)
  const [uploadedPaymentProofUrl, setUploadedPaymentProofUrl] = useState<string | null>(null)
  const paymentProofInputRef = useRef<HTMLInputElement | null>(null)

  const [openingDocumentUrl, setOpeningDocumentUrl] = useState<string | null>(null)
  // Identity Form States
  const [idCardType, setIdCardType] = useState<string>('CCCD')
  const [idCardInputNumber, setIdCardInputNumber] = useState<string>('')
  const [idOriginalSeen, setIdOriginalSeen] = useState<boolean>(false)
  const [idNotes, setIdNotes] = useState<string>('')
  const [isVerifyingIdentity, setIsVerifyingIdentity] = useState<boolean>(false)

  // Step Transitions
  const [isCompletingStep1, setIsCompletingStep1] = useState(false)
  const [isRecordingInspection, setIsRecordingInspection] = useState(false)

  // Evidence Photos preview & lightbox modal states
  const [doorPreviewUrl, setDoorPreviewUrl] = useState<string>('')
  const [interiorPreviewUrl, setInteriorPreviewUrl] = useState<string>('')
  const [isUploadingDoor, setIsUploadingDoor] = useState<boolean>(false)
  const [isUploadingInterior, setIsUploadingInterior] = useState<boolean>(false)
  const [previewModalImage, setPreviewModalImage] = useState<{ url: string; title: string } | null>(null)

  // Handover confirmation modal state (Hiển thị giữa màn hình confirm đã bàn giao thành công cho customer)
  const [handoverSuccessModalData, setHandoverSuccessModalData] = useState<HandoverSuccessModalData | null>(null)
  const [copiedSuccessPin, setCopiedSuccessPin] = useState<boolean>(false)
  const [selectedContractForModal, setSelectedContractForModal] = useState<RentalContract | null>(null)
  const [isLoadingContract, setIsLoadingContract] = useState<boolean>(false)
>>>>>>> dc54f515e9b5c06f6639b5efd5c5ed3a26213a2c

  // Condition Photos
  const [photoDoor, setPhotoDoor] = useState<string>('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80')
  const [photoInterior, setPhotoInterior] = useState<string>('https://images.unsplash.com/photo-1595246140625-573b715d11dc?auto=format&fit=crop&w=600&q=80')
  const doorInputRef = useRef<HTMLInputElement | null>(null)
  const interiorInputRef = useRef<HTMLInputElement | null>(null)

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [checkInError, setCheckInError] = useState<string | null>(null)
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [activeStepTab, setActiveStepTab] = useState<'audit' | 'checklist' | 'pin'>('audit')

  // Load arrivals if not provided via props
  useEffect(() => {
    if (propArrivals && propArrivals.length > 0) {
      setInternalArrivals(propArrivals)
      if (!selectedBookingId) {
        setSelectedBookingId(propArrivals[0].id)
      }
    } else {
      loadArrivals()
    }
  }, [propArrivals])

  const loadArrivals = async () => {
    try {
      const data = await bookingService.getUpcomingArrivals()
      if (data && data.length > 0) {
        setInternalArrivals(data)
        if (!selectedBookingId) {
          setSelectedBookingId(data[0].id)
        }
      }
    } catch (err) {
      console.warn('Failed to load arrivals for workbench:', err)
    }
  }

  // Sync when activeBookingId prop changes
  useEffect(() => {
    if (activeBookingId) {
      setSelectedBookingId(activeBookingId)
      setIsCompleted(false)
      setCheckInError(null)
    }
  }, [activeBookingId])

  const arrivalsList = (propArrivals && propArrivals.length > 0) ? propArrivals : internalArrivals
  const currentBooking = arrivalsList.find(b => b.id === selectedBookingId || b.bookingCode === selectedBookingId) || arrivalsList[0]

<<<<<<< Updated upstream
  // When selected booking changes, fetch real prerequisites from backend
=======
  useEffect(() => {
    if (!currentBooking?.facilityId) {
      setAvailableUnitChoices([])
      return
    }
    let cancelled = false
    storageUnitService.getUnits({ facilityId: currentBooking.facilityId })
      .then((units) => {
        if (cancelled) return
        setAvailableUnitChoices((units || []).filter((unit) =>
          unit.unitTypeId === currentBooking.unitTypeId
          && (unit.status === 'AVAILABLE' || unit.id === currentBooking.storageUnitId)
        ))
      })
      .catch(() => {
        if (!cancelled) setAvailableUnitChoices([])
      })
    return () => { cancelled = true }
  }, [currentBooking?.facilityId, currentBooking?.storageUnitId, currentBooking?.unitTypeId])

  // Permission evaluation for currently selected customer
  const isAssignedToOther = Boolean(
    currentBooking?.assignedStaffId && currentBooking.assignedStaffId !== user?.id
  )
  const isUnassigned = Boolean(currentBooking && !currentBooking.assignedStaffId && canReceiveCheckIn)

  // If selectedBookingId is not found in arrivalsList, fetch it directly from backend
>>>>>>> Stashed changes
  useEffect(() => {
    if (currentBooking?.id) {
      fetchPrerequisites(currentBooking.id)
      handleRegeneratePin()
      setIsCompleted(false)
      setCheckInError(null)
    }
  }, [currentBooking?.id])

  const fetchPrerequisites = async (bookingId: string) => {
    setLoadingPrerequisites(true)
    setPrerequisitesError(null)
    try {
      const data = await handoverService.getCheckInPrerequisites(bookingId)
      setPrerequisites(data)
      setIdCardNumber(data.idCardNumber || currentBooking?.customerPhone || '')
      setFirstMonthRentConfirmed(data.firstMonthRentSatisfied)
      setContractConfirmed(data.contractSigned)
      setIdentityVerified(data.identityVerified)
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Không thể tải điều kiện tiên quyết cho lượt đặt chỗ này'
      setPrerequisitesError(msg)
      setPrerequisites(null)
    } finally {
<<<<<<< Updated upstream
      setLoadingPrerequisites(false)
=======
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
    ''
  const unitDisplayCode =
    currentSession.requestedUnitCode ||
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

  // Effective preview photo URLs (ưu tiên local blob URL khi vừa upload, fallback sang server URL)
  const effectiveDoorPhoto = doorPreviewUrl || currentSession.photoDoor
  const effectiveInteriorPhoto = interiorPreviewUrl || currentSession.photoInterior

  // Synchronize authorized preview URLs for evidence photos
  useEffect(() => {
    let isMounted = true

    if (currentSession.photoDoor) {
      if (currentSession.photoDoor.startsWith('blob:') || currentSession.photoDoor.startsWith('data:')) {
        setDoorPreviewUrl(currentSession.photoDoor)
      } else if (selectedBookingId && currentSession.photoDoor.startsWith('/uploads/')) {
        handoverService
          .viewAuthorizedDocument(selectedBookingId, currentSession.photoDoor)
          .then((blobUrl) => {
            if (isMounted) setDoorPreviewUrl(blobUrl)
          })
          .catch((err) => {
            console.warn('Could not load authorized door photo preview:', err)
          })
      }
    } else {
      setDoorPreviewUrl('')
    }

    if (currentSession.photoInterior) {
      if (currentSession.photoInterior.startsWith('blob:') || currentSession.photoInterior.startsWith('data:')) {
        setInteriorPreviewUrl(currentSession.photoInterior)
      } else if (selectedBookingId && currentSession.photoInterior.startsWith('/uploads/')) {
        handoverService
          .viewAuthorizedDocument(selectedBookingId, currentSession.photoInterior)
          .then((blobUrl) => {
            if (isMounted) setInteriorPreviewUrl(blobUrl)
          })
          .catch((err) => {
            console.warn('Could not load authorized interior photo preview:', err)
          })
      }
    } else {
      setInteriorPreviewUrl('')
    }

    return () => {
      isMounted = false
    }
  }, [selectedBookingId, currentSession.photoDoor, currentSession.photoInterior])

  const handleSendEmail = async () => {
    const targetBookingId = currentBooking?.id || handoverSuccessModalData?.bookingId || selectedBookingId
    const targetEmail = customerDisplayEmail || handoverSuccessModalData?.customerEmail
    if (!targetBookingId) return
    if (!targetEmail) {
      setDispatchFeedback({ text: 'Không tìm thấy địa chỉ email hợp lệ của khách hàng.', isError: true })
      return
    }
    setIsSendingEmail(true)
    setDispatchFeedback(null)
    try {
      await handoverService.sendPinEmail(targetBookingId)
      updateCurrentSession({ emailSent: true })
      setDispatchFeedback({ text: `Đã gửi email thông báo mã PIN thành công đến ${targetEmail}.` })
    } catch (err: any) {
      updateCurrentSession({ emailSent: false })
      setDispatchFeedback({ text: err?.response?.data?.message || err?.message || 'Không thể gửi email thông báo mã PIN.', isError: true })
    } finally {
      setIsSendingEmail(false)
      setTimeout(() => setDispatchFeedback(null), 4000)
>>>>>>> Stashed changes
    }
  }

  // Generate new 6-digit random PIN
  const handleRegeneratePin = () => {
    const newPin = Math.floor(100000 + Math.random() * 900000).toString()
    setAccessPin(newPin)
    setPinCopied(false)
    setSmsSent(false)
    setAppPushSent(false)
  }

  const handleCopyPin = () => {
    navigator.clipboard.writeText(accessPin)
    setPinCopied(true)
    setTimeout(() => setPinCopied(false), 2000)
  }

  const handleToggleChecklist = (key: keyof typeof checklist) => {
    setChecklist(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleSelectAllChecklist = () => {
    setChecklist({
      doorRoll: true,
      cleanliness: true,
      lighting: true,
      fireSafety: true,
      sealPlate: true
    })
  }

  const checklistCount = Object.values(checklist).filter(Boolean).length
  const isAllChecklistPassed = checklistCount === 5

  // Overall check-in readiness
  const isDepositMet = prerequisites ? prerequisites.depositSatisfied : false
  const isRentMet = (prerequisites?.firstMonthRentSatisfied) || firstMonthRentConfirmed
  const isContractMet = (prerequisites?.contractSigned) || contractConfirmed
  const isIdMet = identityVerified && (idCardNumber.trim().length > 0)
  const isReadyForCheckIn = isDepositMet && isRentMet && isContractMet && isIdMet

<<<<<<< HEAD
  // Submit Handover Check-in
=======
    // 1. Tạo ngay local object URL để hiển thị tức thời cho nhân viên kiểm tra, không bị đen/lỗi
    const localBlobUrl = URL.createObjectURL(file)
    if (type === 'door') {
      setDoorPreviewUrl(localBlobUrl)
      setIsUploadingDoor(true)
    } else {
      setInteriorPreviewUrl(localBlobUrl)
      setIsUploadingInterior(true)
    }

    try {
      if (!selectedBookingId) throw new Error('Vui lòng chọn lượt nhận kho trước khi tải ảnh hiện trường.')
      const stored = await handoverService.uploadHandoverDocument(selectedBookingId, file, 'CHECKIN_EVIDENCE')
      const fileUrl = stored?.fileUrl
      if (!fileUrl) throw new Error('Upload thành công nhưng máy chủ không trả về đường dẫn tệp.')

      if (type === 'door') {
        updateCurrentSession({ photoDoor: fileUrl })
      } else {
        updateCurrentSession({ photoInterior: fileUrl })
      }
      setDispatchFeedback({ text: `Đã lưu ảnh hiện trạng ${type === 'door' ? 'cửa ngoài' : 'nền sàn bên trong'} thành công!` })
    } catch (err: any) {
      setCheckInError(err?.response?.data?.message || err?.message || 'Không thể tải ảnh nghiệm thu lên hệ thống.')
    } finally {
      if (type === 'door') setIsUploadingDoor(false)
      else setIsUploadingInterior(false)
      input.value = ''
    }
  }
  // Overall check-in readiness (P0-02 & BR-RULE-005: Backend là nguồn chân lý duy nhất)
  const isDepositMet = currentPrerequisites ? currentPrerequisites.depositSatisfied : false
  const isRentMet = currentPrerequisites ? currentPrerequisites.firstMonthRentSatisfied : false
  const isPaymentMet = isDepositMet && isRentMet
  const isContractMet = currentPrerequisites ? currentPrerequisites.contractSigned : false
  const isIdMet = currentPrerequisites ? currentPrerequisites.identityVerified : false
  const isCheckInTimeMet = currentPrerequisites ? (currentPrerequisites.checkInTimeMet ?? true) : false
  const isReadyForCheckIn = isPaymentMet && isContractMet && isIdMet && isCheckInTimeMet && (currentPrerequisites?.eligibleForInspection ?? false)

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
    setUploadedPaymentProofUrl(null)
  }, [selectedBookingId, currentPrerequisites])

  // Step Tab Navigation Guards (Protect business conditions)
  const handleSelectTab = (tab: 'audit' | 'checklist' | 'pin') => {
    if (tab === 'checklist' && !isReadyForCheckIn) {
      if (!isCheckInTimeMet) {
        setCheckInError(currentPrerequisites?.checkInTimeMessage || 'Chưa đến thời điểm check-in hợp lệ theo lịch hẹn!')
        return
      }
      setCheckInError('Cần thỏa mãn cả 3 điều kiện đối soát (Hợp đồng, bằng chứng chuyển khoản cọc & tiền thuê, CCCD gốc) và đến thời điểm check-in hợp lệ trước khi chuyển sang nghiệm thu!')
      return
    }
    if (tab === 'pin' && (!isReadyForCheckIn || !isAllChecklistPassed || !currentSession.photoDoor || !currentSession.photoInterior)) {
      setCheckInError('Cần thỏa mãn các điều kiện đối soát và đạt chuẩn 5/5 nghiệm thu hiện trường (kèm đủ 2 ảnh) trước khi chuyển sang cấp mã PIN!')
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
    if (!fileUrl) return
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      window.open(fileUrl, '_blank')
      return
    }
    if (!selectedBookingId) return
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

  const handlePaymentProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!selectedBookingId) {
      setCheckInError('Vui lòng chọn lượt nhận kho trước khi tải ảnh chuyển khoản.')
      return
    }
    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      setCheckInError('Dung lượng tệp vượt quá giới hạn cho phép (10MB).')
      return
    }

    setIsUploadingPaymentProof(true)
    setCheckInError(null)
    try {
      const res = await handoverService.uploadHandoverDocument(selectedBookingId, file, 'PAYMENT_PROOF')
      if (res?.fileUrl) {
        setUploadedPaymentProofUrl(res.fileUrl)
        setDispatchFeedback({ text: 'Đã tải lên và lưu bằng chứng chuyển khoản thành công!' })
        await fetchPrerequisitesForBooking(selectedBookingId)
      }
    } catch (err: any) {
      setCheckInError(err?.response?.data?.message || err?.message || 'Không thể tải ảnh chuyển khoản lên hệ thống.')
    } finally {
      setIsUploadingPaymentProof(false)
      e.target.value = ''
    }
  }

  const handleViewElectronicContract = async () => {
    const targetBookingId = selectedBookingId || currentBooking?.id
    if (!targetBookingId) return
    setIsLoadingContract(true)
    try {
      let contract = await contractService.getContractByBookingId(targetBookingId)
      if (!contract && currentPrerequisites) {
        contract = {
          id: currentPrerequisites.contractCode || targetBookingId,
          contractCode: currentPrerequisites.contractCode || `CTR-${bookingDisplayCode}`,
          customerId: currentBooking?.customerId || '',
          customerEmail: currentPrerequisites.customerEmail || currentBooking?.customerEmail || '',
          customerName: currentPrerequisites.customerName || currentBooking?.customerName || customerDisplayName || 'Khách hàng',
          customerPhone: currentPrerequisites.customerPhone || currentBooking?.customerPhone || customerDisplayPhone || '',
          unitCode: currentPrerequisites.unitCode || currentBooking?.unitCode || unitDisplayCode,
          facilityName: currentPrerequisites.facilityName || currentBooking?.facilityName || facilityDisplayName,
          startDate: currentBooking?.startDate || (currentBooking as any)?.expectedStartDate || new Date().toISOString(),
          endDate: currentBooking?.endDate || (currentBooking as any)?.expectedEndDate || new Date().toISOString(),
          monthlyFee: currentPrerequisites.requiredFirstMonthRent || (currentBooking as any)?.monthlyRent || (currentBooking && currentBooking.rentalMonths > 0 ? currentBooking.totalRentalFee / currentBooking.rentalMonths : 0),
          depositHeld: currentPrerequisites.depositPaid || currentBooking?.depositAmount || 0,
          status: (currentPrerequisites.contractStatus as any) || 'PENDING_ACTIVATION',
          signedDocumentUrl: currentPrerequisites.signedDocumentUrl,
          signedAt: currentPrerequisites.contractSignedAt,
          signingMethod: 'ONLINE'
        }
      }
      if (contract) {
        setSelectedContractForModal(contract)
      } else {
        setDispatchFeedback({ text: 'Không tìm thấy hồ sơ hợp đồng điện tử.', isError: true })
      }
    } catch (err) {
      if (currentPrerequisites) {
        const fallback: RentalContract = {
          id: currentPrerequisites.contractCode || targetBookingId,
          contractCode: currentPrerequisites.contractCode || `CTR-${bookingDisplayCode}`,
          customerId: currentBooking?.customerId || '',
          customerEmail: currentPrerequisites.customerEmail || currentBooking?.customerEmail || '',
          customerName: currentPrerequisites.customerName || currentBooking?.customerName || customerDisplayName || 'Khách hàng',
          customerPhone: currentPrerequisites.customerPhone || currentBooking?.customerPhone || customerDisplayPhone || '',
          unitCode: currentPrerequisites.unitCode || currentBooking?.unitCode || unitDisplayCode,
          facilityName: currentPrerequisites.facilityName || currentBooking?.facilityName || facilityDisplayName,
          startDate: currentBooking?.startDate || (currentBooking as any)?.expectedStartDate || new Date().toISOString(),
          endDate: currentBooking?.endDate || (currentBooking as any)?.expectedEndDate || new Date().toISOString(),
          monthlyFee: currentPrerequisites.requiredFirstMonthRent || (currentBooking as any)?.monthlyRent || (currentBooking && currentBooking.rentalMonths > 0 ? currentBooking.totalRentalFee / currentBooking.rentalMonths : 0),
          depositHeld: currentPrerequisites.depositPaid || currentBooking?.depositAmount || 0,
          status: (currentPrerequisites.contractStatus as any) || 'PENDING_ACTIVATION',
          signedDocumentUrl: currentPrerequisites.signedDocumentUrl,
          signedAt: currentPrerequisites.contractSignedAt,
          signingMethod: 'ONLINE'
        }
        setSelectedContractForModal(fallback)
      } else {
        setDispatchFeedback({ text: 'Lỗi khi tải thông tin hợp đồng điện tử.', isError: true })
      }
    } finally {
      setIsLoadingContract(false)
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

    // Đối chiếu với số CCCD/Passport đã lưu trong CSDL của đơn đặt giữ chỗ
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
    if (!isCheckInTimeMet) {
      setCheckInError(currentPrerequisites?.checkInTimeMessage || 'Chưa đến thời điểm check-in hợp lệ theo lịch hẹn!')
      return
    }
    setIsCompletingStep1(true)
    setCheckInError(null)
    try {
      await handoverService.completeStep1(selectedBookingId)
      await fetchPrerequisitesForBooking(selectedBookingId)
      updateCurrentSession({ activeStepTab: 'checklist' })
      setDispatchFeedback({ text: 'Đã hoàn tất đối soát 3 điều kiện! Chuyển sang bước Nghiệm thu hiện trường.' })
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể chuyển bước: Chưa đáp ứng đủ 3 điều kiện đối soát.'
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
>>>>>>> dc54f515e9b5c06f6639b5efd5c5ed3a26213a2c
  const handleCompleteHandover = async () => {
    if (!currentBooking) return
<<<<<<< Updated upstream
=======
    if (!isReadyForCheckIn) {
      setCheckInError('Chưa thỏa mãn 3 điều kiện tiên quyết (Hợp đồng, chuyển khoản cọc & thuê toàn hạn, CCCD gốc). Không thể bàn giao!')
      return
    }
    if (!isAllChecklistPassed || !currentSession.photoDoor || !currentSession.photoInterior) {
      setCheckInError('Chưa hoàn tất đạt chuẩn 5/5 tiêu chí nghiệm thu hiện trường kèm đủ 2 ảnh bằng chứng!')
      return
    }
    if (!currentSession.requestedUnitCode) {
      setCheckInError('Vui lòng xác nhận vị trí kho khách hàng muốn chọn trước khi bàn giao.')
      return
    }

>>>>>>> Stashed changes
    setIsSubmitting(true)
    setCheckInError(null)
    try {
      await handoverService.checkIn({
        bookingId: currentBooking.id,
        requestedUnitCode: currentSession.requestedUnitCode,
        recordType: 'CHECK_IN',
        idCardNumber: idCardNumber.trim() || currentBooking.customerPhone || '079198002441',
        identityVerified: true,
        firstMonthRentConfirmed: firstMonthRentConfirmed || (prerequisites?.firstMonthRentSatisfied ?? false),
        contractConfirmed: contractConfirmed || (prerequisites?.contractSigned ?? false),
        rfidCardNumber: rfidCard,
        accessPin: accessPin,
        doorConditionPassed: checklist.doorRoll,
        cleanlinessPassed: checklist.cleanliness,
        smartLockPassed: checklist.lighting,
        sensorPassed: checklist.fireSafety,
        wallStructurePassed: checklist.sealPlate,
        unitCondition: `${checklistCount}/5 tiêu chuẩn nghiệm thu đạt chuẩn (Ảnh cửa & trong kho đã lưu vết)`,
        notes: handoverNotes
      })
      setIsCompleted(true)
      if (onHandoverComplete) {
        onHandoverComplete(currentBooking.id)
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi thực hiện check-in bàn giao kho.'
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
      </div>
    )
  }

<<<<<<< Updated upstream
  const customerDisplayName = currentBooking?.customerName || prerequisites?.customerName || 'Khách hàng'
  const customerDisplayPhone = currentBooking?.customerPhone || prerequisites?.customerPhone || 'N/A'
  const unitDisplayCode = currentBooking?.unitCode || prerequisites?.unitCode || 'N/A'
  const bookingDisplayCode = currentBooking?.bookingCode || prerequisites?.bookingCode || 'N/A'
  const facilityDisplayName = currentBooking?.facilityName || prerequisites?.facilityName || 'Boxora Facility'
=======
  if (!currentBooking) {
    return (
      <>
        {renderSuccessModal()}
        {renderContractModal()}
        <div id="handover-workbench" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-left">
          {/* 1. Process Header Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm shrink-0">
              <span className="material-symbols-outlined text-[24px] text-cyan-400">verified_user</span>
            </div>
            <div>
              <h2 className="font-headline text-base sm:text-lg font-bold text-slate-900">
                Quy Trình Check-in &amp; Nghiệm Thu Bàn Giao Kho
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Chuẩn hóa 3 điều kiện tiên quyết BR-RULE-005, nghiệm thu 5 điểm, lưu trữ ảnh hiện trường và cấp mã PIN bảo mật.
              </p>
            </div>
          </div>

          {/* Empty State Card */}
          <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 shadow-xs">
              <span className="material-symbols-outlined text-[34px]">person_pin_circle</span>
            </div>
            <h3 className="font-headline text-base font-bold text-slate-900">
              Chưa Chọn Lượt Khách Tiếp Nhận Bàn Giao
            </h3>
            <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
              {arrivalsList.length > 0
                ? 'Vui lòng bấm "Tiếp nhận" hoặc chọn lượt khách bạn được phân công từ danh sách "Lịch Hẹn Nhận Kho Trong Ca" bên dưới để bắt đầu quy trình đối soát hồ sơ và bàn giao.'
                : 'Hiện tại chưa có khách hẹn nhận kho trong ca làm việc này.'}
            </p>
          </div>
        </div>
      </>
    )
  }

  if (isAssignedToOther) {
    return (
      <>
        {renderSuccessModal()}
        {renderContractModal()}
        <div id="handover-workbench" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-left">
          {/* 1. Process Header Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3.5 mb-5">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm shrink-0">
              <span className="material-symbols-outlined text-[24px] text-cyan-400">verified_user</span>
            </div>
            <div>
              <h2 className="font-headline text-base sm:text-lg font-bold text-slate-900">
                Quy Trình Check-in &amp; Nghiệm Thu Bàn Giao Kho
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Chuẩn hóa 3 điều kiện tiên quyết BR-RULE-005, nghiệm thu 5 điểm, lưu trữ ảnh hiện trường và cấp mã PIN bảo mật.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[30px]">lock_person</span>
            </div>
            <h3 className="font-headline text-base font-bold text-amber-900">
              Lượt Khách Đang Thuộc Về Nhân Viên Khác
            </h3>
            <p className="text-xs text-amber-800 mt-1.5 max-w-md leading-relaxed">
              Đơn <strong>{currentBooking.bookingCode}</strong> (Khách hàng <strong>{currentBooking.customerName}</strong>) hiện đang do nhân viên <strong>{currentBooking.assignedStaffName || 'khác'}</strong> phụ trách tiếp đón.
            </p>
            <p className="text-[11px] text-amber-700 mt-1">
              Theo quy định phân quyền, bạn chỉ được thao tác trên các đơn do bạn chủ động tiếp nhận hoặc được phân công.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedBookingId('')
                if (onSelectBooking) onSelectBooking('')
              }}
              className="mt-4 px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
              <span>Đóng Chi Tiết &amp; Quay Lại</span>
            </button>
          </div>
        </div>
      </>
    )
  }

  if (currentBooking && !canReceiveCheckIn) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-center text-sm text-slate-600">
        Tài khoản này chỉ được xem thông tin tiếp nhận. Quy trình check-in được thực hiện bởi nhân viên hoặc quản lý cơ sở.
      </div>
    )
  }

  if (isUnassigned) {
    return (
      <>
        {renderSuccessModal()}
        {renderContractModal()}
        <div id="handover-workbench" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-left">
          {/* 1. Process Header Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3.5 mb-5">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm shrink-0">
              <span className="material-symbols-outlined text-[24px] text-cyan-400">verified_user</span>
            </div>
            <div>
              <h2 className="font-headline text-base sm:text-lg font-bold text-slate-900">
                Quy Trình Check-in &amp; Nghiệm Thu Bàn Giao Kho
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Chuẩn hóa 3 điều kiện tiên quyết BR-RULE-005, nghiệm thu 5 điểm, lưu trữ ảnh hiện trường và cấp mã PIN bảo mật.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-blue-50 border border-blue-200 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[30px]">how_to_reg</span>
            </div>
            <h3 className="font-headline text-base font-bold text-blue-900">
              Chưa Tiếp Nhận Khách Hàng Này
            </h3>
            <p className="text-xs text-blue-800 mt-1.5 max-w-md leading-relaxed">
              Đơn <strong>{currentBooking.bookingCode}</strong> (Khách hàng <strong>{currentBooking.customerName}</strong>) chưa có nhân sự tiếp đón tại quầy.
            </p>
            <p className="text-[11px] text-blue-700 mt-1">
              Vui lòng bấm nút tiếp nhận bên dưới để đăng ký phụ trách khách hàng này trước khi thực hiện đối soát và bàn giao kho.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const updated = await bookingService.claimCheckInReception(currentBooking.id)
                    setInternalArrivals(prev => prev.map(b => b.id === currentBooking.id ? {
                      ...b,
                      assignedStaffId: updated.assignedStaffId || user?.id,
                      assignedStaffName: updated.assignedStaffName || user?.fullName || 'Nhân viên quầy'
                    } : b))
                    if (onRefreshArrivals) onRefreshArrivals()
                  } catch (err: any) {
                    alert(err?.response?.data?.message || 'Không thể tiếp nhận đơn này.')
                  }
                }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                <span>Tiếp Nhận Đơn Này Ngay</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedBookingId('')
                  if (onSelectBooking) onSelectBooking('')
                }}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Quay Lại
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }
>>>>>>> Stashed changes

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
<<<<<<< HEAD

        {/* Customer Quick Selector & Scan Trigger */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-slate-500 font-medium">Khách tại sảnh:</span>
            <select
              value={currentBooking?.id || ''}
              onChange={(e) => {
                setSelectedBookingId(e.target.value)
                setIsCompleted(false)
                setCheckInError(null)
              }}
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
            >
              {arrivalsList.map(b => (
                <option key={b.id} value={b.id}>
                  {b.customerName || 'Khách'} ({b.bookingCode} - {b.unitCode})
                </option>
              ))}
            </select>
          </div>

=======
        <div>
          <h2 className="font-headline text-base sm:text-lg font-bold text-slate-900">
            Quy Trình Check-in &amp; Nghiệm Thu Bàn Giao Kho
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Chuẩn hóa 3 điều kiện tiên quyết BR-RULE-005, nghiệm thu 5 điểm, lưu trữ ảnh hiện trường và cấp mã PIN bảo mật.
          </p>
>>>>>>> dc54f515e9b5c06f6639b5efd5c5ed3a26213a2c
        </div>
      </div>

      {/* 2. Customer Spotlight Profile Card */}
      <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-headline font-bold text-base shadow-xs shrink-0">
              {customerDisplayName.split(' ').map(n => n[0]).slice(-2).join('')}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-headline text-base font-bold text-slate-900">
                  {customerDisplayName}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-900 font-mono text-[11px] font-bold">
                  {bookingDisplayCode}
                </span>
                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold ${
                  currentBooking?.status === 'CONFIRMED'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  Trạng thái: {currentBooking?.status || 'CONFIRMED'}
                </span>
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
              Hợp đồng: <strong className="font-mono text-slate-900 font-bold">{prerequisites?.contractCode || 'Chưa khởi tạo'}</strong>
            </div>
            {currentBooking?.signingMethod && (
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-1.5 ${
                currentBooking.signingMethod === 'IN_PERSON'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-blue-100 text-blue-900 border border-blue-200'
              }`}>
                {currentBooking.signingMethod === 'IN_PERSON' ? '🏢 Ký Trực Tiếp Tại Kho' : '✍️ Ký Online DocuSeal'}
              </span>
            )}
          </div>
        </div>

        {/* Staff Assignment Notes from Manager */}
        {currentBooking?.staffAssignmentNotes && (
          <div className="mt-3 pt-2.5 border-t border-slate-200/80 text-xs text-amber-900 flex items-start gap-2">
            <span className="material-symbols-outlined text-[16px] text-amber-700 shrink-0 mt-0.5">
              assignment_ind
            </span>
            <div>
              <strong className="text-amber-950 font-bold">Chỉ đạo từ Quản lý cơ sở:</strong> {currentBooking.staffAssignmentNotes}
            </div>
          </div>
        )}
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
          onClick={() => setActiveStepTab('audit')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeStepTab === 'audit'
              ? 'border-cyan-600 text-cyan-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-mono text-[10px]">
            1
          </span>
          <span>Đối Soát 3 Điều Kiện</span>
          {isReadyForCheckIn && (
            <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
          )}
        </button>

        <button
          onClick={() => setActiveStepTab('checklist')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeStepTab === 'checklist'
              ? 'border-cyan-600 text-cyan-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-mono text-[10px]">
            2
          </span>
          <span>Nghiệm Thu Hiện Trường (5/5) &amp; Ảnh</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
            isAllChecklistPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
          }`}>
            {checklistCount}/5
          </span>
        </button>

        <button
          onClick={() => setActiveStepTab('pin')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeStepTab === 'pin'
              ? 'border-cyan-600 text-cyan-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-mono text-[10px]">
            3
          </span>
          <span>Cấp Mã PIN &amp; Bàn Giao</span>
          {isCompleted && (
            <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
          )}
        </button>
      </div>

      {/* Tab 1 Content: Pre-requisites Audit */}
      {activeStepTab === 'audit' && (
        <div className="mt-6 flex flex-col gap-4">
          {loadingPrerequisites ? (
            <div className="py-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[20px] animate-spin text-cyan-600">progress_activity</span>
              <span>Đang đối soát điều kiện tiên quyết từ máy chủ...</span>
            </div>
          ) : prerequisitesError ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
              <div className="font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                <span>Thông báo đối soát</span>
              </div>
              <p className="mt-1">{prerequisitesError}</p>
            </div>
          ) : (
            <>
<<<<<<< HEAD
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
=======
              {/* Thẻ Quy Tắc Nghiệp Vụ Thời Điểm Check-in */}
              {(() => {
                const checkInStatus = currentPrerequisites?.checkInTimeStatus || 'ON_TIME'
                const checkInMet = currentPrerequisites?.checkInTimeMet ?? true
                const checkInMsg = currentPrerequisites?.checkInTimeMessage || 'Đã đến thời điểm hợp lệ để nhận kho'
                const expDateStr = currentPrerequisites?.expectedCheckInAt || currentBooking?.expectedCheckInAt || currentBooking?.startDate

                let statusBadgeLabel = 'Đã đến giờ check-in'
                let actionAdvice = 'Kiểm tra các điều kiện bàn giao còn lại'
                let cardClass = 'bg-emerald-50 border-emerald-300 text-emerald-950'
                let iconName = 'verified'
                let iconColor = 'text-emerald-600'

                if (checkInStatus === 'BEFORE_DATE') {
                  statusBadgeLabel = 'Chưa đến ngày check-in'
                  actionAdvice = 'Hiển thị thời điểm được phép nhận kho • Không cho phép bàn giao'
                  cardClass = 'bg-rose-50 border-rose-300 text-rose-950'
                  iconName = 'event_busy'
                  iconColor = 'text-rose-600'
                } else if (checkInStatus === 'BEFORE_TIME') {
                  statusBadgeLabel = 'Đúng ngày nhưng chưa đến giờ'
                  actionAdvice = 'Chờ đến giờ hợp lệ • Không cho phép bàn giao'
                  cardClass = 'bg-amber-50 border-amber-300 text-amber-950'
                  iconName = 'hourglass_top'
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
                              checkInMet ? 'bg-emerald-200 text-emerald-950' : 'bg-rose-200 text-rose-950'
                            }`}>
                              {checkInMet ? 'Có thể bàn giao' : 'Không cho phép bàn giao'}
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
                  </div>
                )
              })()}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
>>>>>>> dc54f515e9b5c06f6639b5efd5c5ed3a26213a2c
                
                {/* Condition 1: Signed Contract */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    isContractMet ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    <span className="material-symbols-outlined text-[20px]">description</span>
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">1. Hợp Đồng Thuê Kho</span>
                      <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                        isContractMet ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {prerequisites?.contractSigned ? '✓ ĐÃ KÝ ĐIỆN TỬ' : (contractConfirmed ? '✓ XÁC NHẬN TẠI QUẦY' : 'CHƯA KÝ')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Mã HĐ: <strong className="font-mono text-slate-800">{prerequisites?.contractCode || 'Chưa khởi tạo'}</strong> (Trạng thái: {prerequisites?.contractStatus || 'N/A'})
                    </p>
                    {!prerequisites?.contractSigned && (
                      <label className="mt-2 flex items-center gap-2 cursor-pointer text-[11px] text-cyan-800 font-semibold bg-cyan-50/60 p-1.5 rounded-md border border-cyan-100">
                        <input
                          type="checkbox"
                          checked={contractConfirmed}
                          onChange={(e) => setContractConfirmed(e.target.checked)}
                          className="rounded text-cyan-600"
                        />
                        <span>Khách đã ký xác nhận biên bản giấy tại quầy</span>
                      </label>
                    )}
                  </div>
                </div>

<<<<<<< HEAD
                {/* Condition 2: 100% Payment (Deposit + First month) */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    isDepositMet && isRentMet ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    <span className="material-symbols-outlined text-[20px]">payments</span>
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">2. Cọc &amp; Tiền Thuê Tháng Đầu</span>
                      <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                        isDepositMet && isRentMet ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {isDepositMet && isRentMet ? '✓ ĐỦ TIỀN' : 'CHƯA THU ĐỦ'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Cọc: <strong className="font-mono">{(prerequisites?.depositPaid ?? 0).toLocaleString('vi-VN')}đ</strong> / {(prerequisites?.requiredDeposit ?? 0).toLocaleString('vi-VN')}đ • 
                      Thuê: <strong className="font-mono">{(prerequisites?.firstMonthRentPaid ?? 0).toLocaleString('vi-VN')}đ</strong> / {(prerequisites?.requiredFirstMonthRent ?? 0).toLocaleString('vi-VN')}đ
                    </p>
                    {!prerequisites?.firstMonthRentSatisfied && (
                      <label className="mt-2 flex items-center gap-2 cursor-pointer text-[11px] text-cyan-800 font-semibold bg-cyan-50/60 p-1.5 rounded-md border border-cyan-100">
                        <input
                          type="checkbox"
                          checked={firstMonthRentConfirmed}
                          onChange={(e) => setFirstMonthRentConfirmed(e.target.checked)}
                          className="rounded text-cyan-600"
                        />
                        <span>Khách đã thanh toán tiền thuê tháng đầu tại quầy (Tiền mặt/POS)</span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Condition 3: Identity Verification */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[20px]">badge</span>
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">3. Đối Chiếu CCCD / Passport Gốc</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[10px] font-bold">
                        {isIdMet ? '✓ HỢP LỆ' : 'CẦN ĐỐI SOÁT'}
=======
                {/* Điều kiện 2: Bằng Chứng Chuyển Khoản Toàn Bộ Tiền Cọc & Thuê Trong Toàn Bộ Thời Hạn */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isPaymentMet ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">payments</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 text-xs block leading-tight">
                            2. Chuyển Khoản Toàn Bộ Tiền Cọc &amp; Thuê
                          </span>
                          <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                            Bằng chứng chuyển khoản toàn bộ cọc &amp; tiền thuê toàn hạn
                          </span>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold shrink-0 ${
                          isPaymentMet
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {isPaymentMet
                          ? '✓ ĐÃ ĐỦ CỌC & THUÊ'
                          : `CÒN THIẾU ${((currentPrerequisites?.depositRemaining ?? 0) + (currentPrerequisites?.firstMonthRentRemaining ?? 0)).toLocaleString('vi-VN')}đ`}
                      </span>
                    </div>

                    {/* Financial summary: 3 columns */}
                    <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] grid grid-cols-3 gap-2 text-center">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Tổng phải thu</span>
                        <strong className="font-mono text-slate-800 text-[11px]">
                          {((currentPrerequisites?.requiredDeposit ?? 0) + (currentPrerequisites?.requiredFirstMonthRent ?? 0)).toLocaleString('vi-VN')}đ
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Đã xác nhận</span>
                        <strong className="font-mono text-emerald-700 text-[11px]">
                          {((currentPrerequisites?.depositPaid ?? 0) + (currentPrerequisites?.firstMonthRentPaid ?? 0)).toLocaleString('vi-VN')}đ
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Còn thiếu</span>
                        <strong
                          className={`font-mono text-[11px] ${
                            ((currentPrerequisites?.depositRemaining ?? 0) + (currentPrerequisites?.firstMonthRentRemaining ?? 0)) > 0
                              ? 'text-rose-600'
                              : 'text-slate-700'
                          }`}
                        >
                          {((currentPrerequisites?.depositRemaining ?? 0) + (currentPrerequisites?.firstMonthRentRemaining ?? 0)).toLocaleString('vi-VN')}đ
                        </strong>
                      </div>
                    </div>

                    {/* Breakdown cọc vs thuê */}
                    <div className="mt-2 space-y-1 text-[11px] bg-slate-50/60 p-2 rounded-lg border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          Tiền cọc giữ chỗ:
                        </span>
                        <span className="font-mono font-bold text-slate-700">
                          {(currentPrerequisites?.depositPaid ?? 0).toLocaleString('vi-VN')}đ / {(currentPrerequisites?.requiredDeposit ?? 0).toLocaleString('vi-VN')}đ
                          {isDepositMet ? (
                            <span className="text-emerald-600 ml-1">✓</span>
                          ) : (
                            <span className="text-rose-500 ml-1">(-{(currentPrerequisites?.depositRemaining ?? 0).toLocaleString('vi-VN')}đ)</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                          Tiền thuê trọn kỳ:
                        </span>
                        <span className="font-mono font-bold text-slate-700">
                          {(currentPrerequisites?.firstMonthRentPaid ?? 0).toLocaleString('vi-VN')}đ / {(currentPrerequisites?.requiredFirstMonthRent ?? 0).toLocaleString('vi-VN')}đ
                          {isRentMet ? (
                            <span className="text-emerald-600 ml-1">✓</span>
                          ) : (
                            <span className="text-rose-500 ml-1">(-{(currentPrerequisites?.firstMonthRentRemaining ?? 0).toLocaleString('vi-VN')}đ)</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Newly uploaded proof feedback banner */}
                    {uploadedPaymentProofUrl && (
                      <div className="mt-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <span className="material-symbols-outlined text-[15px] text-emerald-600">task_alt</span>
                          Ảnh chuyển khoản đã tải lên
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenAuthorizedDocument(uploadedPaymentProofUrl)}
                          disabled={openingDocumentUrl === uploadedPaymentProofUrl}
                          className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[12px]">visibility</span>
                          <span>{openingDocumentUrl === uploadedPaymentProofUrl ? '...' : 'Xem ảnh'}</span>
                        </button>
                      </div>
                    )}

                    {/* All payment transactions & receipts list */}
                    {currentPrerequisites?.paymentHistory && currentPrerequisites.paymentHistory.length > 0 && (
                      <div className="mt-2 space-y-1.5 max-h-28 overflow-y-auto pr-0.5">
                        {currentPrerequisites.paymentHistory.map((p) => (
                          <div key={p.id} className="p-1.5 rounded bg-slate-100/70 text-[10px] flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <span className={`px-1 py-0.2 rounded font-mono font-bold text-[9px] ${
                                p.paymentType === 'DEPOSIT' ? 'bg-blue-100 text-blue-800' : 'bg-cyan-100 text-cyan-800'
                              }`}>
                                {p.paymentType === 'DEPOSIT' ? 'CỌC' : 'THUÊ'}
                              </span>
                              <span className="font-mono font-bold text-slate-700">
                                {p.paymentMethod} • {p.amount.toLocaleString('vi-VN')}đ
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
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
                              <span
                                className={`px-1.5 py-0.2 rounded font-bold ${
                                  p.status === 'PAID'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : p.status === 'PENDING' || p.status === 'REFUND_PENDING'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {p.status === 'PAID' ? 'Đã duyệt' : p.status === 'PENDING' ? 'Chờ duyệt' : p.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Upload payment proof button */}
                  <div className="pt-2 border-t border-slate-100">
                    <input
                      ref={paymentProofInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={handlePaymentProofUpload}
                    />
                    <button
                      type="button"
                      onClick={() => paymentProofInputRef.current?.click()}
                      disabled={isUploadingPaymentProof}
                      className="w-full py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isUploadingPaymentProof ? 'hourglass_top' : 'upload_file'}
                      </span>
                      <span>{isUploadingPaymentProof ? 'Đang Tải Ảnh...' : 'Tải Lên / Upload Ảnh Chuyển Khoản'}</span>
                    </button>
                  </div>
                </div>

                {/* Điều kiện 3: Đối Chiếu CCCD / Passport Gốc */}
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
                          <span className="font-bold text-slate-900 text-xs block">3. Đối Chiếu CCCD / Hộ Chiếu Gốc</span>
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
>>>>>>> dc54f515e9b5c06f6639b5efd5c5ed3a26213a2c
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="text"
                        value={idCardNumber}
                        onChange={(e) => setIdCardNumber(e.target.value)}
                        placeholder="Nhập số CCCD đối chiếu..."
                        className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded text-slate-900 font-mono text-xs w-48 focus:outline-none focus:border-cyan-600"
                      />
                      <label className="flex items-center gap-1 cursor-pointer text-[11px] text-slate-600">
                        <input
                          type="checkbox"
                          checked={identityVerified}
                          onChange={(e) => setIdentityVerified(e.target.checked)}
                          className="rounded text-cyan-600"
                        />
                        <span>Đã xem bản gốc</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Condition 4: Unit Readiness */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[20px]">door_front</span>
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">4. Kho Vật Lý Đã Sẵn Sàng</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[10px] font-bold">
                        ✓ SẴN SÀNG
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Buồng kho <strong className="font-mono text-cyan-700">#{unitDisplayCode}</strong> tại {facilityDisplayName} đã vệ sinh và sẵn sàng bàn giao.
                    </p>
                  </div>
                </div>

              </div>

<<<<<<< HEAD
              {/* Prerequisites Missing Alert */}
              {prerequisites?.missingPrerequisites && prerequisites.missingPrerequisites.length > 0 && !isReadyForCheckIn && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
                  <span className="font-bold block mb-1">Hồ sơ còn thiếu các điều kiện sau:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
                    {prerequisites.missingPrerequisites.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
=======
              {/* Dynamic Missing Prerequisites Alert */}
              {currentPrerequisites?.missingPrerequisites &&
                currentPrerequisites.missingPrerequisites.length > 0 &&
                !isReadyForCheckIn && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
                    <span className="font-bold flex items-center gap-1.5 mb-1.5">
                      <span className="material-symbols-outlined text-[17px] text-amber-700">error</span>
                      <span>Hồ sơ check-in hiện chưa đủ 3 điều kiện bắt buộc:</span>
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 pl-1 font-medium">
                      {currentPrerequisites.missingPrerequisites.map((m, idx) => (
                        <li key={idx}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
>>>>>>> dc54f515e9b5c06f6639b5efd5c5ed3a26213a2c

              <div className="p-3 bg-cyan-50 border border-cyan-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-cyan-900">
                  <span className="material-symbols-outlined text-[18px] text-cyan-600">task_alt</span>
                  <span className="font-medium">
                    {isReadyForCheckIn
<<<<<<< HEAD
                      ? 'Tất cả 4/4 điều kiện tiên quyết đã sẵn sàng. Di chuyển dẫn khách thẩm định thực địa kho.'
                      : 'Vui lòng hoàn tất hoặc xác nhận thu cọc/tiền thuê và đối chiếu CCCD trước khi chuyển bước.'}
=======
                      ? 'Tất cả điều kiện đối soát và thời điểm check-in đã hoàn tất hợp lệ. Bạn có thể chuyển sang bước Nghiệm thu hiện trường.'
                      : !isCheckInTimeMet
                      ? (currentPrerequisites?.checkInTimeMessage || 'Chưa đến thời điểm check-in hợp lệ. Hệ thống không cho phép bàn giao trước thời hạn.')
                      : 'Hệ thống chặn chuyển bước và chặn cấp mã PIN cho đến khi cả 3 điều kiện trên được đáp ứng đầy đủ.'}
>>>>>>> dc54f515e9b5c06f6639b5efd5c5ed3a26213a2c
                  </span>
                </div>
                <button
                  onClick={() => setActiveStepTab('checklist')}
                  className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer shrink-0"
                >
                  <span>Nghiệm Thu Hiện Trường</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 2 Content: 5-Point On-Site Inspection & 2 Photos */}
      {activeStepTab === 'checklist' && (
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
              <label className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                checklist.doorRoll ? 'bg-cyan-50/50 border-cyan-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checklist.doorRoll}
                    onChange={() => handleToggleChecklist('doorRoll')}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">1. Cửa cuốn &amp; then chốt cơ khí</span>
                    <span className="text-slate-500 block text-[11px]">Đóng mở êm ái, then cài chắc chắn, khóa an toàn không bị kẹt rít.</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  checklist.doorRoll ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {checklist.doorRoll ? 'ĐẠT' : 'CHƯA ĐẠT'}
                </span>
              </label>

              {/* Item 2 */}
              <label className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                checklist.cleanliness ? 'bg-cyan-50/50 border-cyan-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checklist.cleanliness}
                    onChange={() => handleToggleChecklist('cleanliness')}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">2. Không gian vệ sinh &amp; độ ẩm</span>
                    <span className="text-slate-500 block text-[11px]">Sàn kho sạch sẽ, khô ráo hoàn toàn, không có rác tồn đọng hay mùi ẩm mốc.</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  checklist.cleanliness ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {checklist.cleanliness ? 'ĐẠT' : 'CHƯA ĐẠT'}
                </span>
              </label>

              {/* Item 3 */}
              <label className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                checklist.lighting ? 'bg-cyan-50/50 border-cyan-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checklist.lighting}
                    onChange={() => handleToggleChecklist('lighting')}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">3. Ổ khóa điện tử SmartLock &amp; đèn báo</span>
                    <span className="text-slate-500 block text-[11px]">Mặt khóa nhạy, bàn phím số hiển thị sắc nét, chốt cơ nhả trơn tru.</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  checklist.lighting ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {checklist.lighting ? 'ĐẠT' : 'CHƯA ĐẠT'}
                </span>
              </label>

              {/* Item 4 */}
              <label className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                checklist.fireSafety ? 'bg-cyan-50/50 border-cyan-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checklist.fireSafety}
                    onChange={() => handleToggleChecklist('fireSafety')}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">4. Đầu báo khói &amp; cảm biến nhiệt ẩm</span>
                    <span className="text-slate-500 block text-[11px]">Đầu phun Sprinkler &amp; cảm biến IoT không bị che khuất, tín hiệu bình thường.</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  checklist.fireSafety ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {checklist.fireSafety ? 'ĐẠT' : 'CHƯA ĐẠT'}
                </span>
              </label>

              {/* Item 5 */}
              <label className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                checklist.sealPlate ? 'bg-cyan-50/50 border-cyan-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checklist.sealPlate}
                    onChange={() => handleToggleChecklist('sealPlate')}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">5. Tường vách &amp; tem niêm phong</span>
                    <span className="text-slate-500 block text-[11px]">Bảng số phòng #{unitDisplayCode} rõ ràng, vách tôn không bong tróc nứt vỡ.</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  checklist.sealPlate ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {checklist.sealPlate ? 'ĐẠT' : 'CHƯA ĐẠT'}
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
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setPhotoDoor(URL.createObjectURL(file))
                  }
                }}
              />
              <input
                type="file"
                ref={interiorInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setPhotoInterior(URL.createObjectURL(file))
                  }
                }}
              />

              {/* Photo 1: Door Overview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col">
                <div className="relative aspect-video bg-slate-900 overflow-hidden">
                  <img
                    src={photoDoor}
                    alt="Ảnh Cửa Ngoài Kho"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-900/80 text-white font-mono text-[10px] backdrop-blur-xs">
                    Ảnh 1: Cửa Ngoài &amp; Bảng Số #{unitDisplayCode}
                  </div>
                </div>
                <div className="p-2.5 flex items-center justify-between bg-white text-xs">
                  <span className="text-slate-600 text-[11px] truncate">door_overview_{unitDisplayCode}.jpg</span>
                  <button
                    type="button"
                    onClick={() => doorInputRef.current?.click()}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                  >
                    Chụp lại
                  </button>
                </div>
              </div>

              {/* Photo 2: Inside Storage Unit */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col">
                <div className="relative aspect-video bg-slate-900 overflow-hidden">
                  <img
                    src={photoInterior}
                    alt="Ảnh Bên Trong Kho"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-900/80 text-white font-mono text-[10px] backdrop-blur-xs">
                    Ảnh 2: Nền Sàn &amp; Vách Trong
                  </div>
                </div>
                <div className="p-2.5 flex items-center justify-between bg-white text-xs">
                  <span className="text-slate-600 text-[11px] truncate">interior_floor_{unitDisplayCode}.jpg</span>
                  <button
                    type="button"
                    onClick={() => interiorInputRef.current?.click()}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                  >
                    Chụp lại
                  </button>
                </div>
              </div>

            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              onClick={() => setActiveStepTab('audit')}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-bold text-xs transition-colors cursor-pointer"
            >
              Quay lại Bước 1
            </button>

            <button
              onClick={() => setActiveStepTab('pin')}
              disabled={!isAllChecklistPassed}
              className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                isAllChecklistPassed
                  ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span>Chuyển sang Bước 3: Cấp PIN &amp; Bàn Giao</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>

        </div>
      )}

      {/* Tab 3 Content: Secure PIN Lock Box & Handover Completion */}
      {activeStepTab === 'pin' && (
        <div className="mt-6 flex flex-col gap-6">
          
<<<<<<< Updated upstream
=======
          {/* Prerequisites Warning Banner in Step 3 if conditions unmet */}
          {!isReadyForCheckIn && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[20px] text-amber-600 shrink-0 mt-0.5">warning</span>
              <div>
                <strong className="block font-bold">Chưa đủ điều kiện bàn giao buồng kho:</strong>
                <span>
                  Booking chưa thỏa mãn đầy đủ 3 điều kiện đối soát (Hợp đồng, chuyển khoản cọc &amp; thuê toàn hạn, CCCD đối chiếu). Hệ thống bảo mật không cho phép cấp mã PIN trước khi đáp ứng đủ quy chuẩn.
                </span>
              </div>
            </div>
          )}

          <div className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
            <label htmlFor="requested-unit-code" className="block text-xs font-bold text-cyan-950">
              Vị trí kho khách hàng mong muốn
            </label>
            <p className="mt-1 text-[11px] text-cyan-800">
              Xác nhận với khách và chọn kho trống cùng loại trước khi kích hoạt mã PIN.
            </p>
            <select
              id="requested-unit-code"
              value={currentSession.requestedUnitCode || ''}
              onChange={(event) => updateCurrentSession({ requestedUnitCode: event.target.value })}
              disabled={currentSession.isCompleted || isSubmitting}
              className="mt-2 w-full rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-cyan-600 focus:outline-none disabled:bg-slate-100"
            >
              <option value="">Chọn mã kho khách muốn nhận</option>
              {availableUnitChoices.map((unit) => (
                <option key={unit.id} value={unit.unitCode}>
                  #{unit.unitCode} · {unit.floorLevel || 'Vị trí chưa ghi tầng'} {unit.status === 'AVAILABLE' ? '· Kho trống' : '· Vị trí đang giữ cho đơn này'}
                </option>
              ))}
            </select>
            {availableUnitChoices.length === 0 && (
              <p className="mt-2 text-[11px] font-medium text-rose-700">
                Không tìm thấy kho trống cùng loại tại cơ sở này. Hãy kiểm tra tồn kho trước khi tiếp tục.
              </p>
            )}
          </div>

>>>>>>> Stashed changes
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
                  onClick={handleRegeneratePin}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                  <span>Sinh Mã Mới</span>
                </button>
                <button
                  onClick={handleCopyPin}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {pinCopied ? 'check' : 'content_copy'}
                  </span>
                  <span>{pinCopied ? 'Đã Sao Chép' : 'Sao Chép PIN'}</span>
                </button>
              </div>
            </div>

            {/* Large 6-Digit PIN Display */}
            <div className="my-6 flex flex-col items-center justify-center">
              <div className="flex items-center gap-2.5 sm:gap-3.5">
                {accessPin.split('').map((char, index) => (
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
                <span>Mã có hiệu lực ngay khi ký bàn giao • Thẻ RFID cấp phát: </span>
                <input
                  type="text"
                  value={rfidCard}
                  onChange={(e) => setRfidCard(e.target.value)}
                  className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-white rounded font-mono text-xs w-24 text-center focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Quick Dispatch Buttons */}
            <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-slate-400">
                Gửi mã xác nhận mở kho trực tiếp đến điện thoại khách hàng:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSmsSent(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    smsSent
                      ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">sms</span>
                  <span>{smsSent ? `Đã Gửi SMS (${customerDisplayPhone})` : 'Gửi SMS Cho Khách'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAppPushSent(true)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    appPushSent
                      ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">send_to_mobile</span>
                  <span>{appPushSent ? 'Đã Bắn Thông Báo App' : 'Bắn Thông Báo App'}</span>
                </button>
              </div>
            </div>
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
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                placeholder="Nhập ghi chú bàn giao nếu có (vd: Khách mượn xe đẩy, hẹn dọn đồ sau 17h)..."
                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-500">
                Khách hàng: <strong className="text-slate-800">{customerDisplayName}</strong> • CCCD: <strong className="font-mono text-slate-800">{idCardNumber || customerDisplayPhone}</strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPdfModal(true)}
                  className="px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  <span>Xem Trước Biên Bản (PDF)</span>
                </button>

                <button
                  onClick={handleCompleteHandover}
                  disabled={isSubmitting || isCompleted}
                  className={`btn-tactile px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                    isCompleted
                      ? 'bg-emerald-600 text-white'
                      : isSubmitting
                      ? 'bg-slate-400 text-white cursor-wait'
                      : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isCompleted ? 'verified' : isSubmitting ? 'hourglass_top' : 'assignment_turned_in'}
                  </span>
                  <span>
                    {isCompleted ? 'ĐÃ HOÀN TẤT BÀN GIAO' : isSubmitting ? 'Đang Xử Lý API...' : 'Xác Nhận Ký & Bàn Giao'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Success Banner if Completed */}
          {isCompleted && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">check</span>
                </div>
                <div>
                  <h4 className="font-headline text-sm font-bold text-emerald-900">
                    Bàn Giao Kho #{unitDisplayCode} Thành Công!
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
                  <span className="text-slate-600 block">CCCD: {idCardNumber || 'Đã đối chiếu'}</span>
                  <span className="text-slate-600 block">SĐT: {customerDisplayPhone}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-bold text-slate-900">1. Thông tin kho bàn giao:</span>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-3 gap-2 text-[11px] font-mono">
                  <div>Mã kho: <strong>#{unitDisplayCode}</strong></div>
                  <div>Cơ sở: <strong>{facilityDisplayName}</strong></div>
                  <div>Thời hạn: <strong>{currentBooking?.rentalMonths ?? 1} Tháng</strong></div>
                  <div>Mã PIN cấp: <strong className="text-cyan-700">{accessPin}</strong></div>
                  <div>Thẻ từ RFID: <strong>{rfidCard}</strong></div>
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
                  {handoverNotes || 'Không có ghi chú thêm.'}
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
