import { ArrowUp, Square } from 'lucide-react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import {
  PromptInput,
  PromptInputActions,
  PromptInputTextarea,
} from '~/components/ui/prompt-input'
import { cn } from '~/lib/utils'

interface ChatInputProps {
  onSend: (content: string) => void
  isLoading?: boolean
  disabled?: boolean
  variant?: 'default' | 'secondary'
  hasMessages?: boolean
}

export function ChatInput({
  onSend,
  isLoading,
  disabled,
  variant = 'default',
  hasMessages = false,
}: ChatInputProps) {
  const [value, setValue] = useState('')

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setValue('')
  }

  return (
    <div
      data-slot="chat-input"
      className={cn('p-3', variant === 'default' && 'border-t')}
    >
      <PromptInput
        value={value}
        onValueChange={setValue}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        disabled={disabled}
        className={cn(
          'rounded-xl',
          variant === 'secondary' && 'border-none bg-secondary shadow-none',
        )}
      >
        <PromptInputTextarea
          autoFocus
          placeholder={hasMessages ? 'Reply...' : 'Ask Bunkr...'}
          className="dark:bg-transparent"
        />
        <PromptInputActions className="justify-end px-2 pb-2">
          {isLoading ? (
            <Button
              variant="default"
              size="icon-sm"
              className="rounded-full"
              onClick={handleSubmit}
            >
              <Square className="size-4 fill-current" />
            </Button>
          ) : (
            <Button
              variant="default"
              size="icon-sm"
              className="rounded-full"
              disabled={!value.trim()}
              onClick={handleSubmit}
            >
              <ArrowUp className="size-4" />
            </Button>
          )}
        </PromptInputActions>
      </PromptInput>
    </div>
  )
}
