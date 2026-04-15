import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChatBubble } from '~/components/chat/chat-bubble'
import { ChatDisclaimer } from '~/components/chat/chat-disclaimer'
import { ChatEmptyState } from '~/components/chat/chat-empty-state'
import { ChatHeader } from '~/components/chat/chat-header'
import { ChatInput } from '~/components/chat/chat-input'
import { ChatMessages } from '~/components/chat/chat-messages'
import { MockChatMessages } from '~/components/chat/mock-chat-messages'
import {
  ChatContainerContent,
  ChatContainerRoot,
} from '~/components/ui/chat-container'
import { Loader } from '~/components/ui/loader'
import {
  useActiveThread,
  useChatDispatch,
  useChatState,
  useMockActiveConversation,
  useMockState,
} from '~/contexts/chat-context'
import { cn } from '~/lib/utils'

export function ChatPanel() {
  const { t } = useTranslation()
  const {
    panelMode,
    activeThreadId,
    isCreatingThread,
    isDraftThread,
    pendingMessage,
  } = useChatState()
  const dispatch = useChatDispatch()
  const mockState = useMockState()
  const thread = useActiveThread()
  const mockConversation = useMockActiveConversation()
  const [isWaiting, setIsWaiting] = useState(false)
  const [prevThreadId, setPrevThreadId] = useState(activeThreadId)
  if (activeThreadId !== prevThreadId) {
    setPrevThreadId(activeThreadId)
    // Pessimistically assume an existing thread is streaming until
    // ChatMessages mounts and calls onWaitingChange with the real status.
    // A draft (null) has nothing to wait on, so leave the input enabled.
    setIsWaiting(!!activeThreadId)
  }
  const handleWaitingChange = useCallback((waiting: boolean) => {
    setIsWaiting(waiting)
  }, [])

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
  if (!activeThreadId && !isCreatingThread && !isDraftThread) return null

  const title = thread?.title ?? t('chat.newChat')
  const hasMessages = !!thread?.title || !!pendingMessage
  const inputDisabled = isCreatingThread || isWaiting

  const chatContent =
    pendingMessage && !activeThreadId ? (
      <PendingMessageView message={pendingMessage} />
    ) : activeThreadId ? (
      <ChatMessages
        threadId={activeThreadId}
        onSuggestionClick={dispatch.sendMessage}
        pendingMessage={pendingMessage}
        onWaitingChange={handleWaitingChange}
      />
    ) : (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <ChatEmptyState onSuggestionClick={dispatch.sendMessage} />
      </div>
    )

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
          onDelete={activeThreadId ? dispatch.deleteChat : undefined}
        />
        {chatContent}
        <div className="mx-auto w-full max-w-3xl">
          <ChatInput
            key={activeThreadId}
            onSend={dispatch.sendMessage}
            variant="secondary"
            hasMessages={hasMessages}
            disabled={inputDisabled}
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
        onDelete={activeThreadId ? dispatch.deleteChat : undefined}
      />
      {chatContent}
      <ChatInput
        key={activeThreadId}
        onSend={dispatch.sendMessage}
        hasMessages={hasMessages}
        disabled={inputDisabled}
      />
    </div>
  )
}

function PendingMessageView({ message }: { message: string }) {
  const { t } = useTranslation()
  return (
    <ChatContainerRoot className="relative flex-1">
      <ChatContainerContent className="gap-4 p-4">
        <ChatDisclaimer />
        <ChatBubble variant="user">{message}</ChatBubble>
        <div className="flex items-center gap-2 px-1">
          <Loader variant="text-shimmer" text={t('chat.thinking')} />
        </div>
      </ChatContainerContent>
    </ChatContainerRoot>
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
