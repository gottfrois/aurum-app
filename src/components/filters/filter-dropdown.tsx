import * as React from 'react'
import { ChevronLeft, ListFilter } from 'lucide-react'
import { FilterValueInput } from './filter-value-input'
import type {
  FilterCondition,
  FilterConfig,
  FilterFieldDescriptor,
} from '~/lib/filters/types'
import { Button } from '~/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command'
import { VALUELESS_OPERATORS } from '~/lib/filters/operators'

type Stage = 'field' | 'value'

interface FilterDropdownProps {
  config: FilterConfig
  onAdd: (condition: FilterCondition) => void
  onUpdate: (id: string, updates: Partial<Omit<FilterCondition, 'id'>>) => void
  onRemove: (id: string) => void
  trigger?: React.ReactNode
}

export function FilterDropdown({
  config,
  onAdd,
  onUpdate,
  onRemove,
  trigger,
}: FilterDropdownProps) {
  const [open, setOpen] = React.useState(false)
  const [stage, setStage] = React.useState<Stage>('field')
  const [selectedField, setSelectedField] =
    React.useState<FilterFieldDescriptor | null>(null)
  const [pendingId, setPendingId] = React.useState<string | null>(null)
  const [value, setValue] = React.useState<unknown>(undefined)

  const reset = () => {
    setStage('field')
    setSelectedField(null)
    setPendingId(null)
    setValue(undefined)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && pendingId) {
      // Remove the condition if user closes without selecting a meaningful value
      const isEmpty =
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0)
      if (isEmpty) {
        onRemove(pendingId)
      }
    }
    setOpen(nextOpen)
    if (!nextOpen) reset()
  }

  const handleFieldSelect = (field: FilterFieldDescriptor) => {
    setSelectedField(field)
    const op = field.defaultOperator
    if (VALUELESS_OPERATORS.has(op)) {
      onAdd({
        id: crypto.randomUUID(),
        field: field.name,
        operator: op,
        value: null,
      })
      reset()
      setOpen(false)
      return
    }
    // Create the condition immediately so filtering is live
    const id = crypto.randomUUID()
    const initialValue = field.valueType === 'enum' ? [] : undefined
    onAdd({
      id,
      field: field.name,
      operator: op,
      value: initialValue,
    })
    setPendingId(id)
    setStage('value')
    setValue(initialValue)
  }

  const handleValueChange = (newValue: unknown) => {
    setValue(newValue)
    if (pendingId) {
      onUpdate(pendingId, { value: newValue })
    }
  }

  const handleApply = () => {
    // Close — the condition is already live
    reset()
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ListFilter className="size-3.5" />
            Filter
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        {stage === 'field' && (
          <Command>
            <CommandInput placeholder="Filter by..." />
            <CommandList>
              <CommandEmpty>No fields found.</CommandEmpty>
              <CommandGroup>
                {config.fields.map((field) => (
                  <CommandItem
                    key={field.name}
                    value={field.label}
                    onSelect={() => handleFieldSelect(field)}
                  >
                    {field.icon && (
                      <field.icon className="size-4 text-muted-foreground" />
                    )}
                    {field.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}

        {stage === 'value' && selectedField && (
          <div>
            <div className="border-b px-1 py-1.5">
              <button
                className="flex items-center gap-1 rounded-sm px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => {
                  // Going back — remove the pending condition
                  if (pendingId) {
                    onRemove(pendingId)
                  }
                  setStage('field')
                  setSelectedField(null)
                  setPendingId(null)
                  setValue(undefined)
                }}
              >
                <ChevronLeft className="size-3.5" />
                {selectedField.label}
              </button>
            </div>
            <FilterValueInput
              field={selectedField}
              operator={selectedField.defaultOperator}
              value={value}
              onChange={handleValueChange}
              onApply={handleApply}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
