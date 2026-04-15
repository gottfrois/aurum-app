import { useUIMessages } from '@convex-dev/agent/react'
import { api } from '../../../convex/_generated/api'

/**
 * Invisible component that subscribes to a thread's messages to warm the
 * Convex query cache. Mounted when the user hovers a minimized chat tab so
 * that clicking the tab opens the conversation instantly — `useUIMessages`
 * in `ChatMessages` then picks up the already-cached first page instead of
 * going through `LoadingFirstPage`.
 *
 * Must use the exact same query + args as `ChatMessages` for the cache hit.
 */
export function ChatMessagesPrewarm({ threadId }: { threadId: string }) {
  useUIMessages(
    api.agentChatQueries.listThreadMessages,
    { threadId },
    { initialNumItems: 50, stream: true },
  )
  return null
}
