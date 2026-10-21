import { Activity, AlarmClock, Inbox, ShieldCheck } from 'lucide-react'
import { StatCard } from '@/components/ui'
import { formatNumber, formatPercent } from '@/lib/format'
import type { TicketKpiValues } from '../ticketUtils'

interface TicketKpisProps {
  kpis: TicketKpiValues
  isLoading: boolean
}

function complianceTone(value: number | null) {
  if (value === null) return 'neutral' as const
  if (value >= 90) return 'success' as const
  if (value >= 70) return 'warning' as const
  return 'danger' as const
}

export function TicketKpis({ kpis, isLoading }: TicketKpisProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Đang mở"
        value={formatNumber(kpis.open)}
        icon={Inbox}
        tone="warning"
        hint="Mới hoặc mở lại, chờ xử lý"
        loading={isLoading}
      />
      <StatCard
        label="Đang xử lý"
        value={formatNumber(kpis.inProgress)}
        icon={Activity}
        tone="info"
        hint="Đã có người phụ trách"
        loading={isLoading}
      />
      <StatCard
        label="Quá hạn SLA"
        value={formatNumber(kpis.overdue)}
        icon={AlarmClock}
        tone={kpis.overdue > 0 ? 'danger' : 'neutral'}
        hint={kpis.overdue > 0 ? 'Cần ưu tiên xử lý' : 'Không có ticket quá hạn'}
        loading={isLoading}
      />
      <StatCard
        label="Tuân thủ SLA"
        value={kpis.slaCompliance === null ? '—' : formatPercent(kpis.slaCompliance, { fractionDigits: 1 })}
        icon={ShieldCheck}
        tone={complianceTone(kpis.slaCompliance)}
        hint={`Trên ${formatNumber(kpis.total)} ticket trong phạm vi`}
        loading={isLoading}
      />
    </div>
  )
}
