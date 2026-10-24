/**
 * Boxora Smart Storage AI Assistant Service
 * Secure Backend-proxied client communicating with Spring Boot /api/v1/chatbot/chat
 * Gemini credentials are used only by the backend.
 */

import { api } from '../lib/axios'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
}

export const QUICK_SUGGESTIONS = [
  'Bảng giá thuê kho tại Boxora',
  'Làm sao để nhận Smart Key mở kho?',
  'Địa chỉ các chi nhánh Boxora ở đâu?',
  'Tôi muốn gửi nội thất khi dọn nhà',
  'Quy trình check-in tự động 24/7'
]

export async function sendChatMessage(
  messages: ChatMessage[],
  signal?: AbortSignal,
  unavailableMessage = 'Boxora AI is temporarily unavailable. Please try again later or browse storage options at /booking.'
): Promise<string> {
  const lastMessage = messages[messages.length - 1]?.content || ''
  const history = messages.slice(0, messages.length - 1).map(msg => ({
    role: msg.role,
    content: msg.content
  }))

  try {
    const response = await api.post(
      '/api/v1/chatbot/chat',
      {
        message: lastMessage,
        history
      },
      { signal }
    )

    const status = response.data?.data?.status
    if (status === 'UNAVAILABLE' || status === 'CONFIGURATION_ERROR') {
      return unavailableMessage
    }

    const reply = response.data?.data?.reply
    if (reply) {
      return reply
    }
  } catch (err: unknown) {
    if ((err as Error)?.name === 'AbortError') {
      throw err
    }
    console.warn('Boxora AI backend is unavailable')
  }

  // Graceful fallback response if backend encounters high load
  return unavailableMessage
}
