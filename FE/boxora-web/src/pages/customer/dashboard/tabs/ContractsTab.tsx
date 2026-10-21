import { useState } from 'react'
import { CircleDollarSign, FileCheck2, PiggyBank } from 'lucide-react'
import { StatCard } from '@/components/ui'
import { formatCurrency, formatNumber } from '@/lib/format'
import type { PaymentItem } from '@/services/paymentService'
import type { RentalContract, User } from '@/types'
import { ContractsTable } from '../components/ContractsTable'
import { PaymentsTable } from '../components/PaymentsTable'
import { RefundsCard } from '../components/RefundsCard'
import { isPaidPayment, sumDepositsHeld, sumNetPaid, sumRefunded } from '../lib/portal'
import { VatReceiptModal } from '../modals/VatReceiptModal'
import type { OpenDialog } from '../types'

interface ContractsTabProps {
  user: User | null
  contracts: RentalContract[]
  heldContractCount: number
  contractsLoading: boolean
  contractsError: unknown
  onRetryContracts: () => void
  payments: PaymentItem[]
  paymentsLoading: boolean
  paymentsError: unknown
  onRetryPayments: () => void
  onOpenDialog: OpenDialog
  /** Bumped after cancellations and payments so the refunds reload. */
  refundsRefreshKey?: number
}

/** "Hợp đồng & thanh toán": money summary, contracts table, payments table and receipts. */
export function ContractsTab({
  user,
  contracts,
  heldContractCount,
  contractsLoading,
  contractsError,
  onRetryContracts,
  payments,
  paymentsLoading,
  paymentsError,
  onRetryPayments,
  onOpenDialog,
  refundsRefreshKey = 0,
}: ContractsTabProps) {
  const [receipt, setReceipt] = useState<PaymentItem | null>(null)
  const paidCount = payments.filter(isPaidPayment).length
  const refunded = sumRefunded(payments)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Tổng đã thanh toán"
          value={formatCurrency(sumNetPaid(payments))}
          icon={CircleDollarSign}
          tone="success"
          hint={`${formatNumber(paidCount)} giao dịch thành công${refunded > 0 ? `, đã trừ ${formatCurrency(refunded)} hoàn tiền` : ''}`}
          loading={paymentsLoading}
        />
        <StatCard
          label="Tiền cọc đang giữ"
          value={formatCurrency(sumDepositsHeld(contracts))}
          icon={PiggyBank}
          hint="Tiền cọc đã nộp của các hợp đồng chưa kết thúc"
          loading={contractsLoading}
        />
        <StatCard
          label="Hợp đồng đang hiệu lực"
          value={formatNumber(heldContractCount)}
          icon={FileCheck2}
          tone="info"
          hint={`${formatNumber(contracts.length)} hợp đồng trong hồ sơ`}
          loading={contractsLoading}
        />
      </div>

      <ContractsTable
        contracts={contracts}
        isLoading={contractsLoading}
        error={contractsError}
        onRetry={onRetryContracts}
        onView={contract => onOpenDialog({ type: 'contract', contract })}
        onSign={contract => onOpenDialog({ type: 'sign', contract })}
        onViewPolicy={contract => onOpenDialog({ type: 'policy', facilityId: contract.facilityId, facilityName: contract.facilityName })}
      />

      <PaymentsTable
        payments={payments}
        isLoading={paymentsLoading}
        error={paymentsError}
        onRetry={onRetryPayments}
        onViewReceipt={setReceipt}
      />

      <RefundsCard refreshKey={refundsRefreshKey} />

      {receipt ? <VatReceiptModal payment={receipt} user={user} onClose={() => setReceipt(null)} /> : null}
    </div>
  )
}
