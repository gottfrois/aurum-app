import { useQuery } from 'convex/react'
import { BotMessageSquare } from 'lucide-react'
import { useState } from 'react'
import { ActivateAgentDialog } from '~/components/activate-agent-dialog'
import { ChatConversationTab } from '~/components/chat/chat-conversation-tab'
import { Button } from '~/components/ui/button'
import {
  useChatDispatch,
  useMinimizedConversations,
} from '~/contexts/chat-context'
import { api } from '../../convex/_generated/api'

export function SiteFooter() {
  const agentStatus = useQuery(api.agent.getAgentStatus)
  const [activateDialogOpen, setActivateDialogOpen] = useState(false)
  const minimized = useMinimizedConversations()
  const dispatch = useChatDispatch()

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
          {minimized.map((conv) => (
            <ChatConversationTab
              key={conv.id}
              conversation={conv}
              onOpen={() => dispatch.openConversation(conv.id)}
              onClose={() => dispatch.closeConversation(conv.id)}
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
