import { X } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { ButtonGroup, ButtonGroupText } from '~/components/ui/button-group'

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
    <ButtonGroup>
      <ButtonGroupText
        className="max-w-40 cursor-pointer text-xs"
        onClick={onOpen}
      >
        <span className="truncate">{conversation.title}</span>
      </ButtonGroupText>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        <X className="size-3" />
      </Button>
    </ButtonGroup>
  )
}
