import { useMemo, useState } from 'react'
import { History } from 'lucide-react'
import { Alert, Button, EmptyState, Skeleton, Tabs, Timeline } from '@/components/ui'
import { humanizeEnum } from '@/constants/statusMeta'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatDateTime, parseDate } from '@/lib/format'
import { activityLogService } from '@/services/activityLogService'
import type { ActivityLog } from '@/types'

type Period = '7d' | '30d' | 'all'

const PERIOD_DAYS: Record<Exclude<Period, 'all'>, number> = { '7d': 7, '30d': 30 }

/** Vietnamese labels for the activity actions that matter on a single unit. Others fall back to the server text. */
const ACTION_LABELS: Record<string, string> = {
  STORAGE_UNIT_CREATE: 'Tạo kho',
  STORAGE_UNIT_UPDATE: 'Cập nhật kho',
  STORAGE_UNIT_STATUS_CHANGE: 'Đổi trạng thái kho',
  STORAGE_UNIT_ASSIGN: 'Gán kho cho khách',
  STORAGE_UNIT_RELEASE: 'Thu hồi kho',
  CHECKIN_VERIFIED: 'Xác minh nhận kho',
  HANDOVER_COMPLETE: 'Hoàn tất bàn giao',
  ACCESS_CREDENTIAL_ISSUE: 'Cấp mã truy cập',
  ACCESS_CREDENTIAL_UPDATE: 'Cập nhật mã truy cập',
  ACCESS_CREDENTIAL_REVOKE: 'Thu hồi mã truy cập',
  MASTER_KEY_OVERRIDE: 'Sử dụng chìa khóa tổng',
  OVERDUE_DETECTED: 'Phát hiện quá hạn',
  OVERDUE_REMINDER_SENT: 'Gửi email nhắc nợ',
  OVERDUE_ACCESS_DISABLED: 'Khóa truy cập do quá hạn',
  OVERDUE_SEALING_APPROVED: 'Phê duyệt niêm phong',
  OVERDUE_UNIT_LOCKED: 'Niêm phong kho',
  CHECKOUT_REQUEST: 'Yêu cầu trả kho',
  CHECKOUT_INSPECTION_COMPLETE: 'Hoàn tất kiểm tra trả kho',
}

/**
 * Older reminder entries were recorded under the "overdue detected" action; their text tells them apart so the timeline
 * does not claim a detection for every reminder email.
 */
function actionLabel(log: Pick<ActivityLog, 'action' | 'description'>): string {
  if (log.action === 'OVERDUE_DETECTED' && /^Đã gửi email nhắc nợ/.test(log.description ?? '')) return ACTION_LABELS.OVERDUE_REMINDER_SENT
  return ACTION_LABELS[log.action] ?? humanizeEnum(log.action)
}

const isCodeChar = (char: string | undefined) => char !== undefined && /[a-z0-9-]/i.test(char)

/**
 * The server search also matches user names and facility names, so keep only entries whose text names
 * this exact unit (`A-10` must not match `A-101`).
 */
function mentionsUnit(log: ActivityLog, unitCode: string): boolean {
  const text = `${log.description ?? ''} ${log.details ?? ''}`.toLowerCase()
  const code = unitCode.toLowerCase()
  let index = text.indexOf(code)
  while (index !== -1) {
    if (!isCodeChar(text[index - 1]) && !isCodeChar(text[index + code.length])) return true
    index = text.indexOf(code, index + 1)
  }
  return false
}

function filterByPeriod(logs: ActivityLog[], period: Period): ActivityLog[] {
  if (period === 'all') return logs
  const cutoff = Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000
  return logs.filter((log) => {
    const time = parseDate(log.createdAt)?.getTime()
    return time !== undefined && time >= cutoff
  })
}

interface UnitActivityLogProps {
  unitCode: string
  facilityId?: string
}

/**
 * Activity recorded for one unit (credential, handover and overdue events). There is no
 * dedicated door-open feed in the backend, so this is the audit log filtered by unit code.
 */
export function UnitActivityLog({ unitCode, facilityId }: UnitActivityLogProps) {
  const [period, setPeriod] = useState<Period>('30d')
  const { data, error, isLoading, reload } = useAsyncData(
    (signal) => activityLogService.getAll({ search: unitCode, facilityId, size: 100 }, { signal }),
    [unitCode, facilityId],
    { keepPreviousData: false },
  )

  const logs = useMemo(
    () =>
      filterByPeriod(
        (data?.content ?? []).filter((log) => mentionsUnit(log, unitCode)),
        period,
      ),
    [data, period, unitCode],
  )

  return (
    <section aria-label="Nhật ký hoạt động của kho" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">Nhật ký hoạt động</h3>
        <Tabs
          variant="segmented"
          size="sm"
          aria-label="Khoảng thời gian"
          value={period}
          onValueChange={setPeriod}
          items={[
            { value: '7d', label: '7 ngày' },
            { value: '30d', label: '30 ngày' },
            { value: 'all', label: 'Tất cả' },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : error ? (
        <Alert
          tone="danger"
          title="Không tải được nhật ký"
          action={
            <Button size="sm" variant="secondary" onClick={() => void reload()}>
              Thử lại
            </Button>
          }
        >
          {getApiErrorMessage(error)}
        </Alert>
      ) : logs.length === 0 ? (
        <EmptyState
          size="sm"
          icon={History}
          title="Chưa có hoạt động nào"
          description="Không có ghi nhận cho kho này trong khoảng thời gian đã chọn."
        />
      ) : (
        <Timeline
          items={logs.map((log) => ({
            id: log.id,
            title: actionLabel(log),
            description: log.description ?? log.details,
            time: formatDateTime(log.createdAt),
            tone: log.status === 'SUCCESS' ? undefined : log.status === 'WARNING' ? 'warning' : 'danger',
            meta: <span className="text-xs text-fg-subtle">{log.userFullName ?? log.userName ?? log.username ?? 'Hệ thống'}</span>,
          }))}
        />
      )}
    </section>
  )
}
