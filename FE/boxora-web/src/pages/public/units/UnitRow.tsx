import React from 'react'
import { MapPin } from 'lucide-react'
import { Card, cn } from '../../../components/ui'
import type { StorageUnitType } from '../../../data/storageUnitsData'
import { UnitActions, UnitDistance, UnitPrice, UnitStatusBadge } from './unitParts'
import { formatArea, unitTypeLabel } from './unitModel'

interface UnitRowProps {
  unit: StorageUnitType
  onDetail: (unit: StorageUnitType) => void
  onRent: (unit: StorageUnitType) => void
}

/** List layout of one unit. Same data and actions as `UnitCard`. */
export function UnitRow({ unit, onDetail, onRent }: UnitRowProps) {
  return (
    <Card className={cn(!unit.isAvailable && 'bg-surface-2')}>
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_auto_auto] md:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-mono text-base font-semibold text-fg">{unit.unitCode}</h3>
            <UnitStatusBadge status={unit.status} />
          </div>
          <p className="mt-0.5 text-dense text-fg-muted">
            <span className="break-words">{unitTypeLabel(unit)}</span>{' '}
            <span className="whitespace-nowrap tabular-nums">· {formatArea(unit.areaSqMeters)}</span>
          </p>
        </div>

        <div className="min-w-0 space-y-1 text-dense text-fg-muted">
          <p className="truncate font-medium text-fg">
            {unit.facilityName} · {unit.floorLabel}
          </p>
          {unit.facilityAddress ? (
            <p className="flex items-start gap-1.5">
              <MapPin size={14} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-fg-subtle" />
              <span className="line-clamp-1">{unit.facilityAddress}</span>
            </p>
          ) : null}
          <UnitDistance unit={unit} />
        </div>

        <UnitPrice unit={unit} align="right" />

        <UnitActions unit={unit} onDetail={onDetail} onRent={onRent} />
      </div>
    </Card>
  )
}
