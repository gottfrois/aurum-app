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
import { useEffect, useMemo, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import type { DateSelectorValue } from '~/components/reui/date-selector'
import { DateSelector } from '~/components/reui/date-selector'
import type { CustomRendererProps } from '~/components/reui/filters'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { HotkeyDisplay, Kbd } from '~/components/ui/kbd'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'

// ---------------------------------------------------------------------------
// Number renderer
// ---------------------------------------------------------------------------

export function NumberRenderer({
  values,
  onChange,
  operator,
}: CustomRendererProps) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsOpen(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const isBetween = operator === 'between'

  if (isBetween) {
    const from = values[0] != null ? String(values[0]) : ''
    const to = values[1] != null ? String(values[1]) : ''

    const handleApply = () => {
      setIsOpen(false)
    }

    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger>
          {from && to ? `${from} – ${to}` : 'Set range'}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start" sideOffset={8}>
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              type="number"
              value={from}
              onChange={(e) =>
                onChange([
                  e.target.value === '' ? '' : Number(e.target.value),
                  values[1] ?? '',
                ])
              }
              placeholder="From"
              className="h-8 w-24"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="number"
              value={to}
              onChange={(e) =>
                onChange([
                  values[0] ?? '',
                  e.target.value === '' ? '' : Number(e.target.value),
                ])
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApply()
              }}
              placeholder="To"
              className="h-8 w-24"
            />
            <Button size="sm" className="h-8 shrink-0" onClick={handleApply}>
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  // Single number input
  const value = values[0] != null ? String(values[0]) : ''

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger>{value || 'Set value'}</PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start" sideOffset={8}>
        <div className="flex gap-2">
          <Input
            autoFocus
            type="number"
            value={value}
            onChange={(e) =>
              onChange([e.target.value === '' ? '' : Number(e.target.value)])
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') setIsOpen(false)
            }}
            placeholder="Enter number..."
            className="h-8 w-32"
          />
          <Button size="sm" className="h-8" onClick={() => setIsOpen(false)}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// Date renderer
// ---------------------------------------------------------------------------

const DATE_PRESETS = [
  { label: '1 day ago', offset: () => subDays(new Date(), 1) },
  { label: '3 days ago', offset: () => subDays(new Date(), 3) },
  { label: '1 week ago', offset: () => subDays(new Date(), 7) },
  { label: '1 month ago', offset: () => subMonths(new Date(), 1) },
  { label: '3 months ago', offset: () => subMonths(new Date(), 3) },
  { label: '6 months ago', offset: () => subMonths(new Date(), 6) },
  { label: '1 year ago', offset: () => subYears(new Date(), 1) },
] as const

function formatDateStr(date: Date): string {
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
    if (
      (value.operator === 'is' ||
        value.operator === 'before' ||
        value.operator === 'after') &&
      value.startDate
    ) {
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

export function DateRangeRenderer({ values, onChange }: CustomRendererProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const today = formatDateStr(new Date())

  useEffect(() => {
    const timer = setTimeout(() => setIsOpen(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const from = values[0] != null ? String(values[0]) : ''
  const to = values[1] != null ? String(values[1]) : ''
  const displayText =
    from && to ? `${from} – ${to}` : from ? `from ${from}` : 'Set range'

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger>{displayText}</PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
          <div className="flex flex-col">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors"
                onClick={() => {
                  onChange([formatDateStr(preset.offset()), today])
                  setIsOpen(false)
                }}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              className="border-t px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors"
              onClick={() => {
                setIsOpen(false)
                setDialogOpen(true)
              }}
            >
              Custom date or timeframe...
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <CustomDateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isRange={true}
        onApply={(result) => {
          if (result.range) {
            onChange([result.range.from, result.range.to])
          } else if (result.single) {
            onChange([result.single, result.single])
          }
        }}
      />
    </>
  )
}

export function SingleDateRenderer({ values, onChange }: CustomRendererProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsOpen(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const value = values[0] != null ? String(values[0]) : ''
  const displayText = value || 'Select date'

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger>{displayText}</PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
          <div className="flex flex-col">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors"
                onClick={() => {
                  onChange([formatDateStr(preset.offset())])
                  setIsOpen(false)
                }}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              className="border-t px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors"
              onClick={() => {
                setIsOpen(false)
                setDialogOpen(true)
              }}
            >
              Custom date or timeframe...
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <CustomDateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isRange={false}
        onApply={(result) => {
          if (result.single) {
            onChange([result.single])
          } else if (result.range) {
            onChange([result.range.from])
          }
        }}
      />
    </>
  )
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
  const [dateValue, setDateValue] = useState<DateSelectorValue>({
    period: 'day',
    operator: isRange ? 'between' : 'is',
  })

  const resolved = useMemo(
    () => resolveDateSelectorValue(dateValue),
    [dateValue],
  )

  const handleApply = () => {
    if (resolved) {
      onApply(resolved)
    }
    onOpenChange(false)
  }

  const handleCancel = () => onOpenChange(false)

  useHotkeys('escape', handleCancel, { preventDefault: true })
  useHotkeys('mod+enter', handleApply, {
    enabled: !!resolved,
    preventDefault: true,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-fit" showCloseButton={false}>
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
          <Button variant="outline" onClick={handleCancel}>
            Cancel <Kbd>Esc</Kbd>
          </Button>
          <Button onClick={handleApply} disabled={!resolved}>
            Apply <HotkeyDisplay hotkey={{ keys: 'mod+enter' }} />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
