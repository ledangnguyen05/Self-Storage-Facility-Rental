import React, { useState } from 'react'
import { ChevronDown, ExternalLink, MapPin, MapPinOff } from 'lucide-react'
import { LazyFacilityMap } from '../../../components/map/LazyMaps'
import { Alert, Button, Card, CardContent, CardHeader, Skeleton, cn } from '../../../components/ui'
import { buildDirectionsUrl } from '../../../data/storageUnitsData'
import { formatNumber } from '../../../lib/format'
import type { UnitsExplorerState } from './useUnitsExplorer'

interface UnitsMapSectionProps {
  explorer: UnitsExplorerState
  /** Called when the visitor picks "Xem kho trống" on a pin. */
  onSelectFacility: (facilityId: string) => void
}

/** Collapsible map of the branches above the unit list: one pin each, live availability, distance and directions. */
export function UnitsMapSection({ explorer, onSelectFacility }: UnitsMapSectionProps) {
  const { isLoading, error, facilities, mapFacilities, hasAnyCoords, facilitiesWithoutCoords, customer, filters } = explorer
  const [open, setOpen] = useState(true)

  // The list below already reports a failed load; nothing to draw without facilities.
  if (error || (!isLoading && facilities.length === 0)) return null

  let body: React.ReactNode
  if (isLoading) {
    body = <Skeleton className="h-80 w-full rounded-lg sm:h-96" />
  } else if (!hasAnyCoords) {
    body = (
      <div className="space-y-3">
        <Alert tone="info" icon={MapPinOff} title="Chưa có tọa độ GPS của các cơ sở">
          Bản đồ và khoảng cách sẽ hiển thị khi cơ sở được cập nhật vị trí. Trong lúc đó bạn vẫn có thể mở từng địa chỉ trên Google Maps.
        </Alert>
        <ul className="divide-y divide-line rounded-lg border border-line">
          {facilities.map(facility => (
            <li key={facility.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{facility.name}</p>
                <p className="truncate text-dense text-fg-muted">{facility.address || '—'}</p>
              </div>
              {facility.address ? (
                <a
                  href={buildDirectionsUrl(facility.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-dense font-medium text-accent-text hover:underline"
                >
                  Chỉ đường
                  <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    )
  } else {
    body = (
      <div className="space-y-3">
        <LazyFacilityMap
          facilities={mapFacilities}
          userLocation={customer.location}
          selectedId={filters.facility || null}
          onSelectFacility={onSelectFacility}
        />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-fg-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-accent" />
            Cơ sở Boxora
          </span>
          {customer.location ? (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2.5 rounded-full bg-success-solid" />
                Gần bạn nhất
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2.5 rounded-full bg-info-solid" />
                Vị trí của bạn
              </span>
            </>
          ) : (
            <span>Bấm "Vị trí của tôi" ở bộ lọc để xem khoảng cách tới từng cơ sở.</span>
          )}
          {facilitiesWithoutCoords > 0 ? (
            <span className="text-fg-subtle">{formatNumber(facilitiesWithoutCoords)} cơ sở chưa có tọa độ nên chưa hiện trên bản đồ.</span>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader
        title="Bản đồ cơ sở"
        description="Chọn một ghim để xem địa chỉ, số kho trống và đường đi."
        titleAs="h2"
        actions={
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={open}
            aria-controls="units-map-body"
            leftIcon={MapPin}
            rightIcon={<ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" className={cn('transition-transform', open && 'rotate-180')} />}
            onClick={() => setOpen(current => !current)}
          >
            {open ? 'Ẩn bản đồ' : 'Hiện bản đồ'}
          </Button>
        }
      />
      {open ? (
        <CardContent id="units-map-body" className="pt-0">
          {body}
        </CardContent>
      ) : null}
    </Card>
  )
}
