import React from 'react'
import { LocateFixed, Search } from 'lucide-react'
import { Alert, Button, Field, IconButton, Input } from '../../../components/ui'
import type { CustomerLocationState } from './useCustomerLocation'

interface LocateControlProps {
  customer: CustomerLocationState
  label?: string
  hint?: string
  /** Extra result line under the notice (e.g. "no branch has coordinates yet"). */
  children?: React.ReactNode
}

/**
 * "Vị trí của bạn": address search (Nominatim) and a GPS button. Shared by the units explorer filters and the home page.
 * Shows what happened (found, denied, not found) so the visitor is never left guessing.
 */
export function LocateControl({
  customer,
  label = 'Vị trí của bạn',
  hint = 'Nhập địa chỉ hoặc dùng GPS để xem khoảng cách tới từng cơ sở.',
  children,
}: LocateControlProps) {
  return (
    <div className="space-y-3">
      <Field label={label} hint={hint}>
        <div className="flex items-center gap-2">
          <Input
            value={customer.address}
            onChange={event => customer.setAddress(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void customer.searchAddress()
              }
            }}
            placeholder="Địa chỉ hoặc khu vực"
            autoComplete="street-address"
          />
          <IconButton
            icon={Search}
            variant="secondary"
            aria-label="Tìm vị trí theo địa chỉ"
            tooltip
            loading={customer.isSearching}
            disabled={!customer.address.trim()}
            onClick={() => void customer.searchAddress()}
          />
        </div>
      </Field>

      <Button variant="secondary" fullWidth leftIcon={LocateFixed} loading={customer.isLocating} onClick={customer.locateWithGps}>
        Vị trí của tôi
      </Button>

      {customer.notice ? (
        <Alert tone={customer.notice.tone === 'warning' ? 'warning' : customer.notice.tone === 'success' ? 'success' : 'info'}>
          {customer.notice.message}
        </Alert>
      ) : null}

      {children}
    </div>
  )
}
