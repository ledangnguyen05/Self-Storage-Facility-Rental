import type { ReactNode } from 'react'
import { Badge, DescriptionList } from '../../ui'
import { formatCurrency, formatPercent } from '../../../lib/format'
import type { ResolvedFacilityPolicy } from '../../../utils/facilityPolicyDefaults'

interface SectionProps {
  policy: ResolvedFacilityPolicy
}

function PolicyBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line p-4">
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      <div className="mt-2 text-sm text-fg-muted">{children}</div>
    </section>
  )
}

function BulletList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>
}

function PolicyFact({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface-2 p-4">
      <span className="text-dense text-fg-muted">{label}</span>
      <span className="text-xl font-semibold tabular-nums text-fg">{value}</span>
      {children ? <p className="text-dense text-fg-muted">{children}</p> : null}
    </div>
  )
}

export function RentalSection({ policy }: SectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <PolicyBlock title="Ký hợp đồng điện tử">
        <BulletList>
          <li>Hợp đồng thuê kho được tạo và ký hoàn toàn trực tuyến bằng chữ ký điện tử.</li>
          <li>
            Thời hạn thuê tối thiểu là <strong className="font-semibold text-fg">{policy.minimumRentalMonths} tháng</strong>. Hết hạn, bạn có
            thể gia hạn ngay trên tài khoản.
          </li>
          <li>
            Gia hạn mở trước <strong className="font-semibold text-fg">{policy.renewalWindowDays} ngày</strong> so với ngày hết hạn hợp đồng.
          </li>
        </BulletList>
      </PolicyBlock>
      <PolicyBlock title="Quyền lưu trữ và an ninh tài sản">
        <BulletList>
          <li>Bạn được ra vào kho 24/7 bằng mã PIN qua hệ thống khóa thông minh.</li>
          <li>Không lưu trữ hàng cấm, vũ khí, chất cháy nổ hoặc hàng hóa có mùi hôi, dễ phân hủy.</li>
          <li>Mọi lượt ra vào đều được ghi nhận tự động để bảo vệ tài sản của bạn.</li>
        </BulletList>
      </PolicyBlock>
    </div>
  )
}

export function PaymentSection({ policy }: SectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PolicyFact label="Tiền đặt cọc" value={formatPercent(policy.depositPercentage)}>
          Tính trên giá thuê một tháng. Khoản cọc được giữ hộ và hoàn trả khi thanh lý hợp đồng đúng hạn.
        </PolicyFact>
        <PolicyFact label="Phương thức thanh toán" value="VNPay hoặc tại quầy">
          Thanh toán trực tuyến qua VNPay (QR hoặc cổng ngân hàng); tiền mặt hoặc chuyển khoản tại quầy khi giữ chỗ theo lịch hẹn.
        </PolicyFact>
      </div>
      <PolicyBlock title="Chu kỳ thanh toán">
        <p>Tiền thuê được thanh toán theo kỳ thuê bạn chọn khi đặt kho. Hệ thống gửi nhắc hạn trước khi kỳ mới bắt đầu.</p>
      </PolicyBlock>
    </div>
  )
}

export function CancellationSection({ policy }: SectionProps) {
  const full = policy.cancellationFullRefundHours
  const partial = policy.cancellationPartialRefundHours
  const rows: { text: string; tone: 'success' | 'warning' | 'danger'; outcome: string }[] = [
    { text: `Hủy trước giờ hẹn nhận kho từ ${full} giờ trở lên`, tone: 'success', outcome: 'Hoàn 100% tiền cọc' },
    {
      text: `Hủy trước giờ hẹn nhận kho từ ${partial} giờ đến dưới ${full} giờ`,
      tone: 'warning',
      outcome: `Hoàn ${formatPercent(policy.cancellationPartialRefundPercent)} tiền cọc`,
    },
    { text: `Hủy dưới ${partial} giờ hoặc không đến nhận kho`, tone: 'danger', outcome: 'Không hoàn tiền cọc' },
  ]
  return (
    <PolicyBlock title="Mốc hủy đơn giữ chỗ và tỷ lệ hoàn cọc">
      <ul className="flex flex-col gap-2">
        {rows.map(row => (
          <li key={row.text} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3">
            <span className="text-fg">{row.text}</span>
            <Badge tone={row.tone}>{row.outcome}</Badge>
          </li>
        ))}
      </ul>
    </PolicyBlock>
  )
}

export function ReturnSection({ policy }: SectionProps) {
  const notice = policy.returnNoticeDays
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PolicyFact label="Báo trước khi trả kho" value={notice > 0 ? `${notice} ngày` : 'Không yêu cầu'}>
          {notice > 0
            ? `Gửi yêu cầu trả kho trên ứng dụng trước ${notice} ngày để nhân viên chuẩn bị tiếp nhận.`
            : 'Bạn có thể gửi yêu cầu trả kho trên ứng dụng bất cứ lúc nào.'}
        </PolicyFact>
        <PolicyFact label="Thời hạn hoàn cọc" value={`${policy.depositRefundSlaDays} ngày làm việc`}>
          Tiền cọc được hoàn về tài khoản ngân hàng của bạn sau khi hoàn tất biên bản nghiệm thu.
        </PolicyFact>
      </div>
      <PolicyBlock title="Điều kiện nghiệm thu để hoàn đủ tiền cọc">
        <BulletList>
          <li>Đã dọn sạch đồ đạc và vệ sinh kho gọn gàng.</li>
          <li>Không làm hư hại vách ngăn, cửa cuốn hoặc khóa thông minh.</li>
          <li>Đã thanh toán đầy đủ các khoản phí phát sinh đến ngày trả kho.</li>
        </BulletList>
      </PolicyBlock>
    </div>
  )
}

export function OverdueSection({ policy }: SectionProps) {
  return (
    <PolicyBlock title="Quy trình xử lý quá hạn thanh toán">
      <DescriptionList
        layout="inline"
        items={[
          { label: 'Thời gian ân hạn, không tính phí', value: `${policy.overdueGraceDays} ngày` },
          { label: 'Phí trễ hạn mỗi ngày', value: <span className="tabular-nums">{formatCurrency(policy.dailyLateFee)}/ngày</span> },
          { label: 'Vô hiệu hóa mã PIN', value: `Từ ngày thứ ${policy.overdueAccessDisableDays} quá hạn` },
          { label: 'Niêm phong và xử lý tài sản', value: `Từ ngày thứ ${policy.overdueSealingDays} quá hạn` },
        ]}
      />
    </PolicyBlock>
  )
}
