import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'

interface ChatConversationTabProps {
  conversation: { id: string; title: string }
  onOpen: () => void
  onClose: () => void
  /** Fires on first pointer/focus — used to prewarm the thread's messages. */
  onHover?: () => void
}

export function ChatConversationTab({
  conversation,
  onOpen,
  onClose,
  onHover,
}: ChatConversationTabProps) {
  const { t } = useTranslation()
  return (
    <div className="group flex h-8 max-w-40 min-w-16 shrink items-center gap-1 rounded-md bg-secondary px-2.5 text-secondary-foreground">
      <button
        type="button"
        title={conversation.title}
        className="min-w-0 shrink cursor-pointer overflow-hidden whitespace-nowrap text-sm"
        style={{
          maskImage:
            'linear-gradient(to right, black calc(100% - 1.5rem), transparent)',
          WebkitMaskImage:
            'linear-gradient(to right, black calc(100% - 1.5rem), transparent)',
        }}
        onClick={onOpen}
        onMouseEnter={onHover}
        onFocus={onHover}
      >
        {conversation.title}
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('chat.close')}
        className="size-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={onClose}
      >
        <X />
      </Button>
    </div>
  )
}
