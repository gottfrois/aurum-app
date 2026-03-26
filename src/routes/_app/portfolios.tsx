import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { MoreVertical } from 'lucide-react'
import * as React from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'
import { ConfirmDialog } from '~/components/confirm-dialog'
import { CreatePortfolioDialog } from '~/components/create-portfolio-dialog'
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
import { PortfolioAvatar } from '~/components/portfolio-avatar'
import { SiteHeader } from '~/components/site-header'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
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
import { PageHeader } from '~/components/ui/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Skeleton } from '~/components/ui/skeleton'
import { usePortfolio } from '~/contexts/portfolio-context'
import { api } from '../../../convex/_generated/api'
import type { Doc } from '../../../convex/_generated/dataModel'

type SharingLevel = 'none' | 'percentages' | 'full'

function toSharingLevel(portfolio: Doc<'portfolios'>): SharingLevel {
  if (!portfolio.shared) return 'none'
  return (portfolio.shareAmounts ?? true) ? 'full' : 'percentages'
}

const SHARING_LABELS: Record<SharingLevel, string> = {
  none: 'Not shared',
  percentages: 'Percentages only',
  full: 'Full access',
}

export const Route = createFileRoute('/_app/portfolios')({
  component: PortfoliosPage,
})

function PortfoliosPage() {
  const { portfolios, isLoading, setActivePortfolioId } = usePortfolio()
  const updatePortfolio = useMutation(api.portfolios.updatePortfolio)
  const deletePortfolio = useMutation(api.portfolios.deletePortfolio)
  const updateSharing = useMutation(api.portfolios.updatePortfolioSharing)
  const subscription = useQuery(api.billing.getSubscriptionStatus)
  const isTeamPlan = subscription?.isActive && subscription?.plan === 'team'

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [editingPortfolio, setEditingPortfolio] =
    React.useState<Doc<'portfolios'> | null>(null)
  const [editName, setEditName] = React.useState('')
  const [deletingPortfolio, setDeletingPortfolio] =
    React.useState<Doc<'portfolios'> | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  function openEdit(portfolio: Doc<'portfolios'>) {
    setEditingPortfolio(portfolio)
    setEditName(portfolio.name)
  }

  async function handleSaveEdit() {
    if (!editingPortfolio || !editName.trim()) return
    await updatePortfolio({
      portfolioId: editingPortfolio._id,
      name: editName.trim(),
    })
    setEditingPortfolio(null)
  }

  function openDelete(portfolio: Doc<'portfolios'>) {
    setDeletingPortfolio(portfolio)
  }

  async function handleDelete() {
    if (!deletingPortfolio) return
    setIsDeleting(true)
    try {
      await deletePortfolio({ portfolioId: deletingPortfolio._id })
      const remaining = portfolios?.filter(
        (p) => p._id !== deletingPortfolio._id,
      )
      if (remaining && remaining.length > 0) {
        setActivePortfolioId(remaining[0]._id)
      }
      setDeletingPortfolio(null)
    } catch (err) {
      console.error('Failed to delete portfolio:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleSharingChange(portfolioId: string, level: SharingLevel) {
    try {
      await updateSharing({
        portfolioId: portfolioId as never,
        shared: level !== 'none',
        shareAmounts: level === 'full',
      })
      toast.success(level === 'none' ? 'Portfolio unshared' : 'Sharing updated')
    } catch {
      toast.error('Failed to update sharing')
    }
  }

  const canDelete = (portfolios?.length ?? 0) > 1

  if (isLoading || !portfolios) {
    return (
      <>
        <SiteHeader title="Manage Portfolios" />
        <div className="mx-auto w-full max-w-3xl flex-1 px-10 py-16">
          <header>
            <Skeleton className="h-9 w-40" />
          </header>
          <div className="mt-8 space-y-6">
            <div className="rounded-lg border">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-28" />
              </div>
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-4 py-3 ${i > 1 ? 'border-t' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-8 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="size-8" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <SiteHeader title="Manage Portfolios" />
      <div className="mx-auto w-full max-w-3xl flex-1 px-10 py-16">
        <PageHeader
          title="Your portfolios"
          description="Organize your accounts into separate portfolios for tracking."
        />
        <div className="mt-8 space-y-6">
          <ItemCard>
            <ItemCardHeader>
              <ItemCardHeaderContent>
                <ItemCardHeaderTitle>
                  {portfolios.length}{' '}
                  {portfolios.length === 1 ? 'portfolio' : 'portfolios'}
                </ItemCardHeaderTitle>
              </ItemCardHeaderContent>
              <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                Add portfolio
              </Button>
            </ItemCardHeader>
            <ItemCardItems>
              {portfolios.map((portfolio) => {
                const level = toSharingLevel(portfolio)
                return (
                  <ItemCardItem key={portfolio._id}>
                    <div className="flex items-center gap-3">
                      <PortfolioAvatar
                        name={portfolio.name}
                        className="size-8"
                      />
                      <ItemCardItemContent>
                        <ItemCardItemTitle>{portfolio.name}</ItemCardItemTitle>
                        <ItemCardItemDescription>
                          {isTeamPlan
                            ? SHARING_LABELS[level]
                            : `Created ${new Date(portfolio._creationTime).toLocaleDateString('fr-FR')}`}
                        </ItemCardItemDescription>
                      </ItemCardItemContent>
                    </div>
                    <ItemCardItemAction>
                      <div className="flex items-center gap-2">
                        {isTeamPlan && (
                          <Select
                            value={level}
                            onValueChange={(value) =>
                              handleSharingChange(
                                portfolio._id,
                                value as SharingLevel,
                              )
                            }
                          >
                            <SelectTrigger size="sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Not shared</SelectItem>
                              <SelectItem value="percentages">
                                Percentages only
                              </SelectItem>
                              <SelectItem value="full">Full access</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                            >
                              <MoreVertical className="size-4" />
                              <span className="sr-only">More</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openEdit(portfolio)}
                            >
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => openDelete(portfolio)}
                              disabled={!canDelete}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </ItemCardItemAction>
                  </ItemCardItem>
                )
              })}
            </ItemCardItems>
          </ItemCard>
        </div>
      </div>

      <Dialog
        open={!!editingPortfolio}
        onOpenChange={(open) => {
          if (!open) setEditingPortfolio(null)
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Edit Portfolio</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-portfolio-name">Name</Label>
              <Input
                id="edit-portfolio-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
          </div>
          <EditPortfolioFooter
            onCancel={() => setEditingPortfolio(null)}
            onConfirm={handleSaveEdit}
            disabled={!editName.trim()}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingPortfolio}
        onOpenChange={(open) => {
          if (!open) setDeletingPortfolio(null)
        }}
        title="Delete Portfolio"
        description={`Deleting ${deletingPortfolio?.name} is permanent and cannot be undone. Deleting a portfolio also deletes all associated accounts & connections.`}
        confirmValue={deletingPortfolio?.name}
        confirmLabel="Delete"
        loading={isDeleting}
        onConfirm={handleDelete}
      />

      <CreatePortfolioDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  )
}

function EditPortfolioFooter({
  onCancel,
  onConfirm,
  disabled,
}: {
  onCancel: () => void
  onConfirm: () => void
  disabled: boolean
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
      <Button onClick={handleConfirm} disabled={disabled}>
        Save <HotkeyDisplay hotkey={{ keys: 'mod+enter' }} />
      </Button>
    </DialogFooter>
  )
}
