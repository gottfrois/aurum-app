import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { Ellipsis, Star } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '~/components/confirm-dialog'
import { DialogFormFooter } from '~/components/dialog-form-footer'
import { SiteHeader } from '~/components/site-header'
import { TransactionsContent } from '~/components/transactions-content'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Skeleton } from '~/components/ui/skeleton'
import { Textarea } from '~/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import { useCommand } from '~/hooks/use-command'
import { deserializeFilters, serializeFilters } from '~/lib/filters/serialize'
import type { FilterCondition } from '~/lib/filters/types'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_app/views/$viewId')({
  component: ViewDetailPage,
  ssr: false,
})

function ViewDetailPage() {
  const { viewId: rawViewId } = Route.useParams()
  const viewId = rawViewId as Id<'filterViews'>
  const navigate = useNavigate()
  const view = useQuery(api.filterViews.get, { viewId })
  const favorites = useQuery(api.filterViewFavorites.list)
  const toggleFavorite = useMutation(api.filterViewFavorites.toggle)
  const updateView = useMutation(api.filterViews.update)
  const removeView = useMutation(api.filterViews.remove)

  const conditionsRef = React.useRef<Array<FilterCondition>>([])

  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)

  const isFavorite = React.useMemo(
    () => favorites?.some((f) => f.viewId === viewId) ?? false,
    [favorites, viewId],
  )

  const initialConditions = React.useMemo(() => {
    if (!view) return []
    return deserializeFilters(view.filters)
  }, [view])

  const handleConditionsChange = React.useCallback(
    (conditions: Array<FilterCondition>) => {
      conditionsRef.current = conditions
    },
    [],
  )

  const handleSaveView = React.useCallback(async () => {
    try {
      await updateView({
        viewId,
        filters: serializeFilters(conditionsRef.current),
      })
      toast.success('View filters saved')
    } catch {
      toast.error('Failed to save filters')
    }
  }, [updateView, viewId])

  const handleToggleFavorite = async () => {
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
    setDeleting(true)
    try {
      await removeView({ viewId })
      toast.success('View deleted')
      navigate({ to: '/views' })
    } catch {
      toast.error('Failed to delete view')
    } finally {
      setDeleting(false)
    }
  }

  useCommand('view.toggle-favorite', {
    handler: () => void handleToggleFavorite(),
  })
  useCommand('view.rename', {
    handler: () => setEditOpen(true),
  })
  useCommand('view.delete', {
    handler: () => setDeleteOpen(true),
  })

  if (view === undefined) {
    return (
      <>
        <SiteHeader
          breadcrumbs={[{ label: 'Views', href: '/views' }, { label: '...' }]}
        />
        <div className="flex flex-1 flex-col p-4 md:p-6">
          <Skeleton className="h-8 w-48" />
        </div>
      </>
    )
  }

  if (view === null) {
    return (
      <>
        <SiteHeader
          breadcrumbs={[
            { label: 'Views', href: '/views' },
            { label: 'Not Found' },
          ]}
        />
        <div className="flex flex-1 flex-col items-center justify-center p-4 md:p-6">
          <p className="text-muted-foreground">View not found</p>
        </div>
      </>
    )
  }

  return (
    <>
      <SiteHeader
        breadcrumbs={[{ label: 'Views', href: '/views' }, { label: view.name }]}
        actions={
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void handleToggleFavorite()}
                  className={isFavorite ? 'text-yellow-500' : ''}
                >
                  <Star
                    className="size-4"
                    fill={isFavorite ? 'currentColor' : 'none'}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              </TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <Ellipsis className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  Edit details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="flex flex-1 flex-col">
        <TransactionsContent
          key={viewId}
          initialConditions={initialConditions}
          onConditionsChange={handleConditionsChange}
          onSaveView={handleSaveView}
          entityType="transactions"
        />
      </div>

      <EditViewDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        viewId={viewId}
        initialName={view.name}
        initialDescription={view.description ?? ''}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete view"
        description="Are you sure you want to delete this view? This action cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  )
}

function EditViewDialog({
  open,
  onOpenChange,
  viewId,
  initialName,
  initialDescription,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  viewId: Id<'filterViews'>
  initialName: string
  initialDescription: string
}) {
  const updateView = useMutation(api.filterViews.update)
  const [name, setName] = React.useState(initialName)
  const [description, setDescription] = React.useState(initialDescription)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setName(initialName)
      setDescription(initialDescription)
    }
  }, [open, initialName, initialDescription])

  const handleCancel = () => onOpenChange(false)

  const handleConfirm = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await updateView({
        viewId,
        name: name.trim(),
        description: description.trim() || undefined,
      })
      toast.success('View updated')
      onOpenChange(false)
    } catch {
      toast.error('Failed to update view')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Edit view</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="view-name">Name</Label>
            <Input
              id="view-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="view-description">Description</Label>
            <Textarea
              id="view-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description..."
            />
          </div>
        </div>
        <DialogFormFooter
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          disabled={!name.trim() || saving}
          saving={saving}
          confirmLabel="Save"
        />
      </DialogContent>
    </Dialog>
  )
}
