import React, { useState } from 'react'
import { AlarmClock, CreditCard, FileText, PackageCheck, CalendarX } from 'lucide-react'
import { facilityPolicyService } from '../../services/facilityPolicyService'
import { useAsyncData } from '../../hooks/useAsyncData'
import { getApiErrorStatus } from '../../lib/apiError'
import { resolvePolicy } from '../../utils/facilityPolicyDefaults'
import { Alert, Button, Modal, SkeletonText, TabPanel, Tabs, type TabItem } from '../ui'
import {
  CancellationSection,
  OverdueSection,
  PaymentSection,
  RentalSection,
  ReturnSection,
} from './policy/PolicySections'

interface CustomerPolicyModalProps {
  isOpen: boolean
  onClose: () => void
  facilityId?: string
  facilityName?: string
}

type PolicyTab = 'rental' | 'payment' | 'cancellation' | 'return' | 'overdue'

const TABS_ID = 'customer-policy-tabs'

const TAB_ITEMS: TabItem<PolicyTab>[] = [
  { value: 'rental', label: 'Thuê kho', icon: FileText },
  { value: 'payment', label: 'Cọc và thanh toán', icon: CreditCard },
  { value: 'cancellation', label: 'Hủy và hoàn cọc', icon: CalendarX },
  { value: 'return', label: 'Trả kho', icon: PackageCheck },
  { value: 'overdue', label: 'Quá hạn', icon: AlarmClock },
]

export const CustomerPolicyModal: React.FC<CustomerPolicyModalProps> = ({ isOpen, onClose, facilityId, facilityName }) => {
  if (!isOpen) return null
  return <PolicyDialog onClose={onClose} facilityId={facilityId} facilityName={facilityName} />
}

function PolicyDialog({ onClose, facilityId, facilityName }: Omit<CustomerPolicyModalProps, 'isOpen'>) {
  const [tab, setTab] = useState<PolicyTab>('rental')

  // 404 means the facility has no policy of its own (backend defaults apply); any other failure is surfaced.
  const policyQuery = useAsyncData(
    async (signal) => {
      try {
        return await facilityPolicyService.getByFacilityId(facilityId as string, { signal })
      } catch (err) {
        if (getApiErrorStatus(err) === 404) return null
        throw err
      }
    },
    [facilityId],
    { enabled: Boolean(facilityId) },
  )

  const policy = resolvePolicy(policyQuery.data, facilityId)
  const isLoading = policyQuery.isLoading
  const hasError = Boolean(policyQuery.error)
  const usesDefaults = !facilityId || policyQuery.data === null

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Chính sách thuê kho"
      description={facilityName ? `${facilityName} · Chính sách áp dụng khi thuê kho Boxora` : 'Chính sách áp dụng khi thuê kho Boxora'}
      footer={<Button onClick={onClose}>Đã hiểu</Button>}
    >
      <div className="flex flex-col gap-4">
        <Tabs aria-label="Nhóm chính sách" id={TABS_ID} items={TAB_ITEMS} value={tab} onValueChange={setTab} />

        {hasError ? (
          <Alert
            tone="warning"
            title="Không tải được chính sách của cơ sở"
            action={
              <Button size="sm" variant="secondary" onClick={() => void policyQuery.reload()}>
                Thử lại
              </Button>
            }
          >
            Các mức dưới đây là chính sách mặc định của Boxora và có thể khác với cơ sở này.
          </Alert>
        ) : usesDefaults && !isLoading ? (
          <Alert tone="info">
            {facilityId
              ? 'Cơ sở này chưa cấu hình chính sách riêng, các mức dưới đây là chính sách mặc định của Boxora.'
              : 'Các mức dưới đây là chính sách mặc định của Boxora. Mức áp dụng thực tế có thể khác theo từng cơ sở.'}
          </Alert>
        ) : null}

        <TabPanel tabsId={TABS_ID} value={tab}>
          {isLoading ? (
            <div className="flex flex-col gap-4" aria-busy="true">
              <SkeletonText lines={4} />
              <SkeletonText lines={3} />
            </div>
          ) : (
            <>
              {tab === 'rental' && <RentalSection policy={policy} />}
              {tab === 'payment' && <PaymentSection policy={policy} />}
              {tab === 'cancellation' && <CancellationSection policy={policy} />}
              {tab === 'return' && <ReturnSection policy={policy} />}
              {tab === 'overdue' && <OverdueSection policy={policy} />}
            </>
          )}
        </TabPanel>
      </div>
    </Modal>
  )
}
