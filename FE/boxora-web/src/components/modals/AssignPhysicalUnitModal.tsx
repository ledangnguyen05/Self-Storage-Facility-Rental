import React, { useState, useEffect, useMemo } from 'react'
import { X, Check, Key, ShieldCheck, Mail, AlertCircle, Building2, Box, Layers, Filter } from 'lucide-react'
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

const EQUIVALENT_TYPE_GROUPS: string[][] = [
  ['10000000-0000-0000-0000-000000000001', '5a11bcbb-f3a1-44f6-89a6-fb461be8158c'], // Mini/Locker (1m²)
  ['10000000-0000-0000-0000-000000000002', 'e56d6554-5a81-4af1-a392-29db319252c1'], // Medium/Compact Studio (3m²)
  ['10000000-0000-0000-0000-000000000003', 'fedddc98-983a-4925-81cf-dbf8da4d5a4e'], // Standard (6m²)
  ['10000000-0000-0000-0000-000000000004', 'ce41ba29-16d6-4af0-99b1-a2407cbe1345'], // Extra Large (12m²)
  ['10000000-0000-0000-0000-000000000005'], // Cold Storage (5m²)
]

function isUnitMatchingBookedSize(u: StorageUnit, targetTypeId?: string | null, targetName?: string | null): boolean {
  if (targetTypeId && u.unitTypeId) {
    if (u.unitTypeId === targetTypeId) return true
    for (const group of EQUIVALENT_TYPE_GROUPS) {
      if (group.includes(targetTypeId) && group.includes(u.unitTypeId)) return true
    }
  }

  if (targetName && u.unitTypeName) {
    const t = targetName.toLowerCase()
    const n = u.unitTypeName.toLowerCase()
    if (t === n || n.includes(t) || t.includes(n)) return true
    if ((t.includes('mini') || t.includes('locker')) && (n.includes('mini') || n.includes('locker'))) return true
    if ((t.includes('medium') || t.includes('studio') || t.includes('nhỏ')) && (n.includes('medium') || n.includes('studio') || n.includes('nhỏ'))) return true
    if ((t.includes('standard') || t.includes('tiêu chuẩn')) && (n.includes('standard') || n.includes('tiêu chuẩn'))) return true
    if ((t.includes('commercial') || t.includes('extra') || t.includes('lớn') || t.includes('doanh nghiệp')) && (n.includes('commercial') || n.includes('extra') || n.includes('lớn') || n.includes('doanh nghiệp'))) return true
    if ((t.includes('cold') || t.includes('climate') || t.includes('lạnh') || t.includes('điều hòa')) && (n.includes('cold') || n.includes('climate') || n.includes('lạnh') || n.includes('điều hòa'))) return true
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

  const targetFacilityId = facilityId || booking?.facilityId

  // Định danh loại kho khách hàng đã chọn trong hợp đồng
  const bookedUnitTypeId = booking?.unitTypeId
  const bookedUnitTypeName = useMemo(() => {
    if (!booking) return ''
    if (booking.unitTypeName) return booking.unitTypeName
    const rawAny = booking as any
    if (rawAny.tier?.name) return rawAny.tier.name
    if (rawAny.size?.name) return rawAny.size.name
    if (rawAny.size?.volumeText) return rawAny.size.volumeText
    if (booking.unitCode && (booking.unitCode.includes('m') || booking.unitCode.includes('Locker') || booking.unitCode.includes('Box'))) {
      return booking.unitCode
    }
    return ''
  }, [booking])

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
        status: 'AVAILABLE',
      })
      .then((data) => {
        const availableList = (data || []).filter(
          (u) => u.status === 'AVAILABLE' || (u.status as string) === 'Trống'
        )
        setAllUnits(availableList)

        // Tự động tìm ô kho khớp kích thước hợp đồng đã chọn
        const targetTypeId = booking.unitTypeId
        const targetName = bookedUnitTypeName.trim().toLowerCase()

        const matchingUnits = availableList.filter((u) => isUnitMatchingBookedSize(u, targetTypeId, targetName))

        if (matchingUnits.length > 0) {
          setSelectedUnitId(matchingUnits[0].id)
        } else if (availableList.length > 0 && !targetTypeId && !targetName) {
          setSelectedUnitId(availableList[0].id)
        } else {
          setSelectedUnitId('')
        }
      })
      .catch((err) => {
        console.error('Failed to load available units:', err)
        setError('Không thể tải danh sách ô kho trống của cơ sở. Vui lòng thử lại.')
      })
      .finally(() => setLoadingUnits(false))
  }, [isOpen, booking, targetFacilityId, bookedUnitTypeName])

  // Lọc chỉ hiển thị các ô kho còn trống thuộc loại kho khách đã chọn trong hợp đồng
  const matchingUnits = useMemo(() => {
    if (!booking) return []
    const targetTypeId = booking.unitTypeId
    const targetName = bookedUnitTypeName.trim().toLowerCase()

    return allUnits.filter((u) => isUnitMatchingBookedSize(u, targetTypeId, targetName))
  }, [allUnits, booking, bookedUnitTypeName])

  // Danh sách hiển thị: mặc định CHỈ hiển thị ô kho khớp loại khách đã chọn
  const displayUnits = useMemo(() => {
    if (showAllSizes) {
      return allUnits
    }
    // Nếu có ô kho khớp hoặc có thông tin loại kho, chỉ hiển thị đúng loại đó
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
      const effectiveIdOrCode = booking.id || booking.bookingCode
      const updated = await bookingService.assignUnitAndProvision(effectiveIdOrCode, selectedUnitId, notes)

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
                  status: 'CONFIRMED',
                  unitCode: updated.unitCode || selectedUnit?.unitCode,
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
        onSuccess(updated)
      }, 1500)
    } catch (err: any) {
      console.error('Unit assignment error:', err)
      setError(err?.response?.data?.message || 'Có lỗi xảy ra khi gán ô kho. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || !booking) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 via-white to-cyan-50 border-b border-blue-100 flex items-center justify-between">
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
          <div className="p-8 text-center space-y-4">
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
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Filter size={14} className="text-blue-600" />
                  <span>
                    Các kho còn trống thuộc loại kho khách đã chọn ({bookedUnitTypeName || 'Đã đặt'}):
                  </span>
                </label>
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto p-1">
                    {displayUnits.map((unit) => {
                      const isSelected = selectedUnitId === unit.id
                      const isExactType = (bookedUnitTypeId && unit.unitTypeId === bookedUnitTypeId) ||
                        (bookedUnitTypeName && unit.unitTypeName?.toLowerCase() === bookedUnitTypeName.toLowerCase())

                      return (
                        <button
                          key={unit.id}
                          type="button"
                          onClick={() => setSelectedUnitId(unit.id)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-400/40'
                              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-sm tracking-wide">
                              {unit.unitCode}
                            </span>
                            {isExactType ? (
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                  isSelected ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                Đúng loại
                              </span>
                            ) : (
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
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
                            {unit.floorLevel ? `Tầng ${unit.floorLevel}` : 'Tầng 1'} • Trống
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

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
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
                    <span>Đang xác nhận &amp; Bàn giao...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
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
