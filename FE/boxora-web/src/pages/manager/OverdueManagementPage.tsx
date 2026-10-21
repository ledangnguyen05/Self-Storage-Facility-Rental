import React, { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, RefreshCw } from 'lucide-react'
import { Alert, Button, Card, CardHeader, PageHeader, Pagination, SearchInput, Select, TabPanel, Tabs } from '@/components/ui'
import { usePagination } from '@/hooks/usePagination'
import { usePageTitle } from '@/pages/public/components/usePageTitle'
import { toCsv, downloadCsv } from '@/lib/csv'
import { formatCurrency, formatNumber, todayISO } from '@/lib/format'
import { OVERDUE_STAGES, OVERDUE_STAGE_KEYS, getOverdueStage, type OverdueStageKey } from './overdue/overdueModel'
import { OverdueStagePipeline } from './overdue/OverdueStagePipeline'
import { OverdueTable } from './overdue/OverdueTable'
import { useOverdueActionDialogs } from './overdue/useOverdueActionDialogs'
import { useOverdueData } from './overdue/useOverdueData'
import { SealingRecordsCard } from './sealing/SealingRecordsCard'
import { useManagerFacility } from './shared/useManagerFacility'

type StageFilter = OverdueStageKey | 'all'
type PageTab = 'ledger' | 'sealing'
const TABS_ID = 'overdue-tabs'

const STAGE_FILTER_OPTIONS = [
  { value: 'all', label: 'Mọi giai đoạn' },
  ...OVERDUE_STAGE_KEYS.map((key) => ({ value: key, label: OVERDUE_STAGES[key].label })),
]

const emptyByStage = (): Record<OverdueStageKey, number> => ({
  GRACE_PERIOD: 0,
  WARNING: 0,
  ACCESS_BLOCKED: 0,
  ELIGIBLE_FOR_SEALING: 0,
})

export const OverdueManagementPage: React.FC = () => {
  usePageTitle('Nợ quá hạn')
  const { facilityId, facilityName } = useManagerFacility()
  const data = useOverdueData(facilityId)
  const [sealingRefresh, setSealingRefresh] = useState(0)
  const dialogs = useOverdueActionDialogs(() => {
    void data.reload()
    setSealingRefresh((value) => value + 1)
  })

  const [searchParams, setSearchParams] = useSearchParams()
  const tab: PageTab = searchParams.get('tab') === 'sealing' ? 'sealing' : 'ledger'
  const setTab = (next: PageTab) =>
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous)
        if (next === 'ledger') params.delete('tab')
        else params.set('tab', next)
        return params
      },
      { replace: true },
    )

  const [stageFilter, setStageFilter] = useState<StageFilter>('all')
  const [query, setQuery] = useState('')

  const { counts, debts, totalDebt } = useMemo(() => {
    const stageCounts = emptyByStage()
    const stageDebts = emptyByStage()
    let total = 0
    for (const item of data.items) {
      const stage = getOverdueStage(item)
      stageCounts[stage] += 1
      stageDebts[stage] += item.totalDebt
      total += item.totalDebt
    }
    return { counts: stageCounts, debts: stageDebts, totalDebt: total }
  }, [data.items])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return data.items.filter((item) => {
      if (stageFilter !== 'all' && getOverdueStage(item) !== stageFilter) return false
      if (!needle) return true
      return [item.unitCode, item.customerName, item.contractCode, item.customerPhone, item.customerEmail].some((value) =>
        value?.toLowerCase().includes(needle),
      )
    })
  }, [data.items, stageFilter, query])

  const pager = usePagination({ items: filtered })
  const isFiltered = stageFilter !== 'all' || query.trim().length > 0

  const clearFilters = () => {
    setStageFilter('all')
    setQuery('')
    pager.reset()
  }
  const changeStage = (next: StageFilter) => {
    setStageFilter(next)
    pager.reset()
  }
  const changeQuery = (next: string) => {
    setQuery(next)
    pager.reset()
  }

  const exportCsv = () => {
    const csv = toCsv(filtered, [
      { header: 'Mã kho', accessor: 'unitCode' },
      { header: 'Cơ sở', accessor: 'facilityName' },
      { header: 'Khách hàng', accessor: 'customerName' },
      { header: 'Số điện thoại', accessor: 'customerPhone' },
      { header: 'Email', accessor: 'customerEmail' },
      { header: 'Mã hợp đồng', accessor: 'contractCode' },
      { header: 'Hết hạn', accessor: 'dueDate' },
      { header: 'Số ngày quá hạn', accessor: 'daysOverdue' },
      { header: 'Giai đoạn', accessor: (row) => OVERDUE_STAGES[getOverdueStage(row)].label },
      { header: 'Đã khóa truy cập', accessor: (row) => (row.accessLocked ? 'Có' : 'Không') },
      { header: 'Đã niêm phong', accessor: (row) => (row.sealed ? 'Có' : 'Không') },
      { header: 'Tiền thuê quá hạn (₫)', accessor: 'unpaidRent' },
      { header: 'Phí trễ hạn (₫)', accessor: 'totalLateFee' },
      { header: 'Đã thanh toán sau hạn (₫)', accessor: 'paidSinceDue' },
      { header: 'Tổng nợ (₫)', accessor: 'totalDebt' },
    ])
    downloadCsv(`no-qua-han-${todayISO()}`, csv)
  }

  const policy = data.policy

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nợ quá hạn"
        description={`${facilityName ?? 'Tất cả cơ sở'} · nhắc nợ, khóa và mở khóa truy cập, niêm phong theo chính sách của cơ sở`}
        actions={
          <>
            <Button variant="secondary" leftIcon={RefreshCw} loading={data.isRefreshing} onClick={() => void data.reload()}>
              Làm mới
            </Button>
            <Button variant="secondary" leftIcon={Download} disabled={filtered.length === 0} onClick={exportCsv}>
              Xuất CSV
            </Button>
          </>
        }
      />

      {policy ? (
        <Alert tone="info" title={policy.defaultPolicy ? 'Cơ sở chưa có chính sách riêng, đang áp dụng mặc định' : 'Chính sách quá hạn đang áp dụng'}>
          {`Ân hạn ${formatNumber(policy.graceDays)} ngày, sau đó tính ${formatCurrency(policy.dailyLateFee)} mỗi ngày. Khóa truy cập từ ngày quá hạn thứ ${formatNumber(policy.accessDisableDays)}, niêm phong từ ngày thứ ${formatNumber(policy.sealingDays)}. Hệ thống tự áp dụng lúc 01:00 hằng ngày; niêm phong luôn do quản lý lập biên bản có người chứng kiến.`}
        </Alert>
      ) : null}

      <OverdueStagePipeline
        counts={counts}
        debts={debts}
        active={stageFilter}
        onSelect={(stage) => {
          changeStage(stage)
          setTab('ledger')
        }}
        isLoading={data.isLoading}
        thresholds={data.thresholds}
      />

      <Tabs
        id={TABS_ID}
        aria-label="Nợ quá hạn"
        value={tab}
        onValueChange={setTab}
        items={[
          { value: 'ledger', label: 'Danh sách khoản nợ', count: data.items.length },
          { value: 'sealing', label: 'Biên bản niêm phong', count: data.ledger?.sealedCount },
        ]}
      />

      <TabPanel tabsId={TABS_ID} value={tab}>
        {tab === 'ledger' ? (
          <Card className="overflow-hidden">
            <CardHeader
              divider
              title="Danh sách khoản nợ"
              description={
                data.isLoading
                  ? 'Đang tải dữ liệu'
                  : `${formatNumber(data.items.length)} hợp đồng quá hạn · tổng nợ ${formatCurrency(totalDebt)}${data.ledger && data.ledger.accessLockedCount > 0 ? ` · ${formatNumber(data.ledger.accessLockedCount)} kho đang khóa` : ''}`
              }
            />
            <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center">
              <SearchInput
                value={query}
                onValueChange={changeQuery}
                placeholder="Tìm kho, khách hàng, số điện thoại, hợp đồng"
                size="sm"
                className="sm:w-80"
              />
              <Select
                size="sm"
                aria-label="Lọc theo giai đoạn"
                value={stageFilter}
                onChange={(event) => changeStage(event.target.value as StageFilter)}
                options={STAGE_FILTER_OPTIONS}
                className="sm:w-48"
              />
              {isFiltered ? (
                <Button variant="link" size="sm" onClick={clearFilters}>
                  Xóa bộ lọc
                </Button>
              ) : null}
            </div>
            <OverdueTable
              rows={pager.slice(filtered)}
              isLoading={data.isLoading}
              error={data.error}
              onRetry={() => void data.reload()}
              isFiltered={isFiltered}
              showFacility={!facilityId}
              {...dialogs.actions}
            />
            {filtered.length > 10 ? (
              <Pagination
                page={pager.page}
                pageCount={pager.pageCount}
                total={pager.total}
                pageSize={pager.pageSize}
                onPageChange={pager.setPage}
                onPageSizeChange={pager.setPageSize}
              />
            ) : null}
          </Card>
        ) : (
          <SealingRecordsCard
            facilityId={facilityId}
            showFacility={!facilityId}
            refreshKey={sealingRefresh}
            onView={(record) => dialogs.viewProtocol({ record })}
            onUnseal={(record) =>
              dialogs.unseal({
                sealingRecordId: record.id,
                protocolNumber: record.protocolNumber,
                unitCode: record.unitCode,
                customerName: record.customerName,
                sealedAt: record.sealedAt,
              })
            }
          />
        )}
      </TabPanel>

      {dialogs.dialogs}
    </div>
  )
}
