import { api } from '../lib/axios'
import type { RequestOptions } from '../types'

export interface PricingQuoteRequest {
  storageUnitId: string;
  rentalMonths: number;
  discountCode?: string;
  startDate?: string;
  /** True when quoting a renewal: skips the facility's minimum-rental rule (it only applies to new bookings). */
  renewal?: boolean;
}

/** Where the monthly price comes from, in priority order. */
export type PriceSource = 'FACILITY_POLICY' | 'UNIT' | 'UNIT_TYPE'

/**
 * The server quote: the single source of money. The listed price on a unit card, this quote and the amount
 * charged use the same rule, so `monthlyPrice` always equals the card price.
 */
export interface PricingQuoteResponse {
  storageUnitId: string;
  unitCode: string;
  unitTypeName: string;
  facilityId: string;
  facilityName: string;
  rentalMonths: number;
  startDate: string;
  endDate: string;
  monthlyPrice: number;
  /** Older name of `monthlyPrice`. */
  monthlyRate: number;
  priceSource?: PriceSource;
  subtotalRentalFee: number;
  /** A voucher code, or `TERM_xxPCT` when the term discount applied. */
  discountCode?: string;
  /** Rounded percent (older field). */
  discountPercentage?: number;
  /** Exact percent, may have decimals. */
  discountPercent?: number;
  discountAmount: number;
  totalRentalFee: number;
  depositPercentage?: number;
  depositAmount: number;
  initialPaymentAmount: number;
  totalContractValue: number;
  refundSlaDays: number;
  cancellationPolicy: string;
  holdGraceHours?: number;
  maxHoldDays?: number;
}

/** Rent for `months` or more is discounted by `percent` % (facility price list, or the system tiers). */
export interface TermDiscount {
  months: number;
  percent: number;
}

export const pricingService = {
  /** An invalid `discountCode` is rejected with HTTP 400 and a Vietnamese message (use `getApiErrorMessage`). */
  async getQuote(data: PricingQuoteRequest, opts?: RequestOptions): Promise<PricingQuoteResponse> {
    const res = await api.post('/api/v1/pricing/quote', data, { signal: opts?.signal })
    return (res.data?.data || res.data) as PricingQuoteResponse
  },

  /** Discount ladder that applies to this unit, to show before the customer picks a term. */
  async getTermDiscounts(storageUnitId: string, opts?: RequestOptions): Promise<TermDiscount[]> {
    const res = await api.get('/api/v1/pricing/term-discounts', { params: { storageUnitId }, signal: opts?.signal })
    return (res.data?.data || []) as TermDiscount[]
  },
}
