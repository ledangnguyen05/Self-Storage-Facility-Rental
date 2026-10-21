import React from 'react'
import { Check } from 'lucide-react'
import { TERMS_INTRO, TERMS_MODULES, type TermsModule } from '../../data/termsContent'
import { Button, Card, CardContent, Modal } from '../ui'
import { cn } from '../ui/cn'

export interface TermsAndStandardsModalProps {
  isOpen: boolean
  onClose: () => void
  /** Shows a "Tôi đồng ý" button that calls this and closes the dialog. */
  onAccept?: () => void
}

/** One section of the terms (icon, headline fact, clauses). Shared with TermsAndStandardsPage. */
export function TermsModuleCard({
  module,
  className,
  headingAs: Heading = 'h2',
}: {
  module: TermsModule
  className?: string
  headingAs?: 'h2' | 'h3'
}) {
  const Icon = module.icon
  return (
    <Card id={module.id} className={cn('h-full scroll-mt-24', className)}>
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent-text">
            <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <Heading className="text-base font-semibold text-fg">{module.title}</Heading>
            <p className="mt-0.5 text-dense text-fg-muted">{module.summary}</p>
          </div>
        </div>

        <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-md bg-surface-2 px-3 py-2">
          <span className="text-xs text-fg-subtle">{module.highlight.label}</span>
          <span className="text-sm font-semibold text-fg tabular-nums">{module.highlight.value}</span>
        </p>

        <dl className="space-y-3">
          {module.items.map(item => (
            <div key={item.label}>
              <dt className="flex items-start gap-2 text-sm font-medium text-fg">
                <Check size={14} strokeWidth={2} aria-hidden="true" className="mt-1 shrink-0 text-success" />
                {item.label}
              </dt>
              <dd className="mt-0.5 pl-6 text-dense text-fg-muted">{item.detail}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

/** Terms and standards in a dialog (used before accepting them, e.g. on registration). */
export const TermsAndStandardsModal: React.FC<TermsAndStandardsModalProps> = ({ isOpen, onClose, onAccept }) => (
  <Modal
    open={isOpen}
    onClose={onClose}
    size="xl"
    title={TERMS_INTRO.title}
    description={TERMS_INTRO.description}
    footer={
      <>
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
        {onAccept ? (
          <Button
            onClick={() => {
              onAccept()
              onClose()
            }}
          >
            Tôi đồng ý
          </Button>
        ) : null}
      </>
    }
  >
    <div className="grid gap-4 md:grid-cols-2">
      {TERMS_MODULES.map(module => (
        <TermsModuleCard key={module.id} module={module} headingAs="h3" />
      ))}
    </div>
    <p className="mt-4 text-dense text-fg-subtle">{TERMS_INTRO.note}</p>
  </Modal>
)

export default TermsAndStandardsModal
