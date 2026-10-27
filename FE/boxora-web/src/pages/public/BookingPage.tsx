import React, { useState, useEffect, useMemo } from 'react'
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
import { Facility, StorageUnit } from '../../types'
import { facilityService } from '../../services/facilityService'
import { storageUnitService } from '../../services/storageUnitService'
import { bookingService } from '../../services/bookingService'
import { paymentService } from '../../services/paymentService'
import { BrandLogo } from '../../components/common/BrandLogo'
import { QuickThemeLanguageToggle } from '../../components/common/QuickThemeLanguageToggle'
import { AccountProfileModal } from '../../components/common/AccountProfileModal'
import { LogoutConfirmModal } from '../../components/common/LogoutConfirmModal'
import { WebSettingsModal } from '../../components/common/WebSettingsModal'
import { UserAvatarDropdown } from '../../components/common/UserAvatarDropdown'
import { useLanguage } from '../../context/LanguageContext'
import { checkCustomerPortalAccess } from '../../utils/rentalAccess'

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
} from '../../utils/checkInTimeSlots'

export { CHECK_IN_PERIOD_GROUPS, CHECK_IN_HOURS_24 }

export const BookingPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, isAuthenticated, logout } = useAuth()
  const { t } = useLanguage()

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)

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
  // Step 1: Chọn cơ sở kho
  // Step 2: Chọn kích thước kho (8 mẫu 3D Isometric & Non-A/C / A/C)
  // Step 3: Thời gian thuê, Lịch check-in & Thông tin khách hàng (tự động lấy từ tài khoản, cho phép sửa)
  // Step 4: Xem báo giá và chi tiết về đơn đặt hàng (Review quotation & Booking details)
  // Step 5: Phương thức thanh toán (Thanh toán online & Thanh toán sau khi nhận kho)
  // Step 6: Đặt giữ chỗ thành công & Chờ đón tiếp
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

  // Step 2: Storage Size Selection (8 volumetric options matching image)
  const [selectedSizeId, setSelectedSizeId] = useState<string>('3m3')
  // Individual AC preference map per size or global
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

  // Category filter state for 16 sizes in Step 2
  const [sizeFilterCategory, setSizeFilterCategory] = useState<'ALL' | 'PERSONAL' | 'FAMILY' | 'ENTERPRISE'>('ALL')
  const filteredSizesCatalog = useMemo(() => {
    if (sizeFilterCategory === 'PERSONAL') {
      return STORAGE_SIZES_CATALOG.filter((s) => s.volumeNumber <= 4)
    }
    if (sizeFilterCategory === 'FAMILY') {
      return STORAGE_SIZES_CATALOG.filter((s) => s.volumeNumber >= 5 && s.volumeNumber <= 9)
    }
    if (sizeFilterCategory === 'ENTERPRISE') {
      return STORAGE_SIZES_CATALOG.filter((s) => s.volumeNumber >= 10)
    }
    return STORAGE_SIZES_CATALOG
  }, [sizeFilterCategory])

  // Modal zoom inspecting unit
  const [inspectingSizeUnit, setInspectingSizeUnit] = useState<StorageSizeUnitDef | null>(null)


  // Step 3: Rental Duration & Dates
  const [durationMode, setDurationMode] = useState<'MONTHS' | 'CUSTOM_DAYS'>('MONTHS')
  const [rentalMonths, setRentalMonths] = useState<number>(3)
  const [customDays, setCustomDays] = useState<number>(7)
  // Step 3: Appointment Date & Time
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

  // Ngày bắt đầu thời hạn thuê tự động đồng bộ theo ngày hẹn nhận kho
  useEffect(() => {
    if (checkInDate) {
      setStartDate(checkInDate)
    }
  }, [checkInDate])

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('morning')

  const selectedPeriod = useMemo(() => {
    return CHECK_IN_PERIOD_GROUPS.find((g) => g.id === selectedPeriodId) || CHECK_IN_PERIOD_GROUPS[0]
  }, [selectedPeriodId])

  const checkInTime = useMemo(() => {
    return `${selectedPeriod.name} (${selectedPeriod.rangeText})`
  }, [selectedPeriod])
  const [specialNotes, setSpecialNotes] = useState<string>('')
  const [policyAccepted, setPolicyAccepted] = useState<boolean>(true)

  // Step 3: Customer Information (pre-filled automatically from user account, fully editable by user)
  const [customerName, setCustomerName] = useState<string>('')
  const [customerPhone, setCustomerPhone] = useState<string>('')
  const [customerIdCard, setCustomerIdCard] = useState<string>('')
  const [customerEmail, setCustomerEmail] = useState<string>('')

  // Automatically pre-fill customer info when user is loaded
  useEffect(() => {
    if (user) {
      setCustomerName((prev) => (prev ? prev : user.fullName || user.username || ''))
      setCustomerPhone((prev) => (prev ? prev : user.phone || (user as any).phoneNumber || ''))
      setCustomerEmail((prev) => (prev ? prev : user.email || ''))
      const savedCccd =
        (user as any).identityCardNumber ||
        localStorage.getItem('boxora_user_cccd_' + user.email) ||
        localStorage.getItem('boxora_user_cccd') ||
        ''
      setCustomerIdCard((prev) => (prev ? prev : savedCccd))
    }
  }, [user])

  // Step 4 & 5: Submission & Result
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [bookingCode, setBookingCode] = useState<string>('')
  const [copiedCode, setCopiedCode] = useState<boolean>(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false)

  // Load backend data
  useEffect(() => {
    let isMounted = true
    setLoadingData(true)

    Promise.allSettled([
      facilityService.getFacilities({ size: 100 }),
      storageUnitService.getUnits(),
    ])
      .then(([facRes, unitRes]) => {
        if (!isMounted) return

        if (facRes.status === 'fulfilled' && Array.isArray(facRes.value?.content)) {
          const activeList = facRes.value.content.filter(
            (f) => !f.status || f.status === 'ACTIVE'
          )
          setFacilities(activeList)
          if (activeList.length > 0 && !selectedFacility) {
            setSelectedFacility(activeList[0])
          }
        }

        if (unitRes.status === 'fulfilled' && Array.isArray(unitRes.value)) {
          setStorageUnits(unitRes.value)
        }
      })
      .finally(() => {
        if (isMounted) setLoadingData(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Active facilities with unit count
  const sortedFacilities = useMemo(() => {
    return facilities.map((fac) => {
      const unitsInFac = storageUnits.filter((u) => u.facilityId === fac.id)
      const availableCount = unitsInFac.filter(
        (u) => u.status === 'AVAILABLE' || (u.status as string) === 'Trống'
      ).length

      return {
        ...fac,
        availableCount: availableCount > 0 ? availableCount : (unitsInFac.length > 0 ? 0 : 8),
      }
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [facilities, storageUnits])

  // Selected Size Unit Object
  const currentSelectedSize = useMemo(() => {
    return STORAGE_SIZES_CATALOG.find((s) => s.id === selectedSizeId) || STORAGE_SIZES_CATALOG[2]
  }, [selectedSizeId])

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

  // Pricing calculation: Tiền thuê buồng kho hàng tháng sau ưu đãi tính theo gói + % giảm, cọc 1 tháng tiền kho theo giá gốc niêm yết
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
    const depositAmount = baseMonthly // Tiền phải cọc là 1 tháng niêm yết của kho đó

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

  // Toggle AC for a size card
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
    isPaid = false
  ) => {
    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ngày ' + new Date().toLocaleDateString('vi-VN')

    const nowIso = new Date().toISOString()
    const payload = {
      id: `LOCAL-RES-${code}`,
      bookingCode: code,
      createdAt: nowIso,
      customer: { fullName: customerName, phone: customerPhone, idCard: customerIdCard, email: customerEmail },
      customerName: customerName,
      customerPhone: customerPhone,
      identityCardNumber: customerIdCard,
      customerEmail: customerEmail,
      facility: { id: selectedFacility?.id, name: selectedFacility?.name, address: selectedFacility?.address, contactPhone: selectedFacility?.contactPhone },
      facilityId: selectedFacility?.id,
      facilityName: selectedFacility?.name,
      unitCode: currentSelectedSize.volumeText,
      size: {
        volumeText: currentSelectedSize.volumeText,
        capacityText: currentSelectedSize.capacityText,
        mode: isAcActive ? 'Máy lạnh (A/C)' : 'Thông gió tiêu chuẩn (Non-A/C)',
        dimensions: currentSelectedSize.dimensions,
      },
      duration: {
        mode: durationMode,
        text: rentalDurationText,
        months: isCustomDuration ? Math.max(1, Math.round(customDays / 30)) : rentalMonths,
        days: isCustomDuration ? customDays : rentalMonths * 30,
      },
      rentalMonths: isCustomDuration ? Math.max(1, Math.round(customDays / 30)) : rentalMonths,
      rentalDurationText,
      durationMode,
      customDays: isCustomDuration ? customDays : null,
      startDate,
      rentalEndDate,
      checkInDate,
      checkInTime,
      expectedCheckInAt: `${checkInDate}T${selectedPeriod.hours[0]?.value || '09:00'}:00`,
      totalRentalFee: quoteCalculation.totalRent,
      depositAmount: quoteCalculation.depositAmount,
      totalEstimate: quoteCalculation.totalEstimate,
      paymentMethod: method === 'ONLINE' ? 'Thanh toán online (Trực tuyến)' : 'Thanh toán sau tại cơ sở kho',
      paymentStatus: isPaid ? 'PAID' : 'PENDING',
      status: isPaid ? 'PAID_CONFIRMED' : 'PENDING_CONTACT',
      sentToStaff: true,
      sentToStaffAt: nowIso,
    }

    try {
      const saved = JSON.parse(localStorage.getItem('boxora_guest_reservations') || '[]')
      const filtered = Array.isArray(saved) ? saved.filter((r: any) => r.bookingCode !== code) : []
      filtered.unshift(payload)
      localStorage.setItem('boxora_guest_reservations', JSON.stringify(filtered))
    } catch (e) {
      console.warn('Storage reservation error:', e)
    }

    try {
      const staffNotification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        facilityId: selectedFacility?.id,
        facilityName: selectedFacility?.name,
        channel: 'STAFF_PORTAL',
        notificationType: 'NEW_BOOKING_RESERVATION',
        referenceType: 'BOOKING',
        referenceId: code,
        title: isPaid ? `Đơn giữ chỗ đã thanh toán online: ${code}` : `Đơn giữ chỗ mới: ${code}`,
        content: isPaid
          ? `Khách hàng ${customerName} (${customerPhone}) đã thanh toán online thành công đơn giữ chỗ kho ${currentSelectedSize.volumeText} tại ${selectedFacility?.name}. Lịch hẹn: ${checkInDate} (${checkInTime}). Đã thu: ${quoteCalculation.totalEstimate.toLocaleString('vi-VN')} ₫.`
          : `Khách hàng ${customerName} (${customerPhone}) vừa gửi đơn đặt giữ chỗ (thanh toán sau) kho ${currentSelectedSize.volumeText} tại ${selectedFacility?.name}. Lịch hẹn: ${checkInDate} (${checkInTime}). Yêu cầu liên hệ đón tiếp theo lịch hẹn.`,
        status: 'UNREAD',
        createdAt: nowIso,
      }
      const existingNotifs = JSON.parse(localStorage.getItem('boxora_in_app_notifications') || '[]')
      existingNotifs.unshift(staffNotification)
      localStorage.setItem('boxora_in_app_notifications', JSON.stringify(existingNotifs))
      window.dispatchEvent(new CustomEvent('boxora_notification_pushed', { detail: staffNotification }))
      window.dispatchEvent(new CustomEvent('boxora_staff_reservation_created', { detail: payload }))
    } catch (e) {
      console.warn('Notification dispatch error:', e)
    }
  }

  // Xử lý thanh toán & Xác nhận đặt giữ chỗ (Bước 5 -> Mở cổng thanh toán hoặc Bước 6)
  const handleProcessPaymentAndConfirm = async (overrideMethod?: 'ONLINE' | 'PAY_LATER') => {
    const selectedMethod = overrideMethod || paymentMethod
    if (!policyAccepted) {
      alert('Quý khách vui lòng đồng ý với chính sách và quy chế giữ chỗ kho của Boxora.')
      setCurrentStep(4)
      return
    }

    if (!customerName.trim() || !customerPhone.trim() || !customerIdCard.trim()) {
      setSubmitError('Vui lòng kiểm tra và điền đầy đủ Họ tên, Số điện thoại và Số CCCD.')
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
      const facUnits = storageUnits.filter((u) => u.facilityId === selectedFacility?.id)
      const available = facUnits.filter((u) => u.status === 'AVAILABLE' || (u.status as string) === 'Trống')

      let matchedUnit = available.find((u) => Math.abs((u.areaSqMeters || 0) - currentSelectedSize.areaM2) < 0.8)
      if (!matchedUnit) {
        matchedUnit = available.find((u) => (u.unitTypeName || '').toLowerCase().includes(currentSelectedSize.id))
      }
      if (!matchedUnit) {
        matchedUnit = available[0] || facUnits[0] || storageUnits.find((u) => u.status === 'AVAILABLE') || storageUnits[0]
      }

      let effectiveBookingCode = generatedCode
      let backendBookingId = ''
      let createdBooking: any = null

      if (isAuthenticated && matchedUnit?.id) {
        try {
          const cleanTime = selectedPeriod.hours[0]?.value || '09:00'
          const res = await bookingService.createBooking({
            storageUnitId: matchedUnit.id,
            startDate: startDate,
            rentalMonths: isCustomDuration ? Math.max(1, Math.round(customDays / 30)) : rentalMonths,
            totalRentalFee: quoteCalculation.totalRent,
            depositPaid: selectedMethod === 'ONLINE' ? quoteCalculation.depositAmount : 0,
            signingMethod: selectedMethod === 'ONLINE' ? 'ONLINE' : 'IN_PERSON',
            expectedCheckInAt: `${checkInDate}T${cleanTime}:00`,
            checkInTime: cleanTime,
            identityCardNumber: customerIdCard.trim(),
            identityCardType: 'CCCD',
          })

          if (res?.bookingCode || res?.id) {
            effectiveBookingCode = res.bookingCode || `BX-${res.id.slice(0, 8).toUpperCase()}`
            backendBookingId = res.id
            createdBooking = res
          }
        } catch (apiErr: any) {
          console.warn('Backend booking API error:', apiErr)
          const msg = apiErr?.response?.data?.message || apiErr?.message
          if (selectedMethod === 'ONLINE') {
            throw new Error(msg || 'Không thể tạo phiên giữ chỗ trên hệ thống để kết nối cổng thanh toán. Quý khách vui lòng thử lại hoặc chọn Thanh toán sau khi nhận kho.')
          }
        }
      }

      setBookingCode(effectiveBookingCode)

      // Xử lý theo phương thức thanh toán đã chọn
      if (selectedMethod === 'ONLINE') {
        if (!backendBookingId) {
          throw new Error('Chưa thể khởi tạo thông tin giao dịch trực tuyến. Quý khách vui lòng thử lại hoặc chọn hình thức Thanh toán sau khi nhận kho.')
        }

        // Tính số tiền thanh toán khớp chính xác với bản ghi booking trong hệ thống
        const paymentAmount = (createdBooking?.totalRentalFee != null && createdBooking?.depositAmount != null)
          ? Math.round(Number(createdBooking.totalRentalFee) + Number(createdBooking.depositAmount))
          : (createdBooking?.initialPaymentAmount != null
              ? Math.round(Number(createdBooking.initialPaymentAmount))
              : quoteCalculation.totalEstimate)

        // Tạo giao dịch thanh toán trực tuyến qua cổng bảo mật
        const payRes = await paymentService.createVNPayPayment({
          bookingId: backendBookingId,
          paymentType: 'BOOKING_PAYMENT',
          amount: paymentAmount,
          orderInfo: `Thanh toan giu cho ${effectiveBookingCode}`,
        })

        if (payRes?.paymentUrl) {
          sendReservationToStaff(effectiveBookingCode, 'ONLINE', false)
          // Mở trực tiếp trang thanh toán
          window.location.assign(payRes.paymentUrl)
          return
        } else {
          throw new Error('Cổng thanh toán không phản hồi đường dẫn giao dịch. Vui lòng thử lại trong giây lát.')
        }
      } else {
        // Thanh toán sau khi nhận kho
        setIsOnlinePaid(false)
        sendReservationToStaff(effectiveBookingCode, 'PAY_LATER', false)
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


  const isStep3Valid = Boolean(
    isDurationValid &&
    customerName.trim().length > 0 &&
    customerPhone.trim().length > 0 &&
    customerIdCard.trim().length > 0
  )

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!selectedFacility && sortedFacilities.length > 0) {
        setSelectedFacility(sortedFacilities[0])
      }
      setCurrentStep(2)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (currentStep === 2) {
      setCurrentStep(3)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (currentStep === 3) {
      if (!isStep3Valid) {
        alert('Quý khách vui lòng kiểm tra và điền đầy đủ các thông tin bắt buộc ở Bước 3 trước khi tiếp tục.')
        return
      }
      setCurrentStep(4)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (currentStep === 4) {
      if (!policyAccepted) {
        alert('Quý khách vui lòng đồng ý với chính sách và quy chế giữ chỗ kho của Boxora.')
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
      
      {/* ================================================================ */}
      {/* 1. TOP UNIFIED NAVIGATION BAR (STICKY WITH BACKDROP BLUR)        */}
      {/* ================================================================ */}
      <header className="sticky top-0 z-[100] border-b border-slate-200/70 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl transition-colors">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-10">
          
          {/* Brand Logo */}
          <BrandLogo size="sm" subtitle="KHO TỰ QUẢN THÔNG MINH" />

          {/* Nav Links (Desktop) */}
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-slate-600 dark:text-slate-300 lg:flex">
            <a href="/#services" className="transition-colors hover:text-slate-950 dark:hover:text-white">
              Dịch vụ
            </a>
            <a href="/#process" className="transition-colors hover:text-slate-950 dark:hover:text-white">
              Cách hoạt động
            </a>
            <a href="/#iot-access" className="transition-colors hover:text-slate-950 dark:hover:text-white">
              Công nghệ
            </a>
            <a href="/#faq" className="transition-colors hover:text-slate-950 dark:hover:text-white">
              Hỗ trợ
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
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
                        className="w-full py-2.5 px-3.5 rounded-xl bg-slate-900 dark:bg-blue-600 text-white font-semibold text-xs flex items-center justify-between hover:bg-neutral-800 dark:hover:bg-blue-700 transition-all shadow-xs cursor-pointer"
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
                        onClick={() => navigate('/my-bookings')}
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
                  to="/units"
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

      {/* ================================================================ */}
      {/* 2. DEDICATED 5-STEP INTERACTIVE PROGRESS BAR (BELOW HEADER)        */}
      {/* ================================================================ */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          
          {/* Desktop & Tablet Stepper with Connected Progress Line */}
          <div className="hidden sm:block">
            <div className="relative flex items-center justify-between">
              
              {/* Background Connecting Line */}
              <div className="absolute left-8 right-8 top-5 -translate-y-1/2 h-1 bg-slate-200 dark:bg-slate-800 -z-0">
                <div
                  className="h-full bg-blue-600 transition-all duration-500 ease-out"
                  style={{ width: `${((currentStep - 1) / 5) * 100}%` }}
                />
              </div>

              {/* 6 Step Indicator */}
              {[
                { step: 1, title: 'Cơ sở kho' },
                { step: 2, title: 'Kích thước' },
                { step: 3, title: 'Thời gian & Lịch hẹn' },
                { step: 4, title: 'Báo giá & Chi tiết' },
                { step: 5, title: 'Thanh toán' },
                { step: 6, title: 'Chờ xác nhận' },
              ].map((item) => {
                const isPassed = currentStep > item.step
                const isCurrent = currentStep === item.step

                return (
                  <div
                    key={item.step}
                    className="relative z-10 flex flex-col items-center text-center select-none cursor-default"
                  >
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm transition-all duration-300 shadow-md ${
                        isPassed
                          ? 'bg-emerald-600 text-white shadow-emerald-600/30 ring-4 ring-emerald-500/10'
                          : isCurrent
                          ? 'bg-blue-600 text-white shadow-blue-600/30 ring-4 ring-blue-500/20 scale-110'
                          : 'bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {isPassed ? (
                        <Check size={18} strokeWidth={3} />
                      ) : (
                        <span>0{item.step}</span>
                      )}
                    </div>

                    <div className="mt-2">
                      <span
                        className={`text-xs font-bold block transition-colors ${
                          isCurrent
                            ? 'text-blue-600 dark:text-blue-400'
                            : isPassed
                            ? 'text-slate-900 dark:text-white font-semibold'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {item.title}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Mobile Compact Progress Bar (Display Only) */}
          <div className="sm:hidden space-y-2 select-none">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">
                BƯỚC {currentStep} / 6:
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {currentStep === 1 && 'Chọn cơ sở kho lưu trữ'}
                {currentStep === 2 && `Kích thước (${currentSelectedSize.volumeText})`}
                {currentStep === 3 && 'Thời gian & Lịch đón tiếp'}
                {currentStep === 4 && 'Xem báo giá & Chi tiết đơn'}
                {currentStep === 5 && 'Phương thức thanh toán'}
                {currentStep === 6 && 'Xác nhận & Hoàn tất'}
              </span>
              <span className="font-mono text-slate-400 text-[11px] font-bold">
                {Math.round((currentStep / 6) * 100)}%
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / 6) * 100}%` }}
              />
            </div>
            {/* Mobile step indicator chips (Display Only) */}
            <div className="flex items-center justify-between pt-1 text-[11px] font-mono">
              {[1, 2, 3, 4, 5, 6].map((s) => (
                <span
                  key={s}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-default ${
                    currentStep === s
                      ? 'bg-blue-600 text-white shadow-xs'
                      : s < currentStep
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                      : 'text-slate-400 dark:text-slate-600'
                  }`}
                >
                  B{s}
                </span>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ================================================================ */}
      {/* MAIN FULL-SCREEN PAGE CONTENT                                     */}
      {/* ================================================================ */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 pb-32 sm:pb-36">
        
        {/* ============================================================== */}
        {/* BƯỚC 1: CHỌN CƠ SỞ KHO                                         */}
        {/* ============================================================== */}
        {currentStep === 1 && (
          <div className="space-y-8 animate-in fade-in duration-300">
            
            <div className="text-center max-w-3xl mx-auto space-y-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono text-xs font-bold">
                <Building2 size={13} />
                BƯỚC 1: CHỌN CƠ SỞ KHO
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Chọn cơ sở kho lưu trữ phù hợp với bạn
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
                Chọn chi nhánh kho tự quản thông minh Boxora thuận tiện nhất cho bạn để tiếp tục đặt buồng kho.
              </p>
            </div>

            {/* Facility Cards Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400">
                <span>Danh sách cơ sở kho Boxora ({sortedFacilities.length} chi nhánh)</span>
              </div>

              {loadingData ? (
                <div className="p-16 text-center text-slate-400 text-sm">
                  <span className="animate-spin inline-block text-2xl mb-2">⟳</span>
                  <p>Đang tải danh sách cơ sở kho Boxora...</p>
                </div>
              ) : sortedFacilities.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-500 text-sm">
                  Không tìm thấy cơ sở nào phù hợp. Vui lòng tải lại trang.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
                  {sortedFacilities.map((fac, idx) => {
                    const isSelected = selectedFacility?.id === fac.id
                    const facImg = getFacilityImage(fac, idx)
                    return (
                      <div
                        key={fac.id}
                        onClick={() => setSelectedFacility(fac)}
                        className={`rounded-3xl border transition-all duration-300 cursor-pointer relative text-left flex flex-col justify-between overflow-hidden group shadow-sm hover:shadow-xl ${
                          isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-600 dark:border-blue-500 ring-4 ring-blue-500/20 scale-[1.01]'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {/* Facility Realistic Cover Image */}
                        <div className="relative w-full h-48 overflow-hidden bg-slate-100 dark:bg-slate-800">
                          <img
                            src={facImg}
                            alt={fac.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />

                          {/* Selected Check Badge */}
                          <div className="absolute top-3 right-3">
                            {isSelected ? (
                              <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs shadow-md font-bold ring-2 ring-white">
                                ✓
                              </span>
                            ) : (
                              <span className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-md border border-white/60 flex items-center justify-center text-white text-xs opacity-70 group-hover:opacity-100 transition-opacity" />
                            )}
                          </div>

                          {/* Facility Code Pill */}
                          <div className="absolute top-3 left-3">
                            <span className="px-2.5 py-1 rounded-lg bg-blue-600/90 backdrop-blur-md text-white font-mono text-[10.5px] font-bold tracking-wider shadow-sm uppercase">
                              {fac.code || 'BOXORA'}
                            </span>
                          </div>

                          {/* Branch name on bottom overlay */}
                          <div className="absolute bottom-2.5 left-3.5 right-3.5">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300 block">
                              CHI NHÁNH KHO TỰ QUẢN
                            </span>
                            <h3 className="font-extrabold text-base sm:text-lg text-white leading-tight drop-shadow-sm truncate">
                              {fac.name}
                            </h3>
                          </div>
                        </div>

                        {/* Card Info Body */}
                        <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                          <div className="space-y-3">
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2 leading-relaxed">
                              <MapPin size={16} className="text-blue-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{fac.address || 'Địa chỉ đang cập nhật'}</span>
                            </p>

                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                                🔒 Khóa IoT mã PIN
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                                📹 Camera AI 24/7
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                                ❄️ Điều hòa A/C
                              </span>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
                            <span className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1">
                              <Building2 size={13} className="text-blue-500" />
                              {fac.city || 'TP.HCM'}
                            </span>

                            <span className="font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200/60 dark:border-emerald-800/60">
                              {fac.availableCount > 0 ? `Còn ${fac.availableCount} kho trống` : 'Sắp trống'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}</div>
              )}
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* BƯỚC 2: CHỈ CHỌN KÍCH THƯỚC KHO (8 THẺ 3D ISOMETRIC)           */}
        {/* ============================================================== */}
        {currentStep === 2 && (
          <div className="space-y-8 animate-in fade-in duration-300">
            
            <div className="text-center max-w-3xl mx-auto space-y-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono text-xs font-bold">
                <Box size={13} />
                BƯỚC 2: CHỌN KÍCH THƯỚC KHO
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Chọn kích thước kho lưu trữ phù hợp
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
                Hệ thống 16 quy chuẩn thể tích từ 1 m³ đến 24 m³. Quý khách có thể chuyển đổi linh hoạt giữa chế độ máy lạnh A/C và thông gió tiêu chuẩn trên từng buồng kho.
              </p>
            </div>

            {/* Facility reminder banner */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Building2 size={18} className="text-blue-600 dark:text-blue-400" />
                <span>Cơ sở đang chọn: <strong>{selectedFacility?.name}</strong> ({selectedFacility?.address})</span>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-blue-600 hover:underline font-semibold cursor-pointer"
              >
                Đổi cơ sở khác
              </button>
            </div>

            {/* Quick Category Filter Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { key: 'ALL', label: 'Tất cả (16 kích thước)' },
                  { key: 'PERSONAL', label: 'Cá nhân & Mini (1 – 4 m³)' },
                  { key: 'FAMILY', label: 'Gia đình (5 – 9 m³)' },
                  { key: 'ENTERPRISE', label: 'Căn hộ lớn & Doanh nghiệp (10 – 24 m³)' },
                ].map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setSizeFilterCategory(cat.key as any)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      sizeFilterCategory === cat.key
                        ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 px-3 font-semibold">
                Hiển thị {filteredSizesCatalog.length} / 16 quy chuẩn
              </span>
            </div>

            {/* 16 Isometric Size Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredSizesCatalog.map((sizeUnit) => {
                const isSelected = selectedSizeId === sizeUnit.id
                const unitAcMode = acSelectionMap[sizeUnit.id] || 'NON_AC'
                const displayPrice = unitAcMode === 'AC' ? sizeUnit.acRate : sizeUnit.nonAcRate

                return (
                  <div
                    key={sizeUnit.id}
                    onClick={() => setSelectedSizeId(sizeUnit.id)}
                    className={`rounded-3xl border transition-all cursor-pointer relative flex flex-col justify-between overflow-hidden group ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-600 dark:border-blue-500 ring-4 ring-blue-500/20 shadow-xl'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-700 hover:shadow-lg'
                    }`}
                  >
                    {/* Top banner: Volume & Zoom Inspect Icon */}
                    <div className="p-4 pb-0 flex items-start justify-between">
                      <div>
                        <span className="font-extrabold text-2xl text-slate-900 dark:text-white font-headline tracking-tight block">
                          {sizeUnit.volumeText}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          {sizeUnit.capacityText}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setInspectingSizeUnit(sizeUnit)
                        }}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                        title="Phóng to & Xem chi tiết đồ đạc phù hợp"
                      >
                        <Maximize2 size={14} />
                      </button>
                    </div>

                    {/* 3D Isometric Image Display */}
                    <div className="px-4 py-3 flex items-center justify-center h-48 sm:h-52 overflow-hidden relative">
                      <img
                        src={sizeUnit.image}
                        alt={`Kho ${sizeUnit.volumeText}`}
                        className="max-h-full max-w-full object-contain filter drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    {/* Non-A/C vs A/C Capsule Toggle */}
                    <div className="p-4 pt-2 space-y-3 border-t border-slate-100 dark:border-slate-800">
                      
                      {/* Segmented Control Capsule Pill */}
                      <div className="p-1 rounded-full bg-slate-100 dark:bg-slate-800/80 flex items-center text-xs font-semibold">
                        <button
                          type="button"
                          onClick={(e) => handleToggleAc(sizeUnit.id, 'NON_AC', e)}
                          className={`flex-1 py-1.5 rounded-full text-center transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] ${
                            unitAcMode === 'NON_AC'
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                          }`}
                        >
                          <Wind size={12} />
                          <span>Non-A/C</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleToggleAc(sizeUnit.id, 'AC', e)}
                          className={`flex-1 py-1.5 rounded-full text-center transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] ${
                            unitAcMode === 'AC'
                              ? 'bg-blue-600 text-white shadow-xs font-bold'
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                          }`}
                        >
                          <ThermometerSnowflake size={12} />
                          <span>A/C Máy lạnh</span>
                        </button>
                      </div>

                      {/* Dimensions & Monthly Price */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                          {sizeUnit.dimensions.split('×')[0]}...
                        </span>
                        <div className="text-right">
                          <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white block font-mono leading-none">
                            {displayPrice.toLocaleString('vi-VN')} ₫
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">/tháng</span>
                        </div>
                      </div>

                    </div>
                  </div>
                )
              })}
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* BƯỚC 3: THỜI GIAN THUÊ, LỊCH HẸN & THÔNG TIN NGƯỜI ĐẶT         */}
        {/* ============================================================== */}
        {currentStep === 3 && (
          <div className="space-y-8 animate-in fade-in duration-300 max-w-4xl mx-auto">
            
            <div className="text-center space-y-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono text-xs font-bold">
                <Calendar size={13} />
                BƯỚC 3: THỜI GIAN THUÊ, LỊCH HẸN &amp; THÔNG TIN NGƯỜI ĐẶT
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Thiết lập thời hạn thuê &amp; Lịch đón tiếp
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
                Hệ thống đã tự động lấy thông tin từ tài khoản Boxora của bạn. Quý khách có thể kiểm tra và chỉnh sửa lại nếu muốn.
              </p>
            </div>

            {/* Selected Storage Unit Mini Bar */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs sm:text-sm shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 flex items-center justify-center flex-shrink-0">
                  <img src={currentSelectedSize.image} alt={currentSelectedSize.volumeText} className="max-h-full max-w-full object-contain" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">
                    Kho {currentSelectedSize.volumeText} ({isAcActive ? 'A/C Máy lạnh' : 'Non-A/C'}) • {selectedFacility?.name}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-xs">
                    {currentSelectedSize.dimensions} • Sức chứa {currentSelectedSize.capacityText}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="text-blue-600 hover:underline font-semibold cursor-pointer text-xs"
              >
                Đổi kích thước
              </button>
            </div>

            {/* SECTION 1: DURATION AND DATES */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock size={18} className="text-blue-600" />
                    1. Thời gian cam kết thuê kho &amp; Ưu đãi chiết khấu
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Thuê từ 3 tháng trở lên để nhận ưu đãi giảm giá trực tiếp vào đơn giá
                  </p>
                </div>
                <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-3.5 py-1.5 rounded-full">
                  {rentalDurationText}
                </span>
              </div>

              {/* 5 Duration Options */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { m: 1, label: '1 tháng', discount: 'Tiêu chuẩn' },
                  { m: 3, label: '3 tháng', discount: 'Giảm 5%' },
                  { m: 6, label: '6 tháng', discount: 'Giảm 10%' },
                  { m: 12, label: '12 tháng', discount: 'Giảm 15%' },
                ].map((dur) => (
                  <button
                    key={dur.m}
                    type="button"
                    onClick={() => {
                      setDurationMode('MONTHS')
                      setRentalMonths(dur.m)
                    }}
                    className={`p-4 rounded-2xl border text-center transition-all cursor-pointer ${
                      durationMode === 'MONTHS' && rentalMonths === dur.m
                        ? 'bg-blue-600 border-blue-600 text-white font-bold shadow-md shadow-blue-600/20 ring-2 ring-blue-500/30'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-sm font-bold">{dur.label}</div>
                    <div
                      className={`text-xs font-mono mt-1 ${
                        durationMode === 'MONTHS' && rentalMonths === dur.m
                          ? 'text-blue-100'
                          : 'text-emerald-600 dark:text-emerald-400 font-semibold'
                      }`}
                    >
                      {dur.discount}
                    </div>
                  </button>
                ))}

                {/* Mục Khác (Theo ngày) */}
                <button
                  type="button"
                  onClick={() => setDurationMode('CUSTOM_DAYS')}
                  className={`p-4 rounded-2xl border text-center transition-all cursor-pointer ${
                    durationMode === 'CUSTOM_DAYS'
                      ? 'bg-blue-600 border-blue-600 text-white font-bold shadow-md shadow-blue-600/20 ring-2 ring-blue-500/30'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-sm font-bold">Khác</div>
                  <div
                    className={`text-xs font-mono mt-1 ${
                      durationMode === 'CUSTOM_DAYS'
                        ? 'text-blue-100'
                        : 'text-blue-600 dark:text-blue-400 font-semibold'
                    }`}
                  >
                    Theo số ngày
                  </div>
                </button>
              </div>

              {/* Input nhập số ngày khi chọn Khác & Ràng buộc >= 7 ngày */}
              {durationMode === 'CUSTOM_DAYS' && (
                <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 space-y-3 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Nhập số ngày muốn thuê kho:
                      </label>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Ràng buộc thuê ngắn hạn: Thời gian thuê phải <strong>từ 7 ngày trở lên</strong> (≥ 7 ngày).
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <input
                          type="number"
                          min={7}
                          value={customDays || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10)
                            setCustomDays(isNaN(val) ? 0 : val)
                          }}
                          placeholder="≥ 7"
                          className={`w-32 px-3.5 py-2.5 rounded-xl border text-center font-mono font-bold text-base focus:outline-none focus:ring-2 transition-all ${
                            customDays < 7
                              ? 'border-red-400 bg-red-50 text-red-700 focus:ring-red-500 dark:bg-red-950/50 dark:text-red-300'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-blue-500'
                          }`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                          ngày
                        </span>
                      </div>

                      {/* Quick chips */}
                      <div className="flex gap-1.5">
                        {[7, 10, 14, 21, 30].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setCustomDays(d)}
                            className={`px-2.5 py-2 rounded-xl text-xs font-mono font-semibold transition-colors cursor-pointer ${
                              customDays === d
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {d}d
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {customDays < 7 && (
                    <div className="p-3 rounded-xl bg-red-100/90 dark:bg-red-950/80 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-medium flex items-center gap-2">
                      <AlertCircle size={16} className="flex-shrink-0" />
                      <span>
                        Thời gian thuê tối thiểu phải <strong>trên hoặc bằng 7 ngày</strong>. Quý khách vui lòng điều chỉnh lại số ngày.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Pricing calculation summary */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="p-3.5 sm:p-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-950 dark:text-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono">
                  <div>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                      {isCustomDuration
                        ? 'Tổng tiền thuê tạm tính theo ngày:'
                        : quoteCalculation.discountPercent > 0
                          ? `Tiền thuê buồng kho hàng tháng sau ưu đãi (Giảm ${quoteCalculation.discountPercent}%):`
                          : 'Tiền thuê buồng kho hàng tháng sau ưu đãi:'}
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <strong className="text-sm sm:text-base text-blue-700 dark:text-blue-400 font-bold">
                        {isCustomDuration
                          ? `${quoteCalculation.totalRent.toLocaleString('vi-VN')} ₫ (${customDays} ngày)`
                          : `${quoteCalculation.monthlyAfterDiscount.toLocaleString('vi-VN')} ₫/tháng`}
                      </strong>
                      {!isCustomDuration && quoteCalculation.discountPercent > 0 && (
                        <span className="text-xs text-slate-400 line-through font-normal">
                          {quoteCalculation.baseMonthly.toLocaleString('vi-VN')} ₫/tháng
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-[11px] w-fit">
                    Cọc 1 tháng: {quoteCalculation.depositAmount.toLocaleString('vi-VN')} ₫
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 2: APPOINTMENT AT FACILITY (24/7 ACCESS) */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <Calendar size={18} className="text-amber-500" />
                    2. Lịch hẹn đón tiếp tại cơ sở kho (Hỗ trợ 24/7)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Kho Boxora mở cửa tự động 24/7/365. Quý khách có thể lựa chọn bất kỳ khung giờ nào trong ngày để đến tham quan và nhận buồng kho.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono text-xs font-bold w-fit">
                  <Clock size={13} />
                  MỞ CỬA 24 GIỜ / 7 NGÀY
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Ngày đến xem &amp; nhận bàn giao:
                  </label>
                  <input
                    type="date"
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 text-xs flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Buổi hẹn đã chọn:</span>
                    <strong className="text-blue-700 dark:text-blue-300 font-bold font-mono text-xs sm:text-sm">
                      {selectedPeriod.name} ({selectedPeriod.rangeText})
                    </strong>
                  </div>
                </div>
              </div>

              {/* Chỉ hiển thị các box chọn buổi tiếp đón: Sáng, Trưa, Chiều, Tối, Đêm */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Chọn buổi hẹn tiếp đón tại kho:
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {CHECK_IN_PERIOD_GROUPS.map((group) => {
                    const isSelected = selectedPeriodId === group.id
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setSelectedPeriodId(group.id)}
                        className={`p-3.5 sm:p-4 rounded-2xl text-left border-2 transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20 shadow-md shadow-blue-500/10'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-2xl">{group.icon}</span>
                          {isSelected && (
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-cyan-400 animate-pulse" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-white">
                            {group.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 leading-snug">
                            {group.rangeText}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* IoT 24/7 Notice */}
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200 flex items-center gap-2">
                <Sparkles size={15} className="text-blue-600 flex-shrink-0" />
                <span>
                  Kho Boxora trang bị <strong>khóa số thông minh IoT độc lập</strong> hoạt động liên tục 24/7. Quý khách có thể tự do mở cửa buồng kho vào bất kỳ lúc nào trong 24 giờ.
                </span>
              </div>
            </div>

            {/* SECTION 3: CUSTOMER INFORMATION (AUTO-SYNCED FROM ACCOUNT & FULLY EDITABLE) */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <User size={18} className="text-blue-600" />
                    3. Thông tin người đặt kho
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Hệ thống tự động đồng bộ từ tài khoản. Quý khách có thể kiểm tra và chỉnh sửa lại nếu cần.
                  </p>
                </div>
                {isAuthenticated && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono text-xs font-bold w-fit">
                    <ShieldCheck size={14} />
                    TÀI KHOẢN ĐÃ XÁC THỰC
                  </span>
                )}
              </div>

              {/* Sync notification pill */}
              <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                <Sparkles size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Thông tin tự động điền:</strong> Họ tên, Số điện thoại và CCCD đã được lấy sẵn từ tài khoản Boxora của bạn. Quý khách có thể chỉnh sửa trực tiếp các ô bên dưới nếu muốn thay đổi thông tin người liên hệ.
                </span>
              </div>

              {/* 4 Editable Input Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Họ và tên người thuê *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Số điện thoại liên hệ *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="0912 345 678"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Số CCCD / Hộ chiếu (Đối chiếu nhận kho &amp; mã PIN) *
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={customerIdCard}
                      onChange={(e) => setCustomerIdCard(e.target.value)}
                      placeholder="Nhập 12 số CCCD (VD: 079123456789)"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Địa chỉ Email nhận phiếu hẹn
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Special Notes Input */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Ghi chú về tài sản gửi hoặc yêu cầu đặc biệt (tùy chọn):
                </label>
                <input
                  type="text"
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  placeholder="VD: Cần hỗ trợ xe kéo pallet, hàng chuyển nguyên căn hộ, hàng giá trị cao..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* BƯỚC 4: XEM BÁO GIÁ VÀ CHI TIẾT VỀ ĐƠN ĐẶT HÀNG                 */}
        {/* ============================================================== */}
        {currentStep === 4 && (
          <div className="space-y-8 animate-in fade-in duration-300 max-w-4xl mx-auto">
            
            <div className="text-center space-y-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono text-xs font-bold">
                <FileText size={13} />
                BƯỚC 4: XEM BÁO GIÁ &amp; CHI TIẾT VỀ ĐƠN ĐẶT HÀNG
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Xem báo giá &amp; Chi tiết về đơn đặt hàng
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
                Vui lòng rà soát bảng báo giá chi phí và các thông tin đã thiết lập trước khi tiến hành xác nhận đặt giữ chỗ buồng kho.
              </p>
            </div>

            {submitError && (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Official Order Quotation & Review Card */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-md space-y-0">
              
              {/* Header card banner */}
              <div className="p-6 bg-slate-900 dark:bg-slate-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 p-1 flex items-center justify-center flex-shrink-0">
                    <img
                      src={currentSelectedSize.image}
                      alt={currentSelectedSize.volumeText}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-blue-400 font-bold uppercase tracking-wider">
                      BẢNG BÁO GIÁ &amp; ĐƠN ĐẶT GIỮ CHỖ
                    </span>
                    <h2 className="font-bold text-xl text-white">
                      Kho tự quản {currentSelectedSize.volumeText} ({isAcActive ? 'A/C Máy lạnh' : 'Non-A/C Thông gió'})
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {currentSelectedSize.dimensions} • Sức chứa: {currentSelectedSize.capacityText}
                    </p>
                  </div>
                </div>

                <div className="sm:text-right">
                  <span className="text-[10px] text-slate-400 block font-mono">
                    {isCustomDuration
                      ? quoteCalculation.discountPercent > 0
                        ? `TỔNG TIỀN THUÊ DỰ KIẾN (ĐÃ GIẢM ${quoteCalculation.discountPercent}%)`
                        : 'TỔNG TIỀN THUÊ DỰ KIẾN'
                      : quoteCalculation.discountPercent > 0
                        ? `TIỀN THUÊ KHO HÀNG THÁNG (ĐÃ GIẢM ${quoteCalculation.discountPercent}%)`
                        : 'TIỀN THUÊ KHO HÀNG THÁNG (GIÁ GỐC)'}
                  </span>
                  <div className="flex items-baseline justify-end gap-2">
                    {!isCustomDuration && quoteCalculation.discountPercent > 0 && (
                      <span className="font-mono text-sm text-slate-400 line-through">
                        {quoteCalculation.baseMonthly.toLocaleString('vi-VN')} ₫
                      </span>
                    )}
                    <span className="font-mono text-2xl font-black text-cyan-300">
                      {isCustomDuration
                        ? `${quoteCalculation.totalRent.toLocaleString('vi-VN')} ₫`
                        : `${quoteCalculation.monthlyAfterDiscount.toLocaleString('vi-VN')} ₫/tháng`}
                    </span>
                  </div>
                  <span className="block text-[11px] text-slate-400 font-mono mt-0.5">
                    + Cọc 1 tháng: {quoteCalculation.depositAmount.toLocaleString('vi-VN')} ₫
                  </span>
                </div>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                
                {/* 4 Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  
                  {/* 1. Cơ sở kho */}
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                    <span className="font-bold text-slate-900 dark:text-white font-mono text-xs uppercase flex items-center gap-2">
                      <Building2 size={16} className="text-blue-600 dark:text-blue-400" />
                      1. Cơ sở kho lưu trữ
                    </span>
                    <div className="flex items-center gap-3.5">
                      <img
                        src={getFacilityImage(selectedFacility)}
                        alt={selectedFacility?.name || 'Cơ sở kho'}
                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs shrink-0"
                      />
                      <div className="space-y-1 text-xs sm:text-sm min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {selectedFacility?.name}
                        </div>
                        <div className="text-slate-600 dark:text-slate-400 leading-relaxed text-xs line-clamp-2">
                          {selectedFacility?.address}
                        </div>
                        <div className="text-blue-600 dark:text-blue-400 font-mono text-[11px] pt-0.5">
                          Hotline: {selectedFacility?.contactPhone || '1900-BOXORA'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Kích thước & Thời hạn */}
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                    <span className="font-bold text-slate-900 dark:text-white font-mono text-xs uppercase flex items-center gap-2">
                      <Box size={16} className="text-cyan-600 dark:text-cyan-400" />
                      2. Quy cách &amp; Thời hạn thuê
                    </span>
                    <div className="space-y-1 text-xs sm:text-sm font-mono">
                      <div>Thể tích: <strong>{currentSelectedSize.volumeText}</strong> ({currentSelectedSize.dimensions})</div>
                      <div>Loại phòng: <strong>{isAcActive ? 'Máy lạnh A/C' : 'Thông gió Non-A/C'}</strong></div>
                      <div>Thời hạn cam kết: <strong>{rentalDurationText}</strong></div>
                      <div>Thời gian: <strong>{startDate}</strong> đến <strong>{rentalEndDate}</strong></div>
                    </div>
                  </div>

                  {/* 3. Thông tin người đặt */}
                  <div className="p-5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-900 dark:text-blue-200 font-mono text-xs uppercase flex items-center gap-2">
                        <User size={16} className="text-blue-600" />
                        3. Thông tin người đặt kho
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(3)}
                        className="text-blue-600 hover:underline text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 size={12} />
                        Sửa
                      </button>
                    </div>

                    <div className="space-y-1 text-xs sm:text-sm font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Họ và tên:</span>
                        <strong className="text-slate-900 dark:text-white font-sans">{customerName}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Số điện thoại:</span>
                        <strong className="text-slate-900 dark:text-white">{customerPhone}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Số CCCD/Hộ chiếu:</span>
                        <strong className="text-blue-700 dark:text-blue-400">{customerIdCard}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Email:</span>
                        <span className="truncate max-w-[170px] text-slate-700 dark:text-slate-300">{customerEmail || 'Chưa cung cấp'}</span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Lịch hẹn tiếp đón tại kho */}
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                    <span className="font-bold text-slate-900 dark:text-white font-mono text-xs uppercase flex items-center gap-2">
                      <Calendar size={16} className="text-amber-600 dark:text-amber-400" />
                      4. Lịch hẹn đón tiếp tại cơ sở
                    </span>
                    <div className="space-y-1 text-xs sm:text-sm font-mono">
                      <div>Ngày hẹn: <strong>{checkInDate}</strong> lúc <strong>{checkInTime}</strong></div>
                      <div>Cơ sở tiếp đón: <strong>{selectedFacility?.name}</strong></div>
                      {specialNotes && (
                        <div className="pt-1 text-xs text-slate-500 dark:text-slate-400 font-sans italic">
                          Ghi chú: {specialNotes}
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* BẢNG BÁO GIÁ CHI PHÍ CHÍNH THỨC */}
                <div className="p-6 rounded-2xl bg-blue-50/70 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/60 space-y-3 font-mono text-xs sm:text-sm">
                  <div className="font-bold text-xs uppercase tracking-wider text-blue-900 dark:text-blue-200 flex items-center gap-2">
                    <FileCheck2 size={16} className="text-blue-600" />
                    Bảng báo giá chi phí thuê kho Boxora
                  </div>

                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Đơn giá buồng kho niêm yết (giá gốc):</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {isCustomDuration
                        ? `${quoteCalculation.dailyRate.toLocaleString('vi-VN')} ₫/ngày`
                        : `${quoteCalculation.baseMonthly.toLocaleString('vi-VN')} ₫/tháng`}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Thời hạn thuê:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {rentalDurationText} (Từ {startDate} đến {rentalEndDate})
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-900 dark:text-white font-bold pt-2 border-t border-blue-200 dark:border-blue-900/60">
                    <span>
                      {isCustomDuration
                        ? 'Tổng tiền thuê buồng kho tạm tính:'
                        : quoteCalculation.discountPercent > 0
                          ? `Tiền thuê buồng kho hàng tháng sau ưu đãi (Giảm ${quoteCalculation.discountPercent}%):`
                          : 'Tiền thuê buồng kho hàng tháng sau ưu đãi:'}
                    </span>
                    <div className="text-right">
                      <span className="text-blue-700 dark:text-blue-400 text-base font-bold">
                        {isCustomDuration
                          ? `${quoteCalculation.totalRent.toLocaleString('vi-VN')} ₫`
                          : `${quoteCalculation.monthlyAfterDiscount.toLocaleString('vi-VN')} ₫/tháng`}
                      </span>
                      {!isCustomDuration && quoteCalculation.discountPercent > 0 && (
                        <span className="block text-xs text-slate-400 line-through font-normal">
                          {quoteCalculation.baseMonthly.toLocaleString('vi-VN')} ₫/tháng
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                      <span>Tiền phải cọc buồng kho (1 tháng tiền kho theo giá niêm yết):</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-sans italic">
                        (Bảo đảm hoàn trả khi kết thúc hợp đồng)
                      </span>
                    </span>
                    <strong className="text-slate-900 dark:text-white font-bold text-sm">
                      {quoteCalculation.depositAmount.toLocaleString('vi-VN')} ₫
                    </strong>
                  </div>

                  <div className="flex justify-between items-center text-slate-900 dark:text-white pt-2.5 pb-2.5 px-3 rounded-xl bg-blue-100/60 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800">
                    <div>
                      <span className="font-bold text-xs sm:text-sm block">
                        Tổng chi phí thanh toán dự kiến khi nhận kho (Tiền thuê + Cọc 1 tháng):
                      </span>
                      {quoteCalculation.discountAmount > 0 && (
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-sans font-medium">
                          🎉 Quý khách tiết kiệm được {quoteCalculation.discountAmount.toLocaleString('vi-VN')} ₫ nhờ ưu đãi thuê {rentalDurationText}
                        </span>
                      )}
                    </div>
                    <span className="font-black text-blue-700 dark:text-cyan-400 text-base sm:text-lg">
                      {(quoteCalculation.totalRent + quoteCalculation.depositAmount).toLocaleString('vi-VN')} ₫
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t border-blue-200 dark:border-blue-900/60 gap-2">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white text-base block">
                        Phí thanh toán giữ chỗ trực tuyến hôm nay:
                      </span>
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-normal">
                        Miễn phí 100% • Quý khách thanh toán tiền thuê và tiền cọc 1 tháng qua chuyển khoản khi ký HĐ &amp; nhận bàn giao tại cơ sở
                      </span>
                    </div>
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      0 ₫
                    </span>
                  </div>
                </div>

                {/* Note phương thức thanh toán: Hệ thống chỉ nhận chuyển khoản, không nhận tiền mặt */}
                <div className="p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-3 text-xs sm:text-sm">
                  <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="block font-bold text-amber-950 dark:text-amber-200 text-xs sm:text-sm uppercase tracking-wide">
                      Lưu ý quan trọng về phương thức thanh toán:
                    </strong>
                    <p className="text-xs text-amber-900/90 dark:text-amber-300 leading-relaxed">
                      Hệ thống Boxora <strong>chỉ nhận chuyển khoản ngân hàng (VietQR / Internet Banking)</strong>, <strong>KHÔNG nhận tiền mặt</strong> tại quầy tiếp đón nhằm đảm bảo tính minh bạch, tự động xuất hóa đơn điện tử và bảo mật giao dịch cho quý khách.
                    </p>
                  </div>
                </div>

                {/* Policy Agreement */}
                <div className="pt-2">
                  <label className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={policyAccepted}
                      onChange={(e) => setPolicyAccepted(e.target.checked)}
                      className="mt-1 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span>
                      Tôi xác nhận các thông tin trên và đồng ý với{' '}
                      <Link to="/policies" target="_blank" className="text-blue-600 underline font-semibold">
                        Quy chế giữ chỗ &amp; Bảo mật kho tự quản Boxora
                      </Link>
                      . Vị trí buồng kho cụ thể và mã PIN bảo mật sẽ được bàn giao sau khi check-in tại cơ sở.
                    </span>
                  </label>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* BƯỚC 5: PHƯƠNG THỨC THANH TOÁN (ONLINE HOẶC THANH TOÁN SAU)   */}
        {/* ============================================================== */}
        {currentStep === 5 && (
          <div className="space-y-8 animate-in fade-in duration-300 max-w-4xl mx-auto">
            
            <div className="text-center space-y-2.5">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono text-xs font-bold">
                <CreditCard size={13} />
                BƯỚC 5: PHƯƠNG THỨC THANH TOÁN
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Chọn phương thức thanh toán
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                Lựa chọn phương thức thanh toán an toàn, linh hoạt phù hợp với nhu cầu của quý khách.
              </p>
            </div>

            {/* Storage Unit Mini Bar Summary */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 flex items-center justify-center flex-shrink-0">
                  <img src={currentSelectedSize.image} alt={currentSelectedSize.volumeText} className="max-h-full max-w-full object-contain" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block text-sm sm:text-base">
                    Kho {currentSelectedSize.volumeText} ({isAcActive ? 'A/C Máy lạnh' : 'Non-A/C'}) • {selectedFacility?.name}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-xs font-mono">
                    Thời hạn: <strong>{rentalDurationText}</strong> • Hẹn nhận kho: <strong>{checkInDate} ({checkInTime})</strong>
                  </span>
                </div>
              </div>
              <div className="text-left sm:text-right font-mono">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Tổng chi phí dự kiến:</span>
                <strong className="text-lg text-blue-700 dark:text-cyan-400 font-black">
                  {quoteCalculation.totalEstimate.toLocaleString('vi-VN')} ₫
                </strong>
                <span className="text-[10px] text-slate-400 block">
                  (Tiền thuê: {quoteCalculation.totalRent.toLocaleString('vi-VN')} ₫ + Cọc 1 tháng: {quoteCalculation.depositAmount.toLocaleString('vi-VN')} ₫)
                </span>
              </div>
            </div>

            {/* Hai tùy chọn thanh toán */}
            <div className="space-y-4">
              
              {/* Tùy chọn 1: Thanh toán Online */}
              <div
                onClick={() => setPaymentMethod('ONLINE')}
                className={`p-6 sm:p-7 rounded-3xl border-2 transition-all cursor-pointer relative overflow-hidden ${
                  paymentMethod === 'ONLINE'
                    ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-600 shadow-xl shadow-blue-600/10 ring-2 ring-blue-500/20'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-6 h-6 rounded-full border-2 mt-1 flex items-center justify-center shrink-0 transition-colors ${
                        paymentMethod === 'ONLINE'
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                      }`}
                    >
                      {paymentMethod === 'ONLINE' && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-bold uppercase tracking-wider font-mono">
                          Khuyên dùng
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1">
                          <Lock size={12} />
                          Bảo mật SSL 256-bit
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-mono">
                          Kích hoạt tức thì
                        </span>
                      </div>

                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <CreditCard className="text-blue-600 shrink-0" size={20} />
                          Thanh toán online
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                          Thanh toán trực tiếp nhanh chóng qua cổng thanh toán online. Hỗ trợ quét mã <strong>QR ngân hàng</strong>, ứng dụng Mobile Banking, thẻ ATM nội địa Napas và thẻ quốc tế Visa / MasterCard / JCB.
                        </p>
                      </div>

                      {/* Supported payment badges */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-2xs">
                          <QrCode size={14} className="text-blue-600" />
                          <span>VNPAY-QR / VietQR</span>
                        </span>
                        <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-2xs">
                          <Smartphone size={14} className="text-emerald-600" />
                          <span>Thẻ ATM / Mobile Banking</span>
                        </span>
                        <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-2xs">
                          <CreditCard size={14} className="text-indigo-600" />
                          <span>Visa / MasterCard / JCB</span>
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 flex items-center gap-2">
                        <ShieldCheck size={16} className="text-blue-600 shrink-0" />
                        <span>Khi bấm thanh toán, hệ thống sẽ mở trực tiếp trang thanh toán an toàn để bạn quét mã hoặc nhập thông tin thẻ.</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 hidden sm:block">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400 block">Số tiền thanh toán:</span>
                    <strong className="text-xl font-black text-blue-700 dark:text-cyan-400 font-mono">
                      {quoteCalculation.totalEstimate.toLocaleString('vi-VN')} ₫
                    </strong>
                  </div>
                </div>
              </div>

              {/* Tùy chọn 2: Thanh toán sau khi nhận kho (Pay Later) */}
              <div
                onClick={() => setPaymentMethod('PAY_LATER')}
                className={`p-6 sm:p-7 rounded-3xl border-2 transition-all cursor-pointer relative overflow-hidden ${
                  paymentMethod === 'PAY_LATER'
                    ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-600 shadow-xl shadow-blue-600/10 ring-2 ring-blue-500/20'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-6 h-6 rounded-full border-2 mt-1 flex items-center justify-center shrink-0 transition-colors ${
                        paymentMethod === 'PAY_LATER'
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                      }`}
                    >
                      {paymentMethod === 'PAY_LATER' && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-wider font-mono">
                          Giữ chỗ 0₫ hôm nay
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">
                          Thanh toán khi nhận kho
                        </span>
                      </div>

                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <Building2 className="text-emerald-600 shrink-0" size={20} />
                          Thanh toán sau khi nhận kho
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                          Đặt giữ chỗ trước hoàn toàn miễn phí <strong>0 ₫</strong> hôm nay. Quý khách thanh toán toàn bộ chi phí khi đến tham quan buồng kho thực tế và làm thủ tục bàn giao tại cơ sở.
                        </p>
                      </div>

                      {/* Details of pay later */}
                      <div className="p-3.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                        <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                          <span>Phí thanh toán giữ chỗ trực tuyến:</span>
                          <strong className="text-emerald-600 font-bold font-mono">0 ₫ (Miễn phí)</strong>
                        </div>
                        <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                          <span>Chi phí thanh toán khi nhận kho:</span>
                          <strong className="text-slate-900 dark:text-white font-bold font-mono">
                            {quoteCalculation.totalEstimate.toLocaleString('vi-VN')} ₫
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 hidden sm:block">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400 block">Thanh toán hôm nay:</span>
                    <strong className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      0 ₫
                    </strong>
                  </div>
                </div>
              </div>

            </div>

            {submitError && (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

          </div>
        )}

        {/* ============================================================== */}
        {/* BƯỚC 6: XÁC NHẬN ĐẶT GIỮ CHỖ THÀNH CÔNG                        */}
        {/* ============================================================== */}
        {currentStep === 6 && (
          <div className="space-y-8 animate-in zoom-in-95 duration-400 max-w-2xl mx-auto text-center py-6">
            
            {/* Animated Status Icon */}
            <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
              <div className={`absolute inset-0 rounded-full animate-ping ${
                paymentMethod === 'ONLINE' && isOnlinePaid
                  ? 'bg-emerald-500/20'
                  : 'bg-blue-500/20'
              }`} />
              <div className={`w-20 h-20 rounded-full text-white flex items-center justify-center shadow-xl ${
                paymentMethod === 'ONLINE' && isOnlinePaid
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/25'
                  : 'bg-gradient-to-tr from-blue-600 to-cyan-500 shadow-blue-500/25'
              }`}>
                {paymentMethod === 'ONLINE' && isOnlinePaid ? (
                  <CheckCircle2 size={38} className="animate-bounce" />
                ) : (
                  <Clock size={38} className="animate-pulse" />
                )}
              </div>
            </div>

            <div className="space-y-3">
              <span className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full font-mono text-xs font-bold border ${
                paymentMethod === 'ONLINE' && isOnlinePaid
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}>
                {paymentMethod === 'ONLINE' && isOnlinePaid ? (
                  <>
                    <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                    TRẠNG THÁI: ĐÃ THANH TOÁN ONLINE THÀNH CÔNG
                  </>
                ) : (
                  <>
                    <Clock size={14} className="text-amber-600 dark:text-amber-400" />
                    TRẠNG THÁI: ĐẶT GIỮ CHỖ THÀNH CÔNG (THANH TOÁN SAU)
                  </>
                )}
              </span>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {paymentMethod === 'ONLINE' && isOnlinePaid
                  ? 'Đặt giữ chỗ & Thanh toán online thành công!'
                  : 'Đơn đặt giữ chỗ đã được ghi nhận'}
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed">
                {paymentMethod === 'ONLINE' && isOnlinePaid
                  ? `Cảm ơn quý khách đã tin chọn Boxora! Giao dịch của bạn đã được thanh toán thành công trực tuyến. Nhân viên Boxora sẽ liên hệ và chuẩn bị buồng kho sẵn sàng đón tiếp bạn theo đúng lịch hẹn.`
                  : `Cảm ơn quý khách đã tin chọn dịch vụ của Boxora! Đơn đặt giữ chỗ của bạn đã được ghi nhận. Bạn sẽ thanh toán chi phí khi đến tham quan và nhận bàn giao kho tại cơ sở.`}
              </p>
            </div>

            {/* Booking Code Card */}
            <div className="p-6 rounded-3xl bg-slate-900 text-white shadow-2xl space-y-3">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
                MÃ ĐƠN ĐẶT GIỮ CHỖ CỦA BẠN
              </span>
              <div className="flex items-center justify-center gap-3">
                <span className="font-mono text-3xl font-black text-cyan-300 tracking-wider">
                  {bookingCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Sao chép mã đơn"
                >
                  {copiedCode ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                </button>
              </div>
              {copiedCode && (
                <span className="text-xs text-emerald-400 font-mono block">
                  Đã sao chép mã đơn vào bộ nhớ tạm!
                </span>
              )}
            </div>

            {/* Appointment Details Box */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left shadow-sm space-y-4 text-xs sm:text-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-slate-900 dark:text-white font-mono text-xs uppercase flex items-center gap-2">
                  <Calendar size={16} className="text-blue-600 dark:text-blue-400" />
                  Thông tin lịch hẹn &amp; kho đã chọn:
                </h3>
                <span className="text-xs font-mono font-bold text-blue-600 dark:text-cyan-400">
                  {selectedFacility?.name}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <img
                  src={getFacilityImage(selectedFacility)}
                  alt={selectedFacility?.name || 'Chi nhánh kho'}
                  className="w-full sm:w-48 h-32 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm shrink-0"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700 dark:text-slate-300 font-mono flex-1 w-full">
                <div>
                  <span className="text-slate-400 block text-[11px]">CƠ SỞ KHO:</span>
                  <strong className="text-slate-900 dark:text-white">{selectedFacility?.name}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">ĐỊA CHỈ:</span>
                  <span className="truncate block">{selectedFacility?.address}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">KÍCH THƯỚC KHO:</span>
                  <strong className="text-blue-600 dark:text-blue-400">
                    Kho {currentSelectedSize.volumeText} ({isAcActive ? 'A/C Máy lạnh' : 'Non-A/C'})
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">THỜI HẠN THUÊ:</span>
                  <strong className="text-slate-900 dark:text-white">
                    {rentalDurationText} (Từ {startDate} đến {rentalEndDate})
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">NGƯỜI ĐẶT:</span>
                  <strong className="text-slate-900 dark:text-white">{customerName} ({customerPhone})</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">SỐ CCCD ĐỐI CHIẾU:</span>
                  <strong className="text-blue-600 dark:text-cyan-400">{customerIdCard}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">THỜI GIAN HẸN:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400">{checkInDate} lúc {checkInTime}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">HÌNH THỨC THANH TOÁN:</span>
                  <strong className={paymentMethod === 'ONLINE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-cyan-400'}>
                    {paymentMethod === 'ONLINE' ? 'Thanh toán online (Trực tuyến)' : 'Thanh toán sau tại cơ sở kho'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">
                    {quoteCalculation.discountPercent > 0
                      ? `TIỀN THUÊ KHO HÀNG THÁNG SAU ƯU ĐÃI (GIẢM ${quoteCalculation.discountPercent}%):`
                      : 'TIỀN THUÊ KHO HÀNG THÁNG SAU ƯU ĐÃI:'}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <strong className="text-blue-600 dark:text-cyan-400">
                      {quoteCalculation.monthlyAfterDiscount.toLocaleString('vi-VN')} ₫/tháng
                    </strong>
                    {quoteCalculation.discountPercent > 0 && (
                      <span className="text-xs text-slate-400 line-through font-normal">
                        {quoteCalculation.baseMonthly.toLocaleString('vi-VN')} ₫
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">TIỀN PHẢI CỌC (1 THÁNG TIỀN KHO):</span>
                  <strong className="text-slate-900 dark:text-white">
                    {quoteCalculation.depositAmount.toLocaleString('vi-VN')} ₫
                  </strong>
                </div>
              </div>
            </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                💡 <strong>Lưu ý:</strong> Khi đến cơ sở nhận kho theo lịch hẹn, quý khách vui lòng mang theo CCCD/Hộ chiếu bản gốc (số <strong>{customerIdCard}</strong>) để đối chiếu và tiến hành ký hợp đồng bàn giao buồng kho.
              </div>
            </div>

            {/* Actions: Xem đơn đặt giữ chỗ / Chi tiết / Về trang chủ */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (isAuthenticated) {
                    navigate('/my-bookings')
                  } else {
                    navigate('/login?redirect=/my-bookings')
                  }
                }}
                className="px-7 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-600/25 flex items-center gap-2 transition-all cursor-pointer"
              >
                <FileText size={16} />
                <span>Xem đơn đặt giữ chỗ của bạn</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDetailModalOpen(true)}
                className="px-6 py-3.5 rounded-2xl border border-blue-300 dark:border-blue-750 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold text-sm transition-colors flex items-center gap-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/60"
              >
                <Maximize2 size={16} />
                <span>Chi tiết phiếu giữ chỗ</span>
              </button>

              <Link
                to="/"
                className="px-6 py-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm transition-colors flex items-center gap-2"
              >
                <Home size={16} />
                <span>Về trang chủ</span>
              </Link>
            </div>

            {/* MODAL CHI TIẾT ĐƠN ĐẶT GIỮ CHỖ */}
            {isDetailModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-left animate-in zoom-in-95 duration-200">
                  
                  {/* Modal Header */}
                  <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/30">
                        <FileText size={20} />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                          Chi tiết đơn đặt giữ chỗ
                        </h3>
                        <div className="flex items-center gap-2 text-xs font-mono text-cyan-300">
                          <span>Mã đơn: <strong>{bookingCode}</strong></span>
                          <button
                            type="button"
                            onClick={handleCopyCode}
                            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title="Sao chép mã đơn"
                          >
                            {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsDetailModalOpen(false)}
                      className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-5 sm:p-6 space-y-5 overflow-y-auto text-xs sm:text-sm">
                    
                    {/* Trạng thái đơn */}
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Clock size={18} className="animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                          <span>TRẠNG THÁI: CHỜ XÁC NHẬN</span>
                        </div>
                        <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                          Đơn đặt giữ chỗ của bạn đang ở trạng thái <strong className="font-bold">Chờ xác nhận</strong>. Sau khi nhân viên xác nhận đơn, trạng thái sẽ tự động chuyển sang <strong className="font-bold">Chờ check in</strong> và email xác nhận lịch hẹn sẽ được gửi đến bạn.
                        </p>
                      </div>
                    </div>

                    {/* Grid chi tiết */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 font-mono">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                        <img
                          src={getFacilityImage(selectedFacility)}
                          alt={selectedFacility?.name || 'Chi nhánh'}
                          className="w-14 h-14 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                        />
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-400 block uppercase">Cơ sở tiếp đón:</span>
                          <strong className="text-slate-900 dark:text-white font-sans text-xs truncate block">{selectedFacility?.name}</strong>
                          <span className="text-[11px] text-slate-500 block truncate font-sans mt-0.5">{selectedFacility?.address}</span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block uppercase">Thời gian hẹn:</span>
                        <strong className="text-emerald-600 dark:text-emerald-400 text-xs">{checkInDate} lúc {checkInTime}</strong>
                        <span className="text-[11px] text-slate-500 block font-sans mt-0.5">Tiếp đón và hỗ trợ tại kho</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block uppercase">Quy cách kho:</span>
                        <strong className="text-blue-600 dark:text-blue-400 text-xs">Kho {currentSelectedSize.volumeText} ({isAcActive ? 'A/C Máy lạnh' : 'Non-A/C'})</strong>
                        <span className="text-[11px] text-slate-500 block font-sans mt-0.5">{currentSelectedSize.dimensions} • {currentSelectedSize.capacityText}</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block uppercase">Thời hạn cam kết:</span>
                        <strong className="text-slate-900 dark:text-white text-xs">{rentalDurationText}</strong>
                        <span className="text-[11px] text-slate-500 block font-sans mt-0.5">Từ {startDate} đến {rentalEndDate}</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block uppercase">Người liên hệ:</span>
                        <strong className="text-slate-900 dark:text-white font-sans text-xs">{customerName}</strong>
                        <span className="text-[11px] text-blue-600 dark:text-blue-400 block font-mono mt-0.5">{customerPhone}</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block uppercase">Số CCCD đối chiếu:</span>
                        <strong className="text-blue-700 dark:text-cyan-400 text-xs">{customerIdCard}</strong>
                        <span className="text-[11px] text-slate-500 block font-sans mt-0.5">Đối chiếu khi nhận kho</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block uppercase">Phương thức thanh toán:</span>
                        <strong className={paymentMethod === 'ONLINE' && isOnlinePaid ? 'text-emerald-600 dark:text-emerald-400 text-xs' : 'text-blue-600 dark:text-cyan-400 text-xs'}>
                          {paymentMethod === 'ONLINE' ? 'Thanh toán online (Trực tuyến)' : 'Thanh toán sau tại cơ sở kho'}
                        </strong>
                        <span className="text-[11px] text-slate-500 block font-sans mt-0.5">
                          {paymentMethod === 'ONLINE' && isOnlinePaid ? '✓ Đã thanh toán online' : 'Chưa thanh toán • Thanh toán khi nhận kho'}
                        </span>
                      </div>
                    </div>

                    {/* Bảng tiền */}
                    <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 space-y-2 font-mono text-xs">
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>Tiền thuê buồng kho sau ưu đãi:</span>
                        <strong className="text-blue-700 dark:text-blue-300">{quoteCalculation.totalRent.toLocaleString('vi-VN')} ₫</strong>
                      </div>
                      {quoteCalculation.discountAmount > 0 && (
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                          <span>Chiết khấu ưu đãi kỳ hạn ({quoteCalculation.discountPercent}%):</span>
                          <span>−{quoteCalculation.discountAmount.toLocaleString('vi-VN')} ₫</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>Tiền phải cọc buồng kho (1 tháng giá gốc):</span>
                        <strong className="text-slate-900 dark:text-white">{quoteCalculation.depositAmount.toLocaleString('vi-VN')} ₫</strong>
                      </div>
                      <div className="flex justify-between text-slate-900 dark:text-white font-bold pt-1.5 border-t border-blue-200/60 dark:border-blue-900/60">
                        <span>Tổng chi phí trọn gói:</span>
                        <strong className="text-blue-700 dark:text-cyan-400 text-sm">
                          {(quoteCalculation.totalRent + quoteCalculation.depositAmount).toLocaleString('vi-VN')} ₫
                        </strong>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-300 pt-1 border-t border-blue-200/40 dark:border-blue-900/40">
                        <span>Đã thanh toán hôm nay:</span>
                        <strong className={paymentMethod === 'ONLINE' && isOnlinePaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}>
                          {paymentMethod === 'ONLINE' && isOnlinePaid
                            ? `${(quoteCalculation.totalRent + quoteCalculation.depositAmount).toLocaleString('vi-VN')} ₫ (Thanh toán online)`
                            : '0 ₫ (Thanh toán sau tại cơ sở)'}
                        </strong>
                      </div>
                    </div>

                    {/* Các bước tiếp theo */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                      <span className="font-bold text-slate-900 dark:text-white uppercase font-mono text-[11px] block">
                        Các bước tiếp theo:
                      </span>
                      <ul className="space-y-1.5 text-slate-600 dark:text-slate-300 text-xs">
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-500 font-bold">1.</span>
                          <span>Nhân viên kiểm tra và xác nhận đơn đặt giữ chỗ (chuyển sang trạng thái Chờ check in).</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-500 font-bold">2.</span>
                          <span>Quý khách đến cơ sở {selectedFacility?.name} theo lịch hẹn, mang CCCD bản gốc (số <strong>{customerIdCard}</strong>).</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-500 font-bold">3.</span>
                          <span>Ký hợp đồng thuê kho và nhận buồng kho thực tế.</span>
                        </li>
                      </ul>
                    </div>

                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-end gap-3">
                    <div className="flex items-center gap-2">
                      {isAuthenticated ? (
                        <button
                          type="button"
                          onClick={() => {
                            setIsDetailModalOpen(false)
                            navigate('/my-bookings')
                          }}
                          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/25 cursor-pointer transition-all"
                        >
                          <LayoutDashboard size={15} />
                          <span>Xem trong Dashboard</span>
                        </button>
                      ) : (
                        <Link
                          to="/login?redirect=/my-bookings"
                          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/25 cursor-pointer transition-all"
                        >
                          <LogIn size={15} />
                          <span>Đăng nhập để xem trên Dashboard</span>
                        </Link>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsDetailModalOpen(false)}
                        className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer"
                      >
                        Đóng
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>
        )}

      </main>

      {/* ================================================================ */}
      {/* 3. FIXED BOTTOM NAVIGATION FOOTER (ALWAYS VISIBLE ON SCROLL)     */}
      {/* ================================================================ */}
      {currentStep < 6 && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-all">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            
            {/* Left: Back button + Step Context Summary */}
            <div className="flex items-center gap-3 justify-between sm:justify-start">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-4 sm:px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-98"
                >
                  <ArrowLeft size={16} />
                  <span>
                    {currentStep === 2 && 'Quay lại chọn cơ sở'}
                    {currentStep === 3 && 'Quay lại đổi kích thước'}
                    {currentStep === 4 && 'Quay lại chỉnh sửa'}
                    {currentStep === 5 && 'Quay lại xem báo giá'}
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
              <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-slate-800 text-xs">
                {currentStep === 1 && (
                  <span className="text-slate-600 dark:text-slate-400 truncate max-w-xs font-mono">
                    📍 {selectedFacility ? selectedFacility.name : 'Vui lòng chọn cơ sở kho bên trên'}
                  </span>
                )}
                {currentStep === 2 && (
                  <span className="text-slate-600 dark:text-slate-400 font-mono">
                    📦 Kho <strong className="text-blue-600 dark:text-blue-400 font-bold">{currentSelectedSize.volumeText}</strong> ({isAcActive ? 'A/C Máy lạnh' : 'Non-A/C'}) • {currentSelectedSize.capacityText}
                  </span>
                )}
                {currentStep === 3 && (
                  <span className="text-slate-600 dark:text-slate-400 font-mono">
                    🗓️ <strong className="text-slate-900 dark:text-white">{rentalDurationText}</strong> • Check-in: <strong className="text-blue-600 dark:text-blue-400">{checkInDate} ({checkInTime})</strong>
                  </span>
                )}
                {currentStep === 4 && (
                  <div className="flex items-center gap-2 text-xs flex-wrap sm:flex-nowrap font-mono">
                    <span className="text-slate-500 dark:text-slate-400">
                      Thuê{quoteCalculation.discountPercent > 0 ? ` (-${quoteCalculation.discountPercent}%)` : ''}: <strong className="text-slate-800 dark:text-slate-200">{quoteCalculation.totalRent.toLocaleString('vi-VN')} ₫</strong>
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Cọc 1 tháng: <strong className="text-slate-800 dark:text-slate-200">{quoteCalculation.depositAmount.toLocaleString('vi-VN')} ₫</strong>
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span className="text-slate-900 dark:text-white font-bold">
                      Tổng dự kiến: <span className="text-blue-600 dark:text-cyan-400 font-black">{(quoteCalculation.totalRent + quoteCalculation.depositAmount).toLocaleString('vi-VN')} ₫</span>
                    </span>
                  </div>
                )}
                {currentStep === 5 && (
                  <span className="text-slate-600 dark:text-slate-400 font-mono">
                    💳 Phương thức: <strong className="text-blue-600 dark:text-blue-400">{paymentMethod === 'ONLINE' ? 'Thanh toán online (Trực tuyến)' : 'Thanh toán sau tại cơ sở kho'}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Right: Next / Proceed / Confirm button */}
            <div className="flex items-center gap-3 justify-end">
              {currentStep === 1 && (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full sm:w-auto px-7 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Tiếp tục: Chọn kích thước kho</span>
                  <ArrowRight size={17} />
                </button>
              )}

              {currentStep === 2 && (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full sm:w-auto px-7 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Tiếp tục: Thời gian &amp; Lịch hẹn</span>
                  <ArrowRight size={17} />
                </button>
              )}

              {currentStep === 3 && (
                <button
                  type="button"
                  disabled={!isStep3Valid}
                  onClick={handleNextStep}
                  className={`w-full sm:w-auto px-7 py-3 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all ${
                    isStep3Valid
                      ? 'bg-blue-600 hover:bg-blue-700 active:scale-98 text-white shadow-blue-600/25 cursor-pointer'
                      : 'bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
                  }`}
                  title={
                    !isDurationValid
                      ? 'Thời gian thuê tối thiểu phải từ 7 ngày trở lên'
                      : !customerName.trim() || !customerPhone.trim() || !customerIdCard.trim()
                      ? 'Vui lòng điền đầy đủ họ tên, số điện thoại và số CCCD'
                      : 'Tiếp tục xem báo giá chi tiết'
                  }
                >
                  <span>Tiếp tục: Xem báo giá &amp; Chi tiết</span>
                  <ArrowRight size={17} />
                </button>
              )}

              {currentStep === 4 && (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full sm:w-auto px-7 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Tiếp tục: Chọn phương thức thanh toán</span>
                  <ArrowRight size={17} />
                </button>
              )}

              {currentStep === 5 && (
                paymentMethod === 'ONLINE' ? (
                  <button
                    type="button"
                    onClick={() => handleProcessPaymentAndConfirm('ONLINE')}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="animate-spin text-base">⟳</span>
                        <span>Đang kết nối cổng thanh toán...</span>
                      </>
                    ) : (
                      <>
                        <span>Mở trang thanh toán online ({quoteCalculation.totalEstimate.toLocaleString('vi-VN')} ₫)</span>
                        <ExternalLink size={17} />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleProcessPaymentAndConfirm('PAY_LATER')}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="animate-spin text-base">⟳</span>
                        <span>Đang xử lý đặt chỗ...</span>
                      </>
                    ) : (
                      <>
                        <span>Xác nhận đặt giữ chỗ (Thanh toán sau)</span>
                        <CheckCircle2 size={18} />
                      </>
                    )}
                  </button>
                )
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

            <div className="h-52 bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 flex items-center justify-center border border-slate-100 dark:border-slate-800">
              <img
                src={inspectingSizeUnit.image}
                alt={inspectingSizeUnit.volumeText}
                className="max-h-full max-w-full object-contain filter drop-shadow-lg"
              />
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

      {/* Modal nhắc đăng nhập khi chọn Thanh toán Online */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-2xl text-left animate-in zoom-in-95 duration-200 space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <LogIn size={24} />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                Đăng nhập để thanh toán online
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Để kết nối cổng thanh toán trực tuyến bảo mật và lưu hợp đồng buồng kho vào tài khoản cá nhân, quý khách vui lòng đăng nhập trước khi thanh toán.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span>Kho lưu trữ:</span>
                <strong className="text-slate-900 dark:text-white">{currentSelectedSize.volumeText} • {selectedFacility?.name}</strong>
              </div>
              <div className="flex justify-between">
                <span>Số tiền thanh toán:</span>
                <strong className="text-blue-600 dark:text-cyan-400 font-bold">{quoteCalculation.totalEstimate.toLocaleString('vi-VN')} ₫</strong>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem('boxora_pending_booking_flow', JSON.stringify({
                      facilityId: selectedFacility?.id,
                      sizeId: selectedSizeId,
                      acMode: acSelectionMap[selectedSizeId] || 'AC',
                      durationMode,
                      rentalMonths,
                      customDays,
                      checkInDate,
                      selectedPeriodId,
                      customerName,
                      customerPhone,
                      customerIdCard,
                      customerEmail,
                      paymentMethod: 'ONLINE',
                    }))
                  } catch (e) {
                    console.warn(e)
                  }
                  navigate('/login?redirect=/booking')
                }}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <LogIn size={16} />
                <span>Đăng nhập ngay để thanh toán</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAuthModal(false)
                  setPaymentMethod('PAY_LATER')
                  void handleProcessPaymentAndConfirm('PAY_LATER')
                }}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Tiếp tục giữ chỗ với Thanh toán sau (0 ₫ hôm nay)
              </button>

              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors py-1"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
