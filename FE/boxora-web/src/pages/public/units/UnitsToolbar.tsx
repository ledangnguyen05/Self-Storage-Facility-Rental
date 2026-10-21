import React from 'react'
import { LayoutGrid, List, SlidersHorizontal } from 'lucide-react'
import { Badge, Button, Select, Tabs } from '../../../components/ui'
import { formatNumber } from '../../../lib/format'
import { SORT_OPTIONS, type StatusFilter } from './unitFilters'
import type { UnitsExplorerState } from './useUnitsExplorer'

export type UnitsView = 'grid' | 'list'

interface UnitsToolbarProps {
  explorer: UnitsExplorerState
  view: UnitsView
  onViewChange: (view: UnitsView) => void
  onOpenFilters: () => void
}

/** Status tabs, sorting and view switch. Sticks under the header on large screens. */
export function UnitsToolbar({ explorer, view, onViewChange, onOpenFilters }: UnitsToolbarProps) {
  const { filters, setFilter, availableCount, totalCount, customer, canSortByDistance, hasAnyCoords, activeFilterCount } = explorer

  return (
    <div className="z-20 -mx-4 border-b border-line bg-canvas px-4 py-3 sm:-mx-6 sm:px-6 lg:sticky lg:top-20 lg:mx-0 lg:rounded-lg lg:border lg:bg-surface lg:px-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Tabs<StatusFilter>
          variant="segmented"
          size="sm"
          aria-label="Tình trạng kho"
          value={filters.status}
          onValueChange={value => setFilter('status', value)}
          items={[
            { value: 'all', label: 'Tất cả kho', count: totalCount },
            { value: 'available', label: 'Còn trống', count: availableCount },
          ]}
        />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="md" className="lg:hidden" leftIcon={SlidersHorizontal} onClick={onOpenFilters}>
            Bộ lọc
            {activeFilterCount > 0 ? (
              <Badge tone="accent" size="sm" className="ml-1">
                {formatNumber(activeFilterCount)}
              </Badge>
            ) : null}
          </Button>

          <Select
            aria-label="Sắp xếp kết quả"
            className="w-52"
            value={filters.sort}
            options={SORT_OPTIONS.map(option => ({
              value: option.value,
              label:
                option.value !== 'distance' || canSortByDistance
                  ? option.label
                  : customer.location && !hasAnyCoords
                    ? 'Gần bạn nhất (chưa có tọa độ cơ sở)'
                    : 'Gần bạn nhất (cần vị trí)',
              disabled: option.value === 'distance' && !canSortByDistance,
            }))}
            onChange={event => setFilter('sort', event.target.value as typeof filters.sort)}
          />

          <Tabs<UnitsView>
            variant="segmented"
            size="sm"
            aria-label="Kiểu hiển thị"
            value={view}
            onValueChange={onViewChange}
            items={[
              { value: 'grid', label: <span className="sr-only">Dạng lưới</span>, icon: LayoutGrid },
              { value: 'list', label: <span className="sr-only">Dạng danh sách</span>, icon: List },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
