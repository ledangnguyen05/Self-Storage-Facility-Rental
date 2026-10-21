import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Clock, MapPin, MapPinOff, Navigation, Phone } from 'lucide-react'
import { LazyFacilityMap } from '../../../components/map/LazyMaps'
import type { MapFacility } from '../../../components/map/mapTypes'
import { Alert, Badge, Button, Card, CardContent, EmptyState, Skeleton } from '../../../components/ui'
import { buttonVariants } from '../../../components/ui/buttonVariants'
import { FACILITIES_CONTENT } from '../../../data/homeContent'
import { buildDirectionsUrl, type GeoPoint } from '../../../data/storageUnitsData'
import { getApiErrorMessage } from '../../../lib/apiError'
import { formatNumber, formatTime, toNumber } from '../../../lib/format'
import type { Facility } from '../../../types'
import { Section, SectionHeading } from '../components/Section'
import { distanceFrom, findNearest } from '../location/facilityDistance'
import { LocateControl } from '../location/LocateControl'
import { useCustomerLocation } from '../location/useCustomerLocation'

const MAX_FACILITIES = 6

interface FacilitiesSectionProps {
  facilities: Facility[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
}

interface BranchView {
  facility: Facility
  coords: GeoPoint | null
  distanceKm: number | null
  isNearest: boolean
}

function openingHours(facility: Facility): string | null {
  if (!facility.openTime || !facility.closeTime) return null
  return `${formatTime(facility.openTime)} – ${formatTime(facility.closeTime)}`
}

function toCoords(facility: Facility): GeoPoint | null {
  const lat = toNumber(facility.latitude)
  const lng = toNumber(facility.longitude)
  return lat != null && lng != null ? { lat, lng } : null
}

function BranchCard({
  branch,
  origin,
  selected,
  onShowOnMap,
}: {
  branch: BranchView
  origin: GeoPoint | null
  selected: boolean
  onShowOnMap: (facilityId: string) => void
}) {
  const { facility, coords, distanceKm, isNearest } = branch
  const available = Number(facility.availableUnits) || 0
  const hasUnits = (Number(facility.totalUnits) || 0) > 0
  const hours = openingHours(facility)
  const addressText = [facility.address, facility.city].filter(Boolean).join(', ')
  const directionsTarget = coords ?? addressText
  const phoneDigits = (facility.contactPhone ?? '').replace(/[^\d+]/g, '')
  const phoneHref = phoneDigits ? `tel:${phoneDigits}` : null

  return (
    <Card className={selected ? 'border-accent-line' : undefined}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-fg">{facility.name}</h3>
            <p className="mt-1 flex items-start gap-1.5 text-dense text-fg-muted">
              <MapPin size={14} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-fg-subtle" />
              <span>{addressText || '—'}</span>
            </p>
            {hours ? (
              <p className="mt-1 flex items-center gap-1.5 text-dense text-fg-muted">
                <Clock size={14} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-fg-subtle" />
                <span className="tabular-nums">Giờ làm việc {hours}</span>
              </p>
            ) : null}
            {phoneHref ? (
              <p className="mt-1 flex items-center gap-1.5 text-dense text-fg-muted">
                <Phone size={14} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-fg-subtle" />
                <a href={phoneHref} className="tabular-nums text-accent-text hover:underline">
                  {facility.contactPhone}
                </a>
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Badge tone={available > 0 ? 'success' : 'neutral'}>
              {available > 0 ? `${formatNumber(available)} kho trống` : hasUnits ? 'Hết kho trống' : 'Chưa có kho'}
            </Badge>
            {distanceKm != null ? (
              <Badge tone="accent" size="sm" icon={Navigation}>
                <span className="tabular-nums">~{formatNumber(distanceKm, { maximumFractionDigits: 1 })} km</span>
              </Badge>
            ) : null}
            {isNearest ? (
              <Badge tone="success" size="sm">
                Gần bạn nhất
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {hasUnits ? (
            <Link
              to={`/units?facility=${encodeURIComponent(facility.id)}&status=available`}
              className={buttonVariants({ size: 'sm' })}
            >
              Xem kho trống
            </Link>
          ) : null}
          {directionsTarget ? (
            <a
              href={buildDirectionsUrl(directionsTarget, origin)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            >
              Chỉ đường
            </a>
          ) : null}
          {coords ? (
            <Button variant="ghost" size="sm" leftIcon={MapPin} onClick={() => onShowOnMap(facility.id)}>
              Xem trên bản đồ
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export function FacilitiesSection({ facilities, isLoading, error, onRetry }: FacilitiesSectionProps) {
  const customer = useCustomerLocation()
  const { location } = customer
  // `nonce` changes on every press so the map re-opens the popup even when the same branch is chosen again.
  const [selection, setSelection] = useState<{ id: string; nonce: number } | null>(null)
  const selectedId = selection?.id ?? null
  const mapBox = useRef<HTMLDivElement>(null)

  const showOnMap = useCallback((facilityId: string) => {
    setSelection(previous => ({ id: facilityId, nonce: (previous?.nonce ?? 0) + 1 }))
    // On a phone the map sits above the list: bring it into view so the visitor sees which branch was chosen.
    const box = mapBox.current
    if (!box) return
    const rect = box.getBoundingClientRect()
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      box.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
    }
  }, [])

  const branches = useMemo<BranchView[]>(() => {
    const withCoords = facilities.map(facility => ({ id: facility.id, facility, coords: toCoords(facility) }))
    const nearest = findNearest(withCoords, location)
    const list = withCoords.map(item => ({
      facility: item.facility,
      coords: item.coords,
      distanceKm: distanceFrom(location, item.coords),
      isNearest: nearest?.item.id === item.id,
    }))
    // Closest first when the visitor's position is known; branches without coordinates and ties keep the server order.
    if (location) {
      list.sort((a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY) || 0)
    }
    return list
  }, [facilities, location])

  const shown = useMemo(() => branches.slice(0, MAX_FACILITIES), [branches])
  const hasAnyCoords = shown.some(branch => branch.coords != null)
  const mapFacilities = useMemo<MapFacility[]>(
    () =>
      shown.flatMap(branch =>
        branch.coords
          ? [
              {
                id: branch.facility.id,
                name: branch.facility.name,
                address: [branch.facility.address, branch.facility.city].filter(Boolean).join(', '),
                lat: branch.coords.lat,
                lng: branch.coords.lng,
                availableUnits: Number(branch.facility.availableUnits) || 0,
                totalUnits: Number(branch.facility.totalUnits) || 0,
                distanceKm: branch.distanceKm,
                isNearest: branch.isNearest,
              },
            ]
          : [],
      ),
    [shown],
  )

  let body: React.ReactNode
  if (isLoading) {
    body = (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-7 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  } else if (error) {
    body = (
      <Alert
        tone="danger"
        title="Không tải được danh sách cơ sở"
        action={
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Thử lại
          </Button>
        }
      >
        {getApiErrorMessage(error)}
      </Alert>
    )
  } else if (shown.length === 0) {
    body = (
      <Card>
        <EmptyState
          icon={Building2}
          title="Chưa có cơ sở nào đang mở"
          description="Danh sách cơ sở sẽ xuất hiện tại đây khi có cơ sở đi vào hoạt động."
        />
      </Card>
    )
  } else {
    const nearest = shown.find(branch => branch.isNearest)
    body = (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <div className="order-2 space-y-4 lg:order-1">
          <Card>
            <CardContent className="p-4">
              <LocateControl customer={customer} hint="Nhập địa chỉ hoặc dùng GPS để xem cơ sở nào gần bạn nhất.">
                {location && !hasAnyCoords ? (
                  <Alert tone="warning">Chưa có tọa độ cơ sở nên chưa thể tính khoảng cách.</Alert>
                ) : null}
                {location && nearest && nearest.distanceKm != null ? (
                  <p className="text-dense text-fg-muted">
                    Gần bạn nhất: <span className="font-medium text-fg">{nearest.facility.name}</span> (~
                    <span className="tabular-nums">{formatNumber(nearest.distanceKm, { maximumFractionDigits: 1 })}</span> km)
                  </p>
                ) : null}
              </LocateControl>
            </CardContent>
          </Card>

          <ul className="space-y-3">
            {shown.map(branch => (
              <li key={branch.facility.id}>
                <BranchCard branch={branch} origin={location} selected={selectedId === branch.facility.id} onShowOnMap={showOnMap} />
              </li>
            ))}
          </ul>
        </div>

        <div ref={mapBox} className="order-1 lg:sticky lg:top-24 lg:order-2">
          {hasAnyCoords ? (
            <LazyFacilityMap
              facilities={mapFacilities}
              userLocation={location}
              selectedId={selectedId}
              focusRequest={selection?.nonce ?? 0}
              heightClassName="h-80 lg:h-[28rem]"
            />
          ) : (
            <Alert tone="info" icon={MapPinOff} title="Chưa có tọa độ GPS của các cơ sở">
              Bản đồ sẽ hiển thị khi cơ sở được cập nhật vị trí. Bạn vẫn có thể bấm Chỉ đường theo địa chỉ ở từng cơ sở.
            </Alert>
          )}
        </div>
      </div>
    )
  }

  return (
    <Section id="facilities" tone="surface" aria-labelledby="facilities-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading id="facilities-title" title={FACILITIES_CONTENT.title} description={FACILITIES_CONTENT.description} />
        {facilities.length > MAX_FACILITIES ? (
          <Link to="/units" className={buttonVariants({ variant: 'secondary' })}>
            Xem tất cả kho
          </Link>
        ) : null}
      </div>
      <div className="mt-10">{body}</div>
    </Section>
  )
}
