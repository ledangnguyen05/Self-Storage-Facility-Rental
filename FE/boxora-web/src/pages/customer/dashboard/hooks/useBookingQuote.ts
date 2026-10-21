import { useAsyncData } from '@/hooks/useAsyncData'
import { pricingService, type PricingQuoteResponse } from '@/services/pricingService'
import { resolveBookingTerm, type BookingPackageId, type BookingTerm } from '../constants'

export interface BookingQuoteState {
  term: BookingTerm
  quote: PricingQuoteResponse | undefined
  error: unknown
  isLoading: boolean
  isRefreshing: boolean
  /** Re-requests the quote; stale responses are ignored by useAsyncData. */
  reload: () => Promise<void>
}

/**
 * Server quote (`POST /pricing/quote`) for a unit, package and start date.
 * The quote is the only source of prices: there is no client-side estimate.
 */
export function useBookingQuote(
  storageUnitId: string | undefined,
  packageId: BookingPackageId,
  customDays: number,
  startDate: string,
): BookingQuoteState {
  const term = resolveBookingTerm(packageId, customDays)
  const { data, error, isLoading, isRefreshing, reload } = useAsyncData<PricingQuoteResponse>(
    signal =>
      pricingService.getQuote(
        { storageUnitId: storageUnitId as string, rentalMonths: term.months, startDate: startDate || undefined },
        { signal },
      ),
    [storageUnitId, term.months, startDate],
    { enabled: Boolean(storageUnitId) },
  )
  return { term, quote: error ? undefined : data, error, isLoading, isRefreshing, reload }
}
