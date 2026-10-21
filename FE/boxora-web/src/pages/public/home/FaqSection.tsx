import React, { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Tabs, cn } from '../../../components/ui'
import { FAQ_CATEGORIES, FAQ_ITEMS, type FaqCategoryId } from '../../../data/homeContent'
import { Section, SectionHeading } from '../components/Section'

export function FaqSection() {
  const [category, setCategory] = useState<FaqCategoryId>('ALL')
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0]?.id ?? null)

  const visible = useMemo(
    () => (category === 'ALL' ? FAQ_ITEMS : FAQ_ITEMS.filter(item => item.category === category)),
    [category],
  )

  const handleCategoryChange = (next: FaqCategoryId) => {
    setCategory(next)
    // Keep exactly one answer open that belongs to the new list.
    const first = next === 'ALL' ? FAQ_ITEMS[0] : FAQ_ITEMS.find(item => item.category === next)
    setOpenId(first?.id ?? null)
  }

  return (
    <Section id="faq" aria-labelledby="faq-title">
      <SectionHeading id="faq-title" title="Câu hỏi thường gặp" description="Giải đáp nhanh trước khi bạn đặt kho." />

      <div className="mt-8 max-w-full overflow-x-auto scrollbar-none">
        <Tabs
          variant="segmented"
          size="sm"
          aria-label="Nhóm câu hỏi"
          value={category}
          onValueChange={handleCategoryChange}
          items={FAQ_CATEGORIES.map(({ id, label }) => ({ value: id, label }))}
        />
      </div>

      <div className="mt-6 max-w-3xl divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {visible.map(item => {
          const open = item.id === openId
          const buttonId = `faq-button-${item.id}`
          const panelId = `faq-panel-${item.id}`
          return (
            <div key={item.id}>
              <h3>
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenId(open ? null : item.id)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-fg transition-colors hover:bg-surface-2"
                >
                  <span>{item.question}</span>
                  <ChevronDown
                    size={16}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className={cn('shrink-0 text-fg-subtle transition-transform', open && 'rotate-180')}
                  />
                </button>
              </h3>
              <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open} className="px-5 pb-4 text-sm text-fg-muted">
                {item.answer}
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
