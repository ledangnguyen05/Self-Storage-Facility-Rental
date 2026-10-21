import { useCallback, useEffect, useState } from 'react'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import { getJSON, setJSON } from '@/lib/storage'
import { CHECKLIST_KEYS, EMPTY_CHECKLIST, type ChecklistState, type EvidencePhotos } from '../workbench/checklist'

export type CheckInStep = 0 | 1 | 2

/**
 * What survives a reload (sessionStorage): the wizard step and boolean flags
 * only. Photos, the PIN, ID numbers and free text never touch storage.
 */
export interface PersistedHandoverSession {
  step: CheckInStep
  checklist: ChecklistState
  inspectionRecorded: boolean
  isCompleted: boolean
  completedAt?: string
  emailSent: boolean
  /** The PIN email was handed to the background mail queue by the check-in call (the real outcome is not known yet). */
  emailQueued: boolean
  webPushSent: boolean
}

/** In-memory draft for the current tab only. */
export interface HandoverDraft {
  /** Urls of the evidence photos already uploaded to the server (never image data). */
  photos: EvidencePhotos
  rfidCard: string
  handoverNotes: string
  /** Returned once by the check-in API; kept in memory, never persisted. */
  accessPin: string
  /** Why the PIN email was not sent (from the server), empty when it was. */
  emailError: string
}

export type HandoverSession = PersistedHandoverSession & HandoverDraft
export type HandoverSessionPatch = Partial<Omit<HandoverSession, 'checklist' | 'photos'>> & {
  checklist?: Partial<ChecklistState>
  photos?: EvidencePhotos
}

const MAX_PERSISTED_SESSIONS = 40
const PERSISTED_KEYS = ['step', 'inspectionRecorded', 'isCompleted', 'completedAt', 'emailSent', 'emailQueued', 'webPushSent'] as const
const DRAFT_KEYS = ['rfidCard', 'handoverNotes', 'accessPin', 'emailError'] as const

const createPersisted = (): PersistedHandoverSession => ({
  step: 0,
  checklist: { ...EMPTY_CHECKLIST },
  inspectionRecorded: false,
  isCompleted: false,
  emailSent: false,
  emailQueued: false,
  webPushSent: false,
})

const createDraft = (): HandoverDraft => ({ photos: {}, rfidCard: '', handoverNotes: '', accessPin: '', emailError: '' })

const LEGACY_STEPS: Record<string, CheckInStep> = { audit: 0, checklist: 1, pin: 2 }

function toStep(value: unknown): CheckInStep {
  if (value === 0 || value === 1 || value === 2) return value
  if (typeof value === 'string' && value in LEGACY_STEPS) return LEGACY_STEPS[value]
  return 0
}

/** Keeps known boolean flags only; older drafts (base64 photos, PINs, ID numbers) are dropped. */
function sanitize(raw: unknown): PersistedHandoverSession | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const checklistRaw = (record.checklist && typeof record.checklist === 'object' ? record.checklist : {}) as Record<string, unknown>
  const checklist = { ...EMPTY_CHECKLIST }
  for (const key of CHECKLIST_KEYS) checklist[key] = checklistRaw[key] === true
  return {
    step: toStep(record.step ?? record.activeStepTab),
    checklist,
    inspectionRecorded: record.inspectionRecorded === true,
    isCompleted: record.isCompleted === true,
    completedAt: typeof record.completedAt === 'string' ? record.completedAt : undefined,
    emailSent: record.emailSent === true,
    emailQueued: record.emailQueued === true,
    webPushSent: record.webPushSent === true,
  }
}

function loadSessions(): Record<string, PersistedHandoverSession> {
  const raw = getJSON<Record<string, unknown>>(STORAGE_KEYS.handoverWorkbenchSessions, {}, 'session')
  const sessions: Record<string, PersistedHandoverSession> = {}
  if (!raw || typeof raw !== 'object') return sessions
  for (const [bookingId, value] of Object.entries(raw)) {
    const session = sanitize(value)
    if (session) sessions[bookingId] = session
  }
  return sessions
}

function trim(sessions: Record<string, PersistedHandoverSession>): Record<string, PersistedHandoverSession> {
  const entries = Object.entries(sessions)
  return entries.length <= MAX_PERSISTED_SESSIONS ? sessions : Object.fromEntries(entries.slice(-MAX_PERSISTED_SESSIONS))
}

/**
 * Per-booking check-in progress. Flags persist across reloads (sessionStorage,
 * this tab only); photos, the PIN and notes stay in memory.
 */
export function useHandoverSessions() {
  const [persisted, setPersisted] = useState<Record<string, PersistedHandoverSession>>(loadSessions)
  const [drafts, setDrafts] = useState<Record<string, HandoverDraft>>({})

  // Also rewrites legacy entries on first render, freeing the quota old photo drafts used.
  useEffect(() => {
    setJSON(STORAGE_KEYS.handoverWorkbenchSessions, persisted, 'session')
  }, [persisted])

  const getSession = useCallback(
    (bookingId: string): HandoverSession => ({
      ...createPersisted(),
      ...persisted[bookingId],
      ...createDraft(),
      ...drafts[bookingId],
    }),
    [persisted, drafts],
  )

  const updateSession = useCallback((bookingId: string, patch: HandoverSessionPatch) => {
    if (!bookingId) return
    const persistedPatch: Partial<PersistedHandoverSession> = {}
    for (const key of PERSISTED_KEYS) {
      if (key in patch) Object.assign(persistedPatch, { [key]: patch[key] })
    }
    const hasPersisted = Object.keys(persistedPatch).length > 0 || patch.checklist !== undefined
    if (hasPersisted) {
      setPersisted((current) => {
        const existing = current[bookingId] ?? createPersisted()
        const next = {
          ...existing,
          ...persistedPatch,
          checklist: patch.checklist ? { ...existing.checklist, ...patch.checklist } : existing.checklist,
        }
        const rest = { ...current }
        delete rest[bookingId]
        return trim({ ...rest, [bookingId]: next })
      })
    }

    const draftPatch: Partial<HandoverDraft> = {}
    for (const key of DRAFT_KEYS) {
      if (key in patch) Object.assign(draftPatch, { [key]: patch[key] })
    }
    if (Object.keys(draftPatch).length > 0 || patch.photos !== undefined) {
      setDrafts((current) => {
        const existing = current[bookingId] ?? createDraft()
        return {
          ...current,
          [bookingId]: {
            ...existing,
            ...draftPatch,
            photos: patch.photos ? { ...existing.photos, ...patch.photos } : existing.photos,
          },
        }
      })
    }
  }, [])

  return { getSession, updateSession }
}
