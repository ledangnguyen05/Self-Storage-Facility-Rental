import React, { useEffect, useRef } from 'react'

interface Node {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  alpha: number
  pulseSpeed: number
  pulseAngle: number
}

interface PulsePacket {
  fromNode: number
  toNode: number
  progress: number
  speed: number
}

export const HeroDynamicBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = 0
    let height = 0

    // Handle high-DPI displays
    const resize = () => {
      const rect = container.getBoundingClientRect()
      width = rect.width
      height = rect.height
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)
    }

    resize()
    window.addEventListener('resize', resize)

    // Palette inspired by Boxora IoT theme
    const nodeColors = [
      'rgba(8, 145, 178, ',   // cyan-600
      'rgba(6, 182, 212, ',   // cyan-500
      'rgba(14, 116, 144, ',  // cyan-700
      'rgba(59, 130, 246, ',  // blue-500
      'rgba(16, 185, 129, ',  // emerald-500
    ]

    const nodeCount = Math.max(24, Math.min(48, Math.floor(width / 32)))
    const nodes: Node[] = []

    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: Math.random() * 2 + 1.6,
        color: nodeColors[Math.floor(Math.random() * nodeColors.length)],
        alpha: Math.random() * 0.5 + 0.35,
        pulseSpeed: Math.random() * 0.03 + 0.015,
        pulseAngle: Math.random() * Math.PI * 2,
      })
    }

    // IoT network packet pulses along connected mesh lines
    const packets: PulsePacket[] = []
    const spawnPacket = () => {
      if (nodes.length < 2) return
      const a = Math.floor(Math.random() * nodes.length)
      let b = Math.floor(Math.random() * nodes.length)
      let attempts = 0
      while (b === a && attempts < 5) {
        b = Math.floor(Math.random() * nodes.length)
        attempts++
      }
      const dx = nodes[a].x - nodes[b].x
      const dy = nodes[a].y - nodes[b].y
      const dist = Math.hypot(dx, dy)
      if (dist < 160) {
        packets.push({
          fromNode: a,
          toNode: b,
          progress: 0,
          speed: 0.015 + Math.random() * 0.02,
        })
      }
    }

    const packetInterval = setInterval(() => {
      if (packets.length < 8) spawnPacket()
    }, 1200)

    // Interactive cursor reactivity
    const mouse = { x: -1000, y: -1000, active: false }
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
      mouse.active = true
    }
    const handleMouseLeave = () => {
      mouse.active = false
      mouse.x = -1000
      mouse.y = -1000
    }

    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)

    // Render loop
    let isVisible = true
    const handleVisibility = () => {
      isVisible = !document.hidden
    }
    document.addEventListener('visibilitychange', handleVisibility)

    const maxDistance = 150

    const render = () => {
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(render)
        return
      }

      ctx.clearRect(0, 0, width, height)

      // Update and draw connections
      for (let i = 0; i < nodes.length; i++) {
        const ni = nodes[i]

        // Move
        ni.x += ni.vx
        ni.y += ni.vy

        // Bounce at boundaries
        if (ni.x < 0) { ni.x = 0; ni.vx *= -1 }
        if (ni.x > width) { ni.x = width; ni.vx *= -1 }
        if (ni.y < 0) { ni.y = 0; ni.vy *= -1 }
        if (ni.y > height) { ni.y = height; ni.vy *= -1 }

        // Mouse gentle repulsion
        if (mouse.active) {
          const mdx = ni.x - mouse.x
          const mdy = ni.y - mouse.y
          const mDist = Math.hypot(mdx, mdy)
          if (mDist < 140 && mDist > 0) {
            const force = (140 - mDist) / 140 * 0.6
            ni.x += (mdx / mDist) * force
            ni.y += (mdy / mDist) * force
          }
        }

        // Draw connections to nearby nodes
        for (let j = i + 1; j < nodes.length; j++) {
          const nj = nodes[j]
          const dx = ni.x - nj.x
          const dy = ni.y - nj.y
          const dist = Math.hypot(dx, dy)

          if (dist < maxDistance) {
            const opacity = (1 - dist / maxDistance) * 0.22
            ctx.beginPath()
            ctx.moveTo(ni.x, ni.y)
            ctx.lineTo(nj.x, nj.y)
            ctx.strokeStyle = `rgba(8, 145, 178, ${opacity})`
            ctx.lineWidth = 1
            ctx.stroke()
          }
        }
      }

      // Draw connection to cursor if nearby
      if (mouse.active) {
        for (let i = 0; i < nodes.length; i++) {
          const ni = nodes[i]
          const mdx = ni.x - mouse.x
          const mdy = ni.y - mouse.y
          const mDist = Math.hypot(mdx, mdy)
          if (mDist < 130) {
            const opacity = (1 - mDist / 130) * 0.35
            ctx.beginPath()
            ctx.moveTo(ni.x, ni.y)
            ctx.lineTo(mouse.x, mouse.y)
            ctx.strokeStyle = `rgba(6, 182, 212, ${opacity})`
            ctx.lineWidth = 1.2
            ctx.stroke()
          }
        }
      }

      // Update and draw packet pulses
      for (let p = packets.length - 1; p >= 0; p--) {
        const pkt = packets[p]
        pkt.progress += pkt.speed
        if (pkt.progress >= 1) {
          packets.splice(p, 1)
          continue
        }
        const from = nodes[pkt.fromNode]
        const to = nodes[pkt.toNode]
        if (!from || !to) {
          packets.splice(p, 1)
          continue
        }
        const px = from.x + (to.x - from.x) * pkt.progress
        const py = from.y + (to.y - from.y) * pkt.progress

        // Packet bead glow
        ctx.beginPath()
        ctx.arc(px, py, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = '#38bdf8'
        ctx.shadowColor = '#06b6d4'
        ctx.shadowBlur = 8
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // Draw nodes
      for (let i = 0; i < nodes.length; i++) {
        const ni = nodes[i]
        ni.pulseAngle += ni.pulseSpeed
        const currentAlpha = ni.alpha + Math.sin(ni.pulseAngle) * 0.15

        // Outer glow
        ctx.beginPath()
        ctx.arc(ni.x, ni.y, ni.radius * 2.2, 0, Math.PI * 2)
        ctx.fillStyle = `${ni.color}${Math.max(0, currentAlpha * 0.18)})`
        ctx.fill()

        // Inner core
        ctx.beginPath()
        ctx.arc(ni.x, ni.y, ni.radius, 0, Math.PI * 2)
        ctx.fillStyle = `${ni.color}${Math.max(0, currentAlpha)})`
        ctx.fill()
      }

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationFrameId)
      clearInterval(packetInterval)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', handleVisibility)
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0"
      aria-hidden="true"
    >
      {/* 1. Fluid Aurora Glow Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[380px] bg-gradient-to-tr from-cyan-400/15 via-teal-400/15 to-sky-500/10 rounded-full blur-[100px] animate-aurora-1" />
      <div className="absolute top-1/3 left-1/4 w-[420px] h-[320px] bg-gradient-to-br from-teal-500/12 via-emerald-400/10 to-cyan-500/10 rounded-full blur-[90px] animate-aurora-2" />
      <div className="absolute top-1/2 right-1/4 w-[480px] h-[340px] bg-gradient-to-bl from-blue-500/10 via-indigo-500/10 to-cyan-400/10 rounded-full blur-[95px] animate-aurora-1" />

      {/* 2. Cybernetic Precision Isometric Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.45] mix-blend-multiply"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(8, 145, 178, 0.07) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(8, 145, 178, 0.07) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at 50% 40%, rgba(0,0,0,1) 15%, rgba(0,0,0,0) 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 40%, rgba(0,0,0,1) 15%, rgba(0,0,0,0) 80%)'
        }}
      />

      {/* 3. Central Radar Sonar Waves (referencing IoT Lock Telemetry) */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
        <div className="absolute w-72 h-72 rounded-full border border-cyan-400/25 animate-radar-ripple" />
        <div className="absolute w-72 h-72 rounded-full border border-teal-400/20 animate-radar-ripple [animation-delay:1.3s]" />
        <div className="absolute w-72 h-72 rounded-full border border-sky-400/15 animate-radar-ripple [animation-delay:2.6s]" />
      </div>

      {/* 4. Canvas for Dynamic Node Constellation & Circuit Pulses */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
      />

      {/* 5. 3D Isometric Wireframe Cube Accents (matching the new Logo) */}
      <div className="hidden xl:block absolute top-16 left-12 w-28 h-28 opacity-25 animate-float-slow">
        <svg viewBox="0 0 100 100" className="w-full h-full text-cyan-600 stroke-current fill-none" strokeWidth="1.2">
          {/* Top rhombus */}
          <polygon points="50,15 85,32 50,49 15,32" className="fill-cyan-50/40" />
          {/* Left face */}
          <polygon points="15,32 50,49 50,85 15,68" className="fill-cyan-100/30" />
          {/* Right face */}
          <polygon points="50,49 85,32 85,68 50,85" className="fill-cyan-200/20" />
          {/* Circuit nodes */}
          <circle cx="50" cy="49" r="2.5" className="fill-cyan-600" />
          <circle cx="85" cy="32" r="2" className="fill-cyan-500" />
          <circle cx="15" cy="32" r="2" className="fill-cyan-500" />
        </svg>
      </div>

      <div className="hidden xl:block absolute bottom-20 right-12 w-32 h-32 opacity-20 animate-float-delayed">
        <svg viewBox="0 0 100 100" className="w-full h-full text-teal-600 stroke-current fill-none" strokeWidth="1.2">
          <polygon points="50,15 85,32 50,49 15,32" className="fill-teal-50/40" />
          <polygon points="15,32 50,49 50,85 15,68" className="fill-teal-100/30" />
          <polygon points="50,49 85,32 85,68 50,85" className="fill-teal-200/20" />
          <circle cx="50" cy="49" r="2.5" className="fill-teal-600" />
        </svg>
      </div>

      {/* 6. Floating Glassmorphic IoT Status Badges */}
      {/* Badge Left: SmartLock Telemetry */}
      <div className="hidden lg:flex absolute top-28 left-8 xl:left-24 items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-cyan-200/80 shadow-sm animate-float-slow text-xs font-mono text-slate-800">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-semibold text-[11px] text-cyan-900">SL-9000 // IoT SmartLock ONLINE</span>
        <span className="text-[10px] text-slate-400 font-bold ml-1">98% PIN</span>
      </div>

      {/* Badge Right: Climate Controlled Telemetry */}
      <div className="hidden lg:flex absolute top-36 right-8 xl:right-24 items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-teal-200/80 shadow-sm animate-float-delayed text-xs font-mono text-slate-800">
        <span className="material-symbols-outlined text-teal-600 text-[16px]">thermostat</span>
        <span className="font-semibold text-[11px] text-slate-800">21.5°C // 45% RH Ổn Định</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-bold border border-teal-200">ISO</span>
      </div>

      {/* Badge Center-Left: Encrypted Security Badge */}
      <div className="hidden 2xl:flex absolute bottom-28 left-20 items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-slate-200 shadow-sm animate-float-fast text-xs font-mono text-slate-700">
        <span className="material-symbols-outlined text-cyan-600 text-[16px]">encrypted</span>
        <span className="text-[11px] font-semibold">AES-256 GCM Vault Protection</span>
      </div>
    </div>
  )
}
