import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, MapPin, Phone, Filter, Loader2 } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { facilityService } from '../../services/facilityService'
import { storageUnitService } from '../../services/storageUnitService'
import { Facility, StorageUnit } from '../../types'
import { BrandLogo } from '../../components/common/BrandLogo'
import { StorageUnitDetailModal } from '../../components/modals/StorageUnitDetailModal'

import facilityD1Img from '../../assets/facilities/facility-d1.jpg'
import facilityD7Img from '../../assets/facilities/facility-d7.jpg'
import facilityThuDucImg from '../../assets/facilities/facility-thuduc.jpg'
import facilityTanBinhImg from '../../assets/facilities/facility-tanbinh.jpg'

const FACILITY_IMAGES = [
  facilityD1Img,
  facilityD7Img,
  facilityThuDucImg,
  facilityTanBinhImg
]

export const FacilitiesPage: React.FC = () => {
  const navigate = useNavigate()
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [units, setUnits] = useState<StorageUnit[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [selectedDetailUnit, setSelectedDetailUnit] = useState<StorageUnit | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const [facRes, unitRes] = await Promise.all([
          facilityService.getFacilities({ size: 100 }),
          storageUnitService.getUnits()
        ])
        const facList = (facRes?.content || []).filter(facility => !facility.status || facility.status === 'ACTIVE')
        const unitList = Array.isArray(unitRes) ? unitRes : []
        setFacilities(facList)
        setUnits(unitList)
        if (facList.length > 0) {
          setSelectedFacilityId(facList[0].id)
        }
      } catch (err) {
        console.error('Failed to load facilities/units from database:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const selectedFacility = facilities.find(f => f.id === selectedFacilityId) || facilities[0]
  
  const facilityUnits = units.filter(u => {
    const matchFac = u.facilityId === selectedFacilityId
    const matchStatus = statusFilter === 'ALL' || u.status === statusFilter
    return matchFac && matchStatus
  })

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen pb-16 text-slate-900 dark:text-slate-100 font-sans antialiased text-left">
      {/* Top Brand Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <BrandLogo subtitle="HỆ THỐNG CƠ SỞ" />
          <div className="flex items-center gap-3">
            <Link
              to="/booking"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all shadow-xs flex items-center gap-1.5"
            >
              <span>Tìm &amp; Thuê Kho</span>
            </Link>
            <Link
              to="/"
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
            >
              Trang Chủ
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="max-w-3xl mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-semibold text-orange-700 mb-3">
            <Building2 className="w-3.5 h-3.5 text-orange-600" />
            Hệ thống {facilities.length} cơ sở kho đang hoạt động
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2 text-slate-900">
            Hệ Thống Cơ Sở &amp; Tình Trạng Kho Trống
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Kiểm tra sơ đồ thực tế, sức chứa và danh sách các vị trí kho đang sẵn sàng bàn giao tại từng chi nhánh của Boxora.
          </p>
        </div>

        {/* Facility Cards Selector */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-500 text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
            <span>Đang tải dữ liệu từ database...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {facilities.map((facility, idx) => {
              const isSelected = facility.id === selectedFacilityId
              const facUnits = units.filter(u => u.facilityId === facility.id)
              const availableUnits = facUnits.filter(u => u.status === 'AVAILABLE').length
              const totalUnits = facUnits.length
              const imageUrl = facility.imageUrl || FACILITY_IMAGES[idx % FACILITY_IMAGES.length]

              return (
                <div
                  key={facility.id}
                  onClick={() => setSelectedFacilityId(facility.id)}
                  className={`cursor-pointer rounded-2xl border p-5 transition-all ${
                    isSelected 
                      ? 'border-orange-500 bg-white shadow-md ring-2 ring-orange-500/20' 
                      : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div className="h-44 rounded-xl overflow-hidden mb-4 relative">
                    <img 
                      src={imageUrl} 
                      alt={facility.name} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2.5 right-2.5">
                      <Badge variant="success" className="font-semibold">{availableUnits} Kho Trống</Badge>
                    </div>
                  </div>

                  <h3 className="font-bold text-base text-slate-900 mb-1">{facility.name}</h3>
                  <p className="text-xs text-slate-600 flex items-center gap-1.5 mb-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {facility.address}
                  </p>
                  <p className="text-xs text-slate-500 font-mono flex items-center gap-1.5 mb-4">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {facility.contactPhone}
                  </p>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                    <span className="text-slate-500">Tổng quy mô:</span>
                    <span className="font-unit-code font-bold text-slate-900">{totalUnits} Kho</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Selected Facility Unit Inventory Grid */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{selectedFacility?.name || 'Chi nhánh'} • Danh Sách Kho</h2>
              <p className="text-xs text-slate-500 mt-1">Cập nhật trực tiếp tình trạng từng vị trí kho tại cơ sở này.</p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Lọc kho:
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 font-semibold text-slate-800 focus:outline-none focus:border-slate-400"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="AVAILABLE">Đang trống (Thuê ngay)</option>
                <option value="OCCUPIED">Đang có khách thuê</option>
              </select>
            </div>
          </div>

          {/* Units Table/Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {facilityUnits.map(unit => (
              <div 
                key={unit.id}
                onClick={() => {
                  setSelectedDetailUnit(unit)
                  setIsDetailModalOpen(true)
                }}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-blue-400 hover:shadow-sm transition-all flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-unit-code font-bold text-base text-slate-900 group-hover:text-blue-600 transition-colors">#{unit.unitCode}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      unit.status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      unit.status === 'OCCUPIED' ? 'bg-slate-100 text-slate-600 border-slate-200' : 
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {unit.status === 'AVAILABLE' ? 'Sẵn sàng' : unit.status === 'OCCUPIED' ? 'Đã thuê' : 'Bảo trì'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 mb-0.5">{unit.unitTypeName}</p>
                  <p className="text-[11px] text-slate-500 mb-2">{unit.floorLevel}</p>
                  <span className="text-[11px] text-blue-600 font-semibold inline-flex items-center gap-1 group-hover:underline mb-2">
                    <span className="material-symbols-outlined text-[14px]">visibility</span>
                    Xem chi tiết &amp; ảnh minh họa
                  </span>
                </div>

                <div className="border-t border-slate-200/80 pt-3 flex items-center justify-between">
                  <span className="font-unit-code font-bold text-xs text-orange-600">
                    {Number(unit.pricePerMonth || 0).toLocaleString('vi-VN')} ₫<span className="text-[10px] font-normal text-slate-500">/tháng</span>
                  </span>
                  {unit.status === 'AVAILABLE' ? (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate('/booking')
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] py-1 px-2.5 shadow-2xs cursor-pointer"
                    >
                      Giữ chỗ
                    </Button>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">Hết kho</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {facilityUnits.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-xs">
              Không tìm thấy vị trí kho nào phù hợp với bộ lọc đã chọn.
            </div>
          )}
        </div>

      </div>

      <StorageUnitDetailModal
        isOpen={isDetailModalOpen}
        unit={selectedDetailUnit ? {
          id: selectedDetailUnit.id,
          backendId: selectedDetailUnit.id,
          unitCode: selectedDetailUnit.unitCode,
          unitTypeName: selectedDetailUnit.unitTypeName,
          facilityId: selectedDetailUnit.facilityId,
          facilityName: selectedFacility?.name || selectedDetailUnit.facilityName,
          facilityAddress: selectedFacility?.address,
          floorLevel: selectedDetailUnit.floorLevel,
          pricePerMonth: selectedDetailUnit.pricePerMonth,
          depositAmount: selectedDetailUnit.depositAmount,
          areaSqMeters: selectedDetailUnit.areaSqMeters,
          status: selectedDetailUnit.status,
          images: selectedDetailUnit.images
        } : null}
        onClose={() => setIsDetailModalOpen(false)}
        onReserve={(unitData) => {
          setIsDetailModalOpen(false)
          navigate('/booking')
        }}
      />
    </div>
  )
}

export default FacilitiesPage
