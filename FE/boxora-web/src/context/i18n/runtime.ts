import { EN_ENTRIES } from './entries'
import { createTranslator } from './translator'

/** The English translator. Loaded lazily (dynamic import) the first time the UI switches to English. */
export const englishTranslator = createTranslator(EN_ENTRIES)
