import type { ContractRenewal } from '@/services/contractService'
import type { Booking, RentalContract } from '@/types'

/**
 * Page-level dialogs. Only one is open at a time, so modals never nest:
 * moving from one flow to the next (contract → signature, details →
 * reschedule) replaces the dialog.
 */
export type DashboardDialog =
  /** `renewal`: an open request to show directly (e.g. after signing its addendum). */
  | { type: 'renew'; contract: RentalContract; renewal?: ContractRenewal }
  /** In-app signing of a renewal addendum (test environment, DocuSeal not configured). */
  | { type: 'renewal-sign'; renewal: ContractRenewal; contract?: RentalContract }
  /** Rent due / overdue settlement of a contract, paid through VNPay. */
  | { type: 'pay-outstanding'; contract: RentalContract }
  /** Customer move-out request ("Yêu cầu trả kho"). */
  | { type: 'move-out'; contract: RentalContract; booking?: Booking }
  | { type: 'change-pin'; contract: RentalContract }
  | { type: 'contract'; contract: RentalContract }
  /** Electronic signing: OTP by email, then DocuSeal or the in-app pad. */
  | { type: 'sign'; contract: RentalContract }
  | { type: 'booking-details'; booking: Booking }
  /** `fallbackAmount`: the quote's initial payment, used when the booking does not carry one. */
  | { type: 'pay'; booking: Booking; fallbackAmount?: number }
  | { type: 'reschedule'; booking: Booking; returnToDetails?: boolean }
  | { type: 'cancel'; booking: Booking }
  | { type: 'policy'; facilityId?: string; facilityName?: string }

export type OpenDialog = (dialog: DashboardDialog) => void

/** Pre-fills the support form when the customer reports an issue from a unit card. */
export interface TicketPreset {
  contractId: string
  /** Changes on every request so the form remounts with the preset. */
  nonce: number
}
