import React, { useMemo, useState } from 'react'
import { CalendarCheck, CalendarClock, RefreshCw, UserCheck, UserPlus, Users } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  Input,
  PageHeader,
  Pagination,
  SearchInput,
  StatCard,
  Tabs,
  useToast,
} from '@/components/ui'
import { getShiftMeta } from '@/constants/statusMeta'
import { usePagination } from '@/hooks/usePagination'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatDate, formatNumber, todayISO } from '@/lib/format'
import { getAssignmentStaffName, staffAssignmentService, type StaffAssignmentResponse } from '@/services/staffAssignmentService'
import { usePageTitle } from '@/pages/public/components/usePageTitle'
import { ShiftAssignmentModal } from './modals/ShiftAssignmentModal'
import { ShiftRosterTable } from './shifts/ShiftRosterTable'
import { useShiftRoster, type RosterRow } from './shifts/useShiftRoster'
import { useManagerFacility } from './shared/useManagerFacility'

type RosterFilter = 'all' | 'assigned' | 'unassigned'

export const ShiftRosterPage: React.FC = () => {
  usePageTitle('Ca trực')
  const toast = useToast()
  const { facilityId, facility, facilityName, facilities } = useManagerFacility()
  const [date, setDate] = useState(todayISO)
  const roster = useShiftRoster(facilityId, date)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<RosterFilter>('all')
  const [assignTarget, setAssignTarget] = useState<{ staffId?: string; facilityId: string } | null>(null)
  const [removeTarget, setRemoveTarget] = useState<StaffAssignmentResponse | null>(null)
  const [editTarget, setEditTarget] = useState<StaffAssignmentResponse | null>(null)

  const counts = useMemo(() => {
    const active = roster.rows.filter((row) => row.isActive)
    const assigned = roster.rows.filter((row) => row.assignments.length > 0)
    return {
      active: active.length,
      assigned: assigned.length,
      unassigned: active.filter((row) => row.assignments.length === 0).length,
    }
  }, [roster.rows])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return roster.rows.filter((row) => {
      if (filter === 'assigned' && row.assignments.length === 0) return false
      if (filter === 'unassigned' && row.assignments.length > 0) return false
      if (!needle) return true
      return [row.name, row.email, row.phone, row.facilityName].some((value) => value?.toLowerCase().includes(needle))
    })
  }, [roster.rows, query, filter])

  const pager = usePagination({ items: filtered })
  const isFiltered = filter !== 'all' || query.trim().length > 0
  const canAssign = Boolean(facilityId)
  const assignFacilityId = assignTarget?.facilityId
  const assignFacility = assignFacilityId === facilityId ? facility : facilities.find((item) => item.id === assignFacilityId)
  const assignStaff = useMemo(
    () => roster.activeStaff.filter((member) => !member.facilityId || member.facilityId === assignFacilityId),
    [roster.activeStaff, assignFacilityId],
  )

  const changeFilter = (next: RosterFilter) => {
    setFilter(next)
    pager.reset()
  }
  const changeQuery = (next: string) => {
    setQuery(next)
    pager.reset()
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    try {
      await staffAssignmentService.deleteAssignment(removeTarget.id)
      toast.success('Đã hủy phân công ca trực')
      setRemoveTarget(null)
      await roster.reloadBoard()
    } catch (error) {
      toast.error('Không thể hủy phân công', getApiErrorMessage(error))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ca trực"
        description={`${facilityName ?? 'Tất cả cơ sở'} · lịch trực ngày ${formatDate(date)}`}
        actions={
          <>
            <Input
              type="date"
              aria-label="Ngày xem lịch trực"
              value={date}
              onChange={(event) => event.target.value && setDate(event.target.value)}
              className="w-40"
            />
            {date !== todayISO() ? (
              <Button variant="link" size="sm" onClick={() => setDate(todayISO())}>
                Hôm nay
              </Button>
            ) : null}
            <Button variant="secondary" leftIcon={RefreshCw} loading={roster.isRefreshing} onClick={() => void roster.reload()}>
              Làm mới
            </Button>
            <Button leftIcon={UserPlus} disabled={!canAssign} onClick={() => facilityId && setAssignTarget({ facilityId })}>
              Phân công ca
            </Button>
          </>
        }
      />

      {!canAssign ? (
        <Alert tone="info">
          Đang xem lịch trực của tất cả cơ sở. Bấm Phân công ở từng nhân viên để giao ca tại cơ sở của người đó, hoặc chọn một cơ sở ở
          thanh trên.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Nhân viên đang hoạt động"
          value={formatNumber(counts.active)}
          icon={Users}
          loading={roster.isLoading}
          hint={`${formatNumber(roster.rows.length)} nhân viên trong danh sách`}
        />
        <StatCard
          label="Đã có ca"
          value={formatNumber(counts.assigned)}
          icon={UserCheck}
          tone="success"
          loading={roster.isLoading}
          hint={`Ngày ${formatDate(date)}`}
        />
        <StatCard
          label="Chưa có ca"
          value={formatNumber(counts.unassigned)}
          icon={CalendarClock}
          tone={counts.unassigned > 0 ? 'warning' : 'neutral'}
          loading={roster.isLoading}
          hint="Nhân viên hoạt động, chưa được phân công"
        />
        <StatCard
          label="Lượt phân công"
          value={formatNumber(roster.assignmentCount)}
          icon={CalendarCheck}
          loading={roster.isLoading}
          hint="Tổng số ca đã phân công trong ngày"
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader divider title="Danh sách nhân sự" description="Ca trực của từng nhân viên trong ngày đã chọn" />
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            variant="segmented"
            size="sm"
            aria-label="Lọc nhân sự theo ca"
            value={filter}
            onValueChange={changeFilter}
            items={[
              { value: 'all', label: 'Tất cả', count: roster.rows.length },
              { value: 'assigned', label: 'Đã có ca', count: counts.assigned },
              { value: 'unassigned', label: 'Chưa có ca', count: counts.unassigned },
            ]}
          />
          <SearchInput
            value={query}
            onValueChange={changeQuery}
            placeholder="Tìm tên, email, số điện thoại"
            size="sm"
            className="sm:w-72"
          />
        </div>
        <ShiftRosterTable
          rows={pager.slice(filtered)}
          isLoading={roster.isLoading}
          error={roster.error}
          onRetry={() => void roster.reload()}
          isFiltered={isFiltered}
          showFacility={!facilityId}
          canAssign={(row: RosterRow) => Boolean(facilityId ?? row.facilityId)}
          onAssign={(row: RosterRow) => {
            const target = facilityId ?? row.facilityId
            if (target) setAssignTarget({ staffId: row.staffId, facilityId: target })
          }}
          onEdit={setEditTarget}
          onRemove={setRemoveTarget}
        />
        {filtered.length > 10 ? (
          <Pagination
            page={pager.page}
            pageCount={pager.pageCount}
            total={pager.total}
            pageSize={pager.pageSize}
            onPageChange={pager.setPage}
            onPageSizeChange={pager.setPageSize}
          />
        ) : null}
      </Card>

      {assignTarget ? (
        <ShiftAssignmentModal
          open
          onClose={() => setAssignTarget(null)}
          facilityId={assignTarget.facilityId}
          facility={assignFacility}
          staff={assignStaff}
          defaultStaffId={assignTarget?.staffId}
          defaultDate={date}
          onAssigned={(assignment) => {
            setAssignTarget(null)
            toast.success(
              'Đã phân công ca trực',
              `${getAssignmentStaffName(assignment)} · ${getShiftMeta(assignment.shift).label} · ${formatDate(assignment.assignedDate)}${assignment.assignedZone ? ` · ${assignment.assignedZone}` : ''}`,
            )
            void roster.reloadBoard()
          }}
        />
      ) : null}

      {editTarget ? (
        <ShiftAssignmentModal
          open
          onClose={() => setEditTarget(null)}
          facilityId={editTarget.facilityId}
          facility={editTarget.facilityId === facilityId ? facility : facilities.find((item) => item.id === editTarget.facilityId)}
          staff={[]}
          assignment={editTarget}
          onAssigned={(assignment) => {
            setEditTarget(null)
            toast.success(
              'Đã cập nhật ca trực',
              `${getAssignmentStaffName(assignment)} · ${getShiftMeta(assignment.shift).label} · ${formatDate(assignment.assignedDate)}`,
            )
            void roster.reloadBoard()
          }}
        />
      ) : null}

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        tone="danger"
        title="Hủy phân công ca trực?"
        description={
          removeTarget
            ? `${getAssignmentStaffName(removeTarget)} sẽ không còn trực ${getShiftMeta(removeTarget.shift).label.toLowerCase()} ngày ${formatDate(removeTarget.assignedDate)}.`
            : undefined
        }
        confirmLabel="Hủy phân công"
        onConfirm={confirmRemove}
      />
    </div>
  )
}
