/**
 * Boxora AI assistant client. Talks only to the backend proxy
 * POST /api/v1/chatbot/chat; model keys stay on the server.
 *
 * The backend answers from live facility, price and policy data. When it cannot answer
 * (no model key configured, model unreachable, caller asking too fast) it replies with an
 * error status and this client throws a `ChatServiceError`, so the widget can say so honestly
 * instead of showing an invented reply.
 */

import { api } from '../lib/axios'
import { getApiErrorStatus, isRequestCanceled } from '../lib/apiError'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
}

/** Maximum number of earlier messages sent as context with each question. */
export const CHAT_HISTORY_LIMIT = 20

/** Longest question the backend accepts. */
export const CHAT_MESSAGE_MAX_LENGTH = 1000

export const QUICK_SUGGESTIONS = [
  'Bảng giá thuê kho tại Boxora',
  'Các cơ sở Boxora ở đâu?',
  'Quy trình thuê kho và nhận mã PIN',
  'Tôi cần kho để gửi đồ khi dọn nhà',
  'Chính sách hủy đặt kho và hoàn cọc',
]

export type ChatFailureKind = 'unavailable' | 'rate_limited' | 'invalid' | 'network'

const FAILURE_MESSAGES: Record<ChatFailureKind, string> = {
  unavailable: 'Trợ lý AI tạm thời chưa sẵn sàng. Bạn vẫn có thể xem kho trống và bảng giá tại trang Khám phá kho.',
  rate_limited: 'Bạn gửi câu hỏi hơi nhanh. Vui lòng đợi ít phút rồi hỏi tiếp.',
  invalid: 'Câu hỏi chưa hợp lệ. Hãy rút gọn nội dung rồi gửi lại.',
  network: 'Không kết nối được tới trợ lý. Vui lòng kiểm tra mạng và thử lại.',
}

/** The assistant could not answer. `message` is ready to show to the customer. */
export class ChatServiceError extends Error {
  readonly kind: ChatFailureKind

  constructor(kind: ChatFailureKind) {
    super(FAILURE_MESSAGES[kind])
    this.name = 'ChatServiceError'
    this.kind = kind
  }
}

const kindOfStatus = (status: number | undefined): ChatFailureKind => {
  if (status === 429) return 'rate_limited'
  if (status === 400) return 'invalid'
  if (status === 503 || status === 502 || status === 504) return 'unavailable'
  return 'network'
}

/**
 * Sends the conversation and returns the assistant reply.
 * The last message is the question; at most CHAT_HISTORY_LIMIT earlier
 * messages are sent as history. Rethrows when `signal` aborts the request and
 * throws `ChatServiceError` when the assistant cannot answer.
 */
export async function sendChatMessage(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const lastMessage = messages[messages.length - 1]?.content || ''
  const history = messages
    .slice(0, -1)
    .slice(-CHAT_HISTORY_LIMIT)
    .map((msg) => ({ role: msg.role, content: msg.content }))

  try {
    const response = await api.post('/api/v1/chatbot/chat', { message: lastMessage, history }, { signal })
    const reply = response.data?.data?.reply
    if (typeof reply === 'string' && reply.trim()) return reply
  } catch (err: unknown) {
    if (isRequestCanceled(err) || signal?.aborted) throw err
    throw new ChatServiceError(kindOfStatus(getApiErrorStatus(err)))
  }

  // A 200 without text is not an answer.
  throw new ChatServiceError('unavailable')
}
