/**
 * Boxora Smart Storage AI Assistant Service
 * Secure Backend-proxied client communicating with Spring Boot /api/v1/chatbot/chat
 * All 26 Google Gemini API keys remain safe in backend server .env!
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
  signal?: AbortSignal
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

    const reply = response.data?.data?.reply
    if (reply) {
      return reply
    }
  } catch (err: unknown) {
    if ((err as Error)?.name === 'AbortError') {
      throw err
    }
    console.warn('Backend chatbot endpoint error, fallback to graceful response:', err)
  }

  // Graceful fallback response if backend encounters high load
  return `Dạ chào bạn! Hiện tại trợ lý ảo Boxora AI đang xử lý lượng yêu cầu cao. Bạn có thể tham khảo nhanh bảng giá và đặt kho tự động tại 👉 [Khám phá kho](/units) hoặc xem [Quy định & Tiêu chuẩn](/terms) để được hỗ trợ tức thì nhé!`
}
