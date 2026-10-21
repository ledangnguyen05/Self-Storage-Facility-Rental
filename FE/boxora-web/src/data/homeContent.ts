import {
  CalendarCheck,
  Clock,
  CreditCard,
  FileSignature,
  KeyRound,
  Lock,
  MapPin,
  PhoneCall,
  Search,
  ShieldCheck,
  Thermometer,
  type LucideIcon,
} from 'lucide-react'
import { SITE_CONFIG } from '../constants/siteConfig'
import { formatCurrency } from '../lib/format'
import { FACILITY_POLICY_DEFAULTS as POLICY } from '../utils/facilityPolicyDefaults'
import type { SizeBucket } from './storageUnitsData'

/**
 * Copy for the public landing page. The home sections only map over these
 * arrays. One consistent set of facts is used everywhere:
 *  - rental term: minimum 1 month
 *  - climate-controlled units: 20 – 25 °C, humidity 45 – 55 %
 *  - policy numbers come from `FACILITY_POLICY_DEFAULTS` (each facility can differ)
 *  - no insurance claims (nothing in the product backs them up)
 */

export interface NavItem {
  label: string
  to: string
}

/** Header and footer navigation. Hash links scroll on the home page (see `useHashScroll`). */
export const PUBLIC_NAV: readonly NavItem[] = [
  { label: 'Thuê kho', to: '/units' },
  { label: 'Bảng giá và kích thước', to: '/#size-guide' },
  { label: 'Chi nhánh', to: '/#facilities' },
  { label: 'Hỏi đáp', to: '/#faq' },
]

export const HERO_CONTENT = {
  eyebrow: 'Kho tự quản thông minh',
  title: 'Thuê kho tự quản, vào kho bất cứ lúc nào bằng mã PIN riêng',
  description:
    'Chọn kho phù hợp, ký hợp đồng điện tử và thanh toán trực tuyến. Giá niêm yết rõ ràng trước khi đặt, thời hạn thuê tối thiểu 1 tháng.',
  primaryCta: 'Tìm kho trống',
  secondaryCta: 'Xem bảng giá',
  points: ['Hợp đồng điện tử', 'Thanh toán qua VNPay', 'Ra vào 24/7'],
} as const

export interface IconItem {
  icon: LucideIcon
  title: string
  description: string
}

export const TRUST_ITEMS: readonly IconItem[] = [
  { icon: Lock, title: 'Khóa điện tử riêng', description: 'Mỗi kho có mã PIN và mã QR riêng' },
  { icon: Clock, title: 'Ra vào 24/7', description: 'Cả ban đêm và ngày lễ' },
  { icon: FileSignature, title: 'Hợp đồng điện tử', description: 'Ký trực tuyến, lưu trên tài khoản' },
  { icon: Thermometer, title: 'Kho mát 20 – 25 °C', description: 'Cho đồ điện tử, tài liệu, đồ da' },
]

export interface Step {
  title: string
  description: string
  icon: LucideIcon
}

export const HOW_IT_WORKS = {
  title: 'Thuê kho trong 3 bước',
  description: 'Toàn bộ quy trình đặt kho, ký hợp đồng và thanh toán diễn ra trực tuyến.',
  steps: [
    {
      icon: Search,
      title: 'Chọn kho',
      description:
        'Lọc theo cơ sở, diện tích và giá thuê. Nhập địa chỉ hoặc bật định vị để xem khoảng cách tới từng cơ sở.',
    },
    {
      icon: CreditCard,
      title: 'Ký hợp đồng và đặt cọc',
      description: 'Xác nhận thời hạn thuê, ký hợp đồng điện tử và thanh toán an toàn qua cổng VNPay.',
    },
    {
      icon: KeyRound,
      title: 'Nhận mã PIN và dùng kho',
      description:
        'Sau khi hoàn tất bàn giao tại cơ sở, mã PIN riêng của kho được kích hoạt. Bạn quản lý hợp đồng và mã PIN trong cổng khách hàng.',
    },
  ] satisfies readonly Step[],
} as const

export interface SizeTier {
  id: string
  name: string
  /** Same bucket the explorer filters by (`/units?size=...`). */
  bucket: SizeBucket
  areaLabel: string
  description: string
  fits: readonly string[]
  bestFor: string
  /** Unit types in this area range feed the "Giá từ" line. */
  minArea: number
  maxArea: number
}

export const SIZE_GUIDE = {
  title: 'Chọn đúng kích thước',
  description: 'Gợi ý theo diện tích để bạn hình dung nhanh. Giá thuê thực tế hiển thị theo từng kho khi đặt.',
  tiers: [
    {
      id: 'locker',
      name: 'Kho nhỏ',
      bucket: 'under3',
      areaLabel: 'Dưới 3 m²',
      description: 'Cho tư trang cá nhân, vali, tài liệu và đồ thể thao.',
      fits: ['Vali và thùng carton', 'Giấy tờ, hồ sơ đóng hộp', 'Đồ thể thao, thiết bị cá nhân'],
      bestFor: 'Sinh viên, người đi công tác',
      minArea: 0,
      maxArea: 3,
    },
    {
      id: 'standard',
      name: 'Kho tiêu chuẩn',
      bucket: '3to8',
      areaLabel: '3 – 8 m²',
      description: 'Đủ chỗ cho đồ đạc của một phòng khi chuyển trọ hoặc sửa nhà.',
      fits: ['Xe máy hoặc xe đạp điện', 'Bàn ghế, tủ kệ nhỏ', 'Nhiều thùng đồ gia dụng'],
      bestFor: 'Hộ gia đình, shop online',
      minArea: 3,
      maxArea: 8,
    },
    {
      id: 'large',
      name: 'Kho lớn',
      bucket: '8to15',
      areaLabel: '8 – 15 m²',
      description: 'Cho nội thất cồng kềnh hoặc đồ đạc của cả căn hộ.',
      fits: ['Sofa, giường, tủ lạnh', 'Máy giặt, bộ bàn ăn', 'Hàng mẫu, thiết bị văn phòng'],
      bestFor: 'Cải tạo nhà, chuyển nhà',
      minArea: 8,
      maxArea: 15,
    },
    {
      id: 'enterprise',
      name: 'Kho doanh nghiệp',
      bucket: '15plus',
      areaLabel: 'Trên 15 m²',
      description: 'Cho hàng tồn kho, hồ sơ chứng từ và thiết bị sự kiện số lượng lớn.',
      fits: ['Pallet hàng hóa', 'Hồ sơ chứng từ lưu trữ', 'Thiết bị triển lãm, sự kiện'],
      bestFor: 'Doanh nghiệp, đại lý phân phối',
      minArea: 15,
      maxArea: Number.POSITIVE_INFINITY,
    },
  ] satisfies readonly SizeTier[],
} as const

export const FEATURES_CONTENT = {
  title: 'Những gì bạn nhận được',
  description: 'Mọi kho đều có khóa điện tử riêng, quy trình số hóa và hỗ trợ trực tiếp từ cơ sở.',
  items: [
    {
      icon: KeyRound,
      title: 'Mã PIN và mã QR riêng',
      description:
        'Mỗi kho có khóa điện tử độc lập. Bạn mở kho bằng mã PIN hoặc mã QR, không cần chìa khóa và không phải chờ nhân viên.',
    },
    {
      icon: FileSignature,
      title: 'Hợp đồng điện tử',
      description: 'Ký hợp đồng trực tuyến, xem lại và theo dõi thời hạn thuê, gia hạn ngay trong tài khoản.',
    },
    {
      icon: Thermometer,
      title: 'Kiểm soát khí hậu',
      description: 'Kho mát giữ nhiệt độ 20 – 25 °C và độ ẩm 45 – 55 %, hạn chế ẩm mốc cho đồ điện tử, tài liệu và đồ da.',
    },
    {
      icon: ShieldCheck,
      title: 'An ninh và nhật ký ra vào',
      description: 'Camera giám sát khu vực chung, không quay vào bên trong kho. Mọi lần mở khóa đều được ghi lại.',
    },
    {
      icon: CalendarCheck,
      title: 'Linh hoạt thời hạn',
      description: `Thuê tối thiểu ${POLICY.minimumRentalMonths} tháng và gia hạn trực tuyến khi cần, không phải ký lại từ đầu.`,
    },
    {
      icon: PhoneCall,
      title: 'Hỗ trợ trực tiếp',
      description: `Hotline ${SITE_CONFIG.hotline.display} (${SITE_CONFIG.hotline.hours}), email ${SITE_CONFIG.supportEmail} và nhân viên tại cơ sở.`,
    },
  ] satisfies readonly IconItem[],
} as const

export const FACILITIES_CONTENT = {
  title: 'Hệ thống cơ sở',
  description: 'Chọn cơ sở gần bạn nhất. Số kho trống được cập nhật theo dữ liệu thực tế.',
  icon: MapPin,
} as const

export type FaqCategoryId = 'ALL' | 'ACCESS' | 'CONTRACT' | 'FACILITY'

export interface FaqCategory {
  id: FaqCategoryId
  label: string
}

export const FAQ_CATEGORIES: readonly FaqCategory[] = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'ACCESS', label: 'Truy cập và bảo mật' },
  { id: 'CONTRACT', label: 'Hợp đồng và chi phí' },
  { id: 'FACILITY', label: 'Cơ sở và hàng hóa' },
]

export interface FaqItem {
  id: string
  category: Exclude<FaqCategoryId, 'ALL'>
  question: string
  answer: string
}

const POLICY_NOTE = 'Mỗi cơ sở có thể điều chỉnh các mức này, thông tin chính xác nằm trong hợp đồng thuê.'

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: 'access-24-7',
    category: 'ACCESS',
    question: 'Tôi có thể vào kho ban đêm hoặc ngày lễ không?',
    answer:
      'Có. Mỗi kho có khóa điện tử riêng hoạt động 24/7. Bạn mở kho bằng mã PIN hoặc mã QR của mình mà không cần báo trước hay chờ nhân viên.',
  },
  {
    id: 'access-pin',
    category: 'ACCESS',
    question: 'Khi nào tôi nhận được mã PIN?',
    answer:
      'Sau khi bạn thanh toán, ký hợp đồng điện tử và nhân viên cơ sở hoàn tất biên bản bàn giao, mã PIN riêng của kho được kích hoạt. Bạn xem và đổi mã trong cổng khách hàng.',
  },
  {
    id: 'access-handover',
    category: 'ACCESS',
    question: 'Tôi cần mang gì khi đến nhận kho?',
    answer:
      'Hãy mang căn cước công dân bản gốc để nhân viên đối chiếu thông tin và nghiệm thu kho cùng bạn. Lịch hẹn nhận kho hiển thị trong cổng khách hàng sau khi đặt.',
  },
  {
    id: 'contract-term',
    category: 'CONTRACT',
    question: 'Thời hạn thuê tối thiểu là bao lâu?',
    answer: `Thời hạn thuê tối thiểu là ${POLICY.minimumRentalMonths} tháng. Bạn có thể gia hạn trực tuyến trong cổng khách hàng khi sắp đến hạn.`,
  },
  {
    id: 'contract-deposit',
    category: 'CONTRACT',
    question: 'Tiền cọc được tính và hoàn lại như thế nào?',
    answer: `Số tiền cọc hiển thị rõ ở bước đặt kho. Sau khi trả kho và nghiệm thu, tiền cọc được hoàn trong tối đa ${POLICY.depositRefundSlaDays} ngày làm việc. ${POLICY_NOTE}`,
  },
  {
    id: 'contract-cancel',
    category: 'CONTRACT',
    question: 'Nếu tôi hủy đặt kho thì được hoàn bao nhiêu?',
    answer: `Hủy trước giờ hẹn nhận kho từ ${POLICY.cancellationFullRefundHours} giờ trở lên được hoàn đầy đủ. Hủy trong khoảng ${POLICY.cancellationPartialRefundHours} đến ${POLICY.cancellationFullRefundHours} giờ được hoàn ${POLICY.cancellationPartialRefundPercent}%. Hủy muộn hơn sẽ không được hoàn. ${POLICY_NOTE}`,
  },
  {
    id: 'contract-overdue',
    category: 'CONTRACT',
    question: 'Điều gì xảy ra nếu tôi thanh toán trễ?',
    answer: `Sau ${POLICY.overdueGraceDays} ngày ân hạn, phí trễ hạn là ${formatCurrency(POLICY.dailyLateFee)} mỗi ngày. Quyền mở khóa có thể bị tạm khóa sau ${POLICY.overdueAccessDisableDays} ngày quá hạn và kho có thể bị niêm phong sau ${POLICY.overdueSealingDays} ngày. ${POLICY_NOTE}`,
  },
  {
    id: 'contract-payment',
    category: 'CONTRACT',
    question: 'Tôi thanh toán bằng cách nào?',
    answer:
      'Bạn thanh toán trực tuyến qua cổng VNPay ngay khi đặt kho. Cơ sở cũng ghi nhận thanh toán tiền mặt hoặc chuyển khoản trong trường hợp cần thiết.',
  },
  {
    id: 'facility-prohibited',
    category: 'FACILITY',
    question: 'Những loại hàng nào không được gửi trong kho?',
    answer:
      'Không lưu trữ chất dễ cháy nổ, hóa chất độc hại, hàng hóa vi phạm pháp luật, động vật sống và thực phẩm tươi sống. Danh mục đầy đủ có trong trang Điều khoản và quy chuẩn.',
  },
  {
    id: 'facility-climate',
    category: 'FACILITY',
    question: 'Kho mát khác kho thường ở điểm nào?',
    answer:
      'Kho mát giữ nhiệt độ 20 – 25 °C và độ ẩm 45 – 55 %, phù hợp với thiết bị điện tử, tài liệu, đồ da và đồ sưu tầm. Bạn lọc loại kho này ở trang Thuê kho.',
  },
]

export const FINAL_CTA = {
  title: 'Sẵn sàng tìm kho phù hợp?',
  description: 'Xem kho trống theo cơ sở và diện tích, đặt giữ chỗ trực tuyến chỉ trong vài phút.',
  primary: 'Tìm kho trống',
  secondary: `Gọi ${SITE_CONFIG.hotline.display}`,
} as const
