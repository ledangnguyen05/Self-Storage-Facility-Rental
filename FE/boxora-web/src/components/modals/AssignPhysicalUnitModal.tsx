import React, { useState, useEffect, useMemo } from 'react'
import { X, Check, Key, ShieldCheck, Mail, AlertCircle, Box, Layers, Filter } from 'lucide-react'
import { Booking, StorageUnit } from '../../types'
import { storageUnitService } from '../../services/storageUnitService'
import { bookingService } from '../../services/bookingService'

interface AssignPhysicalUnitModalProps {
  isOpen: boolean
  booking: Booking | null
  facilityId?: string
  onClose: () => void
  onSuccess: (updatedBooking: Booking) => void
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const EQUIVALENT_TYPE_GROUPS: string[][] = [
  ['10000000-0000-0000-0000-000000000001', '5a11bcbb-f3a1-44f6-89a6-fb461be8158c'], // Mini/Locker (1m² / 1m³)
  ['10000000-0000-0000-0000-000000000002', 'e56d6554-5a81-4af1-a392-29db319252c1'], // Medium/Compact Studio (3m² / 3m³)
  ['10000000-0000-0000-0000-000000000003', 'fedddc98-983a-4925-81cf-dbf8da4d5a4e'], // Standard (6m² / 6m³)
  ['10000000-0000-0000-0000-000000000004', 'ce41ba29-16d6-4af0-99b1-a2407cbe1345'], // Extra Large (12m² / 12-25m³)
  ['10000000-0000-0000-0000-000000000005'], // Cold Storage (5m²)
]

function extractAreaNumber(area?: number | string | null, name?: string | null): number | null {
  if (typeof area === 'number' && !Number.isNaN(area) && area > 0) return area
  if (typeof area === 'string' && area.trim()) {
    const parsed = parseFloat(area.replace(',', '.'))
    if (!Number.isNaN(parsed) && parsed > 0) return parsed
  }
  if (name) {
    const match = name.match(/(\d+(?:[.,]\d+)?)\s*m(?:³|3|²|2)?/i)
    if (match) {
      const val = parseFloat(match[1].replace(',', '.'))
      if (!Number.isNaN(val) && val > 0) return val
    }
  }
  return null
}

function normalizeTypeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function isUnitMatchingBookedSize(
  u: StorageUnit,
  targetTypeId?: string | null,
  targetName?: string | null,
  targetArea?: number | string | null
): boolean {
  // 1. Khớp tuyệt đối theo Unit Type ID nếu cả 2 bên đều có id
  if (targetTypeId && u.unitTypeId) {
    if (u.unitTypeId.toLowerCase() === targetTypeId.toLowerCase()) return true
    for (const group of EQUIVALENT_TYPE_GROUPS) {
      const lowerGroup = group.map((id) => id.toLowerCase())
      if (lowerGroup.includes(targetTypeId.toLowerCase()) && lowerGroup.includes(u.unitTypeId.toLowerCase())) {
        return true
      }
    }
    // Cả 2 đều có mã loại kho rõ ràng nhưng khác nhau -> Không trùng loại!
    return false
  }

  const parsedTargetArea = extractAreaNumber(targetArea, targetName)
  const parsedUnitArea = extractAreaNumber(u.areaSqMeters, u.unitTypeName)

  // 2. Đối chiếu theo tên loại kho nếu có
  if (targetName && u.unitTypeName) {
    const t = normalizeTypeName(targetName)
    const n = normalizeTypeName(u.unitTypeName)

    if (t === n && t.length > 0) {
      if (parsedTargetArea != null && parsedUnitArea != null) {
        return Math.abs(parsedTargetArea - parsedUnitArea) <= 1.0
      }
      return true
    }

    if (t.length >= 4 && n.length >= 4 && (t.includes(n) || n.includes(t))) {
      if (parsedTargetArea != null && parsedUnitArea != null) {
        return Math.abs(parsedTargetArea - parsedUnitArea) <= 1.0
      }
      return true
    }

    return false
  }

  // 3. Dự phòng đối chiếu theo diện tích nếu thiếu tên hoặc id
  if (parsedTargetArea != null && parsedUnitArea != null) {
    return Math.abs(parsedTargetArea - parsedUnitArea) <= 0.5
  }

  return false
}

export const AssignPhysicalUnitModal: React.FC<AssignPhysicalUnitModalProps> = ({
  isOpen,
  booking,
  facilityId,
  onClose,
  onSuccess,
}) => {
  const [allUnits, setAllUnits] = useState<StorageUnit[]>([])
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [selectedUnitId, setSelectedUnitId] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAllSizes, setShowAllSizes] = useState<boolean>(false)
  const [successData, setSuccessData] = useState<{
    unitCode: string
    pin: string
    bookingCode: string
  } | null>(null)

  const targetFacilityId = useMemo(() => {
    if (booking?.facilityId && UUID_REGEX.test(booking.facilityId)) return booking.facilityId
    if (facilityId && facilityId !== 'ALL' && UUID_REGEX.test(facilityId)) return facilityId
    return booking?.facilityId || (facilityId !== 'ALL' ? facilityId : undefined)
  }, [booking?.facilityId, facilityId])

  // Định danh loại kho khách hàng đã chọn trong hợp đồng
  const bookedUnitTypeId = booking?.unitTypeId
  const bookedUnitTypeName = useMemo(() => {
    if (!booking) return ''
    if (booking.unitTypeName) return booking.unitTypeName
    const rawAny = booking as any
    if (rawAny.tier?.name) return rawAny.tier.name
    if (rawAny.sizeName) return rawAny.sizeName
    if (rawAny.size?.name) return rawAny.size.name
    if (rawAny.size?.volumeText) return rawAny.size.volumeText
    if (booking.unitCode && (booking.unitCode.includes('m') || booking.unitCode.includes('Kho') || booking.unitCode.includes('Locker') || booking.unitCode.includes('Box'))) {
      return booking.unitCode
    }
    return ''
  }, [booking])

  const bookedUnitArea = useMemo(() => {
    if (!booking) return null
    return (
      booking.areaSqMeters ??
      (booking as any)?.storageUnit?.areaSqMeters ??
      (booking as any)?.unitType?.areaSqm ??
      (booking as any)?.size?.areaSqMeters ??
      extractAreaNumber(null, bookedUnitTypeName)
    )
  }, [booking, bookedUnitTypeName])

  useEffect(() => {
    if (!isOpen || !booking) {
      setAllUnits([])
      setSelectedUnitId('')
      setNotes('')
      setError(null)
      setShowAllSizes(false)
      setSuccessData(null)
      return
    }

    setLoadingUnits(true)
    setError(null)

    storageUnitService
      .getUnits({
        facilityId: targetFacilityId,
      })
      .then((data) => {
        const availableList = (data || []).filter((u) => {
          const st = String(u.status || '').toUpperCase().trim()
          return (
            st === 'AVAILABLE' ||
            st === 'RESERVED' ||
            st === 'PENDING_HANDOVER' ||
            (u.status as string) === 'Trống' ||
            (u.status as string) === 'Chờ bàn giao'
          )
        })
        setAllUnits(availableList)

        const targetTypeId = booking.unitTypeId
        const targetName = bookedUnitTypeName.trim()

        const assignableList = availableList.filter((u) => {
          const isHeldByOther =
            (String(u.status || '').toUpperCase() === 'RESERVED' || (u.status as string) === 'Chờ bàn giao') &&
            u.bookingId &&
            u.bookingId !== booking.id
          return !isHeldByOther
        })
        const matched = assignableList.filter((u) => isUnitMatchingBookedSize(u, targetTypeId, targetName, bookedUnitArea))

        if (matched.length > 0) {
          setSelectedUnitId(matched[0].id)
          setShowAllSizes(false)
        } else if (assignableList.length > 0) {
          setSelectedUnitId(assignableList[0].id)
          setShowAllSizes(true)
        } else {
          setSelectedUnitId('')
        }
      })
      .catch((err) => {
        console.error('Failed to load available units:', err)
        setError('Không thể tải danh sách ô kho trống của cơ sở. Vui lòng thử lại.')
      })
      .finally(() => setLoadingUnits(false))
  }, [isOpen, booking, targetFacilityId, bookedUnitTypeName, bookedUnitArea])

  // Lọc các ô kho còn trống thuộc loại kho khách đã chọn trong hợp đồng
  const matchingUnits = useMemo(() => {
    if (!booking) return []
    const targetTypeId = booking.unitTypeId
    const targetName = bookedUnitTypeName.trim()

    return allUnits.filter((u) => isUnitMatchingBookedSize(u, targetTypeId, targetName, bookedUnitArea))
  }, [allUnits, booking, bookedUnitTypeName, bookedUnitArea])

  // Danh sách hiển thị: mặc định hiển thị ô kho khớp loại khách đã chọn
  const displayUnits = useMemo(() => {
    if (showAllSizes) {
      return allUnits
    }
    if (matchingUnits.length > 0 || bookedUnitTypeId || bookedUnitTypeName) {
      return matchingUnits
    }
    return allUnits
  }, [showAllSizes, matchingUnits, allUnits, bookedUnitTypeId, bookedUnitTypeName])

  const selectedUnit = useMemo(
    () => allUnits.find((u) => u.id === selectedUnitId) || null,
    [allUnits, selectedUnitId]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!booking || !selectedUnitId) {
      setError('Vui lòng chọn một ô kho vật lý đang trống để gán.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const hasValidBackendUuid = Boolean(booking.id && UUID_REGEX.test(booking.id.trim()))
      const primaryIdOrCode = hasValidBackendUuid ? booking.id.trim() : (booking.bookingCode || booking.id)

      let updated: Booking | null = null

      try {
        updated = await bookingService.assignUnitAndProvision(primaryIdOrCode, selectedUnitId, notes)
      } catch (firstErr: any) {
        // Nếu gọi bằng UUID không tìm thấy nhưng có bookingCode hợp lệ -> thử gọi theo bookingCode
        if (hasValidBackendUuid && booking.bookingCode) {
          try {
            updated = await bookingService.assignUnitAndProvision(booking.bookingCode.trim(), selectedUnitId, notes)
          } catch {
            // Sẽ xử lý ở bước auto-sync bên dưới
          }
        }

        // Nếu đơn đặt chỗ chỉ mới lưu ở localStorage (chưa có trong DB Backend), tự động đồng bộ lên Backend rồi gán kho
        if (!updated) {
          const status = firstErr?.response?.status
          const errCode = firstErr?.response?.data?.errorCode
          if (status === 404 || errCode === 'BOOKING_NOT_FOUND' || !hasValidBackendUuid) {
            const rawPhone = (booking.customerPhone || '0912345678').replace(/[\s.-]/g, '')
            const validPhone = /^(0|\+84)(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/.test(rawPhone)
              ? rawPhone
              : '0912345678'
            const validEmail =
              booking.customerEmail && /^[A-Za-z0-9+_.-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})$/.test(booking.customerEmail.trim())
                ? booking.customerEmail.trim()
                : 'khachhang@boxora.vn'
            const cleanName = (booking.customerName || 'Khach Hang Boxora')
              .replace(/[^\p{L}\s]/gu, ' ')
              .replace(/\s+/g, ' ')
              .trim() || 'Khach Hang Boxora'
            const todayIso = new Date().toISOString().slice(0, 10)
            const startDateIso =
              booking.startDate && booking.startDate >= todayIso ? booking.startDate.slice(0, 10) : todayIso

            const syncedBooking = await bookingService.createBooking({
              bookingCode: booking.bookingCode,
              facilityId: selectedUnit?.facilityId || targetFacilityId,
              unitTypeId: (selectedUnit?.unitTypeId || booking.unitTypeId) ?? undefined,
              customerName: cleanName,
              customerPhone: validPhone,
              customerEmail: validEmail,
              fullName: cleanName,
              phone: validPhone,
              email: validEmail,
              startDate: startDateIso,
              rentalMonths: Math.max(1, Number(booking.rentalMonths) || 1),
              totalRentalFee: Number(booking.totalRentalFee) || undefined,
              depositAmount: Number(booking.depositAmount) || undefined,
              depositPaid: Number(booking.depositPaid) || 0,
              signingMethod: 'IN_PERSON',
              initialStatus: 'PENDING_CONTACT',
              identityCardNumber:
                booking.identityCardNumber && /^\d{12}$/.test(booking.identityCardNumber.trim())
                  ? booking.identityCardNumber.trim()
                  : undefined,
            })

            const syncedTarget = syncedBooking?.id || syncedBooking?.bookingCode || booking.bookingCode
            updated = await bookingService.assignUnitAndProvision(syncedTarget, selectedUnitId, notes)
          } else {
            throw firstErr
          }
        }
      }

      if (!updated) {
        throw new Error('Không thể hoàn tất gán ô kho.')
      }

      // Đồng bộ vào localStorage để giao diện Staff không bị stale data
      try {
        const rawLocal = localStorage.getItem('boxora_guest_reservations')
        if (rawLocal) {
          const list = JSON.parse(rawLocal)
          if (Array.isArray(list)) {
            const synced = list.map((item: any) => {
              if (
                item.bookingCode === booking.bookingCode ||
                item.id === booking.id ||
                item.backendBookingId === booking.id
              ) {
                return {
                  ...item,
                  id: updated!.id || item.id,
                  backendBookingId: updated!.id || item.backendBookingId,
                  status: 'CONFIRMED',
                  unitCode: updated!.unitCode || selectedUnit?.unitCode,
                  storageUnitId: selectedUnitId,
                  handoverTime: new Date().toISOString(),
                }
              }
              return item
            })
            localStorage.setItem('boxora_guest_reservations', JSON.stringify(synced))
            window.dispatchEvent(new CustomEvent('boxora_reservation_status_changed'))
          }
        }
      } catch (syncErr) {
        console.warn('Lỗi đồng bộ local reservation:', syncErr)
      }

      setSuccessData({
        unitCode: updated.unitCode || selectedUnit?.unitCode || 'Đã gán',
        pin: updated.accessPin || 'Đã kích hoạt ngầm',
        bookingCode: updated.bookingCode || booking.bookingCode,
      })

      setTimeout(() => {
        onSuccess(updated!)
      }, 1500)
    } catch (err: any) {
      console.error('Unit assignment error:', err)
      setError(err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi gán ô kho. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || !booking) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col my-auto rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
        
        {/* Header (Cố định ở trên cùng) */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 via-white to-cyan-50 border-b border-blue-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Key size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Gán Ô Kho Vật Lý &amp; Bàn Giao Cửa IoT
              </h3>
              <p className="text-xs text-slate-500">
                Đơn đặt chỗ: <span className="font-mono font-bold text-blue-700">{booking.bookingCode}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {successData ? (
          <div className="p-8 text-center space-y-4 overflow-y-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm ring-8 ring-emerald-50">
              <Check size={32} />
            </div>
            <div className="space-y-1">
              <h4 className="text-xl font-bold text-slate-900">Xác Nhận &amp; Bàn Giao Thành Công!</h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Đã gán ô kho <strong className="text-emerald-700 font-mono text-sm">{successData.unitCode}</strong> vào đơn <strong>{successData.bookingCode}</strong>. Trạng thái đã chuyển sang <strong>CONFIRMED</strong>.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 max-w-sm mx-auto space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold justify-center">
                <Mail size={16} />
                <span>Tiến trình tự động đã kích hoạt gửi Email IoT!</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Mã PIN cửa IoT (<strong>{successData.pin}</strong>), QR Token và hướng dẫn nhận kho đã được gửi tới email khách hàng: <strong>{booking.customerEmail}</strong>.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Scrollable Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Booking Summary Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block font-mono">KHÁCH HÀNG:</span>
                  <span className="font-bold text-slate-900">{booking.customerName}</span>
                  <span className="block text-slate-500 font-mono text-[11px]">{booking.customerPhone}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-mono">EMAIL NHẬN MÃ KHÓA:</span>
                  <span className="font-mono text-slate-800 truncate block">{booking.customerEmail}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-mono">CƠ SỞ THUÊ:</span>
                  <span className="font-semibold text-slate-800">{booking.facilityName || 'Cơ sở Boxora'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-mono">LOẠI KHO TRONG HỢP ĐỒNG:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    <Box size={13} className="text-blue-600" />
                    <span>{bookedUnitTypeName || 'Chưa xác định'}</span>
                  </span>
                </div>
              </div>

              {/* Unit Selection Header with Filter Count */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Filter size={14} className="text-blue-600 shrink-0" />
                    <span>
                      Các kho còn trống thuộc loại kho khách đã chọn ({bookedUnitTypeName || 'Đã đặt'}):
                    </span>
                  </label>
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100 shrink-0">
                    {displayUnits.length} ô kho khả dụng
                  </span>
                </div>

                {loadingUnits ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="inline-block animate-spin mr-2">⟳</span>
                    Đang tải danh sách ô kho trống theo loại kho khách đã chọn...
                  </div>
                ) : displayUnits.length === 0 ? (
                  <div className="p-5 text-center text-xs bg-amber-50/80 rounded-xl border border-amber-200 space-y-2.5">
                    <div className="flex items-center justify-center gap-1.5 text-amber-800 font-bold">
                      <AlertCircle size={16} />
                      <span>Hiện tại không còn ô kho trống nào thuộc loại "{bookedUnitTypeName || 'đã chọn'}" tại cơ sở này.</span>
                    </div>
                    <p className="text-[11px] text-amber-700">
                      Tất cả các ô kho cùng loại kích thước hiện đã được thuê hoặc đang bảo trì.
                    </p>
                    {allUnits.length > 0 && !showAllSizes && (
                      <button
                        type="button"
                        onClick={() => setShowAllSizes(true)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold text-xs transition cursor-pointer"
                      >
                        <Layers size={13} />
                        <span>Xem tất cả ô kho trống khác ({allUnits.length} ô)</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1 pr-1.5">
                      {displayUnits.map((unit) => {
                        const isSelected = selectedUnitId === unit.id
                        const isMatchingType = isUnitMatchingBookedSize(unit, bookedUnitTypeId, bookedUnitTypeName, bookedUnitArea)
                        const isReserved =
                          String(unit.status || '').toUpperCase() === 'RESERVED' ||
                          String(unit.status || '').toUpperCase() === 'PENDING_HANDOVER' ||
                          (unit.status as string) === 'Chờ bàn giao'
                        const isAssignedToCurrent = Boolean(
                          (booking.unitCode && booking.unitCode === unit.unitCode) ||
                          (unit.bookingId && unit.bookingId === booking.id)
                        )
                        const isHeldByOther = Boolean(
                          isReserved && !isAssignedToCurrent && unit.bookingId && unit.bookingId !== booking.id
                        )

                        return (
                          <button
                            key={unit.id}
                            type="button"
                            disabled={isHeldByOther}
                            onClick={() => {
                              if (!isHeldByOther) setSelectedUnitId(unit.id)
                            }}
                            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                              isHeldByOther
                                ? 'bg-slate-50 border-slate-200 text-slate-400 opacity-70 cursor-not-allowed'
                                : isSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-400/40 cursor-pointer'
                                : isAssignedToCurrent
                                ? 'bg-emerald-50 border-emerald-400 text-slate-800 cursor-pointer'
                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono font-bold text-sm tracking-wide">
                                {unit.unitCode}
                              </span>
                              {isAssignedToCurrent ? (
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                                    isSelected ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  Đơn này
                                </span>
                              ) : isHeldByOther ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0 bg-slate-200 text-slate-600">
                                  Đơn khác
                                </span>
                              ) : isMatchingType ? (
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                                    isSelected ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  Đúng loại
                                </span>
                              ) : (
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  Khác loại
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] mt-1.5 opacity-90 truncate font-medium">
                              {unit.unitTypeName || unit.floorLevel || 'Buồng kho'}
                            </div>
                            <div className="text-[10px] mt-0.5 opacity-75">
                              {unit.floorLevel
                                ? (unit.floorLevel.toLowerCase().startsWith('tầng') ? unit.floorLevel : `Tầng ${unit.floorLevel}`)
                                : 'Tầng 1'} • {isAssignedToCurrent ? 'Đã gán' : isHeldByOther ? 'Giữ cho đơn khác' : 'Trống'}
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {allUnits.length > matchingUnits.length && (
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAllSizes(!showAllSizes)}
                          className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                        >
                          {showAllSizes
                            ? `← Chỉ hiển thị ô kho thuộc đúng loại "${bookedUnitTypeName || 'hợp đồng'}" (${matchingUnits.length})`
                            : `Xem toàn bộ ${allUnits.length} ô kho trống tại cơ sở này`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  Ghi chú bàn giao (tùy chọn):
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ví dụ: Ô kho sạch sẽ, cửa hướng Đông, khách đã mang đồ đến..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notice */}
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-[11px] text-blue-900 flex items-start gap-2">
                <ShieldCheck size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Khi nhấn <strong>"Xác nhận &amp; Bàn giao"</strong>: Hệ thống sẽ đổi trạng thái ô kho sang <strong>RESERVED</strong>, trạng thái đơn sang <strong>CONFIRMED</strong>, và tự động gửi email kèm mã khóa IoT tới khách hàng.
                </span>
              </div>
            </div>

            {/* Footer Buttons (Cố định ở dưới cùng) */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedUnitId || displayUnits.length === 0}
                className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold shadow-md shadow-emerald-600/25 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <span className="inline-block animate-spin">⟳</span>
                    <span>Đang gán &amp; phát mã IoT...</span>
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    <span>Xác nhận &amp; Bàn giao</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
