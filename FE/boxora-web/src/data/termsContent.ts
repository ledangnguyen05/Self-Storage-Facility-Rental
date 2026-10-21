import { Ban, CalendarClock, FileSignature, Lock, ThermometerSun, Wallet, type LucideIcon } from 'lucide-react'
import { formatCurrency } from '../lib/format'
import { FACILITY_POLICY_DEFAULTS as POLICY } from '../utils/facilityPolicyDefaults'

/**
 * Single source of the "Điều khoản và quy chuẩn" copy, rendered by both
 * TermsAndStandardsPage and TermsAndStandardsModal. Numbers are the platform
 * defaults (`FACILITY_POLICY_DEFAULTS`); each facility may configure its own,
 * and the signed rental contract always prevails.
 */

export interface TermsItem {
  label: string
  detail: string
}

export interface TermsModule {
  id: string
  title: string
  summary: string
  icon: LucideIcon
  /** One headline fact shown under the title. */
  highlight: { label: string; value: string }
  items: readonly TermsItem[]
}

export const TERMS_INTRO = {
  title: 'Điều khoản và quy chuẩn vận hành kho',
  description:
    'Những quy định chính khi thuê kho tại Boxora. Mức áp dụng cụ thể của từng cơ sở và điều khoản trong hợp đồng thuê là căn cứ cuối cùng.',
  note: 'Các con số trên là mức mặc định của hệ thống. Cơ sở có thể cấu hình mức khác và sẽ ghi rõ trong hợp đồng của bạn.',
} as const

export const TERMS_MODULES: readonly TermsModule[] = [
  {
    id: 'contract',
    title: 'Hợp đồng và thời hạn thuê',
    summary: 'Hợp đồng điện tử, thời hạn thuê và thanh toán.',
    icon: FileSignature,
    highlight: { label: 'Thời hạn thuê tối thiểu', value: `${POLICY.minimumRentalMonths} tháng` },
    items: [
      {
        label: 'Hợp đồng điện tử',
        detail:
          'Bạn ký hợp đồng thuê trực tuyến, xác thực bằng mã OTP gửi tới email. Bản ký được lưu trong cổng khách hàng để xem lại bất kỳ lúc nào.',
      },
      {
        label: 'Thanh toán',
        detail:
          'Thanh toán trực tuyến qua VNPay khi đặt kho. Cơ sở có thể ghi nhận thêm thanh toán tiền mặt hoặc chuyển khoản và cấp biên nhận.',
      },
      {
        label: 'Gia hạn',
        detail: `Bạn có thể yêu cầu gia hạn trực tuyến trong khoảng ${POLICY.renewalWindowDays} ngày trước khi hợp đồng kết thúc.`,
      },
    ],
  },
  {
    id: 'access',
    title: 'Truy cập và an ninh',
    summary: 'Khóa điện tử riêng cho từng kho và giám sát khu vực chung.',
    icon: Lock,
    highlight: { label: 'Giờ ra vào', value: '24/7' },
    items: [
      {
        label: 'Mã PIN và mã QR',
        detail:
          'Mã PIN được kích hoạt sau khi hợp đồng có hiệu lực và nhân viên hoàn tất bàn giao. Người thuê tự bảo quản mã và không chia sẻ cho người không được ủy quyền.',
      },
      {
        label: 'Giám sát khu vực chung',
        detail:
          'Camera giám sát hành lang và lối đi chung. Boxora không lắp camera hướng vào bên trong không gian riêng của kho.',
      },
      {
        label: 'Nhật ký ra vào',
        detail: 'Mỗi lần mở khóa được ghi lại để phục vụ đối chiếu khi có sự cố.',
      },
    ],
  },
  {
    id: 'environment',
    title: 'Môi trường và an toàn',
    summary: 'Điều kiện bảo quản và phòng cháy chữa cháy.',
    icon: ThermometerSun,
    highlight: { label: 'Kho mát', value: '20 – 25 °C' },
    items: [
      {
        label: 'Kiểm soát khí hậu',
        detail: 'Kho mát giữ nhiệt độ 20 – 25 °C và độ ẩm 45 – 55 % để hạn chế ẩm mốc cho thiết bị điện tử, tài liệu và đồ da.',
      },
      {
        label: 'Phòng cháy chữa cháy',
        detail: 'Cơ sở trang bị hệ thống báo cháy và chữa cháy theo quy định hiện hành. Người thuê tuân thủ nội quy PCCC của cơ sở.',
      },
      {
        label: 'Vệ sinh và trật tự',
        detail: 'Giữ lối đi chung thông thoáng, không để hàng hóa ngoài phạm vi kho và không gây ảnh hưởng tới khách thuê khác.',
      },
    ],
  },
  {
    id: 'deposit',
    title: 'Đặt cọc, hủy và hoàn tiền',
    summary: 'Cách tính hoàn tiền khi hủy đặt kho và khi trả kho.',
    icon: Wallet,
    highlight: { label: 'Hoàn cọc sau trả kho', value: `Tối đa ${POLICY.depositRefundSlaDays} ngày làm việc` },
    items: [
      {
        label: 'Hủy trước giờ hẹn nhận kho',
        detail: `Từ ${POLICY.cancellationFullRefundHours} giờ trở lên: hoàn đầy đủ. Từ ${POLICY.cancellationPartialRefundHours} đến ${POLICY.cancellationFullRefundHours} giờ: hoàn ${POLICY.cancellationPartialRefundPercent}%. Dưới ${POLICY.cancellationPartialRefundHours} giờ: không hoàn.`,
      },
      {
        label: 'Hoàn cọc khi trả kho',
        detail: `Sau khi bạn dọn kho và nhân viên nghiệm thu hiện trạng, tiền cọc được hoàn trong tối đa ${POLICY.depositRefundSlaDays} ngày làm việc, sau khi trừ các khoản phát sinh nếu có.`,
      },
      {
        label: 'Thông báo trả kho',
        detail:
          POLICY.returnNoticeDays > 0
            ? `Bạn cần báo trước ${POLICY.returnNoticeDays} ngày khi muốn trả kho.`
            : 'Bạn có thể gửi yêu cầu trả kho trong cổng khách hàng, không cần báo trước một số ngày tối thiểu.',
      },
    ],
  },
  {
    id: 'overdue',
    title: 'Quá hạn thanh toán',
    summary: 'Ân hạn, phí trễ hạn và các bước xử lý.',
    icon: CalendarClock,
    highlight: { label: 'Phí trễ hạn', value: `${formatCurrency(POLICY.dailyLateFee)} mỗi ngày` },
    items: [
      {
        label: 'Ân hạn',
        detail: `Sau ngày đến hạn, bạn có ${POLICY.overdueGraceDays} ngày ân hạn trước khi phí trễ hạn bắt đầu được tính.`,
      },
      {
        label: 'Tạm khóa quyền mở khóa',
        detail: `Sau ${POLICY.overdueAccessDisableDays} ngày quá hạn, quyền mở khóa của kho có thể bị tạm khóa cho tới khi hoàn tất thanh toán.`,
      },
      {
        label: 'Niêm phong kho',
        detail: `Sau ${POLICY.overdueSealingDays} ngày quá hạn, cơ sở có thể niêm phong kho theo quy trình và thông báo trước cho người thuê.`,
      },
    ],
  },
  {
    id: 'prohibited',
    title: 'Hàng hóa bị cấm',
    summary: 'Bảo vệ an toàn cho mọi khách thuê và tuân thủ pháp luật.',
    icon: Ban,
    highlight: { label: 'Vi phạm', value: 'Có thể chấm dứt hợp đồng' },
    items: [
      {
        label: 'Chất dễ cháy nổ và hóa chất',
        detail: 'Xăng dầu, bình gas, khí nén, pháo hoa, ắc quy hở, hóa chất ăn mòn hoặc độc hại.',
      },
      {
        label: 'Hàng hóa vi phạm pháp luật',
        detail: 'Ma túy, vũ khí, vật liệu nổ, hàng lậu hoặc tài sản có nguồn gốc bất hợp pháp.',
      },
      {
        label: 'Sinh vật sống và thực phẩm tươi',
        detail: 'Động vật, cây sống và thực phẩm tươi sống dễ gây mùi, vi khuẩn hoặc thu hút côn trùng.',
      },
    ],
  },
]
