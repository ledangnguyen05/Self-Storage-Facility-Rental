import React, { useState, useEffect } from 'react'
import { sealingService } from '../../../services/sealingService'
import { userService } from '../../../services/userService'
import { User } from '../../../types'

interface AssetSealingModalProps {
  isOpen: boolean
  onClose: () => void
  unitCode: string
  unitId?: string
  tenantName: string
  contractCode: string
  contractId?: string
  facilityId?: string
  overdueDays: number
  totalDebt: string
  onCompleteSealing: (msg: string) => void
}

export const AssetSealingModal: React.FC<AssetSealingModalProps> = ({
  isOpen,
  onClose,
  unitCode,
  unitId,
  tenantName,
  contractCode,
  contractId,
  facilityId,
  overdueDays,
  totalDebt,
  onCompleteSealing
}) => {
  const [sealReportCode] = useState(() => `BB-NP-${new Date().getFullYear()}${Math.floor(100 + Math.random() * 900)}`)
  const [sealStickerCode, setSealStickerCode] = useState(() => `TEM-BOXORA-${Math.floor(10000 + Math.random() * 90000)}`)
  const [witnesses, setWitnesses] = useState<User[]>([])
  const [selectedWitnessId, setSelectedWitnessId] = useState<string>('')
  const [reason, setReason] = useState('Khách hàng vi phạm nghĩa vụ thanh toán quá hạn trên 7 ngày theo quy định BR-RULE-012. Tiến hành niêm phong bảo toàn tài sản.')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadWitnesses()
    }
  }, [isOpen, facilityId])

  const loadWitnesses = async () => {
    try {
      const res = await userService.getAllUsers({ facilityId })
      const users = res?.data || []
      setWitnesses(users)
      if (users.length > 0) {
        setSelectedWitnessId(users[0].id)
      }
    } catch {
      // Fallback
    }
  }

  if (!isOpen) return null

  const handleConfirm = async () => {
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await sealingService.createSealing({
        contractId: contractId || undefined,
        unitId: unitId || undefined,
        sealTagNumber: sealStickerCode,
        witnessId: selectedWitnessId || undefined,
        reason: reason,
        notes: `Niêm phong kho #${unitCode} do quá hạn ${overdueDays} ngày. Tổng nợ ${totalDebt}.`
      })

      const protocol = res?.protocolNumber || sealReportCode
      onCompleteSealing(`Đã hoàn tất lập biên bản niêm phong ${protocol} và chuyển trạng thái kho #${unitCode} sang SEALED / OVERDUE_LOCKED!`)
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Lỗi khi gọi API niêm phong kho'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedWitness = witnesses.find(w => w.id === selectedWitnessId)
  const witnessName = selectedWitness ? (selectedWitness.fullName || selectedWitness.username) : 'Nhân chứng hiện trường trạm'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-100 text-orange-900">
              <span className="material-symbols-outlined text-[26px]">gavel</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Biên Bản Niêm Phong &amp; Kê Biên Kho</h2>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono text-xs font-bold text-slate-800 border border-slate-200">
                  {sealReportCode}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Kết nối API POST /api/v1/sealing &mdash; Chuyển trạng thái kho sang SEALED
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Legal Document Sheet Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 rounded-xl border border-slate-200 font-sans text-xs flex flex-col gap-3">
          {/* Header Quốc Hiệu */}
          <div className="text-center pb-2 border-b border-slate-200">
            <p className="font-bold text-slate-900 uppercase tracking-widest text-[11px]">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </p>
            <p className="text-slate-600 text-[11px] italic">Độc lập - Tự do - Hạnh phúc</p>
            <div className="w-16 h-0.5 bg-slate-400 mx-auto my-1.5"></div>
            <h3 className="text-sm font-black text-slate-900 uppercase mt-1">
              BIÊN BẢN NIÊM PHONG KHO HÀNG &amp; KÊ BIÊN TÀI SẢN
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5 italic">
              (Do vi phạm nghĩa vụ thanh toán cước thuê kho vượt quá thời hạn cam kết BR-RULE-012)
            </p>
          </div>

          {/* Basis */}
          <div className="text-slate-700 leading-relaxed text-[11px]">
            <p>&bull; <strong>Căn cứ:</strong> Hợp đồng dịch vụ thuê kho tự quản số <strong>{contractCode}</strong>.</p>
            <p>&bull; <strong>Căn cứ:</strong> Điều 8 Quy chế quản lý &amp; xử lý tài sản vi phạm nợ cước của Hệ thống Boxora.</p>
            <p>&bull; <strong>Thời điểm lập:</strong> {new Date().toLocaleTimeString('vi-VN')} ngày {new Date().toLocaleDateString('vi-VN')}.</p>
          </div>

          {/* Parties Involved */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col gap-1.5">
            <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
              1. Thông tin đối tượng vi phạm &amp; Tài sản niêm phong
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>&bull; Phòng kho: <strong className="font-mono text-slate-900">Kho #{unitCode}</strong></div>
              <div>&bull; Khách thuê: <strong>{tenantName}</strong></div>
              <div>&bull; Quá hạn: <span className="text-rose-700 font-bold">{overdueDays} ngày</span></div>
              <div>&bull; Tổng cước nợ &amp; phạt: <strong className="font-mono text-rose-700">{totalDebt}</strong></div>
            </div>
          </div>

          {/* Council & Witnesses */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col gap-2">
            <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
              2. Thành phần hội đồng &amp; Nhân chứng niêm phong
            </span>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-slate-600 font-semibold">
                Chọn nhân viên / giám sát làm nhân chứng hiện trường (Two-Person Integrity):
              </label>
              {witnesses.length > 0 ? (
                <select
                  value={selectedWitnessId}
                  onChange={(e) => setSelectedWitnessId(e.target.value)}
                  className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800 font-medium cursor-pointer"
                >
                  {witnesses.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.fullName || w.username} ({w.role?.name || 'Staff'} - {w.email})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-[11px] text-slate-700 italic">
                  Đại diện Ban Quản Lý &amp; Cán bộ phụ trách Kỹ thuật tại trạm: <strong>{witnessName}</strong>
                </p>
              )}
            </div>
          </div>

          {/* Seal Tag & Reason */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col gap-2">
            <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
              3. Tem niêm phong &amp; Lý do cưỡng chế
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">MÃ TEM NIÊM PHONG AN NINH</label>
                <input
                  type="text"
                  value={sealStickerCode}
                  onChange={(e) => setSealStickerCode(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 rounded border border-slate-200 font-mono font-bold text-orange-700 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">LÝ DO NIÊM PHONG</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 rounded border border-slate-200 text-xs text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Enforcement Steps */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col gap-1.5">
            <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
              4. Biện pháp cưỡng chế áp dụng
            </span>
            <div className="text-[11px] text-slate-700 flex flex-col gap-1">
              <p>&bull; Ngắt kết nối mã PIN cá nhân trên SmartLock, đổi trạng thái kho sang <strong className="text-rose-700">OVERDUE_LOCKED / SEALED</strong>.</p>
              <p>&bull; Dán tem an ninh <strong className="font-mono text-orange-700">{sealStickerCode}</strong> tại chốt cửa ngoài.</p>
              <p>&bull; Hệ thống tự động gửi Email thông báo khẩn cấp và biểu mẫu công nợ cho khách hàng.</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-lg bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-all border border-slate-200 cursor-pointer flex items-center gap-1 shadow-2xs"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            In / Xuất PDF
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all border border-slate-200 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition-all shadow-sm cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] ${isSubmitting ? 'animate-spin' : ''}`}>
                {isSubmitting ? 'sync' : 'verified'}
              </span>
              <span>{isSubmitting ? 'Đang gọi API niêm phong...' : 'Lưu & Ký Số Biên Bản'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
