import { useMutation, useQuery } from 'convex/react'
import { ChevronsUpDown } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { CategoryCombobox } from '~/components/category-combobox'
import { DialogFormFooter } from '~/components/dialog-form-footer'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { Switch } from '~/components/ui/switch'
import { useRetroactiveRuleApplication } from '~/hooks/use-retroactive-rule-application'
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
  defaultCustomDescription?: string
  onCreated?: (ruleId: Id<'transactionRules'>) => void
}

export function RuleDialog({
  open,
  onOpenChange,
  rule,
  defaultPattern = '',
  defaultCategoryKey = '',
  defaultExcludeFromBudget = false,
  defaultCustomDescription = '',
  onCreated,
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
  const [customDescription, setCustomDescription] = React.useState('')
  const [applyRetroactively, setApplyRetroactively] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

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
        setCustomDescription(rule.customDescription ?? '')
        setApplyRetroactively(true)
      } else {
        setPattern(defaultPattern)
        setMatchType('contains')
        setCategoryKey(defaultCategoryKey)
        setExcludeFromBudget(defaultExcludeFromBudget)
        setSelectedLabelIds([])
        setCustomDescription(defaultCustomDescription)
        setApplyRetroactively(true)
      }
    }
  }, [
    open,
    rule,
    defaultPattern,
    defaultCategoryKey,
    defaultExcludeFromBudget,
    defaultCustomDescription,
  ])

  const hasAction =
    !!categoryKey ||
    excludeFromBudget ||
    selectedLabelIds.length > 0 ||
    !!customDescription.trim()

  const handleSave = async () => {
    if (!pattern.trim() || !hasAction) return
    setSaving(true)
    try {
      if (isEdit) {
        await updateRule({
          ruleId: rule._id,
          pattern: pattern.trim(),
          matchType,
          categoryKey: categoryKey || '',
          excludeFromBudget,
          labelIds: selectedLabelIds as Array<Id<'transactionLabels'>>,
          customDescription: customDescription.trim() || '',
        })
        toast.success('Rule updated')
      } else {
        const ruleId = await createRule({
          pattern: pattern.trim(),
          matchType,
          categoryKey: categoryKey || undefined,
          excludeFromBudget: excludeFromBudget || undefined,
          labelIds:
            selectedLabelIds.length > 0
              ? (selectedLabelIds as Array<Id<'transactionLabels'>>)
              : undefined,
          customDescription: customDescription.trim() || undefined,
        })
        toast.success('Rule created', {
          description: applyRetroactively
            ? 'Existing transactions are being updated.'
            : 'New transactions will be processed automatically.',
          action: onCreated
            ? {
                label: 'Edit',
                onClick: () => onCreated(ruleId),
              }
            : undefined,
        })

        if (applyRetroactively) {
          apply({
            pattern: pattern.trim(),
            matchType,
            categoryKey: categoryKey || undefined,
            excludeFromBudget: excludeFromBudget || undefined,
            labelIds:
              selectedLabelIds.length > 0 ? selectedLabelIds : undefined,
            customDescription: customDescription.trim() || undefined,
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

  const selectedLabels = (labels ?? []).filter((l) =>
    selectedLabelIds.includes(l._id),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Automation Rule' : 'Create Automation Rule'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Condition */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                when transaction
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="flex">
              <MatchTypePicker matchType={matchType} onChange={setMatchType} />
              <Input
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder={
                  matchType === 'regex'
                    ? 'e.g. CARREFOUR|LECLERC or ^CB\\s.*'
                    : 'e.g. CARREFOUR'
                }
                className="rounded-l-none border-l-0 font-mono"
                autoFocus
              />
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                then
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Assign category */}
            <div className="space-y-2">
              <Label>Assign category</Label>
              <CategoryCombobox
                value={categoryKey}
                onChange={(key) => setCategoryKey(key)}
                allowCreate
                trigger={({ category, open }) => (
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                  >
                    {categoryKey ? (
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        {category.label}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        No category (optional)
                      </span>
                    )}
                    <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
                  </Button>
                )}
              />
            </div>

            {/* Add labels */}
            {labels && labels.length > 0 && (
              <div className="space-y-2">
                <Label>Add labels</Label>
                <LabelMultiSelect
                  labels={labels}
                  selectedLabelIds={selectedLabelIds}
                  selectedLabels={selectedLabels}
                  onToggle={toggleLabel}
                />
              </div>
            )}

            {/* Change description */}
            <div className="space-y-2">
              <Label>Change description to</Label>
              <Input
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="Custom description (optional)"
              />
            </div>

            {/* Exclude from budget */}
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
          </div>

          {/* Apply retroactively */}
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

function MatchTypePicker({
  matchType,
  onChange,
}: {
  matchType: 'contains' | 'regex'
  onChange: (v: 'contains' | 'regex') => void
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-l-md border bg-muted/50 px-3 text-sm font-medium transition-colors hover:bg-accent"
        >
          {matchType === 'contains' ? 'contains' : 'matches'}
          <ChevronsUpDown className="size-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[140px] p-1" align="start">
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent',
            matchType === 'contains' && 'font-medium',
          )}
          onClick={() => {
            onChange('contains')
            setOpen(false)
          }}
        >
          contains
        </button>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent',
            matchType === 'regex' && 'font-medium',
          )}
          onClick={() => {
            onChange('regex')
            setOpen(false)
          }}
        >
          matches (regex)
        </button>
      </PopoverContent>
    </Popover>
  )
}

function LabelMultiSelect({
  labels,
  selectedLabelIds,
  selectedLabels,
  onToggle,
}: {
  labels: Array<Doc<'transactionLabels'>>
  selectedLabelIds: string[]
  selectedLabels: Array<Doc<'transactionLabels'>>
  onToggle: (labelId: string) => void
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-9 w-full justify-between font-normal"
        >
          {selectedLabels.length > 0 ? (
            <span className="flex min-w-0 flex-wrap gap-1">
              {selectedLabels.map((label) => (
                <Badge
                  key={label._id}
                  variant="secondary"
                  className="gap-1 px-2 py-0.5 text-xs"
                  style={{
                    backgroundColor: `${label.color}20`,
                    color: label.color,
                    borderColor: `${label.color}40`,
                  }}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  {label.name}
                </Badge>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">No labels (optional)</span>
          )}
          <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search labels..." />
          <CommandList>
            <CommandEmpty>No labels found.</CommandEmpty>
            <CommandGroup>
              {labels.map((label) => (
                <CommandItem
                  key={label._id}
                  value={label.name}
                  onSelect={() => onToggle(label._id)}
                >
                  <Checkbox
                    checked={selectedLabelIds.includes(label._id)}
                    tabIndex={-1}
                    className="pointer-events-none"
                  />
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  <span>{label.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
