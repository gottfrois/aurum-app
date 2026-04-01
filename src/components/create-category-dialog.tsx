import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { Info } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { DialogFormFooter } from '~/components/dialog-form-footer'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import { useEncryption } from '~/contexts/encryption-context'
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
  const { t } = useTranslation()
  const [name, setName] = React.useState(initialName)
  const [description, setDescription] = React.useState('')
  const [color, setColor] = React.useState(initialColor)
  const [scope, setScope] = React.useState<CategoryScope>(
    defaultPortfolioId ?? 'workspace',
  )
  const [saving, setSaving] = React.useState(false)
  const [showPromote, setShowPromote] = React.useState(false)
  const createCategory = useMutation(api.categories.createCategory)
  const promoteCategoryMutation = useMutation(api.categories.promoteCategory)
  const { portfolios } = usePortfolio()
  const { role, workspacePolicies } = useEncryption()
  const canCreateWorkspaceCategory =
    role === 'owner' || workspacePolicies?.categoryCreation === 'all_members'

  const key = deriveCategoryKey(name.trim())
  const conflict = useQuery(
    api.categories.checkCategoryKeyConflict,
    key
      ? {
          key,
          portfolioId:
            scope !== 'workspace' ? (scope as Id<'portfolios'>) : undefined,
        }
      : 'skip',
  )

  // Sync initial values when dialog opens with new props
  React.useEffect(() => {
    if (open) {
      setName(initialName)
      setDescription('')
      setColor(initialColor)
      setScope(
        defaultPortfolioId ??
          (canCreateWorkspaceCategory
            ? 'workspace'
            : (portfolios?.[0]?._id ?? 'workspace')),
      )
      setShowPromote(false)
    }
  }, [
    open,
    initialName,
    initialColor,
    defaultPortfolioId,
    canCreateWorkspaceCategory,
    portfolios,
  ])

  const disabled = !name.trim() || saving

  const handleCreate = async () => {
    const label = name.trim()
    if (!label) return

    // Suggest promoting when same key exists in another portfolio
    if (conflict?.type === 'exists_in_portfolio') {
      setShowPromote(true)
      return
    }

    setSaving(true)
    try {
      await createCategory({
        label,
        description: description.trim() || undefined,
        color,
        portfolioId:
          scope !== 'workspace' ? (scope as Id<'portfolios'>) : undefined,
      })
      const categoryKey = deriveCategoryKey(label)
      onOpenChange(false)
      onCreated(categoryKey, label)
      toast.success(t('toast.categoryCreated', { label }))
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as string)
          : t('toast.failedCreateCategory'),
      )
    } finally {
      setSaving(false)
    }
  }

  const handlePromote = async () => {
    if (conflict?.type !== 'exists_in_portfolio') return

    setSaving(true)
    try {
      await promoteCategoryMutation({ categoryId: conflict.categoryId })
      onOpenChange(false)
      onCreated(key, name.trim())
      toast.success(t('toast.categoryPromoted', { label: name.trim() }))
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as string)
          : t('toast.failedPromoteCategory'),
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
      ? t('dialogs.createCategory.scopeAllPortfolios')
      : (portfolios?.find((p) => p._id === scope)?.name ??
        t('dialogs.createCategory.scopeSinglePortfolio'))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{t('dialogs.createCategory.title')}</DialogTitle>
          <DialogDescription>
            {t('dialogs.createCategory.subtitle', { scope: scopeLabel })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="create-cat-name">{t('form.name')}</Label>
            <Input
              id="create-cat-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setShowPromote(false)
              }}
              placeholder={t('form.categoryNamePlaceholder')}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-cat-description">
              {t('form.description')}
            </Label>
            <Textarea
              id="create-cat-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('form.descriptionPlaceholder')}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('form.color')}</Label>
            <ColorPicker color={color} onChange={setColor} />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              {t('dialogs.createCategory.visibilityLabel')}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[200px]">
                  {t('dialogs.createCategory.visibilityTooltip')}
                </TooltipContent>
              </Tooltip>
            </Label>
            <Select
              value={scope}
              onValueChange={(v) => {
                setScope(v as CategoryScope)
                setShowPromote(false)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {canCreateWorkspaceCategory && (
                  <SelectItem value="workspace">
                    {t('dialogs.createCategory.workspaceOption')}
                  </SelectItem>
                )}
                {portfolios?.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {showPromote && conflict?.type === 'exists_in_portfolio' && (
            <Alert>
              <AlertDescription className="space-y-3">
                <p>
                  {t('dialogs.createCategory.promoteMessage', {
                    name: name.trim(),
                    portfolio: conflict.portfolioName,
                  })}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handlePromote} loading={saving}>
                    {t('dialogs.createCategory.promoteButton')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowPromote(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
        {!showPromote && (
          <DialogFormFooter
            onCancel={handleCancel}
            onConfirm={handleCreate}
            disabled={disabled}
            saving={saving}
            confirmLabel={t('common.create')}
          />
        )}
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
