import { api } from '@/lib/axios'

/**
 * POST /api/v1/reports/overdue-debt/{contractId}/send-reminder: emails the overdue notice
 * (days overdue, late fee, total debt) to the tenant. Kept next to the overdue page because
 * `services/` has no wrapper for it yet; move it to `overdueService` when that layer is reopened.
 */
export async function sendOverdueReminder(contractId: string): Promise<void> {
  await api.post(`/api/v1/reports/overdue-debt/${contractId}/send-reminder`)
}
