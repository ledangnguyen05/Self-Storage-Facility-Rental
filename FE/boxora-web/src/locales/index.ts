import { ENUMS_DICTIONARY } from './enums'
import { GLOBAL_DICTIONARY } from './global'
import { OPERATIONS_DICTIONARY } from './operations'
import { ADMIN_DICTIONARY } from './admin'
import { MANAGER_DICTIONARY } from './manager'
import { STAFF_DICTIONARY } from './staff'
import { CUSTOMER_DICTIONARY } from './customer'
import { PUBLIC_DICTIONARY } from './public'
import { MODALS_DICTIONARY } from './modals'

/**
 * Combined Domain-Specific Localization Dictionaries
 */
export const MODULAR_DICTIONARY: Record<string, string> = {
  ...ENUMS_DICTIONARY,
  ...GLOBAL_DICTIONARY,
  ...OPERATIONS_DICTIONARY,
  ...ADMIN_DICTIONARY,
  ...MANAGER_DICTIONARY,
  ...STAFF_DICTIONARY,
  ...CUSTOMER_DICTIONARY,
  ...PUBLIC_DICTIONARY,
  ...MODALS_DICTIONARY,
}

export {
  ENUMS_DICTIONARY,
  GLOBAL_DICTIONARY,
  OPERATIONS_DICTIONARY,
  ADMIN_DICTIONARY,
  MANAGER_DICTIONARY,
  STAFF_DICTIONARY,
  CUSTOMER_DICTIONARY,
  PUBLIC_DICTIONARY,
  MODALS_DICTIONARY,
}
