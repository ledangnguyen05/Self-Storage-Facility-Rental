import type { ReactNode } from 'react'
import { Ellipsis } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  DescriptionList,
  Drawer,
  DropdownMenu,
  DropdownMenuItem,
  IconButton,
} from '@/components/ui'
import { getTicketCategoryMeta, getTicketPriorityMeta, getTicketStatusMeta } from '@/constants/statusMeta'
import { useAsyncData } from '@/hooks/useAsyncData'
import { formatDateTime } from '@/lib/format'
import { supportTicketService, type SupportTicketRecord } from '@/services/supportTicketService'
import { ContactLogTimeline } from '../components/ContactLogTimeline'
import { EvidenceGallery } from '../components/EvidenceGallery'
import type { TicketPermissions } from '../hooks/useTicketPermissions'
import { getTicketActions, PRIMARY_ACTION_IDS, type TicketActionId } from '../ticketActions'
import { getEvidenceUrls, getTicketCode, getUnitLabel, isActiveStatus, isTicketOverdue } from '../ticketUtils'

interface TicketDetailDrawerProps {
  ticket: SupportTicketRecord
  permissions: TicketPermissions
  onClose: () => void
  onAction: (action: TicketActionId, ticket: SupportTicketRecord) => void
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {children}
    </section>
  )
}

export function TicketDetailDrawer({ ticket, permissions, onClose, onAction }: TicketDetailDrawerProps) {
  const logsQuery = useAsyncData(signal => supportTicketService.getContactLogs(ticket.id, { signal }), [ticket.id])
  const status = getTicketStatusMeta(ticket.status)
  const priority = getTicketPriorityMeta(ticket.priority)
  const overdue = isTicketOverdue(ticket) && isActiveStatus(ticket.status)

  const actions = getTicketActions(ticket, permissions)
  const primary = actions.find(action => PRIMARY_ACTION_IDS.includes(action.id))
  const menuActions = actions.filter(action => action !== primary)

  return (
    <Drawer
      open
      onClose={onClose}
      size="md"
      title={ticket.title}
      description={<span className="font-mono">{getTicketCode(ticket)}</span>}
      footer={
        <>
          {menuActions.length > 0 ? (
            <DropdownMenu
              align="start"
              side="top"
              aria-label="Thao tác khác"
              trigger={<IconButton icon={Ellipsis} variant="secondary" aria-label="Thao tác khác" tooltip />}
            >
              {menuActions.map(action => (
                <DropdownMenuItem key={action.id} icon={action.icon} tone={action.tone} onSelect={() => onAction(action.id, ticket)}>
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenu>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          {primary ? (
            <Button leftIcon={primary.icon} onClick={() => onAction(primary.id, ticket)}>
              {primary.label}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
          <Badge tone={priority.tone}>Ưu tiên {priority.label.toLowerCase()}</Badge>
          {overdue ? <Badge tone="danger">Quá hạn SLA</Badge> : null}
          {ticket.reopenCount ? <Badge tone="warning">Mở lại {ticket.reopenCount} lần</Badge> : null}
        </div>

        <DescriptionList
          items={[
            { label: 'Cơ sở', value: ticket.facilityName },
            { label: 'Vị trí', value: getUnitLabel(ticket), mono: Boolean(ticket.unitCode) },
            { label: 'Danh mục', value: getTicketCategoryMeta(ticket.category).label },
            { label: 'Người báo cáo', value: ticket.customerName },
            { label: 'Phụ trách', value: ticket.assignedStaffName || 'Chưa phân công' },
            { label: 'Tạo lúc', value: formatDateTime(ticket.createdAt) },
            { label: 'Hạn xử lý (SLA)', value: formatDateTime(ticket.slaDueAt) },
            { label: 'Hoàn tất lúc', value: ticket.resolvedAt ? formatDateTime(ticket.resolvedAt) : undefined },
          ]}
        />

        <Section title="Mô tả">
          <p className="whitespace-pre-wrap text-sm text-fg-muted">{ticket.description || '—'}</p>
        </Section>

        {ticket.resolutionNote ? (
          <Alert tone="success" title="Kết quả xử lý">
            <span className="whitespace-pre-wrap">{ticket.resolutionNote}</span>
          </Alert>
        ) : null}
        {ticket.reopenReason ? (
          <Alert tone="warning" title="Lý do mở lại">
            <span className="whitespace-pre-wrap">{ticket.reopenReason}</span>
          </Alert>
        ) : null}

        <Section title="Ảnh minh chứng">
          <EvidenceGallery urls={getEvidenceUrls(ticket)} />
        </Section>

        <Section title="Nhật ký liên hệ giám đốc vận hành">
          <ContactLogTimeline
            logs={logsQuery.data ?? []}
            isLoading={logsQuery.isLoading}
            error={logsQuery.error}
            onRetry={() => void logsQuery.reload()}
          />
        </Section>
      </div>
    </Drawer>
  )
}
