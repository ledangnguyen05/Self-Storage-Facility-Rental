import { Hand, Lock, PhoneForwarded, RotateCcw, SquareCheckBig, UserPlus, type LucideIcon } from 'lucide-react'
import type { SupportTicketRecord } from '@/services/supportTicketService'
import type { TicketPermissions } from './hooks/useTicketPermissions'
import { isActiveStatus, isInProgressStatus, isOpenStatus, isReopenedStatus, isResolvedStatus } from './ticketUtils'

export type TicketActionId = 'take' | 'assign' | 'resolve' | 'close' | 'reopen' | 'contact'

export interface TicketAction {
  id: TicketActionId
  label: string
  icon: LucideIcon
  tone?: 'default' | 'danger'
}

/** What the page can open: a ticket dialog/drawer, or the create form. */
export type TicketDialogState =
  | { type: 'detail' | TicketActionId; ticket: SupportTicketRecord }
  | { type: 'create' }
  | null

/**
 * Actions the signed-in role may run on a ticket, most important first.
 * The first of take / resolve / close is the row's primary action.
 *
 * The server enforces the same rules: staff take a ticket nobody has taken yet (or one reopened on them), resolve only
 * what they are working on, and never touch a colleague's ticket. The facility manager can step in on any of them.
 */
export function getTicketActions(ticket: SupportTicketRecord, permissions: TicketPermissions): TicketAction[] {
  const actions: TicketAction[] = []
  const mine = permissions.isAssignedToMe(ticket)
  const reopened = isReopenedStatus(ticket.status)
  const takeable = isOpenStatus(ticket.status) || reopened

  if (permissions.canTake && takeable && (!ticket.assignedStaffId || mine || permissions.isFacilityManager)) {
    actions.push({ id: 'take', label: reopened ? 'Nhận xử lý lại' : 'Nhận xử lý', icon: Hand })
  }
  if (permissions.canResolve && isInProgressStatus(ticket.status) && (mine || permissions.isFacilityManager)) {
    actions.push({ id: 'resolve', label: 'Báo hoàn tất', icon: SquareCheckBig })
  }
  if (permissions.canClose && isResolvedStatus(ticket.status)) {
    actions.push({ id: 'close', label: 'Nghiệm thu và đóng', icon: Lock })
  }
  if (permissions.canAssign && isActiveStatus(ticket.status)) {
    actions.push({ id: 'assign', label: ticket.assignedStaffId ? 'Đổi người phụ trách' : 'Phân công', icon: UserPlus })
  }
  if (permissions.canReopen && isResolvedStatus(ticket.status)) {
    actions.push({ id: 'reopen', label: 'Yêu cầu xử lý lại', icon: RotateCcw, tone: 'danger' })
  }
  if (permissions.canContactBom) {
    actions.push({ id: 'contact', label: 'Liên hệ giám đốc vận hành', icon: PhoneForwarded })
  }
  return actions
}

/** Actions that stand on their own as a button; everything else goes to the menu. */
export const PRIMARY_ACTION_IDS: readonly TicketActionId[] = ['take', 'resolve', 'close']
