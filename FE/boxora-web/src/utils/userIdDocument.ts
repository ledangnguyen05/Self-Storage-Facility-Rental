export type IdCardType = 'CCCD' | 'PASSPORT'

export const CCCD_PATTERN = /^[0-9]{12}$/
export const PASSPORT_PATTERN = /^[A-Za-z][0-9]{7,8}$/
export const ID_DOC_KEY = 'boxora_user_id_document'

export interface UserSavedIdDoc {
  preferredType: IdCardType
  cccd: string
  passport: string
}

export function isCccdValid(val: string): boolean {
  return CCCD_PATTERN.test(val.trim())
}

export function isPassportValid(val: string): boolean {
  return PASSPORT_PATTERN.test(val.trim())
}

/**
 * Loads the saved CCCD and Passport data for a user from localStorage.
 * Automatically resolves whether a stored value is a CCCD (12 digits) or Passport (1 letter + 7-8 digits),
 * even if previous code accidentally stored a passport number under a CCCD key.
 */
export function loadUserSavedIdDoc(user?: { id?: string; email?: string } | null): UserSavedIdDoc {
  let preferredType: IdCardType = 'CCCD'
  let cccd = ''
  let passport = ''

  if (!user) {
    return { preferredType, cccd, passport }
  }

  // 1. Read from boxora_user_id_document map
  try {
    const raw = localStorage.getItem(ID_DOC_KEY)
    if (raw) {
      const all = JSON.parse(raw)
      const entry = (user.id && all[user.id]) || (user.email && all[user.email])
      if (entry) {
        if (entry.type === 'PASSPORT' || entry.type === 'CCCD') {
          preferredType = entry.type
        }
        if (typeof entry.cccd === 'string') cccd = entry.cccd.trim()
        if (typeof entry.passport === 'string') passport = entry.passport.trim()

        // Handle legacy single-number entry
        if (entry.number) {
          const num = String(entry.number).trim()
          if (CCCD_PATTERN.test(num)) {
            if (!cccd) cccd = num
          } else if (PASSPORT_PATTERN.test(num)) {
            if (!passport) passport = num
          } else if (entry.type === 'PASSPORT') {
            if (!passport) passport = num
          } else {
            if (!cccd) cccd = num
          }
        }
      }
    }
  } catch {}

  const email = user.email ? user.email.trim() : ''

  // 2. Check legacy cccd keys (might contain CCCD or accidentally Passport)
  const legacyCccd =
    (user as any).identityCardNumber ||
    (email ? localStorage.getItem('boxora_user_cccd_' + email) : null) ||
    localStorage.getItem('boxora_user_cccd') ||
    ''

  if (legacyCccd) {
    const val = String(legacyCccd).trim()
    if (PASSPORT_PATTERN.test(val)) {
      if (!passport) passport = val
    } else if (CCCD_PATTERN.test(val)) {
      if (!cccd) cccd = val
    } else {
      if (!cccd) cccd = val
    }
  }

  // 3. Check legacy passport keys
  const legacyPassport =
    (email ? localStorage.getItem('boxora_user_passport_' + email) : null) ||
    localStorage.getItem('boxora_user_passport') ||
    ''

  if (legacyPassport && !passport) {
    passport = String(legacyPassport).trim()
  }

  // 4. Check preferred type key
  const legacyType =
    (email ? localStorage.getItem('boxora_user_id_type_' + email) : null) ||
    localStorage.getItem('boxora_user_id_type') ||
    ''

  if (legacyType === 'PASSPORT' || legacyType === 'CCCD') {
    preferredType = legacyType
  }

  // Auto-switch as requested:
  // "nếu customer chỉ có passport thì cần tự động chuyển sang option passport luon trong buoc 4 đặt lịch"
  if (!cccd && passport) {
    preferredType = 'PASSPORT'
  } else if (cccd && !passport) {
    preferredType = 'CCCD'
  }

  return { preferredType, cccd, passport }
}

/**
 * Saves both CCCD and Passport independently so switching between them
 * preserves both values and doesn't overwrite each other.
 */
export function saveUserSavedIdDoc(
  user: { id?: string; email?: string } | null,
  preferredType: IdCardType,
  cccd: string,
  passport: string
) {
  if (!user) return
  const cleanCccd = cccd.trim()
  const cleanPassport = passport.trim()
  const currentNumber = preferredType === 'CCCD' ? cleanCccd : cleanPassport

  try {
    const raw = localStorage.getItem(ID_DOC_KEY)
    const all = raw ? JSON.parse(raw) : {}
    const docData = {
      type: preferredType,
      number: currentNumber,
      cccd: cleanCccd,
      passport: cleanPassport
    }
    if (user.id) all[user.id] = docData
    if (user.email) all[user.email] = docData
    localStorage.setItem(ID_DOC_KEY, JSON.stringify(all))
  } catch {}

  const email = user.email ? user.email.trim() : ''

  if (cleanCccd) {
    if (email) localStorage.setItem('boxora_user_cccd_' + email, cleanCccd)
    localStorage.setItem('boxora_user_cccd', cleanCccd)
  }
  if (cleanPassport) {
    if (email) localStorage.setItem('boxora_user_passport_' + email, cleanPassport)
    localStorage.setItem('boxora_user_passport', cleanPassport)
  }
  if (email) localStorage.setItem('boxora_user_id_type_' + email, preferredType)
  localStorage.setItem('boxora_user_id_type', preferredType)
}

