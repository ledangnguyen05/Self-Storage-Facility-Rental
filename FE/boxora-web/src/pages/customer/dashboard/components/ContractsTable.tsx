import type { ReactNode } from 'react'
import { FileText, PenLine, ShieldCheck } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  IconButton,
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
import { getContractStatusMeta } from '@/constants/statusMeta'
import { usePagination } from '@/hooks/usePagination'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDate } from '@/lib/format'
import type { RentalContract } from '@/types'

const COLUMNS = 7

interface ContractsTableProps {
  contracts: RentalContract[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
  onView: (contract: RentalContract) => void
  onSign: (contract: RentalContract) => void
  onViewPolicy: (contract: RentalContract) => void
}

export function ContractsTable({ contracts, isLoading, error, onRetry, onView, onSign, onViewPolicy }: ContractsTableProps) {
  const pager = usePagination({ items: contracts })
  const rows = pager.slice(contracts)

  const loadFailed = Boolean(error) && contracts.length === 0

  let body: ReactNode
  if (isLoading) body = <TableLoading colSpan={COLUMNS} rows={3} />
  else if (loadFailed) body = <TableError colSpan={COLUMNS} message={getApiErrorMessage(error)} onRetry={onRetry} />
  else if (contracts.length === 0) {
    body = <TableEmpty colSpan={COLUMNS} icon={FileText} title="Chưa có hợp đồng" description="Hợp đồng được tạo khi bạn đặt kho và hoàn tất thủ tục." />
  } else {
    body = rows.map(contract => {
      const status = getContractStatusMeta(contract.status)
      const awaitingSignature = (contract.status ?? '').toUpperCase() === 'PENDING_SIGNATURE'
      return (
        <TableRow key={contract.id}>
          <TableCell className="font-mono">{contract.contractCode || '—'}</TableCell>
          <TableCell>
            <span className="font-mono">{contract.unitCode || '—'}</span>
            <span className="block text-xs text-fg-muted">{contract.facilityName ? formatFacilityName(contract.facilityName) : '—'}</span>
          </TableCell>
          <TableCell className="whitespace-nowrap tabular-nums">
            {formatDate(contract.startDate)} – {formatDate(contract.endDate)}
            {(contract.status ?? '').toUpperCase() === 'PENDING_ACTIVATION' ? (
              <span className="block text-xs text-fg-muted">Hiệu lực khi nhận kho</span>
            ) : null}
          </TableCell>
          <TableCell numeric>{formatCurrency(contract.monthlyFee)}</TableCell>
          <TableCell numeric>
            {formatCurrency(contract.depositHeld)}
            {(Number(contract.depositAmount) || 0) > (Number(contract.depositHeld) || 0) ? (
              <span className="block text-xs text-fg-muted">Cần nộp {formatCurrency(contract.depositAmount)}</span>
            ) : null}
          </TableCell>
          <TableCell>
            <Badge tone={status.tone}>{status.label}</Badge>
          </TableCell>
          <TableCell align="right">
            <div className="flex items-center justify-end gap-1">
              {awaitingSignature ? (
                <Button variant="secondary" size="sm" leftIcon={PenLine} onClick={() => onSign(contract)}>
                  Ký ngay
                </Button>
              ) : null}
              <IconButton icon={ShieldCheck} size="sm" aria-label="Chính sách cơ sở" tooltip onClick={() => onViewPolicy(contract)} />
              <Button variant="secondary" size="sm" onClick={() => onView(contract)}>
                Chi tiết
              </Button>
            </div>
          </TableCell>
        </TableRow>
      )
    })
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Hợp đồng thuê kho" description="Điều khoản, thời hạn và văn bản hợp đồng đã ký." divider />
      <div className="hidden md:block">
        <Table density="comfortable">
          <TableHeader>
            <TableRow>
              <TableHead>Mã hợp đồng</TableHead>
              <TableHead>Kho</TableHead>
              <TableHead>Thời hạn</TableHead>
              <TableHead align="right">Phí hàng tháng</TableHead>
              <TableHead align="right">Tiền cọc</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead align="right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{body}</TableBody>
        </Table>
      </div>

      {/* Phones: one card per contract, so status and actions need no sideways scrolling. */}
      <div className="md:hidden">
        {isLoading ? (
          <div className="flex flex-col gap-3 p-4" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-32 w-full" />
            ))}
          </div>
        ) : loadFailed ? (
          <div className="p-4">
            <Alert
              tone="danger"
              title="Không tải được hợp đồng"
              action={
                <Button size="sm" variant="secondary" onClick={onRetry}>
                  Thử lại
                </Button>
              }
            >
              {getApiErrorMessage(error)}
            </Alert>
          </div>
        ) : contracts.length === 0 ? (
          <EmptyState icon={FileText} size="sm" title="Chưa có hợp đồng" description="Hợp đồng được tạo khi bạn đặt kho và hoàn tất thủ tục." />
        ) : (
          <ul className="divide-y divide-line" aria-label="Hợp đồng thuê kho">
            {rows.map(contract => {
              const status = getContractStatusMeta(contract.status)
              const statusCode = (contract.status ?? '').toUpperCase()
              return (
                <li key={contract.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-dense text-fg">{contract.contractCode || '—'}</p>
                      <p className="text-xs text-fg-muted">
                        Kho <span className="font-mono">{contract.unitCode || '—'}</span>
                        {contract.facilityName ? ` · ${formatFacilityName(contract.facilityName)}` : ''}
                      </p>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-dense">
                    <div className="col-span-2">
                      <dt className="text-xs text-fg-muted">Thời hạn</dt>
                      <dd className="tabular-nums text-fg">
                        {formatDate(contract.startDate)} – {formatDate(contract.endDate)}
                        {statusCode === 'PENDING_ACTIVATION' ? <span className="block text-xs text-fg-muted">Hiệu lực khi nhận kho</span> : null}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-fg-muted">Phí hàng tháng</dt>
                      <dd className="tabular-nums text-fg">{formatCurrency(contract.monthlyFee)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-fg-muted">Tiền cọc</dt>
                      <dd className="tabular-nums text-fg">
                        {formatCurrency(contract.depositHeld)}
                        {(Number(contract.depositAmount) || 0) > (Number(contract.depositHeld) || 0) ? (
                          <span className="block text-xs text-fg-muted">Cần nộp {formatCurrency(contract.depositAmount)}</span>
                        ) : null}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {statusCode === 'PENDING_SIGNATURE' ? (
                      <Button variant="secondary" size="sm" leftIcon={PenLine} onClick={() => onSign(contract)}>
                        Ký ngay
                      </Button>
                    ) : null}
                    <IconButton icon={ShieldCheck} size="sm" aria-label="Chính sách cơ sở" tooltip onClick={() => onViewPolicy(contract)} />
                    <Button variant="secondary" size="sm" onClick={() => onView(contract)}>
                      Chi tiết
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {!isLoading && contracts.length > 0 ? (
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
