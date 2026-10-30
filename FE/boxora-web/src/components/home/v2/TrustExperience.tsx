import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLanguage } from '../../../context/LanguageContext'
import { FACILITIES_LIST } from '../CinematicServicesSection'
import { POLICY_DOSSIER } from '../CinematicPoliciesAndFaq'
import type { PolicyTabKey } from '../CinematicPoliciesAndFaq'
import { Container, CtaButton, Eyebrow, LineReveal, MaskImage, Reveal, EASE_OUT } from './motion'

const POLICY_KEYS: PolicyTabKey[] = ['deposit', 'insurance', 'contract', 'prohibited']
const POLICY_LABEL: Record<PolicyTabKey, string> = {
  deposit: 'Tiền cọc',
  insurance: 'Bảo hiểm',
  contract: 'Hợp đồng',
  prohibited: 'Hàng cấm',
}

export const TrustExperience: React.FC<{ onBookNow: () => void }> = ({ onBookNow }) => {
  const { t } = useLanguage()
  const [facility, setFacility] = useState(0)
  const [tab, setTab] = useState<PolicyTabKey>('deposit')
  const policiesRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<PolicyTabKey>).detail
      if (detail && POLICY_KEYS.includes(detail)) setTab(detail)
      policiesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.addEventListener('boxora:open-policy', handler)
    return () => window.removeEventListener('boxora:open-policy', handler)
  }, [])

  const f = FACILITIES_LIST[facility]
  const policy = POLICY_DOSSIER[tab]

  return (
    <section
      id="trust"
      className="relative bg-white py-24 text-slate-900 dark:bg-slate-950 dark:text-white sm:py-32"
    >
      <Container>
        <Reveal>
          <Eyebrow index="07" label={t('Cơ sở & Chính sách')} />
        </Reveal>
        <LineReveal
          className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
          lines={[t('Bốn cơ sở tại TP.HCM,'), t('điều khoản rõ ràng.')]}
        />

        {/* facilities */}
        <div className="mt-16 grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7">
            <div className="relative aspect-[4/3] bg-sky-50 dark:bg-slate-900">
              <AnimatePresence mode="sync">
                <motion.div
                  key={facility}
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: EASE_OUT }}
                >
                  <MaskImage
                    src={f.image}
                    alt={f.name}
                    className="h-full w-full"
                    from="left"
                    parallax={30}
                  />
                </motion.div>
              </AnimatePresence>
              <div className="absolute bottom-0 left-0 bg-white px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700 dark:bg-slate-950 dark:text-cyan-300">
                {f.code}
              </div>
            </div>
          </div>

          <ul className="lg:col-span-5 lg:self-center">
            {FACILITIES_LIST.map((fac, i) => {
              const on = i === facility
              return (
                <li key={fac.code} className="border-b border-slate-200 first:border-t dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setFacility(i)}
                    onMouseEnter={() => setFacility(i)}
                    onFocus={() => setFacility(i)}
                    aria-pressed={on}
                    className="group flex w-full cursor-pointer items-start gap-5 py-6 text-left outline-none"
                  >
                    <span
                      className={`pt-1 text-xs font-semibold tabular-nums transition-colors ${
                        on ? 'text-sky-700 dark:text-cyan-300' : 'text-slate-400'
                      }`}
                    >
                      {fac.code.split(' ')[0]}
                    </span>
                    <span
                      className={`block transition-transform duration-500 ${on ? 'translate-x-2' : 'group-hover:translate-x-1'}`}
                    >
                      <span
                        className={`block text-xl font-semibold tracking-tight transition-colors ${
                          on ? 'text-slate-950 dark:text-white' : 'text-slate-500'
                        }`}
                      >
                        {t(fac.name)}
                      </span>
                      <span className="mt-1 block text-sm text-slate-500">{t(fac.address)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* policies */}
        <div id="policies" ref={policiesRef} className="mt-28 scroll-mt-24 sm:mt-36">
          <div className="grid overflow-hidden bg-sky-50/70 dark:bg-slate-900 lg:grid-cols-12">
            <div className="p-8 sm:p-12 lg:col-span-5">
              <Eyebrow index="—" label={t('Chính sách')} />
              <div role="tablist" aria-label={t('Chính sách')} className="mt-8">
                {POLICY_KEYS.map((k) => {
                  const on = k === tab
                  return (
                    <button
                      key={k}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setTab(k)}
                      className="group flex w-full cursor-pointer items-baseline gap-4 border-b border-slate-300/70 py-4 text-left outline-none dark:border-slate-700"
                    >
                      <span className="text-xs font-semibold tabular-nums text-slate-400">
                        {POLICY_DOSSIER[k].code}
                      </span>
                      <span
                        className={`text-2xl font-semibold tracking-tight transition-[color,transform] duration-300 sm:text-3xl ${
                          on
                            ? 'translate-x-1 text-sky-700 dark:text-cyan-300'
                            : 'text-slate-400 group-hover:translate-x-1 group-hover:text-slate-700 dark:group-hover:text-slate-200'
                        }`}
                      >
                        {t(POLICY_LABEL[k])}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="mt-10">
                <CtaButton onClick={onBookNow}>{t('Đặt kho ngay')}</CtaButton>
              </div>
            </div>

            <div className="bg-white p-8 dark:bg-slate-950 sm:p-12 lg:col-span-7">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  role="tabpanel"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4, ease: EASE_OUT }}
                >
                  <div className="flex items-end gap-5">
                    <span className="text-6xl font-semibold leading-none tracking-tighter text-sky-700 dark:text-cyan-300 sm:text-7xl">
                      {policy.metric}
                    </span>
                    <span className="max-w-[16rem] pb-1 text-sm leading-snug text-slate-500">
                      {t(policy.metricSub)}
                    </span>
                  </div>
                  <h3 className="mt-8 text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
                    {t(policy.headline)}
                  </h3>
                  <ol className="mt-8 space-y-7">
                    {policy.clauses.map((c) => (
                      <li key={c.num} className="grid grid-cols-[2rem_1fr] gap-3">
                        <span className="text-xs font-semibold tabular-nums text-slate-400">{c.num}</span>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
                            {t(c.label)}
                          </p>
                          <p className="mt-1 font-semibold">{t(c.title)}</p>
                          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                            {t(c.body)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
