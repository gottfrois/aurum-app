import { useMutation } from 'convex/react'
import type { TFunction } from 'i18next'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { api } from '../../../convex/_generated/api'

/** Human-readable summary for tool inputs using i18n. */
function formatRuleSummary(
  t: TFunction,
  input: Record<string, unknown>,
): string {
  const parts: string[] = []
  if (input.pattern) {
    const matchType = input.matchType === 'regex' ? 'matches regex' : 'contains'
    parts.push(
      t('chat.toolApproval.ruleWhen', { matchType, pattern: input.pattern }),
    )
  }
  const actions: string[] = []
  if (input.categoryKey)
    actions.push(`${t('chat.toolApproval.categorize')} "${input.categoryKey}"`)
  if (input.customDescription)
    actions.push(
      `${t('chat.toolApproval.setDescription')} "${input.customDescription}"`,
    )
  if (input.excludeFromBudget)
    actions.push(t('chat.toolApproval.excludeBudget'))
  if (actions.length > 0) parts.push(actions.join(', '))
  return parts.join(' → ')
}

function formatCategorySummary(
  t: TFunction,
  input: Record<string, unknown>,
): string {
  const ids = input.transactionIds as string[] | undefined
  const count = ids?.length ?? 0
  const category = input.categoryKey as string | undefined
  return t('chat.toolApproval.recategorize', {
    count,
    category: category ?? 'unknown',
  })
}

function formatLabelSummary(
  t: TFunction,
  input: Record<string, unknown>,
): string {
  const ids = input.transactionIds as string[] | undefined
  const count = ids?.length ?? 0
  const addCount = (input.addLabelIds as string[] | undefined)?.length ?? 0
  const removeCount =
    (input.removeLabelIds as string[] | undefined)?.length ?? 0
  const parts: string[] = []
  if (addCount > 0)
    parts.push(t('chat.toolApproval.addLabels', { count: addCount }))
  if (removeCount > 0)
    parts.push(t('chat.toolApproval.removeLabels', { count: removeCount }))
  return `${parts.join(', ')} ${t('chat.toolApproval.onTransactions', { count })}`
}

function formatCreateLabelSummary(
  t: TFunction,
  input: Record<string, unknown>,
): string {
  const name = input.name as string | undefined
  const scope = input.scope as string | undefined
  return t('chat.toolApproval.createLabel', {
    name: name ?? 'unknown',
    scope: scope ?? '',
  })
}

function formatExclusionSummary(
  t: TFunction,
  input: Record<string, unknown>,
): string {
  const ids = input.transactionIds as string[] | undefined
  const count = ids?.length ?? 0
  const exclude = input.exclude as boolean
  if (exclude) {
    return t('chat.toolApproval.excludeFromBudget', { count })
  }
  return t('chat.toolApproval.reincludeInBudget', { count })
}

function getToolSummaries(
  t: TFunction,
): Record<string, (input: Record<string, unknown>) => string> {
  return {
    createTransactionRule: (input) => formatRuleSummary(t, input),
    updateTransactionCategory: (input) => formatCategorySummary(t, input),
    updateTransactionLabels: (input) => formatLabelSummary(t, input),
    createLabel: (input) => formatCreateLabelSummary(t, input),
    deleteLabel: (input) => {
      const count = (input.labelIds as string[] | undefined)?.length ?? 0
      return t('chat.toolApproval.deleteLabels', { count })
    },
    deleteTransactionRule: (input) => {
      const count = (input.ruleIds as string[] | undefined)?.length ?? 0
      return t('chat.toolApproval.deleteRules', { count })
    },
    excludeFromBudget: (input) => formatExclusionSummary(t, input),
  }
}

interface ToolApprovalProps {
  toolName: string
  input: Record<string, unknown>
  approvalId: string
  threadId: string
  onApprovalSubmitted: (messageId: string) => void
}

export function ToolApproval({
  toolName,
  input,
  approvalId,
  threadId,
  onApprovalSubmitted,
}: ToolApprovalProps) {
  const { t } = useTranslation()
  const submitApproval = useMutation(api.agentChatQueries.submitApproval)
  const [loading, setLoading] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const toolSummaries = getToolSummaries(t)
  const summary = toolSummaries[toolName]?.(input) ?? JSON.stringify(input)

  async function handleApprove() {
    setLoading(true)
    try {
      const { messageId } = await submitApproval({
        threadId,
        approvalId,
        approved: true,
      })
      onApprovalSubmitted(messageId)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeny() {
    if (!rejecting) {
      setRejecting(true)
      return
    }
    setLoading(true)
    try {
      const { messageId } = await submitApproval({
        threadId,
        approvalId,
        approved: false,
        reason: reason || undefined,
      })
      onApprovalSubmitted(messageId)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-sm font-medium">
        {t('chat.toolApproval.confirmAction')}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
      {rejecting && (
        <Input
          autoFocus
          className="mt-2 text-sm"
          placeholder={t('chat.toolApproval.reasonPlaceholder')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleDeny()
          }}
        />
      )}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={loading}
          loading={loading && !rejecting}
          onClick={() => void handleApprove()}
        >
          <Check className="size-3.5" />
          {t('chat.toolApproval.approve')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          loading={loading && rejecting}
          onClick={() => void handleDeny()}
        >
          <X className="size-3.5" />
          {rejecting
            ? t('chat.toolApproval.sendRejection')
            : t('chat.toolApproval.reject')}
        </Button>
      </div>
    </div>
  )
}
