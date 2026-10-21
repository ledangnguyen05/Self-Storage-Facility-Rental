import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface QrState {
  source: string
  dataUrl: string
  failed: boolean
}

/** Renders `text` as a QR code data URL (empty while generating, or when `text` is empty). */
export function useQrDataUrl(text: string | null | undefined, size = 200) {
  const [state, setState] = useState<QrState>({ source: '', dataUrl: '', failed: false })

  useEffect(() => {
    if (!text) return undefined
    let current = true
    QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then(dataUrl => {
        if (current) setState({ source: text, dataUrl, failed: false })
      })
      .catch(() => {
        if (current) setState({ source: text, dataUrl: '', failed: true })
      })
    return () => {
      current = false
    }
  }, [text, size])

  const isCurrent = Boolean(text) && state.source === text
  return {
    dataUrl: isCurrent ? state.dataUrl : '',
    isGenerating: Boolean(text) && !isCurrent,
    failed: isCurrent && state.failed,
  }
}
