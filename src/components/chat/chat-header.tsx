import { Maximize2, Minimize2, Minus, Trash2, X } from 'lucide-react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useTranslation } from 'react-i18next'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Kbd } from '~/components/ui/kbd'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import type { ChatPanelMode } from '~/contexts/chat-context'
import { cn } from '~/lib/utils'

interface ChatHeaderProps {
  title: string
  mode: ChatPanelMode
  onMinimize: () => void
  onExpand: () => void
  onCollapse: () => void
  onClose: () => void
  onDelete?: () => void
}

export function ChatHeader({
  title,
  mode,
  onMinimize,
  onExpand,
  onCollapse,
  onClose,
  onDelete,
}: ChatHeaderProps) {
  const { t } = useTranslation()
  useHotkeys('escape', onMinimize, {
    enableOnFormTags: true,
    preventDefault: true,
  })

  return (
    <div
      data-slot="chat-header"
      className={cn(
        'flex shrink-0 items-center gap-2 border-b px-3 py-2',
        mode === 'expanded' && 'h-(--header-height) px-4 lg:px-6',
      )}
    >
      <Badge variant="secondary">{t('chat.beta')}</Badge>
      <span className="flex-1 truncate text-sm font-medium">{title}</span>
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-0.5">
          {onDelete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={onDelete}>
                  <Trash2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t('chat.deleteConversation')}
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={onMinimize}>
                <Minus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t('chat.minimize')} <Kbd>Esc</Kbd>
            </TooltipContent>
          </Tooltip>
          {mode === 'popover' ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={onExpand}>
                  <Maximize2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('chat.expand')}</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={onCollapse}>
                  <Minimize2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t('chat.collapse')}
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={onClose}>
                <X className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('chat.close')}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  )
}
