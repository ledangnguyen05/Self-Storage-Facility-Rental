import React, { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useLanguage } from '../../../context/LanguageContext'
import { IOT_REAL_FEATURES } from '../CinematicIotVaultSection'
import { Container, Eyebrow, LineReveal, Reveal, useParallax, EASE_OUT } from './motion'

/** Schematic of a storage unit door + smart lock + signal rings. */
const LockSchematic: React.FC<{ active: number }> = ({ active }) => {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement | null>(null)
  const yBack = useParallax(ref, 30)
  const yMid = useParallax(ref, -10)
  const yFront = useParallax(ref, -50)

  const ring = (i: number) =>
    reduce
      ? { initial: { opacity: 0.25, scale: 1 + i * 0.5 } }
      : {
          initial: { opacity: 0.5, scale: 0.6 },
          animate: { opacity: [0.5, 0], scale: [0.6, 2.4] },
          transition: { duration: 5, delay: i * 1.66, repeat: Infinity, ease: 'easeOut' as const },
        }

  const dot = (n: number) =>
    `transition-colors duration-500 ${active === n ? 'fill-sky-700 dark:fill-cyan-300' : 'fill-slate-300 dark:fill-slate-600'}`

  return (
    <div ref={ref} className="relative mx-auto aspect-[4/5] w-full max-w-[520px]">
      {/* back plane: grid */}
      <motion.div
        aria-hidden
        style={reduce ? undefined : { y: yBack }}
        className="absolute inset-0 rounded-[2rem] bg-sky-50 dark:bg-slate-900"
      >
        <div
          className="absolute inset-0 rounded-[2rem] opacity-60"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(2,132,199,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(2,132,199,0.10) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </motion.div>

      {/* signal rings */}
      <div aria-hidden className="absolute left-[68%] top-[48%] h-0 w-0">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            {...ring(i)}
            className="absolute -left-14 -top-14 block h-28 w-28 rounded-full border border-cyan-500 will-change-transform"
          />
        ))}
      </div>

      {/* mid plane: door */}
      <motion.svg
        viewBox="0 0 400 500"
        role="img"
        aria-label="Sơ đồ cửa buồng kho và khóa thông minh"
        style={reduce ? undefined : { y: yMid }}
        className="absolute inset-0 h-full w-full"
      >
        <g className="stroke-sky-700 dark:stroke-cyan-300" fill="none" strokeWidth="1.5">
          <rect x="60" y="50" width="280" height="400" rx="6" className="fill-white dark:fill-slate-950" />
          <rect x="82" y="72" width="236" height="356" rx="3" strokeOpacity="0.4" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <line key={i} x1="82" x2="318" y1={100 + i * 30} y2={100 + i * 30} strokeOpacity="0.14" />
          ))}
          {/* top sensor */}
          <circle cx="200" cy="62" r="3" className={dot(1)} strokeWidth="0" />
          {/* hinges */}
          <rect x="52" y="110" width="10" height="36" rx="2" />
          <rect x="52" y="354" width="10" height="36" rx="2" />
          {/* keypad body */}
          <rect x="262" y="206" width="56" height="104" rx="8" className="fill-sky-50 dark:fill-slate-900" />
          {[0, 1, 2].flatMap((r) =>
            [0, 1, 2].map((c) => (
              <circle
                key={`${r}${c}`}
                cx={277 + c * 13}
                cy={246 + r * 13}
                r="3"
                strokeWidth="0"
                className={dot(0)}
              />
            ))
          )}
          <rect x="268" y="214" width="44" height="14" rx="2" strokeOpacity="0.5" />
          {/* bolt */}
          <rect x="236" y="250" width="26" height="8" rx="2" className={active === 1 ? 'fill-sky-100 dark:fill-sky-900' : ''} />
          {/* environment sensor */}
          <circle cx="120" cy="140" r="14" strokeOpacity="0.5" />
          <circle cx="120" cy="140" r="4" strokeWidth="0" className={dot(3)} />
          {/* log line */}
          <path d="M110 380 H170 M110 392 H150" strokeOpacity="0.5" />
          <circle cx="100" cy="380" r="2.5" strokeWidth="0" className={dot(3)} />
          <circle cx="100" cy="392" r="2.5" strokeWidth="0" className={dot(2)} />
        </g>
      </motion.svg>

      {/* front plane: floating labels */}
      <motion.div
        style={reduce ? undefined : { y: yFront }}
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -right-2 top-[18%] flex items-center gap-2 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-sm ring-1 ring-sky-100 dark:bg-slate-950 dark:text-cyan-300 dark:ring-slate-800 sm:-right-6">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          PIN · 24/7
        </div>
        <div className="absolute -left-2 bottom-[14%] bg-slate-950 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white dark:bg-white dark:text-slate-950 sm:-left-6">
          IoT Lock
        </div>
      </motion.div>
    </div>
  )
}

export const TechSecurity: React.FC = () => {
  const { t } = useLanguage()
  const [active, setActive] = useState(0)

  return (
    <section
      id="iot-access"
      className="relative overflow-hidden bg-white py-24 text-slate-900 dark:bg-slate-950 dark:text-white sm:py-32"
    >
      <Container>
        <div className="grid items-start gap-16 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5 lg:sticky lg:top-28">
            <Reveal>
              <Eyebrow index="05" label={t('Công nghệ & An ninh')} />
            </Reveal>
            <LineReveal
              className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
              lines={[t('Khóa số thông minh,'), t('quyền truy cập'), t('nằm trong tay bạn.')]}
            />
            <Reveal delay={0.2}>
              <p className="mt-6 max-w-md text-base leading-relaxed text-slate-600 dark:text-slate-400">
                {t('Mỗi buồng kho được trang bị khóa IoT, mã PIN cá nhân và nhật ký đóng mở để bạn luôn chủ động.')}
              </p>
            </Reveal>
            <div className="mt-12">
              <LockSchematic active={active} />
            </div>
          </div>

          <ol className="lg:col-span-7 lg:pl-10">
            {IOT_REAL_FEATURES.map((f, i) => (
              <motion.li
                key={f.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '0px 0px -10% 0px' }}
                transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.05 }}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                tabIndex={0}
                className="group relative border-t border-slate-200 py-10 outline-none first:border-t-0 first:pt-0 dark:border-slate-800 sm:py-12"
              >
                <div className="grid gap-4 sm:grid-cols-[88px_1fr]">
                  <span
                    className={`text-5xl font-semibold tabular-nums tracking-tighter transition-colors duration-500 sm:text-6xl ${
                      active === i ? 'text-sky-700 dark:text-cyan-300' : 'text-slate-200 dark:text-slate-800'
                    }`}
                  >
                    {f.num}
                  </span>
                  <div className="transition-transform duration-500 group-hover:translate-x-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
                      {t(f.category)}
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
                      {t(f.title)}
                    </h3>
                    <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
                      {t(f.desc)}
                    </p>
                    <p className="mt-5 inline-block border-l-2 border-sky-600 pl-3 text-xs font-medium tracking-wide text-slate-500 dark:border-cyan-300 dark:text-slate-400">
                      {t(f.spec)}
                    </p>
                  </div>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  )
}
