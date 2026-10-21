import { useMemo } from 'react'
import type { RoleType, User } from '@/types'
import type { SupportTicketRecord } from '@/services/supportTicketService'

export interface TicketPermissions {
  role: RoleType | null
  isStaff: boolean
  isFacilityManager: boolean
  /** BUSINESS_MANAGER and ADMIN watch the queue but never change it. */
  isReadOnly: boolean
  isBusinessManager: boolean
  isAdmin: boolean
  canCreate: boolean
  canTake: boolean
  canResolve: boolean
  canAssign: boolean
  canClose: boolean
  canReopen: boolean
  canContactBom: boolean
  /** True when the ticket is assigned to the signed-in user. */
  isAssignedToMe: (ticket: Pick<SupportTicketRecord, 'assignedStaffId'>) => boolean
  /** One sentence describing what this role does on the page. */
  description: string
}

const DESCRIPTIONS = {
  FACILITY_MANAGER:
    'Phân công nhân viên, nghiệm thu sự cố đã xử lý và liên hệ giám đốc vận hành khi vượt thẩm quyền.',
  STAFF: 'Tiếp nhận sự cố được giao, cập nhật tiến độ tại hiện trường và báo hoàn tất sau khi khắc phục.',
  READ_ONLY: 'Theo dõi tiến độ xử lý sự cố và mức tuân thủ SLA trên toàn hệ thống.',
} as const

/**
 * What the signed-in role may do with support tickets. A missing role gets read-only access,
 * never the staff default the page used before.
 */
export function useTicketPermissions(role: RoleType | null, user: Pick<User, 'id'> | null): TicketPermissions {
  const userId = user?.id
  return useMemo<TicketPermissions>(() => {
    const isStaff = role === 'STAFF'
    const isFacilityManager = role === 'FACILITY_MANAGER'
    const isBusinessManager = role === 'BUSINESS_MANAGER'
    const isAdmin = role === 'ADMIN'
    const isOperator = isStaff || isFacilityManager

    return {
      role,
      isStaff,
      isFacilityManager,
      isBusinessManager,
      isAdmin,
      isReadOnly: !isOperator,
      canCreate: isOperator,
      canTake: isOperator,
      canResolve: isOperator,
      canAssign: isFacilityManager,
      canClose: isFacilityManager,
      canReopen: isFacilityManager,
      canContactBom: isFacilityManager,
      isAssignedToMe: ticket => Boolean(userId && ticket.assignedStaffId === userId),
      description: isFacilityManager ? DESCRIPTIONS.FACILITY_MANAGER : isStaff ? DESCRIPTIONS.STAFF : DESCRIPTIONS.READ_ONLY,
    }
  }, [role, userId])
}
