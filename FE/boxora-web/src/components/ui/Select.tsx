import React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from './cn'
import { controlClasses, controlIconOffset, type ControlSize } from './controlStyles'
import { useFieldControl } from './fieldContext'

export interface SelectOption {
  value: string | number
  label: React.ReactNode
  disabled?: boolean
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: ControlSize
  invalid?: boolean
  /** Shorthand for <option> children. */
  options?: SelectOption[]
  /** Adds an empty, unselectable first option (`value=""`). */
  placeholder?: string
  /** Classes for the <select>; `className` goes to the wrapper. */
  selectClassName?: string
}

/** Native select styled like Input. Keyboard and mobile pickers work out of the box. */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { size = 'md', invalid, options, placeholder, className, selectClassName, children, ...props },
  ref,
) {
  const { invalid: isInvalid, controlProps } = useFieldControl({ ...props, invalid })
  return (
    <div className={cn('relative flex w-full items-center', className)}>
      <select
        ref={ref}
        data-slot="select"
        {...props}
        {...controlProps}
        className={cn(
          controlClasses({ size, invalid: isInvalid }),
          'cursor-pointer appearance-none truncate',
          controlIconOffset[size].padRight,
          selectClassName,
        )}
      >
        {placeholder !== undefined ? (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        ) : null}
        {options?.map(option => (
          <option key={String(option.value)} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown
        size={16}
        strokeWidth={1.75}
        aria-hidden="true"
        className={cn('pointer-events-none absolute text-fg-subtle', controlIconOffset[size].right)}
      />
    </div>
  )
})
