import { cn } from './cn'

export type ControlSize = 'sm' | 'md' | 'lg'

const sizeClasses: Record<ControlSize, string> = {
  sm: 'px-2 text-dense',
  md: 'px-2.5 text-base sm:text-sm',
  lg: 'px-3 text-base sm:text-sm',
}

const heightClasses: Record<ControlSize, string> = {
  sm: 'h-7',
  md: 'h-8',
  lg: 'h-10',
}

/** Shared look of Input, Textarea and Select: one border, one focus ring, one disabled style. */
export function controlClasses({ size = 'md', invalid = false, multiline = false }: { size?: ControlSize; invalid?: boolean; multiline?: boolean }) {
  return cn(
    'w-full min-w-0 rounded-md border bg-surface text-fg shadow-xs outline-none transition-[color,border-color,box-shadow] duration-150',
    'placeholder:text-fg-subtle',
    'disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-2 disabled:text-fg-disabled disabled:shadow-none',
    invalid
      ? 'border-danger focus:border-danger focus:ring-3 focus:ring-danger/15'
      : 'border-line-strong hover:border-fg-disabled focus:border-accent focus:ring-3 focus:ring-accent/15',
    sizeClasses[size],
    multiline ? 'py-1.5' : heightClasses[size],
  )
}

export const controlIconOffset: Record<ControlSize, { left: string; right: string; padLeft: string; padRight: string }> = {
  sm: { left: 'left-2', right: 'right-2', padLeft: 'pl-7', padRight: 'pr-7' },
  md: { left: 'left-2.5', right: 'right-2.5', padLeft: 'pl-8', padRight: 'pr-8' },
  lg: { left: 'left-3', right: 'right-3', padLeft: 'pl-9', padRight: 'pr-9' },
}
