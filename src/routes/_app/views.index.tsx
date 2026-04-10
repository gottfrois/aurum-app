import * as Sentry from '@sentry/tanstackstart-react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { Layers, MoreHorizontal, Plus } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '~/components/confirm-dialog'
import { DataTable } from '~/components/data-table'
import { SiteHeader } from '~/components/site-header'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '~/components/ui/empty'
import { PageHeader } from '~/components/ui/page-header'
import { Skeleton } from '~/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import { usePortfolio } from '~/contexts/portfolio-context'
import { deserializeFilters } from '~/lib/filters/serialize'
import { formatShortDate } from '~/lib/utils'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_app/views/')({
  component: ViewsPage,
  ssr: false,
})

type ViewRow = {
  _id: Id<'filterViews'>
  name: string
  description?: string
  color?: string
  filters: string
  visibility: string
  portfolioId?: Id<'portfolios'>
  portfolioName?: string
  filterCount: number
  createdAt: number
  isFavorite: boolean
}

function ViewsPage() {
  const { t } = useTranslation()
  return (
    <>
      <SiteHeader title={t('views.pageTitle')} />
      <div className="flex flex-1 flex-col">
        <ViewsContent />
      </div>
    </>
  )
}

function ViewsContent() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const views = useQuery(api.filterViews.list, {})
  const favorites = useQuery(api.filterViewFavorites.list)
  const toggleFavorite = useMutation(api.filterViewFavorites.toggle)
  const removeView = useMutation(api.filterViews.remove)
  const { portfolios } = usePortfolio()

  const [deleteViewId, setDeleteViewId] =
    React.useState<Id<'filterViews'> | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const favoriteViewIds = React.useMemo(
    () => new Set(favorites?.map((f) => f.viewId) ?? []),
    [favorites],
  )

  const portfolioNameMap = React.useMemo(() => {
    const map = new Map<string, string>()
    if (!portfolios) return map
    for (const p of portfolios) {
      map.set(p._id, p.name)
    }
    return map
  }, [portfolios])

  const handleToggleFavorite = async (viewId: Id<'filterViews'>) => {
    try {
      const result = await toggleFavorite({ viewId })
      toast.success(
        result.favorited
          ? t('toast.addedFavorite')
          : t('toast.removedFavorite'),
      )
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as string)
          : t('toast.failedToggleFavorite'),
      )
    }
  }

  const handleDelete = async () => {
    if (!deleteViewId) return
    setDeleting(true)
    try {
      await removeView({ viewId: deleteViewId })
      toast.success(t('toast.viewDeleted'))
      setDeleteViewId(null)
    } catch (error) {
      Sentry.captureException(error)
      toast.error(t('toast.failedDeleteView'))
    } finally {
      setDeleting(false)
    }
  }

  const handleBatchDelete = async (ids: string[]) => {
    try {
      for (const id of ids) {
        await removeView({ viewId: id as Id<'filterViews'> })
      }
      toast.success(t('toast.viewsDeleted', { count: ids.length }))
    } catch (error) {
      Sentry.captureException(error)
      toast.error(t('toast.failedDeleteViews'))
    }
  }

  if (views === undefined) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-10 py-16">
        <Skeleton className="h-9 w-40" />
        <div className="mt-8">
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (views.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-4 md:p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Layers />
            </EmptyMedia>
            <EmptyTitle>{t('views.emptyTitle')}</EmptyTitle>
            <EmptyDescription>{t('views.emptyDescription')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              onClick={() =>
                navigate({ to: '/cash-flow', search: { createView: true } })
              }
            >
              {t('button.createView')}
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  const tableData: ViewRow[] = views.map((view) => {
    let filterCount = 0
    try {
      filterCount = deserializeFilters(view.filters).length
    } catch {}
    return {
      _id: view._id,
      name: view.name,
      description: view.description,
      color: view.color,
      filters: view.filters,
      visibility: view.visibility ?? 'workspace',
      portfolioId: view.portfolioId,
      portfolioName: view.portfolioId
        ? portfolioNameMap.get(view.portfolioId)
        : undefined,
      filterCount,
      createdAt: view.createdAt,
      isFavorite: favoriteViewIds.has(view._id),
    }
  })

  const portfolioIds = [
    ...new Set(
      tableData.flatMap((v) =>
        v.visibility === 'portfolio' && v.portfolioId ? [v.portfolioId] : [],
      ),
    ),
  ]

  const newViewAction = (scope: string, tooltip: string) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-xs" asChild>
          <Link to="/cash-flow" search={{ createView: true, viewScope: scope }}>
            <Plus className="size-3" />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )

  const groups = [
    ...(tableData.some((v) => v.visibility === 'personal')
      ? [
          {
            label: t('views.personalGroup'),
            description: t('views.personalDescription'),
            action: newViewAction('personal', t('views.createPersonalTooltip')),
            filter: (row: ViewRow) => row.visibility === 'personal',
          },
        ]
      : []),
    ...(tableData.some((v) => v.visibility === 'workspace')
      ? [
          {
            label: t('views.workspaceGroup'),
            description: t('views.workspaceDescription'),
            action: newViewAction(
              'workspace',
              t('views.createWorkspaceTooltip'),
            ),
            filter: (row: ViewRow) => row.visibility === 'workspace',
          },
        ]
      : []),
    ...portfolioIds.map((pid) => ({
      label: portfolioNameMap.get(pid) ?? 'Portfolio',
      action: newViewAction(pid, t('views.createPortfolioTooltip')),
      filter: (row: ViewRow) =>
        row.visibility === 'portfolio' && row.portfolioId === pid,
    })),
  ]

  const tableColumns: ColumnDef<ViewRow, unknown>[] = [
    {
      accessorKey: 'name',
      header: t('views.nameHeader'),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {row.original.color ? (
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: row.original.color }}
            />
          ) : (
            <Layers className="size-3 shrink-0 text-muted-foreground" />
          )}
          <Link
            to="/views/$viewId"
            params={{ viewId: row.original._id }}
            className="font-medium hover:underline"
          >
            {row.original.name}
          </Link>
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: t('views.descriptionHeader'),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.description}
        </span>
      ),
    },
    {
      id: 'filters',
      header: t('views.filtersHeader'),
      size: 80,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.filterCount > 0 ? `${row.original.filterCount}` : null}
        </span>
      ),
    },
    {
      id: 'created',
      header: t('views.createdHeader'),
      size: 100,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatShortDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      size: 50,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 opacity-0 transition-opacity group-hover/row:opacity-100 data-[state=open]:opacity-100"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/views/$viewId" params={{ viewId: row.original._id }}>
                  {t('button.openView')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => void handleToggleFavorite(row.original._id)}
              >
                {row.original.isFavorite
                  ? t('button.removeFavorite')
                  : t('button.addFavorite')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteViewId(row.original._id)}
              >
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  return (
    <>
      <div className="mx-auto w-full max-w-3xl flex-1 px-10 py-16">
        <div className="shrink-0">
          <PageHeader
            title={t('views.pageTitle')}
            description={t('views.description')}
          />
        </div>
        <div className="mt-8 flex min-h-0 flex-1 flex-col">
          <DataTable
            columns={tableColumns}
            data={tableData}
            filterColumn="name"
            filterPlaceholder={t('views.filterPlaceholder')}
            getRowId={(row) => row._id}
            onBatchDelete={handleBatchDelete}
            groups={groups}
            actions={
              <Button
                size="sm"
                onClick={() =>
                  navigate({
                    to: '/cash-flow',
                    search: { createView: true },
                  })
                }
              >
                <Plus className="size-4" />
                {t('button.newView')}
              </Button>
            }
          />
        </div>
      </div>

      <ConfirmDialog
        open={deleteViewId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteViewId(null)
        }}
        title={t('views.deleteTitle')}
        description={t('views.deleteConfirm')}
        confirmLabel={t('common.delete')}
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  )
}
