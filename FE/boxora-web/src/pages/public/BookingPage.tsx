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
  CalendarCheck,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useRealtimeSync } from '../../hooks/useRealtimeSync'
import { Facility, StorageUnit, RentalContract, UnitType, FacilityPolicy } from '../../types'
import { facilityPolicyService } from '../../services/facilityPolicyService'
import { facilityService } from '../../services/facilityService'
import { storageUnitService } from '../../services/storageUnitService'
import { bookingService } from '../../services/bookingService'
import { paymentService } from '../../services/paymentService'
import { contractService } from '../../services/contractService'
import { cancellationPolicyService } from '../../services/cancellationPolicyService'
import { customDiscountService, CustomDiscount } from '../../services/customDiscountService'
import { facilityUnitTypeService } from '../../services/facilityUnitTypeService'
import { DocuSealSimulationModal } from '../../components/modals/DocuSealSimulationModal'
import { FacilityNoUnitsModal } from '../../components/modals/FacilityNoUnitsModal'
import { PayLaterAppointmentConfirmModal } from '../../components/modals/PayLaterAppointmentConfirmModal'
import { CancellationPolicyConfirmModal } from '../../components/modals/CancellationPolicyConfirmModal'
import { CancellationPolicyDetail } from '../../types'
import { BrandLogo } from '../../components/common/BrandLogo'
import { QuickThemeLanguageToggle } from '../../components/common/QuickThemeLanguageToggle'
import { AccountProfileModal } from '../../components/common/AccountProfileModal'
import { LogoutConfirmModal } from '../../components/common/LogoutConfirmModal'
import { WebSettingsModal } from '../../components/common/WebSettingsModal'
import { UserAvatarDropdown } from '../../components/common/UserAvatarDropdown'
import {
  IdCardType,
  loadUserSavedIdDoc,
  saveUserSavedIdDoc
} from '../../utils/userIdDocument'
import { useLanguage } from '../../context/LanguageContext'
import { toast } from '../../utils/toast'
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
  if (name.includes('district 1') || name.includes('quáº­n 1') || name.includes('d1')) return facilityD1Img
  if (name.includes('district 7') || name.includes('quáº­n 7') || name.includes('d7')) return facilityD7Img
  if (name.includes('thá»§ Ä‘á»©c') || name.includes('thu duc')) return facilityThuDucImg
  if (name.includes('tÃ¢n bÃ¬nh') || name.includes('tan binh')) return facilityTanBinhImg

  const defaultList = [facilityD1Img, facilityD7Img, facilityThuDucImg, facilityTanBinhImg]
  return defaultList[index % defaultList.length]
}

export interface StorageSizeUnitDef {
  id: string
  volumeText: string
  volumeNumber: number
  capacityText: string
  image: string
  imageUrl?: string
  dimensions: string
  areaM2: number
  fitsDetailed: string[]
  nonAcRate: number
  acRate: number
  hasAc?: boolean
  dbUnitTypeId?: string
  typeName?: string
}

export const STORAGE_SIZES_CATALOG: StorageSizeUnitDef[] = [
  {
    id: '1m3',
    volumeText: '1.2 mÂ³',
    volumeNumber: 1.2,
    capacityText: '6 boxes',
    image: size1m3Img,
    dimensions: '1.0m Ã— 1.0m Ã— 1.2m',
    areaM2: 1.0,
    fitsDetailed: ['4â€“6 Vali lá»›n', '6 ThÃ¹ng carton tiÃªu chuáº©n (0.5Ã—0.4m)', 'Dá»¥ng cá»¥ thá»ƒ thao, laptop, balo', 'Giáº¥y tá» tÃ i liá»‡u vÄƒn phÃ²ng'],
    nonAcRate: 350000,
    acRate: 420000,
  },
  {
    id: '2m3',
    volumeText: '2 mÂ³',
    volumeNumber: 2,
    capacityText: '12 boxes',
    image: size2m3Img,
    dimensions: '1.0m Ã— 1.0m Ã— Cao 2.0m',
    areaM2: 1.0,
    fitsDetailed: ['12 ThÃ¹ng carton tiÃªu chuáº©n', 'Ká»‡ Ä‘á»ƒ Ä‘á»“ mini, gháº¿ lÆ°á»i', '3â€“4 Vali cá»¡ lá»›n', 'Äá»“ gia dá»¥ng cÃ¡ nhÃ¢n, tÃ i liá»‡u'],
    nonAcRate: 550000,
    acRate: 660000,
  },
  {
    id: '3m3',
    volumeText: '3 mÂ³',
    volumeNumber: 3,
    capacityText: '18 boxes',
    image: size3m3Img,
    dimensions: '1.2m Ã— 1.0m Ã— Cao 2.5m',
    areaM2: 1.2,
    fitsDetailed: ['18 ThÃ¹ng carton tiÃªu chuáº©n', 'Tá»§ quáº§n Ã¡o mini thÃ¡o láº¯p', 'BÃ n lÃ m viá»‡c, gháº¿ vÄƒn phÃ²ng', 'Ná»‡m Ä‘Æ¡n vÃ  há»™p Ä‘á»“ chuyá»ƒn trá»'],
    nonAcRate: 750000,
    acRate: 900000,
  },
  {
    id: '4m3',
    volumeText: '4 mÂ³',
    volumeNumber: 4,
    capacityText: '24 boxes',
    image: size4m3Img,
    dimensions: '1.6m Ã— 1.0m Ã— Cao 2.5m',
    areaM2: 1.6,
    fitsDetailed: ['24 ThÃ¹ng carton tÃ i sáº£n', 'Xe mÃ¡y tay ga, xe Ä‘áº¡p thá»ƒ thao', 'GiÆ°á»ng Ä‘Æ¡n, tá»§ Ä‘áº§u giÆ°á»ng', 'Thiáº¿t bá»‹ Ä‘iá»‡n tá»­, loa Ä‘Ã i'],
    nonAcRate: 990000,
    acRate: 1180000,
  },
  {
    id: '5m3',
    volumeText: '5 mÂ³',
    volumeNumber: 5,
    capacityText: '30 boxes',
    image: size5m3Img,
    dimensions: '1.9m Ã— 1.0m Ã— Cao 2.6m',
    areaM2: 1.9,
    fitsDetailed: ['30 ThÃ¹ng carton cá»¡ vá»«a', 'Tá»§ láº¡nh mini, lÃ² vi sÃ³ng', 'Sofa bÄƒng 2 chá»—', 'ToÃ n bá»™ Ä‘á»“ Ä‘áº¡c phÃ²ng ngá»§ Ä‘Æ¡n'],
    nonAcRate: 1250000,
    acRate: 1500000,
  },
  {
    id: '6m3',
    volumeText: '6 mÂ³',
    volumeNumber: 6,
    capacityText: '36 boxes',
    image: size6m3Img,
    dimensions: '2.3m Ã— 1.0m Ã— Cao 2.6m',
    areaM2: 2.3,
    fitsDetailed: ['36 ThÃ¹ng carton hÃ ng hÃ³a', 'Sofa vÄƒng, bÃ n trÃ , TV 65-inch', 'Tá»§ quáº§n Ã¡o 2 cÃ¡nh gá»—', 'MÃ¡y giáº·t, mÃ¡y sáº¥y quáº§n Ã¡o'],
    nonAcRate: 1500000,
    acRate: 1800000,
  },
  {
    id: '7m3',
    volumeText: '7 mÂ³',
    volumeNumber: 7,
    capacityText: '42 boxes',
    image: size6m3Img,
    dimensions: '2.5m Ã— 1.1m Ã— Cao 2.6m',
    areaM2: 2.7,
    fitsDetailed: ['42 ThÃ¹ng carton tÃ i sáº£n', 'Tá»§ quáº§n Ã¡o 3 cÃ¡nh', 'BÃ n lÃ m viá»‡c chá»¯ L + Gháº¿ cÃ´ng thÃ¡i há»c', 'GiÆ°á»ng ná»‡m Ä‘Ã´i thÃ¡o láº¯p'],
    nonAcRate: 1680000,
    acRate: 2010000,
  },
  {
    id: '8m3',
    volumeText: '7.8 mÂ³',
    volumeNumber: 7.8,
    capacityText: '48 boxes',
    image: size8m3Img,
    dimensions: '2.0m Ã— 1.5m Ã— 2.6m',
    areaM2: 3.0,
    fitsDetailed: ['48 ThÃ¹ng hÃ ng carton kinh doanh', 'BÃ n gháº¿ Äƒn 4-6 ngÆ°á»i', 'GiÆ°á»ng Ä‘Ã´i Queen-size + Ná»‡m', 'Tá»§ láº¡nh 2 cÃ¡nh, mÃ¡y rá»­a bÃ¡t'],
    nonAcRate: 1850000,
    acRate: 2220000,
  },
  {
    id: '9m3',
    volumeText: '9 mÂ³',
    volumeNumber: 9,
    capacityText: '54 boxes (Studio)',
    image: size9m3Img,
    dimensions: '2.8m Ã— 1.2m Ã— Cao 2.7m',
    areaM2: 3.4,
    fitsDetailed: ['ToÃ n bá»™ Ä‘á»“ Ä‘áº¡c cÄƒn há»™ studio', 'Sofa chá»¯ L, tá»§ láº¡nh side-by-side', 'MÃ¡y giáº·t, giÆ°á»ng ná»‡m, bÃ n Äƒn', '50+ ThÃ¹ng carton tÃ i sáº£n'],
    nonAcRate: 2100000,
    acRate: 2520000,
  },
  {
    id: '10m3',
    volumeText: '10 mÂ³',
    volumeNumber: 10,
    capacityText: '60 boxes (1 phÃ²ng ngá»§)',
    image: size9m3Img,
    dimensions: '3.0m Ã— 1.3m Ã— Cao 2.7m',
    areaM2: 3.8,
    fitsDetailed: ['ToÃ n bá»™ ná»™i tháº¥t cÄƒn há»™ 1 phÃ²ng ngá»§', 'GiÆ°á»ng King-size + Ná»‡m cao su', 'Tá»§ lá»›n 4 cÃ¡nh, bÃ n trang Ä‘iá»ƒm', '60+ ThÃ¹ng Ä‘á»“ gia dá»¥ng vÃ  thiáº¿t bá»‹'],
    nonAcRate: 2300000,
    acRate: 2760000,
  },
  {
    id: '12m3',
    volumeText: '12 mÂ³',
    volumeNumber: 12,
    capacityText: '72 boxes (1â€“2 phÃ²ng ngá»§)',
    image: size8m3Img,
    dimensions: '3.5m Ã— 1.3m Ã— Cao 2.7m',
    areaM2: 4.5,
    fitsDetailed: ['ToÃ n bá»™ ná»™i tháº¥t cÄƒn há»™ 2 phÃ²ng ngá»§', '2 Bá»™ giÆ°á»ng tá»§, bá»™ bÃ n Äƒn 6 gháº¿', 'Tá»§ láº¡nh lá»›n, mÃ¡y giáº·t, mÃ¡y sáº¥y', '70+ ThÃ¹ng carton Ä‘á»“ Ä‘áº¡c gia Ä‘Ã¬nh'],
    nonAcRate: 2700000,
    acRate: 3240000,
  },
  {
    id: '14m3',
    volumeText: '14 mÂ³',
    volumeNumber: 14,
    capacityText: '85 boxes (CÄƒn há»™ 2PN lá»›n)',
    image: size9m3Img,
    dimensions: '3.8m Ã— 1.4m Ã— Cao 2.7m',
    areaM2: 5.2,
    fitsDetailed: ['Äá»“ Ä‘áº¡c chung cÆ° 2 phÃ²ng ngá»§ cao cáº¥p', 'Sofa da cá»¡ Ä‘áº¡i, 2 tá»§ quáº§n Ã¡o ká»‹ch tráº§n', 'Thiáº¿t bá»‹ sá»± kiá»‡n, mÃ¡y pha cafe cÃ´ng nghiá»‡p', '85+ ThÃ¹ng hÃ ng hÃ³a lÆ°u kho'],
    nonAcRate: 3100000,
    acRate: 3720000,
  },
  {
    id: '16m3',
    volumeText: '16.8 mÂ³',
    volumeNumber: 16.8,
    capacityText: '100 boxes (CÄƒn há»™ 3PN)',
    image: size8m3Img,
    dimensions: '3.0m Ã— 2.0m Ã— 2.8m',
    areaM2: 6.0,
    fitsDetailed: ['Ná»™i tháº¥t chuyá»ƒn nhÃ  nguyÃªn cÄƒn há»™ 3PN', '3 Bá»™ giÆ°á»ng ná»‡m, bÃ n Äƒn 8 ngÆ°á»i', 'Ná»™i tháº¥t phÃ²ng khÃ¡ch, báº¿p Ä‘áº§y Ä‘á»§', '100+ ThÃ¹ng hÃ ng kinh doanh online'],
    nonAcRate: 3500000,
    acRate: 4200000,
  },
  {
    id: '18m3',
    volumeText: '18 mÂ³',
    volumeNumber: 18,
    capacityText: '115 boxes (Kho sá»‰ thÆ°Æ¡ng máº¡i)',
    image: size9m3Img,
    dimensions: '4.5m Ã— 1.5m Ã— Cao 2.7m',
    areaM2: 6.8,
    fitsDetailed: ['Kho hÃ ng sá»‰ thÆ°Æ¡ng máº¡i Ä‘iá»‡n tá»­', '2-3 Pallet hÃ ng xuáº¥t nháº­p kháº©u', 'BÃ n gháº¿ vÄƒn phÃ²ng cho 10-15 nhÃ¢n sá»±', '115+ ThÃ¹ng carton Ä‘Ã³ng kiá»‡n tiÃªu chuáº©n'],
    nonAcRate: 3900000,
    acRate: 4680000,
  },
  {
    id: '20m3',
    volumeText: '20 mÂ³',
    volumeNumber: 20,
    capacityText: '130 boxes (Kho doanh nghiá»‡p)',
    image: size8m3Img,
    dimensions: '5.0m Ã— 1.5m Ã— Cao 2.7m',
    areaM2: 7.5,
    fitsDetailed: ['HÃ ng hÃ³a phÃ¢n phá»‘i quy mÃ´ doanh nghiá»‡p vá»«a', '3-4 Pallet hÃ ng cÃ´ng nghiá»‡p, mÃ¡y mÃ³c', 'TÃ i liá»‡u há»“ sÆ¡ doanh nghiá»‡p lÆ°u trá»¯ 10 nÄƒm', '130+ ThÃ¹ng carton táº£i trá»ng náº·ng'],
    nonAcRate: 4300000,
    acRate: 5160000,
  },
  {
    id: '70m3',
    typeName: 'Ráº¥t lá»›n (vÄƒn phÃ²ng thÆ°Æ¡ng máº¡i)',
    volumeText: '70 mÂ³',
    volumeNumber: 70,
    capacityText: '160 boxes (Kho logistics lá»›n)',
    image: size9m3Img,
    dimensions: '5.0m Ã— 4.0m Ã— 3.5m',
    areaM2: 20.0,
    fitsDetailed: ['Kho logistics, thÆ°Æ¡ng máº¡i lá»›n & vÄƒn phÃ²ng', 'ToÃ n bá»™ trang thiáº¿t bá»‹ vÄƒn phÃ²ng lá»›n', 'Pallet hÃ ng hÃ³a thÆ°Æ¡ng máº¡i quy mÃ´ lá»›n', '160+ ThÃ¹ng carton Ä‘Ã³ng kiá»‡n tiÃªu chuáº©n'],
    nonAcRate: 5000000,
    acRate: 6000000,
  },
  {
    id: '24m3',
    volumeText: '24 mÂ³',
    volumeNumber: 24,
    capacityText: '160 boxes (Kho logistics lá»›n)',
    image: size9m3Img,
    dimensions: '6.0m Ã— 1.5m Ã— Cao 2.7m',
    areaM2: 9.0,
    fitsDetailed: ['Kho trung chuyá»ƒn bÃ¡n láº» & logistics', 'Ná»™i tháº¥t toÃ n bá»™ biá»‡t thá»± nhÃ  phá»‘', '5+ Pallet hÃ ng hÃ³a vÃ  thiáº¿t bá»‹ sÃ¢n kháº¥u', '160+ ThÃ¹ng carton cá»“ng ká»nh'],
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
  formatDateDDMMYYYY,
} from '../../utils/checkInTimeSlots'

export { CHECK_IN_PERIOD_GROUPS, CHECK_IN_HOURS_24, formatDateDDMMYYYY }

export const resolveUnitTypeIdForSelectedSize = (size: StorageSizeUnitDef): string => {
  if (size.dbUnitTypeId) {
    return size.dbUnitTypeId
  }
  if (size.id.includes('cold') || size.id === '14m3' || (size.areaM2 >= 4.5 && size.areaM2 <= 5.5)) {
    return '10000000-0000-0000-0000-000000000005' // Cold Storage (kiá»ƒm soÃ¡t nhiá»‡t Ä‘á»™ 18-22Â°C) - 5mÂ²
  }
  if (size.id === '1m3' || size.id === '2m3' || size.areaM2 <= 1.5) {
    return '10000000-0000-0000-0000-000000000001' // Mini (tá»§ cÃ¡ nhÃ¢n) - 1mÂ²
  }
  if (size.id === '8m3' || (size.areaM2 > 1.5 && size.areaM2 <= 3.5)) {
    return '10000000-0000-0000-0000-000000000002' // Medium (Compact Studio) - 3mÂ²
  }
  if (size.id === '16m3' || (size.areaM2 > 5.5 && size.areaM2 <= 7.0)) {
    return '10000000-0000-0000-0000-000000000003' // Standard (1-Bedroom) - 6mÂ²
  }
  return '10000000-0000-0000-0000-000000000004' // Extra Large (Commercial Suite) - 12mÂ²
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

  // User role & customer rental access state
  const userRole = (user?.role?.name || (user as any)?.roleName || (user as any)?.role || '').toUpperCase()
  const isCustomer = userRole === 'CUSTOMER' || userRole === 'ROLE_CUSTOMER'
  const isStaffOrManager = ['ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF', 'ROLE_ADMIN', 'ROLE_BUSINESS_MANAGER', 'ROLE_FACILITY_MANAGER', 'ROLE_STAFF'].includes(userRole)

  const getRoleDisplayName = (role?: string) => {
    const r = (role || userRole || '').toUpperCase()
    if (r.includes('ADMIN')) return 'Quáº£n trá»‹ viÃªn (Admin)'
    if (r.includes('BUSINESS')) return 'Quáº£n lÃ½ kinh doanh (Business Manager)'
    if (r.includes('FACILITY')) return 'Quáº£n lÃ½ cÆ¡ sá»Ÿ (Facility Manager)'
    if (r.includes('STAFF')) return 'NhÃ¢n viÃªn cÆ¡ sá»Ÿ (Staff)'
    return 'Quáº£n trá»‹ / NhÃ¢n viÃªn'
  }

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
  // Step 1: Chá»n cÆ¡ sá»Ÿ
  // Step 2: Chá»n kho / loáº¡i kho
  // Step 3: Thá»i háº¡n thuÃª & BÃ¡o giÃ¡
  // Step 4: Lá»‹ch háº¹n & Chi tiáº¿t
  // Step 5: Há»£p Ä‘á»“ng & Thanh toÃ¡n
  // Step 6: HoÃ n táº¥t giá»¯ chá»—
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1)
  const [paymentMethod, setPaymentMethod] = useState<'ONLINE' | 'PAY_LATER'>('ONLINE')
  const [isOnlinePaid, setIsOnlinePaid] = useState<boolean>(false)
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false)

  // Data
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [storageUnits, setStorageUnits] = useState<StorageUnit[]>([])
  const [dbUnitTypes, setDbUnitTypes] = useState<UnitType[]>([])
  const [loadingData, setLoadingData] = useState<boolean>(true)

  // Step 1: Facility Selection
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null)
  const [facilityPolicy, setFacilityPolicy] = useState<FacilityPolicy | null>(null)
  const [customDiscounts, setCustomDiscounts] = useState<CustomDiscount[]>([])

  const loadCustomDiscounts = useCallback(() => {
    const facId =
      selectedFacility?.id ||
      localStorage.getItem('boxora_selected_facility_id') ||
      sessionStorage.getItem('boxora_selected_facility_id') ||
      localStorage.getItem('boxora_admin_selected_facility_id')
    const active = customDiscountService.getActiveDiscounts(facId)
    setCustomDiscounts(active)
  }, [selectedFacility?.id])

  useEffect(() => {
    loadCustomDiscounts()
    if (!selectedFacility?.id) {
      setFacilityPolicy(null)
      return
    }
    let isCancelled = false
    const loadPolicy = async () => {
      try {
        const pol = await facilityPolicyService.getByFacilityId(selectedFacility.id)
        if (!isCancelled && pol) {
          setFacilityPolicy(pol)
        }
      } catch (err) {
        console.warn('Could not load facility policy:', err)
      }
    }
    void loadPolicy()

    const handleDiscountsUpdated = () => {
      loadCustomDiscounts()
      void loadPolicy()
    }
    window.addEventListener('boxora_custom_discounts_updated', handleDiscountsUpdated)
    window.addEventListener('boxora_facility_unittypes_updated', handleDiscountsUpdated)
    window.addEventListener('storage', handleDiscountsUpdated)
    window.addEventListener('focus', handleDiscountsUpdated)

    return () => {
      isCancelled = true
      window.removeEventListener('boxora_custom_discounts_updated', handleDiscountsUpdated)
      window.removeEventListener('boxora_facility_unittypes_updated', handleDiscountsUpdated)
      window.removeEventListener('storage', handleDiscountsUpdated)
      window.removeEventListener('focus', handleDiscountsUpdated)
    }
  }, [selectedFacility?.id, loadCustomDiscounts])

  // Also ensure custom discounts are fresh when entering Step 3
  useEffect(() => {
    if (currentStep === 3) {
      loadCustomDiscounts()
    }
  }, [currentStep, loadCustomDiscounts])

  const facilityDiscount3M = Number(facilityPolicy?.discount3MonthPercent ?? 5)
  const facilityDiscount6M = Number(facilityPolicy?.discount6MonthPercent ?? 10)
  const facilityDiscount12M = Number(facilityPolicy?.discount12MonthPercent ?? 15)

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

  // Category filter state for sizes in Step 2 (Task: 5 standardized volume ranges)
  type SizeCategoryTab = 'ALL' | 'PERSONAL' | 'FAMILY' | 'ENTERPRISE' | 'LOGISTICS'
  type PreservationFilterType = 'ALL' | 'AC' | 'NON_AC'
  type StockStatusFilterType = 'ALL' | 'AVAILABLE' | 'OUT_OF_STOCK'
  type AreaFilterType = 'ALL' | 'LE_3' | '3_TO_6' | 'GT_6'

  const [sizeFilterCategory, setSizeFilterCategory] = useState<SizeCategoryTab>('ALL')
  const [preservationFilter, setPreservationFilter] = useState<PreservationFilterType>('ALL')
  const [stockStatusFilter, setStockStatusFilter] = useState<StockStatusFilterType>('ALL')
  const [areaFilter, setAreaFilter] = useState<AreaFilterType>('ALL')
  const [sizeVisualMode, setSizeVisualMode] = useState<'3D' | 'PHOTO'>('3D')
  const [userForced3DMode, setUserForced3DMode] = useState<boolean>(false)
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
  const [idCardType, setIdCardType] = useState<IdCardType>('CCCD')
  const [customerIdCard, setCustomerIdCard] = useState<string>('')
  const [bookingCccd, setBookingCccd] = useState<string>('')
  const [bookingPassport, setBookingPassport] = useState<string>('')
  const [customerEmail, setCustomerEmail] = useState<string>('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Automatically pre-fill customer info when user is loaded
  useEffect(() => {
    if (user) {
      const pName = user.fullName || user.username || ''
      if (pName) {
        setCustomerName((prev) => (prev && prev !== 'KhÃ¡ch hÃ ng' ? prev : pName))
      }
      const pPhone = user.phone || (user as any).phoneNumber || ''
      if (pPhone) {
        setCustomerPhone((prev) => (prev ? prev : pPhone))
      }
      if (user.email) {
        setCustomerEmail((prev) => (prev ? prev : user.email))
      }
      const doc = loadUserSavedIdDoc(user)
      setBookingCccd(doc.cccd)
      setBookingPassport(doc.passport)
      setIdCardType(doc.preferredType)
      const targetNumber = doc.preferredType === 'CCCD' ? doc.cccd : doc.passport
      setCustomerIdCard((prev) => (prev ? prev : targetNumber))
    }
  }, [user])

  // Listen to profile updates (e.g. user updated CCCD or Passport in AccountProfileModal)
  useEffect(() => {
    const handleIdUpdated = () => {
      if (user) {
        const doc = loadUserSavedIdDoc(user)
        setBookingCccd(doc.cccd)
        setBookingPassport(doc.passport)
        setIdCardType(doc.preferredType)
        setCustomerIdCard(doc.preferredType === 'CCCD' ? doc.cccd : doc.passport)
      }
    }
    window.addEventListener('boxora_id_document_updated', handleIdUpdated)
    return () => window.removeEventListener('boxora_id_document_updated', handleIdUpdated)
  }, [user])

  // Step 5 & 6: Submission & Result
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [bookingCode, setBookingCode] = useState<string>('')
  const [copiedCode, setCopiedCode] = useState<boolean>(false)
  const [showPayLaterConfirmModal, setShowPayLaterConfirmModal] = useState<boolean>(false)

  // Cancellation Policy confirmation state (XÃ¡c nháº­n Ä‘iá»u khoáº£n há»§y trÆ°á»›c khi má»Ÿ DocuSeal)
  const [showPolicyConfirmModal, setShowPolicyConfirmModal] = useState<boolean>(false)
  const [policyDetail, setPolicyDetail] = useState<CancellationPolicyDetail | null>(null)
  const [isLoadingPolicy, setIsLoadingPolicy] = useState<boolean>(false)
  const [policyError, setPolicyError] = useState<string | null>(null)
  const [isConfirmingPolicy, setIsConfirmingPolicy] = useState<boolean>(false)

  // DocuSeal e-Signing state (BÆ°á»›c 2: KÃ½ há»£p Ä‘á»“ng trá»±c tuyáº¿n trÆ°á»›c khi thanh toÃ¡n)
  const [showDocuSealModal, setShowDocuSealModal] = useState<boolean>(false)
  const [contractForSigning, setContractForSigning] = useState<RentalContract | null>(null)
  const [createdBookingForSigning, setCreatedBookingForSigning] = useState<any>(null)
  const [hasSignedContract, setHasSignedContract] = useState<boolean>(false)
  const [contractInvalidatedByChange, setContractInvalidatedByChange] = useState<boolean>(false)
  const [signingFormSnapshot, setSigningFormSnapshot] = useState<{
    facilityId: string
    sizeId: string
    isAc: boolean
    durationMode: string
    rentalMonths: number
    customDays: number
    startDate: string
    checkInDate: string
    selectedPeriodId: string
    customerName: string
    customerPhone: string
    customerEmail: string
    customerIdCard: string
    idCardType: string
  } | null>(null)

  // Listen to BFCache / page navigation returns so isSubmitting is never permanently stuck
  useEffect(() => {
    const handlePageShow = () => {
      setIsSubmitting(false)
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  useEffect(() => {
    setIsSubmitting(false)
  }, [currentStep])

  // Load backend data
  useEffect(() => {
    let isMounted = true
    setLoadingData(true)

    Promise.allSettled([
      facilityService.getFacilities({ page: 0, size: 50, status: 'ACTIVE' }),
      storageUnitService.getUnits({ status: 'AVAILABLE' }),
      storageUnitService.getUnitTypes(),
    ])
      .then(([facRes, unitRes, utRes]) => {
        if (!isMounted) return

        let activeList: Facility[] = []
        if (facRes.status === 'fulfilled' && Array.isArray(facRes.value?.content)) {
          activeList = facRes.value.content.filter(
            (f) => f.status === 'ACTIVE' || (!f.status && (f as any).isActive !== false)
          )
          setFacilities(activeList)
        }

        const freshUnits = (unitRes.status === 'fulfilled' && Array.isArray(unitRes.value)) ? unitRes.value : []
        if (freshUnits.length > 0) {
          setStorageUnits(freshUnits)
        }
        if (utRes && utRes.status === 'fulfilled' && Array.isArray(utRes.value)) {
          setDbUnitTypes(utRes.value)
        }

        const savedFacId =
          localStorage.getItem('boxora_selected_facility_id') ||
          sessionStorage.getItem('boxora_selected_facility_id')
        const facParam = searchParams.get('facility')

        // Restore draft from sessionStorage or localStorage if exists (Task 2: Guest Flow Persistence)
        try {
          const draftStr = sessionStorage.getItem('boxora_booking_draft') || localStorage.getItem('boxora_booking_draft')
          if (draftStr) {
            const draft = JSON.parse(draftStr)
            const targetFacId = facParam || draft.facilityId || savedFacId
            let matchedFac = targetFacId
              ? activeList.find((f) =>
                  String(f.id) === String(targetFacId) ||
                  (f.code && f.code.toLowerCase() === String(targetFacId).toLowerCase()) ||
                  (f.name && f.name.toLowerCase().includes(String(targetFacId).toLowerCase()))
                )
              : undefined
            if (!matchedFac && draft.facilityName) {
              matchedFac = activeList.find((f) => 
                f.name?.toLowerCase().trim() === draft.facilityName.toLowerCase().trim() ||
                f.name?.toLowerCase().includes(draft.facilityName.toLowerCase()) ||
                draft.facilityName.toLowerCase().includes(f.name?.toLowerCase() || '')
              )
            }
            if (!matchedFac && draft.facilityCode) {
              matchedFac = activeList.find((f) => f.code?.toLowerCase() === draft.facilityCode.toLowerCase())
            }

            if (matchedFac) {
              setSelectedFacility(matchedFac)
              localStorage.setItem('boxora_selected_facility_id', matchedFac.id)
            } else if (activeList.length > 0) {
              // Priority: First facility that actually has AVAILABLE storage units > 0
              const facWithUnits = activeList.find((f) => {
                return freshUnits.filter((u: any) => u.facilityId === f.id && (u.status === 'AVAILABLE' || (u.status as string) === 'Trá»‘ng')).length > 0
              })
              const chosen = facWithUnits || activeList[0]
              setSelectedFacility(chosen)
              if (chosen) localStorage.setItem('boxora_selected_facility_id', chosen.id)
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
              const pName = user?.fullName || user?.username || draft.customerName || ''
              if (pName) setCustomerName(pName)
              const pPhone = user?.phone || (user as any)?.phoneNumber || draft.customerPhone || ''
              if (pPhone) setCustomerPhone(pPhone)
              if (user?.email || draft.customerEmail) setCustomerEmail(user?.email || draft.customerEmail)
              const doc = loadUserSavedIdDoc(user)
              setBookingCccd(doc.cccd)
              setBookingPassport(doc.passport)
              const chosenType: IdCardType = (draft.idCardType as IdCardType) || doc.preferredType
              setIdCardType(chosenType)
              const chosenNum = chosenType === 'CCCD' ? (doc.cccd || draft.customerIdCard || '') : (doc.passport || draft.customerIdCard || '')
              if (chosenNum) {
                setCustomerIdCard(chosenNum)
              }
              setCurrentStep(4)
            }
            return
          }
        } catch (e) {
          console.warn('Draft restoration error:', e)
        }

        // When no draft exists: determine default facility
        let defaultFac: Facility | undefined = undefined
        if (facParam && activeList.length > 0) {
          defaultFac = activeList.find(
            (f) =>
              f.id === facParam ||
              (f.code && f.code.toLowerCase() === facParam.toLowerCase()) ||
              (f.name && f.name.toLowerCase().includes(facParam.toLowerCase()))
          )
        }
        if (!defaultFac && savedFacId && activeList.length > 0) {
          defaultFac = activeList.find((f) => String(f.id) === String(savedFacId))
        }
        if (!defaultFac && activeList.length > 0) {
          // Choose first facility that actually has AVAILABLE storage units > 0
          defaultFac = activeList.find((f) => {
            return freshUnits.filter((u: any) => u.facilityId === f.id && (u.status === 'AVAILABLE' || (u.status as string) === 'Trá»‘ng')).length > 0
          }) || activeList[0]
        }

        if (defaultFac) {
          setSelectedFacility(defaultFac)
          localStorage.setItem('boxora_selected_facility_id', defaultFac.id)
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
    // CRITICAL: MUST WAIT UNTIL FACILITIES ARE LOADED SO FACILITY ID IS NEVER LOST
    if (isAuthenticated && facilities.length > 0) {
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

          const targetFacId = draft.facilityId || localStorage.getItem('boxora_selected_facility_id') || sessionStorage.getItem('boxora_selected_facility_id')
          let matched: Facility | undefined = undefined
          if (targetFacId) {
            matched = facilities.find((f) => String(f.id) === String(targetFacId))
          }
          if (!matched && draft.facilityName) {
            matched = facilities.find((f) => 
              f.name?.toLowerCase().trim() === draft.facilityName.toLowerCase().trim() ||
              f.name?.toLowerCase().includes(draft.facilityName.toLowerCase()) ||
              draft.facilityName.toLowerCase().includes(f.name?.toLowerCase() || '')
            )
          }
          if (!matched && draft.facilityCode) {
            matched = facilities.find((f) => f.code?.toLowerCase() === draft.facilityCode.toLowerCase())
          }
          if (matched) {
            setSelectedFacility(matched)
            localStorage.setItem('boxora_selected_facility_id', matched.id)
          }

          // Pre-fill profile info
          const pName = user?.fullName || user?.username || draft.customerName || ''
          if (pName) setCustomerName(pName)
          const pPhone = user?.phone || (user as any)?.phoneNumber || draft.customerPhone || ''
          if (pPhone) setCustomerPhone(pPhone)
          if (user?.email || draft.customerEmail) setCustomerEmail(user?.email || draft.customerEmail)
          const doc = loadUserSavedIdDoc(user)
          setBookingCccd(doc.cccd)
          setBookingPassport(doc.passport)
          const chosenType: IdCardType = (draft.idCardType as IdCardType) || doc.preferredType
          setIdCardType(chosenType)
          const chosenNum = chosenType === 'CCCD' ? (doc.cccd || draft.customerIdCard || '') : (doc.passport || draft.customerIdCard || '')
          if (chosenNum) setCustomerIdCard(chosenNum)

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
    return facilities
      .filter((fac) => fac.status === 'ACTIVE' || (!fac.status && (fac as any).isActive !== false))
      .map((fac) => {
      const unitsInFac = storageUnits.filter((u) => u.facilityId === fac.id)
      const availableCount = unitsInFac.filter(
        (u) => u.status === 'AVAILABLE' || (u.status as string) === 'Trá»‘ng'
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

    // Äá»c cÃ¡c Ä‘Æ¡n Ä‘áº·t giá»¯ chá»— Ä‘ang chiáº¿m giá»¯ buá»“ng kho
    const localReservedUnitIds = new Set<string>()
    const localReservedUnitCodes = new Set<string>()
    try {
      const raw = localStorage.getItem('boxora_guest_reservations')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          parsed.forEach((r: any) => {
            const isHolding = r.status !== 'CANCELLED' && r.status !== 'COMPLETED' && r.status !== 'REJECTED'
            if (isHolding) {
              if (r.storageUnitId) localReservedUnitIds.add(r.storageUnitId)
              if (r.unitCode) localReservedUnitCodes.add(r.unitCode)
            }
          })
        }
      }
    } catch {}

    return storageUnits.filter(
      (u) =>
        u.facilityId === selectedFacility.id &&
        (u.status === 'AVAILABLE' || (u.status as string) === 'Trá»‘ng') &&
        !localReservedUnitIds.has(u.id) &&
        !localReservedUnitCodes.has(u.unitCode) &&
        (() => {
          if (!u.unitTypeId) return true
          const dbType = dbUnitTypes.find((ut) => ut.id === u.unitTypeId)
          return !dbType || dbType.isActive !== false
        })()
    )
  }, [storageUnits, selectedFacility, dbUnitTypes])

  // Láº¯ng nghe sá»± kiá»‡n toÃ n há»‡ thá»‘ng Ä‘á»ƒ tá»± Ä‘á»™ng Ä‘á»“ng bá»™ sá»‘ lÆ°á»£ng kho kháº£ dá»¥ng thá»i gian thá»±c
  const refreshAvailableUnits = useCallback(async () => {
    try {
      const [unitRes, facRes, typeRes] = await Promise.allSettled([
        storageUnitService.getUnits({ status: 'AVAILABLE' }),
        facilityService.getFacilities({ size: 100 }),
        storageUnitService.getUnitTypes(),
      ])
      if (unitRes.status === 'fulfilled') {
        const list = Array.isArray(unitRes.value) ? unitRes.value : ((unitRes.value as any)?.content || [])
        if (Array.isArray(list)) {
          setStorageUnits(list)
        }
      }
      if (facRes.status === 'fulfilled' && Array.isArray(facRes.value?.content)) {
        const activeList = facRes.value.content.filter(
          (f) => f.status === 'ACTIVE' || (!f.status && (f as any).isActive !== false)
        )
        if (activeList.length > 0) {
          setFacilities(activeList)
          setSelectedFacility((prev) => (prev ? activeList.find((f) => f.id === prev.id) || prev : activeList[0]))
        }
      }
      if (typeRes.status === 'fulfilled' && Array.isArray(typeRes.value) && typeRes.value.length > 0) {
        setDbUnitTypes(typeRes.value)
      }
      if (selectedFacility?.id) {
        facilityPolicyService
          .getByFacilityId(selectedFacility.id)
          .then((pol) => {
            if (pol) setFacilityPolicy(pol)
          })
          .catch(() => {})
        loadCustomDiscounts()
      }
    } catch (e) {
      console.warn('Refresh available units error:', e)
    }
  }, [selectedFacility?.id, loadCustomDiscounts])

  useRealtimeSync(() => {
    void refreshAvailableUnits()
  }, { intervalMs: 3000 })

  useEffect(() => {
    if (currentStep === 2) {
      refreshAvailableUnits()
    }
  }, [currentStep, refreshAvailableUnits])

  // Real sizes that exist and are available in the selected facility
  const availableSizesInFacility = useMemo(() => {
    // Process units in the selected facility
    const facilityUnits = selectedFacility ? storageUnits.filter(u => u.facilityId === selectedFacility.id) : []
    if (facilityUnits.length === 0 && availableFacilityUnits.length === 0) return []

    const unitsSource = facilityUnits.length > 0 ? facilityUnits : availableFacilityUnits
    const matchedSizes: StorageSizeUnitDef[] = []
    const processedKeys = new Set<string>()

    const facilityUnitTypes = selectedFacility?.id
      ? facilityUnitTypeService.getFacilityUnitTypes(selectedFacility.id, dbUnitTypes, facilityPolicy)
      : dbUnitTypes

    unitsSource.forEach((unit) => {
      // 1. Try to find matching unit type in facilityUnitTypes
      const dbType = facilityUnitTypes.find((ut) => ut.id === unit.unitTypeId)
      if (dbType && dbType.isActive === false) {
        return // Bá» qua loáº¡i kho Ä‘ang táº¡m ngÆ°ng hoáº¡t Ä‘á»™ng táº¡i cÆ¡ sá»Ÿ nÃ y
      }
      const dbTypeByName = !dbType && unit.unitTypeName ? facilityUnitTypes.find((ut) => ut.typeName.toLowerCase() === unit.unitTypeName.toLowerCase()) : null
      if (dbTypeByName && dbTypeByName.isActive === false) {
        return // Bá» qua loáº¡i kho Ä‘ang táº¡m ngÆ°ng hoáº¡t Ä‘á»™ng táº¡i cÆ¡ sá»Ÿ nÃ y
      }

      const targetType = dbType || dbTypeByName
      const key = targetType ? targetType.id : (unit.unitTypeName || `${unit.areaSqMeters}m2`)
      if (processedKeys.has(key)) return
      processedKeys.add(key)

      // Try to find a matching static catalog item
      let matchedCatalog = STORAGE_SIZES_CATALOG.find((s) => {
        if (targetType && (targetType.volumeM3 === s.volumeNumber || Math.abs((targetType.areaSqm || 0) - s.areaM2) < 0.5)) return true
        const name = (unit.unitTypeName || '').toLowerCase()
        if (name.includes(s.id)) return true
        return unit.areaSqMeters && Math.abs(unit.areaSqMeters - s.areaM2) < 0.6
      })

      if (targetType) {
        const vol = targetType.volumeM3 != null ? Number(targetType.volumeM3) : (matchedCatalog ? matchedCatalog.volumeNumber : Math.round((targetType.areaSqm || unit.areaSqMeters || 1) * 3))
        const area = targetType.areaSqm != null ? Number(targetType.areaSqm) : (matchedCatalog ? matchedCatalog.areaM2 : (unit.areaSqMeters || 1))
        const dims = targetType.dimensions || (matchedCatalog ? matchedCatalog.dimensions : `${targetType.lengthM || 2}m Ã— ${targetType.widthM || 1.5}m Ã— ${targetType.heightM || 2.6}m`)
        const cap = matchedCatalog ? matchedCatalog.capacityText : `${Math.round(area * 8)} boxes`
        const name = targetType.typeName || (matchedCatalog ? matchedCatalog.typeName : 'Kho tiÃªu chuáº©n')
        const hasAc = targetType.acPricePerMonth != null && Number(targetType.acPricePerMonth) > 0
        const nonAcRate = Number(targetType.basePricePerMonth || (matchedCatalog ? matchedCatalog.nonAcRate : 5000000))
        const acRate = hasAc ? Number(targetType.acPricePerMonth) : 0

        matchedSizes.push({
          ...(matchedCatalog || STORAGE_SIZES_CATALOG[0]),
          id: targetType.id,
          dbUnitTypeId: targetType.id,
          typeName: name,
          volumeText: `${vol} mÂ³`,
          volumeNumber: vol,
          capacityText: cap,
          image: targetType?.imageUrl || dbType?.imageUrl || (vol >= 24 ? STORAGE_SIZES_CATALOG[STORAGE_SIZES_CATALOG.length - 1].image : (matchedCatalog?.image || STORAGE_SIZES_CATALOG[0].image)),
          imageUrl: targetType?.imageUrl || dbType?.imageUrl || undefined,
          dimensions: dims,
          areaM2: area,
          fitsDetailed: [
            name || 'Kho tiÃªu chuáº©n',
            `Diá»‡n tÃ­ch sÃ n: ${area} mÂ² Â· Thá»ƒ tÃ­ch: ${vol} mÂ³`,
            `KÃ­ch thÆ°á»›c: ${dims}`,
            'Báº£o quáº£n an ninh 24/7 vá»›i kiá»ƒm soÃ¡t Ä‘á»™ áº©m vÃ  camera thÃ´ng minh',
          ],
          nonAcRate,
          acRate,
          hasAc,
        })
      } else if (matchedCatalog) {
        matchedSizes.push({
          ...matchedCatalog,
          hasAc: matchedCatalog.acRate > 0,
        })
      }
    })

    return matchedSizes.sort((a, b) => a.volumeNumber - b.volumeNumber)
  }, [selectedFacility, storageUnits, availableFacilityUnits, dbUnitTypes, facilityPolicy])

  // Count available units for a size in the selected facility
  const getAvailableCountForSize = (sizeUnit: StorageSizeUnitDef) => {
    return availableFacilityUnits.filter((u) => {
      if (sizeUnit.dbUnitTypeId && u.unitTypeId === sizeUnit.dbUnitTypeId) return true
      if (sizeUnit.id && u.unitTypeId === sizeUnit.id) return true
      return false
    }).length
  }

  // Filter sizes based on 5 standardized volume categories and multi-criteria filters
  const filteredSizesCatalog = useMemo(() => {
    const source = availableSizesInFacility.length > 0 ? availableSizesInFacility : []
    return source.filter((s) => {
      // 1. Volume filter:
      // ALL: Táº¥t cáº£
      // PERSONAL: CÃ¡ nhÃ¢n & Mini: <= 4 mÂ³
      // FAMILY: Gia Ä‘Ã¬nh: > 4 vÃ  <= 10 mÂ³
      // ENTERPRISE: Doanh nghiá»‡p: > 10 vÃ  <= 25 mÂ³
      // LOGISTICS: Logistics: > 25 mÂ³
      if (sizeFilterCategory === 'PERSONAL' && s.volumeNumber > 4) return false
      if (sizeFilterCategory === 'FAMILY' && (s.volumeNumber <= 4 || s.volumeNumber > 10)) return false
      if (sizeFilterCategory === 'ENTERPRISE' && (s.volumeNumber <= 10 || s.volumeNumber > 25)) return false
      if (sizeFilterCategory === 'LOGISTICS' && s.volumeNumber <= 25) return false

      // 2. Area filter (mÂ²)
      if (areaFilter === 'LE_3' && s.areaM2 > 3) return false
      if (areaFilter === '3_TO_6' && (s.areaM2 <= 3 || s.areaM2 > 6)) return false
      if (areaFilter === 'GT_6' && s.areaM2 <= 6) return false

      // 3. Stock Status filter
      const avail = getAvailableCountForSize(s)
      if (stockStatusFilter === 'AVAILABLE' && avail <= 0) return false
      if (stockStatusFilter === 'OUT_OF_STOCK' && avail > 0) return false

      // 4. Preservation Condition filter
      const unitAcMode = acSelectionMap[s.id] || 'NON_AC'
      const isClimateType = (s.typeName || '').toLowerCase().includes('láº¡nh') || (s.typeName || '').toLowerCase().includes('mÃ¡t')
      if (preservationFilter === 'AC' && unitAcMode !== 'AC' && !isClimateType) return false
      if (preservationFilter === 'NON_AC' && (unitAcMode === 'AC' || isClimateType)) return false

      return true
    })
  }, [availableSizesInFacility, sizeFilterCategory, areaFilter, stockStatusFilter, preservationFilter, acSelectionMap, availableFacilityUnits])

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
      localStorage.setItem('boxora_selected_facility_id', fac.id)
      sessionStorage.setItem('boxora_selected_facility_id', fac.id)
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
      const foundInFacility = availableSizesInFacility.find((s) => s.id === selectedSizeId)
      if (foundInFacility) return foundInFacility
      const foundInStatic = STORAGE_SIZES_CATALOG.find((s) => s.id === selectedSizeId)
      if (foundInStatic) return foundInStatic
    }
    if (availableSizesInFacility.length > 0) {
      return availableSizesInFacility[0]
    }
    return STORAGE_SIZES_CATALOG[2]
  }, [selectedSizeId, availableSizesInFacility])

  const isAcActive = Boolean(
    currentSelectedSize.hasAc !== false &&
    currentSelectedSize.acRate > 0 &&
    acSelectionMap[currentSelectedSize.id] === 'AC'
  )

  // Rental duration helpers & validation
  const isCustomDuration = durationMode === 'CUSTOM_DAYS'
  const isDurationValid = isCustomDuration
    ? typeof customDays === 'number' && customDays >= 7
    : rentalMonths >= 1

  const rentalDurationText = useMemo(() => {
    return isCustomDuration ? `${customDays} ngÃ y` : `${rentalMonths} thÃ¡ng`
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

  const maxActiveDiscountPercent = useMemo(() => {
    let maxPct = Math.max(facilityDiscount3M, facilityDiscount6M, facilityDiscount12M)
    customDiscounts.forEach((cd) => {
      if ((cd.isActive === true || String(cd.isActive) === 'true') && Number(cd.percent) > maxPct) {
        maxPct = Number(cd.percent)
      }
    })
    return maxPct
  }, [facilityDiscount3M, facilityDiscount6M, facilityDiscount12M, customDiscounts])

  const activeDurationOptions = useMemo(() => {
    return [
      { m: 1, label: '1 thÃ¡ng', badge: 'TiÃªu chuáº©n', sortOrder: 1 },
      { m: 3, label: '3 thÃ¡ng', badge: facilityDiscount3M > 0 ? `Tiáº¿t kiá»‡m ${facilityDiscount3M}%` : 'TiÃªu chuáº©n', sortOrder: 3 },
      { m: 6, label: '6 thÃ¡ng', badge: facilityDiscount6M > 0 ? `Tiáº¿t kiá»‡m ${facilityDiscount6M}%` : 'TiÃªu chuáº©n', sortOrder: 6 },
      { m: 12, label: '12 thÃ¡ng', badge: facilityDiscount12M > 0 ? `Tiáº¿t kiá»‡m ${facilityDiscount12M}%` : 'TiÃªu chuáº©n', sortOrder: 12 },
      ...customDiscounts
        .filter((cd) => (cd.isActive === true || String(cd.isActive) === 'true') && Number(cd.percent) > 0 && ![1, 3, 6, 12].includes(Number(cd.months)))
        .map((cd) => ({
          m: Number(cd.months),
          label: `${cd.months} thÃ¡ng`,
          badge: `Tiáº¿t kiá»‡m ${cd.percent}%`,
          sortOrder: Number(cd.months),
        })),
    ].sort((a, b) => a.sortOrder - b.sortOrder)
  }, [facilityDiscount3M, facilityDiscount6M, facilityDiscount12M, customDiscounts])

  const durationGridColsClass = useMemo(() => {
    const count = activeDurationOptions.length
    if (count <= 3) return 'grid-cols-2 sm:grid-cols-3'
    if (count === 4) return 'grid-cols-2 sm:grid-cols-4'
    if (count === 5) return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5'
    if (count === 6) return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-6'
    return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
  }, [activeDurationOptions.length])

  const getDynamicPriceForSize = useCallback((sizeUnit: StorageSizeUnitDef, isAc: boolean) => {
    const utId = resolveUnitTypeIdForSelectedSize(sizeUnit)
    const facilityUnitTypes = selectedFacility?.id
      ? facilityUnitTypeService.getFacilityUnitTypes(selectedFacility.id, dbUnitTypes, facilityPolicy)
      : dbUnitTypes
    const matchingUt = facilityUnitTypes.find((ut) => ut.id === utId)
    if (matchingUt && matchingUt.basePricePerMonth && matchingUt.basePricePerMonth > 0) {
      if (isAc && sizeUnit.hasAc !== false && matchingUt.acPricePerMonth != null && Number(matchingUt.acPricePerMonth) > 0) {
        return Number(matchingUt.acPricePerMonth)
      }
      return matchingUt.basePricePerMonth
    }
    const matchingUnit = availableFacilityUnits.find((u) => u.unitTypeId === utId && u.pricePerMonth && u.pricePerMonth > 0)
    if (matchingUnit?.pricePerMonth) {
      if (isAc && sizeUnit.hasAc !== false && sizeUnit.acRate > 0) {
        return sizeUnit.acRate
      }
      return matchingUnit.pricePerMonth
    }
    return isAc && sizeUnit.hasAc !== false && sizeUnit.acRate > 0 ? sizeUnit.acRate : sizeUnit.nonAcRate
  }, [availableFacilityUnits, dbUnitTypes, selectedFacility?.id, facilityPolicy])

  // Pricing calculation
  const quoteCalculation = useMemo(() => {
    const baseMonthly = getDynamicPriceForSize(currentSelectedSize, isAcActive)
    const dailyRate = Math.round(baseMonthly / 30)

    let discountPercent = 0
    if (isCustomDuration) {
      if (customDays >= 720) discountPercent = facilityDiscount12M
      else if (customDays >= 365) discountPercent = facilityDiscount12M
      else if (customDays >= 180) discountPercent = facilityDiscount6M
      else if (customDays >= 90) discountPercent = facilityDiscount3M
    } else {
      const customMatch = customDiscounts.find(
        (cd) => Number(cd.months) === Number(rentalMonths) && (cd.isActive === true || String(cd.isActive) === 'true')
      )
      if (customMatch && Number(customMatch.percent) > 0) {
        discountPercent = Number(customMatch.percent)
      } else if (rentalMonths === 12) {
        discountPercent = facilityDiscount12M
      } else if (rentalMonths === 6) {
        discountPercent = facilityDiscount6M
      } else if (rentalMonths === 3) {
        discountPercent = facilityDiscount3M
      } else if (rentalMonths >= 12) {
        discountPercent = facilityDiscount12M
      } else if (rentalMonths >= 6) {
        discountPercent = facilityDiscount6M
      } else if (rentalMonths >= 3) {
        discountPercent = facilityDiscount3M
      }
    }

    const discountAmountPerMonth = Math.round(baseMonthly * (discountPercent / 100))
    const monthlyAfterDiscount = baseMonthly - discountAmountPerMonth
    const rawRent = isCustomDuration ? dailyRate * Math.max(1, customDays) : baseMonthly * rentalMonths
    const discountAmount = Math.round(rawRent * (discountPercent / 100))
    const totalRent = isCustomDuration
      ? dailyRate * Math.max(1, customDays)
      : monthlyAfterDiscount * rentalMonths
    const depositPct = facilityPolicy?.depositPercentage != null ? Number(facilityPolicy.depositPercentage) : 100
    const depositAmount = Math.round(baseMonthly * (depositPct / 100))

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
  }, [currentSelectedSize, isAcActive, isCustomDuration, rentalMonths, customDays, getDynamicPriceForSize, facilityDiscount3M, facilityDiscount6M, facilityDiscount12M, customDiscounts, facilityPolicy])

  // Snapshot thÃ´ng tin khi kÃ½ há»£p Ä‘á»“ng DocuSeal Ä‘á»ƒ phÃ¡t hiá»‡n khi ngÆ°á»i dÃ¹ng quay láº¡i sá»­a thÃ´ng tin
  const captureSigningSnapshot = useCallback(() => ({
    facilityId: selectedFacility?.id || '',
    sizeId: currentSelectedSize.id,
    isAc: isAcActive,
    durationMode,
    rentalMonths,
    customDays,
    startDate,
    checkInDate,
    selectedPeriodId,
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim().replace(/[\s.-]/g, ''),
    customerEmail: customerEmail.trim().toLowerCase(),
    customerIdCard: customerIdCard.trim(),
    idCardType,
  }), [
    selectedFacility?.id,
    currentSelectedSize.id,
    isAcActive,
    durationMode,
    rentalMonths,
    customDays,
    startDate,
    checkInDate,
    selectedPeriodId,
    customerName,
    customerPhone,
    customerEmail,
    customerIdCard,
    idCardType,
  ])

  // Kiá»ƒm tra xem form hiá»‡n táº¡i cÃ³ khá»›p hoÃ n toÃ n vá»›i thÃ´ng tin cá»§a há»£p Ä‘á»“ng Ä‘Ã£ kÃ½ trÆ°á»›c Ä‘Ã³ hay khÃ´ng
  const isContractFormMatching = useMemo(() => {
    if (!signingFormSnapshot) return false
    return (
      signingFormSnapshot.facilityId === (selectedFacility?.id || '') &&
      signingFormSnapshot.sizeId === currentSelectedSize.id &&
      signingFormSnapshot.isAc === isAcActive &&
      signingFormSnapshot.durationMode === durationMode &&
      signingFormSnapshot.rentalMonths === rentalMonths &&
      signingFormSnapshot.customDays === customDays &&
      signingFormSnapshot.startDate === startDate &&
      signingFormSnapshot.checkInDate === checkInDate &&
      signingFormSnapshot.selectedPeriodId === selectedPeriodId &&
      signingFormSnapshot.customerName.toLowerCase() === customerName.trim().toLowerCase() &&
      signingFormSnapshot.customerPhone === customerPhone.trim().replace(/[\s.-]/g, '') &&
      signingFormSnapshot.customerEmail.toLowerCase() === customerEmail.trim().toLowerCase() &&
      signingFormSnapshot.customerIdCard === customerIdCard.trim() &&
      signingFormSnapshot.idCardType === idCardType
    )
  }, [
    signingFormSnapshot,
    selectedFacility?.id,
    currentSelectedSize.id,
    isAcActive,
    durationMode,
    rentalMonths,
    customDays,
    startDate,
    checkInDate,
    selectedPeriodId,
    customerName,
    customerPhone,
    customerEmail,
    customerIdCard,
    idCardType,
  ])

  // Náº¿u ngÆ°á»i dÃ¹ng quay láº¡i thay Ä‘á»•i báº¥t ká»³ thÃ´ng tin nÃ o (cÆ¡ sá»Ÿ, loáº¡i kho, thÃ¡ng thuÃª, khÃ¡ch hÃ ng, ngÃ y check-in),
  // tá»± Ä‘á»™ng há»§y há»£p Ä‘á»“ng cÅ© vÃ  reset tráº¡ng thÃ¡i kÃ½ Ä‘á»ƒ ngÆ°á»i dÃ¹ng kÃ½ há»£p Ä‘á»“ng má»›i
  useEffect(() => {
    if (signingFormSnapshot && !isContractFormMatching) {
      setHasSignedContract(false)
      setContractForSigning(null)
      setContractInvalidatedByChange(true)
      setCreatedBookingForSigning((prev: any) => prev ? { ...prev, contractSigned: false, status: 'PENDING_SIGNATURE', contractStatus: 'PENDING_SIGNATURE' } : prev)
      if (createdBookingForSigning?.id) {
        void bookingService.invalidateSignedContract(createdBookingForSigning.id).catch(() => {})
      }
      setSigningFormSnapshot(null)
    }
  }, [signingFormSnapshot, isContractFormMatching])

  const isContractAlreadySigned = Boolean(
    !contractInvalidatedByChange &&
    isContractFormMatching &&
    (hasSignedContract ||
      contractForSigning?.signedAt ||
      createdBookingForSigning?.contractSigned ||
      createdBookingForSigning?.status === 'SIGNED_PENDING_PAYMENT' ||
      createdBookingForSigning?.status === 'PAID_AND_SIGNED') &&
    createdBookingForSigning?.id
  )

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
    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ngÃ y ' + new Date().toLocaleDateString('vi-VN')
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
      unitTypeName: `Kho ${currentSelectedSize.volumeText} (${isAcActive ? 'A/C MÃ¡y láº¡nh' : 'ThÆ°á»ng'})`,
      dimensions: currentSelectedSize.dimensions,
      isAc: isAcActive,
      rentalDuration: rentalDurationText,
      checkInDate: checkInDate,
      checkInTime: checkInTime,
      startDate: startDate || checkInDate || new Date().toISOString().slice(0, 10),
      expectedCheckInAt: `${checkInDate || startDate || new Date().toISOString().slice(0, 10)}T${(checkInTime || '09:00').split(' - ')[0].trim().length === 5 ? (checkInTime || '09:00').split(' - ')[0].trim() + ':00' : '09:00:00'}`,
      totalRent: quoteCalculation.totalRent,
      depositAmount: quoteCalculation.depositAmount,
      totalEstimate: quoteCalculation.totalEstimate,
      paymentMethod: method,
      paymentStatus: isPaid ? 'PAID' : 'PENDING',
      signingMethod: method === 'PAY_LATER' ? 'IN_PERSON' : 'ONLINE',
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
        title: `ÄÆ¡n giá»¯ chá»— má»›i: ${code}`,
        message: `KhÃ¡ch hÃ ng ${customerName.trim()} vá»«a Ä‘áº·t giá»¯ chá»— Kho ${currentSelectedSize.volumeText} táº¡i ${selectedFacility?.name}. Nháº­n bÃ n giao: ${checkInDate} (${checkInTime}).`,
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

    // 1. Há» vÃ  tÃªn: chá»‰ cáº§n cÃ³ chá»¯ cÃ¡i, khÃ´ng space rá»—ng hoáº·c kÃ½ tá»± Ä‘áº·c biá»‡t
    const nameTrim = customerName.trim()
    if (!nameTrim) {
      errors.customerName = 'Vui lÃ²ng nháº­p há» vÃ  tÃªn cá»§a báº¡n'
    } else if (!/^[\p{L}\s]+$/u.test(nameTrim)) {
      errors.customerName = 'Há» vÃ  tÃªn chá»‰ Ä‘Æ°á»£c chá»©a chá»¯ cÃ¡i, khÃ´ng chá»©a sá»‘ hoáº·c kÃ½ tá»± Ä‘áº·c biá»‡t'
    } else if (nameTrim.length > 100) {
      errors.customerName = 'Há» vÃ  tÃªn khÃ´ng Ä‘Æ°á»£c vÆ°á»£t quÃ¡ 100 kÃ½ tá»±'
    }

    // 2. Sá»‘ Ä‘iá»‡n thoáº¡i di Ä‘á»™ng VN
    const cleanPhone = customerPhone.trim().replace(/[\s.-]/g, '')
    if (!cleanPhone) {
      errors.customerPhone = 'Vui lÃ²ng nháº­p sá»‘ Ä‘iá»‡n thoáº¡i liÃªn há»‡'
    } else if (!/^(0|\+84)(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/.test(cleanPhone)) {
      errors.customerPhone = 'Sá»‘ Ä‘iá»‡n thoáº¡i di Ä‘á»™ng Viá»‡t Nam khÃ´ng há»£p lá»‡ (10 sá»‘, báº¯t Ä‘áº§u báº±ng 03, 05, 07, 08, 09 hoáº·c +84)'
    }

    // 3. Sá»‘ CCCD / Há»™ chiáº¿u
    const cleanId = customerIdCard.trim().toUpperCase()
    if (!cleanId) {
      errors.customerIdCard = idCardType === 'CCCD' ? 'Vui lÃ²ng nháº­p sá»‘ CCCD 12 chá»¯ sá»‘' : 'Vui lÃ²ng nháº­p sá»‘ Há»™ chiáº¿u'
    } else if (idCardType === 'CCCD') {
      if (!/^\d{12}$/.test(cleanId)) {
        errors.customerIdCard = 'Sá»‘ CCCD pháº£i bao gá»“m Ä‘Ãºng 12 chá»¯ sá»‘'
      }
    } else {
      if (!/^[A-Z][0-9]{7,8}$/.test(cleanId)) {
        errors.customerIdCard = 'Sá»‘ Há»™ chiáº¿u khÃ´ng há»£p lá»‡ (1 chá»¯ cÃ¡i in hoa theo sau lÃ  7-8 chá»¯ sá»‘)'
      }
    }

    // 4. Email: Báº¯t buá»™c vÃ  Ä‘Ãºng Ä‘á»‹nh dáº¡ng RFC
    const emailTrim = customerEmail.trim()
    if (!emailTrim) {
      errors.customerEmail = 'Vui lÃ²ng nháº­p Ä‘á»‹a chá»‰ email nháº­n thÃ´ng tin há»£p Ä‘á»“ng vÃ  phiáº¿u háº¹n'
    } else if (!/^[A-Za-z0-9+_.-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})$/.test(emailTrim)) {
      errors.customerEmail = 'Äá»‹a chá»‰ email khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng (vÃ­ dá»¥: name@domain.com)'
    }

    // 5. Ghi chÃº (tá»‘i Ä‘a 500 kÃ½ tá»±)
    if (specialNotes && specialNotes.length > 500) {
      errors.specialNotes = 'Ghi chÃº tá»‘i Ä‘a 500 kÃ½ tá»±'
    }

    // 6. Quy cháº¿ chÃ­nh sÃ¡ch
    if (!policyAccepted) {
      errors.policyAccepted = 'QuÃ½ khÃ¡ch vui lÃ²ng Ä‘á»“ng Ã½ vá»›i chÃ­nh sÃ¡ch vÃ  quy cháº¿ giá»¯ chá»— kho cá»§a Boxora'
    }

    // 7. Khung giá» tiáº¿p Ä‘Ã³n khÃ´ng thuá»™c quÃ¡ khá»©
    if (isPeriodInPast(checkInDate, selectedPeriodId)) {
      errors.checkInTime = 'Khung giá» tiáº¿p Ä‘Ã³n báº¡n chá»n Ä‘Ã£ káº¿t thÃºc. Vui lÃ²ng chá»n khung giá» khÃ¡c hoáº·c ngÃ y tiáº¿p theo.'
    }

    setFormErrors(errors)

    const errorKeys = Object.keys(errors)
    if (errorKeys.length > 0) {
      // XÃ¡c Ä‘á»‹nh field lá»—i Ä‘áº§u tiÃªn theo thá»© tá»± xuáº¥t hiá»‡n trÃªn form
      const fieldSequence = [
        { key: 'checkInTime', id: 'booking-checkin-time' },
        { key: 'customerName', id: 'booking-customer-name' },
        { key: 'customerPhone', id: 'booking-customer-phone' },
        { key: 'customerIdCard', id: 'booking-customer-id-card' },
        { key: 'customerEmail', id: 'booking-customer-email' },
        { key: 'specialNotes', id: 'booking-special-notes' },
        { key: 'policyAccepted', id: 'booking-policy-checkbox' },
      ]

      const firstFault = fieldSequence.find((f) => errors[f.key])
      if (firstFault) {
        toast.warning(errors[firstFault.key], {
          title: 'ThÃ´ng tin chÆ°a Ä‘áº§y Ä‘á»§',
        })

        // Tá»± Ä‘á»™ng cuá»™n vÃ  focus tháº³ng vÃ o field thiáº¿u/lá»—i
        setTimeout(() => {
          const el = document.getElementById(firstFault.id)
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            if (typeof (el as HTMLElement).focus === 'function') {
              ;(el as HTMLElement).focus()
            }
            // Náº¿u lÃ  khá»‘i cha (nhÆ° booking-checkin-time), focus pháº§n tá»­ tÆ°Æ¡ng tÃ¡c Ä‘áº§u tiÃªn bÃªn trong
            const interactive = el.querySelector<HTMLElement>('input, button, select, textarea')
            if (interactive && typeof interactive.focus === 'function') {
              interactive.focus()
            }
          }
        }, 60)
      }
      return false
    }

    return true
  }

  // Handle Process Payment & Confirm (DocuSeal E-sign -> VNPay Sandbox)
  const handleProcessPaymentAndConfirm = async (overrideMethod?: 'ONLINE' | 'PAY_LATER') => {
    const selectedMethod = overrideMethod || paymentMethod

    if (isStaffOrManager) {
      toast.warning('Chá»‰ tÃ i khoáº£n khÃ¡ch hÃ ng má»›i cÃ³ thá»ƒ thá»±c hiá»‡n Ä‘áº·t kho.', {
        title: 'Giá»›i háº¡n quyá»n thao tÃ¡c',
      })
      setSubmitError('Chá»‰ tÃ i khoáº£n khÃ¡ch hÃ ng má»›i cÃ³ thá»ƒ thá»±c hiá»‡n Ä‘áº·t kho.')
      setIsSubmitting(false)
      return
    }

    if (!customerName.trim() || !customerPhone.trim() || !customerIdCard.trim()) {
      setSubmitError('Vui lÃ²ng kiá»ƒm tra vÃ  Ä‘iá»n Ä‘áº§y Ä‘á»§ Há» tÃªn, Sá»‘ Ä‘iá»‡n thoáº¡i vÃ  Sá»‘ CCCD.')
      setCurrentStep(4)
      return
    }

    if (isPeriodInPast(checkInDate, selectedPeriodId)) {
      setSubmitError('Khung giá» tiáº¿p Ä‘Ã³n báº¡n chá»n Ä‘Ã£ káº¿t thÃºc. Vui lÃ²ng chá»n khung giá» khÃ¡c hoáº·c ngÃ y tiáº¿p theo.')
      setCurrentStep(4)
      return
    }

    // LÆ°u láº¡i sá»‘ Ä‘á»‹nh danh Ä‘á»ƒ tiá»‡n tÃ¡i sá»­ dá»¥ng
    if (customerIdCard.trim() && user) {
      saveUserSavedIdDoc(
        user,
        idCardType,
        idCardType === 'CCCD' ? customerIdCard.trim() : bookingCccd,
        idCardType === 'PASSPORT' ? customerIdCard.trim() : bookingPassport
      )
    }

    // Náº¿u trÆ°á»›c Ä‘Ã³ Ä‘Ã£ kÃ½ há»£p Ä‘á»“ng online thÃ nh cÃ´ng nhÆ°ng chÆ°a thanh toÃ¡n, tiáº¿p tá»¥c thanh toÃ¡n Ä‘Æ¡n hiá»‡n táº¡i
    if (selectedMethod === 'ONLINE' && isContractAlreadySigned && createdBookingForSigning?.id) {
      void handleContinuePayment()
      return
    }

    // Náº¿u chá»n Thanh toÃ¡n online nhÆ°ng chÆ°a Ä‘Äƒng nháº­p tÃ i khoáº£n
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
      // TÃ¬m buá»“ng kho phÃ¹ há»£p táº¡i cÆ¡ sá»Ÿ theo kÃ­ch thÆ°á»›c ngÆ°á»i dÃ¹ng Ä‘Ã£ chá»n
      let allUnits = storageUnits
      const availableInCurrent = allUnits.filter((u) => u.status === 'AVAILABLE' || (u.status as string) === 'Trá»‘ng')
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
      const availableAll = allUnits.filter((u) => u.status === 'AVAILABLE' || (u.status as string) === 'Trá»‘ng')
      const available = facUnits.filter((u) => u.status === 'AVAILABLE' || (u.status as string) === 'Trá»‘ng')

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

        const bookingPayload = {
          bookingCode: createdBookingForSigning?.bookingCode || undefined,
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
        } as const
        const res = createdBookingForSigning?.id
          ? await bookingService.updateUnpaidBooking(createdBookingForSigning.id, bookingPayload)
          : await bookingService.createBooking(bookingPayload)
        if (false) console.log({
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
            ? `Chi tiáº¿t trÆ°á»ng khÃ´ng há»£p lá»‡: ${Object.entries(fieldErrors)
                .map(([k, v]) => `${k} (${String(v)})`)
                .join(' | ')}`
            : ''
        const msg = detailedFieldMsg
          ? `${apiErr?.response?.data?.message || 'Dá»¯ liá»‡u yÃªu cáº§u khÃ´ng há»£p lá»‡.'} â€” ${detailedFieldMsg}`
          : apiErr?.response?.data?.message || apiErr?.message
        if (selectedMethod === 'ONLINE') {
          throw new Error(msg || 'KhÃ´ng thá»ƒ táº¡o phiÃªn giá»¯ chá»— trÃªn há»‡ thá»‘ng Ä‘á»ƒ káº¿t ná»‘i cá»•ng thanh toÃ¡n. QuÃ½ khÃ¡ch vui lÃ²ng thá»­ láº¡i hoáº·c chá»n Thanh toÃ¡n sau khi nháº­n kho.')
        }
      }

      setBookingCode(effectiveBookingCode)

      // Xá»­ lÃ½ theo phÆ°Æ¡ng thá»©c thanh toÃ¡n Ä‘Ã£ chá»n
      if (selectedMethod === 'ONLINE') {
        if (!backendBookingId) {
          throw new Error('ChÆ°a thá»ƒ khá»Ÿi táº¡o thÃ´ng tin giao dá»‹ch trá»±c tuyáº¿n. QuÃ½ khÃ¡ch vui lÃ²ng thá»­ láº¡i hoáº·c chá»n hÃ¬nh thá»©c Thanh toÃ¡n sau khi nháº­n kho.')
        }

        setCreatedBookingForSigning(createdBooking)

        // Kiá»ƒm tra xem khÃ¡ch hÃ ng Ä‘Ã£ xÃ¡c nháº­n Ä‘iá»u khoáº£n há»§y phiÃªn báº£n má»›i nháº¥t cho booking nÃ y chÆ°a
        let statusRes: any = null
        try {
          statusRes = await cancellationPolicyService.getPolicyConfirmationStatus(backendBookingId)
        } catch (e) {
          console.warn('Check policy confirmation status warning:', e)
        }

        if (statusRes?.policyConfirmed && statusRes?.isLatestPolicy) {
          // ÄÃ£ xÃ¡c nháº­n phiÃªn báº£n má»›i nháº¥t -> Chuyá»ƒn tháº³ng sang kÃ½ há»£p Ä‘á»“ng DocuSeal
          let contract = null
          try {
            contract = await contractService.getContractByBookingId(backendBookingId)
          } catch (cErr) {
            console.warn('Error fetching contract for signing:', cErr)
          }

          if (!contract) {
            throw new Error('KhÃ´ng thá»ƒ khá»Ÿi táº¡o tÃ i liá»‡u há»£p Ä‘á»“ng Ä‘iá»‡n tá»­ DocuSeal. Vui lÃ²ng thá»­ láº¡i.')
          }

          setContractForSigning(contract)
          setShowDocuSealModal(true)
          setIsSubmitting(false)
          return
        }

        // ChÆ°a xÃ¡c nháº­n hoáº·c chÃ­nh sÃ¡ch Ä‘Ã£ cáº­p nháº­t phiÃªn báº£n má»›i -> Táº£i thÃ´ng tin vÃ  má»Ÿ modal Äiá»u khoáº£n há»§y há»£p Ä‘á»“ng & hoÃ n tiá»n
        setIsLoadingPolicy(true)
        setPolicyError(null)
        try {
          const facilityIdToUse = selectedFacility?.id || createdBooking?.facilityId || (createdBooking?.facility as any)?.id
          if (facilityIdToUse) {
            const pol = await cancellationPolicyService.getCancellationPolicyByFacility(facilityIdToUse)
            setPolicyDetail(pol)
            if (!pol?.isConfigured) {
              setPolicyError('CÆ¡ sá»Ÿ chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh Ä‘áº§y Ä‘á»§ chÃ­nh sÃ¡ch há»§y há»£p Ä‘á»“ng & hoÃ n tiá»n. Vui lÃ²ng liÃªn há»‡ quáº£n trá»‹ viÃªn.')
            }
          } else {
            setPolicyError('KhÃ´ng tÃ¬m tháº¥y thÃ´ng tin cÆ¡ sá»Ÿ kho Ä‘á»ƒ tra cá»©u chÃ­nh sÃ¡ch há»§y há»£p Ä‘á»“ng.')
          }
        } catch (pErr: any) {
          console.warn('Load cancellation policy error:', pErr)
          setPolicyError(pErr?.response?.data?.message || 'KhÃ´ng thá»ƒ táº£i thÃ´ng tin chÃ­nh sÃ¡ch há»§y há»£p Ä‘á»“ng cá»§a cÆ¡ sá»Ÿ.')
        } finally {
          setIsLoadingPolicy(false)
        }

        setShowPolicyConfirmModal(true)
        setIsSubmitting(false)
        return
      } else {
        // Thanh toÃ¡n sau khi nháº­n kho: LÆ°u Ä‘Æ¡n PENDING_CONTACT (chá»n kho khi check-in táº¡i quáº§y)
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
        'CÃ³ lá»—i xáº£y ra khi xÃ¡c nháº­n Ä‘áº·t chá»—. Vui lÃ²ng thá»­ láº¡i hoáº·c liÃªn há»‡ Hotline 1900-BOXORA.'
      setSubmitError(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Xá»­ lÃ½ khi khÃ¡ch hÃ ng Ä‘á»c vÃ  báº¥m "XÃ¡c nháº­n & Tiáº¿p tá»¥c" trÃªn Modal Äiá»u khoáº£n há»§y & HoÃ n tiá»n
  const handleConfirmCancellationPolicy = async () => {
    if (!createdBookingForSigning?.id) {
      toast.error('KhÃ´ng tÃ¬m tháº¥y mÃ£ Ä‘Æ¡n Ä‘áº·t kho Ä‘á»ƒ xÃ¡c nháº­n Ä‘iá»u khoáº£n.')
      return
    }
    const facilityIdToUse = selectedFacility?.id || createdBookingForSigning?.facilityId || (createdBookingForSigning?.facility as any)?.id
    if (!facilityIdToUse) {
      toast.error('KhÃ´ng tÃ¬m tháº¥y thÃ´ng tin cÆ¡ sá»Ÿ cá»§a Ä‘Æ¡n Ä‘áº·t kho.')
      return
    }
    if (!policyDetail?.policyVersion || !policyDetail?.isConfigured) {
      toast.error('ChÃ­nh sÃ¡ch há»§y cá»§a cÆ¡ sá»Ÿ chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh Ä‘áº§y Ä‘á»§.')
      return
    }

    setIsConfirmingPolicy(true)
    try {
      await cancellationPolicyService.confirmCancellationPolicy({
        bookingId: createdBookingForSigning.id,
        facilityId: facilityIdToUse,
        policyVersion: policyDetail.policyVersion,
        agreed: true,
      })

      // ÄÃ³ng modal Ä‘iá»u khoáº£n
      setShowPolicyConfirmModal(false)

      // Sau khi backend lÆ°u xÃ¡c nháº­n thÃ nh cÃ´ng, tiáº¿n hÃ nh láº¥y há»£p Ä‘á»“ng vÃ  má»Ÿ modal DocuSeal
      let contract = null
      try {
        contract = await contractService.getContractByBookingId(createdBookingForSigning.id)
      } catch (cErr) {
        console.warn('Error fetching contract after policy confirmation:', cErr)
      }

      if (!contract) {
        throw new Error('KhÃ´ng thá»ƒ khá»Ÿi táº¡o tÃ i liá»‡u há»£p Ä‘á»“ng Ä‘iá»‡n tá»­ DocuSeal. Vui lÃ²ng thá»­ láº¡i.')
      }

      setContractForSigning(contract)
      setShowDocuSealModal(true)
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'XÃ¡c nháº­n Ä‘iá»u khoáº£n tháº¥t báº¡i. Vui lÃ²ng thá»­ láº¡i.'
      toast.error(msg, { title: 'Lá»—i xÃ¡c nháº­n Ä‘iá»u khoáº£n' })
    } finally {
      setIsConfirmingPolicy(false)
    }
  }

  // BÆ°á»›c 3: Sau khi khÃ¡ch kÃ½ há»£p Ä‘á»“ng trá»±c tuyáº¿n DocuSeal thÃ nh cÃ´ng -> Táº¡o VNPay vÃ  chuyá»ƒn hÆ°á»›ng sang Sandbox
  const handleDocuSealSignedSuccess = async (_signedContract: RentalContract) => {
    setShowDocuSealModal(false)
    setHasSignedContract(true)
    setContractInvalidatedByChange(false)
    setSigningFormSnapshot(captureSigningSnapshot())
    setCreatedBookingForSigning((prev: any) => prev ? { ...prev, contractSigned: true, status: 'SIGNED_PENDING_PAYMENT' } : prev)
    if (_signedContract) {
      setContractForSigning(_signedContract)
    }
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      if (!createdBookingForSigning) {
        throw new Error('KhÃ´ng tÃ¬m tháº¥y thÃ´ng tin Ä‘Æ¡n Ä‘áº·t chá»— Ä‘Ã£ kÃ½.')
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
        throw new Error('Cá»•ng thanh toÃ¡n khÃ´ng pháº£n há»“i Ä‘Æ°á»ng dáº«n giao dá»‹ch. Vui lÃ²ng thá»­ láº¡i trong giÃ¢y lÃ¡t.')
      }
    } catch (err: any) {
      console.error('VNPay redirect after sign error:', err)
      setSubmitError(err?.message || 'Há»£p Ä‘á»“ng Ä‘Ã£ kÃ½ thÃ nh cÃ´ng, nhÆ°ng khÃ´ng thá»ƒ káº¿t ná»‘i tá»›i cá»•ng thanh toÃ¡n VNPay Sandbox. Vui lÃ²ng thá»­ láº¡i.')
      setIsSubmitting(false)
    }
  }

  // Tiáº¿p tá»¥c thá»±c hiá»‡n thanh toÃ¡n cho Ä‘Æ¡n vÃ  há»£p Ä‘á»“ng Ä‘Ã£ kÃ½ trÆ°á»›c Ä‘Ã³
  const handleContinuePayment = async () => {
    if (isStaffOrManager) {
      toast.warning('Chá»‰ tÃ i khoáº£n khÃ¡ch hÃ ng má»›i cÃ³ thá»ƒ thá»±c hiá»‡n Ä‘áº·t kho.', {
        title: 'Giá»›i háº¡n quyá»n thao tÃ¡c',
      })
      setSubmitError('Chá»‰ tÃ i khoáº£n khÃ¡ch hÃ ng má»›i cÃ³ thá»ƒ thá»±c hiá»‡n Ä‘áº·t kho.')
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const targetBooking = createdBookingForSigning
      if (!targetBooking?.id) {
        await handleProcessPaymentAndConfirm('ONLINE')
        return
      }

      const paymentAmount = (targetBooking?.totalRentalFee != null && targetBooking?.depositAmount != null)
        ? Math.round(Number(targetBooking.totalRentalFee) + Number(targetBooking.depositAmount))
        : (targetBooking?.initialPaymentAmount != null
            ? Math.round(Number(targetBooking.initialPaymentAmount))
            : quoteCalculation.totalEstimate)

      const payRes = await paymentService.createVNPayPayment({
        bookingId: targetBooking.id,
        paymentType: 'BOOKING_PAYMENT',
        amount: paymentAmount,
        orderInfo: `Thanh toan giu cho ${targetBooking.bookingCode || bookingCode}`,
        returnUrl: `${window.location.origin}/payment-result`,
      })

      if (payRes?.paymentUrl) {
        sendReservationToStaff(targetBooking.bookingCode || bookingCode, 'ONLINE', false, targetBooking.id)
        window.location.assign(payRes.paymentUrl)
      } else {
        throw new Error('Cá»•ng thanh toÃ¡n khÃ´ng pháº£n há»“i Ä‘Æ°á»ng dáº«n giao dá»‹ch. Vui lÃ²ng thá»­ láº¡i trong giÃ¢y lÃ¡t.')
      }
    } catch (err: any) {
      console.error('Continue VNPay payment error:', err)
      setSubmitError(err?.message || 'KhÃ´ng thá»ƒ káº¿t ná»‘i tá»›i cá»•ng thanh toÃ¡n VNPay Sandbox. Vui lÃ²ng thá»­ láº¡i.')
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
            (u) => u.facilityId === activeFac.id && (u.status === 'AVAILABLE' || (u.status as string) === 'Trá»‘ng')
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
      if (currentSelectedSize && getAvailableCountForSize(currentSelectedSize) === 0) {
        toast.warning('KÃ­ch thÆ°á»›c buá»“ng kho Ä‘Ã£ chá»n hiá»‡n khÃ´ng cÃ²n buá»“ng kháº£ dá»¥ng táº¡i cÆ¡ sá»Ÿ nÃ y. Vui lÃ²ng chá»n kÃ­ch thÆ°á»›c khÃ¡c hoáº·c Ä‘á»•i chi nhÃ¡nh.', {
          title: 'Kho Ä‘Ã£ háº¿t chá»—',
        })
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
        toast.warning('Thá»i gian thuÃª ngáº¯n háº¡n tá»‘i thiá»ƒu lÃ  7 ngÃ y. Vui lÃ²ng kiá»ƒm tra láº¡i.', {
          title: 'Thá»i gian thuÃª khÃ´ng há»£p lá»‡',
        })
        return
      }

      // Customer MUST be logged in or registered before proceeding to Step 4
      if (!isAuthenticated || !user) {
        const draft = {
          facilityId: selectedFacility?.id,
          facilityName: selectedFacility?.name,
          facilityCode: selectedFacility?.code,
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
        if (selectedFacility?.id) {
          localStorage.setItem('boxora_selected_facility_id', selectedFacility.id)
          sessionStorage.setItem('boxora_selected_facility_id', selectedFacility.id)
        }
        setShowAuthModal(true)
        return
      }

      // Auto pre-fill info from user profile when authenticated
      if (user) {
        const pName = user.fullName || user.username || ''
        if (pName && (!customerName.trim() || customerName === 'KhÃ¡ch hÃ ng')) {
          setCustomerName(pName)
        }
        const pPhone = user.phone || (user as any).phoneNumber || ''
        if (pPhone && !customerPhone.trim()) {
          setCustomerPhone(pPhone)
        }
        if (user.email && !customerEmail.trim()) {
          setCustomerEmail(user.email)
        }
        const doc = loadUserSavedIdDoc(user)
        setBookingCccd(doc.cccd)
        setBookingPassport(doc.passport)
        if (!customerIdCard.trim()) {
          setIdCardType(doc.preferredType)
          setCustomerIdCard(doc.preferredType === 'CCCD' ? doc.cccd : doc.passport)
        } else {
          // If customerIdCard currently has a value, make sure it matches the selected idCardType
          if (idCardType === 'CCCD' && doc.passport && customerIdCard.trim() === doc.passport && doc.cccd) {
            setCustomerIdCard(doc.cccd)
          } else if (idCardType === 'CCCD' && !doc.cccd && doc.passport) {
            setIdCardType('PASSPORT')
            setCustomerIdCard(doc.passport)
          }
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

      setIsSubmitting(false)
      setCurrentStep(5)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (currentStep === 5) {
      if (isStaffOrManager) {
        toast.warning('Chá»‰ tÃ i khoáº£n khÃ¡ch hÃ ng má»›i thá»±c hiá»‡n Ä‘áº·t Ä‘Æ°á»£c kho.', {
          title: 'Giá»›i háº¡n quyá»n thao tÃ¡c',
        })
        return
      }
      if (paymentMethod === 'ONLINE' && isContractAlreadySigned) {
        void handleContinuePayment()
      } else if (paymentMethod === 'PAY_LATER') {
        setShowPayLaterConfirmModal(true)
      } else {
        void handleProcessPaymentAndConfirm()
      }
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
      setIsSubmitting(false)
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
              <span className="font-semibold text-slate-900 dark:text-white">Quy trÃ¬nh Ä‘áº·t kho</span>
              <span>â€¢</span>
              <span>Minh báº¡ch chi phÃ­</span>
              <span>â€¢</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Tá»± Ä‘á»™ng 24/7</span>
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
                          <span>{isCustomer ? t('VÃ o trang Quáº£n LÃ½ Kho ') : t('VÃ o Trang Äiá»u HÃ nh Portal')}</span>
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
                          <span>{t('ÄÆ¡n Äáº·t Giá»¯ Chá»— Cá»§a TÃ´i')}</span>
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
                  {t('ÄÄƒng Nháº­p')}
                </Link>
                <Link
                  to="/booking"
                  className="inline-flex items-center gap-1.5 rounded-full bg-blue-700 hover:bg-blue-800 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors shadow-xs"
                >
                  <span>{t('ThuÃª Kho Ngay')}</span>
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
                { step: 1, title: 'Chá»n cÆ¡ sá»Ÿ', subtitle: selectedFacility?.name || 'Chá»n chi nhÃ¡nh' },
                { step: 2, title: 'Chá»n kho', subtitle: currentSelectedSize ? `Kho ${currentSelectedSize.volumeText}` : 'Chá»n quy cÃ¡ch' },
                { step: 3, title: 'Thá»i háº¡n & BÃ¡o giÃ¡', subtitle: `${rentalDurationText} â€¢ ${quoteCalculation.totalEstimate.toLocaleString('vi-VN')} â‚«` },
                { step: 4, title: 'Lá»‹ch háº¹n & Chi tiáº¿t', subtitle: `${formatDateDDMMYYYY(checkInDate)} â€¢ ${customerName || 'Chi tiáº¿t'}` },
                { step: 5, title: 'Há»£p Ä‘á»“ng & Thanh toÃ¡n', subtitle: paymentMethod === 'ONLINE' ? 'KÃ½ HÄ & Trá»±c tuyáº¿n' : 'Táº¡i cÆ¡ sá»Ÿ' },
                { step: 6, title: 'HoÃ n táº¥t', subtitle: 'HoÃ n táº¥t giá»¯ chá»—' },
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
                        {isPassed ? item.subtitle : isCurrent ? 'Äang thá»±c hiá»‡n' : 'ChÆ°a tá»›i'}
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
                  {currentStep === 1 && 'BÆ°á»›c 1: Chá»n cÆ¡ sá»Ÿ'}
                  {currentStep === 2 && `BÆ°á»›c 2: Chá»n kho (${currentSelectedSize?.volumeText || ''})`}
                  {currentStep === 3 && 'BÆ°á»›c 3: Thá»i háº¡n thuÃª & BÃ¡o giÃ¡'}
                  {currentStep === 4 && 'BÆ°á»›c 4: Lá»‹ch háº¹n & Chi tiáº¿t'}
                  {currentStep === 5 && 'BÆ°á»›c 5: Há»£p Ä‘á»“ng & Thanh toÃ¡n'}
                  {currentStep === 6 && 'BÆ°á»›c 6: HoÃ n táº¥t giá»¯ chá»—'}
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
        {/* BÆ¯á»šC 1: CHá»ŒN CÆ  Sá»ž KHO                                          */}
        {/* ============================================================== */}
        {currentStep === 1 && (
          <div id="facility-selection-section" className="space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2 border-b border-slate-200/80 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200/60 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                  <Building2 size={12} />
                  <span>BÆ°á»›c 1 / 6 â€¢ Chá»n cÆ¡ sá»Ÿ</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Chá»n cÆ¡ sá»Ÿ kho lÆ°u trá»¯
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Táº¥t cáº£ chi nhÃ¡nh Boxora Ä‘á»u váº­n hÃ nh tá»± Ä‘á»™ng 24/7 vá»›i khÃ³a thÃ´ng minh IoT Ä‘á»™c láº­p.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-2 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span><strong>{sortedFacilities.length}</strong> cÆ¡ sá»Ÿ Ä‘ang hoáº¡t Ä‘á»™ng</span>
                </div>
                {selectedFacility && (
                  <div className="hidden sm:flex px-3 py-1.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800 text-xs font-semibold text-blue-700 dark:text-blue-300 items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-blue-600 dark:text-blue-400" />
                    <span>Äang chá»n: {selectedFacility.name}</span>
                  </div>
                )}
              </div>
            </div>

            {loadingData ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 text-sm space-y-2">
                <div className="w-7 h-7 border-3 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto" />
                <p className="font-medium text-xs">Äang táº£i danh sÃ¡ch cÆ¡ sá»Ÿ kho Boxora...</p>
              </div>
            ) : sortedFacilities.length === 0 ? (
              <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 text-sm">
                KhÃ´ng tÃ¬m tháº¥y cÆ¡ sá»Ÿ nÃ o phÃ¹ há»£p. Vui lÃ²ng táº£i láº¡i trang.
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
                              {fac.availableCount > 0 ? `CÃ²n ${fac.availableCount} kho trá»‘ng` : 'Háº¿t kho trá»‘ng'}
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
                            {fac.address || 'Äá»‹a chá»‰ Ä‘ang cáº­p nháº­t'}
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
                              Äang chá»n
                            </span>
                          ) : (
                            <span className="text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 text-[11px] font-medium flex items-center gap-1">
                              Chá»n cÆ¡ sá»Ÿ
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
        {/* BÆ¯á»šC 2: CHá»ŒN KHO / LOáº I KHO (Task 1: Real availability strictly) */}
        {/* ============================================================== */}
        {currentStep === 2 && (
          <div className="space-y-3.5 animate-in fade-in duration-300">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pb-2 border-b border-slate-200/80 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200/60 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                  <Box size={12} />
                  <span>BÆ°á»›c 2 / 6 â€¢ Chá»n kho / loáº¡i kho</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Chá»n kho hoáº·c loáº¡i kho lÆ°u trá»¯
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lá»±a chá»n thá»ƒ tÃ­ch phÃ¹ há»£p vÃ  tÃ¹y chá»‰nh cháº¿ Ä‘á»™ Ä‘iá»u hÃ²a nhiá»‡t áº©m  hoáº·c thÃ´ng giÃ³ tá»± nhiÃªn.
                </p>
              </div>

              <div className="flex items-center justify-between sm:justify-start gap-2.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs text-xs shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Building2 size={14} />
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px]">CÆ¡ sá»Ÿ lÆ°u trá»¯</span>
                    <strong className="text-slate-900 dark:text-white font-bold text-xs">{selectedFacility?.name}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-blue-600 dark:text-blue-400 text-xs font-semibold cursor-pointer"
                >
                  Äá»•i cÆ¡ sá»Ÿ
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
                    <h3 className="font-extrabold text-base sm:text-lg">CÆ¡ sá»Ÿ nÃ y hiá»‡n chÆ°a cÃ³ kho kháº£ dá»¥ng</h3>
                    <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300/90 mt-1 leading-relaxed">
                      CÆ¡ sá»Ÿ {selectedFacility?.name} hiá»‡n chÆ°a cÃ³ buá»“ng kho nÃ o á»Ÿ tráº¡ng thÃ¡i kháº£ dá»¥ng. Vui lÃ²ng chá»n cÆ¡ sá»Ÿ khÃ¡c Ä‘á»ƒ tiáº¿p tá»¥c Ä‘áº·t kho.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNoUnitsModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-bold text-xs sm:text-sm shrink-0 transition-all shadow-xs cursor-pointer"
                >
                  Chá»n cÆ¡ sá»Ÿ khÃ¡c
                </button>
              </div>
            ) : (
              <>
                {/* Category Filter Tabs & Visual Mode Switcher */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 p-2 sm:p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
                  <div
                    className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar scroll-smooth flex-nowrap py-0.5 min-w-0 flex-1"
                    style={{ flexWrap: 'nowrap' }}
                  >
                    {[
                      { key: 'ALL', label: `Táº¥t cáº£ (${availableSizesInFacility.length})` },
                      { key: 'PERSONAL', label: 'CÃ¡ nhÃ¢n & Mini (â‰¤ 4 mÂ³)' },
                      { key: 'FAMILY', label: 'Gia Ä‘Ã¬nh (> 4 â€“ 10 mÂ³)' },
                      { key: 'ENTERPRISE', label: 'Doanh nghiá»‡p (> 10 â€“ 25 mÂ³)' },
                      { key: 'LOGISTICS', label: 'Logistics (> 25 mÂ³)' },
                    ].map((cat) => (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setSizeFilterCategory(cat.key as any)}
                        className={`whitespace-nowrap shrink-0 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
                        onClick={() => {
                          setSizeVisualMode('3D')
                          setUserForced3DMode(true)
                        }}
                        className={px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          sizeVisualMode === '3D'
                            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                        }}
                      >
                        <Box size={12} />
                        <span>Mô hình 3D</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSizeVisualMode('PHOTO')
                          setUserForced3DMode(false)
                        }}
                        className={px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          sizeVisualMode === 'PHOTO'
                            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                        }}
                      >
                        <Building2 size={12} />
                        <span>Ảnh thực tế</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      <span>Đang chọn:</span>
                      <strong className="text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap">
                        Kho {currentSelectedSize.volumeText} ({isAcActive ? 'A/C Máy lạnh' : 'Non-A/C'})
                      </strong>
                    </div>
                  </div>
                  </div>
                </div>


                {/* Available Sizes Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
                  {filteredSizesCatalog.map((sizeUnit) => {
                    const isSelected = selectedSizeId === sizeUnit.id
                    const unitHasAc = Boolean(sizeUnit.hasAc !== false && sizeUnit.acRate > 0)
                    const unitAcMode = unitHasAc ? (acSelectionMap[sizeUnit.id] || 'NON_AC') : 'NON_AC'
                    const displayPrice = getDynamicPriceForSize(sizeUnit, unitAcMode === 'AC')
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
                          <div className="min-w-0 flex-1">
                            {sizeUnit.typeName && (
                              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 block truncate" title={sizeUnit.typeName}>
                                {sizeUnit.typeName}
                              </span>
                            )}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-extrabold text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight">
                                {sizeUnit.volumeText}
                              </span>
                              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-semibold">
                                {sizeUnit.areaM2} mÂ²
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                              {sizeUnit.dimensions}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setInspectVisualTab(
                                  (sizeUnit as any).imageUrl && !userForced3DMode ? 'PHOTO' : sizeVisualMode
                                )
                                setInspectingSizeUnit(sizeUnit)
                              }}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                              title="Xem chi tiáº¿t quy cÃ¡ch & áº£nh thá»±c táº¿"
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
                          {sizeVisualMode === '3D' && (!((sizeUnit as any).imageUrl) || userForced3DMode) ? (
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
                                src={(sizeUnit as any).imageUrl || realPhotoInfo.photoUrl}
                                alt={`áº¢nh thá»±c táº¿ kho ${sizeUnit.volumeText}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                onError={(e) => {
                                  const target = e.currentTarget
                                  target.onerror = null
                                  target.src = realPhotoInfo.photoUrl
                                }}
                              />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 via-slate-950/30 to-transparent px-3 py-1.5 flex items-center justify-between text-[10px] text-white">
                                <span className="font-semibold truncate">{sizeUnit.dimensions.replace('Cao ', '')}</span>
                                <span className="px-1.5 py-0.5 rounded bg-blue-600/90 font-bold shrink-0">
                                  {unitAcMode === 'AC' ? 'Kho A/C' : 'TiÃªu chuáº©n'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Bottom Controls */}
                        <div className="p-3.5 pt-2 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Kháº£ dá»¥ng:</span>
                            {availCount > 0 ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                                CÃ²n {availCount} buá»“ng kho
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold">
                                Háº¿t chá»—
                              </span>
                            )}
                          </div>

                          {/* Segmented A/C Toggle: áº¨n nÃºt MÃ¡y láº¡nh A/C náº¿u kho khÃ´ng há»— trá»£ A/C */}
                          {unitHasAc ? (
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
                                <span>TiÃªu chuáº©n</span>
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
                                <span>MÃ¡y láº¡nh A/C</span>
                              </button>
                            </div>
                          ) : (
                            <div className="p-1 rounded-lg bg-slate-100/70 dark:bg-slate-800/70 flex items-center text-xs font-semibold">
                              <div className="flex-1 py-1 rounded-md text-center bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-2xs font-bold flex items-center justify-center gap-1 text-[11px]">
                                <Wind size={11} className="text-slate-500" />
                                <span>TiÃªu chuáº©n (ThÃ´ng giÃ³)</span>
                              </div>
                            </div>
                          )}

                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                              ÄÆ¡n giÃ¡ thuÃª
                            </span>
                            <div className="text-right">
                              <span className="font-extrabold text-sm sm:text-base text-blue-600 dark:text-blue-400">
                                {displayPrice.toLocaleString('vi-VN')} â‚«
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium"> /thÃ¡ng</span>
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
        {/* BÆ¯á»šC 3: THá»œI Háº N THUÃŠ & BÃO GIÃ (Task 2 Standardized)           */}
        {/* ============================================================== */}
        {currentStep === 3 && (
          <div className="space-y-3.5 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2 border-b border-slate-200/80 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200/60 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                  <Clock size={12} />
                  <span>BÆ°á»›c 3 / 6 â€¢ Thá»i háº¡n thuÃª &amp; BÃ¡o giÃ¡</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Thá»i háº¡n thuÃª &amp; Báº£ng kÃª bÃ¡o giÃ¡
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('Lá»±a chá»n ká»³ háº¡n thuÃª linh hoáº¡t Ä‘á»ƒ nháº­n Æ°u Ä‘Ã£i lÃªn Ä‘áº¿n {pct}% vÃ  xem báº£ng phÃ¢n rÃ£ chi phÃ­ minh báº¡ch.', { pct: `${maxActiveDiscountPercent}%` }) || `Lá»±a chá»n ká»³ háº¡n thuÃª linh hoáº¡t Ä‘á»ƒ nháº­n Æ°u Ä‘Ã£i lÃªn Ä‘áº¿n ${maxActiveDiscountPercent}% vÃ  xem báº£ng phÃ¢n rÃ£ chi phÃ­ minh báº¡ch.`}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/70 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300">
                <ShieldCheck size={14} />
                <span>Minh báº¡ch 100% â€¢ KhÃ´ng phÃ­ áº©n</span>
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
                          1. Chá»n thá»i háº¡n thuÃª kho &amp; Æ¯u Ä‘Ã£i ká»³ háº¡n
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {t('Cam káº¿t tá»« 3 thÃ¡ng trá»Ÿ lÃªn Ä‘Æ°á»£c giáº£m trá»±c tiáº¿p tá»« {min}% Ä‘áº¿n {max}% vÃ o Ä‘Æ¡n giÃ¡ hÃ ng thÃ¡ng', { min: `${facilityDiscount3M}%`, max: `${maxActiveDiscountPercent}%` }) || `Cam káº¿t tá»« 3 thÃ¡ng trá»Ÿ lÃªn Ä‘Æ°á»£c giáº£m trá»±c tiáº¿p tá»« ${facilityDiscount3M}% Ä‘áº¿n ${maxActiveDiscountPercent}% vÃ o Ä‘Æ¡n giÃ¡ hÃ ng thÃ¡ng`}
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-bold shrink-0">
                      {rentalDurationText}
                    </span>
                  </div>

                  <div className={`grid ${durationGridColsClass} gap-2.5`}>
                    {activeDurationOptions.map((dur) => {
                      const active = durationMode === 'MONTHS' && rentalMonths === dur.m
                      return (
                        <button
                          key={dur.m}
                          type="button"
                          onClick={() => {
                            setDurationMode('MONTHS')
                            setRentalMonths(dur.m)
                          }}
                          className={`p-3 sm:p-3.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                            active
                              ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-600 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/20'
                              : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white whitespace-nowrap">{dur.label}</span>
                          <span className={`text-[10px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md whitespace-nowrap ${
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
                      <span>{durationMode === 'CUSTOM_DAYS' ? 'Thu gá»n tÃ¹y chá»‰nh sá»‘ ngÃ y' : 'Cáº§n thuÃª theo sá»‘ ngÃ y ngáº¯n háº¡n? (Tá»‘i thiá»ƒu 7 ngÃ y)'}</span>
                      <ChevronRight size={13} className={durationMode === 'CUSTOM_DAYS' ? 'rotate-90 transition-transform' : ''} />
                    </button>
                  </div>

                  {durationMode === 'CUSTOM_DAYS' && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Nháº­p sá»‘ ngÃ y muá»‘n thuÃª (tá»‘i thiá»ƒu 7 ngÃ y):
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
                        <p className="text-xs text-red-600 font-medium">Thá»i gian thuÃª tá»‘i thiá»ƒu lÃ  7 ngÃ y.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. TRANSPARENCY COMMITMENTS */}
                <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-4">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                    Cam káº¿t minh báº¡ch tÃ i chÃ­nh Boxora
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
                      <strong className="text-slate-900 dark:text-white font-bold block">HoÃ n cá»c 100%</strong>
                      <span className="text-slate-500 dark:text-slate-400 leading-relaxed block">
                        Tiá»n cá»c báº£o Ä‘áº£m Ä‘Æ°á»£c hoÃ n tráº£ nguyÃªn váº¹n ngay khi thanh lÃ½ há»£p Ä‘á»“ng há»£p lá»‡.
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
                      <strong className="text-slate-900 dark:text-white font-bold block">Bao trá»n Ä‘iá»‡n &amp; A/C</strong>
                      <span className="text-slate-500 dark:text-slate-400 leading-relaxed block">
                        ÄÃ£ bao gá»“m chi phÃ­ Ä‘iá»‡n chiáº¿u sÃ¡ng, Ä‘iá»u hÃ²a kiá»ƒm soÃ¡t áº©m vÃ  vá»‡ sinh cÃ´ng nghiá»‡p.
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
                      <strong className="text-slate-900 dark:text-white font-bold block">ÄÃ£ gá»“m VAT</strong>
                      <span className="text-slate-500 dark:text-slate-400 leading-relaxed block">
                        Xuáº¥t hÃ³a Ä‘Æ¡n Ä‘iá»‡n tá»­ VAT tá»± Ä‘á»™ng, khÃ´ng phÃ¡t sinh báº¥t ká»³ khoáº£n phá»¥ phÃ­ áº©n nÃ o.
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
                        Báº£ng bÃ¡o giÃ¡ chi tiáº¿t
                      </h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                      VNÄ (ÄÃ£ gá»“m VAT)
                    </span>
                  </div>

                  <div className="p-3.5 sm:p-4 space-y-2.5 text-xs">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>ÄÆ¡n giÃ¡ buá»“ng kho niÃªm yáº¿t:</span>
                      <strong className="text-slate-900 dark:text-white font-semibold">
                        {isCustomDuration
                          ? `${quoteCalculation.dailyRate.toLocaleString('vi-VN')} â‚«/ngÃ y`
                          : `${quoteCalculation.baseMonthly.toLocaleString('vi-VN')} â‚«/thÃ¡ng`}
                      </strong>
                    </div>

                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Ká»³ háº¡n Ä‘Äƒng kÃ½ thuÃª:</span>
                      <strong className="text-slate-900 dark:text-white font-semibold">
                        {rentalDurationText}
                      </strong>
                    </div>

                    {!isCustomDuration && quoteCalculation.discountPercent > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span>ÄÆ¡n giÃ¡ sau Æ°u Ä‘Ã£i (-{quoteCalculation.discountPercent}%):</span>
                        <span>{quoteCalculation.monthlyAfterDiscount.toLocaleString('vi-VN')} â‚«/thÃ¡ng</span>
                      </div>
                    )}

                    {quoteCalculation.discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span>Tá»•ng sá»‘ tiá»n tiáº¿t kiá»‡m Ä‘Æ°á»£c:</span>
                        <span>âˆ’{quoteCalculation.discountAmount.toLocaleString('vi-VN')} â‚«</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-slate-800 dark:text-slate-200 font-semibold">
                      <span>Tá»•ng tiá»n thuÃª ({rentalDurationText}):</span>
                      <span>{quoteCalculation.totalRent.toLocaleString('vi-VN')} â‚«</span>
                    </div>

                    <div className="flex justify-between items-start text-slate-600 dark:text-slate-400">
                      <div>
                        <span className="block">Tiá»n Ä‘áº·t cá»c báº£o Ä‘áº£m:</span>
                        <span className="text-[10px] text-slate-400 block">HoÃ n tráº£ 100% khi thanh lÃ½ há»£p Ä‘á»“ng</span>
                      </div>
                      <strong className="text-slate-900 dark:text-white font-semibold">
                        {quoteCalculation.depositAmount.toLocaleString('vi-VN')} â‚«
                      </strong>
                    </div>

                    <div className="p-3 rounded-lg bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-900/60 space-y-0.5">
                      <div className="flex items-baseline justify-between">
                        <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                          Tá»•ng chi phÃ­ dá»± kiáº¿n
                        </span>
                        <span className="font-extrabold text-lg text-blue-600 dark:text-blue-400">
                          {quoteCalculation.totalEstimate.toLocaleString('vi-VN')} â‚«
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Bao gá»“m tiá»n thuÃª {rentalDurationText} vÃ  tiá»n cá»c hoÃ n láº¡i 1 thÃ¡ng.
                      </p>
                    </div>

                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* BÆ¯á»šC 4: Lá»ŠCH Háº¸N & CHI TIáº¾T (Task 2 & 3 Standardized)           */}
        {/* ============================================================== */}
        {currentStep === 4 && (
          <div className="space-y-3.5 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2 border-b border-slate-200/80 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200/60 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                  <Calendar size={12} />
                  <span>BÆ°á»›c 4 / 6 â€¢ Lá»‹ch háº¹n &amp; Chi tiáº¿t</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Lá»‹ch háº¹n Ä‘Ã³n tiáº¿p &amp; Chi tiáº¿t Ä‘áº·t kho
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
                  Chá»n khung giá» bÃ n giao buá»“ng kho 24/7 vÃ  Ä‘iá»n thÃ´ng tin ngÆ°á»i Ä‘áº¡i diá»‡n nháº­n kho Ä‘á»ƒ chuáº©n bá»‹ há»“ sÆ¡ há»£p Ä‘á»“ng.
                </p>
              </div>

              {isAuthenticated && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/70 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300 text-xs font-semibold w-fit shrink-0">
                  <ShieldCheck size={14} />
                  <span>ÄÃ£ Ä‘á»“ng bá»™ thÃ´ng tin tÃ i khoáº£n</span>
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
                          1. Lá»‹ch háº¹n Ä‘Ã³n tiáº¿p &amp; Nháº­n bÃ n giao kho
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Chá»n ngÃ y vÃ  buá»•i thuáº­n tiá»‡n Ä‘á»ƒ nhÃ¢n viÃªn chuáº©n bá»‹ buá»“ng kho &amp; há»— trá»£ bÃ n giao
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold w-fit">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Há»— trá»£ nháº­n kho 24/7
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        NgÃ y nháº­n bÃ n giao kho (NgÃ y báº¯t Ä‘áº§u thuÃª)
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
                        Thá»i háº¡n há»£p Ä‘á»“ng dá»± kiáº¿n
                      </label>
                      <div className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs sm:text-sm flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 text-xs">Tá»« {formatDateDDMMYYYY(startDate)} Ä‘áº¿n:</span>
                        <strong className="text-slate-900 dark:text-white font-bold text-xs sm:text-sm">
                          {formatDateDDMMYYYY(rentalEndDate)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Time Slot Selector */}
                  <div id="booking-checkin-time" className="space-y-1.5 scroll-mt-28">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                        Khung giá» háº¹n Ä‘áº¿n cÆ¡ sá»Ÿ
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
                            title={isPast ? 'Khung giá» nÃ y Ä‘Ã£ káº¿t thÃºc Ä‘á»‘i vá»›i ngÃ y Ä‘Ã£ chá»n' : undefined}
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
                                  ÄÃ£ qua
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
                              {group.rangeText.replace('Khoáº£ng tá»« ', 'Tá»« ')}
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
                        Táº¥t cáº£ cÃ¡c ca tiáº¿p Ä‘Ã³n trong ngÃ y Ä‘Ã£ chá»n Ä‘Ã£ káº¿t thÃºc. QuÃ½ khÃ¡ch vui lÃ²ng chá»n ngÃ y nháº­n kho tá»« ngÃ y mai.
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
                        2. ThÃ´ng tin ngÆ°á»i Ä‘áº·t &amp; Nháº­n bÃ n giao
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        DÃ¹ng Ä‘á»ƒ láº­p há»£p Ä‘á»“ng thuÃª kho Ä‘iá»‡n tá»­, cáº¥p mÃ£ PIN khÃ³a thÃ´ng minh IoT vÃ  Ä‘á»‘i chiáº¿u khi nháº­n kho
                      </p>
                    </div>
                  </div>

                  {/* Informational banner when profile is missing phone or cccd (e.g. Google Login) */}
                  {user && (!user.phone && !(user as any).phoneNumber) && (
                    <div className="p-2.5 px-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                      <AlertCircle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-bold">Bá»• sung thÃ´ng tin ngÆ°á»i nháº­n bÃ n giao</p>
                        <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90 leading-relaxed">
                          TÃ i khoáº£n cá»§a báº¡n chÆ°a cÃ³ sá»‘ Ä‘iá»‡n thoáº¡i trong há»“ sÆ¡. Vui lÃ²ng nháº­p sá»‘ Ä‘iá»‡n thoáº¡i vÃ  sá»‘ CCCD/Há»™ chiáº¿u bÃªn dÆ°á»›i Ä‘á»ƒ Boxora láº­p há»£p Ä‘á»“ng vÃ  cáº¥p mÃ£ PIN má»Ÿ kho.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Verified sync badge when profile info was auto loaded */}
                  {user && (user.fullName || user.username) && (user.phone || (user as any).phoneNumber) && user.email && (
                    <div className="p-2 px-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>ThÃ´ng tin Ä‘Ã£ Ä‘Æ°á»£c Ä‘á»“ng bá»™ tá»± Ä‘á»™ng tá»« tÃ i khoáº£n <strong>{user.fullName || user.username}</strong></span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Full Name */}
                    <div>
                      <label htmlFor="booking-customer-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Há» vÃ  tÃªn ngÆ°á»i thuÃª <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          id="booking-customer-name"
                          type="text"
                          value={customerName}
                          onChange={(e) => {
                            setCustomerName(e.target.value)
                            if (formErrors.customerName) {
                              setFormErrors((prev) => ({ ...prev, customerName: '' }))
                            }
                          }}
                          placeholder="Nguyá»…n VÄƒn A"
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
                      <label htmlFor="booking-customer-phone" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Sá»‘ Ä‘iá»‡n thoáº¡i liÃªn há»‡ <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          id="booking-customer-phone"
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
                        <label htmlFor="booking-customer-id-card" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Loáº¡i giáº¥y tá» &amp; Sá»‘ Ä‘á»‹nh danh <span className="text-red-500">*</span>
                        </label>
                        <div className="inline-flex rounded-md bg-slate-100 dark:bg-slate-800 p-0.5 text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => {
                              setIdCardType('CCCD')
                              const doc = loadUserSavedIdDoc(user)
                              const targetVal = bookingCccd || doc.cccd
                              setCustomerIdCard(targetVal)
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
                              const doc = loadUserSavedIdDoc(user)
                              const targetVal = bookingPassport || doc.passport
                              setCustomerIdCard(targetVal)
                              if (formErrors.customerIdCard) setFormErrors((prev) => ({ ...prev, customerIdCard: '' }))
                            }}
                            className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                              idCardType === 'PASSPORT' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-2xs font-extrabold' : 'text-slate-500'
                            }`}
                          >
                            Há»™ chiáº¿u
                          </button>
                        </div>
                      </div>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          id="booking-customer-id-card"
                          type="text"
                          inputMode={idCardType === 'CCCD' ? 'numeric' : 'text'}
                          maxLength={idCardType === 'CCCD' ? 12 : 9}
                          value={customerIdCard}
                          onChange={(e) => {
                            const raw = e.target.value
                            const val = idCardType === 'CCCD'
                              ? raw.replace(/\D/g, '').slice(0, 12)
                              : raw.toUpperCase().slice(0, 9)
                            setCustomerIdCard(val)
                            if (idCardType === 'CCCD') {
                              setBookingCccd(val)
                            } else {
                              setBookingPassport(val)
                            }
                            if (formErrors.customerIdCard) {
                              setFormErrors((prev) => ({ ...prev, customerIdCard: '' }))
                            }
                          }}
                          placeholder={idCardType === 'CCCD' ? '12 chá»¯ sá»‘ CCCD (VD: 079123456789)' : 'VD: B1234567 (1 chá»¯ cÃ¡i + 7-8 sá»‘)'}
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
                        <label htmlFor="booking-customer-email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Äá»‹a chá»‰ Email nháº­n phiáº¿u &amp; HÄ <span className="text-red-500">*</span>
                        </label>
                      </div>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          id="booking-customer-email"
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
                      <label htmlFor="booking-special-notes" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Ghi chÃº vá» tÃ i sáº£n lÆ°u trá»¯ hoáº·c yÃªu cáº§u há»— trá»£ (tÃ¹y chá»n)
                      </label>
                      <span className={`text-[10px] ${specialNotes.length > 500 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                        {specialNotes.length}/500 kÃ½ tá»±
                      </span>
                    </div>
                    <input
                      id="booking-special-notes"
                      type="text"
                      maxLength={500}
                      value={specialNotes}
                      onChange={(e) => {
                        setSpecialNotes(e.target.value)
                        if (formErrors.specialNotes) setFormErrors((prev) => ({ ...prev, specialNotes: '' }))
                      }}
                      placeholder="VD: Cáº§n há»— trá»£ xe Ä‘áº©y hÃ ng, chuyá»ƒn Ä‘á»“ cÄƒn há»™, hÃ ng dá»… vá»¡..."
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                    />
                    {formErrors.specialNotes && (
                      <p className="mt-1 text-xs text-red-600 font-medium">{formErrors.specialNotes}</p>
                    )}
                  </div>
                </div>

                {/* 3. POLICY ACCEPTANCE */}
                <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2">
                  <label htmlFor="booking-policy-checkbox" className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      id="booking-policy-checkbox"
                      type="checkbox"
                      checked={policyAccepted}
                      onChange={(e) => {
                        setPolicyAccepted(e.target.checked)
                        if (formErrors.policyAccepted) setFormErrors((prev) => ({ ...prev, policyAccepted: '' }))
                      }}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="leading-relaxed">
                      TÃ´i xÃ¡c nháº­n thÃ´ng tin trÃªn lÃ  chÃ­nh xÃ¡c vÃ  Ä‘á»“ng Ã½ vá»›i{' '}
                      <Link to="/policies" target="_blank" className="text-blue-600 dark:text-blue-400 underline font-semibold">
                        Quy cháº¿ giá»¯ chá»— &amp; Báº£o máº­t kho tá»± quáº£n Boxora
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
                          TÃ³m táº¯t buá»“ng kho
                        </span>
                        <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                          Kho {currentSelectedSize.volumeText} ({isAcActive ? 'MÃ¡y láº¡nh A/C' : 'TiÃªu chuáº©n'})
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
                        CÆ¡ sá»Ÿ:
                      </span>
                      <strong className="text-slate-900 dark:text-white font-semibold text-right max-w-[170px] truncate">
                        {selectedFacility?.name}
                      </strong>
                    </div>

                    <div className="flex justify-between items-start text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} className="text-blue-600 dark:text-blue-400" />
                        Thá»i háº¡n thuÃª:
                      </span>
                      <strong className="text-slate-900 dark:text-white font-semibold">
                        {rentalDurationText}
                      </strong>
                    </div>

                    <div className="flex justify-between items-start text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-blue-600 dark:text-blue-400" />
                        Lá»‹ch háº¹n nháº­n kho:
                      </span>
                      <strong className="text-blue-600 dark:text-blue-400 font-semibold text-right">
                        {formatDateDDMMYYYY(checkInDate)} â€¢ {selectedPeriod.name}
                      </strong>
                    </div>

                    {/* Price Breakdown */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Tiá»n thuÃª kho ({rentalDurationText}):</span>
                        <strong className="text-slate-900 dark:text-white">{quoteCalculation.totalRent.toLocaleString('vi-VN')} â‚«</strong>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Cá»c báº£o Ä‘áº£m (hoÃ n láº¡i):</span>
                        <strong className="text-slate-900 dark:text-white">{quoteCalculation.depositAmount.toLocaleString('vi-VN')} â‚«</strong>
                      </div>
                      <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-baseline">
                        <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">Tá»•ng cá»™ng:</span>
                        <strong className="text-base sm:text-lg font-extrabold text-blue-600 dark:text-blue-400">
                          {quoteCalculation.totalEstimate.toLocaleString('vi-VN')} â‚«
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
        {/* BÆ¯á»šC 5: Há»¢P Äá»’NG & THANH TOÃN                                  */}
        {/* ============================================================== */}
        {currentStep === 5 && (
          <div className="space-y-3.5 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2 border-b border-slate-200/80 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200/60 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                  <FileCheck2 size={12} />
                  <span>BÆ°á»›c 5 / 6 â€¢ Há»£p Ä‘á»“ng &amp; Thanh toÃ¡n</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Há»£p Ä‘á»“ng &amp; Thanh toÃ¡n
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Vui lÃ²ng lá»±a chá»n hÃ¬nh thá»©c kÃ½ káº¿t há»£p Ä‘á»“ng vÃ  phÆ°Æ¡ng thá»©c thanh toÃ¡n phÃ¹ há»£p vá»›i quÃ½ khÃ¡ch.
                </p>
              </div>
            </div>

            {isStaffOrManager && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
                <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-950 dark:text-amber-100">
                    Chá»‰ tÃ i khoáº£n khÃ¡ch hÃ ng má»›i thá»±c hiá»‡n Ä‘áº·t Ä‘Æ°á»£c kho
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    Báº¡n Ä‘ang Ä‘Äƒng nháº­p báº±ng tÃ i khoáº£n <strong>{getRoleDisplayName(userRole)}</strong> ({user?.fullName || user?.username || user?.email}). CÃ¡c vai trÃ² quáº£n trá»‹ vÃ  nhÃ¢n viÃªn chá»‰ cÃ³ thá»ƒ xem bÃ¡o giÃ¡ vÃ  quy trÃ¬nh á»Ÿ BÆ°á»›c 5. Äá»ƒ thá»±c hiá»‡n kÃ½ káº¿t há»£p Ä‘á»“ng Ä‘iá»‡n tá»­ vÃ  thanh toÃ¡n giá»¯ chá»—, vui lÃ²ng Ä‘Äƒng nháº­p báº±ng tÃ i khoáº£n KhÃ¡ch hÃ ng (Customer).
                  </p>
                </div>
              </div>
            )}

            {submitError && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs sm:text-sm flex items-center gap-2.5">
                <AlertCircle size={18} className="shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {contractInvalidatedByChange && !isContractAlreadySigned && paymentMethod === 'ONLINE' && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
                <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-950 dark:text-amber-100">
                    ThÃ´ng tin Ä‘áº·t kho cá»§a quÃ½ khÃ¡ch Ä‘Ã£ thay Ä‘á»•i so vá»›i há»£p Ä‘á»“ng Ä‘Ã£ kÃ½ trÆ°á»›c Ä‘Ã³. Vui lÃ²ng xem láº¡i vÃ  kÃ½ há»£p Ä‘á»“ng má»›i trÆ°á»›c khi thanh toÃ¡n.
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    Há»£p Ä‘á»“ng cÅ© cá»§a Ä‘Æ¡n <strong>#{createdBookingForSigning?.bookingCode || bookingCode}</strong> Ä‘Ã£ Ä‘Æ°á»£c chuyá»ƒn sang tráº¡ng thÃ¡i háº¿t hiá»‡u lá»±c (SUPERSEDED). QuÃ½ khÃ¡ch vui lÃ²ng nháº¥n nÃºt <strong>"Xem vÃ  kÃ½ láº¡i há»£p Ä‘á»“ng"</strong> bÃªn dÆ°á»›i Ä‘á»ƒ kiá»ƒm tra vÃ  kÃ½ láº¡i há»£p Ä‘á»“ng má»›i theo thÃ´ng tin vá»«a cáº­p nháº­t.
                  </p>
                </div>
              </div>
            )}

            {isContractAlreadySigned && paymentMethod === 'ONLINE' && (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
                <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-emerald-950 dark:text-emerald-100">
                    Há»£p Ä‘á»“ng Ä‘iá»‡n tá»­ Ä‘Ã£ Ä‘Æ°á»£c kÃ½ káº¿t thÃ nh cÃ´ng!
                  </p>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    ÄÆ¡n Ä‘áº·t chá»— <strong>#{createdBookingForSigning?.bookingCode || bookingCode}</strong> Ä‘Ã£ hoÃ n táº¥t kÃ½ káº¿t há»£p Ä‘á»“ng. QuÃ½ khÃ¡ch vui lÃ²ng nháº¥n nÃºt <strong>"Tiáº¿p tá»¥c thá»±c hiá»‡n thanh toÃ¡n"</strong> bÃªn dÆ°á»›i Ä‘á»ƒ hoÃ n táº¥t giao dá»‹ch qua cá»•ng thanh toÃ¡n VNPay.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
              
              {/* LEFT COLUMN: 2 CONTRACT & PAYMENT OPTIONS */}
              <div className="lg:col-span-7 space-y-3">
                
                {/* Option 1: KÃ½ há»£p Ä‘á»“ng vÃ  thanh toÃ¡n trá»±c tuyáº¿n */}
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
                            1. KÃ½ há»£p Ä‘á»“ng vÃ  thanh toÃ¡n trá»±c tuyáº¿n
                          </h3>
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider">
                            KhuyÃªn dÃ¹ng â€¢ KÃ­ch hoáº¡t ngay
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          KÃ½ há»£p Ä‘á»“ng Ä‘iá»‡n tá»­ DocuSeal trá»±c tiáº¿p trÃªn há»‡ thá»‘ng vÃ  thanh toÃ¡n toÃ n bá»™ chi phÃ­ (bao gá»“m tiá»n thuÃª kho vÃ  tiá»n cá»c báº£o Ä‘áº£m) qua cá»•ng VNPay (VNPAY-QR, Tháº» ATM/Visa/Mastercard). Buá»“ng kho vÃ  mÃ£ PIN khÃ³a thÃ´ng minh sáº½ Ä‘Æ°á»£c cáº¥p ngay sau khi hoÃ n táº¥t.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Option 2: KÃ½ há»£p Ä‘á»“ng vÃ  thanh toÃ¡n táº¡i cÆ¡ sá»Ÿ vÃ o ngÃ y tá»›i nháº­n kho */}
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
                            2. KÃ½ há»£p Ä‘á»“ng vÃ  thanh toÃ¡n táº¡i cÆ¡ sá»Ÿ vÃ o ngÃ y tá»›i nháº­n kho
                          </h3>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-semibold">
                            0 â‚« hÃ´m nay
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          Äáº·t giá»¯ chá»— trÆ°á»›c Ä‘á»ƒ Boxora chuáº©n bá»‹ buá»“ng kho. QuÃ½ khÃ¡ch sáº½ kÃ½ káº¿t há»£p Ä‘á»“ng vÃ  thanh toÃ¡n trá»±c tuyáº¿n qua quÃ©t mÃ£ VietQR / cá»•ng VNPay trá»±c tiáº¿p khi Ä‘áº¿n nháº­n kho (Boxora Ã¡p dá»¥ng 100% thanh toÃ¡n sá»‘ khÃ´ng dÃ¹ng tiá»n máº·t).
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
                    XÃ¡c nháº­n Há»£p Ä‘á»“ng &amp; Thanh toÃ¡n
                  </h3>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>HÃ¬nh thá»©c Ä‘Ã£ chá»n:</span>
                      <strong className="text-blue-600 dark:text-blue-400 font-semibold text-right max-w-[200px]">
                        {paymentMethod === 'ONLINE' ? '1. KÃ½ HÄ & Thanh toÃ¡n trá»±c tuyáº¿n' : '2. KÃ½ HÄ & Thanh toÃ¡n táº¡i cÆ¡ sá»Ÿ'}
                      </strong>
                    </div>

                    <div className="flex justify-between text-slate-600 dark:text-slate-400 items-baseline">
                      <span>Sá»‘ tiá»n thanh toÃ¡n hÃ´m nay:</span>
                      <strong className="text-slate-900 dark:text-white font-extrabold text-base sm:text-lg">
                        {paymentMethod === 'ONLINE' ? `${quoteCalculation.totalEstimate.toLocaleString('vi-VN')} â‚«` : '0 â‚«'}
                      </strong>
                    </div>

                    {paymentMethod === 'ONLINE' ? (
                      <div className="space-y-1 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 leading-relaxed">
                        <div className="flex justify-between">
                          <span>Tiá»n thuÃª kho ({rentalDurationText}):</span>
                          <strong className="text-slate-700 dark:text-slate-300 font-semibold">{quoteCalculation.totalRent.toLocaleString('vi-VN')} â‚«</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Tiá»n cá»c báº£o Ä‘áº£m (hoÃ n láº¡i):</span>
                          <strong className="text-slate-700 dark:text-slate-300 font-semibold">{quoteCalculation.depositAmount.toLocaleString('vi-VN')} â‚«</strong>
                        </div>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium pt-1">
                          âœ“ Thanh toÃ¡n toÃ n bá»™ hÃ´m nay qua VNPay. Khi Ä‘áº¿n nháº­n kho quÃ½ khÃ¡ch khÃ´ng cáº§n thanh toÃ¡n thÃªm.
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          QuÃ½ khÃ¡ch khÃ´ng cáº§n thanh toÃ¡n trÆ°á»›c. Giá»¯ chá»— sáº½ Ä‘Æ°á»£c lÆ°u trÃªn há»‡ thá»‘ng, quÃ½ khÃ¡ch kÃ½ há»£p Ä‘á»“ng vÃ  thanh toÃ¡n táº¡i cÆ¡ sá»Ÿ vÃ o ngÃ y {formatDateDDMMYYYY(checkInDate)}.
                        </p>
                        {!isStaffOrManager && (
                          <div className="pt-2">
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => setShowPayLaterConfirmModal(true)}
                              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                            >
                              <CalendarCheck size={16} />
                              <span>XÃ¡c nháº­n (KÃ½ HÄ &amp; Thanh toÃ¡n táº¡i cÆ¡ sá»Ÿ)</span>
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {isStaffOrManager && (
                      <div className="pt-2.5 border-t border-amber-200 dark:border-amber-800/70">
                        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200 font-medium flex items-start gap-1.5">
                          <AlertCircle size={14} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                          <span>Chá»‰ tÃ i khoáº£n khÃ¡ch hÃ ng má»›i thá»±c hiá»‡n Ä‘áº·t Ä‘Æ°á»£c kho (TÃ i khoáº£n hiá»‡n táº¡i: <strong>{getRoleDisplayName(userRole)}</strong>).</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* BÆ¯á»šC 6: HOÃ€N Táº¤T GIá»® CHá»– (Task 2 Standardized)                  */}
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
                        <span>ÄÃ£ kÃ½ há»£p Ä‘á»“ng &amp; thanh toÃ¡n trá»±c tuyáº¿n thÃ nh cÃ´ng</span>
                      </>
                    ) : (
                      <>
                        <Clock size={13} />
                        <span>Äáº·t giá»¯ chá»— thÃ nh cÃ´ng â€¢ KÃ½ HÄ &amp; thanh toÃ¡n táº¡i cÆ¡ sá»Ÿ</span>
                      </>
                    )}
                  </span>

                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Cáº£m Æ¡n quÃ½ khÃ¡ch {customerName || ''}!
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                    Há»‡ thá»‘ng Boxora Ä‘Ã£ ghi nháº­n yÃªu cáº§u giá»¯ chá»— buá»“ng kho. NhÃ¢n viÃªn cÆ¡ sá»Ÿ sáº½ liÃªn há»‡ vÃ  chuáº©n bá»‹ Ä‘Ã³n tiáº¿p quÃ½ khÃ¡ch Ä‘Ãºng khung giá» Ä‘Ã£ háº¹n.
                  </p>
                </div>

                {/* Booking Code Card */}
                <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-800 max-w-sm mx-auto flex items-center justify-between gap-3">
                  <div className="text-left">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider block">
                      MÃ£ phiáº¿u giá»¯ chá»—
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
                    <span>{copiedCode ? 'ÄÃ£ chÃ©p' : 'Sao chÃ©p'}</span>
                  </button>
                </div>
              </div>

              {/* Summary Details */}
              <div className="p-4 sm:p-5 space-y-3 bg-slate-50/50 dark:bg-slate-900/50 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">CÆ¡ sá»Ÿ bÃ n giao</span>
                    <strong className="text-slate-900 dark:text-white block font-bold text-xs sm:text-sm">{selectedFacility?.name}</strong>
                    <span className="text-slate-500 block text-[11px] truncate">{selectedFacility?.address}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Lá»‹ch háº¹n Ä‘Ã³n tiáº¿p</span>
                    <strong className="text-blue-600 dark:text-blue-400 block font-bold text-xs sm:text-sm">{formatDateDDMMYYYY(checkInDate)}</strong>
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
                      Xem Ä‘Æ¡n Ä‘áº·t cá»§a tÃ´i
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate(`/login?redirect=${encodeURIComponent(`/portal/customer?tab=bookings&bookingCode=${bookingCode}`)}`)}
                      className="flex-1 py-2.5 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 text-center transition-all cursor-pointer"
                    >
                      ÄÄƒng nháº­p Ä‘á»ƒ theo dÃµi há»£p Ä‘á»“ng
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="flex-1 py-2.5 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs sm:text-sm text-center transition-colors cursor-pointer"
                  >
                    Vá» trang chá»§ Boxora
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
                    {currentStep === 2 && 'Quay láº¡i chá»n cÆ¡ sá»Ÿ'}
                    {currentStep === 3 && 'Quay láº¡i chá»n kho'}
                    {currentStep === 4 && 'Quay láº¡i bÃ¡o giÃ¡'}
                    {currentStep === 5 && 'Quay láº¡i thÃ´ng tin'}
                  </span>
                </button>
              ) : (
                <Link
                  to="/"
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
                >
                  <Home size={15} />
                  <span>Vá» trang chá»§</span>
                </Link>
              )}

              {/* Step Context Pill */}
              <div className="hidden md:flex items-center gap-2.5 pl-3.5 border-l border-slate-200 dark:border-slate-800 text-xs">
                {currentStep === 1 && (
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <MapPin size={14} className="text-blue-600" />
                    <span>CÆ¡ sá»Ÿ: <strong className="text-slate-900 dark:text-white">{selectedFacility ? selectedFacility.name : 'ChÆ°a chá»n'}</strong></span>
                  </span>
                )}
                {currentStep === 2 && (
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Box size={14} className="text-blue-600" />
                    <span>
                      Äang chá»n: <strong className="text-blue-600 dark:text-blue-400 font-bold">Kho {currentSelectedSize.volumeText}</strong> ({isAcActive ? 'MÃ¡y láº¡nh A/C' : 'TiÃªu chuáº©n'}) â€¢ <strong className="text-slate-900 dark:text-white">{quoteCalculation.baseMonthly.toLocaleString('vi-VN')} â‚«/thÃ¡ng</strong>
                    </span>
                  </span>
                )}
                {currentStep === 3 && (
                  <div className="flex items-center gap-2.5 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Thá»i háº¡n: <strong className="text-slate-900 dark:text-white">{rentalDurationText}</strong>
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">â€¢</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Tiá»n thuÃª: <strong className="text-slate-800 dark:text-slate-200">{quoteCalculation.totalRent.toLocaleString('vi-VN')} â‚«</strong>
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">â€¢</span>
                    <span className="text-slate-900 dark:text-white font-semibold">
                      Tá»•ng cá»™ng: <strong className="text-blue-600 dark:text-blue-400 font-extrabold">{quoteCalculation.totalEstimate.toLocaleString('vi-VN')} â‚«</strong>
                    </span>
                  </div>
                )}
                {currentStep === 4 && (
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Calendar size={14} className="text-blue-600" />
                    <span>
                      Nháº­n kho: <strong className="text-blue-600 dark:text-blue-400">{formatDateDDMMYYYY(checkInDate)} ({selectedPeriod.name})</strong> â€¢ NgÆ°á»i Ä‘áº·t: <strong className="text-slate-900 dark:text-white">{customerName || 'ChÆ°a Ä‘iá»n'}</strong>
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
                  <span>Tiáº¿p tá»¥c: Chá»n kho / loáº¡i kho</span>
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
                  <span>Tiáº¿p tá»¥c: Thá»i háº¡n thuÃª &amp; BÃ¡o giÃ¡</span>
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
                  <span>Tiáº¿p tá»¥c: Lá»‹ch háº¹n &amp; Chi tiáº¿t</span>
                  <ArrowRight size={16} />
                </button>
              )}

              {currentStep === 4 && (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Tiáº¿p tá»¥c: Há»£p Ä‘á»“ng &amp; Thanh toÃ¡n</span>
                  <ArrowRight size={16} />
                </button>
              )}

              {currentStep === 5 && (
                isStaffOrManager ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs sm:text-sm font-semibold shadow-xs">
                    <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Chá»‰ tÃ i khoáº£n khÃ¡ch hÃ ng má»›i thá»±c hiá»‡n Ä‘áº·t Ä‘Æ°á»£c kho</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      if (paymentMethod === 'ONLINE' && isContractAlreadySigned) {
                        void handleContinuePayment()
                      } else if (paymentMethod === 'PAY_LATER') {
                        setShowPayLaterConfirmModal(true)
                      } else {
                        void handleProcessPaymentAndConfirm()
                      }
                    }}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Äang xá»­ lÃ½...</span>
                      </span>
                    ) : (
                      <span>
                        {paymentMethod === 'ONLINE'
                          ? (isContractAlreadySigned
                              ? 'Tiáº¿p tá»¥c thá»±c hiá»‡n thanh toÃ¡n'
                              : (contractInvalidatedByChange
                                  ? 'Xem vÃ  kÃ½ láº¡i há»£p Ä‘á»“ng'
                                  : 'Tiáº¿n hÃ nh KÃ½ HÄ & Thanh toÃ¡n trá»±c tuyáº¿n'))
                          : 'XÃ¡c nháº­n (KÃ½ HÄ & Thanh toÃ¡n táº¡i cÆ¡ sá»Ÿ)'}
                      </span>
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
                  Chi tiáº¿t quy cÃ¡ch kho {inspectingSizeUnit.volumeText}
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {inspectingSizeUnit.dimensions} â€¢ {inspectingSizeUnit.areaM2} mÂ²
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Minh há»a khÃ´ng gian:
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
                    MÃ´ hÃ¬nh 3D
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
                    áº¢nh kho thá»±c táº¿
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
                      src={
                        (inspectingSizeUnit as any)?.imageUrl ||
                        getRealPhotoForSize(
                          inspectingSizeUnit.volumeNumber,
                          (acSelectionMap[inspectingSizeUnit.id] || 'NON_AC') === 'AC'
                        ).photoUrl
                      }
                      alt={`áº¢nh thá»±c táº¿ kho ${inspectingSizeUnit.volumeText}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.currentTarget
                        target.onerror = null
                        target.src = getRealPhotoForSize(
                          inspectingSizeUnit.volumeNumber,
                          (acSelectionMap[inspectingSizeUnit.id] || 'NON_AC') === 'AC'
                        ).photoUrl
                      }}
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
                <span className="text-slate-400 block text-[10px]">KÃCH THÆ¯á»šC:</span>
                <strong className="text-slate-900 dark:text-white">{inspectingSizeUnit.dimensions}</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-400 block text-[10px]">DIá»†N TÃCH Máº¶T SÃ€N:</span>
                <strong className="text-slate-900 dark:text-white">{inspectingSizeUnit.areaM2} mÂ²</strong>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                TÃ i sáº£n phÃ¹ há»£p lÆ°u trá»¯:
              </span>
              <ul className="grid grid-cols-1 gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                {inspectingSizeUnit.fitsDetailed.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="text-blue-600 text-sm">âœ“</span>
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
                Chá»n kÃ­ch thÆ°á»›c nÃ y
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

      {/* Modal cáº£nh bÃ¡o cÆ¡ sá»Ÿ chÆ°a cÃ³ kho kháº£ dá»¥ng */}
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

      {/* Modal KÃ½ Há»£p Äá»“ng Äiá»‡n Tá»­ DocuSeal (Theo kÃ­ch thÆ°á»›c Size_ID) */}
      {showDocuSealModal && contractForSigning && (
        <DocuSealSimulationModal
          contract={contractForSigning}
          booking={createdBookingForSigning}
          financialSummary={{
            sizeName: `Kho ${currentSelectedSize.volumeText} (${isAcActive ? 'MÃ¡y láº¡nh A/C' : 'TiÃªu chuáº©n'})`,
            rentalMonths: isCustomDuration ? Math.max(1, Math.round(customDays / 30)) : rentalMonths,
            monthlyFee: quoteCalculation.monthlyAfterDiscount,
            totalRent: quoteCalculation.totalRent,
            depositAmount: quoteCalculation.depositAmount,
            totalPayment: quoteCalculation.totalEstimate,
          }}
          onClose={() => setShowDocuSealModal(false)}
          onSignedSuccess={handleDocuSealSignedSuccess}
          onContractSigned={(signed) => {
            setHasSignedContract(true)
            setContractInvalidatedByChange(false)
            setSigningFormSnapshot(captureSigningSnapshot())
            setContractForSigning(signed)
            setCreatedBookingForSigning((prev: any) =>
              prev ? { ...prev, contractSigned: true, status: 'SIGNED_PENDING_PAYMENT', contractStatus: signed.status, contractCode: signed.contractCode } : prev
            )
          }}
        />
      )}

      {/* Modal nháº¯c Ä‘Äƒng nháº­p khi tá»« BÆ°á»›c 3 sang BÆ°á»›c 4 */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-2xl text-left animate-in zoom-in-95 duration-200 space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <LogIn size={24} />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                ÄÄƒng nháº­p Ä‘á»ƒ tiáº¿p tá»¥c Ä‘áº·t kho
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                QuÃ½ khÃ¡ch vui lÃ²ng Ä‘Äƒng nháº­p hoáº·c Ä‘Äƒng kÃ½ tÃ i khoáº£n Boxora Ä‘á»ƒ tiáº¿p tá»¥c sang BÆ°á»›c 4 (Lá»‹ch háº¹n &amp; ThÃ´ng tin ngÆ°á»i Ä‘áº·t). ThÃ´ng tin cÃ¡ nhÃ¢n cá»§a báº¡n sáº½ Ä‘Æ°á»£c tá»± Ä‘á»™ng Ä‘á»“ng bá»™ tá»« tÃ i khoáº£n há»“ sÆ¡!
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span>Kho lÆ°u trá»¯:</span>
                <strong className="text-slate-900 dark:text-white">{currentSelectedSize.volumeText} â€¢ {selectedFacility?.name}</strong>
              </div>
              <div className="flex justify-between">
                <span>Thá»i háº¡n thuÃª:</span>
                <strong className="text-slate-900 dark:text-white">{isCustomDuration ? `${customDays} ngÃ y` : `${rentalMonths} thÃ¡ng`}</strong>
              </div>
              <div className="flex justify-between">
                <span>Sá»‘ tiá»n táº¡m tÃ­nh:</span>
                <strong className="text-blue-600 dark:text-cyan-400 font-bold">{quoteCalculation.totalEstimate.toLocaleString('vi-VN')} â‚«</strong>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  const draft = {
                    facilityId: selectedFacility?.id,
                    facilityName: selectedFacility?.name,
                    facilityCode: selectedFacility?.code,
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
                  if (selectedFacility?.id) {
                    localStorage.setItem('boxora_selected_facility_id', selectedFacility.id)
                    sessionStorage.setItem('boxora_selected_facility_id', selectedFacility.id)
                  }
                  navigate('/login?redirect=/booking')
                }}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <LogIn size={16} />
                <span>ÄÄƒng nháº­p tÃ i khoáº£n</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const draft = {
                    facilityId: selectedFacility?.id,
                    facilityName: selectedFacility?.name,
                    facilityCode: selectedFacility?.code,
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
                  if (selectedFacility?.id) {
                    localStorage.setItem('boxora_selected_facility_id', selectedFacility.id)
                    sessionStorage.setItem('boxora_selected_facility_id', selectedFacility.id)
                  }
                  navigate('/register?redirect=/booking')
                }}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer text-center"
              >
                ÄÄƒng kÃ½ tÃ i khoáº£n má»›i
              </button>

              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors py-1 text-center"
              >
                ÄÃ³ng láº¡i &amp; Chá»‰nh sá»­a thÃ´ng tin
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
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block">Chi tiáº¿t buá»“ng kho</span>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Kho {inspectingSizeUnit.volumeText} ({inspectingSizeUnit.areaM2} mÂ²)
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
                <span className="text-slate-500">KÃ­ch thÆ°á»›c (DÃ—RÃ—C):</span>
                <strong className="text-slate-900 dark:text-white">{inspectingSizeUnit.dimensions}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Diá»‡n tÃ­ch sÃ n:</span>
                <strong className="text-slate-900 dark:text-white">{inspectingSizeUnit.areaM2} mÂ²</strong>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Váº­t dá»¥ng phÃ¹ há»£p:</span>
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
              Chá»n kÃ­ch thÆ°á»›c nÃ y
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

      {/* Cancellation Policy Confirm Modal (TrÆ°á»›c khi hiá»ƒn thá»‹ DocuSeal E-Contract) */}
      <CancellationPolicyConfirmModal
        isOpen={showPolicyConfirmModal}
        onClose={() => setShowPolicyConfirmModal(false)}
        onConfirm={handleConfirmCancellationPolicy}
        isSubmitting={isConfirmingPolicy}
        policyDetail={policyDetail}
        isLoadingPolicy={isLoadingPolicy}
        policyError={policyError}
        bookingInfo={{
          facilityName: selectedFacility?.name || 'CÆ¡ sá»Ÿ Boxora',
          unitName: `Kho ${currentSelectedSize.volumeText} (${isAcActive ? 'A/C MÃ¡y láº¡nh' : 'TiÃªu chuáº©n'})`,
          rentalDuration: rentalDurationText,
          startDate: startDate,
          endDate: rentalEndDate,
          totalRent: quoteCalculation.totalRent,
          depositAmount: quoteCalculation.depositAmount,
          totalPayment: quoteCalculation.totalEstimate,
          paymentMethodName: 'VNPay Sandbox (Thanh toÃ¡n trá»±c tuyáº¿n)',
        }}
      />

      {/* Pay Later Appointment Confirm Modal */}
      <PayLaterAppointmentConfirmModal
        isOpen={showPayLaterConfirmModal}
        onClose={() => setShowPayLaterConfirmModal(false)}
        isSubmitting={isSubmitting}
        onConfirm={async () => {
          setShowPayLaterConfirmModal(false)
          await handleProcessPaymentAndConfirm('PAY_LATER')
        }}
        facilityName={selectedFacility?.name}
        facilityAddress={selectedFacility?.address}
        unitName={`Kho ${currentSelectedSize.volumeText} (${isAcActive ? 'A/C MÃ¡y láº¡nh' : 'ThÆ°á»ng'})`}
        rentalDuration={rentalDurationText}
        checkInDate={checkInDate}
        checkInTime={checkInTime}
        customerName={customerName.trim()}
        customerPhone={customerPhone.trim()}
        customerIdCard={customerIdCard.trim()}
        totalEstimate={quoteCalculation.totalEstimate}
        depositAmount={quoteCalculation.depositAmount}
        rentAmount={quoteCalculation.totalRent}
      />

    </div>
  )
}
export default BookingPage
