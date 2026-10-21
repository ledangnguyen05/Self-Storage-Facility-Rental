import React, { useId, useMemo } from 'react'
import { CircleAlert } from 'lucide-react'
import { cn } from './cn'
import { FieldContext, type FieldContextValue } from './fieldContext'

export interface FieldProps {
  label?: React.ReactNode
  /** Id given to the control. Generated when omitted. */
  id?: string
  required?: boolean
  /** Shows "(không bắt buộc)" next to the label. */
  optional?: boolean
  hint?: React.ReactNode
  /** Error message. Also marks the control as invalid. */
  error?: React.ReactNode
  disabled?: boolean
  /** Element shown at the right of the label row, e.g. a link button. */
  labelAction?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/**
 * Label + control + hint/error. The control inside (Input, Textarea, Select,
 * SearchInput) picks up `id`, `aria-describedby`, `aria-invalid`, `required`
 * and `disabled` automatically.
 */
export function Field({ label, id, required = false, optional = false, hint, error, disabled = false, labelAction, className, children }: FieldProps) {
  const generatedId = useId()
  const controlId = id ?? `field-${generatedId}`
  const hintId = `${controlId}-hint`
  const errorId = `${controlId}-error`
  const hasError = error !== undefined && error !== null && error !== false && error !== ''
  const hasHint = hint !== undefined && hint !== null && hint !== false && hint !== ''

  const context = useMemo<FieldContextValue>(
    () => ({
      id: controlId,
      describedBy: hasError ? errorId : hasHint ? hintId : undefined,
      invalid: hasError,
      required,
      disabled,
    }),
    [controlId, hasError, hasHint, errorId, hintId, required, disabled],
  )

  return (
    <div data-slot="field" className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {label || labelAction ? (
        <div className="flex items-center justify-between gap-2">
          {label ? (
            <label htmlFor={controlId} className={cn('text-sm font-medium text-fg', disabled && 'text-fg-disabled')}>
              {label}
              {required ? (
                <span className="ml-0.5 text-danger" aria-hidden="true">
                  *
                </span>
              ) : null}
              {optional && !required ? <span className="ml-1 font-normal text-fg-subtle">(không bắt buộc)</span> : null}
            </label>
          ) : (
            <span />
          )}
          {labelAction}
        </div>
      ) : null}
      <FieldContext.Provider value={context}>{children}</FieldContext.Provider>
      {hasError ? (
        <p id={errorId} className="flex items-start gap-1.5 text-dense text-danger">
          <CircleAlert size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : hasHint ? (
        <p id={hintId} className="text-dense text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
