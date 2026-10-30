import React, { useEffect, useRef } from 'react'

/**
 * Live 3D orbit sphere (canvas 2D with real 3D projection).
 * Used as the hero visual when the BOXORA orbit video asset is not available
 * (missing file, load error, slow network) — see HeroVisual.tsx.
 *
 * Performance: single rAF loop, paused when off-screen / tab hidden,
 * DPR capped at 2, no allocations inside the frame loop except Path2D.
 */

type Vec = [number, number, number]

interface Ring {
  r: number
  tiltX: number
  tiltZ: number
  speed: number
  color: string
  comet: string
}

const RINGS: Ring[] = [
  { r: 1.42, tiltX: 72, tiltZ: -18, speed: 0.34, color: '14,165,233', comet: '125,211,252' },
  { r: 1.68, tiltX: 58, tiltZ: 34, speed: -0.24, color: '34,211,238', comet: '165,243,252' },
  { r: 1.98, tiltX: 80, tiltZ: -52, speed: 0.16, color: '45,212,191', comet: '153,246,228' },
  { r: 1.55, tiltX: 24, tiltZ: 64, speed: 0.42, color: '59,130,246', comet: '147,197,253' },
  { r: 2.32, tiltX: 66, tiltZ: 8, speed: -0.1, color: '56,189,248', comet: '186,230,253' },
]

const SEGMENTS = 120
const PARTICLES = 80
const DEG = Math.PI / 180

const rotX = (v: Vec, a: number): Vec => {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]
}
const rotY = (v: Vec, a: number): Vec => {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]
}
const rotZ = (v: Vec, a: number): Vec => {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]
}

export const OrbitCanvas: React.FC<{ className?: string }> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    let dpr = 1
    let raf = 0
    let running = false
    let visible = true
    let last = performance.now()
    let time = 0
    let mx = 0
    let my = 0
    let tmx = 0
    let tmy = 0

    const particles = Array.from({ length: PARTICLES }, (_, i) => ({
      ring: i % RINGS.length,
      a: Math.random() * Math.PI * 2,
      sp: (0.25 + Math.random() * 0.9) * (Math.random() > 0.5 ? 1 : -1),
      off: (Math.random() - 0.5) * 0.16,
      size: 0.8 + Math.random() * 1.8,
      mint: Math.random() > 0.45,
    }))

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = Math.max(1, Math.round(rect.width))
      h = Math.max(1, Math.round(rect.height))
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const project = (p: Vec, cx: number, cy: number, S: number): [number, number, number] => {
      const f = 5
      const k = f / (f - p[2])
      return [cx + p[0] * S * k, cy + p[1] * S * k, p[2]]
    }

    const ringPoint = (ring: Ring, a: number, off: number, gy: number, tilt: number): Vec => {
      let v: Vec = [Math.cos(a) * (ring.r + off), 0, Math.sin(a) * (ring.r + off)]
      v = rotX(v, ring.tiltX * DEG)
      v = rotZ(v, ring.tiltZ * DEG)
      v = rotY(v, gy)
      v = rotX(v, tilt)
      return v
    }

    const frame = (now: number) => {
      if (!running) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      time += dt
      mx += (tmx - mx) * 0.04
      my += (tmy - my) * 0.04

      ctx.clearRect(0, 0, w, h)
      const cx = w * 0.5
      const cy = h * 0.5
      const S = Math.min(w, h) * 0.2
      const R = S
      const gy = time * 0.09 + mx * 0.5
      const tilt = -0.18 + my * 0.25

      // ---- rings: back half, then sphere, then front half
      const backPaths: Path2D[] = []
      const frontPaths: Path2D[] = []
      for (let ri = 0; ri < RINGS.length; ri++) {
        const ring = RINGS[ri]
        const back = new Path2D()
        const front = new Path2D()
        let prev = project(ringPoint(ring, 0, 0, gy, tilt), cx, cy, S)
        for (let i = 1; i <= SEGMENTS; i++) {
          const a = (i / SEGMENTS) * Math.PI * 2
          const cur = project(ringPoint(ring, a, 0, gy, tilt), cx, cy, S)
          const target = (prev[2] + cur[2]) / 2 < 0 ? back : front
          target.moveTo(prev[0], prev[1])
          target.lineTo(cur[0], cur[1])
          prev = cur
        }
        backPaths.push(back)
        frontPaths.push(front)
      }

      ctx.lineCap = 'round'
      for (let ri = 0; ri < RINGS.length; ri++) {
        ctx.strokeStyle = `rgba(${RINGS[ri].color},0.2)`
        ctx.lineWidth = 1.2
        ctx.stroke(backPaths[ri])
      }

      // comets + particles behind sphere
      const drawComets = (front: boolean) => {
        for (let ri = 0; ri < RINGS.length; ri++) {
          const ring = RINGS[ri]
          const head = time * ring.speed * 1.6 + ri * 1.7
          const dir = ring.speed > 0 ? 1 : -1
          const TAIL = 26
          let prev = project(ringPoint(ring, head, 0, gy, tilt), cx, cy, S)
          for (let i = 1; i <= TAIL; i++) {
            const a = head - dir * i * 0.045
            const cur = project(ringPoint(ring, a, 0, gy, tilt), cx, cy, S)
            const isFront = (prev[2] + cur[2]) / 2 >= 0
            if (isFront === front) {
              const k = 1 - i / TAIL
              ctx.strokeStyle = `rgba(${ring.comet},${0.85 * k})`
              ctx.lineWidth = 0.8 + 2.4 * k
              ctx.beginPath()
              ctx.moveTo(prev[0], prev[1])
              ctx.lineTo(cur[0], cur[1])
              ctx.stroke()
            }
            prev = cur
          }
        }
      }

      const drawParticles = (front: boolean) => {
        for (const p of particles) {
          const ring = RINGS[p.ring]
          const a = p.a + time * ring.speed * p.sp
          const v = ringPoint(ring, a, p.off, gy, tilt)
          const isFront = v[2] >= 0
          if (isFront !== front) continue
          const [x, y] = project(v, cx, cy, S)
          const depth = 0.45 + 0.55 * ((v[2] + 2.4) / 4.8)
          ctx.fillStyle = p.mint
            ? `rgba(45,212,191,${0.85 * depth})`
            : `rgba(14,165,233,${0.85 * depth})`
          ctx.beginPath()
          ctx.arc(x, y, p.size * (0.7 + depth * 0.6), 0, Math.PI * 2)
          ctx.fill()
        }
      }

      drawComets(false)
      drawParticles(false)

      // ---- sphere
      ctx.save()
      const g = ctx.createRadialGradient(cx - R * 0.34, cy - R * 0.4, R * 0.08, cx, cy, R * 1.05)
      g.addColorStop(0, '#ffffff')
      g.addColorStop(0.32, '#dcf5ff')
      g.addColorStop(0.68, '#7cc8f5')
      g.addColorStop(1, '#2b7de0')
      ctx.shadowColor = 'rgba(14,116,200,0.28)'
      ctx.shadowBlur = R * 0.55
      ctx.shadowOffsetY = R * 0.22
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.clip()
      // mint reflection (bottom right)
      const mint = ctx.createRadialGradient(cx + R * 0.55, cy + R * 0.6, 0, cx + R * 0.55, cy + R * 0.6, R * 0.95)
      mint.addColorStop(0, 'rgba(45,212,191,0.6)')
      mint.addColorStop(1, 'rgba(45,212,191,0)')
      ctx.fillStyle = mint
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2)
      // cyan rim (top left)
      const cyan = ctx.createRadialGradient(cx - R * 0.6, cy - R * 0.55, 0, cx - R * 0.6, cy - R * 0.55, R * 0.8)
      cyan.addColorStop(0, 'rgba(255,255,255,0.75)')
      cyan.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = cyan
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2)

      // meridians + parallels rotating with the sphere
      ctx.strokeStyle = 'rgba(255,255,255,0.42)'
      ctx.lineWidth = 1
      const spin = time * 0.22
      for (let i = 0; i < 8; i++) {
        const phi = spin + (i / 8) * Math.PI
        const rx = Math.abs(Math.cos(phi)) * R
        ctx.beginPath()
        ctx.ellipse(cx, cy, Math.max(rx, 0.5), R, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
      for (let i = -3; i <= 3; i++) {
        const lat = (i / 4) * (Math.PI / 2)
        const rr = Math.cos(lat) * R
        const yy = cy + Math.sin(lat) * R
        ctx.beginPath()
        ctx.ellipse(cx, yy, rr, rr * 0.2, 0, 0, Math.PI)
        ctx.stroke()
      }
      ctx.restore()

      // ---- front half
      drawComets(true)
      drawParticles(true)
      for (let ri = 0; ri < RINGS.length; ri++) {
        ctx.strokeStyle = `rgba(${RINGS[ri].color},0.75)`
        ctx.lineWidth = 1.6
        ctx.stroke(frontPaths[ri])
      }

      raf = requestAnimationFrame(frame)
    }

    const start = () => {
      if (running || !visible || document.hidden) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        if (visible) start()
        else stop()
      },
      { threshold: 0.01 }
    )
    io.observe(canvas)
    const onVis = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVis)

    const finePointer = window.matchMedia('(pointer: fine)').matches
    const onMove = (e: PointerEvent) => {
      tmx = (e.clientX / window.innerWidth - 0.5) * 2
      tmy = (e.clientY / window.innerHeight - 0.5) * 2
    }
    if (finePointer) window.addEventListener('pointermove', onMove, { passive: true })

    start()
    return () => {
      stop()
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}

