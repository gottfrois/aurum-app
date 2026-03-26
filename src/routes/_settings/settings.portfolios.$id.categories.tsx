import { createFileRoute } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery } from 'convex/react'
import { MoreHorizontal, Plus } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { CategoryFormFields } from '~/components/category-form-fields'
import { ConfirmDialog } from '~/components/confirm-dialog'
import { DataTable, type DataTableGroup } from '~/components/data-table'
import { DialogFormFooter } from '~/components/dialog-form-footer'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { PageHeader } from '~/components/ui/page-header'
import { Skeleton } from '~/components/ui/skeleton'
import { formatShortDate } from '~/lib/utils'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export const Route = createFileRoute(
  '/_settings/settings/portfolios/$id/categories',
)({
  component: PortfolioCategoriesPage,
})

type CategoryRow = {
  _id: string
  label: string
  description?: string
  color: string
  builtIn: boolean
  portfolioId?: string
  createdAt?: number
}

function PortfolioCategoriesPage() {
  const { id } = Route.useParams()
  const portfolioId = id as Id<'portfolios'>
  const portfolio = useQuery(api.portfolios.getPortfolio, { portfolioId })
  const allCategories = useQuery(api.categories.listCategories, { portfolioId })

  if (portfolio === undefined || allCategories === undefined) {
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
          title="Categories"
          description="Transaction categories available in this portfolio."
        />
      </div>
      <div className="mt-8 flex min-h-0 flex-1 flex-col">
        <CategoriesTable
          categories={allCategories as CategoryRow[]}
          portfolioId={portfolioId}
        />
      </div>
    </div>
  )
}

function CategoriesTable({
  categories,
  portfolioId,
}: {
  categories: CategoryRow[]
  portfolioId: Id<'portfolios'>
}) {
  const createCategory = useMutation(api.categories.createCategory)
  const deleteCategory = useMutation(api.categories.deleteCategory)
  const batchDeleteCategories = useMutation(
    api.categories.batchDeleteCategories,
  )
  const [createOpen, setCreateOpen] = React.useState(false)
  const [newLabel, setNewLabel] = React.useState('')
  const [newDescription, setNewDescription] = React.useState('')
  const [newColor, setNewColor] = React.useState('#3B82F6')
  const [saving, setSaving] = React.useState(false)
  const [deletingCategoryId, setDeletingCategoryId] =
    React.useState<Id<'transactionCategories'> | null>(null)

  const isPortfolioLevel = (row: CategoryRow) => row.portfolioId === portfolioId

  const canSelect = (row: CategoryRow) => isPortfolioLevel(row) && !row.builtIn

  const handleCreate = async () => {
    if (!newLabel.trim()) return
    setSaving(true)
    try {
      await createCategory({
        portfolioId,
        label: newLabel.trim(),
        description: newDescription.trim() || undefined,
        color: newColor,
      })
      toast.success('Category created')
      setCreateOpen(false)
      setNewLabel('')
      setNewDescription('')
      setNewColor('#3B82F6')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create category',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingCategoryId) return
    try {
      await deleteCategory({ categoryId: deletingCategoryId })
      toast.success('Category deleted')
      setDeletingCategoryId(null)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete category',
      )
    }
  }

  const handleBatchDelete = async (ids: string[]) => {
    try {
      await batchDeleteCategories({
        categoryIds: ids as Id<'transactionCategories'>[],
      })
      toast.success(
        `${ids.length} categor${ids.length > 1 ? 'ies' : 'y'} deleted`,
      )
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete categories',
      )
    }
  }

  const tableColumns: ColumnDef<CategoryRow, unknown>[] = [
    {
      accessorKey: 'label',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <span
            className="size-3 shrink-0 rounded-full"
            style={{ backgroundColor: row.original.color }}
          />
          <span className="font-medium">{row.original.label}</span>
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.description}
        </span>
      ),
    },
    {
      id: 'created',
      header: 'Created',
      size: 100,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.createdAt
            ? formatShortDate(row.original.createdAt)
            : null}
        </span>
      ),
    },
    {
      id: 'actions',
      size: 50,
      cell: ({ row }) => {
        if (!canSelect(row.original)) return null
        return (
          <div className="flex justify-end">
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
                    setDeletingCategoryId(
                      row.original._id as Id<'transactionCategories'>,
                    )
                  }
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]

  const categoryGroups: DataTableGroup<CategoryRow>[] = [
    { label: 'Portfolio', filter: (row) => isPortfolioLevel(row) },
    {
      label: 'Inherited from workspace',
      filter: (row) => !isPortfolioLevel(row),
    },
  ]

  return (
    <>
      <DataTable
        columns={tableColumns}
        data={categories}
        filterColumn="label"
        filterPlaceholder="Filter by name..."
        getRowId={(row) => row._id}
        onBatchDelete={handleBatchDelete}
        enableRowSelection={(row) => canSelect(row)}
        disabledRowTooltip="Inherited from workspace — manage in workspace settings"
        groups={categoryGroups}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Add category
          </Button>
        }
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
            <DialogDescription>
              Create a category for this portfolio.
            </DialogDescription>
          </DialogHeader>
          <CategoryFormFields
            label={newLabel}
            description={newDescription}
            color={newColor}
            onLabelChange={setNewLabel}
            onDescriptionChange={setNewDescription}
            onColorChange={setNewColor}
          />
          <DialogFormFooter
            onCancel={() => setCreateOpen(false)}
            onConfirm={handleCreate}
            disabled={saving || !newLabel.trim()}
            saving={saving}
            confirmLabel="Create"
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deletingCategoryId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingCategoryId(null)
        }}
        title="Delete category?"
        description="This action cannot be undone. This category will be permanently deleted."
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </>
  )
}
