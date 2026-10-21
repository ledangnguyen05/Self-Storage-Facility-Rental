import { STORAGE_KEYS } from '../../constants/storageKeys'
import { getJSON, removeItem, setJSON } from '../../lib/storage'
import type { ChatMessage } from '../../services/geminiChatService'

/** Messages kept per conversation, in memory and on disk. */
export const MAX_STORED_MESSAGES = 50

const GUEST_OWNER = 'guest'

/** One storage key per signed-in user, plus one for guests. */
export const chatHistoryKey = (userId: string | null | undefined): string =>
  `${STORAGE_KEYS.aiChatHistory}:${userId || GUEST_OWNER}`

const isChatMessage = (value: unknown): value is ChatMessage => {
  if (!value || typeof value !== 'object') return false
  const message = value as Partial<ChatMessage>
  return (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string'
}

export const capHistory = (messages: ChatMessage[]): ChatMessage[] =>
  messages.length > MAX_STORED_MESSAGES ? messages.slice(-MAX_STORED_MESSAGES) : messages

export function loadChatHistory(userId: string | null | undefined): ChatMessage[] {
  const stored = getJSON<unknown>(chatHistoryKey(userId), [])
  return Array.isArray(stored) ? capHistory(stored.filter(isChatMessage)) : []
}

export function saveChatHistory(userId: string | null | undefined, messages: ChatMessage[]): void {
  if (messages.length === 0) removeItem(chatHistoryKey(userId))
  else setJSON(chatHistoryKey(userId), capHistory(messages))
}

export function clearChatHistory(userId: string | null | undefined): void {
  removeItem(chatHistoryKey(userId))
}

/** Removes the old single, global key that every user and guest used to share. */
export function purgeLegacyChatHistory(): void {
  removeItem(STORAGE_KEYS.aiChatHistory)
}
