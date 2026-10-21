import React, { useId, useRef } from 'react'
import { cn } from './cn'
import { renderIcon, type IconProp } from './icon'

export interface TabItem<T extends string = string> {
  value: T
  label: React.ReactNode
  icon?: IconProp
  /** Small count pill after the label. */
  count?: number
  disabled?: boolean
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[]
  value: T
  onValueChange: (value: T) => void
  /** `underline` for page sections, `segmented` for view toggles. */
  variant?: 'underline' | 'segmented'
  size?: 'sm' | 'md'
  /** Accessible name of the tab list. */
  'aria-label'?: string
  /** Base id. Pair with <TabPanel tabsId={id} value=...> to wire aria-controls. */
  id?: string
  fullWidth?: boolean
  className?: string
}

/** Controlled tabs with roving focus: Arrow keys move and select, Home/End jump. */
export function Tabs<T extends string = string>({
  items,
  value,
  onValueChange,
  variant = 'underline',
  size = 'md',
  id,
  fullWidth = false,
  className,
  ...props
}: TabsProps<T>) {
  const generatedId = useId()
  const baseId = id ?? `tabs-${generatedId}`
  const listRef = useRef<HTMLDivElement>(null)
  const enabled = items.filter(item => !item.disabled)

  const focusTab = (nextValue: T) => {
    onValueChange(nextValue)
    const button = listRef.current?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(nextValue)}"]`)
    button?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = enabled.findIndex(item => item.value === value)
    if (enabled.length === 0) return
    let next: TabItem<T> | undefined
    if (event.key === 'ArrowRight') next = enabled[(index + 1) % enabled.length]
    else if (event.key === 'ArrowLeft') next = enabled[(index - 1 + enabled.length) % enabled.length]
    else if (event.key === 'Home') next = enabled[0]
    else if (event.key === 'End') next = enabled[enabled.length - 1]
    if (!next) return
    event.preventDefault()
    focusTab(next.value)
  }

  const segmented = variant === 'segmented'

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={props['aria-label']}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      data-slot="tabs"
      className={cn(
        segmented
          ? 'inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-md border border-line bg-surface-2 p-0.5 scrollbar-none'
          : 'relative flex max-w-full items-center gap-5 overflow-x-auto scrollbar-none before:pointer-events-none before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-line',
        fullWidth && (segmented ? 'flex w-full' : 'w-full'),
        className,
      )}
    >
      {items.map(item => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`${baseId}-tab-${item.value}`}
            aria-controls={id ? `${baseId}-panel-${item.value}` : undefined}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            data-value={item.value}
            onClick={() => onValueChange(item.value)}
            className={cn(
              'inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
              segmented
                ? cn(
                    'rounded px-3 text-fg-muted hover:text-fg',
                    size === 'sm' ? 'h-6 text-dense' : 'h-7 text-sm',
                    selected && 'bg-surface text-fg shadow-xs',
                    fullWidth && 'flex-1',
                  )
                : cn(
                    'relative z-10 border-b-2 px-0.5 text-fg-muted hover:text-fg',
                    size === 'sm' ? 'h-9 text-dense' : 'h-10 text-sm',
                    selected ? 'border-accent text-fg' : 'border-transparent hover:border-line-strong',
                  ),
            )}
          >
            {renderIcon(item.icon, { size: 16 })}
            {item.label}
            {item.count !== undefined ? (
              <span
                className={cn(
                  'min-w-5 rounded-full px-1.5 text-center text-xs font-medium leading-5 tabular-nums',
                  selected ? 'bg-accent-subtle text-accent-text' : 'bg-surface-3 text-fg-muted',
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The `id` passed to <Tabs>. */
  tabsId: string
  value: string
}

/** Optional wrapper that links a panel to its tab for screen readers. */
export function TabPanel({ tabsId, value, className, ...props }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={`${tabsId}-panel-${value}`}
      aria-labelledby={`${tabsId}-tab-${value}`}
      tabIndex={0}
      className={cn('outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', className)}
      {...props}
    />
  )
}
