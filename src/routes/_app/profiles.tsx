import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { Check, Copy, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Doc } from '../../../convex/_generated/dataModel'
import { SiteHeader } from '~/components/site-header'
import { useProfile } from '~/contexts/profile-context'
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
import { ProfileAvatar } from '~/components/profile-avatar'
import { CreateProfileDialog } from '~/components/create-profile-dialog'

export const Route = createFileRoute('/_app/profiles')({
  component: ProfilesPage,
})

function ProfilesPage() {
  const { profiles, isLoading, setActiveProfileId } = useProfile()
  const updateProfile = useMutation(api.profiles.updateProfile)
  const deleteProfile = useMutation(api.profiles.deleteProfile)

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [editingProfile, setEditingProfile] =
    React.useState<Doc<'profiles'> | null>(null)
  const [editName, setEditName] = React.useState('')
  const [deletingProfile, setDeletingProfile] =
    React.useState<Doc<'profiles'> | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = React.useState('')
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  function openEdit(profile: Doc<'profiles'>) {
    setEditingProfile(profile)
    setEditName(profile.name)
  }

  async function handleSaveEdit() {
    if (!editingProfile || !editName.trim()) return
    await updateProfile({
      profileId: editingProfile._id,
      name: editName.trim(),
    })
    setEditingProfile(null)
  }

  function openDelete(profile: Doc<'profiles'>) {
    setDeletingProfile(profile)
    setDeleteConfirmName('')
    setCopied(false)
  }

  async function handleCopyName() {
    if (!deletingProfile) return
    await navigator.clipboard.writeText(deletingProfile.name)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleDelete() {
    if (!deletingProfile) return
    setIsDeleting(true)
    try {
      await deleteProfile({ profileId: deletingProfile._id })
      const remaining = profiles?.filter((p) => p._id !== deletingProfile._id)
      if (remaining && remaining.length > 0) {
        setActiveProfileId(remaining[0]._id)
      }
      setDeletingProfile(null)
    } catch (err) {
      console.error('Failed to delete profile:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  const canDelete = (profiles?.length ?? 0) > 1

  if (isLoading || !profiles) {
    return (
      <>
        <SiteHeader title="Manage Profiles" />
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
      <SiteHeader title="Manage Profiles" />
      <div className="mx-auto w-full max-w-3xl flex-1 px-10 py-16">
        <header>
          <h1 className="text-3xl font-semibold">Profiles</h1>
        </header>
        <div className="mt-8 space-y-6">
          <ItemCard>
            <ItemCardHeader>
              <ItemCardHeaderContent>
                <ItemCardHeaderTitle>
                  {profiles.length}{' '}
                  {profiles.length === 1 ? 'profile' : 'profiles'}
                </ItemCardHeaderTitle>
              </ItemCardHeaderContent>
              <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                Add profile
              </Button>
            </ItemCardHeader>
            <ItemCardItems>
              {profiles.map((profile) => (
                <ItemCardItem key={profile._id}>
                  <div className="flex items-center gap-3">
                    <ProfileAvatar name={profile.name} className="size-8" />
                    <ItemCardItemContent>
                      <ItemCardItemTitle>{profile.name}</ItemCardItemTitle>
                      <ItemCardItemDescription>
                        Created{' '}
                        {new Date(profile._creationTime).toLocaleDateString(
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
                        <DropdownMenuItem onClick={() => openEdit(profile)}>
                          <Pencil className="size-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => openDelete(profile)}
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
        open={!!editingProfile}
        onOpenChange={(open) => {
          if (!open) setEditingProfile(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-profile-name">Name</Label>
              <Input
                id="edit-profile-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit()
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProfile(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={!editName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deletingProfile}
        onOpenChange={(open) => {
          if (!open) setDeletingProfile(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Profile</DialogTitle>
            <DialogDescription>
              Deleting{' '}
              <span className="font-semibold">{deletingProfile?.name}</span> is
              permanent and cannot be undone. Deleting a profile also deletes
              all associated accounts & connections.
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
                  {deletingProfile?.name}
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
                placeholder={deletingProfile?.name}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingProfile(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={
                deleteConfirmName !== deletingProfile?.name || isDeleting
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateProfileDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  )
}
