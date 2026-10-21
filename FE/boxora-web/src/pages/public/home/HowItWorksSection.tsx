import React from 'react'
import { Card, CardContent } from '../../../components/ui'
import { HOW_IT_WORKS } from '../../../data/homeContent'
import { Section, SectionHeading } from '../components/Section'

export function HowItWorksSection() {
  return (
    <Section id="how-it-works" aria-labelledby="how-it-works-title">
      <SectionHeading id="how-it-works-title" title={HOW_IT_WORKS.title} description={HOW_IT_WORKS.description} />
      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {HOW_IT_WORKS.steps.map(({ icon: Icon, title, description }, index) => (
          <li key={title}>
            <Card className="h-full">
              <CardContent className="flex h-full flex-col gap-4 p-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent tabular-nums">
                    {index + 1}
                  </span>
                  <Icon size={20} strokeWidth={1.75} aria-hidden="true" className="text-fg-subtle" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-fg">{title}</h3>
                  <p className="mt-1.5 text-sm text-fg-muted">{description}</p>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </Section>
  )
}
