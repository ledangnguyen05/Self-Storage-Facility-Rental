import React from 'react'
import { BookOpen } from 'lucide-react'
import { Alert, Badge, Button, EmptyState, Modal, SkeletonText } from '@/components/ui'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage, getApiErrorStatus } from '@/lib/apiError'
import { formatCurrency, formatNumber } from '@/lib/format'
import { facilityPolicyService } from '@/services/facilityPolicyService'
import { resolvePolicy, type ResolvedFacilityPolicy } from '@/utils/facilityPolicyDefaults'

interface StaffPolicyGuideModalProps {
  isOpen: boolean
  onClose: () => void
  facilityId?: string
  facilityName?: string
}

/** Read-only operating rules for front-desk staff, from the facility policy (defaults when none is set). */
export const StaffPolicyGuideModal: React.FC<StaffPolicyGuideModalProps> = ({ isOpen, onClose, facilityId, facilityName }) => {
  const query = useAsyncData(
    async (signal) => {
      try {
        return { policy: await facilityPolicyService.getByFacilityId(facilityId as string, { signal }), isDefault: false }
      } catch (err) {
        if (getApiErrorStatus(err) === 404) return { policy: null, isDefault: true }
        throw err
      }
    },
    [facilityId, isOpen],
    { enabled: isOpen && Boolean(facilityId), keepPreviousData: false },
  )

  const policy = query.data ? resolvePolicy(query.data.policy, facilityId) : null

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="lg"
      title="Hướng dẫn nghiệp vụ quầy"
      description="Quy định áp dụng khi đón khách, bàn giao, trả kho và xử lý quá hạn."
      footer={<Button onClick={onClose}>Đóng</Button>}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{facilityName || 'Chưa xác định cơ sở'}</Badge>
          {query.data?.isDefault ? <Badge tone="info">Chính sách mặc định</Badge> : null}
        </div>

        <Alert tone="info">
          Nhân viên quầy chỉ xem để đối chiếu. Đề xuất điều chỉnh gửi quản lý cơ sở hoặc giám đốc vận hành.
        </Alert>

        {!facilityId ? (
          <EmptyState
            icon={BookOpen}
            size="sm"
            title="Chưa chọn cơ sở"
            description="Chọn một cơ sở ở thanh trên cùng để xem quy định đang áp dụng."
          />
        ) : query.isLoading ? (
          <div className="flex flex-col gap-4" aria-busy="true">
            <SkeletonText lines={4} />
            <SkeletonText lines={4} />
          </div>
        ) : query.error ? (
          <Alert
            tone="danger"
            title="Không tải được chính sách của cơ sở"
            action={
              <Button size="sm" variant="secondary" onClick={() => void query.reload()}>
                Thử lại
              </Button>
            }
          >
            {getApiErrorMessage(query.error)}
          </Alert>
        ) : policy ? (
          <PolicySections policy={policy} />
        ) : null}
      </div>
    </Modal>
  )
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line p-4">
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fg-muted">{children}</ul>
    </section>
  )
}

const Strong = ({ children }: { children: React.ReactNode }) => <strong className="font-medium text-fg tabular-nums">{children}</strong>

function PolicySections({ policy }: { policy: ResolvedFacilityPolicy }) {
  return (
    <>
      {policy.isActive === false ? (
        <Alert tone="warning">Chính sách của cơ sở đang tạm ngưng. Xác nhận quy định hiện hành với quản lý cơ sở.</Alert>
      ) : null}
      <PolicySection title="1. Tiền cọc và bàn giao">
        <li>
          Tiền cọc bắt buộc: <Strong>{formatNumber(policy.depositPercentage)}% tiền thuê</Strong>.
        </li>
        <li>
          Thời gian thuê tối thiểu: <Strong>{policy.minimumRentalMonths} tháng</Strong>.
        </li>
        <li>
          Đăng ký gia hạn trước khi hết hạn: <Strong>{policy.renewalWindowDays} ngày</Strong>.
        </li>
        <li>Chỉ bàn giao mã PIN sau khi đối chiếu giấy tờ gốc và đủ bốn điều kiện nhận kho.</li>
      </PolicySection>
      <PolicySection title="2. Nghiệm thu trả kho và hoàn cọc">
        <li>
          Khách báo trước khi trả kho: <Strong>{policy.returnNoticeDays > 0 ? `${policy.returnNoticeDays} ngày` : 'không bắt buộc'}</Strong>.
        </li>
        <li>
          Hoàn cọc trong vòng <Strong>{policy.depositRefundSlaDays} ngày làm việc</Strong>.
        </li>
        <li>Bắt buộc chụp ảnh hiện trạng và lập biên bản nghiệm thu trước khi đề xuất hoàn cọc.</li>
        <li>Hư hỏng tài sản được khấu trừ vào tiền cọc; đề xuất có khấu trừ cần kế toán duyệt.</li>
      </PolicySection>
      <PolicySection title="3. Hủy đặt kho">
        <li>
          Hủy trước ít nhất <Strong>{policy.cancellationFullRefundHours} giờ</Strong>: hoàn toàn bộ tiền cọc.
        </li>
        <li>
          Hủy trong khoảng {policy.cancellationPartialRefundHours}–{policy.cancellationFullRefundHours} giờ: hoàn{' '}
          <Strong>{formatNumber(policy.cancellationPartialRefundPercent)}% tiền cọc</Strong>.
        </li>
        <li>
          Hủy dưới <Strong>{policy.cancellationPartialRefundHours} giờ</Strong>: không hoàn tiền cọc.
        </li>
      </PolicySection>
      <PolicySection title="4. Quá hạn và niêm phong">
        <li>
          Thời gian ân hạn: <Strong>{policy.overdueGraceDays} ngày</Strong>, chưa tính phí trễ hạn.
        </li>
        <li>
          Phí trễ hạn: <Strong>{formatCurrency(policy.dailyLateFee)}/ngày</Strong> sau thời gian ân hạn.
        </li>
        <li>
          Tạm khóa mã PIN sau <Strong>{policy.overdueAccessDisableDays} ngày</Strong> quá hạn.
        </li>
        <li>
          Niêm phong kho sau <Strong>{policy.overdueSealingDays} ngày</Strong> quá hạn, cần có người chứng kiến.
        </li>
      </PolicySection>
    </>
  )
}
