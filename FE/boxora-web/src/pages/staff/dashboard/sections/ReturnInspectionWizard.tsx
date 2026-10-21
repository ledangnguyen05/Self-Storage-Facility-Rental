import React from 'react'
import { Undo2 } from 'lucide-react'
import { Card, CardContent, CardHeader, EmptyState } from '@/components/ui'
import { ReturnWizardBody } from '../return/ReturnWizardBody'
import type { ReturnQueueItem } from '../utils/frontDesk'

interface ReturnInspectionWizardProps {
  item: ReturnQueueItem | null
  onCompleted: (item: ReturnQueueItem) => void
}

/** Return wizard: 1 return date → 2 inspection and damage → 3 deductions and refund → 4 confirm. */
export function ReturnInspectionWizard({ item, onCompleted }: ReturnInspectionWizardProps) {
  return (
    <Card id="return-workbench">
      <CardHeader title="Trả kho" description="Nghiệm thu hiện trạng, khấu trừ và đề xuất hoàn cọc" divider />
      <CardContent>
        {item ? (
          <ReturnWizardBody key={item.bookingId} item={item} onCompleted={onCompleted} />
        ) : (
          <EmptyState
            icon={Undo2}
            title="Chưa chọn hợp đồng"
            description="Chọn một hợp đồng trong danh sách Trả kho để bắt đầu nghiệm thu."
          />
        )}
      </CardContent>
    </Card>
  )
}
