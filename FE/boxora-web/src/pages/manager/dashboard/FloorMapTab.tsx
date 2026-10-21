import { useMemo, useState } from 'react'
import { LayoutGrid, Plus } from 'lucide-react'
import { Alert, Button, Card, CardContent, EmptyState, SearchInput, Select, Skeleton, Tabs, cn } from '@/components/ui'
import { getUnitStatusMeta } from '@/constants/statusMeta'
import { getApiErrorMessage } from '@/lib/apiError'
import type { Facility, StorageUnit } from '@/types'
import { parseFacilityLayoutConfig } from '@/utils/facilityLayout'
import { UnitTile } from './UnitTile'
import {
  SIZE_FILTER_OPTIONS,
  TONE_DOT_CLASS,
  UNIT_STATUS_KEYS,
  countByStatus,
  getUnitZone,
  isUnitFiltered,
  matchesUnitFilters,
  type FloorKey,
  type SizeFilter,
  type UnitStatusFilter,
  type UnitStatusKey,
  type UnitZone,
} from './unitModel'

interface FloorMapTabProps {
  units: StorageUnit[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
  facility: Facility | undefined
  statusFilter: UnitStatusFilter
  onStatusFilterChange: (status: UnitStatusFilter) => void
  selectedUnitId: string | null
  onSelectUnit: (unit: StorageUnit) => void
  onCreateUnit: () => void
}

const GRID_CLASS = 'grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8'

function StatusLegend({
  counts,
  active,
  onChange,
}: {
  counts: Record<UnitStatusKey, number>
  active: UnitStatusFilter
  onChange: (status: UnitStatusFilter) => void
}) {
  return (
    <div role="group" aria-label="Lọc theo trạng thái kho" className="flex flex-wrap items-center gap-2">
      {UNIT_STATUS_KEYS.map((key) => {
        const meta = getUnitStatusMeta(key)
        const isActive = active === key
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(isActive ? 'all' : key)}
            className={cn(
              'inline-flex h-7 items-center gap-2 rounded-md border px-2.5 text-xs font-medium text-fg-muted transition-colors',
              'hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              isActive ? 'border-accent-line bg-accent-subtle text-fg' : 'border-line bg-surface',
            )}
          >
            <span aria-hidden="true" className={cn('size-2 rounded-full', TONE_DOT_CLASS[meta.tone])} />
            {meta.label}
            <span className="tabular-nums text-fg-subtle">{counts[key]}</span>
          </button>
        )
      })}
    </div>
  )
}

function ZoneSection({
  title,
  units,
  filters,
  selectedUnitId,
  onSelectUnit,
}: {
  title: string
  units: StorageUnit[]
  filters: { query: string; size: SizeFilter; status: UnitStatusFilter }
  selectedUnitId: string | null
  onSelectUnit: (unit: StorageUnit) => void
}) {
  const matchingCount = units.filter((unit) => matchesUnitFilters(unit, filters)).length
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className="flex items-baseline gap-2 text-sm font-semibold text-fg">
        {title}
        <span className="text-xs font-normal tabular-nums text-fg-subtle">
          {isUnitFiltered(filters) ? `${matchingCount}/${units.length} kho` : `${units.length} kho`}
        </span>
      </h3>
      {units.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-dense text-fg-muted">
          Chưa có kho nào trong khu này.
        </p>
      ) : (
        <div className={GRID_CLASS}>
          {units.map((unit) => (
            <UnitTile
              key={unit.id}
              unit={unit}
              selected={unit.id === selectedUnitId}
              matches={matchesUnitFilters(unit, filters)}
              onSelect={onSelectUnit}
            />
          ))}
        </div>
      )}
    </section>
  )
}

/** Floor map: floor switch, filters, status legend with counts and a grid of unit tiles per zone. */
export function FloorMapTab({
  units,
  isLoading,
  error,
  onRetry,
  facility,
  statusFilter,
  onStatusFilterChange,
  selectedUnitId,
  onSelectUnit,
  onCreateUnit,
}: FloorMapTabProps) {
  const [floor, setFloor] = useState<FloorKey>('floor1')
  const [query, setQuery] = useState('')
  const [size, setSize] = useState<SizeFilter>('all')

  const layout = useMemo(() => parseFacilityLayoutConfig(facility?.layoutConfig), [facility?.layoutConfig])
  const filters = useMemo(() => ({ query, size, status: statusFilter }), [query, size, statusFilter])
  const filtered = isUnitFiltered(filters)

  const byZone = useMemo(() => {
    const zones: Record<UnitZone, StorageUnit[]> = { A: [], B: [], C: [] }
    for (const unit of units) zones[getUnitZone(unit)].push(unit)
    return zones
  }, [units])
  const counts = useMemo(() => countByStatus(units), [units])

  const floor1Units = byZone.A.length + byZone.B.length
  const floor2Units = byZone.C.length
  const matching = (list: StorageUnit[]) => list.filter((unit) => matchesUnitFilters(unit, filters)).length

  const clearFilters = () => {
    setQuery('')
    setSize('all')
    onStatusFilterChange('all')
  }

  if (error && units.length === 0) {
    return (
      <Alert
        tone="danger"
        title="Không tải được sơ đồ kho"
        action={
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Thử lại
          </Button>
        }
      >
        {getApiErrorMessage(error)}
      </Alert>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-8 w-72" />
          <div className={GRID_CLASS}>
            {Array.from({ length: 16 }, (_, index) => (
              <Skeleton key={index} className="h-18" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (units.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={LayoutGrid}
          title="Cơ sở chưa có kho nào"
          description="Tạo kho đầu tiên để bắt đầu theo dõi công suất và khách thuê."
          action={
            <Button leftIcon={Plus} onClick={onCreateUnit}>
              Tạo kho
            </Button>
          }
        />
      </Card>
    )
  }

  const visibleZones: { zone: UnitZone; title: string }[] =
    floor === 'floor1'
      ? [
          { zone: 'A', title: layout.zoneAName },
          { zone: 'B', title: layout.zoneBName },
        ]
      : [{ zone: 'C', title: layout.zoneCName }]
  const floorHint =
    floor === 'floor1'
      ? [layout.loadingBayFloor1, layout.corridorNorth, layout.exitFloor1]
      : [layout.loadingBayFloor2, layout.corridorClimate, layout.exitFloor2]
  const floorHasMatches = visibleZones.some(({ zone }) => matching(byZone[zone]) > 0)

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <Alert
          tone="warning"
          title="Không cập nhật được dữ liệu mới nhất"
          action={
            <Button size="sm" variant="secondary" onClick={onRetry}>
              Thử lại
            </Button>
          }
        >
          Sơ đồ đang hiển thị dữ liệu của lần tải trước. {getApiErrorMessage(error)}
        </Alert>
      ) : null}
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs
              variant="segmented"
              size="sm"
              aria-label="Chọn tầng"
              value={floor}
              onValueChange={setFloor}
              items={[
                { value: 'floor1', label: layout.floor1Name, count: filtered ? matching([...byZone.A, ...byZone.B]) : floor1Units },
                { value: 'floor2', label: layout.floor2Name, count: filtered ? matching(byZone.C) : floor2Units },
              ]}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <SearchInput
                value={query}
                onValueChange={setQuery}
                placeholder="Tìm mã kho, khách thuê, hợp đồng"
                size="sm"
                className="sm:w-64"
              />
              <Select
                size="sm"
                aria-label="Lọc theo diện tích"
                value={size}
                onChange={(event) => setSize(event.target.value as SizeFilter)}
                options={SIZE_FILTER_OPTIONS}
                className="sm:w-52"
              />
              {filtered ? (
                <Button variant="link" size="sm" onClick={clearFilters}>
                  Xóa bộ lọc
                </Button>
              ) : null}
            </div>
          </div>

          <StatusLegend counts={counts} active={statusFilter} onChange={onStatusFilterChange} />

          <p className="text-xs text-fg-subtle">{floorHint.filter(Boolean).join(' · ')}</p>

          {filtered && !floorHasMatches ? (
            <EmptyState
              size="sm"
              title="Không có kho phù hợp bộ lọc trên tầng này"
              description="Thử đổi tầng hoặc xóa bộ lọc."
              action={
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Xóa bộ lọc
                </Button>
              }
            />
          ) : null}

          <div className="flex flex-col gap-6">
            {visibleZones.map(({ zone, title }) => (
              <ZoneSection
                key={zone}
                title={title}
                units={byZone[zone]}
                filters={filters}
                selectedUnitId={selectedUnitId}
                onSelectUnit={onSelectUnit}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
