import React, { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { cn } from './cn'
import { useFloatingPosition, type FloatingAlign, type FloatingSide } from './floating'
import { getFocusable, mergeRefs, useControllableOpen, useEscapeKey, useLayer, useOutsidePointerDown } from './overlay'
import { Portal } from './Portal'

export type TriggerElement = React.ReactElement<
  React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement>; disabled?: boolean }
>

export interface PopoverProps {
  /** A single focusable element, usually a Button or IconButton. It receives ref, onClick and aria attributes. */
  trigger: TriggerElement
  /** Content, or a render function that receives `close()`. */
  children: React.ReactNode | ((api: { close: () => void }) => React.ReactNode)
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  side?: FloatingSide
  align?: FloatingAlign
  /** Accessible name of the panel. */
  'aria-label'?: string
  /** Panel classes (width, padding). Default: `w-72 p-3`. */
  className?: string
}

/** Non-modal floating panel anchored to a trigger. Closes on outside click and Esc. */
export function Popover({
  trigger,
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  side = 'bottom',
  align = 'end',
  className,
  ...props
}: PopoverProps) {
  const [open, setOpen] = useControllableOpen(openProp, defaultOpen, onOpenChange)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)
  const panelId = useId()
  const layer = useLayer(open, false)
  const { style } = useFloatingPosition(anchor, panel, open, { side, align, offset: 6 })

  const close = useCallback(
    (restoreFocus = true) => {
      setOpen(false)
      if (restoreFocus) anchor?.focus({ preventScroll: true })
    },
    [anchor, setOpen],
  )

  useEscapeKey(open, layer, () => close(true))
  useOutsidePointerDown(open, [anchor, panel], () => close(false))

  useEffect(() => {
    if (open && panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true })
  }, [open, panel])

  // The panel lives in a portal at the end of <body>; tabbing past either end returns to the trigger.
  const onPanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !panel) return
    const items = getFocusable(panel)
    const active = document.activeElement
    const leavingForward = !event.shiftKey && (items.length === 0 || active === items[items.length - 1])
    const leavingBackward = event.shiftKey && (items.length === 0 || active === items[0] || active === panel)
    if (leavingForward || leavingBackward) {
      event.preventDefault()
      close(true)
    }
  }

  const triggerProps = trigger.props
  const triggerRef = useMemo(() => mergeRefs(triggerProps.ref, setAnchor), [triggerProps.ref])
  const triggerNode = React.cloneElement(trigger, {
    ref: triggerRef,
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      triggerProps.onClick?.(event)
      if (!event.defaultPrevented) setOpen(!open)
    },
    'aria-haspopup': 'dialog',
    'aria-expanded': open,
    'aria-controls': open ? panelId : undefined,
  })

  return (
    <>
      {triggerNode}
      {open ? (
        <Portal>
          <div
            ref={setPanel}
            id={panelId}
            role="dialog"
            aria-label={props['aria-label']}
            tabIndex={-1}
            data-slot="popover"
            style={style}
            onKeyDown={onPanelKeyDown}
            className={cn(
              'z-300 w-72 overflow-y-auto rounded-xl border border-line bg-overlay p-3 text-fg shadow-md outline-none animate-popover-in',
              className,
            )}
          >
            {typeof children === 'function' ? children({ close: () => close(true) }) : children}
          </div>
        </Portal>
      ) : null}
    </>
  )
}
