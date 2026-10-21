import React from 'react'
import { Link } from 'react-router-dom'
import { Phone, Printer } from 'lucide-react'
import { TermsModuleCard } from '../../components/common/TermsAndStandardsModal'
import { Alert, Button } from '../../components/ui'
import { buttonVariants } from '../../components/ui/buttonVariants'
import { SITE_CONFIG } from '../../constants/siteConfig'
import { TERMS_INTRO, TERMS_MODULES } from '../../data/termsContent'
import { Container } from './components/Section'
import { PublicLayout } from './components/PublicLayout'
import { usePageTitle } from './components/usePageTitle'

/** Terms and operating standards: one data source (`data/termsContent`), tokens only, printable. */
export const TermsAndStandardsPage: React.FC = () => {
  usePageTitle('Điều khoản và quy chuẩn')

  return (
    <PublicLayout>
      <div className="border-b border-line bg-surface">
        <Container className="flex flex-wrap items-end justify-between gap-4 py-10">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight text-fg">{TERMS_INTRO.title}</h1>
            <p className="mt-3 text-base text-fg-muted">{TERMS_INTRO.description}</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="secondary" leftIcon={Printer} onClick={() => window.print()}>
              In văn bản
            </Button>
            <Link to="/units" className={buttonVariants()}>
              Tìm kho trống
            </Link>
          </div>
        </Container>
      </div>

      <Container className="py-10">
        <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <nav aria-label="Mục lục" className="hidden lg:block print:hidden">
            <div className="sticky top-24">
              <p className="text-xs font-medium text-fg-subtle">Nội dung</p>
              <ul className="mt-3 space-y-1 border-l border-line">
                {TERMS_MODULES.map(module => (
                  <li key={module.id}>
                    <a
                      href={`#${module.id}`}
                      className="-ml-px block border-l border-transparent py-1 pl-3 text-sm text-fg-muted hover:border-fg-subtle hover:text-fg"
                    >
                      {module.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <div className="min-w-0 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {TERMS_MODULES.map(module => (
                <TermsModuleCard key={module.id} module={module} />
              ))}
            </div>

            <Alert tone="info" title="Lưu ý">
              {TERMS_INTRO.note}
            </Alert>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-5 print:hidden">
              <div>
                <p className="text-sm font-semibold text-fg">Cần giải đáp thêm về điều khoản?</p>
                <p className="mt-0.5 text-dense text-fg-muted">
                  Gọi {SITE_CONFIG.hotline.display} ({SITE_CONFIG.hotline.hours}) hoặc email {SITE_CONFIG.supportEmail}.
                </p>
              </div>
              <a href={SITE_CONFIG.hotline.href} className={buttonVariants({ variant: 'secondary' })}>
                <Phone size={16} strokeWidth={1.75} aria-hidden="true" />
                Gọi hotline
              </a>
            </div>
          </div>
        </div>
      </Container>
    </PublicLayout>
  )
}

export default TermsAndStandardsPage
