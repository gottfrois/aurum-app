import * as React from 'react'
import { Check } from 'lucide-react'
import {
  endOfMonth,
  endOfYear,
  format,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from 'date-fns'
import type {
  EnumOption,
  FilterFieldDescriptor,
  FilterOperator,
} from '~/lib/filters/types'
import type { DateSelectorValue } from '~/components/reui/date-selector'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { DateSelector } from '~/components/reui/date-selector'
import { cn } from '~/lib/utils'
import { RANGE_OPERATORS } from '~/lib/filters/operators'

interface FilterValueInputProps {
  field: FilterFieldDescriptor
  operator: FilterOperator
  value: unknown
  onChange: (value: unknown) => void
  onApply?: () => void
  /** Called when an enum checkbox is toggled (distinct from label click) */
  onToggle?: (value: unknown) => void
}

export function FilterValueInput({
  field,
  operator,
  value,
  onChange,
  onApply,
  onToggle,
}: FilterValueInputProps) {
  switch (field.valueType) {
    case 'enum':
      return (
        <EnumInput
          options={
            typeof field.enumOptions === 'function'
              ? field.enumOptions()
              : (field.enumOptions ?? [])
          }
          value={(value as Array<string> | undefined) ?? []}
          onChange={onChange}
          onApply={onApply}
          onToggle={onToggle}
        />
      )
    case 'string':
      return (
        <StringInput
          value={(value as string | undefined) ?? ''}
          onChange={onChange}
          onApply={onApply}
        />
      )
    case 'number':
      return RANGE_OPERATORS.has(operator) ? (
        <NumberRangeInput
          value={
            (value as { from: number; to: number } | undefined) ?? {
              from: 0,
              to: 0,
            }
          }
          onChange={onChange}
          onApply={onApply}
        />
      ) : (
        <NumberInput
          value={value as number | undefined}
          onChange={onChange}
          onApply={onApply}
        />
      )
    case 'date':
      return RANGE_OPERATORS.has(operator) ? (
        <DateRangeWithShortcuts
          value={
            (value as { from: string; to: string } | undefined) ?? {
              from: '',
              to: '',
            }
          }
          onChange={onChange}
          onApply={onApply}
        />
      ) : (
        <DateWithShortcuts
          value={(value as string | undefined) ?? ''}
          onChange={onChange}
          onApply={onApply}
        />
      )
    case 'boolean':
      return (
        <BooleanInput
          value={value as boolean | undefined}
          onChange={onChange}
        />
      )
    default:
      return null
  }
}

function EnumInput({
  options,
  value,
  onChange,
  onApply,
  onToggle,
}: {
  options: Array<EnumOption>
  value: Array<string>
  onChange: (value: unknown) => void
  onApply?: () => void
  onToggle?: (value: unknown) => void
}) {
  const toggle = (optionValue: string) => {
    const next = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue]
    const callback = onToggle ?? onChange
    callback(next)
  }

  const selectOnly = (optionValue: string) => {
    onChange([optionValue])
    onApply?.()
  }

  return (
    <Command>
      <CommandInput placeholder="Search..." />
      <CommandList className="max-h-[200px]">
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup>
          {options.map((opt) => {
            const selected = value.includes(opt.value)
            return (
              <CommandItem
                key={opt.value}
                value={`${opt.label} ${opt.value}`}
                keywords={[opt.label]}
                onSelect={() => selectOnly(opt.value)}
              >
                <div
                  role="checkbox"
                  aria-checked={selected}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggle(opt.value)
                  }}
                  className={cn(
                    'flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm border',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/30',
                  )}
                >
                  {selected && <Check className="size-3" />}
                </div>
                {opt.color && (
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: opt.color }}
                  />
                )}
                <span className="truncate">{opt.label}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

function StringInput({
  value,
  onChange,
  onApply,
}: {
  value: string
  onChange: (value: unknown) => void
  onApply?: () => void
}) {
  return (
    <div className="flex gap-2 p-2">
      <Input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onApply?.()
        }}
        placeholder="Enter value..."
        className="h-8"
      />
      <Button size="sm" className="h-8" onClick={onApply}>
        Apply
      </Button>
    </div>
  )
}

function NumberInput({
  value,
  onChange,
  onApply,
}: {
  value: number | undefined
  onChange: (value: unknown) => void
  onApply?: () => void
}) {
  return (
    <div className="flex gap-2 p-2">
      <Input
        autoFocus
        type="number"
        value={value ?? ''}
        onChange={(e) =>
          onChange(e.target.value === '' ? undefined : Number(e.target.value))
        }
        onKeyDown={(e) => {
          if (e.key === 'Enter') onApply?.()
        }}
        placeholder="Enter number..."
        className="h-8"
      />
      <Button size="sm" className="h-8" onClick={onApply}>
        Apply
      </Button>
    </div>
  )
}

function NumberRangeInput({
  value,
  onChange,
  onApply,
}: {
  value: { from: number; to: number }
  onChange: (value: unknown) => void
  onApply?: () => void
}) {
  return (
    <div className="flex items-center gap-2 p-2">
      <Input
        autoFocus
        type="number"
        value={value.from || ''}
        onChange={(e) =>
          onChange({
            ...value,
            from: e.target.value === '' ? 0 : Number(e.target.value),
          })
        }
        placeholder="From"
        className="h-8"
      />
      <span className="text-sm text-muted-foreground">to</span>
      <Input
        type="number"
        value={value.to || ''}
        onChange={(e) =>
          onChange({
            ...value,
            to: e.target.value === '' ? 0 : Number(e.target.value),
          })
        }
        onKeyDown={(e) => {
          if (e.key === 'Enter') onApply?.()
        }}
        placeholder="To"
        className="h-8"
      />
      <Button size="sm" className="h-8 shrink-0" onClick={onApply}>
        Apply
      </Button>
    </div>
  )
}

const DATE_SHORTCUTS = [
  { label: '1 day ago', offset: () => subDays(new Date(), 1) },
  { label: '3 days ago', offset: () => subDays(new Date(), 3) },
  { label: '1 week ago', offset: () => subDays(new Date(), 7) },
  { label: '1 month ago', offset: () => subMonths(new Date(), 1) },
  { label: '3 months ago', offset: () => subMonths(new Date(), 3) },
  { label: '6 months ago', offset: () => subMonths(new Date(), 6) },
  { label: '1 year ago', offset: () => subYears(new Date(), 1) },
] as const

function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function resolveDateSelectorValue(
  value: DateSelectorValue,
): { single?: string; range?: { from: string; to: string } } | null {
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

  if (value.period === 'day') {
    if (value.operator === 'between' && value.startDate && value.endDate) {
      return { range: { from: fmt(value.startDate), to: fmt(value.endDate) } }
    }
    if (value.operator === 'is' && value.startDate) {
      return { single: fmt(value.startDate) }
    }
    if (value.operator === 'before' && value.startDate) {
      return { single: fmt(value.startDate) }
    }
    if (value.operator === 'after' && value.startDate) {
      return { single: fmt(value.startDate) }
    }
    return null
  }

  if (value.period === 'month') {
    if (value.operator === 'between' && value.rangeStart && value.rangeEnd) {
      const start = startOfMonth(
        new Date(value.rangeStart.year, value.rangeStart.value),
      )
      const end = endOfMonth(
        new Date(value.rangeEnd.year, value.rangeEnd.value),
      )
      return { range: { from: fmt(start), to: fmt(end) } }
    }
    if (value.operator === 'is' && value.year != null && value.month != null) {
      const start = startOfMonth(new Date(value.year, value.month))
      const end = endOfMonth(new Date(value.year, value.month))
      return { range: { from: fmt(start), to: fmt(end) } }
    }
    return null
  }

  if (value.period === 'quarter') {
    if (value.operator === 'between' && value.rangeStart && value.rangeEnd) {
      const start = startOfMonth(
        new Date(value.rangeStart.year, (value.rangeStart.value - 1) * 3),
      )
      const end = endOfMonth(
        new Date(value.rangeEnd.year, value.rangeEnd.value * 3 - 1),
      )
      return { range: { from: fmt(start), to: fmt(end) } }
    }
    if (
      value.operator === 'is' &&
      value.year != null &&
      value.quarter != null
    ) {
      const start = startOfMonth(new Date(value.year, (value.quarter - 1) * 3))
      const end = endOfMonth(new Date(value.year, value.quarter * 3 - 1))
      return { range: { from: fmt(start), to: fmt(end) } }
    }
    return null
  }

  if (value.period === 'half-year') {
    if (value.operator === 'between' && value.rangeStart && value.rangeEnd) {
      const start = startOfMonth(
        new Date(value.rangeStart.year, (value.rangeStart.value - 1) * 6),
      )
      const end = endOfMonth(
        new Date(value.rangeEnd.year, value.rangeEnd.value * 6 - 1),
      )
      return { range: { from: fmt(start), to: fmt(end) } }
    }
    if (
      value.operator === 'is' &&
      value.year != null &&
      value.halfYear != null
    ) {
      const start = startOfMonth(new Date(value.year, (value.halfYear - 1) * 6))
      const end = endOfMonth(new Date(value.year, value.halfYear * 6 - 1))
      return { range: { from: fmt(start), to: fmt(end) } }
    }
    return null
  }

  // year
  if (value.operator === 'between' && value.rangeStart && value.rangeEnd) {
    const start = startOfYear(new Date(value.rangeStart.year, 0))
    const end = endOfYear(new Date(value.rangeEnd.year, 0))
    return { range: { from: fmt(start), to: fmt(end) } }
  }
  if (value.operator === 'is' && value.year != null) {
    const start = startOfYear(new Date(value.year, 0))
    const end = endOfYear(new Date(value.year, 0))
    return { range: { from: fmt(start), to: fmt(end) } }
  }
  return null
}

function CustomDateDialog({
  open,
  onOpenChange,
  isRange,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  isRange: boolean
  onApply: (result: {
    single?: string
    range?: { from: string; to: string }
  }) => void
}) {
  const [dateValue, setDateValue] = React.useState<DateSelectorValue>({
    period: 'day',
    operator: isRange ? 'between' : 'is',
  })

  const resolved = React.useMemo(
    () => resolveDateSelectorValue(dateValue),
    [dateValue],
  )

  const handleApply = () => {
    if (resolved) {
      onApply(resolved)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-fit">
        <DialogHeader>
          <DialogTitle>
            {isRange ? 'Select date range' : 'Select date'}
          </DialogTitle>
        </DialogHeader>
        <DateSelector
          value={dateValue}
          onChange={setDateValue}
          defaultFilterType={isRange ? 'between' : 'is'}
          periodTypes={['day', 'month', 'quarter', 'half-year', 'year']}
          showInput={false}
          showTwoMonths={isRange}
          maxYear={new Date().getFullYear()}
          minYear={2015}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!resolved}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DateWithShortcuts({
  onChange,
  onApply,
}: {
  value: string
  onChange: (value: unknown) => void
  onApply?: () => void
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false)

  return (
    <>
      <Command>
        <CommandList className="max-h-[300px]">
          <CommandGroup>
            {DATE_SHORTCUTS.map((shortcut) => (
              <CommandItem
                key={shortcut.label}
                onSelect={() => {
                  onChange(formatDate(shortcut.offset()))
                  onApply?.()
                }}
              >
                {shortcut.label}
              </CommandItem>
            ))}
            <CommandItem onSelect={() => setDialogOpen(true)}>
              Custom date or timeframe...
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
      <CustomDateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isRange={false}
        onApply={(result) => {
          if (result.single) {
            onChange(result.single)
          } else if (result.range) {
            onChange(result.range.from)
          }
          onApply?.()
        }}
      />
    </>
  )
}

function DateRangeWithShortcuts({
  onChange,
  onApply,
}: {
  value: { from: string; to: string }
  onChange: (value: unknown) => void
  onApply?: () => void
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const today = formatDate(new Date())

  return (
    <>
      <Command>
        <CommandList className="max-h-[300px]">
          <CommandGroup>
            {DATE_SHORTCUTS.map((shortcut) => (
              <CommandItem
                key={shortcut.label}
                onSelect={() => {
                  onChange({ from: formatDate(shortcut.offset()), to: today })
                  onApply?.()
                }}
              >
                {shortcut.label}
              </CommandItem>
            ))}
            <CommandItem onSelect={() => setDialogOpen(true)}>
              Custom date or timeframe...
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
      <CustomDateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isRange={true}
        onApply={(result) => {
          if (result.range) {
            onChange(result.range)
          } else if (result.single) {
            onChange({ from: result.single, to: result.single })
          }
          onApply?.()
        }}
      />
    </>
  )
}

function BooleanInput({
  value,
  onChange,
}: {
  value: boolean | undefined
  onChange: (value: unknown) => void
}) {
  return (
    <div className="flex gap-2 p-2">
      <Button
        size="sm"
        variant={value === true ? 'default' : 'outline'}
        className="h-8 flex-1"
        onClick={() => onChange(true)}
      >
        Yes
      </Button>
      <Button
        size="sm"
        variant={value === false ? 'default' : 'outline'}
        className="h-8 flex-1"
        onClick={() => onChange(false)}
      >
        No
      </Button>
    </div>
  )
}
