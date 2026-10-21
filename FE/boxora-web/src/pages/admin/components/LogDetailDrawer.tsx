import { Badge, Button, DescriptionList, Drawer } from '@/components/ui'
import { getActivityLogStatusMeta, getRoleMeta } from '@/constants/statusMeta'
import { formatDateTime } from '@/lib/format'
import type { ActivityLog } from '@/types'
import { getAuditActionLabel, getLogTypeLabel } from '../lib/auditActions'
import { formatLogValue, getLogActorEmail, getLogActorName, isCriticalLog } from '../lib/auditLog'

export interface LogDetailDrawerProps {
  log: ActivityLog | null
  onClose: () => void
}

/** The before / after value of an edit, kept readable (long JSON wraps instead of widening the drawer). */
const valueBlock = (raw: string | null | undefined, action: string) => {
  const text = formatLogValue(raw, action)
  if (text === null) return null
  // A scalar reads as normal text; only structured JSON needs the monospaced, indented block.
  return text.includes('\n') ? <pre className="whitespace-pre-wrap break-words font-mono text-xs">{text}</pre> : text
}

/** Full record of one audit log entry. */
export function LogDetailDrawer({ log, onClose }: LogDetailDrawerProps) {
  const status = getActivityLogStatusMeta(log?.status)

  return (
    <Drawer
      open={log !== null}
      onClose={onClose}
      title={log ? getAuditActionLabel(log.action) : 'Chi tiết nhật ký'}
      description={log ? formatDateTime(log.createdAt) : undefined}
      footer={<Button variant="secondary" onClick={onClose}>Đóng</Button>}
    >
      {log ? (
        <DescriptionList
          columns={1}
          items={[
            { label: 'Trạng thái', value: <Badge tone={status.tone} dot>{status.label}</Badge> },
            { label: 'Mức độ', value: isCriticalLog(log) ? <Badge tone="danger">Thao tác quan trọng</Badge> : 'Thông thường' },
            { label: 'Tài khoản', value: getLogActorName(log) },
            { label: 'Email', value: getLogActorEmail(log) ?? log.userEmail ?? log.emailAttempted },
            { label: 'Vai trò', value: log.userRole ? getRoleMeta(log.userRole).label : 'Hệ thống' },
            { label: 'Loại nhật ký', value: getLogTypeLabel(log.logType) },
            { label: 'Đối tượng', value: [log.resourceType, log.resourceId].filter(Boolean).join(' · ') || undefined, mono: true },
            { label: 'Cơ sở', value: log.facilityName },
            { label: 'Địa chỉ IP', value: log.ipAddress, mono: true },
            { label: 'Trình duyệt', value: log.userAgent },
            { label: 'Mô tả', value: log.description || log.details, full: true },
            { label: 'Giá trị trước thay đổi', value: valueBlock(log.oldValue, log.action), full: true },
            { label: 'Giá trị sau thay đổi', value: valueBlock(log.newValue, log.action), full: true },
          ].filter(item => item.full !== true || item.value !== null)}
        />
      ) : null}
    </Drawer>
  )
}
