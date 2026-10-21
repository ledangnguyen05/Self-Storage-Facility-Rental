import { useMemo, useState } from 'react'
import { Plus, Tags } from 'lucide-react'
import {
  Alert,
  Button,
  Checkbox,
  Field,
  Input,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableError,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '@/components/ui'
import { getUnitTypeLabel } from '@/data/storageUnitsData'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage, getApiErrorStatus } from '@/lib/apiError'
import { formatCurrency, formatNumber } from '@/lib/format'
import { facilityPolicyService } from '@/services/facilityPolicyService'
import { storageUnitService } from '@/services/storageUnitService'
import type { Facility, FacilityPolicy, UnitType } from '@/types'
import { FacilityPolicyModal } from '../FacilityPolicyModal'
import {
  DISCOUNT_COLUMNS,
  SYSTEM_DISCOUNT_DEFAULTS,
  digitsOf,
  enabledRowFor,
  isPriceFormDirty,
  toPriceFormState,
  toPricePayload,
  validatePriceForm,
  type DiscountKey,
  type PriceFormState,
} from './facilityPriceForm'

export interface FacilityPricePanelProps {
  facilities: readonly Facility[]
  /** Business manager edits; admin sees the same table read-only. */
  canEdit: boolean
}

/** Loads the policy of one facility; a facility without a policy (404) resolves to null. */
const loadPolicy = async (facilityId: string, signal: AbortSignal): Promise<FacilityPolicy | null> => {
  try {
    return await facilityPolicyService.getByFacilityId(facilityId, { signal })
  } catch (err) {
    if (getApiErrorStatus(err) === 404) return null
    throw err
  }
}

/** "Giá theo cơ sở": per-branch monthly price and 3/6/12-month discounts for every unit type. */
export function FacilityPricePanel({ facilities, canEdit }: FacilityPricePanelProps) {
  const [facilityId, setFacilityId] = useState(() => facilities[0]?.id ?? '')
  const activeFacilityId = facilities.some(facility => facility.id === facilityId) ? facilityId : (facilities[0]?.id ?? '')

  const unitTypesQuery = useAsyncData(signal => storageUnitService.getUnitTypes({ signal }), [])
  const policyQuery = useAsyncData(signal => loadPolicy(activeFacilityId, signal), [activeFacilityId], { enabled: Boolean(activeFacilityId) })

  const facility = facilities.find(item => item.id === activeFacilityId) ?? null
  const unitTypes = useMemo<UnitType[]>(() => unitTypesQuery.data ?? [], [unitTypesQuery.data])

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-4 border-b border-line p-4">
        <p className="max-w-3xl text-dense text-fg-muted">
          Giá riêng của một cơ sở thay thế giá chung của loại kho tại cơ sở đó, và chiết khấu theo kỳ hạn thuê cũng lấy từ đây. Giá niêm yết trên
          trang Thuê kho, báo giá và số tiền thu của khách luôn dùng cùng một mức giá. Loại kho không bật giá riêng dùng giá chung và bậc chiết khấu
          mặc định của hệ thống ({SYSTEM_DISCOUNT_DEFAULTS.d3}% từ 3 tháng, {SYSTEM_DISCOUNT_DEFAULTS.d6}% từ 6 tháng, {SYSTEM_DISCOUNT_DEFAULTS.d12}% từ 12 tháng).
          Hợp đồng đang thuê giữ nguyên giá đã ký.
        </p>
        <Field label="Cơ sở" className="sm:max-w-sm">
          <Select
            value={activeFacilityId}
            onChange={event => setFacilityId(event.target.value)}
            disabled={facilities.length === 0}
            options={facilities.map(item => ({ value: item.id, label: item.code ? `${item.name} (${item.code})` : item.name }))}
            placeholder={facilities.length === 0 ? 'Chưa có cơ sở' : undefined}
          />
        </Field>
      </div>

      {!facility ? (
        <Table>
          <TableBody>
            <TableEmpty colSpan={1} icon={Tags} title="Chưa có cơ sở" description="Tạo cơ sở trong mục Cấu hình chi nhánh trước khi đặt giá." />
          </TableBody>
        </Table>
      ) : policyQuery.isLoading || unitTypesQuery.isLoading ? (
        <div className="flex flex-col gap-3 p-4" aria-busy="true">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : policyQuery.error || unitTypesQuery.error ? (
        <Table>
          <TableBody>
            <TableError
              colSpan={1}
              message={getApiErrorMessage(policyQuery.error ?? unitTypesQuery.error)}
              onRetry={() => {
                void policyQuery.reload()
                void unitTypesQuery.reload()
              }}
            />
          </TableBody>
        </Table>
      ) : (
        <FacilityPriceEditor
          // Remount per facility and per saved version so the form always starts from the stored list
          key={`${facility.id}:${policyQuery.data?.id ?? 'none'}:${JSON.stringify(policyQuery.data?.prices ?? [])}`}
          facility={facility}
          policy={policyQuery.data ?? null}
          unitTypes={unitTypes}
          canEdit={canEdit}
          onSaved={() => void policyQuery.reload()}
        />
      )}
    </div>
  )
}

interface FacilityPriceEditorProps {
  facility: Facility
  policy: FacilityPolicy | null
  unitTypes: readonly UnitType[]
  canEdit: boolean
  onSaved: () => void
}

function FacilityPriceEditor({ facility, policy, unitTypes, canEdit, onSaved }: FacilityPriceEditorProps) {
  const toast = useToast()
  const initial = useMemo(() => toPriceFormState(unitTypes, policy), [unitTypes, policy])
  const [state, setState] = useState<PriceFormState>(initial)
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [creatingPolicy, setCreatingPolicy] = useState(false)

  const errors = useMemo(() => validatePriceForm(state), [state])
  const dirty = isPriceFormDirty(initial, state)
  const hasErrors = Object.keys(errors).length > 0

  if (!policy) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Alert
          tone="info"
          title={`${facility.name} chưa có chính sách riêng`}
          action={
            canEdit ? (
              <Button size="sm" leftIcon={Plus} onClick={() => setCreatingPolicy(true)}>
                Tạo chính sách
              </Button>
            ) : undefined
          }
        >
          Bảng giá riêng nằm trong chính sách của cơ sở. {canEdit ? 'Hãy tạo chính sách trước, sau đó quay lại đây để đặt giá.' : 'Giám đốc vận hành sẽ ban hành chính sách và bảng giá.'}
        </Alert>
        <FacilityPolicyModal
          isOpen={creatingPolicy}
          onClose={() => setCreatingPolicy(false)}
          facility={facility}
          existingPolicy={null}
          onSuccess={() => {
            toast.success('Đã ban hành chính sách cơ sở', 'Bây giờ bạn có thể đặt giá riêng cho từng loại kho.')
            onSaved()
          }}
        />
      </div>
    )
  }

  const setRow = (unitTypeId: string, patch: Partial<PriceFormState[string]>) =>
    setState(current => ({ ...current, [unitTypeId]: { ...current[unitTypeId], ...patch } }))

  const toggleRow = (unitType: UnitType, enabled: boolean) =>
    setState(current => ({
      ...current,
      [unitType.id]: enabled
        ? (current[unitType.id]?.price ? { ...current[unitType.id], enabled: true } : enabledRowFor(unitType))
        : { ...current[unitType.id], enabled: false },
    }))

  const save = async () => {
    setAttempted(true)
    if (hasErrors || !policy) return
    setSaving(true)
    try {
      await facilityPolicyService.update(policy.id, { prices: toPricePayload(state) })
      toast.success(`Đã lưu bảng giá của ${facility.name}`, 'Giá mới áp dụng cho các lượt đặt kho mới.')
      onSaved()
    } catch (err) {
      toast.error('Không thể lưu bảng giá', getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const columnCount = 5 + DISCOUNT_COLUMNS.length
  const policyInactive = policy.isActive === false

  return (
    <>
      {policyInactive ? (
        <div className="border-b border-line p-4">
          <Alert tone="warning" title="Chính sách của cơ sở đang tắt">
            Khi chính sách tắt, cơ sở dùng giá chung và quy định mặc định của hệ thống nên bảng giá riêng chưa có hiệu lực. Bật lại chính sách ở tab Chính sách cơ sở.
          </Alert>
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Loại kho</TableHead>
            <TableHead align="right">Giá chung / tháng</TableHead>
            <TableHead>{canEdit ? 'Giá riêng' : 'Áp dụng'}</TableHead>
            <TableHead align="right">Giá tại cơ sở / tháng</TableHead>
            {DISCOUNT_COLUMNS.map(column => (
              <TableHead key={column.key} align="right">
                {column.label}
              </TableHead>
            ))}
            <TableHead align="right">Tiền cọc</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {unitTypes.length === 0 ? (
            <TableEmpty colSpan={columnCount} icon={Tags} title="Chưa có loại kho" description="Loại kho được tạo khi cấu hình hệ thống." />
          ) : (
            unitTypes.map(unitType => {
              const row = state[unitType.id]
              const rowErrors = errors[unitType.id] ?? {}
              const enabled = row?.enabled === true
              const depositPercent = policy.depositPercentage ?? 100
              const effectivePrice = enabled ? Number(digitsOf(row.price)) : Number(unitType.basePricePerMonth)
              return (
                <TableRow key={unitType.id}>
                  <TableCell className="min-w-48">
                    <div className="font-medium text-fg">{getUnitTypeLabel(unitType.typeName)}</div>
                    <div className="text-xs text-fg-subtle">
                      {[unitType.dimensions, unitType.areaSqm ? `${formatNumber(unitType.areaSqm)} m²` : null].filter(Boolean).join(' · ')}
                    </div>
                  </TableCell>
                  <TableCell numeric>{formatCurrency(unitType.basePricePerMonth)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {canEdit ? (
                      <Checkbox
                        aria-label={`Dùng giá riêng cho ${getUnitTypeLabel(unitType.typeName)}`}
                        label="Giá riêng"
                        checked={enabled}
                        onCheckedChange={checked => toggleRow(unitType, checked)}
                      />
                    ) : (
                      <span className="text-dense text-fg-muted">{enabled ? 'Giá riêng' : 'Giá chung'}</span>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {enabled && canEdit ? (
                      <Input
                        size="sm"
                        inputMode="numeric"
                        aria-label={`Giá thuê mỗi tháng của ${getUnitTypeLabel(unitType.typeName)} tại ${facility.name}`}
                        title={attempted ? rowErrors.price : undefined}
                        invalid={Boolean(attempted && rowErrors.price)}
                        className="ml-auto w-36 text-right tabular-nums"
                        value={row.price ? formatNumber(Number(row.price)) : ''}
                        onChange={event => setRow(unitType.id, { price: digitsOf(event.target.value) })}
                      />
                    ) : (
                      <span className={enabled ? 'tabular-nums text-fg' : 'tabular-nums text-fg-subtle'}>
                        {formatCurrency(enabled ? Number(digitsOf(row.price)) : unitType.basePricePerMonth)}
                      </span>
                    )}
                  </TableCell>
                  {DISCOUNT_COLUMNS.map(column => (
                    <TableCell key={column.key} align="right">
                      {enabled && canEdit ? (
                        <Input
                          size="sm"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          step="0.5"
                          aria-label={`${column.label} của ${getUnitTypeLabel(unitType.typeName)}`}
                          title={attempted ? rowErrors[column.key] : undefined}
                          invalid={Boolean(attempted && rowErrors[column.key])}
                          className="ml-auto w-20 text-right tabular-nums"
                          value={row[column.key]}
                          onChange={event => setRow(unitType.id, { [column.key]: event.target.value } as Record<DiscountKey, string>)}
                        />
                      ) : (
                        <span className="tabular-nums text-fg-subtle">
                          {enabled ? `${formatNumber(Number(row[column.key]))}%` : `${SYSTEM_DISCOUNT_DEFAULTS[column.key]}%`}
                        </span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell numeric>
                    <span title={`${formatNumber(depositPercent)}% tiền thuê một tháng`}>
                      {formatCurrency(Math.round((effectivePrice * depositPercent) / 100))}
                    </span>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>

      <div className="flex flex-col gap-3 border-t border-line p-4">
        <p className="text-xs text-fg-subtle">
          Tiền cọc = {formatNumber(policy.depositPercentage ?? 100)}% tiền thuê một tháng theo chính sách của cơ sở. Khi dùng giá chung, chiết khấu là bậc mặc định của hệ thống.
        </p>
        {attempted && hasErrors ? <Alert tone="danger">Kiểm tra lại các ô báo lỗi trong bảng trước khi lưu.</Alert> : null}
        {canEdit ? (
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" disabled={!dirty || saving} onClick={() => { setState(initial); setAttempted(false) }}>
              Hoàn tác
            </Button>
            <Button loading={saving} disabled={!dirty} onClick={() => void save()}>
              Lưu bảng giá cơ sở
            </Button>
          </div>
        ) : null}
      </div>
    </>
  )
}
