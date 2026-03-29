import { Maximize2, Minimize2, Minus, Plus, X } from 'lucide-react'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import type { ChatPanelMode } from '~/contexts/chat-context'
import { cn } from '~/lib/utils'

interface ChatHeaderProps {
  title: string
  mode: ChatPanelMode
  onNewChat: () => void
  onMinimize: () => void
  onExpand: () => void
  onCollapse: () => void
  onClose: () => void
}

export function ChatHeader({
  title,
  mode,
  onNewChat,
  onMinimize,
  onExpand,
  onCollapse,
  onClose,
}: ChatHeaderProps) {
  return (
    <div
      data-slot="chat-header"
      className={cn(
        'flex shrink-0 items-center gap-2 border-b px-3 py-2',
        mode === 'expanded' && 'h-(--header-height) px-4 lg:px-6',
      )}
    >
      <Badge variant="secondary">Beta</Badge>
      <span className="flex-1 truncate text-sm font-medium">{title}</span>
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon-sm" onClick={onNewChat}>
          <Plus className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onMinimize}>
          <Minus className="size-4" />
        </Button>
        {mode === 'popover' ? (
          <Button variant="ghost" size="icon-sm" onClick={onExpand}>
            <Maximize2 className="size-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" onClick={onCollapse}>
            <Minimize2 className="size-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
    </div>
  )
}
