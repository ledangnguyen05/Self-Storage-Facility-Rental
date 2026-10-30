import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BrandLogo } from '../../common/BrandLogo'
import { QuickThemeLanguageToggle } from '../../common/QuickThemeLanguageToggle'
import { UserAvatarDropdown } from '../../common/UserAvatarDropdown'
import { useLanguage } from '../../../context/LanguageContext'
import { EASE_OUT } from './motion'

interface SiteHeaderProps {
  isAuthenticated: boolean
  user: any
  isCustomer: boolean
  canAccessPortal: boolean
  onNavigate: (path: string) => void
  onOpenProfile: () => void
  onOpenSettings: () => void
  onOpenLogoutConfirm: () => void
}

const SOLUTION_LINKS: { href: string; title: string; desc: string }[] = [
  { href: '#services', title: 'Loại kho & cơ sở', desc: 'Các loại phòng kho và 4 cơ sở tại TP.HCM' },
  { href: '#size-guide', title: 'Kích cỡ & giá', desc: 'So sánh dung tích 1–24 m³ và mức giá thuê' },
  { href: '#iot-access', title: 'Công nghệ & an ninh', desc: 'Khóa IoT, mã PIN và giám sát phòng kho' },
]

const NAV_LINKS: { href: string; label: string }[] = [
  { href: '#about', label: 'Giới thiệu' },
  { href: '#process', label: 'Cách hoạt động' },
  { href: '#trust', label: 'Chính sách' },
  { href: '#faq', label: 'Hỗ trợ' },
]

export const SiteHeader: React.FC<SiteHeaderProps> = ({
  isAuthenticated,
  user,
  isCustomer,
  canAccessPortal,
  onNavigate,
  onOpenProfile,
  onOpenSettings,
  onOpenLogoutConfirm,
}) => {
  const { t } = useLanguage()
  const reduce = useReducedMotion()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setMobileOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const openMenu = () => {
    window.clearTimeout(closeTimer.current)
    setMenuOpen(true)
  }
  const closeMenuSoon = () => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setMenuOpen(false), 120)
  }

  const linkClass =
    'relative py-2 text-[13px] font-medium text-slate-600 transition-colors hover:text-slate-950 dark:text-slate-300 dark:hover:text-white after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-sky-600 after:transition-transform after:duration-300 hover:after:scale-x-100'

  return (
    <motion.header
      initial={reduce ? false : { y: -24, opacity: 0 }}
      animate={reduce ? undefined : { y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: EASE_OUT }}
      className={`sticky top-0 z-[100] transition-[background-color,box-shadow,border-color,backdrop-filter] duration-300 ${
        scrolled
          ? 'border-b border-slate-200/80 bg-white/85 shadow-[0_1px_0_rgba(15,23,42,0.03)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85'
          : 'border-b border-transparent bg-[#f7fbff]/70 backdrop-blur-sm dark:bg-slate-950/60'
      }`}
    >
      <div className="mx-auto flex h-[72px] w-full max-w-[1320px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <a href="#top" aria-label="BOXORA" className="shrink-0">
          <BrandLogo size="sm" subtitle="KHO TỰ QUẢN THÔNG MINH" />
        </a>

        {/* ---------- desktop nav ---------- */}
        <nav className="hidden items-center gap-8 lg:flex" aria-label="Main">
          <div
            className="relative"
            onMouseEnter={openMenu}
            onMouseLeave={closeMenuSoon}
            onFocus={openMenu}
            onBlur={closeMenuSoon}
          >
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className={`${linkClass} inline-flex cursor-pointer items-center gap-1`}
            >
              {t('Giải pháp')}
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                aria-hidden
                className={`transition-transform duration-300 ${menuOpen ? 'rotate-180' : ''}`}
              >
                <path d="M1 3.5 5 7.5 9 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 8, clipPath: 'inset(0 0 100% 0)' }}
                  animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)' }}
                  exit={{ opacity: 0, y: 6, clipPath: 'inset(0 0 100% 0)' }}
                  transition={{ duration: 0.28, ease: EASE_OUT }}
                  className="absolute left-1/2 top-full w-[340px] -translate-x-1/2 pt-3"
                >
                  <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.25)] dark:border-slate-800 dark:bg-slate-900">
                    {SOLUTION_LINKS.map((item) => (
                      <li key={item.href}>
                        <a
                          href={item.href}
                          onClick={() => setMenuOpen(false)}
                          className="group block rounded-xl px-4 py-3 transition-colors hover:bg-sky-50 dark:hover:bg-slate-800"
                        >
                          <span className="flex items-center justify-between text-sm font-semibold text-slate-900 dark:text-white">
                            {t(item.title)}
                            <span
                              aria-hidden
                              className="translate-x-[-4px] text-sky-600 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                            >
                              →
                            </span>
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                            {t(item.desc)}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className={linkClass}>
              {t(l.label)}
            </a>
          ))}
        </nav>

        {/* ---------- actions ---------- */}
        <div className="flex items-center gap-3">
          <QuickThemeLanguageToggle />

          {isAuthenticated ? (
            <UserAvatarDropdown
              user={user}
              role={user?.role?.name || 'CUSTOMER'}
              onOpenProfile={onOpenProfile}
              onOpenSettings={onOpenSettings}
              onOpenLogoutConfirm={onOpenLogoutConfirm}
              extraActions={
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                  {canAccessPortal ? (
                    <button
                      type="button"
                      onClick={() => onNavigate(isCustomer ? '/portal/customer' : '/portal')}
                      className="w-full py-2.5 px-3.5 rounded-xl bg-blue-600 text-white font-semibold text-xs flex items-center justify-between hover:bg-blue-700 shadow-xs transition-all cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-emerald-400">dashboard</span>
                        <span>
                          {isCustomer ? t('Vào Portal Quản Lý Kho (Khóa IoT)') : t('Vào Trang Điều Hành Portal')}
                        </span>
                      </span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onNavigate('/portal/customer?tab=bookings')}
                      className="w-full py-2.5 px-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-semibold text-xs flex items-center justify-between hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all shadow-xs cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-400">
                          calendar_month
                        </span>
                        <span>{t('Đơn Đặt Giữ Chỗ Của Tôi')}</span>
                      </span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  )}
                </div>
              }
            />
          ) : (
            <>
              <Link
                to="/login"
                className="hidden px-3 py-2 text-[13px] font-medium text-slate-700 transition-colors hover:text-slate-950 dark:text-slate-300 dark:hover:text-white sm:inline-block"
              >
                {t('Đăng Nhập')}
              </Link>
              <Link
                to="/booking"
                className="group inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-sky-700 dark:bg-white dark:text-slate-950 dark:hover:bg-cyan-200"
              >
                <span>{t('Thuê Kho Ngay')}</span>
                <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
              </Link>
            </>
          )}

          <button
            type="button"
            aria-label="Menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-slate-800 ring-1 ring-slate-200 lg:hidden dark:text-white dark:ring-slate-700"
          >
            <span
              className={`absolute h-px w-4 bg-current transition-transform duration-300 ${
                mobileOpen ? 'rotate-45' : '-translate-y-1'
              }`}
            />
            <span
              className={`absolute h-px w-4 bg-current transition-transform duration-300 ${
                mobileOpen ? '-rotate-45' : 'translate-y-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* ---------- mobile panel ---------- */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className="overflow-hidden border-t border-slate-200 bg-white lg:hidden dark:border-slate-800 dark:bg-slate-950"
            aria-label="Mobile"
          >
            <ul className="mx-auto max-w-[1320px] space-y-1 px-5 py-4 sm:px-8">
              {[...SOLUTION_LINKS.map((s) => ({ href: s.href, label: s.title })), ...NAV_LINKS].map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-between rounded-xl px-3 py-3 text-[15px] font-medium text-slate-800 hover:bg-sky-50 dark:text-slate-100 dark:hover:bg-slate-900"
                  >
                    {t(l.label)}
                    <span aria-hidden className="text-slate-400">→</span>
                  </a>
                </li>
              ))}
              {!isAuthenticated && (
                <li>
                  <Link
                    to="/login"
                    className="block rounded-xl px-3 py-3 text-[15px] font-medium text-slate-800 hover:bg-sky-50 dark:text-slate-100"
                  >
                    {t('Đăng Nhập')}
                  </Link>
                </li>
              )}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  )
}

