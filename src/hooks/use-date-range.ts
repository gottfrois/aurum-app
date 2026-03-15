import * as React from 'react'
import { format, startOfDay, subMonths } from 'date-fns'

export interface DateRange {
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD
}

export function useDateRange() {
  const [start, setStart] = React.useState<Date>(() =>
    startOfDay(subMonths(new Date(), 4)),
  )
  const [end, setEnd] = React.useState<Date>(() => startOfDay(new Date()))

  const range = React.useMemo<DateRange>(
    () => ({
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
    }),
    [start, end],
  )

  const setRange = React.useCallback((newStart: Date, newEnd: Date) => {
    setStart(startOfDay(newStart))
    setEnd(startOfDay(newEnd))
  }, [])

  return { start, end, range, setRange }
}
