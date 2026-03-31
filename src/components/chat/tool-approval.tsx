import { useMutation } from 'convex/react'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { api } from '../../../convex/_generated/api'

/** Human-readable summary for tool inputs. */
function formatRuleSummary(input: Record<string, unknown>): string {
  const parts: string[] = []
  if (input.pattern) {
    const matchType = input.matchType === 'regex' ? 'matches regex' : 'contains'
    parts.push(`When transaction ${matchType} "${input.pattern}"`)
  }
  const actions: string[] = []
  if (input.categoryKey) actions.push(`categorize as "${input.categoryKey}"`)
  if (input.customDescription)
    actions.push(`set description "${input.customDescription}"`)
  if (input.excludeFromBudget) actions.push('exclude from budget')
  if (actions.length > 0) parts.push(actions.join(', '))
  return parts.join(' → ')
}

function formatCategorySummary(input: Record<string, unknown>): string {
  const ids = input.transactionIds as string[] | undefined
  const count = ids?.length ?? 0
  const category = input.categoryKey as string | undefined
  return `Recategorize ${count} transaction${count !== 1 ? 's' : ''} as "${category ?? 'unknown'}"`
}

const TOOL_SUMMARIES: Record<
  string,
  (input: Record<string, unknown>) => string
> = {
  createTransactionRule: formatRuleSummary,
  updateTransactionCategory: formatCategorySummary,
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
  const submitApproval = useMutation(api.agentChatQueries.submitApproval)
  const [loading, setLoading] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const summary = TOOL_SUMMARIES[toolName]?.(input) ?? JSON.stringify(input)

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
      <p className="text-sm font-medium">Confirm action</p>
      <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
      {rejecting && (
        <Input
          autoFocus
          className="mt-2 text-sm"
          placeholder="Reason (optional)..."
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
          Approve
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          loading={loading && rejecting}
          onClick={() => void handleDeny()}
        >
          <X className="size-3.5" />
          {rejecting ? 'Send rejection' : 'Reject'}
        </Button>
      </div>
    </div>
  )
}
