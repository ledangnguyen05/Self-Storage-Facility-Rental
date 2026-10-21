import React, { useId, useState } from 'react'
import { BuildingComplex } from 'lucide-react'
import { getRoleMeta } from '../../constants/statusMeta'
import { useAsyncData } from '../../hooks/useAsyncData'
import { getApiErrorMessage } from '../../lib/apiError'
import { facilityService } from '../../services/facilityService'
import type { Facility } from '../../types'
import { Alert, Avatar, Badge, Button, EmptyState, Modal, Skeleton, useToast } from '../ui'
import { cn } from '../ui/cn'

interface FacilityScopingModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { facilityId: string }) => Promise<void> | void
  initialUser?: {
    id: string
    fullName: string
    email: string
    roleName: string
    facilityId?: string
  } | null
}

/** Assigns an account to one facility. The parent persists the choice in `onSave`. */
export const FacilityScopingModal: React.FC<FacilityScopingModalProps> = ({ isOpen, ...props }) =>
  // Mounted only while open so the selection always starts from the account's current facility.
  isOpen ? <FacilityScopingDialog {...props} /> : null

function FacilityScopingDialog({ onClose, onSave, initialUser }: Omit<FacilityScopingModalProps, 'isOpen'>) {
  const toast = useToast()
  const formId = useId()
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const { data, error, isLoading, reload } = useAsyncData(
    signal => facilityService.getFacilities(undefined, { signal }),
    [],
  )
  const facilities: Facility[] = data?.content ?? []

  // Default: the account's current facility when it still exists, else the first one.
  const defaultId =
    initialUser?.facilityId && facilities.some(facility => facility.id === initialUser.facilityId)
      ? initialUser.facilityId
      : (facilities[0]?.id ?? '')
  const selectedId = pickedId ?? defaultId
  const roleMeta = getRoleMeta(initialUser?.roleName)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedId) {
      setSaveError('Hãy chọn một cơ sở đang hoạt động.')
      return
    }
    setIsSubmitting(true)
    setSaveError(null)
    try {
      await onSave({ facilityId: selectedId })
      toast.success('Đã cập nhật cơ sở cho tài khoản')
      onClose()
    } catch (submitError) {
      setSaveError(getApiErrorMessage(submitError, 'Không thể cập nhật cơ sở cho tài khoản. Dữ liệu chưa được thay đổi.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Gán cơ sở cho tài khoản"
      description="Thay đổi phạm vi cơ sở được lưu trực tiếp vào hồ sơ tài khoản."
      dismissible={!isSubmitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" form={formId} loading={isSubmitting} disabled={isLoading || facilities.length === 0 || !selectedId}>
            Lưu cơ sở
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 p-3">
          <Avatar name={initialUser?.fullName} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{initialUser?.fullName || 'Tài khoản'}</p>
            <p className="truncate text-dense text-fg-muted">{initialUser?.email || '—'}</p>
          </div>
          {initialUser?.roleName ? (
            <Badge size="sm" tone={roleMeta.tone} className="shrink-0">
              {roleMeta.label}
            </Badge>
          ) : null}
        </div>

        <fieldset disabled={isLoading || isSubmitting || facilities.length === 0} className="min-w-0">
          <legend className="mb-2 text-sm font-medium text-fg">Cơ sở</legend>
          {isLoading ? (
            <div className="grid gap-2 sm:grid-cols-2" aria-label="Đang tải danh sách cơ sở">
              {[0, 1, 2, 3].map(item => (
                <Skeleton key={item} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : error && facilities.length === 0 ? (
            <Alert
              tone="danger"
              action={
                <Button size="sm" variant="secondary" onClick={() => void reload()}>
                  Thử lại
                </Button>
              }
            >
              Không tải được danh sách cơ sở.
            </Alert>
          ) : facilities.length === 0 ? (
            <EmptyState size="sm" icon={BuildingComplex} title="Chưa có cơ sở để gán" className="rounded-lg border border-line" />
          ) : (
            <div className="grid max-h-72 gap-2 overflow-y-auto p-0.5 sm:grid-cols-2">
              {facilities.map(facility => {
                const checked = selectedId === facility.id
                return (
                  <label
                    key={facility.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                      'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
                      checked ? 'border-accent bg-accent-subtle' : 'border-line hover:border-line-strong hover:bg-surface-2',
                    )}
                  >
                    <input
                      type="radio"
                      name={`${formId}-facility`}
                      value={facility.id}
                      checked={checked}
                      onChange={() => setPickedId(facility.id)}
                      className="mt-0.5 size-4 shrink-0 accent-accent"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fg">{facility.name}</span>
                      <span className="mt-0.5 block text-xs text-fg-muted">
                        {[facility.address, facility.city].filter(Boolean).join(', ') || facility.code || 'Chưa có địa chỉ'}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </fieldset>

        {saveError ? <Alert tone="danger">{saveError}</Alert> : null}
      </form>
    </Modal>
  )
}
