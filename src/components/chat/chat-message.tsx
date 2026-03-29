import { BotMessageSquare, User } from 'lucide-react'
import { Message, MessageContent } from '~/components/ui/message'
import type { MockChatMessage } from '~/contexts/chat-context'
import { cn } from '~/lib/utils'

interface ChatMessageProps {
  message: MockChatMessage
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

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
        {message.content}
      </MessageContent>
    </Message>
  )
}
