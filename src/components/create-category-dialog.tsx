import { useMutation } from 'convex/react'
import * as React from 'react'
import { toast } from 'sonner'
import { DialogFormFooter } from '~/components/dialog-form-footer'
import { ColorPicker } from '~/components/ui/color-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Textarea } from '~/components/ui/textarea'
import { usePortfolio } from '~/contexts/portfolio-context'
import { CATEGORY_PALETTE, deriveCategoryKey } from '~/lib/categories'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

type CategoryScope = 'workspace' | Id<'portfolios'>

interface CreateCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialName: string
  initialColor: string
  /** When set, the scope defaults to this portfolio and the selector is shown */
  defaultPortfolioId: Id<'portfolios'> | null
  onCreated: (categoryKey: string, categoryLabel: string) => void
}

export function CreateCategoryDialog({
  open,
  onOpenChange,
  initialName,
  initialColor,
  defaultPortfolioId,
  onCreated,
}: CreateCategoryDialogProps) {
  const [name, setName] = React.useState(initialName)
  const [description, setDescription] = React.useState('')
  const [color, setColor] = React.useState(initialColor)
  const [scope, setScope] = React.useState<CategoryScope>(
    defaultPortfolioId ?? 'workspace',
  )
  const [saving, setSaving] = React.useState(false)
  const createCategory = useMutation(api.categories.createCategory)
  const { portfolios } = usePortfolio()

  // Sync initial values when dialog opens with new props
  React.useEffect(() => {
    if (open) {
      setName(initialName)
      setDescription('')
      setColor(initialColor)
      setScope(defaultPortfolioId ?? 'workspace')
    }
  }, [open, initialName, initialColor, defaultPortfolioId])

  const disabled = !name.trim() || saving

  const handleCreate = async () => {
    const label = name.trim()
    if (!label) return

    setSaving(true)
    try {
      await createCategory({
        label,
        description: description.trim() || undefined,
        color,
        portfolioId:
          scope !== 'workspace' ? (scope as Id<'portfolios'>) : undefined,
      })
      const key = deriveCategoryKey(label)
      onOpenChange(false)
      onCreated(key, label)
      toast.success(`Category "${label}" created`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create category',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  const scopeLabel =
    scope === 'workspace'
      ? 'all portfolios'
      : (portfolios?.find((p) => p._id === scope)?.name ?? 'this portfolio')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Create category</DialogTitle>
          <DialogDescription>
            This category will be available in {scopeLabel}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="create-cat-name">Name</Label>
            <Input
              id="create-cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Coffee Shops"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-cat-description">Description</Label>
            <Textarea
              id="create-cat-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Daily coffee expenses"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker color={color} onChange={setColor} />
          </div>
          <div className="space-y-2">
            <Label>Scope</Label>
            <Select
              value={scope}
              onValueChange={(v) => setScope(v as CategoryScope)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workspace">
                  Workspace (all portfolios)
                </SelectItem>
                {portfolios?.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFormFooter
          onCancel={handleCancel}
          onConfirm={handleCreate}
          disabled={disabled}
          saving={saving}
          confirmLabel="Create"
        />
      </DialogContent>
    </Dialog>
  )
}

export function useCreateCategoryDialog(
  customCategoryCount: number,
  defaultPortfolioId: Id<'portfolios'> | null,
) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [initialName, setInitialName] = React.useState('')
  const [initialColor, setInitialColor] = React.useState(CATEGORY_PALETTE[0])

  const openDialog = React.useCallback(
    (name: string) => {
      const capitalized = name.charAt(0).toUpperCase() + name.slice(1)
      setInitialName(capitalized)
      setInitialColor(
        CATEGORY_PALETTE[customCategoryCount % CATEGORY_PALETTE.length],
      )
      setDialogOpen(true)
    },
    [customCategoryCount],
  )

  return {
    dialogOpen,
    setDialogOpen,
    initialName,
    initialColor,
    defaultPortfolioId,
    openDialog,
  }
}
