import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Building2,
  Box,
  Check,
  CheckCircle2,
  PhoneCall,
  User,
  Phone,
  CreditCard,
  Mail,
  Calendar,
  Clock,
  ShieldCheck,
  Copy,
  Sparkles,
  LogIn,
  LayoutDashboard,
  AlertCircle,
  ChevronRight,
  Home,
  Maximize2,
  X,
  Package,
  Wind,
  ThermometerSnowflake,
  FileText,
  FileCheck2,
  Edit3,
  Tag,
  ExternalLink,
  Lock,
  QrCode,
  Smartphone,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Facility, StorageUnit, RentalContract } from '../../types'
import { facilityService } from '../../services/facilityService'
import { storageUnitService } from '../../services/storageUnitService'
import { bookingService } from '../../services/bookingService'
import { paymentService } from '../../services/paymentService'
import { contractService } from '../../services/contractService'
import { DocuSealSimulationModal } from '../../components/modals/DocuSealSimulationModal'
import { FacilityNoUnitsModal } from '../../components/modals/FacilityNoUnitsModal'
import { BrandLogo } from '../../components/common/BrandLogo'
import { QuickThemeLanguageToggle } from '../../components/common/QuickThemeLanguageToggle'
import { AccountProfileModal } from '../../components/common/AccountProfileModal'
import { LogoutConfirmModal } from '../../components/common/LogoutConfirmModal'
import { WebSettingsModal } from '../../components/common/WebSettingsModal'
import { UserAvatarDropdown } from '../../components/common/UserAvatarDropdown'
import { useLanguage } from '../../context/LanguageContext'
import { checkCustomerPortalAccess } from '../../utils/rentalAccess'
import {
  StorageSizeIsometric3D,
  getRealPhotoForSize,
} from '../../components/booking/StorageSizeIsometric3D'

// Import 8 isometric 3D storage images matching user specification
import size1m3Img from '../../assets/sizes/size-1m3.png'
import size2m3Img from '../../assets/sizes/size-2m3.png'
import size3m3Img from '../../assets/sizes/size-3m3.png'
import size4m3Img from '../../assets/sizes/size-4m3.png'
import size5m3Img from '../../assets/sizes/size-5m3.png'
import size6m3Img from '../../assets/sizes/size-6m3.png'
import size8m3Img from '../../assets/sizes/size-8m3.png'
import size9m3Img from '../../assets/sizes/size-9m3.png'
import facilityD1Img from '../../assets/facilities/facility-d1.jpg'
import facilityD7Img from '../../assets/facilities/facility-d7.jpg'
import facilityThuDucImg from '../../assets/facilities/facility-thuduc.jpg'
import facilityTanBinhImg from '../../assets/facilities/facility-tanbinh.jpg'

export const getFacilityImage = (fac?: Facility | null, index = 0): string => {
  if (!fac) return facilityD1Img
  if (fac.imageUrl && fac.imageUrl.startsWith('http')) return fac.imageUrl

  const code = (fac.code || '').toUpperCase()
  if (code.includes('D1') || code.includes('Q1')) return facilityD1Img
  if (code.includes('D7') || code.includes('Q7')) return facilityD7Img
  if (code.includes('TD') || code.includes('THUDUC')) return facilityThuDucImg
  if (code.includes('TB') || code.includes('TANBINH')) return facilityTanBinhImg

  const name = (fac.name || '').toLowerCase()
  if (name.includes('district 1') || name.includes('quận 1') || name.includes('d1')) return facilityD1Img
  if (name.includes('district 7') || name.includes('quận 7') || name.includes('d7')) return facilityD7Img
  if (name.includes('thủ đức') || name.includes('thu duc')) return facilityThuDucImg
  if (name.includes('tân bình') || name.includes('tan binh')) return facilityTanBinhImg

  const defaultList = [facilityD1Img, facilityD7Img, facilityThuDucImg, facilityTanBinhImg]
  return defaultList[index % defaultList.length]
}

export interface StorageSizeUnitDef {
  id: string
  volumeText: string
  volumeNumber: number
  capacityText: string
  image: string
  dimensions: string
  areaM2: number
  fitsDetailed: string[]
  nonAcRate: number
  acRate: number
}

export const STORAGE_SIZES_CATALOG: StorageSizeUnitDef[] = [
  {
    id: '1m3',
    volumeText: '1 m³',
    volumeNumber: 1,
    capacityText: '6 boxes',
    image: size1m3Img,
    dimensions: '1.0m × 1.0m × Cao 1.0m',
    areaM2: 1.0,
    fitsDetailed: ['4–6 Vali lớn', '6 Thùng carton tiêu chuẩn (0.5×0.4m)', 'Dụng cụ thể thao, laptop, balo', 'Giấy tờ tài liệu văn phòng'],
    nonAcRate: 350000,
    acRate: 420000,
  },
  {
    id: '2m3',
    volumeText: '2 m³',
    volumeNumber: 2,
    capacityText: '12 boxes',
    image: size2m3Img,
    dimensions: '1.0m × 1.0m × Cao 2.0m',
    areaM2: 1.0,
    fitsDetailed: ['12 Thùng carton tiêu chuẩn', 'Kệ để đồ mini, ghế lười', '3–4 Vali cỡ lớn', 'Đồ gia dụng cá nhân, tài liệu'],
    nonAcRate: 550000,
    acRate: 660000,
  },
  {
    id: '3m3',
    volumeText: '3 m³',
    volumeNumber: 3,
    capacityText: '18 boxes',
    image: size3m3Img,
    dimensions: '1.2m × 1.0m × Cao 2.5m',
    areaM2: 1.2,
    fitsDetailed: ['18 Thùng carton tiêu chuẩn', 'Tủ quần áo mini tháo lắp', 'Bàn làm việc, ghế văn phòng', 'Nệm đơn và hộp đồ chuyển trọ'],
    nonAcRate: 750000,
    acRate: 900000,
  },
  {
    id: '4m3',
    volumeText: '4 m³',
    volumeNumber: 4,
    capacityText: '24 boxes',
    image: size4m3Img,
    dimensions: '1.6m × 1.0m × Cao 2.5m',
    areaM2: 1.6,
    fitsDetailed: ['24 Thùng carton tài sản', 'Xe máy tay ga, xe đạp thể thao', 'Giường đơn, tủ đầu giường', 'Thiết bị điện tử, loa đài'],
    nonAcRate: 990000,
    acRate: 1180000,
  },
  {
    id: '5m3',
    volumeText: '5 m³',
    volumeNumber: 5,
    capacityText: '30 boxes',
    image: size5m3Img,
    dimensions: '1.9m × 1.0m × Cao 2.6m',
    areaM2: 1.9,
    fitsDetailed: ['30 Thùng carton cỡ vừa', 'Tủ lạnh mini, lò vi sóng', 'Sofa băng 2 chỗ', 'Toàn bộ đồ đạc phòng ngủ đơn'],
    nonAcRate: 1250000,
    acRate: 1500000,
  },
  {
    id: '6m3',
    volumeText: '6 m³',
    volumeNumber: 6,
    capacityText: '36 boxes',
    image: size6m3Img,
    dimensions: '2.3m × 1.0m × Cao 2.6m',
    areaM2: 2.3,
    fitsDetailed: ['36 Thùng carton hàng hóa', 'Sofa văng, bàn trà, TV 65-inch', 'Tủ quần áo 2 cánh gỗ', 'Máy giặt, máy sấy quần áo'],
    nonAcRate: 1500000,
    acRate: 1800000,
  },
  {
    id: '7m3',
    volumeText: '7 m³',
    volumeNumber: 7,
    capacityText: '42 boxes',
    image: size6m3Img,
    dimensions: '2.5m × 1.1m × Cao 2.6m',
    areaM2: 2.7,
    fitsDetailed: ['42 Thùng carton tài sản', 'Tủ quần áo 3 cánh', 'Bàn làm việc chữ L + Ghế công thái học', 'Giường nệm đôi tháo lắp'],
    nonAcRate: 1680000,
    acRate: 2010000,
  },
  {
    id: '8m3',
    volumeText: '8 m³',
    volumeNumber: 8,
    capacityText: '48 boxes',
    image: size8m3Img,
    dimensions: '2.5m × 1.2m × Cao 2.7m',
    areaM2: 3.0,
    fitsDetailed: ['48 Thùng hàng carton kinh doanh', 'Bàn ghế ăn 4-6 người', 'Giường đôi Queen-size + Nệm', 'Tủ lạnh 2 cánh, máy rửa bát'],
    nonAcRate: 1850000,
    acRate: 2220000,
  },
  {
    id: '9m3',
    volumeText: '9 m³',
    volumeNumber: 9,
    capacityText: '54 boxes (Studio)',
    image: size9m3Img,
    dimensions: '2.8m × 1.2m × Cao 2.7m',
    areaM2: 3.4,
    fitsDetailed: ['Toàn bộ đồ đạc căn hộ studio', 'Sofa chữ L, tủ lạnh side-by-side', 'Máy giặt, giường nệm, bàn ăn', '50+ Thùng carton tài sản'],
    nonAcRate: 2100000,
    acRate: 2520000,
  },
  {
    id: '10m3',
    volumeText: '10 m³',
    volumeNumber: 10,
    capacityText: '60 boxes (1 phòng ngủ)',
    image: size9m3Img,
    dimensions: '3.0m × 1.3m × Cao 2.7m',
    areaM2: 3.8,
    fitsDetailed: ['Toàn bộ nội thất căn hộ 1 phòng ngủ', 'Giường King-size + Nệm cao su', 'Tủ lớn 4 cánh, bàn trang điểm', '60+ Thùng đồ gia dụng và thiết bị'],
    nonAcRate: 2300000,
    acRate: 2760000,
  },
  {
    id: '12m3',
    volumeText: '12 m³',
    volumeNumber: 12,
    capacityText: '72 boxes (1–2 phòng ngủ)',
    image: size8m3Img,
    dimensions: '3.5m × 1.3m × Cao 2.7m',
    areaM2: 4.5,
    fitsDetailed: ['Toàn bộ nội thất căn hộ 2 phòng ngủ', '2 Bộ giường tủ, bộ bàn ăn 6 ghế', 'Tủ lạnh lớn, máy giặt, máy sấy', '70+ Thùng carton đồ đạc gia đình'],
    nonAcRate: 2700000,
    acRate: 3240000,
  },
  {
    id: '14m3',
    volumeText: '14 m³',
    volumeNumber: 14,
    capacityText: '85 boxes (Căn hộ 2PN lớn)',
    image: size9m3Img,
    dimensions: '3.8m × 1.4m × Cao 2.7m',
    areaM2: 5.2,
    fitsDetailed: ['Đồ đạc chung cư 2 phòng ngủ cao cấp', 'Sofa da cỡ đại, 2 tủ quần áo kịch trần', 'Thiết bị sự kiện, máy pha cafe công nghiệp', '85+ Thùng hàng hóa lưu kho'],
    nonAcRate: 3100000,
    acRate: 3720000,
  },
  {
    id: '16m3',
    volumeText: '16 m³',
    volumeNumber: 16,
    capacityText: '100 boxes (Căn hộ 3PN)',
    image: size8m3Img,
    dimensions: '4.0m × 1.5m × Cao 2.7m',
    areaM2: 6.0,
    fitsDetailed: ['Nội thất chuyển nhà nguyên căn hộ 3PN', '3 Bộ giường nệm, bàn ăn 8 người', 'Nội thất phòng khách, bếp đầy đủ', '100+ Thùng hàng kinh doanh online'],
    nonAcRate: 3500000,
    acRate: 4200000,
  },
  {
    id: '18m3',
    volumeText: '18 m³',
    volumeNumber: 18,
    capacityText: '115 boxes (Kho sỉ thương mại)',
    image: size9m3Img,
    dimensions: '4.5m × 1.5m × Cao 2.7m',
    areaM2: 6.8,
    fitsDetailed: ['Kho hàng sỉ thương mại điện tử', '2-3 Pallet hàng xuất nhập khẩu', 'Bàn ghế văn phòng cho 10-15 nhân sự', '115+ Thùng carton đóng kiện tiêu chuẩn'],
    nonAcRate: 3900000,
    acRate: 4680000,
  },
  {
    id: '20m3',
    volumeText: '20 m³',
    volumeNumber: 20,
    capacityText: '130 boxes (Kho doanh nghiệp)',
    image: size8m3Img,
    dimensions: '5.0m × 1.5m × Cao 2.7m',
    areaM2: 7.5,
    fitsDetailed: ['Hàng hóa phân phối quy mô doanh nghiệp vừa', '3-4 Pallet hàng công nghiệp, máy móc', 'Tài liệu hồ sơ doanh nghiệp lưu trữ 10 năm', '130+ Thùng carton tải trọng nặng'],
    nonAcRate: 4300000,
    acRate: 5160000,
  },
  {
    id: '24m3',
    volumeText: '24 m³',
    volumeNumber: 24,
    capacityText: '160 boxes (Kho logistics lớn)',
    image: size9m3Img,
    dimensions: '6.0m × 1.5m × Cao 2.7m',
    areaM2: 9.0,
    fitsDetailed: ['Kho trung chuyển bán lẻ & logistics', 'Nội thất toàn bộ biệt thự nhà phố', '5+ Pallet hàng hóa và thiết bị sân khấu', '160+ Thùng carton cồng kềnh'],
    nonAcRate: 5000000,
    acRate: 6000000,
  },
]

import {
  CHECK_IN_PERIOD_GROUPS,
  CHECK_IN_HOURS_24,
  CheckInPeriodGroup,
  isPeriodInPast,
  getFirstAvailablePeriod,
  hasAvailablePeriods,
  formatLocalDate,
} from '../../utils/checkInTimeSlots'

export { CHECK_IN_PERIOD_GROUPS, CHECK_IN_HOURS_24 }

export const resolveUnitTypeIdForSelectedSize = (size: StorageSizeUnitDef): string => {
  if (size.id.includes('cold')) {
    return '10000000-0000-0000-0000-000000000005' // Kho lạnh (kiểm soát nhiệt độ 18-22°C)
  }
  if (size.volumeNumber <= 2 || size.areaM2 <= 1.0) {
    return '10000000-0000-0000-0000-000000000001' // Mini (tủ cá nhân) - 1m²
  }
  if (size.volumeNumber <= 5 || size.areaM2 <= 2.0) {
    return '10000000-0000-0000-0000-000000000002' // Vừa (phòng studio nhỏ) - 3m²
  }
  if (size.volumeNumber <= 10 || size.areaM2 <= 4.0) {
    return '10000000-0000-0000-0000-000000000003' // Tiêu chuẩn (căn một phòng ngủ) - 6m²
  }
  return '10000000-0000-0000-0000-000000000004' // Rất lớn (văn phòng thương mại) - 12m²
}

export const BookingPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, isAuthenticated, logout } = useAuth()
  const { t } = useLanguage()

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [isNoUnitsModalOpen, setIsNoUnitsModalOpen] = useState(false)

  // Customer rental access state
  const isCustomer = user?.role?.name === 'CUSTOMER'
  const [customerAccess, setCustomerAccess] = useState(() => checkCustomerPortalAccess(user))
  const canAccessPortal = !isCustomer || customerAccess.hasAccess

  useEffect(() => {
    const handleRentalChange = () => {
      setCustomerAccess(checkCustomerPortalAccess(user))
    }
    window.addEventListener('boxora_rental_updated', handleRentalChange)
    return () => window.removeEventListener('boxora_rental_updated', handleRentalChange)
  }, [user])

  useEffect(() => {
    setCustomerAccess(checkCustomerPortalAccess(user))
  }, [user])

  // 1 -> 6 Step Flow:
  // Step 1: Chọn cơ sở
  // Step 2: Chọn kho / loại kho
  // Step 3: Thời hạn thuê & Báo giá
  // Step 4: Lịch hẹn & Chi tiết
  // Step 5: Hợp đồng & Thanh toán
  // Step 6: Hoàn tất giữ chỗ
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1)
  const [paymentMethod, setPaymentMethod] = useState<'ONLINE' | 'PAY_LATER'>('ONLINE')
  const [isOnlinePaid, setIsOnlinePaid] = useState<boolean>(false)
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false)

  // Data
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [storageUnits, setStorageUnits] = useState<StorageUnit[]>([])
  const [loadingData, setLoadingData] = useState<boolean>(true)

  // Step 1: Facility Selection
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null)

  // Step 2: Storage Size Selection
  const [selectedSizeId, setSelectedSizeId] = useState<string>('3m3')
  const [acSelectionMap, setAcSelectionMap] = useState<Record<string, 'NON_AC' | 'AC'>>({
    '1m3': 'NON_AC',
    '2m3': 'NON_AC',
    '3m3': 'AC',
    '4m3': 'AC',
    '5m3': 'NON_AC',
    '6m3': 'AC',
    '7m3': 'NON_AC',
    '8m3': 'AC',
    '9m3': 'NON_AC',
    '10m3': 'AC',
    '12m3': 'NON_AC',
    '14m3': 'AC',
    '16m3': 'NON_AC',
    '18m3': 'AC',
    '20m3': 'NON_AC',
    '24m3': 'AC',
  })

  // Category filter state for sizes in Step 2
  const [sizeFilterCategory, setSizeFilterCategory] = useState<'ALL' | 'PERSONAL' | 'FAMILY' | 'ENTERPRISE'>('ALL')
  const [sizeVisualMode, setSizeVisualMode] = useState<'3D' | 'PHOTO'>('3D')
  const [inspectVisualTab, setInspectVisualTab] = useState<'3D' | 'PHOTO'>('3D')
  const [inspectingSizeUnit, setInspectingSizeUnit] = useState<StorageSizeUnitDef | null>(null)

  // Step 3: Rental Duration & Dates
  const [durationMode, setDurationMode] = useState<'MONTHS' | 'CUSTOM_DAYS'>('MONTHS')
  const [rentalMonths, setRentalMonths] = useState<number>(3)
  const [customDays, setCustomDays] = useState<number>(7)

  // Step 4: Appointment Date & Time & Customer Details
  const [checkInDate, setCheckInDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })

  useEffect(() => {
    if (checkInDate) {
      setStartDate(checkInDate)
    }
  }, [checkInDate])

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(() => getFirstAvailablePeriod(checkInDate))

  useEffect(() => {
    if (isPeriodInPast(checkInDate, selectedPeriodId)) {
      setSelectedPeriodId(getFirstAvailablePeriod(checkInDate))
    }
  }, [checkInDate, selectedPeriodId])
  const selectedPeriod = useMemo(() => {
    return CHECK_IN_PERIOD_GROUPS.find((g) => g.id === selectedPeriodId) || CHECK_IN_PERIOD_GROUPS[0]
  }, [selectedPeriodId])

  const checkInTime = useMemo(() => {
    return `${selectedPeriod.name} (${selectedPeriod.rangeText})`
  }, [selectedPeriod])

  const [specialNotes, setSpecialNotes] = useState<string>('')
  const [policyAccepted, setPolicyAccepted] = useState<boolean>(true)

  // Customer Contact Information (Task 3)
  const [customerName, setCustomerName] = useState<string>('')
  const [customerPhone, setCustomerPhone] = useState<string>('')
  const [idCardType, setIdCardType] = useState<'CCCD' | 'PASSPORT'>('CCCD')
  const [customerIdCard, setCustomerIdCard] = useState<string>('')
  const [customerEmail, setCustomerEmail] = useState<string>('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Automatically pre-fill customer info when user is loaded
  useEffect(() => {
    if (user) {
      const pName = user.fullName || user.username || ''
      if (pName) {
        setCustomerName((prev) => (prev && prev !== 'Khách hàng' ? prev : pName))
      }
      const pPhone = user.phone || (user as any).phoneNumber || ''
      if (pPhone) {
        setCustomerPhone((prev) => (prev ? prev : pPhone))
      }
      if (user.email) {
        setCustomerEmail((prev) => (prev ? prev : user.email))
      }
      const savedCccd = (user as any).identityCardNumber || localStorage.getItem('boxora_user_cccd_' + user.email) || localStorage.getItem('boxora_user_cccd') || ''
      if (savedCccd) {
        setCustomerIdCard((prev) => (prev ? prev : savedCccd))
      }
    }
  }, [user])

  // Step 5 & 6: Submission & Result
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [bookingCode, setBookingCode] = useState<string>('')
  const [copiedCode, setCopiedCode] = useState<boolean>(false)

  // DocuSeal e-Signing state (Bước 2: Ký hợp đồng trực tuyến trước khi thanh toán)
  const [showDocuSealModal, setShowDocuSealModal] = useState<boolean>(false)
  const [contractForSigning, setContractForSigning] = useState<RentalContract | null>(null)
  const [createdBookingForSigning, setCreatedBookingForSigning] = useState<any>(null)

  // Load backend data
  useEffect(() => {
    let isMounted = true
    setLoadingData(true)

    Promise.allSettled([
      facilityService.getFacilities({ page: 0, size: 50 }),
      storageUnitService.getUnits({ status: 'AVAILABLE' }),
    ])
      .then(([facRes, unitRes]) => {
        if (!isMounted) return

        let activeList: Facility[] = []
        if (facRes.status === 'fulfilled' && Array.isArray(facRes.value?.content)) {
          activeList = facRes.value.content.filter((f) => !f.status || f.status === 'ACTIVE')
          setFacilities(activeList)
        }

        if (unitRes.status === 'fulfilled' && Array.isArray(unitRes.value)) {
          setStorageUnits(unitRes.value)
        }

        // Restore draft from sessionStorage or localStorage if exists (Task 2: Guest Flow Persistence)
        try {
          const draftStr = sessionStorage.getItem('boxora_booking_draft') || localStorage.getItem('boxora_booking_draft')
          if (draftStr) {
            const draft = JSON.parse(draftStr)
            if (draft.facilityId && activeList.length > 0) {
              const matchedFac = activeList.find((f) => f.id === draft.facilityId)
              if (matchedFac) setSelectedFacility(matchedFac)
            } else if (activeList.length > 0 && !selectedFacility) {
              setSelectedFacility(activeList[0])
            }
            if (draft.selectedSizeId) setSelectedSizeId(draft.selectedSizeId)
            if (draft.acMode && draft.selectedSizeId) {
              setAcSelectionMap((prev) => ({ ...prev, [draft.selectedSizeId]: draft.acMode }))
            }
            if (draft.durationMode) setDurationMode(draft.durationMode)
            if (draft.rentalMonths) setRentalMonths(draft.rentalMonths)
            if (draft.customDays) setCustomDays(draft.customDays)
            if (draft.checkInDate) setCheckInDate(draft.checkInDate)
            if (draft.selectedPeriodId) setSelectedPeriodId(draft.selectedPeriodId)
            if (draft.customerName) setCustomerName(draft.customerName)
            if (draft.customerPhone) setCustomerPhone(draft.customerPhone)
            if (draft.customerEmail) setCustomerEmail(draft.customerEmail)
            if (draft.specialNotes) setSpecialNotes(draft.specialNotes)
            if (draft.idCardType) setIdCardType(draft.idCardType)

            // If user has now logged in, restore and transition directly to step 4
            if (isAuthenticated) {
              sessionStorage.removeItem('boxora_booking_draft')
              localStorage.removeItem('boxora_booking_draft')
              const userCccd = (user as any)?.identityCardNumber || localStorage.getItem('boxora_user_cccd_' + user?.email) || localStorage.getItem('boxora_user_cccd') || ''
              if (userCccd && !customerIdCard) {
                setCustomerIdCard(userCccd)
              }
              setCurrentStep(4)
            }
            return
          }
        } catch (e) {
          console.warn('Draft restoration error:', e)
        }

        // URL param matching fallback
        const facParam = searchParams.get('facility')
        if (facParam && activeList.length > 0) {
          const matchedFacility = activeList.find(
            (f) =>
              f.id === facParam ||
              (f.code && f.code.toLowerCase() === facParam.toLowerCase()) ||
              (f.name && f.name.toLowerCase().includes(facParam.toLowerCase()))
          )
          if (matchedFacility) setSelectedFacility(matchedFacility)
          else if (activeList.length > 0 && !selectedFacility) setSelectedFacility(activeList[0])
        } else if (activeList.length > 0 && !selectedFacility) {
          setSelectedFacility(activeList[0])
        }
      })
      .finally(() => {
        if (isMounted) setLoadingData(false)
      })

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, user])

  // Dedicated listener to advance to step 4 whenever user is authenticated and has a pending booking draft
  useEffect(() => {
    if (isAuthenticated) {
      try {
        const draftStr = sessionStorage.getItem('boxora_booking_draft') || localStorage.getItem('boxora_booking_draft')
        if (draftStr) {
          const draft = JSON.parse(draftStr)
          if (draft.selectedSizeId) setSelectedSizeId(draft.selectedSizeId)
          if (draft.acMode && draft.selectedSizeId) {
            setAcSelectionMap((prev) => ({ ...prev, [draft.selectedSizeId]: draft.acMode }))
          }
          if (draft.durationMode) setDurationMode(draft.durationMode)
          if (draft.rentalMonths) setRentalMonths(draft.rentalMonths)
          if (draft.customDays) setCustomDays(draft.customDays)
          if (draft.checkInDate) setCheckInDate(draft.checkInDate)
          if (draft.selectedPeriodId) setSelectedPeriodId(draft.selectedPeriodId)
          if (draft.specialNotes) setSpecialNotes(draft.specialNotes)
          if (draft.idCardType) setIdCardType(draft.idCardType)

          if (draft.facilityId && facilities.length > 0) {
            const matched = facilities.find((f) => f.id === draft.facilityId)
            if (matched) setSelectedFacility(matched)
          }

          // Pre-fill profile info
          const pName = user?.fullName || user?.username || draft.customerName || ''
          if (pName) setCustomerName(pName)
          const pPhone = user?.phone || (user as any)?.phoneNumber || draft.customerPhone || ''
          if (pPhone) setCustomerPhone(pPhone)
          if (user?.email || draft.customerEmail) setCustomerEmail(user?.email || draft.customerEmail)
          const userCccd = (user as any)?.identityCardNumber || localStorage.getItem('boxora_user_cccd_' + user?.email) || localStorage.getItem('boxora_user_cccd') || ''
          if (userCccd) setCustomerIdCard(userCccd)

          sessionStorage.removeItem('boxora_booking_draft')
          localStorage.removeItem('boxora_booking_draft')
          setCurrentStep(4)
        }
      } catch (err) {
        console.warn('Draft auto advance error:', err)
      }
    }
  }, [isAuthenticated, user, facilities])

  // Facilities with real available unit counts (Task 1: No fake fallback)
  const sortedFacilities = useMemo(() => {
    return facilities.map((fac) => {
      const unitsInFac = storageUnits.filter((u) => u.facilityId === fac.id)
      const availableCount = unitsInFac.filter(
        (u) => u.status === 'AVAILABLE' || (u.status as string) === 'Trống'
      ).length

      return {
        ...fac,
        availableCount,
      }
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [facilities, storageUnits])

  // Real available units for selected facility
  const availableFacilityUnits = useMemo(() => {
    if (!selectedFacility) return []

    // Đọc các đơn đặt giữ chỗ đang chiếm giữ buồng kho
    const localReservedUnitIds = new Set<string>()
    try {
      const raw = localStorage.getItem('boxora_guest_reservations')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          parsed.forEach((r: any) => {
            const isHolding = r.status !== 'CANCELLED' && r.status !== 'COMPLETED'
            if (isHolding && r.storageUnitId) {
              localReservedUnitIds.add(r.storageUnitId)
            }
          })
        }
      }
    } catch {}

    return storageUnits.filter(
      (u) =>
        u.facilityId === selectedFacility.id &&
        (u.status === 'AVAILABLE' || (u.status as string) === 'Trống') &&
        !localReservedUnitIds.has(u.id)
    )
  }, [storageUnits, selectedFacility])

  // Lắng nghe sự kiện toàn hệ thống để tự động đồng bộ số lượng kho khả dụng thời gian thực
  const refreshAvailableUnits = useCallback(async () => {
    try {
      const unitRes = await storageUnitService.getUnits({ status: 'AVAILABLE' })
      const list = Array.isArray(unitRes) ? unitRes : ((unitRes as any)?.content || [])
      if (Array.isArray(list)) {
        setStorageUnits(list)
      }
    } catch (e) {
      console.warn('Refresh available units error:', e)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('boxora:storage-units-refresh', refreshAvailableUnits)
    window.addEventListener('boxora_reservation_updated', refreshAvailableUnits)
    window.addEventListener('boxora_new_reservation', refreshAvailableUnits)
    return () => {
      window.removeEventListener('boxora:storage-units-refresh', refreshAvailableUnits)
      window.removeEventListener('boxora_reservation_updated', refreshAvailableUnits)
      window.removeEventListener('boxora_new_reservation', refreshAvailableUnits)
    }
  }, [refreshAvailableUnits])

  useEffect(() => {
    if (currentStep === 2) {
      refreshAvailableUnits()
    }
  }, [currentStep, refreshAvailableUnits])

  // Real sizes that exist and are available in the selected facility
  const availableSizesInFacility = useMemo(() => {
    if (availableFacilityUnits.length === 0) return []
    const matchedSet = new Set<string>()
    availableFacilityUnits.forEach((unit) => {
      let bestMatch = STORAGE_SIZES_CATALOG[0]
      let bestDiff = 999
      for (const s of STORAGE_SIZES_CATALOG) {
        const typeName = (unit.unitTypeName || '').toLowerCase()
        if (typeName.includes(s.id)) {
          bestMatch = s
          bestDiff = 0
          break
        }
        const diff = Math.abs((unit.areaSqMeters || 1) - s.areaM2)
        if (diff < bestDiff) {
          bestDiff = diff
          bestMatch = s
        }
      }
      matchedSet.add(bestMatch.id)
    })
    return STORAGE_SIZES_CATALOG.filter((s) => matchedSet.has(s.id))
  }, [availableFacilityUnits])

  // Count available units for a size in the selected facility
  const getAvailableCountForSize = (sizeUnit: StorageSizeUnitDef) => {
    return availableFacilityUnits.filter((u) => {
      const name = (u.unitTypeName || '').toLowerCase()
      if (name.includes(sizeUnit.id)) return true
      if (u.areaSqMeters && Math.abs(u.areaSqMeters - sizeUnit.areaM2) < 0.6) return true
      return false
    }).length
  }

  // Filter sizes based on category tab
  const filteredSizesCatalog = useMemo(() => {
    const source = availableSizesInFacility.length > 0 ? availableSizesInFacility : []
    if (sizeFilterCategory === 'PERSONAL') {
      return source.filter((s) => s.volumeNumber <= 4)
    }
    if (sizeFilterCategory === 'FAMILY') {
      return source.filter((s) => s.volumeNumber >= 5 && s.volumeNumber <= 9)
    }
    if (sizeFilterCategory === 'ENTERPRISE') {
      return source.filter((s) => s.volumeNumber >= 10)
    }
    return source
  }, [availableSizesInFacility, sizeFilterCategory])

  // Auto-sync selectedSizeId when facility changes or size becomes invalid
  useEffect(() => {
    if (availableSizesInFacility.length > 0) {
      if (!selectedSizeId || !availableSizesInFacility.some((s) => s.id === selectedSizeId)) {
        setSelectedSizeId(availableSizesInFacility[0].id)
      }
    }
  }, [availableSizesInFacility, selectedSizeId])

  // Handle switching facility (Task 1: reset size, reload fresh units)
  const handleSelectFacility = async (fac: Facility) => {
    if (selectedFacility?.id !== fac.id) {
      setSelectedFacility(fac)
      setSelectedSizeId('') // Clear unit selection
      try {
        const res = await storageUnitService.getUnits({ facilityId: fac.id, status: 'AVAILABLE' })
        const fresh = Array.isArray(res) ? res : ((res as any)?.content || [])
        setStorageUnits((prev) => {
          const others = prev.filter((u) => u.facilityId !== fac.id)
          return [...others, ...fresh]
        })
      } catch (e) {
        console.warn('Failed to refresh units for facility:', e)
      }
    }
  }

  const currentSelectedSize = useMemo(() => {
    if (selectedSizeId) {
      const found = STORAGE_SIZES_CATALOG.find((s) => s.id === selectedSizeId)
      if (found) return found
    }
    if (availableSizesInFacility.length > 0) {
      return availableSizesInFacility[0]
    }
    return STORAGE_SIZES_CATALOG[2]
  }, [selectedSizeId, availableSizesInFacility])

  const isAcActive = acSelectionMap[currentSelectedSize.id] === 'AC'

  // Rental duration helpers & validation
  const isCustomDuration = durationMode === 'CUSTOM_DAYS'
  const isDurationValid = isCustomDuration
    ? typeof customDays === 'number' && customDays >= 7
    : rentalMonths >= 1

  const rentalDurationText = useMemo(() => {
    return isCustomDuration ? `${customDays} ngày` : `${rentalMonths} tháng`
  }, [isCustomDuration, customDays, rentalMonths])

  const rentalEndDate = useMemo(() => {
    if (!startDate) return ''
    const d = new Date(startDate)
    if (isCustomDuration) {
      d.setDate(d.getDate() + (customDays || 7))
    } else {
      d.setMonth(d.getMonth() + rentalMonths)
    }
    return d.toISOString().split('T')[0]
  }, [startDate, isCustomDuration, customDays, rentalMonths])

  // Pricing calculation
  const quoteCalculation = useMemo(() => {
    const baseMonthly = isAcActive ? currentSelectedSize.acRate : currentSelectedSize.nonAcRate
    const dailyRate = Math.round(baseMonthly / 30)

    let discountPercent = 0
    if (isCustomDuration) {
      if (customDays >= 720) discountPercent = 20
      else if (customDays >= 365) discountPercent = 15
      else if (customDays >= 180) discountPercent = 10
      else if (customDays >= 90) discountPercent = 5
    } else {
      if (rentalMonths >= 24) discountPercent = 20
      else if (rentalMonths >= 12) discountPercent = 15
      else if (rentalMonths >= 6) discountPercent = 10
      else if (rentalMonths >= 3) discountPercent = 5
    }

    const discountAmountPerMonth = Math.round(baseMonthly * (discountPercent / 100))
    const monthlyAfterDiscount = baseMonthly - discountAmountPerMonth
    const rawRent = isCustomDuration ? dailyRate * Math.max(1, customDays) : baseMonthly * rentalMonths
    const discountAmount = Math.round(rawRent * (discountPercent / 100))
    const totalRent = isCustomDuration
      ? dailyRate * Math.max(1, customDays)
      : monthlyAfterDiscount * rentalMonths
    const depositAmount = baseMonthly

    return {
      baseMonthly,
      dailyRate,
      rawRent,
      discountPercent,
      discountAmount,
      discountAmountPerMonth,
      monthlyAfterDiscount,
      totalRent,
      depositAmount,
      totalEstimate: totalRent + depositAmount,
    }
  }, [currentSelectedSize, isAcActive, isCustomDuration, rentalMonths, customDays])

  // Toggle AC mode for a size
  const handleToggleAc = (sizeId: string, mode: 'NON_AC' | 'AC', e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setAcSelectionMap((prev) => ({
      ...prev,
      [sizeId]: mode,
    }))
  }

  // Dispatch booking reservation to Staff and in-app notifications
  const sendReservationToStaff = (
    code: string,
    method: 'ONLINE' | 'PAY_LATER' = 'PAY_LATER',
    isPaid = false,
    backendBookingId = '',
    storageUnitId?: string,
    unitCode?: string
  ) => {
    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ngày ' + new Date().toLocaleDateString('vi-VN')
    const reservationData = {
      id: backendBookingId || 'res_' + Date.now(),
      bookingCode: code,
      storageUnitId: storageUnitId || '',
      unitCode: unitCode || '',
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerIdCard: customerIdCard.trim(),
      customerEmail: customerEmail.trim(),
      facilityId: selectedFacility?.id,
      facilityName: selectedFacility?.name,
      facilityAddress: selectedFacility?.address,
      sizeId: currentSelectedSize.id,
      sizeName: `Kho ${currentSelectedSize.volumeText}`,
      unitTypeName: `Kho ${currentSelectedSize.volumeText} (${isAcActive ? 'A/C Máy lạnh' : 'Thường'})`,
      dimensions: currentSelectedSize.dimensions,
      isAc: isAcActive,
      rentalDuration: rentalDurationText,
      checkInDate: checkInDate,
      checkInTime: checkInTime,
      totalRent: quoteCalculation.totalRent,
      depositAmount: quoteCalculation.depositAmount,
      totalEstimate: quoteCalculation.totalEstimate,
      paymentMethod: method,
      paymentStatus: isPaid ? 'PAID' : 'PENDING',
      createdAt: new Date().toISOString(),
      createdTimeFormatted: timeStr,
      specialNotes: specialNotes.trim(),
    }

    try {
      const savedList = JSON.parse(localStorage.getItem('boxora_guest_reservations') || '[]')
      savedList.unshift(reservationData)
      localStorage.setItem('boxora_guest_reservations', JSON.stringify(savedList.slice(0, 50)))

      const newStaffNotif = {
        id: 'notif_' + Date.now(),
        type: 'NEW_BOOKING_RESERVATION',
        title: `Đơn giữ chỗ mới: ${code}`,
        message: `Khách hàng ${customerName.trim()} vừa đặt giữ chỗ Kho ${currentSelectedSize.volumeText} tại ${selectedFacility?.name}. Nhận bàn giao: ${checkInDate} (${checkInTime}).`,
        createdAt: new Date().toISOString(),
        read: false,
        bookingCode: code,
        facilityId: selectedFacility?.id,
      }
      const existingNotifs = JSON.parse(localStorage.getItem('boxora_in_app_notifications') || '[]')
      existingNotifs.unshift(newStaffNotif)
      localStorage.setItem('boxora_in_app_notifications', JSON.stringify(existingNotifs.slice(0, 100)))

      window.dispatchEvent(new Event('boxora_new_reservation'))
    } catch (e) {
      console.warn('LocalStorage notification warning:', e)
    }
  }

  // Strict Validation (Task 3)
  const validateContactDetails = (): boolean => {
    const errors: Record<string, string> = {}

    // 1. Họ và tên: chỉ cần có chữ cái, không space rỗng hoặc ký tự đặc biệt
    const nameTrim = customerName.trim()
    if (!nameTrim) {
      errors.customerName = 'Vui lòng nhập họ và tên của bạn'
    } else if (!/^[\p{L}\s]+$/u.test(nameTrim)) {
      errors.customerName = 'Họ và tên chỉ được chứa chữ cái, không chứa số hoặc ký tự đặc biệt'
    } else if (nameTrim.length > 100) {
      errors.customerName = 'Họ và tên không được vượt quá 100 ký tự'
    }

    // 2. Số điện thoại di động VN
    const cleanPhone = customerPhone.trim().replace(/[\s.-]/g, '')
    if (!cleanPhone) {
      errors.customerPhone = 'Vui lòng nhập số điện thoại liên hệ'
    } else if (!/^(0|\+84)(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/.test(cleanPhone)) {
      errors.customerPhone = 'Số điện thoại di động Việt Nam không hợp lệ (10 số, bắt đầu bằng 03, 05, 07, 08, 09 hoặc +84)'
    }

    // 3. Số CCCD / Hộ chiếu
    const cleanId = customerIdCard.trim().toUpperCase()
    if (!cleanId) {
      errors.customerIdCard = idCardType === 'CCCD' ? 'Vui lòng nhập số CCCD 12 chữ số' : 'Vui lòng nhập số Hộ chiếu'
    } else if (idCardType === 'CCCD') {
      if (!/^\d{12}$/.test(cleanId)) {
        errors.customerIdCard = 'Số CCCD phải bao gồm đúng 12 chữ số'
      }
    } else {
      if (!/^[A-Z][0-9]{7,8}$/.test(cleanId)) {
        errors.customerIdCard = 'Số Hộ chiếu không hợp lệ (1 chữ cái in hoa theo sau là 7-8 chữ số)'
      }
    }

    // 4. Email: Bắt buộc và đúng định dạng RFC
    const emailTrim = customerEmail.trim()
    if (!emailTrim) {
      errors.customerEmail = 'Vui lòng nhập địa chỉ email nhận thông tin hợp đồng và phiếu hẹn'
    } else if (!/^[A-Za-z0-9+_.-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})$/.test(emailTrim)) {
      errors.customerEmail = 'Địa chỉ email không đúng định dạng (ví dụ: name@domain.com)'
    }

    // 5. Ghi chú (tối đa 500 ký tự)
    if (specialNotes && specialNotes.length > 500) {
      errors.specialNotes = 'Ghi chú tối đa 500 ký tự'
    }

    // 6. Quy chế chính sách
    if (!policyAccepted) {
      errors.policyAccepted = 'Quý khách vui lòng đồng ý với chính sách và quy chế giữ chỗ kho của Boxora'
    }

    // 7. Khung giờ tiếp đón không thuộc quá khứ
    if (isPeriodInPast(checkInDate, selectedPeriodId)) {
      errors.checkInTime = 'Khung giờ tiếp đón bạn chọn đã kết thúc. Vui lòng chọn khung giờ khác hoặc ngày tiếp theo.'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle Process Payment & Confirm (DocuSeal E-sign -> VNPay Sandbox)
  const handleProcessPaymentAndConfirm = async (overrideMethod?: 'ONLINE' | 'PAY_LATER') => {
    const selectedMethod = overrideMethod || paymentMethod

    if (!customerName.trim() || !customerPhone.trim() || !customerIdCard.trim()) {
      setSubmitError('Vui lòng kiểm tra và điền đầy đủ Họ tên, Số điện thoại và Số CCCD.')
      setCurrentStep(3)
      return
    }

    if (isPeriodInPast(checkInDate, selectedPeriodId)) {
      setSubmitError('Khung giờ tiếp đón bạn chọn đã kết thúc. Vui lòng chọn khung giờ khác hoặc ngày tiếp theo.')
      setCurrentStep(3)
      return
    }

    // Lưu lại số CCCD để tiện tái sử dụng
    if (customerIdCard.trim()) {
      if (user?.email) localStorage.setItem('boxora_user_cccd_' + user.email, customerIdCard.trim())
      localStorage.setItem('boxora_user_cccd', customerIdCard.trim())
    }

    // Nếu chọn Thanh toán online nhưng chưa đăng nhập tài khoản
    if (selectedMethod === 'ONLINE' && !isAuthenticated) {
      setShowAuthModal(true)
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    const randomSuffix = Math.floor(1000 + Math.random() * 9000)
    const nowStr = new Date().toISOString().slice(2, 10).replace(/-/g, '')
    const generatedCode = `BX-${nowStr}-${randomSuffix}`

    try {
      // Tìm buồng kho phù hợp tại cơ sở theo kích thước người dùng đã chọn
      let allUnits = storageUnits
      const availableInCurrent = allUnits.filter((u) => u.status === 'AVAILABLE' || (u.status as string) === 'Trống')
      if (availableInCurrent.length === 0) {
        try {
          const freshRes = await storageUnitService.getUnits({ status: 'AVAILABLE' })
          const freshList = Array.isArray(freshRes) ? freshRes : ((freshRes as any)?.content || [])
          if (freshList.length > 0) allUnits = freshList
        } catch (uErr) {
          console.warn('Refresh available units warning:', uErr)
        }
      }
      const facUnits = allUnits.filter((u) => u.facilityId === selectedFacility?.id)
      const availableAll = allUnits.filter((u) => u.status === 'AVAILABLE' || (u.status as string) === 'Trống')
      const available = facUnits.filter((u) => u.status === 'AVAILABLE' || (u.status as string) === 'Trống')

      let matchedUnit = available.find((u) => Math.abs((u.areaSqMeters || 0) - currentSelectedSize.areaM2) < 0.8)
      if (!matchedUnit) {
        matchedUnit = available.find((u) => (u.unitTypeName || '').toLowerCase().includes(currentSelectedSize.id))
      }
      if (!matchedUnit) {
        matchedUnit = available[0] || availableAll[0] || facUnits[0] || allUnits[0]
      }

      let effectiveBookingCode = generatedCode
      let backendBookingId = ''
      let createdBooking: any = null

      try {
        const cleanTime = selectedPeriod.id === 'morning' ? '09:00' : (selectedPeriod.hours[0]?.value || '09:00')
        let expectedCheckInStr = `${checkInDate}T${cleanTime}:00`
        const parsedCheckIn = new Date(expectedCheckInStr)
        const minAllowedMs = Date.now() + 5.25 * 3600 * 1000
        if (!Number.isNaN(parsedCheckIn.getTime()) && parsedCheckIn.getTime() < minAllowedMs) {
          const safeDate = new Date(minAllowedMs)
          const pad = (n: number) => String(n).padStart(2, '0')
          expectedCheckInStr = `${safeDate.getFullYear()}-${pad(safeDate.getMonth() + 1)}-${pad(safeDate.getDate())}T${pad(safeDate.getHours())}:${pad(safeDate.getMinutes())}:00`
        }

        const resolvedUnitTypeId = resolveUnitTypeIdForSelectedSize(currentSelectedSize)

        const res = await bookingService.createBooking({
          facilityId: selectedFacility?.id,
          unitTypeId: resolvedUnitTypeId,
          fullName: customerName.trim(),
          phone: customerPhone.trim().replace(/[\s.-]/g, ''),
          email: customerEmail.trim(),
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim().replace(/[\s.-]/g, ''),
          customerEmail: customerEmail.trim(),
          startDate: startDate,
          rentalMonths: isCustomDuration ? Math.max(1, Math.round(customDays / 30)) : rentalMonths,
          totalRentalFee: quoteCalculation.totalRent,
          depositPaid: 0,
          depositAmount: quoteCalculation.depositAmount,
          signingMethod: selectedMethod === 'ONLINE' ? 'ONLINE' : 'IN_PERSON',
          initialStatus: selectedMethod === 'ONLINE' ? 'PENDING_SIGNATURE' : 'PENDING_CONTACT',
          expectedCheckInAt: expectedCheckInStr,
          checkInTime: cleanTime,
          identityCardNumber: customerIdCard.trim(),
          identityCardType: idCardType,
          specialNotes: specialNotes.trim() || undefined,
        })

        if (res?.bookingCode || res?.id) {
          effectiveBookingCode = res.bookingCode || `BX-${res.id.slice(0, 8).toUpperCase()}`
          backendBookingId = res.id
          createdBooking = res
          window.dispatchEvent(new Event('boxora:storage-units-refresh'))
        }
      } catch (apiErr: any) {
        console.warn('Backend booking API error:', apiErr)
        const fieldErrors = apiErr?.response?.data?.errors
        const detailedFieldMsg =
          fieldErrors && typeof fieldErrors === 'object' && Object.keys(fieldErrors).length > 0
            ? `Chi tiết trường không hợp lệ: ${Object.entries(fieldErrors)
                .map(([k, v]) => `${k} (${String(v)})`)
                .join(' | ')}`
            : ''
        const msg = detailedFieldMsg
          ? `${apiErr?.response?.data?.message || 'Dữ liệu yêu cầu không hợp lệ.'} — ${detailedFieldMsg}`
          : apiErr?.response?.data?.message || apiErr?.message
        if (selectedMethod === 'ONLINE') {
          throw new Error(msg || 'Không thể tạo phiên giữ chỗ trên hệ thống để kết nối cổng thanh toán. Quý khách vui lòng thử lại hoặc chọn Thanh toán sau khi nhận kho.')
        }
      }

      setBookingCode(effectiveBookingCode)

      // Xử lý theo phương thức thanh toán đã chọn
      if (selectedMethod === 'ONLINE') {
        if (!backendBookingId) {
          throw new Error('Chưa thể khởi tạo thông tin giao dịch trực tuyến. Quý khách vui lòng thử lại hoặc chọn hình thức Thanh toán sau khi nhận kho.')
        }

        // Bước 1 & 2: Lấy hợp đồng điện tử DocuSeal (ghi theo Size_ID) và mở modal cho khách ký trước khi thanh toán
        setCreatedBookingForSigning(createdBooking)
        let contract = null
        try {
          contract = await contractService.getContractByBookingId(backendBookingId)
        } catch (cErr) {
          console.warn('Error fetching contract for signing:', cErr)
        }

        if (!contract) {
          throw new Error('Không thể khởi tạo tài liệu hợp đồng điện tử DocuSeal. Vui lòng thử lại.')
        }

        setContractForSigning(contract)
        setShowDocuSealModal(true)
        setIsSubmitting(false)
        return
      } else {
        // Thanh toán sau khi nhận kho: Lưu đơn PENDING_CONTACT (chọn kho khi check-in tại quầy)
        setIsOnlinePaid(false)
        sendReservationToStaff(
          effectiveBookingCode,
          'PAY_LATER',
          false,
          backendBookingId,
          undefined,
          undefined
        )
        window.dispatchEvent(new Event('boxora:storage-units-refresh'))
        setCurrentStep(6)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch (err: any) {
      console.error('Reservation error:', err)
      const errorMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Có lỗi xảy ra khi xác nhận đặt chỗ. Vui lòng thử lại hoặc liên hệ Hotline 1900-BOXORA.'
      setSubmitError(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }


  // Bước 3: Sau khi khách ký hợp đồng trực tuyến DocuSeal thành công -> Tạo VNPay và chuyển hướng sang Sandbox
  const handleDocuSealSignedSuccess = async (_signedContract: RentalContract) => {
    setShowDocuSealModal(false)
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      if (!createdBookingForSigning) {
        throw new Error('Không tìm thấy thông tin đơn đặt chỗ đã ký.')
      }

      const paymentAmount = (createdBookingForSigning?.totalRentalFee != null && createdBookingForSigning?.depositAmount != null)
        ? Math.round(Number(createdBookingForSigning.totalRentalFee) + Number(createdBookingForSigning.depositAmount))
        : (createdBookingForSigning?.initialPaymentAmount != null
            ? Math.round(Number(createdBookingForSigning.initialPaymentAmount))
            : quoteCalculation.totalEstimate)

      const payRes = await paymentService.createVNPayPayment({
        bookingId: createdBookingForSigning.id,
        paymentType: 'BOOKING_PAYMENT',
        amount: paymentAmount,
        orderInfo: `Thanh toan giu cho ${createdBookingForSigning.bookingCode}`,
        returnUrl: `${window.location.origin}/payment-result`,
      })

      if (payRes?.paymentUrl) {
        sendReservationToStaff(createdBookingForSigning.bookingCode, 'ONLINE', false, createdBookingForSigning.id)
        window.location.assign(payRes.paymentUrl)
      } else {
        throw new Error('Cổng thanh toán không phản hồi đường dẫn giao dịch. Vui lòng thử lại trong giây lát.')
      }
    } catch (err: any) {
      console.error('VNPay redirect after sign error:', err)
      setSubmitError(err?.message || 'Hợp đồng đã ký thành công, nhưng không thể kết nối tới cổng thanh toán VNPay Sandbox. Vui lòng thử lại.')
      setIsSubmitting(false)
    }
  }

  const isStep3Valid = Boolean(
    isDurationValid &&
    customerName.trim().length > 0 &&
    customerPhone.trim().length > 0 &&
    customerIdCard.trim().length > 0
  )


  const handleNextStep = () => {
    if (currentStep === 1) {
      const activeFac = selectedFacility || (sortedFacilities.length > 0 ? sortedFacilities[0] : null)
      if (!selectedFacility && activeFac) {
        setSelectedFacility(activeFac)
      }
      const unitsInFac = activeFac
        ? storageUnits.filter(
            (u) => u.facilityId === activeFac.id && (u.status === 'AVAILABLE' || (u.status as string) === 'Trống')
          )
        : []
      if (!activeFac || unitsInFac.length === 0 || (activeFac as any).availableCount === 0) {
        setIsNoUnitsModalOpen(true)
        return
      }
      setCurrentStep(2)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (currentStep === 2) {
      if (availableFacilityUnits.length === 0) {
        setIsNoUnitsModalOpen(true)
        return
      }
      if (!selectedSizeId && availableSizesInFacility.length > 0) {
        setSelectedSizeId(availableSizesInFacility[0].id)
      }
      setCurrentStep(3)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (currentStep === 3) {
      if (!isDurationValid) {
        alert('Thời gian thuê ngắn hạn tối thiểu là 7 ngày. Vui lòng kiểm tra lại.')
        return
      }

      // Customer MUST be logged in or registered before proceeding to Step 4
      if (!isAuthenticated || !user) {
        const draft = {
          facilityId: selectedFacility?.id,
          selectedSizeId,
          acMode: isAcActive ? 'AC' : 'NON_AC',
          durationMode,
          rentalMonths,
          customDays,
          checkInDate,
          selectedPeriodId,
          fullName: customerName.trim(),
          phone: customerPhone.trim().replace(/[\s.-]/g, ''),
          email: customerEmail.trim(),
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim().replace(/[\s.-]/g, ''),
          customerEmail: customerEmail.trim(),
          specialNotes: specialNotes.trim(),
          idCardType,
          targetStep: 4,
        }
        sessionStorage.setItem('boxora_booking_draft', JSON.stringify(draft))
        setShowAuthModal(true)
        return
      }

      // Auto pre-fill info from user profile when authenticated
      if (user) {
        const pName = user.fullName || user.username || ''
        if (pName && (!customerName.trim() || customerName === 'Khách hàng')) {
          setCustomerName(pName)
        }
        const pPhone = user.phone || (user as any).phoneNumber || ''
        if (pPhone && !customerPhone.trim()) {
          setCustomerPhone(pPhone)
        }
        if (user.email && !customerEmail.trim()) {
          setCustomerEmail(user.email)
        }
        const savedCccd = (user as any).identityCardNumber || localStorage.getItem('boxora_user_cccd_' + user.email) || localStorage.getItem('boxora_user_cccd') || ''
        if (savedCccd && !customerIdCard.trim()) {
          setCustomerIdCard(savedCccd)
        }
      }

      setCurrentStep(4)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (currentStep === 4) {
      const isValid = validateContactDetails()
      if (!isValid) {
        return
      }

      // Safety check: ensure user is authenticated
      if (!isAuthenticated || !user) {
        setShowAuthModal(true)
        return
      }

      setCurrentStep(5)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (currentStep === 5) {
      void handleProcessPaymentAndConfirm()
      return
    }
  }

  // Handle Prev Step
  const handlePrevStep = () => {
    if (currentStep === 2) {
      setCurrentStep(1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (currentStep === 3) {
      setCurrentStep(2)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (currentStep === 4) {
      setCurrentStep(3)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (currentStep === 5) {
      setCurrentStep(4)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
  }



  const handleCopyCode = () => {
    if (!bookingCode) return
    navigator.clipboard.writeText(bookingCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2500)
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      
      {/* 1. TOP UNIFIED NAVIGATION BAR */}
      <header className="sticky top-0 z-[100] border-b border-slate-200/70 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-13 sm:h-14 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-6 sm:gap-8">
            <BrandLogo size="md" />

            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pl-6 border-l border-slate-200 dark:border-slate-800">
              <span className="font-semibold text-slate-900 dark:text-white">Quy trình đặt kho</span>
              <span>•</span>
              <span>Minh bạch chi phí</span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Tự động 24/7</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <QuickThemeLanguageToggle />

            {isAuthenticated ? (
              <UserAvatarDropdown
                user={user}
                role={user?.role?.name || 'CUSTOMER'}
                onOpenProfile={() => setIsProfileModalOpen(true)}
                onOpenSettings={() => setIsSettingsModalOpen(true)}
                onOpenLogoutConfirm={() => setIsLogoutConfirmOpen(true)}
                extraActions={
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                    {canAccessPortal ? (
                      <button
                        type="button"
                        onClick={() => navigate(isCustomer ? '/portal/customer' : '/portal')}
                        className="w-full py-2.5 px-3.5 rounded-xl bg-blue-600 dark:bg-blue-600 text-white font-semibold text-xs flex items-center justify-between hover:bg-blue-700 dark:hover:bg-blue-700 transition-all shadow-xs cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-emerald-400">dashboard</span>
                          <span>{isCustomer ? t('Vào Portal Quản Lý Kho (Khóa IoT)') : t('Vào Trang Điều Hành Portal')}</span>
                        </span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate('/portal/customer?tab=bookings')}
                        className="w-full py-2.5 px-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-semibold text-xs flex items-center justify-between hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all shadow-xs cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-400">calendar_month</span>
                          <span>{t('Đơn Đặt Giữ Chỗ Của Tôi')}</span>
                        </span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </button>
                    )}
                  </div>
                }
              />
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 py-2 text-[13px] font-medium text-slate-700 dark:text-slate-300 transition-colors hover:text-slate-950 dark:hover:text-white"
                >
                  {t('Đăng Nhập')}
                </Link>
                <Link
                  to="/booking"
                  className="inline-flex items-center gap-1.5 rounded-full bg-blue-700 hover:bg-blue-800 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors shadow-xs"
                >
                  <span>{t('Thuê Kho Ngay')}</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </>
            )}
          </div>

        </div>
      </header>

      {/* 2. DEDICATED 6-STEP INTERACTIVE PROGRESS BAR (Task 2 Standardized Names) */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5">
          
          {/* Desktop & Tablet Stepper */}
          <div className="hidden sm:block">
            <div className="relative grid grid-cols-6 items-start">
              
              {/* Background Connecting Track */}
              <div className="absolute left-[8.333%] right-[8.333%] top-3.5 sm:top-4 -translate-y-1/2 h-[2.5px] bg-slate-200 dark:bg-slate-800 rounded-full">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${((currentStep - 1) / 5) * 100}%` }}
                />
              </div>

              {/* 6 Step Nodes */}
              {[
                { step: 1, title: 'Chọn cơ sở', subtitle: selectedFacility?.name || 'Chọn chi nhánh' },
                { step: 2, title: 'Chọn kho', subtitle: currentSelectedSize ? `Kho ${currentSelectedSize.volumeText}` : 'Chọn quy cách' },
                { step: 3, title: 'Thời hạn & Báo giá', subtitle: `${rentalDurationText} • ${quoteCalculation.totalEstimate.toLocaleString('vi-VN')} ₫` },
                { step: 4, title: 'Lịch hẹn & Chi tiết', subtitle: `${checkInDate} • ${customerName || 'Chi tiết'}` },
                { step: 5, title: 'Hợp đồng & Thanh toán', subtitle: paymentMethod === 'ONLINE' ? 'Ký HĐ & Trực tuyến' : 'Tại cơ sở' },
                { step: 6, title: 'Hoàn tất', subtitle: 'Hoàn tất giữ chỗ' },
              ].map((item) => {
                const isPassed = currentStep > item.step
                const isCurrent = currentStep === item.step
                const canJumpBack = isPassed && currentStep < 6

                return (
                  <button
                    key={item.step}
                    type="button"
                    disabled={!canJumpBack}
                    onClick={() => {
                      if (canJumpBack) {
                        setCurrentStep(item.step as 1 | 2 | 3 | 4 | 5 | 6)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }
                    }}
                    className={`relative z-10 flex flex-col items-center text-center px-1 select-none group focus:outline-none ${
                      canJumpBack ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-[11px] sm:text-xs transition-all duration-300 ${
                        isPassed
                          ? 'bg-emerald-600 text-white shadow-xs ring-3 ring-white dark:ring-slate-900 group-hover:bg-emerald-700'
                          : isCurrent
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 ring-3 ring-blue-100 dark:ring-blue-950'
                          : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500 ring-3 ring-white dark:ring-slate-900'
                      }`}
                    >
                      {isPassed ? (
                        <Check size={14} strokeWidth={2.75} />
                      ) : (
                        <span>0{item.step}</span>
                      )}
                    </div>

                    <div className="mt-1 space-y-0 max-w-[130px]">
                      <span
                        className={`text-[11px] sm:text-xs font-bold block transition-colors leading-tight truncate ${
                          isCurrent
                            ? 'text-blue-600 dark:text-blue-400'
                            : isPassed
                            ? 'text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400'
                            : 'text-slate-400 dark:text-slate-500 font-medium'
                        }`}
                      >
                        {item.title}
                      </span>
                      <span
                        className={`text-[10px] block truncate transition-colors leading-tight ${
                          isCurrent
                            ? 'text-slate-600 dark:text-slate-300 font-medium'
                            : isPassed
                            ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                            : 'text-slate-400/80 dark:text-slate-600'
                        }`}
                      >
                        {isPassed ? item.subtitle : isCurrent ? 'Đang thực hiện' : 'Chưa tới'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Mobile Compact Progress Bar */}
          <div className="sm:hidden space-y-1.5 select-none py-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {currentStep}
                </span>
                <span className="font-bold text-xs text-slate-900 dark:text-white">
                  {currentStep === 1 && 'Bước 1: Chọn cơ sở'}
                  {currentStep === 2 && `Bước 2: Chọn kho (${currentSelectedSize?.volumeText || ''})`}
                  {currentStep === 3 && 'Bước 3: Thời hạn thuê & Báo giá'}
                  {currentStep === 4 && 'Bước 4: Lịch hẹn & Chi tiết'}
                  {currentStep === 5 && 'Bước 5: Hợp đồng & Thanh toán'}
                  {currentStep === 6 && 'Bước 6: Hoàn tất giữ chỗ'}
                </span>
              </div>
              <span className="text-slate-400 font-mono text-[11px]">{currentStep}/6</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / 6) * 100}%` }}
              />
            </div>
          </div>

        </div>
      </div>

      {/* MAIN STEP CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 pb-36 sm:pb-44">
        
        {/* ============================================================== */}
        {/* BƯỚC 1: CHỌN CƠ SỞ KHO                                          */}
        {/* ============================================================== */}
        {currentStep === 1 && (
          <div id="facility-selection-section" className="space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2 border-b border-slate-200/80 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200/60 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                  <Building2 size={12} />
                  <span>Bước 1 / 6 • Chọn cơ sở</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Chọn cơ sở kho lưu trữ
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tất cả chi nhánh Boxora đều vận hành tự động 24/7 với khóa thông minh IoT độc lập.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-2 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span><strong>{sortedFacilities.length}</strong> cơ sở đang hoạt động</span>
                </div>
                {selectedFacility && (
                  <div className="hidden sm:flex px-3 py-1.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800 text-xs font-semibold text-blue-700 dark:text-blue-300 items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-blue-600 dark:text-blue-400" />
                    <span>Đang chọn: {selectedFacility.name}</span>
                  </div>
                )}
              </div>
            </div>

            {loadingData ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 text-sm space-y-2">
                <div className="w-7 h-7 border-3 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto" />
                <p className="font-medium text-xs">Đang tải danh sách cơ sở kho Boxora...</p>
              </div>
            ) : sortedFacilities.length === 0 ? (
              <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 text-sm">
                Không tìm thấy cơ sở nào phù hợp. Vui lòng tải lại trang.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {sortedFacilities.map((fac, idx) => {
                  const isSelected = selectedFacility?.id === fac.id
                  const facImg = getFacilityImage(fac, idx)
                  return (
                    <div
                      key={fac.id}
                      onClick={() => handleSelectFacility(fac)}
                      className={`rounded-2xl border transition-all duration-200 cursor-pointer relative text-left flex flex-col justify-between overflow-hidden group ${
                        isSelected
                          ? 'bg-white dark:bg-slate-900 border-blue-600 dark:border-blue-500 ring-3 ring-blue-500/15 shadow-md'
                          : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs hover:shadow-md'
                      }`}
                    >
                      <div className="relative w-full h-34 sm:h-36 overflow-hidden bg-slate-100 dark:bg-slate-800">
                        <img
                          src={facImg}
                          alt={fac.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />

                        <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
                          <span className="px-2.5 py-1 rounded-lg bg-blue-600/90 backdrop-blur-md text-white text-[11px] font-bold tracking-wide uppercase shadow-xs">
                            {fac.code || 'BOXORA'}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-800 dark:text-slate-200 text-[11px] font-semibold shadow-xs">
                            {fac.city || 'TP.HCM'}
                          </span>
                        </div>

                        <div className="absolute bottom-3 left-3.5 right-3.5 flex flex-col gap-1.5 z-10">
                          <div>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg backdrop-blur-md text-white text-[10px] font-semibold shadow-xs ${
                              fac.availableCount > 0 ? 'bg-emerald-600/95' : 'bg-slate-600/95'
                            }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              {fac.availableCount > 0 ? `Còn ${fac.availableCount} kho trống` : 'Hết kho trống'}
                            </span>
                          </div>
                          <h3 className="font-extrabold text-white text-base leading-tight drop-shadow-sm">
                            {fac.name}
                          </h3>
                        </div>
                      </div>

                      <div className="p-4 space-y-3">
                        <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                          <MapPin size={14} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2 leading-relaxed font-medium">
                            {fac.address || 'Địa chỉ đang cập nhật'}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                            <PhoneCall size={12} className="text-slate-400" />
                            <span>{fac.contactPhone || '1900 636 888'}</span>
                          </div>

                          {isSelected ? (
                            <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 text-[11px]">
                              <Check size={13} strokeWidth={3} />
                              Đang chọn
                            </span>
                          ) : (
                            <span className="text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 text-[11px] font-medium flex items-center gap-1">
                              Chọn cơ sở
                              <ChevronRight size={13} />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* BƯỚC 2: CHỌN KHO / LOẠI KHO (Task 1: Real availability strictly) */}
        {/* ============================================================== */}
        {currentStep === 2 && (
          <div className="space-y-3.5 animate-in fade-in duration-300">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pb-2 border-b border-slate-200/80 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200/60 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                  <Box size={12} />
                  <span>Bước 2 / 6 • Chọn kho / loại kho</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Chọn kho hoặc loại kho lưu trữ
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lựa chọn thể tích phù hợp và tùy chỉnh chế độ điều hòa nhiệt ẩm (A/C) hoặc thông gió tự nhiên (Non-A/C).
                </p>
              </div>

              <div className="flex items-center justify-between sm:justify-start gap-2.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs text-xs shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Building2 size={14} />
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Cơ sở lưu trữ</span>
                    <strong className="text-slate-900 dark:text-white font-bold text-xs">{selectedFacility?.name}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-blue-600 dark:text-blue-400 text-xs font-semibold cursor-pointer"
                >
                  Đổi cơ sở
                </button>
              </div>
            </div>

            {/* Task 1: Empty state banner if facility has 0 available units */}
            {availableFacilityUnits.length === 0 ? (
              <div className="p-6 sm:p-8 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-xs">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <AlertCircle size={26} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base sm:text-lg">Cơ sở này hiện chưa có kho khả dụng</h3>
                    <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300/90 mt-1 leading-relaxed">
                      Cơ sở {selectedFacility?.name} hiện chưa có buồng kho nào ở trạng thái khả dụng. Vui lòng chọn cơ sở khác để tiếp tục đặt kho.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNoUnitsModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-bold text-xs sm:text-sm shrink-0 transition-all shadow-xs cursor-pointer"
                >
                  Chọn cơ sở khác
                </button>
              </div>
            ) : (
              <>
                {/* Category Filter Tabs & Visual Mode Switcher */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { key: 'ALL', label: `Tất cả (${availableSizesInFacility.length})` },
                      { key: 'PERSONAL', label: 'Cá nhân & Mini (1 – 4 m³)' },
                      { key: 'FAMILY', label: 'Gia đình (5 – 9 m³)' },
                      { key: 'ENTERPRISE', label: 'Doanh nghiệp (10 – 24 m³)' },
                    ].map((cat) => (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setSizeFilterCategory(cat.key as any)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          sizeFilterCategory === cat.key
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 px-1">
                    <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setSizeVisualMode('3D')}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          sizeVisualMode === '3D'
                            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                        }`}
                      >
                        <Box size={12} />
                        <span>Mô hình 3D</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSizeVisualMode('PHOTO')}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          sizeVisualMode === 'PHOTO'
                            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                        }`}
                      >
                        <Building2 size={12} />
                        <span>Ảnh thực tế</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      <span>Đang chọn:</span>
                      <strong className="text-blue-600 dark:text-blue-400 font-bold">
                        Kho {currentSelectedSize.volumeText} ({isAcActive ? 'A/C Máy lạnh' : 'Non-A/C'})
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Available Sizes Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
                  {filteredSizesCatalog.map((sizeUnit) => {
                    const isSelected = selectedSizeId === sizeUnit.id
                    const unitAcMode = acSelectionMap[sizeUnit.id] || 'NON_AC'
                    const displayPrice = unitAcMode === 'AC' ? sizeUnit.acRate : sizeUnit.nonAcRate
                    const realPhotoInfo = getRealPhotoForSize(sizeUnit.volumeNumber, unitAcMode === 'AC')
                    const availCount = getAvailableCountForSize(sizeUnit)

                    return (
                      <div
                        key={sizeUnit.id}
                        onClick={() => setSelectedSizeId(sizeUnit.id)}
                        className={`rounded-2xl border transition-all duration-200 cursor-pointer relative flex flex-col justify-between overflow-hidden group ${
                          isSelected
                            ? 'bg-white dark:bg-slate-900 border-blue-600 dark:border-blue-500 ring-3 ring-blue-500/15 shadow-lg'
                            : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs hover:shadow-md'
                        }`}
                      >
                        <div className="p-3.5 pb-1.5 flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight">
                                {sizeUnit.volumeText}
                              </span>
                              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-semibold">
                                {sizeUnit.areaM2} m²
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block mt-0.5">
                              Sức chứa: {sizeUnit.capacityText}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setInspectVisualTab(sizeVisualMode)
                                setInspectingSizeUnit(sizeUnit)
                              }}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                              title="Xem chi tiết quy cách & ảnh thực tế"
                            >
                              <Maximize2 size={13} />
                            </button>
                            {isSelected && (
                              <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                                <Check size={14} strokeWidth={2.75} />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Visual Container */}
                        <div className="mx-3.5 my-1 rounded-xl bg-gradient-to-b from-slate-50 to-blue-50/40 dark:from-slate-800/60 dark:to-slate-800/30 border border-slate-100 dark:border-slate-800/80 flex items-center justify-center h-36 sm:h-38 overflow-hidden relative">
                          {sizeVisualMode === '3D' ? (
                            <div className="w-full h-full px-2 py-1 flex items-center justify-center group-hover:scale-[1.04] transition-transform duration-300">
                              <StorageSizeIsometric3D
                                sizeId={sizeUnit.id}
                                volumeM3={sizeUnit.volumeNumber}
                                dimensions={sizeUnit.dimensions}
                                isAc={unitAcMode === 'AC'}
                                showDimensions={true}
                              />
                            </div>
                          ) : (
                            <div className="w-full h-full relative overflow-hidden">
                              <img
                                src={realPhotoInfo.photoUrl}
                                alt={`Ảnh thực tế kho ${sizeUnit.volumeText}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 via-slate-950/30 to-transparent px-3 py-1.5 flex items-center justify-between text-[10px] text-white">
                                <span className="font-semibold truncate">{sizeUnit.dimensions.replace('Cao ', '')}</span>
                                <span className="px-1.5 py-0.5 rounded bg-blue-600/90 font-bold shrink-0">
                                  {unitAcMode === 'AC' ? 'Kho A/C' : 'Tiêu chuẩn'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Bottom Controls */}
                        <div className="p-3.5 pt-2 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Khả dụng:</span>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                              Còn {availCount} buồng kho
                            </span>
                          </div>

                          {/* Segmented A/C Toggle */}
                          <div className="p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center text-xs font-semibold">
                            <button
                              type="button"
                              onClick={(e) => handleToggleAc(sizeUnit.id, 'NON_AC', e)}
                              className={`flex-1 py-1 rounded-md text-center transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] ${
                                unitAcMode === 'NON_AC'
                                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                              }`}
                            >
                              <Wind size={11} />
                              <span>Tiêu chuẩn</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleToggleAc(sizeUnit.id, 'AC', e)}
                              className={`flex-1 py-1 rounded-md text-center transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] ${
                                unitAcMode === 'AC'
                                  ? 'bg-blue-600 text-white shadow-2xs font-bold'
                                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                              }`}
                            >
                              <ThermometerSnowflake size={11} />
                              <span>Máy lạnh A/C</span>
                            </button>
                          </div>

                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                              Đơn giá thuê
                            </span>
                            <div className="text-right">
                              <span className="font-extrabold text-sm sm:text-base text-blue-600 dark:text-blue-400">
                                {displayPrice.toLocaleString('vi-VN')} ₫
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium"> /tháng</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* BƯỚC 3: THỜI HẠN THUÊ & BÁO GIÁ (Task 2 Standardized)           */}
        {/* ============================================================== */}
        {currentStep === 3 && (
          <div className="space-y-3.5 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2 border-b border-slate-200/80 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200/60 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                  <Clock size={12} />
                  <span>Bước 3 / 6 • Thời hạn thuê &amp; Báo giá</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Thời hạn thuê &amp; Bảng kê báo giá
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lựa chọn kỳ hạn thuê linh hoạt để nhận ưu đãi lên đến 15% và xem bảng phân rã chi phí minh bạch.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/70 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300">
                <ShieldCheck size={14} />
                <span>Minh bạch 100% • Không phí ẩn</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              
              {/* LEFT COLUMN: DURATION PACKAGES & VALUE ASSURANCES */}
              <div className="lg:col-span-7 space-y-3.5">
                
                {/* 1. DURATION OPTIONS */}
                <div className="p-4 sm:p-4.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Clock size={18} />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-white">
                          1. Chọn thời hạn thuê kho &amp; Ưu đãi kỳ hạn
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Cam kết từ 3 tháng trở lên được giảm trực tiếp từ 5% đến 15% vào đơn giá hàng tháng
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-bold shrink-0">
                      {rentalDurationText}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { m: 1, label: '1 tháng', badge: 'Tiêu chuẩn' },
                      { m: 3, label: '3 tháng', badge: 'Tiết kiệm 5%' },
                      { m: 6, label: '6 tháng', badge: 'Tiết kiệm 10%' },
                      { m: 12, label: '12 tháng', badge: 'Tiết kiệm 15%' },
                    ].map((dur) => {
                      const active = durationMode === 'MONTHS' && rentalMonths === dur.m
                      return (
                        <button
                          key={dur.m}
                          type="button"
                          onClick={() => {
                            setDurationMode('MONTHS')
                            setRentalMonths(dur.m)
                          }}
                          className={`p-3.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                            active
                              ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-600 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/20'
                              : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white">{dur.label}</span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                            active
                              ? 'bg-blue-600 text-white'
                              : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          }`}>
                            {dur.badge}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Custom Days Accordion / Option */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setDurationMode(durationMode === 'CUSTOM_DAYS' ? 'MONTHS' : 'CUSTOM_DAYS')}
                      className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{durationMode === 'CUSTOM_DAYS' ? 'Thu gọn tùy chỉnh số ngày' : 'Cần thuê theo số ngày ngắn hạn? (Tối thiểu 7 ngày)'}</span>
                      <ChevronRight size={13} className={durationMode === 'CUSTOM_DAYS' ? 'rotate-90 transition-transform' : ''} />
                    </button>
                  </div>

                  {durationMode === 'CUSTOM_DAYS' && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Nhập số ngày muốn thuê (tối thiểu 7 ngày):
                        </label>
                        <input
                          type="number"
                          min={7}
                          value={customDays}
                          onChange={(e) => setCustomDays(Math.max(1, parseInt(e.target.value, 10) || 7))}
                          className="w-24 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-bold text-center"
                        />
                      </div>
                      {customDays < 7 && (
                        <p className="text-xs text-red-600 font-medium">Thời gian thuê tối thiểu là 7 ngày.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. TRANSPARENCY COMMITMENTS */}
                <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-4">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                    Cam kết minh bạch tài chính Boxora
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
                      <strong className="text-slate-900 dark:text-white font-bold block">Hoàn cọc 100%</strong>
                      <span className="text-slate-500 dark:text-slate-400 leading-relaxed block">
                        Tiền cọc bảo đảm được hoàn trả nguyên vẹn ngay khi thanh lý hợp đồng hợp lệ.
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
                      <strong className="text-slate-900 dark:text-white font-bold block">Bao trọn điện &amp; A/C</strong>
                      <span className="text-slate-500 dark:text-slate-400 leading-relaxed block">
                        Đã bao gồm chi phí điện chiếu sáng, điều hòa kiểm soát ẩm và vệ sinh công nghiệp.
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
                      <strong className="text-slate-900 dark:text-white font-bold block">Đã gồm VAT 8%</strong>
                      <span className="text-slate-500 dark:text-slate-400 leading-relaxed block">
                        Xuất hóa đơn điện tử VAT tự động, không phát sinh bất kỳ khoản phụ phí ẩn nào.
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: OFFICIAL PRICE QUOTATION CARD */}
              <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <FileCheck2 size={17} />
                      </div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white">
                        Bảng báo giá chi tiết
                      </h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                      VNĐ (Đã gồm VAT)
                    </span>
                  </div>

                  <div className="p-3.5 sm:p-4 space-y-2.5 text-xs">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Đơn giá buồng kho niêm yết:</span>
                      <strong className="text-slate-900 dark:text-white font-semibold">
                        {isCustomDuration
                          ? `${quoteCalculation.dailyRate.toLocaleString('vi-VN')} ₫/ngày`
                          : `${quoteCalculation.baseMonthly.toLocaleString('vi-VN')} ₫/tháng`}
                      </strong>
                    </div>

                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Kỳ hạn đăng ký thuê:</span>
                      <strong className="text-slate-900 dark:text-white font-semibold">
                        {rentalDurationText}
                      </strong>
                    </div>

                    {!isCustomDuration && quoteCalculation.discountPercent > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span>Đơn giá sau ưu đãi (-{quoteCalculation.discountPercent}%):</span>
                        <span>{quoteCalculation.monthlyAfterDiscount.toLocaleString('vi-VN')} ₫/tháng</span>
                      </div>
                    )}

                    {quoteCalculation.discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span>Tổng số tiền tiết kiệm được:</span>
                        <span>−{quoteCalculation.discountAmount.toLocaleString('vi-VN')} ₫</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-slate-800 dark:text-slate-200 font-semibold">
                      <span>Tổng tiền thuê ({rentalDurationText}):</span>
                      <span>{quoteCalculation.totalRent.toLocaleString('vi-VN')} ₫</span>
                    </div>

                    <div className="flex justify-between items-start text-slate-600 dark:text-slate-400">
                      <div>
                        <span className="block">Tiền đặt cọc bảo đảm:</span>
                        <span className="text-[10px] text-slate-400 block">Hoàn trả 100% khi thanh lý hợp đồng</span>
                      </div>
                      <strong className="text-slate-900 dark:text-white font-semibold">
                        {quoteCalculation.depositAmount.toLocaleString('vi-VN')} ₫
                      </strong>
                    </div>

                    <div className="p-3 rounded-lg bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-900/60 space-y-0.5">
                      <div className="flex items-baseline justify-between">
                        <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                          Tổng chi phí dự kiến
                        </span>
                        <span className="font-extrabold text-lg text-blue-600 dark:text-blue-400">
                          {quoteCalculation.totalEstimate.toLocaleString('vi-VN')} ₫
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Bao gồm tiền thuê {rentalDurationText} và tiền cọc hoàn lại 1 tháng.
                      </p>
                    </div>

                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* BƯỚC 4: LỊCH HẸN & CHI TIẾT (Task 2 & 3 Standardized)           */}
        {/* ============================================================== */}
        {currentStep === 4 && (
          <div className="space-y-3.5 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2 border-b border-slate-200/80 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200/60 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                  <Calendar size={12} />
                  <span>Bước 4 / 6 • Lịch hẹn &amp; Chi tiết</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Lịch hẹn đón tiếp &amp; Chi tiết đặt kho
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
                  Chọn khung giờ bàn giao buồng kho 24/7 và điền thông tin người đại diện nhận kho để chuẩn bị hồ sơ hợp đồng.
                </p>
              </div>

              {isAuthenticated && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/70 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300 text-xs font-semibold w-fit shrink-0">
                  <ShieldCheck size={14} />
                  <span>Đã đồng bộ thông tin tài khoản</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
              
              {/* LEFT COLUMN: APPOINTMENT + VALIDATED CONTACT DETAILS */}
              <div className="lg:col-span-8 space-y-3 sm:space-y-3.5">
                
                {/* 1. CHECK-IN APPOINTMENT SCHEDULE */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Calendar size={15} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                          1. Lịch hẹn đón tiếp &amp; Nhận bàn giao kho
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Chọn ngày và buổi thuận tiện để nhân viên chuẩn bị buồng kho &amp; hỗ trợ bàn giao
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold w-fit">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Hỗ trợ nhận kho 24/7
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Ngày nhận bàn giao kho (Ngày bắt đầu thuê)
                      </label>
                      <input
                        type="date"
                        min={formatLocalDate()}
                        value={checkInDate}
                        onChange={(e) => setCheckInDate(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Thời hạn hợp đồng dự kiến
                      </label>
                      <div className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs sm:text-sm flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 text-xs">Từ {startDate} đến:</span>
                        <strong className="text-slate-900 dark:text-white font-bold text-xs sm:text-sm">
                          {rentalEndDate}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Time Slot Selector */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                        Khung giờ hẹn đến cơ sở
                      </label>
                      <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                        {selectedPeriod.name} ({selectedPeriod.rangeText})
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {CHECK_IN_PERIOD_GROUPS.map((group) => {
                        const isPast = isPeriodInPast(checkInDate, group.id)
                        const isSelected = selectedPeriodId === group.id && !isPast
                        return (
                          <button
                            key={group.id}
                            type="button"
                            disabled={isPast}
                            onClick={() => {
                              if (!isPast) setSelectedPeriodId(group.id)
                            }}
                            title={isPast ? 'Khung giờ này đã kết thúc đối với ngày đã chọn' : undefined}
                            className={`p-2 sm:p-2.5 rounded-lg text-left border transition-all flex flex-col justify-between gap-1 ${
                              isPast
                                ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800/30 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 select-none'
                                : isSelected
                                ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-600 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/15 cursor-pointer'
                                : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className={`font-bold text-xs ${isPast ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-900 dark:text-white'}`}>
                                {group.name}
                              </span>
                              {isPast ? (
                                <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1 py-0.5 rounded border border-amber-200 dark:border-amber-800/60">
                                  Đã qua
                                </span>
                              ) : isSelected ? (
                                <span className="w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                                  <Check size={9} strokeWidth={3} />
                                </span>
                              ) : (
                                <Clock size={12} className="text-slate-400" />
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                              {group.rangeText.replace('Khoảng từ ', 'Từ ')}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    {formErrors.checkInTime && (
                      <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle size={12} /> {formErrors.checkInTime}
                      </p>
                    )}
                    {!hasAvailablePeriods(checkInDate) && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1 font-medium bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
                        <AlertCircle size={13} className="shrink-0" />
                        Tất cả các ca tiếp đón trong ngày đã chọn đã kết thúc. Quý khách vui lòng chọn ngày nhận kho từ ngày mai.
                      </p>
                    )}
                  </div>
                </div>

                {/* 2. VALIDATED CUSTOMER DETAILS (Task 3) */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      <User size={15} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                        2. Thông tin người đặt &amp; Nhận bàn giao
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Dùng để lập hợp đồng thuê kho điện tử, cấp mã PIN khóa thông minh IoT và đối chiếu khi nhận kho
                      </p>
                    </div>
                  </div>

                  {/* Informational banner when profile is missing phone or cccd (e.g. Google Login) */}
                  {user && (!user.phone && !(user as any).phoneNumber) && (
                    <div className="p-2.5 px-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                      <AlertCircle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-bold">Bổ sung thông tin người nhận bàn giao</p>
                        <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90 leading-relaxed">
                          Tài khoản của bạn chưa có số điện thoại trong hồ sơ. Vui lòng nhập số điện thoại và số CCCD/Hộ chiếu bên dưới để Boxora lập hợp đồng và cấp mã PIN mở kho.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Verified sync badge when profile info was auto loaded */}
                  {user && (user.fullName || user.username) && (user.phone || (user as any).phoneNumber) && user.email && (
                    <div className="p-2 px-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Thông tin đã được đồng bộ tự động từ tài khoản <strong>{user.fullName || user.username}</strong></span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Full Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Họ và tên người thuê <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => {
                            setCustomerName(e.target.value)
                            if (formErrors.customerName) {
                              setFormErrors((prev) => ({ ...prev, customerName: '' }))
                            }
                          }}
                          placeholder="Nguyễn Văn A"
                          className={`w-full pl-8 pr-3 py-1.5 rounded-lg border bg-slate-50/70 dark:bg-slate-800/60 text-xs sm:text-sm font-medium focus:ring-2 focus:bg-white dark:focus:bg-slate-900 focus:outline-none ${
                            formErrors.customerName ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500'
                          }`}
                        />
                      </div>
                      {formErrors.customerName && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-medium">
                          <AlertCircle size={12} className="shrink-0" />
                          <span>{formErrors.customerName}</span>
                        </p>
                      )}
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Số điện thoại liên hệ <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => {
                            setCustomerPhone(e.target.value)
                            if (formErrors.customerPhone) {
                              setFormErrors((prev) => ({ ...prev, customerPhone: '' }))
                            }
                          }}
                          placeholder="0912 345 678"
                          className={`w-full pl-8 pr-3 py-1.5 rounded-lg border bg-slate-50/70 dark:bg-slate-800/60 text-xs sm:text-sm font-medium focus:ring-2 focus:bg-white dark:focus:bg-slate-900 focus:outline-none ${
                            formErrors.customerPhone ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500'
                          }`}
                        />
                      </div>
                      {formErrors.customerPhone && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-medium">
                          <AlertCircle size={12} className="shrink-0" />
                          <span>{formErrors.customerPhone}</span>
                        </p>
                      )}
                    </div>

                    {/* Document Selector & Number */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Loại giấy tờ &amp; Số định danh <span className="text-red-500">*</span>
                        </label>
                        <div className="inline-flex rounded-md bg-slate-100 dark:bg-slate-800 p-0.5 text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => {
                              setIdCardType('CCCD')
                              if (formErrors.customerIdCard) setFormErrors((prev) => ({ ...prev, customerIdCard: '' }))
                            }}
                            className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                              idCardType === 'CCCD' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-2xs font-extrabold' : 'text-slate-500'
                            }`}
                          >
                            CCCD
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIdCardType('PASSPORT')
                              if (formErrors.customerIdCard) setFormErrors((prev) => ({ ...prev, customerIdCard: '' }))
                            }}
                            className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                              idCardType === 'PASSPORT' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-2xs font-extrabold' : 'text-slate-500'
                            }`}
                          >
                            Hộ chiếu
                          </button>
                        </div>
                      </div>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          value={customerIdCard}
                          onChange={(e) => {
                            setCustomerIdCard(e.target.value)
                            if (formErrors.customerIdCard) {
                              setFormErrors((prev) => ({ ...prev, customerIdCard: '' }))
                            }
                          }}
                          placeholder={idCardType === 'CCCD' ? '12 chữ số CCCD (VD: 079123456789)' : '1 chữ cái + 7-8 số'}
                          className={`w-full pl-8 pr-3 py-1.5 rounded-lg border bg-slate-50/70 dark:bg-slate-800/60 text-xs sm:text-sm font-medium focus:ring-2 focus:bg-white dark:focus:bg-slate-900 focus:outline-none ${
                            formErrors.customerIdCard ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500'
                          }`}
                        />
                      </div>
                      {formErrors.customerIdCard && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-medium">
                          <AlertCircle size={12} className="shrink-0" />
                          <span>{formErrors.customerIdCard}</span>
                        </p>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Địa chỉ Email nhận phiếu &amp; HĐ <span className="text-red-500">*</span>
                        </label>
                      </div>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="email"
                          value={customerEmail}
                          onChange={(e) => {
                            setCustomerEmail(e.target.value)
                            if (formErrors.customerEmail) {
                              setFormErrors((prev) => ({ ...prev, customerEmail: '' }))
                            }
                          }}
                          placeholder="email@example.com"
                          className={`w-full pl-8 pr-3 py-1.5 rounded-lg border bg-slate-50/70 dark:bg-slate-800/60 text-xs sm:text-sm font-medium focus:ring-2 focus:bg-white dark:focus:bg-slate-900 focus:outline-none ${
                            formErrors.customerEmail ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500'
                          }`}
                        />
                      </div>
                      {formErrors.customerEmail && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-medium">
                          <AlertCircle size={12} className="shrink-0" />
                          <span>{formErrors.customerEmail}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Special Notes with 500 Char Counter */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Ghi chú về tài sản lưu trữ hoặc yêu cầu hỗ trợ (tùy chọn)
                      </label>
                      <span className={`text-[10px] ${specialNotes.length > 500 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                        {specialNotes.length}/500 ký tự
                      </span>
                    </div>
                    <input
                      type="text"
                      maxLength={500}
                      value={specialNotes}
                      onChange={(e) => {
                        setSpecialNotes(e.target.value)
                        if (formErrors.specialNotes) setFormErrors((prev) => ({ ...prev, specialNotes: '' }))
                      }}
                      placeholder="VD: Cần hỗ trợ xe đẩy hàng, chuyển đồ căn hộ, hàng dễ vỡ..."
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                    />
                    {formErrors.specialNotes && (
                      <p className="mt-1 text-xs text-red-600 font-medium">{formErrors.specialNotes}</p>
                    )}
                  </div>
                </div>

                {/* 3. POLICY ACCEPTANCE */}
                <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2">
                  <label className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={policyAccepted}
                      onChange={(e) => {
                        setPolicyAccepted(e.target.checked)
                        if (formErrors.policyAccepted) setFormErrors((prev) => ({ ...prev, policyAccepted: '' }))
                      }}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="leading-relaxed">
                      Tôi xác nhận thông tin trên là chính xác và đồng ý với{' '}
                      <Link to="/policies" target="_blank" className="text-blue-600 dark:text-blue-400 underline font-semibold">
                        Quy chế giữ chỗ &amp; Bảo mật kho tự quản Boxora
                      </Link>
                      .
                    </span>
                  </label>
                  {formErrors.policyAccepted && (
                    <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-medium">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{formErrors.policyAccepted}</span>
                    </p>
                  )}
                </div>

              </div>

              {/* RIGHT COLUMN: STICKY LIVE BOOKING SUMMARY */}
              <div className="lg:col-span-4 lg:sticky lg:top-20 space-y-3">
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
                  
                  {/* Summary Header */}
                  <div className="p-3 sm:p-3.5 bg-gradient-to-r from-blue-50/90 via-white to-cyan-50/70 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border-b border-blue-100 dark:border-slate-800 text-slate-900 dark:text-white flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-white border border-blue-200/80 shadow-2xs p-1 flex items-center justify-center shrink-0 overflow-hidden">
                        <StorageSizeIsometric3D
                          sizeId={currentSelectedSize.id}
                          volumeM3={currentSelectedSize.volumeNumber}
                          dimensions={currentSelectedSize.dimensions}
                          isAc={isAcActive}
                          showDimensions={false}
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider block">
                          Tóm tắt buồng kho
                        </span>
                        <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                          Kho {currentSelectedSize.volumeText} ({isAcActive ? 'Máy lạnh A/C' : 'Tiêu chuẩn'})
                        </h4>
                        <span className="text-xs text-slate-500 font-medium block">
                          {currentSelectedSize.dimensions}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Key Booking Specs */}
                  <div className="p-3.5 space-y-2.5 text-xs">
                    <div className="flex justify-between items-start text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Building2 size={13} className="text-blue-600 dark:text-blue-400" />
                        Cơ sở:
                      </span>
                      <strong className="text-slate-900 dark:text-white font-semibold text-right max-w-[170px] truncate">
                        {selectedFacility?.name}
                      </strong>
                    </div>

                    <div className="flex justify-between items-start text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} className="text-blue-600 dark:text-blue-400" />
                        Thời hạn thuê:
                      </span>
                      <strong className="text-slate-900 dark:text-white font-semibold">
                        {rentalDurationText}
                      </strong>
                    </div>

                    <div className="flex justify-between items-start text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-blue-600 dark:text-blue-400" />
                        Lịch hẹn nhận kho:
                      </span>
                      <strong className="text-blue-600 dark:text-blue-400 font-semibold text-right">
                        {checkInDate} • {selectedPeriod.name}
                      </strong>
                    </div>

                    {/* Price Breakdown */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Tiền thuê kho ({rentalDurationText}):</span>
                        <strong className="text-slate-900 dark:text-white">{quoteCalculation.totalRent.toLocaleString('vi-VN')} ₫</strong>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Cọc bảo đảm (hoàn lại):</span>
                        <strong className="text-slate-900 dark:text-white">{quoteCalculation.depositAmount.toLocaleString('vi-VN')} ₫</strong>
                      </div>
                      <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-baseline">
                        <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">Tổng cộng:</span>
                        <strong className="text-base sm:text-lg font-extrabold text-blue-600 dark:text-blue-400">
                          {quoteCalculation.totalEstimate.toLocaleString('vi-VN')} ₫
                        </strong>
                      </div>
                    </div>
              
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* BƯỚC 5: HỢP ĐỒNG & THANH TOÁN                                  */}
        {/* ============================================================== */}
        {currentStep === 5 && (
          <div className="space-y-3.5 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2 border-b border-slate-200/80 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200/60 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                  <FileCheck2 size={12} />
                  <span>Bước 5 / 6 • Hợp đồng &amp; Thanh toán</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Hợp đồng &amp; Thanh toán
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Vui lòng lựa chọn hình thức ký kết hợp đồng và phương thức thanh toán phù hợp với quý khách.
                </p>
              </div>
            </div>

            {submitError && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs sm:text-sm flex items-center gap-2.5">
                <AlertCircle size={18} className="shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
              
              {/* LEFT COLUMN: 2 CONTRACT & PAYMENT OPTIONS */}
              <div className="lg:col-span-7 space-y-3">
                
                {/* Option 1: Ký hợp đồng và thanh toán trực tuyến */}
                <div
                  onClick={() => setPaymentMethod('ONLINE')}
                  className={`p-3.5 sm:p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    paymentMethod === 'ONLINE'
                      ? 'bg-blue-50/40 dark:bg-blue-950/30 border-blue-600 ring-3 ring-blue-500/15 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-4.5 h-4.5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                          paymentMethod === 'ONLINE'
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {paymentMethod === 'ONLINE' && <Check size={11} strokeWidth={3} />}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                            1. Ký hợp đồng và thanh toán trực tuyến
                          </h3>
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider">
                            Khuyên dùng • Kích hoạt ngay
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          Ký hợp đồng điện tử DocuSeal trực tiếp trên hệ thống và thanh toán toàn bộ chi phí (bao gồm tiền thuê kho và tiền cọc bảo đảm) qua cổng VNPay (VNPAY-QR, Thẻ ATM/Visa/Mastercard). Buồng kho và mã PIN khóa thông minh sẽ được cấp ngay sau khi hoàn tất.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Option 2: Ký hợp đồng và thanh toán tại cơ sở vào ngày tới nhận kho */}
                <div
                  onClick={() => setPaymentMethod('PAY_LATER')}
                  className={`p-3.5 sm:p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    paymentMethod === 'PAY_LATER'
                      ? 'bg-blue-50/40 dark:bg-blue-950/30 border-blue-600 ring-3 ring-blue-500/15 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-4.5 h-4.5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                          paymentMethod === 'PAY_LATER'
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {paymentMethod === 'PAY_LATER' && <Check size={11} strokeWidth={3} />}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                            2. Ký hợp đồng và thanh toán tại cơ sở vào ngày tới nhận kho
                          </h3>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-semibold">
                            0 ₫ hôm nay
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          Đặt giữ chỗ trước để Boxora chuẩn bị buồng kho. Quý khách sẽ ký kết hợp đồng và thanh toán (chuyển khoản/thẻ/tiền mặt) trực tiếp tại quầy lễ tân cơ sở vào ngày hẹn đến nhận kho.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: PAYMENT SUMMARY & ACTION */}
              <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-3">
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm p-4 space-y-3">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                    Xác nhận Hợp đồng &amp; Thanh toán
                  </h3>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Hình thức đã chọn:</span>
                      <strong className="text-blue-600 dark:text-blue-400 font-semibold text-right max-w-[200px]">
                        {paymentMethod === 'ONLINE' ? '1. Ký HĐ & Thanh toán trực tuyến' : '2. Ký HĐ & Thanh toán tại cơ sở'}
                      </strong>
                    </div>

                    <div className="flex justify-between text-slate-600 dark:text-slate-400 items-baseline">
                      <span>Số tiền thanh toán hôm nay:</span>
                      <strong className="text-slate-900 dark:text-white font-extrabold text-base sm:text-lg">
                        {paymentMethod === 'ONLINE' ? `${quoteCalculation.totalEstimate.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                      </strong>
                    </div>

                    {paymentMethod === 'ONLINE' ? (
                      <div className="space-y-1 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 leading-relaxed">
                        <div className="flex justify-between">
                          <span>Tiền thuê kho ({rentalDurationText}):</span>
                          <strong className="text-slate-700 dark:text-slate-300 font-semibold">{quoteCalculation.totalRent.toLocaleString('vi-VN')} ₫</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Tiền cọc bảo đảm (hoàn lại):</span>
                          <strong className="text-slate-700 dark:text-slate-300 font-semibold">{quoteCalculation.depositAmount.toLocaleString('vi-VN')} ₫</strong>
                        </div>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium pt-1">
                          ✓ Thanh toán toàn bộ hôm nay qua VNPay. Khi đến nhận kho quý khách không cần thanh toán thêm.
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Quý khách không cần thanh toán trước. Giữ chỗ sẽ được lưu trên hệ thống, quý khách ký hợp đồng và thanh toán tại cơ sở vào ngày {checkInDate}.
                      </p>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* BƯỚC 6: HOÀN TẤT GIỮ CHỖ (Task 2 Standardized)                  */}
        {/* ============================================================== */}
        {currentStep === 6 && (
          <div className="space-y-3 animate-in zoom-in-95 duration-300 max-w-xl mx-auto py-1">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 text-center space-y-2.5 border-b border-slate-100 dark:border-slate-800">
                <div
                  className={`mx-auto w-12 h-12 rounded-xl text-white flex items-center justify-center shadow-md ${
                    paymentMethod === 'ONLINE' && isOnlinePaid
                      ? 'bg-emerald-600 shadow-emerald-600/20'
                      : 'bg-blue-600 shadow-blue-600/20'
                  }`}
                >
                  {paymentMethod === 'ONLINE' && isOnlinePaid ? (
                    <CheckCircle2 size={24} />
                  ) : (
                    <Clock size={24} />
                  )}
                </div>

                <div className="space-y-1.5">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      paymentMethod === 'ONLINE' && isOnlinePaid
                        ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    {paymentMethod === 'ONLINE' && isOnlinePaid ? (
                      <>
                        <CheckCircle2 size={13} />
                        <span>Đã ký hợp đồng &amp; thanh toán trực tuyến thành công</span>
                      </>
                    ) : (
                      <>
                        <Clock size={13} />
                        <span>Đặt giữ chỗ thành công • Ký HĐ &amp; thanh toán tại cơ sở</span>
                      </>
                    )}
                  </span>

                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Cảm ơn quý khách {customerName || ''}!
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                    Hệ thống Boxora đã ghi nhận yêu cầu giữ chỗ buồng kho. Nhân viên cơ sở sẽ liên hệ và chuẩn bị đón tiếp quý khách đúng khung giờ đã hẹn.
                  </p>
                </div>

                {/* Booking Code Card */}
                <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-800 max-w-sm mx-auto flex items-center justify-between gap-3">
                  <div className="text-left">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider block">
                      Mã phiếu giữ chỗ
                    </span>
                    <strong className="text-base sm:text-lg font-mono font-extrabold text-blue-600 dark:text-blue-400 tracking-wider">
                      {bookingCode}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="p-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-200 hover:text-blue-600 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <Copy size={13} />
                    <span>{copiedCode ? 'Đã chép' : 'Sao chép'}</span>
                  </button>
                </div>
              </div>

              {/* Summary Details */}
              <div className="p-4 sm:p-5 space-y-3 bg-slate-50/50 dark:bg-slate-900/50 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Cơ sở bàn giao</span>
                    <strong className="text-slate-900 dark:text-white block font-bold text-xs sm:text-sm">{selectedFacility?.name}</strong>
                    <span className="text-slate-500 block text-[11px] truncate">{selectedFacility?.address}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Lịch hẹn đón tiếp</span>
                    <strong className="text-blue-600 dark:text-blue-400 block font-bold text-xs sm:text-sm">{checkInDate}</strong>
                    <span className="text-slate-500 block text-[11px]">{checkInTime}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  {isAuthenticated ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/portal/customer?tab=bookings&bookingCode=${encodeURIComponent(bookingCode)}`)}
                      className="flex-1 py-2.5 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 text-center transition-all cursor-pointer"
                    >
                      Xem đơn đặt của tôi
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate(`/login?redirect=${encodeURIComponent(`/portal/customer?tab=bookings&bookingCode=${bookingCode}`)}`)}
                      className="flex-1 py-2.5 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 text-center transition-all cursor-pointer"
                    >
                      Đăng nhập để theo dõi hợp đồng
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="flex-1 py-2.5 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs sm:text-sm text-center transition-colors cursor-pointer"
                  >
                    Về trang chủ Boxora
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* 3. FIXED BOTTOM NAVIGATION FOOTER */}
      {currentStep < 6 && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] transition-all">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            
            {/* Left: Back button + Step Context */}
            <div className="flex items-center gap-3 justify-between sm:justify-start">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer active:scale-98"
                >
                  <ArrowLeft size={15} />
                  <span>
                    {currentStep === 2 && 'Quay lại chọn cơ sở'}
                    {currentStep === 3 && 'Quay lại chọn kho'}
                    {currentStep === 4 && 'Quay lại báo giá'}
                    {currentStep === 5 && 'Quay lại thông tin'}
                  </span>
                </button>
              ) : (
                <Link
                  to="/"
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
                >
                  <Home size={15} />
                  <span>Về trang chủ</span>
                </Link>
              )}

              {/* Step Context Pill */}
              <div className="hidden md:flex items-center gap-2.5 pl-3.5 border-l border-slate-200 dark:border-slate-800 text-xs">
                {currentStep === 1 && (
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <MapPin size={14} className="text-blue-600" />
                    <span>Cơ sở: <strong className="text-slate-900 dark:text-white">{selectedFacility ? selectedFacility.name : 'Chưa chọn'}</strong></span>
                  </span>
                )}
                {currentStep === 2 && (
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Box size={14} className="text-blue-600" />
                    <span>
                      Đang chọn: <strong className="text-blue-600 dark:text-blue-400 font-bold">Kho {currentSelectedSize.volumeText}</strong> ({isAcActive ? 'Máy lạnh A/C' : 'Tiêu chuẩn'}) • <strong className="text-slate-900 dark:text-white">{quoteCalculation.baseMonthly.toLocaleString('vi-VN')} ₫/tháng</strong>
                    </span>
                  </span>
                )}
                {currentStep === 3 && (
                  <div className="flex items-center gap-2.5 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Thời hạn: <strong className="text-slate-900 dark:text-white">{rentalDurationText}</strong>
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Tiền thuê: <strong className="text-slate-800 dark:text-slate-200">{quoteCalculation.totalRent.toLocaleString('vi-VN')} ₫</strong>
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="text-slate-900 dark:text-white font-semibold">
                      Tổng cộng: <strong className="text-blue-600 dark:text-blue-400 font-extrabold">{quoteCalculation.totalEstimate.toLocaleString('vi-VN')} ₫</strong>
                    </span>
                  </div>
                )}
                {currentStep === 4 && (
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Calendar size={14} className="text-blue-600" />
                    <span>
                      Nhận kho: <strong className="text-blue-600 dark:text-blue-400">{checkInDate} ({selectedPeriod.name})</strong> • Người đặt: <strong className="text-slate-900 dark:text-white">{customerName || 'Chưa điền'}</strong>
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Right: Next button */}
            <div className="flex items-center gap-3 justify-end">
              {currentStep === 1 && (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Tiếp tục: Chọn kho / loại kho</span>
                  <ArrowRight size={16} />
                </button>
              )}

              {currentStep === 2 && (
                <button
                  type="button"
                  disabled={availableFacilityUnits.length === 0}
                  onClick={handleNextStep}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                    availableFacilityUnits.length > 0
                      ? 'bg-blue-600 hover:bg-blue-700 active:scale-98 text-white shadow-md shadow-blue-600/20 cursor-pointer'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span>Tiếp tục: Thời hạn thuê &amp; Báo giá</span>
                  <ArrowRight size={16} />
                </button>
              )}

              {currentStep === 3 && (
                <button
                  type="button"
                  disabled={!isDurationValid}
                  onClick={handleNextStep}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                    isDurationValid
                      ? 'bg-blue-600 hover:bg-blue-700 active:scale-98 text-white shadow-md shadow-blue-600/20 cursor-pointer'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span>Tiếp tục: Lịch hẹn &amp; Chi tiết</span>
                  <ArrowRight size={16} />
                </button>
              )}

              {currentStep === 4 && (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Tiếp tục: Hợp đồng &amp; Thanh toán</span>
                  <ArrowRight size={16} />
                </button>
              )}

              {currentStep === 5 && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleProcessPaymentAndConfirm()}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Đang xử lý...</span>
                    </span>
                  ) : (
                    <span>
                      {paymentMethod === 'ONLINE'
                        ? 'Tiến hành Ký HĐ & Thanh toán trực tuyến'
                        : 'Xác nhận (Ký HĐ & Thanh toán tại cơ sở)'}
                    </span>
                  )}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* MODAL ZOOM INSPECTING STORAGE UNIT DETAIL                          */}
      {/* ================================================================ */}
      {inspectingSizeUnit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={() => setInspectingSizeUnit(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-5 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setInspectingSizeUnit(null)}
              className="absolute right-4 top-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-base font-mono">
                {inspectingSizeUnit.volumeText}
              </span>
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  Chi tiết quy cách kho {inspectingSizeUnit.volumeText}
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Sức chứa tương đương {inspectingSizeUnit.capacityText}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Minh họa không gian &amp; sức chứa:
                </span>
                <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setInspectVisualTab('3D')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      inspectVisualTab === '3D'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Mô hình 3D
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectVisualTab('PHOTO')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      inspectVisualTab === 'PHOTO'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Ảnh kho thực tế
                  </button>
                </div>
              </div>

              <div className="h-56 bg-gradient-to-b from-slate-50 to-blue-50/40 dark:from-slate-800/60 dark:to-slate-800/30 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-200/80 dark:border-slate-800 relative">
                {inspectVisualTab === '3D' ? (
                  <div className="w-full h-full p-3 flex items-center justify-center">
                    <StorageSizeIsometric3D
                      sizeId={inspectingSizeUnit.id}
                      volumeM3={inspectingSizeUnit.volumeNumber}
                      dimensions={inspectingSizeUnit.dimensions}
                      isAc={(acSelectionMap[inspectingSizeUnit.id] || 'NON_AC') === 'AC'}
                      showDimensions={true}
                    />
                  </div>
                ) : (
                  <div className="w-full h-full relative">
                    <img
                      src={getRealPhotoForSize(
                        inspectingSizeUnit.volumeNumber,
                        (acSelectionMap[inspectingSizeUnit.id] || 'NON_AC') === 'AC'
                      ).photoUrl}
                      alt={`Ảnh thực tế kho ${inspectingSizeUnit.volumeText}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent px-4 py-2.5 text-[11px] text-white">
                      {
                        getRealPhotoForSize(
                          inspectingSizeUnit.volumeNumber,
                          (acSelectionMap[inspectingSizeUnit.id] || 'NON_AC') === 'AC'
                        ).caption
                      }
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-400 block text-[10px]">KÍCH THƯỚC:</span>
                <strong className="text-slate-900 dark:text-white">{inspectingSizeUnit.dimensions}</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-400 block text-[10px]">DIỆN TÍCH MẶT SÀN:</span>
                <strong className="text-slate-900 dark:text-white">{inspectingSizeUnit.areaM2} m²</strong>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                Tài sản phù hợp lưu trữ:
              </span>
              <ul className="grid grid-cols-1 gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                {inspectingSizeUnit.fitsDetailed.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="text-blue-600 text-sm">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedSizeId(inspectingSizeUnit.id)
                  setInspectingSizeUnit(null)
                }}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/25 cursor-pointer"
              >
                Chọn kích thước này
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account / Settings / Logout Modals */}
      <AccountProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
      <WebSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
      <LogoutConfirmModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={async () => {
          await logout()
          navigate('/login')
        }}
        userName={user?.fullName || user?.username}
        userEmail={user?.email}
        userRole={user?.role?.name || 'CUSTOMER'}
      />

      {/* Modal cảnh báo cơ sở chưa có kho khả dụng */}
      <FacilityNoUnitsModal
        isOpen={isNoUnitsModalOpen}
        onClose={() => setIsNoUnitsModalOpen(false)}
        currentFacility={selectedFacility}
        alternativeFacilities={sortedFacilities}
        onSelectAlternativeFacility={(fac) => {
          handleSelectFacility(fac)
          setCurrentStep(1)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
        onStayOnFacilityStep={() => {
          setCurrentStep(1)
          const facSection = document.getElementById('facility-selection-section')
          if (facSection) {
            facSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
          } else {
            window.scrollTo({ top: 350, behavior: 'smooth' })
          }
        }}
      />

      {/* Modal Ký Hợp Đồng Điện Tử DocuSeal (Theo kích thước Size_ID) */}
      {showDocuSealModal && contractForSigning && (
        <DocuSealSimulationModal
          contract={contractForSigning}
          booking={createdBookingForSigning}
          financialSummary={{
            sizeName: `Kho ${currentSelectedSize.volumeText} (${isAcActive ? 'Máy lạnh A/C' : 'Tiêu chuẩn'})`,
            rentalMonths: isCustomDuration ? Math.max(1, Math.round(customDays / 30)) : rentalMonths,
            monthlyFee: quoteCalculation.monthlyAfterDiscount,
            totalRent: quoteCalculation.totalRent,
            depositAmount: quoteCalculation.depositAmount,
            totalPayment: quoteCalculation.totalEstimate,
          }}
          onClose={() => setShowDocuSealModal(false)}
          onSignedSuccess={handleDocuSealSignedSuccess}
        />
      )}

      {/* Modal nhắc đăng nhập khi từ Bước 3 sang Bước 4 */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-2xl text-left animate-in zoom-in-95 duration-200 space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <LogIn size={24} />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                Đăng nhập để tiếp tục đặt kho
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Quý khách vui lòng đăng nhập hoặc đăng ký tài khoản Boxora để tiếp tục sang Bước 4 (Lịch hẹn &amp; Thông tin người đặt). Thông tin cá nhân của bạn sẽ được tự động đồng bộ từ tài khoản hồ sơ!
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span>Kho lưu trữ:</span>
                <strong className="text-slate-900 dark:text-white">{currentSelectedSize.volumeText} • {selectedFacility?.name}</strong>
              </div>
              <div className="flex justify-between">
                <span>Thời hạn thuê:</span>
                <strong className="text-slate-900 dark:text-white">{isCustomDuration ? `${customDays} ngày` : `${rentalMonths} tháng`}</strong>
              </div>
              <div className="flex justify-between">
                <span>Số tiền tạm tính:</span>
                <strong className="text-blue-600 dark:text-cyan-400 font-bold">{quoteCalculation.totalEstimate.toLocaleString('vi-VN')} ₫</strong>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  const draft = {
                    facilityId: selectedFacility?.id,
                    selectedSizeId,
                    acMode: isAcActive ? 'AC' : 'NON_AC',
                    durationMode,
                    rentalMonths,
                    customDays,
                    checkInDate,
                    selectedPeriodId,
                    fullName: customerName.trim(),
          phone: customerPhone.trim().replace(/[\s.-]/g, ''),
          email: customerEmail.trim(),
          customerName: customerName.trim(),
                    customerPhone: customerPhone.trim().replace(/[\s.-]/g, ''),
                    customerEmail: customerEmail.trim(),
                    specialNotes: specialNotes.trim(),
                    idCardType,
                    targetStep: 4,
                  }
                  sessionStorage.setItem('boxora_booking_draft', JSON.stringify(draft))
                  localStorage.setItem('boxora_booking_draft', JSON.stringify(draft))
                  navigate('/login?redirect=/booking')
                }}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <LogIn size={16} />
                <span>Đăng nhập tài khoản</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const draft = {
                    facilityId: selectedFacility?.id,
                    selectedSizeId,
                    acMode: isAcActive ? 'AC' : 'NON_AC',
                    durationMode,
                    rentalMonths,
                    customDays,
                    checkInDate,
                    selectedPeriodId,
                    fullName: customerName.trim(),
          phone: customerPhone.trim().replace(/[\s.-]/g, ''),
          email: customerEmail.trim(),
          customerName: customerName.trim(),
                    customerPhone: customerPhone.trim().replace(/[\s.-]/g, ''),
                    customerEmail: customerEmail.trim(),
                    specialNotes: specialNotes.trim(),
                    idCardType,
                    targetStep: 4,
                  }
                  sessionStorage.setItem('boxora_booking_draft', JSON.stringify(draft))
                  localStorage.setItem('boxora_booking_draft', JSON.stringify(draft))
                  navigate('/register?redirect=/booking')
                }}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer text-center"
              >
                Đăng ký tài khoản mới
              </button>

              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors py-1 text-center"
              >
                Đóng lại &amp; Chỉnh sửa thông tin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspecting Size Unit Modal */}
      {inspectingSizeUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block">Chi tiết buồng kho</span>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Kho {inspectingSizeUnit.volumeText} ({inspectingSizeUnit.areaM2} m²)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingSizeUnit(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="h-56 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-center overflow-hidden">
              <StorageSizeIsometric3D
                sizeId={inspectingSizeUnit.id}
                volumeM3={inspectingSizeUnit.volumeNumber}
                dimensions={inspectingSizeUnit.dimensions}
                isAc={acSelectionMap[inspectingSizeUnit.id] === 'AC'}
                showDimensions={true}
              />
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Kích thước (D×R×C):</span>
                <strong className="text-slate-900 dark:text-white">{inspectingSizeUnit.dimensions}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sức chứa ước tính:</span>
                <strong className="text-slate-900 dark:text-white">{inspectingSizeUnit.capacityText}</strong>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Vật dụng phù hợp:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {inspectingSizeUnit.fitsDetailed.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <Check size={13} className="text-emerald-500 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedSizeId(inspectingSizeUnit.id)
                setInspectingSizeUnit(null)
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
            >
              Chọn kích thước này
            </button>
          </div>
        </div>
      )}

      {/* Account Profile Modal */}
      <AccountProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />

      {/* Settings Modal */}
      <WebSettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} />

      {/* Logout Confirm Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={async () => {
          setIsLogoutConfirmOpen(false)
          await logout()
          navigate('/')
        }}
      />

    </div>
  )
}
export default BookingPage
