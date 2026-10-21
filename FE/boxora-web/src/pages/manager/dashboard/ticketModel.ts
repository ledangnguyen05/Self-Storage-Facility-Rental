import type { SupportTicketRecord } from '@/services/supportTicketService'

const CLOSED_STATUSES = new Set(['RESOLVED', 'CLOSED'])
const HIGH_PRIORITIES = new Set(['HIGH', 'URGENT', 'CRITICAL'])

/** A ticket still needs work: anything not resolved or closed. */
export const isOpenTicket = (ticket: Pick<SupportTicketRecord, 'status'>) => !CLOSED_STATUSES.has((ticket.status ?? '').toUpperCase())

/** HIGH, URGENT and CRITICAL all count as high priority. */
export const isHighPriority = (ticket: Pick<SupportTicketRecord, 'priority'>) => HIGH_PRIORITIES.has((ticket.priority ?? '').toUpperCase())
