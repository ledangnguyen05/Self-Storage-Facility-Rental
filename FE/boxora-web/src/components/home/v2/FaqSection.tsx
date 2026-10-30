import React, { useId, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useLanguage } from '../../../context/LanguageContext'
import { FAQ_ITEMS, type FaqCategoryKey } from '../CinematicPoliciesAndFaq'
import { Container, EASE_OUT, Eyebrow, LineReveal, Reveal } from './motion'

const CATEGORIES: { key: FaqCategoryKey; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'IOT', label: 'Khóa IoT' },
  { key: 'CONTRACT', label: 'Hợp đồng' },
  { key: 'FACILITY', label: 'Cơ sở kho' },
]

export const FaqSection: React.FC = () => {
  const { t } = useLanguage()
  const reduce = useReducedMotion()
  const uid = useId()
  const [filter, setFilter] = useState<FaqCategoryKey>('ALL')
  const [open, setOpen] = useState<number | null>(0)

  const items = useMemo(
    () => FAQ_ITEMS.filter((i) => filter === 'ALL' || i.cat === filter),
    [filter]
  )

  const changeFilter = (k: FaqCategoryKey) => {
    setFilter(k)
    setOpen(null)
  }

  return (
    <section
      id="faq"
      className="relative bg-white py-24 text-slate-900 dark:bg-slate-950 dark:text-white sm:py-32 lg:py-40"
    >
      <Container>
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-20">
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <Eyebrow index="08" label={t('Câu hỏi thường gặp')} />
              <LineReveal
                className="mt-8 text-[clamp(2.4rem,5.2vw,4.5rem)] font-semibold leading-[1.04] tracking-tight"
                lines={[t('Mọi điều bạn'), t('cần biết,'), t('trả lời gọn.')]}
              />
              <Reveal delay={0.15} className="mt-10 max-w-sm">
                <p className="text-base leading-relaxed text-slate-600 dark:text-slate-400">
                  {t('Chưa thấy câu trả lời? Đội ngũ Boxora luôn sẵn sàng hỗ trợ bạn.')}
                </p>
                <a
                  href="tel:1900269672"
                  className="mt-6 inline-flex flex-col border-l-2 border-sky-600 pl-4 transition-colors hover:border-cyan-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600 dark:border-cyan-300"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {t('Hotline 24/7')}
                  </span>
                  <span className="mt-1 text-2xl font-semibold tracking-tight text-sky-700 dark:text-cyan-300">
                    1900-BOXORA
                  </span>
                </a>
              </Reveal>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div role="tablist" aria-label={t('Lọc câu hỏi')} className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const active = c.key === filter
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => changeFilter(c.key)}
                    className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${
                      active
                        ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                        : 'text-slate-600 ring-1 ring-slate-200 hover:ring-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:ring-white'
                    }`}
                  >
                    {t(c.label)}
                  </button>
                )
              })}
            </div>

            <ul className="mt-8 border-t border-slate-200 dark:border-slate-800">
              {items.map((item, idx) => {
                const isOpen = open === idx
                const btnId = `${uid}-btn-${filter}-${idx}`
                const panelId = `${uid}-panel-${filter}-${idx}`
                return (
                  <li key={`${filter}-${idx}`} className="border-b border-slate-200 dark:border-slate-800">
                    <h3>
                      <button
                        id={btnId}
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => setOpen(isOpen ? null : idx)}
                        className="group flex w-full cursor-pointer items-start justify-between gap-6 py-6 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
                      >
                        <span
                          className={`text-lg font-medium leading-snug tracking-tight transition-colors duration-300 sm:text-xl ${
                            isOpen
                              ? 'text-sky-700 dark:text-cyan-300'
                              : 'text-slate-900 group-hover:text-sky-700 dark:text-white dark:group-hover:text-cyan-300'
                          }`}
                        >
                          {t(item.q)}
                        </span>
                        <span aria-hidden className="relative mt-2 block h-4 w-4 shrink-0">
                          <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current" />
                          <span
                            className={`absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current transition-transform duration-500 ease-out ${
                              isOpen ? 'rotate-0' : 'rotate-90'
                            }`}
                          />
                        </span>
                      </button>
                    </h3>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          id={panelId}
                          role="region"
                          aria-labelledby={btnId}
                          key="content"
                          initial={reduce ? false : { height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                          transition={{ duration: reduce ? 0 : 0.5, ease: EASE_OUT }}
                          className="overflow-hidden"
                        >
                          <p className="max-w-2xl pb-7 pr-10 text-base leading-relaxed text-slate-600 dark:text-slate-400">
                            {t(item.a)}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  )
}
