import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

/* --------------------------------------------------------------------------
 * Internal overlay plumbing shared by Modal, Drawer, ConfirmDialog, Popover,
 * DropdownMenu and Tooltip. Not part of the public barrel.
 * ------------------------------------------------------------------------ */

/** Keeps a ref pointing at the latest value without re-running effects. */
export function useLatest<T>(value: T) {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}

/* ---------- Layer stack: only the top-most layer reacts to Esc / Tab ---------- */

interface Layer {
  id: number
  modal: boolean
}

const layers: Layer[] = []
let nextLayerId = 1

export interface LayerHandle {
  isTop: () => boolean
  isTopModal: () => boolean
}

export function useLayer(active: boolean, modal: boolean): LayerHandle {
  const idRef = useRef(0)

  useEffect(() => {
    if (!active) return
    const id = nextLayerId++
    idRef.current = id
    layers.push({ id, modal })
    return () => {
      const index = layers.findIndex(layer => layer.id === id)
      if (index >= 0) layers.splice(index, 1)
      idRef.current = 0
    }
  }, [active, modal])

  return useMemo<LayerHandle>(
    () => ({
      isTop: () => idRef.current !== 0 && layers[layers.length - 1]?.id === idRef.current,
      isTopModal: () => {
        for (let i = layers.length - 1; i >= 0; i -= 1) {
          if (layers[i].modal) return layers[i].id === idRef.current
        }
        return false
      },
    }),
    [],
  )
}

export function useEscapeKey(active: boolean, layer: LayerHandle, onEscape: () => void) {
  const handlerRef = useLatest(onEscape)

  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || !layer.isTop()) return
      event.preventDefault()
      handlerRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, layer, handlerRef])
}

/* ---------- Body scroll lock (nesting-safe) ---------- */

let scrollLockCount = 0
let savedBodyStyle: { overflow: string; paddingRight: string } | null = null

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return
    const body = document.body
    if (scrollLockCount === 0) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      savedBodyStyle = { overflow: body.style.overflow, paddingRight: body.style.paddingRight }
      body.style.overflow = 'hidden'
      if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`
    }
    scrollLockCount += 1
    return () => {
      scrollLockCount = Math.max(0, scrollLockCount - 1)
      if (scrollLockCount === 0 && savedBodyStyle) {
        body.style.overflow = savedBodyStyle.overflow
        body.style.paddingRight = savedBodyStyle.paddingRight
        savedBodyStyle = null
      }
    }
  }, [active])
}

/* ---------- Focus management ---------- */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',')

export function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    element => element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length > 0,
  )
}

const FIELD_SELECTOR =
  '[data-autofocus], input:not([disabled]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea:not([disabled]), select:not([disabled])'

interface FocusTrapOptions {
  layer: LayerHandle
  initialFocusRef?: React.RefObject<HTMLElement | null>
  restoreFocus?: boolean
}

/**
 * Moves focus into the container when it opens (explicit target, then the first
 * form field, then the container itself), keeps Tab inside while it is the top
 * modal layer, and gives focus back to the trigger when it closes.
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean,
  { layer, initialFocusRef, restoreFocus = true }: FocusTrapOptions,
) {
  useEffect(() => {
    if (!active) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const frame = window.requestAnimationFrame(() => {
      const container = containerRef.current
      if (!container || container.contains(document.activeElement)) return
      const target =
        initialFocusRef?.current ??
        container.querySelector<HTMLElement>(FIELD_SELECTOR) ??
        container
      target.focus({ preventScroll: true })
    })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.defaultPrevented || !layer.isTopModal()) return
      const container = containerRef.current
      if (!container) return
      const items = getFocusable(container)
      if (items.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement
      const outside = !container.contains(current)
      if (event.shiftKey && (current === first || current === container || outside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (current === last || outside)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      if (restoreFocus && previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true })
      }
    }
  }, [active, layer, restoreFocus, containerRef, initialFocusRef])
}

/* ---------- Outside pointer detection for non-modal floating layers ---------- */

export function useOutsidePointerDown(
  active: boolean,
  elements: Array<HTMLElement | null>,
  onOutside: () => void,
) {
  const handlerRef = useLatest(onOutside)
  const elementsRef = useLatest(elements)

  useEffect(() => {
    if (!active) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (elementsRef.current.some(element => element?.contains(target))) return
      handlerRef.current()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [active, handlerRef, elementsRef])
}

/* ---------- Controlled / uncontrolled open state ---------- */

export function useControllableOpen(
  open: boolean | undefined,
  defaultOpen: boolean,
  onOpenChange?: (open: boolean) => void,
): [boolean, (next: boolean) => void] {
  const [internal, setInternal] = useState(defaultOpen)
  const isControlled = open !== undefined
  const value = isControlled ? open : internal
  const setValue = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternal(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )
  return [value, setValue]
}

/** Merge several refs (object or callback) into one callback ref. */
export function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>): React.RefCallback<T> {
  return (value: T | null) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(value)
      else if (ref && typeof ref === 'object') (ref as React.MutableRefObject<T | null>).current = value
    }
  }
}

/* ---------- Everything a modal surface needs (Modal, Drawer, ConfirmDialog) ---------- */

interface ModalBehaviorOptions {
  open: boolean
  onClose: () => void
  /** When false, Esc and outside clicks do nothing (e.g. while a request is running). */
  dismissible: boolean
  panelRef: React.RefObject<HTMLElement | null>
  initialFocusRef?: React.RefObject<HTMLElement | null>
}

export function useModalBehavior({ open, onClose, dismissible, panelRef, initialFocusRef }: ModalBehaviorOptions) {
  const layer = useLayer(open, true)
  useScrollLock(open)
  useFocusTrap(panelRef, open, { layer, initialFocusRef })
  useEscapeKey(open, layer, () => {
    if (dismissible) onClose()
  })

  // Close on a click that both starts and ends on the backdrop (not a text-selection drag).
  const pressedOnBackdrop = useRef(false)
  const backdropProps = {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      pressedOnBackdrop.current = event.target === event.currentTarget
    },
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      if (dismissible && pressedOnBackdrop.current && event.target === event.currentTarget) onClose()
      pressedOnBackdrop.current = false
    },
  }

  return { backdropProps }
}
