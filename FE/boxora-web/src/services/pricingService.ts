import { api } from '../lib/axios'

export interface PricingQuoteRequest {
  storageUnitId: string;
  rentalMonths: number;
  discountCode?: string;
  startDate?: string;
}

export interface PricingQuoteResponse {
  storageUnitId: string;
  unitCode: string;
  unitTypeName: string;
  facilityId: string;
  facilityName: string;
  rentalMonths: number;
  startDate: string;
  endDate: string;
  monthlyRate: number;
  subtotalRentalFee: number;
  discountCode?: string;
  discountPercentage?: number;
  discountAmount: number;
  totalRentalFee: number;
  depositAmount: number;
  initialPaymentAmount: number;
  totalContractValue: number;
  refundSlaDays: number;
  cancellationPolicy: string;
  holdGraceHours?: number;
  maxHoldDays?: number;
}

export const pricingService = {
  getQuote: async (data: PricingQuoteRequest): Promise<PricingQuoteResponse> => {
    const res = await api.post('/api/v1/pricing/quote', data);
    return res.data?.data || res.data;
  },
};
