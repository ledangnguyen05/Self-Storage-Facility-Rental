/**
 * Every Web Storage key used by the app. Read and write them through
 * `lib/storage.ts`. Only auth tokens may be kept long-term; never store PINs.
 */
export const STORAGE_KEYS = {
  /** localStorage: JWT access token. */
  accessToken: 'boxora_access_token',
  /** localStorage: refresh token (the backend also sets an HttpOnly cookie). */
  refreshToken: 'boxora_refresh_token',
  /** localStorage: normalized `User` JSON for the current session. */
  user: 'boxora_user',
  /** localStorage: theme / font size / language / notification preferences. */
  webSettings: 'boxora_web_settings',
  /** localStorage: Boxora AI chat transcript. */
  aiChatHistory: 'boxora_ai_chat_history',
  /** localStorage: in-app notification feed (NotificationCenter, staff workbench). */
  inAppNotifications: 'boxora_in_app_notifications',
  /** sessionStorage: staff handover workbench drafts. */
  handoverWorkbenchSessions: 'boxora_handover_workbench_sessions',
  /** localStorage: desktop sidebar collapsed to the icon rail. */
  sidebarCollapsed: 'boxora_sidebar_collapsed',
  /** localStorage: per-user ids of in-app notifications marked as read. */
  notificationReadIds: 'boxora_notification_read_ids',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

/** localStorage prefix for a locally drawn contract signature: `boxora_sig_<contractId>`. */
export const CONTRACT_SIGNATURE_KEY_PREFIX = 'boxora_sig_'
export const contractSignatureKey = (contractId: string) => `${CONTRACT_SIGNATURE_KEY_PREFIX}${contractId}`

/** Keys that hold the auth session; cleared together on logout or session expiry. */
export const AUTH_STORAGE_KEYS = [STORAGE_KEYS.accessToken, STORAGE_KEYS.refreshToken, STORAGE_KEYS.user] as const

/**
 * Prefixes written by the removed client-side "rental access" simulation
 * (utils/rentalAccess). Purged on startup; nothing reads them any more.
 */
export const LEGACY_STORAGE_PREFIXES = ['boxora_customer_rentals_', 'boxora_is_new_customer_'] as const

/** Window CustomEvent names used for cross-component signals. */
export const APP_EVENTS = {
  /** Dispatched by lib/axios when the refresh token is rejected; AuthContext clears state. */
  sessionExpired: 'boxora:session-expired',
  /** Dispatched by utils/webSettings after settings are saved. */
  settingsChanged: 'boxora_settings_changed',
  /** Dispatched when a new in-app notification is pushed to STORAGE_KEYS.inAppNotifications. */
  notificationPushed: 'boxora_notification_pushed',
} as const
