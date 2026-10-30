import React, { useEffect, useRef, useState } from 'react'

/**
 * Hero artwork rendered as a real video (alpha WebM), captured from the original BOXORA hero art
 * (sphere + orbits + flowing lines) so it keeps exactly the same look as the static page.
 *
 * Assets (public/assets/videos/):
 *   boxora-hero-orbit.webm        VP9 with alpha — overlays the live ambience background
 *   boxora-hero-orbit-poster.png  first frame, shown while loading / reduced motion
 *
 * Fallbacks: if the browser cannot decode VP9 alpha (e.g. Safari), the video errors,
 * or the user prefers reduced motion, `onFallback` tells the hero to render the original
 * CSS/SVG artwork instead (reduced motion → poster image only).
 */
export const HERO_ART_VIDEO = {
  webm: '/assets/videos/boxora-hero-orbit.webm',
  poster: '/assets/videos/boxora-hero-orbit-poster.png',
} as const

type Mode = 'video' | 'fallback'

const detectMode = (): Mode => {
  if (typeof document === 'undefined') return 'fallback'
  const canPlay = document.createElement('video').canPlayType('video/webm; codecs="vp9"')
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
  return canPlay && !saveData ? 'video' : 'fallback'
}

export const HeroArtVideo: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [mode, setMode] = useState<Mode>(detectMode)
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // pause when scrolled out of view
  useEffect(() => {
    const el = videoRef.current
    if (!el || mode !== 'video') return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.play().catch(() => undefined)
        else el.pause()
      },
      { threshold: 0.05 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [mode])

  const showVideo = mode === 'video' && !reduced
  const showPoster = mode === 'video' && reduced

  return (
    <>
      {/* Original CSS/SVG artwork: dark mode (video is rendered for the light theme), fallback, or before check */}
      <div className={showVideo || showPoster ? 'hidden dark:block' : ''}>{children}</div>

      {(showVideo || showPoster) && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-[1320/452] h-[179%] -translate-x-1/2 -translate-y-1/2 dark:hidden"
        >
          {showVideo ? (
            <video
              ref={videoRef}
              className="h-full w-full"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster={HERO_ART_VIDEO.poster}
              disablePictureInPicture
              disableRemotePlayback
              controls={false}
              tabIndex={-1}
              onError={() => setMode('fallback')}
            >
              <source src={HERO_ART_VIDEO.webm} type="video/webm" />
            </video>
          ) : (
            <img src={HERO_ART_VIDEO.poster} alt="" className="h-full w-full" decoding="async" />
          )}
        </div>
      )}
    </>
  )
}
