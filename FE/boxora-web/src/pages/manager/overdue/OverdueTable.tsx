import { Ellipsis, FileText, Gavel, Lock, LockOpen, Mail, ShieldCheck, Unlock } from 'lucide-react'
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  IconButton,
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
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/format'
import type { OverdueLedgerItem } from '@/services/overdueService'
import { OVERDUE_STAGES, getOverdueStage } from './overdueModel'

export interface OverdueRowActions {
  onRemind: (item: OverdueLedgerItem) => void
  onLock: (item: OverdueLedgerItem) => void
  onRestore: (item: OverdueLedgerItem) => void
  onSeal: (item: OverdueLedgerItem) => void
  onUnseal: (item: OverdueLedgerItem) => void
  onViewProtocol: (item: OverdueLedgerItem) => void
}

interface OverdueTableProps extends OverdueRowActions {
  rows: OverdueLedgerItem[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
  isFiltered: boolean
  showFacility: boolean
}

const reminderHint = (item: OverdueLedgerItem) => {
  if (!item.canRemind) return 'Khách chưa có email'
  if (!item.lastReminderAt) return undefined
  return item.lastReminderStatus === 'FAILED'
    ? `Lần gửi gần nhất lỗi lúc ${formatDateTime(item.lastReminderAt)}`
    : `Đã gửi ${formatNumber(item.reminderCount)} lần, gần nhất ${formatDateTime(item.lastReminderAt)}`
}

function RowActions({ item, ...actions }: { item: OverdueLedgerItem } & OverdueRowActions) {
  const unit = item.unitCode ?? 'kho'
  let primary
  if (item.sealed) {
    primary = (
      <Button size="sm" variant="secondary" leftIcon={FileText} onClick={() => actions.onViewProtocol(item)}>
        Xem biên bản
      </Button>
    )
  } else if (item.canSeal) {
    primary = (
      <Button size="sm" variant="danger" leftIcon={Gavel} onClick={() => actions.onSeal(item)}>
        Niêm phong
      </Button>
    )
  } else if (item.canRestoreAccess) {
    primary = (
      <Button size="sm" variant="secondary" leftIcon={LockOpen} onClick={() => actions.onRestore(item)}>
        Mở khóa truy cập
      </Button>
    )
  } else if (item.canLockout) {
    primary = (
      <Button size="sm" variant="secondary" leftIcon={Lock} onClick={() => actions.onLock(item)}>
        Khóa truy cập
      </Button>
    )
  } else {
    primary = (
      <Button size="sm" variant="secondary" leftIcon={Mail} disabled={!item.canRemind} onClick={() => actions.onRemind(item)}>
        Gửi nhắc nợ
      </Button>
    )
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {primary}
      <DropdownMenu trigger={<IconButton icon={Ellipsis} aria-label={`Thao tác khác cho kho ${unit}`} size="sm" />}>
        <DropdownMenuItem icon={Mail} disabled={!item.canRemind} description={reminderHint(item)} onSelect={() => actions.onRemind(item)}>
          Gửi email nhắc nợ
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={Lock}
          disabled={!item.canLockout}
          description={
            item.accessLocked
              ? 'Quyền truy cập đã bị khóa'
              : !item.canLockout
                ? `Từ ngày quá hạn thứ ${formatNumber(item.accessDisableDays)}`
                : undefined
          }
          onSelect={() => actions.onLock(item)}
        >
          Khóa truy cập
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={Unlock}
          disabled={!item.canRestoreAccess}
          description={item.sealed ? 'Cần gỡ niêm phong trước' : !item.accessLocked ? 'Quyền truy cập đang mở' : undefined}
          onSelect={() => actions.onRestore(item)}
        >
          Mở khóa truy cập
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {item.sealed ? (
          <>
            <DropdownMenuItem icon={FileText} onSelect={() => actions.onViewProtocol(item)}>
              Xem và in biên bản
            </DropdownMenuItem>
            <DropdownMenuItem icon={LockOpen} disabled={!item.canUnseal} onSelect={() => actions.onUnseal(item)}>
              Gỡ niêm phong
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem
            icon={Gavel}
            tone="danger"
            disabled={!item.canSeal}
            description={!item.canSeal ? `Từ ngày quá hạn thứ ${formatNumber(item.sealingDays)}` : undefined}
            onSelect={() => actions.onSeal(item)}
          >
            Lập biên bản niêm phong
          </DropdownMenuItem>
        )}
      </DropdownMenu>
    </div>
  )
}

/** Delinquency ledger: one row per overdue contract with the next action allowed by the facility policy. */
export function OverdueTable({ rows, isLoading, error, onRetry, isFiltered, showFacility, ...actions }: OverdueTableProps) {
  const colSpan = showFacility ? 10 : 9
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Kho</TableHead>
          {showFacility ? <TableHead className="hidden lg:table-cell">Cơ sở</TableHead> : null}
          <TableHead>Khách hàng</TableHead>
          <TableHead className="hidden lg:table-cell">Hợp đồng</TableHead>
          <TableHead align="right">Quá hạn</TableHead>
          <TableHead>Giai đoạn</TableHead>
          <TableHead align="right" className="hidden md:table-cell">
            Tiền thuê quá hạn
          </TableHead>
          <TableHead align="right" className="hidden md:table-cell">
            Phí trễ hạn
          </TableHead>
          <TableHead align="right">Tổng nợ</TableHead>
          {/* On a phone the table scrolls sideways; the action column stays in reach at the right edge. */}
          <TableHead align="right" className="max-md:sticky max-md:right-0 max-md:bg-surface-2">
            <span className="sr-only">Thao tác</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableLoading colSpan={colSpan} />
        ) : error ? (
          <TableError colSpan={colSpan} message={getApiErrorMessage(error, 'Không tải được danh sách nợ quá hạn.')} onRetry={onRetry} />
        ) : rows.length === 0 ? (
          <TableEmpty
            colSpan={colSpan}
            icon={ShieldCheck}
            title={isFiltered ? 'Không có khoản nợ phù hợp bộ lọc' : 'Không có khoản nợ quá hạn'}
            description={isFiltered ? 'Thử đổi giai đoạn hoặc từ khóa tìm kiếm.' : 'Tất cả hợp đồng đang trong hạn thanh toán.'}
          />
        ) : (
          rows.map((item) => {
            const stage = OVERDUE_STAGES[getOverdueStage(item)]
            return (
              <TableRow key={item.contractId}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="whitespace-nowrap font-mono text-dense font-medium">{item.unitCode ?? '—'}</span>
                    {/* The facility column is hidden on small screens, so the facility moves under the unit code. */}
                    {showFacility ? <span className="text-xs text-fg-muted lg:hidden">{item.facilityName ?? '—'}</span> : null}
                  </div>
                </TableCell>
                {showFacility ? <TableCell className="hidden text-fg-muted lg:table-cell">{item.facilityName ?? '—'}</TableCell> : null}
                <TableCell>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{item.customerName ?? '—'}</span>
                    <span className="text-xs tabular-nums text-fg-muted">{item.customerPhone ?? item.customerEmail ?? '—'}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="flex min-w-0 flex-col">
                    <span className="whitespace-nowrap font-mono text-dense">{item.contractCode}</span>
                    <span className="text-xs text-fg-muted">Hết hạn {formatDate(item.dueDate)}</span>
                  </div>
                </TableCell>
                <TableCell numeric>{`${formatNumber(item.daysOverdue)} ngày`}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={stage.tone} dot>
                      {stage.label}
                    </Badge>
                    {item.sealed ? (
                      <Badge tone="danger" size="sm" icon={Gavel}>
                        Đã niêm phong
                      </Badge>
                    ) : item.accessLocked ? (
                      <Badge tone="neutral" size="sm" icon={Lock}>
                        Đã khóa
                      </Badge>
                    ) : null}
                    {item.accessHoldUntil && !item.accessLocked ? (
                      <Badge tone="info" size="sm">{`Giữ truy cập đến ${formatDate(item.accessHoldUntil)}`}</Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell numeric className="hidden md:table-cell">
                  {formatCurrency(item.unpaidRent)}
                </TableCell>
                <TableCell numeric className="hidden md:table-cell">
                  {formatCurrency(item.totalLateFee)}
                </TableCell>
                <TableCell numeric>
                  <div className="flex flex-col items-end">
                    <span className="font-medium">{formatCurrency(item.totalDebt)}</span>
                    {item.paidSinceDue > 0 ? (
                      <span className="text-xs text-fg-muted">{`Đã trừ ${formatCurrency(item.paidSinceDue)}`}</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell align="right" className="max-md:sticky max-md:right-0 max-md:bg-surface max-md:shadow-[-8px_0_8px_-8px_rgb(0_0_0/0.15)]">
                  <RowActions item={item} {...actions} />
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}
