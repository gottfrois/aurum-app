import * as React from 'react'

// --- Types ---

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

export interface ChatConversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
}

export type ChatPanelMode = 'closed' | 'popover' | 'expanded'

interface ChatState {
  conversations: ChatConversation[]
  activeConversationId: string | null
  panelMode: ChatPanelMode
  minimizedConversationIds: string[]
  isThinking: boolean
}

interface ChatDispatch {
  openNewChat: () => void
  openConversation: (id: string) => void
  minimizeChat: () => void
  expandChat: () => void
  collapseChat: () => void
  closeChat: () => void
  closeConversation: (id: string) => void
  sendMessage: (content: string) => void
}

// --- Contexts ---

const StateContext = React.createContext<ChatState | null>(null)
const DispatchContext = React.createContext<ChatDispatch | null>(null)

// --- Mock responses ---

const MOCK_RESPONSES = [
  'Based on your recent transactions, your total spending this month is approximately €3,240. The largest categories are Housing (€1,200), Groceries (€480), and Transportation (€320).',
  'Your net worth across all portfolios is currently €47,830, up 2.3% from last month. Your investment portfolio has grown by €1,120 this quarter.',
  "Looking at your spending patterns, you've been spending about 15% more on dining out compared to last month. You might want to review your restaurant expenses.",
  "Your savings rate this month is 22%, which is above your 3-month average of 18%. Great job! At this rate, you'll reach your emergency fund goal in about 4 months.",
  'I can see you have 3 active bank connections. All are syncing correctly. Your last transaction was recorded 2 hours ago.',
]

function getMockResponse(): string {
  return MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)]
}

function generateId(): string {
  return crypto.randomUUID()
}

function generateTitle(content: string): string {
  return content.length > 40 ? `${content.slice(0, 40)}...` : content
}

// --- Provider ---

const DEFAULT_STATE: ChatState = {
  conversations: [],
  activeConversationId: null,
  panelMode: 'closed',
  minimizedConversationIds: [],
  isThinking: false,
}

export function ChatProvider({
  children,
  initialState,
}: {
  children: React.ReactNode
  initialState?: Partial<ChatState>
}) {
  const [state, setState] = React.useState<ChatState>({
    ...DEFAULT_STATE,
    ...initialState,
  })

  const dispatch = React.useMemo<ChatDispatch>(() => {
    const openNewChat = () => {
      const id = generateId()
      const conversation: ChatConversation = {
        id,
        title: 'New chat',
        messages: [],
        createdAt: Date.now(),
      }
      setState((prev) => ({
        ...prev,
        conversations: [...prev.conversations, conversation],
        activeConversationId: id,
        panelMode: 'popover',
      }))
    }

    const openConversation = (id: string) => {
      setState((prev) => ({
        ...prev,
        activeConversationId: id,
        panelMode: 'popover',
        minimizedConversationIds: prev.minimizedConversationIds.filter(
          (cid) => cid !== id,
        ),
      }))
    }

    const minimizeChat = () => {
      setState((prev) => {
        const active = prev.conversations.find(
          (c) => c.id === prev.activeConversationId,
        )
        const shouldMinimize = active && active.messages.length > 0
        return {
          ...prev,
          panelMode: 'closed',
          activeConversationId: null,
          minimizedConversationIds: shouldMinimize
            ? [
                ...prev.minimizedConversationIds.filter(
                  (id) => id !== active.id,
                ),
                active.id,
              ]
            : prev.minimizedConversationIds,
          // Remove empty conversations when minimizing
          conversations: shouldMinimize
            ? prev.conversations
            : prev.conversations.filter(
                (c) => c.id !== prev.activeConversationId,
              ),
        }
      })
    }

    const expandChat = () => {
      setState((prev) => ({ ...prev, panelMode: 'expanded' }))
    }

    const collapseChat = () => {
      setState((prev) => ({ ...prev, panelMode: 'popover' }))
    }

    const closeChat = () => {
      setState((prev) => {
        // Remove the active conversation if it has no messages
        const active = prev.conversations.find(
          (c) => c.id === prev.activeConversationId,
        )
        const shouldRemove = active && active.messages.length === 0
        return {
          ...prev,
          panelMode: 'closed',
          activeConversationId: null,
          conversations: shouldRemove
            ? prev.conversations.filter(
                (c) => c.id !== prev.activeConversationId,
              )
            : prev.conversations,
        }
      })
    }

    const closeConversation = (id: string) => {
      setState((prev) => ({
        ...prev,
        conversations: prev.conversations.filter((c) => c.id !== id),
        minimizedConversationIds: prev.minimizedConversationIds.filter(
          (cid) => cid !== id,
        ),
        activeConversationId:
          prev.activeConversationId === id ? null : prev.activeConversationId,
      }))
    }

    const sendMessage = (content: string) => {
      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content,
        createdAt: Date.now(),
      }

      setState((prev) => ({
        ...prev,
        isThinking: true,
        conversations: prev.conversations.map((c) => {
          if (c.id !== prev.activeConversationId) return c
          const isFirstMessage = c.messages.length === 0
          return {
            ...c,
            title: isFirstMessage ? generateTitle(content) : c.title,
            messages: [...c.messages, userMessage],
          }
        }),
      }))

      // Mock assistant response after delay
      setTimeout(() => {
        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: getMockResponse(),
          createdAt: Date.now(),
        }
        setState((prev) => ({
          ...prev,
          isThinking: false,
          conversations: prev.conversations.map((c) => {
            if (c.id !== prev.activeConversationId) return c
            return { ...c, messages: [...c.messages, assistantMessage] }
          }),
        }))
      }, 500)
    }

    return {
      openNewChat,
      openConversation,
      minimizeChat,
      expandChat,
      collapseChat,
      closeChat,
      closeConversation,
      sendMessage,
    }
  }, [])

  return (
    <StateContext value={state}>
      <DispatchContext value={dispatch}>{children}</DispatchContext>
    </StateContext>
  )
}

// --- Hooks ---

export function useChatState(): ChatState {
  const ctx = React.useContext(StateContext)
  if (!ctx) throw new Error('useChatState must be used within ChatProvider')
  return ctx
}

export function useChatDispatch(): ChatDispatch {
  const ctx = React.useContext(DispatchContext)
  if (!ctx) throw new Error('useChatDispatch must be used within ChatProvider')
  return ctx
}

export function useActiveConversation(): ChatConversation | null {
  const { conversations, activeConversationId } = useChatState()
  if (!activeConversationId) return null
  return conversations.find((c) => c.id === activeConversationId) ?? null
}

export function useMinimizedConversations(): ChatConversation[] {
  const { conversations, minimizedConversationIds } = useChatState()
  return minimizedConversationIds
    .map((id) => conversations.find((c) => c.id === id))
    .filter((c): c is ChatConversation => c !== undefined)
}
