import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Button } from '~/components/ui/button'
import type { FilterCondition, FilterConfig } from '~/lib/filters/types'
import { FilterChip } from './filter-chip'
import { FilterDropdown } from './filter-dropdown'
import { SavedViews } from './saved-views'

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
  onAdd,
  onUpdate,
  onRemove,
  onLoadConditions,
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
      <SavedViews />
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
  onSaveView?: () => void
  entityType: string
}

export function ActiveFilters({
  config,
  conditions,
  onAdd,
  onUpdate,
  onRemove,
  onClearAll,
  onSaveView,
}: ActiveFiltersProps) {
  const navigate = useNavigate()

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
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={
            onSaveView ??
            (() =>
              navigate({ to: '/transactions', search: { createView: true } }))
          }
        >
          Save view
        </Button>
      </div>
    </div>
  )
}
