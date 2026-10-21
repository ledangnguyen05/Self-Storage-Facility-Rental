import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, ExternalLink } from 'lucide-react'
import { buttonVariants } from '../ui/buttonVariants'
import { resolveChatLink } from './chatLinks'

const BOLD = /\*\*([^*]+)\*\*/g
const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g

function renderBold(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(BOLD)) {
    const index = match.index ?? 0
    if (index > last) parts.push(text.slice(last, index))
    parts.push(
      <strong key={`${keyPrefix}-b-${index}`} className="font-semibold text-fg">
        {match[1]}
      </strong>,
    )
    last = index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

interface ChatMessageContentProps {
  content: string
  role: 'user' | 'assistant'
  /** Called after an internal link is followed (the widget closes itself on phones). */
  onNavigate?: () => void
}

const LINK_CLASS = buttonVariants({ variant: 'secondary', size: 'sm', className: 'my-0.5 mr-1' })

/** Plain text for the user; bold and safe `[title](url)` buttons for the assistant. */
export function ChatMessageContent({ content, role, onNavigate }: ChatMessageContentProps) {
  if (role === 'user') return <p className="whitespace-pre-wrap break-words">{content}</p>

  const nodes: React.ReactNode[] = []
  let last = 0
  for (const match of content.matchAll(LINK)) {
    const index = match.index ?? 0
    if (index > last) nodes.push(...renderBold(content.slice(last, index), `t${index}`))

    const [, title, rawUrl] = match
    const target = resolveChatLink(rawUrl)
    if (target.kind === 'internal') {
      nodes.push(
        <Link key={`l${index}`} to={target.to} onClick={onNavigate} className={LINK_CLASS}>
          {title}
          <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
        </Link>,
      )
    } else if (target.kind === 'external') {
      nodes.push(
        <a key={`l${index}`} href={target.href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          {title}
          <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
        </a>,
      )
    } else {
      nodes.push(title)
    }
    last = index + match[0].length
  }
  if (last < content.length) nodes.push(...renderBold(content.slice(last), 'end'))

  return <div className="whitespace-pre-wrap break-words">{nodes}</div>
}
