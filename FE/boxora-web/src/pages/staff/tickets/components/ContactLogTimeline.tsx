import { History, Mail, MessageSquare, Phone, UsersRound } from 'lucide-react'
import { Alert, Button, EmptyState, Skeleton, Timeline, type IconProp } from '@/components/ui'
import { formatDateTime } from '@/lib/format'
import { getApiErrorMessage } from '@/lib/apiError'
import type { SupportTicketContactLog } from '@/services/supportTicketService'
import { getContactMethodLabel } from '../constants'

const METHOD_ICONS: Record<string, IconProp> = {
  PHONE: Phone,
  EMAIL: Mail,
  INTERNAL_CHAT: MessageSquare,
  OTHER: UsersRound,
}

interface ContactLogTimelineProps {
  logs: SupportTicketContactLog[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
  emptyText?: string
}

/** Contact history between the facility manager and the business managers for one ticket. */
export function ContactLogTimeline({
  logs,
  isLoading,
  error,
  onRetry,
  emptyText = 'Chưa có lượt liên hệ nào được ghi nhận.',
}: ContactLogTimelineProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    )
  }
  if (error && logs.length === 0) {
    return (
      <Alert
        tone="danger"
        title="Không tải được nhật ký liên hệ"
        action={
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Thử lại
          </Button>
        }
      >
        {getApiErrorMessage(error)}
      </Alert>
    )
  }
  if (logs.length === 0) {
    return <EmptyState size="sm" icon={History} title={emptyText} />
  }
  return (
    <Timeline
      items={logs.map(log => ({
        id: log.id,
        icon: METHOD_ICONS[log.contactMethod?.toUpperCase()] ?? UsersRound,
        title: `${log.contactedByName || 'Quản lý cơ sở'} · ${getContactMethodLabel(log.contactMethod)}`,
        time: formatDateTime(log.createdAt),
        description: (
          <>
            {log.contactTarget ? <span className="block text-fg-subtle">Liên hệ: {log.contactTarget}</span> : null}
            <span className="block">{log.summary}</span>
            {log.result ? <span className="block text-fg">Kết quả: {log.result}</span> : null}
          </>
        ),
      }))}
    />
  )
}
