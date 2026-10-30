import React, { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { OrbitCanvas } from './OrbitCanvas'

/**
 * HERO VISUAL — 3D orbit sphere.
 *
 * Asset contract (drop the rendered files into FE/boxora-web/public/assets/videos/):
 *   - boxora-orbit-sphere.webm   (preferred, VP9/AV1, ideally < 2.5 MB, 1080–1440 px square, 24–30 fps)
 *   - boxora-orbit-sphere.mp4    (H.264 fallback, same framing, +faststart)
 *   - boxora-orbit-sphere-poster.svg|jpg|webp (shown while loading / reduced motion)
 *
 * The video should be rendered on a WHITE background: it is blended with
 * `mix-blend-mode: multiply`, so white disappears into the page background
 * (a true alpha WebM works too). Until the files exist — or if loading fails —
 * a live canvas 3D orbit sphere (OrbitCanvas) is rendered instead. Nothing is faked:
 * the component reports which source is active via `data-source`.
 */
export const HERO_VIDEO = {
  webm: '/assets/videos/boxora-orbit-sphere.webm',
  mp4: '/assets/videos/boxora-orbit-sphere.mp4',
  poster: '/assets/videos/boxora-orbit-sphere-poster.svg',
} as const

type Source = 'pending' | 'video' | 'canvas' | 'poster'

export const HeroVisual: React.FC<{ className?: string }> = ({ className }) => {
  const reduce = useReducedMotion()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [source, setSource] = useState<Source>(reduce ? 'poster' : 'pending')
  const failedCount = useRef(0)

  // Save data / very slow connections: skip the video and use the canvas.
  useEffect(() => {
    if (reduce) {
      setSource('poster')
      return
    }
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (conn?.saveData) setSource('canvas')
  }, [reduce])

  // Pause the video when it is off-screen to save CPU/GPU.
  useEffect(() => {
    const el = videoRef.current
    if (!el || source === 'canvas' || source === 'poster') return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.play().catch(() => undefined)
        else el.pause()
      },
      { threshold: 0.05 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [source])

  const handleSourceError = () => {
    failedCount.current += 1
    if (failedCount.current >= 2) setSource('canvas')
  }

  const showVideo = source === 'pending' || source === 'video'

  return (
    <div className={className} data-source={source}>
      {/* Poster is always the base layer (instant paint, reduced-motion fallback) */}
      <img
        src={HERO_VIDEO.poster}
        alt=""
        aria-hidden="true"
        decoding="async"
        fetchPriority="high"
        className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-700 ${
          source === 'poster' || source === 'pending' ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {source === 'canvas' && <OrbitCanvas className="absolute inset-0 h-full w-full" />}

      {showVideo && (
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-contain mix-blend-multiply dark:mix-blend-screen transition-opacity duration-700 ${
            source === 'video' ? 'opacity-100' : 'opacity-0'
          }`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={HERO_VIDEO.poster}
          disablePictureInPicture
          disableRemotePlayback
          controls={false}
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setSource('video')}
          onError={() => setSource('canvas')}
        >
          <source src={HERO_VIDEO.webm} type="video/webm" onError={handleSourceError} />
          <source src={HERO_VIDEO.mp4} type="video/mp4" onError={handleSourceError} />
        </video>
      )}
    </div>
  )
}

