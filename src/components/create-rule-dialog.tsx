import * as React from 'react'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { useCategories } from '~/lib/categories'
import { cn } from '~/lib/utils'

interface CreateRuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultPattern?: string
  defaultCategoryKey?: string
}

export function CreateRuleDialog({
  open,
  onOpenChange,
  defaultPattern = '',
  defaultCategoryKey = '',
}: CreateRuleDialogProps) {
  const [pattern, setPattern] = React.useState(defaultPattern)
  const [categoryKey, setCategoryKey] = React.useState(defaultCategoryKey)
  const [applyRetroactively, setApplyRetroactively] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const { categories } = useCategories()
  const createRule = useMutation(api.categoryRules.createRule)

  React.useEffect(() => {
    if (open) {
      setPattern(defaultPattern)
      setCategoryKey(defaultCategoryKey)
      setApplyRetroactively(true)
    }
  }, [open, defaultPattern, defaultCategoryKey])

  const handleSave = async () => {
    if (!pattern.trim() || !categoryKey) return
    setSaving(true)
    try {
      await createRule({
        pattern: pattern.trim(),
        matchType: 'contains',
        categoryKey,
        applyRetroactively,
      })
      toast.success('Rule created', {
        description: applyRetroactively
          ? 'Existing transactions are being recategorized.'
          : 'New transactions will be auto-categorized.',
      })
      onOpenChange(false)
    } catch {
      toast.error('Failed to create rule')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Auto-categorize Transactions</DialogTitle>
          <DialogDescription>
            Transactions whose description contains this text will be
            automatically assigned the chosen category.
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
            />
            <p className={cn('text-xs text-muted-foreground')}>
              Case-insensitive. Matches any part of the transaction description.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Assign category</Label>
            <Select value={categoryKey} onValueChange={setCategoryKey}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
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
          <div className="flex items-center gap-2">
            <Checkbox
              id="apply-retroactively"
              checked={applyRetroactively}
              onCheckedChange={(checked) =>
                setApplyRetroactively(checked === true)
              }
            />
            <Label htmlFor="apply-retroactively" className="font-normal">
              Apply to existing uncategorized transactions
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !pattern.trim() || !categoryKey}
          >
            {saving ? 'Creating...' : 'Create rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
