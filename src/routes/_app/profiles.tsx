import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { Check, Copy, Pencil, Trash2 } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Doc } from '../../../convex/_generated/dataModel'
import { SiteHeader } from '~/components/site-header'
import { useProfile } from '~/contexts/profile-context'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from '~/components/ui/item'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Skeleton } from '~/components/ui/skeleton'
import { Badge } from '~/components/ui/badge'
import { ProfileAvatar } from '~/components/profile-avatar'

export const Route = createFileRoute('/_app/profiles')({
  component: ProfilesPage,
})

function ProfilesPage() {
  const { profiles, isLoading, setActiveProfileId } = useProfile()
  const updateProfile = useMutation(api.profiles.updateProfile)
  const deleteProfile = useMutation(api.profiles.deleteProfile)

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
      // If we just deleted the active profile, switch to the first remaining one
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

  return (
    <>
      <SiteHeader title="Manage Profiles" />
      <div className="flex flex-1 flex-col">
        <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
          {isLoading || !profiles ? (
            <ItemGroup className="rounded-lg border">
              {[1, 2].map((i) => (
                <React.Fragment key={i}>
                  {i > 1 && <ItemSeparator />}
                  <Item>
                    <Skeleton className="size-8 rounded-sm" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                    </div>
                    <Skeleton className="h-8 w-16" />
                  </Item>
                </React.Fragment>
              ))}
            </ItemGroup>
          ) : (
            <ItemGroup className="rounded-lg border">
              {profiles.map((profile, i) => (
                  <React.Fragment key={profile._id}>
                    {i > 0 && <ItemSeparator />}
                    <Item>
                      <ProfileAvatar
                        name={profile.name}
                        className="size-8"
                      />
                      <ItemContent>
                        <ItemTitle>{profile.name}</ItemTitle>
                        <ItemDescription>
                          Created{' '}
                          {new Date(profile._creationTime).toLocaleDateString(
                            'fr-FR',
                          )}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openEdit(profile)}
                        >
                          <Pencil className="size-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => openDelete(profile)}
                          disabled={!canDelete}
                        >
                          <Trash2 className="size-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </ItemActions>
                    </Item>
                  </React.Fragment>
                ))}
            </ItemGroup>
          )}
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
    </>
  )
}
