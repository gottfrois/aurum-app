import { useMutation } from 'convex/react'
import { Info } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { DialogFormFooter } from '~/components/dialog-form-footer'
import { LabelFormFields } from '~/components/label-form-fields'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import { usePortfolio } from '~/contexts/portfolio-context'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

const LABEL_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
]

type LabelScope = 'workspace' | Id<'portfolios'>

interface CreateLabelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialName: string
  initialColor: string
  /** When set, the scope defaults to this portfolio and the selector is shown */
  defaultPortfolioId: Id<'portfolios'> | null
  workspaceId: Id<'workspaces'>
  onCreated: (labelId: Id<'transactionLabels'>) => void
}

export function CreateLabelDialog({
  open,
  onOpenChange,
  initialName,
  initialColor,
  defaultPortfolioId,
  workspaceId,
  onCreated,
}: CreateLabelDialogProps) {
  const [name, setName] = React.useState(initialName)
  const [description, setDescription] = React.useState('')
  const [color, setColor] = React.useState(initialColor)
  const [scope, setScope] = React.useState<LabelScope>(
    defaultPortfolioId ?? 'workspace',
  )
  const [saving, setSaving] = React.useState(false)
  const createLabel = useMutation(api.transactionLabels.createLabel)
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
      const labelId = await createLabel({
        workspaceId,
        name: label,
        description: description.trim() || undefined,
        color,
        portfolioId:
          scope !== 'workspace' ? (scope as Id<'portfolios'>) : undefined,
      })
      onOpenChange(false)
      onCreated(labelId)
      toast.success(`Label "${label}" created`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create label',
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
          <DialogTitle>Create label</DialogTitle>
          <DialogDescription>
            This label will be available in {scopeLabel}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <LabelFormFields
            name={name}
            description={description}
            color={color}
            onNameChange={setName}
            onDescriptionChange={setDescription}
            onColorChange={setColor}
          />
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              Visibility
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[200px]">
                  Choose whether this label is available in a single portfolio
                  or shared across all portfolios in your workspace.
                </TooltipContent>
              </Tooltip>
            </Label>
            <Select
              value={scope}
              onValueChange={(v) => setScope(v as LabelScope)}
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

export function useCreateLabelDialog(
  labelCount: number,
  defaultPortfolioId: Id<'portfolios'> | null,
) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [initialName, setInitialName] = React.useState('')
  const [initialColor, setInitialColor] = React.useState(LABEL_COLORS[0])

  const openDialog = React.useCallback(
    (name: string) => {
      const capitalized = name.charAt(0).toUpperCase() + name.slice(1)
      setInitialName(capitalized)
      setInitialColor(LABEL_COLORS[labelCount % LABEL_COLORS.length])
      setDialogOpen(true)
    },
    [labelCount],
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
