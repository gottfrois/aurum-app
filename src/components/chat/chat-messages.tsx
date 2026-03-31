import {
  SmoothText,
  type UIMessage,
  useUIMessages,
} from '@convex-dev/agent/react'
import { useNavigate } from '@tanstack/react-router'
import { isToolUIPart, type ToolUIPart as ToolUIPartType } from 'ai'
import { useMutation } from 'convex/react'
import { ArrowRight, Check, Copy } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatBubble } from '~/components/chat/chat-bubble'
import { ChatDisclaimer } from '~/components/chat/chat-disclaimer'
import { ChatEmptyState } from '~/components/chat/chat-empty-state'
import { ToolApproval } from '~/components/chat/tool-approval'
import { dispatchAIFilters } from '~/components/command-palette'
import type { Filter } from '~/components/reui/filters'
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
import { Tool, type ToolPart } from '~/components/ui/tool'
import { cn } from '~/lib/utils'
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
  findAnomalies: 'Detecting anomalies',
  getRecurringExpenses: 'Finding recurring expenses',
  listUncategorizedTransactions: 'Finding uncategorized transactions',
  getTransactionRules: 'Loading transaction rules',
  comparePeriodSpending: 'Comparing spending periods',
  createTransactionRule: 'Creating transaction rule',
  updateTransactionCategory: 'Updating transaction categories',
  updateTransactionLabels: 'Updating transaction labels',
  createLabel: 'Creating label',
  deleteLabel: 'Deleting label',
  deleteTransactionRule: 'Deleting transaction rule',
  excludeFromBudget: 'Updating budget exclusion',
  findSavingsOpportunities: 'Finding savings opportunities',
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

  const triggerContinuation = useMutation(
    api.agentChatQueries.triggerContinuation,
  )
  const lastApprovalMessageIdRef = useRef<string | null>(null)

  // Detect pending approvals across all messages
  const hasPendingApprovals = messages.some((m) =>
    (m.parts ?? []).some(
      (p) =>
        isToolUIPart(p) && (p as ToolUIPartType).state === 'approval-requested',
    ),
  )

  // When all approvals are resolved, trigger continuation
  useEffect(() => {
    if (!hasPendingApprovals && lastApprovalMessageIdRef.current) {
      const messageId = lastApprovalMessageIdRef.current
      lastApprovalMessageIdRef.current = null
      void triggerContinuation({ threadId, lastApprovalMessageId: messageId })
    }
  }, [hasPendingApprovals, threadId, triggerContinuation])

  const handleApprovalSubmitted = useCallback((messageId: string) => {
    lastApprovalMessageIdRef.current = messageId
  }, [])

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <ChatEmptyState onSuggestionClick={onSuggestionClick} />
      </div>
    )
  }

  // Show "Thinking" when waiting for assistant response:
  // - Last message is from the user (assistant hasn't started yet)
  // - Last message is assistant but has no text yet (even if tool parts exist — agent is still working)
  // - BUT NOT when waiting for user approval (approval-requested state)
  const lastMessage = messages.at(-1)
  const lastHasApprovalPending =
    lastMessage?.role === 'assistant' &&
    (lastMessage.parts ?? []).some(
      (p) => isToolUIPart(p) && p.state === 'approval-requested',
    )
  const isWaitingForReply =
    !lastHasApprovalPending &&
    (lastMessage?.role === 'user' ||
      (lastMessage?.role === 'assistant' &&
        !lastMessage.text &&
        lastMessage.status !== 'failed'))

  return (
    <ChatContainerRoot className="relative flex-1">
      <ChatContainerContent className="gap-4 p-4">
        <ChatDisclaimer />
        {messages.map((msg) => (
          <ChatMessageBubble
            key={msg.key}
            message={msg}
            threadId={threadId}
            onApprovalSubmitted={handleApprovalSubmitted}
          />
        ))}
        {isWaitingForReply && (
          <div className="flex items-center gap-2 px-1">
            <Loader variant="text-shimmer" text="Thinking" />
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

function getToolName(part: { type: string; toolName?: string }): string {
  return part.toolName ?? part.type.replace('tool-', '')
}

function ChatMessageBubble({
  message,
  threadId,
  onApprovalSubmitted,
}: {
  message: UIMessage
  threadId: string
  onApprovalSubmitted: (messageId: string) => void
}) {
  const navigate = useNavigate()
  const isUser = message.role === 'user'
  const parts = message.parts ?? []
  const hasToolParts = parts.some(isToolUIPart)
  const hasAnyText = parts.some(
    (p) => p.type === 'text' && 'text' in p && (p.text as string),
  )

  // Skip empty assistant messages (pending before any text arrives)
  if (!isUser && !hasAnyText && !hasToolParts) return null

  if (isUser) {
    return <ChatBubble variant="user">{message.text}</ChatBubble>
  }

  const isFailed = message.status === 'failed'
  const showActions = hasAnyText && message.status !== 'streaming' && !isFailed

  function handleViewTransactions(output: Record<string, unknown>) {
    const filters = output.filters as Array<Filter>
    const startDate = output.startDate as string | null
    const endDate = output.endDate as string | null

    if (startDate && endDate) {
      localStorage.setItem(
        'bunkr:period:transactions',
        JSON.stringify({ mode: 'custom', start: startDate, end: endDate }),
      )
    }

    void navigate({ to: '/transactions' }).then(() => {
      setTimeout(() => dispatchAIFilters(filters), 100)
    })
  }

  // Render parts in chronological order
  const renderedParts: React.ReactNode[] = []
  let textPartIndex = 0

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]

    if (part.type === 'text') {
      textPartIndex++
      const text = 'text' in part ? (part.text as string) : ''
      const isStreamingPart = 'state' in part && part.state !== 'done'
      if (!text && !isStreamingPart) continue
      const contentClass = isFailed
        ? 'bg-destructive/10 text-destructive border border-destructive/20 max-w-full'
        : 'bg-background text-foreground prose dark:prose-invert max-w-full overflow-x-auto'
      renderedParts.push(
        isStreamingPart ? (
          <SmoothTextBubble
            key={`text-${textPartIndex}`}
            text={text}
            className={contentClass}
          />
        ) : (
          <MessageContent
            key={`text-${textPartIndex}`}
            markdown={!isFailed}
            className={contentClass}
          >
            {text}
          </MessageContent>
        ),
      )
      continue
    }

    if (!isToolUIPart(part)) continue

    const toolName = getToolName(part as Parameters<typeof getToolName>[0])

    // Approval-requested → render approval card
    if (part.state === 'approval-requested') {
      const approval =
        'approval' in part ? (part.approval as { id: string }) : null
      if (approval) {
        renderedParts.push(
          <ToolApproval
            key={approval.id}
            toolName={toolName}
            input={
              'input' in part ? (part.input as Record<string, unknown>) : {}
            }
            approvalId={approval.id}
            threadId={threadId}
            onApprovalSubmitted={onApprovalSubmitted}
          />,
        )
      }
      continue
    }

    // viewTransactions → render button
    if (toolName === 'viewTransactions' && part.state === 'output-available') {
      const output =
        'output' in part ? (part.output as Record<string, unknown>) : null
      if (output) {
        renderedParts.push(
          <Button
            key={
              'toolCallId' in part
                ? (part.toolCallId as string)
                : `view-tx-${i}`
            }
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => handleViewTransactions(output)}
          >
            {(output.label as string) ?? 'View transactions'}
            <ArrowRight className="size-3.5" />
          </Button>,
        )
      }
      continue
    }

    // Regular tool → render Tool card
    renderedParts.push(
      <Tool
        key={'toolCallId' in part ? (part.toolCallId as string) : `tool-${i}`}
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
            'toolCallId' in part ? (part.toolCallId as string) : undefined,
          errorText:
            'errorText' in part ? (part.errorText as string) : undefined,
        }}
      />,
    )
  }

  return (
    <Message className="group/message">
      <div className="flex w-full flex-col gap-2">
        {renderedParts}
        {showActions && (
          <MessageActions className="opacity-0 transition-opacity group-hover/message:opacity-100">
            <CopyAction text={message.text} />
          </MessageActions>
        )}
      </div>
    </Message>
  )
}

function SmoothTextBubble({
  text,
  className,
}: {
  text: string
  className: string
}) {
  return (
    <div
      className={cn('rounded-lg p-2 break-words whitespace-normal', className)}
    >
      <SmoothText text={text} />
    </div>
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
