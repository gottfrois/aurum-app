import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '~/components/confirm-dialog'
import {
  ItemCard,
  ItemCardItem,
  ItemCardItemAction,
  ItemCardItemContent,
  ItemCardItemDescription,
  ItemCardItems,
  ItemCardItemTitle,
} from '~/components/item-card'
import { RequireOwner } from '~/components/require-owner'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { PageHeader } from '~/components/ui/page-header'
import { Skeleton } from '~/components/ui/skeleton'
import { api } from '../../../convex/_generated/api'

export const Route = createFileRoute('/_settings/settings/workspace/')({
  component: GeneralPage,
})

function GeneralPage() {
  const workspace = useQuery(api.workspaces.getMyWorkspace)

  if (workspace === undefined) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-10 py-16">
        <header>
          <Skeleton className="h-9 w-32" />
        </header>
        <div className="mt-8 space-y-6">
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (!workspace) return null

  return (
    <RequireOwner>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
        <PageHeader
          title="General"
          description="Manage your workspace name and settings."
        />
        <div className="mt-8 space-y-6">
          <WorkspaceNameCard name={workspace.name} />
          <DeleteWorkspaceCard workspaceName={workspace.name} />
        </div>
      </div>
    </RequireOwner>
  )
}

function WorkspaceNameCard({ name }: { name: string }) {
  const updateWorkspace = useMutation(api.workspaces.updateWorkspace)
  const [workspaceName, setWorkspaceName] = useState(name)
  const [saving, setSaving] = useState(false)

  async function handleBlur() {
    const trimmed = workspaceName.trim()
    if (trimmed === name) return

    if (!trimmed) {
      setWorkspaceName(name)
      toast.error('Workspace name cannot be empty')
      return
    }

    setSaving(true)
    try {
      await updateWorkspace({ name: trimmed })
      toast.success('Workspace name updated')
    } catch {
      setWorkspaceName(name)
      toast.error('Failed to update workspace name')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ItemCard>
      <ItemCardItems>
        <ItemCardItem>
          <ItemCardItemContent>
            <ItemCardItemTitle>Workspace name</ItemCardItemTitle>
          </ItemCardItemContent>
          <ItemCardItemAction>
            <Input
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              disabled={saving}
              className="h-8 w-48 text-sm"
            />
          </ItemCardItemAction>
        </ItemCardItem>
      </ItemCardItems>
    </ItemCard>
  )
}

function DeleteWorkspaceCard({ workspaceName }: { workspaceName: string }) {
  const deleteWorkspace = useAction(api.workspaces.deleteWorkspace)
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      await deleteWorkspace()
      toast.success('Workspace deleted')
      navigate({ to: '/' })
    } catch {
      toast.error('Failed to delete workspace')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">Workspace access</h2>
      <ItemCard>
        <ItemCardItems>
          <ItemCardItem>
            <ItemCardItemContent>
              <ItemCardItemTitle>Delete workspace</ItemCardItemTitle>
              <ItemCardItemDescription>
                Permanently delete this workspace and all associated data. This
                action cannot be undone.
              </ItemCardItemDescription>
            </ItemCardItemContent>
            <ItemCardItemAction>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmOpen(true)}
              >
                Delete
              </Button>
            </ItemCardItemAction>
          </ItemCardItem>
        </ItemCardItems>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Delete workspace"
          description={`This will permanently delete ${workspaceName} and all associated data including connections, transactions, investments, and member data. This action cannot be undone.`}
          confirmValue={workspaceName}
          confirmLabel="Delete"
          loading={loading}
          onConfirm={handleDelete}
        />
      </ItemCard>
    </section>
  )
}
