import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { getApiErrorMessage } from '../../../lib/apiError'

/** QR code (PNG data URL) for `value`, regenerated when it changes. */
export function useQrDataUrl(value: string): { qrCode: string; error: string } {
  const [state, setState] = useState({ value: '', qrCode: '', error: '' })

  useEffect(() => {
    if (!value) return undefined
    let isCurrent = true
    QRCode.toDataURL(value, { width: 220, margin: 1, errorCorrectionLevel: 'M' })
      .then((dataUrl: string) => {
        if (isCurrent) setState({ value, qrCode: dataUrl, error: '' })
      })
      .catch((err: unknown) => {
        if (isCurrent) setState({ value, qrCode: '', error: getApiErrorMessage(err, 'Không thể tạo mã QR.') })
      })
    return () => {
      isCurrent = false
    }
  }, [value])

  // Ignore a result that belongs to a previous value.
  return state.value === value ? { qrCode: state.qrCode, error: state.error } : { qrCode: '', error: '' }
}
