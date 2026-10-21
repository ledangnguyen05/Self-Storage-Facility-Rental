import type { ReactNode } from 'react'
import { Landmark, PiggyBank } from 'lucide-react'
import {
  Badge,
  Button,
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
import { getRefundStatusMeta } from '@/constants/statusMeta'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDate } from '@/lib/format'
import type { RefundRequestItem } from '@/services/refundService'

const COLUMNS = 7

interface RefundsTableProps {
  refunds: RefundRequestItem[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
  onOpen: (refund: RefundRequestItem) => void
  selectedId?: string
  emptyTitle: string
}

export function RefundsTable({ refunds, isLoading, error, onRetry, onOpen, selectedId, emptyTitle }: RefundsTableProps) {
  let body: ReactNode
  if (isLoading) body = <TableLoading colSpan={COLUMNS} rows={5} />
  else if (error && refunds.length === 0) body = <TableError colSpan={COLUMNS} message={getApiErrorMessage(error)} onRetry={onRetry} />
  else if (refunds.length === 0) body = <TableEmpty colSpan={COLUMNS} icon={PiggyBank} title={emptyTitle} description="Yêu cầu hoàn tiền mới sẽ hiển thị tại đây." />
  else {
    body = refunds.map(refund => {
      const status = getRefundStatusMeta(refund.status)
      return (
        <TableRow key={refund.id} onClick={() => onOpen(refund)} selected={refund.id === selectedId}>
          <TableCell>
            <span className="font-mono">{refund.requestCode}</span>
            <span className="block text-xs text-fg-muted tabular-nums">{formatDate(refund.createdAt)}</span>
          </TableCell>
          <TableCell>
            <span className="block">{refund.customerName || '—'}</span>
            <span className="block text-xs text-fg-muted">{refund.customerPhone || refund.customerEmail || '—'}</span>
          </TableCell>
          <TableCell>
            <span className="font-mono">{refund.bookingCode || refund.contractCode || '—'}</span>
            <span className="block text-xs text-fg-muted">
              {[refund.unitCode ? `Kho ${refund.unitCode}` : null, refund.facilityName ? formatFacilityName(refund.facilityName) : null]
                .filter(Boolean)
                .join(' · ') || '—'}
            </span>
          </TableCell>
          <TableCell numeric>
            {formatCurrency(refund.finalRefundAmount)}
            {Number(refund.deductionAmount) > 0 ? (
              <span className="block text-xs text-fg-muted">Khấu trừ {formatCurrency(refund.deductionAmount)}</span>
            ) : null}
          </TableCell>
          <TableCell>
            {refund.bankInfoMissing ? (
              <Badge tone="warning" icon={Landmark}>
                Chưa có tài khoản
              </Badge>
            ) : (
              <span className="text-dense">
                {refund.bankName}
                <span className="block font-mono text-xs text-fg-muted">{refund.bankAccountNumber}</span>
              </span>
            )}
          </TableCell>
          <TableCell>
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
          </TableCell>
          <TableCell align="right">
            <Button
              variant="secondary"
              size="sm"
              onClick={event => {
                event.stopPropagation()
                onOpen(refund)
              }}
            >
              Xử lý
            </Button>
          </TableCell>
        </TableRow>
      )
    })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mã yêu cầu</TableHead>
          <TableHead>Khách hàng</TableHead>
          <TableHead>Đơn / kho</TableHead>
          <TableHead align="right">Số tiền hoàn</TableHead>
          <TableHead>Tài khoản nhận</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead align="right">Thao tác</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{body}</TableBody>
    </Table>
  )
}
