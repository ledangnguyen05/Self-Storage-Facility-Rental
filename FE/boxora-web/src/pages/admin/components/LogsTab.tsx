import { useState } from 'react'
import { ScrollText } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Pagination,
  SearchInput,
  Select,
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
import { getActivityLogStatusMeta, getRoleMeta } from '@/constants/statusMeta'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatDateTime } from '@/lib/format'
import { activityLogService } from '@/services/activityLogService'
import type { ActivityLog } from '@/types'
import { AUDIT_DOMAIN_OPTIONS, AUDIT_LOG_TYPE_OPTIONS, AUDIT_STATUS_OPTIONS, getAuditActionLabel } from '../lib/auditActions'
import { getLogActorEmail, getLogActorName, isCriticalLog } from '../lib/auditLog'
import { LogDetailDrawer } from './LogDetailDrawer'

const COLUMN_COUNT = 7

/** Audit log. Search and every filter are applied by the server, so they cover all pages, not just the visible one. */
export function LogsTab() {
  const [search, setSearch] = useState('')
  const [logType, setLogType] = useState('')
  const [domain, setDomain] = useState('')
  const [status, setStatus] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [criticalOnly, setCriticalOnly] = useState(false)
  const [selected, setSelected] = useState<ActivityLog | null>(null)
  const debouncedSearch = useDebouncedValue(search.trim())
  // A reversed range is not sent (the server would refuse it); the field shows why instead.
  const rangeError = fromDate && toDate && toDate < fromDate ? 'Ngày kết thúc phải từ ngày bắt đầu trở đi.' : undefined

  // Server-side paging: the page number drives the request, so it cannot come from a hook that needs the total first.
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const { data, error, isLoading, reload } = useAsyncData(
    signal =>
      activityLogService.getAll(
        {
          page: page - 1,
          size: pageSize,
          search: debouncedSearch || undefined,
          logType: logType || undefined,
          domain: domain || undefined,
          status: status || undefined,
          fromDate: rangeError ? undefined : fromDate || undefined,
          toDate: rangeError ? undefined : toDate || undefined,
          isCriticalOnly: criticalOnly || undefined,
          sortBy: 'createdAt',
          sortDir: 'desc',
        },
        { signal },
      ),
    [page, pageSize, debouncedSearch, logType, domain, status, fromDate, toDate, rangeError, criticalOnly],
  )

  const logs = data?.content ?? []
  const total = data?.totalElements ?? 0
  const pageCount = Math.max(1, data?.totalPages ?? 1)
  const hasFilters = Boolean(search || logType || domain || status || fromDate || toDate || criticalOnly)

  const clearFilters = () => {
    setSearch('')
    setLogType('')
    setDomain('')
    setStatus('')
    setFromDate('')
    setToDate('')
    setCriticalOnly(false)
    setPage(1)
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
        <SearchInput
          value={search}
          onValueChange={value => {
            setSearch(value)
            setPage(1)
          }}
          placeholder="Tìm theo mô tả, người dùng, cơ sở…"
          className="lg:w-80"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Select
            aria-label="Lọc theo nhóm thao tác"
            className="w-56"
            value={domain}
            onChange={event => {
              setDomain(event.target.value)
              setPage(1)
            }}
            options={[...AUDIT_DOMAIN_OPTIONS]}
          />
          <Select
            aria-label="Lọc theo loại nhật ký"
            className="w-48"
            value={logType}
            onChange={event => {
              setLogType(event.target.value)
              setPage(1)
            }}
            options={[...AUDIT_LOG_TYPE_OPTIONS]}
          />
          <Select
            aria-label="Lọc theo trạng thái"
            className="w-44"
            value={status}
            onChange={event => {
              setStatus(event.target.value)
              setPage(1)
            }}
            options={[...AUDIT_STATUS_OPTIONS]}
          />
          <Checkbox
            label="Chỉ thao tác quan trọng"
            checked={criticalOnly}
            onCheckedChange={checked => {
              setCriticalOnly(checked)
              setPage(1)
            }}
          />
          {hasFilters ? (
            <Button variant="link" size="sm" onClick={clearFilters}>
              Xóa bộ lọc
            </Button>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-3 border-b border-line px-4 py-3">
        <Field label="Từ ngày" className="w-44">
          <Input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={event => {
              setFromDate(event.target.value)
              setPage(1)
            }}
          />
        </Field>
        <Field label="Đến ngày" className="w-44" error={rangeError}>
          <Input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={event => {
              setToDate(event.target.value)
              setPage(1)
            }}
          />
        </Field>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Thời gian</TableHead>
            <TableHead>Tài khoản</TableHead>
            <TableHead>Vai trò</TableHead>
            <TableHead>Hành động</TableHead>
            <TableHead>Mô tả</TableHead>
            <TableHead>Địa chỉ IP</TableHead>
            <TableHead>Trạng thái</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableLoading colSpan={COLUMN_COUNT} rows={8} />
          ) : error ? (
            <TableError colSpan={COLUMN_COUNT} message={getApiErrorMessage(error)} onRetry={() => void reload()} />
          ) : logs.length === 0 ? (
            <TableEmpty
              colSpan={COLUMN_COUNT}
              icon={ScrollText}
              title={hasFilters ? 'Không có nhật ký khớp bộ lọc' : 'Chưa có nhật ký nào'}
              description={hasFilters ? 'Thử đổi từ khóa hoặc bỏ bớt bộ lọc.' : 'Các thao tác đăng nhập và thay đổi dữ liệu sẽ được ghi lại ở đây.'}
              action={
                hasFilters ? (
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    Xóa bộ lọc
                  </Button>
                ) : undefined
              }
            />
          ) : (
            logs.map(log => {
              const statusMeta = getActivityLogStatusMeta(log.status)
              const email = getLogActorEmail(log)
              return (
                <TableRow key={log.id} onClick={() => setSelected(log)}>
                  <TableCell className="whitespace-nowrap tabular-nums text-fg-muted">{formatDateTime(log.createdAt)}</TableCell>
                  <TableCell>
                    <div className="font-medium text-fg">{getLogActorName(log)}</div>
                    {email ? <div className="text-xs text-fg-subtle">{email}</div> : null}
                  </TableCell>
                  <TableCell>{log.userRole ? <Badge tone={getRoleMeta(log.userRole).tone}>{getRoleMeta(log.userRole).label}</Badge> : <span className="text-fg-subtle">Hệ thống</span>}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-fg">{getAuditActionLabel(log.action)}</span>
                      {isCriticalLog(log) ? <Badge tone="danger" size="sm">Quan trọng</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-80 truncate text-fg-muted">{log.description || log.details || '—'}</TableCell>
                  <TableCell className="font-mono text-dense text-fg-muted">{log.ipAddress || '—'}</TableCell>
                  <TableCell>
                    <Badge tone={statusMeta.tone} dot>
                      {statusMeta.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>

      {total > 0 ? (
        <div className="border-t border-line px-4 py-3">
          <Pagination
            page={Math.min(page, pageCount)}
            pageCount={pageCount}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={size => {
              setPageSize(size)
              setPage(1)
            }}
          />
        </div>
      ) : null}

      <LogDetailDrawer log={selected} onClose={() => setSelected(null)} />
    </Card>
  )
}
