import * as React from 'react'
import { useMutation } from 'convex/react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import { FilterChip } from './filter-chip'
import { FilterDropdown } from './filter-dropdown'
import { SavedViews } from './saved-views'
import type { FilterCondition, FilterConfig } from '~/lib/filters/types'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { serializeFilters } from '~/lib/filters/serialize'

interface FilterActionsProps {
  config: FilterConfig
  conditions: Array<FilterCondition>
  onAdd: (condition: FilterCondition) => void
  onUpdate: (id: string, updates: Partial<Omit<FilterCondition, 'id'>>) => void
  onRemove: (id: string) => void
  onLoadConditions: (conditions: Array<FilterCondition>) => void
  entityType: string
}

export function FilterActions({
  config,
  conditions,
  onAdd,
  onUpdate,
  onRemove,
  onLoadConditions,
  entityType,
}: FilterActionsProps) {
  return (
    <div className="ml-auto flex items-center gap-2">
      <FilterDropdown
        config={config}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onLoadConditions={onLoadConditions}
      />
      <SavedViews
        entityType={entityType}
        currentConditions={conditions}
        onLoadConditions={onLoadConditions}
      />
    </div>
  )
}

interface ActiveFiltersProps {
  config: FilterConfig
  conditions: Array<FilterCondition>
  onAdd: (condition: FilterCondition) => void
  onUpdate: (id: string, updates: Partial<Omit<FilterCondition, 'id'>>) => void
  onRemove: (id: string) => void
  onClearAll: () => void
  entityType: string
}

export function ActiveFilters({
  config,
  conditions,
  onAdd,
  onUpdate,
  onRemove,
  onClearAll,
  entityType,
}: ActiveFiltersProps) {
  if (conditions.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {conditions.map((condition) => {
        const field = config.fieldMap.get(condition.field)
        if (!field) return null
        return (
          <FilterChip
            key={condition.id}
            condition={condition}
            field={field}
            onUpdate={(updates) => onUpdate(condition.id, updates)}
            onRemove={() => onRemove(condition.id)}
          />
        )
      })}
      <FilterDropdown
        config={config}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onRemove={onRemove}
        trigger={
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md">
            <Plus className="size-4" />
          </Button>
        }
      />
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={onClearAll}
        >
          Clear
        </Button>
        <SaveFilterButton entityType={entityType} conditions={conditions} />
      </div>
    </div>
  )
}

function SaveFilterButton({
  entityType,
  conditions,
}: {
  entityType: string
  conditions: Array<FilterCondition>
}) {
  const createView = useMutation(api.filterViews.create)
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')

  const handleSave = async () => {
    if (!name.trim()) return
    try {
      await createView({
        entityType,
        name: name.trim(),
        filters: serializeFilters(conditions),
      })
      setName('')
      setOpen(false)
      toast.success('View saved')
    } catch {
      toast.error('Failed to save view')
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          Save
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-2" align="end">
        <div className="flex gap-2">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') setOpen(false)
            }}
            placeholder="View name..."
            className="h-8"
          />
          <Button size="sm" className="h-8" onClick={handleSave}>
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
