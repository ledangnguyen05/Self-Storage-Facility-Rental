import { useCallback, useMemo } from 'react'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getAssignmentStaffName, staffAssignmentService, type StaffAssignmentResponse } from '@/services/staffAssignmentService'
import { userService } from '@/services/userService'
import type { User } from '@/types'
import { compareShifts } from './shiftRules'

export interface RosterRow {
  key: string
  staffId: string
  name: string
  email?: string
  phone?: string
  avatar?: string
  /** Facility the person belongs to (used in the "all facilities" scope). */
  facilityId?: string
  facilityName?: string
  /** Account state, not shift state. */
  isActive: boolean
  /** Assignments of this person on the selected day. */
  assignments: StaffAssignmentResponse[]
}

export interface ShiftRoster {
  rows: RosterRow[]
  /** Active staff (of the facility, or of every facility), for the assignment form. */
  activeStaff: User[]
  assignmentCount: number
  isLoading: boolean
  error: unknown
  isRefreshing: boolean
  reload: () => Promise<void>
  reloadBoard: () => Promise<void>
}

/**
 * Staff joined with their shift assignments for one day. With `facilityId` undefined (admin / business manager in the
 * "all facilities" scope) both the staff list and the daily board span every facility.
 */
export function useShiftRoster(facilityId: string | undefined, date: string): ShiftRoster {
  const staffQuery = useAsyncData(
    async (signal) => (await userService.getAllUsers({ role: 'STAFF', facilityId, size: 200 }, { signal })).data,
    [facilityId],
    { keepPreviousData: false },
  )
  const boardQuery = useAsyncData((signal) => staffAssignmentService.getDailyBoard(facilityId, date, { signal }), [facilityId, date], {
    keepPreviousData: false,
  })

  const rows = useMemo<RosterRow[]>(() => {
    const board = boardQuery.data ?? []
    const byStaff = new Map<string, StaffAssignmentResponse[]>()
    for (const assignment of board) {
      byStaff.set(assignment.staffId, [...(byStaff.get(assignment.staffId) ?? []), assignment])
    }
    for (const [staffId, list] of byStaff) byStaff.set(staffId, [...list].sort(compareShifts))
    const staff = staffQuery.data ?? []
    const known = new Set(staff.map((member) => member.id))
    const fromStaff: RosterRow[] = staff.map((member) => ({
      key: member.id,
      staffId: member.id,
      name: member.fullName || member.username,
      email: member.email,
      phone: member.phone,
      avatar: member.avatar,
      facilityId: member.facilityId,
      facilityName: member.facilityName,
      isActive: member.isActive !== false,
      assignments: byStaff.get(member.id) ?? [],
    }))
    // People on the board who are not in the staff list (moved or deactivated) still show up.
    const fromBoard: RosterRow[] = [...byStaff.entries()]
      .filter(([staffId]) => !known.has(staffId))
      .map(([staffId, assignments]) => ({
        key: staffId,
        staffId,
        name: getAssignmentStaffName(assignments[0]),
        email: assignments[0].staffEmail,
        phone: assignments[0].staffPhone,
        avatar: assignments[0].staffAvatar,
        facilityId: assignments[0].facilityId,
        facilityName: assignments[0].facilityName,
        isActive: true,
        assignments,
      }))
    return [...fromStaff, ...fromBoard]
  }, [staffQuery.data, boardQuery.data])

  const activeStaff = useMemo(() => (staffQuery.data ?? []).filter((member) => member.isActive !== false), [staffQuery.data])

  const staffReload = staffQuery.reload
  const boardReload = boardQuery.reload
  const reload = useCallback(async () => {
    await Promise.all([staffReload(), boardReload()])
  }, [staffReload, boardReload])

  return {
    rows,
    activeStaff,
    assignmentCount: boardQuery.data?.length ?? 0,
    isLoading: staffQuery.isLoading || boardQuery.isLoading,
    error: staffQuery.error ?? boardQuery.error,
    isRefreshing: staffQuery.isRefreshing || boardQuery.isRefreshing,
    reload,
    reloadBoard: boardReload,
  }
}
