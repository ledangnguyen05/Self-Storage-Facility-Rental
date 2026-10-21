import { Badge } from '@/components/ui'
import { getTicketPriorityMeta, getTicketStatusMeta } from '@/constants/statusMeta'
import type { SupportTicketRecord } from '@/services/supportTicketService'
import { getTicketCode } from '../ticketUtils'

/** Compact "which ticket am I acting on" box at the top of the action dialogs. */
export function TicketSummary({ ticket }: { ticket: SupportTicketRecord }) {
  const status = getTicketStatusMeta(ticket.status)
  const priority = getTicketPriorityMeta(ticket.priority)
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-dense text-fg-muted">{getTicketCode(ticket)}</span>
        <Badge tone={status.tone} size="sm" dot>
          {status.label}
        </Badge>
        <Badge tone={priority.tone} size="sm">
          {priority.label}
        </Badge>
      </div>
      <p className="mt-1.5 text-sm font-medium text-fg">{ticket.title}</p>
      {ticket.description ? <p className="mt-0.5 line-clamp-3 text-dense text-fg-muted">{ticket.description}</p> : null}
    </div>
  )
}
