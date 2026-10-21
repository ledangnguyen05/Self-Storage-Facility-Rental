import { ImageOff } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import { EvidenceViewer } from '../../components/EvidenceViewer'

/**
 * The images attached to a ticket: thumbnails with an inline viewer (it opens inside the drawer, no second
 * overlay), or an empty state when nobody attached any. Uploaded files load through the `/uploads` proxy.
 */
export function EvidenceGallery({ urls }: { urls: string[] }) {
  if (urls.length === 0) {
    return <EmptyState size="sm" icon={ImageOff} title="Chưa có ảnh minh chứng" description="Ticket này không đính kèm hình ảnh." />
  }
  return <EvidenceViewer urls={urls} label="Ảnh minh chứng" />
}
