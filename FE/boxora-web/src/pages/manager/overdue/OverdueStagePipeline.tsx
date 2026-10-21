import { ChevronRight } from 'lucide-react'
import { StatCard, cn } from '@/components/ui'
import { formatCurrency, formatNumber } from '@/lib/format'
import { OVERDUE_STAGES, OVERDUE_STAGE_KEYS, getStageThreshold, type OverdueStageKey, type StageThresholds } from './overdueModel'

interface OverdueStagePipelineProps {
  counts: Record<OverdueStageKey, number>
  debts: Record<OverdueStageKey, number>
  active: OverdueStageKey | 'all'
  onSelect: (stage: OverdueStageKey | 'all') => void
  isLoading: boolean
  /** Day ranges of the facility policy. Null when several facilities are listed (each has its own policy). */
  thresholds: StageThresholds | null
}

/** Four-stage delinquency pipeline. Each card filters the table below; select the active card again to clear. */
export function OverdueStagePipeline({ counts, debts, active, onSelect, isLoading, thresholds }: OverdueStagePipelineProps) {
  return (
    <ol aria-label="Quy trình xử lý nợ quá hạn" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {OVERDUE_STAGE_KEYS.map((key, index) => {
        const stage = OVERDUE_STAGES[key]
        const isActive = active === key
        const range = thresholds ? getStageThreshold(key, thresholds) : stage.summary
        return (
          <li key={key} className="relative">
            <StatCard
              label={`${index + 1}. ${stage.label}`}
              value={formatNumber(counts[key])}
              icon={stage.icon}
              tone={counts[key] > 0 ? stage.tone : 'neutral'}
              loading={isLoading}
              hint={`${range} · ${formatCurrency(debts[key])}`}
              onClick={() => onSelect(isActive ? 'all' : key)}
              aria-pressed={isActive}
              className={cn(isActive && 'border-accent-line ring-2 ring-ring')}
            />
            {index < OVERDUE_STAGE_KEYS.length - 1 ? (
              <ChevronRight
                size={16}
                strokeWidth={1.75}
                aria-hidden="true"
                className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-canvas text-fg-subtle xl:block"
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
