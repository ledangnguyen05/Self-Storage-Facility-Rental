import React, { useRef } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from './cn'
import { controlClasses, controlIconOffset, type ControlSize } from './controlStyles'
import { useFieldControl } from './fieldContext'
import { mergeRefs } from './overlay'

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'value' | 'onChange' | 'type'> {
  value: string
  onValueChange: (value: string) => void
  /** Called after the clear button (or Esc) empties the field. */
  onClear?: () => void
  size?: ControlSize
  invalid?: boolean
  clearLabel?: string
  /** Classes for the <input>; `className` goes to the wrapper. */
  inputClassName?: string
}

/** Input with a search icon and a clear button. Esc clears a non-empty value. */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  {
    value,
    onValueChange,
    onClear,
    size = 'md',
    invalid,
    clearLabel = 'Xóa tìm kiếm',
    placeholder = 'Tìm kiếm…',
    className,
    inputClassName,
    onKeyDown,
    ...props
  },
  ref,
) {
  const { invalid: isInvalid, controlProps } = useFieldControl({ ...props, invalid })
  const offsets = controlIconOffset[size]
  const innerRef = useRef<HTMLInputElement | null>(null)

  const clear = () => {
    onValueChange('')
    onClear?.()
    innerRef.current?.focus()
  }

  return (
    <div className={cn('relative flex w-full items-center', className)}>
      <Search
        size={16}
        strokeWidth={1.75}
        aria-hidden="true"
        className={cn('pointer-events-none absolute text-fg-subtle', offsets.left)}
      />
      <input
        ref={mergeRefs(innerRef, ref)}
        type="search"
        data-slot="input"
        value={value}
        placeholder={placeholder}
        onChange={event => onValueChange(event.target.value)}
        onKeyDown={event => {
          onKeyDown?.(event)
          if (event.key === 'Escape' && value && !event.defaultPrevented) {
            event.preventDefault()
            clear()
          }
        }}
        {...props}
        {...controlProps}
        className={cn(
          controlClasses({ size, invalid: isInvalid }),
          offsets.padLeft,
          offsets.padRight,
          '[&::-webkit-search-cancel-button]:appearance-none',
          inputClassName,
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={clear}
          aria-label={clearLabel}
          className={cn(
            'absolute flex size-5 items-center justify-center rounded text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg',
            size === 'lg' ? 'right-2.5' : 'right-1.5',
          )}
        >
          <X size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
})
