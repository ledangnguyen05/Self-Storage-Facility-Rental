import React, { useEffect, useRef } from 'react'
import { ArrowDown, ArrowRight } from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface SmartLockerDynamicHeroProps {
  onBookNow: () => void
}

export const SmartLockerDynamicHero: React.FC<SmartLockerDynamicHeroProps> = ({ onBookNow }) => {
  const sectionRef = useRef<HTMLElement | null>(null)
  const cursorGlowRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const section = sectionRef.current
    const cursorGlow = cursorGlowRef.current
    if (!section || !cursorGlow) return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const context = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set('[data-hero-copy]', { autoAlpha: 1, y: 0 })
        return
      }

      gsap.from('[data-hero-copy]', { autoAlpha: 0, y: 18, duration: 0.75, stagger: 0.08, ease: 'power3.out', delay: 0.05 })
      gsap.to('[data-bg-cloud="a"]', {
        x: 34,
        y: -18,
        scale: 1.08,
        duration: 14,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      })
      gsap.to('[data-bg-cloud="b"]', {
        x: -28,
        y: 22,
        scale: 1.1,
        duration: 18,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      })
      gsap.to('[data-bg-ribbon]', {
        x: 28,
        scaleX: 1.06,
        duration: 16,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      })
      gsap.to('[data-bg-orbit]', {
        rotate: -360,
        duration: 100,
        ease: 'none',
        repeat: -1,
      })
      gsap.to('[data-bg-orbit-inner]', {
        rotate: 360,
        duration: 75,
        ease: 'none',
        repeat: -1,
      })
      gsap.to('[data-art-orbit]', {
        rotate: 360,
        duration: 90,
        ease: 'none',
        repeat: -1,
      })
      gsap.to('[data-art-core]', {
        scale: 1.06,
        duration: 7,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      })
      gsap.to('[data-core-glow]', {
        scale: 1.08,
        duration: 10,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      })
      gsap.to('[data-art-flow]', {
        strokeDashoffset: -42,
        duration: 4.5,
        ease: 'none',
        repeat: -1,
      })
      gsap.to('[data-art-node]', {
        opacity: 0.3,
        duration: 1.6,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        stagger: 0.45,
      })

      const scrollTransition = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom top',
          scrub: 0.8,
          invalidateOnRefresh: true,
        },
      })

      scrollTransition
        .to('[data-scroll-ambience]', { yPercent: -7, scale: 1.1, opacity: 0.8, ease: 'none' }, 0)
        .to('[data-scroll-copy]', { y: -34, autoAlpha: 0.82, ease: 'none' }, 0)
    }, section)

    const moveGlowX = gsap.quickTo(cursorGlow, 'x', { duration: 0.7, ease: 'power3.out' })
    const moveGlowY = gsap.quickTo(cursorGlow, 'y', { duration: 0.7, ease: 'power3.out' })

    const handlePointerMove = (event: PointerEvent) => {
      const rect = section.getBoundingClientRect()
      gsap.to(cursorGlow, { opacity: 1, duration: 0.35, overwrite: true })
      moveGlowX(event.clientX - rect.left - 240)
      moveGlowY(event.clientY - rect.top - 240)
    }

    const handlePointerLeave = () => {
      gsap.to(cursorGlow, { opacity: 0, duration: 0.5, overwrite: true })
      moveGlowX(section.clientWidth * 0.5 - 240)
      moveGlowY(section.clientHeight * 0.68 - 240)
    }

    if (!prefersReducedMotion) {
      section.addEventListener('pointermove', handlePointerMove)
      section.addEventListener('pointerleave', handlePointerLeave)
    }

    return () => {
      section.removeEventListener('pointermove', handlePointerMove)
      section.removeEventListener('pointerleave', handlePointerLeave)
      gsap.killTweensOf(cursorGlow)
      context.revert()
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      aria-labelledby="boxora-hero-title"
      className="relative isolate min-h-[calc(100svh_-_64px)] overflow-hidden bg-[#f7faff] text-[#101827]"
    >
      {/* A custom, image-free IoT light field: soft color, orbital geometry and contour lines. */}
      <div data-scroll-ambience aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[linear-gradient(180deg,#f7faff_0%,#f2f8ff_38%,#f1fff8_100%)]">
        <div data-bg-cloud="a" className="absolute -left-[19%] top-[12%] h-[430px] w-[660px] rounded-full bg-[radial-gradient(ellipse,rgba(8,102,245,.28)_0%,rgba(0,191,216,.2)_42%,transparent_73%)] blur-[42px] sm:h-[620px] sm:w-[900px]" />
        <div data-bg-cloud="b" className="absolute -right-[21%] top-[22%] h-[460px] w-[700px] rounded-full bg-[radial-gradient(ellipse,rgba(0,191,216,.3)_0%,rgba(123,227,63,.16)_43%,transparent_73%)] blur-[48px] sm:h-[650px] sm:w-[980px]" />
        <div data-bg-ribbon className="absolute left-[8%] top-[54%] h-[270px] w-[84%] rounded-[50%] bg-[linear-gradient(90deg,transparent,rgba(0,191,216,.25),rgba(8,102,245,.22),rgba(123,227,63,.14),transparent)] blur-[54px] sm:top-[50%] sm:h-[360px]" />
        <div data-core-glow className="absolute left-1/2 top-[65%] h-[390px] w-[min(96vw,1020px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(0,191,216,.22)_0%,rgba(8,102,245,.14)_38%,rgba(123,227,63,.12)_54%,transparent_72%)] blur-[30px]" />

        <div data-bg-orbit className="absolute left-1/2 top-[64%] aspect-[2.3/1] w-[min(105vw,1380px)] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-blue-700/[0.14]" />
        <div data-bg-orbit-inner className="absolute left-1/2 top-[64%] aspect-[2.05/1] w-[min(92vw,1180px)] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-cyan-700/[0.15]" />

        <div className="absolute bottom-0 left-0 right-0 h-[52%] opacity-[0.34] [background-image:radial-gradient(rgba(8,102,245,.3)_0.8px,transparent_0.8px)] [background-position:center] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_50%_100%,black_5%,transparent_72%)]" />
        <svg className="absolute inset-x-0 bottom-0 h-[50%] w-full opacity-[0.42]" viewBox="0 0 1440 380" fill="none" preserveAspectRatio="none">
          <path d="M-60 267C161 155 266 355 500 250S819 131 1015 226s313 94 488-7" stroke="#0866F5" strokeOpacity=".34" />
          <path d="M-80 301C140 189 278 385 513 281s326-117 520-21 322 90 490-9" stroke="#00AFCB" strokeOpacity=".32" />
          <path d="M-40 331C189 225 301 411 544 310s329-106 522-14 299 78 434-6" stroke="#32B995" strokeOpacity=".3" />
          <path d="M-30 352C185 267 342 429 558 342s337-98 522-17 273 66 410-4" stroke="#7BE33F" strokeOpacity=".25" />
        </svg>
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#f1fff8]" />
      </div>

      <div
        ref={cursorGlowRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-[1] h-[480px] w-[480px] rounded-full opacity-0 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(8,102,245,.26), rgba(0,191,216,.26) 38%, rgba(123,227,63,.14) 58%, transparent 72%)', mixBlendMode: 'screen' }}
      />

      <div data-scroll-copy className="relative z-10 mx-auto flex min-h-[calc(100svh_-_64px)] max-w-[1440px] flex-col items-center px-5 pb-3 pt-[clamp(1.25rem,5svh,4rem)] text-center sm:px-8 sm:pb-4 sm:pt-[clamp(1.75rem,6svh,4.5rem)] lg:px-12 lg:pt-[clamp(1.5rem,5svh,3.75rem)]">

        <h1 data-hero-copy id="boxora-hero-title" className="max-w-6xl text-[clamp(2.2rem,min(7.4vw,10svh),6.4rem)] font-semibold leading-[0.96] tracking-[-0.045em] text-slate-950">
          Không gian lưu trữ linh hoạt
          <img
            src="/logo.png"
            alt="Boxora"
            className="mx-auto mt-1 block h-[clamp(7rem,18svh,11rem)] w-auto object-contain drop-shadow-[0_10px_24px_rgba(8,102,245,.12)]"
          />
        </h1>

        <p data-hero-copy className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-6 text-slate-700 sm:mt-5 sm:text-base sm:leading-7 lg:text-lg">
          Chọn diện tích phù hợp <span className="mx-1 text-cyan-600">•</span> Vào kho 24/7 bằng mã PIN
        </p>

        <div data-hero-copy className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:mt-6">
          <button
            type="button"
            onClick={onBookNow}
            className="group inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <span>Đặt kho ngay</span>
            <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
          </button>
          <a
            href="#services"
            className="inline-flex min-h-12 items-center rounded-full border border-blue-200 bg-white/75 px-6 py-3 text-sm font-semibold text-blue-900 transition-colors hover:border-cyan-500 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            Khám phá dịch vụ
          </a>
        </div>

        <div data-hero-copy role="img" aria-label="Minh họa trừu tượng về mạng lưới kết nối Boxora" className="relative mt-4 h-[clamp(118px,22svh,190px)] w-full max-w-[1320px] sm:mt-5 sm:h-[clamp(145px,25svh,250px)] lg:mt-3 lg:h-[clamp(165px,28svh,290px)]">
          <div data-art-core className="absolute left-1/2 top-[47%] h-[clamp(118px,22svh,190px)] w-[clamp(118px,22svh,190px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_34%_28%,#ffffff_0%,#e4f5ff_12%,rgba(0,191,216,.84)_31%,rgba(8,102,245,.6)_51%,rgba(123,227,63,.3)_69%,transparent_76%)] shadow-[0_0_110px_rgba(8,102,245,.25)] sm:h-[clamp(145px,25svh,245px)] sm:w-[clamp(145px,25svh,245px)] lg:h-[clamp(165px,28svh,275px)] lg:w-[clamp(165px,28svh,275px)]" />
          <div data-art-orbit className="absolute left-1/2 top-[47%] h-[clamp(108px,20svh,175px)] w-[min(82vw,650px)] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-blue-700/25 shadow-[0_0_30px_rgba(8,102,245,.1)] sm:h-[clamp(135px,23svh,205px)] lg:h-[clamp(150px,24svh,230px)]">
            <span className="absolute left-[16%] top-[18%] h-2.5 w-2.5 rounded-full bg-blue-600 shadow-[0_0_18px_rgba(8,102,245,.62)]" />
            <span className="absolute right-[14%] bottom-[18%] h-2 w-2 rounded-full bg-lime-500 shadow-[0_0_18px_rgba(123,227,63,.6)]" />
          </div>
          <div className="absolute left-1/2 top-[47%] h-[clamp(82px,15svh,132px)] w-[min(68vw,500px)] -translate-x-1/2 -translate-y-1/2 rotate-[16deg] rounded-[50%] border border-cyan-700/20 shadow-[0_0_24px_rgba(8,145,178,.08)] sm:h-[clamp(105px,17svh,160px)] lg:h-[clamp(120px,18svh,185px)]" />

          <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 1440 400" fill="none" preserveAspectRatio="xMidYMid meet">
            <defs>
              <radialGradient id="boxora-core" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(720 180) rotate(90) scale(155)">
                <stop stopColor="#F9FFFE" />
                <stop offset=".28" stopColor="#BEEBFF" stopOpacity=".88" />
                <stop offset=".58" stopColor="#00BFD8" stopOpacity=".54" />
                <stop offset="1" stopColor="#7BE33F" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="boxora-line" x1="220" y1="330" x2="1210" y2="65" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0866F5" stopOpacity="0" />
                <stop offset=".5" stopColor="#00AFCB" stopOpacity=".7" />
                <stop offset="1" stopColor="#7BE33F" stopOpacity="0" />
              </linearGradient>
              <filter id="boxora-blur" x="340" y="0" width="760" height="370" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
                <feGaussianBlur stdDeviation="20" />
              </filter>
            </defs>

            <ellipse cx="720" cy="188" rx="245" ry="118" fill="url(#boxora-core)" filter="url(#boxora-blur)" />
            <circle cx="720" cy="180" r="115" fill="url(#boxora-core)" />
            <circle cx="720" cy="180" r="139" stroke="#0866F5" strokeOpacity=".28" />
            <circle cx="720" cy="180" r="169" stroke="#00AFCB" strokeOpacity=".2" strokeDasharray="2 8" />
            <circle cx="720" cy="180" r="194" stroke="#7BE33F" strokeOpacity=".19" strokeDasharray="1 12" />
            <path data-art-flow d="M95 299C268 170 409 365 594 261C775 159 862 73 1044 172C1186 250 1264 222 1370 126" stroke="url(#boxora-line)" strokeWidth="1.8" strokeDasharray="7 24" />
            <path d="M77 327C259 197 409 389 600 289C789 190 878 104 1058 200C1204 278 1280 252 1397 154" stroke="url(#boxora-line)" strokeOpacity=".82" strokeWidth="1.3" />
            <path d="M164 118C332 235 414 41 585 116C782 202 869 333 1056 272C1181 232 1239 97 1348 82" stroke="url(#boxora-line)" strokeOpacity=".76" strokeWidth="1.25" />
            <path d="M235 359C378 302 481 344 601 304C762 251 901 309 1038 317C1178 324 1265 277 1375 250" stroke="#0866F5" strokeOpacity=".28" />
            <circle data-art-node cx="360" cy="235" r="3" fill="#0866F5" fillOpacity=".9" />
            <circle data-art-node cx="1057" cy="201" r="3.5" fill="#00AFCB" fillOpacity=".9" />
            <circle data-art-node cx="585" cy="116" r="2.5" fill="#7BE33F" fillOpacity=".9" />
            <circle data-art-node cx="1040" cy="317" r="2.5" fill="#4AAFC0" fillOpacity=".8" />
            <path d="M720 13V57M720 303V356M548 180H505M935 180H892" stroke="#0866F5" strokeOpacity=".16" strokeDasharray="2 7" />
          </svg>

        </div>

      </div>

      <a
        href="#process"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('process')?.scrollIntoView({
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
            block: 'start',
          })
        }}
        aria-label="Cuộn xuống xem nội dung Boxora"
        className="group absolute bottom-4 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/80 bg-white/75 py-1.5 pl-2 pr-4 text-xs font-semibold text-blue-900 shadow-[0_8px_24px_rgba(15,23,42,.08)] backdrop-blur-lg transition duration-200 hover:-translate-y-0.5 hover:border-cyan-400 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 sm:bottom-5 sm:py-2 sm:pl-2.5 sm:pr-5 lg:left-12 lg:translate-x-0"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-800 transition-colors group-hover:bg-blue-100">
          <ArrowDown size={15} className="animate-bounce motion-reduce:animate-none" />
        </span>
        <span>Cuộn để khám phá</span>
      </a>
    </section>
  )
}
