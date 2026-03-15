import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { Check, Copy, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Doc } from '../../../convex/_generated/dataModel'
import { SiteHeader } from '~/components/site-header'
import { usePortfolio } from '~/contexts/portfolio-context'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  ItemCard,
  ItemCardHeader,
  ItemCardHeaderContent,
  ItemCardHeaderTitle,
  ItemCardItem,
  ItemCardItemAction,
  ItemCardItemContent,
  ItemCardItemDescription,
  ItemCardItemTitle,
  ItemCardItems,
} from '~/components/item-card'
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
import { Skeleton } from '~/components/ui/skeleton'
import { Badge } from '~/components/ui/badge'
import { PortfolioAvatar } from '~/components/portfolio-avatar'
import { CreatePortfolioDialog } from '~/components/create-portfolio-dialog'

export const Route = createFileRoute('/_app/portfolios')({
  component: PortfoliosPage,
})

function PortfoliosPage() {
  const { portfolios, isLoading, setActivePortfolioId } = usePortfolio()
  const updatePortfolio = useMutation(api.portfolios.updatePortfolio)
  const deletePortfolio = useMutation(api.portfolios.deletePortfolio)

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [editingPortfolio, setEditingPortfolio] =
    React.useState<Doc<'portfolios'> | null>(null)
  const [editName, setEditName] = React.useState('')
  const [deletingPortfolio, setDeletingPortfolio] =
    React.useState<Doc<'portfolios'> | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = React.useState('')
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

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
    setDeleteConfirmName('')
    setCopied(false)
  }

  async function handleCopyName() {
    if (!deletingPortfolio) return
    await navigator.clipboard.writeText(deletingPortfolio.name)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

  const canDelete = (portfolios?.length ?? 0) > 1

  if (isLoading || !portfolios) {
    return (
      <>
        <SiteHeader title="Manage Portfolios" />
        <div className="mx-auto w-full max-w-3xl flex-1 px-10 py-16">
          <div className="mt-8 space-y-6">
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <SiteHeader title="Manage Portfolios" />
      <div className="mx-auto w-full max-w-3xl flex-1 px-10 py-16">
        <header>
          <h1 className="text-3xl font-semibold">Portfolios</h1>
        </header>
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
              {portfolios.map((portfolio) => (
                <ItemCardItem key={portfolio._id}>
                  <div className="flex items-center gap-3">
                    <PortfolioAvatar name={portfolio.name} className="size-8" />
                    <ItemCardItemContent>
                      <ItemCardItemTitle>{portfolio.name}</ItemCardItemTitle>
                      <ItemCardItemDescription>
                        Created{' '}
                        {new Date(portfolio._creationTime).toLocaleDateString(
                          'fr-FR',
                        )}
                      </ItemCardItemDescription>
                    </ItemCardItemContent>
                  </div>
                  <ItemCardItemAction>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreVertical className="size-4" />
                          <span className="sr-only">More</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(portfolio)}>
                          <Pencil className="size-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => openDelete(portfolio)}
                          disabled={!canDelete}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </ItemCardItemAction>
                </ItemCardItem>
              ))}
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
        <DialogContent>
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit()
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPortfolio(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={!editName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deletingPortfolio}
        onOpenChange={(open) => {
          if (!open) setDeletingPortfolio(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Portfolio</DialogTitle>
            <DialogDescription>
              Deleting{' '}
              <span className="font-semibold">{deletingPortfolio?.name}</span>{' '}
              is permanent and cannot be undone. Deleting a portfolio also
              deletes all associated accounts & connections.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label
                htmlFor="delete-confirm"
                className="flex flex-wrap items-center gap-1"
              >
                Type
                <Badge
                  variant="secondary"
                  className="cursor-pointer gap-1 font-mono"
                  onClick={handleCopyName}
                >
                  {deletingPortfolio?.name}
                  {copied ? (
                    <Check className="size-3" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </Badge>
                to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={deletingPortfolio?.name}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingPortfolio(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={
                deleteConfirmName !== deletingPortfolio?.name || isDeleting
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreatePortfolioDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  )
}
