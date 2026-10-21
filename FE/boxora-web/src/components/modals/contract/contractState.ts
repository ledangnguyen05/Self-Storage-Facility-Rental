import type { RentalContract } from '../../../types'

/** Statuses a contract can only reach after it has been signed. */
const SIGNED_STATUSES = new Set(['ACTIVE', 'PENDING_ACTIVATION', 'OVERDUE', 'OVERDUE_LOCKED', 'EXPIRED'])

export function isContractSigned(contract: RentalContract): boolean {
  return Boolean(contract.signedAt) || SIGNED_STATUSES.has(contract.status)
}
