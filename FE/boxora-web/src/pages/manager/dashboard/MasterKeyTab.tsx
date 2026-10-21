import { useMemo, useState } from 'react'
import { KeySquare, Plus } from 'lucide-react'
import {
  Alert,
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
  useToast,
} from '@/components/ui'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatDateTime } from '@/lib/format'
import { masterKeyService } from '@/services/masterKeyService'
import type { StorageUnit } from '@/types'
import { MasterKeyOverrideModal } from '../modals/MasterKeyOverrideModal'
import { masterKeyCategoryLabel, masterKeySeverityMeta } from './masterKeyModel'

interface MasterKeyTabProps {
  facilityId: string
  units: StorageUnit[]
}

const PAGE_SIZE = 10

/** History of physical master-key uses at the facility, and the two-person record form. */
export function MasterKeyTab({ facilityId, units }: MasterKeyTabProps) {
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [isOpen, setIsOpen] = useState(false)
  const query = useAsyncData((signal) => masterKeyService.getAll({ facilityId, page: page - 1, size: PAGE_SIZE }, { signal }), [facilityId, page])
  const unitCodes = useMemo(() => new Map(units.map((unit) => [unit.id, unit.unitCode])), [units])
  const rows = query.data?.content ?? []

  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info">
        Ghi nhận mỗi lần mở kho của khách bằng chìa khóa cơ tổng, có người chứng kiến xác thực bằng mật khẩu. Hệ thống không điều
        khiển khóa từ xa; mỗi bản ghi được lưu vết và gửi cảnh báo tới quản lý kinh doanh và quản trị viên.
      </Alert>
      <Card className="overflow-hidden">
        <CardHeader
          divider
          title="Lịch sử sử dụng chìa khóa tổng"
          description="Mới nhất trước"
          actions={
            <Button size="sm" leftIcon={Plus} onClick={() => setIsOpen(true)}>
              Ghi nhận sử dụng
            </Button>
          }
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Thời điểm</TableHead>
              <TableHead>Kho</TableHead>
              <TableHead>Tình huống</TableHead>
              <TableHead>Mức độ</TableHead>
              <TableHead>Người sử dụng</TableHead>
              <TableHead>Người chứng kiến</TableHead>
              <TableHead>Lý do</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              <TableLoading colSpan={7} />
            ) : query.error ? (
              <TableError colSpan={7} message={getApiErrorMessage(query.error, 'Không tải được lịch sử chìa khóa tổng.')} onRetry={() => void query.reload()} />
            ) : rows.length === 0 ? (
              <TableEmpty
                colSpan={7}
                icon={KeySquare}
                title="Chưa có lần sử dụng nào"
                description="Mỗi lần dùng chìa khóa cơ tổng cần được ghi nhận tại đây."
                action={
                  <Button size="sm" variant="secondary" leftIcon={Plus} onClick={() => setIsOpen(true)}>
                    Ghi nhận sử dụng
                  </Button>
                }
              />
            ) : (
              rows.map((record) => {
                const severity = masterKeySeverityMeta(record.severity)
                return (
                  <TableRow key={record.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(record.createdAt)}</TableCell>
                    <TableCell className="font-mono text-dense">
                      {record.resourceId ? (unitCodes.get(record.resourceId) ?? '—') : '—'}
                    </TableCell>
                    <TableCell>{masterKeyCategoryLabel(record.category)}</TableCell>
                    <TableCell>
                      <Badge tone={severity.tone}>{severity.label}</Badge>
                    </TableCell>
                    <TableCell>{record.performedByName ?? '—'}</TableCell>
                    <TableCell>{record.witnessName ?? '—'}</TableCell>
                    <TableCell className="max-w-72">
                      <span className="line-clamp-2 text-dense">{record.reason}</span>
                      {record.documentReference ? <span className="block text-xs text-fg-muted">{`Văn bản ${record.documentReference}`}</span> : null}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        {query.data && query.data.totalPages > 1 ? (
          <Pagination page={page} pageCount={query.data.totalPages} total={query.data.totalElements} pageSize={PAGE_SIZE} onPageChange={setPage} />
        ) : null}
      </Card>

      <MasterKeyOverrideModal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        facilityId={facilityId}
        units={units}
        onRecorded={() => {
          setIsOpen(false)
          toast.success('Đã ghi nhận lần sử dụng chìa khóa tổng', 'Quản lý kinh doanh và quản trị viên nhận cảnh báo trong trung tâm thông báo.')
          setPage(1)
          void query.reload()
        }}
      />
    </div>
  )
}
