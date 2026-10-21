import React, { useState } from 'react'
import { Bell, BellRing, CheckCheck, KeyRound, RefreshCw, ShieldAlert } from 'lucide-react'
import { formatDateTime, formatRelativeTime } from '../../lib/format'
import type { NotificationLog } from '../../services/notificationService'
import { Alert, Badge, Button, EmptyState, IconButton, Popover, Skeleton, useToast } from '../ui'
import { buttonVariants } from '../ui/buttonVariants'
import { cn } from '../ui/cn'
import { useNotificationFeed } from './notificationStore'

interface NotificationCenterProps {
  userId?: string
}

const TYPE_LABELS: Record<string, string> = {
  HANDOVER_PIN: 'Bàn giao kho',
  HANDOVER_CHECKIN: 'Bàn giao kho',
  RENEWAL_REMINDER_3D: 'Sắp hết hạn',
  RENEWAL_REMINDER_7D: 'Gia hạn',
  OVERDUE_NOTICE: 'Quá hạn',
  REFUND_STATUS: 'Hoàn tiền',
  SEALING_NOTICE: 'Niêm phong',
  UNSEALING_NOTICE: 'Mở niêm phong',
  MASTER_KEY_ALERT: 'Cảnh báo an ninh',
  TICKET_UPDATE: 'Phiếu hỗ trợ',
}

/** Only email deliveries have a delivery state worth showing; in-app notifications are simply there. */
function getDeliveryLabel(item: NotificationLog): string | undefined {
  if (item.channel !== 'EMAIL') return undefined
  if (item.status === 'FAILED') return 'Chưa gửi được email'
  if (item.status === 'SENT') return 'Đã gửi email'
  return undefined
}

const isHandoverNotification = (item: NotificationLog) =>
  item.notificationType === 'HANDOVER_PIN' || item.notificationType === 'HANDOVER_CHECKIN'

/** Topbar bell with the account's recent notifications. Read state is stored on the server. */
const NotificationCenter: React.FC<NotificationCenterProps> = ({ userId }) => {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const feed = useNotificationFeed(userId)
  const { items, unreadCount, reload } = feed

  const canFetch = Boolean(userId)
  const isLoading = feed.isLoading && items.length === 0
  const showError = Boolean(feed.error) && items.length === 0 && !feed.isLoading

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next && canFetch) void reload()
    if (!next) setExpandedId(null)
  }

  const toggleItem = async (item: NotificationLog) => {
    setExpandedId((current) => (current === item.id ? null : item.id))
    if (!item.read) {
      const ok = await feed.markRead(item.id)
      if (!ok) toast.error('Không đánh dấu được đã đọc', 'Vui lòng thử lại.')
    }
  }

  const readAll = async () => {
    const ok = await feed.markAllRead()
    if (!ok) toast.error('Không đánh dấu được tất cả đã đọc', 'Vui lòng thử lại.')
  }

  const trigger = (
    <button
      type="button"
      aria-label={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
      className={buttonVariants({ variant: 'ghost', iconOnly: true, className: 'relative' })}
    >
      <Bell size={18} strokeWidth={1.75} aria-hidden="true" />
      {unreadCount > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold leading-none text-on-accent tabular-nums ring-2 ring-surface"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      ) : null}
    </button>
  )

  return (
    <Popover trigger={trigger} open={open} onOpenChange={handleOpenChange} aria-label="Thông báo gần đây" className="flex w-96 flex-col p-0">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-sm font-semibold text-fg">Thông báo</h2>
          {unreadCount > 0 ? (
            <Badge tone="accent" size="sm">
              {unreadCount} mới
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" leftIcon={CheckCheck} disabled={unreadCount === 0} onClick={() => void readAll()}>
            Đã đọc tất cả
          </Button>
          {canFetch ? (
            <IconButton
              icon={RefreshCw}
              size="sm"
              aria-label="Làm mới thông báo"
              loading={feed.isRefreshing}
              onClick={() => void reload()}
            />
          ) : null}
        </div>
      </div>

      <div className="max-h-96 min-h-0 flex-1 overflow-y-auto p-1.5" aria-busy={isLoading || undefined}>
        {isLoading ? (
          <div className="flex flex-col gap-3 p-2.5" aria-label="Đang tải thông báo">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : showError ? (
          <Alert
            tone="danger"
            className="m-1.5"
            action={
              <Button size="sm" variant="secondary" onClick={() => void reload()}>
                Thử lại
              </Button>
            }
          >
            Không tải được thông báo.
          </Alert>
        ) : items.length === 0 ? (
          <EmptyState
            size="sm"
            icon={BellRing}
            title="Chưa có thông báo"
            description={canFetch ? 'Thông báo mới sẽ được hiển thị tại đây.' : 'Đăng nhập để xem thông báo của bạn.'}
          />
        ) : (
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                unread={!item.read}
                expanded={expandedId === item.id}
                onToggle={() => void toggleItem(item)}
              />
            ))}
          </ul>
        )}
      </div>

      {items.length > 0 ? (
        <p className="shrink-0 border-t border-line px-4 py-2 text-center text-xs text-fg-subtle">
          Hiển thị {items.length} thông báo gần nhất
        </p>
      ) : null}
    </Popover>
  )
}

function NotificationRow({
  item,
  unread,
  expanded,
  onToggle,
}: {
  item: NotificationLog
  unread: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const handover = isHandoverNotification(item)
  const security = item.notificationType === 'MASTER_KEY_ALERT'
  const Icon = security ? ShieldAlert : handover ? KeyRound : Bell
  const typeLabel = (item.notificationType && TYPE_LABELS[item.notificationType]) || 'Thông báo'
  const deliveryLabel = getDeliveryLabel(item)

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-surface-2"
      >
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
            security ? 'bg-danger-subtle text-danger' : handover ? 'bg-accent-subtle text-accent-text' : 'bg-surface-2 text-fg-muted',
          )}
        >
          <Icon size={16} strokeWidth={1.75} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-start justify-between gap-2">
            <span className={cn('min-w-0 truncate text-sm', unread ? 'font-semibold text-fg' : 'font-medium text-fg-muted')}>
              {item.title || 'Thông báo Boxora'}
            </span>
            {unread ? (
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent">
                <span className="sr-only">Chưa đọc</span>
              </span>
            ) : null}
          </span>
          <span className={cn('mt-0.5 text-dense text-fg-muted', expanded ? 'whitespace-pre-wrap break-words' : 'line-clamp-2')}>
            {item.content || 'Không có nội dung chi tiết.'}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
            <Badge size="sm" tone={security ? 'danger' : handover ? 'accent' : 'neutral'}>
              {typeLabel}
            </Badge>
            <time dateTime={item.createdAt} title={formatDateTime(item.createdAt)} className="tabular-nums">
              {item.createdAt ? formatRelativeTime(item.createdAt) : 'Thời gian không xác định'}
            </time>
            {deliveryLabel ? <span>· {deliveryLabel}</span> : null}
          </span>
        </span>
      </button>
    </li>
  )
}

export default NotificationCenter
