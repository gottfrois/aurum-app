import {
  endOfMonth,
  endOfYear,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfYear,
} from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import * as React from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useTranslation } from 'react-i18next'
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
import { HotkeyDisplay, Kbd } from '~/components/ui/kbd'
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group'
import type { TransactionPeriod } from '~/hooks/use-date-range'
import { TRANSACTION_PERIODS } from '~/hooks/use-date-range'
import { useDateSelectorI18n } from '~/hooks/use-date-selector-i18n'
import { getDateLocale } from '~/lib/date-locale'
import i18n from '~/lib/i18n'

interface PeriodNavigatorProps {
  start: Date
  end: Date
  activePeriod: TransactionPeriod | null
  canGoNext: boolean
  onSelectPeriod: (period: TransactionPeriod) => void
  onCustomRange: (start: Date, end: Date) => void
  onPrev: () => void
  onNext: () => void
}

function formatRangeLabel(start: Date, end: Date): string {
  const today = startOfDay(new Date())
  const sameYear = start.getFullYear() === end.getFullYear()
  const locale = getDateLocale()

  // Full year: "2025"
  if (
    isSameDay(start, startOfYear(start)) &&
    isSameDay(end, endOfYear(start)) &&
    sameYear
  ) {
    return format(start, 'yyyy', { locale })
  }

  // Full single month: "Mar 2026"
  if (
    isSameDay(start, startOfMonth(start)) &&
    isSameDay(end, endOfMonth(start)) &&
    start.getMonth() === end.getMonth() &&
    sameYear
  ) {
    return format(start, 'MMM yyyy', { locale })
  }

  const endLabel = isSameDay(end, today)
    ? i18n.t('periodNavigator.today')
    : format(end, sameYear ? 'MMM d' : 'MMM d, yyyy', { locale })
  const startLabel = format(start, sameYear ? 'MMM d' : 'MMM d, yyyy', {
    locale,
  })

  if (sameYear && !isSameDay(end, today)) {
    return `${startLabel} – ${endLabel}, ${format(end, 'yyyy', { locale })}`
  }
  return `${startLabel} – ${endLabel}`
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

export function PeriodNavigator({
  start,
  end,
  activePeriod,
  canGoNext,
  onSelectPeriod,
  onCustomRange,
  onPrev,
  onNext,
}: PeriodNavigatorProps) {
  const { t } = useTranslation()
  const dateSelectorI18n = useDateSelectorI18n()
  const [open, setOpen] = React.useState(false)
  const [dateValue, setDateValue] = React.useState<DateSelectorValue>({
    period: 'day',
    operator: 'between',
    startDate: start,
    endDate: end,
  })

  // Sync dateValue when range changes externally
  React.useEffect(() => {
    if (!open) {
      setDateValue({
        period: 'day',
        operator: 'between',
        startDate: start,
        endDate: end,
      })
    }
  }, [start, end, open])

  const resolvedRange = React.useMemo(
    () => resolveDateSelectorRange(dateValue),
    [dateValue],
  )

  const handleApply = React.useCallback(() => {
    if (resolvedRange) {
      onCustomRange(resolvedRange.start, resolvedRange.end)
    }
    setOpen(false)
  }, [resolvedRange, onCustomRange])

  const label = formatRangeLabel(start, end)

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onPrev}
          aria-label={t('periodNavigator.previousPeriod')}
        >
          <ChevronLeft />
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <CalendarDays />
              <span>{label}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-fit" showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>{t('periodNavigator.selectDateRange')}</DialogTitle>
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
              i18n={dateSelectorI18n}
            />
            <CustomRangeFooter
              onCancel={() => setOpen(false)}
              onConfirm={handleApply}
              disabled={!resolvedRange}
            />
          </DialogContent>
        </Dialog>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onNext}
          disabled={!canGoNext}
          aria-label={t('periodNavigator.nextPeriod')}
        >
          <ChevronRight />
        </Button>
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={activePeriod ?? ''}
        onValueChange={(val) => {
          if (val) onSelectPeriod(val as TransactionPeriod)
        }}
        className="hidden sm:flex"
      >
        {TRANSACTION_PERIODS.map((p) => (
          <ToggleGroupItem key={p} value={p}>
            {p}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="sm:hidden">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={activePeriod ?? ''}
          onValueChange={(val) => {
            if (val) onSelectPeriod(val as TransactionPeriod)
          }}
        >
          {TRANSACTION_PERIODS.map((p) => (
            <ToggleGroupItem key={p} value={p} className="px-1.5 text-xs">
              {p}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  )
}

function CustomRangeFooter({
  onCancel,
  onConfirm,
  disabled,
}: {
  onCancel: () => void
  onConfirm: () => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  const handleConfirm = React.useCallback(() => {
    if (!disabled) onConfirm()
  }, [disabled, onConfirm])

  useHotkeys('escape', onCancel, {
    enableOnFormTags: true,
    preventDefault: true,
  })

  useHotkeys('mod+enter', handleConfirm, {
    enabled: !disabled,
    enableOnFormTags: true,
    preventDefault: true,
  })

  return (
    <DialogFooter>
      <Button variant="outline" onClick={onCancel}>
        {t('common.cancel')} <Kbd>Esc</Kbd>
      </Button>
      <Button onClick={handleConfirm} disabled={disabled}>
        {t('common.apply')} <HotkeyDisplay hotkey={{ keys: 'mod+enter' }} />
      </Button>
    </DialogFooter>
  )
}
