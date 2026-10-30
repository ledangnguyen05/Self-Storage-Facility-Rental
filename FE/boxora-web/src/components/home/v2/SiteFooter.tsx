import React from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../../context/LanguageContext'
import { BrandLogo } from '../../common/BrandLogo'
import { Container } from './motion'

type PolicyKey = 'deposit' | 'insurance' | 'contract' | 'prohibited'

const NAV: { href: string; label: string }[] = [
  { href: '#about', label: 'Về Boxora' },
  { href: '#process', label: 'Quy trình thuê' },
  { href: '#services', label: 'Loại kho' },
  { href: '#iot-access', label: 'Khóa IoT 24/7' },
  { href: '#size-guide', label: 'Hướng dẫn chọn kích cỡ' },
  { href: '#trust', label: 'Cam kết' },
  { href: '#faq', label: 'Câu hỏi thường gặp' },
]

const POLICIES: { key: PolicyKey; label: string }[] = [
  { key: 'deposit', label: 'Chính sách tiền cọc & hoàn trả' },
  { key: 'insurance', label: 'Bảo hiểm tài sản' },
  { key: 'contract', label: 'Hợp đồng thuê' },
  { key: 'prohibited', label: 'Danh mục hàng cấm & PCCC' },
]

const FACILITIES: { name: string; address: string }[] = [
  { name: 'Boxora Quận 1', address: '123 Nguyễn Huệ, P. Bến Nghé, Quận 1, TP.HCM' },
  { name: 'Boxora Quận 7 (Nam Sài Gòn)', address: '456 Nguyễn Hữu Thọ, P. Tân Hưng, Quận 7, TP.HCM' },
  { name: 'Boxora Thủ Đức Hub', address: '789 Võ Văn Ngân, P. Linh Chiểu, TP. Thủ Đức, TP.HCM' },
  { name: 'Boxora Tân Bình Mega Hub', address: '102 Trường Sơn, Phường 2, Quận Tân Bình, TP.HCM' },
]

const linkCls =
  'text-sm text-slate-600 transition-colors hover:text-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:text-slate-400 dark:hover:text-cyan-300'

const headCls =
  'text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500'

export const SiteFooter: React.FC = () => {
  const { t } = useLanguage()

  const openPolicy = (key: PolicyKey) => {
    window.dispatchEvent(new CustomEvent('boxora:open-policy', { detail: key }))
    if (window.location.hash !== '#policies') window.location.hash = '#policies'
  }

  return (
    <footer className="relative overflow-hidden border-t border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white">
      <Container className="pt-20 sm:pt-24">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <BrandLogo size="md" subtitle="SMART STORAGE SYSTEMS" />
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {t(
                'Hệ thống phòng kho tự quản thông minh đầu tiên tại Việt Nam ứng dụng khóa bảo mật IoT, kiểm soát vi khí hậu 24/7 và cấp mã PIN truy cập số hóa tức thời.'
              )}
            </p>
            <a
              href="tel:1900269672"
              className="mt-8 inline-flex flex-col focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600"
            >
              <span className={headCls}>{t('Hotline 24/7')}</span>
              <span className="mt-1 text-2xl font-semibold tracking-tight text-sky-700 dark:text-cyan-300">
                1900-BOXORA
              </span>
            </a>
          </div>

          <nav aria-label={t('Điều hướng')} className="lg:col-span-2">
            <h4 className={headCls}>{t('Khám phá')}</h4>
            <ul className="mt-5 space-y-3">
              {NAV.map((n) => (
                <li key={n.href}>
                  <a href={n.href} className={linkCls}>
                    {t(n.label)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="lg:col-span-3">
            <h4 className={headCls}>{t('Chính sách & quy định')}</h4>
            <ul className="mt-5 space-y-3">
              {POLICIES.map((p) => (
                <li key={p.key}>
                  <a href="#policies" onClick={() => openPolicy(p.key)} className={linkCls}>
                    {t(p.label)}
                  </a>
                </li>
              ))}
            </ul>
            <h4 className={`${headCls} mt-10`}>{t('Tài khoản')}</h4>
            <ul className="mt-5 space-y-3">
              <li>
                <Link to="/booking" className={linkCls}>
                  {t('Dashboard Tìm Kho')}
                </Link>
              </li>
              <li>
                <Link to="/login" className={linkCls}>
                  {t('Đăng Nhập')}
                </Link>
              </li>
              <li>
                <Link to="/register" className={linkCls}>
                  {t('Đăng Ký')}
                </Link>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h4 className={headCls}>{t('Hệ thống 4 cơ sở kho')}</h4>
            <ul className="mt-5 space-y-5">
              {FACILITIES.map((f, i) => (
                <li key={f.name} className="flex gap-4">
                  <span className="pt-0.5 text-xs font-semibold tabular-nums text-sky-700 dark:text-cyan-300">
                    0{i + 1}
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{t(f.name)}</div>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                      {t(f.address)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-20 flex flex-col items-start justify-between gap-4 border-t border-slate-200 py-6 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center">
          <p>{t('© 2026 Boxora Smart Storage. Tất cả các quyền được bảo lưu.')}</p>
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault()
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="inline-flex items-center gap-2 transition-colors hover:text-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:hover:text-cyan-300"
          >
            <span aria-hidden>↑</span>
            {t('Về đầu trang')}
          </a>
        </div>
      </Container>

      <div aria-hidden className="select-none overflow-hidden pb-4 text-center leading-none">
        <span className="block translate-y-[0.12em] text-[clamp(5rem,23vw,22rem)] font-semibold tracking-[-0.05em] text-sky-700/[0.07] dark:text-cyan-300/[0.08]">
          BOXORA
        </span>
      </div>
    </footer>
  )
}
