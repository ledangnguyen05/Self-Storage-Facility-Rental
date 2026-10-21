import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Banknote, ClipboardCheck, Hourglass, ShieldCheck } from 'lucide-react'
import { Alert, Button, Card, PageHeader, Pagination, SearchInput, StatCard, Tabs } from '@/components/ui'
import { ALL_FACILITIES, useDashboardContext } from '@/components/layout/dashboardContext'
import { useAuth } from '@/context/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatNumber } from '@/lib/format'
import { refundService, type RefundRequestItem } from '@/services/refundService'
import { RefundDrawer } from './refunds/RefundDrawer'
import { RefundsTable } from './refunds/RefundsTable'
import { REFUND_QUEUE_ORDER, REFUND_QUEUES, isRefundQueue, refundPermissions, type RefundQueue } from './refunds/queues'

const PAGE_SIZE_DEFAULT = 20

/**
 * /portal/finance: refund queue of the facility (staff, facility manager) or the chain (business
 * manager, admin). Review, bank transfer, customer confirmation and reconciliation of every refund
 * created by cancellations, return settlements and late payments.
 */
export function RefundsPage() {
  const { role } = useAuth()
  const { selectedFacility, isFacilityScoped } = useDashboardContext()
  const facilityId = selectedFacility && selectedFacility !== ALL_FACILITIES ? selectedFacility : undefined
  const permissions = refundPermissions(role)
  const [searchParams, setSearchParams] = useSearchParams()
  const queueParam = searchParams.get('queue')
  const queue: RefundQueue = isRefundQueue(queueParam) ? queueParam : 'todo'
  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT)
  const [selected, setSelected] = useState<RefundRequestItem | null>(null)

  const stats = useAsyncData(signal => refundService.getStats(facilityId, { signal }), [facilityId])
  const list = useAsyncData(
    signal =>
      refundService.getAll(
        { facilityId, status: REFUND_QUEUES[queue].statuses, q, page: page - 1, size: pageSize },
        { signal },
      ),
    [facilityId, queue, q, page, pageSize],
  )
  const refunds = list.data?.content ?? []
  const counts = stats.data ?? {}
  const count = (...statuses: string[]) => statuses.reduce((total, status) => total + (counts[status] ?? 0), 0)

  const tabItems = REFUND_QUEUE_ORDER.map(value => ({
    value,
    label: REFUND_QUEUES[value].label,
    count: value === 'all' ? undefined : count(...REFUND_QUEUES[value].statuses) || undefined,
  }))

  const changeQueue = (next: RefundQueue) => {
    setPage(1)
    setSearchParams(previous => {
      const params = new URLSearchParams(previous)
      params.set('queue', next)
      return params
    }, { replace: true })
  }

  const handleUpdated = (updated: RefundRequestItem) => {
    setSelected(updated)
    void list.reload()
    void stats.reload()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Hoàn tiền"
        description={
          isFacilityScoped
            ? 'Duyệt, chuyển khoản và đối soát các khoản hoàn tiền của cơ sở được phân công.'
            : 'Duyệt, chuyển khoản và đối soát các khoản hoàn tiền của toàn chuỗi hoặc cơ sở đang chọn.'
        }
      >
        <Tabs<RefundQueue> aria-label="Hàng đợi hoàn tiền" value={queue} onValueChange={changeQueue} items={tabItems} />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Chờ duyệt" value={formatNumber(count('PENDING_REVIEW'))} icon={Hourglass} tone="warning" loading={stats.isLoading} hint="Yêu cầu mới từ hủy đơn và trả kho" />
        <StatCard label="Chờ chuyển khoản" value={formatNumber(count('APPROVED', 'PROCESSING_TRANSFER'))} icon={Banknote} tone="info" loading={stats.isLoading} hint="Đã duyệt hoặc đang chuyển" />
        <StatCard label="Chờ khách xác nhận" value={formatNumber(count('AWAITING_CUSTOMER_CONFIRMATION', 'PROCESSED'))} icon={ClipboardCheck} loading={stats.isLoading} hint="Đã chuyển tiền" />
        <StatCard label="Chờ đối soát" value={formatNumber(count('RECONCILED'))} icon={ShieldCheck} tone="success" loading={stats.isLoading} hint="Khách đã xác nhận nhận tiền" />
      </div>

      {stats.error ? (
        <Alert
          tone="danger"
          title="Không tải được thống kê hoàn tiền"
          action={
            <Button size="sm" variant="secondary" onClick={() => void stats.reload()}>
              Thử lại
            </Button>
          }
        >
          {getApiErrorMessage(stats.error)}
        </Alert>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <SearchInput
            value={search}
            onValueChange={value => {
              setSearch(value)
              setPage(1)
            }}
            placeholder="Tìm mã yêu cầu, mã đơn, tên hoặc số điện thoại khách"
            className="w-full sm:w-80"
          />
          {search ? (
            <Button variant="link" size="sm" onClick={() => setSearch('')}>
              Xóa bộ lọc
            </Button>
          ) : null}
        </div>
        <RefundsTable
          refunds={refunds}
          isLoading={list.isLoading}
          error={list.error}
          onRetry={() => void list.reload()}
          onOpen={setSelected}
          selectedId={selected?.id}
          emptyTitle={q ? 'Không có yêu cầu khớp tìm kiếm' : `Không có yêu cầu trong mục ${REFUND_QUEUES[queue].label.toLowerCase()}`}
        />
        {!list.isLoading && (list.data?.totalElements ?? 0) > 0 ? (
          <div className="border-t border-line px-5 py-3">
            <Pagination
              page={page}
              pageCount={Math.max(1, list.data?.totalPages ?? 1)}
              total={list.data?.totalElements}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={size => {
                setPageSize(size)
                setPage(1)
              }}
            />
          </div>
        ) : null}
      </Card>

      <RefundDrawer refund={selected} permissions={permissions} onClose={() => setSelected(null)} onUpdated={handleUpdated} />
    </div>
  )
}

export default RefundsPage
