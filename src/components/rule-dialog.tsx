import { useMutation, useQuery } from 'convex/react'
import * as React from 'react'
import { toast } from 'sonner'
import { DialogFormFooter } from '~/components/dialog-form-footer'
import { Checkbox } from '~/components/ui/checkbox'
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
import { Switch } from '~/components/ui/switch'
import { useRetroactiveRuleApplication } from '~/hooks/use-retroactive-rule-application'
import { useCategories } from '~/lib/categories'
import { cn } from '~/lib/utils'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'

interface RuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: Doc<'transactionRules'>
  defaultPattern?: string
  defaultCategoryKey?: string
  defaultExcludeFromBudget?: boolean
}

export function RuleDialog({
  open,
  onOpenChange,
  rule,
  defaultPattern = '',
  defaultCategoryKey = '',
  defaultExcludeFromBudget = false,
}: RuleDialogProps) {
  const isEdit = !!rule
  const [pattern, setPattern] = React.useState(defaultPattern)
  const [matchType, setMatchType] = React.useState<'contains' | 'regex'>(
    'contains',
  )
  const [categoryKey, setCategoryKey] = React.useState(defaultCategoryKey)
  const [excludeFromBudget, setExcludeFromBudget] = React.useState(
    defaultExcludeFromBudget,
  )
  const [selectedLabelIds, setSelectedLabelIds] = React.useState<string[]>([])
  const [applyRetroactively, setApplyRetroactively] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const { categories } = useCategories()
  const workspace = useQuery(api.workspaces.getMyWorkspace)
  const labels = useQuery(
    api.transactionLabels.listWorkspaceLabels,
    workspace ? { workspaceId: workspace._id } : 'skip',
  )
  const createRule = useMutation(api.transactionRules.createRule)
  const updateRule = useMutation(api.transactionRules.updateRule)
  const { apply } = useRetroactiveRuleApplication()

  React.useEffect(() => {
    if (open) {
      if (rule) {
        setPattern(rule.pattern)
        setMatchType(rule.matchType)
        setCategoryKey(rule.categoryKey ?? '')
        setExcludeFromBudget(rule.excludeFromBudget ?? false)
        setSelectedLabelIds((rule.labelIds as string[] | undefined) ?? [])
        setApplyRetroactively(true)
      } else {
        setPattern(defaultPattern)
        setMatchType('contains')
        setCategoryKey(defaultCategoryKey)
        setExcludeFromBudget(defaultExcludeFromBudget)
        setSelectedLabelIds([])
        setApplyRetroactively(true)
      }
    }
  }, [open, rule, defaultPattern, defaultCategoryKey, defaultExcludeFromBudget])

  const hasAction =
    !!categoryKey || excludeFromBudget || selectedLabelIds.length > 0

  const handleSave = async () => {
    if (!pattern.trim() || !hasAction) return
    setSaving(true)
    try {
      if (isEdit) {
        await updateRule({
          ruleId: rule._id,
          pattern: pattern.trim(),
          matchType,
          categoryKey: categoryKey || undefined,
          excludeFromBudget: excludeFromBudget || undefined,
          labelIds:
            selectedLabelIds.length > 0
              ? (selectedLabelIds as Array<Id<'transactionLabels'>>)
              : undefined,
        })
        toast.success('Rule updated')
      } else {
        await createRule({
          pattern: pattern.trim(),
          matchType,
          categoryKey: categoryKey || undefined,
          excludeFromBudget: excludeFromBudget || undefined,
          labelIds:
            selectedLabelIds.length > 0
              ? (selectedLabelIds as Array<Id<'transactionLabels'>>)
              : undefined,
        })
        toast.success('Rule created', {
          description: applyRetroactively
            ? 'Existing transactions are being updated.'
            : 'New transactions will be processed automatically.',
        })

        if (applyRetroactively) {
          apply({
            pattern: pattern.trim(),
            matchType,
            categoryKey: categoryKey || undefined,
            excludeFromBudget: excludeFromBudget || undefined,
            labelIds:
              selectedLabelIds.length > 0 ? selectedLabelIds : undefined,
          })
        }
      }
      onOpenChange(false)
    } catch {
      toast.error(isEdit ? 'Failed to update rule' : 'Failed to create rule')
    } finally {
      setSaving(false)
    }
  }

  const toggleLabel = (labelId: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId],
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Automation Rule' : 'Create Automation Rule'}
          </DialogTitle>
          <DialogDescription>
            Transactions whose description matches this pattern will be
            automatically processed with the selected actions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pattern">Description contains</Label>
            <Input
              id="pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g. CARREFOUR"
              required
            />
            <p className={cn('text-xs text-muted-foreground')}>
              Case-insensitive. Matches any part of the transaction description.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Match type</Label>
            <Select
              value={matchType}
              onValueChange={(v) => setMatchType(v as 'contains' | 'regex')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="regex">Regex</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Assign category</Label>
            <Select value={categoryKey} onValueChange={setCategoryKey}>
              <SelectTrigger>
                <SelectValue placeholder="No category (optional)" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.key} value={cat.key}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block size-2.5 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {labels && labels.length > 0 && (
            <div className="space-y-2">
              <Label>Assign labels</Label>
              <div className="space-y-2 rounded-md border p-3">
                {labels.map((label) => (
                  <div key={label._id} className="flex items-center gap-2">
                    <Checkbox
                      id={`label-${label._id}`}
                      checked={selectedLabelIds.includes(label._id)}
                      onCheckedChange={() => toggleLabel(label._id)}
                    />
                    <label
                      htmlFor={`label-${label._id}`}
                      className="flex items-center gap-2 text-sm font-normal"
                    >
                      <span
                        className="inline-block size-2.5 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      {label.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <Label htmlFor="exclude-budget" className="font-normal">
              Exclude from budget
            </Label>
            <Switch
              id="exclude-budget"
              checked={excludeFromBudget}
              onCheckedChange={setExcludeFromBudget}
            />
          </div>
          {!isEdit && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="apply-retroactively"
                checked={applyRetroactively}
                onCheckedChange={(checked) =>
                  setApplyRetroactively(checked === true)
                }
              />
              <Label htmlFor="apply-retroactively" className="font-normal">
                Apply to existing transactions
              </Label>
            </div>
          )}
        </div>
        <DialogFormFooter
          onCancel={() => onOpenChange(false)}
          onConfirm={handleSave}
          disabled={saving || !pattern.trim() || !hasAction}
          saving={saving}
          confirmLabel={isEdit ? 'Save rule' : 'Create rule'}
        />
      </DialogContent>
    </Dialog>
  )
}
