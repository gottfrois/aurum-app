import { ChatHeader } from '~/components/chat/chat-header'
import { ChatInput } from '~/components/chat/chat-input'
import { ChatMessages } from '~/components/chat/chat-messages'
import { MockChatMessages } from '~/components/chat/mock-chat-messages'
import {
  useActiveThread,
  useChatDispatch,
  useChatState,
  useMockActiveConversation,
  useMockState,
} from '~/contexts/chat-context'
import { cn } from '~/lib/utils'

export function ChatPanel() {
  const { panelMode, activeThreadId } = useChatState()
  const dispatch = useChatDispatch()
  const mockState = useMockState()
  const thread = useActiveThread()
  const mockConversation = useMockActiveConversation()

  // Mock mode (Storybook)
  if (mockState) {
    return (
      <MockChatPanel
        panelMode={panelMode}
        dispatch={dispatch}
        conversation={mockConversation}
        isThinking={mockState.isThinking}
      />
    )
  }

  // Convex mode
  if (panelMode === 'closed' || !activeThreadId) return null

  const title = thread?.title ?? 'New chat'

  if (panelMode === 'expanded') {
    return (
      <div className="flex flex-1 flex-col">
        <ChatHeader
          title={title}
          mode={panelMode}
          onNewChat={dispatch.openNewChat}
          onMinimize={dispatch.minimizeChat}
          onExpand={dispatch.expandChat}
          onCollapse={dispatch.collapseChat}
          onClose={dispatch.closeChat}
        />
        <ChatMessages
          threadId={activeThreadId}
          onSuggestionClick={dispatch.sendMessage}
        />
        <div className="mx-auto w-full max-w-3xl">
          <ChatInput onSend={dispatch.sendMessage} variant="secondary" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'fixed bottom-[calc(var(--header-height)+0.5rem)] right-4 z-40',
        'flex h-[calc(100dvh-6rem)] w-[420px] flex-col overflow-hidden',
        'rounded-lg border bg-popover shadow-lg',
        'animate-in fade-in-0 slide-in-from-bottom-2',
      )}
    >
      <ChatHeader
        title={title}
        mode={panelMode}
        onNewChat={dispatch.openNewChat}
        onMinimize={dispatch.minimizeChat}
        onExpand={dispatch.expandChat}
        onCollapse={dispatch.collapseChat}
        onClose={dispatch.closeChat}
      />
      <ChatMessages
        threadId={activeThreadId}
        onSuggestionClick={dispatch.sendMessage}
      />
      <ChatInput onSend={dispatch.sendMessage} />
    </div>
  )
}

/** Mock version of ChatPanel for Storybook */
function MockChatPanel({
  panelMode,
  dispatch,
  conversation,
  isThinking,
}: {
  panelMode: string
  dispatch: ReturnType<typeof useChatDispatch>
  conversation: ReturnType<typeof useMockActiveConversation>
  isThinking: boolean
}) {
  if (panelMode === 'closed' || !conversation) return null

  if (panelMode === 'expanded') {
    return (
      <div className="flex flex-1 flex-col">
        <ChatHeader
          title={conversation.title}
          mode="expanded"
          onNewChat={dispatch.openNewChat}
          onMinimize={dispatch.minimizeChat}
          onExpand={dispatch.expandChat}
          onCollapse={dispatch.collapseChat}
          onClose={dispatch.closeChat}
        />
        <MockChatMessages
          messages={conversation.messages}
          isThinking={isThinking}
          onSuggestionClick={dispatch.sendMessage}
        />
        <div className="mx-auto w-full max-w-3xl">
          <ChatInput
            onSend={dispatch.sendMessage}
            isLoading={isThinking}
            variant="secondary"
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'fixed bottom-[calc(var(--header-height)+0.5rem)] right-4 z-40',
        'flex h-[calc(100dvh-6rem)] w-[420px] flex-col overflow-hidden',
        'rounded-lg border bg-popover shadow-lg',
        'animate-in fade-in-0 slide-in-from-bottom-2',
      )}
    >
      <ChatHeader
        title={conversation.title}
        mode="popover"
        onNewChat={dispatch.openNewChat}
        onMinimize={dispatch.minimizeChat}
        onExpand={dispatch.expandChat}
        onCollapse={dispatch.collapseChat}
        onClose={dispatch.closeChat}
      />
      <MockChatMessages
        messages={conversation.messages}
        isThinking={isThinking}
        onSuggestionClick={dispatch.sendMessage}
      />
      <ChatInput onSend={dispatch.sendMessage} isLoading={isThinking} />
    </div>
  )
}
