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
  Compass,
  ArrowRight,
  Shield,
  Layers,
} from 'lucide-react'
import { FacilityFloor, FacilityFunctionalArea, FunctionalAreaType, FunctionalAreaAttributes } from '../../types'
import { FUNCTIONAL_AREA_TYPE_OPTIONS, generateId } from '../../utils/facilityLayout'

interface FloorFunctionalAreaManagerProps {
  floor: FacilityFloor
  allFloors: FacilityFloor[]
  onUpdateFloor: (updatedFloor: FacilityFloor) => void
}

export const FloorFunctionalAreaManager: React.FC<FloorFunctionalAreaManagerProps> = ({
  floor,
  allFloors,
  onUpdateFloor,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Form State
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [areaType, setAreaType] = useState<FunctionalAreaType>('MAIN_CORRIDOR')
  const [customTypeLabel, setCustomTypeLabel] = useState('')
  const [area, setArea] = useState<number | ''>('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'ACTIVE' | 'MAINTENANCE' | 'INACTIVE'>('ACTIVE')
  const [formError, setFormError] = useState<string | null>(null)

  // Extended attributes
  const [maxPayloadKg, setMaxPayloadKg] = useState<number | ''>('')
  const [capacityPersons, setCapacityPersons] = useState<number | ''>('')
  const [servedFloors, setServedFloors] = useState<string[]>([])
  const [exitDirection, setExitDirection] = useState('')
  const [coverageArea, setCoverageArea] = useState('')
  const [mapLocationNote, setMapLocationNote] = useState('')

  const openCreateModal = () => {
    setEditingAreaId(null)
    const nextIdx = floor.functionalAreas.length + 1
    const defaultCode = `FA-${floor.code.replace(/[^a-zA-Z0-9]/g, '')}-${String(nextIdx).padStart(2, '0')}`
    setName('Hành lang chính')
    setCode(defaultCode)
    setAreaType('MAIN_CORRIDOR')
    setCustomTypeLabel('')
    setArea(30)
    setDescription('')
    setStatus('ACTIVE')
    setMaxPayloadKg('')
    setCapacityPersons('')
    setServedFloors([floor.code])
    setExitDirection('')
    setCoverageArea('')
    setMapLocationNote('')
    setFormError(null)
    setIsModalOpen(true)
  }

  const openEditModal = (fa: FacilityFunctionalArea) => {
    setEditingAreaId(fa.id)
    setName(fa.name)
    setCode(fa.code)
    setAreaType(fa.areaType)
    setCustomTypeLabel(fa.customTypeLabel || '')
    setArea(fa.area != null ? fa.area : '')
    setDescription(fa.description || '')
    setStatus(fa.status)

    const attrs = fa.attributes || {}
    setMaxPayloadKg(attrs.maxPayloadKg != null ? attrs.maxPayloadKg : '')
    setCapacityPersons(attrs.capacityPersons != null ? attrs.capacityPersons : '')
    setServedFloors(attrs.servedFloors || [floor.code])
    setExitDirection(attrs.exitDirection || '')
    setCoverageArea(attrs.coverageArea || '')
    setMapLocationNote(attrs.mapLocationNote || '')

    setFormError(null)
    setIsModalOpen(true)
  }

  const handleDuplicate = (fa: FacilityFunctionalArea) => {
    let newCode = `${fa.code}_COPY`
    let counter = 1
    const allExistingCodes = allFloors.flatMap((f) => f.functionalAreas.map((x) => x.code.toLowerCase()))
    while (allExistingCodes.includes(newCode.toLowerCase())) {
      newCode = `${fa.code}_COPY${counter++}`
    }

    const duplicated: FacilityFunctionalArea = {
      ...fa,
      id: generateId(),
      name: `${fa.name} (Bản sao)`,
      code: newCode,
      displayOrder: floor.functionalAreas.length + 1,
    }

    onUpdateFloor({
      ...floor,
      functionalAreas: [...floor.functionalAreas, duplicated],
    })
  }

  const handleDelete = (areaId: string) => {
    onUpdateFloor({
      ...floor,
      functionalAreas: floor.functionalAreas.filter((a) => a.id !== areaId),
    })
    setDeleteConfirmId(null)
  }

  const handleMove = (index: number, direction: 'UP' | 'DOWN') => {
    const targetIdx = direction === 'UP' ? index - 1 : index + 1
    if (targetIdx < 0 || targetIdx >= floor.functionalAreas.length) return

    const newAreas = [...floor.functionalAreas]
    const temp = newAreas[index]
    newAreas[index] = newAreas[targetIdx]
    newAreas[targetIdx] = temp

    newAreas.forEach((a, i) => {
      a.displayOrder = i + 1
    })

    onUpdateFloor({
      ...floor,
      functionalAreas: newAreas,
    })
  }

  const toggleServedFloor = (fCode: string) => {
    setServedFloors((prev) =>
      prev.includes(fCode) ? prev.filter((c) => c !== fCode) : [...prev, fCode]
    )
  }

  const handleSave = (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    setFormError(null)

    const cleanName = name.trim()
    const cleanCode = code.trim().toUpperCase()

    if (!cleanName) {
      setFormError('Vui lòng nhập tên khu vực chức năng.')
      return
    }
    if (!cleanCode) {
      setFormError('Vui lòng nhập mã khu vực chức năng.')
      return
    }

    let areaNum: number | undefined = undefined
    if (area !== '') {
      areaNum = Number(area)
      if (isNaN(areaNum) || areaNum <= 0) {
        setFormError('Nếu khai báo diện tích, vui lòng nhập số dương lớn hơn 0 m².')
        return
      }
    }

    // Check code uniqueness across all floors in facility
    const isCodeDuplicate = allFloors.some((f) =>
      f.functionalAreas.some(
        (a) => a.code.toLowerCase() === cleanCode.toLowerCase() && a.id !== editingAreaId
      )
    )
    if (isCodeDuplicate) {
      setFormError(`Mã khu vực chức năng "${cleanCode}" đã tồn tại trong cơ sở. Vui lòng chọn mã khác.`)
      return
    }

    const attributes: FunctionalAreaAttributes = {}
    if (maxPayloadKg !== '') attributes.maxPayloadKg = Number(maxPayloadKg)
    if (capacityPersons !== '') attributes.capacityPersons = Number(capacityPersons)
    if (servedFloors.length > 0) attributes.servedFloors = servedFloors
    if (exitDirection.trim()) attributes.exitDirection = exitDirection.trim()
    if (coverageArea.trim()) attributes.coverageArea = coverageArea.trim()
    if (mapLocationNote.trim()) attributes.mapLocationNote = mapLocationNote.trim()

    if (editingAreaId) {
      const updated = floor.functionalAreas.map((a) => {
        if (a.id === editingAreaId) {
          return {
            ...a,
            name: cleanName,
            code: cleanCode,
            areaType,
            customTypeLabel: areaType === 'OTHER' ? customTypeLabel.trim() : '',
            area: areaNum,
            description: description.trim(),
            status,
            attributes,
          }
        }
        return a
      })
      onUpdateFloor({
        ...floor,
        functionalAreas: updated,
      })
    } else {
      const newArea: FacilityFunctionalArea = {
        id: generateId(),
        floorId: floor.id,
        name: cleanName,
        code: cleanCode,
        areaType,
        customTypeLabel: areaType === 'OTHER' ? customTypeLabel.trim() : '',
        area: areaNum,
        description: description.trim(),
        status,
        displayOrder: floor.functionalAreas.length + 1,
        attributes,
      }
      onUpdateFloor({
        ...floor,
        functionalAreas: [...floor.functionalAreas, newArea],
      })
    }

    setIsModalOpen(false)
  }

  const isElevatorType =
    areaType === 'CARGO_ELEVATOR' || areaType === 'PASSENGER_ELEVATOR' || areaType === 'CARGO_LIFT'
  const isEmergencyType = areaType === 'EMERGENCY_EXIT' || areaType === 'FIRE_DOOR'
  const isLoadingBayType = areaType === 'LOADING_BAY' || areaType === 'DISPATCH_BAY'

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-teal-600 dark:text-teal-400">
              storefront
            </span>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Khu vực chức năng &amp; Vận hành ({floor.functionalAreas.length})
            </h5>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Hạ tầng chung: Khu nhận/xuất hàng, hành lang, thang hàng, thang bộ, lối thoát hiểm, phòng kỹ thuật...
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs cursor-pointer transition-all shrink-0 self-start sm:self-auto"
        >
          <Plus size={14} />
          <span>Thêm khu vực chức năng</span>
        </button>
      </div>

      {/* List of Functional Areas */}
      {floor.functionalAreas.length === 0 ? (
        <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-slate-500 space-y-1.5">
          <Compass className="w-8 h-8 mx-auto text-slate-400/80" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Tầng này chưa khai báo khu vực chức năng
          </p>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            Hệ thống không tự ý áp đặt các khu vực mặc định. Bấm "Thêm khu vực chức năng" để khai báo các tiện ích phù hợp với thực tế thiết kế mặt bằng của tầng.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {floor.functionalAreas.map((fa, idx) => {
            const typeOpt =
              FUNCTIONAL_AREA_TYPE_OPTIONS.find((t) => t.type === fa.areaType) ||
              FUNCTIONAL_AREA_TYPE_OPTIONS[0]
            const attrs = fa.attributes || {}

            return (
              <div
                key={fa.id}
                className="group relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 hover:border-teal-300 dark:hover:border-teal-800 transition-all shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-teal-200/80 bg-teal-50/80 dark:border-teal-800 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 shrink-0">
                        <span className="material-symbols-outlined text-[16px]">{typeOpt.icon}</span>
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h6 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={fa.name}>
                            {fa.name}
                          </h6>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold shrink-0">
                            {fa.code}
                          </span>
                        </div>
                        <span className="inline-block mt-0.5 text-[10px] font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded-full border border-teal-100 dark:border-teal-900/40">
                          {fa.areaType === 'OTHER' && fa.customTypeLabel ? fa.customTypeLabel : typeOpt.label}
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
                        disabled={idx === floor.functionalAreas.length - 1}
                        onClick={() => handleMove(idx, 'DOWN')}
                        title="Di chuyển xuống"
                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Badges for technical attributes */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {attrs.maxPayloadKg && (
                      <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 px-1.5 py-0.5 rounded font-mono font-bold">
                        Tải trọng: {attrs.maxPayloadKg} kg
                      </span>
                    )}
                    {attrs.capacityPersons && (
                      <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 px-1.5 py-0.5 rounded">
                        Sức chứa: {attrs.capacityPersons} người
                      </span>
                    )}
                    {attrs.servedFloors && attrs.servedFloors.length > 0 && (
                      <span className="text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono">
                        Phục vụ: {attrs.servedFloors.join(', ')}
                      </span>
                    )}
                    {attrs.exitDirection && (
                      <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 px-1.5 py-0.5 rounded truncate max-w-full" title={attrs.exitDirection}>
                        Hướng thoát: {attrs.exitDirection}
                      </span>
                    )}
                    {attrs.coverageArea && (
                      <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 px-1.5 py-0.5 rounded">
                        Phạm vi: {attrs.coverageArea}
                      </span>
                    )}
                  </div>

                  {fa.description && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 italic">
                      "{fa.description}"
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {fa.area ? (
                      <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300">
                        {fa.area} m²
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Không tính diện tích</span>
                    )}
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        fa.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : fa.status === 'MAINTENANCE'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {fa.status === 'ACTIVE' ? 'Hoạt động' : fa.status === 'MAINTENANCE' ? 'Bảo trì' : 'Tạm ngưng'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDuplicate(fa)}
                      title="Nhân bản khu vực này"
                      className="p-1 rounded-md text-slate-500 hover:text-teal-700 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(fa)}
                      title="Chỉnh sửa khu vực"
                      className="p-1 rounded-md text-slate-500 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(fa.id)}
                      title="Xóa khu vực"
                      className="p-1 rounded-md text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Delete Confirmation Overlay */}
                {deleteConfirmId === fa.id && (
                  <div className="absolute inset-0 z-20 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs p-3 flex flex-col justify-between border border-rose-200 dark:border-rose-900 animate-in fade-in">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                        <AlertCircle size={14} />
                        <span>Xác nhận xóa khu vực chức năng?</span>
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        Xóa "{fa.name}" ({fa.code}). Vui lòng đảm bảo không có quy trình vận hành nào đang tham chiếu trực tiếp đến khu vực này.
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
                        onClick={() => handleDelete(fa.id)}
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

      {/* Modal Thêm / Chỉnh sửa Khu vực chức năng */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600">storefront</span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {editingAreaId ? 'Chỉnh sửa khu vực chức năng' : 'Thêm khu vực chức năng mới'} — {floor.name}
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
                    Tên khu vực *
                  </label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Hành lang chính khu Tây"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mã khu vực (Duy nhất) *
                  </label>
                  <input
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="VD: FA-CORR-01"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold uppercase text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Loại khu vực chức năng *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1 border border-slate-200 dark:border-slate-800 rounded-xl">
                  {FUNCTIONAL_AREA_TYPE_OPTIONS.map((opt) => (
                    <label
                      key={opt.type}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-left cursor-pointer transition-all ${
                        areaType === opt.type
                          ? 'border-teal-600 bg-teal-50/80 text-teal-900 dark:bg-teal-950/60 dark:text-teal-200'
                          : 'border-slate-200/80 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="areaType"
                        value={opt.type}
                        checked={areaType === opt.type}
                        onChange={() => setAreaType(opt.type)}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span className="material-symbols-outlined text-[16px] text-teal-600 dark:text-teal-400">
                        {opt.icon}
                      </span>
                      <span className="text-[11px] font-semibold truncate">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {areaType === 'OTHER' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tên loại chức năng tùy biến
                  </label>
                  <input
                    value={customTypeLabel}
                    onChange={(e) => setCustomTypeLabel(e.target.value)}
                    placeholder="VD: Khu trạm sạc xe nâng điện"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Diện tích chiếm sàn (m² - Tùy chọn)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={area}
                    onChange={(e) => setArea(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="VD: 35 (Để trống nếu không chiếm diện tích sàn)"
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
                    <option value="INACTIVE">Tạm ngưng hoạt động (INACTIVE)</option>
                  </select>
                </div>
              </div>

              {/* Thông số mở rộng theo loại khu vực */}
              {isElevatorType && (
                <div className="p-3 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900 dark:text-purple-200">
                    <span className="material-symbols-outlined text-[16px]">tune</span>
                    <span>Thông số kỹ thuật thang máy &amp; tải trọng</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Tải trọng tối đa (kg)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={maxPayloadKg}
                        onChange={(e) => setMaxPayloadKg(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="VD: 2000"
                        className="w-full rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 dark:bg-slate-800 dark:border-purple-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Sức chứa tối đa (người)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={capacityPersons}
                        onChange={(e) => setCapacityPersons(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="VD: 15"
                        className="w-full rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 dark:bg-slate-800 dark:border-purple-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Các tầng phục vụ kết nối
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {allFloors.map((f) => {
                        const isSelected = servedFloors.includes(f.code)
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => toggleServedFloor(f.code)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                              isSelected
                                ? 'bg-purple-700 text-white shadow-2xs'
                                : 'bg-white text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {f.name} ({f.code})
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {isEmergencyType && (
                <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900 dark:text-rose-200">
                    <span className="material-symbols-outlined text-[16px]">emergency</span>
                    <span>Phương án thoát hiểm &amp; Hướng di chuyển</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Vị trí &amp; Hướng thoát hiểm thực tế
                    </label>
                    <input
                      value={exitDirection}
                      onChange={(e) => setExitDirection(e.target.value)}
                      placeholder="VD: Cửa thoát phía Tây dẫn ra cầu thang thoát hiểm ngoài trời"
                      className="w-full rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:bg-slate-800 dark:border-rose-800 dark:text-slate-100"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 italic">
                    * Lưu ý: Boxora ghi nhận hướng di chuyển thực tế do người lập cấu hình cung cấp, không tự động xác nhận đạt tiêu chuẩn kiểm định PCCC nhà nước.
                  </p>
                </div>
              )}

              {isLoadingBayType && (
                <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-200">
                    <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                    <span>Phạm vi &amp; Khả năng tiếp nhận phương tiện</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Phạm vi phục vụ / Loại phương tiện đáp ứng
                    </label>
                    <input
                      value={coverageArea}
                      onChange={(e) => setCoverageArea(e.target.value)}
                      placeholder="VD: Cửa bốc hàng xe tải 2.5 tấn, có bệ nâng hạ thủy lực"
                      className="w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:bg-slate-800 dark:border-blue-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mô tả &amp; Vị trí trên sơ đồ (tùy chọn)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ghi chú về thiết bị, giờ hoạt động hoặc vị trí bố trí trên bản vẽ..."
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
                  className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs cursor-pointer transition-all"
                >
                  {editingAreaId ? 'Lưu thay đổi' : 'Thêm khu vực'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
