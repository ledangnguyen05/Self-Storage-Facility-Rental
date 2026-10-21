import { useCallback } from 'react'
import { useAsyncData } from '@/hooks/useAsyncData'
import { usePolling } from '@/hooks/usePolling'
import { isRequestCanceled } from '@/lib/apiError'
import { bookingService } from '@/services/bookingService'
import { contractService } from '@/services/contractService'
import { paymentService, type PaymentItem } from '@/services/paymentService'
import { supportTicketService, type SupportTicketRecord } from '@/services/supportTicketService'
import type { Booking, RentalContract } from '@/types'
import { REQUESTS_POLL_MS } from '../constants'

export interface PortalResource<T> {
  data: T[]
  error: unknown
  isLoading: boolean
  isRefreshing: boolean
  reload: () => Promise<void>
}

const EMPTY: never[] = []

/** `my-bookings`, falling back to `my-active` when the history endpoint fails (older backends). */
async function loadMyBookings(signal: AbortSignal): Promise<Booking[]> {
  try {
    return await bookingService.getMyBookings(undefined, { signal })
  } catch (err) {
    if (isRequestCanceled(err) || signal.aborted) throw err
    try {
      return await bookingService.getMyActive(undefined, { signal })
    } catch {
      throw err
    }
  }
}

function useResource<T>(fetcher: (signal: AbortSignal) => Promise<T[]>, userId: string | undefined): PortalResource<T> {
  const { data, error, isLoading, isRefreshing, reload } = useAsyncData<T[]>(fetcher, [userId], {
    enabled: Boolean(userId),
    initialData: EMPTY,
  })
  return { data: data ?? EMPTY, error, isLoading, isRefreshing, reload }
}

/**
 * Every list the customer portal shows, one `useAsyncData` per resource.
 * Booking requests and bookings poll while `pollBookings` is true (the
 * "Kho của tôi" and "Đặt chỗ" tabs), and both refresh on each tick.
 */
export function useCustomerPortalData(userId: string | undefined, { pollBookings }: { pollBookings: boolean }) {
  const contracts = useResource<RentalContract>(
    signal => contractService.getMyContracts({ size: 50 }, { signal }).then(page => page.content ?? []),
    userId,
  )
  const bookings = useResource<Booking>(loadMyBookings, userId)
  const requests = useResource<Booking>(signal => bookingService.getMyRequests({ signal }), userId)
  const payments = useResource<PaymentItem>(signal => paymentService.getMyPayments({ signal }), userId)
  const tickets = useResource<SupportTicketRecord>(signal => supportTicketService.getMyTickets(undefined, { signal }), userId)

  const reloadBookings = bookings.reload
  const reloadRequests = requests.reload
  const reloadContracts = contracts.reload
  const reloadPayments = payments.reload

  const refreshBookingLists = useCallback(
    () => Promise.all([reloadRequests(), reloadBookings()]).then(() => undefined),
    [reloadRequests, reloadBookings],
  )

  /** After a booking, payment, contract or cancellation change. */
  const reloadAfterBookingChange = useCallback(
    () => Promise.all([reloadBookings(), reloadRequests(), reloadContracts(), reloadPayments()]).then(() => undefined),
    [reloadBookings, reloadRequests, reloadContracts, reloadPayments],
  )

  usePolling(refreshBookingLists, REQUESTS_POLL_MS, Boolean(userId) && pollBookings)

  return { contracts, bookings, requests, payments, tickets, refreshBookingLists, reloadAfterBookingChange }
}

export type CustomerPortalData = ReturnType<typeof useCustomerPortalData>
