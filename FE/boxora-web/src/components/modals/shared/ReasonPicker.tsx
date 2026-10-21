import { useId } from 'react'
import { Field, Textarea, cn } from '../../ui'
import type { ReasonValue } from './reason'

export interface ReasonPickerProps {
  /** Visible label of the preset group. */
  label: string
  presets: readonly string[]
  value: ReasonValue
  onChange: (value: ReasonValue) => void
  /** Label of the free-text field. */
  noteLabel?: string
  notePlaceholder?: string
  disabled?: boolean
}

/**
 * Preset reason chips plus an optional note. Shared by the cancel and reschedule
 * modals. A preset can be toggled off by selecting it again.
 */
export function ReasonPicker({
  label,
  presets,
  value,
  onChange,
  noteLabel = 'Chi tiết thêm',
  notePlaceholder = 'Nhập thêm chi tiết nếu cần',
  disabled = false,
}: ReasonPickerProps) {
  const labelId = useId()

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-col gap-2">
        <p id={labelId} className="text-sm font-medium text-fg">
          {label}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {presets.map(preset => {
            const selected = value.preset === preset
            return (
              <button
                key={preset}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onChange({ ...value, preset: selected ? '' : preset })}
                className={cn(
                  'inline-flex min-h-7 items-center rounded-full border px-3 py-0.5 text-dense font-medium transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  selected
                    ? 'border-accent-line bg-accent-subtle text-accent-text'
                    : 'border-line-strong bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                {preset}
              </button>
            )
          })}
        </div>
      </div>
      <Field label={noteLabel} optional disabled={disabled}>
        <Textarea
          rows={2}
          value={value.note}
          maxLength={500}
          placeholder={notePlaceholder}
          onChange={event => onChange({ ...value, note: event.target.value })}
        />
      </Field>
    </div>
  )
}
