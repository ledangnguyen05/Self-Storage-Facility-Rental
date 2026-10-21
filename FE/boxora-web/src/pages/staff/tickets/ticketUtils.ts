import { SITE_CONFIG } from '@/constants/siteConfig'
import { getTicketCategoryMeta, getTicketPriorityMeta, getTicketStatusMeta } from '@/constants/statusMeta'
import { formatDateTime } from '@/lib/format'
import type { SupportTicketRecord } from '@/services/supportTicketService'

const norm = (value?: string | null) => (value ?? '').trim().toUpperCase()

export const isOpenStatus = (status?: string | null) => ['OPEN', 'PENDING'].includes(norm(status))
export const isWorkingStatus = (status?: string | null) => ['IN_PROGRESS', 'REOPENED'].includes(norm(status))
export const isInProgressStatus = (status?: string | null) => norm(status) === 'IN_PROGRESS'
export const isReopenedStatus = (status?: string | null) => norm(status) === 'REOPENED'
export const isResolvedStatus = (status?: string | null) => norm(status) === 'RESOLVED'
export const isClosedStatus = (status?: string | null) => norm(status) === 'CLOSED'
export const isActiveStatus = (status?: string | null) => isOpenStatus(status) || isWorkingStatus(status)

export const isTicketOverdue = (ticket: Pick<SupportTicketRecord, 'isOverdue' | 'isOverdueSla'>) =>
  Boolean(ticket.isOverdue || ticket.isOverdueSla)

/** Display code, e.g. `#TK-20261021-0042`. Falls back to the first 8 characters of the id. */
export function getTicketCode(ticket: Pick<SupportTicketRecord, 'id' | 'ticketCode' | 'ticketNumber'>): string {
  return `#${ticket.ticketCode || ticket.ticketNumber || ticket.id.slice(0, 8).toUpperCase()}`
}

/** A ticket without a unit has no `unitCode` (older rows carried the literal "Chung"). */
export function getUnitLabel(ticket: Pick<SupportTicketRecord, 'unitCode'>): string {
  const code = ticket.unitCode?.trim()
  if (!code || code.toLowerCase() === 'chung') return 'Khu vực chung'
  return `Kho ${code}`
}

/** CRITICAL only exists in legacy data; the form and the API use URGENT. */
export function normalizePriority(priority?: string | null): string {
  const value = norm(priority)
  return value === 'CRITICAL' ? 'URGENT' : value || 'MEDIUM'
}

/** "Khẩn cấp" matches both URGENT and the legacy CRITICAL value. */
export function matchesPriorityFilter(priority: string | undefined, filter: string): boolean {
  if (filter === 'ALL') return true
  return normalizePriority(priority) === normalizePriority(filter)
}

export function matchesTicketSearch(ticket: SupportTicketRecord, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return true
  return [
    ticket.ticketCode,
    ticket.ticketNumber,
    ticket.id,
    ticket.title,
    ticket.description,
    ticket.unitCode,
    ticket.assignedStaffName,
    ticket.customerName,
    ticket.facilityName,
  ].some(field => field?.toLowerCase().includes(query))
}

function isSafeImageUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || (url.startsWith('/') && !url.startsWith('//'))
}

/** Evidence images of a ticket (`evidenceUrls` plus the `;`-joined `imageEvidence`), deduplicated and safe to render. */
export function getEvidenceUrls(ticket: Pick<SupportTicketRecord, 'evidenceUrls' | 'imageEvidence'>): string[] {
  const urls = new Set<string>()
  const add = (value?: string | null) => {
    const trimmed = value?.trim()
    if (trimmed && isSafeImageUrl(trimmed)) urls.add(trimmed)
  }
  ticket.evidenceUrls?.forEach(add)
  ticket.imageEvidence?.split(';').forEach(add)
  return Array.from(urls)
}

/** Plain-text summary pasted into chat or email when escalating to the business manager. */
export function buildEscalationText(ticket: SupportTicketRecord): string {
  return [
    `[${SITE_CONFIG.brandName}] Báo cáo sự cố cần hỗ trợ`,
    `Mã ticket: ${getTicketCode(ticket)}`,
    `Cơ sở: ${ticket.facilityName || '—'}`,
    `Vị trí: ${getUnitLabel(ticket)}`,
    `Danh mục: ${getTicketCategoryMeta(ticket.category).label}`,
    `Mức ưu tiên: ${getTicketPriorityMeta(ticket.priority).label}`,
    `Trạng thái: ${getTicketStatusMeta(ticket.status).label}`,
    `Tiêu đề: ${ticket.title}`,
    `Mô tả: ${ticket.description || '—'}`,
    `Thời điểm phát sinh: ${formatDateTime(ticket.createdAt)}`,
  ].join('\n')
}

export interface TicketKpiValues {
  open: number
  inProgress: number
  overdue: number
  /** 0-100, or null when there are no tickets to measure. */
  slaCompliance: number | null
  total: number
}

/** A resolved or closed ticket that was finished after its SLA deadline. */
function wasResolvedLate(ticket: SupportTicketRecord): boolean {
  if (!isResolvedStatus(ticket.status) && !isClosedStatus(ticket.status)) return false
  if (!ticket.resolvedAt || !ticket.slaDueAt) return false
  return new Date(ticket.resolvedAt).getTime() > new Date(ticket.slaDueAt).getTime()
}

/**
 * KPI values from the loaded queue, so the cards always agree with the table
 * (the stats endpoint is closed to STAFF and counts the same tickets). SLA compliance counts both the open
 * tickets that are past their deadline and the finished ones that were resolved late, like the backend stats.
 */
export function buildTicketKpis(tickets: readonly SupportTicketRecord[]): TicketKpiValues {
  const open = tickets.filter(t => isOpenStatus(t.status) || norm(t.status) === 'REOPENED').length
  const inProgress = tickets.filter(t => norm(t.status) === 'IN_PROGRESS').length
  const overdue = tickets.filter(t => isTicketOverdue(t) && isActiveStatus(t.status)).length
  const late = overdue + tickets.filter(wasResolvedLate).length
  const total = tickets.length
  const slaCompliance = total > 0 ? Math.max(0, Math.min(100, ((total - late) / total) * 100)) : null
  return { open, inProgress, overdue, slaCompliance, total }
}
