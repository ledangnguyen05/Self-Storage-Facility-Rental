import React, { useEffect, useState } from 'react'
import { facilityService } from '../../services/facilityService'
import { Facility } from '../../types'

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

export const FacilityScopingModal: React.FC<FacilityScopingModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialUser
}) => {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState(initialUser?.facilityId || '')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setIsLoading(true)
    setError(null)
    setSuccess(false)
    facilityService.getFacilities()
      .then(result => {
        if (!active) return
        const availableFacilities = result?.content || []
        setFacilities(availableFacilities)
        setSelectedFacilityId(current => {
          if (initialUser?.facilityId && availableFacilities.some(facility => facility.id === initialUser.facilityId)) {
            return initialUser.facilityId
          }
          return availableFacilities[0]?.id || ''
        })
      })
      .catch(() => {
        if (active) setError('Không tải được danh sách cơ sở. Vui lòng thử đóng và mở lại cửa sổ.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => { active = false }
  }, [isOpen, initialUser?.facilityId])

  if (!isOpen) return null

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedFacilityId) {
      setError('Hãy chọn một cơ sở đang hoạt động.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await onSave({ facilityId: selectedFacilityId })
      setSuccess(true)
      window.setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 900)
    } catch {
      setError('Không thể cập nhật cơ sở cho tài khoản. Dữ liệu chưa được thay đổi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-blue-50 via-white to-cyan-50 border-b border-slate-200 text-slate-900 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 text-cyan-200 flex items-center justify-center">
              <span className="material-symbols-outlined">domain</span>
            </div>
            <div>
              <h2 className="text-base font-bold">Gán cơ sở cho tài khoản</h2>
              <p className="mt-1 text-xs text-slate-300">Thay đổi phạm vi cơ sở được lưu trực tiếp vào hồ sơ tài khoản.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="w-8 h-8 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="font-semibold text-slate-900">{initialUser?.fullName || 'Tài khoản'}</div>
            <div className="mt-1 text-xs text-slate-500">{initialUser?.email || '—'}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-md bg-white px-2 py-1 border border-slate-200 text-slate-600">{initialUser?.roleName || 'Chưa có vai trò'}</span>
              <span className="rounded-md bg-white px-2 py-1 border border-slate-200 text-slate-500 font-mono">ID: {initialUser?.id || '—'}</span>
            </div>
          </div>

          <fieldset disabled={isLoading || isSubmitting || facilities.length === 0}>
            <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">Cơ sở</legend>
            {isLoading ? (
              <div className="grid gap-2 sm:grid-cols-2" aria-label="Đang tải danh sách cơ sở">
                {[0, 1].map(item => <div key={item} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)}
              </div>
            ) : facilities.length > 0 ? (
              <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                {facilities.map(facility => (
                  <label key={facility.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${selectedFacilityId === facility.id ? 'border-cyan-600 bg-cyan-50 ring-1 ring-cyan-600' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input type="radio" name="facility" value={facility.id} checked={selectedFacilityId === facility.id} onChange={() => setSelectedFacilityId(facility.id)} className="mt-0.5 accent-cyan-700" />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-900">{facility.name}</span>
                      <span className="mt-1 block text-[11px] text-slate-500">{[facility.address, facility.city].filter(Boolean).join(', ') || facility.code || 'Chưa có địa chỉ'}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Chưa có cơ sở để gán.</p>
            )}
          </fieldset>

          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>}
          {success && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">Đã cập nhật cơ sở cho tài khoản.</p>}

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Hủy</button>
            <button type="submit" disabled={isLoading || isSubmitting || facilities.length === 0 || !selectedFacilityId} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              {isSubmitting && <span className="material-symbols-outlined animate-spin text-[15px]">progress_activity</span>}
              Lưu cơ sở
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
