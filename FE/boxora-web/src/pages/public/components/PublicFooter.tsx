import React from 'react'
import { Link } from 'react-router-dom'
import { Mail, MapPin, Phone } from 'lucide-react'
import { BrandLogo } from '../../../components/common/BrandLogo'
import { SITE_CONFIG } from '../../../constants/siteConfig'
import { PUBLIC_NAV } from '../../../data/homeContent'
import { Container } from './Section'

const FOOTER_LINK = 'text-sm text-fg-muted transition-colors hover:text-fg'

/** Site footer. Every business fact comes from `SITE_CONFIG`. */
export function PublicFooter() {
  const { company, hotline, headquarters } = SITE_CONFIG

  return (
    <footer data-slot="public-footer" className="border-t border-line bg-surface print:hidden">
      <Container className="py-12">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <BrandLogo size="sm" showText={false} />
            <p className="max-w-xs text-sm text-fg-muted">
              {SITE_CONFIG.brandName} là hệ thống kho tự quản thông minh: thuê kho trực tuyến, ra vào 24/7 bằng mã PIN riêng.
            </p>
          </div>

          <nav aria-label="Dịch vụ">
            <h2 className="text-sm font-semibold text-fg">Dịch vụ</h2>
            <ul className="mt-3 space-y-2">
              {PUBLIC_NAV.map(item => (
                <li key={item.to}>
                  <Link to={item.to} className={FOOTER_LINK}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Hỗ trợ và tài khoản">
            <h2 className="text-sm font-semibold text-fg">Hỗ trợ</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Link to="/terms" className={FOOTER_LINK}>
                  Điều khoản và quy chuẩn
                </Link>
              </li>
              <li>
                <Link to="/login" className={FOOTER_LINK}>
                  Đăng nhập
                </Link>
              </li>
              <li>
                <Link to="/register" className={FOOTER_LINK}>
                  Tạo tài khoản
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="text-sm font-semibold text-fg">Liên hệ</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-fg-muted">
              <li className="flex items-start gap-2">
                <Phone size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-fg-subtle" />
                <a href={hotline.href} className="transition-colors hover:text-fg">
                  {hotline.display} ({hotline.hours})
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Mail size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-fg-subtle" />
                <a href={SITE_CONFIG.supportEmailHref} className="break-all transition-colors hover:text-fg">
                  {SITE_CONFIG.supportEmail}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-fg-subtle" />
                <a
                  href={headquarters.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-fg"
                >
                  {headquarters.name}: {headquarters.address}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-1 border-t border-line pt-6 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {company.legalName}
          </p>
          <p>
            Mã số thuế {company.taxId} · {company.taxIdIssuer}
          </p>
        </div>
      </Container>
    </footer>
  )
}

export default PublicFooter
