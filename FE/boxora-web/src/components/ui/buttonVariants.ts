import { cn } from './cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
export type ButtonSize = 'sm' | 'md' | 'lg'

const base =
  'relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent shadow-xs hover:bg-accent-hover',
  secondary: 'border border-line-strong bg-surface text-fg shadow-xs hover:bg-surface-2',
  ghost: 'text-fg-muted hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger-solid text-on-accent shadow-xs hover:bg-danger-solid/90',
  link: 'rounded-sm text-accent-text underline-offset-4 hover:underline',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 gap-1.5 px-2.5 text-dense',
  md: 'h-8 gap-2 px-3 text-sm',
  lg: 'h-10 gap-2 px-4 text-sm',
}

const linkSizeClasses: Record<ButtonSize, string> = {
  sm: 'gap-1 text-dense',
  md: 'gap-1.5 text-sm',
  lg: 'gap-1.5 text-sm',
}

const iconButtonSizeClasses: Record<ButtonSize, string> = {
  sm: 'size-7',
  md: 'size-8',
  lg: 'size-10',
}

export interface ButtonVariantOptions {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  /** Square button sized for a single icon. */
  iconOnly?: boolean
  className?: string
}

/**
 * Class string for the Button look. Use it to style a router `Link` or an
 * `<a>` like a button: `<Link className={buttonVariants({ variant: 'secondary' })} />`.
 */
export function buttonVariants({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  iconOnly = false,
  className,
}: ButtonVariantOptions = {}): string {
  const sizing =
    variant === 'link' ? linkSizeClasses[size] : iconOnly ? iconButtonSizeClasses[size] : sizeClasses[size]
  return cn(base, variantClasses[variant], sizing, fullWidth && 'w-full', className)
}
