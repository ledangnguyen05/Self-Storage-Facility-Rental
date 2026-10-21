import { useAsyncData } from '@/hooks/useAsyncData'
import { supportTicketService } from '@/services/supportTicketService'

/** Ticket statistics and the ticket queue, both scoped to one facility (or the whole chain). */
export function useIncidentData(facilityId: string | undefined) {
  const stats = useAsyncData(signal => supportTicketService.getStats(facilityId, { signal }), [facilityId])
  const queue = useAsyncData(signal => supportTicketService.getQueue({ facilityId }, { signal }), [facilityId])
  const reloadAll = () => Promise.all([stats.reload(), queue.reload()]).then(() => undefined)
  return { stats, queue, reloadAll }
}
