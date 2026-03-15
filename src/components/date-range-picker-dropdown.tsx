import * as React from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import {
  endOfMonth,
  endOfYear,
  format,
  isToday,
  startOfMonth,
  startOfYear,
} from 'date-fns'
import type { DateSelectorValue } from '~/components/reui/date-selector'
import { DateSelector } from '~/components/reui/date-selector'

import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'

interface DateRangePickerDropdownProps {
  start: Date
  end: Date
  onRangeChange: (start: Date, end: Date) => void
}

function formatLabel(start: Date, end: Date): string {
  const startStr = format(start, 'MMM d, yyyy')
  const endStr = isToday(end) ? 'Today' : format(end, 'MMM d, yyyy')
  return `${startStr} – ${endStr}`
}

function resolveDateSelectorRange(
  value: DateSelectorValue,
): { start: Date; end: Date } | null {
  const today = new Date()

  if (value.period === 'day') {
    if (value.operator === 'between' && value.startDate && value.endDate) {
      return { start: value.startDate, end: value.endDate }
    }
    if (value.operator === 'is' && value.startDate) {
      return { start: value.startDate, end: value.startDate }
    }
    if (value.operator === 'before' && value.startDate) {
      return { start: new Date(2015, 0, 1), end: value.startDate }
    }
    if (value.operator === 'after' && value.startDate) {
      return { start: value.startDate, end: today }
    }
    return null
  }

  if (value.period === 'month') {
    if (value.operator === 'between' && value.rangeStart && value.rangeEnd) {
      return {
        start: startOfMonth(
          new Date(value.rangeStart.year, value.rangeStart.value),
        ),
        end: endOfMonth(new Date(value.rangeEnd.year, value.rangeEnd.value)),
      }
    }
    if (value.operator === 'is' && value.year != null && value.month != null) {
      return {
        start: startOfMonth(new Date(value.year, value.month)),
        end: endOfMonth(new Date(value.year, value.month)),
      }
    }
    return null
  }

  if (value.period === 'quarter') {
    if (value.operator === 'between' && value.rangeStart && value.rangeEnd) {
      return {
        start: startOfMonth(
          new Date(value.rangeStart.year, (value.rangeStart.value - 1) * 3),
        ),
        end: endOfMonth(
          new Date(value.rangeEnd.year, value.rangeEnd.value * 3 - 1),
        ),
      }
    }
    if (
      value.operator === 'is' &&
      value.year != null &&
      value.quarter != null
    ) {
      return {
        start: startOfMonth(new Date(value.year, (value.quarter - 1) * 3)),
        end: endOfMonth(new Date(value.year, value.quarter * 3 - 1)),
      }
    }
    return null
  }

  if (value.period === 'half-year') {
    if (value.operator === 'between' && value.rangeStart && value.rangeEnd) {
      return {
        start: startOfMonth(
          new Date(value.rangeStart.year, (value.rangeStart.value - 1) * 6),
        ),
        end: endOfMonth(
          new Date(value.rangeEnd.year, value.rangeEnd.value * 6 - 1),
        ),
      }
    }
    if (
      value.operator === 'is' &&
      value.year != null &&
      value.halfYear != null
    ) {
      return {
        start: startOfMonth(new Date(value.year, (value.halfYear - 1) * 6)),
        end: endOfMonth(new Date(value.year, value.halfYear * 6 - 1)),
      }
    }
    return null
  }

  // year
  if (value.operator === 'between' && value.rangeStart && value.rangeEnd) {
    return {
      start: startOfYear(new Date(value.rangeStart.year, 0)),
      end: endOfYear(new Date(value.rangeEnd.year, 0)),
    }
  }
  if (value.operator === 'is' && value.year != null) {
    return {
      start: startOfYear(new Date(value.year, 0)),
      end: endOfYear(new Date(value.year, 0)),
    }
  }
  return null
}

export function DateRangePickerDropdown({
  start,
  end,
  onRangeChange,
}: DateRangePickerDropdownProps) {
  const [open, setOpen] = React.useState(false)
  const [dateValue, setDateValue] = React.useState<DateSelectorValue>({
    period: 'day',
    operator: 'between',
    startDate: start,
    endDate: end,
  })

  // Sync dateValue when range changes externally
  React.useEffect(() => {
    setDateValue({
      period: 'day',
      operator: 'between',
      startDate: start,
      endDate: end,
    })
  }, [start, end])

  const resolvedRange = React.useMemo(
    () => resolveDateSelectorRange(dateValue),
    [dateValue],
  )

  const handleApply = () => {
    if (resolvedRange) {
      onRangeChange(resolvedRange.start, resolvedRange.end)
    }
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarDays className="size-4" />
          <span>{formatLabel(start, end)}</span>
          <ChevronDown className="size-3.5 opacity-50" />
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
