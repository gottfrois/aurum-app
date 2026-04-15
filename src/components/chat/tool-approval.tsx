import { useMutation, useQuery } from 'convex/react'
import type { TFunction } from 'i18next'
import { Check, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { useWorkspace } from '~/contexts/workspace-context'
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

/**
 * mutate_entity and bulk_mutate_entity are generic wrappers — unpack their
 * (type, action, payload) discriminator into the existing per-action
 * formatters so the user sees the same human-readable preview regardless of
 * which tool produced the call.
 */
function resolveIdsToNames(
  ids: string[],
  byId: Map<string, string>,
): { names: string[]; unknownCount: number } {
  const names: string[] = []
  let unknownCount = 0
  for (const id of ids) {
    const name = byId.get(id)
    if (name) names.push(name)
    else unknownCount++
  }
  return { names, unknownCount }
}

function formatNamedDelete(
  t: TFunction,
  namedKey: string,
  fallbackKey: string,
  ids: string[],
  byId: Map<string, string>,
): string {
  const { names, unknownCount } = resolveIdsToNames(ids, byId)
  if (names.length > 0 && unknownCount === 0) {
    return t(namedKey, { count: names.length, names: quoteJoin(names) })
  }
  return t(fallbackKey, { count: ids.length })
}

function formatMutateEntitySummary(
  t: TFunction,
  input: Record<string, unknown>,
  labelsById: Map<string, string>,
  categoriesById: Map<string, string>,
  rulesById: Map<string, string>,
): string {
  const type = input.type as string | undefined
  const action = input.action as string | undefined
  const payload = (input.payload as Record<string, unknown> | undefined) ?? {}

  if (type === 'rule' && action === 'create') {
    return formatRuleSummary(t, payload)
  }
  if (type === 'rule' && action === 'delete') {
    const ids = (payload.ids as string[] | undefined) ?? []
    return formatNamedDelete(
      t,
      'chat.toolApproval.deleteRulesNamed',
      'chat.toolApproval.deleteRules',
      ids,
      rulesById,
    )
  }
  if (type === 'label' && action === 'create') {
    return formatCreateLabelSummary(t, payload)
  }
  if (type === 'label' && action === 'delete') {
    const ids = (payload.ids as string[] | undefined) ?? []
    return formatNamedDelete(
      t,
      'chat.toolApproval.deleteLabelsNamed',
      'chat.toolApproval.deleteLabels',
      ids,
      labelsById,
    )
  }
  if (type === 'category' && action === 'create') {
    const label = payload.label as string | undefined
    const scope = payload.scope as string | undefined
    return t(
      scope
        ? 'chat.toolApproval.createCategoryWithScope'
        : 'chat.toolApproval.createCategory',
      { label: label ?? 'unknown', scope: scope ?? '' },
    )
  }
  if (type === 'category' && action === 'update') {
    const id = payload.id as string | undefined
    const name = (id && categoriesById.get(id)) || id || 'unknown'
    const changed = Object.keys(payload).filter((k) => k !== 'id')
    return t('chat.toolApproval.updateCategory', {
      name,
      fields: changed.join(', '),
    })
  }
  if (type === 'category' && action === 'delete') {
    const ids = (payload.ids as string[] | undefined) ?? []
    return formatNamedDelete(
      t,
      'chat.toolApproval.deleteCategoriesNamed',
      'chat.toolApproval.deleteCategories',
      ids,
      categoriesById,
    )
  }
  if (type === 'transaction' && action === 'update_labels') {
    return formatLabelSummary(t, {
      transactionIds: payload.ids,
      addLabelIds: payload.addLabelIds,
      removeLabelIds: payload.removeLabelIds,
    })
  }
  if (type === 'transaction' && action === 'update') {
    const ids = (payload.ids as string[] | undefined)?.length ?? 0
    const parts: string[] = []
    if (payload.categoryKey)
      parts.push(
        formatCategorySummary(t, {
          transactionIds: payload.ids,
          categoryKey: payload.categoryKey,
        }),
      )
    if (payload.excludedFromBudget !== undefined)
      parts.push(
        formatExclusionSummary(t, {
          transactionIds: payload.ids,
          exclude: payload.excludedFromBudget,
        }),
      )
    if (payload.customName)
      parts.push(`rename ${ids} transaction(s) → "${payload.customName}"`)
    return parts.join(' · ') || t('chat.toolApproval.confirmAction')
  }
  return `${type ?? 'entity'}.${action ?? '?'}`
}

function quoteJoin(names: string[]): string {
  return names.map((n) => `"${n}"`).join(', ')
}

function formatBulkFilter(
  t: TFunction,
  filter: Record<string, unknown>,
  labelsById: Map<string, string>,
  categoriesByKey: Map<string, string>,
): string | null {
  const parts: string[] = []
  const dateRange = filter.dateRange as
    | { from?: string; to?: string }
    | undefined
  if (dateRange?.from && dateRange?.to) {
    parts.push(
      t('chat.toolApproval.bulk.filterDateRange', {
        from: dateRange.from,
        to: dateRange.to,
      }),
    )
  }
  const categoryKeys = filter.categoryKeys as string[] | undefined
  if (categoryKeys && categoryKeys.length > 0) {
    const names = categoryKeys.map((k) => categoriesByKey.get(k) ?? k)
    parts.push(
      t('chat.toolApproval.bulk.filterCategories', {
        count: names.length,
        names: quoteJoin(names),
      }),
    )
  }
  const labelIds = filter.labelIds as string[] | undefined
  if (labelIds && labelIds.length > 0) {
    const names = labelIds.map((id) => labelsById.get(id) ?? id)
    parts.push(
      t('chat.toolApproval.bulk.filterLabels', {
        count: names.length,
        names: quoteJoin(names),
      }),
    )
  }
  const counterparty = filter.counterparty as string | undefined
  if (counterparty)
    parts.push(t('chat.toolApproval.bulk.filterCounterparty', { counterparty }))
  const textSearch = filter.textSearch as string | undefined
  if (textSearch)
    parts.push(t('chat.toolApproval.bulk.filterText', { text: textSearch }))
  const sign = filter.sign as 'income' | 'expense' | undefined
  if (sign === 'expense') parts.push(t('chat.toolApproval.bulk.filterExpense'))
  else if (sign === 'income')
    parts.push(t('chat.toolApproval.bulk.filterIncome'))
  if (parts.length === 0) return null
  return parts.join(' · ')
}

function formatBulkMutateSummary(
  t: TFunction,
  input: Record<string, unknown>,
  labelsById: Map<string, string>,
  categoriesByKey: Map<string, string>,
  categoriesById: Map<string, string>,
): { action: string; scope: string | null } {
  const op = input.operation as string | undefined
  const target = (input.target as Record<string, unknown> | undefined) ?? {}
  const filter = (input.filter as Record<string, unknown> | undefined) ?? {}

  let action: string
  if (op === 'recategorize') {
    const key = target.categoryKey as string | undefined
    const name = (key && categoriesByKey.get(key)) || key || '?'
    action = t('chat.toolApproval.bulk.recategorize', { category: name })
  } else if (op === 'relabel') {
    const addIds = (target.addLabelIds as string[] | undefined) ?? []
    const removeIds = (target.removeLabelIds as string[] | undefined) ?? []
    const segments: string[] = []
    if (addIds.length > 0) {
      const names = addIds.map((id) => labelsById.get(id) ?? id)
      segments.push(
        t('chat.toolApproval.bulk.addLabels', {
          count: names.length,
          names: quoteJoin(names),
        }),
      )
    }
    if (removeIds.length > 0) {
      const names = removeIds.map((id) => labelsById.get(id) ?? id)
      segments.push(
        t('chat.toolApproval.bulk.removeLabels', {
          count: names.length,
          names: quoteJoin(names),
        }),
      )
    }
    action = segments.join(' · ') || t('chat.toolApproval.confirmAction')
  } else if (op === 'exclude_from_budget') {
    action = t('chat.toolApproval.bulk.excludeFromBudget')
  } else if (op === 'include_in_budget') {
    action = t('chat.toolApproval.bulk.includeInBudget')
  } else if (op === 'batch_create_categories') {
    const categories =
      (input.categories as Array<{ label: string }> | undefined) ?? []
    const preview = categories
      .slice(0, 3)
      .map((c) => `"${c.label}"`)
      .join(', ')
    return {
      action: t('chat.toolApproval.bulk.batchCreateCategories', {
        count: categories.length,
        preview,
      }),
      scope: null,
    }
  } else if (op === 'batch_delete_categories') {
    const ids = (input.ids as string[] | undefined) ?? []
    return {
      action: formatNamedDelete(
        t,
        'chat.toolApproval.bulk.batchDeleteCategoriesNamed',
        'chat.toolApproval.bulk.batchDeleteCategories',
        ids,
        categoriesById,
      ),
      scope: null,
    }
  } else {
    action = op ?? 'bulk'
  }

  return {
    action,
    scope: formatBulkFilter(t, filter, labelsById, categoriesByKey),
  }
}

interface ToolSummary {
  action: string
  scope?: string | null
}

function getToolSummary(
  t: TFunction,
  toolName: string,
  input: Record<string, unknown>,
  labelsById: Map<string, string>,
  categoriesByKey: Map<string, string>,
  categoriesById: Map<string, string>,
  rulesById: Map<string, string>,
): ToolSummary {
  if (toolName === 'mutate_entity') {
    return {
      action: formatMutateEntitySummary(
        t,
        input,
        labelsById,
        categoriesById,
        rulesById,
      ),
    }
  }
  if (toolName === 'bulk_mutate_entity') {
    return formatBulkMutateSummary(
      t,
      input,
      labelsById,
      categoriesByKey,
      categoriesById,
    )
  }
  return { action: JSON.stringify(input) }
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
  const { workspace } = useWorkspace()
  const [loading, setLoading] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  // Resolve label / category / rule ids to display names so the summary reads
  // as "Delete label 'foo', 'bar'" rather than "Delete 2 labels".
  const labels = useQuery(
    api.transactionLabels.listLabels,
    workspace
      ? { workspaceId: workspace._id, includeAllPortfolios: true }
      : 'skip',
  )
  const categories = useQuery(
    api.categories.listCategories,
    workspace ? { includeAllPortfolios: true } : 'skip',
  )
  const rules = useQuery(
    api.transactionRules.listRules,
    workspace ? {} : 'skip',
  )

  const labelsById = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of labels ?? []) m.set(l._id, l.name)
    return m
  }, [labels])
  const categoriesByKey = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories ?? []) m.set(c.key, c.label)
    return m
  }, [categories])
  const categoriesById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories ?? []) m.set(c._id, c.label)
    return m
  }, [categories])
  const rulesById = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of rules ?? []) m.set(r._id, r.pattern)
    return m
  }, [rules])

  const summary = getToolSummary(
    t,
    toolName,
    input,
    labelsById,
    categoriesByKey,
    categoriesById,
    rulesById,
  )

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
      <p className="mt-1 text-sm text-muted-foreground">{summary.action}</p>
      {summary.scope ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{summary.scope}</p>
      ) : null}
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
