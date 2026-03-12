import * as React from 'react'
import { X } from 'lucide-react'
import { FilterValueInput } from './filter-value-input'
import type {
  EnumOption,
  FilterCondition,
  FilterFieldDescriptor,
} from '~/lib/filters/types'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '~/components/ui/command'
import {
  RANGE_OPERATORS,
  VALUELESS_OPERATORS,
  getOperatorLabel,
} from '~/lib/filters/operators'

interface FilterChipProps {
  condition: FilterCondition
  field: FilterFieldDescriptor
  onUpdate: (updates: Partial<Omit<FilterCondition, 'id'>>) => void
  onRemove: () => void
}

const segmentBase =
  'flex h-8 items-center gap-1.5 border-y border-r px-2.5 text-sm first:rounded-l-md first:border-l last:rounded-r-md'
const segmentInteractive = 'cursor-pointer hover:bg-accent transition-colors'

export function FilterChip({
  condition,
  field,
  onUpdate,
  onRemove,
}: FilterChipProps) {
  const [operatorOpen, setOperatorOpen] = React.useState(false)
  const [valueOpen, setValueOpen] = React.useState(false)

  const operatorLabel = getOperatorLabel(condition.operator, field.valueType)
  const valueLabel = formatValueLabel(condition, field)
  const Icon = field.icon

  return (
    <div className="inline-flex items-center">
      {/* Segment 1: Field with icon */}
      <div className={`${segmentBase} font-medium`}>
        {Icon && <Icon className="size-3.5 text-muted-foreground" />}
        <span>{field.label}</span>
      </div>

      {/* Segment 2: Operator */}
      <Popover open={operatorOpen} onOpenChange={setOperatorOpen}>
        <PopoverTrigger asChild>
          <button
            className={`${segmentBase} ${segmentInteractive} text-muted-foreground`}
          >
            {operatorLabel}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto min-w-[140px] p-0" align="start">
          <Command>
            <CommandList>
              <CommandGroup>
                {field.operators.map((op) => (
                  <CommandItem
                    key={op}
                    value={getOperatorLabel(op, field.valueType)}
                    onSelect={() => {
                      if (VALUELESS_OPERATORS.has(op)) {
                        onUpdate({ operator: op, value: null })
                      } else {
                        const currentValue = condition.value
                        const switchingToRange = RANGE_OPERATORS.has(op)
                        const currentIsRange = RANGE_OPERATORS.has(
                          condition.operator,
                        )

                        if (currentIsRange && !switchingToRange) {
                          // Range → scalar: use the "from" value
                          const range = currentValue as {
                            from: unknown
                            to: unknown
                          } | null
                          onUpdate({
                            operator: op,
                            value: range?.from ?? undefined,
                          })
                        } else if (!currentIsRange && switchingToRange) {
                          // Scalar → range: use value as "from", leave "to" empty
                          onUpdate({
                            operator: op,
                            value: { from: currentValue ?? '', to: '' },
                          })
                        } else {
                          onUpdate({ operator: op })
                        }
                      }
                      setOperatorOpen(false)
                    }}
                  >
                    <span
                      className={condition.operator === op ? 'font-medium' : ''}
                    >
                      {getOperatorLabel(op, field.valueType)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Segment 3: Value(s) */}
      {!VALUELESS_OPERATORS.has(condition.operator) && (
        <Popover open={valueOpen} onOpenChange={setValueOpen}>
          <PopoverTrigger asChild>
            <button
              className={`${segmentBase} ${segmentInteractive} max-w-[200px] font-medium`}
            >
              {valueLabel ? (
                <span className="truncate">{valueLabel}</span>
              ) : (
                <span className="text-muted-foreground">...</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto min-w-[220px] p-0" align="start">
            <FilterValueInput
              field={field}
              operator={condition.operator}
              value={condition.value}
              onChange={(value) => onUpdate({ value })}
              onApply={() => setValueOpen(false)}
            />
          </PopoverContent>
        </Popover>
      )}

      {/* Segment 4: Remove */}
      <button
        className={`${segmentBase} ${segmentInteractive} text-muted-foreground`}
        onClick={onRemove}
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

function formatValueLabel(
  condition: FilterCondition,
  field: FilterFieldDescriptor,
): string {
  if (VALUELESS_OPERATORS.has(condition.operator)) return ''

  const { value } = condition

  if (value == null) return ''

  if (RANGE_OPERATORS.has(condition.operator)) {
    const range = value as { from: unknown; to: unknown }
    return `${range.from} – ${range.to}`
  }

  if (Array.isArray(value)) {
    const options = resolveEnumOptions(field)
    const labels = value.map(
      (v) => options.find((o) => o.value === v)?.label ?? String(v),
    )
    if (labels.length === 0) return ''
    if (labels.length === 1) return labels[0]
    return `${labels.length} selected`
  }

  if (field.valueType === 'boolean') {
    return (value as boolean) ? 'Yes' : 'No'
  }

  return String(value)
}

function resolveEnumOptions(field: FilterFieldDescriptor): Array<EnumOption> {
  if (!field.enumOptions) return []
  return typeof field.enumOptions === 'function'
    ? field.enumOptions()
    : field.enumOptions
}
