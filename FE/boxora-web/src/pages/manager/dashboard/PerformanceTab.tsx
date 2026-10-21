import { Link } from 'react-router-dom'
import { Alert, Button, Card, CardContent, CardHeader, DescriptionList, ProgressBar, Skeleton, buttonVariants, cn } from '@/components/ui'
import { getUnitStatusMeta } from '@/constants/statusMeta'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format'
import type { OverdueLedger } from '@/services/overdueService'
import type { StorageUnit } from '@/types'
import { TONE_DOT_CLASS, UNIT_STATUS_KEYS, countByStatus, getPhysicalOccupancy } from './unitModel'

interface PerformanceTabProps {
  units: StorageUnit[]
  unitsLoading: boolean
  unitsError: unknown
  onRetryUnits: () => void
  report: { data: OverdueLedger | undefined; isLoading: boolean; error: unknown; reload: () => Promise<void> }
}

/** Occupancy and delinquency summary computed from the facility's units and the overdue ledger. */
export function PerformanceTab({ units, unitsLoading, unitsError, onRetryUnits, report }: PerformanceTabProps) {
  const counts = countByStatus(units)
  const occupancy = getPhysicalOccupancy(units)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader divider title="Công suất kho" description="Tỷ lệ kho đang có khách thuê trên tổng số kho của cơ sở" />
        <CardContent className="flex flex-col gap-5">
          {unitsLoading ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-2" />
              <Skeleton className="h-24" />
            </div>
          ) : unitsError ? (
            <Alert
              tone="danger"
              title="Không tải được dữ liệu kho"
              action={
                <Button size="sm" variant="secondary" onClick={onRetryUnits}>
                  Thử lại
                </Button>
              }
            >
              {getApiErrorMessage(unitsError)}
            </Alert>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                <p className="text-2xl font-semibold tabular-nums text-fg">
                  {occupancy === null ? '—' : formatPercent(occupancy, { fractionDigits: 1 })}
                </p>
                <ProgressBar value={occupancy ?? 0} thresholds={{ warning: 80, danger: 95 }} label="Công suất vật lý" />
                <p className="text-dense text-fg-muted">
                  {formatNumber(counts.OCCUPIED + counts.OVERDUE_LOCKED)} trên {formatNumber(units.length)} kho đang có khách
                </p>
              </div>
              <ul className="flex flex-col divide-y divide-line">
                {UNIT_STATUS_KEYS.map((key) => {
                  const meta = getUnitStatusMeta(key)
                  return (
                    <li key={key} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
                      <span className="flex items-center gap-2 text-fg-muted">
                        <span aria-hidden="true" className={cn('size-2 rounded-full', TONE_DOT_CLASS[meta.tone])} />
                        {meta.label}
                      </span>
                      <span className="font-medium tabular-nums text-fg">{formatNumber(counts[key])}</span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          divider
          title="Nợ quá hạn"
          description="Hợp đồng quá hạn thanh toán theo mốc xử lý của chính sách cơ sở"
          actions={
            <Link to="/portal/overdue" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              Xử lý nợ quá hạn
            </Link>
          }
        />
        <CardContent>
          {report.isLoading ? (
            <Skeleton className="h-40" aria-busy="true" />
          ) : report.error ? (
            <Alert
              tone="danger"
              title="Không tải được sổ nợ quá hạn"
              action={
                <Button size="sm" variant="secondary" onClick={() => void report.reload()}>
                  Thử lại
                </Button>
              }
            >
              {getApiErrorMessage(report.error)}
            </Alert>
          ) : (
            <DescriptionList
              columns={1}
              layout="inline"
              items={[
                { label: 'Hợp đồng quá hạn', value: formatNumber(report.data?.totalOverdueCount ?? 0) },
                { label: 'Tổng nợ cần thu', value: formatCurrency(report.data?.totalDebtAmount ?? 0) },
                { label: 'Phí trễ hạn trong tổng nợ', value: formatCurrency(report.data?.totalLateFees ?? 0) },
                { label: 'Trong ân hạn', value: formatNumber(report.data?.gracePeriodCount ?? 0) },
                { label: 'Trễ hạn, chưa đến mốc khóa', value: formatNumber(report.data?.warningCount ?? 0) },
                { label: 'Đến mốc khóa truy cập', value: formatNumber(report.data?.accessBlockedCount ?? 0) },
                { label: 'Đến mốc niêm phong', value: formatNumber(report.data?.eligibleForSealingCount ?? 0) },
                { label: 'Kho đang khóa truy cập', value: formatNumber(report.data?.accessLockedCount ?? 0) },
                { label: 'Kho đang niêm phong', value: formatNumber(report.data?.sealedCount ?? 0) },
              ]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
