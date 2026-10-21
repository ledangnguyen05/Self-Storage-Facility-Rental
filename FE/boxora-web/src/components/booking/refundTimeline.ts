import { Banknote, CheckCircle2, CircleDot, FileCheck2, Send, ShieldCheck, XCircle } from 'lucide-react'
import type { TimelineItem } from '../ui'
import { formatDateTime } from '../../lib/format'
import type { RefundRequestItem } from '../../services/refundService'

/** Stages of a refund, for a compact progress label. */
export const REFUND_STAGE_ORDER = ['PENDING_REVIEW', 'APPROVED', 'PROCESSING_TRANSFER', 'AWAITING_CUSTOMER_CONFIRMATION', 'RECONCILED', 'COMPLETED'] as const

/** Refund history built from its own timestamps (oldest first). `audience` picks the wording. */
export function buildRefundTimeline(refund: RefundRequestItem, audience: 'customer' | 'staff' = 'customer'): TimelineItem[] {
  const status = String(refund.status).toUpperCase()
  const items: TimelineItem[] = [
    {
      id: 'created',
      title: 'Tạo yêu cầu hoàn tiền',
      description: refund.reason,
      time: formatDateTime(refund.createdAt),
      icon: Send,
    },
  ]
  if (refund.reviewedAt) {
    const rejected = status === 'REJECTED'
    items.push({
      id: 'reviewed',
      title: rejected ? 'Yêu cầu bị từ chối' : 'Đã duyệt hoàn tiền',
      description: (rejected ? refund.rejectionReason : refund.reviewNote) || undefined,
      time: formatDateTime(refund.reviewedAt),
      icon: rejected ? XCircle : ShieldCheck,
      tone: rejected ? 'danger' : 'info',
      meta: audience === 'staff' && refund.reviewedByName ? refund.reviewedByName : undefined,
    })
  }
  if (refund.transferInitiatedAt) {
    items.push({
      id: 'transfer',
      title: 'Bắt đầu chuyển khoản',
      description: audience === 'staff' && refund.transferReference ? `Mã lệnh: ${refund.transferReference}` : undefined,
      time: formatDateTime(refund.transferInitiatedAt),
      icon: Banknote,
      tone: 'info',
    })
  }
  if (refund.processedAt) {
    items.push({
      id: 'processed',
      title: 'Đã chuyển tiền',
      description: refund.transactionReference ? `Mã giao dịch ngân hàng: ${refund.transactionReference}` : undefined,
      time: formatDateTime(refund.processedAt),
      icon: FileCheck2,
      tone: 'success',
    })
  }
  if (refund.customerConfirmedAt) {
    items.push({
      id: 'confirmed',
      title: audience === 'customer' ? 'Bạn đã xác nhận nhận tiền' : 'Khách xác nhận đã nhận tiền',
      description: refund.customerConfirmationNotes || undefined,
      time: formatDateTime(refund.customerConfirmedAt),
      icon: CheckCircle2,
      tone: 'success',
    })
  }
  if (refund.reconciledAt) {
    items.push({
      id: 'reconciled',
      title: 'Hoàn tất đối soát',
      description: refund.reconciliationNotes || undefined,
      time: formatDateTime(refund.reconciledAt),
      icon: CheckCircle2,
      tone: 'success',
    })
  }
  const next = nextStep(refund, audience)
  if (next) items.push({ id: 'next', title: next, icon: CircleDot, tone: 'warning' })
  return items
}

/** What happens next, or null when the refund is closed. */
export function nextStep(refund: RefundRequestItem, audience: 'customer' | 'staff'): string | null {
  const status = String(refund.status).toUpperCase()
  const customer = audience === 'customer'
  switch (status) {
    case 'PENDING_REVIEW':
      if (refund.bankInfoMissing) return customer ? 'Bổ sung tài khoản nhận hoàn tiền' : 'Chờ duyệt; khách chưa cung cấp tài khoản nhận tiền'
      return customer ? 'Cơ sở đang xét duyệt yêu cầu' : 'Chờ quản lý duyệt'
    case 'APPROVED':
      if (refund.bankInfoMissing) return customer ? 'Bổ sung tài khoản nhận hoàn tiền để được chuyển khoản' : 'Chờ khách cung cấp tài khoản nhận tiền'
      return customer ? 'Cơ sở đang chuẩn bị chuyển khoản' : 'Chờ bắt đầu chuyển khoản'
    case 'PROCESSING_TRANSFER':
      return customer ? 'Đang chuyển khoản tới tài khoản của bạn' : 'Chờ xác nhận đã chuyển tiền (mã giao dịch ngân hàng)'
    case 'AWAITING_CUSTOMER_CONFIRMATION':
    case 'PROCESSED':
      return customer ? 'Kiểm tra tài khoản và xác nhận đã nhận tiền' : 'Chờ khách xác nhận đã nhận tiền'
    case 'RECONCILED':
      return customer ? null : 'Chờ kế toán đối soát và đóng hồ sơ'
    default:
      return null
  }
}
