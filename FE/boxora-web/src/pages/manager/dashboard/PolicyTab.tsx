import { Settings2 } from 'lucide-react'
import { Alert, Badge, Button, Card, CardContent, Skeleton } from '@/components/ui'
import { getApiErrorMessage } from '@/lib/apiError'
import { PolicySummary } from '../shared/PolicySummary'
import type { ManagerDashboardData } from './useManagerDashboardData'

interface PolicyTabProps {
  facilityName?: string
  policy: ManagerDashboardData['policy']
  hasPolicyException: boolean
  onEditException: () => void
}

/** Operating policy of the facility as applied today (stored values merged with system defaults). */
export function PolicyTab({ facilityName, policy, hasPolicyException, onEditException }: PolicyTabProps) {
  if (policy.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy="true">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-44" />
        ))}
      </div>
    )
  }

  if (policy.error) {
    return (
      <Alert
        tone="danger"
        title="Không tải được chính sách cơ sở"
        action={
          <Button size="sm" variant="secondary" onClick={() => void policy.reload()}>
            Thử lại
          </Button>
        }
      >
        {getApiErrorMessage(policy.error)}
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-fg">Chính sách vận hành</h2>
              {facilityName ? <Badge tone="neutral">{facilityName}</Badge> : null}
              <Badge tone={hasPolicyException ? 'accent' : 'neutral'} dot>
                {hasPolicyException ? 'Có quyền ngoại lệ' : 'Chỉ xem'}
              </Badge>
            </div>
            <p className="text-dense text-fg-muted">
              Chính sách do giám đốc vận hành ban hành. Mọi điều chỉnh ngoại lệ cần được phê duyệt trước.
            </p>
          </div>
          {hasPolicyException && policy.stored ? (
            <Button leftIcon={Settings2} variant="secondary" onClick={onEditException}>
              Điều chỉnh ngoại lệ
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {!policy.stored ? (
        <Alert tone="info" title="Cơ sở chưa có chính sách riêng">
          Đang áp dụng quy định mặc định của hệ thống. Liên hệ giám đốc vận hành để thiết lập chính sách cho cơ sở này.
        </Alert>
      ) : policy.stored.isActive === false ? (
        <Alert tone="warning" title="Chính sách đã ngừng áp dụng">
          Cơ sở đang dùng quy định mặc định cho đến khi chính sách được kích hoạt lại.
        </Alert>
      ) : null}

      <PolicySummary policy={policy.resolved} />
    </div>
  )
}
