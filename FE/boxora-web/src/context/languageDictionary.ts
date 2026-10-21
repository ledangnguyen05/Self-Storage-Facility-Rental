/**
 * Vietnamese → English UI dictionary. Keys are the Vietnamese source copy; the entries live in `./i18n/entries/*`.
 * Only the English translator (`./i18n/runtime`) imports this data, and it is code-split so Vietnamese users
 * never download it.
 */
export { EN_ENTRIES as DICTIONARY } from './i18n/entries'
