import { Button, Field, Input, SearchInput, Select } from '@/components/ui'
import { todayISO } from '@/lib/format'
import type { LedgerFilterState } from '../hooks/useCashierLedger'
import {
  METHOD_FILTER_OPTIONS,
  RANGE_PRESET_OPTIONS,
  STATUS_FILTER_OPTIONS,
  TYPE_FILTER_OPTIONS,
  type DateRange,
  type RangePreset,
} from '../ledgerUtils'

interface LedgerFiltersProps {
  range: DateRange
  preset: RangePreset
  onRangeChange: (patch: Partial<DateRange>) => void
  onPresetChange: (preset: RangePreset) => void
  filters: LedgerFilterState
  onFiltersChange: (patch: Partial<LedgerFilterState>) => void
  onClear: () => void
  hasActiveFilters: boolean
}

export function LedgerFilters({
  range,
  preset,
  onRangeChange,
  onPresetChange,
  filters,
  onFiltersChange,
  onClear,
  hasActiveFilters,
}: LedgerFiltersProps) {
  const today = todayISO()
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Khoảng thời gian">
          <Select
            value={preset}
            onChange={event => onPresetChange(event.target.value as RangePreset)}
            options={RANGE_PRESET_OPTIONS}
            className="w-full sm:w-40"
          />
        </Field>
        <Field label="Từ ngày">
          <Input
            type="date"
            value={range.from}
            max={today}
            onChange={event => onRangeChange({ from: event.target.value })}
            className="w-full sm:w-40"
          />
        </Field>
        <Field label="Đến ngày">
          <Input
            type="date"
            value={range.to}
            max={today}
            onChange={event => onRangeChange({ to: event.target.value })}
            className="w-full sm:w-40"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={filters.search}
          onValueChange={search => onFiltersChange({ search })}
          placeholder="Tìm mã giao dịch, mã kho, khách hàng…"
          className="w-full sm:w-72"
        />
        <Select
          aria-label="Phương thức"
          value={filters.method}
          onChange={event => onFiltersChange({ method: event.target.value })}
          options={METHOD_FILTER_OPTIONS}
          className="w-full sm:w-44"
        />
        <Select
          aria-label="Trạng thái"
          value={filters.status}
          onChange={event => onFiltersChange({ status: event.target.value })}
          options={STATUS_FILTER_OPTIONS}
          className="w-full sm:w-44"
        />
        <Select
          aria-label="Loại giao dịch"
          value={filters.type}
          onChange={event => onFiltersChange({ type: event.target.value })}
          options={TYPE_FILTER_OPTIONS}
          className="w-full sm:w-48"
        />
        {hasActiveFilters ? (
          <Button variant="link" size="sm" onClick={onClear}>
            Xóa bộ lọc
          </Button>
        ) : null}
      </div>
    </div>
  )
}
