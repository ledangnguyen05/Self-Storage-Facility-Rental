import { useContext } from 'react'
import { LanguageContext } from './languageStore'

export { LanguageProvider } from './LanguageProvider'
export type { Language, LanguageContextType } from './languageStore'

export const useLanguage = () => useContext(LanguageContext)
export default LanguageContext
