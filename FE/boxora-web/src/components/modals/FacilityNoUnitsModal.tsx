import React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { AlertCircle, X } from 'lucide-react'
import { Facility } from '../../types'

interface FacilityNoUnitsModalProps {
  isOpen: boolean
  onClose: () => void
  currentFacility?: Facility | null
  alternativeFacilities?: any[]
  onSelectAlternativeFacility?: (facility: Facility) => void
  onStayOnFacilityStep?: () => void
}

export const FacilityNoUnitsModal: React.FC<FacilityNoUnitsModalProps> = ({
  isOpen,
  onClose,
  currentFacility,
  onStayOnFacilityStep,
}) => {
  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleAcknowledge()
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleAcknowledge = () => {
    if (onStayOnFacilityStep) {
      onStayOnFacilityStep()
    }
    onClose()
  }

  const facilityName = currentFacility?.name || 'Vinhomes'

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop Blur Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-0"
          onClick={handleAcknowledge}
        />

        {/* Modal Dialog Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl z-10 overflow-hidden text-center my-auto p-6 sm:p-7"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {/* Subtle Accent Glow Top Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />

          {/* Close Button Top Right */}
          <button
            type="button"
            onClick={handleAcknowledge}
            className="absolute top-3.5 right-3.5 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>

          <div className="flex flex-col items-center pt-2">
            {/* Warning Icon Badge */}
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/80 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 shadow-sm">
              <AlertCircle size={30} strokeWidth={2.2} />
            </div>

            {/* Title */}
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
              Thông báo khả dụng
            </h3>

            {/* Content Message */}
            <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed space-y-2 mb-6">
              <p>
                Cơ sở <span className="font-bold text-slate-900 dark:text-white">{facilityName}</span> tạm thời hết kho hoặc hiện chưa có buồng kho nào ở trạng thái sẵn sàng để đặt trực tuyến.
              </p>
              <p className="font-semibold text-amber-700 dark:text-amber-400">
                Vui lòng chọn cơ sở khác.
              </p>
            </div>

            {/* Action Button: Đã hiểu */}
            <button
              type="button"
              onClick={handleAcknowledge}
              className="w-full py-3 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-blue-600/25 transition-all cursor-pointer flex items-center justify-center"
            >
              Đã hiểu
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
