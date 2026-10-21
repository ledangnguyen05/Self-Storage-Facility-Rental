import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Phone } from 'lucide-react'
import { buttonVariants } from '../../../components/ui/buttonVariants'
import { SITE_CONFIG } from '../../../constants/siteConfig'
import { FINAL_CTA } from '../../../data/homeContent'
import { Container } from '../components/Section'

export function FinalCtaSection() {
  return (
    <section aria-labelledby="final-cta-title" className="border-t border-line bg-canvas py-16 sm:py-20">
      <Container>
        <div className="rounded-xl border border-accent-line bg-accent-subtle px-6 py-12 text-center sm:px-12">
          <h2 id="final-cta-title" className="text-3xl font-semibold tracking-tight text-fg">
            {FINAL_CTA.title}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-fg-muted">{FINAL_CTA.description}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/units" className={buttonVariants({ size: 'lg' })}>
              {FINAL_CTA.primary}
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <a href={SITE_CONFIG.hotline.href} className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
              <Phone size={16} strokeWidth={1.75} aria-hidden="true" />
              {FINAL_CTA.secondary}
            </a>
          </div>
        </div>
      </Container>
    </section>
  )
}
