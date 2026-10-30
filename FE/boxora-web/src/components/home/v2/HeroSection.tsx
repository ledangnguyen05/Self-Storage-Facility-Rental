import React, { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { useLanguage } from '../../../context/LanguageContext'
import { CtaButton, Container, EASE_OUT, LineReveal } from './motion'
import { HeroVisual } from './HeroVisual'

interface HeroSectionProps {
  onBookNow: () => void
}

/** Facts below come from the live site copy (4 facilities in HCMC, 1–24 m³ range, IoT PIN lock). */
const HERO_FACTS: { value: string; label: string }[] = [
  { value: '4', label: 'Cơ sở tại TP.HCM' },
  { value: '1–24 m³', label: 'Dung tích linh hoạt' },
  { value: 'PIN', label: 'Khóa IoT, cấp mã tức thời' },
]

export const HeroSection: React.FC<HeroSectionProps> = ({ onBookNow }) => {
  const { t } = useLanguage()
  const reduce = useReducedMotion()
  const ref = useRef<HTMLElement | null>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const visualY = useTransform(scrollYProgress, [0, 1], [0, 140])
  const visualScale = useTransform(scrollYProgress, [0, 1], [1, 1.08])
  const textY = useTransform(scrollYProgress, [0, 1], [0, -60])
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  const enter = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.9, delay, ease: EASE_OUT },
        }

  return (
    <section
      ref={ref}
      id="top"
      className="relative isolate overflow-hidden bg-[#f7fbff] dark:bg-slate-950"
    >
      {/* single, quiet background wash — no glow blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_85%_30%,#e6f6ff_0%,rgba(247,251,255,0)_60%)] dark:bg-[radial-gradient(120%_80%_at_85%_30%,rgba(14,165,233,0.12)_0%,transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-slate-300/70 to-transparent dark:via-slate-700"
      />

      <Container className="relative">
        <div className="grid min-h-[calc(100svh-72px)] items-center gap-6 py-14 lg:grid-cols-12 lg:py-10">
          {/* ---------------- copy ---------------- */}
          <motion.div style={reduce ? undefined : { y: textY, opacity: fade }} className="relative z-10 lg:col-span-6 xl:col-span-5">
            <motion.div
              {...enter(0.1)}
              className="mb-7 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700 dark:text-cyan-300"
            >
              <span aria-hidden className="h-px w-10 bg-sky-600/50 dark:bg-cyan-300/50" />
              {t('Kho tự quản thông minh')}
            </motion.div>

            <LineReveal
              as="h1"
              immediate
              delay={0.2}
              stagger={0.12}
              className="text-[clamp(2.7rem,6.4vw,5.8rem)] font-semibold leading-[0.98] tracking-[-0.045em] text-slate-950 dark:text-white"
              lines={[
                t('Kho lưu trữ'),
                <span key="b" className="text-sky-700 dark:text-cyan-300">
                  {t('hiện đại, linh hoạt')}
                </span>,
                t('và thuận tiện.'),
              ]}
            />

            <motion.p
              {...enter(0.7)}
              className="mt-8 max-w-[34rem] text-[15px] leading-[1.75] text-slate-600 dark:text-slate-300 sm:text-base"
            >
              {t(
                'Phòng kho tự quản với khóa IoT, mã PIN số hóa cấp tức thời và kiểm soát vi khí hậu 24/7 — chọn kho, ký hợp đồng và nhận mã truy cập hoàn toàn trực tuyến.'
              )}
            </motion.p>

            <motion.div {...enter(0.85)} className="mt-10 flex flex-wrap items-center gap-3">
              <CtaButton onClick={onBookNow}>{t('Thuê kho ngay')}</CtaButton>
              <CtaButton href="#process" variant="ghost">
                {t('Xem cách hoạt động')}
              </CtaButton>
            </motion.div>

            <motion.dl
              {...enter(1)}
              className="mt-14 grid max-w-xl grid-cols-3 gap-6 border-t border-slate-200 pt-6 dark:border-slate-800"
            >
              {HERO_FACTS.map((f) => (
                <div key={f.label}>
                  <dt className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-[28px]">
                    {f.value}
                  </dt>
                  <dd className="mt-1.5 text-[12px] leading-snug text-slate-500 dark:text-slate-400">
                    {t(f.label)}
                  </dd>
                </div>
              ))}
            </motion.dl>
          </motion.div>

          {/* ---------------- visual ---------------- */}
          <div className="relative h-[68vw] min-h-[340px] max-h-[560px] lg:col-span-6 lg:h-[min(82vh,780px)] lg:max-h-none xl:col-span-7">
            <motion.div
              style={reduce ? undefined : { y: visualY, scale: visualScale }}
              initial={reduce ? false : { opacity: 0, scale: 0.92 }}
              animate={reduce ? undefined : { opacity: 1 }}
              transition={{ duration: 1.4, delay: 0.25, ease: EASE_OUT }}
              className="absolute -right-[22%] -left-[14%] inset-y-[-8%] will-change-transform sm:-right-[14%] lg:-left-[10%] lg:-right-[26%] lg:inset-y-[-12%]"
            >
              <HeroVisual className="absolute inset-0" />
            </motion.div>
          </div>
        </div>
      </Container>

      {/* scroll cue */}
      <motion.a
        href="#about"
        aria-label={t('Cuộn xuống')}
        {...enter(1.3)}
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400 transition-colors hover:text-sky-700 lg:flex"
      >
        {t('Cuộn')}
        <span className="relative block h-9 w-px overflow-hidden bg-slate-300 dark:bg-slate-700">
          <span className="absolute inset-x-0 top-0 h-1/2 bg-sky-600 motion-safe:animate-[boxoraScrollCue_1.8s_ease-in-out_infinite]" />
        </span>
      </motion.a>
    </section>
  )
}

