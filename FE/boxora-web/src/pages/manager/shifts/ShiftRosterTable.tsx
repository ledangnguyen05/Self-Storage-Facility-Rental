import { CalendarOff, Pencil, Trash2, UserPlus } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableError,
  TableHead,
  TableHeader,
  TableLoading,
  TableRow,
} from '@/components/ui'
import { getShiftMeta, getStaffAssignmentStatusMeta } from '@/constants/statusMeta'
import { getApiErrorMessage } from '@/lib/apiError'
import { getAssignmentStaffName, type StaffAssignmentResponse } from '@/services/staffAssignmentService'
import type { RosterRow } from './useShiftRoster'

interface ShiftRosterTableProps {
  rows: RosterRow[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
  isFiltered: boolean
  /** Every facility is listed: show the facility column. */
  showFacility: boolean
  /** Whether a row can receive a new assignment (a facility must be known). */
  canAssign: (row: RosterRow) => boolean
  onAssign: (row: RosterRow) => void
  onEdit: (assignment: StaffAssignmentResponse) => void
  onRemove: (assignment: StaffAssignmentResponse) => void
}

function AssignmentLine({
  assignment,
  onEdit,
  onRemove,
}: {
  assignment: StaffAssignmentResponse
  onEdit: (assignment: StaffAssignmentResponse) => void
  onRemove: (assignment: StaffAssignmentResponse) => void
}) {
  const shift = getShiftMeta(assignment.shift)
  const status = getStaffAssignmentStatusMeta(assignment.status)
  return (
    <div className="flex items-center gap-2">
      <Badge tone="neutral">{shift.label}</Badge>
      {assignment.assignedZone ? <span className="min-w-0 truncate text-dense text-fg-muted">{assignment.assignedZone}</span> : null}
      <Badge tone={status.tone} size="sm" dot>
        {status.label}
      </Badge>
      <IconButton
        icon={Pencil}
        size="sm"
        aria-label={`Chỉnh sửa ${shift.label.toLowerCase()} của ${getAssignmentStaffName(assignment)}`}
        tooltip="Chỉnh sửa ca trực"
        onClick={() => onEdit(assignment)}
      />
      <IconButton
        icon={Trash2}
        size="sm"
        aria-label={`Hủy phân công ${shift.label.toLowerCase()} của ${getAssignmentStaffName(assignment)}`}
        tooltip="Hủy phân công"
        onClick={() => onRemove(assignment)}
      />
    </div>
  )
}

/** Roster for one day: every staff member with the shifts they hold that day. */
export function ShiftRosterTable({
  rows,
  isLoading,
  error,
  onRetry,
  isFiltered,
  showFacility,
  canAssign,
  onAssign,
  onEdit,
  onRemove,
}: ShiftRosterTableProps) {
  const colSpan = showFacility ? 6 : 5
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nhân viên</TableHead>
          {showFacility ? <TableHead>Cơ sở</TableHead> : null}
          <TableHead>Điện thoại</TableHead>
          <TableHead>Ca trực trong ngày</TableHead>
          <TableHead>Tài khoản</TableHead>
          <TableHead align="right">
            <span className="sr-only">Thao tác</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableLoading colSpan={colSpan} />
        ) : error ? (
          <TableError colSpan={colSpan} message={getApiErrorMessage(error, 'Không tải được lịch trực.')} onRetry={onRetry} />
        ) : rows.length === 0 ? (
          <TableEmpty
            colSpan={colSpan}
            icon={CalendarOff}
            title={isFiltered ? 'Không có nhân viên phù hợp bộ lọc' : 'Cơ sở chưa có nhân viên'}
            description={isFiltered ? 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.' : 'Nhân viên được gán cho cơ sở sẽ hiển thị tại đây.'}
          />
        ) : (
          rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar name={row.name} src={row.avatar} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{row.name}</span>
                    <span className="truncate text-xs text-fg-muted">{row.email || '—'}</span>
                  </div>
                </div>
              </TableCell>
              {showFacility ? <TableCell className="text-fg-muted">{row.facilityName || '—'}</TableCell> : null}
              <TableCell className="tabular-nums">{row.phone || '—'}</TableCell>
              <TableCell>
                {row.assignments.length === 0 ? (
                  <span className="text-dense text-fg-subtle">Chưa phân công</span>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {row.assignments.map((assignment) => (
                      <AssignmentLine key={assignment.id} assignment={assignment} onEdit={onEdit} onRemove={onRemove} />
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <Badge tone={row.isActive ? 'success' : 'neutral'} dot>
                  {row.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                </Badge>
              </TableCell>
              <TableCell align="right">
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={UserPlus}
                  disabled={!canAssign(row) || !row.isActive}
                  onClick={() => onAssign(row)}
                >
                  Phân công
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
