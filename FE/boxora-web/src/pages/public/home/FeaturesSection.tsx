import React from 'react'
import { FEATURES_CONTENT } from '../../../data/homeContent'
import { Section, SectionHeading } from '../components/Section'

export function FeaturesSection() {
  return (
    <Section id="features" aria-labelledby="features-title">
      <SectionHeading id="features-title" title={FEATURES_CONTENT.title} description={FEATURES_CONTENT.description} />
      <ul className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES_CONTENT.items.map(({ icon: Icon, title, description }) => (
          <li key={title} className="flex gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-accent-text">
              <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-fg">{title}</h3>
              <p className="mt-1 text-sm text-fg-muted">{description}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  )
}
