import React, { useState, useRef, useEffect } from 'react'
import { ContractRenewal, RentalContract } from '../../types'
import { contractService } from '../../services/contractService'
import { useAuth } from '../../context/AuthContext'
import { toast } from '../../utils/toast'

export interface RenewalAddendumModalProps {
  renewal: ContractRenewal | null
  contract?: RentalContract | null
  readOnly?: boolean
  onClose: () => void
  onSignedSuccess?: (updated: ContractRenewal) => void
  onPayNow?: (renewal: ContractRenewal) => void
}

function formatDateVi(val?: string) {
  if (!val) return '—'
  if (val.includes('/')) return val
  const parts = val.split('T')[0].split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return val
}

export const RenewalAddendumModal: React.FC<RenewalAddendumModalProps> = ({
  renewal,
  contract,
  readOnly = false,
  onClose,
  onSignedSuccess,
  onPayNow,
}) => {
  const { user } = useAuth()
  const [localRenewal, setLocalRenewal] = useState<ContractRenewal | null>(renewal)
  const [agreed, setAgreed] = useState<boolean>(true)
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw')
  const [signerName, setSignerName] = useState<string>(
    renewal?.customerName || contract?.customerName || user?.fullName || 'Khách hàng'
  )
  const [isSigning, setIsSigning] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState<boolean>(false)
  const [hasDrawn, setHasDrawn] = useState<boolean>(false)

  useEffect(() => {
    setLocalRenewal(renewal)
    if (renewal?.customerName || contract?.customerName || user?.fullName) {
      setSignerName(renewal?.customerName || contract?.customerName || user?.fullName || 'Khách hàng')
    }
  }, [renewal, contract?.customerName, user?.fullName])

  const storedSig = (() => {
    if (!localRenewal?.id) return null
    try {
      return localStorage.getItem('boxora_renewal_sig_' + localRenewal.id)
    } catch {
      return null
    }
  })()

  const effectiveSignature = localRenewal?.signatureData || storedSig || null
  const isAlreadySigned = Boolean(
    localRenewal?.signedAt ||
      effectiveSignature ||
      localRenewal?.status === 'PENDING_PAYMENT' ||
      localRenewal?.status === 'COMPLETED'
  )
  const canSignNow =
    Boolean(localRenewal) &&
    !readOnly &&
    !isAlreadySigned &&
    (localRenewal?.status === 'PENDING_SIGNATURE' || localRenewal?.status === 'PENDING_PAYMENT')

  const updateCanvasResolution = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0 && !hasDrawn) {
      canvas.width = Math.round(rect.width)
      canvas.height = Math.round(rect.height)
    }
  }

  useEffect(() => {
    if (!canSignNow || signatureMode !== 'draw') return
    const timer = setTimeout(updateCanvasResolution, 60)
    window.addEventListener('resize', updateCanvasResolution)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateCanvasResolution)
    }
  }, [canSignNow, signatureMode, hasDrawn])

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    setIsDrawing(true)
    setHasDrawn(true)
    const { x, y } = getCoordinates(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { x, y } = getCoordinates(e)
    ctx.lineWidth = 2.8
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1d4ed8'
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
    updateCanvasResolution()
  }

  if (!localRenewal) return null

  const handleConfirmSign = async () => {
    if (!agreed) {
      setError('Vui lòng đánh dấu xác nhận đồng ý với các điều khoản của Phụ lục gia hạn.')
      return
    }
    if (signatureMode === 'draw' && !hasDrawn) {
      setError('Vui lòng ký tay vào khung chữ ký điện tử bên dưới hoặc chuyển sang Chữ ký mẫu.')
      return
    }

    setIsSigning(true)
    setError(null)
    try {
      let signatureData: string
      if (signatureMode === 'draw' && canvasRef.current && hasDrawn) {
        signatureData = canvasRef.current.toDataURL('image/png')
      } else {
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 85" width="260" height="85"><path d="M 26 55 C 30 38 36 20 44 15 C 50 11 55 18 58 32 C 63 50 69 58 75 38 C 79 26 85 22 91 30 C 97 38 101 52 108 48 C 114 44 118 32 123 30 C 129 28 131 42 135 48 C 139 54 144 48 148 38 C 152 26 156 22 160 34 C 164 46 170 76 158 84 C 146 91 140 78 148 64 C 158 48 168 40 178 38 C 186 36 191 44 196 46 C 203 48 210 36 217 34 C 224 32 228 42 234 40 C 240 38 244 32 248 34" fill="none" stroke="%231e3a8a" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="218" cy="23" r="2.2" fill="%231e3a8a"/><path d="M 34 68 C 74 65 132 67 198 59 C 220 56 236 55 248 57" fill="none" stroke="%232563eb" stroke-width="2.2" stroke-linecap="round"/></svg>`
        signatureData = `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`
      }

      try {
        localStorage.setItem('boxora_renewal_sig_' + localRenewal.id, signatureData)
      } catch {
        // ignore storage quota errors
      }

      const updated = await contractService.mockSignRenewal(localRenewal.id, signatureData)
      const merged: ContractRenewal = {
        ...localRenewal,
        ...updated,
        signatureData: updated?.signatureData || signatureData,
        signedAt: updated?.signedAt || new Date().toISOString(),
        status: updated?.status || 'PENDING_PAYMENT',
      }
      setLocalRenewal(merged)
      toast.success(
        `Đã ký Phụ lục gia hạn kho #${localRenewal.unitCode}`,
        'Phụ lục gia hạn hợp đồng đã được ký số thành công. Vui lòng hoàn tất thanh toán phí gia hạn.'
      )
      onSignedSuccess?.(merged)
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Không thể ký phụ lục gia hạn lúc này. Vui lòng thử lại.'
      setError(msg)
    } finally {
      setIsSigning(false)
    }
  }

  const monthlyRate =
    localRenewal.cycleMonths && localRenewal.cycleMonths > 0
      ? Math.round(Number(localRenewal.renewalFee || 0) / localRenewal.cycleMonths)
      : Number(contract?.monthlyFee || 0)

  return (
    <div className="fixed inset-0 z-[85] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">history_edu</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline text-sm sm:text-base font-bold tracking-wide uppercase">
                  Phụ Lục Gia Hạn Hợp Đồng Thuê Kho
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    localRenewal.status === 'COMPLETED'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                      : isAlreadySigned
                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40'
                      : localRenewal.status === 'PENDING_SIGNATURE'
                      ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                      : 'bg-slate-700 text-slate-300 border-slate-600'
                  }`}
                >
                  {localRenewal.status === 'COMPLETED'
                    ? '✓ Đã có hiệu lực pháp lý'
                    : isAlreadySigned
                    ? '✍️ Đã ký số • Chờ thanh toán'
                    : localRenewal.status === 'PENDING_SIGNATURE'
                    ? 'Chờ khách hàng ký số'
                    : localRenewal.status === 'PENDING_REVIEW'
                    ? 'Bản dự thảo (Chờ Quản lý duyệt)'
                    : localRenewal.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Mã phụ lục: #PLGH-{localRenewal.id.slice(0, 8).toUpperCase()} • Kèm theo HĐ gốc #{localRenewal.contractCode}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Legal Document Content */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-5 text-xs text-slate-700 leading-relaxed flex-1 bg-slate-50/50">
          {/* Official Paper Sheet */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-xs space-y-5">
            {/* National Header */}
            <div className="text-center border-b border-slate-200 pb-4 space-y-1">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
              </div>
              <div className="font-semibold text-slate-700 text-[11px] underline underline-offset-4">
                Độc lập - Tự do - Hạnh phúc
              </div>
              <h2 className="font-headline text-base sm:text-lg font-extrabold text-slate-900 uppercase pt-3">
                PHỤ LỤC GIA HẠN HỢP ĐỒNG THUÊ KHO TỰ QUẢN
              </h2>
              <p className="font-mono text-[11px] text-slate-500">
                Số: PLGH-{localRenewal.id.slice(0, 8).toUpperCase()}/{new Date().getFullYear()}/BOXORA (Kèm theo Hợp đồng số #{localRenewal.contractCode})
              </p>
            </div>

            {/* Parties Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                  BÊN CHO THUÊ (BÊN A):
                </div>
                <div className="font-bold text-slate-900">
                  CÔNG TY CỔ PHẦN HỆ THỐNG KHO TỰ QUẢN BOXORA
                </div>
                <div className="text-[11px] text-slate-600">
                  Cơ sở vận hành: <strong>{localRenewal.facilityName || contract?.facilityName || 'Boxora Storage'}</strong>
                </div>
                <div className="text-[11px] text-slate-600">
                  Người phê duyệt: <strong>{localRenewal.reviewedByName || 'Ban Quản Lý Cơ Sở Boxora'}</strong>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  BÊN THUÊ KHO (BÊN B - KHÁCH HÀNG):
                </div>
                <div className="font-bold text-slate-900">
                  {localRenewal.customerName || contract?.customerName || user?.fullName || 'Quý Khách Hàng'}
                </div>
                <div className="text-[11px] text-slate-600 font-mono">
                  Email: {localRenewal.customerEmail || contract?.customerEmail || user?.email || '—'}
                </div>
                <div className="text-[11px] text-slate-600">
                  Ngăn kho đang thuê: <strong className="font-mono text-blue-700">KHO #{localRenewal.unitCode}</strong>
                </div>
              </div>
            </div>

            {/* Legal Clauses */}
            <div className="space-y-4 text-slate-700">
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-900 uppercase text-xs flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-blue-100 text-blue-700 font-mono text-[11px] flex items-center justify-center">
                    1
                  </span>
                  <span>Điều 1. Nội dung gia hạn thời hạn thuê kho</span>
                </h4>
                <p className="text-xs text-slate-600 pl-6">
                  Hai bên thống nhất gia hạn thời gian thuê ngăn kho tự quản{' '}
                  <strong className="font-mono text-slate-900">#{localRenewal.unitCode}</strong> tại cơ sở{' '}
                  <strong>{localRenewal.facilityName}</strong> theo Hợp đồng gốc số{' '}
                  <strong className="font-mono">#{localRenewal.contractCode}</strong> với lộ trình thời gian nối tiếp cụ thể như sau:
                </p>

                <div className="ml-6 grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Ngày kết thúc cũ
                    </span>
                    <span className="font-mono text-sm font-bold text-slate-800 mt-0.5 block">
                      {formatDateVi(localRenewal.oldEndDate)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                    <span className="text-[10px] uppercase font-bold text-blue-600 block">
                      Chu kỳ gia hạn thêm
                    </span>
                    <span className="font-mono text-sm font-extrabold text-blue-800 mt-0.5 block">
                      +{localRenewal.cycleMonths} tháng liên tiếp
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 block">
                      Ngày kết thúc mới
                    </span>
                    <span className="font-mono text-sm font-extrabold text-emerald-800 mt-0.5 block">
                      {formatDateVi(localRenewal.newEndDate)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-900 uppercase text-xs flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-blue-100 text-blue-700 font-mono text-[11px] flex items-center justify-center">
                    2
                  </span>
                  <span>Điều 2. Giá trị phụ lục gia hạn &amp; Phương thức thanh toán</span>
                </h4>
                <div className="ml-6 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center border-b border-slate-200/70 pb-1.5">
                    <span className="text-slate-600">Đơn giá thuê hàng tháng theo hợp đồng:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {monthlyRate.toLocaleString('vi-VN')} ₫ / tháng
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200/70 pb-1.5">
                    <span className="text-slate-600">Số tháng gia hạn nối tiếp:</span>
                    <span className="font-mono font-bold text-slate-900">{localRenewal.cycleMonths} tháng</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200/70 pb-1.5">
                    <span className="text-slate-600">Tiền cọc bảo đảm (Đã lưu ký từ HĐ gốc):</span>
                    <span className="font-mono font-semibold text-emerald-700">
                      Giữ nguyên (Không phải đóng thêm cọc)
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">
                      TỔNG CƯỚC PHÍ GIA HẠN CẦN THANH TOÁN:
                    </span>
                    <span className="font-mono text-base sm:text-lg font-extrabold text-blue-700">
                      {Number(localRenewal.renewalFee || 0).toLocaleString('vi-VN')} ₫
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 uppercase text-xs flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-blue-100 text-blue-700 font-mono text-[11px] flex items-center justify-center">
                    3
                  </span>
                  <span>Điều 3. Hiệu lực thi hành &amp; Quyền truy cập SmartLock IoT</span>
                </h4>
                <ul className="list-disc pl-10 space-y-1 text-slate-600">
                  <li>
                    Phụ lục này là một bộ phận không tách rời của Hợp đồng thuê kho số{' '}
                    <strong className="font-mono">#{localRenewal.contractCode}</strong>. Các điều khoản khác về an ninh, bảo hiểm và nội quy sử dụng kho giữ nguyên hiệu lực.
                  </li>
                  <li>
                    Ngay sau khi Bên B hoàn tất ký Phụ lục này và thanh toán đủ phí gia hạn tại Điều 2, thời hạn hợp đồng và hiệu lực mã PIN khóa thông minh IoT của kho{' '}
                    <strong className="font-mono">#{localRenewal.unitCode}</strong> sẽ tự động được kéo dài liên tục đến hết ngày{' '}
                    <strong className="font-mono text-emerald-700">{formatDateVi(localRenewal.newEndDate)}</strong>.
                  </li>
                </ul>
              </div>
            </div>

            {/* Signatures Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-5 border-t border-slate-200">
              {/* Representative Boxora Stamp */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col items-center justify-between text-center min-h-[160px]">
                <div>
                  <div className="font-bold text-slate-900 uppercase text-xs">ĐẠI DIỆN BÊN CHO THUÊ (BÊN A)</div>
                  <div className="text-[11px] text-slate-500">Hệ thống Kho Tự Quản Boxora</div>
                </div>

                {localRenewal.status !== 'PENDING_REVIEW' && localRenewal.status !== 'REJECTED' ? (
                  <div className="my-2 px-4 py-2 rounded-xl border-2 border-rose-600/80 bg-rose-50/60 text-rose-700 font-mono text-[11px] font-bold uppercase tracking-wider rotate-[-2deg] shadow-2xs">
                    <div>✓ ĐÃ PHÊ DUYỆT ĐIỆN TỬ</div>
                    <div className="text-[10px] font-semibold">
                      {localRenewal.reviewedByName || 'QUẢN LÝ CƠ SỞ BOXORA'}
                    </div>
                  </div>
                ) : (
                  <div className="my-4 text-[11px] text-amber-700 font-semibold italic">
                    (Đang chờ Quản lý cơ sở phê duyệt)
                  </div>
                )}

                <div className="text-[10px] text-slate-500 font-mono">
                  {localRenewal.reviewedAt
                    ? `Duyệt lúc: ${new Date(localRenewal.reviewedAt).toLocaleString('vi-VN')}`
                    : 'Chứng thực bởi Boxora Digital Trust'}
                </div>
              </div>

              {/* Customer Signature Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col items-center justify-between text-center min-h-[160px]">
                <div>
                  <div className="font-bold text-slate-900 uppercase text-xs">ĐẠI DIỆN BÊN THUÊ KHO (BÊN B)</div>
                  <div className="text-[11px] text-slate-500">Khách hàng ký xác nhận gia hạn</div>
                </div>

                {isAlreadySigned ? (
                  <div className="my-2 flex flex-col items-center">
                    {effectiveSignature ? (
                      <img
                        src={effectiveSignature}
                        alt="Chữ ký khách hàng"
                        className="h-16 object-contain"
                      />
                    ) : (
                      <div className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 font-bold text-xs">
                        ✍️ Đã ký xác nhận điện tử
                      </div>
                    )}
                    <span className="text-xs font-bold text-slate-900 mt-1">
                      {localRenewal.customerName || user?.fullName || signerName}
                    </span>
                  </div>
                ) : (
                  <div className="my-4 text-[11px] text-slate-400 italic">
                    {canSignNow ? '(Vui lòng ký vào khung bên dưới)' : '(Ký sau khi Quản lý phê duyệt)'}
                  </div>
                )}

                <div className="text-[10px] text-slate-500 font-mono">
                  {localRenewal.signedAt
                    ? `Đã ký lúc: ${new Date(localRenewal.signedAt).toLocaleString('vi-VN')}`
                    : 'Chữ ký điện tử DocuSeal / Boxora eSign'}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Electronic Signing Area (Only shown when approved & waiting for customer signature) */}
          {canSignNow && (
            <div className="bg-blue-50/70 border-2 border-blue-300 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200 pb-3">
                <div>
                  <h4 className="font-headline text-sm font-extrabold text-blue-950 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-blue-600 text-[20px]">draw</span>
                    <span>Ký Điện Tử Phụ Lục Gia Hạn Hợp Đồng</span>
                  </h4>
                  <p className="text-[11px] text-blue-800">
                    Vẽ chữ ký tay trực tiếp trên khung cảm ứng hoặc chọn chữ ký điện tử mẫu để xác nhận phụ lục.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-blue-200 self-start">
                  <button
                    type="button"
                    onClick={() => setSignatureMode('draw')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      signatureMode === 'draw' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Vẽ chữ ký tay
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignatureMode('type')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      signatureMode === 'type' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Chữ ký mẫu nhanh
                  </button>
                </div>
              </div>

              {signatureMode === 'draw' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span>Dùng chuột hoặc ngón tay ký vào khung trắng bên dưới:</span>
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">ink_eraser</span>
                      <span>Xóa ký lại</span>
                    </button>
                  </div>
                  <div className="relative bg-white border-2 border-dashed border-blue-300 rounded-xl overflow-hidden h-36">
                    <canvas
                      ref={canvasRef}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-full cursor-crosshair touch-none"
                    />
                    {!hasDrawn && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400 font-medium">
                        Ký tên của bạn tại đây...
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Họ và tên người ký xác nhận:
                  </label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={e => setSignerName(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-blue-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                  <div className="p-3 bg-white rounded-xl border border-blue-200 flex items-center justify-center">
                    <span className="font-serif italic text-2xl text-blue-800 font-bold tracking-wide">
                      {signerName || 'Chữ ký khách hàng'}
                    </span>
                  </div>
                </div>
              )}

              <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs text-slate-800 font-medium leading-relaxed">
                  Tôi xác nhận đã đọc, hiểu rõ và đồng ý toàn bộ điều khoản trong Phụ lục gia hạn hợp đồng thuê kho #{localRenewal.unitCode} thêm{' '}
                  <strong>{localRenewal.cycleMonths} tháng</strong> (đến ngày{' '}
                  <strong>{formatDateVi(localRenewal.newEndDate)}</strong>) với tổng phí gia hạn{' '}
                  <strong>{Number(localRenewal.renewalFee || 0).toLocaleString('vi-VN')} ₫</strong>.
                </span>
              </label>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>In phụ lục</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Đóng
            </button>

            {canSignNow && (
              <button
                type="button"
                onClick={handleConfirmSign}
                disabled={isSigning}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">ink_pen</span>
                <span>{isSigning ? 'Đang ký số phụ lục...' : 'Xác Nhận Ký Số Phụ Lục'}</span>
              </button>
            )}

            {isAlreadySigned && localRenewal.status !== 'COMPLETED' && onPayNow && (
              <button
                type="button"
                onClick={() => onPayNow(localRenewal)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">payments</span>
                <span>
                  Thanh Toán Phí Gia Hạn ({Number(localRenewal.renewalFee || 0).toLocaleString('vi-VN')} ₫)
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
