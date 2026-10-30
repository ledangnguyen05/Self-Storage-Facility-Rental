import React, { useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
} from 'framer-motion'
import { useLanguage } from '../../../context/LanguageContext'
import { PROCESS_STEPS_DATA } from '../CinematicProcessSection'
import { Container, CtaButton, EASE_OUT, Eyebrow, Reveal, useSectionProgress } from './motion'

const COUNT = PROCESS_STEPS_DATA.length

export const HowItWorks: React.FC<{ onBookNow: () => void }> = ({ onBookNow }) => {
  const { t } = useLanguage()
  const reduce = useReducedMotion()
  const ref = useRef<HTMLElement | null>(null)
  const progress = useSectionProgress(ref)
  const smooth = useSpring(progress, { stiffness: 120, damping: 26, mass: 0.3 })
  const [active, setActive] = useState(0)

  useMotionValueEvent(progress, 'change', (v) => {
    const next = Math.min(COUNT - 1, Math.max(0, Math.floor(v * COUNT)))
    setActive((prev) => (prev === next ? prev : next))
  })

  const jumpTo = (i: number) => {
    const el = ref.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY
    const range = el.offsetHeight - window.innerHeight
    window.scrollTo({
      top: top + ((i + 0.5) / COUNT) * range,
      behavior: reduce ? 'auto' : 'smooth',
    })
  }

  const step = PROCESS_STEPS_DATA[active]

  return (
    <section
      id="process"
      ref={ref}
      className="relative bg-sky-50/60 text-slate-900 dark:bg-slate-900 dark:text-white"
    >
      {/* Desktop: sticky scroll story */}
      <div className="hidden h-[520vh] lg:block">
        <div className="sticky top-0 flex h-screen items-center overflow-hidden">
          <Container className="grid grid-cols-12 gap-10">
            <div className="col-span-7 flex flex-col justify-center">
              <Eyebrow index="03" label={t('Quy trình thuê kho')} />
              <div className="relative mt-10 h-[460px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step.step}
                    initial={reduce ? false : { opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, y: -30 }}
                    transition={{ duration: 0.45, ease: EASE_OUT }}
                    className="absolute inset-0"
                  >
                    <div className="flex items-end gap-8">
                      <span className="text-[11rem] font-semibold leading-[0.8] tracking-[-0.06em] text-sky-700/90 tabular-nums dark:text-cyan-300">
                        {step.code}
                      </span>
                      <span className="pb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                        {t(step.stepLabel)} / 0{COUNT}
                      </span>
                    </div>
                    <h3 className="mt-10 text-5xl font-semibold leading-[1.05] tracking-[-0.03em]">
                      {t(step.title)}
                    </h3>
                    <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                      {t(step.cardDesc)}
                    </p>
                    <p className="mt-8 max-w-xl border-l-2 border-sky-600 pl-4 text-sm text-slate-500 dark:border-cyan-300 dark:text-slate-400">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.2em]">
                        {t(step.metricLabel)}
                      </span>
                      <span className="mt-1 block text-slate-800 dark:text-slate-200">
                        {t(step.metricValue)}
                      </span>
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="col-span-5 flex items-center">
              <div className="relative w-full pl-8">
                <div className="absolute bottom-3 left-0 top-3 w-px bg-slate-300 dark:bg-slate-700" />
                <motion.div
                  className="absolute bottom-3 left-0 top-3 w-px origin-top bg-sky-600 dark:bg-cyan-300"
                  style={{ scaleY: reduce ? progress : smooth }}
                />
                <ol className="space-y-5">
                  {PROCESS_STEPS_DATA.map((s, i) => {
                    const on = i === active
                    return (
                      <li key={s.step}>
                        <button
                          type="button"
                          onClick={() => jumpTo(i)}
                          aria-current={on ? 'step' : undefined}
                          className={`group relative flex w-full cursor-pointer items-baseline gap-5 text-left transition-[opacity,transform] duration-300 ${
                            on ? 'translate-x-2 opacity-100' : 'opacity-40 hover:opacity-80'
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`absolute -left-[37px] top-2 h-2.5 w-2.5 rounded-full transition-colors duration-300 ${
                              i <= active
                                ? 'bg-sky-600 dark:bg-cyan-300'
                                : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                          />
                          <span className="text-sm font-semibold tabular-nums text-slate-500">
                            {s.code}
                          </span>
                          <span className="text-xl font-semibold tracking-tight">{t(s.title)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
                <div className="mt-12">
                  <CtaButton onClick={onBookNow}>{t('Đặt kho ngay')}</CtaButton>
                </div>
              </div>
            </div>
          </Container>
        </div>
      </div>

      {/* Mobile / tablet: stacked timeline */}
      <div className="py-24 sm:py-28 lg:hidden">
        <Container>
          <Eyebrow index="03" label={t('Quy trình thuê kho')} />
          <ol className="relative mt-12 space-y-14 border-l border-slate-300 pl-7 dark:border-slate-700">
            {PROCESS_STEPS_DATA.map((s) => (
              <Reveal as="li" key={s.step} className="relative">
                <span
                  aria-hidden
                  className="absolute -left-[33px] top-3 h-2.5 w-2.5 rounded-full bg-sky-600 dark:bg-cyan-300"
                />
                <span className="text-6xl font-semibold tracking-[-0.05em] text-sky-700 tabular-nums dark:text-cyan-300">
                  {s.code}
                </span>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight">{t(s.title)}</h3>
                <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">
                  {t(s.cardDesc)}
                </p>
              </Reveal>
            ))}
          </ol>
          <div className="mt-14">
            <CtaButton onClick={onBookNow}>{t('Đặt kho ngay')}</CtaButton>
          </div>
        </Container>
      </div>
    </section>
  )
}
