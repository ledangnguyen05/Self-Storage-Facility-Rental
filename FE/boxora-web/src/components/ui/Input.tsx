import React from 'react'
import { cn } from './cn'
import { controlClasses, controlIconOffset, type ControlSize } from './controlStyles'
import { useFieldControl } from './fieldContext'
import { renderIcon, type IconProp } from './icon'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: ControlSize
  invalid?: boolean
  leftIcon?: IconProp
  /** Decorative icon at the right edge. */
  rightIcon?: IconProp
  /** Classes for the <input> when icons are present (className then goes to the wrapper). */
  inputClassName?: string
}

/**
 * Text input. `className` styles the root: the <input> itself, or the wrapper
 * when `leftIcon` / `rightIcon` is set.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', invalid, leftIcon, rightIcon, className, inputClassName, type = 'text', ...props },
  ref,
) {
  const { invalid: isInvalid, controlProps } = useFieldControl({ ...props, invalid })
  const hasIcons = Boolean(leftIcon || rightIcon)
  const offsets = controlIconOffset[size]

  const input = (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      {...props}
      {...controlProps}
      className={cn(
        controlClasses({ size, invalid: isInvalid }),
        leftIcon && offsets.padLeft,
        rightIcon && offsets.padRight,
        hasIcons ? inputClassName : className,
      )}
    />
  )

  if (!hasIcons) return input

  return (
    <div className={cn('relative flex w-full items-center', className)}>
      {leftIcon ? (
        <span className={cn('pointer-events-none absolute flex items-center text-fg-subtle', offsets.left)}>
          {renderIcon(leftIcon, { size: 16 })}
        </span>
      ) : null}
      {input}
      {rightIcon ? (
        <span className={cn('pointer-events-none absolute flex items-center text-fg-subtle', offsets.right)}>
          {renderIcon(rightIcon, { size: 16 })}
        </span>
      ) : null}
    </div>
  )
})
