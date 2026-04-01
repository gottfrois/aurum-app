import { createFileRoute } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { Lock, MoreHorizontal, Plus } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CategoryFormFields } from '~/components/category-form-fields'
import { ConfirmDialog } from '~/components/confirm-dialog'
import { DataTable } from '~/components/data-table'
import { DialogFormFooter } from '~/components/dialog-form-footer'
import { RequireOwner } from '~/components/require-owner'
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
  '/_settings/settings/workspace/categories',
)({
  component: CategoriesPage,
})

type CategoryRow = {
  _id: string
  label: string
  description?: string
  color: string
  builtIn: boolean
  parentKey?: string
  createdAt?: number
}

function CategoriesPage() {
  const { t } = useTranslation()
  return (
    <RequireOwner>
      <div className="flex h-full flex-col overflow-hidden px-10 pt-16">
        <div className="shrink-0">
          <PageHeader
            title={t('settings.categories.title')}
            description={t('settings.categories.workspaceDescription')}
          />
        </div>
        <div className="mt-8 flex min-h-0 flex-1 flex-col">
          <CategoriesList />
        </div>
      </div>
    </RequireOwner>
  )
}

function CategoriesList() {
  const { t } = useTranslation()
  const categories = useQuery(api.categories.listCategories, {})
  const createCategory = useMutation(api.categories.createCategory)
  const deleteCategory = useMutation(api.categories.deleteCategory)
  const batchDeleteCategories = useMutation(
    api.categories.batchDeleteCategories,
  )
  const [createOpen, setCreateOpen] = React.useState(false)
  const [newLabel, setNewLabel] = React.useState('')
  const [newDescription, setNewDescription] = React.useState('')
  const [newColor, setNewColor] = React.useState('hsl(200 70% 50%)')
  const [saving, setSaving] = React.useState(false)
  const [deletingCategoryId, setDeletingCategoryId] =
    React.useState<Id<'transactionCategories'> | null>(null)

  if (categories === undefined) {
    return <Skeleton className="h-48 w-full rounded-lg" />
  }

  const handleCreate = async () => {
    if (!newLabel.trim()) return
    setSaving(true)
    try {
      await createCategory({
        label: newLabel.trim(),
        description: newDescription.trim() || undefined,
        color: newColor,
      })
      toast.success(t('toast.categoryCreated', { label: newLabel.trim() }))
      setCreateOpen(false)
      setNewLabel('')
      setNewDescription('')
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as string)
          : t('toast.failedCreateCategory'),
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingCategoryId) return
    try {
      await deleteCategory({ categoryId: deletingCategoryId })
      toast.success(t('toast.categoryDeleted'))
      setDeletingCategoryId(null)
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as string)
          : t('toast.failedDeleteCategory'),
      )
    }
  }

  const handleBatchDelete = async (ids: string[]) => {
    try {
      await batchDeleteCategories({
        categoryIds: ids as Id<'transactionCategories'>[],
      })
      toast.success(t('toast.categoriesDeleted', { count: ids.length }))
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as string)
          : t('toast.failedDeleteCategories'),
      )
    }
  }

  const tableColumns: ColumnDef<CategoryRow, unknown>[] = [
    {
      accessorKey: 'label',
      header: t('settings.categories.nameHeader'),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <span
            className="size-3 shrink-0 rounded-full"
            style={{ backgroundColor: row.original.color }}
          />
          <span className="font-medium">{row.original.label}</span>
          {row.original.builtIn && (
            <Lock className="size-3 text-muted-foreground" />
          )}
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: t('settings.categories.descriptionHeader'),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.description}
        </span>
      ),
    },
    {
      id: 'created',
      header: t('settings.categories.createdHeader'),
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
        if (row.original.builtIn) return null
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

  return (
    <>
      <DataTable
        columns={tableColumns}
        data={categories as CategoryRow[]}
        filterColumn="label"
        filterPlaceholder={t('settings.categories.filterPlaceholder')}
        getRowId={(row) => row._id}
        onBatchDelete={handleBatchDelete}
        enableRowSelection={(row) => !row.builtIn}
        groups={[
          {
            label: t('settings.categories.customGroup'),
            filter: (row) => !row.builtIn,
          },
          {
            label: t('settings.categories.defaultGroup'),
            filter: (row) => row.builtIn,
          },
        ]}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t('settings.categories.addCategory')}
          </Button>
        }
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {t('settings.categories.addCategoryTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('settings.categories.addCategoryDescription')}
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
            confirmLabel={t('common.create')}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deletingCategoryId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingCategoryId(null)
        }}
        title={t('settings.categories.deleteCategoryTitle')}
        description={t('settings.categories.deleteCategoryDescription')}
        confirmLabel={t('common.delete')}
        onConfirm={handleDelete}
      />
    </>
  )
}
