import React, { useState } from 'react'
import { Alert, Button, Field, Input, Modal, Select, useToast } from '@/components/ui'
import { getRoleMeta } from '@/constants/statusMeta'
import { getApiErrorMessage } from '@/lib/apiError'
import { PASSWORD_MIN_LENGTH } from '@/pages/public/auth/credentialRules'
import { userService } from '@/services/userService'
import type { Facility, Role, User } from '@/types'
import {
  findRole,
  initialUserFormValues,
  roleNeedsFacility,
  validateUserForm,
  type UserFormErrors,
  type UserFormMode,
  type UserFormValues,
} from '../lib/userForm'

export interface UserFormModalProps {
  mode: UserFormMode
  /** The account being edited (edit mode). */
  user?: User
  roles: readonly Role[]
  facilities: readonly Facility[]
  onClose: () => void
  /** Called after the backend accepted the change, before the modal closes. */
  onSaved: () => void
}

const FORM_ID = 'user-form'

/** Create an account or edit an existing one. Mounted only while open, so the form always starts fresh. */
export function UserFormModal({ mode, user, roles, facilities, onClose, onSaved }: UserFormModalProps) {
  const toast = useToast()
  const [values, setValues] = useState<UserFormValues>(() => initialUserFormValues(mode, roles, user))
  const [errors, setErrors] = useState<UserFormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEdit = mode === 'edit'
  const selectedRole = findRole(roles, values.roleId)
  const needsFacility = roleNeedsFacility(selectedRole?.name)

  const setField = <K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) => {
    setValues(current => ({ ...current, [key]: value }))
    setErrors(current => (current[key] ? { ...current, [key]: undefined } : current))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitError(null)
    const nextErrors = validateUserForm(values, mode, roles)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)
    try {
      const facilityId = needsFacility ? values.facilityId : undefined
      if (isEdit && user) {
        const previous = initialUserFormValues('edit', roles, user)
        await userService.updateUser(user.id, {
          fullName: values.fullName.trim(),
          ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
          ...(values.roleId !== previous.roleId ? { roleId: values.roleId } : {}),
          ...(facilityId && facilityId !== previous.facilityId ? { facilityId } : {}),
        })
        toast.success('Đã cập nhật tài khoản', values.fullName.trim())
      } else {
        await userService.createUser({
          username: values.username.trim(),
          // Addresses are case-insensitive; the backend stores the lower-case form.
          email: values.email.trim().toLowerCase(),
          password: values.password,
          fullName: values.fullName.trim(),
          phone: values.phone.trim(),
          roleId: values.roleId,
          facilityId,
        })
        toast.success('Đã tạo tài khoản', `${values.fullName.trim()} có thể đăng nhập bằng mật khẩu ban đầu.`)
      }
      onSaved()
      onClose()
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, isEdit ? 'Không thể cập nhật tài khoản.' : 'Không thể tạo tài khoản.'))
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!isSubmitting}
      size="md"
      title={isEdit ? 'Chỉnh sửa tài khoản' : 'Tạo tài khoản'}
      description={isEdit ? user?.email : 'Tài khoản dùng mật khẩu ban đầu bạn đặt và có thể đổi sau khi đăng nhập.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" form={FORM_ID} loading={isSubmitting}>
            {isEdit ? 'Lưu thay đổi' : 'Tạo tài khoản'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {submitError ? (
          <Alert tone="danger" title={isEdit ? 'Không thể lưu tài khoản' : 'Không thể tạo tài khoản'}>
            {submitError}
          </Alert>
        ) : null}

        <Field label="Họ và tên" required error={errors.fullName}>
          <Input value={values.fullName} maxLength={30} autoComplete="off" placeholder="Họ và tên đầy đủ" onChange={event => setField('fullName', event.target.value)} />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tên đăng nhập" required={!isEdit} error={errors.username}>
            <Input
              value={values.username}
              maxLength={30}
              autoComplete="off"
              disabled={isEdit}
              placeholder="Chữ thường, không dấu"
              onChange={event => setField('username', event.target.value)}
            />
          </Field>
          <Field label="Số điện thoại" required={!isEdit} error={errors.phone}>
            <Input type="tel" value={values.phone} inputMode="tel" autoComplete="off" placeholder="Số di động 10 chữ số" onChange={event => setField('phone', event.target.value)} />
          </Field>
        </div>

        <Field label="Email" required={!isEdit} error={errors.email}>
          <Input type="email" value={values.email} disabled={isEdit} autoComplete="off" placeholder="ten@congty.vn" onChange={event => setField('email', event.target.value)} />
        </Field>

        {!isEdit ? (
          <Field label="Mật khẩu ban đầu" required error={errors.password} hint={`Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự.`}>
            <Input type="password" value={values.password} autoComplete="new-password" onChange={event => setField('password', event.target.value)} />
          </Field>
        ) : null}

        <Field label="Vai trò" required error={errors.roleId}>
          <Select
            value={values.roleId}
            placeholder="Chọn vai trò"
            onChange={event => {
              setField('roleId', event.target.value)
              if (!roleNeedsFacility(findRole(roles, event.target.value)?.name)) setField('facilityId', '')
            }}
            options={roles.map(role => ({ value: role.id, label: getRoleMeta(role.name).label }))}
          />
        </Field>

        {needsFacility ? (
          <Field label="Cơ sở trực thuộc" required error={errors.facilityId} hint="Nhân viên và quản lý cơ sở chỉ thấy dữ liệu của cơ sở này.">
            <Select
              value={values.facilityId}
              placeholder="Chọn cơ sở"
              onChange={event => setField('facilityId', event.target.value)}
              options={facilities.map(facility => ({ value: facility.id, label: facility.code ? `${facility.name} (${facility.code})` : facility.name }))}
            />
          </Field>
        ) : null}
      </form>
    </Modal>
  )
}
