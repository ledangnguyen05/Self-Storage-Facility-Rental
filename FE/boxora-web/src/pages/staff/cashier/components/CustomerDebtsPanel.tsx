import { useMemo, useState, type FormEvent } from 'react'
import { BadgeCheck, Ban, HandCoins, RefreshCw } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Modal,
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
  Textarea,
  useToast,
} from '@/components/ui'
import { CUSTOMER_DEBT_STATUS_OPTIONS, getCustomerDebtStatusMeta } from '@/constants/statusMeta'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDate } from '@/lib/format'
import { handoverService, type CustomerDebt } from '@/services/handoverService'

const COLUMN_COUNT = 7
const ALL = 'ALL'
const NO_DEBTS: CustomerDebt[] = []

type DebtFilter = 'OPEN' | 'COLLECTED' | 'WRITTEN_OFF' | typeof ALL
type DebtOutcome = 'COLLECTED' | 'WRITTEN_OFF'

const FILTER_ITEMS: { value: DebtFilter; label: string }[] = [
  ...CUSTOMER_DEBT_STATUS_OPTIONS.map(option => ({ value: option.value as DebtFilter, label: option.label })),
  { value: ALL, label: 'Tất cả' },
]

const OUTCOME_COPY: Record<DebtOutcome, { title: string; confirm: string; noteLabel: string; placeholder: string }> = {
  COLLECTED: {
    title: 'Ghi nhận đã thu hồi công nợ',
    confirm: 'Ghi nhận đã thu',
    noteLabel: 'Cách thu và chứng từ',
    placeholder: 'Ví dụ: khách chuyển khoản ngày 20/10, mã giao dịch FT123456.',
  },
  WRITTEN_OFF: {
    title: 'Xóa công nợ',
    confirm: 'Xóa nợ',
    noteLabel: 'Lý do xóa nợ',
    placeholder: 'Ví dụ: quản lý cơ sở đồng ý miễn do khách thuê lâu năm.',
  },
}

interface CustomerDebtsPanelProps {
  /** Facility in scope; the backend narrows a facility manager to their own facility anyway. */
  facilityId?: string
}

/**
 * Debts customers still owe after a return where deductions exceeded the deposit. Accounting sees them here
 * and records the collection (or a write-off) with a note, which the server keeps in the audit trail.
 */
export function CustomerDebtsPanel({ facilityId }: CustomerDebtsPanelProps) {
  const [filter, setFilter] = useState<DebtFilter>('OPEN')
  const [resolving, setResolving] = useState<{ debt: CustomerDebt; outcome: DebtOutcome } | null>(null)

  const query = useAsyncData(
    signal =>
      handoverService.getCustomerDebts({ facilityId, status: filter === ALL ? undefined : filter }, { signal }),
    [facilityId, filter],
    { keepPreviousData: false }
  )
  const debts = query.data ?? NO_DEBTS
  const openTotal = useMemo(
    () => debts.filter(debt => debt.status === 'OPEN').reduce((sum, debt) => sum + (debt.amount || 0), 0),
    [debts]
  )
  const hasOpen = debts.some(debt => debt.status === 'OPEN')

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Công nợ khách hàng"
        description="Khoản khách còn nợ sau khi khấu trừ trả kho vượt tiền cọc."
        divider
        actions={
          <Button variant="secondary" size="sm" leftIcon={RefreshCw} loading={query.isRefreshing} onClick={() => void query.reload()}>
            Làm mới
          </Button>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <Tabs
          variant="segmented"
          size="sm"
          aria-label="Lọc công nợ theo trạng thái"
          items={FILTER_ITEMS}
          value={filter}
          onValueChange={setFilter}
        />
        {hasOpen ? (
          <p className="text-sm text-fg-muted">
            Đang nợ <span className="font-semibold tabular-nums text-danger">{formatCurrency(openTotal)}</span>
          </p>
        ) : null}
      </div>

      <Table aria-label="Danh sách công nợ khách hàng">
        <TableHeader>
          <TableRow>
            <TableHead>Khách hàng</TableHead>
            <TableHead>Đơn và kho</TableHead>
            <TableHead align="right">Số tiền</TableHead>
            <TableHead>Lý do</TableHead>
            <TableHead>Ghi nhận</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead align="right">
              <span className="sr-only">Thao tác</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.isLoading ? (
            <TableLoading colSpan={COLUMN_COUNT} rows={3} />
          ) : query.error ? (
            <TableError
              colSpan={COLUMN_COUNT}
              message={getApiErrorMessage(query.error, 'Không thể tải công nợ khách hàng.')}
              onRetry={() => void query.reload()}
            />
          ) : debts.length === 0 ? (
            <TableEmpty
              colSpan={COLUMN_COUNT}
              icon={HandCoins}
              title={filter === 'OPEN' ? 'Không có công nợ nào đang mở' : 'Không có công nợ phù hợp'}
              description="Công nợ phát sinh khi khoản khấu trừ lúc trả kho lớn hơn tiền cọc của khách."
            />
          ) : (
            debts.map(debt => {
              const status = getCustomerDebtStatusMeta(debt.status)
              const isOpen = debt.status === 'OPEN'
              return (
                <TableRow key={debt.id}>
                  <TableCell>
                    <p className="text-dense text-fg">{debt.customerName || '—'}</p>
                    {debt.customerPhone ? <p className="text-xs tabular-nums text-fg-muted">{debt.customerPhone}</p> : null}
                  </TableCell>
                  <TableCell>
                    <p className="font-mono text-dense">{debt.bookingCode || '—'}</p>
                    <p className="text-xs text-fg-muted">
                      {debt.unitCode ? `Kho ${debt.unitCode}` : '—'}
                      {debt.facilityName ? ` · ${debt.facilityName}` : ''}
                    </p>
                  </TableCell>
                  <TableCell numeric className="font-medium">
                    {formatCurrency(debt.amount)}
                  </TableCell>
                  <TableCell className="max-w-xs text-dense text-fg-muted">{debt.reason}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <p className="text-dense tabular-nums">{formatDate(debt.createdAt)}</p>
                    {debt.createdByName ? <p className="text-xs text-fg-muted">{debt.createdByName}</p> : null}
                  </TableCell>
                  <TableCell>
                    <Badge tone={status.tone} dot>
                      {status.label}
                    </Badge>
                    {!isOpen && debt.resolvedAt ? (
                      <p className="mt-1 text-xs text-fg-muted">
                        {formatDate(debt.resolvedAt)}
                        {debt.resolvedByName ? ` · ${debt.resolvedByName}` : ''}
                      </p>
                    ) : null}
                    {!isOpen && debt.resolutionNote ? <p className="mt-0.5 text-xs text-fg-subtle">{debt.resolutionNote}</p> : null}
                  </TableCell>
                  <TableCell align="right">
                    {isOpen ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="secondary" leftIcon={BadgeCheck} onClick={() => setResolving({ debt, outcome: 'COLLECTED' })}>
                          Đã thu
                        </Button>
                        <Button size="sm" variant="ghost" leftIcon={Ban} onClick={() => setResolving({ debt, outcome: 'WRITTEN_OFF' })}>
                          Xóa nợ
                        </Button>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>

      {resolving ? (
        <ResolveDebtModal
          debt={resolving.debt}
          outcome={resolving.outcome}
          onClose={() => setResolving(null)}
          onResolved={async () => {
            setResolving(null)
            await query.reload()
          }}
        />
      ) : null}
    </Card>
  )
}

interface ResolveDebtModalProps {
  debt: CustomerDebt
  outcome: DebtOutcome
  onClose: () => void
  onResolved: () => Promise<void>
}

function ResolveDebtModal({ debt, outcome, onClose, onResolved }: ResolveDebtModalProps) {
  const toast = useToast()
  const copy = OUTCOME_COPY[outcome]
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const trimmed = note.trim()
  const error = touched && !trimmed ? 'Ghi lại nội dung xử lý để lưu vết kiểm toán.' : undefined

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!trimmed) return
    setSaving(true)
    try {
      await handoverService.resolveCustomerDebt(debt.id, outcome, trimmed)
      toast.success(outcome === 'COLLECTED' ? 'Đã ghi nhận thu hồi công nợ' : 'Đã xóa công nợ', formatCurrency(debt.amount))
      await onResolved()
    } catch (err) {
      toast.error('Không cập nhật được công nợ', getApiErrorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      size="md"
      title={copy.title}
      description={`${debt.customerName || 'Khách hàng'} · ${debt.bookingCode || 'Không rõ đơn'} · ${formatCurrency(debt.amount)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" form="resolve-debt-form" loading={saving} variant={outcome === 'WRITTEN_OFF' ? 'danger' : 'primary'}>
            {copy.confirm}
          </Button>
        </>
      }
    >
      <form id="resolve-debt-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {outcome === 'WRITTEN_OFF' ? (
          <Alert tone="warning">Xóa nợ nghĩa là Boxora không đòi khoản này nữa. Thao tác được ghi vào nhật ký hoạt động và không hoàn tác được.</Alert>
        ) : null}
        <p className="text-sm text-fg-muted">{debt.reason}</p>
        <Field label={copy.noteLabel} required error={error}>
          <Textarea
            rows={3}
            value={note}
            onChange={event => setNote(event.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={copy.placeholder}
            maxLength={500}
          />
        </Field>
      </form>
    </Modal>
  )
}
