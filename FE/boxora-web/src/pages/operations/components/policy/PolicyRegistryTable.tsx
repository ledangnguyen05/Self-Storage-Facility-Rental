import { Ellipsis, KeyRound, Pencil, Plus, Power, PowerOff, ScrollText, Trash2 } from 'lucide-react'
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  IconButton,
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
} from '@/components/ui'
import { usePagination } from '@/hooks/usePagination'
import { formatCurrency } from '@/lib/format'
import type { Facility, FacilityPolicy } from '@/types'
import { BOOKING_HOLD_DEFAULTS, resolvePolicy } from '@/utils/facilityPolicyDefaults'

export interface PolicyRegistryTableProps {
  facilities: readonly Facility[]
  policies: readonly FacilityPolicy[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
  /** Business manager: create, edit, switch on/off, grant exceptions and delete. Admin sees the table read-only. */
  canManage: boolean
  onCreate: (facility: Facility) => void
  onEdit: (facility: Facility, policy: FacilityPolicy) => void
  onToggleActive: (policy: FacilityPolicy) => void
  onGrantExceptions: (facility: Facility, policy: FacilityPolicy) => void
  onDelete: (facility: Facility, policy: FacilityPolicy) => void
}

function PolicyStatusBadge({ policy }: { policy?: FacilityPolicy }) {
  if (!policy) return <Badge tone="warning" dot>Chưa cấu hình</Badge>
  if (policy.isActive === false) return <Badge tone="neutral" dot>Ngừng áp dụng</Badge>
  return <Badge tone="success" dot>Đang áp dụng</Badge>
}

function Stacked({ main, sub }: { main: string; sub: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-fg">{main}</span>
      <span className="text-xs text-fg-subtle">{sub}</span>
    </div>
  )
}

/** One row per facility with the policy numbers that matter to a business manager. */
export function PolicyRegistryTable({
  facilities,
  policies,
  isLoading,
  error,
  onRetry,
  canManage,
  onCreate,
  onEdit,
  onToggleActive,
  onGrantExceptions,
  onDelete,
}: PolicyRegistryTableProps) {
  const pager = usePagination({ items: facilities })
  const pageFacilities = pager.slice(facilities)
  const columnCount = canManage ? 8 : 7

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cơ sở</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Cọc và thuê tối thiểu</TableHead>
            <TableHead>Gia hạn và trả kho</TableHead>
            <TableHead>Hủy và hoàn tiền</TableHead>
            <TableHead>SLA hoàn cọc</TableHead>
            <TableHead>Quá hạn</TableHead>
            {canManage ? (
              <TableHead align="right">
                <span className="sr-only">Thao tác</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableLoading colSpan={columnCount} rows={4} />
          ) : error ? (
            <TableError colSpan={columnCount} onRetry={onRetry} />
          ) : pageFacilities.length === 0 ? (
            <TableEmpty colSpan={columnCount} icon={ScrollText} title="Chưa có cơ sở" description="Tạo cơ sở trong mục Cấu hình chi nhánh trước khi ban hành chính sách." />
          ) : (
            pageFacilities.map(facility => {
              const policy = policies.find(item => item.facilityId === facility.id)
              const resolved = resolvePolicy(policy, facility.id)
              return (
                <TableRow key={facility.id}>
                  <TableCell>
                    <div className="font-medium text-fg">{facility.name}</div>
                    <div className="font-mono text-xs text-fg-subtle">{facility.code ?? '—'}</div>
                  </TableCell>
                  <TableCell>
                    <PolicyStatusBadge policy={policy} />
                  </TableCell>
                  {policy ? (
                    <>
                      <TableCell>
                        <Stacked
                          main={`Cọc ${resolved.depositPercentage}%`}
                          sub={`Thuê tối thiểu ${resolved.minimumRentalMonths} tháng · giữ chỗ thêm ${policy?.holdGraceHours ?? BOOKING_HOLD_DEFAULTS.holdGraceHours} giờ`}
                        />
                      </TableCell>
                      <TableCell>
                        <Stacked main={`Gia hạn trước ${resolved.renewalWindowDays} ngày`} sub={`Báo trả kho trước ${resolved.returnNoticeDays} ngày`} />
                      </TableCell>
                      <TableCell>
                        <Stacked
                          main={`Hoàn 100% nếu hủy trước ${resolved.cancellationFullRefundHours} giờ`}
                          sub={`Hoàn ${resolved.cancellationPartialRefundPercent}% nếu hủy trước ${resolved.cancellationPartialRefundHours} giờ`}
                        />
                      </TableCell>
                      <TableCell className="tabular-nums">{resolved.depositRefundSlaDays} ngày</TableCell>
                      <TableCell>
                        <Stacked
                          main={`${formatCurrency(resolved.dailyLateFee)} mỗi ngày`}
                          sub={`Ân hạn ${resolved.overdueGraceDays} ngày · khóa PIN sau ${resolved.overdueAccessDisableDays} ngày · niêm phong sau ${resolved.overdueSealingDays} ngày`}
                        />
                      </TableCell>
                    </>
                  ) : (
                    <TableCell colSpan={5} className="text-fg-subtle">
                      Cơ sở đang dùng giá trị mặc định của hệ thống.
                    </TableCell>
                  )}
                  {canManage ? (
                    <TableCell align="right">
                      {policy ? (
                        <DropdownMenu trigger={<IconButton icon={Ellipsis} size="sm" aria-label={`Thao tác chính sách ${facility.name}`} />}>
                          <DropdownMenuItem icon={Pencil} onSelect={() => onEdit(facility, policy)}>
                            Chỉnh sửa
                          </DropdownMenuItem>
                          <DropdownMenuItem icon={KeyRound} onSelect={() => onGrantExceptions(facility, policy)}>
                            Quyền sửa ngoại lệ
                          </DropdownMenuItem>
                          <DropdownMenuItem icon={policy.isActive === false ? Power : PowerOff} onSelect={() => onToggleActive(policy)}>
                            {policy.isActive === false ? 'Kích hoạt' : 'Ngừng áp dụng'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem icon={Trash2} tone="danger" onSelect={() => onDelete(facility, policy)}>
                            Xóa chính sách
                          </DropdownMenuItem>
                        </DropdownMenu>
                      ) : (
                        <Button variant="secondary" size="sm" leftIcon={Plus} onClick={() => onCreate(facility)}>
                          Tạo chính sách
                        </Button>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
      {pager.pageCount > 1 ? (
        <div className="border-t border-line px-4 py-3">
          <Pagination page={pager.page} pageCount={pager.pageCount} total={pager.total} pageSize={pager.pageSize} onPageChange={pager.setPage} onPageSizeChange={pager.setPageSize} />
        </div>
      ) : null}
    </>
  )
}
