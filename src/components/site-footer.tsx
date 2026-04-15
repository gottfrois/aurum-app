import { useQuery } from 'convex/react'
import { BotMessageSquare } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivateAgentDialog } from '~/components/activate-agent-dialog'
import { ChatConversationTab } from '~/components/chat/chat-conversation-tab'
import { ChatHistoryPopover } from '~/components/chat/chat-history-popover'
import { ChatMessagesPrewarm } from '~/components/chat/chat-messages-prewarm'
import { Button } from '~/components/ui/button'
import { HotkeyDisplay } from '~/components/ui/kbd'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip'
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
  // Thread IDs whose messages have been prewarmed via hover. Stays populated
  // for the session so re-hovering doesn't toggle subscriptions.
  const [prewarmedThreadIds, setPrewarmedThreadIds] = useState<Set<string>>(
    () => new Set(),
  )
  const prewarmThread = useCallback((threadId: string) => {
    setPrewarmedThreadIds((prev) => {
      if (prev.has(threadId)) return prev
      const next = new Set(prev)
      next.add(threadId)
      return next
    })
  }, [])

  // Use mock or Convex minimized threads
  const minimizedThreads = useMinimizedThreads()
  const mockMinimized = useMockMinimizedConversations()
  const minimized = mockState
    ? mockMinimized.map((c) => ({ threadId: c.id, title: c.title }))
    : minimizedThreads

  // Not authenticated
  if (agentStatus === null) return null

  // Still loading — render the footer shell with just the Ask Bunkr button
  // so the layout doesn't shift when data arrives. Minimized tabs and the
  // history button fill in once agentStatus resolves.
  if (agentStatus === undefined) {
    return (
      <footer className="sticky bottom-0 z-30 flex h-(--header-height) shrink-0 items-center overflow-hidden border-t bg-background md:rounded-b-xl">
        <div className="flex w-full min-w-0 items-center justify-end gap-1 px-4 lg:gap-2 lg:px-6">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" disabled>
                <BotMessageSquare className="size-4" />
                {t('footer.askBunkr')}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="flex items-center gap-2">
              <span>{t('footer.askBunkr')}</span>
              <HotkeyDisplay hotkey={{ keys: 'mod+j' }} />
            </TooltipContent>
          </Tooltip>
        </div>
      </footer>
    )
  }

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
                  onHover={
                    mockState ? undefined : () => prewarmThread(thread.threadId)
                  }
                />
              ))}
            </div>
          )}
          {/* Invisible subscribers that warm the Convex cache for hovered
              threads so opening a minimized chat feels instant. */}
          {!mockState &&
            minimized
              .filter((thread) => prewarmedThreadIds.has(thread.threadId))
              .map((thread) => (
                <ChatMessagesPrewarm
                  key={thread.threadId}
                  threadId={thread.threadId}
                />
              ))}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAskBunkr}
                className="shrink-0"
              >
                <BotMessageSquare className="size-4" />
                {t('footer.askBunkr')}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="flex items-center gap-2">
              <span>{t('footer.askBunkr')}</span>
              <HotkeyDisplay hotkey={{ keys: 'mod+j' }} />
            </TooltipContent>
          </Tooltip>
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
