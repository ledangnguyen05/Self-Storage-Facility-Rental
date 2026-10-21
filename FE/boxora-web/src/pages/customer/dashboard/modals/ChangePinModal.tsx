import { useState, type FormEvent } from 'react'
import { Shuffle } from 'lucide-react'
import { Alert, Button, Checkbox, Field, Input, Modal, useToast } from '@/components/ui'
import { getApiErrorMessage } from '@/lib/apiError'
import type { BookingPinData } from '@/services/bookingService'
import type { RentalContract } from '@/types'
import { generatePinSuggestion, isValidPin, toAccessTarget, updateUnitAccessPin } from '../lib/unitAccess'

interface ChangePinModalProps {
  contract: RentalContract
  onClose: () => void
  onUpdated: (data: Pick<BookingPinData, 'pin' | 'qrAccessToken'>) => void
}

const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, 6)

/** Sets a new 6-digit access PIN for a rented unit. */
export function ChangePinModal({ contract, onClose, onUpdated }: ChangePinModalProps) {
  const toast = useToast()
  const [pin, setPin] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState<{ pin?: string; confirmation?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [visible, setVisible] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: typeof errors = {}
    if (!isValidPin(pin)) nextErrors.pin = 'Mã PIN gồm đúng 6 chữ số.'
    if (confirmation !== pin) nextErrors.confirmation = 'Mã xác nhận không khớp.'
    setErrors(nextErrors)
    if (nextErrors.pin || nextErrors.confirmation) return

    setSubmitting(true)
    try {
      const result = await updateUnitAccessPin(toAccessTarget(contract), pin)
      toast.success('Đã đổi mã PIN', `Mã mới của kho ${contract.unitCode} đã được lưu trên hệ thống Boxora.`)
      onUpdated({ pin: result.pin || pin, qrAccessToken: result.qrAccessToken })
      onClose()
    } catch (err) {
      toast.error('Không thể đổi mã PIN', getApiErrorMessage(err, 'Cập nhật mã PIN thất bại. Vui lòng thử lại.'))
    } finally {
      setSubmitting(false)
    }
  }

  const suggest = () => {
    const value = generatePinSuggestion()
    setPin(value)
    setConfirmation(value)
    setVisible(true)
    setErrors({})
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!submitting}
      title="Đổi mã PIN"
      description={`Kho ${contract.unitCode}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" form="change-pin-form" loading={submitting}>
            Đổi mã PIN
          </Button>
        </>
      }
    >
      <form id="change-pin-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Alert tone="info" icon={null}>
          Mã PIN gồm 6 chữ số, không chia sẻ cho người khác. Môi trường thử nghiệm: khóa thông minh chưa kết nối, mã mới được lưu trên hệ thống Boxora để nhân viên đối chiếu khi bạn ra vào kho.
        </Alert>
        <Field label="Mã PIN mới" required error={errors.pin}>
          <Input
            type={visible ? 'text' : 'password'}
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            value={pin}
            onChange={event => setPin(digitsOnly(event.target.value))}
            className="font-mono tracking-widest"
          />
        </Field>
        <Field label="Nhập lại mã PIN" required error={errors.confirmation}>
          <Input
            type={visible ? 'text' : 'password'}
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            value={confirmation}
            onChange={event => setConfirmation(digitsOnly(event.target.value))}
            className="font-mono tracking-widest"
          />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Checkbox label="Hiện mã PIN" checked={visible} onCheckedChange={setVisible} />
          <Button variant="ghost" size="sm" leftIcon={Shuffle} onClick={suggest}>
            Tạo mã ngẫu nhiên
          </Button>
        </div>
      </form>
    </Modal>
  )
}
