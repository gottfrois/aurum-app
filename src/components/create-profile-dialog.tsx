import * as React from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useProfile } from '~/contexts/profile-context'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

export function CreateProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const createProfile = useMutation(api.profiles.createProfile)
  const { setActiveProfileId } = useProfile()
  const [newName, setNewName] = React.useState('')

  async function handleCreate() {
    if (!newName.trim()) return
    const id = await createProfile({ name: newName.trim(), icon: 'User' })
    setActiveProfileId(id)
    setNewName('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Profile</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. SASU Pro, Joint Account"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!newName.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
