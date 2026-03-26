import {
  addDays,
  addMonths,
  addYears,
  differenceInDays,
  endOfYear,
  format,
  isAfter,
  isSameDay,
  parseISO,
  startOfDay,
  startOfYear,
  subMonths,
  subYears,
} from 'date-fns'
import * as React from 'react'

export type TransactionPeriod = '1M' | '3M' | '6M' | '1Y' | 'YTD'
export const TRANSACTION_PERIODS: Array<TransactionPeriod> = [
  '1M',
  '3M',
  '6M',
  '1Y',
  'YTD',
]

export interface DateRange {
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD
}

type DateRangeMode =
  | { mode: 'preset'; period: TransactionPeriod; anchor: string }
  | { mode: 'custom'; start: string; end: string }

const STORAGE_KEY = 'bunkr:period:transactions'

function getToday(): Date {
  return startOfDay(new Date())
}

function computePresetRange(
  period: TransactionPeriod,
  anchor: Date,
): { start: Date; end: Date } {
  switch (period) {
    case '1M':
      return { start: subMonths(anchor, 1), end: anchor }
    case '3M':
      return { start: subMonths(anchor, 3), end: anchor }
    case '6M':
      return { start: subMonths(anchor, 6), end: anchor }
    case '1Y':
      return { start: subYears(anchor, 1), end: anchor }
    case 'YTD': {
      const yearStart = startOfYear(anchor)
      const now = getToday()
      const end =
        anchor.getFullYear() === now.getFullYear()
          ? now
          : startOfDay(endOfYear(anchor))
      return { start: yearStart, end }
    }
  }
}

function stepAnchor(
  period: TransactionPeriod,
  anchor: Date,
  direction: 1 | -1,
): Date {
  switch (period) {
    case '1M':
      return addMonths(anchor, direction)
    case '3M':
      return addMonths(anchor, 3 * direction)
    case '6M':
      return addMonths(anchor, 6 * direction)
    case '1Y':
      return addYears(anchor, direction)
    case 'YTD':
      return addYears(anchor, direction)
  }
}

function loadState(): DateRangeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (
        parsed.mode === 'preset' &&
        TRANSACTION_PERIODS.includes(parsed.period)
      ) {
        return parsed
      }
      if (parsed.mode === 'custom' && parsed.start && parsed.end) {
        return parsed
      }
    }
  } catch {
    // Corrupted or unavailable
  }
  return {
    mode: 'preset',
    period: '3M',
    anchor: format(getToday(), 'yyyy-MM-dd'),
  }
}

function saveState(state: DateRangeMode) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or unavailable
  }
}

export function useDateRange() {
  const [state, setStateRaw] = React.useState<DateRangeMode>(() => loadState())

  const setState = React.useCallback((s: DateRangeMode) => {
    setStateRaw(s)
    saveState(s)
  }, [])

  const { start, end } = React.useMemo(() => {
    if (state.mode === 'preset') {
      return computePresetRange(
        state.period,
        startOfDay(parseISO(state.anchor)),
      )
    }
    return {
      start: startOfDay(parseISO(state.start)),
      end: startOfDay(parseISO(state.end)),
    }
  }, [state])

  const range = React.useMemo<DateRange>(
    () => ({
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
    }),
    [start, end],
  )

  const activePeriod: TransactionPeriod | null =
    state.mode === 'preset' ? state.period : null

  const canGoNext = React.useMemo(() => {
    const now = getToday()
    return !isSameDay(end, now) && !isAfter(end, now)
  }, [end])

  const selectPeriod = React.useCallback(
    (period: TransactionPeriod) => {
      setState({
        mode: 'preset',
        period,
        anchor: format(getToday(), 'yyyy-MM-dd'),
      })
    },
    [setState],
  )

  const setCustomRange = React.useCallback(
    (s: Date, e: Date) => {
      setState({
        mode: 'custom',
        start: format(startOfDay(s), 'yyyy-MM-dd'),
        end: format(startOfDay(e), 'yyyy-MM-dd'),
      })
    },
    [setState],
  )

  const goPrev = React.useCallback(() => {
    if (state.mode === 'preset') {
      const newAnchor = stepAnchor(
        state.period,
        startOfDay(parseISO(state.anchor)),
        -1,
      )
      setState({
        mode: 'preset',
        period: state.period,
        anchor: format(newAnchor, 'yyyy-MM-dd'),
      })
    } else {
      const s = startOfDay(parseISO(state.start))
      const e = startOfDay(parseISO(state.end))
      const duration = differenceInDays(e, s)
      const newEnd = addDays(s, -1)
      const newStart = addDays(newEnd, -duration)
      setState({
        mode: 'custom',
        start: format(newStart, 'yyyy-MM-dd'),
        end: format(newEnd, 'yyyy-MM-dd'),
      })
    }
  }, [state, setState])

  const goNext = React.useCallback(() => {
    if (!canGoNext) return
    const now = getToday()

    if (state.mode === 'preset') {
      let newAnchor = stepAnchor(
        state.period,
        startOfDay(parseISO(state.anchor)),
        1,
      )
      if (isAfter(newAnchor, now)) newAnchor = now
      setState({
        mode: 'preset',
        period: state.period,
        anchor: format(newAnchor, 'yyyy-MM-dd'),
      })
    } else {
      const s = startOfDay(parseISO(state.start))
      const e = startOfDay(parseISO(state.end))
      const duration = differenceInDays(e, s)
      const newStart = addDays(e, 1)
      let newEnd = addDays(newStart, duration)
      if (isAfter(newEnd, now)) newEnd = now
      setState({
        mode: 'custom',
        start: format(newStart, 'yyyy-MM-dd'),
        end: format(newEnd, 'yyyy-MM-dd'),
      })
    }
  }, [state, canGoNext, setState])

  return {
    start,
    end,
    range,
    activePeriod,
    canGoNext,
    selectPeriod,
    setCustomRange,
    goPrev,
    goNext,
  }
}
