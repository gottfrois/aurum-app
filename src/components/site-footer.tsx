import { useQuery } from 'convex/react'
import { BotMessageSquare } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivateAgentDialog } from '~/components/activate-agent-dialog'
import { ChatConversationTab } from '~/components/chat/chat-conversation-tab'
import { ChatHistoryPopover } from '~/components/chat/chat-history-popover'
import { Button } from '~/components/ui/button'
import {
  useChatDispatch,
  useMinimizedThreads,
  useMockMinimizedConversations,
  useMockState,
} from '~/contexts/chat-context'
import { api } from '../../convex/_generated/api'

export function SiteFooter() {
  const { t } = useTranslation()
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
      <footer className="sticky bottom-0 z-30 flex h-(--header-height) shrink-0 items-center overflow-hidden border-t bg-background md:rounded-b-xl">
        <div className="flex w-full min-w-0 items-center justify-end gap-1 px-4 lg:gap-2 lg:px-6">
          {minimized.length > 0 && (
            <div className="flex min-w-0 items-center justify-end gap-1">
              {minimized.map((thread) => (
                <ChatConversationTab
                  key={thread.threadId}
                  conversation={{
                    id: thread.threadId,
                    title: thread.title ?? t('footer.newChat'),
                  }}
                  onOpen={() => dispatch.openThread(thread.threadId)}
                  onClose={() => dispatch.closeThread(thread.threadId)}
                />
              ))}
            </div>
          )}
          {minimized.length > 0 ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleAskBunkr}
              title={t('footer.askBunkr')}
            >
              <BotMessageSquare className="size-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleAskBunkr}>
              <BotMessageSquare className="size-4" />
              {t('footer.askBunkr')}
            </Button>
          )}
          {isEnabled && !mockState && (
            <ChatHistoryPopover onOpenThread={dispatch.openThread} />
          )}
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
