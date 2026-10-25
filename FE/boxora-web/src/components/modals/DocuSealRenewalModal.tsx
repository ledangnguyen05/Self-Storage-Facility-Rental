import React, { useState, useRef, useEffect } from 'react'
import { ContractRenewal } from '../../types'
import { contractService } from '../../services/contractService'
import { useAuth } from '../../context/AuthContext'

interface DocuSealRenewalModalProps {
  renewal: ContractRenewal
  onClose: () => void
  onSignedSuccess: (updated: ContractRenewal) => void
  onProceedToPayment?: (renewal: ContractRenewal) => void
}

function formatDate(val?: string) {
  if (!val) return 'N/A'
  try {
    const d = new Date(val)
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return val
  }
}

export function DocuSealRenewalModal({
  renewal,
  onClose,
  onSignedSuccess,
  onProceedToPayment,
}: DocuSealRenewalModalProps) {
  const { user } = useAuth()
  const customerName = renewal.customerName || user?.fullName || 'Khách hàng Boxora'
  const [agreed, setAgreed] = useState(false)
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw')
  const [signerName, setSignerName] = useState(customerName)
  const [isSigning, setIsSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signedResult, setSignedResult] = useState<ContractRenewal | null>(null)

  // Canvas drawing state
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  const updateCanvasResolution = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      if (!hasDrawn) {
        canvas.width = rect.width
        canvas.height = rect.height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.strokeStyle = '#0f172a'
          ctx.lineWidth = 2.5
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
        }
      }
    }
  }

  useEffect(() => {
    updateCanvasResolution()
    window.addEventListener('resize', updateCanvasResolution)
    return () => window.removeEventListener('resize', updateCanvasResolution)
  }, [hasDrawn, signatureMode])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    setIsDrawing(true)
    setHasDrawn(true)
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    ctx.beginPath()
    ctx.moveTo(clientX - rect.left, clientY - rect.top)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    ctx.lineTo(clientX - rect.left, clientY - rect.top)
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
  }

  const handleSign = async () => {
    if (!agreed) {
      setError('Vui lòng đọc và tích chọn xác nhận đồng ý các điều khoản phụ lục.')
      return
    }

    let signatureData = ''
    if (signatureMode === 'draw') {
      if (!hasDrawn || !canvasRef.current) {
        setError('Vui lòng ký tay vào ô chữ ký bên dưới trước khi xác nhận.')
        return
      }
      signatureData = canvasRef.current.toDataURL('image/png')
    } else {
      if (!signerName.trim()) {
        setError('Vui lòng nhập họ và tên của người ký.')
        return
      }
      signatureData = `TYPED:${signerName.trim()}`
    }

    setIsSigning(true)
    setError(null)
    try {
      const updated = await contractService.mockSignRenewal(renewal.id, signatureData)
      setSignedResult(updated)
      onSignedSuccess(updated)
    } catch (err: any) {
      console.error('Lỗi khi ký phụ lục gia hạn:', err)
      const msg = err?.response?.data?.message || err?.message || 'Không thể xác nhận chữ ký điện tử. Vui lòng thử lại.'
      setError(msg)
    } finally {
      setIsSigning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/75 backdrop-blur-md overflow-y-auto p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="min-h-full flex items-center justify-center py-6">
        <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 text-slate-900 dark:text-white flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <span className="material-symbols-outlined text-[20px]">draw</span>
            </div>
            <div>
              <h3 className="font-headline text-base font-bold text-white flex items-center gap-2">
                Ký Phụ Lục Gia Hạn Hợp Đồng
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  DocuSeal Certified
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Kho #{renewal.unitCode} • Hợp đồng #{renewal.contractCode}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {signedResult ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <span className="material-symbols-outlined text-[36px]">verified</span>
              </div>
              <div className="space-y-1">
                <h4 className="font-headline text-lg font-bold text-slate-900">
                  Ký Phụ Lục Gia Hạn Thành Công!
                </h4>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  Chữ ký điện tử của bạn đã được ghi nhận bảo mật trên hệ thống Boxora. Thời hạn mới dự kiến: <strong className="text-slate-900">{formatDate(signedResult.newEndDate)}</strong>.
                </p>
              </div>

              {signedResult.status === 'COMPLETED' ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl max-w-md mx-auto text-xs text-emerald-800 font-medium">
                  Hợp đồng thuê kho đã được gia hạn hoàn tất thành công!
                </div>
              ) : (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl max-w-md mx-auto text-xs text-blue-800 font-medium space-y-1">
                  <div>Trạng thái hiện tại: <strong>Chờ thanh toán phí gia hạn</strong></div>
                  <div className="font-mono text-sm font-bold text-blue-900">
                    Phí gia hạn: {Number(signedResult.renewalFee || 0).toLocaleString('vi-VN')} ₫
                  </div>
                </div>
              )}

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                {signedResult.status !== 'COMPLETED' && onProceedToPayment && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      onProceedToPayment(signedResult)
                    }}
                    className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">credit_card</span>
                    <span>Thanh toán VNPay ngay</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Đóng cửa sổ
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Phụ lục document preview */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-3 font-sans">
                <div className="text-center pb-2 border-b border-slate-200">
                  <div className="font-bold uppercase tracking-wider text-slate-900 text-sm">
                    CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">Độc lập - Tự do - Hạnh phúc</div>
                  <div className="font-headline font-bold text-blue-800 uppercase text-sm mt-2">
                    PHỤ LỤC GIA HẠN HỢP ĐỒNG THUÊ KHO TỰ QUẢN
                  </div>
                  <div className="font-mono text-[11px] text-slate-500">
                    Số: PLGH-{renewal.contractCode} • Ngày: {new Date().toLocaleDateString('vi-VN')}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 py-1 text-slate-700">
                  <div>
                    <span className="text-slate-500">Bên thuê (Khách hàng): </span>
                    <strong className="text-slate-900">{customerName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Cơ sở lưu trữ: </span>
                    <strong className="text-slate-900">{renewal.facilityName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Mã kho tự quản: </span>
                    <strong className="text-slate-900 font-mono">#{renewal.unitCode}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Thời hạn hiện tại đến: </span>
                    <strong className="text-slate-900 font-mono">{formatDate(renewal.oldEndDate)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Thời gian gia hạn thêm: </span>
                    <strong className="text-blue-700 font-bold">{renewal.cycleMonths} Tháng</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Thời hạn kết thúc mới: </span>
                    <strong className="text-emerald-700 font-mono font-bold">{formatDate(renewal.newEndDate)}</strong>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-600 block">Tổng phí gia hạn kỳ này</span>
                    <span className="text-[10px] text-slate-400">Đã bao gồm VAT và áp dụng giá thuê theo hợp đồng</span>
                  </div>
                  <div className="font-mono text-base font-extrabold text-blue-700">
                    {Number(renewal.renewalFee || 0).toLocaleString('vi-VN')} ₫
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 leading-relaxed italic">
                  * Hai bên cam kết tuân thủ toàn bộ các điều khoản trong Hợp đồng thuê kho gốc đã ký. Phụ lục này có hiệu lực chính thức ngay sau khi hoàn tất ký điện tử và xác nhận thanh toán đủ cước gia hạn.
                </div>
              </div>

              {/* Signature section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-blue-600 text-[18px]">draw</span>
                    Chữ ký điện tử người thuê
                  </label>
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setSignatureMode('draw')}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        signatureMode === 'draw' ? 'bg-white shadow-xs text-blue-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Ký tay
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignatureMode('type')}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        signatureMode === 'type' ? 'bg-white shadow-xs text-blue-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Nhập tên
                    </button>
                  </div>
                </div>

                {signatureMode === 'draw' ? (
                  <div className="space-y-1.5">
                    <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/60 overflow-hidden">
                      <canvas
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="w-full h-36 cursor-crosshair touch-none"
                      />
                      {!hasDrawn && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs italic">
                          Dùng chuột hoặc ngón tay để vẽ chữ ký của bạn tại đây
                        </div>
                      )}
                      {hasDrawn && (
                        <button
                          type="button"
                          onClick={clearCanvas}
                          className="absolute top-2 right-2 px-2 py-1 bg-white/90 hover:bg-white text-rose-600 text-[11px] font-semibold rounded shadow-xs border border-slate-200 cursor-pointer"
                        >
                          Xóa ký lại
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Nhập họ và tên đầy đủ..."
                      className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500 font-sans italic"
                    />
                  </div>
                )}

                {/* Agreement checkbox */}
                <label className="flex items-start gap-2.5 pt-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs text-slate-600 leading-snug">
                    Tôi xác nhận đã đọc, hiểu rõ và đồng ý toàn bộ nội dung phụ lục gia hạn này, cam kết thanh toán đầy đủ phí gia hạn theo quy định.
                  </span>
                </label>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">error</span>
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!signedResult && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSigning}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSign}
              disabled={isSigning || !agreed}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              {isSigning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  <span>Đang ký điện tử...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>Ký &amp; Xác Nhận Phụ Lục</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
  )
}
