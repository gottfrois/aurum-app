import {
  type UIMessage,
  useSmoothText,
  useUIMessages,
} from '@convex-dev/agent/react'
import { isToolUIPart } from 'ai'
import { Check, Copy, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { ChatEmptyState } from '~/components/chat/chat-empty-state'
import { Button } from '~/components/ui/button'
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from '~/components/ui/chat-container'
import { Loader } from '~/components/ui/loader'
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from '~/components/ui/message'
import { ScrollButton } from '~/components/ui/scroll-button'
import { SystemMessage } from '~/components/ui/system-message'
import { Tool, type ToolPart } from '~/components/ui/tool'
import { api } from '../../../convex/_generated/api'

/** Map tool names to human-readable labels. */
const TOOL_LABELS: Record<string, string> = {
  getSpendingSummary: 'Analyzing spending',
  getCashFlow: 'Analyzing cash flow',
  searchTransactions: 'Searching transactions',
  searchCategories: 'Searching categories',
  searchLabels: 'Searching labels',
  listAccounts: 'Loading accounts',
  listInvestments: 'Loading investments',
  getBalanceHistory: 'Loading balance history',
  web_search: 'Searching the web',
}

interface ChatMessagesProps {
  threadId: string
  onSuggestionClick: (suggestion: string) => void
}

export function ChatMessages({
  threadId,
  onSuggestionClick,
}: ChatMessagesProps) {
  const { results: messages } = useUIMessages(
    api.agentChatQueries.listThreadMessages,
    { threadId },
    { initialNumItems: 50, stream: true },
  )

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <ChatEmptyState onSuggestionClick={onSuggestionClick} />
      </div>
    )
  }

  // Show "Thinking..." when waiting for assistant response:
  // - Last message is from the user (assistant hasn't started yet)
  // - Last message is assistant but has no text yet (even if tool parts exist — agent is still working)
  const lastMessage = messages.at(-1)
  const isWaitingForReply =
    lastMessage?.role === 'user' ||
    (lastMessage?.role === 'assistant' &&
      !lastMessage.text &&
      lastMessage.status !== 'failed')

  return (
    <ChatContainerRoot className="relative flex-1">
      <ChatContainerContent className="gap-4 p-4">
        <SystemMessage
          variant="warning"
          icon={<ShieldAlert className="size-4" />}
        >
          Conversations are stored unencrypted on our servers. Responses may
          contain mistakes and are for informational purposes only — not
          financial advice.
        </SystemMessage>
        {messages.map((msg) => (
          <ChatMessageBubble key={msg.key} message={msg} />
        ))}
        {isWaitingForReply && (
          <div className="flex items-center gap-2 px-1">
            <Loader variant="text-shimmer" text="Thinking..." />
          </div>
        )}
        <ChatContainerScrollAnchor />
      </ChatContainerContent>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
        <ScrollButton />
      </div>
    </ChatContainerRoot>
  )
}

function ChatMessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user'
  const [visibleText] = useSmoothText(message.text, {
    startStreaming: message.status === 'streaming',
  })

  // Extract tool parts from message
  const toolParts = (message.parts ?? []).filter(isToolUIPart)
  const hasToolParts = toolParts.length > 0

  // Skip empty assistant messages (pending before any text arrives)
  if (!isUser && !visibleText && !hasToolParts) return null

  if (isUser) {
    return (
      <Message className="flex-row-reverse">
        <MessageContent className="max-w-[80%] bg-primary text-primary-foreground">
          {visibleText}
        </MessageContent>
      </Message>
    )
  }

  const showActions = visibleText && message.status !== 'streaming'

  return (
    <Message className="group/message">
      <div className="flex w-full flex-col gap-2">
        {hasToolParts && (
          <div className="flex flex-col gap-1">
            {toolParts.map((part) => {
              const toolName =
                'toolName' in part
                  ? (part.toolName as string)
                  : part.type.replace('tool-', '')
              return (
                <Tool
                  key={
                    'toolCallId' in part
                      ? (part.toolCallId as string)
                      : toolName
                  }
                  toolPart={{
                    type: TOOL_LABELS[toolName] ?? toolName,
                    state: part.state as ToolPart['state'],
                    input:
                      'input' in part
                        ? (part.input as Record<string, unknown>)
                        : undefined,
                    output:
                      'output' in part
                        ? (part.output as Record<string, unknown>)
                        : undefined,
                    toolCallId:
                      'toolCallId' in part
                        ? (part.toolCallId as string)
                        : undefined,
                    errorText:
                      'errorText' in part
                        ? (part.errorText as string)
                        : undefined,
                  }}
                />
              )
            })}
          </div>
        )}
        {visibleText && (
          <MessageContent
            markdown
            className="max-w-[80%] bg-muted text-foreground prose prose-sm dark:prose-invert"
          >
            {visibleText}
          </MessageContent>
        )}
        {showActions && (
          <MessageActions className="opacity-0 transition-opacity group-hover/message:opacity-100">
            <CopyAction text={message.text} />
          </MessageActions>
        )}
      </div>
    </Message>
  )
}

function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <MessageAction tooltip={copied ? 'Copied' : 'Copy'}>
      <Button variant="ghost" size="icon-sm" onClick={handleCopy}>
        {copied ? <Check /> : <Copy />}
      </Button>
    </MessageAction>
  )
}
