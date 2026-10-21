import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { Badge, Card, CardContent, Skeleton } from '../../../components/ui'
import { SIZE_GUIDE } from '../../../data/homeContent'
import { formatCurrency } from '../../../lib/format'
import { Section, SectionHeading } from '../components/Section'
import type { TierPrices } from './useHomeData'

interface SizeGuideSectionProps {
  prices: TierPrices
  isLoading: boolean
}

export function SizeGuideSection({ prices, isLoading }: SizeGuideSectionProps) {
  return (
    <Section id="size-guide" tone="surface" aria-labelledby="size-guide-title">
      <SectionHeading id="size-guide-title" title={SIZE_GUIDE.title} description={SIZE_GUIDE.description} />
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SIZE_GUIDE.tiers.map(tier => {
          const price = prices[tier.id]
          return (
            <li key={tier.id}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-fg">{tier.name}</h3>
                    <Badge variant="outline" tone="neutral">
                      {tier.areaLabel}
                    </Badge>
                  </div>
                  <p className="text-sm text-fg-muted">{tier.description}</p>

                  <div>
                    <p className="text-xs font-medium text-fg-subtle">Có thể chứa</p>
                    <ul className="mt-2 space-y-1.5">
                      {tier.fits.map(item => (
                        <li key={item} className="flex items-start gap-2 text-dense text-fg-muted">
                          <Check size={14} strokeWidth={2} aria-hidden="true" className="mt-1 shrink-0 text-success" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <p className="text-dense text-fg-subtle">Phù hợp: {tier.bestFor}</p>

                  <div className="mt-auto border-t border-line pt-4">
                    {isLoading ? (
                      <>
                        <p className="text-xs text-fg-subtle">Giá từ</p>
                        <Skeleton className="mt-1 h-6 w-28" />
                      </>
                    ) : price == null ? (
                      // No unit type falls in this tier yet: a dash price and a link to an empty list would only look broken.
                      <>
                        <p className="text-dense text-fg-muted">Hiện chưa có kho thuộc nhóm diện tích này.</p>
                        <Link
                          to="/units"
                          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent-text hover:underline"
                        >
                          Xem các kho hiện có
                          <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
                        </Link>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-fg-subtle">Giá từ</p>
                        <p className="text-lg font-semibold text-fg tabular-nums">
                          {formatCurrency(price)}
                          <span className="text-sm font-normal text-fg-muted"> / tháng</span>
                        </p>
                        <Link
                          to={`/units?size=${tier.bucket}&status=available`}
                          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent-text hover:underline"
                        >
                          Xem kho trống cỡ này
                          <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
                        </Link>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
