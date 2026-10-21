import { formatCurrency } from '../../../lib/format'
import type { BookingCheckoutUnit } from './checkoutTypes'

interface UnitSummaryProps {
  unit: BookingCheckoutUnit
  /** Monthly rent to show; null while it is not known. */
  monthlyPrice: number | null
}

/** Header card of every checkout step: which unit is being rented and at what monthly price. */
export function UnitSummary({ unit, monthlyPrice }: UnitSummaryProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-line bg-surface-2 p-4">
      <div className="min-w-0">
        <p className="font-mono text-dense font-medium text-accent-text">{unit.code}</p>
        <h3 className="mt-0.5 text-sm font-semibold text-fg">{unit.name}</h3>
        <p className="mt-0.5 text-dense text-fg-muted">
          {[unit.facilityName, unit.size].filter(Boolean).join(' · ') || 'Boxora'}
        </p>
        {unit.address ? <p className="mt-0.5 text-dense text-fg-muted">{unit.address}</p> : null}
      </div>
      <p className="shrink-0 text-right text-sm font-semibold tabular-nums text-fg">
        {formatCurrency(monthlyPrice)}
        <span className="block text-xs font-normal text-fg-muted">/ tháng</span>
      </p>
    </div>
  )
}
