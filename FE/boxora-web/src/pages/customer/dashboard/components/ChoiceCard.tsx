import { useId, type ReactNode } from 'react'
import { cn } from '@/components/ui'

export interface ChoiceCardProps {
  /** Radio group name; cards sharing it form one group (arrow keys move between them). */
  name: string
  value: string
  checked: boolean
  onSelect: (value: string) => void
  label: ReactNode
  description?: ReactNode
  /** Right-aligned extra on the title row (e.g. a Badge). */
  meta?: ReactNode
  /** Content under the description (e.g. the amount due). */
  footer?: ReactNode
  disabled?: boolean
  className?: string
}

/**
 * Selectable card backed by a native radio input (local primitive of the
 * customer portal; candidate for components/ui). Wrap a set of cards in an
 * element with `role="radiogroup"` and an accessible name.
 */
export function ChoiceCard({ name, value, checked, onSelect, label, description, meta, footer, disabled = false, className }: ChoiceCardProps) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex min-w-0 cursor-pointer flex-col gap-1 rounded-lg border bg-surface p-3 text-left transition-colors',
        'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring',
        checked ? 'border-accent bg-accent-subtle ring-1 ring-accent' : 'border-line hover:border-line-strong',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-fg">{label}</span>
        {meta}
      </span>
      {description ? <span className="text-dense text-fg-muted">{description}</span> : null}
      {footer}
    </label>
  )
}
