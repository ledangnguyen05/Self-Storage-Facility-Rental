import { api } from '../lib/axios'
import { toPageResult } from '../lib/pageResult'
import type { PageResult, RentalContract, RequestOptions } from '../types'
import type { VNPayPayment } from './paymentService'
export type { RentalContract }

/** `ContractRenewalResponse`. */
export interface ContractRenewal {
  id: string
  contractId: string
  contractCode?: string
  customerId?: string
  customerName?: string
  customerEmail?: string
  facilityId?: string
  facilityName?: string
  unitCode?: string
  oldEndDate?: string
  newEndDate?: string
  cycleMonths: number
  /** Total to pay: rentalFeeAmount + lateFeeAmount. */
  renewalFee?: number
  /** Rent of the renewal cycle (pricing quote). */
  rentalFeeAmount?: number
  /** Late fee of an overdue contract, included in renewalFee. */
  lateFeeAmount?: number
  status: 'PENDING_SIGNATURE' | 'PENDING_PAYMENT' | 'COMPLETED' | 'CANCELLED' | string
  paymentId?: string
  paymentStatus?: string
  paid?: boolean
  signed?: boolean
  /** DocuSeal link, or the in-app signing link when DocuSeal is not configured. */
  signingUrl?: string
  /** DOCUSEAL or IN_APP_TEST. */
  signingMethod?: string
  /** True when the addendum is signed in the portal (test environment, DocuSeal not configured). */
  signingSimulated?: boolean
  signedDocumentUrl?: string
  signedAt?: string
  cancelledAt?: string
  cancelReason?: string
  createdAt?: string
  updatedAt?: string
}

export interface ContractOtpResponse {
  expiresInSeconds: number
  resendInSeconds: number
  signingUrl?: string
}

/** `GET /contracts/signing-config`. */
export interface SigningConfig {
  mode: 'DOCUSEAL' | 'SIMULATION'
  simulated: boolean
  otpRequired: boolean
}

/** Renewal states that still need an action from the customer. */
export const OPEN_RENEWAL_STATUSES = new Set(['PENDING_SIGNATURE', 'PENDING_PAYMENT'])

/** The API sends the unit UUID as `unitId` (and `storageUnitId` on newer backends). */
function normalizeContract(contract: RentalContract): RentalContract {
  if (!contract) return contract
  return contract.storageUnitId || !contract.unitId ? contract : { ...contract, storageUnitId: contract.unitId }
}

export const contractService = {
  /** GET /contracts (scoped by the backend to the caller's role). */
  async getMyContracts(
    paramsOrCustomerId?: string | { customerId?: string; facilityId?: string; status?: string; page?: number; size?: number },
    opts?: RequestOptions
  ): Promise<PageResult<RentalContract>> {
    const params = typeof paramsOrCustomerId === 'string'
      ? { customerId: paramsOrCustomerId, size: 100 }
      : { size: 50, ...paramsOrCustomerId }
    const response = await api.get('/api/v1/contracts', { params, signal: opts?.signal })
    const page = toPageResult<RentalContract>(response.data?.data)
    return { ...page, content: page.content.map(normalizeContract) }
  },

  async getById(contractId: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/contracts/${contractId}`, { signal: opts?.signal })
    return normalizeContract(response.data?.data as RentalContract)
  },

  async getSigningConfig(opts?: RequestOptions) {
    const response = await api.get('/api/v1/contracts/signing-config', { signal: opts?.signal })
    return response.data?.data as SigningConfig
  },

  async sendSigningOtp(contractId: string) {
    const response = await api.post(`/api/v1/contracts/${contractId}/otp/send`)
    return response.data?.data as ContractOtpResponse
  },

  async resendSigningOtp(contractId: string) {
    const response = await api.post(`/api/v1/contracts/${contractId}/otp/resend`)
    return response.data?.data as ContractOtpResponse
  },

  async verifySigningOtp(contractId: string, otp: string) {
    const response = await api.post(`/api/v1/contracts/${contractId}/otp/verify`, { otp })
    return response.data?.data as ContractOtpResponse
  },

  /** In-app signing, only when DocuSeal is not configured; requires the verified OTP. */
  async mockSignContract(contractId: string, signatureData?: string) {
    const response = await api.post(`/api/v1/contracts/${contractId}/mock-sign`, { signatureData })
    return normalizeContract(response.data?.data as RentalContract)
  },

  async getSigningUrl(contractId: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/contracts/${contractId}/signing-url`, { signal: opts?.signal })
    return response.data?.data?.signingUrl as string
  },

  /** Resolves null when the booking has no contract yet (or the request fails). */
  async getContractByBookingId(bookingId: string, opts?: RequestOptions): Promise<RentalContract | null> {
    try {
      const response = await api.get(`/api/v1/contracts/booking/${bookingId}`, { signal: opts?.signal })
      return normalizeContract(response.data?.data as RentalContract)
    } catch {
      return null
    }
  },

  async sendForSignature(contractId: string) {
    const response = await api.post(`/api/v1/contracts/${contractId}/send-for-signature`)
    return response.data?.data?.signingUrl as string
  },

  // ---------------------------------------------------------------- renewal

  /** Accepted inside the facility renewal window (`contract.renewable`) or while the contract is overdue. */
  async requestRenewal(contractId: string, cycleMonths: number) {
    const response = await api.post(`/api/v1/contracts/${contractId}/renew`, { cycleMonths })
    return response.data?.data as ContractRenewal
  },

  /** Renewals of a contract, newest first. */
  async getRenewals(contractId: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/contracts/${contractId}/renewals`, { signal: opts?.signal })
    return (response.data?.data || []) as ContractRenewal[]
  },

  async getRenewal(renewalId: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/contracts/renewals/${renewalId}`, { signal: opts?.signal })
    return response.data?.data as ContractRenewal
  },

  /** VNPay link for the renewal fee (amount computed by the server). */
  async createRenewalPayment(renewalId: string) {
    const response = await api.post(`/api/v1/contracts/renewals/${renewalId}/payment`)
    return response.data?.data as VNPayPayment
  },

  /** DocuSeal link of the addendum, or the in-app signing link in the test environment. */
  async getRenewalSigningUrl(renewalId: string) {
    const response = await api.get(`/api/v1/contracts/renewals/${renewalId}/signing-url`)
    return response.data?.data?.signingUrl as string
  },

  /** In-app addendum signing (test environment, DocuSeal not configured). */
  async mockSignRenewal(renewalId: string, signatureData: string) {
    const response = await api.post(`/api/v1/contracts/renewals/${renewalId}/mock-sign`, { signatureData })
    return response.data?.data as ContractRenewal
  },

  async cancelRenewal(renewalId: string, reason?: string) {
    const response = await api.post(`/api/v1/contracts/renewals/${renewalId}/cancel`, { reason: reason?.trim() || undefined })
    return response.data?.data as ContractRenewal
  },
}
