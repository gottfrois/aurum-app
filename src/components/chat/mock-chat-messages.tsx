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
import type { MockChatMessage } from '~/contexts/chat-context'
import { cn } from '~/lib/utils'

interface MockChatMessagesProps {
  messages: MockChatMessage[]
  isThinking: boolean
  onSuggestionClick: (suggestion: string) => void
}

export function MockChatMessages({
  messages,
  isThinking,
  onSuggestionClick,
}: MockChatMessagesProps) {
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
        {messages.map((message) => {
          const isUser = message.role === 'user'
          return (
            <Message
              key={message.id}
              className={cn(isUser && 'flex-row-reverse')}
            >
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
                {message.content}
              </MessageContent>
            </Message>
          )
        })}
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
