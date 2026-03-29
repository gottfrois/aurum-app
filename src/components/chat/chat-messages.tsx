import {
  type UIMessage,
  useSmoothText,
  useUIMessages,
} from '@convex-dev/agent/react'
import { BotMessageSquare, ShieldAlert, User } from 'lucide-react'
import { ChatEmptyState } from '~/components/chat/chat-empty-state'
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from '~/components/ui/chat-container'
import { Loader } from '~/components/ui/loader'
import { Message, MessageContent } from '~/components/ui/message'
import { ScrollButton } from '~/components/ui/scroll-button'
import { SystemMessage } from '~/components/ui/system-message'
import { cn } from '~/lib/utils'
import { api } from '../../../convex/_generated/api'

interface ChatMessagesProps {
  threadId: string
  onSuggestionClick: (suggestion: string) => void
}

export function ChatMessages({
  threadId,
  onSuggestionClick,
}: ChatMessagesProps) {
  const { results: messages } = useUIMessages(
    api.agentChatQueries.listThreadMessages,
    { threadId },
    { initialNumItems: 50, stream: true },
  )

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <ChatEmptyState onSuggestionClick={onSuggestionClick} />
      </div>
    )
  }

  // Show "Thinking..." when waiting for assistant response:
  // - Last message is from the user (assistant hasn't started yet)
  // - Last message is assistant but has no text yet (pending/early streaming)
  const lastMessage = messages.at(-1)
  const isWaitingForReply =
    lastMessage?.role === 'user' ||
    (lastMessage?.role === 'assistant' &&
      !lastMessage.text &&
      lastMessage.status !== 'failed')

  return (
    <ChatContainerRoot className="relative flex-1">
      <ChatContainerContent className="gap-4 p-4">
        <SystemMessage
          variant="warning"
          icon={<ShieldAlert className="size-4" />}
        >
          Conversations are stored unencrypted on our servers.
        </SystemMessage>
        {messages.map((msg) => (
          <ChatMessageBubble key={msg.key} message={msg} />
        ))}
        {isWaitingForReply && (
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

function ChatMessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user'
  const [visibleText] = useSmoothText(message.text, {
    startStreaming: message.status === 'streaming',
  })

  // Skip empty assistant messages (pending before any text arrives)
  if (!isUser && !visibleText) return null

  return (
    <Message className={cn(isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        {isUser ? (
          <User className="size-3.5" />
        ) : (
          <BotMessageSquare className="size-3.5" />
        )}
      </div>
      <MessageContent
        markdown={!isUser}
        className={cn(
          'max-w-[80%] text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground',
        )}
      >
        {visibleText}
      </MessageContent>
    </Message>
  )
}
