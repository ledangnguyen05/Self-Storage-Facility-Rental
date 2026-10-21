import { Ellipsis, Eye } from 'lucide-react'
import {
  Button,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  IconButton,
} from '@/components/ui'
import type { SupportTicketRecord } from '@/services/supportTicketService'
import type { TicketPermissions } from '../hooks/useTicketPermissions'
import { getTicketActions, PRIMARY_ACTION_IDS, type TicketActionId } from '../ticketActions'
import { getTicketCode } from '../ticketUtils'

interface TicketRowActionsProps {
  ticket: SupportTicketRecord
  permissions: TicketPermissions
  /** The primary "take" action is waiting for the server. */
  isTaking?: boolean
  onAction: (action: TicketActionId, ticket: SupportTicketRecord) => void
  onOpenDetail: (ticket: SupportTicketRecord) => void
}

/** One primary button for the next step of the workflow, everything else in the overflow menu. */
export function TicketRowActions({ ticket, permissions, isTaking = false, onAction, onOpenDetail }: TicketRowActionsProps) {
  const actions = getTicketActions(ticket, permissions)
  const primary = actions.find(action => PRIMARY_ACTION_IDS.includes(action.id))
  const menuActions = actions.filter(action => action !== primary)

  return (
    // The menu is portaled but React events still bubble to the clickable row.
    <div className="flex items-center justify-end gap-1" onClick={event => event.stopPropagation()}>
      {primary ? (
        <Button
          size="sm"
          variant="secondary"
          leftIcon={primary.icon}
          loading={primary.id === 'take' && isTaking}
          onClick={() => onAction(primary.id, ticket)}
        >
          {primary.label}
        </Button>
      ) : null}
      <DropdownMenu
        aria-label={`Thao tác với ticket ${getTicketCode(ticket)}`}
        trigger={<IconButton icon={Ellipsis} size="sm" aria-label={`Thao tác với ticket ${getTicketCode(ticket)}`} />}
      >
        <DropdownMenuItem icon={Eye} onSelect={() => onOpenDetail(ticket)}>
          Xem chi tiết
        </DropdownMenuItem>
        {menuActions.length > 0 ? <DropdownMenuSeparator /> : null}
        {menuActions.map(action => (
          <DropdownMenuItem key={action.id} icon={action.icon} tone={action.tone} onSelect={() => onAction(action.id, ticket)}>
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenu>
    </div>
  )
}
