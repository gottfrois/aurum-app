import { X } from 'lucide-react'
import { Button } from '~/components/ui/button'

interface ChatConversationTabProps {
  conversation: { id: string; title: string }
  onOpen: () => void
  onClose: () => void
}

export function ChatConversationTab({
  conversation,
  onOpen,
  onClose,
}: ChatConversationTabProps) {
  return (
    <div className="group flex h-8 items-center gap-1 rounded-md bg-secondary px-2.5 text-secondary-foreground">
      <button
        type="button"
        title={conversation.title}
        className="max-w-40 cursor-pointer truncate"
        onClick={onOpen}
      >
        {conversation.title}
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Close"
        className="size-5 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={onClose}
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}
