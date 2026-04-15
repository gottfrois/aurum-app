import { useQuery } from 'convex/react'
import { History, MessageSquare, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import { formatRelativeShort, groupByDate } from '~/lib/date-groups'
import { api } from '../../../convex/_generated/api'

interface ChatHistoryPopoverProps {
  onOpenThread: (threadId: string) => void
}

export function ChatHistoryPopover({ onOpenThread }: ChatHistoryPopoverProps) {
  const { t } = useTranslation()
  const threads = useQuery(api.agentChatQueries.listThreads)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  if (threads !== undefined && threads.length === 0) {
    return null
  }

  const filtered = (threads ?? []).filter((t) => {
    if (!search.trim()) return true
    return (t.title ?? '').toLowerCase().includes(search.toLowerCase().trim())
  })

  const grouped = groupByDate(filtered, (t) => new Date(t.createdAt))

  function handleOpen(threadId: string) {
    onOpenThread(threadId)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <History className="size-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">
          {t('chat.conversationHistory')}
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="end" side="top" className="w-80 p-0">
        <div className="flex flex-col">
          <div className="border-b px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('chat.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {threads === undefined ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t('common.loading')}
              </div>
            ) : grouped.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-3 py-6">
                <MessageSquare className="size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {search ? t('chat.noMatching') : t('chat.noConversations')}
                </p>
              </div>
            ) : (
              grouped.map(({ group, items }) => (
                <div key={group}>
                  <div className="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground">
                    {group}
                  </div>
                  {items.map((thread) => (
                    <button
                      key={thread.threadId}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                      onClick={() => handleOpen(thread.threadId)}
                    >
                      <span className="flex-1 truncate">
                        {thread.title ?? t('chat.newChat')}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelativeShort(new Date(thread.createdAt))}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
