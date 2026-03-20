import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { MoreHorizontal, Plus } from 'lucide-react'
import * as React from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'
import {
  ItemCard,
  ItemCardHeader,
  ItemCardHeaderContent,
  ItemCardHeaderTitle,
  ItemCardItem,
  ItemCardItemAction,
  ItemCardItemContent,
  ItemCardItems,
  ItemCardItemTitle,
} from '~/components/item-card'
import { RequireOwner } from '~/components/require-owner'
import { Button } from '~/components/ui/button'
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
import { Input } from '~/components/ui/input'
import { HotkeyDisplay, Kbd } from '~/components/ui/kbd'
import { Label } from '~/components/ui/label'
import { Skeleton } from '~/components/ui/skeleton'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_settings/settings/workspace/labels')({
  component: LabelsPage,
})

function LabelsPage() {
  return (
    <RequireOwner>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
        <header>
          <h1 className="text-3xl font-semibold">Labels</h1>
        </header>
        <div className="mt-8 space-y-6">
          <LabelsList />
        </div>
      </div>
    </RequireOwner>
  )
}

function LabelsList() {
  const workspace = useQuery(api.workspaces.getMyWorkspace)
  const labels = useQuery(
    api.transactionLabels.listWorkspaceLabels,
    workspace ? { workspaceId: workspace._id } : 'skip',
  )
  const createLabel = useMutation(api.transactionLabels.createLabel)
  const updateLabel = useMutation(api.transactionLabels.updateLabel)
  const deleteLabel = useMutation(api.transactionLabels.deleteLabel)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editingLabel, setEditingLabel] = React.useState<{
    _id: Id<'transactionLabels'>
    name: string
    color: string
  } | null>(null)
  const [newName, setNewName] = React.useState('')
  const [newColor, setNewColor] = React.useState('#3B82F6')
  const [saving, setSaving] = React.useState(false)

  if (labels === undefined || workspace === undefined) {
    return <Skeleton className="h-48 w-full rounded-lg" />
  }

  if (!workspace) return null

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await createLabel({
        workspaceId: workspace._id,
        name: newName.trim(),
        color: newColor,
      })
      toast.success('Label created')
      setCreateOpen(false)
      setNewName('')
      setNewColor('#3B82F6')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create label')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingLabel || !newName.trim()) return
    setSaving(true)
    try {
      await updateLabel({
        labelId: editingLabel._id,
        name: newName.trim(),
        color: newColor,
      })
      toast.success('Label updated')
      setEditingLabel(null)
      setNewName('')
      setNewColor('#3B82F6')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update label')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (labelId: Id<'transactionLabels'>) => {
    try {
      await deleteLabel({ labelId })
      toast.success('Label deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete label')
    }
  }

  const openEdit = (label: {
    _id: Id<'transactionLabels'>
    name: string
    color: string
  }) => {
    setEditingLabel(label)
    setNewName(label.name)
    setNewColor(label.color)
  }

  return (
    <ItemCard>
      <ItemCardHeader>
        <ItemCardHeaderContent>
          <ItemCardHeaderTitle>Labels</ItemCardHeaderTitle>
        </ItemCardHeaderContent>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Add label
        </Button>
      </ItemCardHeader>
      <ItemCardItems>
        {labels.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No labels yet. Create a label to tag transactions.
          </div>
        ) : (
          labels.map((label) => (
            <ItemCardItem key={label._id}>
              <ItemCardItemContent>
                <div className="flex items-center gap-3">
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  <ItemCardItemTitle>{label.name}</ItemCardItemTitle>
                </div>
              </ItemCardItemContent>
              <ItemCardItemAction>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(label)}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDelete(label._id)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </ItemCardItemAction>
            </ItemCardItem>
          ))
        )}
      </ItemCardItems>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Add Label</DialogTitle>
            <DialogDescription>
              Create a label to tag transactions.
            </DialogDescription>
          </DialogHeader>
          <LabelFormFields
            name={newName}
            color={newColor}
            onNameChange={setNewName}
            onColorChange={setNewColor}
          />
          <LabelFormFooter
            onCancel={() => setCreateOpen(false)}
            onConfirm={handleCreate}
            disabled={saving || !newName.trim()}
            saving={saving}
            confirmLabel="Create"
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingLabel !== null}
        onOpenChange={(open) => {
          if (!open) setEditingLabel(null)
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Edit Label</DialogTitle>
            <DialogDescription>Update label name or color.</DialogDescription>
          </DialogHeader>
          <LabelFormFields
            name={newName}
            color={newColor}
            onNameChange={setNewName}
            onColorChange={setNewColor}
          />
          <LabelFormFooter
            onCancel={() => setEditingLabel(null)}
            onConfirm={handleUpdate}
            disabled={saving || !newName.trim()}
            saving={saving}
            confirmLabel="Save"
          />
        </DialogContent>
      </Dialog>
    </ItemCard>
  )
}

function LabelFormFields({
  name,
  color,
  onNameChange,
  onColorChange,
}: {
  name: string
  color: string
  onNameChange: (value: string) => void
  onColorChange: (value: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="label-name">Name</Label>
        <Input
          id="label-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Urgent"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="label-color">Color</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            id="label-color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="size-8 cursor-pointer rounded border"
          />
          <Input
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            placeholder="#3B82F6"
            className="flex-1"
          />
        </div>
      </div>
    </div>
  )
}

function LabelFormFooter({
  onCancel,
  onConfirm,
  disabled,
  saving,
  confirmLabel,
}: {
  onCancel: () => void
  onConfirm: () => void
  disabled: boolean
  saving: boolean
  confirmLabel: string
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
      <Button onClick={handleConfirm} disabled={disabled} loading={saving}>
        {confirmLabel} <HotkeyDisplay hotkey={{ keys: 'mod+enter' }} />
      </Button>
    </DialogFooter>
  )
}
