import { useState } from 'react'
import { FileText, Gavel, LockOpen } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableError,
  TableHead,
  TableHeader,
  TableLoading,
  TableRow,
  Tabs,
} from '@/components/ui'
import { getSealingStatusMeta } from '@/constants/statusMeta'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { sealingService, type SealingRecordResponse } from '@/services/sealingService'

type StatusFilter = 'SEALED' | 'UNSEALED' | 'ALL'

interface SealingRecordsCardProps {
  facilityId: string | undefined
  showFacility: boolean
  /** Bumped by the parent after a seal / unseal so the list reloads. */
  refreshKey: number
  onView: (record: SealingRecordResponse) => void
  onUnseal: (record: SealingRecordResponse) => void
}

const PAGE_SIZE = 10

/** Sealing protocols of the facility (server-paged), newest first. */
export function SealingRecordsCard({ facilityId, showFacility, refreshKey, onView, onUnseal }: SealingRecordsCardProps) {
  const [status, setStatus] = useState<StatusFilter>('SEALED')
  const [page, setPage] = useState(1)
  const query = useAsyncData(
    (signal) =>
      sealingService.getAll(
        { facilityId, status: status === 'ALL' ? undefined : status, page: page - 1, size: PAGE_SIZE },
        { signal },
      ),
    [facilityId, status, page, refreshKey],
  )
  const rows = query.data?.content ?? []
  const colSpan = showFacility ? 8 : 7

  const changeStatus = (next: StatusFilter) => {
    setStatus(next)
    setPage(1)
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader divider title="Biên bản niêm phong" description="Biên bản đã lập tại cơ sở, có thể xem, in hoặc gỡ niêm phong" />
      <div className="border-b border-line p-3">
        <Tabs
          variant="segmented"
          size="sm"
          aria-label="Lọc biên bản theo trạng thái"
          value={status}
          onValueChange={changeStatus}
          items={[
            { value: 'SEALED', label: 'Đang niêm phong' },
            { value: 'UNSEALED', label: 'Đã gỡ niêm phong' },
            { value: 'ALL', label: 'Tất cả' },
          ]}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Số biên bản</TableHead>
            <TableHead>Kho</TableHead>
            {showFacility ? <TableHead>Cơ sở</TableHead> : null}
            <TableHead>Khách thuê</TableHead>
            <TableHead>Niêm phong lúc</TableHead>
            <TableHead align="right">Nợ khi niêm phong</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead align="right">
              <span className="sr-only">Thao tác</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.isLoading ? (
            <TableLoading colSpan={colSpan} />
          ) : query.error ? (
            <TableError colSpan={colSpan} message={getApiErrorMessage(query.error, 'Không tải được biên bản niêm phong.')} onRetry={() => void query.reload()} />
          ) : rows.length === 0 ? (
            <TableEmpty
              colSpan={colSpan}
              icon={Gavel}
              title={status === 'SEALED' ? 'Không có kho nào đang niêm phong' : 'Chưa có biên bản'}
              description="Biên bản được lập từ danh sách nợ khi hợp đồng đến mốc niêm phong."
            />
          ) : (
            rows.map((record) => {
              const meta = getSealingStatusMeta(record.status)
              return (
                <TableRow key={record.id}>
                  <TableCell className="font-mono text-dense">{record.protocolNumber ?? '—'}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-dense">{record.unitCode ?? '—'}</TableCell>
                  {showFacility ? <TableCell className="text-fg-muted">{record.facilityName ?? '—'}</TableCell> : null}
                  <TableCell>{record.customerName ?? '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(record.sealedAt)}</TableCell>
                  <TableCell numeric>{formatCurrency(record.totalDebtAmount)}</TableCell>
                  <TableCell>
                    <Badge tone={meta.tone} dot>
                      {meta.label}
                    </Badge>
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="secondary" leftIcon={FileText} onClick={() => onView(record)}>
                        Xem biên bản
                      </Button>
                      {record.status === 'SEALED' ? (
                        <Button size="sm" variant="ghost" leftIcon={LockOpen} onClick={() => onUnseal(record)}>
                          Gỡ niêm phong
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
      {query.data && query.data.totalPages > 1 ? (
        <Pagination
          page={page}
          pageCount={query.data.totalPages}
          total={query.data.totalElements}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      ) : null}
    </Card>
  )
}
