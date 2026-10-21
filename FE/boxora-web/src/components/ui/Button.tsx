import React from 'react'
import { cn } from './cn'
import { buttonVariants, type ButtonSize, type ButtonVariant } from './buttonVariants'
import { renderIcon, type IconProp } from './icon'
import { Spinner } from './Spinner'
import { Tooltip, type TooltipProps } from './Tooltip'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows a spinner, disables the button and keeps its width. */
  loading?: boolean
  leftIcon?: IconProp
  rightIcon?: IconProp
  fullWidth?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    type = 'button',
    disabled,
    className,
    children,
    ...props
  },
  ref,
) {
  const iconSize = size === 'sm' ? 14 : 16
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-slot="button"
      className={buttonVariants({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner size={size === 'sm' ? 'xs' : 'sm'} label="" />
        </span>
      ) : null}
      <span className={cn('contents', loading && 'invisible')}>
        {renderIcon(leftIcon, { size: iconSize, className: 'shrink-0' })}
        {children}
        {renderIcon(rightIcon, { size: iconSize, className: 'shrink-0' })}
      </span>
    </button>
  )
})

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Required: the accessible name of the button. */
  'aria-label': string
  icon: IconProp
  variant?: 'ghost' | 'secondary' | 'primary' | 'danger'
  size?: ButtonSize
  loading?: boolean
  /** Show a tooltip on hover/focus. `true` reuses the aria-label. */
  tooltip?: boolean | React.ReactNode
  tooltipSide?: TooltipProps['side']
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, variant = 'ghost', size = 'md', loading = false, tooltip, tooltipSide = 'bottom', type = 'button', disabled, className, ...props },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-slot="icon-button"
      className={buttonVariants({ variant, size, iconOnly: true, className })}
      {...props}
    >
      {loading ? <Spinner size="sm" label="" /> : renderIcon(icon, { size: size === 'lg' ? 20 : 16 })}
    </button>
  )
  if (!tooltip) return button
  return (
    <Tooltip content={tooltip === true ? props['aria-label'] : tooltip} side={tooltipSide}>
      {button}
    </Tooltip>
  )
})
