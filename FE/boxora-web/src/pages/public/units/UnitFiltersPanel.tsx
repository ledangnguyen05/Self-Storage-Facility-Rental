import React from 'react'
import { RotateCcw } from 'lucide-react'
import { Alert, Button, Field, SearchInput, Select } from '../../../components/ui'
import { SIZE_BUCKETS, UNIT_CATEGORY_OPTIONS } from '../../../data/storageUnitsData'
import { formatNumber } from '../../../lib/format'
import { distanceFrom } from '../location/facilityDistance'
import { LocateControl } from '../location/LocateControl'
import { PRICE_BUCKETS, type UnitFilters } from './unitFilters'
import type { UnitsExplorerState } from './useUnitsExplorer'

interface UnitFiltersPanelProps {
  explorer: UnitsExplorerState
}

/** All filters of the explorer. Rendered in the sidebar on desktop and in a drawer on mobile. */
export function UnitFiltersPanel({ explorer }: UnitFiltersPanelProps) {
  const {
    filters,
    setFilter,
    query,
    setQuery,
    facilities,
    floorOptions,
    customer,
    nearestFacility,
    hasAnyCoords,
    facilitiesWithoutCoords,
    hasActiveFilters,
    resetFilters,
  } = explorer
  const { location } = customer

  const facilityOptions = [
    { value: '', label: `Tất cả cơ sở (${formatNumber(facilities.length)})` },
    ...facilities.map(facility => {
      const distance = distanceFrom(location, facility.coords)
      const nearest = nearestFacility?.facility.id === facility.id ? ' · gần nhất' : ''
      return {
        value: facility.id,
        label:
          distance == null
            ? facility.name
            : `${facility.name} (~${formatNumber(distance, { maximumFractionDigits: 1 })} km${nearest})`,
      }
    }),
  ]

  const selectedFacility = facilities.find(facility => facility.id === filters.facility)

  return (
    <div className="space-y-5">
      <Field label="Tìm kiếm">
        <SearchInput value={query} onValueChange={setQuery} placeholder="Mã kho, cơ sở, địa chỉ…" />
      </Field>

      <LocateControl customer={customer}>
        {location && !hasAnyCoords ? (
          <Alert tone="warning">
            Chưa có tọa độ cơ sở nên chưa thể tính khoảng cách. Kết quả vẫn được xếp theo giá.
          </Alert>
        ) : null}

        {location && hasAnyCoords && nearestFacility ? (
          <p className="text-dense text-fg-muted">
            Gần bạn nhất: <span className="font-medium text-fg">{nearestFacility.facility.name}</span> (~
            <span className="tabular-nums">{formatNumber(nearestFacility.distanceKm, { maximumFractionDigits: 1 })}</span> km). Kết quả
            được xếp theo khoảng cách, cùng cơ sở thì giá thấp xếp trước.
          </p>
        ) : null}

        {location && hasAnyCoords && facilitiesWithoutCoords > 0 ? (
          <p className="text-xs text-fg-subtle">
            {formatNumber(facilitiesWithoutCoords)} cơ sở chưa có tọa độ nên không hiện khoảng cách.
          </p>
        ) : null}
      </LocateControl>

      <Field label="Cơ sở" hint={selectedFacility?.address || undefined}>
        <Select
          value={filters.facility}
          options={facilityOptions}
          onChange={event => setFilter('facility', event.target.value)}
        />
      </Field>

      <Field label="Tầng">
        <Select
          value={filters.floor}
          disabled={floorOptions.length === 0}
          options={[
            { value: '', label: 'Tất cả tầng' },
            ...floorOptions.map(option => ({ value: option.key, label: option.label })),
          ]}
          onChange={event => setFilter('floor', event.target.value)}
        />
      </Field>

      <Field label="Loại kho">
        <Select
          value={filters.category}
          options={[{ value: '', label: 'Tất cả loại kho' }, ...UNIT_CATEGORY_OPTIONS]}
          onChange={event => setFilter('category', event.target.value as UnitFilters['category'])}
        />
      </Field>

      <Field label="Diện tích">
        <Select
          value={filters.size}
          options={[{ value: '', label: 'Mọi diện tích' }, ...SIZE_BUCKETS]}
          onChange={event => setFilter('size', event.target.value as UnitFilters['size'])}
        />
      </Field>

      <Field label="Giá thuê">
        <Select
          value={filters.price}
          options={[{ value: '', label: 'Mọi mức giá' }, ...PRICE_BUCKETS]}
          onChange={event => setFilter('price', event.target.value as UnitFilters['price'])}
        />
      </Field>

      {hasActiveFilters ? (
        <Button variant="link" size="sm" leftIcon={RotateCcw} onClick={resetFilters}>
          Xóa bộ lọc
        </Button>
      ) : null}
    </div>
  )
}
