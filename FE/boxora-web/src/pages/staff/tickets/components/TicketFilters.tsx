import { useMemo } from 'react'
import { Button, Checkbox, SearchInput, Select } from '@/components/ui'
import type { Facility } from '@/types'
import { ALL, CATEGORY_FILTER_OPTIONS, PRIORITY_FILTER_OPTIONS, STATUS_FILTER_OPTIONS } from '../constants'
import type { TicketFilterState } from '../hooks/useTicketFilters'

interface TicketFiltersProps {
  filters: TicketFilterState
  onChange: (patch: Partial<TicketFilterState>) => void
  onClear: () => void
  hasActiveFilters: boolean
  /** Facility scope. Omitted for roles pinned to one facility (the select is hidden). */
  facility?: {
    value: string
    options: Facility[]
    onChange: (facilityId: string) => void
  }
}

export function TicketFilters({ filters, onChange, onClear, hasActiveFilters, facility }: TicketFiltersProps) {
  const facilityOptions = useMemo(
    () => (facility ? [{ value: ALL, label: 'Tất cả cơ sở' }, ...facility.options.map(f => ({ value: f.id, label: f.name }))] : []),
    [facility]
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput
        value={filters.search}
        onValueChange={search => onChange({ search })}
        placeholder="Tìm mã, tiêu đề, kho, khách, nhân viên…"
        className="w-full sm:w-72"
      />
      {facility ? (
        <Select
          aria-label="Cơ sở"
          value={facility.value}
          onChange={event => facility.onChange(event.target.value)}
          options={facilityOptions}
          className="w-full sm:w-44"
        />
      ) : null}
      <Select
        aria-label="Trạng thái"
        value={filters.status}
        onChange={event => onChange({ status: event.target.value })}
        options={STATUS_FILTER_OPTIONS}
        className="w-full sm:w-40"
      />
      <Select
        aria-label="Mức ưu tiên"
        value={filters.priority}
        onChange={event => onChange({ priority: event.target.value })}
        options={PRIORITY_FILTER_OPTIONS}
        className="w-full sm:w-44"
      />
      <Select
        aria-label="Danh mục"
        value={filters.category}
        onChange={event => onChange({ category: event.target.value })}
        options={CATEGORY_FILTER_OPTIONS}
        className="w-full sm:w-44"
      />
      <Checkbox
        label="Chỉ quá hạn SLA"
        checked={filters.overdueOnly}
        onCheckedChange={overdueOnly => onChange({ overdueOnly })}
        className="px-1"
      />
      {hasActiveFilters ? (
        <Button variant="link" size="sm" onClick={onClear}>
          Xóa bộ lọc
        </Button>
      ) : null}
    </div>
  )
}
