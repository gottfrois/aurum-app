import { useUser } from '@clerk/tanstack-react-start'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAction, useQuery } from 'convex/react'
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
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { PageHeader } from '~/components/ui/page-header'
import { Skeleton } from '~/components/ui/skeleton'
import { useEncryption } from '~/contexts/encryption-context'
import { api } from '../../../convex/_generated/api'

export const Route = createFileRoute('/_settings/settings/account/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  const { user, isLoaded } = useUser()

  if (!isLoaded) {
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

  if (!user) return null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
      <PageHeader
        title="Profile"
        description="Your personal information and display settings."
      />
      <div className="mt-8 space-y-6">
        <ItemCard>
          <ItemCardItems>
            <ProfilePictureItem />
            <EmailItem />
            <FullNameItem />
          </ItemCardItems>
        </ItemCard>
        <WorkspaceSection />
      </div>
    </div>
  )
}

function ProfilePictureItem() {
  const { user } = useUser()
  if (!user) return null

  const name = user.fullName ?? ''
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <ItemCardItem>
      <ItemCardItemContent>
        <ItemCardItemTitle>Profile picture</ItemCardItemTitle>
      </ItemCardItemContent>
      <ItemCardItemAction>
        <Avatar className="size-10 rounded-full">
          <AvatarImage src={user.imageUrl} alt={name} />
          <AvatarFallback className="rounded-full">{initials}</AvatarFallback>
        </Avatar>
      </ItemCardItemAction>
    </ItemCardItem>
  )
}

function EmailItem() {
  const { user } = useUser()
  if (!user) return null

  return (
    <ItemCardItem>
      <ItemCardItemContent>
        <ItemCardItemTitle>Email</ItemCardItemTitle>
      </ItemCardItemContent>
      <ItemCardItemAction>
        <span className="text-sm text-muted-foreground">
          {user.primaryEmailAddress?.emailAddress ?? ''}
        </span>
      </ItemCardItemAction>
    </ItemCardItem>
  )
}

function FullNameItem() {
  const { user } = useUser()
  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [saving, setSaving] = useState(false)

  if (!user) return null

  async function handleBlur() {
    const trimmed = fullName.trim()

    if (trimmed === (user?.fullName ?? '')) return

    if (!trimmed) {
      setFullName(user?.fullName ?? '')
      toast.error('Name cannot be empty')
      return
    }

    setSaving(true)
    try {
      await user?.update({
        firstName: trimmed.split(' ')[0],
        lastName: trimmed.split(' ').slice(1).join(' ') || undefined,
      })
      toast.success('Profile updated')
    } catch {
      setFullName(user?.fullName ?? '')
      toast.error('Failed to update name')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ItemCardItem>
      <ItemCardItemContent>
        <ItemCardItemTitle>Full name</ItemCardItemTitle>
      </ItemCardItemContent>
      <ItemCardItemAction>
        <Input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          disabled={saving}
          className="h-8 w-48 text-sm"
        />
      </ItemCardItemAction>
    </ItemCardItem>
  )
}

function WorkspaceSection() {
  const { role } = useEncryption()
  const workspace = useQuery(api.workspaces.getMyWorkspace)

  if (role === null || !workspace) return null

  if (role === 'owner')
    return <DeleteWorkspaceCard workspaceName={workspace.name} />
  return <LeaveWorkspaceCard workspaceName={workspace.name} />
}

function LeaveWorkspaceCard({ workspaceName }: { workspaceName: string }) {
  const leaveWorkspace = useAction(api.workspaces.leaveWorkspace)
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLeave() {
    setLoading(true)
    try {
      await leaveWorkspace()
      toast.success('You have left the workspace')
      navigate({ to: '/' })
    } catch {
      toast.error('Failed to leave workspace')
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
              <ItemCardItemTitle>Leave workspace</ItemCardItemTitle>
              <ItemCardItemDescription>
                You will lose access to all shared data in this workspace.
              </ItemCardItemDescription>
            </ItemCardItemContent>
            <ItemCardItemAction>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmOpen(true)}
              >
                Leave
              </Button>
            </ItemCardItemAction>
          </ItemCardItem>
        </ItemCardItems>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Leave workspace"
          description={`Are you sure you want to leave ${workspaceName}? You will lose access to all shared data.`}
          confirmValue={workspaceName}
          confirmLabel="Leave"
          loading={loading}
          onConfirm={handleLeave}
        />
      </ItemCard>
    </section>
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
