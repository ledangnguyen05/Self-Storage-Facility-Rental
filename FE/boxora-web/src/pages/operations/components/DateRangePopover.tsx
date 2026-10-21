import { useState } from 'react'
import { CalendarRange } from 'lucide-react'
import { Button, Field, Input, Popover, cn } from '@/components/ui'
import { ALL_TIME, DATE_RANGE_PRESETS, describeRange, isSameRange, validateRange, type DateRange } from '../lib/dateRange'

export interface DateRangePopoverProps {
  value: DateRange
  onApply: (range: DateRange) => void
  /** Period the backend reported, shown when only one bound is set. */
  reported?: Partial<DateRange>
}

/** Report period picker: quick presets plus two date fields. The period only changes on "Áp dụng". */
export function DateRangePopover({ value, onApply, reported }: DateRangePopoverProps) {
  return (
    <Popover
      align="end"
      aria-label="Chọn kỳ báo cáo"
      className="w-80 p-4"
      trigger={
        <Button variant="secondary" leftIcon={CalendarRange} aria-label={`Kỳ báo cáo: ${describeRange(value, reported)}`}>
          {describeRange(value, reported)}
        </Button>
      }
    >
      {({ close }) => (
        <DateRangeForm
          initial={value}
          onCancel={close}
          onApply={range => {
            onApply(range)
            close()
          }}
        />
      )}
    </Popover>
  )
}

interface DateRangeFormProps {
  initial: DateRange
  onApply: (range: DateRange) => void
  onCancel: () => void
}

function DateRangeForm({ initial, onApply, onCancel }: DateRangeFormProps) {
  const [draft, setDraft] = useState<DateRange>(initial)
  const error = validateRange(draft)

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault()
        if (!error) onApply(draft)
      }}
    >
      <div className="flex flex-col gap-2">
        <span className="text-dense font-medium text-fg-muted">Chọn nhanh</span>
        <div className="grid grid-cols-3 gap-1.5">
          {DATE_RANGE_PRESETS.map(preset => {
            const active = isSameRange(draft, preset.getRange())
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={() => setDraft(preset.getRange())}
                className={cn(
                  'h-7 rounded-md border px-2 text-dense font-medium transition-colors',
                  active ? 'border-accent-line bg-accent-subtle text-accent-text' : 'border-line bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Từ ngày">
          <Input type="date" value={draft.from} max={draft.to || undefined} onChange={event => setDraft(current => ({ ...current, from: event.target.value }))} />
        </Field>
        <Field label="Đến ngày">
          <Input type="date" value={draft.to} min={draft.from || undefined} onChange={event => setDraft(current => ({ ...current, to: event.target.value }))} />
        </Field>
      </div>
      {error ? (
        <p role="alert" className="-mt-2 text-dense text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
        <Button variant="link" size="sm" onClick={() => setDraft(ALL_TIME)}>
          Xóa kỳ
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Đóng
          </Button>
          <Button type="submit" size="sm" disabled={Boolean(error)}>
            Áp dụng
          </Button>
        </div>
      </div>
    </form>
  )
}
