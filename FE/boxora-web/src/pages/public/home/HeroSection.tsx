import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { StorageProductVisual } from '../../../components/home/StorageProductVisual'
import { Badge } from '../../../components/ui'
import { buttonVariants } from '../../../components/ui/buttonVariants'
import { HERO_CONTENT } from '../../../data/homeContent'
import { formatNumber } from '../../../lib/format'
import { Container } from '../components/Section'
import type { HomeFacilitySummary } from './useHomeData'

interface HeroSectionProps {
  summary: HomeFacilitySummary | null
}

export function HeroSection({ summary }: HeroSectionProps) {
  return (
    <section aria-labelledby="hero-title" className="border-b border-line bg-surface">
      <Container className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2 lg:gap-16">
        <div>
          <Badge tone="accent" size="md">
            {HERO_CONTENT.eyebrow}
          </Badge>
          <h1 id="hero-title" className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-fg sm:text-5xl">
            {HERO_CONTENT.title}
          </h1>
          <p className="mt-5 max-w-xl text-base text-fg-muted sm:text-lg">{HERO_CONTENT.description}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/units?status=available" className={buttonVariants({ size: 'lg' })}>
              {HERO_CONTENT.primaryCta}
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <Link to="/#size-guide" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
              {HERO_CONTENT.secondaryCta}
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {HERO_CONTENT.points.map(point => (
              <li key={point} className="flex items-center gap-2 text-sm text-fg-muted">
                <Check size={16} strokeWidth={2} aria-hidden="true" className="text-success" />
                {point}
              </li>
            ))}
          </ul>

          {summary ? (
            <p className="mt-6 text-dense text-fg-subtle">
              Hiện có <span className="font-medium text-fg tabular-nums">{formatNumber(summary.availableUnits)}</span> kho trống tại{' '}
              <span className="font-medium text-fg tabular-nums">{formatNumber(summary.facilityCount)}</span> cơ sở.
            </p>
          ) : null}
        </div>

        <StorageProductVisual className="mx-auto w-full max-w-md lg:ml-auto lg:max-w-lg" />
      </Container>
    </section>
  )
}
