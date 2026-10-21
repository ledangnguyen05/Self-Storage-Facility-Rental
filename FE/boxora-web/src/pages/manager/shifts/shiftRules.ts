import { todayISO } from '@/lib/format'
import type { StaffAssignmentResponse } from '@/services/staffAssignmentService'

/** Order in which one person's shifts are listed: morning, afternoon, night, then the full-day shift. */
export const SHIFT_ORDER: readonly string[] = ['MORNING', 'AFTERNOON', 'NIGHT', 'FULL_DAY']

export const compareShifts = (a: Pick<StaffAssignmentResponse, 'shift'>, b: Pick<StaffAssignmentResponse, 'shift'>) =>
  SHIFT_ORDER.indexOf(String(a.shift)) - SHIFT_ORDER.indexOf(String(b.shift))

/** Shift, zone and role can only change while the shift is still upcoming (the backend enforces the same rule). */
export function canEditShiftDetails(assignment: Pick<StaffAssignmentResponse, 'status' | 'assignedDate'>, today = todayISO()): boolean {
  return assignment.status === 'ASSIGNED' && assignment.assignedDate >= today
}

/**
 * Statuses the manager may move an assignment to, current one first. Mirrors the backend rules: check in only on the shift
 * day, complete or mark absent not before it, nothing out of a completed shift.
 */
export function allowedStatuses(assignment: Pick<StaffAssignmentResponse, 'status' | 'assignedDate'>, today = todayISO()): string[] {
  const { status, assignedDate } = assignment
  const next: string[] = []
  if (status === 'ASSIGNED') {
    if (assignedDate === today) next.push('CHECKED_IN')
    if (assignedDate <= today) next.push('ABSENT')
  } else if (status === 'CHECKED_IN') {
    if (assignedDate <= today) next.push('COMPLETED')
  } else if (status === 'ABSENT') {
    if (assignedDate >= today) next.push('ASSIGNED')
    if (assignedDate === today) next.push('CHECKED_IN')
  }
  return [status, ...next]
}
