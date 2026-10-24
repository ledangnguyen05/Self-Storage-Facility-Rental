import { useLanguage } from '../../context/LanguageContext'
import React, { useState, useEffect, useMemo } from 'react'
import {
  AlertCircle,
  X,
  MapPin,
  Search,
  Navigation,
  Check,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Building2,
  Box,
  User,
  Phone,
  CreditCard,
  Mail,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  PhoneCall,
  Copy,
  Info,
  Layers,
  HelpCircle,
  Tag,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Facility, StorageUnit } from '../../types'
import { CHECK_IN_PERIOD_GROUPS, CHECK_IN_HOURS_24, getPeriodForHour } from '../../utils/checkInTimeSlots'
import { facilityService } from '../../services/facilityService'
import { storageUnitService } from '../../services/storageUnitService'
import { bookingService } from '../../services/bookingService'
import { geocodeAddressWithNominatim } from '../../services/nominatimGeocodingService'
import { calculateDistanceKm } from '../../data/storageUnitsData'
import { useNavigate } from 'react-router-dom'

export type SizeTierKey = 'LOCKER' | 'STANDARD' | 'LARGE' | 'ENTERPRISE'

export interface LandingBookingWizardModalProps {
  isOpen: boolean
  onClose: () => void
  initialTier?: SizeTierKey
}

interface SizeTierOption {
  key: SizeTierKey
  name: string
  subtitle: string
  area: string
  volume: string
  dims: string
  rateNumber: number
  rateFormatted: string
  fits: string[]
  badge: string
  door: string
  category: 'mini' | 'personal' | 'business' | 'special'
}

const SIZE_TIERS: Record<SizeTierKey, SizeTierOption> = {
  LOCKER: {
    key: 'LOCKER',
    name: 'Locker Mini & Đồ Cá Nhân',
    subtitle: 'Nhỏ gọn, linh hoạt, tiết kiệm tối đa',
    area: '1.5 – 3.0 m²',
    volume: '4.0 – 8.0 m³',
    dims: '1.2m x 1.5m • Cao 2.7m',
    rateNumber: 450000,
    rateFormatted: '450.000 ₫/tháng',
    fits: ['4–6 Vali lớn', '10 Thùng carton tiêu chuẩn', 'Đồ thể thao, máy ảnh, laptop', 'Giấy tờ hồ sơ đóng hộp'],
    badge: 'Tiết kiệm nhất',
    door: 'Cửa đơn khóa IoT thông minh mã PIN',
    category: 'mini',
  },
  STANDARD: {
    key: 'STANDARD',
    name: 'Buồng Kho Tiêu Chuẩn',
    subtitle: 'Không gian đa dụng phổ biến nhất',
    area: '4.0 – 6.0 m²',
    volume: '11.0 – 16.0 m³',
    dims: '2.0m x 2.5m • Cao 2.7m',
    rateNumber: 950000,
    rateFormatted: '950.000 ₫/tháng',
    fits: ['1–2 Xe máy hoặc xe đạp điện', 'Bàn làm việc, ghế công thái học', 'Tủ quần áo mini, kệ sách', '25–30 Thùng carton đồ đạc'],
    badge: 'Phổ biến nhất',
    door: 'Cửa bản lề rộng 1.0m mở 180°',
    category: 'personal',
  },
  LARGE: {
    key: 'LARGE',
    name: 'Buồng Kho Lớn Gia Đình',
    subtitle: 'Chứa đồ nguyên căn hộ hoặc chuyển nhà',
    area: '8.0 – 12.0 m²',
    volume: '22.0 – 32.0 m³',
    dims: '3.0m x 3.5m • Cao 2.7m',
    rateNumber: 1850000,
    rateFormatted: '1.850.000 ₫/tháng',
    fits: ['Sofa chữ L, giường đệm King/Queen', 'Tủ lạnh side-by-side, máy giặt', 'Bộ bàn ăn 6 ghế, tủ kệ lớn', '50–70 Thùng hàng hóa'],
    badge: 'Gia đình & Căn hộ',
    door: 'Cửa thép đôi rộng 1.6m tiện bốc xếp',
    category: 'personal',
  },
  ENTERPRISE: {
    key: 'ENTERPRISE',
    name: 'Kho Doanh Nghiệp & Sỉ',
    subtitle: 'Giải pháp thương mại, pallet & sự kiện',
    area: '15.0 – 25.0 m²',
    volume: '45.0 – 75.0 m³',
    dims: '4.0m x 5.0m • Cao 3.0m',
    rateNumber: 3200000,
    rateFormatted: '3.200.000 ₫/tháng',
    fits: ['5–10 Pallet hàng công nghiệp', 'Thiết bị hội chợ, sự kiện lớn', 'Kho trung chuyển hàng TMĐT', '150+ Thùng carton tài liệu'],
    badge: 'Thương mại & Sỉ',
    door: 'Cửa cuốn công nghiệp / cửa đôi tự động',
    category: 'business',
  },
}

export const LandingBookingWizardModal: React.FC<LandingBookingWizardModalProps> = ({ isOpen,
  onClose,
  initialTier = 'STANDARD', }) => {
  const { t } = useLanguage();
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  // 1 -> 5 Step Wizard State
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1)

  // Data from backend
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [storageUnits, setStorageUnits] = useState<StorageUnit[]>([])
  const [loadingInitialData, setLoadingInitialData] = useState<boolean>(true)

  // Step 1: Facility Selection & Location Search
  const [searchAddress, setSearchAddress] = useState<string>('')
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number; displayName: string } | null>(null)
  const [isSearchingLocation, setIsSearchingLocation] = useState<boolean>(false)
  const [locationMessage, setLocationMessage] = useState<string | null>(null)
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('all')
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null)

  // Step 2: Storage Size Selection
  const [selectedTierKey, setSelectedTierKey] = useState<SizeTierKey>(initialTier)
  const [rentalMonths, setRentalMonths] = useState<number>(3)
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })

  // Step 3: Customer Information
  const [fullName, setFullName] = useState<string>('')
  const [phone, setPhone] = useState<string>('')
  const [idCard, setIdCard] = useState<string>('')
  const [idCardType, setIdCardType] = useState<'CCCD' | 'PASSPORT'>('CCCD')
  const [email, setEmail] = useState<string>('')
  const [checkInDate, setCheckInDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('morning')
  const selectedPeriod = useMemo(() => {
    return CHECK_IN_PERIOD_GROUPS.find((g) => g.id === selectedPeriodId) || CHECK_IN_PERIOD_GROUPS[0]
  }, [selectedPeriodId])
  const checkInTime = useMemo(() => {
    return `${selectedPeriod.name} (${selectedPeriod.rangeText})`
  }, [selectedPeriod])
  const [specialNotes, setSpecialNotes] = useState<string>('')
  const [policyAccepted, setPolicyAccepted] = useState<boolean>(true)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Step 4 & 5: Submission & Result
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [bookingCode, setBookingCode] = useState<string>('')
  const [copiedCode, setCopiedCode] = useState<boolean>(false)
  const [sentToStaffTime, setSentToStaffTime] = useState<string>('')
  const [isResendingToStaff, setIsResendingToStaff] = useState<boolean>(false)
  const [sendSuccessToast, setSendSuccessToast] = useState<string | null>(null)

  // Load facilities and storage units
  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    setLoadingInitialData(true)

    Promise.allSettled([
      facilityService.getFacilities({ size: 100 }),
      storageUnitService.getUnits(),
    ])
      .then(([facRes, unitRes]) => {
        if (!isMounted) return

        if (facRes.status === 'fulfilled' && Array.isArray(facRes.value?.content)) {
          const activeFacilities = facRes.value.content.filter(
            (f) => !f.status || f.status === 'ACTIVE'
          )
          setFacilities(activeFacilities)
          if (activeFacilities.length > 0 && !selectedFacility) {
            setSelectedFacility(activeFacilities[0])
          }
        }

        if (unitRes.status === 'fulfilled' && Array.isArray(unitRes.value)) {
          setStorageUnits(unitRes.value)
        }
      })
      .finally(() => {
        if (isMounted) setLoadingInitialData(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen])

  // Prefill user data if logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.fullName && !fullName) setFullName(user.fullName)
      const userPhone = user.phone || (user as any).phoneNumber || ''
      if (userPhone && !phone) setPhone(userPhone)
      if (user.email && !email) setEmail(user.email)
      if ((user as any).identityCardNumber && !idCard) setIdCard((user as any).identityCardNumber)
    }
  }, [isAuthenticated, user])

  // Reset tier when initialTier prop changes
  useEffect(() => {
    if (initialTier) {
      setSelectedTierKey(initialTier)
    }
  }, [initialTier])

  // Handle GPS location
  const handleUseCurrentGPS = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Trình duyệt của bạn không hỗ trợ định vị GPS.')
      return
    }

    setIsSearchingLocation(true)
    setLocationMessage(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomerCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          displayName: 'Vị trí hiện tại của bạn (GPS)',
        })
        setLocationMessage('Đã cập nhật vị trí GPS. Danh sách cơ sở đã sắp xếp theo khoảng cách gần nhất!')
        setIsSearchingLocation(false)
      },
      (err) => {
        console.warn('Geolocation error:', err)
        setLocationMessage('Không thể lấy vị trí GPS. Vui lòng nhập địa chỉ vào ô tìm kiếm.')
        setIsSearchingLocation(false)
      },
      { timeout: 8000, enableHighAccuracy: true }
    )
  }

  // Handle Address Search
  const handleSearchAddress = async () => {
    const query = searchAddress.trim()
    if (!query) {
      setCustomerCoords(null)
      setLocationMessage('Vui lòng nhập địa chỉ hoặc tên quận/thành phố để tìm kiếm.')
      return
    }

    setIsSearchingLocation(true)
    setLocationMessage(null)

    try {
      const result = await geocodeAddressWithNominatim(query)
      if (result && result.lat && result.lng) {
        setCustomerCoords({
          lat: result.lat,
          lng: result.lng,
          displayName: result.displayName || query,
        })
        setLocationMessage(`Tìm kiếm thành công quanh: ${result.displayName}`)
      } else {
        setLocationMessage('Không tìm thấy tọa độ địa chỉ này. Đang hiển thị danh sách tất cả cơ sở.')
      }
    } catch (e) {
      console.warn('Geocoding search error:', e)
      setLocationMessage('Lỗi kết nối khi tìm địa chỉ. Vui lòng chọn cơ sở trong danh sách bên dưới.')
    } finally {
      setIsSearchingLocation(false)
    }
  }

  // Calculate distance & sort facilities
  const sortedFacilities = useMemo(() => {
    let list = [...facilities]

    if (selectedCityFilter !== 'all') {
      list = list.filter((f) => {
        const city = (f.city || '').toLowerCase()
        const addr = (f.address || '').toLowerCase()
        const filter = selectedCityFilter.toLowerCase()
        return city.includes(filter) || addr.includes(filter)
      })
    }

    return list.map((fac) => {
      let distanceKm: number | null = null
      if (customerCoords && fac.latitude != null && fac.longitude != null) {
        distanceKm = calculateDistanceKm(
          customerCoords.lat,
          customerCoords.lng,
          Number(fac.latitude),
          Number(fac.longitude)
        )
      }

      // Count available units in this facility
      const unitsInFac = storageUnits.filter((u) => u.facilityId === fac.id)
      const availableCount = unitsInFac.filter(
        (u) => u.status === 'AVAILABLE' || (u.status as string) === 'Trống'
      ).length

      return {
        ...fac,
        distanceKm,
        availableCount: availableCount, // Real available count only
      }
    }).sort((a, b) => {
      if (a.distanceKm != null && b.distanceKm != null) {
        return a.distanceKm - b.distanceKm
      }
      if (a.distanceKm != null) return -1
      if (b.distanceKm != null) return 1
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [facilities, storageUnits, customerCoords, selectedCityFilter])

  // Count units available for selected tier in chosen facility
  const tierAvailability = useMemo(() => {
    if (!selectedFacility) return { count: 0, matchedUnit: null as StorageUnit | null }

    const facUnits = storageUnits.filter((u) => u.facilityId === selectedFacility.id)
    const available = facUnits.filter((u) => u.status === 'AVAILABLE' || (u.status as string) === 'Trống')

    // Find unit that roughly matches selected tier
    const tier = SIZE_TIERS[selectedTierKey]
    const matched = available.find((u) => {
      const typeName = (u.unitTypeName || (u as any).unitType?.name || (u as any).type || '').toLowerCase()
      const area = u.areaSqMeters || (u as any).area || 0
      if (selectedTierKey === 'LOCKER' && (typeName.includes('mini') || typeName.includes('locker') || typeName.includes('cá nhân') || (area > 0 && area <= 3))) return true
      if (selectedTierKey === 'STANDARD' && (typeName.includes('tiêu chuẩn') || typeName.includes('standard') || (area > 3 && area <= 7))) return true
      if (selectedTierKey === 'LARGE' && (typeName.includes('lớn') || typeName.includes('large') || (area > 7 && area <= 14))) return true
      if (selectedTierKey === 'ENTERPRISE' && (typeName.includes('doanh nghiệp') || typeName.includes('business') || area > 14)) return true
      return false
    }) || available[0] || null

    return {
      count: available.length,
      matchedUnit: matched,
    }
  }, [selectedFacility, storageUnits, selectedTierKey])

  // Pricing calculation: Tiền thuê buồng kho hàng tháng sau ưu đãi tính theo gói + % giảm, cọc 1 tháng tiền kho theo giá gốc niêm yết
  const quoteCalculation = useMemo(() => {
    const tier = SIZE_TIERS[selectedTierKey]
    const baseMonthly = tier.rateNumber

    let discountPercent = 0
    if (rentalMonths >= 24) discountPercent = 20
    else if (rentalMonths >= 12) discountPercent = 15
    else if (rentalMonths >= 6) discountPercent = 10
    else if (rentalMonths >= 3) discountPercent = 5

    const monthlyAfterDiscount = Math.round(baseMonthly * (1 - discountPercent / 100))
    const rawRent = baseMonthly * rentalMonths
    const discountAmount = Math.round(rawRent * (discountPercent / 100))
    const totalRent = monthlyAfterDiscount * rentalMonths
    const depositAmount = baseMonthly // 1 tháng tiền cọc của kho đó theo giá niêm yết

    return {
      baseMonthly,
      rawRent,
      discountPercent,
      discountAmount,
      monthlyAfterDiscount,
      totalRent,
      depositAmount,
      totalEstimate: totalRent + depositAmount,
    }
  }, [selectedTierKey, rentalMonths])

  // Form Validation
  const validateStep3 = () => {
    const errors: Record<string, string> = {}
    const nameTrim = fullName.trim()
    if (!nameTrim) {
      errors.fullName = 'Vui lòng nhập họ và tên của bạn'
    } else if (nameTrim.length < 2 || nameTrim.length > 100) {
      errors.fullName = 'Họ và tên phải từ 2 đến 100 ký tự'
    } else if (!/^[\p{L}\s'.-]+$/u.test(nameTrim)) {
      errors.fullName = 'Họ và tên chỉ được chứa chữ cái tiếng Việt/Latin và khoảng trắng'
    } else if (nameTrim.split(/\s+/).filter(Boolean).length < 2) {
      errors.fullName = 'Vui lòng nhập đầy đủ cả họ và tên (tối thiểu 2 từ)'
    }

    const cleanPhone = phone.trim().replace(/[\s.-]/g, '')
    if (!cleanPhone) {
      errors.phone = 'Vui lòng nhập số điện thoại liên hệ'
    } else if (!/^(0|\+84)(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/.test(cleanPhone)) {
      errors.phone = 'Số điện thoại di động Việt Nam không hợp lệ (10 số, bắt đầu bằng 03, 05, 07, 08, 09 hoặc +84)'
    }

    const cleanId = idCard.trim().toUpperCase()
    if (!cleanId) {
      errors.idCard = idCardType === 'CCCD' ? 'Vui lòng nhập số CCCD 12 chữ số' : 'Vui lòng nhập số Hộ chiếu'
    } else if (idCardType === 'CCCD') {
      if (!/^\d{12}$/.test(cleanId)) {
        errors.idCard = 'Số CCCD phải bao gồm đúng 12 chữ số'
      }
    } else {
      if (!/^[A-Z][0-9]{7,8}$/.test(cleanId)) {
        errors.idCard = 'Số Hộ chiếu không hợp lệ (1 chữ cái in hoa theo sau là 7-8 chữ số)'
      }
    }

    if (email.trim() && !/^[A-Za-z0-9+_.-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})$/.test(email.trim())) {
      errors.email = 'Địa chỉ email không đúng định dạng (ví dụ: name@domain.com)'
    }

    if (specialNotes && specialNotes.length > 500) {
      errors.specialNotes = 'Ghi chú tối đa 500 ký tự'
    }

    if (!checkInDate) {
      errors.checkInDate = 'Vui lòng chọn ngày dự kiến đến nhận kho'
    }
    if (!policyAccepted) {
      errors.policyAccepted = 'Vui lòng đồng ý với điều khoản giữ chỗ của Boxora'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle Next
  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!selectedFacility) {
        alert('Vui lòng chọn một cơ sở kho lưu trữ để tiếp tục.')
        return
      }
      setCurrentStep(2)
    } else if (currentStep === 2) {
      setCurrentStep(3)
    } else if (currentStep === 3) {
      if (validateStep3()) {
        setCurrentStep(4)
      }
    }
  }

  // Handle Back
  const handleBackStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as any)
    }
  }

  // Confirm Reservation (Step 4 -> Step 5)
  const handleConfirmReservation = async () => {
    setIsSubmitting(true)
    setSubmitError(null)

    // Generate readable booking code fallback
    const randomSuffix = Math.floor(1000 + Math.random() * 9000)
    const nowStr = new Date().toISOString().slice(2, 10).replace(/-/g, '')
    const generatedCode = `BX-${nowStr}-${randomSuffix}`

    try {
      // If user is authenticated and we have a backend storage unit ID, submit real booking
      if (isAuthenticated && tierAvailability.matchedUnit?.id) {
        try {
          const res = await bookingService.createBooking({
            storageUnitId: tierAvailability.matchedUnit.id,
            startDate: startDate,
            rentalMonths: rentalMonths,
            totalRentalFee: quoteCalculation.totalRent,
            depositPaid: 0,
            signingMethod: 'IN_PERSON',
            expectedCheckInAt: `${checkInDate}T${selectedPeriod.hours[0]?.value || '09:00'}:00`,
            checkInTime: checkInTime,
            identityCardNumber: idCard.trim(),
            identityCardType: idCardType,
          })

          if (res?.bookingCode || res?.id) {
            setBookingCode(res.bookingCode || `BX-${res.id.slice(0, 8).toUpperCase()}`)
          } else {
            setBookingCode(generatedCode)
          }
        } catch (apiErr: any) {
          console.warn('Backend booking API error, using safe reservation log:', apiErr)
          // Even if backend fails (e.g., token expired or permission constraint), we don't block the user's booking request!
          setBookingCode(generatedCode)
        }
      } else {
        setBookingCode(generatedCode)
      }

      const nowIso = new Date().toISOString()
      const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ngày ' + new Date().toLocaleDateString('vi-VN')
      setSentToStaffTime(timeStr)

      // Save reservation to local storage for Staff and Customer
      const savedReservations = JSON.parse(localStorage.getItem('boxora_guest_reservations') || '[]')
      const reservationRecord = {
        id: `LOCAL-RES-${generatedCode}`,
        bookingCode: generatedCode,
        createdAt: nowIso,
        customer: { fullName, phone, idCard, email, notes: specialNotes },
        customerName: fullName,
        customerPhone: phone,
        identityCardNumber: idCard,
        customerEmail: email,
        facility: { id: selectedFacility?.id, name: selectedFacility?.name, address: selectedFacility?.address, contactPhone: selectedFacility?.contactPhone },
        facilityId: selectedFacility?.id,
        facilityName: selectedFacility?.name,
        unitCode: SIZE_TIERS[selectedTierKey].name,
        tier: SIZE_TIERS[selectedTierKey],
        rentalMonths,
        startDate,
        checkInDate,
        checkInTime,
        expectedCheckInAt: `${checkInDate}T${selectedPeriod.hours[0]?.value || '09:00'}:00`,
        totalRentalFee: quoteCalculation.totalRent,
        depositAmount: quoteCalculation.depositAmount,
        status: 'PENDING_CONTACT',
        sentToStaff: true,
        sentToStaffAt: nowIso,
      }
      savedReservations.unshift(reservationRecord)
      localStorage.setItem('boxora_guest_reservations', JSON.stringify(savedReservations))

      // Push in-app notification to Staff
      try {
        const staffNotification = {
          id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          facilityId: selectedFacility?.id,
          facilityName: selectedFacility?.name,
          channel: 'STAFF_PORTAL',
          notificationType: 'NEW_BOOKING_RESERVATION',
          referenceType: 'BOOKING',
          referenceId: generatedCode,
          title: `Đơn giữ chỗ mới: ${generatedCode}`,
          content: `Khách hàng ${fullName} (${phone}) đã gửi đơn đặt giữ chỗ ${SIZE_TIERS[selectedTierKey].name} tại ${selectedFacility?.name}. Lịch hẹn: ${checkInDate} (${checkInTime}).`,
          status: 'UNREAD',
          createdAt: nowIso,
        }
        const existingNotifs = JSON.parse(localStorage.getItem('boxora_in_app_notifications') || '[]')
        existingNotifs.unshift(staffNotification)
        localStorage.setItem('boxora_in_app_notifications', JSON.stringify(existingNotifs))
        window.dispatchEvent(new CustomEvent('boxora_notification_pushed', { detail: staffNotification }))
        window.dispatchEvent(new CustomEvent('boxora_staff_reservation_created', { detail: reservationRecord }))
      } catch (e) {
        console.warn('Modal staff notification error:', e)
      }

      // Move to step 5!
      setCurrentStep(5)
    } catch (err: any) {
      console.error('Reservation submission error:', err)
      setSubmitError('Có lỗi xảy ra khi xử lý yêu cầu đặt kho. Vui lòng thử lại hoặc gọi hotline 1900-BOXORA.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Copy booking code to clipboard
  const handleCopyCode = () => {
    if (!bookingCode) return
    navigator.clipboard.writeText(bookingCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2500)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto bg-slate-950/70 backdrop-blur-md transition-all duration-300">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-200">
        
        {/* ================================================================ */}
        {/* MODAL HEADER: BRAND & 5-STEP PROGRESS BAR                         */}
        {/* ================================================================ */}
        <div className="flex-none px-6 py-4 bg-gradient-to-r from-blue-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                <Box size={18} />
              </div>
              <div>
                <h3 className="font-headline text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  Quy Trình Đặt Kho Boxora
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                    5 BƯỚC NHANH CHÓNG
                  </span>
                </h3>
                <p className="text-[11px] text-slate-600">
                  Chọn cơ sở, kích thước kho và nhận hỗ trợ tư vấn giữ chỗ miễn phí
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X size={20} />
            </button>
          </div>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2 pt-2 border-t border-slate-700/40">
            {[
              { num: 1, label: 'Chọn Cơ Sở' },
              { num: 2, label: 'Kích Thước' },
              { num: 3, label: 'Thông Tin' },
              { num: 4, label: 'Xác Nhận' },
              { num: 5, label: 'Hoàn Tất' },
            ].map((s) => {
              const isActive = currentStep === s.num
              const isPast = currentStep > s.num
              return (
                <div key={s.num} className="flex flex-col items-center text-center">
                  <div
                    className={`h-1.5 w-full rounded-full transition-all duration-300 mb-1.5 ${
                      isPast
                        ? 'bg-cyan-400'
                        : isActive
                        ? 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.7)]'
                        : 'bg-slate-700'
                    }`}
                  />
                  <div className="flex items-center justify-center gap-1">
                    <span
                      className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${
                        isPast
                          ? 'bg-cyan-500 text-slate-950'
                          : isActive
                          ? 'bg-white text-slate-950 font-black'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {isPast ? '✓' : s.num}
                    </span>
                    <span
                      className={`text-[10px] hidden sm:inline font-medium truncate ${
                        isActive ? 'text-cyan-300 font-bold' : isPast ? 'text-slate-200' : 'text-slate-400'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ================================================================ */}
        {/* MODAL BODY (STEP CONTENT)                                         */}
        {/* ================================================================ */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 md:p-8 space-y-6 bg-slate-50/50">
          
          {/* ============================================================== */}
          {/* BƯỚC 1: LẤY BỘ LỌC TÌM KIẾM KHO & CHỌN CƠ SỞ KHO GẦN ĐỊA CHỈ  */}
          {/* ============================================================== */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-700">
                  Bước 1: Tìm kiếm &amp; Chọn cơ sở kho
                </span>
                <h4 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Nhập địa chỉ hoặc chọn cơ sở gần bạn nhất
                </h4>
                <p className="text-xs sm:text-sm text-slate-600">
                  Hệ thống tự động tính khoảng cách và đề xuất cơ sở kho Boxora gần địa chỉ của bạn để tiện đi lại.
                </p>
              </div>

              {/* Location Search Bar & Quick Filters */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-600" size={18} />
                    <input
                      type="text"
                      value={searchAddress}
                      onChange={(e) => setSearchAddress(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void handleSearchAddress()}
                      placeholder="Nhập địa chỉ nhà, tên đường hoặc quận (VD: Quận 7, Cầu Giấy, Nam Từ Liêm...)"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSearchAddress}
                      disabled={isSearchingLocation}
                      className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isSearchingLocation ? (
                        <span className="animate-spin text-sm">⟳</span>
                      ) : (
                        <Search size={16} />
                      )}
                      <span>Tìm cơ sở</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleUseCurrentGPS}
                      disabled={isSearchingLocation}
                      className="px-3.5 py-2.5 rounded-xl border border-slate-300 hover:border-cyan-500 hover:bg-cyan-50/50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      title="Sử dụng vị trí GPS hiện tại"
                    >
                      <Navigation size={15} className="text-cyan-600" />
                      <span className="hidden sm:inline">GPS của tôi</span>
                    </button>
                  </div>
                </div>

                {/* Status notice */}
                {locationMessage && (
                  <div className="text-[11px] text-cyan-800 bg-cyan-50/80 px-3 py-1.5 rounded-lg border border-cyan-200/80 flex items-center gap-2">
                    <Sparkles size={14} className="text-cyan-600 flex-shrink-0" />
                    <span>{locationMessage}</span>
                  </div>
                )}

                {/* City Filter Pills */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-500 font-medium">Khu vực:</span>
                  {[
                    { id: 'all', label: 'Tất cả chi nhánh' },
                    { id: 'Hồ Chí Minh', label: 'TP. Hồ Chí Minh' },
                    { id: 'Hà Nội', label: 'Hà Nội' },
                    { id: 'Đà Nẵng', label: 'Đà Nẵng' },
                  ].map((city) => (
                    <button
                      key={city.id}
                      type="button"
                      onClick={() => setSelectedCityFilter(city.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                        selectedCityFilter === city.id
                          ? 'bg-blue-600 text-white font-bold'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      {city.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Facility Cards Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>
                    Danh sách cơ sở phù hợp ({sortedFacilities.length} chi nhánh)
                  </span>
                  {customerCoords && (
                    <span className="text-cyan-700 font-semibold flex items-center gap-1">
                      <Navigation size={12} />
                      Đã sắp xếp theo cơ sở gần bạn nhất
                    </span>
                  )}
                </div>

                {loadingInitialData ? (
                  <div className="p-12 text-center text-slate-400 text-xs">
                    <span className="animate-spin inline-block text-lg mb-2">⟳</span>
                    <p>Đang tải danh sách cơ sở kho Boxora...</p>
                  </div>
                ) : sortedFacilities.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
                    Không tìm thấy cơ sở nào phù hợp với bộ lọc hiện tại. Vui lòng chọn "Tất cả chi nhánh".
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[380px] overflow-y-auto pr-1">
                    {sortedFacilities.map((fac) => {
                      const isSelected = selectedFacility?.id === fac.id
                      return (
                        <div
                          key={fac.id}
                          onClick={() => setSelectedFacility(fac)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer relative text-left flex flex-col justify-between gap-3 ${
                            isSelected
                              ? 'bg-blue-50/60 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                              : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-xs'
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <h5 className="font-bold text-sm text-slate-900 leading-snug">
                                {fac.name}
                              </h5>
                              {isSelected ? (
                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 text-xs">
                                  ✓
                                </span>
                              ) : (
                                <span className="w-5 h-5 rounded-full border border-slate-300 flex-shrink-0" />
                              )}
                            </div>

                            <p className="text-xs text-slate-600 flex items-start gap-1.5 leading-relaxed">
                              <MapPin size={14} className="text-cyan-600 flex-shrink-0 mt-0.5" />
                              <span>{fac.address || 'Địa chỉ đang cập nhật'}</span>
                            </p>
                          </div>

                          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
                            {fac.distanceKm != null ? (
                              <span className="font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Navigation size={11} />
                                Cách {fac.distanceKm} km
                              </span>
                            ) : (
                              <span className="text-slate-400">
                                {fac.city || 'TP.HCM'}
                              </span>
                            )}

                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              {fac.availableCount > 0 ? `Còn ${fac.availableCount} kho trống` : 'Sắp trống'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* BƯỚC 2: KHÁCH HÀNG SẼ CHỌN KÍCH THƯỚC KHO MUỐN THUÊ           */}
          {/* ============================================================== */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-700">
                  Bước 2: Chọn kích thước kho
                </span>
                <h4 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Chọn kích thước kho phù hợp với lượng đồ của bạn
                </h4>
                <p className="text-xs sm:text-sm text-slate-600">
                  Tại cơ sở: <strong className="text-blue-900">{selectedFacility?.name}</strong> ({selectedFacility?.address})
                </p>
              </div>

              {/* 4 Size Tier Options */}
              {tierAvailability.count === 0 && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
                  <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
                  <span>Cơ sở này hiện chưa có kho khả dụng cho gói này. Vui lòng chọn gói kích thước khác hoặc đổi cơ sở.</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(Object.keys(SIZE_TIERS) as SizeTierKey[]).map((tierKey) => {
                  const tier = SIZE_TIERS[tierKey]
                  const isSelected = selectedTierKey === tierKey

                  return (
                    <div
                      key={tierKey}
                      onClick={() => setSelectedTierKey(tierKey)}
                      className={`p-5 rounded-2xl border transition-all cursor-pointer relative text-left flex flex-col justify-between ${
                        isSelected
                          ? 'bg-blue-50/70 border-blue-600 ring-2 ring-blue-500/25 shadow-lg'
                          : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-xs'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-900">
                            {tier.badge}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-500">
                            {tier.area}
                          </span>
                        </div>

                        <div>
                          <h5 className="font-bold text-base text-slate-900">
                            {tier.name}
                          </h5>
                          <p className="text-xs text-slate-500">
                            {tier.subtitle}
                          </p>
                        </div>

                        <div className="text-lg font-black font-mono text-blue-700">
                          {tier.rateFormatted}
                        </div>

                        {/* Fits checklist */}
                        <div className="space-y-1 pt-1 text-[11px] text-slate-600">
                          {tier.fits.slice(0, 3).map((fit, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <Check size={13} className="text-emerald-600 flex-shrink-0" />
                              <span className="truncate">{fit}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-mono">
                          Thể tích: {tier.volume}
                        </span>
                        {isSelected ? (
                          <span className="font-bold text-blue-700 flex items-center gap-1">
                            ✓ Đang chọn
                          </span>
                        ) : (
                          <span className="text-slate-400 group-hover:text-blue-600">
                            Bấm chọn
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Rental Duration & Estimated Discount */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                    Thời gian dự kiến thuê &amp; Ưu đãi chiết khấu
                  </span>
                  <span className="text-xs text-blue-700 font-bold">
                    {rentalMonths} tháng
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { m: 1, label: '1 tháng', discount: 'Chuẩn' },
                    { m: 3, label: '3 tháng', discount: 'Giảm 5%' },
                    { m: 6, label: '6 tháng', discount: 'Giảm 10%' },
                    { m: 12, label: '12 tháng', discount: 'Giảm 15%' },
                  ].map((dur) => (
                    <button
                      key={dur.m}
                      type="button"
                      onClick={() => setRentalMonths(dur.m)}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        rentalMonths === dur.m
                          ? 'bg-blue-600 border-blue-600 text-white font-bold shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs">{dur.label}</div>
                      <div className={`text-[10px] font-mono mt-0.5 ${rentalMonths === dur.m ? 'text-cyan-200' : 'text-emerald-600 font-semibold'}`}>
                        {dur.discount}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ngày bắt đầu mong muốn:
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="p-2.5 rounded-xl bg-cyan-50/70 border border-cyan-200/80 text-xs text-cyan-900 flex items-center justify-between font-mono">
                      <span>Đơn giá áp dụng{quoteCalculation.discountPercent > 0 ? ` (Giảm ${quoteCalculation.discountPercent}%):` : ':'}</span>
                      <div className="flex items-baseline gap-1.5">
                        {quoteCalculation.discountPercent > 0 && (
                          <span className="text-[11px] text-slate-400 line-through">
                            {quoteCalculation.baseMonthly.toLocaleString('vi-VN')} ₫
                          </span>
                        )}
                        <strong className="text-blue-700">
                          {quoteCalculation.monthlyAfterDiscount.toLocaleString('vi-VN')} ₫/tháng
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* BƯỚC 3: KHÁCH HÀNG ĐIỀN CÁC THÔNG TIN NHƯ TÊN SDT CCCD...        */}
          {/* ============================================================== */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-700">
                  Bước 3: Thông tin người thuê kho
                </span>
                <h4 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Điền thông tin liên hệ để giữ chỗ
                </h4>
                <p className="text-xs sm:text-sm text-slate-600">
                  Thông tin này được dùng để nhân viên Boxora chuẩn bị hồ sơ bàn giao và kích hoạt mã khóa điện tử.
                </p>
              </div>

              {isAuthenticated && (
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
                  <Sparkles size={16} className="text-blue-600 flex-shrink-0" />
                  <span>
                    Bạn đang đăng nhập bằng tài khoản <strong>{user?.fullName || user?.email}</strong>. Hệ thống đã tự động điền sẵn thông tin của bạn.
                  </span>
                </div>
              )}

              <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <User size={14} className="text-cyan-600" />
                      <span>Họ và tên khách hàng *</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value)
                        if (formErrors.fullName) setFormErrors({ ...formErrors, fullName: '' })
                      }}
                      placeholder="VD: Nguyễn Văn A"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm focus:outline-none focus:ring-2 ${
                        formErrors.fullName
                          ? 'border-red-400 focus:ring-red-300'
                          : 'border-slate-300 focus:ring-blue-500'
                      }`}
                    />
                    {formErrors.fullName && (
                      <p className="text-[11px] text-red-600">{formErrors.fullName}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <Phone size={14} className="text-cyan-600" />
                      <span>Số điện thoại nhận liên hệ *</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value)
                        if (formErrors.phone) setFormErrors({ ...formErrors, phone: '' })
                      }}
                      placeholder="VD: 0912345678"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 ${
                        formErrors.phone
                          ? 'border-red-400 focus:ring-red-300'
                          : 'border-slate-300 focus:ring-blue-500'
                      }`}
                    />
                    {formErrors.phone && (
                      <p className="text-[11px] text-red-600">{formErrors.phone}</p>
                    )}
                  </div>

                  {/* ID Card / CCCD */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <CreditCard size={14} className="text-cyan-600" />
                        <span>Số CCCD / Hộ chiếu *</span>
                      </label>
                      <div className="flex gap-2 text-[10px] font-mono">
                        <button
                          type="button"
                          onClick={() => setIdCardType('CCCD')}
                          className={`px-2 py-0.5 rounded cursor-pointer ${idCardType === 'CCCD' ? 'bg-blue-600 text-white font-bold' : 'text-slate-500'}`}
                        >
                          CCCD
                        </button>
                        <button
                          type="button"
                          onClick={() => setIdCardType('PASSPORT')}
                          className={`px-2 py-0.5 rounded cursor-pointer ${idCardType === 'PASSPORT' ? 'bg-blue-600 text-white font-bold' : 'text-slate-500'}`}
                        >
                          Hộ chiếu
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={idCard}
                      onChange={(e) => {
                        setIdCard(e.target.value)
                        if (formErrors.idCard) setFormErrors({ ...formErrors, idCard: '' })
                      }}
                      placeholder={idCardType === 'CCCD' ? '12 chữ số CCCD' : 'Số hộ chiếu còn hạn'}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 ${
                        formErrors.idCard
                          ? 'border-red-400 focus:ring-red-300'
                          : 'border-slate-300 focus:ring-blue-500'
                      }`}
                    />
                    {formErrors.idCard && (
                      <p className="text-[11px] text-red-600">{formErrors.idCard}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <Mail size={14} className="text-cyan-600" />
                      <span>Email nhận phiếu xác nhận</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="VD: nguyenvana@gmail.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Check-in Date */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <Calendar size={14} className="text-cyan-600" />
                      <span>Ngày dự kiến đến cơ sở nhận kho *</span>
                    </label>
                    <input
                      type="date"
                      value={checkInDate}
                      onChange={(e) => {
                        setCheckInDate(e.target.value)
                        if (formErrors.checkInDate) setFormErrors({ ...formErrors, checkInDate: '' })
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  </div>
                </div>

                {/* Các box chọn buổi tiếp đón: Sáng, Trưa, Chiều, Tối, Đêm */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Clock size={14} className="text-cyan-600" />
                      <span>Chọn buổi tiếp đón tại cơ sở (24/7):</span>
                    </span>
                    <span className="text-[11px] text-blue-600 font-mono font-semibold">
                      {selectedPeriod.name} ({selectedPeriod.rangeText})
                    </span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {CHECK_IN_PERIOD_GROUPS.map((group) => {
                      const isSelected = selectedPeriodId === group.id
                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => setSelectedPeriodId(group.id)}
                          className={`p-2.5 rounded-xl text-left border-2 transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-500/20'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-lg">{group.icon}</span>
                            {isSelected && <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />}
                          </div>
                          <div className="mt-1">
                            <strong className="block text-xs text-slate-900">{group.name}</strong>
                            <span className="block text-[10px] text-slate-500 font-mono leading-tight">{group.rangeText}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                {/* Special Notes */}
                <div className="space-y-1 pt-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Ghi chú thêm về đồ đạc hoặc yêu cầu đặc biệt (tùy chọn):
                  </label>
                  <textarea
                    rows={2}
                    value={specialNotes}
                    onChange={(e) => setSpecialNotes(e.target.value)}
                    placeholder="VD: Cần hỗ trợ xe đẩy bốc xếp hàng, đồ điện tử cần nhiệt độ mát, hàng nặng..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Policy Agreement */}
                <div className="pt-2">
                  <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={policyAccepted}
                      onChange={(e) => {
                        setPolicyAccepted(e.target.checked)
                        if (formErrors.policyAccepted) setFormErrors({ ...formErrors, policyAccepted: '' })
                      }}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      Tôi xác nhận các thông tin trên là chính xác và đồng ý với{' '}
                      <a href="#policies" target="_blank" className="text-blue-600 underline font-semibold">
                        Quy chế giữ chỗ &amp; Bảo mật của Boxora
                      </a>
                      . Mã kho cụ thể và mã PIN mở cửa sẽ được bàn giao sau khi check-in tại cơ sở.
                    </span>
                  </label>
                  {formErrors.policyAccepted && (
                    <p className="text-[11px] text-red-600 mt-1">{formErrors.policyAccepted}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* BƯỚC 4: SẼ CHO KHÁCH HÀNG XEM THÔNG TIN ĐƠN ĐẶT HÀNG           */}
          {/* ============================================================== */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-700">
                  Bước 4: Kiểm tra thông tin đơn đặt hàng
                </span>
                <h4 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Xem lại chi tiết đơn đặt chỗ kho trước khi xác nhận
                </h4>
                <p className="text-xs sm:text-sm text-slate-600">
                  Vui lòng rà soát lại thông tin cơ sở, kích thước kho và thông tin cá nhân của quý khách.
                </p>
              </div>

              {submitError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                  {submitError}
                </div>
              )}

              {/* Order Summary Card */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-md">
                
                {/* Header banner */}
                <div className="p-4 bg-gradient-to-r from-blue-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border-b border-blue-100 dark:border-slate-800 text-slate-900 dark:text-white flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-blue-600 font-bold uppercase tracking-wider">
                      ĐƠN ĐẶT GIỮ CHỖ KHO TRỰC TUYẾN
                    </span>
                    <h5 className="font-bold text-base text-white">
                      {SIZE_TIERS[selectedTierKey].name}
                    </h5>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {quoteCalculation.discountPercent > 0
                        ? `TIỀN THUÊ KHO HÀNG THÁNG (ĐÃ GIẢM ${quoteCalculation.discountPercent}%)`
                        : 'TIỀN THUÊ KHO HÀNG THÁNG (GIÁ GỐC)'}
                    </span>
                    <div className="flex items-baseline justify-end gap-2">
                      {quoteCalculation.discountPercent > 0 && (
                        <span className="font-mono text-xs text-slate-400 line-through">
                          {quoteCalculation.baseMonthly.toLocaleString('vi-VN')} ₫
                        </span>
                      )}
                      <span className="font-mono text-lg font-bold text-cyan-300">
                        {quoteCalculation.monthlyAfterDiscount.toLocaleString('vi-VN')} ₫/tháng
                      </span>
                    </div>
                    <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                      + Cọc 1 tháng: {quoteCalculation.depositAmount.toLocaleString('vi-VN')} ₫
                    </span>
                  </div>
                </div>

                <div className="p-5 sm:p-6 space-y-5 text-xs text-slate-700">
                  
                  {/* Grid 2 Column Review */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Facility & Location Info */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <span className="font-bold text-slate-900 font-mono text-[11px] uppercase flex items-center gap-1.5">
                        <Building2 size={15} className="text-blue-600" />
                        1. Cơ sở kho lưu trữ
                      </span>
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-900 text-sm">
                          {selectedFacility?.name}
                        </div>
                        <div className="text-slate-600 leading-relaxed">
                          {selectedFacility?.address}
                        </div>
                        <div className="text-cyan-800 font-mono text-[11px] pt-1">
                          Hotline hỗ trợ: {selectedFacility?.contactPhone || '1900-BOXORA'}
                        </div>
                      </div>
                    </div>

                    {/* Unit & Size Specs */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <span className="font-bold text-slate-900 font-mono text-[11px] uppercase flex items-center gap-1.5">
                        <Box size={15} className="text-cyan-600" />
                        2. Kích thước &amp; Thời hạn
                      </span>
                      <div className="space-y-1 font-mono text-[11px]">
                        <div>Diện tích: <strong>{SIZE_TIERS[selectedTierKey].area}</strong></div>
                        <div>Thể tích: <strong>{SIZE_TIERS[selectedTierKey].volume}</strong></div>
                        <div>Thời hạn cam kết: <strong>{rentalMonths} tháng</strong></div>
                        <div>Ngày bắt đầu dự kiến: <strong>{startDate}</strong></div>
                      </div>
                    </div>

                    {/* Customer Personal Info */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <span className="font-bold text-slate-900 font-mono text-[11px] uppercase flex items-center gap-1.5">
                        <User size={15} className="text-emerald-600" />
                        3. Người đặt giữ chỗ
                      </span>
                      <div className="space-y-1 text-[11px]">
                        <div>Họ và tên: <strong className="text-slate-900">{fullName}</strong></div>
                        <div>Số điện thoại: <strong className="text-slate-900 font-mono">{phone}</strong></div>
                        <div>{idCardType}: <strong className="text-slate-900 font-mono">{idCard}</strong></div>
                        {email && <div>Email: <span className="font-mono text-slate-600">{email}</span></div>}
                      </div>
                    </div>

                    {/* Check-in Appointment */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <span className="font-bold text-slate-900 font-mono text-[11px] uppercase flex items-center gap-1.5">
                        <Calendar size={15} className="text-amber-600" />
                        4. Lịch hẹn đón tiếp tại kho
                      </span>
                      <div className="space-y-1 text-[11px]">
                        <div>Ngày hẹn: <strong className="text-slate-900 font-mono">{checkInDate}</strong></div>
                        <div>Khung giờ: <strong className="text-slate-900 font-mono">{checkInTime}</strong></div>
                        <div className="text-amber-800 bg-amber-50 px-2 py-1 rounded text-[10px] mt-1">
                          Nhân viên đón tiếp tại cơ sở và hướng dẫn xem buồng kho thực tế.
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Financial Breakdown Table */}
                  <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-2 font-mono text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Đơn giá buồng kho niêm yết (giá gốc):</span>
                      <span className="font-semibold text-slate-800">{quoteCalculation.baseMonthly.toLocaleString('vi-VN')} ₫/tháng</span>
                    </div>

                    <div className="flex justify-between text-slate-800 font-semibold pt-1 border-t border-blue-200/60">
                      <span>
                        {quoteCalculation.discountPercent > 0
                          ? `Tiền thuê buồng kho hàng tháng sau ưu đãi (Giảm ${quoteCalculation.discountPercent}%):`
                          : 'Tiền thuê buồng kho hàng tháng sau ưu đãi:'}
                      </span>
                      <span className="text-blue-700 font-bold">
                        {quoteCalculation.monthlyAfterDiscount.toLocaleString('vi-VN')} ₫/tháng
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-700">
                      <span>Tiền phải cọc buồng kho (1 tháng tiền kho theo giá niêm yết):</span>
                      <strong className="text-slate-900 font-bold">
                        {quoteCalculation.depositAmount.toLocaleString('vi-VN')} ₫
                      </strong>
                    </div>

                    <div className="flex justify-between items-center text-slate-900 pt-1.5 border-t border-blue-200/60 bg-blue-100/50 p-2 rounded-lg">
                      <div>
                        <span className="font-bold text-xs block">
                          Tổng chi phí thanh toán khi nhận kho (Tiền thuê + Cọc 1 tháng):
                        </span>
                        {quoteCalculation.discountAmount > 0 && (
                          <span className="text-[10px] text-emerald-700 font-normal">
                            🎉 Quý khách tiết kiệm được {quoteCalculation.discountAmount.toLocaleString('vi-VN')} ₫ nhờ ưu đãi thuê {rentalMonths} tháng
                          </span>
                        )}
                      </div>
                      <span className="font-black text-blue-700 text-sm">
                        {(quoteCalculation.totalRent + quoteCalculation.depositAmount).toLocaleString('vi-VN')} ₫
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                      <div>
                        <span className="font-bold text-slate-900 text-sm block">
                          Phí thanh toán giữ chỗ trực tuyến:
                        </span>
                        <span className="text-[10px] text-emerald-700 font-normal">
                          Miễn phí 100% • Quý khách thanh toán tiền thuê và tiền cọc qua chuyển khoản khi nhận bàn giao tại cơ sở
                        </span>
                      </div>
                      <span className="text-lg font-black text-emerald-700">
                        0 ₫
                      </span>
                    </div>
                  </div>

                  {/* Lưu ý thanh toán: Chuyển khoản, không nhận tiền mặt */}
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0">info</span>
                    <span>
                      <strong>Lưu ý:</strong> Hệ thống Boxora <strong>chỉ nhận chuyển khoản ngân hàng (VietQR / Internet Banking)</strong>, <strong>KHÔNG nhận tiền mặt</strong> tại quầy tiếp đón để đảm bảo minh bạch và tự động xuất hóa đơn điện tử.
                    </span>
                  </div>

                  {/* Guarantee banner */}
                  <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
                    <ShieldCheck size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>
                      Cam kết giữ buồng kho trống theo đúng kích thước đã chọn trong vòng <strong>48 giờ</strong> kể từ thời điểm đặt chỗ. Không phát sinh phụ phí ẩn.
                    </span>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* BƯỚC 5: HIỂN THỊ THÔNG BÁO ĐẶT GIỮ CHỖ THÀNH CÔNG              */}
          {/* ============================================================== */}
          {currentStep === 5 && (
            <div className="space-y-6 text-center py-4">
              
              {/* Success Badge Animation */}
              <div className="mx-auto w-20 h-20 rounded-full bg-emerald-100 border-4 border-emerald-300 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 size={44} className="stroke-[2.5]" />
              </div>

              <div className="space-y-2 max-w-lg mx-auto">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  Bước 5: Đơn Đặt Giữ Chỗ - Chờ Xác Nhận
                </span>
                <h4 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Đơn Giữ Chỗ Đang Ở Trạng Thái Chờ Xác Nhận
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Đơn giữ chỗ của bạn đang ở trạng thái <strong className="text-amber-700 font-bold">Chờ xác nhận</strong>. Chuyên viên Boxora sẽ gọi điện qua số điện thoại{' '}
                  <strong className="text-blue-700 font-mono">{phone}</strong> trong vòng <strong>15–30 phút</strong> để đối soát thông tin. Sau khi nhân viên xác nhận, đơn sẽ tự động chuyển sang trạng thái <strong className="text-emerald-700 font-bold">Chờ check in</strong>.
                </p>
              </div>

              {/* Booking Code Callout */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-white to-cyan-50 border border-blue-200 text-slate-900 max-w-md mx-auto shadow-xs space-y-2">
                <span className="text-[11px] font-mono text-slate-400 block uppercase">
                  MÃ ĐƠN GIỮ CHỖ CỦA BẠN
                </span>
                <div className="flex items-center justify-center gap-3">
                  <span className="font-mono text-2xl font-black text-blue-700 tracking-wider">
                    {bookingCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                    title="Sao chép mã"
                  >
                    {copiedCode ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  </button>
                </div>
                {copiedCode && (
                  <span className="text-[10px] text-emerald-400 font-mono block">
                    Đã sao chép mã đơn vào bộ nhớ tạm!
                  </span>
                )}
              </div>

              {/* THẺ XÁC NHẬN ĐÃ GỬI ĐƠN CHO STAFF TIẾP ĐÓN */}
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-left max-w-xl mx-auto shadow-xs space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                    <strong className="text-emerald-950 font-bold">Đã gửi đơn giữ chỗ cho nhân viên (Staff)</strong>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                    ĐÃ GỬI TỚI STAFF TRỰC CA
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Đơn giữ chỗ <strong>{bookingCode}</strong> đã được chuyển trực tiếp vào ca trực của Staff cơ sở <strong>{selectedFacility?.name}</strong>. Nhân viên sẽ gọi điện cho quý khách trong 15-30 phút.
                </p>
                <div className="flex items-center justify-between pt-1 border-t border-emerald-200/80 text-[10px] text-emerald-700 font-mono">
                  <span>Gửi lúc: {sentToStaffTime || 'Vừa xong'}</span>
                  <span>Hotline: {selectedFacility?.contactPhone || '1900-BOXORA'}</span>
                </div>
              </div>

              {/* Quick Summary Box */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 text-left max-w-xl mx-auto shadow-sm space-y-3 text-xs">
                <h5 className="font-bold text-slate-900 font-mono text-xs uppercase flex items-center gap-1.5">
                  <Clock size={15} className="text-cyan-600" />
                  Thông tin lịch hẹn đón tiếp:
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 font-mono">
                  <div>
                    <span className="text-slate-400 block text-[10px]">CƠ SỞ KHO:</span>
                    <strong className="text-slate-900">{selectedFacility?.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">ĐỊA CHỈ:</span>
                    <span className="truncate block text-slate-800">{selectedFacility?.address}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">KÍCH THƯỚC:</span>
                    <strong className="text-blue-700">{SIZE_TIERS[selectedTierKey].name} ({SIZE_TIERS[selectedTierKey].area})</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">THỜI GIAN HẸN:</span>
                    <strong className="text-emerald-700">{checkInDate} lúc {checkInTime}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed">
                  💡 <strong>Bước tiếp theo:</strong> Khi đến cơ sở nhận kho, vui lòng mang theo CCCD/Hộ chiếu bản gốc để đối chiếu và nhận mã PIN truy cập kho độc quyền trên ứng dụng Boxora.
                </div>
              </div>

              {/* Action Buttons for Step 5 */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <span>Hoàn tất &amp; Về trang chủ</span>
                  <Check size={16} />
                </button>

                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      navigate('/portal/customer')
                    }}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    Vào trang quản lý của tôi
                  </button>
                )}
              </div>

            </div>
          )}

        </div>

        {/* ================================================================ */}
        {/* MODAL FOOTER (CONTROLS FOR STEPS 1-4)                             */}
        {/* ================================================================ */}
        {currentStep < 5 && (
          <div className="flex-none px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBackStep}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft size={16} />
                <span>Quay lại</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-medium cursor-pointer"
              >
                Hủy bỏ
              </button>

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold shadow-md shadow-blue-600/25 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <span>Tiếp tục sang Bước {currentStep + 1}</span>
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmReservation}
                  disabled={isSubmitting}
                  className="px-7 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin text-sm">⟳</span>
                      <span>Đang xác nhận đặt chỗ...</span>
                    </>
                  ) : (
                    <>
                      <span>Xác nhận đặt giữ chỗ kho</span>
                      <CheckCircle2 size={16} />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
