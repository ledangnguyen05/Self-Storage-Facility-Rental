import React from 'react'

interface IoTTelemetryModalProps {
  isOpen: boolean
  onClose: () => void
  facilityName: string
  totalUnits: number
}

export const IoTTelemetryModal: React.FC<IoTTelemetryModalProps> = ({
  isOpen,
  onClose,
  facilityName,
  totalUnits
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="iot-status-title"
        className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="iot-status-title" className="text-lg font-bold text-slate-900">
              Hardware integration status
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {facilityName} · {totalUnits} storage units in the facility inventory
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close integration status"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex items-center gap-2 font-semibold">
            <span className="material-symbols-outlined">sensors_off</span>
            No device telemetry connection is configured
          </div>
          <p className="mt-2 text-sm leading-relaxed">
            Boxora has no connected gateway telemetry service. Device online state, battery, signal,
            temperature, humidity, and physical lock state cannot be verified. No ping or lock command was sent.
          </p>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </section>
    </div>
  )
}