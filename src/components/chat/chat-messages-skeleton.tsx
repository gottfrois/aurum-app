import { Message } from '~/components/ui/message'
import { Skeleton } from '~/components/ui/skeleton'

/**
 * Skeleton placeholder shown while the first page of thread messages is
 * loading (e.g. when opening a conversation from the history dropdown).
 * Bubbles are aligned to the bottom to match the scrolled-to-bottom state
 * messages land in — avoids a jarring top-aligned → bottom-aligned jump.
 * The disclaimer is intentionally omitted: it lives at the top of the
 * scroll container and would flash into view before being scrolled above
 * the fold when real messages arrive.
 */
export function ChatMessagesSkeleton() {
  return (
    <div className="flex flex-1 flex-col justify-end gap-4 p-4">
      <MessageSkeleton variant="user" widthClass="w-40" />
      <MessageSkeleton variant="assistant" lines={3} />
      <MessageSkeleton variant="user" widthClass="w-56" />
      <MessageSkeleton variant="assistant" lines={2} />
    </div>
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
