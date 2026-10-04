"use client"

import React, { useEffect, useState, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Sparkles, Loader2, MessageSquare, Target, Activity, Plus } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { getChatSessions, getSession, sendChatMessage } from "@/features/chat/actions"
import ReactMarkdown from "react-markdown"
import { useLanguage } from "@/contexts/LanguageContext"

type Message = { role: 'user' | 'model', content: string, action?: any }
type ChatSession = { id: string, title: string, updatedAt: string }

// Greeting placeholders, translated at render time so they follow the language toggle
const WELCOME_MARKER = '__welcome__'
const NEW_CHAT_MARKER = '__new_chat__'

function ChatContent() {
  const { t, language } = useLanguage()
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQuery = searchParams.get('q')
  const sessionParam = searchParams.get('sessionId')
  
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const initialQuerySent = useRef(false)

  useEffect(() => {
    loadSessions()
  }, [])

  useEffect(() => {
    if (sessionParam) {
      // The URL is updated to the session we just created; its messages are already on screen
      if (sessionParam !== activeSessionId) loadSession(sessionParam)
    } else if (initialQuery && !initialQuerySent.current) {
      initialQuerySent.current = true
      handleSend(initialQuery)
      // Remove query param without refreshing
      window.history.replaceState(null, '', '/chat')
    } else if (!sessionParam && !initialQuery && messages.length === 0) {
      // Default welcome
      setMessages([
        { role: 'model', content: WELCOME_MARKER }
      ])
    }
  }, [sessionParam, initialQuery])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  const loadSessions = async () => {
    const data = await getChatSessions()
    setSessions(data.map((d: any) => ({ id: d.id, title: d.title, updatedAt: d.updatedAt })))
  }

  const loadSession = async (id: string) => {
    setActiveSessionId(id)
    setIsTyping(true)
    const session = await getSession(id)
    if (session && session.messages) {
      const parsed = typeof session.messages === 'string' ? JSON.parse(session.messages) : session.messages
      setMessages(parsed as Message[])
    }
    setIsTyping(false)
  }

  const handleCreateNew = () => {
    setActiveSessionId(null)
    setMessages([
      { role: 'model', content: NEW_CHAT_MARKER }
    ])
    window.history.replaceState(null, '', '/chat')
  }

  const handleSend = async (overrideMsg?: string) => {
    const msg = overrideMsg || inputValue
    if (!msg.trim()) return

    setInputValue("")
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setIsTyping(true)

    try {
      const res = await sendChatMessage(activeSessionId, msg, language)
      if (res.error) {
        if (res.limitReached) {
          toast.error(t('chat.limit_title'), { description: t('chat.limit_desc', { limit: res.limit ?? 0 }) })
          setMessages(prev => [...prev, { role: 'model', content: t('chat.limit_msg', { limit: res.limit ?? 0 }) }])
        } else if (res.isQuota) {
          toast.error(t('chat.error_title'), { description: t('chat.error_quota_desc') })
          setMessages(prev => [...prev, { role: 'model', content: t('chat.error_quota_msg') }])
        } else {
          toast.error(t('chat.error_title'), { description: t('chat.error_desc') })
          setMessages(prev => [...prev, { role: 'model', content: t('chat.error_msg') }])
        }
      } else {
        if (res.sessionId && !activeSessionId) {
          setActiveSessionId(res.sessionId)
          window.history.replaceState(null, '', `/chat?sessionId=${res.sessionId}`)
          if (res.newSessionTitle) {
            const title = res.newSessionTitle
            setSessions(prev => [{ id: res.sessionId!, title, updatedAt: new Date().toISOString() }, ...prev.filter(s => s.id !== res.sessionId)])
          }
        }
        setMessages(prev => [...prev, { role: 'model', content: res.reply!, action: res.action }])
      }
    } catch (err) {
      toast.error(t('chat.server_error_title'), { description: t('chat.server_error_desc') })
      setMessages(prev => [...prev, { role: 'model', content: t('chat.server_error_msg') }])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-80px)] -mt-2 -mx-2 md:m-0 gap-4">
      {/* Sidebar (History) - Hidden on mobile unless opened */}
      <div className="hidden md:flex flex-col w-64 shrink-0 glass-panel border-r border-border/50 bg-background/50 overflow-y-auto p-4 rounded-xl">
        <Button onClick={handleCreateNew} className="w-full mb-4 shadow-sm bg-primary/10 text-primary hover:bg-primary/20 border-none">
          <Plus className="w-4 h-4 mr-2" /> {t('chat.new')}
        </Button>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t('chat.history')}</span>
        <div className="flex flex-col gap-2">
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => { router.push(`/chat?sessionId=${s.id}`) }}
              className={`text-left text-sm px-3 py-2.5 rounded-lg transition-colors truncate ${activeSessionId === s.id ? 'bg-primary/15 font-medium text-primary' : 'hover:bg-muted text-muted-foreground'}`}
            >
              <MessageSquare className="w-3.5 h-3.5 inline mr-2 opacity-70" />
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col glass-card border-none sm:border-solid shadow-none sm:shadow-sm overflow-hidden h-[calc(100vh-140px)] md:h-auto rounded-none sm:rounded-xl">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6">
          <AnimatePresence>
            {messages.map((m, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex flex-col max-w-[85%] ${m.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}
              >
                <div 
                  className={`px-4 py-3 rounded-2xl shadow-sm ${
                    m.role === 'user' 
                      ? 'bg-orange-500 text-white rounded-tr-none' 
                      : 'bg-muted/60 text-foreground rounded-tl-none border border-border/50'
                  }`}
                >
                  {m.role === 'model' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1">
                      <ReactMarkdown>{m.content === WELCOME_MARKER ? t('chat.welcome') : m.content === NEW_CHAT_MARKER ? t('chat.new_started') : m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>

                {/* Render Action Card if AI triggered a tool */}
                {m.action && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 w-full self-start max-w-sm">
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold mb-2">
                        <Target className="w-4 h-4" /> 
                        <span>{t('chat.goal_created')}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground bg-background/50 p-2 rounded-lg border border-border/40">
                        {m.action.title}
                      </p>
                      <Button variant="outline" size="sm" className="w-full mt-3 bg-background/50" onClick={() => router.push('/goals')}>
                        {t('chat.view_goals')}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 self-start bg-muted/50 text-muted-foreground px-4 py-3 rounded-2xl rounded-tl-none border border-border/50">
              <Sparkles className="w-4 h-4 animate-pulse text-primary" />
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-3 sm:p-4 border-t border-border/50 bg-background/50 backdrop-blur-md">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="relative flex items-center relative"
          >
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t('chat.placeholder')}
              disabled={isTyping}
              className="pr-12 rounded-full bg-muted/50 border-border/50 focus-visible:ring-1 focus-visible:ring-primary h-12 text-base shadow-inner"
            />
            <Button 
              type="submit" 
              size="icon" 
              disabled={isTyping || !inputValue.trim()}
              className="absolute right-1.5 rounded-full h-9 w-9 bg-primary hover:bg-primary/90 text-white shadow-md transition-transform active:scale-95 disabled:opacity-50"
            >
              {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
          <div className="text-center mt-2.5">
            <span className="text-[10px] sm:text-xs text-muted-foreground opacity-70">
              {t('chat.footer')}
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}

function ChatFallback() {
  const { t } = useLanguage()
  return <div className="w-full h-[60vh] flex flex-col items-center justify-center animate-in fade-in"><img src="/favicon.png" alt="Loading..." className="w-16 h-16 mb-4 drop-shadow-md animate-bounce" /><p className="font-medium animate-pulse text-muted-foreground">{t('chat.starting')}</p></div>
}

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatFallback />}>
      <ChatContent />
    </Suspense>
  )
}
