import React, { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useLanguage } from '../../../context/LanguageContext'
import { SIZE_TIER_ATELIER_DATA, ALL_16_VOLUMES } from '../CinematicVolumetricAtelier'
import type { SizeTierKey } from '../../booking/LandingBookingWizardModal'
import { Container, CtaButton, Eyebrow, LineReveal, Reveal, EASE_OUT } from './motion'

const TIERS: SizeTierKey[] = ['LOCKER', 'STANDARD', 'LARGE', 'ENTERPRISE']
const MAX_VOL = 24

/** Proportional footprint: each tier's default volume as a rectangle scaled by volume. */
const Footprints: React.FC<{ selected: SizeTierKey }> = ({ selected }) => {
  const { t } = useLanguage()
  return (
    <div className="flex h-44 items-end gap-4 sm:gap-6" aria-label={t('So sánh tỉ lệ thể tích')}>
      {TIERS.map((k) => {
        const v = SIZE_TIER_ATELIER_DATA[k].defaultVolM3
        const side = 28 + Math.sqrt(v / MAX_VOL) * 112
        const on = k === selected
        return (
          <div key={k} className="flex flex-col items-center gap-2">
            <div
              style={{ width: side, height: side * 0.8 }}
              className={`border transition-[background-color,border-color,opacity] duration-500 ${
                on
                  ? 'border-sky-700 bg-sky-700/15 dark:border-cyan-300 dark:bg-cyan-300/15'
                  : 'border-slate-300 bg-transparent opacity-60 dark:border-slate-700'
              }`}
            />
            <span
              className={`text-[11px] font-semibold tabular-nums ${
                on ? 'text-sky-700 dark:text-cyan-300' : 'text-slate-400'
              }`}
            >
              {v} m³
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Horizontal ruler of all 16 volumes. */
const VolumeRuler: React.FC<{ selected: SizeTierKey; onPick: (k: SizeTierKey) => void }> = ({
  selected,
  onPick,
}) => {
  const reduce = useReducedMotion()
  return (
    <div className="overflow-x-auto pb-2">
      <div className="relative flex min-w-[760px] items-end gap-1.5 border-b border-slate-300 dark:border-slate-700">
        {ALL_16_VOLUMES.map((v, i) => {
          const on = v.tier === selected
          return (
            <button
              key={v.vol}
              type="button"
              onClick={() => onPick(v.tier)}
              title={v.dims}
              className="group flex flex-1 cursor-pointer flex-col items-center gap-2 outline-none"
            >
              <motion.span
                initial={reduce ? false : { scaleY: 0 }}
                whileInView={reduce ? undefined : { scaleY: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: i * 0.035, ease: EASE_OUT }}
                style={{ height: 24 + (v.volM3 / MAX_VOL) * 120, transformOrigin: 'bottom' }}
                className={`block w-full transition-colors duration-300 ${
                  on
                    ? 'bg-sky-700 dark:bg-cyan-300'
                    : 'bg-slate-200 group-hover:bg-sky-300 dark:bg-slate-800 dark:group-hover:bg-slate-600'
                }`}
              />
              <span
                className={`pb-2 text-[11px] font-semibold tabular-nums ${
                  on ? 'text-sky-700 dark:text-cyan-300' : 'text-slate-500'
                }`}
              >
                {v.volM3}
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">m³</p>
    </div>
  )
}

export const PricingSize: React.FC<{ onBookTier: (tier: SizeTierKey) => void }> = ({ onBookTier }) => {
  const { t } = useLanguage()
  const [selected, setSelected] = useState<SizeTierKey>('STANDARD')
  const spec = SIZE_TIER_ATELIER_DATA[selected]

  return (
    <section
      id="size-guide"
      className="relative bg-sky-50/60 py-24 text-slate-900 dark:bg-slate-900 dark:text-white sm:py-32"
    >
      <Container>
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Reveal>
              <Eyebrow index="06" label={t('Kích thước & Giá')} />
            </Reveal>
            <LineReveal
              className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
              lines={[t('Từ 1 đến 24 m³,'), t('chọn đúng phần bạn cần.')]}
            />
          </div>
          <Reveal delay={0.15} className="lg:col-span-4 lg:col-start-9 lg:self-end">
            <p className="text-base leading-relaxed text-slate-600 dark:text-slate-400">
              {t('So sánh bốn nhóm kích thước, mỗi nhóm có giá niêm yết cho kho thường và kho lạnh A/C.')}
            </p>
          </Reveal>
        </div>

        <Reveal className="mt-16">
          <VolumeRuler selected={selected} onPick={setSelected} />
        </Reveal>

        <div className="mt-16 grid gap-12 lg:grid-cols-12">
          {/* comparison table */}
          <div className="lg:col-span-7" role="radiogroup" aria-label={t('Chọn nhóm kích thước')}>
            <div className="hidden grid-cols-[1.6fr_1fr_1fr] gap-4 border-b border-slate-300 pb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700 sm:grid">
              <span>{t('Nhóm')}</span>
              <span>{t('Thể tích / Diện tích')}</span>
              <span>{t('Giá thuê')}</span>
            </div>
            {TIERS.map((k) => {
              const s = SIZE_TIER_ATELIER_DATA[k]
              const on = k === selected
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSelected(k)}
                  className={`group relative grid w-full cursor-pointer gap-3 border-b border-slate-200 py-6 text-left outline-none transition-colors duration-300 focus-visible:bg-white sm:grid-cols-[1.6fr_1fr_1fr] sm:gap-4 dark:border-slate-800 ${
                    on ? 'bg-white dark:bg-slate-950' : 'hover:bg-white/60 dark:hover:bg-slate-950/50'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`absolute left-0 top-0 h-full w-0.5 origin-top bg-sky-700 transition-transform duration-500 dark:bg-cyan-300 ${
                      on ? 'scale-y-100' : 'scale-y-0'
                    }`}
                  />
                  <span className="pl-4">
                    <span className="block text-lg font-semibold leading-snug tracking-tight">{t(s.name)}</span>
                    <span className="mt-1 block text-sm text-slate-500">{t(s.bestFor)}</span>
                  </span>
                  <span className="pl-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300 sm:pl-0">
                    <span className="block font-semibold tabular-nums">{s.volume}</span>
                    <span className="block tabular-nums text-slate-500">{s.area}</span>
                  </span>
                  <span className="pl-4 text-sm leading-relaxed sm:pl-0">
                    <span className="block font-semibold text-sky-700 dark:text-cyan-300">{t(s.rate)}</span>
                    <span className="block text-slate-500">{t(s.rateAC)}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {/* detail panel */}
          <div className="lg:col-span-5">
            <div className="bg-white p-8 ring-1 ring-sky-100 dark:bg-slate-950 dark:ring-slate-800 sm:p-10">
              <Footprints selected={selected} />
              <AnimatePresence mode="wait">
                <motion.div
                  key={selected}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4, ease: EASE_OUT }}
                  className="mt-8"
                >
                  <h3 className="text-2xl font-semibold tracking-tight">{t(spec.name)}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
                    {t(spec.desc)}
                  </p>
                  <dl className="mt-6 space-y-3 text-sm">
                    <div className="flex justify-between gap-4 border-t border-slate-200 pt-3 dark:border-slate-800">
                      <dt className="text-slate-500">{t('Kích thước')}</dt>
                      <dd className="text-right font-medium">{t(spec.dims)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-slate-200 pt-3 dark:border-slate-800">
                      <dt className="text-slate-500">{t('Cửa')}</dt>
                      <dd className="text-right font-medium">{t(spec.door)}</dd>
                    </div>
                  </dl>
                  <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                    {t('Chứa được')}
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                    {spec.fits.map((f) => (
                      <li key={f} className="flex gap-3">
                        <span aria-hidden className="mt-2 h-px w-4 shrink-0 bg-sky-600 dark:bg-cyan-300" />
                        {t(f)}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8">
                    <CtaButton onClick={() => onBookTier(selected)}>{t('Đặt kho nhóm này')}</CtaButton>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
