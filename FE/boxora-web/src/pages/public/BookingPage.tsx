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
  const [sizeVisualMode, setSizeVisualMode] = useState<'3D' | 'PHOTO'>('3D')
  const [inspectVisualTab, setInspectVisualTab] = useState<'3D' | 'PHOTO'>('3D')
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

          // Check if facility was passed via URL search params (?facility=...)
          const facParam = searchParams.get('facility')
          let matchedFacility: Facility | undefined
          if (facParam) {
            matchedFacility = activeList.find(
              (f) =>
                f.id === facParam ||
                (f.code && f.code.toLowerCase() === facParam.toLowerCase()) ||
                (f.name && f.name.toLowerCase().includes(facParam.toLowerCase()))
            )
          }

          if (matchedFacility) {
            setSelectedFacility(matchedFacility)
          } else if (activeList.length > 0 && !selectedFacility) {
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

  // Sync URL search params for size/type, ac, and step
  useEffect(() => {
    const rawType = searchParams.get('type') || searchParams.get('size')
    if (rawType) {
      const typeUpper = rawType.toUpperCase()
      let mappedSizeId = rawType.toLowerCase()
      if (typeUpper === 'LOCKER') mappedSizeId = '2m3'
      else if (typeUpper === 'STANDARD') mappedSizeId = '6m3'
      else if (typeUpper === 'LARGE') mappedSizeId = '12m3'
      else if (typeUpper === 'ENTERPRISE') mappedSizeId = '20m3'

      const exists = STORAGE_SIZES_CATALOG.some((s) => s.id === mappedSizeId)
      if (exists) {
        setSelectedSizeId(mappedSizeId)
      }
    }

    const acParam = searchParams.get('ac')
    if (acParam === 'true' || acParam === '1' || acParam?.toUpperCase() === 'AC') {
      const rawTarget = searchParams.get('type') || searchParams.get('size') || '3m3'
      let targetId = rawTarget.toLowerCase()
      if (rawTarget.toUpperCase() === 'LOCKER') targetId = '2m3'
      else if (rawTarget.toUpperCase() === 'STANDARD') targetId = '6m3'
      else if (rawTarget.toUpperCase() === 'LARGE') targetId = '12m3'
      else if (rawTarget.toUpperCase() === 'ENTERPRISE') targetId = '20m3'

      setAcSelectionMap((prev) => ({ ...prev, [targetId]: 'AC' }))
    }

    const stepParam = searchParams.get('step')
    if (stepParam && ['1', '2', '3', '4', '5'].includes(stepParam)) {
      setCurrentStep(parseInt(stepParam, 10) as 1 | 2 | 3 | 4 | 5)
    } else if (searchParams.get('facility')) {
      setCurrentStep(2)
    }
  }, [searchParams])

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
    isPaid = false,
    backendBookingId = ''
  ) => {
    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ngày ' + new Date().toLocaleDateString('vi-VN')

    const nowIso = new Date().toISOString()
    const payload = {
      id: backendBookingId || `LOCAL-RES-${code}`,
      backendBookingId: backendBookingId || undefined,
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
      depositPaid: isPaid ? quoteCalculation.depositAmount : 0,
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

      if (isAuthenticated && matchedUnit?.id) {
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
          const res = await bookingService.createBooking({
            storageUnitId: matchedUnit.id,
            startDate: startDate,
            rentalMonths: isCustomDuration ? Math.max(1, Math.round(customDays / 30)) : rentalMonths,
            totalRentalFee: quoteCalculation.totalRent,
            depositPaid: selectedMethod === 'ONLINE' ? quoteCalculation.depositAmount : 0,
            depositAmount: quoteCalculation.depositAmount,
            signingMethod: selectedMethod === 'ONLINE' ? 'ONLINE' : 'IN_PERSON',
            expectedCheckInAt: expectedCheckInStr,
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
          returnUrl: `${window.location.origin}/payment-result`,
        })

        if (payRes?.paymentUrl) {
          sendReservationToStaff(effectiveBookingCode, 'ONLINE', false, backendBookingId)
          // Mở trực tiếp trang thanh toán
          window.location.assign(payRes.paymentUrl)
          return
        } else {
          throw new Error('Cổng thanh toán không phản hồi đường dẫn giao dịch. Vui lòng thử lại trong giây lát.')
        }
      } else {
        // Thanh toán sau khi nhận kho
        setIsOnlinePaid(false)
        sendReservationToStaff(effectiveBookingCode, 'PAY_LATER', false, backendBookingId)
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
      {/* 2. DEDICATED 6-STEP INTERACTIVE PROGRESS BAR (BELOW HEADER)       */}
      {/* ================================================================ */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          
          {/* Desktop & Tablet Stepper with Equal 6-Column Connected Progress Line */}
          <div className="hidden sm:block">
            <div className="relative grid grid-cols-6 items-start">
              
              {/* Background Connecting Track (from center of col 1 to center of col 6) */}
              <div className="absolute left-[8.333%] right-[8.333%] top-5 -translate-y-1/2 h-[3px] bg-slate-200 dark:bg-slate-800 rounded-full">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${((currentStep - 1) / 5) * 100}%` }}
                />
              </div>

              {/* 6 Step Nodes */}
              {[
                { step: 1, title: 'Cơ sở kho', subtitle: selectedFacility?.name || 'Chọn chi nhánh' },
                { step: 2, title: 'Kích thước', subtitle: `Kho ${currentSelectedSize.volumeText} (${isAcActive ? 'A/C' : 'Non-A/C'})` },
                { step: 3, title: 'Thời gian & Lịch hẹn', subtitle: `${rentalDurationText} • ${checkInDate}` },
                { step: 4, title: 'Báo giá & Chi tiết', subtitle: 'Rà soát chi phí' },
                { step: 5, title: 'Thanh toán', subtitle: paymentMethod === 'ONLINE' ? 'VNPay trực tuyến' : 'Thanh toán sau' },
                { step: 6, title: 'Chờ xác nhận', subtitle: 'Hoàn tất giữ chỗ' },
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
                    className={`relative z-10 flex flex-col items-center text-center px-2 select-none group focus:outline-none ${
                      canJumpBack ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${
                        isPassed
                          ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25 ring-4 ring-white dark:ring-slate-900 group-hover:bg-emerald-700'
                          : isCurrent
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-4 ring-blue-100 dark:ring-blue-950'
                          : 'bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 ring-4 ring-white dark:ring-slate-900'
                      }`}
                    >
                      {isPassed ? (
                        <Check size={17} strokeWidth={2.75} />
                      ) : (
                        <span>0{item.step}</span>
                      )}
                    </div>

                    <div className="mt-2.5 space-y-0.5 max-w-[150px]">
                      <span
                        className={`text-xs font-bold block transition-colors leading-snug ${
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
                        className={`text-[11px] block truncate transition-colors ${
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
          <div className="sm:hidden space-y-2.5 select-none">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold text-[11px]">
                  Bước {currentStep}/6
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {currentStep === 1 && 'Chọn cơ sở kho'}
                  {currentStep === 2 && `Chọn kích thước (${currentSelectedSize.volumeText})`}
                  {currentStep === 3 && 'Thời gian & Lịch hẹn'}
                  {currentStep === 4 && 'Báo giá & Chi tiết'}
                  {currentStep === 5 && 'Phương thức thanh toán'}
                  {currentStep === 6 && 'Chờ xác nhận'}
                </span>
              </div>
              <span className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                {Math.round((currentStep / 6) * 100)}%
              </span>
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

      {/* ================================================================ */}
      {/* MAIN FULL-SCREEN PAGE CONTENT                                     */}
      {/* ================================================================ */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 space-y-6 pb-32 sm:pb-36">
        
        {/* ============================================================== */}
        {/* BƯỚC 1: CHỌN CƠ SỞ KHO                                         */}
        {/* ============================================================== */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Step 1 Header & Context Bar */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200/60 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                  <Building2 size={13} />
                  <span>Bước 1 / 6 • Hệ thống chi nhánh</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Chọn cơ sở kho lưu trữ
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
                  Tất cả chi nhánh Boxora đều vận hành tự động 24/7 với khóa thông minh IoT độc lập và hệ thống kiểm soát nhiệt ẩm tiêu chuẩn.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <div className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-2 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span><strong>{sortedFacilities.length}</strong> cơ sở đang hoạt động</span>
                </div>
                {selectedFacility && (
                  <div className="hidden sm:flex px-3.5 py-2 rounded-xl bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800 text-xs font-semibold text-blue-700 dark:text-blue-300 items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-blue-600 dark:text-blue-400" />
                    <span>Đang chọn: {selectedFacility.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Facility Cards Grid */}
            {loadingData ? (
              <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 text-sm space-y-2">
                <div className="w-8 h-8 border-3 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto" />
                <p className="font-medium">Đang tải danh sách cơ sở kho Boxora...</p>
              </div>
            ) : sortedFacilities.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 text-sm">
                Không tìm thấy cơ sở nào phù hợp. Vui lòng tải lại trang.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                {sortedFacilities.map((fac, idx) => {
                  const isSelected = selectedFacility?.id === fac.id
                  const facImg = getFacilityImage(fac, idx)
                  return (
                    <div
                      key={fac.id}
                      onClick={() => setSelectedFacility(fac)}
                      className={`rounded-2xl border transition-all duration-200 cursor-pointer relative text-left flex flex-col justify-between overflow-hidden group ${
                        isSelected
                          ? 'bg-white dark:bg-slate-900 border-blue-600 dark:border-blue-500 ring-3 ring-blue-500/15 shadow-lg'
                          : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs hover:shadow-md'
                      }`}
                    >
                      {/* Facility Cover Image */}
                      <div className="relative w-full h-44 overflow-hidden bg-slate-100 dark:bg-slate-800">
                        <img
                          src={facImg}
                          alt={fac.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />

                        {/* Top Left: Facility Code & City (Khu vực) */}
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
                          <span className="px-2.5 py-1 rounded-lg bg-blue-600/90 backdrop-blur-md text-white text-[11px] font-bold tracking-wide uppercase shadow-xs">
                            {fac.code || 'BOXORA'}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-800 dark:text-slate-200 text-[11px] font-semibold shadow-xs">
                            {fac.city || 'TP.HCM'}
                          </span>
                        </div>

                        {/* Branch Title & Availability on Bottom Overlay */}
                        <div className="absolute bottom-3 left-3.5 right-3.5 flex flex-col gap-1.5 z-10">
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-600/95 backdrop-blur-md text-white text-[10px] font-semibold shadow-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              {fac.availableCount > 0 ? `Còn ${fac.availableCount} kho trống` : 'Sắp trống'}
                            </span>
                          </div>
                          <h3 className="font-bold text-base sm:text-lg text-white leading-snug truncate drop-shadow-sm">
                            {fac.name}
                          </h3>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
                        <div className="space-y-3.5">
                          <div className="space-y-1.5">
                            <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 flex items-start gap-2 leading-relaxed min-h-[38px]">
                              <MapPin size={15} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{fac.address || 'Địa chỉ đang cập nhật'}</span>
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                              <Phone size={14} className="text-slate-400 shrink-0" />
                              <span>Hotline: {fac.contactPhone || '1900 636 888'}</span>
                            </p>
                          </div>

                          {/* Clean Feature Chips */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300">
                              <Lock size={11} className="text-blue-600 dark:text-blue-400" />
                              Khóa IoT 24/7
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300">
                              <ShieldCheck size={11} className="text-emerald-600 dark:text-emerald-400" />
                              An ninh 24/7
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300">
                              <ThermometerSnowflake size={11} className="text-cyan-600 dark:text-cyan-400" />
                              Điều hòa A/C
                            </span>
                          </div>
                        </div>

                        {/* Action Footer */}
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                          <div
                            className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/50 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                            }`}
                          >
                            {isSelected ? (
                              <>
                                <Check size={14} strokeWidth={2.5} />
                                <span>Đang chọn cơ sở này</span>
                              </>
                            ) : (
                              <span>Chọn cơ sở này</span>
                            )}
                          </div>
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
        {/* BƯỚC 2: CHỌN KÍCH THƯỚC KHO (16 QUY CHUẨN THỂ TÍCH)             */}
        {/* ============================================================== */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Step 2 Header & Selected Facility Pill */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200/60 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                  <Box size={13} />
                  <span>Bước 2 / 6 • Quy cách &amp; Thể tích</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Chọn kích thước buồng kho
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
                  Lựa chọn thể tích phù hợp từ 1 m³ đến 24 m³ và tùy chỉnh chế độ điều hòa (A/C) hoặc thông gió tiêu chuẩn (Non-A/C).
                </p>
              </div>

              {/* Current Facility Context Bar */}
              <div className="flex items-center justify-between sm:justify-start gap-3 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs text-xs shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Cơ sở lưu trữ</span>
                    <strong className="text-slate-900 dark:text-white font-bold">{selectedFacility?.name}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 font-semibold transition-colors cursor-pointer"
                >
                  Đổi cơ sở
                </button>
              </div>
            </div>

            {/* Category Filter Tabs & Visual Mode Switcher */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { key: 'ALL', label: 'Tất cả (16)' },
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
                {/* 3D vs Real Photo Switcher */}
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
                    <span>Mô hình 3D trực quan</span>
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
                    <span>Ảnh buồng kho thực tế</span>
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

            {/* 16 Isometric Size Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {filteredSizesCatalog.map((sizeUnit) => {
                const isSelected = selectedSizeId === sizeUnit.id
                const unitAcMode = acSelectionMap[sizeUnit.id] || 'NON_AC'
                const displayPrice = unitAcMode === 'AC' ? sizeUnit.acRate : sizeUnit.nonAcRate
                const realPhotoInfo = getRealPhotoForSize(sizeUnit.volumeNumber, unitAcMode === 'AC')

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
                    {/* Top Header: Volume, Area & Inspect Button */}
                    <div className="p-4 pb-2 flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xl text-slate-900 dark:text-white tracking-tight">
                            {sizeUnit.volumeText}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                            {sizeUnit.areaM2} m²
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block mt-0.5">
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

                    {/* Clean 3D Isometric Cutaway OR Real Warehouse Photo Container */}
                    <div className="mx-4 my-1 rounded-xl bg-gradient-to-b from-slate-50 to-blue-50/40 dark:from-slate-800/60 dark:to-slate-800/30 border border-slate-100 dark:border-slate-800/80 flex items-center justify-center h-44 overflow-hidden relative">
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
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 via-slate-950/30 to-transparent px-3 py-2 flex items-center justify-between text-[10px] text-white">
                            <span className="font-semibold truncate">{sizeUnit.dimensions.replace('Cao ', '')}</span>
                            <span className="px-1.5 py-0.5 rounded bg-blue-600/90 font-bold shrink-0">
                              {unitAcMode === 'AC' ? 'Kho A/C' : 'Tiêu chuẩn'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Controls & Price */}
                    <div className="p-4 pt-2.5 space-y-3">
                      {/* Full Dimensions */}
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center justify-between">
                        <span>Kích thước (D×R×C):</span>
                        <strong className="text-slate-700 dark:text-slate-300 font-semibold">
                          {sizeUnit.dimensions.replace('Cao ', '')}
                        </strong>
                      </div>

                      {/* Non-A/C vs A/C Segmented Toggle */}
                      <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center text-xs font-semibold">
                        <button
                          type="button"
                          onClick={(e) => handleToggleAc(sizeUnit.id, 'NON_AC', e)}
                          className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] ${
                            unitAcMode === 'NON_AC'
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                          }`}
                        >
                          <Wind size={12} />
                          <span>Tiêu chuẩn</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleToggleAc(sizeUnit.id, 'AC', e)}
                          className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] ${
                            unitAcMode === 'AC'
                              ? 'bg-blue-600 text-white shadow-2xs font-bold'
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                          }`}
                        >
                          <ThermometerSnowflake size={12} />
                          <span>Máy lạnh A/C</span>
                        </button>
                      </div>

                      {/* Monthly Rate Footer */}
                      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          Đơn giá thuê
                        </span>
                        <div className="text-right">
                          <span className="font-extrabold text-base text-blue-600 dark:text-blue-400">
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

          </div>
        )}

        {/* ============================================================== */}
        {/* BƯỚC 3: THỜI GIAN THUÊ, LỊCH HẸN & THÔNG TIN NGƯỜI ĐẶT         */}
        {/* ============================================================== */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Step 3 Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200/60 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                  <Calendar size={13} />
                  <span>Bước 3 / 6 • Thời hạn &amp; Lịch hẹn</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Thời gian thuê &amp; Lịch hẹn nhận kho
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
                  Chọn gói thời hạn thuê ưu đãi, khung giờ hẹn bàn giao 24/7 và xác nhận thông tin người đại diện nhận kho.
                </p>
              </div>

              {isAuthenticated && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/70 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300 text-xs font-semibold w-fit shrink-0">
                  <ShieldCheck size={15} />
                  <span>Đã đồng bộ thông tin tài khoản</span>
                </span>
              )}
            </div>

            {/* Two-Column Layout: Left Forms (8 cols) + Right Live Summary (4 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT COLUMN: 3 CONFIGURATION SECTIONS */}
              <div className="lg:col-span-8 space-y-5">
                
                {/* SECTION 1: DURATION AND DISCOUNTS */}
                <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Clock size={18} />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-white">
                          1. Thời hạn thuê kho &amp; Ưu đãi kỳ hạn
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Cam kết từ 3 tháng trở lên được giảm trực tiếp từ 5% đến 15% đơn giá hàng tháng
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-bold shrink-0">
                      {rentalDurationText}
                    </span>
                  </div>

                  {/* 5 Duration Options */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
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
                          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                            active
                              ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/20'
                              : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-sm font-bold">{dur.label}</span>
                            {active && <Check size={14} strokeWidth={2.75} />}
                          </div>
                          <span
                            className={`text-[11px] font-semibold ${
                              active
                                ? 'text-blue-100'
                                : dur.m >= 3
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {dur.badge}
                          </span>
                        </button>
                      )
                    })}

                    {/* Custom Days Option */}
                    <button
                      type="button"
                      onClick={() => setDurationMode('CUSTOM_DAYS')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                        durationMode === 'CUSTOM_DAYS'
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/20'
                          : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-sm font-bold">Tùy chọn</span>
                        {durationMode === 'CUSTOM_DAYS' && <Check size={14} strokeWidth={2.75} />}
                      </div>
                      <span
                        className={`text-[11px] font-semibold ${
                          durationMode === 'CUSTOM_DAYS' ? 'text-blue-100' : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        Theo số ngày
                      </span>
                    </button>
                  </div>

                  {/* Custom Days Input Box */}
                  {durationMode === 'CUSTOM_DAYS' && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3 animate-in fade-in duration-200">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                            Số ngày thuê kho (tối thiểu 7 ngày)
                          </label>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Hệ thống tính cước linh hoạt theo đơn giá ngày ({quoteCalculation.dailyRate.toLocaleString('vi-VN')} ₫/ngày)
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
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
                              className={`w-28 px-3 py-2 rounded-xl border text-center font-bold text-sm focus:outline-none focus:ring-2 transition-all ${
                                customDays < 7
                                  ? 'border-red-400 bg-red-50 text-red-700 focus:ring-red-500 dark:bg-red-950/50 dark:text-red-300'
                                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-blue-500'
                              }`}
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400 pointer-events-none">
                              ngày
                            </span>
                          </div>

                          <div className="flex gap-1.5">
                            {[7, 14, 21, 30, 45].map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => setCustomDays(d)}
                                className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                  customDays === d
                                    ? 'bg-blue-600 text-white'
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
                        <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-medium flex items-center gap-2">
                          <AlertCircle size={15} className="shrink-0" />
                          <span>Thời gian thuê ngắn hạn tối thiểu là 7 ngày. Vui lòng nhập số ngày từ 7 trở lên.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* SECTION 2: CHECK-IN APPOINTMENT SCHEDULE */}
                <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Calendar size={18} />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-white">
                          2. Lịch hẹn đón tiếp &amp; Nhận bàn giao kho
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Chọn ngày và buổi thuận tiện để nhân viên chuẩn bị buồng kho &amp; hỗ trợ bàn giao
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold w-fit">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Hỗ trợ nhận kho 24/7
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Ngày nhận bàn giao kho (Ngày bắt đầu thuê)
                      </label>
                      <input
                        type="date"
                        value={checkInDate}
                        onChange={(e) => setCheckInDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Thời hạn hợp đồng dự kiến
                      </label>
                      <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-sm flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 text-xs">Từ {startDate} đến:</span>
                        <strong className="text-slate-900 dark:text-white font-bold text-xs sm:text-sm">
                          {rentalEndDate}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Time Slot Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      Khung giờ hẹn đến cơ sở
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      {CHECK_IN_PERIOD_GROUPS.map((group) => {
                        const isSelected = selectedPeriodId === group.id
                        return (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() => setSelectedPeriodId(group.id)}
                            className={`p-3 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                              isSelected
                                ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-600 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/15'
                                : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                {group.name}
                              </span>
                              {isSelected ? (
                                <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                                  <Check size={10} strokeWidth={3} />
                                </span>
                              ) : (
                                <Clock size={13} className="text-slate-400" />
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                              {group.rangeText.replace('Khoảng từ ', 'Từ ')}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* SECTION 3: CUSTOMER CONTACT DETAILS */}
                <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      <User size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white">
                        3. Thông tin người đặt &amp; Nhận bàn giao
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Dùng để lập hợp đồng thuê kho điện tử, cấp mã PIN khóa thông minh IoT và đối chiếu khi nhận kho
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Họ và tên người thuê <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Nguyễn Văn A"
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Số điện thoại liên hệ <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="0912 345 678"
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Số CCCD / Hộ chiếu <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input
                          type="text"
                          value={customerIdCard}
                          onChange={(e) => setCustomerIdCard(e.target.value)}
                          placeholder="Nhập 12 số CCCD (VD: 079123456789)"
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Địa chỉ Email nhận phiếu hẹn
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input
                          type="email"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          placeholder="email@example.com"
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Ghi chú về tài sản lưu trữ hoặc yêu cầu hỗ trợ (tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={specialNotes}
                      onChange={(e) => setSpecialNotes(e.target.value)}
                      placeholder="VD: Cần hỗ trợ xe đẩy hàng, chuyển đồ căn hộ, hàng dễ vỡ..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: STICKY LIVE BOOKING SUMMARY */}
              <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
                  
                  {/* Summary Header (Clean White & Soft Blue — No Black Background) */}
                  <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-50/90 via-white to-cyan-50/70 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border-b border-blue-100 dark:border-slate-800 text-slate-900 dark:text-white flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-14 h-14 rounded-2xl bg-white border border-blue-200/80 shadow-2xs p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
                        <StorageSizeIsometric3D
                          sizeId={currentSelectedSize.id}
                          volumeM3={currentSelectedSize.volumeNumber}
                          dimensions={currentSelectedSize.dimensions}
                          isAc={isAcActive}
                          showDimensions={false}
                        />
                      </div>
                      <div>
                        <span className="text-[11px] text-blue-600 font-bold uppercase tracking-wider block">
                          Tóm tắt buồng kho
                        </span>
                        <h4 className="font-extrabold text-base text-slate-900">
                          Kho {currentSelectedSize.volumeText} ({isAcActive ? 'Máy lạnh A/C' : 'Tiêu chuẩn'})
                        </h4>
                        <span className="text-xs text-slate-500 font-medium block">
                          {currentSelectedSize.dimensions}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Details */}
                  <div className="p-4 sm:p-5 space-y-4 text-xs">
                    <div className="space-y-2.5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-slate-500 dark:text-slate-400">Cơ sở kho:</span>
                        <div className="text-right">
                          <strong className="text-slate-900 dark:text-white font-semibold block">
                            {selectedFacility?.name}
                          </strong>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(1)}
                            className="text-[11px] text-blue-600 hover:underline font-medium cursor-pointer"
                          >
                            Đổi cơ sở
                          </button>
                        </div>
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <span className="text-slate-500 dark:text-slate-400">Sức chứa:</span>
                        <div className="text-right">
                          <strong className="text-slate-900 dark:text-white font-semibold block">
                            {currentSelectedSize.capacityText} ({currentSelectedSize.areaM2} m²)
                          </strong>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(2)}
                            className="text-[11px] text-blue-600 hover:underline font-medium cursor-pointer"
                          >
                            Đổi kích thước
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 dark:text-slate-400">Thời hạn thuê:</span>
                        <strong className="text-slate-900 dark:text-white font-semibold">
                          {rentalDurationText} ({startDate} → {rentalEndDate})
                        </strong>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 dark:text-slate-400">Lịch hẹn nhận kho:</span>
                        <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          {checkInDate} • {selectedPeriod.name}
                        </strong>
                      </div>
                    </div>

                    {/* Price Breakdown */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Đơn giá niêm yết:</span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {isCustomDuration
                            ? `${quoteCalculation.dailyRate.toLocaleString('vi-VN')} ₫/ngày`
                            : `${quoteCalculation.baseMonthly.toLocaleString('vi-VN')} ₫/tháng`}
                        </span>
                      </div>

                      {quoteCalculation.discountPercent > 0 && (
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                          <span>Ưu đãi thuê {rentalDurationText} (-{quoteCalculation.discountPercent}%):</span>
                          <span>−{quoteCalculation.discountAmount.toLocaleString('vi-VN')} ₫</span>
                        </div>
                      )}

                      <div className="flex justify-between text-slate-700 dark:text-slate-300 font-semibold">
                        <span>Tổng tiền thuê ({rentalDurationText}):</span>
                        <span>{quoteCalculation.totalRent.toLocaleString('vi-VN')} ₫</span>
                      </div>

                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Tiền cọc (1 tháng giá gốc):</span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {quoteCalculation.depositAmount.toLocaleString('vi-VN')} ₫
                        </span>
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          Tổng tạm tính
                        </span>
                        <strong className="font-extrabold text-lg text-blue-600 dark:text-blue-400">
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
        {/* BƯỚC 4: XEM BÁO GIÁ VÀ CHI TIẾT VỀ ĐƠN ĐẶT HÀNG                 */}
        {/* ============================================================== */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Step 4 Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200/60 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                  <FileText size={13} />
                  <span>Bước 4 / 6 • Báo giá &amp; Kiểm tra thông tin</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Báo giá &amp; Chi tiết đơn đặt kho
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
                  Rà soát lại thông tin buồng kho, lịch hẹn bàn giao và bảng kê chi phí trước khi chuyển sang bước chọn phương thức thanh toán.
                </p>
              </div>
            </div>

            {submitError && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300 flex items-center gap-2.5">
                <AlertCircle size={18} className="shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Two-Column Review Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT COLUMN: 4 INFORMATION CARDS & POLICY */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* Selected Storage Unit Banner (Clean White & Blue — No Black Background) */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50/90 via-white to-cyan-50/70 border border-blue-200/80 text-slate-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-white border border-blue-200/80 shadow-2xs p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
                      <StorageSizeIsometric3D
                        sizeId={currentSelectedSize.id}
                        volumeM3={currentSelectedSize.volumeNumber}
                        dimensions={currentSelectedSize.dimensions}
                        isAc={isAcActive}
                        showDimensions={false}
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-blue-600 font-bold uppercase tracking-wide block">
                        Quy cách buồng kho đã chọn
                      </span>
                      <h2 className="font-extrabold text-lg sm:text-xl text-slate-900">
                        Kho tự quản {currentSelectedSize.volumeText} ({isAcActive ? 'Máy lạnh A/C' : 'Tiêu chuẩn Non-A/C'})
                      </h2>
                      <p className="text-xs text-slate-600 mt-0.5 font-medium">
                        Kích thước: {currentSelectedSize.dimensions} • Diện tích: {currentSelectedSize.areaM2} m² • Sức chứa: {currentSelectedSize.capacityText}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold flex items-center gap-1.5 w-fit shrink-0 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Edit3 size={13} />
                    <span>Đổi kích thước</span>
                  </button>
                </div>

                {/* 2x2 Info Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* 1. Cơ sở kho */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wide flex items-center gap-2">
                        <Building2 size={15} className="text-blue-600 dark:text-blue-400" />
                        1. Cơ sở lưu trữ
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="text-blue-600 hover:underline text-xs font-semibold cursor-pointer"
                      >
                        Thay đổi
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <img
                        src={getFacilityImage(selectedFacility)}
                        alt={selectedFacility?.name || 'Cơ sở kho'}
                        className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      />
                      <div className="space-y-0.5 text-xs min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white text-sm truncate">
                          {selectedFacility?.name}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {selectedFacility?.address}
                        </div>
                        <div className="text-blue-600 dark:text-blue-400 font-medium pt-0.5">
                          Hotline: {selectedFacility?.contactPhone || '1900 636 888'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Thời hạn thuê */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wide flex items-center gap-2">
                        <Clock size={15} className="text-blue-600 dark:text-blue-400" />
                        2. Thời hạn hợp đồng
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(3)}
                        className="text-blue-600 hover:underline text-xs font-semibold cursor-pointer"
                      >
                        Chỉnh sửa
                      </button>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Thời gian cam kết:</span>
                        <strong className="text-slate-900 dark:text-white font-semibold">{rentalDurationText}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Ngày bắt đầu:</span>
                        <strong className="text-slate-900 dark:text-white font-semibold">{startDate}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Ngày kết thúc dự kiến:</span>
                        <strong className="text-slate-900 dark:text-white font-semibold">{rentalEndDate}</strong>
                      </div>
                    </div>
                  </div>

                  {/* 3. Thông tin khách hàng */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wide flex items-center gap-2">
                        <User size={15} className="text-blue-600 dark:text-blue-400" />
                        3. Người đặt kho
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(3)}
                        className="text-blue-600 hover:underline text-xs font-semibold cursor-pointer"
                      >
                        Chỉnh sửa
                      </button>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Họ và tên:</span>
                        <strong className="text-slate-900 dark:text-white font-semibold">{customerName}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Số điện thoại:</span>
                        <strong className="text-slate-900 dark:text-white font-semibold">{customerPhone}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Số CCCD/Hộ chiếu:</span>
                        <strong className="text-blue-600 dark:text-blue-400 font-semibold">{customerIdCard}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Email:</span>
                        <span className="truncate max-w-[170px] text-slate-700 dark:text-slate-300 font-medium">{customerEmail || 'Chưa cung cấp'}</span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Lịch hẹn bàn giao */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wide flex items-center gap-2">
                        <Calendar size={15} className="text-amber-600 dark:text-amber-400" />
                        4. Lịch hẹn đón tiếp
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(3)}
                        className="text-blue-600 hover:underline text-xs font-semibold cursor-pointer"
                      >
                        Đổi lịch
                      </button>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Ngày hẹn:</span>
                        <strong className="text-slate-900 dark:text-white font-semibold">{checkInDate}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Khung giờ:</span>
                        <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">{checkInTime}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Ghi chú:</span>
                        <span className="text-slate-700 dark:text-slate-300 truncate max-w-[160px]">{specialNotes || 'Không có'}</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Cashless Notice & Policy Checkbox */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-4">
                  <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                    <AlertCircle size={17} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong>Lưu ý giao dịch không tiền mặt:</strong> Hệ thống Boxora chỉ tiếp nhận thanh toán trực tuyến (VNPay / QR Ngân hàng / Thẻ) hoặc chuyển khoản VietQR tại quầy tiếp đón nhằm đảm bảo minh bạch và tự động cấp hóa đơn điện tử.
                    </p>
                  </div>

                  <label className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={policyAccepted}
                      onChange={(e) => setPolicyAccepted(e.target.checked)}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="leading-relaxed">
                      Tôi xác nhận các thông tin trên là chính xác và đồng ý với{' '}
                      <Link to="/policies" target="_blank" className="text-blue-600 dark:text-blue-400 underline font-semibold">
                        Quy chế giữ chỗ &amp; Bảo mật kho tự quản Boxora
                      </Link>
                      .
                    </span>
                  </label>
                </div>

              </div>

              {/* RIGHT COLUMN: OFFICIAL QUOTATION CARD */}
              <div className="lg:col-span-5 lg:sticky lg:top-24">
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

                  <div className="p-5 space-y-3.5 text-xs sm:text-sm">
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
                        <span>Đơn giá tháng sau ưu đãi (-{quoteCalculation.discountPercent}%):</span>
                        <span>{quoteCalculation.monthlyAfterDiscount.toLocaleString('vi-VN')} ₫/tháng</span>
                      </div>
                    )}

                    {quoteCalculation.discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span>Tổng số tiền tiết kiệm được:</span>
                        <span>−{quoteCalculation.discountAmount.toLocaleString('vi-VN')} ₫</span>
                      </div>
                    )}

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between text-slate-800 dark:text-slate-200 font-semibold">
                      <span>Tổng tiền thuê ({rentalDurationText}):</span>
                      <span>{quoteCalculation.totalRent.toLocaleString('vi-VN')} ₫</span>
                    </div>

                    <div className="flex justify-between items-start text-slate-600 dark:text-slate-400">
                      <div>
                        <span className="block">Tiền đặt cọc bảo đảm (1 tháng giá gốc):</span>
                        <span className="text-[11px] text-slate-400 block">Hoàn trả 100% khi thanh lý hợp đồng</span>
                      </div>
                      <strong className="text-slate-900 dark:text-white font-semibold">
                        {quoteCalculation.depositAmount.toLocaleString('vi-VN')} ₫
                      </strong>
                    </div>

                    <div className="p-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-900/60 space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          Tổng chi phí trọn gói
                        </span>
                        <span className="font-extrabold text-xl text-blue-600 dark:text-blue-400">
                          {quoteCalculation.totalEstimate.toLocaleString('vi-VN')} ₫
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Bao gồm toàn bộ tiền thuê {rentalDurationText} và tiền cọc 1 tháng.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                      <span className="font-bold text-slate-900 dark:text-white block">
                        Tùy chọn thanh toán linh hoạt ở Bước 5:
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Quý khách có thể chọn <strong>Thanh toán trực tuyến ngay qua VNPay</strong> để ký hợp đồng điện tử tức thì, hoặc chọn <strong>Giữ chỗ 0 ₫ hôm nay</strong> và thanh toán khi đến nhận bàn giao kho.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* BƯỚC 5: PHƯƠNG THỨC THANH TOÁN (ONLINE HOẶC THANH TOÁN SAU)   */}
        {/* ============================================================== */}
        {currentStep === 5 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Step 5 Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200/60 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                  <CreditCard size={13} />
                  <span>Bước 5 / 6 • Hình thức thanh toán</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Chọn phương thức thanh toán
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
                  Chọn thanh toán trực tuyến ngay qua cổng VNPay để hoàn tất thủ tục nhanh chóng, hoặc đặt giữ chỗ trước và thanh toán tại cơ sở.
                </p>
              </div>
            </div>

            {submitError && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs sm:text-sm flex items-center gap-2.5">
                <AlertCircle size={18} className="shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Two-Column Checkout Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT COLUMN: 2 PAYMENT METHOD OPTIONS */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* Tùy chọn 1: Thanh toán trực tuyến (VNPay) */}
                <div
                  onClick={() => setPaymentMethod('ONLINE')}
                  className={`p-5 sm:p-6 rounded-2xl border-2 transition-all cursor-pointer ${
                    paymentMethod === 'ONLINE'
                      ? 'bg-blue-50/40 dark:bg-blue-950/30 border-blue-600 ring-3 ring-blue-500/15 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-5 h-5 rounded-full border-2 mt-1 flex items-center justify-center shrink-0 transition-colors ${
                          paymentMethod === 'ONLINE'
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                        }`}
                      >
                        {paymentMethod === 'ONLINE' && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <CreditCard className="text-blue-600 shrink-0" size={18} />
                            <span>Thanh toán trực tuyến (VNPay)</span>
                          </h3>
                          <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/70 text-blue-700 dark:text-blue-300 text-[11px] font-bold">
                            Khuyên dùng
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                          Thanh toán qua ứng dụng Ngân hàng (QR Pay), thẻ ATM nội địa hoặc thẻ quốc tế Visa / MasterCard.
                        </p>

                        <div className="flex flex-wrap gap-2 pt-0.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                            <QrCode size={12} className="text-blue-600" />
                            Quét mã VietQR
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                            <FileCheck2 size={12} className="text-emerald-600" />
                            Ký hợp đồng điện tử ngay
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Thanh toán ngay</span>
                      <strong className="text-base sm:text-lg font-extrabold text-blue-600 dark:text-blue-400">
                        {quoteCalculation.totalEstimate.toLocaleString('vi-VN')} ₫
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Tùy chọn 2: Thanh toán khi nhận kho */}
                <div
                  onClick={() => setPaymentMethod('PAY_LATER')}
                  className={`p-5 sm:p-6 rounded-2xl border-2 transition-all cursor-pointer ${
                    paymentMethod === 'PAY_LATER'
                      ? 'bg-blue-50/40 dark:bg-blue-950/30 border-blue-600 ring-3 ring-blue-500/15 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-5 h-5 rounded-full border-2 mt-1 flex items-center justify-center shrink-0 transition-colors ${
                          paymentMethod === 'PAY_LATER'
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                        }`}
                      >
                        {paymentMethod === 'PAY_LATER' && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Building2 className="text-slate-700 dark:text-slate-300 shrink-0" size={18} />
                            <span>Thanh toán khi nhận kho tại cơ sở</span>
                          </h3>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                            Giữ chỗ 0 ₫ hôm nay
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                          Đặt giữ chỗ trước miễn phí, thanh toán qua chuyển khoản ngân hàng sau khi đến kiểm tra buồng kho thực tế tại cơ sở.
                        </p>

                        <div className="flex flex-wrap gap-2 pt-0.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                            <ShieldCheck size={12} className="text-emerald-600" />
                            Xem kho thực tế trước khi trả phí
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Cần trả hôm nay</span>
                      <strong className="text-base sm:text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                        0 ₫
                      </strong>
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: ORDER PAYMENT SUMMARY */}
              <div className="lg:col-span-5 lg:sticky lg:top-24">
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-50/90 via-white to-cyan-50/70 border-b border-blue-100 text-slate-900 flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-white border border-blue-200/80 shadow-2xs p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
                      <StorageSizeIsometric3D
                        sizeId={currentSelectedSize.id}
                        volumeM3={currentSelectedSize.volumeNumber}
                        dimensions={currentSelectedSize.dimensions}
                        isAc={isAcActive}
                        showDimensions={false}
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] text-blue-600 font-bold uppercase tracking-wider block">Đơn đặt giữ chỗ</span>
                      <h4 className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
                        Kho {currentSelectedSize.volumeText} ({isAcActive ? 'Máy lạnh A/C' : 'Tiêu chuẩn'}) • {selectedFacility?.name}
                      </h4>
                      <span className="text-xs text-slate-500 font-medium block truncate">
                        Nhận kho: {checkInDate} ({selectedPeriod.name})
                      </span>
                    </div>
                  </div>

                  <div className="p-5 space-y-3 text-xs sm:text-sm">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Khách hàng đăng ký:</span>
                      <strong className="text-slate-900 dark:text-white font-semibold">{customerName} ({customerPhone})</strong>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Thời hạn thuê ({rentalDurationText}):</span>
                      <strong className="text-slate-900 dark:text-white font-semibold">{quoteCalculation.totalRent.toLocaleString('vi-VN')} ₫</strong>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Tiền đặt cọc (1 tháng):</span>
                      <strong className="text-slate-900 dark:text-white font-semibold">{quoteCalculation.depositAmount.toLocaleString('vi-VN')} ₫</strong>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-baseline">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Tổng giá trị đơn hàng:</span>
                      <strong className="text-slate-900 dark:text-white font-bold text-base">
                        {quoteCalculation.totalEstimate.toLocaleString('vi-VN')} ₫
                      </strong>
                    </div>

                    <div className="p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-900/60 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm block">
                          Số tiền thanh toán ngay
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {paymentMethod === 'ONLINE' ? 'Qua cổng thanh toán VNPay' : 'Thanh toán sau tại cơ sở kho'}
                        </span>
                      </div>
                      <strong className="text-lg sm:text-xl font-extrabold text-blue-600 dark:text-blue-400">
                        {paymentMethod === 'ONLINE'
                          ? `${quoteCalculation.totalEstimate.toLocaleString('vi-VN')} ₫`
                          : '0 ₫'}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* BƯỚC 6: XÁC NHẬN ĐẶT GIỮ CHỖ THÀNH CÔNG                        */}
        {/* ============================================================== */}
        {currentStep === 6 && (
          <div className="space-y-6 animate-in zoom-in-95 duration-300 max-w-3xl mx-auto py-2">
            
            {/* Top Confirmation Hero Card */}
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-6 sm:p-8 text-center space-y-4 border-b border-slate-100 dark:border-slate-800">
                <div
                  className={`mx-auto w-16 h-16 rounded-2xl text-white flex items-center justify-center shadow-lg ${
                    paymentMethod === 'ONLINE' && isOnlinePaid
                      ? 'bg-emerald-600 shadow-emerald-600/20'
                      : 'bg-blue-600 shadow-blue-600/20'
                  }`}
                >
                  {paymentMethod === 'ONLINE' && isOnlinePaid ? (
                    <CheckCircle2 size={32} />
                  ) : (
                    <Clock size={32} />
                  )}
                </div>

                <div className="space-y-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                      paymentMethod === 'ONLINE' && isOnlinePaid
                        ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    {paymentMethod === 'ONLINE' && isOnlinePaid ? (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Đã thanh toán trực tuyến thành công</span>
                      </>
                    ) : (
                      <>
                        <Clock size={14} />
                        <span>Đặt giữ chỗ thành công • Chờ xác nhận</span>
                      </>
                    )}
                  </span>

                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {paymentMethod === 'ONLINE' && isOnlinePaid
                      ? 'Đặt giữ chỗ & Thanh toán thành công!'
                      : 'Phiếu đặt giữ chỗ đã được ghi nhận'}
                  </h1>

                  <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
                    {paymentMethod === 'ONLINE' && isOnlinePaid
                      ? 'Cảm ơn quý khách đã tin chọn Boxora. Nhân viên vận hành sẽ chuẩn bị buồng kho sẵn sàng đón tiếp quý khách theo đúng lịch hẹn.'
                      : 'Đơn đặt giữ chỗ của quý khách đã được chuyển đến bộ phận vận hành cơ sở. Quý khách sẽ thanh toán khi đến kiểm tra và nhận bàn giao kho.'}
                  </p>
                </div>

                {/* Booking Code Banner (Clean White & Blue — No Black Background) */}
                <div className="max-w-md mx-auto p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-white to-cyan-50 border border-blue-200 text-slate-900 shadow-xs flex items-center justify-between gap-3">
                  <div className="text-left">
                    <span className="text-[11px] text-slate-500 font-medium block">Mã phiếu đặt giữ chỗ</span>
                    <span className="text-xl sm:text-2xl font-extrabold text-blue-700 tracking-wide">
                      {bookingCode}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                  >
                    {copiedCode ? (
                      <>
                        <Check size={15} className="text-emerald-600" />
                        <span className="text-emerald-700">Đã sao chép</span>
                      </>
                    ) : (
                      <>
                        <Copy size={15} />
                        <span>Sao chép mã</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Reservation Summary Body */}
              <div className="p-6 sm:p-8 space-y-6 text-xs sm:text-sm">
                
                {/* Facility & Unit Row */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={getFacilityImage(selectedFacility)}
                      alt={selectedFacility?.name || 'Chi nhánh kho'}
                      className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                    <div>
                      <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold block">
                        Cơ sở tiếp đón &amp; bàn giao
                      </span>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white">
                        {selectedFacility?.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {selectedFacility?.address}
                      </p>
                    </div>
                  </div>

                  <div className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-left sm:text-right shrink-0">
                    <span className="text-[11px] text-slate-400 block">Lịch hẹn đón tiếp</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-bold text-xs sm:text-sm">
                      {checkInDate} • {checkInTime}
                    </strong>
                  </div>
                </div>

                {/* 2-Column Key Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      Thông tin buồng kho &amp; Kỳ hạn
                    </span>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Quy cách kho:</span>
                        <strong className="text-blue-600 dark:text-blue-400 font-semibold">
                          Kho {currentSelectedSize.volumeText} ({isAcActive ? 'Máy lạnh A/C' : 'Non-A/C'})
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Kích thước:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium">{currentSelectedSize.dimensions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Thời hạn cam kết:</span>
                        <strong className="text-slate-900 dark:text-white font-semibold">
                          {rentalDurationText} ({startDate} → {rentalEndDate})
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      Người đăng ký &amp; Thanh toán
                    </span>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Họ tên &amp; SĐT:</span>
                        <strong className="text-slate-900 dark:text-white font-semibold">
                          {customerName} ({customerPhone})
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Số CCCD đối chiếu:</span>
                        <strong className="text-blue-600 dark:text-blue-400 font-semibold">{customerIdCard}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Tổng chi phí (Thuê + Cọc):</span>
                        <strong className="text-slate-900 dark:text-white font-bold">
                          {quoteCalculation.totalEstimate.toLocaleString('vi-VN')} ₫
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reminder Notice */}
                <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
                  <ShieldCheck size={17} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    <strong>Hướng dẫn khi đến nhận kho:</strong> Quý khách vui lòng mang theo CCCD/Hộ chiếu bản gốc (số <strong>{customerIdCard}</strong>) khi đến cơ sở <strong>{selectedFacility?.name}</strong> theo lịch hẹn để đối chiếu, ký hợp đồng và nhận mã PIN khóa thông minh IoT.
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (isAuthenticated) {
                        navigate('/my-bookings')
                      } else {
                        navigate('/login?redirect=/my-bookings')
                      }
                    }}
                    className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <FileText size={16} />
                    <span>Xem đơn đặt giữ chỗ của bạn</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsDetailModalOpen(true)}
                    className="px-5 py-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/60"
                  >
                    <Maximize2 size={15} />
                    <span>Chi tiết phiếu giữ chỗ</span>
                  </button>

                  <Link
                    to="/"
                    className="px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2"
                  >
                    <Home size={15} />
                    <span>Về trang chủ</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* MODAL CHI TIẾT ĐƠN ĐẶT GIỮ CHỖ */}
            {isDetailModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-left animate-in zoom-in-95 duration-200">
                  
                  {/* Modal Header */}
                  <div className="bg-gradient-to-r from-blue-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 text-slate-900 dark:text-white p-5 sm:p-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/30">
                        <FileText size={20} />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900">
                          Chi tiết đơn đặt giữ chỗ
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-blue-700">
                          <span>Mã đơn: <strong>{bookingCode}</strong></span>
                          <button
                            type="button"
                            onClick={handleCopyCode}
                            className="text-slate-500 hover:text-blue-700 transition-colors cursor-pointer"
                            title="Sao chép mã đơn"
                          >
                            {copiedCode ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsDetailModalOpen(false)}
                      className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-5 sm:p-6 space-y-5 overflow-y-auto text-xs sm:text-sm">
                    
                    {/* Trạng thái đơn */}
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Clock size={18} />
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                        <img
                          src={getFacilityImage(selectedFacility)}
                          alt={selectedFacility?.name || 'Chi nhánh'}
                          className="w-14 h-14 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                        />
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-400 block uppercase">Cơ sở tiếp đón:</span>
                          <strong className="text-slate-900 dark:text-white text-xs truncate block">{selectedFacility?.name}</strong>
                          <span className="text-[11px] text-slate-500 block truncate mt-0.5">{selectedFacility?.address}</span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block uppercase">Thời gian hẹn:</span>
                        <strong className="text-emerald-600 dark:text-emerald-400 text-xs">{checkInDate} lúc {checkInTime}</strong>
                        <span className="text-[11px] text-slate-500 block mt-0.5">Tiếp đón và hỗ trợ tại kho</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block uppercase">Quy cách kho:</span>
                        <strong className="text-blue-600 dark:text-blue-400 text-xs">Kho {currentSelectedSize.volumeText} ({isAcActive ? 'A/C Máy lạnh' : 'Non-A/C'})</strong>
                        <span className="text-[11px] text-slate-500 block mt-0.5">{currentSelectedSize.dimensions} • {currentSelectedSize.capacityText}</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block uppercase">Thời hạn cam kết:</span>
                        <strong className="text-slate-900 dark:text-white text-xs">{rentalDurationText}</strong>
                        <span className="text-[11px] text-slate-500 block mt-0.5">Từ {startDate} đến {rentalEndDate}</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block uppercase">Người liên hệ:</span>
                        <strong className="text-slate-900 dark:text-white text-xs">{customerName}</strong>
                        <span className="text-[11px] text-blue-600 dark:text-blue-400 block mt-0.5">{customerPhone}</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block uppercase">Số CCCD đối chiếu:</span>
                        <strong className="text-blue-700 dark:text-cyan-400 text-xs">{customerIdCard}</strong>
                        <span className="text-[11px] text-slate-500 block mt-0.5">Đối chiếu khi nhận kho</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 sm:col-span-2">
                        <span className="text-[10px] text-slate-400 block uppercase">Phương thức thanh toán:</span>
                        <strong className={paymentMethod === 'ONLINE' && isOnlinePaid ? 'text-emerald-600 dark:text-emerald-400 text-xs' : 'text-blue-600 dark:text-cyan-400 text-xs'}>
                          {paymentMethod === 'ONLINE' ? 'Thanh toán online (Trực tuyến)' : 'Thanh toán sau tại cơ sở kho'}
                        </strong>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          {paymentMethod === 'ONLINE' && isOnlinePaid ? '✓ Đã thanh toán online' : 'Chưa thanh toán • Thanh toán khi nhận kho'}
                        </span>
                      </div>
                    </div>

                    {/* Bảng tiền */}
                    <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 space-y-2 text-xs">
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
                      <span className="font-bold text-slate-900 dark:text-white uppercase text-[11px] block">
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
                        className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
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
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] transition-all">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            
            {/* Left: Back button + Step Context Summary */}
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
                    {currentStep === 3 && 'Quay lại đổi kích thước'}
                    {currentStep === 4 && 'Quay lại chỉnh sửa'}
                    {currentStep === 5 && 'Quay lại báo giá'}
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
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Calendar size={14} className="text-blue-600" />
                    <span>
                      Thời hạn <strong className="text-slate-900 dark:text-white">{rentalDurationText}</strong> • Nhận kho: <strong className="text-blue-600 dark:text-blue-400">{checkInDate} ({selectedPeriod.name})</strong>
                    </span>
                  </span>
                )}
                {currentStep === 4 && (
                  <div className="flex items-center gap-2.5 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Tiền thuê: <strong className="text-slate-800 dark:text-slate-200">{quoteCalculation.totalRent.toLocaleString('vi-VN')} ₫</strong>
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Cọc 1 tháng: <strong className="text-slate-800 dark:text-slate-200">{quoteCalculation.depositAmount.toLocaleString('vi-VN')} ₫</strong>
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="text-slate-900 dark:text-white font-semibold">
                      Tổng cộng: <strong className="text-blue-600 dark:text-blue-400 font-extrabold">{quoteCalculation.totalEstimate.toLocaleString('vi-VN')} ₫</strong>
                    </span>
                  </div>
                )}
                {currentStep === 5 && (
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <CreditCard size={14} className="text-blue-600" />
                    <span>
                      Hình thức: <strong className="text-blue-600 dark:text-blue-400">{paymentMethod === 'ONLINE' ? 'Thanh toán trực tuyến (VNPay)' : 'Thanh toán khi nhận kho'}</strong>
                    </span>
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
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Tiếp tục: Chọn kích thước</span>
                  <ArrowRight size={16} />
                </button>
              )}

              {currentStep === 2 && (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Tiếp tục: Thời gian &amp; Lịch hẹn</span>
                  <ArrowRight size={16} />
                </button>
              )}

              {currentStep === 3 && (
                <button
                  type="button"
                  disabled={!isStep3Valid}
                  onClick={handleNextStep}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                    isStep3Valid
                      ? 'bg-blue-600 hover:bg-blue-700 active:scale-98 text-white shadow-md shadow-blue-600/20 cursor-pointer'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
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
                  <ArrowRight size={16} />
                </button>
              )}

              {currentStep === 4 && (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Tiếp tục: Phương thức thanh toán</span>
                  <ArrowRight size={16} />
                </button>
              )}

              {currentStep === 5 && (
                paymentMethod === 'ONLINE' ? (
                  <button
                    type="button"
                    onClick={() => handleProcessPaymentAndConfirm('ONLINE')}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-7 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="animate-spin text-base">⟳</span>
                        <span>Đang kết nối cổng thanh toán...</span>
                      </>
                    ) : (
                      <>
                        <span>Thanh toán ngay ({quoteCalculation.totalEstimate.toLocaleString('vi-VN')} ₫)</span>
                        <ExternalLink size={16} />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleProcessPaymentAndConfirm('PAY_LATER')}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-7 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="animate-spin text-base">⟳</span>
                        <span>Đang xử lý đặt chỗ...</span>
                      </>
                    ) : (
                      <>
                        <span>Xác nhận đặt giữ chỗ (Thanh toán sau)</span>
                        <CheckCircle2 size={17} />
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
