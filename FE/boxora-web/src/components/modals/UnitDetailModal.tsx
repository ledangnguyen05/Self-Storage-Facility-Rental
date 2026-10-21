import React from 'react'
import { ArrowRight, CalendarClock, Camera, Clock, ExternalLink, FileSignature, KeyRound, MapPin, Percent, ShieldCheck } from 'lucide-react'
import { getUnitStatusMeta } from '../../constants/statusMeta'
import { UNIT_CATEGORY_LABELS, buildDirectionsUrl, type StorageUnitType } from '../../data/storageUnitsData'
import { useAsyncData } from '../../hooks/useAsyncData'
import { getApiErrorStatus, isRequestCanceled } from '../../lib/apiError'
import { formatCurrency, formatNumber } from '../../lib/format'
import { facilityPolicyService } from '../../services/facilityPolicyService'
import { pricingService } from '../../services/pricingService'
import type { FacilityPolicy } from '../../types'
import { BOOKING_HOLD_DEFAULTS, resolvePolicy } from '../../utils/facilityPolicyDefaults'
import { Alert, Badge, Button, DescriptionList, Modal } from '../ui'

interface UnitDetailModalProps {
  unit: StorageUnitType | null
  isOpen: boolean
  onClose: () => void
  onRent: (unit: StorageUnitType) => void
}

/** Advisory capacity hint by area. Marketing guidance, not a guarantee. */
function getCapacityText(area?: number): string {
  if (area == null) return 'Linh hoạt cho nhiều nhu cầu lưu trữ cá nhân hoặc doanh nghiệp.'
  if (area < 3) return 'Phù hợp với thùng carton, tài liệu, vali, xe đạp và đồ dùng cá nhân gọn nhẹ.'
  if (area <= 8) return 'Phù hợp với đồ đạc của một căn hộ nhỏ: bàn ghế, tủ kệ, nệm và đồ gia dụng.'
  if (area <= 15) return 'Phù hợp với nội thất căn hộ 2 – 3 phòng ngủ, hàng mẫu và thiết bị văn phòng cỡ vừa.'
  return 'Phù hợp với hàng hóa thương mại, máy móc và pallet số lượng lớn.'
}

const AMENITIES = [
  { icon: KeyRound, text: 'Khóa điện tử riêng, mở bằng mã PIN hoặc mã QR' },
  { icon: Clock, text: 'Ra vào 24/7, không cần đặt lịch trước' },
  { icon: Camera, text: 'Camera giám sát khu vực chung, không quay vào bên trong kho' },
  { icon: ShieldCheck, text: 'Hệ thống phòng cháy chữa cháy theo quy định' },
] as const

/** Why this unit cannot be booked, per status. Every message points the visitor to a free unit of the same type. */
function unavailableNotice(status: StorageUnitType['status']): string {
  switch (status) {
    case 'UNDER_MAINTENANCE':
      return 'Kho đang bảo trì nên tạm thời chưa thể thuê. Bạn có thể chọn một kho còn trống cùng loại.'
    case 'RESERVED':
      return 'Kho này đang được một khách hàng khác giữ chỗ. Nếu họ không hoàn tất đặt kho, kho sẽ được mở lại. Bạn có thể chọn một kho còn trống cùng loại.'
    case 'OCCUPIED':
    case 'OVERDUE_LOCKED':
      return 'Kho này đã có người thuê nên chưa thể đặt. Bạn có thể chọn một kho còn trống cùng loại.'
    default:
      return 'Kho này hiện chưa thể đặt. Bạn có thể chọn một kho còn trống cùng loại.'
  }
}

/** Loaded policy of the facility. `null` = the facility has no active policy (system defaults apply); `'error'` = lookup failed. */
type PolicyLookup = FacilityPolicy | null | 'error'

/** Unit specifications and rental conditions. Policy numbers are the facility's own; the page says so when it falls back to defaults. */
export const UnitDetailModal: React.FC<UnitDetailModalProps> = ({ unit, isOpen, onClose, onRent }) => {
  if (!isOpen || !unit) return null
  return <UnitDetailDialog unit={unit} onClose={onClose} onRent={onRent} />
}

function UnitDetailDialog({ unit, onClose, onRent }: { unit: StorageUnitType; onClose: () => void; onRent: (unit: StorageUnitType) => void }) {
  const statusMeta = getUnitStatusMeta(unit.status)

  // The policy endpoint is public, so visitors see the facility's real numbers. Only a missing policy (404) means "defaults".
  const { data: lookup } = useAsyncData<PolicyLookup>(
    async signal => {
      try {
        return await facilityPolicyService.getByFacilityId(unit.facilityId, { signal })
      } catch (error) {
        if (isRequestCanceled(error)) throw error
        return getApiErrorStatus(error) === 404 ? null : 'error'
      }
    },
    [unit.facilityId],
    { enabled: Boolean(unit.facilityId) },
  )
  const policyRecord = lookup && lookup !== 'error' ? lookup : null
  const policy = resolvePolicy(policyRecord, unit.facilityId)
  const holdGraceHours = policyRecord?.holdGraceHours ?? BOOKING_HOLD_DEFAULTS.holdGraceHours

  // Term discounts that apply to THIS facility (its price list, or the system tiers).
  const { data: termDiscounts } = useAsyncData(
    async signal => {
      try {
        return await pricingService.getTermDiscounts(unit.id, { signal })
      } catch (error) {
        if (isRequestCanceled(error)) throw error
        return []
      }
    },
    [unit.id],
  )
  const discountsWithValue = (termDiscounts ?? []).filter(item => item.percent > 0)

  const handleRent = () => {
    onClose()
    onRent(unit)
  }

  const directionsTarget = unit.coords ?? unit.facilityAddress

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Kho ${unit.unitCode}`}
      description={`${unit.facilityName} · ${unit.floorLabel}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          {unit.isAvailable ? (
            <Button rightIcon={ArrowRight} onClick={handleRent}>
              Thuê kho này
            </Button>
          ) : (
            <Button disabled>Kho không khả dụng</Button>
          )}
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusMeta.tone} dot>
            {statusMeta.label}
          </Badge>
          <Badge variant="outline">{unit.unitTypeName || UNIT_CATEGORY_LABELS[unit.category]}</Badge>
          {unit.distanceKm != null ? (
            <Badge tone="accent">~{formatNumber(unit.distanceKm, { maximumFractionDigits: 1 })} km</Badge>
          ) : null}
          {unit.isNearest ? <Badge tone="success">Gần bạn nhất</Badge> : null}
        </div>

        {!unit.isAvailable ? <Alert tone="info">{unavailableNotice(unit.status)}</Alert> : null}

        <DescriptionList
          columns={2}
          items={[
            { label: 'Giá thuê', value: <span className="tabular-nums">{formatCurrency(unit.monthlyPrice)} / tháng</span> },
            {
              label: 'Tiền đặt cọc',
              value: (
                <span className="tabular-nums">
                  {formatCurrency(unit.depositAmount)}
                  <span className="text-fg-subtle"> ({formatNumber(policy.depositPercentage)}% tiền thuê tháng)</span>
                </span>
              ),
            },
            { label: 'Diện tích', value: unit.areaSqMeters != null ? `${formatNumber(unit.areaSqMeters, { maximumFractionDigits: 1 })} m²` : null },
            { label: 'Vị trí', value: unit.floorLabel },
          ]}
        />

        {discountsWithValue.length > 0 ? (
          <section aria-labelledby="unit-discounts" className="rounded-lg border border-success-line bg-success-subtle p-4">
            <h3 id="unit-discounts" className="flex items-center gap-2 text-sm font-semibold text-fg">
              <Percent size={16} strokeWidth={1.75} aria-hidden="true" className="text-success" />
              Chiết khấu theo kỳ hạn thuê
            </h3>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-dense text-fg-muted">
              {discountsWithValue.map(item => (
                <li key={item.months} className="tabular-nums">
                  Từ {item.months} tháng: giảm <span className="font-medium text-fg">{formatNumber(item.percent, { maximumFractionDigits: 1 })}%</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-label="Địa điểm" className="rounded-lg border border-line bg-surface-2 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">{unit.facilityName}</p>
              <p className="mt-1 flex items-start gap-1.5 text-dense text-fg-muted">
                <MapPin size={14} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-fg-subtle" />
                <span>{unit.facilityAddress || '—'}</span>
              </p>
            </div>
            {directionsTarget ? (
              <a
                href={buildDirectionsUrl(directionsTarget)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-dense font-medium text-accent-text hover:underline"
              >
                Chỉ đường
                <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="unit-capacity">
          <h3 id="unit-capacity" className="text-sm font-semibold text-fg">
            Sức chứa gợi ý
          </h3>
          <p className="mt-1.5 text-sm text-fg-muted">{getCapacityText(unit.areaSqMeters)}</p>
        </section>

        <section aria-labelledby="unit-amenities">
          <h3 id="unit-amenities" className="text-sm font-semibold text-fg">
            An ninh và tiện ích
          </h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {AMENITIES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2 text-dense text-fg-muted">
                <Icon size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-success" />
                {text}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="unit-terms">
          <h3 id="unit-terms" className="text-sm font-semibold text-fg">
            Điều kiện thuê
          </h3>
          {lookup === 'error' ? (
            <Alert tone="warning" className="mt-2">
              Chưa tải được chính sách riêng của cơ sở, nên các con số dưới đây là quy định mặc định của hệ thống. Số liệu chính xác sẽ hiển thị khi bạn đặt kho.
            </Alert>
          ) : lookup === null ? (
            <p className="mt-2 text-xs text-fg-subtle">Cơ sở này áp dụng quy định mặc định của hệ thống.</p>
          ) : null}
          <ul className="mt-2 space-y-2 text-dense text-fg-muted">
            <li className="flex items-start gap-2">
              <CalendarClock size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-fg-subtle" />
              <span>
                <strong className="font-medium text-fg">Thời hạn thuê:</strong> tối thiểu {policy.minimumRentalMonths} tháng.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <FileSignature size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-fg-subtle" />
              <span>
                <strong className="font-medium text-fg">Hợp đồng:</strong> ký điện tử trực tuyến, xác thực bằng mã OTP gửi tới email.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <KeyRound size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-fg-subtle" />
              <span>
                <strong className="font-medium text-fg">Bàn giao:</strong> mã PIN được kích hoạt sau khi hợp đồng có hiệu lực và nhân viên cơ sở hoàn tất bàn giao.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Clock size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-fg-subtle" />
              <span>
                <strong className="font-medium text-fg">Giữ chỗ:</strong> kho được giữ đến giờ hẹn nhận kho cộng thêm {holdGraceHours} giờ, quá hạn kho sẽ được mở lại cho người khác.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-fg-subtle" />
              <span>
                <strong className="font-medium text-fg">Hủy đặt kho:</strong> hoàn đầy đủ nếu hủy trước {policy.cancellationFullRefundHours} giờ,
                hoàn {policy.cancellationPartialRefundPercent}% nếu hủy trước {policy.cancellationPartialRefundHours} giờ so với giờ hẹn nhận kho.
              </span>
            </li>
          </ul>
        </section>
      </div>
    </Modal>
  )
}
