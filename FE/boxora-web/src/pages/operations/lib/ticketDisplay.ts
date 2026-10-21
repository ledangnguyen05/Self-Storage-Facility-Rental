import type { SupportTicketRecord } from '@/services/supportTicketService'

/** Short code shown for a ticket; falls back to the start of its id. */
export const ticketCode = (ticket: Pick<SupportTicketRecord, 'ticketCode' | 'ticketNumber' | 'id'>): string =>
  ticket.ticketCode || ticket.ticketNumber || ticket.id.slice(0, 8)

export const isTicketOverSla = (ticket: Pick<SupportTicketRecord, 'isOverdue' | 'isOverdueSla'>): boolean =>
  Boolean(ticket.isOverdue || ticket.isOverdueSla)

export type TicketSlaState = 'overdue' | 'late' | 'met' | 'within'

const isClosedStatus = (status: string | undefined): boolean => ['RESOLVED', 'CLOSED'].includes((status ?? '').toUpperCase())

/**
 * SLA of one ticket from its real dates:
 * - `overdue`: still open and past its deadline (or flagged overdue by the server);
 * - `late`: closed after the deadline; `met`: closed in time;
 * - `within`: still open and inside the deadline (or no deadline recorded).
 */
export function getTicketSlaState(
  ticket: Pick<SupportTicketRecord, 'status' | 'slaDueAt' | 'resolvedAt' | 'closedAt' | 'isOverdue' | 'isOverdueSla'>,
  now: Date = new Date(),
): TicketSlaState {
  const due = ticket.slaDueAt ? new Date(ticket.slaDueAt) : null
  const dueMs = due && !Number.isNaN(due.getTime()) ? due.getTime() : null
  const doneAt = ticket.resolvedAt ?? ticket.closedAt

  if (isClosedStatus(ticket.status) && doneAt && dueMs !== null) {
    return new Date(doneAt).getTime() > dueMs ? 'late' : 'met'
  }
  if (isTicketOverSla(ticket)) return 'overdue'
  if (!isClosedStatus(ticket.status) && dueMs !== null && now.getTime() > dueMs) return 'overdue'
  return 'within'
}

export const SLA_LABEL: Record<TicketSlaState, string> = {
  overdue: 'Quá hạn SLA',
  late: 'Xử lý trễ hạn',
  met: 'Đúng hạn SLA',
  within: 'Trong hạn',
}
