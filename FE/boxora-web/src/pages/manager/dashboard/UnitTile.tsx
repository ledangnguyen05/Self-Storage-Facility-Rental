import { cn } from '@/components/ui'
import { formatNumber } from '@/lib/format'
import type { StorageUnit } from '@/types'
import { getUnitStatusInfo, TILE_TONE_CLASS, TONE_TEXT_CLASS } from './unitModel'

interface UnitTileProps {
  unit: StorageUnit
  selected: boolean
  /** False when the unit does not match the active filters; it is dimmed but stays clickable. */
  matches: boolean
  onSelect: (unit: StorageUnit) => void
}

/** One storage unit on the floor map. Tone comes from statusMeta; the status icon and label back it up. */
export function UnitTile({ unit, selected, matches, onSelect }: UnitTileProps) {
  const { meta, icon: StatusIcon } = getUnitStatusInfo(unit)
  const area = typeof unit.areaSqMeters === 'number' ? `${formatNumber(unit.areaSqMeters, { maximumFractionDigits: 1 })} m²` : '—'

  return (
    <button
      type="button"
      onClick={() => onSelect(unit)}
      aria-pressed={selected}
      aria-label={`Kho ${unit.unitCode}, ${meta.label}`}
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-lg border p-2.5 text-left transition-colors',
        'hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        TILE_TONE_CLASS[meta.tone],
        !matches && 'opacity-40 hover:opacity-100',
        selected && 'ring-2 ring-ring',
      )}
    >
      <span className="flex items-center justify-between gap-1">
        <span className="truncate font-mono text-dense font-semibold text-fg">{unit.unitCode}</span>
        <StatusIcon size={14} strokeWidth={1.75} aria-hidden="true" className={cn('shrink-0', TONE_TEXT_CLASS[meta.tone])} />
      </span>
      <span className="text-xs tabular-nums text-fg-muted">{area}</span>
      <span className={cn('truncate text-xs font-medium', TONE_TEXT_CLASS[meta.tone])}>{meta.label}</span>
    </button>
  )
}
