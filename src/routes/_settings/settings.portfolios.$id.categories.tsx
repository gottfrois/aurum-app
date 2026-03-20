import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Lock, MoreHorizontal, Plus } from 'lucide-react'
import * as React from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'
import {
  ItemCard,
  ItemCardHeader,
  ItemCardHeaderContent,
  ItemCardHeaderDescription,
  ItemCardHeaderTitle,
  ItemCardItem,
  ItemCardItemAction,
  ItemCardItemContent,
  ItemCardItems,
  ItemCardItemTitle,
} from '~/components/item-card'
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
  '/_settings/settings/portfolios/$id/categories',
)({
  component: PortfolioCategoriesPage,
})

function PortfolioCategoriesPage() {
  const { id } = Route.useParams()
  const portfolioId = id as Id<'portfolios'>
  const portfolio = useQuery(api.portfolios.getPortfolio, { portfolioId })
  const workspaceCategories = useQuery(api.categories.listWorkspaceCategories)
  const allCategories = useQuery(api.categories.listCategories, { portfolioId })

  if (
    portfolio === undefined ||
    workspaceCategories === undefined ||
    allCategories === undefined
  ) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-10 py-16">
        <Skeleton className="h-9 w-32" />
        <div className="mt-8 space-y-6">
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (!portfolio) return null

  const portfolioCategories = allCategories.filter(
    (c) => c.portfolioId === portfolioId,
  )

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
      <header>
        <h1 className="text-3xl font-semibold">Categories</h1>
      </header>
      <div className="mt-8 space-y-6">
        <InheritedCategoriesCard categories={workspaceCategories} />
        <PortfolioCategoriesCard
          categories={portfolioCategories}
          portfolioId={portfolioId}
        />
      </div>
    </div>
  )
}

function InheritedCategoriesCard({
  categories,
}: {
  categories: Array<{
    _id: string
    label: string
    color: string
    builtIn: boolean
  }>
}) {
  return (
    <ItemCard>
      <ItemCardHeader>
        <ItemCardHeaderContent>
          <ItemCardHeaderTitle>Workspace categories</ItemCardHeaderTitle>
          <ItemCardHeaderDescription>
            Inherited from workspace settings
          </ItemCardHeaderDescription>
        </ItemCardHeaderContent>
      </ItemCardHeader>
      <ItemCardItems>
        {categories.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No workspace categories defined.
          </div>
        ) : (
          categories.map((cat) => (
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
          ))
        )}
      </ItemCardItems>
    </ItemCard>
  )
}

function PortfolioCategoriesCard({
  categories,
  portfolioId,
}: {
  categories: Array<{
    _id: string
    label: string
    color: string
    builtIn: boolean
    portfolioId?: string
  }>
  portfolioId: Id<'portfolios'>
}) {
  const createCategory = useMutation(api.categories.createCategory)
  const deleteCategory = useMutation(api.categories.deleteCategory)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [newLabel, setNewLabel] = React.useState('')
  const [newColor, setNewColor] = React.useState('#3B82F6')
  const [saving, setSaving] = React.useState(false)

  const handleCreate = async () => {
    if (!newLabel.trim()) return
    setSaving(true)
    try {
      await createCategory({
        portfolioId,
        label: newLabel.trim(),
        color: newColor,
      })
      toast.success('Category created')
      setCreateOpen(false)
      setNewLabel('')
      setNewColor('#3B82F6')
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
          <ItemCardHeaderTitle>Portfolio categories</ItemCardHeaderTitle>
        </ItemCardHeaderContent>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Add category
        </Button>
      </ItemCardHeader>
      <ItemCardItems>
        {categories.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No portfolio-specific categories yet.
          </div>
        ) : (
          categories.map((cat) => (
            <ItemCardItem key={cat._id}>
              <ItemCardItemContent>
                <div className="flex items-center gap-3">
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <ItemCardItemTitle>{cat.label}</ItemCardItemTitle>
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
                      onClick={() =>
                        handleDelete(cat._id as Id<'transactionCategories'>)
                      }
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </ItemCardItemAction>
            </ItemCardItem>
          ))
        )}
      </ItemCardItems>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
            <DialogDescription>
              Create a category for this portfolio.
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
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="size-8 cursor-pointer rounded border"
                />
                <Input
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  placeholder="#3B82F6"
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
