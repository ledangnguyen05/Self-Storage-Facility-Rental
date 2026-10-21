import { Download, RefreshCw } from 'lucide-react'
import { Alert, Button, Card, PageHeader, Pagination } from '@/components/ui'
import { ALL_FACILITIES, useDashboardContext } from '@/components/layout/dashboardContext'
import { useAuth } from '@/context/AuthContext'
import { getApiErrorMessage } from '@/lib/apiError'
import { CustomerDebtsPanel } from './cashier/components/CustomerDebtsPanel'
import { LedgerFilters } from './cashier/components/LedgerFilters'
import { LedgerKpis } from './cashier/components/LedgerKpis'
import { LedgerTable } from './cashier/components/LedgerTable'
import { useCashierLedger } from './cashier/hooks/useCashierLedger'
import { describeRange, LEDGER_FETCH_SIZE } from './cashier/ledgerUtils'

/**
 * Payments ledger ("Sổ quỹ") for /portal/cashier. The facility comes from the
 * portal scope (staff and facility managers are pinned to theirs), the dates
 * from the filter bar (default: today).
 */
export function CashierJournalPage() {
  const { role } = useAuth()
  const { selectedFacility, facilities } = useDashboardContext()
  const facilityId = selectedFacility === ALL_FACILITIES ? undefined : selectedFacility
  const facilityName = facilityId ? facilities.find(f => f.id === facilityId)?.name : undefined

  const ledger = useCashierLedger(facilityId)
  const hasPayments = ledger.payments.length > 0
  // Customer debts are read and settled by managers and accounting, not by front-desk staff.
  const canSeeDebts = role === 'FACILITY_MANAGER' || role === 'BUSINESS_MANAGER' || role === 'ADMIN'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sổ quỹ"
        description={`Giao dịch thu tiền tại ${facilityName ?? 'tất cả cơ sở'}, ${describeRange(ledger.range)}.`}
        actions={
          <>
            <Button variant="secondary" leftIcon={RefreshCw} loading={ledger.isRefreshing} onClick={() => void ledger.reload()}>
              Làm mới
            </Button>
            <Button leftIcon={Download} onClick={ledger.exportCsv} disabled={ledger.isLoading || ledger.filtered.length === 0}>
              Xuất CSV
            </Button>
          </>
        }
      />

      <LedgerKpis summary={ledger.summary} rangeLabel={describeRange(ledger.range)} isLoading={ledger.isLoading} />

      {ledger.error && hasPayments ? (
        <Alert
          tone="warning"
          title="Không thể làm mới sổ quỹ"
          action={
            <Button size="sm" variant="secondary" onClick={() => void ledger.reload()}>
              Thử lại
            </Button>
          }
        >
          {getApiErrorMessage(ledger.error)} Đang hiển thị dữ liệu đã tải trước đó.
        </Alert>
      ) : null}

      {ledger.isTruncated ? (
        <Alert tone="warning" title="Chỉ hiển thị một phần giao dịch">
          Khoảng thời gian này có từ {LEDGER_FETCH_SIZE} giao dịch trở lên nên số liệu có thể chưa đầy đủ. Thu hẹp khoảng ngày để xem chính xác.
        </Alert>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-line p-4">
          <LedgerFilters
            range={ledger.range}
            preset={ledger.preset}
            onRangeChange={ledger.updateRange}
            onPresetChange={ledger.applyPreset}
            filters={ledger.filters}
            onFiltersChange={ledger.updateFilters}
            onClear={ledger.clearFilters}
            hasActiveFilters={ledger.hasActiveFilters}
          />
        </div>
        <LedgerTable
          rows={ledger.rows}
          isLoading={ledger.isLoading}
          error={hasPayments ? null : ledger.error}
          onRetry={() => void ledger.reload()}
          hasActiveFilters={ledger.hasActiveFilters}
        />
        {ledger.filtered.length > 0 ? (
          <div className="border-t border-line px-4 py-3">
            <Pagination
              page={ledger.pager.page}
              pageCount={ledger.pager.pageCount}
              total={ledger.pager.total}
              pageSize={ledger.pager.pageSize}
              onPageChange={ledger.pager.setPage}
              onPageSizeChange={ledger.pager.setPageSize}
            />
          </div>
        ) : null}
      </Card>

      {canSeeDebts ? <CustomerDebtsPanel facilityId={facilityId} /> : null}
    </div>
  )
}
