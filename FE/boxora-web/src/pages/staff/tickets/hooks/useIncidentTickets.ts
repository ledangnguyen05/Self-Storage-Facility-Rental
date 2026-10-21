import { useCallback, useMemo, useState } from 'react'
import { useToast } from '@/components/ui'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import {
  supportTicketService,
  type CreateSupportTicketRequest,
  type SupportTicketRecord,
} from '@/services/supportTicketService'
import { buildTicketKpis } from '../ticketUtils'

const NO_TICKETS: SupportTicketRecord[] = []

interface Messages {
  success: string
  error: string
}

export interface AssignPayload {
  assignedStaffId: string
  notes?: string
  priority?: string
}

/**
 * The ticket queue of the current facility scope, its KPI values and every
 * mutation. Each mutation toasts the result, reloads the queue and resolves to
 * `true` on success so the calling dialog knows when to close.
 */
export function useIncidentTickets(facilityId: string | undefined) {
  const toast = useToast()
  const queue = useAsyncData(signal => supportTicketService.getQueue({ facilityId }, { signal }), [facilityId], {
    keepPreviousData: false,
  })
  const { reload } = queue
  const [takingId, setTakingId] = useState<string | null>(null)

  const tickets = queue.data ?? NO_TICKETS
  const kpis = useMemo(() => buildTicketKpis(tickets), [tickets])

  const run = useCallback(
    async (action: () => Promise<unknown>, messages: Messages): Promise<boolean> => {
      try {
        await action()
      } catch (err) {
        toast.error(messages.error, getApiErrorMessage(err))
        return false
      }
      toast.success(messages.success)
      await reload()
      return true
    },
    [reload, toast]
  )

  const take = useCallback(
    async (ticket: SupportTicketRecord) => {
      setTakingId(ticket.id)
      try {
        return await run(() => supportTicketService.takeTicket(ticket.id), {
          success: 'Đã nhận xử lý ticket',
          error: 'Không thể nhận xử lý ticket',
        })
      } finally {
        setTakingId(null)
      }
    },
    [run]
  )

  const resolve = useCallback(
    (ticket: SupportTicketRecord, note: string) =>
      run(() => supportTicketService.resolveTicket(ticket.id, note), {
        success: 'Đã báo hoàn tất xử lý',
        error: 'Không thể báo hoàn tất ticket',
      }),
    [run]
  )

  const close = useCallback(
    (ticket: SupportTicketRecord, note: string) =>
      run(() => supportTicketService.closeTicket(ticket.id, note), {
        success: 'Đã nghiệm thu và đóng ticket',
        error: 'Không thể đóng ticket',
      }),
    [run]
  )

  const reopen = useCallback(
    (ticket: SupportTicketRecord, reason: string) =>
      run(() => supportTicketService.reopenTicket(ticket.id, reason), {
        success: 'Đã yêu cầu xử lý lại',
        error: 'Không thể yêu cầu xử lý lại',
      }),
    [run]
  )

  const assign = useCallback(
    (ticket: SupportTicketRecord, payload: AssignPayload) =>
      run(() => supportTicketService.assignTicket(ticket.id, payload), {
        success: 'Đã phân công nhân viên',
        error: 'Không thể phân công ticket',
      }),
    [run]
  )

  const create = useCallback(
    (payload: CreateSupportTicketRequest) =>
      run(() => supportTicketService.createTicket(payload), {
        success: 'Đã tạo ticket',
        error: 'Không thể tạo ticket',
      }),
    [run]
  )

  return {
    tickets,
    kpis,
    error: queue.error,
    isLoading: queue.isLoading,
    isRefreshing: queue.isRefreshing,
    reload,
    takingId,
    take,
    resolve,
    close,
    reopen,
    assign,
    create,
  }
}
