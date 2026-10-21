import React, { useMemo, useState } from 'react'
import { Building2, Eye } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  IconButton,
  Pagination,
  ProgressBar,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableError,
  TableHead,
  TableHeader,
  TableLoading,
  TableRow,
  cn,
} from '@/components/ui'
import { getFacilityStatusMeta } from '@/constants/statusMeta'
import { usePagination } from '@/hooks/usePagination'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format'
import type { Facility, OccupancyReport, RevenueReport } from '@/types'

type OccupancyRow = NonNullable<OccupancyReport['byFacility']>[number]
type RevenueRow = NonNullable<RevenueReport['byFacility']>[number]
type SortKey = 'revenue' | 'occupancy'

export interface FacilityComparisonTableProps {
  occupancyRows: readonly OccupancyRow[]
  revenueRows: readonly RevenueRow[]
  facilities: readonly Facility[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
  /** Facility currently in scope, or undefined for the whole chain. */
  scopedFacilityId?: string
  onSelectFacility: (facilityId: string) => void
  onShowAll: () => void
}

const COLUMN_COUNT = 9

/** Badge for a facility that is not in normal operation (inactive or under maintenance); nothing for an active one. */
function FacilityStatusBadge({ status }: { status: string | undefined }) {
  const key = (status ?? '').toUpperCase()
  if (!key || key === 'ACTIVE') return null
  const meta = getFacilityStatusMeta(key)
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

const joinAddress = (facility: Facility | undefined): string | undefined =>
  facility?.address ? [facility.address, facility.city].filter(Boolean).join(', ') : undefined

function CardStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="tabular-nums text-fg">{children}</dd>
    </div>
  )
}

/**
 * Occupancy and revenue per facility. Sorted by revenue by default; select a row's eye icon to scope the page to it.
 * Revenue is net cash of the selected period (collected minus refunded); rent includes renewals.
 * Below the md breakpoint the nine columns become one card per facility, so no figure hides in a sideways scroll.
 */
export function FacilityComparisonTable({
  occupancyRows,
  revenueRows,
  facilities,
  isLoading,
  error,
  onRetry,
  scopedFacilityId,
  onSelectFacility,
  onShowAll,
}: FacilityComparisonTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('revenue')

  const rows = useMemo(() => {
    const revenueOf = (facilityId: string) => revenueRows.find(item => item.facilityId === facilityId)
    return occupancyRows
      .map(occupancy => ({ occupancy, revenue: revenueOf(occupancy.facilityId), facility: facilities.find(item => item.id === occupancy.facilityId) }))
      .sort((a, b) =>
        sortKey === 'occupancy'
          ? b.occupancy.occupancyRate - a.occupancy.occupancyRate
          : (b.revenue?.totalRevenue ?? -1) - (a.revenue?.totalRevenue ?? -1),
      )
  }, [occupancyRows, revenueRows, facilities, sortKey])

  const pager = usePagination({ items: rows })
  const pageRows = pager.slice(rows)
  // Loading, error and empty states keep using the table on every screen size.
  const showCards = !isLoading && !error && pageRows.length > 0

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="So sánh các cơ sở"
        description="Công suất kho và doanh thu thực thu (đã trừ hoàn tiền) của từng cơ sở trong kỳ báo cáo."
        divider
        actions={
          scopedFacilityId ? (
            <Button variant="secondary" size="sm" className="print:hidden" onClick={onShowAll}>
              Xem tất cả cơ sở
            </Button>
          ) : null
        }
      />
      {scopedFacilityId && !isLoading && !error ? (
        <div className="border-b border-line p-4 print:hidden">
          <Alert tone="info">Đang lọc theo một cơ sở. Chọn “Xem tất cả cơ sở” để so sánh toàn chuỗi.</Alert>
        </div>
      ) : null}

      {showCards ? (
        <ul aria-label="Danh sách cơ sở" className="divide-y divide-line md:hidden print:hidden">
          {pageRows.map(({ occupancy, revenue, facility }) => {
            const rent = revenue ? revenue.rentalFeeRevenue + revenue.renewalFeeRevenue : undefined
            const address = joinAddress(facility)
            const isScoped = occupancy.facilityId === scopedFacilityId
            return (
              <li key={occupancy.facilityId} className={cn('flex flex-col gap-3 p-4', isScoped && 'bg-accent-subtle')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium text-fg">{occupancy.facilityName}</span>
                      <FacilityStatusBadge status={facility?.status} />
                    </div>
                    <div className="font-mono text-xs text-fg-subtle">{facility?.code ?? '—'}</div>
                    {address ? <div className="mt-0.5 text-xs text-fg-muted">{address}</div> : null}
                    {facility?.contactPhone ? <div className="text-xs text-fg-subtle">Hotline: {facility.contactPhone}</div> : null}
                  </div>
                  <IconButton
                    icon={Eye}
                    size="sm"
                    aria-label={`Xem báo cáo của ${occupancy.facilityName}`}
                    disabled={isScoped}
                    onClick={() => onSelectFacility(occupancy.facilityId)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <ProgressBar value={occupancy.occupancyRate} thresholds={{ warning: 80, danger: 95 }} size="sm" aria-label="Công suất" />
                  <span className="w-14 shrink-0 text-right text-dense tabular-nums">{formatPercent(occupancy.occupancyRate, { fractionDigits: 1 })}</span>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-dense">
                  <CardStat label="Tổng kho">{formatNumber(occupancy.totalUnits)}</CardStat>
                  <CardStat label="Đang thuê">
                    {formatNumber(occupancy.occupiedUnits)}
                    {occupancy.lockedUnits > 0 ? <span className="block text-xs text-danger">{formatNumber(occupancy.lockedUnits)} bị khóa do nợ</span> : null}
                  </CardStat>
                  <CardStat label="Kho trống">{formatNumber(occupancy.availableUnits)}</CardStat>
                  <CardStat label="Doanh thu">
                    <span className="font-medium">{formatCurrency(revenue?.totalRevenue)}</span>
                    {revenue && revenue.refundedAmount > 0 ? <span className="block text-xs text-fg-subtle">đã hoàn {formatCurrency(revenue.refundedAmount)}</span> : null}
                  </CardStat>
                  <CardStat label="Tiền thuê">
                    {formatCurrency(rent)}
                    {revenue && revenue.renewalFeeRevenue > 0 ? <span className="block text-xs text-fg-subtle">gồm gia hạn {formatCurrency(revenue.renewalFeeRevenue)}</span> : null}
                  </CardStat>
                </dl>
              </li>
            )
          })}
        </ul>
      ) : null}

      <Table containerClassName={cn(showCards && 'hidden md:block print:block')}>
        <TableHeader>
          <TableRow>
            <TableHead>Cơ sở</TableHead>
            <TableHead className="print:hidden">Địa chỉ</TableHead>
            <TableHead align="right">Tổng kho</TableHead>
            <TableHead align="right">Đang thuê</TableHead>
            <TableHead
              sortable
              sortDirection={sortKey === 'occupancy' ? 'desc' : false}
              onSort={() => setSortKey('occupancy')}
              className="min-w-40"
            >
              Công suất
            </TableHead>
            <TableHead align="right">Kho trống</TableHead>
            <TableHead align="right" sortable sortDirection={sortKey === 'revenue' ? 'desc' : false} onSort={() => setSortKey('revenue')}>
              Doanh thu
            </TableHead>
            <TableHead align="right">Tiền thuê</TableHead>
            <TableHead align="right" className="print:hidden">
              <span className="sr-only">Thao tác</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableLoading colSpan={COLUMN_COUNT} rows={4} />
          ) : error ? (
            <TableError colSpan={COLUMN_COUNT} onRetry={onRetry} />
          ) : pageRows.length === 0 ? (
            <TableEmpty colSpan={COLUMN_COUNT} icon={Building2} title="Chưa có dữ liệu cơ sở" description="Số liệu hiển thị khi có cơ sở trong hệ thống." />
          ) : (
            pageRows.map(({ occupancy, revenue, facility }) => {
              const rent = revenue ? revenue.rentalFeeRevenue + revenue.renewalFeeRevenue : undefined
              return (
                <TableRow key={occupancy.facilityId} selected={occupancy.facilityId === scopedFacilityId}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium text-fg">{occupancy.facilityName}</span>
                      <FacilityStatusBadge status={facility?.status} />
                    </div>
                    <div className="font-mono text-xs text-fg-subtle">{facility?.code ?? '—'}</div>
                    {facility?.contactPhone ? <div className="text-xs text-fg-subtle">Hotline: {facility.contactPhone}</div> : null}
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-fg-muted print:hidden">{joinAddress(facility) ?? '—'}</TableCell>
                  <TableCell numeric>{formatNumber(occupancy.totalUnits)}</TableCell>
                  <TableCell numeric>
                    <div>{formatNumber(occupancy.occupiedUnits)}</div>
                    {occupancy.lockedUnits > 0 ? <div className="text-xs text-danger">{formatNumber(occupancy.lockedUnits)} bị khóa do nợ</div> : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ProgressBar value={occupancy.occupancyRate} thresholds={{ warning: 80, danger: 95 }} size="sm" />
                      <span className="w-14 shrink-0 text-right tabular-nums">{formatPercent(occupancy.occupancyRate, { fractionDigits: 1 })}</span>
                    </div>
                  </TableCell>
                  <TableCell numeric>{formatNumber(occupancy.availableUnits)}</TableCell>
                  <TableCell numeric className="font-medium">
                    <div>{formatCurrency(revenue?.totalRevenue)}</div>
                    {revenue && revenue.refundedAmount > 0 ? <div className="text-xs font-normal text-fg-subtle">đã hoàn {formatCurrency(revenue.refundedAmount)}</div> : null}
                  </TableCell>
                  <TableCell numeric>
                    <div>{formatCurrency(rent)}</div>
                    {revenue && revenue.renewalFeeRevenue > 0 ? <div className="text-xs text-fg-subtle">gồm gia hạn {formatCurrency(revenue.renewalFeeRevenue)}</div> : null}
                  </TableCell>
                  <TableCell align="right" className="print:hidden">
                    <IconButton
                      icon={Eye}
                      size="sm"
                      tooltip
                      aria-label={`Xem báo cáo của ${occupancy.facilityName}`}
                      disabled={occupancy.facilityId === scopedFacilityId}
                      onClick={() => onSelectFacility(occupancy.facilityId)}
                    />
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
      {pager.pageCount > 1 ? (
        <div className="border-t border-line px-4 py-3 print:hidden">
          <Pagination page={pager.page} pageCount={pager.pageCount} total={pager.total} pageSize={pager.pageSize} onPageChange={pager.setPage} onPageSizeChange={pager.setPageSize} />
        </div>
      ) : null}
    </Card>
  )
}
