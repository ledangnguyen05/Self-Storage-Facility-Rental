import { useCallback, useMemo } from 'react'
import { useAsyncData } from '@/hooks/useAsyncData'
import { bookingService } from '@/services/bookingService'
import { storageUnitService } from '@/services/storageUnitService'
import { supportTicketService } from '@/services/supportTicketService'
import type { Booking, StorageUnit } from '@/types'
import { buildReturnQueue, matchesFacility, RETURNABLE_STATUS_FILTER } from '../utils/frontDesk'

export interface QueryState {
  isLoading: boolean
  error: unknown
  reload: () => Promise<void>
}

const asArray = <T,>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : [])

/** Largest page of rentals requested for the return queue. */
const RETURN_QUEUE_SIZE = 200

/**
 * Every list the front desk needs, scoped to one facility. The arrivals list
 * fetched here is the single source for the queue, the KPIs, the workbench and
 * the QR lookup. The backend scopes both booking lists to the staff member's facility
 * (an admin or business manager passes `facilityId`); `matchesFacility` only drops rows
 * that explicitly belong to another facility.
 */
export function useFrontDeskData(facilityId: string | undefined) {
  const arrivalsQuery = useAsyncData((signal) => bookingService.getUpcomingArrivals({ signal }), [facilityId])
  const bookingsQuery = useAsyncData(
    (signal) => {
      // A variable, not a literal: `facilityId` is accepted by GET /bookings (role-scoped) before the typed helper lists it.
      const params = { facilityId, status: RETURNABLE_STATUS_FILTER, size: RETURN_QUEUE_SIZE }
      return bookingService.getAll(params, { signal })
    },
    [facilityId],
  )
  const unitsQuery = useAsyncData(
    (signal) => storageUnitService.getUnits({ facilityId }, { signal }),
    [facilityId],
    { enabled: Boolean(facilityId) },
  )
  const ticketsQuery = useAsyncData(
    (signal) => supportTicketService.getQueue(facilityId ? { facilityId } : undefined, { signal }),
    [facilityId],
  )

  const arrivals = useMemo<Booking[]>(
    () => asArray(arrivalsQuery.data).filter((booking) => booking?.id && matchesFacility(booking, facilityId)),
    [arrivalsQuery.data, facilityId],
  )

  const units = useMemo<StorageUnit[]>(
    () => (facilityId ? asArray(unitsQuery.data).filter((unit) => !unit.facilityId || unit.facilityId === facilityId) : []),
    [unitsQuery.data, facilityId],
  )

  const returns = useMemo(
    () => buildReturnQueue(asArray(bookingsQuery.data?.content), units, facilityId),
    [bookingsQuery.data, units, facilityId],
  )

  const tickets = useMemo(
    () => asArray(ticketsQuery.data).filter((ticket) => !facilityId || !ticket.facilityId || ticket.facilityId === facilityId),
    [ticketsQuery.data, facilityId],
  )

  const { reload: reloadArrivals } = arrivalsQuery
  const { reload: reloadBookings } = bookingsQuery
  const { reload: reloadUnits } = unitsQuery
  const { reload: reloadTickets } = ticketsQuery

  const reloadReturns = useCallback(async () => {
    await Promise.all([reloadBookings(), reloadUnits()])
  }, [reloadBookings, reloadUnits])

  /** After a check-in or a return: arrivals, rentals and the unit map all change. */
  const reloadOperational = useCallback(async () => {
    await Promise.all([reloadArrivals(), reloadBookings(), reloadUnits()])
  }, [reloadArrivals, reloadBookings, reloadUnits])

  // Returns come from two sources: report an error only when neither produced rows.
  const returnsError = bookingsQuery.error && (unitsQuery.error || !facilityId || returns.length === 0) ? bookingsQuery.error : null

  return {
    arrivals,
    arrivalsState: { isLoading: arrivalsQuery.isLoading, error: arrivalsQuery.error, reload: reloadArrivals } satisfies QueryState,
    returns,
    returnsState: {
      isLoading: bookingsQuery.isLoading || (Boolean(facilityId) && unitsQuery.isLoading),
      error: returnsError,
      reload: reloadReturns,
    } satisfies QueryState,
    units,
    unitsState: { isLoading: unitsQuery.isLoading, error: unitsQuery.error, reload: reloadUnits } satisfies QueryState,
    tickets,
    ticketsState: { isLoading: ticketsQuery.isLoading, error: ticketsQuery.error, reload: reloadTickets } satisfies QueryState,
    reloadOperational,
  }
}

export type FrontDeskData = ReturnType<typeof useFrontDeskData>
