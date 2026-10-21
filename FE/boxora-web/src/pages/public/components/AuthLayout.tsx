import React from 'react'
import { Link } from 'react-router-dom'
import { CreditCard, FileSignature, KeyRound } from 'lucide-react'
import { BrandLogo } from '../../../components/common/BrandLogo'
import { QuickThemeLanguageToggle } from '../../../components/common/QuickThemeLanguageToggle'
import { StorageProductVisual } from '../../../components/home/StorageProductVisual'
import { SITE_CONFIG } from '../../../constants/siteConfig'
import { cn } from '../../../components/ui'

const BRAND_POINTS = [
  { icon: KeyRound, text: 'Ra vào 24/7 bằng mã PIN hoặc mã QR riêng' },
  { icon: FileSignature, text: 'Ký hợp đồng điện tử, theo dõi thời hạn thuê' },
  { icon: CreditCard, text: 'Thanh toán và gia hạn trực tuyến qua VNPay' },
] as const

interface AuthLayoutProps {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  /** Switch-page prompt under the form, e.g. "Chưa có tài khoản? Đăng ký". */
  footer?: React.ReactNode
  /** Form column width: `sm` for login and reset, `md` for registration. */
  width?: 'sm' | 'md'
}

/**
 * Split-screen layout shared by Login, Register and Reset password: the form on
 * the left, a calm brand panel on the right (hidden on small screens).
 */
export function AuthLayout({ title, description, children, footer, width = 'sm' }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-3 px-6 py-5 sm:px-10">
          <BrandLogo size="sm" showText={false} />
          <QuickThemeLanguageToggle />
        </header>

        <main id="main-content" className="flex flex-1 items-center justify-center px-6 py-8 sm:px-10">
          <div className={cn('w-full', width === 'md' ? 'max-w-md' : 'max-w-sm')}>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
            {description ? <p className="mt-2 text-sm text-fg-muted">{description}</p> : null}
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-6 text-center text-sm text-fg-muted">{footer}</div> : null}
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-6 py-5 text-xs text-fg-subtle sm:px-10">
          <Link to="/" className="hover:text-fg">
            Về trang chủ
          </Link>
          <span className="flex flex-wrap items-center gap-x-3">
            <Link to="/terms" className="hover:text-fg">
              Điều khoản và quy chuẩn
            </Link>
            <a href={SITE_CONFIG.hotline.href} className="hover:text-fg">
              Hotline {SITE_CONFIG.hotline.display}
            </a>
          </span>
        </footer>
      </div>

      <aside aria-hidden="true" className="hidden border-l border-line bg-surface-2 lg:flex lg:items-center lg:justify-center lg:px-12">
        <div className="w-full max-w-md space-y-8">
          <div>
            <p className="text-sm font-medium text-accent-text">{SITE_CONFIG.brandName}</p>
            <p className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-fg">Kho tự quản an toàn, thuê trong vài phút</p>
            <p className="mt-3 text-base text-fg-muted">
              Quản lý hợp đồng, mã PIN và thanh toán của bạn tại một nơi.
            </p>
          </div>
          <StorageProductVisual />
          <ul className="space-y-3">
            {BRAND_POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-fg-muted">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-accent-text">
                  <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="pt-1">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}

export default AuthLayout
