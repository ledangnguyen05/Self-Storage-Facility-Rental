import React, { useState } from 'react'
import {
  Layers,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Edit2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  Building2,
  Box,
  Compass,
  ArrowUpDown,
  Info,
  Gauge,
  ShieldAlert,
} from 'lucide-react'
import { FacilityFloor, FacilityZone, FacilityFunctionalArea } from '../../types'
import {
  generateId,
  createEmptyFloor,
  calculateFloorAllocation,
} from '../../utils/facilityLayout'
import { FloorZoneManager } from './FloorZoneManager'
import { FloorFunctionalAreaManager } from './FloorFunctionalAreaManager'

interface FloorListManagerProps {
  floors: FacilityFloor[]
  onChangeFloors: (floors: FacilityFloor[]) => void
  physicalUnits?: any[]
  readOnly?: boolean
}

export const FloorListManager: React.FC<FloorListManagerProps> = ({
  floors,
  onChangeFloors,
  physicalUnits = [],
  readOnly = false,
}) => {
  // State for expanded floors (default: expand first floor)
  const [expandedFloorIds, setExpandedFloorIds] = useState<Record<string, boolean>>(() => {
    if (floors.length > 0) {
      return { [floors[0].id]: true }
    }
    return {}
  })

  // State for active sub-tab inside expanded floor: 'ZONES' | 'FUNCTIONAL_AREAS' | 'SPECS'
  const [activeFloorTabs, setActiveFloorTabs] = useState<Record<string, 'ZONES' | 'FUNCTIONAL_AREAS' | 'SPECS'>>({})

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingFloorId, setEditingFloorId] = useState<string | null>(null)
  const [deleteConfirmFloorId, setDeleteConfirmFloorId] = useState<string | null>(null)
  const [deleteBlockedWarning, setDeleteBlockedWarning] = useState<{
    floorName: string
    unitsCount: number
  } | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [floorNumber, setFloorNumber] = useState<number>(1)
  const [totalArea, setTotalArea] = useState<number | ''>(400)
  const [height, setHeight] = useState<number | ''>(3.5)
  const [loadCapacity, setLoadCapacity] = useState<number | ''>('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'ACTIVE' | 'MAINTENANCE' | 'INACTIVE'>('ACTIVE')
  const [formError, setFormError] = useState<string | null>(null)

  const toggleExpand = (floorId: string) => {
    setExpandedFloorIds((prev) => ({
      ...prev,
      [floorId]: !prev[floorId],
    }))
  }

  const setFloorTab = (floorId: string, tab: 'ZONES' | 'FUNCTIONAL_AREAS' | 'SPECS') => {
    setActiveFloorTabs((prev) => ({
      ...prev,
      [floorId]: tab,
    }))
  }

  // Count physical storage units assigned to a specific floor
  const getPhysicalUnitsCount = (floor: FacilityFloor): number => {
    if (!physicalUnits || physicalUnits.length === 0) return 0
    const fCode = floor.code.trim().toLowerCase()
    const fName = floor.name.trim().toLowerCase()
    const fNum = String(floor.floorNumber)
    return physicalUnits.filter((u) => {
      const uFloor = String(u.floorLevel || '').trim().toLowerCase()
      return uFloor === fCode || uFloor === fName || uFloor === fNum
    }).length
  }

  // Open modal to create a new floor
  const openCreateModal = () => {
    setEditingFloorId(null)
    const nextNum = floors.length + 1
    setName(`Tầng ${nextNum}`)
    setCode(`FL-${String(nextNum).padStart(2, '0')}`)
    setFloorNumber(nextNum)
    setTotalArea(400)
    setHeight(3.5)
    setLoadCapacity('')
    setDescription('')
    setStatus('ACTIVE')
    setFormError(null)
    setIsModalOpen(true)
  }

  // Open modal to edit an existing floor
  const openEditModal = (floor: FacilityFloor) => {
    setEditingFloorId(floor.id)
    setName(floor.name)
    setCode(floor.code)
    setFloorNumber(floor.floorNumber)
    setTotalArea(floor.totalArea)
    setHeight(floor.height ?? '')
    setLoadCapacity(floor.loadCapacity ?? '')
    setDescription(floor.description || '')
    setStatus(floor.status)
    setFormError(null)
    setIsModalOpen(true)
  }

  // Save floor (Create or Edit)
  const handleSaveFloor = (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    setFormError(null)

    const trimmedName = name.trim()
    const trimmedCode = code.trim().toUpperCase()

    if (!trimmedName) {
      setFormError('Vui lòng nhập tên tầng.')
      return
    }

    if (!trimmedCode) {
      setFormError('Vui lòng nhập mã tầng nhận diện.')
      return
    }

    // Check code uniqueness across all floors (except current when editing)
    const duplicateCode = floors.some(
      (f) => f.id !== editingFloorId && f.code.toUpperCase() === trimmedCode
    )
    if (duplicateCode) {
      setFormError(`Mã tầng "${trimmedCode}" đã tồn tại trong cơ sở. Vui lòng chọn mã khác.`)
      return
    }

    const areaNum = Number(totalArea)
    if (isNaN(areaNum) || areaNum <= 0) {
      setFormError('Diện tích sàn tổng cộng phải là một số lớn hơn 0 m².')
      return
    }

    if (editingFloorId) {
      // Edit mode
      const updatedFloors = floors.map((f) => {
        if (f.id !== editingFloorId) return f
        return {
          ...f,
          name: trimmedName,
          code: trimmedCode,
          floorNumber: Number(floorNumber) || 0,
          totalArea: areaNum,
          height: height !== '' ? Number(height) : undefined,
          loadCapacity: loadCapacity !== '' ? Number(loadCapacity) : undefined,
          description: description.trim(),
          status,
        }
      })
      onChangeFloors(updatedFloors)
    } else {
      // Create mode: Create an empty floor without auto-generated functional areas
      const newFloor: FacilityFloor = {
        id: generateId(),
        name: trimmedName,
        code: trimmedCode,
        floorNumber: Number(floorNumber) || floors.length + 1,
        totalArea: areaNum,
        height: height !== '' ? Number(height) : undefined,
        loadCapacity: loadCapacity !== '' ? Number(loadCapacity) : undefined,
        description: description.trim(),
        status,
        displayOrder: floors.length + 1,
        zones: [],
        functionalAreas: [],
      }
      onChangeFloors([...floors, newFloor])
      // Auto expand newly created floor
      setExpandedFloorIds((prev) => ({ ...prev, [newFloor.id]: true }))
    }

    setIsModalOpen(false)
  }

  // Duplicate a floor
  const handleDuplicateFloor = (floor: FacilityFloor) => {
    const nextNum = floors.length + 1
    const newFloorId = generateId()
    const newCode = `${floor.code}-CPY`

    // Deep copy zones with new IDs
    const clonedZones: FacilityZone[] = floor.zones.map((z, idx) => ({
      ...z,
      id: generateId(),
      floorId: newFloorId,
      code: `${z.code}-C${idx + 1}`,
      name: `${z.name} (Bản sao)`,
    }))

    // Deep copy functional areas with new IDs
    const clonedFunctionalAreas: FacilityFunctionalArea[] = floor.functionalAreas.map((fa, idx) => ({
      ...fa,
      id: generateId(),
      floorId: newFloorId,
      code: `${fa.code}-C${idx + 1}`,
      name: `${fa.name} (Bản sao)`,
    }))

    const newFloor: FacilityFloor = {
      ...floor,
      id: newFloorId,
      name: `${floor.name} (Bản sao)`,
      code: newCode,
      floorNumber: floor.floorNumber + 1,
      displayOrder: floors.length + 1,
      zones: clonedZones,
      functionalAreas: clonedFunctionalAreas,
    }

    onChangeFloors([...floors, newFloor])
    setExpandedFloorIds((prev) => ({ ...prev, [newFloorId]: true }))
  }

  // Request floor deletion
  const handleRequestDelete = (floor: FacilityFloor) => {
    const unitsCount = getPhysicalUnitsCount(floor)
    if (unitsCount > 0) {
      setDeleteBlockedWarning({
        floorName: floor.name,
        unitsCount,
      })
      return
    }
    setDeleteConfirmFloorId(floor.id)
  }

  // Confirm delete floor
  const handleConfirmDelete = (floorId: string) => {
    const updated = floors.filter((f) => f.id !== floorId)
    onChangeFloors(updated)
    setDeleteConfirmFloorId(null)
  }

  // Move floor up / down
  const handleMoveFloor = (index: number, direction: 'UP' | 'DOWN') => {
    if (direction === 'UP' && index === 0) return
    if (direction === 'DOWN' && index === floors.length - 1) return

    const targetIndex = direction === 'UP' ? index - 1 : index + 1
    const newFloors = [...floors]
    const temp = newFloors[index]
    newFloors[index] = newFloors[targetIndex]
    newFloors[targetIndex] = temp

    // Update display orders
    const reordered = newFloors.map((f, idx) => ({
      ...f,
      displayOrder: idx + 1,
    }))
    onChangeFloors(reordered)
  }

  // Update a single floor (from child managers)
  const handleUpdateSingleFloor = (updatedFloor: FacilityFloor) => {
    const updatedFloors = floors.map((f) => (f.id === updatedFloor.id ? updatedFloor : f))
    onChangeFloors(updatedFloors)
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/10 to-indigo-600/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center ring-1 ring-indigo-500/20">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Cấu hình sơ đồ tầng cơ sở
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {floors.length} tầng
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Quản lý các tầng (B1, Tầng 1, 2...), phân khu lưu trữ và tiện ích chung theo kiến trúc thực tế.
            </p>
          </div>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Thêm tầng mới
          </button>
        )}
      </div>

      {/* Floors List */}
      {floors.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
          <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Chưa có tầng nào được thiết lập
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            Bấm nút &quot;Thêm tầng mới&quot; để bắt đầu cấu hình mặt bằng cho chi nhánh.
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Thêm tầng đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {floors.map((floor, index) => {
            const isExpanded = !!expandedFloorIds[floor.id]
            const activeTab = activeFloorTabs[floor.id] || 'ZONES'
            const allocation = calculateFloorAllocation(floor)
            const physicalCount = getPhysicalUnitsCount(floor)

            return (
              <div
                key={floor.id}
                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                  allocation.isExceeded
                    ? 'border-rose-300 dark:border-rose-900/60 bg-white dark:bg-slate-900 shadow-sm ring-1 ring-rose-400/20'
                    : isExpanded
                    ? 'border-indigo-200 dark:border-indigo-900/50 bg-white dark:bg-slate-900 shadow-md ring-1 ring-indigo-500/10'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Floor Card Header */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
                  <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                    {/* Reorder Buttons */}
                    {!readOnly && (
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveFloor(index, 'UP')}
                          disabled={index === 0}
                          title="Di chuyển lên"
                          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveFloor(index, 'DOWN')}
                          disabled={index === floors.length - 1}
                          title="Di chuyển xuống"
                          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Floor Icon & Info */}
                    <div
                      onClick={() => toggleExpand(floor.id)}
                      className="cursor-pointer flex items-center gap-3.5 flex-1 min-w-0"
                    >
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 ring-1 ring-slate-200 dark:ring-slate-700">
                        {floor.code}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {floor.name}
                          </h4>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            Thứ tự: {floor.floorNumber}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                              floor.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : floor.status === 'MAINTENANCE'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            }`}
                          >
                            {floor.status === 'ACTIVE'
                              ? 'Hoạt động'
                              : floor.status === 'MAINTENANCE'
                              ? 'Bảo trì'
                              : 'Tạm dừng'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                          <span>
                            Tổng diện tích: <b className="text-slate-700 dark:text-slate-200">{floor.totalArea} m²</b>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Box className="w-3.5 h-3.5 text-blue-500" />
                            <b>{floor.zones.length}</b> phân khu kho ({allocation.zoneAreaTotal} m²)
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Compass className="w-3.5 h-3.5 text-emerald-500" />
                            <b>{floor.functionalAreas.length}</b> khu chức năng ({allocation.functionalAreaTotal} m²)
                          </span>
                          {physicalCount > 0 && (
                            <>
                              <span>•</span>
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                                {physicalCount} buồng kho vật lý
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Floor Allocation Bar & Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                    {/* Allocation Progress Badge */}
                    <div className="flex flex-col items-end gap-1 min-w-[130px]">
                      <div className="flex items-center justify-between w-full text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400">Đã phân bổ:</span>
                        <span
                          className={`font-bold ${
                            allocation.isExceeded
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {allocation.allocatedArea} / {floor.totalArea} m² ({allocation.percentageAllocated}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            allocation.isExceeded
                              ? 'bg-rose-500'
                              : allocation.percentageAllocated >= 90
                              ? 'bg-amber-500'
                              : 'bg-indigo-600'
                          }`}
                          style={{ width: `${Math.min(100, allocation.percentageAllocated)}%` }}
                        />
                      </div>
                      {allocation.isExceeded && (
                        <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3" /> Vượt diện tích sàn!
                        </span>
                      )}
                    </div>

                    {/* Actions Menu */}
                    <div className="flex items-center gap-1.5 ml-2">
                      {!readOnly && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(floor)}
                            title="Chỉnh sửa thông tin tầng"
                            className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateFloor(floor)}
                            title="Tạo bản sao tầng"
                            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRequestDelete(floor)}
                            title="Xóa tầng"
                            className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleExpand(floor.id)}
                        className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Floor Content */}
                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4 sm:p-6 space-y-6">
                    {/* Sub Tabs */}
                    <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                      <button
                        type="button"
                        onClick={() => setFloorTab(floor.id, 'ZONES')}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                          activeTab === 'ZONES'
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                        }`}
                      >
                        <Box className="w-4 h-4" />
                        Phân khu kho ({floor.zones.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setFloorTab(floor.id, 'FUNCTIONAL_AREAS')}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                          activeTab === 'FUNCTIONAL_AREAS'
                            ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                        }`}
                      >
                        <Compass className="w-4 h-4" />
                        Khu vực chức năng ({floor.functionalAreas.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setFloorTab(floor.id, 'SPECS')}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                          activeTab === 'SPECS'
                            ? 'bg-slate-800 dark:bg-slate-700 text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                        }`}
                      >
                        <Gauge className="w-4 h-4" />
                        Thông số kỹ thuật sàn
                      </button>
                    </div>

                    {/* Tab 1: Storage Zones */}
                    {activeTab === 'ZONES' && (
                      <FloorZoneManager
                        floor={floor}
                        allFloors={floors}
                        onUpdateFloor={handleUpdateSingleFloor}
                      />
                    )}

                    {/* Tab 2: Functional Areas */}
                    {activeTab === 'FUNCTIONAL_AREAS' && (
                      <FloorFunctionalAreaManager
                        floor={floor}
                        allFloors={floors}
                        onUpdateFloor={handleUpdateSingleFloor}
                      />
                    )}

                    {/* Tab 3: Floor Specs */}
                    {activeTab === 'SPECS' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                            Tổng diện tích sàn
                          </span>
                          <span className="text-lg font-bold text-slate-900 dark:text-white">
                            {floor.totalArea} m²
                          </span>
                          <div className="text-[11px] text-slate-500 mt-2 space-y-0.5">
                            <div>• Diện tích phân khu kho: {allocation.zoneAreaTotal} m²</div>
                            <div>• Khu vực chức năng: {allocation.functionalAreaTotal} m²</div>
                            <div>• Diện tích chưa bố trí: {allocation.unallocatedArea} m²</div>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                            Chiều cao thông thủy
                          </span>
                          <span className="text-lg font-bold text-slate-900 dark:text-white">
                            {floor.height ? `${floor.height} m` : 'Chưa thiết lập'}
                          </span>
                          <p className="text-[11px] text-slate-500 mt-2">
                            Khoảng cách từ mặt sàn tới dầm hoặc trần kỹ thuật thấp nhất.
                          </p>
                        </div>

                        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                            Tải trọng sàn thiết kế
                          </span>
                          <span className="text-lg font-bold text-slate-900 dark:text-white">
                            {floor.loadCapacity ? `${floor.loadCapacity} kg/m²` : 'Chưa thiết lập'}
                          </span>
                          <p className="text-[11px] text-slate-500 mt-2">
                            Khả năng chịu tải trọng tĩnh & động tối đa theo kết cấu sàn.
                          </p>
                        </div>

                        {floor.description && (
                          <div className="md:col-span-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                              Ghi chú kiến trúc & mặt bằng
                            </span>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                              {floor.description}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Create / Edit Floor */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {editingFloorId ? 'Chỉnh sửa thông tin tầng' : 'Thêm tầng mới'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {editingFloorId
                      ? 'Cập nhật diện tích, thông số kỹ thuật và trạng thái tầng'
                      : 'Khởi tạo tầng mới trong sơ đồ chi nhánh'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tên tầng <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Tầng 1, Tầng Hầm B1, Tầng Trệt"
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mã tầng nhận diện <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="VD: FL-01, FL-B1"
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Số tầng kỹ thuật
                  </label>
                  <input
                    type="number"
                    value={floorNumber}
                    onChange={(e) => setFloorNumber(Number(e.target.value))}
                    placeholder="1, 2, -1 (B1)..."
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    -1 cho hầm B1, 1 cho Tầng 1
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tổng diện tích sàn (m²) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={totalArea}
                    onChange={(e) => setTotalArea(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="VD: 400"
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Trạng thái tầng
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="ACTIVE">Hoạt động bình thường</option>
                    <option value="MAINTENANCE">Đang bảo trì / Nâng cấp</option>
                    <option value="INACTIVE">Tạm ngưng khai thác</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Chiều cao thông thủy (m)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={height}
                    onChange={(e) => setHeight(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="VD: 3.5"
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tải trọng sàn (kg/m²)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={loadCapacity}
                    onChange={(e) => setLoadCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="VD: 500"
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mô tả đặc điểm tầng
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ghi chú về lối tiếp cận, khu vực thang máy hàng, kiểm soát ra vào..."
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {!editingFloorId && (
                <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-[11px] text-indigo-700 dark:text-indigo-300 flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Tầng mới sẽ được khởi tạo với cấu hình rỗng (không tự động thêm khu chức năng). Bạn có thể tự do thêm phân khu kho và tiện ích theo kiến trúc cơ sở.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleSaveFloor}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  {editingFloorId ? 'Lưu thay đổi' : 'Tạo tầng'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {deleteConfirmFloorId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Xác nhận xóa tầng?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Thao tác này sẽ xóa tầng cùng tất cả phân khu và khu vực chức năng trực thuộc.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              Tầng:{' '}
              <b className="text-slate-900 dark:text-white">
                {floors.find((f) => f.id === deleteConfirmFloorId)?.name}
              </b>{' '}
              ({floors.find((f) => f.id === deleteConfirmFloorId)?.code})
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmFloorId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelete(deleteConfirmFloorId)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition-all"
              >
                Xác nhận xóa tầng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Blocked Warning (Units exist on this floor) */}
      {deleteBlockedWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-rose-200 dark:border-rose-900/60 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Không thể xóa tầng này
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                  Ràng buộc toàn vẹn dữ liệu buồng kho
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 bg-rose-50/60 dark:bg-rose-950/30 p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 space-y-1.5">
              <p>
                Tầng <b className="text-slate-900 dark:text-white">{deleteBlockedWarning.floorName}</b> hiện đang có{' '}
                <b className="text-rose-600 dark:text-rose-400">{deleteBlockedWarning.unitsCount}</b> buồng kho vật lý liên kết.
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                Để xóa tầng, trước tiên vui lòng di chuyển các buồng kho sang tầng khác hoặc xóa các buồng kho trong mục Quản lý buồng kho.
              </p>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setDeleteBlockedWarning(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 transition-all"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
