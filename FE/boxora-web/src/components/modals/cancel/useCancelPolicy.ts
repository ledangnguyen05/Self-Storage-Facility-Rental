import type { Booking } from '../../../types'
import { facilityPolicyService } from '../../../services/facilityPolicyService'
import { storageUnitService } from '../../../services/storageUnitService'
import { useAsyncData } from '../../../hooks/useAsyncData'
import { getApiErrorStatus } from '../../../lib/apiError'
import { resolvePolicy, type ResolvedFacilityPolicy } from '../../../utils/facilityPolicyDefaults'

export interface BookingFacilityPolicy {
  facilityId: string
  policy: ResolvedFacilityPolicy
}

/**
 * Facility policy that governs a booking. The booking payload carries no
 * facility id, so it is read from the booked unit. A facility without a policy
 * (404) gets the backend defaults through `resolvePolicy`.
 * Resolves `null` when the facility can not be determined.
 */
export function useCancelPolicy(booking: Pick<Booking, 'facilityId' | 'storageUnitId'>) {
  return useAsyncData<BookingFacilityPolicy | null>(
    async (signal) => {
      let facilityId = booking.facilityId
      if (!facilityId && booking.storageUnitId) {
        const unit = await storageUnitService.getById(booking.storageUnitId, { signal })
        facilityId = unit?.facilityId
      }
      if (!facilityId) return null

      try {
        const policy = await facilityPolicyService.getByFacilityId(facilityId, { signal })
        return { facilityId, policy: resolvePolicy(policy, facilityId) }
      } catch (err) {
        if (getApiErrorStatus(err) === 404) return { facilityId, policy: resolvePolicy(null, facilityId) }
        throw err
      }
    },
    [booking.facilityId, booking.storageUnitId],
  )
}
