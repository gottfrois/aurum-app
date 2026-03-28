import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { Layers, MoreHorizontal, Plus } from 'lucide-react'
import * as React from 'react'
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
  return (
    <>
      <SiteHeader title="Views" />
      <div className="flex flex-1 flex-col">
        <ViewsContent />
      </div>
    </>
  )
}

function ViewsContent() {
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
        result.favorited ? 'Added to favorites' : 'Removed from favorites',
      )
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as string)
          : 'Failed to toggle favorite',
      )
    }
  }

  const handleDelete = async () => {
    if (!deleteViewId) return
    setDeleting(true)
    try {
      await removeView({ viewId: deleteViewId })
      toast.success('View deleted')
      setDeleteViewId(null)
    } catch {
      toast.error('Failed to delete view')
    } finally {
      setDeleting(false)
    }
  }

  const handleBatchDelete = async (ids: string[]) => {
    try {
      for (const id of ids) {
        await removeView({ viewId: id as Id<'filterViews'> })
      }
      toast.success(`${ids.length} view${ids.length > 1 ? 's' : ''} deleted`)
    } catch {
      toast.error('Failed to delete views')
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
            <EmptyTitle>Views</EmptyTitle>
            <EmptyDescription>
              Create custom views using filters to show only the transactions
              you want to see. You can save, share, and favorite these views for
              easy access and faster collaboration.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              onClick={() =>
                navigate({ to: '/transactions', search: { createView: true } })
              }
            >
              Create new view
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
      tableData
        .filter((v) => v.visibility === 'portfolio' && v.portfolioId)
        .map((v) => v.portfolioId!),
    ),
  ]

  const newViewAction = (scope: string, tooltip: string) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-xs" asChild>
          <Link
            to="/transactions"
            search={{ createView: true, viewScope: scope }}
          >
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
            label: 'Personal views',
            description: 'Only visible to you',
            action: newViewAction('personal', 'Create personal view...'),
            filter: (row: ViewRow) => row.visibility === 'personal',
          },
        ]
      : []),
    ...(tableData.some((v) => v.visibility === 'workspace')
      ? [
          {
            label: 'Workspace',
            description: 'Visible to everyone',
            action: newViewAction('workspace', 'Create workspace view...'),
            filter: (row: ViewRow) => row.visibility === 'workspace',
          },
        ]
      : []),
    ...portfolioIds.map((pid) => ({
      label: portfolioNameMap.get(pid) ?? 'Portfolio',
      action: newViewAction(pid, 'Create portfolio view...'),
      filter: (row: ViewRow) =>
        row.visibility === 'portfolio' && row.portfolioId === pid,
    })),
  ]

  const tableColumns: ColumnDef<ViewRow, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
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
      header: 'Description',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.description}
        </span>
      ),
    },
    {
      id: 'filters',
      header: 'Filters',
      size: 80,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.filterCount > 0 ? `${row.original.filterCount}` : null}
        </span>
      ),
    },
    {
      id: 'created',
      header: 'Created',
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
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/views/$viewId" params={{ viewId: row.original._id }}>
                  Open view
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => void handleToggleFavorite(row.original._id)}
              >
                {row.original.isFavorite
                  ? 'Remove from favorites'
                  : 'Add to favorites'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteViewId(row.original._id)}
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
      <div className="mx-auto w-full max-w-3xl flex-1 px-10 py-16">
        <div className="shrink-0">
          <PageHeader
            title="Views"
            description="Save and organize filtered views of your transactions."
          />
        </div>
        <div className="mt-8 flex min-h-0 flex-1 flex-col">
          <DataTable
            columns={tableColumns}
            data={tableData}
            filterColumn="name"
            filterPlaceholder="Filter by name..."
            getRowId={(row) => row._id}
            onBatchDelete={handleBatchDelete}
            groups={groups}
            actions={
              <Button
                size="sm"
                onClick={() =>
                  navigate({
                    to: '/transactions',
                    search: { createView: true },
                  })
                }
              >
                <Plus className="size-4" />
                New view
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
        title="Delete view"
        description="Are you sure you want to delete this view? This action cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  )
}
