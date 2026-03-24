import { createFileRoute } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery } from 'convex/react'
import { MoreHorizontal, Plus } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { DataTable } from '~/components/data-table'
import { RequireOwner } from '~/components/require-owner'
import { RuleDialog } from '~/components/rule-dialog'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Skeleton } from '~/components/ui/skeleton'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_settings/settings/workspace/rules')({
  component: RulesPage,
})

function RulesPage() {
  return (
    <RequireOwner>
      <div className="flex h-full flex-col overflow-hidden px-10 pt-16">
        <header className="shrink-0">
          <h1 className="text-3xl font-semibold">Automation Rules</h1>
        </header>
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
  const batchDeleteRules = useMutation(api.transactionRules.batchDeleteRules)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editingRule, setEditingRule] = React.useState<
    Doc<'transactionRules'> | undefined
  >(undefined)

  if (rules === undefined || categories === undefined) {
    return <Skeleton className="h-48 w-full rounded-lg" />
  }

  const categoryMap = new Map(categories.map((c) => [c.key, c]))
  const labelMap = new Map((labels ?? []).map((l) => [l._id, l]))

  const handleDelete = async (ruleId: Id<'transactionRules'>) => {
    try {
      await deleteRule({ ruleId })
      toast.success('Rule deleted')
    } catch {
      toast.error('Failed to delete rule')
    }
  }

  const handleBatchDelete = async (ids: string[]) => {
    try {
      await batchDeleteRules({
        ruleIds: ids as Id<'transactionRules'>[],
      })
      toast.success(`${ids.length} rule${ids.length > 1 ? 's' : ''} deleted`)
    } catch {
      toast.error('Failed to delete rules')
    }
  }

  const tableColumns: ColumnDef<Doc<'transactionRules'>, unknown>[] = [
    {
      accessorKey: 'pattern',
      header: 'Pattern',
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.pattern}</span>
      ),
    },
    {
      id: 'matchType',
      header: 'Match',
      size: 100,
      cell: ({ row }) => (
        <Badge variant="secondary" className="text-[10px]">
          {row.original.matchType}
        </Badge>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      cell: ({ row }) => {
        const cat = row.original.categoryKey
          ? categoryMap.get(row.original.categoryKey)
          : undefined
        if (!cat) return null
        return (
          <div className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: cat.color }}
            />
            <span className="text-sm">{cat.label}</span>
          </div>
        )
      },
    },
    {
      id: 'labels',
      header: 'Labels',
      cell: ({ row }) => {
        const ruleLabelIds = row.original.labelIds
        if (!ruleLabelIds || ruleLabelIds.length === 0) return null
        return (
          <div className="flex flex-wrap gap-1">
            {ruleLabelIds.map((id) => {
              const label = labelMap.get(id)
              if (!label) return null
              return (
                <Badge key={id} variant="outline" className="text-[10px]">
                  <span
                    className="mr-1 inline-block size-2 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  {label.name}
                </Badge>
              )
            })}
          </div>
        )
      },
    },
    {
      id: 'flags',
      header: '',
      size: 140,
      cell: ({ row }) => {
        if (!row.original.excludeFromBudget) return null
        return (
          <Badge variant="outline" className="text-[10px]">
            Excluded from budget
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      size: 50,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditingRule(row.original)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => handleDelete(row.original._id)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  return (
    <>
      <DataTable
        columns={tableColumns}
        data={rules}
        filterColumn="pattern"
        filterPlaceholder="Filter by pattern..."
        getRowId={(row) => row._id}
        onBatchDelete={handleBatchDelete}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Add rule
          </Button>
        }
      />

      <RuleDialog open={createOpen} onOpenChange={setCreateOpen} />

      <RuleDialog
        open={!!editingRule}
        onOpenChange={(open) => {
          if (!open) setEditingRule(undefined)
        }}
        rule={editingRule}
      />
    </>
  )
}
