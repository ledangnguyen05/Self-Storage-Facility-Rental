import React, { useState } from 'react'
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Edit2,
  AlertCircle,
  X,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react'
import { FacilityFloor, FacilityZone, ZoneType } from '../../types'
import { ZONE_TYPE_OPTIONS, generateId } from '../../utils/facilityLayout'

interface FloorZoneManagerProps {
  floor: FacilityFloor
  allFloors: FacilityFloor[]
  onUpdateFloor: (updatedFloor: FacilityFloor) => void
}

export const FloorZoneManager: React.FC<FloorZoneManagerProps> = ({
  floor,
  allFloors,
  onUpdateFloor,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Form State
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [zoneType, setZoneType] = useState<ZoneType>('STANDARD_STORAGE')
  const [customTypeLabel, setCustomTypeLabel] = useState('')
  const [area, setArea] = useState<number | ''>(50)
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'ACTIVE' | 'MAINTENANCE' | 'INACTIVE'>('ACTIVE')
  const [formError, setFormError] = useState<string | null>(null)

  const openCreateModal = () => {
    setEditingZoneId(null)
    const nextIdx = floor.zones.length + 1
    const defaultCode = `Z-${floor.code.replace(/[^a-zA-Z0-9]/g, '')}-${String.fromCharCode(64 + Math.min(26, nextIdx))}`
    setName(`Phân khu ${String.fromCharCode(64 + Math.min(26, nextIdx))}`)
    setCode(defaultCode)
    setZoneType('STANDARD_STORAGE')
    setCustomTypeLabel('')
    setArea(60)
    setDescription('')
    setStatus('ACTIVE')
    setFormError(null)
    setIsModalOpen(true)
  }

  const openEditModal = (z: FacilityZone) => {
    setEditingZoneId(z.id)
    setName(z.name)
    setCode(z.code)
    setZoneType(z.zoneType)
    setCustomTypeLabel(z.customTypeLabel || '')
    setArea(z.area)
    setDescription(z.description || '')
    setStatus(z.status)
    setFormError(null)
    setIsModalOpen(true)
  }

  const handleDuplicateZone = (z: FacilityZone) => {
    let newCode = `${z.code}_COPY`
    let counter = 1
    const allExistingCodes = allFloors.flatMap((f) => f.zones.map((x) => x.code.toLowerCase()))
    while (allExistingCodes.includes(newCode.toLowerCase())) {
      newCode = `${z.code}_COPY${counter++}`
    }

    const duplicated: FacilityZone = {
      ...z,
      id: generateId(),
      name: `${z.name} (Bản sao)`,
      code: newCode,
      displayOrder: floor.zones.length + 1,
    }

    onUpdateFloor({
      ...floor,
      zones: [...floor.zones, duplicated],
    })
  }

  const handleDeleteZone = (zoneId: string) => {
    onUpdateFloor({
      ...floor,
      zones: floor.zones.filter((z) => z.id !== zoneId),
    })
    setDeleteConfirmId(null)
  }

  const handleMove = (index: number, direction: 'UP' | 'DOWN') => {
    const targetIdx = direction === 'UP' ? index - 1 : index + 1
    if (targetIdx < 0 || targetIdx >= floor.zones.length) return

    const newZones = [...floor.zones]
    const temp = newZones[index]
    newZones[index] = newZones[targetIdx]
    newZones[targetIdx] = temp

    // re-assign display orders
    newZones.forEach((z, i) => {
      z.displayOrder = i + 1
    })

    onUpdateFloor({
      ...floor,
      zones: newZones,
    })
  }

  const handleSave = (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    setFormError(null)

    const cleanName = name.trim()
    const cleanCode = code.trim().toUpperCase()

    if (!cleanName) {
      setFormError('Vui lòng nhập tên phân khu.')
      return
    }
    if (!cleanCode) {
      setFormError('Vui lòng nhập mã phân khu.')
      return
    }

    const areaNum = Number(area)
    if (isNaN(areaNum) || areaNum <= 0) {
      setFormError('Diện tích phân khu phải là số dương lớn hơn 0 m².')
      return
    }

    // Check code uniqueness across all floors in facility
    const isCodeDuplicate = allFloors.some((f) =>
      f.zones.some((z) => z.code.toLowerCase() === cleanCode.toLowerCase() && z.id !== editingZoneId)
    )
    if (isCodeDuplicate) {
      setFormError(`Mã phân khu "${cleanCode}" đã tồn tại trong cơ sở. Vui lòng chọn mã khác.`)
      return
    }

    if (editingZoneId) {
      // Edit existing zone
      const updatedZones = floor.zones.map((z) => {
        if (z.id === editingZoneId) {
          return {
            ...z,
            name: cleanName,
            code: cleanCode,
            zoneType,
            customTypeLabel: zoneType === 'CUSTOM' ? customTypeLabel.trim() : '',
            area: areaNum,
            description: description.trim(),
            status,
          }
        }
        return z
      })
      onUpdateFloor({
        ...floor,
        zones: updatedZones,
      })
    } else {
      // Create new zone
      const newZone: FacilityZone = {
        id: generateId(),
        floorId: floor.id,
        name: cleanName,
        code: cleanCode,
        zoneType,
        customTypeLabel: zoneType === 'CUSTOM' ? customTypeLabel.trim() : '',
        area: areaNum,
        description: description.trim(),
        status,
        displayOrder: floor.zones.length + 1,
      }
      onUpdateFloor({
        ...floor,
        zones: [...floor.zones, newZone],
      })
    }

    setIsModalOpen(false)
  }

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-cyan-600 dark:text-cyan-400">
              grid_view
            </span>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Phân khu bố trí kho lưu trữ ({floor.zones.length})
            </h5>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Khu vực quy hoạch cho các nhóm buồng kho vật lý (Mini, Tiêu chuẩn, Doanh nghiệp, Máy lạnh...)
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-semibold shadow-xs cursor-pointer transition-all shrink-0 self-start sm:self-auto"
        >
          <Plus size={14} />
          <span>Thêm phân khu</span>
        </button>
      </div>

      {/* List of Zones */}
      {floor.zones.length === 0 ? (
        <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-slate-500 space-y-1.5">
          <Layers className="w-8 h-8 mx-auto text-slate-400/80" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Tầng này chưa có phân khu nào
          </p>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            Bấm "Thêm phân khu" để thiết lập phân khu theo nhu cầu (Kho mini, tiêu chuẩn, kho lạnh...). Không bắt buộc mọi tầng phải có cùng loại phân khu.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {floor.zones.map((zone, idx) => {
            const typeOpt = ZONE_TYPE_OPTIONS.find((t) => t.type === zone.zoneType) || ZONE_TYPE_OPTIONS[1]
            return (
              <div
                key={zone.id}
                className="group relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 hover:border-cyan-300 dark:hover:border-cyan-800 transition-all shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border shrink-0 ${typeOpt.color}`}>
                        <span className="material-symbols-outlined text-[16px]">{typeOpt.icon}</span>
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h6 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={zone.name}>
                            {zone.name}
                          </h6>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold shrink-0">
                            {zone.code}
                          </span>
                        </div>
                        <span className={`inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeOpt.badgeColor}`}>
                          {zone.zoneType === 'CUSTOM' && zone.customTypeLabel ? zone.customTypeLabel : typeOpt.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMove(idx, 'UP')}
                        title="Di chuyển lên"
                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === floor.zones.length - 1}
                        onClick={() => handleMove(idx, 'DOWN')}
                        title="Di chuyển xuống"
                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </div>

                  {zone.description && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 italic">
                      "{zone.description}"
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-cyan-800 dark:text-cyan-300">
                      {zone.area} m²
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        zone.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : zone.status === 'MAINTENANCE'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {zone.status === 'ACTIVE' ? 'Hoạt động' : zone.status === 'MAINTENANCE' ? 'Bảo trì' : 'Tạm ngưng'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDuplicateZone(zone)}
                      title="Nhân bản phân khu này"
                      className="p-1 rounded-md text-slate-500 hover:text-cyan-700 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(zone)}
                      title="Chỉnh sửa phân khu"
                      className="p-1 rounded-md text-slate-500 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(zone.id)}
                      title="Xóa phân khu"
                      className="p-1 rounded-md text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Delete Confirmation Overlay */}
                {deleteConfirmId === zone.id && (
                  <div className="absolute inset-0 z-20 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs p-3 flex flex-col justify-between border border-rose-200 dark:border-rose-900 animate-in fade-in">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                        <AlertCircle size={14} />
                        <span>Xác nhận xóa phân khu?</span>
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        Xóa "{zone.name}" ({zone.code}). Vui lòng đảm bảo không có kho vật lý đang được gán vào phân khu này.
                      </p>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteZone(zone.id)}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-xs cursor-pointer"
                      >
                        Xác nhận xóa
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Thêm / Chỉnh sửa Phân khu */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-600">grid_view</span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {editingZoneId ? 'Chỉnh sửa phân khu' : 'Thêm phân khu mới'} — {floor.name}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
                <AlertCircle size={15} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tên phân khu *
                  </label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Phân khu A - Mini Lockers"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mã phân khu (Duy nhất) *
                  </label>
                  <input
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="VD: Z-FL01-A"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold uppercase text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Loại phân khu *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-200 dark:border-slate-800 rounded-xl">
                  {ZONE_TYPE_OPTIONS.map((opt) => (
                    <label
                      key={opt.type}
                      className={`flex items-start gap-2 p-2 rounded-lg border text-left cursor-pointer transition-all ${
                        zoneType === opt.type
                          ? 'border-cyan-600 bg-cyan-50/80 text-cyan-900 dark:bg-cyan-950/60 dark:text-cyan-200'
                          : 'border-slate-200/80 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="zoneType"
                        value={opt.type}
                        checked={zoneType === opt.type}
                        onChange={() => setZoneType(opt.type)}
                        className="mt-0.5 text-cyan-600 focus:ring-cyan-500"
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">{opt.icon}</span>
                          <span>{opt.label}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{opt.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {zoneType === 'CUSTOM' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tên loại phân khu tùy chỉnh
                  </label>
                  <input
                    value={customTypeLabel}
                    onChange={(e) => setCustomTypeLabel(e.target.value)}
                    placeholder="VD: Kho bảo quản nhạc cụ / Rượu vang"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Diện tích phân khu (m²) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    required
                    value={area}
                    onChange={(e) => setArea(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="60"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Trạng thái vận hành *
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                    <option value="MAINTENANCE">Bảo trì kỹ thuật (MAINTENANCE)</option>
                    <option value="INACTIVE">Tạm ngưng khai thác (INACTIVE)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mô tả &amp; Ghi chú vận hành (tùy chọn)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ghi chú về phân khu, thiết bị giám sát hoặc loại hàng hóa lưu trữ phù hợp..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold shadow-xs cursor-pointer transition-all"
                >
                  {editingZoneId ? 'Lưu thay đổi' : 'Thêm phân khu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
