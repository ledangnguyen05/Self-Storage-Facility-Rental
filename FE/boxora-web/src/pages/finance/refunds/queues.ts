import type { RoleType } from '@/types'

export type RefundQueue = 'todo' | 'customer' | 'reconcile' | 'closed' | 'all'

/** Statuses of each queue tab (sent to `GET /refunds?status=`). */
export const REFUND_QUEUES: Record<RefundQueue, { label: string; statuses: string[] }> = {
  todo: { label: 'Cần xử lý', statuses: ['PENDING_REVIEW', 'APPROVED', 'PROCESSING_TRANSFER'] },
  customer: { label: 'Chờ khách xác nhận', statuses: ['AWAITING_CUSTOMER_CONFIRMATION', 'PROCESSED'] },
  reconcile: { label: 'Chờ đối soát', statuses: ['RECONCILED'] },
  closed: { label: 'Đã đóng', statuses: ['COMPLETED', 'REJECTED'] },
  all: { label: 'Tất cả', statuses: [] },
}

export const REFUND_QUEUE_ORDER: RefundQueue[] = ['todo', 'customer', 'reconcile', 'closed', 'all']

export const isRefundQueue = (value: string | null): value is RefundQueue => Boolean(value && value in REFUND_QUEUES)

/** Who may do what (mirrors RefundController @PreAuthorize). */
export interface RefundPermissions {
  review: boolean
  transfer: boolean
  reconcile: boolean
}

export function refundPermissions(role: RoleType | null | undefined): RefundPermissions {
  const manager = role === 'ADMIN' || role === 'BUSINESS_MANAGER' || role === 'FACILITY_MANAGER'
  return {
    review: manager,
    transfer: manager || role === 'STAFF',
    reconcile: manager,
  }
}

/** Roles that open /portal/finance. */
export const FINANCE_ROLES: readonly RoleType[] = ['STAFF', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'ADMIN']
