import React, { useEffect, useId, useRef } from 'react'
import { Check, Minus } from 'lucide-react'
import { cn } from './cn'
import { mergeRefs } from './overlay'

interface ChoiceLabelProps {
  label?: React.ReactNode
  description?: React.ReactNode
}

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>, ChoiceLabelProps {
  /** Shows a dash instead of a tick (e.g. "some rows selected"). */
  indeterminate?: boolean
  onCheckedChange?: (checked: boolean) => void
}

/** Native checkbox with an optional label and description. */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, indeterminate = false, onCheckedChange, onChange, className, id, disabled, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? `checkbox-${generatedId}`
  const descriptionId = description ? `${inputId}-description` : undefined
  const innerRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate
  }, [indeterminate])

  const control = (
    <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
      <input
        ref={mergeRefs(innerRef, ref)}
        id={inputId}
        type="checkbox"
        data-slot="checkbox"
        disabled={disabled}
        aria-describedby={descriptionId}
        onChange={event => {
          onChange?.(event)
          onCheckedChange?.(event.target.checked)
        }}
        className={cn(
          'peer size-4 shrink-0 cursor-pointer appearance-none rounded border border-line-strong bg-surface shadow-xs transition-colors',
          'checked:border-accent checked:bg-accent indeterminate:border-accent indeterminate:bg-accent',
          'hover:border-fg-disabled checked:hover:bg-accent-hover',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !label && className,
        )}
        {...props}
      />
      {indeterminate ? (
        <Minus size={12} strokeWidth={3} aria-hidden="true" className="pointer-events-none absolute text-on-accent" />
      ) : (
        <Check
          size={12}
          strokeWidth={3}
          aria-hidden="true"
          className="pointer-events-none absolute hidden text-on-accent peer-checked:block"
        />
      )}
    </span>
  )

  if (!label && !description) return control

  return (
    <ChoiceLabel htmlFor={inputId} label={label} description={description} descriptionId={descriptionId} disabled={disabled} className={className}>
      {control}
    </ChoiceLabel>
  )
})

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>, ChoiceLabelProps {}

/** Native radio. Group several with the same `name`. */
export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, description, className, id, disabled, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? `radio-${generatedId}`
  const descriptionId = description ? `${inputId}-description` : undefined

  const control = (
    <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
      <input
        ref={ref}
        id={inputId}
        type="radio"
        data-slot="radio"
        disabled={disabled}
        aria-describedby={descriptionId}
        className={cn(
          'peer size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-line-strong bg-surface shadow-xs transition-colors',
          'checked:border-accent checked:bg-accent hover:border-fg-disabled',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !label && className,
        )}
        {...props}
      />
      <span aria-hidden="true" className="pointer-events-none absolute hidden size-1.5 rounded-full bg-on-accent peer-checked:block" />
    </span>
  )

  if (!label && !description) return control

  return (
    <ChoiceLabel htmlFor={inputId} label={label} description={description} descriptionId={descriptionId} disabled={disabled} className={className}>
      {control}
    </ChoiceLabel>
  )
})

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'>, ChoiceLabelProps {
  onCheckedChange?: (checked: boolean) => void
  size?: 'sm' | 'md'
  /** `start` puts the label first and pushes the switch to the right edge (settings rows). */
  labelPosition?: 'start' | 'end'
}

/** On/off toggle built on a native checkbox with role="switch". */
export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, description, onCheckedChange, onChange, size = 'md', labelPosition = 'end', className, id, disabled, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? `switch-${generatedId}`
  const descriptionId = description ? `${inputId}-description` : undefined
  const track = size === 'sm' ? 'h-4 w-7' : 'h-5 w-9'
  const thumb = size === 'sm' ? 'size-3 peer-checked:translate-x-3' : 'size-4 peer-checked:translate-x-4'

  const control = (
    <span className={cn('relative inline-flex shrink-0 items-center', track)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        role="switch"
        data-slot="switch"
        disabled={disabled}
        aria-describedby={descriptionId}
        onChange={event => {
          onChange?.(event)
          onCheckedChange?.(event.target.checked)
        }}
        className={cn(
          'peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-full bg-line-strong transition-colors',
          'checked:bg-accent hover:bg-fg-disabled checked:hover:bg-accent-hover',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !label && className,
        )}
        {...props}
      />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute left-0.5 rounded-full bg-on-accent shadow-xs transition-transform duration-150',
          thumb,
        )}
      />
    </span>
  )

  if (!label && !description) return control

  return (
    <ChoiceLabel
      htmlFor={inputId}
      label={label}
      description={description}
      descriptionId={descriptionId}
      disabled={disabled}
      reverse={labelPosition === 'start'}
      className={className}
    >
      {control}
    </ChoiceLabel>
  )
})

function ChoiceLabel({
  htmlFor,
  label,
  description,
  descriptionId,
  disabled,
  reverse = false,
  className,
  children,
}: ChoiceLabelProps & {
  htmlFor: string
  descriptionId?: string
  disabled?: boolean
  reverse?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex items-start gap-2.5', reverse && 'flex-row-reverse justify-between gap-4', className)}>
      <span className={cn('flex shrink-0 items-center', description ? 'mt-0.5' : 'h-5')}>{children}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        {label ? (
          <label
            htmlFor={htmlFor}
            className={cn('cursor-pointer text-sm font-medium leading-5 text-fg', disabled && 'cursor-not-allowed text-fg-disabled')}
          >
            {label}
          </label>
        ) : null}
        {description ? (
          <span id={descriptionId} className="text-dense text-fg-muted">
            {description}
          </span>
        ) : null}
      </span>
    </div>
  )
}
