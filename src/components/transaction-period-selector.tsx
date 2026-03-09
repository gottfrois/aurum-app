import * as React from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  endOfMonth,
  endOfYear,
  format,
  startOfMonth,
  startOfYear,
} from 'date-fns'
import type { DateSelectorValue } from '~/components/reui/date-selector'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group'
import { DateSelector } from '~/components/reui/date-selector'

export type TransactionPeriodType = '1M' | '3M' | '1Y' | 'custom'

export interface TransactionPeriodRange {
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD
}

interface TransactionPeriodSelectorProps {
  periodType: TransactionPeriodType
  range: TransactionPeriodRange
  onPeriodTypeChange: (type: TransactionPeriodType) => void
  onNavigate: (direction: 'prev' | 'next') => void
  onCustomRangeChange: (range: TransactionPeriodRange) => void
  canGoNext: boolean
}

function formatRangeLabel(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' }
  const startLabel = s.toLocaleDateString('en-US', opts)
  const endLabel = e.toLocaleDateString('en-US', opts)

  if (startLabel === endLabel) return startLabel

  // Same year — abbreviate
  if (s.getFullYear() === e.getFullYear()) {
    return `${s.toLocaleDateString('en-US', { month: 'short' })} – ${endLabel}`
  }
  return `${startLabel} – ${endLabel}`
}

export function TransactionPeriodSelector({
  periodType,
  range,
  onPeriodTypeChange,
  onNavigate,
  onCustomRangeChange,
  canGoNext,
}: TransactionPeriodSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={periodType}
        onValueChange={(val) => {
          if (val) onPeriodTypeChange(val as TransactionPeriodType)
        }}
      >
        <ToggleGroupItem value="1M">1M</ToggleGroupItem>
        <ToggleGroupItem value="3M">3M</ToggleGroupItem>
        <ToggleGroupItem value="1Y">1Y</ToggleGroupItem>
        <ToggleGroupItem value="custom">Custom</ToggleGroupItem>
      </ToggleGroup>

      {periodType !== 'custom' && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            onClick={() => onNavigate('prev')}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[140px] px-2 text-center text-sm font-medium">
            {formatRangeLabel(range.start, range.end)}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            onClick={() => onNavigate('next')}
            disabled={!canGoNext}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {periodType === 'custom' && (
        <CustomDateRangeDialog range={range} onChange={onCustomRangeChange} />
      )}
    </div>
  )
}

function resolveeDateSelectorRange(
  value: DateSelectorValue,
): TransactionPeriodRange | null {
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

  if (value.period === 'day') {
    if (value.operator === 'between' && value.startDate && value.endDate) {
      return { start: fmt(value.startDate), end: fmt(value.endDate) }
    }
    if (value.operator === 'is' && value.startDate) {
      return { start: fmt(value.startDate), end: fmt(value.startDate) }
    }
    if (value.operator === 'before' && value.startDate) {
      return { start: '2015-01-01', end: fmt(value.startDate) }
    }
    if (value.operator === 'after' && value.startDate) {
      return { start: fmt(value.startDate), end: fmt(new Date()) }
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
      return { start: fmt(start), end: fmt(end) }
    }
    if (value.operator === 'is' && value.year != null && value.month != null) {
      const start = startOfMonth(new Date(value.year, value.month))
      const end = endOfMonth(new Date(value.year, value.month))
      return { start: fmt(start), end: fmt(end) }
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
      return { start: fmt(start), end: fmt(end) }
    }
    if (
      value.operator === 'is' &&
      value.year != null &&
      value.quarter != null
    ) {
      const start = startOfMonth(new Date(value.year, (value.quarter - 1) * 3))
      const end = endOfMonth(new Date(value.year, value.quarter * 3 - 1))
      return { start: fmt(start), end: fmt(end) }
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
      return { start: fmt(start), end: fmt(end) }
    }
    if (
      value.operator === 'is' &&
      value.year != null &&
      value.halfYear != null
    ) {
      const start = startOfMonth(new Date(value.year, (value.halfYear - 1) * 6))
      const end = endOfMonth(new Date(value.year, value.halfYear * 6 - 1))
      return { start: fmt(start), end: fmt(end) }
    }
    return null
  }

  // value.period === 'year' (only remaining case)
  if (value.operator === 'between' && value.rangeStart && value.rangeEnd) {
    const start = startOfYear(new Date(value.rangeStart.year, 0))
    const end = endOfYear(new Date(value.rangeEnd.year, 0))
    return { start: fmt(start), end: fmt(end) }
  }
  if (value.operator === 'is' && value.year != null) {
    const start = startOfYear(new Date(value.year, 0))
    const end = endOfYear(new Date(value.year, 0))
    return { start: fmt(start), end: fmt(end) }
  }
  return null
}

function CustomDateRangeDialog({
  range,
  onChange,
}: {
  range: TransactionPeriodRange
  onChange: (range: TransactionPeriodRange) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [dateValue, setDateValue] = React.useState<DateSelectorValue>({
    period: 'day',
    operator: 'between',
    startDate: new Date(range.start),
    endDate: new Date(range.end),
  })

  // Sync dateValue when range changes externally
  React.useEffect(() => {
    setDateValue({
      period: 'day',
      operator: 'between',
      startDate: new Date(range.start),
      endDate: new Date(range.end),
    })
  }, [range.start, range.end])

  const resolvedRange = React.useMemo(() => {
    return resolveeDateSelectorRange(dateValue)
  }, [dateValue])

  const handleApply = () => {
    if (resolvedRange) {
      onChange(resolvedRange)
    }
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarDays className="size-4" />
          {formatRangeLabel(range.start, range.end)}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-fit">
        <DialogHeader>
          <DialogTitle>Select date range</DialogTitle>
        </DialogHeader>
        <DateSelector
          value={dateValue}
          onChange={setDateValue}
          defaultFilterType="between"
          periodTypes={['day', 'month', 'quarter', 'half-year', 'year']}
          showInput={false}
          showTwoMonths
          maxYear={new Date().getFullYear()}
          minYear={2015}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!resolvedRange}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

function monthsForType(type: Exclude<TransactionPeriodType, 'custom'>): number {
  switch (type) {
    case '1M':
      return 1
    case '3M':
      return 3
    case '1Y':
      return 12
  }
}

function computeRange(
  type: Exclude<TransactionPeriodType, 'custom'>,
  offset: number,
): TransactionPeriodRange {
  const months = monthsForType(type)
  const today = todayStr()
  const end = addMonths(today, offset * months)
  const start = addMonths(end, -months)
  // start is exclusive (day after), but we want inclusive start
  const startDate = new Date(start)
  startDate.setDate(startDate.getDate() + 1)
  return {
    start: startDate.toISOString().slice(0, 10),
    end: end > today ? today : end,
  }
}

export function useTransactionPeriod() {
  const [periodType, setPeriodType] =
    React.useState<TransactionPeriodType>('1M')
  const [offset, setOffset] = React.useState(0) // 0 = current, -1 = previous, etc.
  const [customRange, setCustomRange] = React.useState<TransactionPeriodRange>(
    () => ({
      start: addMonths(todayStr(), -1),
      end: todayStr(),
    }),
  )

  const range = React.useMemo<TransactionPeriodRange>(() => {
    if (periodType === 'custom') return customRange
    return computeRange(periodType, offset)
  }, [periodType, offset, customRange])

  const handlePeriodTypeChange = React.useCallback(
    (type: TransactionPeriodType) => {
      setPeriodType(type)
      setOffset(0)
      if (type === 'custom') {
        // Initialize custom range from current computed range
        if (periodType !== 'custom') {
          const current = computeRange(periodType, offset)
          setCustomRange(current)
        }
      }
    },
    [periodType, offset],
  )

  const handleNavigate = React.useCallback((direction: 'prev' | 'next') => {
    setOffset((prev) => prev + (direction === 'prev' ? -1 : 1))
  }, [])

  const canGoNext = offset < 0

  return {
    periodType,
    range,
    canGoNext,
    onPeriodTypeChange: handlePeriodTypeChange,
    onNavigate: handleNavigate,
    onCustomRangeChange: setCustomRange,
  }
}
