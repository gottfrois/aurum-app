import { useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { Globe, Lock } from 'lucide-react'
import * as React from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'
import { PortfolioAvatar } from '~/components/portfolio-avatar'
import type { Filter } from '~/components/reui/filters'
import { Button } from '~/components/ui/button'
import { ColorDot } from '~/components/ui/color-picker'
import { HotkeyDisplay, Kbd } from '~/components/ui/kbd'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { usePortfolio } from '~/contexts/portfolio-context'
import { serializeFilters } from '~/lib/filters/serialize'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

interface CreateViewFormProps {
  getFilters: () => Array<Filter>
  entityType: string
  defaultScope?: string
  onCancel: () => void
}

export function CreateViewForm({
  getFilters,
  entityType,
  defaultScope,
  onCancel,
}: CreateViewFormProps) {
  const navigate = useNavigate()
  const createView = useMutation(api.filterViews.create)
  const { portfolios } = usePortfolio()

  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [color, setColor] = React.useState('#3B82F6')
  const [visibility, setVisibility] = React.useState<
    'workspace' | 'personal' | string
  >(defaultScope ?? 'personal')
  const [saving, setSaving] = React.useState(false)

  const isDisabled = !name.trim() || saving

  const handleSave = React.useCallback(async () => {
    if (isDisabled) return
    setSaving(true)
    try {
      const isPortfolio =
        visibility !== 'workspace' && visibility !== 'personal'
      const viewId = await createView({
        entityType,
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        filters: serializeFilters(getFilters()),
        visibility: isPortfolio ? 'portfolio' : visibility,
        portfolioId: isPortfolio ? (visibility as Id<'portfolios'>) : undefined,
      })
      toast.success('View created')
      navigate({ to: '/views/$viewId', params: { viewId } })
    } catch {
      toast.error('Failed to create view')
      setSaving(false)
    }
  }, [
    isDisabled,
    createView,
    entityType,
    name,
    description,
    color,
    getFilters,
    visibility,
    navigate,
  ])

  useHotkeys('escape', onCancel, {
    enableOnFormTags: true,
    preventDefault: true,
  })

  useHotkeys('mod+enter', handleSave, {
    enabled: !isDisabled,
    enableOnFormTags: true,
    preventDefault: true,
  })

  return (
    <div className="border-b bg-accent/30 px-4 py-3 lg:px-6">
      <div className="flex items-start gap-3">
        <div className="shrink-0 pt-1">
          <ColorDot color={color} onChange={setColor} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="All transactions"
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-base font-medium placeholder:text-muted-foreground focus:outline-none"
            />

            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm text-muted-foreground">Save to</span>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger size="sm" className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="personal">
                      <Lock className="size-4" />
                      Personal
                    </SelectItem>
                    <SelectItem value="workspace">
                      <Globe className="size-4" />
                      Everyone
                    </SelectItem>
                  </SelectGroup>
                  {portfolios && portfolios.length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Portfolios</SelectLabel>
                        {portfolios.map((p) => (
                          <SelectItem key={p._id} value={p._id}>
                            <PortfolioAvatar
                              name={p.name}
                              className="size-4 rounded text-[8px]"
                            />
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={onCancel}>
                Cancel <Kbd>Esc</Kbd>
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isDisabled}
                loading={saving}
              >
                Save <HotkeyDisplay hotkey={{ keys: 'mod+enter' }} />
              </Button>
            </div>
          </div>

          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="mt-1 min-w-0 bg-transparent text-sm text-muted-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}
