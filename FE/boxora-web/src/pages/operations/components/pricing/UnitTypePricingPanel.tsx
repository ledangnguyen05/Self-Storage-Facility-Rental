import { useMemo, useState } from 'react'
import { Tags } from 'lucide-react'
import {
  Alert,
  Button,
  Checkbox,
  ConfirmDialog,
  Field,
  Input,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableError,
  TableHead,
  TableHeader,
  TableLoading,
  TableRow,
  Textarea,
  useToast,
} from '@/components/ui'
import { getUnitTypeLabel } from '@/data/storageUnitsData'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatNumber } from '@/lib/format'
import { storageUnitService } from '@/services/storageUnitService'
import type { UnitType } from '@/types'

export interface UnitTypePricingPanelProps {
  /** Business manager can adjust prices; admin sees the list read-only. */
  canEdit: boolean
}

const COLUMN_COUNT = 6

const digitsOf = (text: string): string => text.replace(/\D/g, '')
const priceOf = (text: string): number => Number(digitsOf(text)) || 0

/** Listed monthly price per unit type. Every change needs a reason and is kept in the price history. */
export function UnitTypePricingPanel({ canEdit }: UnitTypePricingPanelProps) {
  const toast = useToast()
  const { data, error, isLoading, reload } = useAsyncData(signal => storageUnitService.getUnitTypes({ signal }), [])
  const unitTypes = useMemo<UnitType[]>(() => data ?? [], [data])

  /** Price typed per unit type id (digits only). A missing or empty entry means "unchanged". */
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [cascade, setCascade] = useState(true)
  const [attempted, setAttempted] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const changes = useMemo(
    () =>
      unitTypes.flatMap(unitType => {
        const draft = drafts[unitType.id]
        if (!draft) return []
        const newPrice = priceOf(draft)
        return newPrice !== Number(unitType.basePricePerMonth) ? [{ unitType, newPrice }] : []
      }),
    [unitTypes, drafts],
  )

  const invalidIds = new Set(changes.filter(change => change.newPrice <= 0).map(change => change.unitType.id))
  const reasonMissing = changes.length > 0 && reason.trim() === ''
  const canSubmit = changes.length > 0 && invalidIds.size === 0

  const reset = () => {
    setDrafts({})
    setReason('')
    setAttempted(false)
  }

  const requestSave = () => {
    setAttempted(true)
    if (canSubmit && !reasonMissing) setConfirming(true)
  }

  const applyChanges = async () => {
    const applied: string[] = []
    try {
      for (const change of changes) {
        await storageUnitService.adjustUnitTypePrice(change.unitType.id, {
          newPrice: change.newPrice,
          reason: reason.trim(),
          cascadeToAvailableUnits: cascade,
        })
        applied.push(change.unitType.id)
      }
      toast.success(`Đã cập nhật giá ${applied.length} loại kho`, 'Lịch sử giá đã được ghi nhận.')
      reset()
    } catch (err) {
      toast.error(
        applied.length > 0 ? `Mới cập nhật ${applied.length}/${changes.length} loại kho` : 'Không thể cập nhật bảng giá',
        getApiErrorMessage(err),
      )
      setDrafts(current => Object.fromEntries(Object.entries(current).filter(([id]) => !applied.includes(id))))
    } finally {
      setConfirming(false)
      await reload()
    }
  }

  return (
    <div className="flex flex-col">
      <div className="border-b border-line p-4">
        <p className="max-w-3xl text-dense text-fg-muted">
          Giá chung theo loại kho, áp dụng cho mọi cơ sở chưa đặt giá riêng. Cơ sở có giá riêng (tab Giá theo cơ sở) không đổi theo bảng này.
          Hợp đồng đang thuê giữ nguyên giá đã ký.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Loại kho</TableHead>
            <TableHead>Kích thước</TableHead>
            <TableHead align="right">Số kho</TableHead>
            <TableHead align="right">Giá chung hiện tại / tháng</TableHead>
            <TableHead align="right">Giá thấp nhất đang niêm yết</TableHead>
            {canEdit ? <TableHead align="right">Giá mới / tháng</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableLoading colSpan={COLUMN_COUNT} rows={3} />
          ) : error ? (
            <TableError colSpan={COLUMN_COUNT} onRetry={() => void reload()} />
          ) : unitTypes.length === 0 ? (
            <TableEmpty colSpan={COLUMN_COUNT} icon={Tags} title="Chưa có loại kho" description="Loại kho được tạo khi cấu hình cơ sở." />
          ) : (
            unitTypes.map(unitType => {
              const draft = drafts[unitType.id]
              const invalid = invalidIds.has(unitType.id)
              return (
                <TableRow key={unitType.id}>
                  <TableCell className="font-medium text-fg">{getUnitTypeLabel(unitType.typeName)}</TableCell>
                  <TableCell className="text-fg-muted">
                    {[unitType.dimensions, unitType.areaSqm ? `${formatNumber(unitType.areaSqm)} m²` : null].filter(Boolean).join(' · ') || '—'}
                  </TableCell>
                  <TableCell numeric>{formatNumber(unitType.activeUnitsCount)}</TableCell>
                  <TableCell numeric>{formatCurrency(unitType.basePricePerMonth)}</TableCell>
                  <TableCell numeric>
                    {unitType.lowestListedPrice != null ? (
                      formatCurrency(unitType.lowestListedPrice)
                    ) : (
                      <span className="text-fg-subtle" title="Không còn kho trống thuộc loại này">
                        —
                      </span>
                    )}
                  </TableCell>
                  {canEdit ? (
                    <TableCell align="right">
                      <Input
                        size="sm"
                        inputMode="numeric"
                        aria-label={`Giá mới của ${getUnitTypeLabel(unitType.typeName)}`}
                        invalid={invalid}
                        className="ml-auto w-40 text-right tabular-nums"
                        placeholder={formatNumber(unitType.basePricePerMonth)}
                        value={draft ? formatNumber(Number(draft)) : ''}
                        onChange={event => setDrafts(current => ({ ...current, [unitType.id]: digitsOf(event.target.value) }))}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>

      {canEdit && unitTypes.length > 0 ? (
        <div className="flex flex-col gap-4 border-t border-line p-4">
          {attempted && invalidIds.size > 0 ? <Alert tone="danger">Giá mới phải lớn hơn 0.</Alert> : null}
          <Field label="Lý do điều chỉnh" required={changes.length > 0} hint="Ghi vào lịch sử giá để kiểm toán." error={attempted && reasonMissing ? 'Nhập lý do điều chỉnh giá.' : undefined}>
            <Textarea rows={2} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder="Ví dụ: cập nhật giá niêm yết quý 4" />
          </Field>
          <Checkbox
            label="Áp dụng giá mới cho các kho còn trống"
            description="Kho đang thuê hoặc đã giữ chỗ giữ nguyên giá."
            checked={cascade}
            onCheckedChange={setCascade}
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" disabled={changes.length === 0 && reason === ''} onClick={reset}>
              Hoàn tác
            </Button>
            <Button disabled={changes.length === 0} onClick={requestSave}>
              {changes.length > 0 ? `Lưu bảng giá (${changes.length})` : 'Lưu bảng giá'}
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Điều chỉnh giá ${changes.length} loại kho?`}
        description={
          <span className="flex flex-col gap-1">
            {changes.map(change => (
              <span key={change.unitType.id}>
                {getUnitTypeLabel(change.unitType.typeName)}: {formatCurrency(change.unitType.basePricePerMonth)} → {formatCurrency(change.newPrice)}
              </span>
            ))}
          </span>
        }
        confirmLabel="Điều chỉnh giá"
        onConfirm={applyChanges}
      />
    </div>
  )
}
