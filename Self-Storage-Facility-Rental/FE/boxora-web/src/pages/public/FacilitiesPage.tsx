import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Building2, MapPin, Phone, Filter, Search, Loader2, ArrowRight } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Navbar } from '../../components/layout/Navbar'
import { Footer } from '../../components/layout/Footer'
import { facilityService } from '../../services/facilityService'
import { storageUnitService } from '../../services/storageUnitService'
import { Facility, StorageUnit } from '../../types'

const FACILITY_IMAGE_MAP: Record<string, string> = {
  'HCM-D1': 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=1000',
  'HCM-D7': 'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&q=80&w=1000',
  'HCM-TD': 'https://images.unsplash.com/photo-1590247813693-5541d1c609fd?auto=format&fit=crop&q=80&w=1000',
}

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=1000'

export const FacilitiesPage: React.FC = () => {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [storageUnits, setStorageUnits] = useState<StorageUnit[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchUnitQuery, setSearchUnitQuery] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function fetchData() {
      setIsLoading(true)
      setError(null)
      try {
        const [facRes, unitsRes] = await Promise.all([
          facilityService.getFacilities({ size: 100 }),
          storageUnitService.getUnits(),
        ])

        if (!isMounted) return

        const fetchedFacilities = facRes?.content || []
        const fetchedUnits = unitsRes || []

        setFacilities(fetchedFacilities)
        setStorageUnits(fetchedUnits)

        if (fetchedFacilities.length > 0) {
          setSelectedFacilityId(fetchedFacilities[0].id)
        }
      } catch (err: any) {
        if (!isMounted) return
        setError(err.message || 'Không thể nạp dữ liệu cơ sở từ hệ thống')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchData()
    return () => {
      isMounted = false
    }
  }, [])

  // Aggregate units per facility
  const facilitiesWithStats = useMemo(() => {
    return facilities.map((facility) => {
      const unitsInFacility = storageUnits.filter((u) => u.facilityId === facility.id)
      const availableCount = unitsInFacility.filter((u) => u.status === 'AVAILABLE').length
      const image =
        facility.imageUrl ||
        (facility.code && FACILITY_IMAGE_MAP[facility.code]) ||
        DEFAULT_IMAGE

      return {
        ...facility,
        imageUrl: image,
        totalUnits: unitsInFacility.length || facility.totalUnits || 0,
        availableUnits: availableCount,
      }
    })
  }, [facilities, storageUnits])

  const selectedFacility = useMemo(() => {
    return (
      facilitiesWithStats.find((f) => f.id === selectedFacilityId) ||
      facilitiesWithStats[0] ||
      null
    )
  }, [facilitiesWithStats, selectedFacilityId])

  const filteredUnits = useMemo(() => {
    if (!selectedFacilityId) return []
    return storageUnits.filter((u) => {
      const matchFac = u.facilityId === selectedFacilityId
      const matchStatus = statusFilter === 'ALL' || u.status === statusFilter
      const matchQuery =
        !searchUnitQuery.trim() ||
        u.unitCode?.toLowerCase().includes(searchUnitQuery.toLowerCase()) ||
        u.unitTypeName?.toLowerCase().includes(searchUnitQuery.toLowerCase()) ||
        u.floorLevel?.toLowerCase().includes(searchUnitQuery.toLowerCase())
      return matchFac && matchStatus && matchQuery
    })
  }, [storageUnits, selectedFacilityId, statusFilter, searchUnitQuery])

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col font-sans antialiased text-slate-900 text-left">
      <Navbar />

      <main className="flex-1 py-10 sm:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="max-w-3xl mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-semibold text-orange-700 mb-3">
              <Building2 className="w-3.5 h-3.5 text-orange-600" />
              <span>Hệ thống cơ sở kho lưu trữ Boxora</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2 text-slate-900">
              Hệ Thống Cơ Sở &amp; Tình Trạng Kho Trống Thực Tế
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Dữ liệu đồng bộ trực tiếp từ hệ thống API Boxora. Kiểm tra số lượng kho trống, giá thuê và thông tin vị trí các chi nhánh.
            </p>
          </div>

          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <Loader2 className="w-9 h-9 text-orange-600 animate-spin" />
              <p className="text-sm font-medium text-slate-600">Đang tải danh sách cơ sở và kho trống từ máy chủ...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-2xl text-rose-700">
              <p className="font-semibold text-sm mb-2">Đã xảy ra lỗi khi kết nối hệ thống:</p>
              <p className="text-xs text-rose-600 mb-4">{error}</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.location.reload()}
                className="bg-white border-rose-300 text-rose-700 hover:bg-rose-100"
              >
                Tải lại trang
              </Button>
            </div>
          ) : (
            <>
              {/* Facility Cards Selector */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {facilitiesWithStats.map((facility) => {
                  const isSelected = facility.id === selectedFacilityId
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
                      <div className="h-44 rounded-xl overflow-hidden mb-4 relative bg-slate-100">
                        <img
                          src={facility.imageUrl}
                          alt={facility.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute top-2.5 right-2.5">
                          <Badge variant="success" className="font-semibold shadow-xs">
                            {facility.availableUnits} Kho Trống
                          </Badge>
                        </div>
                        {facility.code && (
                          <div className="absolute bottom-2.5 left-2.5 bg-slate-950/80 backdrop-blur px-2.5 py-1 rounded-md text-[11px] font-mono font-bold text-white">
                            {facility.code}
                          </div>
                        )}
                      </div>

                      <h3 className="font-bold text-base text-slate-900 mb-1">{facility.name}</h3>
                      <p className="text-xs text-slate-600 flex items-center gap-1.5 mb-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{facility.address}</span>
                      </p>
                      <p className="text-xs text-slate-500 font-mono flex items-center gap-1.5 mb-4">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {facility.contactPhone || '1900 6868'}
                      </p>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                        <span className="text-slate-500">Tổng quy mô kho:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {facility.totalUnits} Kho
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Selected Facility Unit Inventory Grid */}
              {selectedFacility && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-900">
                          {selectedFacility.name} • Danh Sách Kho
                        </h2>
                        {selectedFacility.code && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-xs font-semibold text-slate-700">
                            {selectedFacility.code}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {selectedFacility.address} — {selectedFacility.city}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Search in units */}
                      <div className="relative min-w-[180px]">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Mã kho, loại kho..."
                          value={searchUnitQuery}
                          onChange={(e) => setSearchUnitQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400"
                        />
                      </div>

                      {/* Status Filter */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Filter className="w-3.5 h-3.5" /> Lọc:
                        </span>
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 font-semibold text-slate-800 focus:outline-none focus:border-slate-400"
                        >
                          <option value="ALL">Tất cả ({storageUnits.filter(u => u.facilityId === selectedFacilityId).length})</option>
                          <option value="AVAILABLE">Đang trống (Thuê ngay)</option>
                          <option value="OCCUPIED">Đang có khách thuê</option>
                          <option value="UNDER_MAINTENANCE">Bảo trì</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Units Table/Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    {filteredUnits.map((unit) => (
                      <div
                        key={unit.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 hover:border-slate-300 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono font-bold text-base text-slate-900">
                              #{unit.unitCode}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                unit.status === 'AVAILABLE'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : unit.status === 'OCCUPIED'
                                  ? 'bg-slate-100 text-slate-600 border-slate-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {unit.status === 'AVAILABLE'
                                ? 'Sẵn sàng'
                                : unit.status === 'OCCUPIED'
                                ? 'Đã thuê'
                                : 'Bảo trì'}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-800 mb-0.5">
                            {unit.unitTypeName || 'Kho tiêu chuẩn'}
                          </p>
                          <p className="text-[11px] text-slate-500 mb-2">
                            {unit.floorLevel || 'Tầng 1'}
                            {unit.areaSqMeters ? ` • ${unit.areaSqMeters} m²` : ''}
                          </p>
                        </div>

                        <div className="border-t border-slate-200/80 pt-3 flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-orange-600">
                            {unit.pricePerMonth ? Number(unit.pricePerMonth).toLocaleString('vi-VN') : '--'} ₫
                            <span className="text-[10px] font-normal text-slate-500">/tháng</span>
                          </span>
                          {unit.status === 'AVAILABLE' ? (
                            <Link to={`/units?unit=${unit.id}`}>
                              <Button
                                size="sm"
                                variant="primary"
                                className="bg-slate-900 hover:bg-slate-800 text-white text-[11px] py-1 px-2.5 flex items-center gap-1 cursor-pointer"
                              >
                                <span>Giữ chỗ</span>
                                <ArrowRight className="w-3 h-3" />
                              </Button>
                            </Link>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">
                              {unit.status === 'OCCUPIED' ? 'Đã có khách' : 'Bảo trì'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {filteredUnits.length === 0 && (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      Không tìm thấy vị trí kho nào phù hợp với bộ lọc đã chọn.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default FacilitiesPage
