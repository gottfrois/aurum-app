import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Lock, MoreHorizontal, Plus } from 'lucide-react'
import * as React from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'
import { CreateRuleDialog } from '~/components/create-rule-dialog'
import {
  ItemCard,
  ItemCardHeader,
  ItemCardHeaderContent,
  ItemCardHeaderTitle,
  ItemCardItem,
  ItemCardItemAction,
  ItemCardItemContent,
  ItemCardItemDescription,
  ItemCardItems,
  ItemCardItemTitle,
} from '~/components/item-card'
import { RequireOwner } from '~/components/require-owner'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Input } from '~/components/ui/input'
import { HotkeyDisplay, Kbd } from '~/components/ui/kbd'
import { Label } from '~/components/ui/label'
import { Skeleton } from '~/components/ui/skeleton'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export const Route = createFileRoute(
  '/_settings/settings/workspace/categories',
)({
  component: CategoriesPage,
})

function CategoriesPage() {
  return (
    <RequireOwner>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
        <header>
          <h1 className="text-3xl font-semibold">Categories</h1>
        </header>
        <div className="mt-8 space-y-6">
          <CategoriesList />
          <RulesList />
        </div>
      </div>
    </RequireOwner>
  )
}

function CategoriesList() {
  const categories = useQuery(api.categories.listCategories, {})
  const createCategory = useMutation(api.categories.createCategory)
  const deleteCategory = useMutation(api.categories.deleteCategory)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [newLabel, setNewLabel] = React.useState('')
  const [newColor, setNewColor] = React.useState('hsl(200 70% 50%)')
  const [saving, setSaving] = React.useState(false)

  if (categories === undefined) {
    return <Skeleton className="h-48 w-full rounded-lg" />
  }

  const builtIn = categories.filter((c) => c.builtIn)
  const custom = categories.filter((c) => !c.builtIn)

  const handleCreate = async () => {
    if (!newLabel.trim()) return
    setSaving(true)
    try {
      await createCategory({ label: newLabel.trim(), color: newColor })
      toast.success('Category created')
      setCreateOpen(false)
      setNewLabel('')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create category',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (categoryId: Id<'transactionCategories'>) => {
    try {
      await deleteCategory({ categoryId })
      toast.success('Category deleted')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete category',
      )
    }
  }

  return (
    <ItemCard>
      <ItemCardHeader>
        <ItemCardHeaderContent>
          <ItemCardHeaderTitle>Categories</ItemCardHeaderTitle>
        </ItemCardHeaderContent>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Add category
        </Button>
      </ItemCardHeader>
      <ItemCardItems>
        {builtIn.map((cat) => (
          <ItemCardItem key={cat._id}>
            <ItemCardItemContent>
              <div className="flex items-center gap-3">
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                <ItemCardItemTitle>{cat.label}</ItemCardItemTitle>
                <Lock className="size-3 text-muted-foreground" />
              </div>
            </ItemCardItemContent>
          </ItemCardItem>
        ))}
        {custom.map((cat) => (
          <ItemCardItem key={cat._id}>
            <ItemCardItemContent>
              <div className="flex items-center gap-3">
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                <ItemCardItemTitle>{cat.label}</ItemCardItemTitle>
                {cat.parentKey && (
                  <ItemCardItemDescription>
                    under {cat.parentKey}
                  </ItemCardItemDescription>
                )}
              </div>
            </ItemCardItemContent>
            <ItemCardItemAction>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => handleDelete(cat._id)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ItemCardItemAction>
          </ItemCardItem>
        ))}
      </ItemCardItems>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
            <DialogDescription>
              Create a custom transaction category.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-label">Name</Label>
              <Input
                id="cat-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Coffee Shops"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-color">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="cat-color"
                  value={newColor.startsWith('hsl') ? '#3B82F6' : newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="size-8 cursor-pointer rounded border"
                />
                <Input
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  placeholder="hsl(200 70% 50%)"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <CreateCategoryFooter
            onCancel={() => setCreateOpen(false)}
            onConfirm={handleCreate}
            disabled={saving || !newLabel.trim()}
            saving={saving}
          />
        </DialogContent>
      </Dialog>
    </ItemCard>
  )
}

function RulesList() {
  const rules = useQuery(api.transactionRules.listRules)
  const categories = useQuery(api.categories.listCategories, {})
  const deleteRule = useMutation(api.transactionRules.deleteRule)
  const [createOpen, setCreateOpen] = React.useState(false)

  if (rules === undefined) {
    return <Skeleton className="h-48 w-full rounded-lg" />
  }

  const categoryMap = new Map((categories ?? []).map((c) => [c.key, c]))

  const handleDelete = async (ruleId: Id<'transactionRules'>) => {
    try {
      await deleteRule({ ruleId })
      toast.success('Rule deleted')
    } catch {
      toast.error('Failed to delete rule')
    }
  }

  return (
    <ItemCard>
      <ItemCardHeader>
        <ItemCardHeaderContent>
          <ItemCardHeaderTitle>Automation Rules</ItemCardHeaderTitle>
        </ItemCardHeaderContent>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Add rule
        </Button>
      </ItemCardHeader>
      <ItemCardItems>
        {rules.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No rules yet. Create a rule to auto-categorize or exclude
            transactions.
          </div>
        ) : (
          rules.map((rule) => {
            const cat = rule.categoryKey
              ? categoryMap.get(rule.categoryKey)
              : undefined
            return (
              <ItemCardItem key={rule._id}>
                <ItemCardItemContent>
                  <div className="flex items-center gap-3">
                    <ItemCardItemTitle className="font-mono text-sm">
                      {rule.pattern}
                    </ItemCardItemTitle>
                    <Badge variant="secondary" className="text-[10px]">
                      {rule.matchType}
                    </Badge>
                    {cat && (
                      <div className="flex items-center gap-1.5">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-sm text-muted-foreground">
                          {cat.label}
                        </span>
                      </div>
                    )}
                    {rule.excludeFromBudget && (
                      <Badge variant="outline" className="text-[10px]">
                        Excluded from budget
                      </Badge>
                    )}
                  </div>
                </ItemCardItemContent>
                <ItemCardItemAction>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(rule._id)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ItemCardItemAction>
              </ItemCardItem>
            )
          })
        )}
      </ItemCardItems>

      <CreateRuleDialog open={createOpen} onOpenChange={setCreateOpen} />
    </ItemCard>
  )
}

function CreateCategoryFooter({
  onCancel,
  onConfirm,
  disabled,
  saving,
}: {
  onCancel: () => void
  onConfirm: () => void
  disabled: boolean
  saving: boolean
}) {
  const handleConfirm = React.useCallback(() => {
    if (!disabled) onConfirm()
  }, [disabled, onConfirm])

  useHotkeys('escape', onCancel, {
    enableOnFormTags: true,
    preventDefault: true,
  })

  useHotkeys('mod+enter', handleConfirm, {
    enabled: !disabled,
    enableOnFormTags: true,
    preventDefault: true,
  })

  return (
    <DialogFooter>
      <Button variant="outline" onClick={onCancel}>
        Cancel <Kbd>Esc</Kbd>
      </Button>
      <Button onClick={handleConfirm} disabled={disabled} loading={saving}>
        Create <HotkeyDisplay hotkey={{ keys: 'mod+enter' }} />
      </Button>
    </DialogFooter>
  )
}
