import { useQuery } from 'convex/react'
import { BotMessageSquare } from 'lucide-react'
import { useState } from 'react'
import { ActivateAgentDialog } from '~/components/activate-agent-dialog'
import { ChatConversationTab } from '~/components/chat/chat-conversation-tab'
import { Button } from '~/components/ui/button'
import {
  useChatDispatch,
  useMinimizedThreads,
  useMockMinimizedConversations,
  useMockState,
} from '~/contexts/chat-context'
import { api } from '../../convex/_generated/api'

export function SiteFooter() {
  const agentStatus = useQuery(api.agent.getAgentStatus)
  const [activateDialogOpen, setActivateDialogOpen] = useState(false)
  const dispatch = useChatDispatch()
  const mockState = useMockState()

  // Use mock or Convex minimized threads
  const minimizedThreads = useMinimizedThreads()
  const mockMinimized = useMockMinimizedConversations()
  const minimized = mockState
    ? mockMinimized.map((c) => ({ threadId: c.id, title: c.title }))
    : minimizedThreads

  // Still loading or not authenticated
  if (agentStatus === undefined || agentStatus === null) return null

  const isOwner = agentStatus.isOwner
  const isEnabled = agentStatus.enabled

  if (!isOwner && !isEnabled) return null

  function handleAskBunkr() {
    if (isEnabled) {
      dispatch.openNewChat()
    } else {
      setActivateDialogOpen(true)
    }
  }

  return (
    <>
      <footer className="flex h-(--header-height) shrink-0 items-center border-t">
        <div className="flex w-full items-center justify-end gap-1 px-4 lg:gap-2 lg:px-6">
          {minimized.map((thread) => (
            <ChatConversationTab
              key={thread.threadId}
              conversation={{
                id: thread.threadId,
                title: thread.title ?? 'New chat',
              }}
              onOpen={() => dispatch.openThread(thread.threadId)}
              onClose={() => dispatch.closeThread(thread.threadId)}
            />
          ))}
          <Button variant="ghost" size="sm" onClick={handleAskBunkr}>
            <BotMessageSquare className="size-4" />
            Ask Bunkr...
          </Button>
        </div>
      </footer>
      {!isEnabled && (
        <ActivateAgentDialog
          open={activateDialogOpen}
          onOpenChange={setActivateDialogOpen}
        />
      )}
    </>
  )
}
