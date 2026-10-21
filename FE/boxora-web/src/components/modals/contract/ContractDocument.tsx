import { forwardRef, type ReactNode } from 'react'
import type { RentalContract } from '../../../types'
import { SITE_CONFIG } from '../../../constants/siteConfig'
import { formatCurrency, formatDate } from '../../../lib/format'
import { DescriptionList } from '../../ui'
import { ContractSignatures } from './ContractSignatures'

function Article({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h4 className="text-sm font-semibold text-fg">{title}</h4>
      <div className="mt-1.5 flex flex-col gap-1.5 text-justify text-dense text-fg">{children}</div>
    </section>
  )
}

interface ContractDocumentProps {
  contract: RentalContract
}

/**
 * The contract text. Every fact comes from the contract record or from
 * `SITE_CONFIG`; the markup is self-contained so it can be printed on its own.
 */
export const ContractDocument = forwardRef<HTMLDivElement, ContractDocumentProps>(function ContractDocument({ contract }, ref) {
  const { company, hotline, supportEmail } = SITE_CONFIG
  // Agreed deposit of the booking; what was actually collected can be lower until the counter payment.
  const agreedDeposit = Math.max(Number(contract.depositAmount) || 0, Number(contract.depositHeld) || 0)
  const collectedDeposit = Number(contract.depositHeld) || 0

  return (
    <article
      ref={ref}
      aria-label={`Hợp đồng thuê kho ${contract.contractCode}`}
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-lg border border-line bg-surface p-4 text-fg sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0"
    >
      <div className="border-b border-line pb-6 text-center">
        <p className="text-xs font-semibold tracking-wide text-fg">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
        <p className="mt-1 text-xs font-medium text-fg">Độc lập – Tự do – Hạnh phúc</p>
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-fg">Hợp đồng thuê kho tự quản thông minh</h1>
        <p className="mt-1 text-dense text-fg-muted">
          Số hợp đồng: <span className="font-mono text-fg">{contract.contractCode}</span>
        </p>
      </div>

      <p className="text-dense italic text-fg-muted">
        Căn cứ Bộ luật Dân sự số 91/2015/QH13 và Luật Giao dịch điện tử số 20/2023/QH15. Hôm nay, các bên tham gia giao kết hợp đồng
        dịch vụ lưu trữ tự quản thông minh gồm có:
      </p>

      <div className="grid grid-cols-1 gap-6 rounded-lg border border-line bg-surface-2 p-4 md:grid-cols-2 print:bg-transparent">
        <section aria-label="Bên cho thuê" className="flex flex-col gap-3">
          <h2 className="border-b border-line pb-1 text-sm font-semibold text-fg">Bên cho thuê (Bên A)</h2>
          <DescriptionList
            columns={1}
            items={[
              { label: 'Đơn vị', value: company.legalName },
              { label: 'Cơ sở', value: contract.facilityName },
              { label: 'Mã số doanh nghiệp', value: `${company.taxId} · Cấp bởi ${company.taxIdIssuer}` },
              { label: 'Liên hệ', value: `${hotline.display} · ${supportEmail}` },
            ]}
          />
        </section>
        <section aria-label="Bên thuê kho" className="flex flex-col gap-3">
          <h2 className="border-b border-line pb-1 text-sm font-semibold text-fg">Bên thuê kho (Bên B)</h2>
          <DescriptionList
            columns={1}
            items={[
              { label: 'Họ và tên', value: contract.customerName },
              { label: 'Email', value: contract.customerEmail },
              { label: 'Số điện thoại', value: contract.customerPhone },
              ...(contract.customerId ? [{ label: 'Mã khách hàng', value: `KH-${contract.customerId.slice(0, 8).toUpperCase()}`, mono: true }] : []),
            ]}
          />
        </section>
      </div>

      <div className="flex flex-col gap-5">
        <Article title="Điều 1. Đối tượng và mục đích thuê">
          <p>
            1.1. Bên A đồng ý cho Bên B thuê và Bên B đồng ý thuê ô kho lưu trữ cá nhân có mã số{' '}
            <strong className="font-mono font-semibold">{contract.unitCode}</strong> tại cơ sở{' '}
            <strong className="font-semibold">{contract.facilityName}</strong>.
          </p>
          <p>
            1.2. Ô kho được trang bị khóa thông minh kết nối hệ thống Boxora, cảm biến an toàn, giám sát phòng cháy chữa cháy và camera an
            ninh khu vực 24/7.
          </p>
        </Article>

        <Article title="Điều 2. Thời hạn thuê kho">
          <p>
            2.1. Thời hạn thuê dự kiến từ ngày <strong className="font-semibold">{formatDate(contract.startDate)}</strong> đến hết ngày{' '}
            <strong className="font-semibold">{formatDate(contract.endDate)}</strong>. Ngày bắt đầu có hiệu lực chính thức của hợp đồng và
            quyền truy cập kho được tính từ ngày Bên B hoàn tất thủ tục bàn giao (check-in) tại cơ sở và kích hoạt mã PIN cá nhân.
          </p>
          <p>2.2. Hợp đồng có thể được gia hạn theo chu kỳ trên cổng khách hàng Boxora khi Bên B thanh toán phí thuê kỳ mới.</p>
        </Article>

        <Article title="Điều 3. Giá thuê, tiền đặt cọc và thanh toán">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-surface-2 p-3 print:bg-transparent">
              <span className="block text-xs text-fg-muted">Đơn giá thuê hàng tháng</span>
              <strong className="text-sm font-semibold tabular-nums">{formatCurrency(contract.monthlyFee)} / tháng</strong>
            </div>
            <div className="rounded-lg border border-line bg-surface-2 p-3 print:bg-transparent">
              <span className="block text-xs text-fg-muted">Tiền đặt cọc</span>
              <strong className="text-sm font-semibold tabular-nums">{formatCurrency(agreedDeposit)}</strong>
              {collectedDeposit < agreedDeposit ? (
                <span className="block text-xs text-fg-muted">
                  {collectedDeposit > 0 ? `Đã nộp ${formatCurrency(collectedDeposit)}` : 'Chưa nộp'}, phần còn lại thanh toán khi nhận kho
                </span>
              ) : null}
            </div>
          </div>
          <p>
            3.1. Tiền đặt cọc do Bên A giữ hộ và được hoàn trả cho Bên B sau khi thanh lý hợp đồng và nghiệm thu hoàn trả kho nguyên
            trạng.
          </p>
          <p>
            3.2. Phương thức thanh toán: cổng thanh toán trực tuyến VNPay (thẻ, QR), chuyển khoản hoặc tiền mặt tại quầy tiếp đón của cơ
            sở.
          </p>
        </Article>

        <Article title="Điều 4. Hình thức ký kết và xác thực điện tử">
          <p>
            4.1. Hợp đồng này được tạo lập và ký kết bằng hình thức điện tử trên nền tảng Boxora, hoặc ký trực tiếp tại quầy tiếp đón của
            cơ sở.
          </p>
          <p>
            4.2. Chữ ký điện tử và thời điểm ký được lưu cùng bản hợp đồng trên hệ thống Boxora, có giá trị pháp lý theo quy định của Luật
            Giao dịch điện tử.
          </p>
        </Article>

        <Article title="Điều 5. Quyền ra vào và nghĩa vụ bảo vệ tài sản">
          <p>5.1. Bên B được ra vào khu vực kho 24/7 bằng mã PIN cá nhân hoặc mã QR do hệ thống Boxora cấp sau khi bàn giao.</p>
          <p>5.2. Nghiêm cấm lưu trữ chất cháy nổ, vũ khí, chất độc hại, động vật sống hoặc hàng cấm theo quy định của pháp luật Việt Nam.</p>
        </Article>
      </div>

      <div className="border-t border-line pt-8">
        <ContractSignatures contract={contract} />
      </div>

      <p className="border-t border-line pt-4 text-center text-xs text-fg-subtle">
        Bản hợp đồng số {contract.contractCode} được lưu trữ trên hệ thống Boxora.
      </p>
    </article>
  )
})
