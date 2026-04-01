import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import * as Sentry from '@sentry/tanstackstart-react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Plus, Zap } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '~/components/confirm-dialog'
import { RuleCard } from '~/components/rule-card'
import { RuleDialog } from '~/components/rule-dialog'
import { Button } from '~/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '~/components/ui/empty'
import { Input } from '~/components/ui/input'
import { PageHeader } from '~/components/ui/page-header'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Skeleton } from '~/components/ui/skeleton'
import { Sortable, SortableItem } from '~/components/ui/sortable'
import { useCachedDecryptRecords } from '~/hooks/use-cached-decrypt'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

type DecryptedBankAccount = Doc<'bankAccounts'> & {
  name?: string
  customName?: string
  connectorName?: string
}

export const Route = createFileRoute(
  '/_settings/settings/portfolios/$id/rules',
)({
  component: PortfolioRulesPage,
})

function PortfolioRulesPage() {
  const { t } = useTranslation()
  const { id } = Route.useParams()
  const portfolioId = id as Id<'portfolios'>
  const portfolio = useQuery(api.portfolios.getPortfolio, { portfolioId })

  if (portfolio === undefined) {
    return (
      <div className="flex h-full flex-col overflow-hidden px-10 pt-16">
        <Skeleton className="h-9 w-32" />
        <div className="mt-8">
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (!portfolio) return null

  return (
    <div className="flex h-full flex-col overflow-hidden px-10 pt-16">
      <div className="shrink-0">
        <PageHeader
          title={t('settings.rules.title')}
          description={t('settings.rules.portfolioDescription')}
        />
      </div>
      <div className="mt-8 flex min-h-0 flex-1 flex-col">
        <PortfolioRulesList portfolioId={portfolioId} />
      </div>
    </div>
  )
}

function PortfolioRulesList({
  portfolioId,
}: {
  portfolioId: Id<'portfolios'>
}) {
  const { t } = useTranslation()
  const rules = useQuery(api.transactionRules.listRules, { portfolioId })
  const categories = useQuery(api.categories.listCategories, { portfolioId })
  const workspace = useQuery(api.workspaces.getMyWorkspace)
  const labels = useQuery(
    api.transactionLabels.listWorkspaceLabels,
    workspace ? { workspaceId: workspace._id } : 'skip',
  )
  const rawBankAccounts = useQuery(api.powens.listBankAccounts, { portfolioId })
  const bankAccounts = useCachedDecryptRecords(
    'bankAccounts',
    rawBankAccounts,
  ) as DecryptedBankAccount[] | undefined

  const deleteRule = useMutation(api.transactionRules.deleteRule)
  const reorderRules = useMutation(api.transactionRules.reorderRules)
  const toggleRule = useMutation(api.transactionRules.toggleRule)

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editingRule, setEditingRule] = React.useState<
    Doc<'transactionRules'> | undefined
  >(undefined)
  const [deletingRule, setDeletingRule] = React.useState<
    Doc<'transactionRules'> | undefined
  >(undefined)
  const [deleting, setDeleting] = React.useState(false)
  const [pendingEditId, setPendingEditId] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState('')
  const [localRules, setLocalRules] = React.useState<
    Doc<'transactionRules'>[] | null
  >(null)
  const pendingReorder = React.useRef(false)

  React.useEffect(() => {
    if (pendingEditId && rules) {
      const created = rules.find((r) => r._id === pendingEditId)
      if (created) {
        setPendingEditId(null)
        setEditingRule(created)
      }
    }
  }, [pendingEditId, rules])

  React.useEffect(() => {
    if (rules && !pendingReorder.current) {
      setLocalRules(rules)
    }
  }, [rules])

  if (
    rules === undefined ||
    categories === undefined ||
    bankAccounts === undefined
  ) {
    return <Skeleton className="h-48 w-full rounded-lg" />
  }

  const displayRules = localRules ?? rules
  const categoryMap = new Map(categories.map((c) => [c.key, c]))
  const labelMap = new Map((labels ?? []).map((l) => [l._id, l]))

  // Build bank account name map for display on rule cards
  const bankAccountMap = new Map<string, string>()
  for (const ba of bankAccounts) {
    const label = ba.customName
      ? ba.customName
      : ba.connectorName
        ? `${ba.connectorName} – ${ba.name ?? ''}`
        : (ba.name ?? '')
    bankAccountMap.set(ba._id, label)
  }

  const isFiltering = filter.trim().length > 0
  const filteredRules = isFiltering
    ? displayRules.filter((r) =>
        r.pattern.toLowerCase().includes(filter.toLowerCase()),
      )
    : displayRules

  // Split into portfolio-specific and inherited workspace rules
  const portfolioRules = filteredRules.filter(
    (r) => r.portfolioId === portfolioId,
  )
  const inheritedRules = filteredRules.filter((r) => !r.portfolioId)

  const handleDelete = async () => {
    if (!deletingRule) return
    setDeleting(true)
    try {
      await deleteRule({ ruleId: deletingRule._id })
      toast.success(t('toast.ruleDeleted'))
      setDeletingRule(undefined)
    } catch (error) {
      Sentry.captureException(error)
      toast.error(t('toast.failedDeleteRule'))
    } finally {
      setDeleting(false)
    }
  }

  const handleToggle = (rule: Doc<'transactionRules'>, enabled: boolean) => {
    setLocalRules((prev) =>
      (prev ?? rules ?? []).map((r) =>
        r._id === rule._id ? { ...r, enabled } : r,
      ),
    )
    toggleRule({ ruleId: rule._id, enabled }).catch((error) => {
      Sentry.captureException(error)
      toast.error(t('toast.failedToggleRule'))
      setLocalRules((prev) =>
        (prev ?? rules ?? []).map((r) =>
          r._id === rule._id ? { ...r, enabled: !enabled } : r,
        ),
      )
    })
  }

  const handleReorder = (reordered: Doc<'transactionRules'>[]) => {
    pendingReorder.current = true
    // Only reorder portfolio rules; keep inherited rules at the end
    const newRules = [...reordered, ...inheritedRules]
    setLocalRules(newRules)
    const orderedIds = reordered.map((r) => r._id)
    reorderRules({ orderedRuleIds: orderedIds, portfolioId })
      .catch((error) => {
        Sentry.captureException(error)
        toast.error(t('toast.failedReorderRules'))
        setLocalRules(rules ?? null)
      })
      .finally(() => {
        pendingReorder.current = false
      })
  }

  const totalRules = portfolioRules.length + inheritedRules.length

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Input
          placeholder={t('settings.rules.filterPlaceholder')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex-1" />
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          {t('settings.rules.addRule')}
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {totalRules === 0 && !isFiltering ? (
          <Empty className="mt-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Zap />
              </EmptyMedia>
              <EmptyTitle>{t('settings.rules.emptyTitle')}</EmptyTitle>
              <EmptyDescription>
                {t('settings.rules.emptyPortfolioDescription')}
              </EmptyDescription>
            </EmptyHeader>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              {t('settings.rules.addRule')}
            </Button>
          </Empty>
        ) : totalRules === 0 && isFiltering ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('settings.rules.noMatch', { pattern: filter })}
          </p>
        ) : (
          <div className="space-y-6 pb-8">
            {/* Portfolio-specific rules (editable, reorderable) */}
            {portfolioRules.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('settings.rules.portfolioGroup')}
                </h3>
                <Sortable
                  value={portfolioRules}
                  onValueChange={handleReorder}
                  getItemValue={(item) => item._id}
                  modifiers={[restrictToVerticalAxis]}
                  className="space-y-2"
                >
                  {portfolioRules.map((rule, index) => (
                    <SortableItem key={rule._id} value={rule._id}>
                      <RuleCard
                        rule={rule}
                        index={index}
                        categoryMap={categoryMap}
                        labelMap={labelMap}
                        bankAccountMap={bankAccountMap}
                        dragDisabled={isFiltering}
                        onEdit={() => setEditingRule(rule)}
                        onDelete={() => setDeletingRule(rule)}
                        onToggle={(enabled) => handleToggle(rule, enabled)}
                      />
                    </SortableItem>
                  ))}
                </Sortable>
              </section>
            )}

            {/* Inherited workspace rules (read-only) */}
            {inheritedRules.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('settings.rules.inheritedGroup')}
                </h3>
                <div className="space-y-2 opacity-60">
                  {inheritedRules.map((rule, index) => (
                    <RuleCard
                      key={rule._id}
                      rule={rule}
                      index={portfolioRules.length + index}
                      categoryMap={categoryMap}
                      labelMap={labelMap}
                      bankAccountMap={bankAccountMap}
                      dragDisabled
                      readOnly
                      onEdit={() => {}}
                      onDelete={() => {}}
                      onToggle={() => {}}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </ScrollArea>

      <RuleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        portfolioId={portfolioId}
        onCreated={(ruleId) => setPendingEditId(ruleId)}
      />

      <RuleDialog
        open={!!editingRule}
        onOpenChange={(open) => {
          if (!open) setEditingRule(undefined)
        }}
        rule={editingRule}
        portfolioId={portfolioId}
      />

      <ConfirmDialog
        open={!!deletingRule}
        onOpenChange={(open) => {
          if (!open) setDeletingRule(undefined)
        }}
        title={t('settings.rules.deleteTitle')}
        description={t('settings.rules.deleteDescription')}
        confirmLabel={t('common.delete')}
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  )
}
