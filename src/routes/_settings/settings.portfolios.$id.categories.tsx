import { createFileRoute } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { MoreHorizontal, Plus } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '~/components/confirm-dialog'
import {
  CreateCategoryDialog,
  useCreateCategoryDialog,
} from '~/components/create-category-dialog'
import { DataTable, type DataTableGroup } from '~/components/data-table'
import { Button } from '~/components/ui/button'
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
  const { t } = useTranslation()
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
          title={t('settings.categories.title')}
          description={t('settings.categories.portfolioDescription')}
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
  const { t } = useTranslation()
  const deleteCategory = useMutation(api.categories.deleteCategory)
  const batchDeleteCategories = useMutation(
    api.categories.batchDeleteCategories,
  )
  const customCategoryCount = categories.filter(
    (c) => c.portfolioId === portfolioId && !c.builtIn,
  ).length
  const createDialog = useCreateCategoryDialog(customCategoryCount, portfolioId)
  const [deletingCategoryId, setDeletingCategoryId] =
    React.useState<Id<'transactionCategories'> | null>(null)

  const isPortfolioLevel = (row: CategoryRow) => row.portfolioId === portfolioId

  const canSelect = (row: CategoryRow) => isPortfolioLevel(row) && !row.builtIn

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
                  {t('common.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]

  const categoryGroups: DataTableGroup<CategoryRow>[] = [
    {
      label: t('settings.categories.portfolioGroup'),
      filter: (row) => isPortfolioLevel(row),
    },
    {
      label: t('settings.categories.inheritedGroup'),
      filter: (row) => !isPortfolioLevel(row),
    },
  ]

  return (
    <>
      <DataTable
        columns={tableColumns}
        data={categories}
        filterColumn="label"
        filterPlaceholder={t('settings.categories.filterPlaceholder')}
        getRowId={(row) => row._id}
        onBatchDelete={handleBatchDelete}
        enableRowSelection={(row) => canSelect(row)}
        disabledRowTooltip={t('settings.categories.inheritedTooltip')}
        groups={categoryGroups}
        actions={
          <Button size="sm" onClick={() => createDialog.openDialog('')}>
            <Plus className="size-4" />
            {t('settings.categories.addCategory')}
          </Button>
        }
      />

      <CreateCategoryDialog
        open={createDialog.dialogOpen}
        onOpenChange={createDialog.setDialogOpen}
        initialName={createDialog.initialName}
        initialColor={createDialog.initialColor}
        defaultPortfolioId={createDialog.defaultPortfolioId}
        onCreated={() => {}}
      />

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
