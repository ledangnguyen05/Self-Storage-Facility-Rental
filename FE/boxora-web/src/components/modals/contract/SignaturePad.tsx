import { forwardRef, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '../../ui'
import { readSignatureInk } from '../shared/signature'

export interface SignaturePadHandle {
  clear: () => void
  /** PNG data URL of the drawing, or null when nothing was drawn. */
  toDataUrl: () => string | null
}

interface SignaturePadProps {
  disabled?: boolean
  /** Fires when the pad goes from empty to drawn and back. */
  onInkChange?: (hasInk: boolean) => void
  className?: string
}

/** Resolution of the drawing surface. Pointer positions are scaled from CSS pixels to this grid. */
const CANVAS_WIDTH = 640
const CANVAS_HEIGHT = 200
const BASE_LINE_WIDTH = 2.5

/**
 * Freehand signature surface. Uses pointer events (mouse, touch and pen) and
 * maps client coordinates onto the canvas grid, so strokes land under the
 * pointer at any rendered size.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  { disabled = false, onInkChange, className },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  const setInk = (value: boolean) => {
    if (hasInk === value) return
    setHasInk(value)
    onInkChange?.(value)
  }

  useImperativeHandle(
    ref,
    () => ({
      clear() {
        const canvas = canvasRef.current
        canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
        setInk(false)
      },
      toDataUrl() {
        const canvas = canvasRef.current
        return canvas && hasInk ? canvas.toDataURL('image/png') : null
      },
    }),
    // setInk closes over hasInk; rebuilding the handle with it keeps both calls current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasInk, onInkChange],
  )

  const pointFrom = (event: ReactPointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1
    return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY, scale: scaleX }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || disabled || !event.isPrimary) return
    event.preventDefault()
    try {
      canvas.setPointerCapture(event.pointerId)
    } catch {
      // Capture is a nicety (strokes continue outside the canvas); drawing works without it.
    }
    drawingRef.current = true

    const { x, y, scale } = pointFrom(event, canvas)
    const ink = readSignatureInk()
    ctx.lineWidth = BASE_LINE_WIDTH * Math.max(1, scale)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = ink
    ctx.fillStyle = ink
    // A tap leaves a dot.
    ctx.beginPath()
    ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x, y)
    setInk(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const { x, y } = pointFrom(event, canvas)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false
    const canvas = canvasRef.current
    if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
  }

  return (
    <div className={cn('relative overflow-hidden rounded-lg border border-line-strong bg-surface', disabled && 'opacity-60', className)}>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        role="img"
        aria-label="Khung vẽ chữ ký. Dùng chuột, bút hoặc ngón tay để ký. Nếu không vẽ được, chuyển sang Ký theo tên."
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className="block aspect-16/5 w-full cursor-crosshair touch-none select-none"
      />
      {hasInk ? null : (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-fg-subtle">
          Ký vào khung này
        </div>
      )}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-line-strong" />
    </div>
  )
})
