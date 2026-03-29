import { ShieldAlert } from 'lucide-react'
import { ChatEmptyState } from '~/components/chat/chat-empty-state'
import { ChatMessage } from '~/components/chat/chat-message'
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from '~/components/ui/chat-container'
import { Loader } from '~/components/ui/loader'
import { ScrollButton } from '~/components/ui/scroll-button'
import { SystemMessage } from '~/components/ui/system-message'
import type { ChatMessage as ChatMessageType } from '~/contexts/chat-context'

interface ChatMessagesProps {
  messages: ChatMessageType[]
  isThinking: boolean
  onSuggestionClick: (suggestion: string) => void
}

export function ChatMessages({
  messages,
  isThinking,
  onSuggestionClick,
}: ChatMessagesProps) {
  if (messages.length === 0 && !isThinking) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <ChatEmptyState onSuggestionClick={onSuggestionClick} />
      </div>
    )
  }

  return (
    <ChatContainerRoot className="relative flex-1">
      <ChatContainerContent className="gap-4 p-4">
        <SystemMessage
          variant="warning"
          icon={<ShieldAlert className="size-4" />}
        >
          Conversations are stored unencrypted on our servers.
        </SystemMessage>
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {isThinking && (
          <div className="flex items-center gap-2 px-1">
            <Loader variant="text-shimmer" text="Thinking..." />
          </div>
        )}
        <ChatContainerScrollAnchor />
      </ChatContainerContent>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
        <ScrollButton />
      </div>
    </ChatContainerRoot>
  )
}
