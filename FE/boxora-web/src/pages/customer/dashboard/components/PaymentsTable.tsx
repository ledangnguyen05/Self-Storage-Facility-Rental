import { useMemo, type ReactNode } from 'react'
import { ReceiptText } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Pagination,
  Skeleton,
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
import { formatFacilityName } from '@/components/layout/useFacilityScope'
import { getPaymentMethodMeta, getPaymentStatusMeta, getPaymentTypeMeta } from '@/constants/statusMeta'
import { usePagination } from '@/hooks/usePagination'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDateTime } from '@/lib/format'
import type { PaymentItem } from '@/services/paymentService'
import { buildRefundMarks, isPaidPayment, isRefundPayment, type RefundMark } from '../lib/portal'

const COLUMNS = 7

interface PaymentsTableProps {
  payments: PaymentItem[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
  onViewReceipt: (payment: PaymentItem) => void
}

/** Short, stable reference for a payment row (the full id stays in the receipt). */
const shortRef = (payment: PaymentItem) => payment.transactionId || payment.id.slice(0, 8).toUpperCase()

/** Money going back to the customer is shown as an outflow: typed "Hoàn tiền" with a minus sign. */
function paymentTypeLabel(payment: PaymentItem) {
  return isRefundPayment(payment) ? 'Hoàn tiền' : getPaymentTypeMeta(payment.paymentType).label
}

function paymentAmountLabel(payment: PaymentItem) {
  return isRefundPayment(payment) ? `−${formatCurrency(payment.amount)}` : formatCurrency(payment.amount)
}

/** Status badge plus, for a refunded original payment, how much of it went back to the customer. */
function StatusCell({ payment, mark }: { payment: PaymentItem; mark?: RefundMark }) {
  const status = getPaymentStatusMeta(payment.status)
  return (
    <>
      {mark?.full ? <Badge tone="neutral">Đã hoàn tiền</Badge> : <Badge tone={status.tone}>{status.label}</Badge>}
      {mark ? (
        <span className="mt-1 block text-xs text-fg-muted">{mark.full ? 'Đã hoàn lại toàn bộ khoản này' : `Đã hoàn ${formatCurrency(mark.amount)}`}</span>
      ) : null}
      {payment.status === 'FAILED' && payment.failureReason ? (
        <span className="mt-1 block max-w-56 text-xs text-fg-muted">{payment.failureReason}</span>
      ) : null}
    </>
  )
}

export function PaymentsTable({ payments, isLoading, error, onRetry, onViewReceipt }: PaymentsTableProps) {
  const pager = usePagination({ items: payments })
  const rows = pager.slice(payments)
  const refundMarks = useMemo(() => buildRefundMarks(payments), [payments])
  const hasData = payments.length > 0
  const loadFailed = Boolean(error) && !hasData

  let body: ReactNode
  if (isLoading) body = <TableLoading colSpan={COLUMNS} rows={3} />
  else if (loadFailed) body = <TableError colSpan={COLUMNS} message={getApiErrorMessage(error)} onRetry={onRetry} />
  else if (!hasData) {
    body = <TableEmpty colSpan={COLUMNS} icon={ReceiptText} title="Chưa có giao dịch" description="Các khoản thanh toán của bạn sẽ hiển thị tại đây." />
  } else {
    body = rows.map(payment => (
      <TableRow key={payment.id}>
        <TableCell>
          <span className="font-mono">{shortRef(payment)}</span>
          <span className="block text-xs text-fg-muted tabular-nums">{formatDateTime(payment.paymentTime || payment.createdAt)}</span>
        </TableCell>
        <TableCell>
          <span className="font-mono">{payment.unitCode || '—'}</span>
          <span className="block text-xs text-fg-muted">{payment.facilityName ? formatFacilityName(payment.facilityName) : '—'}</span>
        </TableCell>
        <TableCell>{paymentTypeLabel(payment)}</TableCell>
        <TableCell>{payment.paymentMethod ? getPaymentMethodMeta(payment.paymentMethod).label : '—'}</TableCell>
        <TableCell numeric>{paymentAmountLabel(payment)}</TableCell>
        <TableCell>
          <StatusCell payment={payment} mark={refundMarks.get(payment.id)} />
        </TableCell>
        <TableCell align="right">
          {!isRefundPayment(payment) && isPaidPayment(payment) ? (
            <Button variant="secondary" size="sm" leftIcon={ReceiptText} onClick={() => onViewReceipt(payment)}>
              Biên lai
            </Button>
          ) : (
            <span className="text-dense text-fg-subtle">—</span>
          )}
        </TableCell>
      </TableRow>
    ))
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Lịch sử thanh toán" description="Giao dịch VNPay và khoản nộp tại quầy được ghi nhận trên hệ thống." divider />

      <div className="hidden md:block">
        <Table density="comfortable">
          <TableHeader>
            <TableRow>
              <TableHead>Mã giao dịch</TableHead>
              <TableHead>Kho</TableHead>
              <TableHead>Loại</TableHead>
              <TableHead>Phương thức</TableHead>
              <TableHead align="right">Số tiền</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead align="right">Biên lai</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{body}</TableBody>
        </Table>
      </div>

      {/* Phones: one card per payment, so status, amount and receipt need no sideways scrolling. */}
      <div className="md:hidden">
        {isLoading ? (
          <div className="flex flex-col gap-3 p-4" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        ) : loadFailed ? (
          <div className="p-4">
            <Alert
              tone="danger"
              title="Không tải được lịch sử thanh toán"
              action={
                <Button size="sm" variant="secondary" onClick={onRetry}>
                  Thử lại
                </Button>
              }
            >
              {getApiErrorMessage(error)}
            </Alert>
          </div>
        ) : !hasData ? (
          <EmptyState icon={ReceiptText} size="sm" title="Chưa có giao dịch" description="Các khoản thanh toán của bạn sẽ hiển thị tại đây." />
        ) : (
          <ul className="divide-y divide-line" aria-label="Lịch sử thanh toán">
            {rows.map(payment => (
              <li key={payment.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-dense text-fg">{shortRef(payment)}</p>
                    <p className="text-xs text-fg-muted tabular-nums">{formatDateTime(payment.paymentTime || payment.createdAt)}</p>
                  </div>
                  <p className="shrink-0 text-sm font-medium tabular-nums text-fg">{paymentAmountLabel(payment)}</p>
                </div>
                <p className="text-dense text-fg-muted">
                  {[
                    paymentTypeLabel(payment),
                    payment.paymentMethod ? getPaymentMethodMeta(payment.paymentMethod).label : null,
                    payment.unitCode ? `Kho ${payment.unitCode}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <StatusCell payment={payment} mark={refundMarks.get(payment.id)} />
                  </div>
                  {!isRefundPayment(payment) && isPaidPayment(payment) ? (
                    <Button variant="secondary" size="sm" leftIcon={ReceiptText} onClick={() => onViewReceipt(payment)}>
                      Biên lai
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!isLoading && hasData ? (
        <div className="border-t border-line px-5 py-3">
          <Pagination
            page={pager.page}
            pageCount={pager.pageCount}
            total={pager.total}
            pageSize={pager.pageSize}
            onPageChange={pager.setPage}
            onPageSizeChange={pager.setPageSize}
          />
        </div>
      ) : null}
    </Card>
  )
}
