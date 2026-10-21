import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { cn } from './cn'
import { useFloatingPosition, type FloatingAlign, type FloatingSide } from './floating'
import { renderIcon, type IconProp } from './icon'
import { mergeRefs, useControllableOpen, useEscapeKey, useLayer, useOutsidePointerDown } from './overlay'
import type { TriggerElement } from './Popover'
import { Portal } from './Portal'

interface MenuContextValue {
  close: (restoreFocus?: boolean) => void
}

const MenuContext = createContext<MenuContextValue>({ close: () => undefined })

const ITEM_SELECTOR = '[role^="menuitem"]:not([aria-disabled="true"])'

export interface DropdownMenuProps {
  /** A single focusable element (Button / IconButton). It receives ref, onClick, onKeyDown and aria attributes. */
  trigger: TriggerElement
  /** DropdownMenuItem, DropdownMenuLabel and DropdownMenuSeparator. */
  children: React.ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  side?: FloatingSide
  align?: FloatingAlign
  /** Make the menu at least as wide as the trigger. */
  matchTriggerWidth?: boolean
  'aria-label'?: string
  /** Menu classes. Default min width is 12rem. */
  className?: string
}

/** Action menu. Arrow keys move, Enter selects, Esc / Tab / outside click close. */
export function DropdownMenu({
  trigger,
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  side = 'bottom',
  align = 'end',
  matchTriggerWidth = false,
  className,
  ...props
}: DropdownMenuProps) {
  const [open, setOpen] = useControllableOpen(openProp, defaultOpen, onOpenChange)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [menu, setMenu] = useState<HTMLDivElement | null>(null)
  const focusOnOpen = useRef<'first' | 'last' | 'menu'>('menu')
  const menuId = useId()
  const layer = useLayer(open, false)
  const { style } = useFloatingPosition(anchor, menu, open, { side, align, offset: 4, matchWidth: matchTriggerWidth })

  const close = useCallback(
    (restoreFocus = true) => {
      setOpen(false)
      if (restoreFocus) anchor?.focus({ preventScroll: true })
    },
    [anchor, setOpen],
  )

  useEscapeKey(open, layer, () => close(true))
  useOutsidePointerDown(open, [anchor, menu], () => close(false))

  useEffect(() => {
    if (!open || !menu) return
    const items = Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR))
    const target =
      focusOnOpen.current === 'first'
        ? items[0]
        : focusOnOpen.current === 'last'
          ? items[items.length - 1]
          : (items.find(item => item.getAttribute('aria-checked') === 'true') ?? menu)
    ;(target ?? menu).focus({ preventScroll: true })
  }, [open, menu])

  const openWith = (focus: 'first' | 'last' | 'menu') => {
    focusOnOpen.current = focus
    setOpen(true)
  }

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!menu) return
    const items = Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR))
    if (items.length === 0) return
    const index = items.indexOf(document.activeElement as HTMLElement)
    let next: HTMLElement | undefined
    if (event.key === 'ArrowDown') next = items[(index + 1) % items.length]
    else if (event.key === 'ArrowUp') next = items[index <= 0 ? items.length - 1 : index - 1]
    else if (event.key === 'Home') next = items[0]
    else if (event.key === 'End') next = items[items.length - 1]
    else if (event.key === 'Tab') {
      event.preventDefault()
      close(true)
      return
    }
    if (next) {
      event.preventDefault()
      next.focus()
    }
  }

  const triggerProps = trigger.props
  const triggerRef = useMemo(() => mergeRefs(triggerProps.ref, setAnchor), [triggerProps.ref])
  const triggerNode = React.cloneElement(trigger, {
    ref: triggerRef,
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      triggerProps.onClick?.(event)
      if (event.defaultPrevented) return
      if (open) close(false)
      else openWith(event.detail === 0 ? 'first' : 'menu')
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      triggerProps.onKeyDown?.(event)
      if (event.defaultPrevented) return
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        openWith(event.key === 'ArrowDown' ? 'first' : 'last')
      }
    },
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
  })

  return (
    <>
      {triggerNode}
      {open ? (
        <Portal>
          <MenuContext.Provider value={{ close }}>
            <div
              ref={setMenu}
              id={menuId}
              role="menu"
              aria-orientation="vertical"
              aria-label={props['aria-label']}
              tabIndex={-1}
              data-slot="dropdown-menu"
              style={style}
              onKeyDown={onMenuKeyDown}
              className={cn(
                'z-300 min-w-48 overflow-y-auto rounded-lg border border-line bg-overlay p-1 text-fg shadow-md outline-none animate-popover-in',
                className,
              )}
            >
              {children}
            </div>
          </MenuContext.Provider>
        </Portal>
      ) : null}
    </>
  )
}

export interface DropdownMenuItemProps {
  children: React.ReactNode
  icon?: IconProp
  /** Secondary line under the label. */
  description?: React.ReactNode
  /** Right-aligned hint, e.g. a count or shortcut. */
  trailing?: React.ReactNode
  onSelect?: () => void
  /** Render as a router link. */
  to?: string
  tone?: 'default' | 'danger'
  disabled?: boolean
  /** Makes the item a checked radio option (menuitemradio) and shows a tick. */
  selected?: boolean
  /** Keep the menu open after selecting. */
  keepOpen?: boolean
  className?: string
}

export function DropdownMenuItem({
  children,
  icon,
  description,
  trailing,
  onSelect,
  to,
  tone = 'default',
  disabled = false,
  selected,
  keepOpen = false,
  className,
}: DropdownMenuItemProps) {
  const { close } = useContext(MenuContext)
  const isRadio = selected !== undefined
  const classes = cn(
    'flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors',
    tone === 'danger' ? 'text-danger hover:bg-danger-subtle focus:bg-danger-subtle' : 'text-fg hover:bg-surface-2 focus:bg-surface-2',
    disabled && 'pointer-events-none opacity-50',
    className,
  )
  const content = (
    <>
      {icon ? (
        <span className={cn('shrink-0', tone === 'danger' ? 'text-danger' : 'text-fg-subtle')}>{renderIcon(icon, { size: 16 })}</span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{children}</span>
        {description ? <span className="truncate text-xs text-fg-subtle">{description}</span> : null}
      </span>
      {trailing ? <span className="shrink-0 text-xs tabular-nums text-fg-subtle">{trailing}</span> : null}
      {isRadio ? (
        <Check size={16} strokeWidth={1.75} aria-hidden="true" className={cn('shrink-0 text-accent-text', !selected && 'invisible')} />
      ) : null}
    </>
  )

  const select = () => {
    if (disabled) return
    onSelect?.()
    if (!keepOpen) close(!to)
  }

  const shared = {
    role: isRadio ? 'menuitemradio' : 'menuitem',
    'aria-checked': isRadio ? Boolean(selected) : undefined,
    'aria-disabled': disabled || undefined,
    tabIndex: -1,
    className: classes,
  }

  if (to && !disabled) {
    return (
      <Link to={to} {...shared} onClick={select}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" {...shared} onClick={select}>
      {content}
    </button>
  )
}

export function DropdownMenuLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="presentation" className={cn('px-2 pb-1 pt-1.5 text-xs font-medium text-fg-subtle', className)} {...props} />
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div role="separator" className={cn('-mx-1 my-1 h-px bg-line', className)} />
}
