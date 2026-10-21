import { SHELL_ENTRIES } from './shell'
import { BACKEND_ENTRIES } from './backend'
import { PUBLIC_ENTRIES } from './public'
import { CUSTOMER_ENTRIES } from './customer'
import { MODALS_ENTRIES } from './modals'
import { STAFF_ENTRIES } from './staff'
import { MANAGER_ENTRIES } from './manager'
import { OPERATIONS_ENTRIES } from './operations'
import { ADMIN_ENTRIES } from './admin'
import { CORE_ENTRIES } from './core'
import { COMPOSED_ENTRIES } from './composed'

/** Vietnamese source text → English. Keys containing `{}` are parameterised patterns (see `../translator.ts`). */
export const EN_ENTRIES: Readonly<Record<string, string>> = {
  // Backend-composed messages first: any curated entry below wins over them.
  ...COMPOSED_ENTRIES,
  ...SHELL_ENTRIES,
  ...BACKEND_ENTRIES,
  ...PUBLIC_ENTRIES,
  ...CUSTOMER_ENTRIES,
  ...MODALS_ENTRIES,
  ...STAFF_ENTRIES,
  ...MANAGER_ENTRIES,
  ...OPERATIONS_ENTRIES,
  ...ADMIN_ENTRIES,
  // Hand-maintained entries last so they win over generated ones.
  ...CORE_ENTRIES,
}
