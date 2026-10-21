import React from 'react'
import { Layers, MapPin } from 'lucide-react'
import { Card, CardContent, cn } from '../../../components/ui'
import type { StorageUnitType } from '../../../data/storageUnitsData'
import { formatArea, unitTypeLabel } from './unitModel'
import { UnitActions, UnitDistance, UnitPrice, UnitStatusBadge } from './unitParts'

interface UnitCardProps {
  unit: StorageUnitType
  onDetail: (unit: StorageUnitType) => void
  onRent: (unit: StorageUnitType) => void
}

/** Grid layout of one unit. See `UnitRow` for the list layout. */
export function UnitCard({ unit, onDetail, onRent }: UnitCardProps) {
  return (
    <Card className={cn('flex h-full flex-col', !unit.isAvailable && 'bg-surface-2')}>
      <CardContent className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-mono text-base font-semibold text-fg">{unit.unitCode}</h3>
            {/* The area is a key decision attribute: let the type name wrap and keep "· 6 m²" together instead of truncating it. */}
            <p className="mt-0.5 text-dense text-fg-muted">
              <span className="break-words">{unitTypeLabel(unit)}</span>{' '}
              <span className="whitespace-nowrap tabular-nums">· {formatArea(unit.areaSqMeters)}</span>
            </p>
          </div>
          <UnitStatusBadge status={unit.status} />
        </div>

        <div className="space-y-1.5 text-dense text-fg-muted">
          <p className="flex items-center gap-1.5">
            <Layers size={14} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-fg-subtle" />
            <span className="truncate">
              {unit.facilityName} · {unit.floorLabel}
            </span>
          </p>
          {unit.facilityAddress ? (
            <p className="flex items-start gap-1.5">
              <MapPin size={14} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-fg-subtle" />
              <span className="line-clamp-2">{unit.facilityAddress}</span>
            </p>
          ) : null}
          <UnitDistance unit={unit} />
        </div>

        <div className="mt-auto space-y-3 border-t border-line pt-4">
          <UnitPrice unit={unit} />
          <UnitActions unit={unit} onDetail={onDetail} onRent={onRent} fullWidth />
        </div>
      </CardContent>
    </Card>
  )
}
