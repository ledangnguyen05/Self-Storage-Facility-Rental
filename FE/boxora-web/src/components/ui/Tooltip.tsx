import React, { useEffect, useId, useRef, useState } from 'react'
import { cn } from './cn'
import { useFloatingPosition, type FloatingAlign, type FloatingSide } from './floating'
import { Portal } from './Portal'

export interface TooltipProps {
  content: React.ReactNode
  /** A single focusable element (usually an IconButton). */
  children: React.ReactElement
  side?: FloatingSide
  align?: FloatingAlign
  /** Hover delay in ms. Keyboard focus shows the tooltip immediately. */
  delay?: number
  disabled?: boolean
  /** Classes for the inline wrapper around the trigger. */
  className?: string
}

/** Small hover/focus label for icon-only controls. Not for rich content. */
export function Tooltip({ content, children, side = 'top', align = 'center', delay = 300, disabled = false, className }: TooltipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null)
  const [floating, setFloating] = useState<HTMLDivElement | null>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const visible = open && !disabled && content !== null && content !== undefined && content !== ''
  const { style } = useFloatingPosition(anchor, floating, visible, { side, align, offset: 6 })

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  useEffect(() => {
    if (!visible) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [visible])

  const show = (immediate = false) => {
    window.clearTimeout(timerRef.current)
    if (immediate) setOpen(true)
    else timerRef.current = window.setTimeout(() => setOpen(true), delay)
  }
  const hide = () => {
    window.clearTimeout(timerRef.current)
    setOpen(false)
  }

  // Skip aria-describedby when the tooltip only repeats the trigger's accessible name.
  const trigger = React.isValidElement<{ 'aria-describedby'?: string; 'aria-label'?: string }>(children)
    ? visible && children.props['aria-label'] !== content
      ? React.cloneElement(children, {
          'aria-describedby': [children.props['aria-describedby'], id].filter(Boolean).join(' '),
        })
      : children
    : children

  return (
    <>
      <span
        ref={setAnchor}
        className={cn('inline-flex', className)}
        onPointerEnter={event => {
          if (event.pointerType === 'mouse') show()
        }}
        onPointerLeave={hide}
        onPointerDown={hide}
        onFocus={event => {
          if (event.target instanceof HTMLElement && event.target.matches(':focus-visible')) show(true)
        }}
        onBlur={hide}
      >
        {trigger}
      </span>
      {visible ? (
        <Portal>
          <div
            ref={setFloating}
            id={id}
            role="tooltip"
            style={style}
            className="pointer-events-none z-300 max-w-xs rounded-md bg-neutral-solid px-2 py-1 text-xs font-medium text-on-accent shadow-md animate-popover-in"
          >
            {content}
          </div>
        </Portal>
      ) : null}
    </>
  )
}
