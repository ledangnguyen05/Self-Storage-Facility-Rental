import type React from 'react'
import { useCallback, useLayoutEffect, useState } from 'react'

export type FloatingSide = 'top' | 'bottom' | 'left' | 'right'
export type FloatingAlign = 'start' | 'center' | 'end'

interface FloatingOptions {
  side?: FloatingSide
  align?: FloatingAlign
  offset?: number
  /** Make the floating element at least as wide as the anchor. */
  matchWidth?: boolean
}

const VIEWPORT_PADDING = 8

const hiddenStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, visibility: 'hidden' }

/**
 * Positions a portaled element (`position: fixed`) next to an anchor, flipping
 * to the opposite side when there is no room and clamping inside the viewport.
 * Tracks scroll, resize and size changes of both elements.
 */
export function useFloatingPosition(
  anchor: HTMLElement | null,
  floating: HTMLElement | null,
  open: boolean,
  { side = 'bottom', align = 'start', offset = 6, matchWidth = false }: FloatingOptions = {},
) {
  const [style, setStyle] = useState<React.CSSProperties>(hiddenStyle)
  const [placement, setPlacement] = useState<FloatingSide>(side)

  const update = useCallback(() => {
    if (!anchor || !floating) return
    const a = anchor.getBoundingClientRect()
    const viewportWidth = document.documentElement.clientWidth
    const viewportHeight = window.innerHeight
    const width = floating.offsetWidth
    const height = floating.offsetHeight
    const pad = VIEWPORT_PADDING

    let resolved: FloatingSide = side
    const spaceBelow = viewportHeight - a.bottom - offset - pad
    const spaceAbove = a.top - offset - pad
    const spaceRight = viewportWidth - a.right - offset - pad
    const spaceLeft = a.left - offset - pad
    if (side === 'bottom' && height > spaceBelow && spaceAbove > spaceBelow) resolved = 'top'
    if (side === 'top' && height > spaceAbove && spaceBelow > spaceAbove) resolved = 'bottom'
    if (side === 'right' && width > spaceRight && spaceLeft > spaceRight) resolved = 'left'
    if (side === 'left' && width > spaceLeft && spaceRight > spaceLeft) resolved = 'right'

    const vertical = resolved === 'top' || resolved === 'bottom'
    let top: number
    let left: number
    let maxHeight: number | undefined

    if (vertical) {
      maxHeight = Math.max(120, resolved === 'bottom' ? spaceBelow : spaceAbove)
      const effectiveHeight = Math.min(height, maxHeight)
      top = resolved === 'bottom' ? a.bottom + offset : a.top - offset - effectiveHeight
      left = align === 'start' ? a.left : align === 'end' ? a.right - width : a.left + a.width / 2 - width / 2
    } else {
      left = resolved === 'right' ? a.right + offset : a.left - offset - width
      top = align === 'start' ? a.top : align === 'end' ? a.bottom - height : a.top + a.height / 2 - height / 2
    }

    left = Math.min(Math.max(pad, left), Math.max(pad, viewportWidth - width - pad))
    if (!vertical) top = Math.min(Math.max(pad, top), Math.max(pad, viewportHeight - height - pad))

    const originY = resolved === 'top' ? 'bottom' : resolved === 'bottom' ? 'top' : 'center'
    const originX = resolved === 'left' ? 'right' : resolved === 'right' ? 'left' : align === 'end' ? 'right' : align === 'center' ? 'center' : 'left'

    setPlacement(resolved)
    setStyle({
      position: 'fixed',
      top: Math.round(top),
      left: Math.round(left),
      maxWidth: viewportWidth - pad * 2,
      maxHeight,
      minWidth: matchWidth ? a.width : undefined,
      transformOrigin: `${originY} ${originX}`,
    })
  }, [anchor, floating, side, align, offset, matchWidth])

  useLayoutEffect(() => {
    if (!open) return
    // Measuring the DOM and positioning before paint is what layout effects are for.
    // eslint-disable-next-line react/set-state-in-effect
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => update()) : null
    if (anchor) observer?.observe(anchor)
    if (floating) observer?.observe(floating)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      observer?.disconnect()
    }
  }, [open, update, anchor, floating])

  return { style: open ? style : hiddenStyle, placement }
}
