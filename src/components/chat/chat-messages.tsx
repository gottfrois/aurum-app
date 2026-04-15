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
import { useTranslation } from 'react-i18next'
import { ChartMessage } from '~/components/chat/chart-message'
import { ChatBubble } from '~/components/chat/chat-bubble'
import { ChatDisclaimer } from '~/components/chat/chat-disclaimer'
import { ChatEmptyState } from '~/components/chat/chat-empty-state'
import { ChatMessagesSkeleton } from '~/components/chat/chat-messages-skeleton'
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
import { useChatDispatch, useChatState } from '~/contexts/chat-context'
import { cn } from '~/lib/utils'
import { api } from '../../../convex/_generated/api'
import type { ChartSpec } from '../../../convex/lib/chartSpec'

/** Map tool names to i18n keys for human-readable labels. */
const TOOL_LABEL_KEYS: Record<string, string> = {
  getSpendingSummary: 'chat.tools.analyzingSpending',
  getCashFlow: 'chat.tools.analyzingCashFlow',
  searchTransactions: 'chat.tools.searchingTransactions',
  searchCategories: 'chat.tools.searchingCategories',
  searchLabels: 'chat.tools.searchingLabels',
  listAccounts: 'chat.tools.loadingAccounts',
  listInvestments: 'chat.tools.loadingInvestments',
  getBalanceHistory: 'chat.tools.loadingBalanceHistory',
  findAnomalies: 'chat.tools.detectingAnomalies',
  getRecurringExpenses: 'chat.tools.findingRecurring',
  listUncategorizedTransactions: 'chat.tools.findingUncategorized',
  getTransactionRules: 'chat.tools.loadingRules',
  comparePeriodSpending: 'chat.tools.comparingSpending',
  createTransactionRule: 'chat.tools.creatingRule',
  updateTransactionCategory: 'chat.tools.updatingCategories',
  updateTransactionLabels: 'chat.tools.updatingLabels',
  createLabel: 'chat.tools.creatingLabel',
  deleteLabel: 'chat.tools.deletingLabel',
  deleteTransactionRule: 'chat.tools.deletingRule',
  excludeFromBudget: 'chat.tools.updatingBudget',
  findSavingsOpportunities: 'chat.tools.findingSavings',
  web_search: 'chat.tools.searchingWeb',
  render_chart: 'chat.tools.renderingChart',
}

interface ChatMessagesProps {
  threadId: string
  onSuggestionClick: (suggestion: string) => void
  pendingMessage?: string | null
  onWaitingChange?: (waiting: boolean) => void
}

export function ChatMessages({
  threadId,
  onSuggestionClick,
  pendingMessage,
  onWaitingChange,
}: ChatMessagesProps) {
  const { t } = useTranslation()
  const { results: messages, status } = useUIMessages(
    api.agentChatQueries.listThreadMessages,
    { threadId },
    { initialNumItems: 50, stream: true },
  )
  const isLoadingFirstPage = status === 'LoadingFirstPage'

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

  // Show "Thinking" when the model is actively working:
  // - Last message is from the user (assistant hasn't started yet)
  // - Last message is an assistant message whose stream is still open
  //   (status === 'streaming'), and either no text has arrived yet or the
  //   latest part is a just-completed tool call — i.e. the model is mid-turn
  //   between a tool result and the next output.
  //
  // Notes on status values (from @convex-dev/agent UIMessages):
  //   'streaming' → stream is still open (message.streaming === true)
  //   'pending'   → stream closed but the row wasn't marked 'success' yet;
  //                 this happens when a turn ends on a terminal tool call.
  //                 We treat this as "done" — not as "still running".
  //   'success' / 'failed' → finalized.
  //
  // Also hidden while a tool approval is pending (user's turn to act).
  const lastMessage = messages.at(-1)
  const lastHasApprovalPending =
    lastMessage?.role === 'assistant' &&
    (lastMessage.parts ?? []).some(
      (p) => isToolUIPart(p) && p.state === 'approval-requested',
    )
  const lastPart = (lastMessage?.parts ?? []).at(-1)
  const lastPartIsCompletedTool =
    !!lastPart &&
    isToolUIPart(lastPart) &&
    (lastPart as ToolUIPartType).state === 'output-available'
  const assistantStreamOpen =
    lastMessage?.role === 'assistant' && lastMessage.status === 'streaming'
  // A freshly-inserted assistant row appears briefly with status === 'pending'
  // before the stream attaches. Without this, the "Thinking" indicator flickers
  // off between the user prompt and the first stream event.
  const assistantPendingEmpty =
    lastMessage?.role === 'assistant' &&
    lastMessage.status === 'pending' &&
    !lastMessage.text &&
    (lastMessage.parts ?? []).length === 0
  const isWaitingForReply =
    messages.length === 0
      ? !!pendingMessage
      : !lastHasApprovalPending &&
        (lastMessage?.role === 'user' ||
          assistantPendingEmpty ||
          (assistantStreamOpen &&
            (!lastMessage?.text || lastPartIsCompletedTool)))

  useEffect(() => {
    onWaitingChange?.(isWaitingForReply)
  }, [isWaitingForReply, onWaitingChange])

  if (messages.length === 0) {
    if (pendingMessage) {
      return (
        <ChatContainerRoot className="relative flex-1">
          <ChatContainerContent className="gap-4 p-4">
            <ChatDisclaimer />
            <ChatBubble variant="user">{pendingMessage}</ChatBubble>
            <div className="flex items-center gap-2 px-1">
              <Loader variant="text-shimmer" text={t('chat.thinking')} />
            </div>
          </ChatContainerContent>
        </ChatContainerRoot>
      )
    }
    // Show skeletons while the first page is loading so reopening a minimized
    // chat doesn't flash the empty state before messages arrive.
    if (isLoadingFirstPage) {
      return <ChatMessagesSkeleton />
    }
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <ChatEmptyState onSuggestionClick={onSuggestionClick} />
      </div>
    )
  }

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
            <Loader variant="text-shimmer" text={t('chat.thinking')} />
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
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { panelMode } = useChatState()
  const { collapseChat } = useChatDispatch()
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

    if (panelMode === 'expanded') {
      collapseChat()
    }

    void navigate({ to: '/cash-flow' }).then(() => {
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

    // render_chart → render chart inline (replaces the generic Tool JSON card)
    if (toolName === 'render_chart' && part.state === 'output-available') {
      const output =
        'output' in part
          ? (part.output as ChartSpec | { error: string } | null)
          : null
      if (output) {
        renderedParts.push(
          <ChartMessage
            key={
              'toolCallId' in part ? (part.toolCallId as string) : `chart-${i}`
            }
            spec={output}
          />,
        )
      }
      continue
    }

    // view_transactions → render button (silent UI tool that surfaces a
    // clickable link to filtered transactions)
    if (toolName === 'view_transactions' && part.state === 'output-available') {
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
            {(output.label as string) ?? t('chat.viewTransactions')}
            <ArrowRight className="size-3.5" />
          </Button>,
        )
      }
      continue
    }

    // Regular tool → render Tool card.
    // Tools surface hard failures as { error: string } outputs (e.g. permission
    // denials from mutate_entity). The Agent SDK still marks those results as
    // `output-available`, so we promote them to `output-error` here so the UI
    // shows the red error badge instead of a green "completed".
    const rawOutput =
      'output' in part ? (part.output as Record<string, unknown>) : undefined
    const outputError =
      rawOutput && typeof rawOutput.error === 'string'
        ? rawOutput.error
        : undefined
    const rawState = part.state as ToolPart['state']
    const effectiveState: ToolPart['state'] =
      rawState === 'output-available' && outputError ? 'output-error' : rawState
    const effectiveErrorText =
      'errorText' in part
        ? (part.errorText as string)
        : effectiveState === 'output-error'
          ? outputError
          : undefined

    renderedParts.push(
      <Tool
        key={'toolCallId' in part ? (part.toolCallId as string) : `tool-${i}`}
        toolPart={{
          type: TOOL_LABEL_KEYS[toolName]
            ? t(TOOL_LABEL_KEYS[toolName])
            : toolName,
          state: effectiveState,
          input:
            'input' in part
              ? (part.input as Record<string, unknown>)
              : undefined,
          output: rawOutput,
          toolCallId:
            'toolCallId' in part ? (part.toolCallId as string) : undefined,
          errorText: effectiveErrorText,
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
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <MessageAction tooltip={copied ? t('chat.copied') : t('chat.copy')}>
      <Button variant="ghost" size="icon-sm" onClick={handleCopy}>
        {copied ? <Check /> : <Copy />}
      </Button>
    </MessageAction>
  )
}
