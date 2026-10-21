import { useCallback, useState } from 'react'
import {
  EMPTY_FEES,
  EMPTY_REFUND_BANK,
  EMPTY_RETURN_INSPECTION,
  REFUND_METHOD_OPTIONS,
  type FeeKey,
  type RefundBank,
  type ReturnFees,
  type ReturnInspectionState,
  type ReturnItemKey,
  type ReturnPhotoKey,
  type ReturnPhotos,
} from '../return/returnInspection'

export const RETURN_STEP_COUNT = 4

/**
 * Form state of one return inspection. The wizard body is keyed by booking id,
 * so inspection, photos and deductions start empty for every contract.
 */
export function useReturnInspection() {
  const [step, setStep] = useState(0)
  const [inspection, setInspection] = useState<ReturnInspectionState>(EMPTY_RETURN_INSPECTION)
  const [photos, setPhotos] = useState<ReturnPhotos>({})
  const [notes, setNotes] = useState('')
  const [fees, setFees] = useState<ReturnFees>(EMPTY_FEES)
  const [overduePrefilled, setOverduePrefilled] = useState(false)
  const [reason, setReason] = useState('')
  const [refundMethod, setRefundMethod] = useState(REFUND_METHOD_OPTIONS[0].value)
  const [refundBank, setRefundBankState] = useState<RefundBank>(EMPTY_REFUND_BANK)
  /** CHECKOUT_REQUESTED bookings need an inspection record before settlement; kept so a retry skips it. */
  const [inspectionRecorded, setInspectionRecorded] = useState(false)

  const setItem = useCallback((key: ReturnItemKey, value: string) => {
    setInspection((current) => ({ ...current, [key]: value }))
  }, [])

  /** Photos are urls of files already uploaded to the server. */
  const setPhoto = useCallback((key: ReturnPhotoKey, value: string | undefined) => {
    setPhotos((current) => ({ ...current, [key]: value }))
  }, [])

  const setFee = useCallback((key: FeeKey, value: string) => {
    setFees((current) => ({ ...current, [key]: value }))
  }, [])

  /** Fills the late fee once from the backend estimate; staff can still change it. */
  const prefillOverdue = useCallback(
    (amount: number | null | undefined) => {
      if (overduePrefilled) return
      setOverduePrefilled(true)
      if (amount && amount > 0) setFees((current) => (current.overdueDebt ? current : { ...current, overdueDebt: String(Math.round(amount)) }))
    },
    [overduePrefilled],
  )

  const setRefundBank = useCallback((patch: Partial<RefundBank>) => {
    setRefundBankState((current) => ({ ...current, ...patch }))
  }, [])

  const goTo = useCallback((next: number) => setStep(Math.max(0, Math.min(RETURN_STEP_COUNT - 1, next))), [])

  return {
    step,
    goTo,
    inspection,
    setItem,
    photos,
    setPhoto,
    notes,
    setNotes,
    fees,
    setFee,
    prefillOverdue,
    reason,
    setReason,
    refundMethod,
    setRefundMethod,
    refundBank,
    setRefundBank,
    inspectionRecorded,
    setInspectionRecorded,
  }
}

export type ReturnInspectionForm = ReturnType<typeof useReturnInspection>
