import type { Booking, RentalContract } from '@/types'
import { formatDateTime } from '@/lib/format'
import type { Tone } from '@/components/ui'
import { getBookingPaymentStatusMeta, type StatusMeta } from '@/constants/statusMeta'
import { formatCheckIn } from './portal'

/**
 * Where a booking stands from the customer's point of view, and what to do next.
 * Pure functions: the page memoises one result per booking (buildBookingNoticeMap).
 */
export type BookingScenario =
  | 'CANCELLED_OR_OVERDUE'
  | 'ACTIVE'
  | 'ENDED'
  | 'RETURNING'
  | 'PENDING_APPROVAL'
  | 'AWAITING_PAYMENT'
  | 'PAID_SIGNED'
  | 'PAID_UNSIGNED'
  | 'UNPAID_IN_PERSON'

export interface BookingNoticeInfo {
  /** Contract created for this booking, matched by `contract.bookingId` only. */
  matchingContract?: RentalContract
  isPaid: boolean
  isContractSigned: boolean
  scenario: BookingScenario
  /** Waiting for check-in: reschedule and cancel are allowed. */
  isPendingCheckIn: boolean
  /** The existing booking can be paid online (never creates a new booking). */
  canPay: boolean
  /** A contract is waiting for the customer's electronic signature. */
  canSignOnline: boolean
}

export interface BookingNotice {
  tone: Tone
  title: string
  description: string
}

type ContractWithPaperCheck = RentalContract & { paperVerifiedAt?: string | null }

const CLOSED_CONTRACT_STATUSES = new Set(['CANCELLED', 'TERMINATED', 'EXPIRED'])

const upper = (value: string | null | undefined) => (value ?? '').trim().toUpperCase()

export function isContractSigned(contract: RentalContract | undefined): boolean {
  if (!contract) return false
  const status = upper(contract.status)
  return (
    status === 'ACTIVE' ||
    status === 'PENDING_ACTIVATION' ||
    Boolean(contract.signedAt) ||
    Boolean(contract.signedDocumentUrl) ||
    Boolean((contract as ContractWithPaperCheck).paperVerifiedAt) ||
    Boolean(contract.signatureData)
  )
}

/**
 * Contracts keyed by `bookingId`. When a booking has several contracts the one
 * that is still open wins. There is deliberately no unit-code fallback: a unit
 * rented again would otherwise match an older contract.
 */
export function buildContractIndex(contracts: RentalContract[]): Map<string, RentalContract> {
  const index = new Map<string, RentalContract>()
  for (const contract of contracts) {
    if (!contract.bookingId) continue
    const existing = index.get(contract.bookingId)
    if (!existing || (CLOSED_CONTRACT_STATUSES.has(upper(existing.status)) && !CLOSED_CONTRACT_STATUSES.has(upper(contract.status)))) {
      index.set(contract.bookingId, contract)
    }
  }
  return index
}

export function getBookingNoticeInfo(booking: Booking, contract?: RentalContract): BookingNoticeInfo {
  const status = upper(booking.status)
  const isPaid = upper(booking.paymentStatus) === 'PAID'
  const signed = status === 'ACTIVE' || isContractSigned(contract)
  const isPendingCheckIn = status === 'CONFIRMED' || status === 'PENDING_PAYMENT'

  let scenario: BookingScenario
  if (status === 'CANCELLED' || status === 'OVERDUE') scenario = 'CANCELLED_OR_OVERDUE'
  else if (status === 'ACTIVE') scenario = 'ACTIVE'
  else if (status === 'COMPLETED') scenario = 'ENDED'
  else if (status === 'CHECKOUT_REQUESTED' || status === 'INSPECTED') scenario = 'RETURNING'
  else if (status === 'PENDING_APPROVAL') scenario = 'PENDING_APPROVAL'
  else if (isPaid && signed) scenario = 'PAID_SIGNED'
  else if (isPaid) scenario = 'PAID_UNSIGNED'
  else if (status === 'PENDING_PAYMENT') scenario = 'AWAITING_PAYMENT'
  else scenario = 'UNPAID_IN_PERSON'

  const handedOver = Boolean(booking.handoverTime)
  return {
    matchingContract: contract,
    isPaid,
    isContractSigned: signed,
    scenario,
    isPendingCheckIn,
    // Online payment of the initial amount: a reservation waiting for payment, or a free hold not yet handed over.
    canPay: isPendingCheckIn && !isPaid && !handedOver,
    canSignOnline: scenario === 'PAID_UNSIGNED' && upper(contract?.status) === 'PENDING_SIGNATURE',
  }
}

/**
 * Badge for `booking.paymentStatus`. The online / counter payment covers the deposit and the first month
 * only, so a multi-month booking marked PAID is shown as "first instalment paid"; later months are billed
 * per period on the contract.
 */
export function getBookingPaymentBadge(booking: Pick<Booking, 'paymentStatus' | 'rentalMonths'>): StatusMeta | null {
  if (!booking.paymentStatus) return null
  const meta = getBookingPaymentStatusMeta(booking.paymentStatus)
  if (upper(booking.paymentStatus) === 'PAID' && (booking.rentalMonths ?? 0) > 1) {
    return { ...meta, label: 'Đã thanh toán đợt đầu' }
  }
  return meta
}

/** One notice per booking, computed once per (bookings, contracts) change. */
export function buildBookingNoticeMap(bookings: Booking[], contracts: RentalContract[]): Map<string, BookingNoticeInfo> {
  const index = buildContractIndex(contracts)
  const map = new Map<string, BookingNoticeInfo>()
  for (const booking of bookings) {
    const contract = index.get(booking.id) ?? (booking.bookingCode ? index.get(booking.bookingCode) : undefined)
    map.set(booking.id, getBookingNoticeInfo(booking, contract))
  }
  return map
}

/** Customer-facing explanation of the scenario, or null when nothing needs saying. */
export function getBookingNotice(booking: Booking, info: BookingNoticeInfo): BookingNotice | null {
  const holdUntil = booking.holdExpiresAt ? formatDateTime(booking.holdExpiresAt) : null
  const paymentDeadline = booking.paymentExpiresAt || booking.holdExpiresAt

  switch (info.scenario) {
    case 'CANCELLED_OR_OVERDUE':
      return upper(booking.status) === 'OVERDUE'
        ? {
            tone: 'danger',
            title: 'Đơn đã quá hạn',
            description: `${holdUntil ? `Hạn giữ chỗ đã kết thúc lúc ${holdUntil}. ` : ''}Liên hệ cơ sở nếu bạn cần hỗ trợ thêm.`,
          }
        : {
            tone: 'neutral',
            title: 'Đơn đã hủy',
            description: `${holdUntil ? `Hạn giữ chỗ kết thúc lúc ${holdUntil}. ` : ''}Kho đã được giải phóng theo chính sách của cơ sở.`,
          }
    case 'ACTIVE':
      return { tone: 'success', title: 'Kho đang hoạt động', description: 'Xem mã PIN và quản lý kho trong mục Kho của tôi.' }
    case 'RETURNING':
      return { tone: 'info', title: 'Đang xử lý trả kho', description: 'Cơ sở đang kiểm tra kho và hoàn tất thủ tục trả kho cho bạn.' }
    case 'PENDING_APPROVAL':
      return { tone: 'warning', title: 'Chờ cơ sở xác nhận', description: 'Yêu cầu thuê kho đang được cơ sở xem xét. Trạng thái sẽ tự cập nhật.' }
    case 'AWAITING_PAYMENT':
      return {
        tone: 'warning',
        title: 'Chờ thanh toán',
        description: `Hoàn tất thanh toán trực tuyến${paymentDeadline ? ` trước ${formatDateTime(paymentDeadline)}` : ''} để giữ kho cho bạn.`,
      }
    case 'PAID_SIGNED':
      return {
        tone: 'success',
        title: 'Đã thanh toán và ký hợp đồng',
        description: `Mang CCCD gốc đến cơ sở đúng lịch hẹn (${formatCheckIn(booking)}) để nhận bàn giao và mã PIN. Thời hạn thuê tính từ ngày nhận kho.`,
      }
    case 'PAID_UNSIGNED':
      return {
        tone: 'info',
        title: 'Đã thanh toán, chờ ký hợp đồng',
        description: info.canSignOnline
          ? 'Ký hợp đồng điện tử ngay, hoặc ký tại cơ sở khi mang CCCD gốc đến nhận kho.'
          : 'Bạn sẽ ký hợp đồng tại cơ sở khi mang CCCD gốc đến nhận kho.',
      }
    case 'UNPAID_IN_PERSON':
      return {
        tone: 'warning',
        title: 'Thanh toán và ký hợp đồng khi nhận kho',
        description: `Kho được giữ cho bạn đến ${holdUntil ?? 'hết thời gian giữ chỗ theo chính sách'}. Mang CCCD gốc đến cơ sở để xem kho, ký hợp đồng và thanh toán tại quầy, hoặc thanh toán trực tuyến trước qua VNPay.`,
      }
    case 'ENDED':
    default:
      return null
  }
}
