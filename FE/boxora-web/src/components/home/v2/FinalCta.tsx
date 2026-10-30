import React, { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { useLanguage } from '../../../context/LanguageContext'
import { Container, CtaButton, Eyebrow, LineReveal, Reveal } from './motion'

export const FinalCta: React.FC<{ onBookNow: () => void }> = ({ onBookNow }) => {
  const { t } = useLanguage()
  const reduce = useReducedMotion()
  const ref = useRef<HTMLElement | null>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 1.15])
  const y = useTransform(scrollYProgress, [0, 1], [80, -80])

  return (
    <section
      id="start"
      ref={ref}
      className="relative isolate overflow-hidden bg-sky-50 py-32 text-slate-950 dark:bg-slate-900 dark:text-white sm:py-44 lg:py-56"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 aspect-square w-[150vw] max-w-[1500px] -translate-x-1/2 -translate-y-1/2 will-change-transform sm:w-[110vw]"
        style={reduce ? undefined : { scale, y }}
      >
        <motion.svg
          viewBox="0 0 1000 1000"
          fill="none"
          className="h-full w-full text-sky-700 dark:text-cyan-300"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 160, ease: 'linear', repeat: Infinity }}
        >
          <circle cx="500" cy="500" r="480" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />
          <circle cx="500" cy="500" r="380" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" strokeDasharray="2 10" />
          <circle cx="500" cy="500" r="280" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />
          <ellipse cx="500" cy="500" rx="480" ry="190" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" transform="rotate(-24 500 500)" />
          <circle cx="500" cy="20" r="7" className="text-cyan-500" fill="currentColor" />
          <circle cx="840" cy="840" r="5" className="text-emerald-500" fill="currentColor" />
          <circle cx="120" cy="640" r="4" fill="currentColor" fillOpacity="0.5" />
        </motion.svg>
      </motion.div>

      <Container className="relative">
        <Eyebrow index="09" label={t('Bắt đầu')} />
        <LineReveal
          className="mt-10 text-[clamp(3rem,10vw,9.5rem)] font-semibold leading-[0.96] tracking-[-0.035em]"
          lines={[t('Không gian của bạn,'), t('sẵn sàng hôm nay.')]}
        />
        <Reveal delay={0.2} className="mt-12 flex flex-col gap-8 sm:flex-row sm:items-center sm:gap-10">
          <p className="max-w-md text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            {t('Chọn kho, ký hợp đồng điện tử và nhận mã PIN truy cập 24/7 chỉ trong vài phút.')}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <CtaButton onClick={onBookNow}>{t('Đặt kho ngay')}</CtaButton>
            <CtaButton href="#faq" variant="ghost">
              {t('Xem câu hỏi thường gặp')}
            </CtaButton>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
