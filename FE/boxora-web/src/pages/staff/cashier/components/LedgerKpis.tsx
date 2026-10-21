import { CircleCheck, PiggyBank, Receipt, Wallet } from 'lucide-react'
import { StatCard } from '@/components/ui'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format'
import type { LedgerSummary } from '../ledgerUtils'

interface LedgerKpisProps {
  summary: LedgerSummary
  /** Label of the selected range, shown under the headline figure. */
  rangeLabel: string
  isLoading: boolean
}

/**
 * Money collected in the selected range: the total with its cash / transfer split, rent and renewals, deposits,
 * and how many collection attempts settled. Independent of the table filters.
 */
export function LedgerKpis({ summary, rangeLabel, isLoading }: LedgerKpisProps) {
  const unresolved = [
    summary.pendingCount > 0 ? `${formatNumber(summary.pendingCount)} chờ xử lý` : null,
    summary.otherCount > 0 ? `${formatNumber(summary.otherCount)} không thành công` : null,
    summary.refundCount > 0 ? `${formatNumber(summary.refundCount)} lượt hoàn tiền không tính` : null,
  ].filter(Boolean)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Tổng thu"
        value={formatCurrency(summary.collected)}
        icon={Wallet}
        tone="success"
        hint={`Tiền mặt ${formatCurrency(summary.cash)} · Chuyển khoản và trực tuyến ${formatCurrency(summary.nonCash)}`}
        loading={isLoading}
      />
      <StatCard
        label="Thu tiền thuê và gia hạn"
        value={formatCurrency(summary.rental)}
        icon={Receipt}
        tone="info"
        hint={`${formatNumber(summary.rentalCount)} giao dịch, không gồm phần tiền cọc · ${rangeLabel}`}
        loading={isLoading}
      />
      <StatCard
        label="Thu tiền cọc"
        value={formatCurrency(summary.deposit)}
        icon={PiggyBank}
        tone="warning"
        hint={`${formatNumber(summary.depositCount)} giao dịch, gồm phần cọc của thanh toán đặt kho trực tuyến · ${rangeLabel}`}
        loading={isLoading}
      />
      <StatCard
        label="Tỷ lệ giao dịch thành công"
        value={summary.successRate === null ? '—' : formatPercent(summary.successRate, { fractionDigits: 0 })}
        icon={CircleCheck}
        tone="neutral"
        hint={
          summary.totalCount === 0
            ? 'Chưa có giao dịch trong khoảng thời gian này'
            : `${formatNumber(summary.collectedCount)}/${formatNumber(summary.attemptCount)} lượt thu thành công${unresolved.length > 0 ? ` · ${unresolved.join(' · ')}` : ''}`
        }
        loading={isLoading}
      />
    </div>
  )
}
