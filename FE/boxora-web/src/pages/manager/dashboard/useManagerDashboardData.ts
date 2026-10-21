import { useCallback, useMemo } from 'react'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorStatus } from '@/lib/apiError'
import { bookingService } from '@/services/bookingService'
import { facilityPolicyService } from '@/services/facilityPolicyService'
import { overdueService, type OverdueLedger } from '@/services/overdueService'
import { storageUnitService } from '@/services/storageUnitService'
import { supportTicketService } from '@/services/supportTicketService'
import type { Booking, FacilityPolicy, StorageUnit } from '@/types'
import type { SupportTicketRecord, SupportTicketStats } from '@/services/supportTicketService'
import { resolvePolicy, type ResolvedFacilityPolicy } from '@/utils/facilityPolicyDefaults'
import { compareUnitCodes } from './unitModel'

export interface ScopedList<T> {
  items: T[]
  isLoading: boolean
  error: unknown
  reload: () => Promise<void>
}

/** Bookings that are being rented or returned, monitored on the "Bàn giao và trả kho" tab. */
export const RENTAL_MONITOR_STATUSES = ['ACTIVE', 'OVERDUE', 'CHECKOUT_REQUESTED', 'INSPECTED'] as const

/**
 * The arrivals endpoint is facility-scoped for staff and facility managers; for business managers and admins the
 * facility is applied here (by facility id, or by the facility's own units for rows without one).
 */
function scopeBookings(bookings: Booking[] | undefined, facilityId: string | undefined, unitIds: ReadonlySet<string> | null): Booking[] {
  if (!bookings || !facilityId) return []
  return bookings.filter((booking) => {
    if (booking.facilityId) return booking.facilityId === facilityId
    return Boolean(unitIds && booking.storageUnitId && unitIds.has(booking.storageUnitId))
  })
}

export interface ManagerDashboardData {
  units: ScopedList<StorageUnit>
  /** Overdue ledger of the facility (GET /overdue/ledger). */
  overdue: { data: OverdueLedger | undefined; isLoading: boolean; error: unknown; reload: () => Promise<void> }
  policy: {
    /** Stored policy, or null when the facility has none yet (404). */
    stored: FacilityPolicy | null
    resolved: ResolvedFacilityPolicy
    isLoading: boolean
    error: unknown
    reload: () => Promise<void>
  }
  /** True when the signed-in user holds an exception grant to edit this facility's policy. */
  hasPolicyException: boolean
  arrivals: ScopedList<Booking>
  /** Booking requests waiting for a manager decision (GET /bookings/pending-approval, usually empty). */
  pendingApprovals: ScopedList<Booking>
  /** Active, overdue and returning rentals of the facility (GET /bookings, facility-scoped by the backend). */
  activeRentals: ScopedList<Booking>
  tickets: ScopedList<SupportTicketRecord>
  ticketStats: { data: SupportTicketStats | undefined; isLoading: boolean; error: unknown; reload: () => Promise<void> }
  isRefreshing: boolean
  reloadAll: () => Promise<void>
}

/** Every query the facility manager overview needs, scoped to one facility. */
export function useManagerDashboardData(facilityId: string | undefined, userId: string | undefined): ManagerDashboardData {
  const enabled = Boolean(facilityId)
  // `isLoading` only turns true after the effect runs; this also covers the first frame once a facility is picked.
  const pending = (query: { isLoading: boolean; data: unknown; error: unknown }) =>
    query.isLoading || (enabled && query.data === undefined && !query.error)

  const unitsQuery = useAsyncData((signal) => storageUnitService.getUnits({ facilityId }, { signal }), [facilityId], {
    enabled,
    keepPreviousData: false,
  })
  const overdueQuery = useAsyncData((signal) => overdueService.getLedger(facilityId, { signal }), [facilityId], {
    enabled,
    keepPreviousData: false,
  })
  const policyQuery = useAsyncData(
    async (signal): Promise<FacilityPolicy | null> => {
      try {
        return await facilityPolicyService.getByFacilityId(facilityId as string, { signal })
      } catch (error) {
        if (getApiErrorStatus(error) === 404) return null
        throw error
      }
    },
    [facilityId],
    { enabled, keepPreviousData: false },
  )
  const policyId = policyQuery.data?.id
  const grantsQuery = useAsyncData(
    async (signal) => {
      try {
        return await facilityPolicyService.getExceptionGrants(policyId as string, { signal })
      } catch {
        return []
      }
    },
    [policyId],
    { enabled: Boolean(policyId) && Boolean(userId), keepPreviousData: false },
  )
  const arrivalsQuery = useAsyncData((signal) => bookingService.getUpcomingArrivals({ signal }), [facilityId], {
    enabled,
    keepPreviousData: false,
  })
  const pendingQuery = useAsyncData((signal) => bookingService.getPendingApprovals({ signal }), [facilityId], {
    enabled,
    keepPreviousData: false,
  })
  const rentalsQuery = useAsyncData(
    (signal) =>
      bookingService.getAll({ facilityId, status: RENTAL_MONITOR_STATUSES.join(','), page: 0, size: 200 }, { signal }),
    [facilityId],
    { enabled, keepPreviousData: false },
  )
  const ticketsQuery = useAsyncData((signal) => supportTicketService.getQueue({ facilityId }, { signal }), [facilityId], {
    enabled,
    keepPreviousData: false,
  })
  const statsQuery = useAsyncData((signal) => supportTicketService.getStats(facilityId, { signal }), [facilityId], {
    enabled,
    keepPreviousData: false,
  })

  const units = useMemo(() => [...(unitsQuery.data ?? [])].sort(compareUnitCodes), [unitsQuery.data])
  const unitIds = useMemo(() => (unitsQuery.data ? new Set(unitsQuery.data.map((unit) => unit.id)) : null), [unitsQuery.data])

  const arrivals = useMemo(() => scopeBookings(arrivalsQuery.data, facilityId, unitIds), [arrivalsQuery.data, facilityId, unitIds])
  const pendingApprovals = useMemo(() => scopeBookings(pendingQuery.data, facilityId, unitIds), [pendingQuery.data, facilityId, unitIds])
  const activeRentals = useMemo(
    () => (rentalsQuery.data?.content ?? []).filter((booking) => !booking.facilityId || booking.facilityId === facilityId),
    [rentalsQuery.data, facilityId],
  )

  const unitsReload = unitsQuery.reload
  const overdueReload = overdueQuery.reload
  const policyReload = policyQuery.reload
  const arrivalsReload = arrivalsQuery.reload
  const rentalsReload = rentalsQuery.reload
  const pendingReload = pendingQuery.reload
  const ticketsReload = ticketsQuery.reload
  const statsReload = statsQuery.reload
  const reloadAll = useCallback(async () => {
    await Promise.all([
      unitsReload(),
      overdueReload(),
      policyReload(),
      arrivalsReload(),
      pendingReload(),
      rentalsReload(),
      ticketsReload(),
      statsReload(),
    ])
  }, [unitsReload, overdueReload, policyReload, arrivalsReload, pendingReload, rentalsReload, ticketsReload, statsReload])

  const hasPolicyException = Boolean(userId && grantsQuery.data?.includes(userId))
  const storedPolicy = policyQuery.data ?? null

  return {
    units: { items: units, isLoading: pending(unitsQuery), error: unitsQuery.error, reload: unitsReload },
    overdue: { data: overdueQuery.data, isLoading: pending(overdueQuery), error: overdueQuery.error, reload: overdueReload },
    policy: {
      stored: storedPolicy,
      resolved: resolvePolicy(storedPolicy, facilityId),
      isLoading: pending(policyQuery),
      error: policyQuery.error,
      reload: policyReload,
    },
    hasPolicyException,
    arrivals: {
      items: arrivals,
      isLoading: pending(arrivalsQuery) || pending(unitsQuery),
      error: arrivalsQuery.error,
      reload: arrivalsReload,
    },
    pendingApprovals: {
      items: pendingApprovals,
      isLoading: pending(pendingQuery) || pending(unitsQuery),
      error: pendingQuery.error,
      reload: pendingReload,
    },
    activeRentals: {
      items: activeRentals,
      isLoading: pending(rentalsQuery),
      error: rentalsQuery.error,
      reload: rentalsReload,
    },
    tickets: {
      items: ticketsQuery.data ?? [],
      isLoading: pending(ticketsQuery),
      error: ticketsQuery.error,
      reload: ticketsReload,
    },
    ticketStats: { data: statsQuery.data, isLoading: pending(statsQuery), error: statsQuery.error, reload: statsReload },
    isRefreshing:
      unitsQuery.isRefreshing ||
      overdueQuery.isRefreshing ||
      policyQuery.isRefreshing ||
      arrivalsQuery.isRefreshing ||
      pendingQuery.isRefreshing ||
      rentalsQuery.isRefreshing ||
      ticketsQuery.isRefreshing ||
      statsQuery.isRefreshing,
    reloadAll,
  }
}
