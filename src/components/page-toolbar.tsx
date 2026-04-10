import { ListFilter } from 'lucide-react'
import type * as React from 'react'
import { useTranslation } from 'react-i18next'
import { PeriodNavigator } from '~/components/period-navigator'
import {
  type Filter,
  type FilterFieldConfig,
  type FilterI18nConfig,
  Filters,
} from '~/components/reui/filters'
import { Button } from '~/components/ui/button'
import type { TransactionPeriod } from '~/hooks/use-date-range'

interface PageToolbarProps {
  children: React.ReactNode
}

export function PageToolbar({ children }: PageToolbarProps) {
  return <div className="flex flex-col border-b">{children}</div>
}

interface PeriodRowProps {
  start: Date
  end: Date
  activePeriod: TransactionPeriod | null
  canGoNext: boolean
  onSelectPeriod: (period: TransactionPeriod) => void
  onCustomRange: (start: Date, end: Date) => void
  onPrev: () => void
  onNext: () => void
  children?: React.ReactNode
}

export function PeriodRow({
  start,
  end,
  activePeriod,
  canGoNext,
  onSelectPeriod,
  onCustomRange,
  onPrev,
  onNext,
  children,
}: PeriodRowProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 lg:px-6">
      <div className="flex-1">
        <PeriodNavigator
          start={start}
          end={end}
          activePeriod={activePeriod}
          canGoNext={canGoNext}
          onSelectPeriod={onSelectPeriod}
          onCustomRange={onCustomRange}
          onPrev={onPrev}
          onNext={onNext}
        />
      </div>
      {children}
    </div>
  )
}

interface FilterRowProps {
  filters: Array<Filter>
  fields: Array<FilterFieldConfig<unknown>>
  onChange: (filters: Array<Filter>) => void
  i18n?: Partial<FilterI18nConfig>
  enableShortcut?: boolean
  menuHeader?: React.ReactNode
  /** Extra actions rendered after the clear button */
  children?: React.ReactNode
  /** Slot rendered below the filter row */
  footer?: React.ReactNode
}

export function FilterRow({
  filters,
  fields,
  onChange,
  i18n,
  enableShortcut,
  menuHeader,
  children,
  footer,
}: FilterRowProps) {
  const { t } = useTranslation()

  return (
    <div className="border-t px-4 py-2.5 lg:px-6">
      <div className="flex items-start gap-2.5">
        <div className="flex-1">
          <Filters
            filters={filters}
            fields={fields}
            onChange={onChange}
            size="sm"
            enableShortcut={enableShortcut}
            i18n={i18n}
            menuHeader={menuHeader}
            trigger={
              <Button variant="ghost" size="icon-sm">
                <ListFilter />
              </Button>
            }
          />
        </div>
        {filters.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onChange([])}>
            {t('transactions.clear')}
          </Button>
        )}
        {children}
      </div>
      {footer}
    </div>
  )
}
