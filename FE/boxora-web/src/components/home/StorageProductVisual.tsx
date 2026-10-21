import React from 'react'
import { Clock, KeyRound, Lock, LockOpen, type LucideIcon } from 'lucide-react'
import { getUnitStatusMeta } from '../../constants/statusMeta'
import { Badge, cn } from '../ui'

type TileKind = 'available' | 'occupied' | 'reserved' | 'selected'

/** Fixed layout, so the illustration never changes between renders. */
const TILES: readonly TileKind[] = [
  'occupied', 'available', 'occupied', 'reserved',
  'available', 'selected', 'occupied', 'available',
  'occupied', 'reserved', 'available', 'occupied',
]

const TILE_STYLE: Record<TileKind, { className: string; icon: LucideIcon }> = {
  available: { className: 'border-success-line bg-success-subtle text-success', icon: LockOpen },
  occupied: { className: 'border-line bg-surface-2 text-fg-subtle', icon: Lock },
  reserved: { className: 'border-warning-line bg-warning-subtle text-warning', icon: Clock },
  selected: { className: 'border-accent bg-accent-subtle text-accent-text ring-2 ring-ring/30', icon: KeyRound },
}

const LEGEND: ReadonlyArray<{ status: string; kind: Exclude<TileKind, 'selected'> }> = [
  { status: 'AVAILABLE', kind: 'available' },
  { status: 'RESERVED', kind: 'reserved' },
  { status: 'OCCUPIED', kind: 'occupied' },
]

interface StorageProductVisualProps {
  className?: string
}

/**
 * Restrained illustration of the facility floor map used by staff and managers.
 * Purely decorative: no figures, no animation, token colours only.
 */
export function StorageProductVisual({ className }: StorageProductVisualProps) {
  return (
    <div aria-hidden="true" className={cn('rounded-xl border border-line bg-surface p-4 sm:p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-fg">Sơ đồ kho</p>
        <Badge tone="accent" size="sm" icon={KeyRound}>
          Mở bằng mã PIN
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {TILES.map((kind, index) => {
          const { className: tileClass, icon: Icon } = TILE_STYLE[kind]
          return (
            <div
              key={index}
              className={cn('flex aspect-4/3 items-center justify-center rounded-md border', tileClass)}
            >
              <Icon size={kind === 'selected' ? 18 : 16} strokeWidth={1.75} />
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
        {LEGEND.map(({ status, kind }) => {
          const meta = getUnitStatusMeta(status)
          return (
            <span key={status} className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
              <span className={cn('size-2.5 rounded-sm border', TILE_STYLE[kind].className)} />
              {meta.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export default StorageProductVisual
