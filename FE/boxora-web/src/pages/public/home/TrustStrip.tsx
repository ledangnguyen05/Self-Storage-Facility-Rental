import React from 'react'
import { TRUST_ITEMS } from '../../../data/homeContent'
import { Container } from '../components/Section'

export function TrustStrip() {
  return (
    <section aria-label="Lý do tin dùng Boxora" className="border-b border-line bg-canvas">
      <Container>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-5 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_ITEMS.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent-text">
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-fg">{title}</p>
                <p className="text-dense text-fg-muted">{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
