import React, { useLayoutEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { useLanguage } from '../../../context/LanguageContext'
import { FACILITIES_LIST, STORAGE_UNIT_TYPES } from '../CinematicServicesSection'
import { Container, CtaButton, Eyebrow, LineReveal, MaskImage, Reveal } from './motion'

type Facility = (typeof FACILITIES_LIST)[number]

const UnitRow: React.FC<{
  unit: (typeof STORAGE_UNIT_TYPES)[number]
  flip: boolean
  onBookNow: () => void
}> = ({ unit, flip, onBookNow }) => {
  const { t } = useLanguage()
  return (
    <article className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
      <MaskImage
        src={unit.image}
        alt={t(unit.title)}
        from={flip ? 'right' : 'left'}
        parallax={36}
        className={`aspect-[4/3] w-full bg-slate-100 dark:bg-slate-800 lg:col-span-7 ${
          flip ? 'lg:order-2' : ''
        }`}
      />
      <div className={`lg:col-span-5 ${flip ? 'lg:order-1' : ''}`}>
        <Reveal>
          <span className="text-8xl font-semibold leading-none tracking-[-0.06em] text-sky-700/90 tabular-nums dark:text-cyan-300 lg:text-9xl">
            {unit.index}
          </span>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {t(unit.subtitle)}
          </p>
          <h3 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.02em] lg:text-4xl">
            {t(unit.title)}
          </h3>
          <p className="mt-5 leading-relaxed text-slate-600 dark:text-slate-300">{t(unit.desc)}</p>
          <ul className="mt-6 space-y-2 border-t border-slate-200 pt-5 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-300">
            {unit.specs.map((s) => (
              <li key={s}>{t(s)}</li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <CtaButton onClick={onBookNow}>{t('Đặt kho ngay')}</CtaButton>
            <span className="text-sm font-semibold text-sky-700 dark:text-cyan-300">
              {t(unit.priceTag)}
            </span>
          </div>
        </Reveal>
      </div>
    </article>
  )
}

const FacilitySlide: React.FC<{ f: Facility; className?: string }> = ({ f, className }) => {
  const { t } = useLanguage()
  return (
    <figure className={className}>
      <div className="aspect-[4/5] overflow-hidden bg-slate-200 dark:bg-slate-800">
        <img
          src={f.image}
          alt={t(f.name)}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>
      <figcaption className="mt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700 dark:text-cyan-300">
          {t(f.code)}
        </p>
        <p className="mt-2 text-xl font-semibold tracking-tight">{t(f.name)}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t(f.address)}</p>
      </figcaption>
    </figure>
  )
}

const FacilitiesStrip: React.FC = () => {
  const { t } = useLanguage()
  const reduce = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [shift, setShift] = useState(0)
  const { scrollYProgress } = useScroll({ target: wrapRef, offset: ['start start', 'end end'] })
  const x = useTransform(scrollYProgress, [0, 1], [0, -shift])

  useLayoutEffect(() => {
    const measure = () => {
      const track = trackRef.current
      if (!track) return
      setShift(Math.max(0, track.scrollWidth - window.innerWidth + 96))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const header = (
    <div className="flex items-end justify-between gap-8">
      <LineReveal
        as="h3"
        className="text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-5xl lg:text-6xl"
        lines={[t('4 cơ sở'), t('khắp TP. Hồ Chí Minh')]}
      />
    </div>
  )

  return (
    <>
      {/* Desktop: scroll-linked horizontal strip */}
      <div
        ref={wrapRef}
        className="relative hidden lg:block"
        style={{ height: reduce ? 'auto' : '320vh' }}
      >
        <div
          className={`${reduce ? '' : 'sticky top-0 h-screen'} flex flex-col justify-center overflow-hidden py-16`}
        >
          <Container className="w-full">{header}</Container>
          <motion.div
            ref={trackRef}
            className={`mt-14 flex w-max gap-12 pl-12 pr-12 will-change-transform ${
              reduce ? 'overflow-x-auto' : ''
            }`}
            style={reduce ? undefined : { x }}
          >
            {FACILITIES_LIST.map((f) => (
              <FacilitySlide key={f.code} f={f} className="w-[28vw] max-w-[440px] shrink-0" />
            ))}
          </motion.div>
        </div>
      </div>

      {/* Mobile: native snap scroll */}
      <div className="lg:hidden">
        <Container>{header}</Container>
        <div className="mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto px-5 pb-4 sm:px-8 [scrollbar-width:none]">
          {FACILITIES_LIST.map((f) => (
            <FacilitySlide key={f.code} f={f} className="w-[78%] max-w-sm shrink-0 snap-start" />
          ))}
        </div>
      </div>
    </>
  )
}

export const StorageSolutions: React.FC<{ onBookNow: () => void }> = ({ onBookNow }) => {
  const { t } = useLanguage()
  return (
    <section
      id="services"
      className="bg-white pt-28 text-slate-900 dark:bg-slate-950 dark:text-white sm:pt-36"
    >
      <Container>
        <Reveal>
          <Eyebrow index="04" label={t('Giải pháp lưu trữ')} />
        </Reveal>
        <LineReveal
          as="h2"
          className="mt-10 max-w-4xl text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-6xl lg:text-7xl"
          lines={[t('Chọn đúng không gian,'), t('chỉ trả cho phần bạn dùng.')]}
        />
        <div className="mt-24 space-y-28 lg:mt-32 lg:space-y-40">
          {STORAGE_UNIT_TYPES.map((u, i) => (
            <UnitRow key={u.index} unit={u} flip={i % 2 === 1} onBookNow={onBookNow} />
          ))}
        </div>
      </Container>

      <div className="mt-32 bg-sky-50/60 py-24 dark:bg-slate-900 lg:mt-44 lg:py-0">
        <FacilitiesStrip />
      </div>
    </section>
  )
}
