import React, { useState, useEffect } from 'react'
import { storageUnitService } from '../../services/storageUnitService'
import { facilityService } from '../../services/facilityService'
import { reportService } from '../../services/reportService'
import { Facility, OverdueDebtReport, StorageUnit } from '../../types'

interface InspectedUnit {
  id: string
  backendId?: string
  size: string
  type: string
  status: 'Available' | 'Rented' | 'Pending' | 'Overdue' | 'Maintenance'
  rawStatus?: string
  color: 'emerald' | 'blue' | 'amber' | 'purple' | 'red'
  tenant: string
  contract: string
  due: string
  battery: string
  smartlock: string
  lastAccess: string
  floorLevel: string
  pricePerMonth?: number
  facilityId?: string
  facilityName?: string
}

const INITIAL_UNITS: InspectedUnit[] = [
  // Zone A (Floor 1)
  { id: 'A-101', floorLevel: 'Floor 1', size: '6.5 m²', type: 'Standard Dry', status: 'Available', color: 'emerald', tenant: 'Chưa có khách', contract: 'Trống', due: '--', battery: '98%', smartlock: 'SL-9011', lastAccess: 'Chưa ghi nhận' },
  { id: 'A-102', floorLevel: 'Floor 1', size: '6.5 m²', type: 'Standard Dry', status: 'Available', color: 'emerald', tenant: 'Chưa có khách', contract: 'Trống', due: '--', battery: '95%', smartlock: 'SL-9012', lastAccess: 'Chưa ghi nhận' },
  { id: 'A-103', floorLevel: 'Floor 1', size: '12.0 m²', type: 'Standard Roll-up', status: 'Rented', color: 'blue', tenant: 'Công ty TNHH Hóa Mỹ Phẩm An Bình', contract: 'HD-2024-8891', due: '18/11/2025', battery: '92%', smartlock: 'SL-8812', lastAccess: 'Hôm nay 08:15' },
  { id: 'A-104', floorLevel: 'Floor 1', size: '12.0 m²', type: 'Standard Roll-up', status: 'Rented', color: 'blue', tenant: 'Võ Thành Đạt (Cá nhân)', contract: 'HD-2024-7742', due: '30/08/2025', battery: '89%', smartlock: 'SL-8814', lastAccess: '3 ngày trước' },
  { id: 'A-105', floorLevel: 'Floor 1', size: '8.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Bùi Thị Thanh Hằng', contract: 'HD-2025-0102', due: '28/02/2026', battery: '100%', smartlock: 'SL-8820', lastAccess: 'Hôm qua 19:40' },
  { id: 'A-106', floorLevel: 'Floor 1', size: '8.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Startup Logistic Tân Bình Express', contract: 'HD-2024-9118', due: '12/12/2025', battery: '94%', smartlock: 'SL-8822', lastAccess: 'Hôm nay 07:11' },
  { id: 'A-107', floorLevel: 'Floor 1', size: '8.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Phòng Trưng Bày Scandinavia', contract: 'HD-2024-6550', due: '10/01/2026', battery: '87%', smartlock: 'SL-8830', lastAccess: '5 ngày trước' },
  { id: 'A-108', floorLevel: 'Floor 1', size: '8.0 m²', type: 'Standard Roll-up', status: 'Pending', color: 'amber', tenant: 'Phạm Hoàng Nam', contract: 'HD-2025-4421', due: '15/05/2025', battery: '99%', smartlock: 'SL-8841', lastAccess: 'Hôm qua 18:24' },
  { id: 'A-109', floorLevel: 'Floor 1', size: '15.0 m²', type: 'Large Bulk Space', status: 'Rented', color: 'blue', tenant: 'Kho Phụ Kiện Sài Gòn', contract: 'HD-2023-3392', due: '01/10/2025', battery: '91%', smartlock: 'SL-8850', lastAccess: 'Hôm nay 09:50' },
  { id: 'A-110', floorLevel: 'Floor 1', size: '15.0 m²', type: 'Large Bulk Space', status: 'Maintenance', color: 'red', tenant: 'ĐANG BẢO TRÌ SỬA CỬA CUỐN', contract: 'TICKET-MT-402', due: 'Dự kiến 17:00', battery: 'Cắt nguồn', smartlock: 'SL-8855 (Tạm ngắt)', lastAccess: 'Kỹ thuật viên' },
  { id: 'A-111', floorLevel: 'Floor 1', size: '10.0 m²', type: 'Standard Roll-up', status: 'Rented', color: 'blue', tenant: 'Chuỗi Coffee Bean Lab', contract: 'HD-2024-5221', due: '19/04/2026', battery: '97%', smartlock: 'SL-8861', lastAccess: 'Hôm qua 14:10' },
  { id: 'A-112', floorLevel: 'Floor 1', size: '10.0 m²', type: 'Standard Roll-up', status: 'Rented', color: 'blue', tenant: 'Nguyễn Mai Hương', contract: 'HD-2024-9099', due: '05/06/2025', battery: '93%', smartlock: 'SL-8864', lastAccess: '2 ngày trước' },
  { id: 'A-113', floorLevel: 'Floor 1', size: '10.0 m²', type: 'Standard Roll-up', status: 'Rented', color: 'blue', tenant: 'Studio Nhiếp Ảnh Sáng Tạo', contract: 'HD-2024-1188', due: '11/11/2025', battery: '86%', smartlock: 'SL-8870', lastAccess: 'Hôm nay 06:40' },
  { id: 'A-114', floorLevel: 'Floor 1', size: '10.0 m²', type: 'Standard Roll-up', status: 'Rented', color: 'blue', tenant: 'Dương Minh Trí', contract: 'HD-2024-2200', due: '24/07/2025', battery: '90%', smartlock: 'SL-8873', lastAccess: '1 tuần trước' },
  { id: 'A-115', floorLevel: 'Floor 1', size: '10.0 m²', type: 'Standard Roll-up', status: 'Overdue', color: 'purple', tenant: 'Trần Quốc Tuấn (Kinh doanh)', contract: 'HD-2024-0044', due: 'Quá hạn 7 ngày', battery: '88%', smartlock: 'SL-8880 [KHOÁ TẠM]', lastAccess: '7 ngày trước 14:20' },
  { id: 'A-116', floorLevel: 'Floor 1', size: '10.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Đoàn Thị Bích Ngọc', contract: 'HD-2024-6331', due: '18/09/2025', battery: '92%', smartlock: 'SL-8889', lastAccess: 'Hôm qua 11:30' },
  // Zone B (Floor 1)
  { id: 'B-101', floorLevel: 'Floor 1', size: '20.0 m²', type: 'High Ceiling Bulk', status: 'Rented', color: 'blue', tenant: 'Hàng Tiêu Dùng Á Châu JSC', contract: 'HD-2023-1100', due: '25/12/2025', battery: '95%', smartlock: 'SL-7001', lastAccess: 'Hôm nay 08:30' },
  { id: 'B-102', floorLevel: 'Floor 1', size: '20.0 m²', type: 'High Ceiling Bulk', status: 'Rented', color: 'blue', tenant: 'Công ty Dược Medipharm', contract: 'HD-2024-5510', due: '15/07/2025', battery: '99%', smartlock: 'SL-7002', lastAccess: 'Hôm qua 16:45' },
  { id: 'B-103', floorLevel: 'Floor 1', size: '15.0 m²', type: 'Heavy Duty Space', status: 'Rented', color: 'blue', tenant: 'Vật Tư Y Tế Phúc Khang', contract: 'HD-2024-6622', due: '10/11/2025', battery: '94%', smartlock: 'SL-7003', lastAccess: '3 ngày trước' },
  { id: 'B-104', floorLevel: 'Floor 1', size: '15.0 m²', type: 'Heavy Duty Space', status: 'Rented', color: 'blue', tenant: 'Chuỗi Cửa Hàng Decathlon Depot', contract: 'HD-2024-3312', due: '01/01/2026', battery: '96%', smartlock: 'SL-7004', lastAccess: 'Hôm nay 09:12' },
  { id: 'B-105', floorLevel: 'Floor 1', size: '12.0 m²', type: 'Standard Roll-up', status: 'Pending', color: 'amber', tenant: 'Đỗ Nhật Huy (App Booking)', contract: 'HD-2025-9901', due: 'Hẹn check-in 14:00', battery: '100%', smartlock: 'SL-7005', lastAccess: 'Chưa check-in' },
  { id: 'B-106', floorLevel: 'Floor 1', size: '12.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Lê Thanh Thảo', contract: 'HD-2024-7711', due: '18/06/2025', battery: '89%', smartlock: 'SL-7006', lastAccess: '4 ngày trước' },
  { id: 'B-107', floorLevel: 'Floor 1', size: '12.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Trương Vĩnh Kỳ', contract: 'HD-2024-4481', due: '20/10/2025', battery: '92%', smartlock: 'SL-7007', lastAccess: 'Hôm nay 10:00' },
  { id: 'B-108', floorLevel: 'Floor 1', size: '8.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Kho Đồ Gia Dụng Thông Minh', contract: 'HD-2024-3388', due: '12/12/2025', battery: '91%', smartlock: 'SL-7008', lastAccess: 'Hôm qua 09:20' },
  { id: 'B-109', floorLevel: 'Floor 1', size: '8.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Ngô Gia Cường', contract: 'HD-2024-8822', due: '05/05/2025', battery: '90%', smartlock: 'SL-7009', lastAccess: '3 ngày trước' },
  { id: 'B-110', floorLevel: 'Floor 1', size: '8.0 m²', type: 'Standard Dry', status: 'Available', color: 'emerald', tenant: 'Chưa có khách', contract: 'Trống', due: '--', battery: '97%', smartlock: 'SL-7010', lastAccess: 'Chưa ghi nhận' },
  { id: 'B-111', floorLevel: 'Floor 1', size: '8.0 m²', type: 'Standard Dry', status: 'Available', color: 'emerald', tenant: 'Chưa có khách', contract: 'Trống', due: '--', battery: '96%', smartlock: 'SL-7011', lastAccess: 'Chưa ghi nhận' },
  { id: 'B-112', floorLevel: 'Floor 1', size: '15.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Cty Kiến Trúc Nghệ Thuật', contract: 'HD-2024-9912', due: '14/09/2025', battery: '93%', smartlock: 'SL-7012', lastAccess: 'Hôm qua 15:00' },
  { id: 'B-113', floorLevel: 'Floor 1', size: '15.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Chuỗi Sách Ngoại Văn Bookland', contract: 'HD-2024-4112', due: '30/11/2025', battery: '98%', smartlock: 'SL-7013', lastAccess: 'Hôm nay 09:44' },
  { id: 'B-114', floorLevel: 'Floor 1', size: '15.0 m²', type: 'Standard Dry', status: 'Rented', color: 'blue', tenant: 'Huỳnh Thanh Tùng', contract: 'HD-2024-5509', due: '01/08/2025', battery: '85%', smartlock: 'SL-7014', lastAccess: '5 ngày trước' },
  { id: 'B-120', floorLevel: 'Floor 1', size: '20.0 m²', type: 'High Ceiling Bulk', status: 'Overdue', color: 'purple', tenant: 'Kho Đồ Điện Tử Việt Phát', contract: 'HD-2023-8811', due: 'Quá hạn 12 ngày', battery: '82%', smartlock: 'SL-7020 [KHOÁ TẠM]', lastAccess: '12 ngày trước 18:00' },
  { id: 'B-121', floorLevel: 'Floor 1', size: '20.0 m²', type: 'High Ceiling Bulk', status: 'Rented', color: 'blue', tenant: 'Cửa Hàng Thể Thao ProSport', contract: 'HD-2024-7700', due: '20/09/2025', battery: '94%', smartlock: 'SL-7021', lastAccess: 'Hôm qua 17:15' },
  // Zone C (Floor 2 - Climate Controlled Cold)
  { id: 'C-201', floorLevel: 'Floor 2', size: '12.0 m²', type: 'Climate Cold (18°C-22°C)', status: 'Available', color: 'emerald', tenant: 'Chưa có khách', contract: 'Trống', due: '--', battery: '99%', smartlock: 'SL-C201', lastAccess: 'Chưa ghi nhận' },
  { id: 'C-202', floorLevel: 'Floor 2', size: '12.0 m²', type: 'Climate Cold (18°C-22°C)', status: 'Available', color: 'emerald', tenant: 'Chưa có khách', contract: 'Trống', due: '--', battery: '98%', smartlock: 'SL-C202', lastAccess: 'Chưa ghi nhận' },
  { id: 'C-203', floorLevel: 'Floor 2', size: '12.0 m²', type: 'Climate Cold (18°C-22°C)', status: 'Rented', color: 'blue', tenant: 'Hầm Rượu Bordeaux Wine Club', contract: 'HD-2025-1088', due: '15/12/2026', battery: '95%', smartlock: 'SL-C203', lastAccess: 'Hôm nay 11:20' },
  { id: 'C-204', floorLevel: 'Floor 2', size: '12.0 m²', type: 'Climate Cold (18°C-22°C)', status: 'Rented', color: 'blue', tenant: 'Công ty Mỹ Phẩm Nature Skin', contract: 'HD-2025-2234', due: '20/11/2026', battery: '92%', smartlock: 'SL-C204', lastAccess: 'Hôm qua 14:00' },
  { id: 'C-205', floorLevel: 'Floor 2', size: '12.0 m²', type: 'Climate Cold (18°C-22°C)', status: 'Rented', color: 'blue', tenant: 'Xưởng Đồ Da Thủ Công Hermes', contract: 'HD-2024-7719', due: '05/10/2026', battery: '94%', smartlock: 'SL-C205', lastAccess: '3 ngày trước' },
  { id: 'C-206', floorLevel: 'Floor 2', size: '12.0 m²', type: 'Climate Cold (18°C-22°C)', status: 'Maintenance', color: 'red', tenant: 'BẢO TRÌ BƠM LẠNH CHILLER #2', contract: 'TICKET-CH-102', due: 'Dự kiến 18:00', battery: 'Cắt nguồn', smartlock: 'SL-C206 [BẢO TRÌ]', lastAccess: 'Kỹ thuật HVAC' },
  { id: 'C-207', floorLevel: 'Floor 2', size: '12.0 m²', type: 'Climate Cold (18°C-22°C)', status: 'Rented', color: 'blue', tenant: 'Dược Phẩm Sinh Học Meditech', contract: 'HD-2024-9988', due: '25/09/2026', battery: '97%', smartlock: 'SL-C207', lastAccess: 'Hôm nay 08:45' },
  { id: 'C-208', floorLevel: 'Floor 2', size: '12.0 m²', type: 'Climate Cold (18°C-22°C)', status: 'Available', color: 'emerald', tenant: 'Chưa có khách', contract: 'Trống', due: '--', battery: '96%', smartlock: 'SL-C208', lastAccess: 'Chưa ghi nhận' },
  { id: 'C-209', floorLevel: 'Floor 2', size: '12.0 m²', type: 'Climate Cold (18°C-22°C)', status: 'Pending', color: 'amber', tenant: 'Công ty Tranh Nghệ Thuật Canvas', contract: 'HD-2026-0012', due: 'Hẹn check-in 15:30', battery: '100%', smartlock: 'SL-C209', lastAccess: 'Chờ giao' },
  { id: 'C-210', floorLevel: 'Floor 2', size: '12.0 m²', type: 'Climate Cold (18°C-22°C)', status: 'Rented', color: 'blue', tenant: 'Bộ Sưu Tập Đồng Hồ Luxury Vintage', contract: 'HD-2024-5501', due: '14/10/2026', battery: '93%', smartlock: 'SL-C210', lastAccess: 'Hôm qua 16:30' },
  { id: 'C-211', floorLevel: 'Floor 2', size: '12.0 m²', type: 'Climate Cold (18°C-22°C)', status: 'Rented', color: 'blue', tenant: 'Kho Thiết Bị Ống Kính Máy Ảnh Cine', contract: 'HD-2025-4490', due: '30/11/2026', battery: '91%', smartlock: 'SL-C211', lastAccess: 'Hôm nay 10:15' },
  { id: 'C-212', floorLevel: 'Floor 2', size: '12.0 m²', type: 'Climate Cold (18°C-22°C)', status: 'Available', color: 'emerald', tenant: 'Chưa có khách', contract: 'Trống', due: '--', battery: '97%', smartlock: 'SL-C212', lastAccess: 'Chưa ghi nhận' },
  { id: 'C-213', floorLevel: 'Floor 2', size: '12.0 m²', type: 'Climate Cold (18°C-22°C)', status: 'Rented', color: 'blue', tenant: 'Kho Dược Phẩm Thảo Dược Đông Y', contract: 'HD-2024-3321', due: '12/12/2026', battery: '96%', smartlock: 'SL-C213', lastAccess: '4 ngày trước' },
  { id: 'C-214', floorLevel: 'Floor 2', size: '12.0 m²', type: 'Climate Cold (18°C-22°C)', status: 'Rented', color: 'blue', tenant: 'Kho Linh Kiện Vi Điện Tử Bán Dẫn', contract: 'HD-2024-8844', due: '01/01/2027', battery: '98%', smartlock: 'SL-C214', lastAccess: 'Hôm nay 07:50' },
  { id: 'C-215', floorLevel: 'Floor 2', size: '12.0 m²', type: 'Climate Cold (18°C-22°C)', status: 'Rented', color: 'blue', tenant: 'Studio Thu Âm Âm Thanh Analog', contract: 'HD-2024-1199', due: '18/08/2026', battery: '89%', smartlock: 'SL-C215', lastAccess: '5 ngày trước' },
  { id: 'C-216', floorLevel: 'Floor 2', size: '12.0 m²', type: 'Climate Cold (18°C-22°C)', status: 'Available', color: 'emerald', tenant: 'Chưa có khách', contract: 'Trống', due: '--', battery: '99%', smartlock: 'SL-C216', lastAccess: 'Chưa ghi nhận' },
]

export const ManagerDashboard: React.FC = () => {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('')
  const [units, setUnits] = useState<InspectedUnit[]>(INITIAL_UNITS)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSampleUnitData, setIsSampleUnitData] = useState(true)
  const [debtReport, setDebtReport] = useState<OverdueDebtReport | null>(null)
  const [isDebtReportLoading, setIsDebtReportLoading] = useState(true)
  const [debtReportError, setDebtReportError] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [selectedFloor, setSelectedFloor] = useState<'floor1' | 'floor2'>('floor1')
  const [sizeFilter, setSizeFilter] = useState<'all' | 's' | 'm' | 'l'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'Available' | 'Rented' | 'Pending' | 'Overdue' | 'Maintenance'>('all')
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUnit, setSelectedUnit] = useState<InspectedUnit>(INITIAL_UNITS[0])
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null)
  useEffect(() => {
    loadInitialData()
  }, [])

  const loadDebtReport = async (facilityId?: string) => {
    setIsDebtReportLoading(true)
    setDebtReportError(false)
    try {
      const report = await reportService.getOverdueDebtReport(facilityId ? { facilityId } : undefined)
      setDebtReport(report || null)
    } catch {
      setDebtReport(null)
      setDebtReportError(true)
    } finally {
      setIsDebtReportLoading(false)
    }
  }

  const loadInitialData = async () => {
    try {
      const facRes = await facilityService.getFacilities()
      if (facRes?.content && facRes.content.length > 0) {
        setFacilities(facRes.content)
        const defaultFac = facRes.content.find(f => f.code === 'HCM-D1') || facRes.content[0]
        setSelectedFacilityId(defaultFac.id)
        await Promise.all([fetchUnits(defaultFac.id), loadDebtReport(defaultFac.id)])
      } else {
        await Promise.all([fetchUnits(), loadDebtReport()])
      }
    } catch {
      await Promise.all([fetchUnits(), loadDebtReport()])
    }
  }

  const handleFacilityChange = async (facId: string) => {
    setSelectedFacilityId(facId)
    await Promise.all([fetchUnits(facId), loadDebtReport(facId)])
  }

  const fetchUnits = async (facId?: string) => {
    setIsLoading(true)
    try {
      const targetId = facId || selectedFacilityId || undefined
      const res = await storageUnitService.getUnits(targetId ? { facilityId: targetId } : undefined)
      if (res && Array.isArray(res) && res.length > 0) {
        setIsSampleUnitData(false)
        const mapped: InspectedUnit[] = res.map((su: StorageUnit) => {
          const isAvail = su.status === 'AVAILABLE'
          const isOcc = su.status === 'OCCUPIED'
          const isMaint = su.status === 'UNDER_MAINTENANCE' || su.status === 'MAINTENANCE'
          const isRes = su.status === 'RESERVED'

          let status: InspectedUnit['status'] = 'Available'
          let color: InspectedUnit['color'] = 'emerald'
          if (isOcc) {
            status = 'Rented'
            color = 'blue'
          } else if (isMaint) {
            status = 'Maintenance'
            color = 'red'
          } else if (isRes) {
            status = 'Pending'
            color = 'amber'
          }

          return {
            id: su.unitCode,
            backendId: su.id,
            size: su.areaSqMeters ? `${su.areaSqMeters.toFixed(1)} m²` : '—',
            type: su.unitTypeName || 'Chưa có dữ liệu',
            status,
            rawStatus: su.status,
            color,
            tenant: su.tenantName || (isAvail ? 'Chưa có khách' : 'Chưa có dữ liệu'),
            contract: su.contractCode || '—',
            due: su.dueDate || '—',
            battery: su.batteryLevel || '—',
            smartlock: su.smartLockSerial || '—',
            lastAccess: su.lastAccessTime || '—',
            floorLevel: su.floorLevel || 'Floor 1',
            pricePerMonth: su.pricePerMonth,
            facilityId: su.facilityId,
            facilityName: su.facilityName
          }
        })
        setUnits(mapped)
        setSelectedUnit(prev => mapped.find(u => u.id === prev?.id) || mapped[0])
      } else {
        setIsSampleUnitData(true)
        setUnits(INITIAL_UNITS)
        setSelectedUnit(INITIAL_UNITS[0])
      }
    } catch {
      // Keep INITIAL_UNITS fallback on network or offline state
      setIsSampleUnitData(true)
      setUnits(INITIAL_UNITS)
      setSelectedUnit(INITIAL_UNITS[0])
    } finally {
      setIsLoading(false)
      setLastUpdatedAt(new Date())
    }
  }

  const handleInspect = (unit: InspectedUnit) => {
    setSelectedUnit(unit)
  }

  const triggerAction = (msg: string) => {
    setActionSuccessMessage(msg)
    setTimeout(() => setActionSuccessMessage(null), 3000)
  }

  const formatCurrency = (amount?: number) => `${(amount ?? 0).toLocaleString('vi-VN')} ₫`

  const handleToggleMaintenance = async () => {
    if (!selectedUnit) return
    if (!selectedUnit.backendId) {
      triggerAction(`Kho #${selectedUnit.id} đang hiển thị dữ liệu minh họa. Trạng thái chưa được thay đổi.`)
      return
    }
    try {
      {
        const updated = await storageUnitService.toggleMaintenance(selectedUnit.backendId)
        const isNowMaint = updated.status === 'UNDER_MAINTENANCE' || updated.status === 'MAINTENANCE'
        const nextStatus: InspectedUnit['status'] = isNowMaint ? 'Maintenance' : 'Available'
        const nextColor: InspectedUnit['color'] = isNowMaint ? 'red' : 'emerald'

        setUnits(prev => prev.map(u => {
          if (u.id === selectedUnit.id) {
            return {
              ...u,
              status: nextStatus,
              rawStatus: updated.status,
              color: nextColor,
              tenant: isNowMaint ? 'ĐANG BẢO TRÌ SỬA CHỮA' : 'Chưa có khách',
              contract: isNowMaint ? 'TICKET-MAINTENANCE' : 'Trống',
              due: isNowMaint ? 'Dự kiến hôm nay' : '--'
            }
          }
          return u
        }))
        setSelectedUnit(prev => ({
          ...prev,
          status: nextStatus,
          rawStatus: updated.status,
          color: nextColor,
          tenant: isNowMaint ? 'ĐANG BẢO TRÌ SỬA CHỮA' : 'Chưa có khách',
          contract: isNowMaint ? 'TICKET-MAINTENANCE' : 'Trống',
          due: isNowMaint ? 'Dự kiến hôm nay' : '--'
        }))

        triggerAction(`Đã cập nhật trạng thái kho #${selectedUnit.id} thành ${isNowMaint ? 'Bảo trì' : 'Sẵn sàng'} qua StorageUnit API!`)
      }
    } catch (err: any) {
      triggerAction(`Không thể đổi trạng thái: ${err?.response?.data?.message || 'Kho đang có người thuê hoặc lỗi hệ thống'}`)
    }
  }

  const filteredUnits = units.filter(u => {
    // Search query filter
    const matchesSearch = u.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.tenant.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.contract.toLowerCase().includes(searchQuery.toLowerCase())
    
    // Size filter
    let matchesSize = true
    const sizeNum = parseFloat(u.size)
    if (!isNaN(sizeNum)) {
      if (sizeFilter === 's') matchesSize = sizeNum <= 6.5
      else if (sizeFilter === 'm') matchesSize = sizeNum > 6.5 && sizeNum <= 12
      else if (sizeFilter === 'l') matchesSize = sizeNum > 12
    }

    // Status filter
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter

    return matchesSearch && matchesSize && matchesStatus
  })

  // Floor splitting
  const floor1Units = filteredUnits.filter(u => u.floorLevel === 'Floor 1' || (!u.floorLevel?.includes('2') && !u.id.startsWith('C-')))
  const floor2Units = filteredUnits.filter(u => u.floorLevel === 'Floor 2' || u.id.startsWith('C-'))

  const zoneAUnits = floor1Units.filter(u => u.id.startsWith('A-'))
  const zoneBUnits = floor1Units.filter(u => u.id.startsWith('B-') || (!u.id.startsWith('A-') && !u.id.startsWith('C-')))
  const zoneCUnits = floor2Units

  // Dynamic KPI counts
  const totalUnitsCount = units.length
  const rentedUnitsCount = units.filter(u => u.status === 'Rented').length
  const availableUnitsCount = units.filter(u => u.status === 'Available').length
  const maintenanceUnitsCount = units.filter(u => u.status === 'Maintenance').length
  const overdueUnitsCount = units.filter(u => u.status === 'Overdue').length
  const pendingUnitsCount = units.filter(u => u.status === 'Pending').length

  const rentedPercent = totalUnitsCount > 0 ? ((rentedUnitsCount / totalUnitsCount) * 100).toFixed(1) : '0.0'
  const availablePercent = totalUnitsCount > 0 ? ((availableUnitsCount / totalUnitsCount) * 100).toFixed(1) : '0.0'
  const maintenancePercent = totalUnitsCount > 0 ? ((maintenanceUnitsCount / totalUnitsCount) * 100).toFixed(1) : '0.0'
  const overduePercent = totalUnitsCount > 0 ? ((overdueUnitsCount / totalUnitsCount) * 100).toFixed(1) : '0.0'

  const currentFacilityName = facilities.find(f => f.id === selectedFacilityId)?.name || 'Cơ sở quản lý'

  const getStatusBadgeStyle = (status: InspectedUnit['status']) => {
    switch (status) {
      case 'Available': return 'bg-emerald-100 text-emerald-800 border-emerald-300'
      case 'Rented': return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'Pending': return 'bg-amber-100 text-amber-900 border-amber-300'
      case 'Overdue': return 'bg-rose-100 text-rose-900 border-rose-300'
      case 'Maintenance': return 'bg-red-100 text-red-800 border-red-300'
    }
  }

  const getUnitCardBorder = (unit: InspectedUnit) => {
    const isSelected = selectedUnit?.id === unit.id ? 'ring-2 ring-slate-900 shadow-md scale-[1.02] z-10' : 'hover:-translate-y-0.5 hover:shadow-xs'
    switch (unit.color) {
      case 'emerald': return `border-t-4 border-t-emerald-500 hover:bg-emerald-50/60 ${isSelected}`
      case 'blue': return `border-t-4 border-t-blue-600 hover:bg-blue-50/60 ${isSelected}`
      case 'amber': return `border-t-4 border-t-amber-500 hover:bg-amber-50/70 ${isSelected}`
      case 'purple': return `border-t-4 border-t-rose-600 hover:bg-rose-50/70 ${isSelected}`
      case 'red': return `border-t-4 border-t-red-500 hover:bg-red-50/70 ${isSelected}`
    }
  }

  const getUnitHeatmapInfo = () => ({
    label: 'Lượt/tuần: —',
    badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200',
  })

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Action Notification Toast */}
      {actionSuccessMessage && (
        <div className="fixed top-24 right-8 z-50 flex items-center gap-2 px-4 py-3 bg-neutral-900 text-white rounded-lg shadow-xl border border-neutral-700 animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-cyan-400 text-[20px]">info</span>
          <span className="text-xs font-semibold">{actionSuccessMessage}</span>
        </div>
      )}

      {/* TOP CONTEXT & OCCUPANCY METRIC STRIP */}
      <section className="flex flex-col lg:flex-row items-stretch justify-between gap-4 p-6 bg-white rounded-xl shadow-sm relative overflow-hidden border border-slate-200">
        <div className="flex flex-col gap-2 max-w-2xl z-10">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-semibold ${isSampleUnitData ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isSampleUnitData ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
              {isLoading ? 'Đang tải dữ liệu' : isSampleUnitData ? 'Dữ liệu minh họa' : 'Dữ liệu từ hệ thống'}
            </span>
            {lastUpdatedAt && (
              <span className="text-xs text-slate-500 font-medium">
                Cập nhật lúc {lastUpdatedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {currentFacilityName} ({totalUnitsCount} Kho tự quản)
            </h1>
            {facilities.length > 1 && (
              <select
                value={selectedFacilityId}
                onChange={(e) => handleFacilityChange(e.target.value)}
                className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-300 focus:outline-none cursor-pointer"
              >
                {facilities.map(f => (
                  <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                ))}
              </select>
            )}
          </div>

          <p className="text-sm text-slate-600">
            Theo dõi tình trạng kho, công suất sử dụng và thiết bị tại cơ sở.
          </p>
        </div>

        {/* Quick action & Facility Switcher */}
        <div className="flex items-center gap-3 self-start lg:self-center shrink-0 z-10 flex-wrap">
          <button 
            type="button" 
            onClick={() => fetchUnits(selectedFacilityId)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-slate-100 text-slate-800 font-semibold text-xs hover:bg-slate-200 transition-all border border-slate-200 cursor-pointer shadow-2xs"
            title="Tải lại danh sách phòng kho mới nhất từ hệ thống"
          >
            <span className={`material-symbols-outlined text-[18px] text-cyan-700 ${isLoading ? 'animate-spin' : ''}`}>sync</span>
            <span>{isLoading ? 'Đang tải...' : 'Làm mới dữ liệu'}</span>
          </button>
          <button 
            type="button" 
            disabled
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-slate-50 text-slate-500 font-medium text-xs border border-slate-200 cursor-not-allowed shadow-2xs"
            title="Tích hợp dữ liệu IoT chưa khả dụng"
          >
            <span className="material-symbols-outlined text-[18px]">sensors</span>
            <span>IoT chưa kết nối</span>
          </button>
          <button 
            type="button" 
            disabled
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-slate-50 text-slate-500 font-medium text-xs border border-slate-200 cursor-not-allowed shadow-2xs"
            title="Chức năng khảo sát chưa được kết nối với hệ thống"
          >
            <span className="material-symbols-outlined text-[18px]">assignment_add</span>
            <span>Khảo sát chưa kết nối</span>
          </button>
        </div>

        {/* Decorative background blueprint grid */}
        <div className="absolute right-0 top-0 bottom-0 w-96 opacity-5 pointer-events-none hidden md:block">
          <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern height="24" id="facility-blueprint" patternUnits="userSpaceOnUse" width="24">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="1"></path>
              </pattern>
            </defs>
            <rect fill="url(#facility-blueprint)" height="100%" width="100%"></rect>
          </svg>
        </div>
      </section>

      {/* 5 CRITICAL DYNAMIC KPI TILES */}
      <section className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 lg:gap-4">
        {/* Tile 1: Total Units */}
        <div 
          onClick={() => setStatusFilter('all')}
          className={`p-4 bg-white rounded-xl border flex flex-col justify-between hover:shadow-md transition-all duration-150 cursor-pointer ${
            statusFilter === 'all' 
              ? 'border-slate-800 ring-2 ring-slate-900/10 shadow-xs' 
              : 'border-slate-200 shadow-2xs hover:border-slate-300'
          }`}
          title="Bấm để hiển thị toàn bộ phòng kho"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-slate-500">Tổng số kho</span>
            <span className="material-symbols-outlined text-slate-400 text-[20px]">warehouse</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-slate-900 leading-none">{totalUnitsCount}</span>
            <span className="text-xs text-slate-500 font-medium">kho đơn vị</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-slate-900 h-full rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>

        {/* Tile 2: Rented */}
        <div 
          onClick={() => setStatusFilter(prev => prev === 'Rented' ? 'all' : 'Rented')}
          className={`p-4 bg-white rounded-xl border flex flex-col justify-between hover:shadow-md transition-all duration-150 cursor-pointer ${
            statusFilter === 'Rented' 
              ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-xs bg-blue-50/20' 
              : 'border-slate-200 shadow-2xs hover:border-slate-300'
          }`}
          title="Bấm để lọc chỉ các kho đang cho thuê"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-slate-500">Đang thuê hoạt động</span>
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono tabular-nums text-xs font-bold">{rentedPercent}%</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-slate-900 leading-none">{rentedUnitsCount}</span>
            <span className="text-xs text-slate-500 font-medium">/ {totalUnitsCount} kho</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${rentedPercent}%` }}></div>
          </div>
        </div>

        {/* Tile 3: Available */}
        <div 
          onClick={() => setStatusFilter(prev => prev === 'Available' ? 'all' : 'Available')}
          className={`p-4 bg-white rounded-xl border flex flex-col justify-between hover:shadow-md transition-all duration-150 cursor-pointer ${
            statusFilter === 'Available' 
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs bg-emerald-50/20' 
              : 'border-slate-200 shadow-2xs hover:border-slate-300'
          }`}
          title="Bấm để lọc chỉ các kho trống sẵn sàng"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-slate-500">Kho trống sẵn sàng</span>
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-emerald-600 leading-none">{availableUnitsCount}</span>
            <span className="text-xs text-slate-500 font-medium">kho nhận ngay</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${availablePercent}%` }}></div>
          </div>
        </div>

        {/* Tile 4: Maintenance */}
        <div 
          onClick={() => setStatusFilter(prev => prev === 'Maintenance' ? 'all' : 'Maintenance')}
          className={`p-4 bg-white rounded-xl border flex flex-col justify-between hover:shadow-md transition-all duration-150 cursor-pointer ${
            statusFilter === 'Maintenance' 
              ? 'border-rose-500 ring-2 ring-rose-500/20 shadow-xs bg-rose-50/20' 
              : 'border-slate-200 shadow-2xs hover:border-slate-300'
          }`}
          title="Bấm để lọc các kho đang bảo trì"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-slate-500">Đang bảo trì kỹ thuật</span>
            <span className="material-symbols-outlined text-rose-500 text-[18px]">build_circle</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-rose-600 leading-none">
              {maintenanceUnitsCount < 10 ? `0${maintenanceUnitsCount}` : maintenanceUnitsCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">kho ngưng dùng</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-rose-500 h-full rounded-full" style={{ width: `${maintenancePercent}%` }}></div>
          </div>
        </div>

        {/* Tile 5: Overdue */}
        <div 
          onClick={() => setStatusFilter(prev => prev === 'Overdue' ? 'all' : 'Overdue')}
          className={`p-4 bg-white rounded-xl border flex flex-col justify-between hover:shadow-md transition-all duration-150 cursor-pointer ${
            statusFilter === 'Overdue' 
              ? 'border-rose-500 ring-2 ring-rose-500/20 shadow-xs bg-rose-50/20' 
              : 'border-slate-200 shadow-2xs hover:border-slate-300'
          }`}
          title="Bấm để lọc các kho nợ cước quá hạn"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-slate-500">Quá hạn thanh toán</span>
            <span className="material-symbols-outlined text-rose-600 text-[18px]">lock_clock</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-rose-700 leading-none">
              {overdueUnitsCount < 10 ? `0${overdueUnitsCount}` : overdueUnitsCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">khóa điện tử tạm</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-rose-600 h-full rounded-full" style={{ width: `${overduePercent}%` }}></div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE FLOOR GRID MAP & CONTEXTUAL SLIDE DRAWER CONTAINER */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT & CENTER: FLOOR MATRIX CANVAS (xl:col-span-8) */}
        <div className="xl:col-span-8 flex flex-col gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          {/* Controls Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
            {/* Floor Selector Tabs */}
            <div className="inline-flex p-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
              <button 
                type="button" 
                onClick={() => setSelectedFloor('floor1')}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                  selectedFloor === 'floor1' 
                    ? 'bg-slate-900 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>Tầng 1 (Khu A &amp; B)</span>
                <span className={`px-1.5 py-0.2 rounded font-mono tabular-nums text-[11px] font-bold ${
                  selectedFloor === 'floor1' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                }`}>
                  {floor1Units.length}
                </span>
              </button>
              <button 
                type="button" 
                onClick={() => setSelectedFloor('floor2')}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                  selectedFloor === 'floor2' 
                    ? 'bg-slate-900 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>Tầng 2 (Khu C Kho Lạnh)</span>
                <span className={`px-1.5 py-0.2 rounded font-mono tabular-nums text-[11px] font-bold ${
                  selectedFloor === 'floor2' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                }`}>
                  {floor2Units.length}
                </span>
              </button>
            </div>

            {/* Filter and Search Matrix */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Heatmap Mode Toggle */}
              <button
                type="button"
                onClick={() => setShowHeatmap(prev => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  showHeatmap 
                    ? 'bg-amber-500 text-amber-950 border-amber-600 shadow-xs ring-2 ring-amber-400/40 font-bold' 
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-2xs'
                }`}
                title="Bật/Tắt thông tin lưu lượng ra vào kho"
              >
                <span className="material-symbols-outlined text-[16px]">{showHeatmap ? 'local_fire_department' : 'radar'}</span>
                <span>Bản đồ nhiệt ({showHeatmap ? 'Bật' : 'Tắt'})</span>
              </button>

              <select 
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-white rounded-lg text-slate-800 text-xs border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400 shadow-2xs font-medium cursor-pointer"
              >
                <option value="all">Tất cả kích thước</option>
                <option value="s">Kho nhỏ S (≤ 6.5m²)</option>
                <option value="m">Kho vừa M (8m² - 12m²)</option>
                <option value="l">Kho lớn L (15m² - 20m²)</option>
              </select>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">filter_alt</span>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm mã kho (#A-101), khách thuê, HĐ..." 
                  className="pl-8 pr-3 py-1.5 bg-white text-slate-800 text-xs rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 border border-slate-200 shadow-2xs w-48 sm:w-60 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Dynamic Color Legend Bar */}
          <div className="flex items-center flex-wrap gap-2 px-3 py-2 bg-slate-50/80 rounded-xl border border-slate-200 text-xs font-medium">
            <button 
              type="button" 
              onClick={() => setStatusFilter(prev => prev === 'Available' ? 'all' : 'Available')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition-all ${
                statusFilter === 'Available' 
                  ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500/30 text-emerald-950 font-bold shadow-xs' 
                  : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700 shadow-2xs'
              }`}
              title="Nhấp để lọc chỉ hiển thị các kho trống"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Kho trống</span>
              <span className="font-mono tabular-nums font-bold text-slate-900 ml-0.5">({availableUnitsCount})</span>
            </button>
            <button 
              type="button" 
              onClick={() => setStatusFilter(prev => prev === 'Rented' ? 'all' : 'Rented')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition-all ${
                statusFilter === 'Rented' 
                  ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/30 text-blue-950 font-bold shadow-xs' 
                  : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700 shadow-2xs'
              }`}
              title="Nhấp để lọc chỉ hiển thị các kho đang cho thuê"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <span>Đang thuê</span>
              <span className="font-mono tabular-nums font-bold text-slate-900 ml-0.5">({rentedUnitsCount})</span>
            </button>
            <button 
              type="button" 
              onClick={() => setStatusFilter(prev => prev === 'Pending' ? 'all' : 'Pending')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition-all ${
                statusFilter === 'Pending' 
                  ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-500/30 text-amber-950 font-bold shadow-xs' 
                  : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700 shadow-2xs'
              }`}
              title="Nhấp để lọc chỉ hiển thị các kho chờ bàn giao"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Chờ bàn giao</span>
              <span className="font-mono tabular-nums font-bold text-slate-900 ml-0.5">({pendingUnitsCount})</span>
            </button>
            <button 
              type="button" 
              onClick={() => setStatusFilter(prev => prev === 'Overdue' ? 'all' : 'Overdue')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition-all ${
                statusFilter === 'Overdue' 
                  ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-500/30 text-rose-950 font-bold shadow-xs' 
                  : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700 shadow-2xs'
              }`}
              title="Nhấp để lọc chỉ hiển thị các kho nợ cước quá hạn"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
              <span>Quá hạn nợ</span>
              <span className="font-mono tabular-nums font-bold text-slate-900 ml-0.5">({overdueUnitsCount})</span>
            </button>
            <button 
              type="button" 
              onClick={() => setStatusFilter(prev => prev === 'Maintenance' ? 'all' : 'Maintenance')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition-all ${
                statusFilter === 'Maintenance' 
                  ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-500/30 text-rose-950 font-bold shadow-xs' 
                  : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700 shadow-2xs'
              }`}
              title="Nhấp để lọc các kho đang bảo trì kỹ thuật"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span>Bảo trì kỹ thuật</span>
              <span className="font-mono tabular-nums font-bold text-slate-900 ml-0.5">({maintenanceUnitsCount})</span>
            </button>

            {statusFilter !== 'all' && (
              <button 
                type="button" 
                onClick={() => setStatusFilter('all')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 text-white text-[11px] font-semibold hover:bg-neutral-800 transition-all cursor-pointer shadow-xs ml-auto"
                title="Bỏ lọc trạng thái và hiển thị lại toàn bộ kho"
              >
                <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
                <span>Bỏ lọc trạng thái</span>
              </button>
            )}
          </div>

          {/* VISUAL MATRIX: WAREHOUSE CORRIDOR LAYOUT */}
          <div className="relative bg-slate-100 p-4 rounded-xl border border-slate-200 overflow-x-auto">
            {/* Physical Corridor Blueprint Overlay */}
            <div className="flex items-center justify-between px-3.5 py-2 mb-3 bg-white rounded-lg font-mono text-[11px] text-slate-600 uppercase tracking-wider border border-slate-200 shadow-2xs">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-slate-500">meeting_room</span> 
                {selectedFloor === 'floor1' ? 'Mặt bằng minh họa · Tầng 1' : 'Mặt bằng minh họa · Tầng 2'}
              </span>
              <span className="font-semibold text-slate-800 flex items-center gap-2">
                <span>Sơ đồ chưa liên kết bản vẽ cơ sở</span>
                {showHeatmap && (
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-300">
                    Chưa có dữ liệu lượt ra/vào
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-slate-400">info</span>
                Vị trí lối thoát hiểm chưa có dữ liệu
              </span>
            </div>

            {selectedFloor === 'floor2' ? (
              /* ZONE C GRID (FLOOR 2) */
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-cyan-900 uppercase flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-cyan-600 text-[18px]">ac_unit</span>
                      Phân khu C (sơ đồ minh họa)
                    </span>
                    {showHeatmap && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 text-[10px] font-mono font-semibold border border-blue-200 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">footprint</span>
                        Chưa có dữ liệu lượt ra/vào
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500">16 kho bảo quản đồ da, rượu vang &amp; vi điện tử nhạy nhiệt độ</span>
                </div>
                {zoneCUnits.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs bg-white rounded-lg border border-slate-200">
                    Không tìm thấy kho phù hợp bộ lọc trên Tầng 2
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {zoneCUnits.map(unit => (
                      <button 
                        key={unit.id}
                        type="button" 
                        onClick={() => handleInspect(unit)}
                        className={`flex flex-col p-2 rounded-lg text-left bg-white transition-all group relative border border-slate-200 cursor-pointer ${getUnitCardBorder(unit)}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-slate-900">#{unit.id}</span>
                          <span className="material-symbols-outlined text-cyan-500 text-[13px]" title="Kho thuộc phân khu C">warehouse</span>
                        </div>
                        <span className="text-[11px] text-slate-500">{unit.size}</span>
                        <span className={`mt-1 text-[10px] font-bold flex items-center gap-1 ${
                          unit.status === 'Available' ? 'text-emerald-700' :
                          unit.status === 'Rented' ? 'text-blue-700' :
                          unit.status === 'Pending' ? 'text-amber-700' :
                          unit.status === 'Overdue' ? 'text-rose-700' : 'text-rose-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            unit.color === 'emerald' ? 'bg-emerald-500' :
                            unit.color === 'blue' ? 'bg-blue-600' :
                            unit.color === 'amber' ? 'bg-amber-500' :
                            unit.color === 'purple' ? 'bg-rose-600' : 'bg-rose-500'
                          }`}></span>
                          {unit.status === 'Available' ? 'Trống' :
                           unit.status === 'Rented' ? 'Thuê' :
                           unit.status === 'Pending' ? 'Chờ giao' :
                           unit.status === 'Overdue' ? 'Quá hạn' : 'Bảo trì'}
                        </span>
                        {showHeatmap && (
                          <span className={`mt-1 text-[9px] px-1 py-0.5 rounded font-mono flex items-center gap-0.5 ${getUnitHeatmapInfo().badgeClass}`}>
                            <span className="material-symbols-outlined text-[10px]">local_fire_department</span>
                            {getUnitHeatmapInfo().label}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* FLOOR 1: ZONE A & ZONE B */
              <>
                {/* ZONE A GRID */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 uppercase">
                        Phân khu A (Hành lang Aisle North)
                      </span>
                      {showHeatmap && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-900 text-[10px] font-mono font-semibold border border-rose-200 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">local_fire_department</span>
                          Chưa có dữ liệu lượt ra/vào
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500">Lô 16 kho mặt tiền cửa cuốn cơ &amp; điện tử</span>
                  </div>
                  {zoneAUnits.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs bg-white rounded-lg border border-slate-200">
                      Không tìm thấy kho phù hợp bộ lọc tại Phân khu A
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                      {zoneAUnits.map(unit => (
                        <button 
                          key={unit.id}
                          type="button" 
                          onClick={() => handleInspect(unit)}
                          className={`flex flex-col p-2 rounded-lg text-left bg-white transition-all group relative border border-slate-200 cursor-pointer ${getUnitCardBorder(unit)}`}
                        >
                          <span className="font-mono text-xs font-bold text-slate-900">#{unit.id}</span>
                          <span className="text-[11px] text-slate-500">{unit.size}</span>
                          <span className={`mt-1 text-[10px] font-bold flex items-center gap-1 ${
                            unit.status === 'Available' ? 'text-emerald-700' :
                            unit.status === 'Rented' ? 'text-blue-700' :
                            unit.status === 'Pending' ? 'text-amber-700' :
                            unit.status === 'Overdue' ? 'text-rose-700' : 'text-rose-700'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              unit.color === 'emerald' ? 'bg-emerald-500' :
                              unit.color === 'blue' ? 'bg-blue-600' :
                              unit.color === 'amber' ? 'bg-amber-500' :
                              unit.color === 'purple' ? 'bg-rose-600' : 'bg-rose-500'
                            }`}></span>
                            {unit.status === 'Available' ? 'Trống' :
                             unit.status === 'Rented' ? 'Thuê' :
                             unit.status === 'Pending' ? 'Chờ giao' :
                             unit.status === 'Overdue' ? 'Quá hạn' : 'Bảo trì'}
                          </span>
                          {showHeatmap && (
                            <span className={`mt-1 text-[9px] px-1 py-0.5 rounded font-mono flex items-center gap-0.5 ${getUnitHeatmapInfo().badgeClass}`}>
                              <span className="material-symbols-outlined text-[10px]">local_fire_department</span>
                              {getUnitHeatmapInfo().label}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* ZONE B GRID */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 uppercase">
                        Phân khu B (Hành lang Aisle South &amp; Giáp kho hàng xuất)
                      </span>
                      {showHeatmap && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-950 text-[10px] font-mono font-semibold border border-amber-200 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">footprint</span>
                          Chưa có dữ liệu lượt ra/vào
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500">Lô 16 kho trần cao 3.8 mét &amp; Pallet tải nặng</span>
                  </div>
                  {zoneBUnits.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs bg-white rounded-lg border border-slate-200">
                      Không tìm thấy kho phù hợp bộ lọc tại Phân khu B
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                      {zoneBUnits.map(unit => (
                        <button 
                          key={unit.id}
                          type="button" 
                          onClick={() => handleInspect(unit)}
                          className={`flex flex-col p-2 rounded-lg text-left bg-white transition-all group relative border border-slate-200 cursor-pointer ${getUnitCardBorder(unit)}`}
                        >
                          <span className="font-mono text-xs font-bold text-slate-900">#{unit.id}</span>
                          <span className="text-[11px] text-slate-500">{unit.size}</span>
                          <span className={`mt-1 text-[10px] font-bold flex items-center gap-1 ${
                            unit.status === 'Available' ? 'text-emerald-700' :
                            unit.status === 'Rented' ? 'text-blue-700' :
                            unit.status === 'Pending' ? 'text-amber-700' :
                            unit.status === 'Overdue' ? 'text-rose-700' : 'text-rose-700'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              unit.color === 'emerald' ? 'bg-emerald-500' :
                              unit.color === 'blue' ? 'bg-blue-600' :
                              unit.color === 'amber' ? 'bg-amber-500' :
                              unit.color === 'purple' ? 'bg-rose-600' : 'bg-rose-500'
                            }`}></span>
                            {unit.status === 'Available' ? 'Trống' :
                             unit.status === 'Rented' ? 'Thuê' :
                             unit.status === 'Pending' ? 'Chờ giao' :
                             unit.status === 'Overdue' ? 'Quá hạn' : 'Bảo trì'}
                          </span>
                          {showHeatmap && (
                            <span className={`mt-1 text-[9px] px-1 py-0.5 rounded font-mono flex items-center gap-0.5 ${getUnitHeatmapInfo().badgeClass}`}>
                              <span className="material-symbols-outlined text-[10px]">local_fire_department</span>
                              {getUnitHeatmapInfo().label}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Elevator & Loading Bay Corridor Footer */}
            <div className="mt-4 pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 font-medium">
                  <span className="material-symbols-outlined text-[16px] text-slate-600">elevator</span> 
                  Thông số hạ tầng chưa có dữ liệu
                </span>
                <span className="flex items-center gap-1 font-medium text-emerald-700">
                  <span className="material-symbols-outlined text-[16px]">sensors_off</span>
                  IoT chưa kết nối
                </span>
              </div>
              <span className="font-mono font-semibold text-slate-700">
                Số liệu diện tích chưa có trong hệ thống
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT: CONTEXTUAL INSPECTION SLIDE-DRAWER PANEL (xl:col-span-4) */}
        <div className="xl:col-span-4 flex flex-col gap-4 bg-white p-6 rounded-xl shadow-xs border border-slate-200 sticky top-20 max-h-[calc(100vh-5.5rem)] overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 text-slate-800">
                <span className="material-symbols-outlined text-[24px]">door_sliding</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Chi tiết kho giám sát</span>
                <h2 className="text-xl font-bold text-slate-900 font-mono">#{selectedUnit.id}</h2>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full font-mono text-xs font-bold border ${getStatusBadgeStyle(selectedUnit.status)}`}>
              {selectedUnit.status === 'Available' ? 'Kho trống' :
               selectedUnit.status === 'Rented' ? 'Đang thuê' :
               selectedUnit.status === 'Pending' ? 'Chờ bàn giao' :
               selectedUnit.status === 'Overdue' ? 'Quá hạn nợ' : 'Đang bảo trì'}
            </span>
          </div>

          {/* Illustrative image; live camera feed is not currently connected. */}
          <div className="relative w-full h-44 rounded-lg overflow-hidden bg-slate-900 border border-slate-200 shadow-inner">
            <img 
              className="w-full h-full object-cover" 
              src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80" 
              alt={`Storage Bay ${selectedUnit.id}`}
            />
            <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-slate-900/85 backdrop-blur-sm rounded text-white font-mono text-[11px] flex items-center gap-1.5 shadow-sm">
              <span className="material-symbols-outlined text-[14px] text-slate-300">image</span>
              Ảnh minh họa · camera chưa kết nối
            </div>
          </div>

          {/* Unit Spec Table */}
          <div className="flex flex-col gap-1.5 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between py-1 text-xs border-b border-slate-200/50">
              <span className="text-slate-500">Diện tích kho:</span>
              <span className="font-mono font-bold text-slate-900">{selectedUnit.size}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-xs border-b border-slate-200/50">
              <span className="text-slate-500">Quy chuẩn kho:</span>
              <span className="font-medium text-slate-800">{selectedUnit.type}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-xs border-b border-slate-200/50">
              <span className="text-slate-500">Khách thuê hiện tại:</span>
              <span className="font-semibold text-slate-900 text-right">{selectedUnit.tenant}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-xs border-b border-slate-200/50">
              <span className="text-slate-500">Mã hợp đồng điện tử:</span>
              <span className="font-mono font-bold text-orange-600">{selectedUnit.contract}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-xs">
              <span className="text-slate-500">Thời hạn thuê:</span>
              <span className="font-mono font-semibold text-slate-800">{selectedUnit.due}</span>
            </div>
          </div>

          {/* Smart Lock & IoT Telemetry */}
          <div className="flex flex-col gap-2 bg-slate-100 p-3.5 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-orange-600">lock</span>
                <span className="text-xs font-bold text-slate-800">Smart Lock IoT Seri</span>
              </div>
              <span className="font-mono text-xs font-bold text-slate-900">{selectedUnit.smartlock}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="flex flex-col p-2 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Pin SmartLock</span>
                <span className="font-mono text-xs font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-[16px] text-slate-500">battery_unknown</span>
                  {selectedUnit.battery}
                </span>
              </div>
              <div className="flex flex-col p-2 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Truy cập gần nhất</span>
                <span className="font-mono text-[11px] font-bold text-slate-800 mt-0.5">{selectedUnit.lastAccess}</span>
              </div>
            </div>
          </div>

          {/* Available operations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleToggleMaintenance}
              disabled={!selectedUnit.backendId}
              className={`py-2 px-3 rounded-lg font-medium text-xs flex items-center justify-center gap-1 border transition-all ${selectedUnit.backendId ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} ${selectedUnit.status === 'Maintenance' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200' : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200'}`}
              title={selectedUnit.backendId ? 'Cập nhật trạng thái kho qua API' : 'Không thể cập nhật dữ liệu minh họa'}
            >
              <span className="material-symbols-outlined text-[16px]">build</span>
              <span>{selectedUnit.backendId ? (selectedUnit.status === 'Maintenance' ? 'Mở lại kho' : 'Chuyển bảo trì') : 'Dữ liệu mẫu · chỉ xem'}</span>
            </button>
            <button
              type="button"
              disabled
              title="Lịch sử truy cập chưa được kết nối với hệ thống"
              className="py-2 px-3 rounded-lg bg-slate-50 text-slate-500 font-medium text-xs flex items-center justify-center gap-1 border border-slate-200 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[16px]">history</span>
              <span>Lịch sử chưa kết nối</span>
            </button>
          </div>        </div>
      </section>

      {/* BOTTOM SECTION: LIVE DEBT SUMMARY & STAFF WORKFORCE */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 flex flex-col gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-100 text-rose-900">
                <span className="material-symbols-outlined text-[22px]">warning</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Tổng quan công nợ quá hạn</h3>
                <p className="text-xs text-slate-500">Số liệu theo cơ sở đang chọn</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-900 font-mono text-xs font-bold border border-rose-200">
              {isDebtReportLoading ? 'Đang tải…' : debtReportError ? 'Không tải được' : `${debtReport?.totalOverdueCount ?? 0} hợp đồng`}
            </span>
          </div>

          {isDebtReportLoading ? (
            <div className="grid grid-cols-2 gap-3 animate-pulse" aria-label="Đang tải báo cáo công nợ">
              {[0, 1, 2, 3].map(item => <div key={item} className="h-20 rounded-xl bg-slate-100" />)}
            </div>
          ) : debtReportError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-amber-900">Không tải được báo cáo công nợ. Thử tải lại để xem số liệu mới nhất.</p>
              <button type="button" onClick={() => loadDebtReport(selectedFacilityId || undefined)} className="shrink-0 px-3 py-2 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-semibold hover:bg-amber-100">Tải lại</button>
            </div>
          ) : debtReport ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4">
                  <p className="text-xs font-medium text-rose-800">Hợp đồng quá hạn</p>
                  <p className="mt-1 text-2xl font-bold text-rose-950">{debtReport.totalOverdueCount}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-600">Tổng công nợ</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(debtReport.totalDebtAmount)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-medium text-slate-600">Tiền thuê chưa thu</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(debtReport.totalUnpaidRent)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-medium text-slate-600">Phí trễ hạn</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(debtReport.totalLateFees)}</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h4 className="text-sm font-semibold text-slate-800">Tình trạng xử lý</h4>
                  {debtReport.asOfDate && <span className="text-[11px] text-slate-500">Cập nhật {new Date(debtReport.asOfDate).toLocaleDateString('vi-VN')}</span>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-50 p-3"><span className="text-slate-500 block">Trong hạn gia hạn</span><strong className="text-slate-900">{debtReport.gracePeriodCount}</strong></div>
                  <div className="rounded-lg bg-amber-50 p-3"><span className="text-amber-800 block">Đã cảnh báo</span><strong className="text-amber-950">{debtReport.warningCount}</strong></div>
                  <div className="rounded-lg bg-orange-50 p-3"><span className="text-orange-800 block">Đã chặn truy cập</span><strong className="text-orange-950">{debtReport.accessBlockedCount}</strong></div>
                  <div className="rounded-lg bg-rose-50 p-3"><span className="text-rose-800 block">Đủ điều kiện niêm phong</span><strong className="text-rose-950">{debtReport.eligibleForSealingCount}</strong></div>
                </div>
              </div>
              {debtReport.totalOverdueCount === 0 && <p className="text-xs text-emerald-700">Hiện không có hợp đồng quá hạn được ghi nhận.</p>}
              <p className="text-[11px] text-slate-500">Báo cáo tổng hợp chưa cung cấp danh sách từng hợp đồng; thao tác nhắc nợ hoặc khóa kho cần thực hiện trong màn hình có dữ liệu hợp đồng chi tiết.</p>
            </>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Chưa có dữ liệu công nợ cho cơ sở này.</p>
          )}
        </div>
        <div className="lg:col-span-5 flex flex-col gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-800">
              <span className="material-symbols-outlined text-[22px]">badge</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Nhân sự và phân ca</h3>
              <p className="text-xs text-slate-500">Theo dõi nhân viên đang trực tại cơ sở</p>
            </div>
          </div>
          <div className="flex flex-col items-center text-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8">
            <span className="material-symbols-outlined text-3xl text-slate-400">event_busy</span>
            <p className="text-sm font-semibold text-slate-700">Chưa có dữ liệu ca trực</p>
            <p className="max-w-sm text-xs leading-relaxed text-slate-500">Hệ thống hiện chưa cung cấp API lịch trực và phân công nhân sự. Thông tin nhân viên sẽ hiển thị tại đây khi được kết nối.</p>
          </div>
        </div>
      </section>

    </div>
  )
}
