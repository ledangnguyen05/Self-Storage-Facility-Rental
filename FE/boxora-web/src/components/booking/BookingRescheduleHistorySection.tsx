import React from 'react'
import { History, RefreshCw } from 'lucide-react'
import type { BookingRescheduleHistory } from '../../types'
import { bookingService } from '../../services/bookingService'
import { useAsyncData } from '../../hooks/useAsyncData'
import { getApiErrorMessage } from '../../lib/apiError'
import { formatDate, formatDateTime } from '../../lib/format'
import { getBookingStatusMeta, getRoleMeta } from '../../constants/statusMeta'
import { Alert, Badge, Button, EmptyState, Skeleton, Timeline, type TimelineItem } from '../ui'
import { getRescheduleOutcomeMeta } from './rescheduleOutcome'

interface BookingRescheduleHistorySectionProps {
  bookingId: string
  /** Change to force a reload (for example after a reschedule). */
  refreshKey?: number
}

function AppointmentChange({ label, at, from, to, muted = false }: { label: string; at: string; from: string; to: string; muted?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <span className="block text-xs text-fg-subtle">{label}</span>
      <span className={muted ? 'text-sm tabular-nums text-fg-muted' : 'text-sm font-medium tabular-nums text-fg'}>{at}</span>
      <span className="mt-0.5 block text-xs tabular-nums text-fg-muted">
        Kỳ hạn: {from} → {to}
      </span>
    </div>
  )
}

function toTimelineItem(item: BookingRescheduleHistory, index: number, total: number): TimelineItem {
  const outcome = getRescheduleOutcomeMeta(item.outcome)
  const tone = outcome.tone === 'accent' ? 'info' : outcome.tone
  const previousStatus = item.previousBookingStatus ? getBookingStatusMeta(item.previousBookingStatus) : null
  const resultingStatus = item.resultingBookingStatus ? getBookingStatusMeta(item.resultingBookingStatus) : null
  const statusChanged = Boolean(previousStatus && resultingStatus && previousStatus.label !== resultingStatus.label)
  const requesterRole = item.requesterRole ? getRoleMeta(item.requesterRole).label : null

  return {
    id: item.id || String(index),
    title: `Lần đổi #${total - index}`,
    time: formatDateTime(item.requestTimestamp || item.createdAt),
    tone,
    description: (
      <div className="mt-1 flex flex-col gap-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <AppointmentChange
            label="Lịch hẹn trước đây"
            at={formatDateTime(item.previousAppointmentAt)}
            from={formatDate(item.previousExpectedStartDate)}
            to={formatDate(item.previousExpectedEndDate)}
            muted
          />
          <AppointmentChange
            label="Lịch hẹn mới"
            at={formatDateTime(item.acceptedAppointmentAt || item.requestedAppointmentAt)}
            from={formatDate(item.newExpectedStartDate)}
            to={formatDate(item.newExpectedEndDate)}
          />
        </div>
        {item.reason ? <p className="text-dense text-fg">Lý do: {item.reason}</p> : null}
        {item.rejectionReason ? <p className="text-dense text-danger">Lý do từ chối: {item.rejectionReason}</p> : null}
        <p className="text-xs text-fg-subtle">
          Yêu cầu bởi {item.requesterName || '—'}
          {requesterRole ? ` (${requesterRole})` : ''} · Xử lý bởi {item.processorName || '—'}
        </p>
        {item.contractAmendmentNotes ? (
          <Alert tone="info" icon={null} className="p-2 text-dense">
            {item.contractAmendmentNotes}
          </Alert>
        ) : null}
      </div>
    ),
    meta: (
      <>
        <Badge tone={outcome.tone} size="sm" dot>
          {outcome.label}
        </Badge>
        {statusChanged && previousStatus && resultingStatus ? (
          <span className="text-xs text-fg-subtle">
            Trạng thái đơn: {previousStatus.label} → {resultingStatus.label}
          </span>
        ) : null}
      </>
    ),
  }
}

export const BookingRescheduleHistorySection: React.FC<BookingRescheduleHistorySectionProps> = ({ bookingId, refreshKey }) => {
  const { data, error, isLoading, isRefreshing, reload } = useAsyncData(
    (signal) => bookingService.getRescheduleHistory(bookingId, { signal }),
    [bookingId, refreshKey],
    // Never show another booking's history while the next one loads.
    { enabled: Boolean(bookingId), initialData: [], keepPreviousData: false },
  )
  const history = data ?? []

  return (
    <section aria-label="Lịch sử đổi lịch hẹn" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <History size={16} strokeWidth={1.75} aria-hidden="true" className="text-fg-subtle" />
          Lịch sử đổi lịch
          {history.length > 0 ? (
            <Badge size="sm" tone="neutral">
              {history.length}
            </Badge>
          ) : null}
        </h4>
        <Button variant="ghost" size="sm" leftIcon={RefreshCw} loading={isRefreshing} disabled={isLoading} onClick={() => void reload()}>
          Làm mới
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : error ? (
        <Alert
          tone="danger"
          title="Không tải được lịch sử đổi lịch"
          action={
            <Button size="sm" variant="secondary" onClick={() => void reload()}>
              Thử lại
            </Button>
          }
        >
          {getApiErrorMessage(error, 'Không thể tải lịch sử đổi lịch hẹn.')}
        </Alert>
      ) : history.length === 0 ? (
        <EmptyState size="sm" icon={History} title="Chưa có lần đổi lịch nào" description="Lịch hẹn ban đầu vẫn được giữ chỗ." />
      ) : (
        <Timeline items={history.map((item, index) => toTimelineItem(item, index, history.length))} />
      )}
    </section>
  )
}
