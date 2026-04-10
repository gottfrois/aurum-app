import * as Sentry from '@sentry/tanstackstart-react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { Ellipsis, Star } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '~/components/confirm-dialog'
import { DialogFormFooter } from '~/components/dialog-form-footer'
import type { Filter } from '~/components/reui/filters'
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
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_app/views/$viewId')({
  component: ViewDetailPage,
  ssr: false,
})

function ViewDetailPage() {
  const { t } = useTranslation()
  const { viewId: rawViewId } = Route.useParams()
  const viewId = rawViewId as Id<'filterViews'>
  const navigate = useNavigate()
  const view = useQuery(api.filterViews.get, { viewId })
  const favorites = useQuery(api.filterViewFavorites.list)
  const toggleFavorite = useMutation(api.filterViewFavorites.toggle)
  const updateView = useMutation(api.filterViews.update)
  const removeView = useMutation(api.filterViews.remove)

  const filtersRef = React.useRef<Array<Filter>>([])

  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)

  const isFavorite = React.useMemo(
    () => favorites?.some((f) => f.viewId === viewId) ?? false,
    [favorites, viewId],
  )

  const initialFilters = React.useMemo(() => {
    if (!view) return []
    return deserializeFilters(view.filters)
  }, [view])

  const handleFiltersChange = React.useCallback((filters: Array<Filter>) => {
    filtersRef.current = filters
  }, [])

  const handleSaveView = React.useCallback(async () => {
    try {
      await updateView({
        viewId,
        filters: serializeFilters(filtersRef.current),
      })
      toast.success(t('toast.viewFiltersSaved'))
    } catch (error) {
      Sentry.captureException(error)
      toast.error(t('toast.failedSaveFilters'))
    }
  }, [updateView, viewId, t])

  const handleToggleFavorite = async () => {
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
    setDeleting(true)
    try {
      await removeView({ viewId })
      toast.success(t('toast.viewDeleted'))
      navigate({ to: '/views' })
    } catch (error) {
      Sentry.captureException(error)
      toast.error(t('toast.failedDeleteView'))
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
          breadcrumbs={[
            { label: t('views.pageTitle'), href: '/views' },
            { label: '...' },
          ]}
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
            { label: t('views.pageTitle'), href: '/views' },
            { label: t('views.notFound') },
          ]}
        />
        <div className="flex flex-1 flex-col items-center justify-center p-4 md:p-6">
          <p className="text-muted-foreground">{t('views.notFound')}</p>
        </div>
      </>
    )
  }

  return (
    <>
      <SiteHeader
        breadcrumbs={[
          { label: t('views.pageTitle'), href: '/views' },
          { label: view.name },
        ]}
        actions={
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void handleToggleFavorite()}
                  className={isFavorite ? 'text-warning' : ''}
                >
                  <Star
                    className="size-4"
                    fill={isFavorite ? 'currentColor' : 'none'}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isFavorite
                  ? t('button.removeFavorite')
                  : t('button.addFavorite')}
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
                  {t('button.editView')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  {t('common.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="flex flex-1 flex-col">
        <TransactionsContent
          key={viewId}
          initialFilters={initialFilters}
          onFiltersChange={handleFiltersChange}
          onSaveView={handleSaveView}
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
        title={t('views.deleteTitle')}
        description={t('views.deleteConfirm')}
        confirmLabel={t('common.delete')}
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
  const { t } = useTranslation()
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
      toast.success(t('toast.viewUpdated'))
      onOpenChange(false)
    } catch (error) {
      Sentry.captureException(error)
      toast.error(t('toast.failedUpdateView'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{t('views.editTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="view-name">{t('views.editNameLabel')}</Label>
            <Input
              id="view-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="view-description">
              {t('views.editDescriptionLabel')}
            </Label>
            <Textarea
              id="view-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={t('views.editDescriptionPlaceholder')}
            />
          </div>
        </div>
        <DialogFormFooter
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          disabled={!name.trim() || saving}
          saving={saving}
          confirmLabel={t('common.save')}
        />
      </DialogContent>
    </Dialog>
  )
}
