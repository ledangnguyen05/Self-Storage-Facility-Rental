import { CheckCircle2, CircleDot, Lock, RotateCcw, Send, UserCheck, Wrench } from 'lucide-react'
import { Alert, Badge, Button, Card, Timeline, type TimelineItem } from '@/components/ui'
import { getTicketCategoryMeta, getTicketPriorityMeta, getTicketStatusMeta } from '@/constants/statusMeta'
import { formatDateTime } from '@/lib/format'
import { EvidenceViewer } from '@/pages/staff/components/EvidenceViewer'
import type { SupportTicketRecord } from '@/services/supportTicketService'

interface TicketCardProps {
  ticket: SupportTicketRecord
  onConfirmClose: (ticket: SupportTicketRecord) => void
  onReopen: (ticket: SupportTicketRecord) => void
}

const upper = (value: string | null | undefined) => (value ?? '').toUpperCase()

/** History of a ticket built from its own timestamps and notes. */
function buildTicketTimeline(ticket: SupportTicketRecord): TimelineItem[] {
  const status = upper(ticket.status)
  const items: TimelineItem[] = [{ id: 'created', title: 'Đã gửi yêu cầu', time: formatDateTime(ticket.createdAt), icon: Send }]
  if (ticket.assignedStaffName) {
    items.push({ id: 'assigned', title: `Tiếp nhận bởi ${ticket.assignedStaffName}`, icon: UserCheck, tone: 'info' })
  }
  if (ticket.resolvedAt || status === 'RESOLVED' || status === 'CLOSED') {
    items.push({
      id: 'resolved',
      title: 'Đã xử lý',
      description: ticket.resolutionNote || undefined,
      time: ticket.resolvedAt ? formatDateTime(ticket.resolvedAt) : undefined,
      icon: CheckCircle2,
      tone: 'success',
    })
  }
  if ((ticket.reopenCount ?? 0) > 0 || status === 'REOPENED') {
    items.push({
      id: 'reopened',
      title: 'Yêu cầu xử lý lại',
      description: ticket.reopenReason || undefined,
      meta: (ticket.reopenCount ?? 0) > 1 ? `${ticket.reopenCount} lần` : undefined,
      icon: RotateCcw,
      tone: 'warning',
    })
  }
  if (status === 'IN_PROGRESS') {
    items.push({ id: 'progress', title: 'Đang xử lý', description: ticket.resolutionNote || 'Nhân viên cơ sở đang kiểm tra.', icon: Wrench, tone: 'info' })
  }
  if (status === 'OPEN' || status === 'PENDING') {
    items.push({ id: 'waiting', title: 'Chờ tiếp nhận', description: 'Yêu cầu đã được chuyển tới ca trực của cơ sở.', icon: CircleDot, tone: 'warning' })
  }
  if (status === 'CLOSED') {
    items.push({ id: 'closed', title: 'Đã đóng', time: ticket.closedAt ? formatDateTime(ticket.closedAt) : undefined, icon: Lock })
  }
  return items
}

export function TicketCard({ ticket, onConfirmClose, onReopen }: TicketCardProps) {
  const status = getTicketStatusMeta(ticket.status)
  const priority = getTicketPriorityMeta(ticket.priority)
  const category = getTicketCategoryMeta(ticket.category)
  const awaitingConfirmation = upper(ticket.status) === 'RESOLVED'
  const reopenCount = ticket.reopenCount ?? 0
  const contactCount = ticket.contactLogCount ?? 0
  const evidenceUrls = ticket.evidenceUrls ?? []
  const footer = [
    ticket.updatedAt ? `Cập nhật lần cuối ${formatDateTime(ticket.updatedAt)}` : null,
    contactCount > 0 ? `Cơ sở đã liên hệ bạn ${contactCount} lần` : null,
  ].filter(Boolean)

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-dense text-fg-muted">{ticket.ticketCode || ticket.id.slice(0, 8).toUpperCase()}</span>
            {ticket.unitCode ? (
              <Badge variant="outline">
                Kho <span className="font-mono">{ticket.unitCode}</span>
              </Badge>
            ) : null}
            <Badge>{category.label}</Badge>
            <Badge tone={priority.tone} variant="outline">
              Ưu tiên {priority.label.toLowerCase()}
            </Badge>
            {reopenCount > 0 ? (
              <Badge tone="warning" variant="outline">
                Đã mở lại {reopenCount} lần
              </Badge>
            ) : null}
          </div>
          <h3 className="mt-1.5 text-sm font-medium text-fg">{ticket.title}</h3>
        </div>
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
      </div>

      {ticket.description ? <p className="whitespace-pre-wrap text-sm text-fg-muted">{ticket.description}</p> : null}

      {evidenceUrls.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-fg-muted">{`Ảnh minh chứng (${evidenceUrls.length})`}</p>
          <EvidenceViewer urls={evidenceUrls} label="Ảnh minh chứng" className="max-w-md" />
        </div>
      ) : null}

      {awaitingConfirmation ? (
        <div className="flex flex-col gap-3">
          <Alert tone="success" title="Cơ sở đã xử lý yêu cầu" role="note">
            Vui lòng xác nhận sự cố đã được khắc phục, hoặc yêu cầu xử lý lại nếu chưa ổn.
          </Alert>
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => onReopen(ticket)}>
              Yêu cầu xử lý lại
            </Button>
            <Button size="sm" onClick={() => onConfirmClose(ticket)}>
              Xác nhận đã xong
            </Button>
          </div>
        </div>
      ) : null}

      <Timeline items={buildTicketTimeline(ticket)} />
      {footer.length > 0 ? <p className="text-xs text-fg-muted">{footer.join(' · ')}</p> : null}
    </Card>
  )
}
