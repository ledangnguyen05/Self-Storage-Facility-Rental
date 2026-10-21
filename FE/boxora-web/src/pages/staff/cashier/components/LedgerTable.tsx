import { Receipt } from 'lucide-react'
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableError,
  TableHead,
  TableHeader,
  TableLoading,
  TableRow,
} from '@/components/ui'
import { getPaymentMethodMeta, getPaymentStatusMeta } from '@/constants/statusMeta'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDateTime } from '@/lib/format'
import type { PaymentItem } from '@/services/paymentService'
import { getLedgerAmount, getLedgerTypeLabel, getPaymentReference, isRefundPayment } from '../ledgerUtils'

const COLUMN_COUNT = 7

interface LedgerTableProps {
  rows: PaymentItem[]
  isLoading: boolean
  /** Set when loading failed and there is nothing to show. */
  error: unknown
  onRetry: () => void
  hasActiveFilters: boolean
}

export function LedgerTable({ rows, isLoading, error, onRetry, hasActiveFilters }: LedgerTableProps) {
  // Phones get one card per transaction (amount and status always in view); the table keeps loading, error and empty states.
  const hasRows = !isLoading && !error && rows.length > 0
  return (
    <>
      {hasRows ? (
        <ul className="divide-y divide-line sm:hidden" aria-label="Sổ quỹ giao dịch">
          {rows.map(payment => {
            const status = getPaymentStatusMeta(payment.status)
            return (
              <li key={payment.id} className="flex flex-col gap-1.5 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-fg">{getLedgerTypeLabel(payment)}</p>
                    <p className="text-xs text-fg-muted">{getPaymentMethodMeta(payment.paymentMethod).label}</p>
                  </div>
                  <p className={cn('shrink-0 text-sm font-medium tabular-nums', isRefundPayment(payment) ? 'text-danger' : 'text-fg')}>
                    {formatCurrency(getLedgerAmount(payment))}
                  </p>
                </div>
                <p className="break-all font-mono text-xs text-fg-muted">{getPaymentReference(payment)}</p>
                <p className="text-xs text-fg-muted">
                  {payment.customerName || '—'}
                  {payment.unitCode ? ` · ${payment.unitCode}` : ''}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone={status.tone} size="sm" dot>
                    {status.label}
                  </Badge>
                  <span className="text-xs tabular-nums text-fg-subtle">{formatDateTime(payment.paymentTime ?? payment.createdAt)}</span>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
      <div className={hasRows ? 'hidden sm:block' : undefined}>
        <Table aria-label="Sổ quỹ giao dịch">
          <TableHeader>
            <TableRow>
              <TableHead>Thời gian</TableHead>
              <TableHead>Mã giao dịch</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead>Kho</TableHead>
              <TableHead>Loại và phương thức</TableHead>
              <TableHead align="right">Số tiền</TableHead>
              <TableHead>Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableLoading colSpan={COLUMN_COUNT} rows={6} />
            ) : error ? (
              <TableError colSpan={COLUMN_COUNT} message={getApiErrorMessage(error, 'Không thể tải sổ quỹ.')} onRetry={onRetry} />
            ) : rows.length === 0 ? (
              <TableEmpty
                colSpan={COLUMN_COUNT}
                icon={Receipt}
                title={hasActiveFilters ? 'Không có giao dịch phù hợp' : 'Chưa có giao dịch trong khoảng này'}
                description={hasActiveFilters ? 'Thử đổi hoặc xóa bộ lọc.' : 'Chọn khoảng thời gian khác để xem các giao dịch trước đó.'}
              />
            ) : (
              rows.map(payment => {
                const status = getPaymentStatusMeta(payment.status)
                return (
                  <TableRow key={payment.id}>
                    <TableCell className="whitespace-nowrap text-dense tabular-nums">
                      {formatDateTime(payment.paymentTime ?? payment.createdAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-dense">{getPaymentReference(payment)}</TableCell>
                    <TableCell className="text-dense">{payment.customerName || '—'}</TableCell>
                    <TableCell>
                      <p className="font-mono text-dense">{payment.unitCode || '—'}</p>
                      {payment.facilityName ? <p className="text-xs text-fg-muted">{payment.facilityName}</p> : null}
                    </TableCell>
                    <TableCell>
                      <p className="text-dense text-fg">{getLedgerTypeLabel(payment)}</p>
                      <p className="text-xs text-fg-muted">{getPaymentMethodMeta(payment.paymentMethod).label}</p>
                    </TableCell>
                    <TableCell numeric className={cn('font-medium', isRefundPayment(payment) && 'text-danger')}>
                      {formatCurrency(getLedgerAmount(payment))}
                    </TableCell>
                    <TableCell>
                      <Badge tone={status.tone} dot>
                        {status.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
