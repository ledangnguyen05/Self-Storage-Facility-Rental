import { Alert, Field, Input, Radio, Select, cn } from '../../ui'
import { formatDate, todayISO } from '../../../lib/format'
import { CHECK_IN_TIME_OPTIONS, RENTAL_MONTH_OPTIONS, type CheckoutForm, type SigningMethod } from './checkoutTypes'

interface DetailsStepProps {
  email: string
  form: CheckoutForm
  onChange: (patch: Partial<CheckoutForm>) => void
  errors: { name?: string; phone?: string; date?: string; time?: string }
  /** Which of the two fields have been visited, so errors do not show on a fresh form. */
  touched: { name: boolean; phone: boolean }
  onTouch: (field: 'name' | 'phone') => void
  /** Profile fields that will be saved to the account when the booking is created. */
  profileChanges: string[]
  holdGraceHours: number
}

export function DetailsStep({ email, form, onChange, errors, touched, onTouch, profileChanges, holdGraceHours }: DetailsStepProps) {
  const signingOptions: { value: SigningMethod; label: string; description: string }[] = [
    {
      value: 'ONLINE',
      label: 'Ký hợp đồng và thanh toán trực tuyến',
      description: 'Thanh toán trực tuyến, sau đó ký hợp đồng điện tử. Mã PIN chỉ được kích hoạt sau khi hệ thống xác nhận đủ điều kiện bàn giao.',
    },
    {
      value: 'IN_PERSON',
      label: 'Giữ chỗ theo lịch hẹn',
      description: `Giữ kho đến lịch hẹn (${formatDate(form.startDate)} ${form.checkInTime}) cộng ${holdGraceHours} giờ gia hạn theo chính sách. Xem kho, ký và thanh toán tại quầy.`,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-fg">Thông tin người thuê</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Họ và tên" required error={touched.name ? errors.name : undefined}>
          <Input
            autoComplete="name"
            value={form.customerName}
            onChange={event => onChange({ customerName: event.target.value })}
            onBlur={() => onTouch('name')}
          />
        </Field>
        <Field label="Số điện thoại" required error={touched.phone ? errors.phone : undefined} hint="Nhân viên dùng số này để liên hệ khi bàn giao kho.">
          <Input
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="0901234567"
            value={form.customerPhone}
            onChange={event => onChange({ customerPhone: event.target.value })}
            onBlur={() => onTouch('phone')}
          />
        </Field>
      </div>

      <Field label="Email tài khoản" hint="Email đăng nhập, không thay đổi tại đây.">
        <Input type="email" value={email} readOnly disabled />
      </Field>

      {profileChanges.length > 0 ? (
        <Alert tone="info" title="Hồ sơ tài khoản sẽ được cập nhật">
          Khi bạn xác nhận đặt kho, {profileChanges.join(' và ')} mới sẽ được lưu vào hồ sơ tài khoản của bạn.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Ngày nhận kho dự kiến" required error={errors.date}>
          <Input type="date" min={todayISO()} value={form.startDate} onChange={event => onChange({ startDate: event.target.value })} />
        </Field>
        <Field label="Giờ hẹn nhận kho" required error={errors.time}>
          <Select value={form.checkInTime} onChange={event => onChange({ checkInTime: event.target.value })} options={CHECK_IN_TIME_OPTIONS} />
        </Field>
      </div>

      <Field
        label="Kỳ hạn thuê"
        hint="Ưu đãi theo kỳ hạn được tính trong báo giá ở bước tiếp theo. Ngày bắt đầu thuê chính thức chỉ được xác lập khi bàn giao thực tế."
      >
        <Select
          value={form.rentalMonths}
          onChange={event => onChange({ rentalMonths: Number(event.target.value) })}
          options={RENTAL_MONTH_OPTIONS}
        />
      </Field>

      <div className="border-t border-line pt-4">
        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-sm font-medium text-fg">Hình thức ký hợp đồng và nhận kho</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {signingOptions.map(option => {
              const selected = form.signingMethod === option.value
              return (
                <div
                  key={option.value}
                  className={cn('rounded-lg border p-3 transition-colors', selected ? 'border-accent bg-accent-subtle' : 'border-line hover:bg-surface-2')}
                >
                  <Radio
                    name="checkout-signing-method"
                    value={option.value}
                    checked={selected}
                    onChange={() => onChange({ signingMethod: option.value })}
                    label={option.label}
                    description={option.description}
                    className="w-full"
                  />
                </div>
              )
            })}
          </div>
        </fieldset>
      </div>
    </div>
  )
}
