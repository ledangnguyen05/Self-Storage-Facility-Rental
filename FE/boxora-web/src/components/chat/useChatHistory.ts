import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../../services/geminiChatService'
import { capHistory, clearChatHistory, loadChatHistory, purgeLegacyChatHistory, saveChatHistory } from './chatHistory'

interface HistoryState {
  owner: string
  messages: ChatMessage[]
}

const ownerOf = (userId: string | null | undefined) => userId || 'guest'

/**
 * Chat transcript scoped to the current user (guests share one anonymous
 * transcript). Switching account swaps the transcript; signing out deletes
 * the signed-out user's stored transcript. Capped at MAX_STORED_MESSAGES.
 */
export function useChatHistory(userId: string | null | undefined) {
  const owner = ownerOf(userId)
  const [state, setState] = useState<HistoryState>(() => ({ owner, messages: loadChatHistory(userId) }))
  const previousUserId = useRef(userId)

  // A different account (or sign-out) must never see the previous transcript.
  let current = state
  if (state.owner !== owner) {
    current = { owner, messages: loadChatHistory(userId) }
    setState(current)
  }

  useEffect(() => {
    purgeLegacyChatHistory()
  }, [])

  useEffect(() => {
    if (previousUserId.current && !userId) clearChatHistory(previousUserId.current)
    previousUserId.current = userId
  }, [userId])

  useEffect(() => {
    if (current.owner === owner) saveChatHistory(userId, current.messages)
  }, [current, owner, userId])

  const setMessages = useCallback(
    (update: (messages: ChatMessage[]) => ChatMessage[]) => {
      setState(prev => ({ owner: prev.owner, messages: capHistory(update(prev.messages)) }))
    },
    [],
  )

  const clear = useCallback(() => {
    setState(prev => ({ owner: prev.owner, messages: [] }))
  }, [])

  return { messages: current.messages, setMessages, clear }
}
