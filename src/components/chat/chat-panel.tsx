import { ChatHeader } from '~/components/chat/chat-header'
import { ChatInput } from '~/components/chat/chat-input'
import { ChatMessages } from '~/components/chat/chat-messages'
import { MockChatMessages } from '~/components/chat/mock-chat-messages'
import { Skeleton } from '~/components/ui/skeleton'
import {
  useActiveThread,
  useChatDispatch,
  useChatState,
  useMockActiveConversation,
  useMockState,
} from '~/contexts/chat-context'
import { cn } from '~/lib/utils'

export function ChatPanel() {
  const { panelMode, activeThreadId, isCreatingThread } = useChatState()
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
  if (panelMode === 'closed') return null
  if (!activeThreadId && !isCreatingThread) return null

  const title = thread?.title ?? 'New chat'
  const hasMessages = !!thread?.title

  const loadingContent = isCreatingThread && !activeThreadId

  if (panelMode === 'expanded') {
    return (
      <div className="flex flex-1 flex-col">
        <ChatHeader
          title={title}
          mode={panelMode}
          onMinimize={dispatch.minimizeChat}
          onExpand={dispatch.expandChat}
          onCollapse={dispatch.collapseChat}
          onClose={dispatch.closeChat}
        />
        {loadingContent ? (
          <ChatPanelSkeleton />
        ) : (
          <ChatMessages
            threadId={activeThreadId!}
            onSuggestionClick={dispatch.sendMessage}
          />
        )}
        <div className="mx-auto w-full max-w-3xl">
          <ChatInput
            onSend={dispatch.sendMessage}
            variant="secondary"
            hasMessages={hasMessages}
            disabled={loadingContent}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'fixed bottom-[calc(var(--header-height)+1rem)] right-4 z-40',
        'flex h-[calc(100dvh-6rem)] w-[420px] flex-col overflow-hidden',
        'rounded-lg border bg-popover shadow-lg',
        'animate-in fade-in-0 slide-in-from-bottom-2',
      )}
    >
      <ChatHeader
        title={title}
        mode={panelMode}
        onMinimize={dispatch.minimizeChat}
        onExpand={dispatch.expandChat}
        onCollapse={dispatch.collapseChat}
        onClose={dispatch.closeChat}
      />
      {loadingContent ? (
        <ChatPanelSkeleton />
      ) : (
        <ChatMessages
          threadId={activeThreadId!}
          onSuggestionClick={dispatch.sendMessage}
        />
      )}
      <ChatInput
        onSend={dispatch.sendMessage}
        hasMessages={hasMessages}
        disabled={loadingContent}
      />
    </div>
  )
}

function ChatPanelSkeleton() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Skeleton className="h-8 w-36 rounded-md" />
        <Skeleton className="h-8 w-44 rounded-md" />
        <Skeleton className="h-8 w-40 rounded-md" />
      </div>
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
        'fixed bottom-[calc(var(--header-height)+1rem)] right-4 z-40',
        'flex h-[calc(100dvh-6rem)] w-[420px] flex-col overflow-hidden',
        'rounded-lg border bg-popover shadow-lg',
        'animate-in fade-in-0 slide-in-from-bottom-2',
      )}
    >
      <ChatHeader
        title={conversation.title}
        mode="popover"
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
