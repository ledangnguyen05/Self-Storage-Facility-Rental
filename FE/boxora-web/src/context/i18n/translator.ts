/**
 * Pure Vietnamese → English phrase translator (no DOM access).
 *
 * A string is translated only when its WHOLE trimmed text matches a dictionary entry:
 *   1. an exact entry ("Thuê kho ngay" → "Rent a unit now");
 *   2. the same entry ignoring letter case ("THUÊ KHO NGAY");
 *   3. an explicit parameterised pattern. A dictionary key that contains `{}` is a pattern; each `{}` captures
 *      one value ("Còn {} phòng" matches "Còn 5 phòng"). `{t}` captures a value that must itself be a known
 *      phrase ("Xem {t}" matches "Xem hợp đồng thuê" but not "Xem xyz"). `{*}` captures text a person typed (a reason
 *      or a note) and keeps it exactly as written: "Cơ sở từ chối: {*}". The English value refers to captures as
 *      `{1}`, `{2}` and may pluralise with `{1:unit|units}` (singular when the capture is exactly 1).
 *   A key ending in `@action` only applies to buttons and links, for words whose meaning differs there
 *   ("Từ chối" is the status "Rejected" but the button "Reject").
 * Anything else returns `null` and the caller leaves the Vietnamese text untouched. There is deliberately no
 * substring replacement: it produced half-translated sentences ("khoảng cách" → "about cách").
 */

export type Entries = Readonly<Record<string, string>>

export type TranslateContext = 'action'

export interface Translator {
  /** Translated text (surrounding whitespace preserved), or `null` when the whole text has no translation. */
  translate: (text: string, context?: TranslateContext) => string | null
  /** Number of exact entries and patterns, for diagnostics. */
  readonly size: { exact: number; patterns: number }
}

interface Pattern {
  regex: RegExp
  anchor: string
  literalLength: number
  template: string
  /** For each capture, whether it must itself be a known phrase (`{t}`). */
  strict: boolean[]
  /** For each capture, whether it is free text that is kept verbatim (`{*}`). */
  free: boolean[]
  /** Too little fixed text to be trusted on its own: every capture must then carry a digit. */
  weak: boolean
}

const PLACEHOLDER = /\{[t*]?\}/g
const ACTION_SUFFIX = '@action'
/** Fixed text with at least this many letters (or a structural delimiter plus 3 letters) makes a pattern trustworthy. */
const STRONG_LETTERS = 6
const DELIMITER = /[/·:%₫→–()#×+=|]/
/** A free capture or field may hold at most this many words and few lowercase "prose" words. */
const DATA_MAX_WORDS = 10
const WEAK_MAX_WORDS = 3
/** In "<datum> <known phrase>" the datum (a date, number or code) is at most this many words. */
const DATUM_MAX_WORDS = 3
/** Separators between independent fields of a composed line: "Boxora Q1 · Ca sáng 06:00 · Lan". */
const SEGMENT_SEPARATOR = /(\s?[·•|]\s|,\s)/
const HAS_LETTER = /\p{L}/u
/** The gap between two sentences: "Hủy đơn. Hoàn tiền." (a sentence end, then a capital letter, digit, quote or bracket). */
const SENTENCE_BREAK = /(?<=[.!?])\s+(?=[\p{Lu}\d"“([])/u
const MAX_SENTENCES = 5
/** Remembered translations; cleared when full so the list never grows without bound. */
const CACHE_LIMIT = 4000
/** "1. Ân hạn": a list number in front of a known phrase. */
const NUMBERED_PREFIX = /^(\d{1,2}[.)] )(.+)$/
const MAX_DEPTH = 3

/** Collapses every whitespace run (including no-break spaces) to one space and trims. */
export const collapseWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim()

const normalizeKey = (value: string) => collapseWhitespace(value.normalize('NFC'))
const foldKey = (value: string) => value.toLocaleLowerCase('vi')

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** `1.250.000` → `1,250,000`, `3,5` → `3.5`. Only touches bare numbers, optionally followed by ₫ or %. */
const VN_NUMBER = /^(-?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?( ?(?:₫|%))?$/

export function localizeNumber(core: string): string | null {
  const match = VN_NUMBER.exec(core)
  if (!match) return null
  const [, sign, integer, fraction, suffix = ''] = match
  if (!integer.includes('.') && fraction === undefined) return null
  const grouped = integer.replace(/\./g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}${grouped}${fraction !== undefined ? `.${fraction}` : ''}${suffix}`
}

/** "{} của {}" is too generic to match arbitrary sentences; "Còn {} phòng" and "{} / {} kho" are not. */
function isWeakPattern(literal: string): boolean {
  const letters = literal.match(/\p{L}/gu)?.length ?? 0
  if (letters >= STRONG_LETTERS) return false
  return !(letters >= 3 && DELIMITER.test(literal))
}

const wordCount = (value: string) => value.split(/\s+/).length
/** A lowercase word of two or more letters: the mark of a sentence ("đã hết hạn"), not of a name, code or date. */
const isProseWord = (word: string) => /^\p{Ll}\p{L}+$/u.test(word)
const proseCount = (value: string) => value.split(/\s+/).filter(isProseWord).length
const hasDigit = (value: string) => /\d/.test(value)

/**
 * A value that is plausibly data (number, code, name, address, date, email) rather than a sentence. Names and
 * codes are capitalised or numeric; a sentence has lowercase words. A value with a known unit ("5 ngày") is
 * translated as a whole before this check applies.
 */
function looksLikeData(value: string): boolean {
  return wordCount(value) <= DATA_MAX_WORDS && proseCount(value) === 0
}

/** A date, number or code, at most a few words, with no sentence words. */
const isDatum = (value: string) => hasDigit(value) && wordCount(value) <= DATUM_MAX_WORDS && proseCount(value) === 0

function matchCase(source: string, translation: string): string {
  const upper = source.toLocaleUpperCase('vi')
  return source === upper && source !== source.toLocaleLowerCase('vi') ? translation.toUpperCase() : translation
}

function applyTemplate(template: string, params: string[]): string {
  return template
    .replace(/\{(\d+):([^|{}]*)\|([^{}]*)\}/g, (_, index: string, singular: string, plural: string) => {
      const value = (params[Number(index) - 1] ?? '').replace(/[.,\s]/g, '')
      return value === '1' ? singular : plural
    })
    .replace(/\{(\d+)\}/g, (whole, index: string) => params[Number(index) - 1] ?? whole)
}

export function createTranslator(entries: Entries): Translator {
  const exact = new Map<string, string>()
  const folded = new Map<string, string>()
  const actions = new Map<string, string>()
  const patterns: Pattern[] = []

  for (const [rawKey, value] of Object.entries(entries)) {
    const key = normalizeKey(rawKey)
    if (!key || !value) continue
    if (key.endsWith(ACTION_SUFFIX)) {
      actions.set(key.slice(0, -ACTION_SUFFIX.length).trim(), value)
      continue
    }
    const placeholders = [...key.matchAll(PLACEHOLDER)]
    if (placeholders.length > 0) {
      const parts = key.split(PLACEHOLDER)
      const literal = parts.join('')
      if (!HAS_LETTER.test(literal)) continue
      const anchor = parts.map(part => part.trim()).sort((a, b) => b.length - a.length)[0] ?? ''
      patterns.push({
        regex: new RegExp(`^${parts.map(escapeRegExp).join('(.*?)')}$`, 'u'),
        anchor,
        literalLength: literal.length,
        template: value,
        strict: placeholders.map(match => match[0] === '{t}'),
        free: placeholders.map(match => match[0] === '{*}'),
        weak: isWeakPattern(literal),
      })
      continue
    }
    if (!exact.has(key)) exact.set(key, value)
    const lower = foldKey(key)
    if (!folded.has(lower)) folded.set(lower, value)
  }
  patterns.sort((a, b) => b.literalLength - a.literalLength)

  /** Translates a captured value; "01/07/2026 (112 ngày)" keeps its date and translates the known tail. */
  const translateParam = (value: string, depth: number): string | null => {
    const whole = translateCore(value, depth)
    if (whole !== null) return whole
    const words = value.split(' ')
    for (let i = 1; i < words.length; i++) {
      const head = words.slice(0, i).join(' ')
      const tail = words.slice(i).join(' ')
      const translatedTail = isDatum(head) ? translateCore(tail, depth) : null
      if (translatedTail !== null) return `${head} ${translatedTail}`
      const translatedHead = isDatum(tail) ? translateCore(head, depth) : null
      if (translatedHead !== null) return `${translatedHead} ${tail}`
    }
    return null
  }

  const translateCore = (core: string, depth: number, context?: TranslateContext): string | null => {
    if (context === 'action') {
      const action = actions.get(core)
      if (action !== undefined) return action
    }
    const hit = exact.get(core)
    if (hit !== undefined) return hit
    const number = localizeNumber(core)
    if (number !== null) return number
    if (!HAS_LETTER.test(core)) return null
    const fold = folded.get(foldKey(core))
    if (fold !== undefined) return matchCase(core, fold)
    if (depth >= MAX_DEPTH) return null
    const numbered = NUMBERED_PREFIX.exec(core)
    if (numbered) {
      const rest = translateCore(numbered[2], depth + 1)
      if (rest !== null) return `${numbered[1]}${rest}`
    }
    for (const pattern of patterns) {
      if (pattern.anchor && !core.includes(pattern.anchor)) continue
      const match = pattern.regex.exec(core)
      if (!match) continue
      const params: string[] = []
      let accepted = true
      for (let i = 1; i < match.length; i++) {
        const param = match[i]
        if (pattern.free[i - 1]) {
          params.push(param)
          continue
        }
        const trimmed = param.trim()
        const translated = trimmed ? translateParam(trimmed, depth + 1) : null
        if (pattern.strict[i - 1]) accepted = translated !== null
        else if (pattern.weak) accepted = trimmed === '' || (hasDigit(trimmed) && wordCount(trimmed) <= WEAK_MAX_WORDS && proseCount(trimmed) === 0)
        else if (translated === null && trimmed) accepted = looksLikeData(trimmed)
        if (!accepted) break
        params.push(translated ?? param)
      }
      if (accepted) return applyTemplate(pattern.template, params)
    }
    return depth <= 1 ? (translateSegments(core, depth) ?? translateSentences(core, depth)) : null
  }

  /**
   * "Hủy đơn. Hoàn 50% tiền cọc.": a few sentences, translated only when the whole text is covered. A known phrase
   * may itself span several sentences, so the longest run that matches an entry wins.
   */
  const translateSentences = (core: string, depth: number): string | null => {
    const sentences = core.split(SENTENCE_BREAK)
    if (sentences.length < 2 || sentences.length > MAX_SENTENCES) return null
    const out: string[] = []
    let start = 0
    while (start < sentences.length) {
      let translated: string | null = null
      let end = sentences.length
      for (; end > start; end--) {
        if (start === 0 && end === sentences.length) continue // the whole text was already tried
        translated = translateCore(sentences.slice(start, end).join(' '), depth + 1)
        if (translated !== null) break
      }
      if (translated === null) return null
      out.push(translated)
      start = end
    }
    return out.join(' ')
  }

  /** "Unit A-1, Sẵn sàng, chờ bàn giao": translates each field when every field is known or plain data. */
  const translateSegments = (core: string, depth: number): string | null => {
    const parts = core.split(SEGMENT_SEPARATOR)
    if (parts.length < 3) return null
    let translatedCount = 0
    const out: string[] = []
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (i % 2 === 1 || !part) {
        out.push(part)
        continue
      }
      const translated = translateParam(part, depth + 1)
      if (translated !== null) {
        translatedCount++
        out.push(translated)
      } else if (looksLikeData(part)) out.push(part)
      else return null
    }
    return translatedCount > 0 ? out.join('') : null
  }

  /** The same labels repeat across rows and re-renders; the result only depends on the text and the context. */
  const cache = new Map<string, string | null>()

  return {
    translate(text, context) {
      const core = normalizeKey(text)
      if (!core) return null
      const cacheKey = context ? `${context}|${core}` : core
      let result = cache.get(cacheKey)
      if (result === undefined) {
        result = translateCore(core, 0, context)
        if (cache.size >= CACHE_LIMIT) cache.clear()
        cache.set(cacheKey, result)
      }
      if (result === null) return null
      const lead = /^\s*/.exec(text)?.[0] ?? ''
      const trail = /\s*$/.exec(text)?.[0] ?? ''
      return lead + result + trail
    },
    size: { exact: exact.size, patterns: patterns.length },
  }
}
