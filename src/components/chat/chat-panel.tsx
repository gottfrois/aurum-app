import { ChatHeader } from '~/components/chat/chat-header'
import { ChatInput } from '~/components/chat/chat-input'
import { ChatMessages } from '~/components/chat/chat-messages'
import {
  useActiveConversation,
  useChatDispatch,
  useChatState,
} from '~/contexts/chat-context'
import { cn } from '~/lib/utils'

export function ChatPanel() {
  const { panelMode, isThinking } = useChatState()
  const dispatch = useChatDispatch()
  const conversation = useActiveConversation()

  if (panelMode === 'closed' || !conversation) return null

  if (panelMode === 'expanded') {
    return (
      <div className="flex flex-1 flex-col">
        <ChatHeader
          title={conversation.title}
          mode={panelMode}
          onNewChat={dispatch.openNewChat}
          onMinimize={dispatch.minimizeChat}
          onExpand={dispatch.expandChat}
          onCollapse={dispatch.collapseChat}
          onClose={dispatch.closeChat}
        />
        <ChatMessages
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
        mode={panelMode}
        onNewChat={dispatch.openNewChat}
        onMinimize={dispatch.minimizeChat}
        onExpand={dispatch.expandChat}
        onCollapse={dispatch.collapseChat}
        onClose={dispatch.closeChat}
      />
      <ChatMessages
        messages={conversation.messages}
        isThinking={isThinking}
        onSuggestionClick={dispatch.sendMessage}
      />
      <ChatInput onSend={dispatch.sendMessage} isLoading={isThinking} />
    </div>
  )
}
