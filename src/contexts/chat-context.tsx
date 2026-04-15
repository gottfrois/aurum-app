import { optimisticallySendMessage } from '@convex-dev/agent/react'
import { useMutation, useQuery } from 'convex/react'
import * as React from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { usePortfolio } from './portfolio-context'

// --- Types ---

export type ChatPanelMode = 'closed' | 'popover' | 'expanded'

interface ChatState {
  activeThreadId: string | null
  panelMode: ChatPanelMode
  minimizedThreadIds: string[]
  isCreatingThread: boolean
  isDraftThread: boolean
  draftPortfolioScope?: 'portfolio' | 'all' | 'team'
  draftPortfolioId?: Id<'portfolios'>
  pendingMessage: string | null
}

interface ChatDispatch {
  openNewChat: () => void
  openThread: (threadId: string) => void
  minimizeChat: () => void
  expandChat: () => void
  collapseChat: () => void
  closeChat: () => void
  closeThread: (threadId: string) => void
  deleteChat: () => void
  sendMessage: (content: string) => void
}

// --- Mock types (for Storybook) ---

export interface MockChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

export interface MockChatConversation {
  id: string
  title: string
  messages: MockChatMessage[]
  createdAt: number
}

// --- Contexts ---

const StateContext = React.createContext<ChatState | null>(null)
const DispatchContext = React.createContext<ChatDispatch | null>(null)

// --- Mock helpers ---

const MOCK_RESPONSES = [
  'Based on your recent transactions, your total spending this month is approximately \u20ac3,240. The largest categories are Housing (\u20ac1,200), Groceries (\u20ac480), and Transportation (\u20ac320).',
  'Your net worth across all portfolios is currently \u20ac47,830, up 2.3% from last month. Your investment portfolio has grown by \u20ac1,120 this quarter.',
  "Looking at your spending patterns, you've been spending about 15% more on dining out compared to last month. You might want to review your restaurant expenses.",
  "Your savings rate this month is 22%, which is above your 3-month average of 18%. Great job! At this rate, you'll reach your emergency fund goal in about 4 months.",
  'I can see you have 3 active bank connections. All are syncing correctly. Your last transaction was recorded 2 hours ago.',
]

function getMockResponse(): string {
  return MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)]
}

function generateMockTitle(content: string): string {
  return content.length > 40 ? `${content.slice(0, 40)}...` : content
}

// --- Mock State (for Storybook) ---

interface MockState extends ChatState {
  conversations: MockChatConversation[]
  isThinking: boolean
}

// --- Provider ---

const DEFAULT_STATE: ChatState = {
  activeThreadId: null,
  panelMode: 'closed',
  minimizedThreadIds: [],
  isCreatingThread: false,
  isDraftThread: false,
  pendingMessage: null,
}

export function ChatProvider({
  children,
  initialState,
  mockMode = false,
}: {
  children: React.ReactNode
  initialState?: Partial<MockState>
  mockMode?: boolean
}) {
  if (mockMode) {
    return (
      <MockChatProvider initialState={initialState}>
        {children}
      </MockChatProvider>
    )
  }

  return (
    <ConvexChatProvider initialState={initialState}>
      {children}
    </ConvexChatProvider>
  )
}

// --- Convex Provider (production) ---

const CHAT_STORAGE_KEY = 'bunkr:chat-state'

function loadChatState(): Partial<ChatState> {
  try {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY)
    if (!stored) return {}
    const parsed = JSON.parse(stored)
    return {
      activeThreadId: parsed.activeThreadId ?? null,
      panelMode: parsed.panelMode ?? 'closed',
      minimizedThreadIds: parsed.minimizedThreadIds ?? [],
    }
  } catch {
    return {}
  }
}

function saveChatState(state: ChatState) {
  try {
    localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({
        activeThreadId: state.activeThreadId,
        panelMode: state.panelMode,
        minimizedThreadIds: state.minimizedThreadIds,
      }),
    )
  } catch {
    // Storage full or unavailable
  }
}

function ConvexChatProvider({
  children,
  initialState,
}: {
  children: React.ReactNode
  initialState?: Partial<ChatState>
}) {
  const [state, setState] = React.useState<ChatState>(() => ({
    ...DEFAULT_STATE,
    ...loadChatState(),
    ...initialState,
  }))

  // Persist to localStorage on state changes
  React.useEffect(() => {
    saveChatState(state)
  }, [state])

  const { singlePortfolioId, activePortfolioId } = usePortfolio()
  const deleteThreadMutation = useMutation(api.agentChatQueries.deleteThread)
  const createThreadAndSendMessageMutation = useMutation(
    api.agentChatQueries.createThreadAndSendMessage,
  )
  const sendMessageMutation = useMutation(
    api.agentChatQueries.sendMessage,
  ).withOptimisticUpdate(
    optimisticallySendMessage(api.agentChatQueries.listThreadMessages),
  )
  const dispatch = React.useMemo<ChatDispatch>(() => {
    const openNewChat = () => {
      const portfolioScope = singlePortfolioId
        ? ('portfolio' as const)
        : activePortfolioId === 'team'
          ? ('team' as const)
          : ('all' as const)
      setState((prev) => ({
        ...prev,
        panelMode: 'popover',
        activeThreadId: null,
        isCreatingThread: false,
        isDraftThread: true,
        pendingMessage: null,
        draftPortfolioScope: portfolioScope,
        draftPortfolioId: singlePortfolioId ?? undefined,
      }))
    }

    const openThread = (threadId: string) => {
      setState((prev) => ({
        ...prev,
        activeThreadId: threadId,
        panelMode: 'popover',
        pendingMessage: null,
        isDraftThread: false,
        draftPortfolioScope: undefined,
        draftPortfolioId: undefined,
        minimizedThreadIds: prev.minimizedThreadIds.includes(threadId)
          ? prev.minimizedThreadIds
          : [...prev.minimizedThreadIds, threadId],
      }))
    }

    const minimizeChat = () => {
      setState((prev) => ({
        ...prev,
        panelMode: 'closed',
        activeThreadId: null,
        isDraftThread: false,
        pendingMessage: null,
        draftPortfolioScope: undefined,
        draftPortfolioId: undefined,
      }))
    }

    const expandChat = () => {
      setState((prev) => ({ ...prev, panelMode: 'expanded' }))
    }

    const collapseChat = () => {
      setState((prev) => ({ ...prev, panelMode: 'popover' }))
    }

    const closeChat = () => {
      setState((prev) => ({
        ...prev,
        panelMode: 'closed',
        minimizedThreadIds: prev.activeThreadId
          ? prev.minimizedThreadIds.filter((id) => id !== prev.activeThreadId)
          : prev.minimizedThreadIds,
        activeThreadId: null,
        isDraftThread: false,
        pendingMessage: null,
        draftPortfolioScope: undefined,
        draftPortfolioId: undefined,
      }))
    }

    const closeThread = (threadId: string) => {
      setState((prev) => ({
        ...prev,
        minimizedThreadIds: prev.minimizedThreadIds.filter(
          (id) => id !== threadId,
        ),
        activeThreadId:
          prev.activeThreadId === threadId ? null : prev.activeThreadId,
        panelMode: prev.activeThreadId === threadId ? 'closed' : prev.panelMode,
        pendingMessage:
          prev.activeThreadId === threadId ? null : prev.pendingMessage,
      }))
    }

    const deleteChat = () => {
      const threadId = state.activeThreadId
      if (!threadId) return
      void deleteThreadMutation({ threadId })
      setState((prev) => ({
        ...prev,
        panelMode: 'closed',
        activeThreadId: null,
        pendingMessage: null,
        minimizedThreadIds: prev.minimizedThreadIds.filter(
          (id) => id !== threadId,
        ),
      }))
    }

    const sendMessage = (content: string) => {
      const threadId = state.activeThreadId

      // Draft thread: create thread + send first message atomically
      if (!threadId && state.isDraftThread) {
        if (state.isCreatingThread) return // prevent double-sends
        setState((prev) => ({
          ...prev,
          isCreatingThread: true,
          pendingMessage: content,
        }))
        void createThreadAndSendMessageMutation({
          portfolioId: state.draftPortfolioId,
          portfolioScope: state.draftPortfolioScope,
          prompt: content,
        })
          .then(({ threadId: newThreadId }) => {
            setState((prev) => ({
              ...prev,
              activeThreadId: newThreadId,
              isDraftThread: false,
              isCreatingThread: false,
              draftPortfolioScope: undefined,
              draftPortfolioId: undefined,
              minimizedThreadIds: [...prev.minimizedThreadIds, newThreadId],
            }))
          })
          .catch(() => {
            setState((prev) => ({
              ...prev,
              isCreatingThread: false,
              pendingMessage: null,
            }))
          })
        return
      }

      if (!threadId) return
      void sendMessageMutation({ threadId, prompt: content })
      setState((prev) => {
        if (!prev.pendingMessage && prev.minimizedThreadIds.includes(threadId))
          return prev
        return {
          ...prev,
          pendingMessage: null,
          minimizedThreadIds: prev.minimizedThreadIds.includes(threadId)
            ? prev.minimizedThreadIds
            : [...prev.minimizedThreadIds, threadId],
        }
      })
    }

    return {
      openNewChat,
      openThread,
      minimizeChat,
      expandChat,
      collapseChat,
      closeChat,
      closeThread,
      deleteChat,
      sendMessage,
    }
  }, [
    createThreadAndSendMessageMutation,
    deleteThreadMutation,
    sendMessageMutation,
    state.activeThreadId,
    state.isDraftThread,
    state.isCreatingThread,
    state.draftPortfolioScope,
    state.draftPortfolioId,
    singlePortfolioId,
    activePortfolioId,
  ])

  return (
    <StateContext value={state}>
      <DispatchContext value={dispatch}>
        <ConvexThreadDataProvider>{children}</ConvexThreadDataProvider>
      </DispatchContext>
    </StateContext>
  )
}

// --- Mock Provider (Storybook) ---

const DEFAULT_MOCK_STATE: MockState = {
  ...DEFAULT_STATE,
  conversations: [],
  isThinking: false,
}

const MockStateContext = React.createContext<MockState | null>(null)

function MockChatProvider({
  children,
  initialState,
}: {
  children: React.ReactNode
  initialState?: Partial<MockState>
}) {
  const [mockState, setMockState] = React.useState<MockState>({
    ...DEFAULT_MOCK_STATE,
    ...initialState,
  })

  const state: ChatState = {
    activeThreadId: mockState.activeThreadId,
    panelMode: mockState.panelMode,
    minimizedThreadIds: mockState.minimizedThreadIds,
    isCreatingThread: false,
    isDraftThread: false,
    pendingMessage: null,
  }

  const dispatch = React.useMemo<ChatDispatch>(() => {
    const openNewChat = () => {
      const id = crypto.randomUUID()
      const conversation: MockChatConversation = {
        id,
        title: 'New chat',
        messages: [],
        createdAt: Date.now(),
      }
      setMockState((prev) => ({
        ...prev,
        conversations: [...prev.conversations, conversation],
        activeThreadId: id,
        panelMode: 'popover',
      }))
    }

    const openThread = (threadId: string) => {
      setMockState((prev) => ({
        ...prev,
        activeThreadId: threadId,
        panelMode: 'popover',
        minimizedThreadIds: prev.minimizedThreadIds.filter(
          (id) => id !== threadId,
        ),
      }))
    }

    const minimizeChat = () => {
      setMockState((prev) => {
        const active = prev.conversations.find(
          (c) => c.id === prev.activeThreadId,
        )
        const shouldMinimize = active && active.messages.length > 0
        return {
          ...prev,
          panelMode: 'closed',
          activeThreadId: null,
          minimizedThreadIds: shouldMinimize
            ? [
                ...prev.minimizedThreadIds.filter((id) => id !== active.id),
                active.id,
              ]
            : prev.minimizedThreadIds,
          conversations: shouldMinimize
            ? prev.conversations
            : prev.conversations.filter((c) => c.id !== prev.activeThreadId),
        }
      })
    }

    const expandChat = () => {
      setMockState((prev) => ({ ...prev, panelMode: 'expanded' }))
    }

    const collapseChat = () => {
      setMockState((prev) => ({ ...prev, panelMode: 'popover' }))
    }

    const closeChat = () => {
      setMockState((prev) => {
        const active = prev.conversations.find(
          (c) => c.id === prev.activeThreadId,
        )
        const shouldRemove = active && active.messages.length === 0
        return {
          ...prev,
          panelMode: 'closed',
          activeThreadId: null,
          conversations: shouldRemove
            ? prev.conversations.filter((c) => c.id !== prev.activeThreadId)
            : prev.conversations,
        }
      })
    }

    const closeThread = (threadId: string) => {
      setMockState((prev) => ({
        ...prev,
        conversations: prev.conversations.filter((c) => c.id !== threadId),
        minimizedThreadIds: prev.minimizedThreadIds.filter(
          (id) => id !== threadId,
        ),
        activeThreadId:
          prev.activeThreadId === threadId ? null : prev.activeThreadId,
      }))
    }

    const sendMessage = (content: string) => {
      const userMessage: MockChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        createdAt: Date.now(),
      }

      setMockState((prev) => ({
        ...prev,
        isThinking: true,
        conversations: prev.conversations.map((c) => {
          if (c.id !== prev.activeThreadId) return c
          const isFirstMessage = c.messages.length === 0
          return {
            ...c,
            title: isFirstMessage ? generateMockTitle(content) : c.title,
            messages: [...c.messages, userMessage],
          }
        }),
      }))

      setTimeout(() => {
        const assistantMessage: MockChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: getMockResponse(),
          createdAt: Date.now(),
        }
        setMockState((prev) => ({
          ...prev,
          isThinking: false,
          conversations: prev.conversations.map((c) => {
            if (c.id !== prev.activeThreadId) return c
            return { ...c, messages: [...c.messages, assistantMessage] }
          }),
        }))
      }, 500)
    }

    return {
      openNewChat,
      openThread,
      minimizeChat,
      expandChat,
      collapseChat,
      closeChat,
      closeThread,
      deleteChat: () => {},
      sendMessage,
    }
  }, [])

  return (
    <MockStateContext value={mockState}>
      <StateContext value={state}>
        <DispatchContext value={dispatch}>{children}</DispatchContext>
      </StateContext>
    </MockStateContext>
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

// --- Convex-dependent hooks ---
// These use a context flag to provide values without calling useQuery in mock mode.

type ActiveThreadValue = {
  threadId: string
  title: string | null
  portfolioScope: string | null
  portfolioId: string | null
} | null
type MinimizedThreadsValue = Array<{ threadId: string; title: string | null }>

const ActiveThreadContext = React.createContext<ActiveThreadValue>(null)
const MinimizedThreadsContext = React.createContext<MinimizedThreadsValue>([])

/** Provides Convex query results for active thread and minimized threads. */
function ConvexThreadDataProvider({ children }: { children: React.ReactNode }) {
  const { activeThreadId, minimizedThreadIds } = useChatState()

  const thread = useQuery(
    api.agentChatQueries.getThread,
    activeThreadId ? { threadId: activeThreadId } : 'skip',
  )
  const activeThread: ActiveThreadValue = activeThreadId
    ? (thread ?? {
        threadId: activeThreadId,
        title: null,
        portfolioScope: null,
        portfolioId: null,
      })
    : null

  const allThreads = useQuery(api.agentChatQueries.listThreads)
  const minimizedThreads: MinimizedThreadsValue = allThreads
    ? minimizedThreadIds
        .map((id) => allThreads.find((t) => t.threadId === id))
        .filter(
          (
            t,
          ): t is {
            threadId: string
            title: string | null
            createdAt: number
          } => t !== undefined,
        )
    : []

  return (
    <ActiveThreadContext value={activeThread}>
      <MinimizedThreadsContext value={minimizedThreads}>
        {children}
      </MinimizedThreadsContext>
    </ActiveThreadContext>
  )
}

/** Get active thread metadata (title). */
export function useActiveThread(): ActiveThreadValue {
  return React.useContext(ActiveThreadContext)
}

/** Get minimized threads metadata. */
export function useMinimizedThreads(): MinimizedThreadsValue {
  return React.useContext(MinimizedThreadsContext)
}

// --- Mock hooks (for Storybook) ---

export function useMockState(): MockState | null {
  return React.useContext(MockStateContext)
}

export function useMockActiveConversation(): MockChatConversation | null {
  const mockState = useMockState()
  if (!mockState?.activeThreadId) return null
  return (
    mockState.conversations.find((c) => c.id === mockState.activeThreadId) ??
    null
  )
}

export function useMockMinimizedConversations(): MockChatConversation[] {
  const mockState = useMockState()
  if (!mockState) return []
  return mockState.minimizedThreadIds
    .map((id) => mockState.conversations.find((c) => c.id === id))
    .filter((c): c is MockChatConversation => c !== undefined)
}
