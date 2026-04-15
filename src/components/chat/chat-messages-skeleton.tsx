import { ChatDisclaimer } from '~/components/chat/chat-disclaimer'
import {
  ChatContainerContent,
  ChatContainerRoot,
} from '~/components/ui/chat-container'
import { Message } from '~/components/ui/message'
import { Skeleton } from '~/components/ui/skeleton'

/**
 * Skeleton placeholder shown while the first page of thread messages is
 * loading (e.g. when reopening a minimized chat). Mirrors the bubble layout
 * of `ChatMessages` so the transition to real content is seamless.
 */
export function ChatMessagesSkeleton() {
  return (
    <ChatContainerRoot className="relative flex-1">
      <ChatContainerContent className="gap-4 p-4">
        <ChatDisclaimer />
        <MessageSkeleton variant="user" widthClass="w-40" />
        <MessageSkeleton variant="assistant" lines={3} />
        <MessageSkeleton variant="user" widthClass="w-56" />
        <MessageSkeleton variant="assistant" lines={2} />
      </ChatContainerContent>
    </ChatContainerRoot>
  )
}

function MessageSkeleton({
  variant,
  widthClass,
  lines = 1,
}: {
  variant: 'user' | 'assistant'
  widthClass?: string
  lines?: number
}) {
  if (variant === 'user') {
    return (
      <Message className="flex-row-reverse">
        <Skeleton className={`h-9 rounded-lg ${widthClass ?? 'w-32'}`} />
      </Message>
    )
  }

  return (
    <Message>
      <div className="flex w-full max-w-full flex-col gap-2 p-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
            key={i}
            className={`h-4 ${
              i === lines - 1 ? 'w-2/3' : i % 2 === 0 ? 'w-full' : 'w-11/12'
            }`}
          />
        ))}
      </div>
    </Message>
  )
}
