import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bot, ChevronRight, Maximize2, MessageSquare, Minimize2, RotateCcw, Send, Sparkles, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { isRequestCanceled } from '../../lib/apiError'
import {
  CHAT_MESSAGE_MAX_LENGTH,
  ChatServiceError,
  QUICK_SUGGESTIONS,
  sendChatMessage,
  type ChatFailureKind,
  type ChatMessage,
} from '../../services/geminiChatService'
import { Alert, Button, ConfirmDialog, IconButton, Spinner, Textarea, buttonVariants, cn } from '../ui'
import { ChatMessageContent } from './ChatMessageContent'
import { useChatHistory } from './useChatHistory'

const MAX_INPUT_HEIGHT_PX = 120
const CHAT_PANEL_ID = 'boxora-chat-panel'
/** `<html data-chat-launcher="portal">` tells index.css to keep a safe area under portal pages (see "Chat launcher safe area"). */
const LAUNCHER_ATTRIBUTE = 'data-chat-launcher'

const createMessage = (role: ChatMessage['role'], content: string): ChatMessage => ({ role, content, timestamp: Date.now() })

/** Why the last question got no answer. Kept out of the transcript, so it is never sent back to the model as if the bot had said it. */
interface ChatFailure {
  owner: string
  kind: ChatFailureKind
  message: string
}

const UNEXPECTED_FAILURE_MESSAGE = 'Không thể gửi câu hỏi lúc này. Vui lòng thử lại sau ít phút.'

/**
 * Floating AI assistant, bottom-right. The contact menu (FloatingContactWidget)
 * is stacked directly above this button on public pages. The transcript belongs to the
 * signed-in user and is deleted on sign-out.
 *
 * Inside the portal (`/portal/**`) the launcher is a compact 40px button and the page
 * content keeps a safe area below it, so it never covers pagination or save buttons.
 */
export const BoxoraChatWidget: React.FC = () => {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const inPortal = pathname === '/portal' || pathname.startsWith('/portal/')
  const owner = user?.id ?? 'guest'
  const { messages, setMessages, clear } = useChatHistory(user?.id)
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [input, setInput] = useState('')
  // The account a request is running for: after a sign-out or account switch nothing is "loading" any more.
  const [pendingOwner, setPendingOwner] = useState<string | null>(null)
  const isLoading = pendingOwner === owner
  const [hasUnread, setHasUnread] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [failure, setFailure] = useState<ChatFailure | null>(null)
  const visibleFailure = failure?.owner === owner ? failure : null

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const isOpenRef = useRef(isOpen)
  useEffect(() => {
    isOpenRef.current = isOpen
  })

  // Never leave a request running after the widget is gone, and never let a reply
  // started for one account land in another account's transcript.
  useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    [owner],
  )

  // Portal pages reserve room under their content for the launcher (padding rule lives in index.css).
  useEffect(() => {
    const root = document.documentElement
    if (!inPortal) return undefined
    root.setAttribute(LAUNCHER_ATTRIBUTE, 'portal')
    return () => root.removeAttribute(LAUNCHER_ATTRIBUTE)
  }, [inPortal])

  useEffect(() => {
    if (!isOpen) return undefined
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
    const frame = window.requestAnimationFrame(() => textareaRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading, visibleFailure])

  const closePanel = useCallback(() => {
    setIsOpen(false)
    launcherRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!isOpen) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !confirmReset) closePanel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, confirmReset, closePanel])

  const resizeInput = () => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, MAX_INPUT_HEIGHT_PX)}px`
  }

  /** Asks the question that ends `conversation` (the transcript already contains it). */
  const ask = async (conversation: ChatMessage[]) => {
    setFailure(null)
    setPendingOwner(owner)

    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller

    try {
      const reply = await sendChatMessage(conversation, controller.signal)
      if (controller.signal.aborted) return
      setMessages(prev => [...prev, createMessage('assistant', reply)])
      if (!isOpenRef.current) setHasUnread(true)
    } catch (error) {
      if (controller.signal.aborted || isRequestCanceled(error)) return
      const kind = error instanceof ChatServiceError ? error.kind : 'network'
      setFailure({ owner, kind, message: error instanceof ChatServiceError ? error.message : UNEXPECTED_FAILURE_MESSAGE })
      if (!isOpenRef.current) setHasUnread(true)
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setPendingOwner(null)
      }
    }
  }

  const handleSend = async (text: string) => {
    const question = text.trim().slice(0, CHAT_MESSAGE_MAX_LENGTH)
    if (!question || isLoading) return

    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const conversation = [...messages, createMessage('user', question)]
    setMessages(() => conversation)
    await ask(conversation)
  }

  const retryLast = () => {
    if (isLoading || messages[messages.length - 1]?.role !== 'user') return
    void ask(messages)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void handleSend(input)
    }
  }

  const resetConversation = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setPendingOwner(null)
    setFailure(null)
    clear()
    setConfirmReset(false)
  }

  const toggle = () => {
    setIsOpen(prev => {
      if (!prev) setHasUnread(false)
      return !prev
    })
  }

  return (
    <>
      <IconButton
        ref={launcherRef}
        icon={isOpen ? X : MessageSquare}
        variant="primary"
        size="lg"
        aria-label={isOpen ? 'Đóng trợ lý Boxora AI' : 'Mở trợ lý Boxora AI'}
        aria-expanded={isOpen}
        aria-controls={CHAT_PANEL_ID}
        className={cn(
          'fixed z-40 rounded-full shadow-md print:hidden',
          inPortal ? 'bottom-4 right-4 size-10' : 'bottom-4 right-4 size-12 sm:bottom-6 sm:right-6',
        )}
        onClick={toggle}
      />
      {!isOpen && hasUnread ? (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none fixed z-40 size-3 rounded-full border-2 border-surface bg-danger-solid print:hidden',
            inPortal ? 'bottom-12 right-4' : 'bottom-14 right-4 sm:bottom-16 sm:right-6',
          )}
        />
      ) : null}

      <section
        id={CHAT_PANEL_ID}
        role="dialog"
        aria-label="Trợ lý Boxora AI"
        className={cn(
          'fixed bottom-0 right-0 z-40 flex h-dvh w-full flex-col overflow-hidden border border-line bg-surface text-fg print:hidden',
          'sm:max-h-[80dvh] sm:rounded-xl sm:shadow-lg',
          inPortal ? 'sm:bottom-16 sm:right-4' : 'sm:bottom-20 sm:right-6',
          isExpanded ? 'sm:h-176 sm:w-xl' : 'sm:h-140 sm:w-96',
          !isOpen && 'hidden',
        )}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent-text">
              <Bot size={18} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-fg">Boxora AI</h2>
              <p className="truncate text-xs text-fg-subtle">Trợ lý trả lời tự động</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <IconButton
              icon={RotateCcw}
              size="sm"
              aria-label="Xóa cuộc trò chuyện"
              tooltip
              disabled={messages.length === 0 && !isLoading}
              onClick={() => setConfirmReset(true)}
            />
            <IconButton
              icon={isExpanded ? Minimize2 : Maximize2}
              size="sm"
              aria-label={isExpanded ? 'Thu nhỏ cửa sổ' : 'Phóng to cửa sổ'}
              tooltip
              className="max-sm:hidden"
              onClick={() => setIsExpanded(prev => !prev)}
            />
            <IconButton icon={X} size="sm" aria-label="Đóng trợ lý" onClick={closePanel} />
          </div>
        </header>

        <div role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto bg-canvas p-4">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-line bg-surface p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-fg">
                  <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" className="text-accent-text" />
                  Xin chào, tôi là trợ lý của Boxora
                </p>
                <p className="mt-1.5 text-dense text-fg-muted">
                  Hỏi tôi về thuê kho, bảng giá, quy trình nhận bàn giao hoặc mở khóa bằng mã PIN.
                </p>
              </div>
              <div className="space-y-2">
                <p className="px-1 text-xs font-medium text-fg-subtle">Gợi ý câu hỏi</p>
                {QUICK_SUGGESTIONS.map(suggestion => (
                  <Button
                    key={suggestion}
                    variant="secondary"
                    size="md"
                    fullWidth
                    className="justify-between text-left font-normal"
                    rightIcon={ChevronRight}
                    onClick={() => void handleSend(suggestion)}
                  >
                    <span className="truncate">{suggestion}</span>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => {
              const isBot = message.role === 'assistant'
              return (
                <div key={`${message.timestamp ?? 0}-${index}`} className={cn('flex', isBot ? 'justify-start' : 'justify-end')}>
                  <div
                    className={cn(
                      'max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm',
                      isBot ? 'rounded-bl-sm border border-line bg-surface text-fg' : 'rounded-br-sm bg-accent text-on-accent',
                    )}
                  >
                    <ChatMessageContent
                      content={message.content}
                      role={message.role}
                      onNavigate={() => {
                        if (window.matchMedia('(max-width: 639px)').matches) setIsOpen(false)
                      }}
                    />
                  </div>
                </div>
              )
            })
          )}

          {isLoading ? (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-xl rounded-bl-sm border border-line bg-surface px-3.5 py-2.5 text-sm text-fg-muted">
                <Spinner size="sm" label="" />
                Đang soạn câu trả lời…
              </div>
            </div>
          ) : null}

          {visibleFailure && !isLoading ? (
            <Alert
              tone={visibleFailure.kind === 'rate_limited' ? 'warning' : 'info'}
              title={visibleFailure.kind === 'unavailable' ? 'Trợ lý chưa sẵn sàng' : 'Chưa gửi được câu hỏi'}
              action={
                visibleFailure.kind === 'invalid' || visibleFailure.kind === 'rate_limited' ? undefined : (
                  <Button size="sm" variant="secondary" onClick={retryLast}>
                    Thử lại
                  </Button>
                )
              }
            >
              <p>{visibleFailure.message}</p>
              <Link
                to="/units"
                onClick={() => {
                  if (window.matchMedia('(max-width: 639px)').matches) setIsOpen(false)
                }}
                className={buttonVariants({ variant: 'link', size: 'sm', className: 'mt-1 px-0' })}
              >
                Khám phá kho
                <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </Alert>
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        <form
          className="shrink-0 border-t border-line p-3"
          onSubmit={event => {
            event.preventDefault()
            void handleSend(input)
          }}
        >
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={event => {
                setInput(event.target.value)
                resizeInput()
              }}
              onKeyDown={handleKeyDown}
              aria-label="Nội dung câu hỏi"
              maxLength={CHAT_MESSAGE_MAX_LENGTH}
              placeholder="Nhập câu hỏi của bạn…"
              className="max-h-30 min-h-8 resize-none"
            />
            <IconButton
              type="submit"
              icon={Send}
              variant="primary"
              aria-label="Gửi câu hỏi"
              disabled={!input.trim() || isLoading}
            />
          </div>
          <p className="mt-2 text-center text-xs text-fg-subtle">Thông tin do trợ lý AI cung cấp chỉ mang tính tham khảo.</p>
        </form>
      </section>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={resetConversation}
        tone="danger"
        title="Xóa cuộc trò chuyện?"
        description="Toàn bộ tin nhắn với trợ lý trên thiết bị này sẽ bị xóa và không thể khôi phục."
        confirmLabel="Xóa cuộc trò chuyện"
      />
    </>
  )
}

export default BoxoraChatWidget
