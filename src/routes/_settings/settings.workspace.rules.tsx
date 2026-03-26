import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Plus, Zap } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '~/components/confirm-dialog'
import { RequireOwner } from '~/components/require-owner'
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
import { api } from '../../../convex/_generated/api'
import type { Doc } from '../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_settings/settings/workspace/rules')({
  component: RulesPage,
})

function RulesPage() {
  return (
    <RequireOwner>
      <div className="flex h-full flex-col overflow-hidden px-10 pt-16">
        <div className="shrink-0">
          <PageHeader
            title="Automation Rules"
            description="Rules are processed top-to-bottom. The first matching rule assigns the category. Labels and budget exclusions are applied from all matching rules."
          />
        </div>
        <div className="mt-8 flex min-h-0 flex-1 flex-col">
          <RulesList />
        </div>
      </div>
    </RequireOwner>
  )
}

function RulesList() {
  const rules = useQuery(api.transactionRules.listRules)
  const categories = useQuery(api.categories.listCategories, {})
  const workspace = useQuery(api.workspaces.getMyWorkspace)
  const labels = useQuery(
    api.transactionLabels.listWorkspaceLabels,
    workspace ? { workspaceId: workspace._id } : 'skip',
  )
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

  // Open edit dialog once a newly created rule appears in the list
  React.useEffect(() => {
    if (pendingEditId && rules) {
      const created = rules.find((r) => r._id === pendingEditId)
      if (created) {
        setPendingEditId(null)
        setEditingRule(created)
      }
    }
  }, [pendingEditId, rules])

  // Sync server rules to local state when no reorder is pending
  React.useEffect(() => {
    if (rules && !pendingReorder.current) {
      setLocalRules(rules)
    }
  }, [rules])

  if (rules === undefined || categories === undefined) {
    return <Skeleton className="h-48 w-full rounded-lg" />
  }

  const displayRules = localRules ?? rules
  const categoryMap = new Map(categories.map((c) => [c.key, c]))
  const labelMap = new Map((labels ?? []).map((l) => [l._id, l]))
  const isFiltering = filter.trim().length > 0
  const filteredRules = isFiltering
    ? displayRules.filter((r) =>
        r.pattern.toLowerCase().includes(filter.toLowerCase()),
      )
    : displayRules

  const handleDelete = async () => {
    if (!deletingRule) return
    setDeleting(true)
    try {
      await deleteRule({ ruleId: deletingRule._id })
      toast.success('Rule deleted')
      setDeletingRule(undefined)
    } catch {
      toast.error('Failed to delete rule')
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
    toggleRule({ ruleId: rule._id, enabled }).catch(() => {
      toast.error('Failed to toggle rule')
      setLocalRules((prev) =>
        (prev ?? rules ?? []).map((r) =>
          r._id === rule._id ? { ...r, enabled: !enabled } : r,
        ),
      )
    })
  }

  const handleReorder = (reordered: Doc<'transactionRules'>[]) => {
    pendingReorder.current = true
    setLocalRules(reordered)
    const orderedIds = reordered.map((r) => r._id)
    reorderRules({ orderedRuleIds: orderedIds })
      .catch(() => {
        toast.error('Failed to reorder rules')
        setLocalRules(rules ?? null)
      })
      .finally(() => {
        pendingReorder.current = false
      })
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Input
          placeholder="Filter by pattern..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex-1" />
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Add rule
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {filteredRules.length === 0 && !isFiltering ? (
          <Empty className="mt-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Zap />
              </EmptyMedia>
              <EmptyTitle>No automation rules yet</EmptyTitle>
              <EmptyDescription>
                Rules automatically categorize, label, and exclude transactions
                based on their description.
              </EmptyDescription>
            </EmptyHeader>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Add rule
            </Button>
          </Empty>
        ) : filteredRules.length === 0 && isFiltering ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No rules match "{filter}"
          </p>
        ) : (
          <Sortable
            value={filteredRules}
            onValueChange={handleReorder}
            getItemValue={(item) => item._id}
            modifiers={[restrictToVerticalAxis]}
            className="space-y-2 pb-8"
          >
            {filteredRules.map((rule, index) => (
              <SortableItem key={rule._id} value={rule._id}>
                <RuleCard
                  rule={rule}
                  index={index}
                  categoryMap={categoryMap}
                  labelMap={labelMap}
                  dragDisabled={isFiltering}
                  onEdit={() => setEditingRule(rule)}
                  onDelete={() => setDeletingRule(rule)}
                  onToggle={(enabled) => handleToggle(rule, enabled)}
                />
              </SortableItem>
            ))}
          </Sortable>
        )}
      </ScrollArea>

      <RuleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(ruleId) => setPendingEditId(ruleId)}
      />

      <RuleDialog
        open={!!editingRule}
        onOpenChange={(open) => {
          if (!open) setEditingRule(undefined)
        }}
        rule={editingRule}
      />

      <ConfirmDialog
        open={!!deletingRule}
        onOpenChange={(open) => {
          if (!open) setDeletingRule(undefined)
        }}
        title="Delete rule?"
        description="This automation rule will be permanently deleted. Transactions already processed by this rule will not be affected."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  )
}
