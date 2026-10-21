import { Badge, Button, DescriptionList, Drawer, cn } from '@/components/ui'
import type { Tone } from '@/components/ui'
import { getTicketCategoryMeta, getTicketPriorityMeta, getTicketStatusMeta } from '@/constants/statusMeta'
import { formatDateTime } from '@/lib/format'
import type { SupportTicketRecord } from '@/services/supportTicketService'
import { SLA_LABEL, getTicketSlaState, ticketCode, type TicketSlaState } from '../../lib/ticketDisplay'

export interface IncidentDetailDrawerProps {
  ticket: SupportTicketRecord | null
  onClose: () => void
}

const SLA_TONE: Record<TicketSlaState, Tone> = { overdue: 'danger', late: 'warning', met: 'success', within: 'success' }

const hasNumber = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value)

/** Read-only detail of one incident for the business manager. Every value comes from the ticket record; a missing one is left out or shown as a dash. */
export function IncidentDetailDrawer({ ticket, onClose }: IncidentDetailDrawerProps) {
  const status = getTicketStatusMeta(ticket?.status)
  const priority = getTicketPriorityMeta(ticket?.priority)
  const sla = ticket ? getTicketSlaState(ticket) : 'within'
  const reopened = hasNumber(ticket?.reopenCount) && ticket.reopenCount > 0
  // After a reopen the ticket is open again: its earlier resolution is history, not the current outcome.
  const isFinished = ['RESOLVED', 'CLOSED'].includes((ticket?.status ?? '').toUpperCase())

  return (
    <Drawer
      open={ticket !== null}
      onClose={onClose}
      title={ticket?.title ?? 'Chi tiết sự cố'}
      description={ticket ? `Mã sự cố ${ticketCode(ticket)}` : undefined}
      footer={<Button variant="secondary" onClick={onClose}>Đóng</Button>}
    >
      {ticket ? (
        <div className="flex flex-col gap-6">
          <DescriptionList
            columns={2}
            items={[
              { label: 'Trạng thái', value: <Badge tone={status.tone} dot>{status.label}</Badge> },
              { label: 'Mức ưu tiên', value: <Badge tone={priority.tone}>{priority.label}</Badge> },
              { label: 'Danh mục', value: getTicketCategoryMeta(ticket.category).label },
              { label: 'SLA', value: <Badge tone={SLA_TONE[sla]}>{SLA_LABEL[sla]}</Badge> },
              { label: 'Cơ sở', value: ticket.facilityName },
              { label: 'Kho', value: ticket.unitCode ? ticket.unitCode : 'Khu vực chung', mono: Boolean(ticket.unitCode) },
              { label: 'Người phụ trách', value: ticket.assignedStaffName ?? 'Chưa phân công' },
              { label: 'Khách báo cáo', value: ticket.customerName },
              { label: 'Tạo lúc', value: formatDateTime(ticket.createdAt) },
              { label: 'Hạn xử lý', value: formatDateTime(ticket.slaDueAt) },
              { label: isFinished ? 'Giải quyết lúc' : 'Giải quyết lần trước lúc', value: formatDateTime(ticket.resolvedAt) },
              { label: 'Cập nhật lần cuối', value: formatDateTime(ticket.updatedAt) },
              // Only shown once the server reports the counters: never a made-up 0.
              ...(hasNumber(ticket.reopenCount) ? [{ label: 'Số lần mở lại', value: String(ticket.reopenCount) }] : []),
              ...(hasNumber(ticket.contactLogCount) ? [{ label: 'Số lần liên hệ cấp quản lý', value: String(ticket.contactLogCount) }] : []),
            ]}
          />

          <section className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold text-fg">Nội dung sự cố</h3>
            <p className="whitespace-pre-wrap rounded-lg border border-line bg-surface-2 p-3 text-sm text-fg-muted">{ticket.description || '—'}</p>
          </section>

          {reopened && ticket.reopenReason ? (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold text-fg">Lý do mở lại gần nhất</h3>
              <p className="whitespace-pre-wrap rounded-lg border border-warning-line bg-warning-subtle p-3 text-sm text-fg">{ticket.reopenReason}</p>
            </section>
          ) : null}

          {ticket.resolutionNote ? (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold text-fg">{isFinished ? 'Ghi chú giải quyết' : 'Ghi chú giải quyết lần trước'}</h3>
              <p
                className={cn(
                  'whitespace-pre-wrap rounded-lg border p-3 text-sm',
                  isFinished ? 'border-success-line bg-success-subtle text-fg' : 'border-line bg-surface-2 text-fg-muted',
                )}
              >
                {ticket.resolutionNote}
              </p>
            </section>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  )
}
