import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import {
  MessageSquare,
  X,
  Send,
  RotateCcw,
  Bot,
  ExternalLink,
  ChevronRight,
  Maximize2,
  Minimize2,
  Sparkles
} from 'lucide-react'
import {
  sendChatMessage,
  ChatMessage,
  QUICK_SUGGESTIONS
} from '../../services/geminiChatService'

const STORAGE_KEY = 'boxora_ai_chat_history'

export const BoxoraChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const navigate = useNavigate()
  const { t } = useLanguage()

  // Save history on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch {
      // ignore storage error
    }
  }, [messages])

  // Scroll to bottom
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom('auto')
      setTimeout(() => textareaRef.current?.focus(), 200)
    }
  }, [isOpen])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    adjustTextareaHeight()
  }

  const handleSend = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend || input).trim()
      if (!text || isLoading) return

      setInput('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }

      const userMessage: ChatMessage = {
        role: 'user',
        content: text,
        timestamp: Date.now()
      }
      const updatedMessages = [...messages, userMessage]
      setMessages(updatedMessages)
      setIsLoading(true)

      const abortCtrl = new AbortController()
      abortControllerRef.current = abortCtrl

      try {
        const reply = await sendChatMessage(
          updatedMessages,
          abortCtrl.signal,
          t('Xin lỗi, trợ lý Boxora hiện tạm thời không khả dụng. Vui lòng thử lại sau.', 'Sorry, Boxora AI is temporarily unavailable. Please try again later.')
        )
        const botMessage: ChatMessage = {
          role: 'assistant',
          content: reply,
          timestamp: Date.now()
        }
        setMessages(prev => [...prev, botMessage])
        if (!isOpen) {
          setHasUnread(true)
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') {
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content:
                'Xin lỗi bạn, kết nối đến hệ thống hỗ trợ tạm thời gián đoạn. Bạn có thể kiểm tra trực tiếp tại [Đặt thuê kho](/booking) hoặc thử lại sau giây lát.',
              timestamp: Date.now()
            }
          ])
        }
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [input, isLoading, messages, isOpen, t]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleResetConversation = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setMessages([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  const toggleWidget = () => {
    setIsOpen(prev => {
      if (!prev) setHasUnread(false)
      return !prev
    })
  }

  // Parse markdown bold and links into clean modern interactive elements
  const renderFormattedMessage = (content: string, isBot: boolean) => {
    if (!isBot) {
      return <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{content}</div>
    }

    const parseBold = (textChunk: string, prefix: string) => {
      const parts: React.ReactNode[] = []
      const boldRegex = /\*\*([^*]+)\*\*/g
      let lastIdx = 0
      let match: RegExpExecArray | null

      while ((match = boldRegex.exec(textChunk)) !== null) {
        if (match.index > lastIdx) {
          parts.push(textChunk.substring(lastIdx, match.index))
        }
        parts.push(
          <strong key={`${prefix}-b-${match.index}`} className="font-semibold text-slate-900">
            {match[1]}
          </strong>
        )
        lastIdx = match.index + match[0].length
      }

      if (lastIdx < textChunk.length) {
        parts.push(textChunk.substring(lastIdx))
      }
      return parts
    }

    // Parse [button title](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    const blocks: React.ReactNode[] = []
    let lastIndex = 0
    let linkMatch: RegExpExecArray | null

    while ((linkMatch = linkRegex.exec(content)) !== null) {
      if (linkMatch.index > lastIndex) {
        const chunk = content.substring(lastIndex, linkMatch.index)
        blocks.push(...parseBold(chunk, `blk-${linkMatch.index}`))
      }

      const btnTitle = linkMatch[1]
      const btnUrl = linkMatch[2]
      const isExternal = btnUrl.startsWith('http')

      blocks.push(
        <span key={`btn-${linkMatch.index}`} className="inline-block my-1 mx-0.5">
          <button
            onClick={() => {
              if (isExternal) {
                window.open(btnUrl, '_blank')
              } else {
                navigate(btnUrl)
                if (window.innerWidth < 640) {
                  setIsOpen(false)
                }
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-50 hover:bg-blue-100/80 border border-blue-200/80 text-blue-700 text-xs font-medium transition-colors cursor-pointer group"
          >
            <span>{btnTitle}</span>
            {isExternal ? (
              <ExternalLink size={12} className="opacity-70 group-hover:opacity-100" />
            ) : (
              <ChevronRight size={13} className="text-blue-500 group-hover:translate-x-0.5 transition-transform" />
            )}
          </button>
        </span>
      )

      lastIndex = linkMatch.index + linkMatch[0].length
    }

    if (lastIndex < content.length) {
      blocks.push(...parseBold(content.substring(lastIndex), 'blk-end'))
    }

    return (
      <div className="space-y-1.5 text-[13.5px] leading-relaxed text-slate-800 whitespace-pre-wrap">
        {blocks}
      </div>
    )
  }

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-[9999]">
        <button
          onClick={toggleWidget}
          aria-label={isOpen ? 'Đóng trợ lý Boxora AI' : 'Mở trợ lý Boxora AI'}
          className={`relative flex items-center justify-center w-12 h-12 sm:w-13 sm:h-13 rounded-full shadow-lg transition-all duration-200 cursor-pointer ${
            isOpen
              ? 'bg-blue-600 hover:bg-blue-700 text-white rotate-90'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/25 hover:scale-105 active:scale-95'
          }`}
        >
          {isOpen ? (
            <X size={20} />
          ) : (
            <>
              <MessageSquare size={21} />
              {!isOpen && hasUnread && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
              )}
            </>
          )}
        </button>
      </div>

      {/* Modern SaaS Chat Window */}
      <div
        className={`fixed z-[9998] transition-all duration-200 ease-out flex flex-col bg-white border border-slate-200/90 shadow-[0_12px_48px_-8px_rgba(15,23,42,0.16),0_4px_16px_-2px_rgba(15,23,42,0.06)] ${
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        } ${
          isExpanded
            ? 'bottom-0 sm:bottom-5 right-0 sm:right-6 w-full sm:w-[580px] h-full sm:h-[720px] sm:max-h-[85vh] rounded-none sm:rounded-2xl'
            : 'bottom-0 sm:bottom-22 right-0 sm:right-6 w-full sm:w-[390px] h-[92vh] sm:h-[560px] sm:max-h-[calc(100vh-110px)] rounded-none sm:rounded-2xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 shrink-0 select-none">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 text-blue-600">
              <Bot size={18} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[13.5px] font-semibold text-slate-900 tracking-tight">Boxora AI</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                  {t('Trợ lý ảo', 'Assistant')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Trợ lý hỗ trợ tự động 24/7</p>
            </div>
          </div>

          <div className="flex items-center gap-0.5 text-slate-400">
            <button
              onClick={handleResetConversation}
              title="Làm mới cuộc trò chuyện"
              aria-label="Làm mới cuộc trò chuyện"
              className="p-1.5 rounded-md hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <RotateCcw size={15} />
            </button>
            <button
              onClick={() => setIsExpanded(prev => !prev)}
              title={isExpanded ? 'Thu nhỏ' : 'Phóng to'}
              aria-label={isExpanded ? 'Thu nhỏ' : 'Phóng to'}
              className="p-1.5 rounded-md hover:text-slate-700 hover:bg-slate-100 transition-colors hidden sm:block cursor-pointer"
            >
              {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button
              onClick={toggleWidget}
              title="Đóng chat"
              aria-label="Đóng chat"
              className="p-1.5 rounded-md hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Conversation Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/70 scrollbar-thin scrollbar-thumb-slate-200">
          {messages.length === 0 ? (
            <div className="py-2 space-y-4">
              {/* Minimal Welcome Card */}
              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-blue-600">
                  <Sparkles size={16} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Hỗ trợ khách hàng</span>
                </div>
                <p className="text-[13px] text-slate-700 leading-relaxed">
                  Xin chào! Tôi là trợ lý ảo của Boxora. Bạn cần tìm hiểu thông tin gì về việc thuê kho, bảng giá hay quy trình mở khóa Smart Key hôm nay?
                </p>
              </div>

              {/* Quick Prompt Suggestions */}
              <div className="space-y-2">
                <span className="text-[11px] font-medium text-slate-400 px-1">Gợi ý câu hỏi nhanh</span>
                <div className="flex flex-col gap-1.5">
                  {QUICK_SUGGESTIONS.map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(sug)}
                      className="w-full text-left text-xs text-slate-700 hover:text-blue-600 bg-white hover:bg-blue-50/40 border border-slate-200/80 hover:border-blue-200 rounded-lg px-3 py-2.5 transition-colors flex items-center justify-between group shadow-2xs cursor-pointer"
                    >
                      <span>{sug}</span>
                      <ChevronRight size={13} className="text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isBot = msg.role === 'assistant'
              return (
                <div
                  key={idx}
                  className={`flex gap-2.5 ${isBot ? 'justify-start items-start' : 'justify-end items-end'}`}
                >
                  {isBot && (
                    <div className="w-6 h-6 rounded-md bg-white border border-slate-200/90 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <Bot size={13} />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
                      isBot
                        ? 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs shadow-2xs'
                        : 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                    }`}
                  >
                    {renderFormattedMessage(msg.content, isBot)}
                  </div>
                </div>
              )
            })
          )}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex gap-2.5 justify-start items-start">
              <div className="w-6 h-6 rounded-md bg-white border border-slate-200/90 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <Bot size={13} />
              </div>
              <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-xs px-3.5 py-2.5 shadow-2xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Container */}
        <div className="p-3 bg-white border-t border-slate-100 shrink-0">
          <div className="relative flex items-end gap-1.5 bg-slate-50 border border-slate-200/90 rounded-xl p-1.5 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Nhập câu hỏi của bạn..."
              className="w-full bg-transparent border-none text-[13.5px] text-slate-800 placeholder-slate-400 outline-none resize-none px-2.5 py-1.5 max-h-28 scrollbar-none leading-relaxed"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              aria-label="Gửi tin nhắn"
              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-30 disabled:hover:bg-blue-600 transition-colors shrink-0 cursor-pointer shadow-2xs"
            >
              <Send size={14} />
            </button>
          </div>
          <p className="text-[10.5px] text-center text-slate-400 mt-1.5">
            Thông tin do trợ lý AI cung cấp mang tính tham khảo
          </p>
        </div>
      </div>
    </>
  )
}
