import { useMemo, useState, type ReactNode } from 'react'
import { LifeBuoy, Mail, Phone, RefreshCw } from 'lucide-react'
import { Alert, Button, Card, CardContent, CardHeader, EmptyState, IconButton, Pagination, SearchInput, Tabs } from '@/components/ui'
import { TicketCloseConfirmModal } from '@/components/modals/TicketCloseConfirmModal'
import { SITE_CONFIG } from '@/constants/siteConfig'
import { usePagination } from '@/hooks/usePagination'
import { getApiErrorMessage } from '@/lib/apiError'
import type { SupportTicketRecord } from '@/services/supportTicketService'
import type { RentalContract } from '@/types'
import { CardGridSkeleton } from '../components/CardGridSkeleton'
import { SupportTicketForm } from '../components/SupportTicketForm'
import { TicketCard } from '../components/TicketCard'
import { matchesSearch } from '../lib/portal'
import { ReopenTicketModal } from '../modals/ReopenTicketModal'
import type { TicketPreset } from '../types'

type TicketFilter = 'ALL' | 'WAITING' | 'IN_PROGRESS' | 'DONE'

const FILTER_STATUSES: Record<Exclude<TicketFilter, 'ALL'>, string[]> = {
  WAITING: ['OPEN', 'PENDING', 'REOPENED'],
  IN_PROGRESS: ['IN_PROGRESS'],
  DONE: ['RESOLVED', 'CLOSED'],
}
const FILTER_LABELS: Record<TicketFilter, string> = {
  ALL: 'Tất cả',
  WAITING: 'Chờ xử lý',
  IN_PROGRESS: 'Đang xử lý',
  DONE: 'Đã xử lý',
}
const FILTERS = Object.keys(FILTER_LABELS) as TicketFilter[]

const matchesFilter = (ticket: SupportTicketRecord, filter: TicketFilter) =>
  filter === 'ALL' || FILTER_STATUSES[filter].includes((ticket.status ?? '').toUpperCase())

interface SupportTabProps {
  customerId?: string
  heldContracts: RentalContract[]
  tickets: SupportTicketRecord[]
  isLoading: boolean
  isRefreshing: boolean
  error: unknown
  onReload: () => Promise<void>
  preset: TicketPreset | null
}

/** "Hỗ trợ": request form, contact channels and the ticket history. */
export function SupportTab({ customerId, heldContracts, tickets, isLoading, isRefreshing, error, onReload, preset }: SupportTabProps) {
  const [filter, setFilter] = useState<TicketFilter>('ALL')
  const [search, setSearch] = useState('')
  const [closeTarget, setCloseTarget] = useState<SupportTicketRecord | null>(null)
  const [reopenTarget, setReopenTarget] = useState<SupportTicketRecord | null>(null)

  const counts = useMemo(() => {
    const result = { ALL: 0, WAITING: 0, IN_PROGRESS: 0, DONE: 0 } as Record<TicketFilter, number>
    for (const ticket of tickets) for (const key of FILTERS) if (matchesFilter(ticket, key)) result[key] += 1
    return result
  }, [tickets])

  const filtered = tickets.filter(
    ticket =>
      matchesFilter(ticket, filter) &&
      matchesSearch(search, [ticket.ticketCode, ticket.unitCode, ticket.title, ticket.description, ticket.resolutionNote]),
  )
  const pager = usePagination({ items: filtered })
  const rows = pager.slice(filtered)
  const hasFilters = filter !== 'ALL' || search.trim() !== ''

  let history: ReactNode
  if (isLoading) {
    history = <CardGridSkeleton count={2} className="lg:grid-cols-1" />
  } else if (error && tickets.length === 0) {
    history = (
      <Alert
        tone="danger"
        title="Không tải được lịch sử yêu cầu"
        action={
          <Button size="sm" variant="secondary" onClick={() => void onReload()}>
            Thử lại
          </Button>
        }
      >
        {getApiErrorMessage(error)}
      </Alert>
    )
  } else if (filtered.length === 0) {
    history = (
      <EmptyState
        icon={LifeBuoy}
        size="sm"
        title={hasFilters ? 'Không có yêu cầu phù hợp' : 'Chưa có yêu cầu hỗ trợ'}
        description={hasFilters ? 'Thử đổi từ khóa hoặc bộ lọc trạng thái.' : 'Khi cần hỗ trợ, hãy gửi yêu cầu bằng biểu mẫu phía trên.'}
        action={
          hasFilters ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFilter('ALL')
                setSearch('')
                pager.reset()
              }}
            >
              Xóa bộ lọc
            </Button>
          ) : null
        }
      />
    )
  } else {
    history = (
      <div className="flex flex-col gap-3">
        {rows.map(ticket => (
          <TicketCard key={ticket.id} ticket={ticket} onConfirmClose={setCloseTarget} onReopen={setReopenTarget} />
        ))}
        <Pagination
          page={pager.page}
          pageCount={pager.pageCount}
          total={pager.total}
          pageSize={pager.pageSize}
          onPageChange={pager.setPage}
          onPageSizeChange={pager.setPageSize}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SupportTicketForm
            key={preset?.nonce ?? 0}
            customerId={customerId}
            contracts={heldContracts}
            defaultContractId={preset?.contractId}
            onCreated={() => void onReload()}
          />
        </div>
        <Card>
          <CardHeader title="Liên hệ trực tiếp" description="Dành cho sự cố cần xử lý ngay." />
          <CardContent className="flex flex-col gap-3">
            <a href={SITE_CONFIG.hotline.href} className="flex items-center gap-3 rounded-md border border-line p-3 hover:border-line-strong">
              <Phone size={20} strokeWidth={1.75} aria-hidden="true" className="text-fg-subtle" />
              <span className="min-w-0">
                <span className="block text-sm font-medium tabular-nums text-fg">{SITE_CONFIG.hotline.display}</span>
                <span className="block text-dense text-fg-muted">Hotline {SITE_CONFIG.hotline.hours}</span>
              </span>
            </a>
            <a href={SITE_CONFIG.supportEmailHref} className="flex items-center gap-3 rounded-md border border-line p-3 hover:border-line-strong">
              <Mail size={20} strokeWidth={1.75} aria-hidden="true" className="text-fg-subtle" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-fg">{SITE_CONFIG.supportEmail}</span>
                <span className="block text-dense text-fg-muted">Phản hồi qua email</span>
              </span>
            </a>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Lịch sử yêu cầu"
          description="Tiến độ và kết quả xử lý từ nhân viên cơ sở."
          actions={<IconButton icon={RefreshCw} variant="secondary" aria-label="Làm mới" tooltip loading={isRefreshing} onClick={() => void onReload()} />}
        />
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SearchInput
              value={search}
              onValueChange={value => {
                setSearch(value)
                pager.reset()
              }}
              placeholder="Tìm mã phiếu, kho hoặc nội dung"
              className="w-full lg:max-w-sm"
            />
            <Tabs
              variant="segmented"
              aria-label="Lọc theo trạng thái"
              value={filter}
              onValueChange={value => {
                setFilter(value)
                pager.reset()
              }}
              items={FILTERS.map(key => ({ value: key, label: FILTER_LABELS[key], count: counts[key] }))}
            />
          </div>
          {history}
        </CardContent>
      </Card>

      <TicketCloseConfirmModal
        isOpen={Boolean(closeTarget)}
        ticket={closeTarget}
        onClose={() => setCloseTarget(null)}
        onSuccess={onReload}
      />
      {reopenTarget ? <ReopenTicketModal ticket={reopenTarget} onClose={() => setReopenTarget(null)} onReopened={onReload} /> : null}
    </div>
  )
}
