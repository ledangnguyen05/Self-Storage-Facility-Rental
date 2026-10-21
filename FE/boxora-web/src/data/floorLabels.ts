/**
 * The only place that knows how a floor name is spelled. The database holds floor labels written over time
 * (`Floor 1`, `Tầng 1`, `Tang 1`, `B1`...); every screen that shows or filters by floor goes through `normalizeFloor`,
 * so one floor is always one option and one label (`Tầng 1`). The server stores the same canonical labels
 * (see `FloorLabels` in the backend), this keeps the UI correct for any older value that still slips through.
 */

export interface NormalizedFloor {
  /** `'1'`, `'2'`, `'0'` (ground), `'B1'`, or `''` when unknown. Same floor = same key, whatever the spelling. */
  key: string
  /** `Tầng 1`, `Hầm 1`, `Tầng trệt`, the original text for names it cannot read, or `—` when empty. */
  label: string
}

/** Lowercase, accent-free text with single spaces. */
const fold = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLocaleLowerCase('vi-VN')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export function normalizeFloor(raw: string | null | undefined): NormalizedFloor {
  const text = (raw ?? '').trim()
  if (!text) return { key: '', label: '—' }
  const normalized = fold(text)

  const basement = /\b(?:b|ham|basement)\s*(\d+)\b/.exec(normalized)
  if (basement) return { key: `B${Number(basement[1])}`, label: `Hầm ${Number(basement[1])}` }

  const digits = /\d+/.exec(normalized)
  if (digits) return { key: String(Number(digits[0])), label: `Tầng ${Number(digits[0])}` }

  if (/\b(?:ground|tret|g)\b/.test(normalized)) return { key: '0', label: 'Tầng trệt' }
  return { key: normalized, label: text }
}

/** Display label of a floor (`Tầng 1`), `—` when the unit has none. */
export const formatFloorLabel = (raw: string | null | undefined): string => normalizeFloor(raw).label

/** Sort order for floor keys: basements first, then ascending floors. */
export function compareFloorKeys(a: string, b: string): number {
  const rank = (key: string) => {
    if (/^B\d+$/.test(key)) return -Number(key.slice(1))
    const n = Number(key)
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
  }
  const diff = rank(a) - rank(b)
  return diff !== 0 ? diff : a.localeCompare(b, 'vi')
}

/** Distinct floors of a list of units as filter options: one entry per floor, in floor order. */
export function floorOptionsOf(rawFloors: ReadonlyArray<string | null | undefined>): NormalizedFloor[] {
  const byKey = new Map<string, NormalizedFloor>()
  for (const raw of rawFloors) {
    const floor = normalizeFloor(raw)
    if (floor.key && !byKey.has(floor.key)) byKey.set(floor.key, floor)
  }
  return [...byKey.values()].sort((a, b) => compareFloorKeys(a.key, b.key))
}
