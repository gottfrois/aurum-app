import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { DateSelectorI18nConfig } from '~/components/reui/date-selector'
import { getDateLocale } from '~/lib/date-locale'

/**
 * Returns a translated DateSelectorI18nConfig for the reui DateSelector component.
 * Month/weekday names are derived from the date-fns locale.
 */
export function useDateSelectorI18n(): Partial<DateSelectorI18nConfig> {
  const { t, i18n } = useTranslation()

  return useMemo(() => {
    const locale = getDateLocale()
    const localize = locale.localize

    const months = Array.from({ length: 12 }, (_, i) =>
      localize.month(i as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11, {
        width: 'wide',
      }),
    )
    const monthsShort = Array.from({ length: 12 }, (_, i) =>
      localize.month(i as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11, {
        width: 'abbreviated',
      }),
    )
    const weekdays = Array.from({ length: 7 }, (_, i) =>
      localize.day(i as 0 | 1 | 2 | 3 | 4 | 5 | 6, { width: 'wide' }),
    )
    const weekdaysShort = Array.from({ length: 7 }, (_, i) =>
      localize.day(i as 0 | 1 | 2 | 3 | 4 | 5 | 6, { width: 'short' }),
    )

    return {
      selectDate: t('datePicker.selectDate'),
      apply: t('datePicker.apply'),
      cancel: t('datePicker.cancel'),
      clear: t('datePicker.clear'),
      today: t('datePicker.today'),
      filterTypes: {
        is: t('datePicker.filterIs'),
        before: t('datePicker.filterBefore'),
        after: t('datePicker.filterAfter'),
        between: t('datePicker.filterBetween'),
      },
      periodTypes: {
        day: t('datePicker.periodDay'),
        month: t('datePicker.periodMonth'),
        quarter: t('datePicker.periodQuarter'),
        halfYear: t('datePicker.periodHalfYear'),
        year: t('datePicker.periodYear'),
      },
      months,
      monthsShort,
      weekdays,
      weekdaysShort,
      placeholder: t('datePicker.placeholder'),
      rangePlaceholder: t('datePicker.rangePlaceholder'),
    }
    // i18n.language is used indirectly via getDateLocale() for month/weekday names
    // biome-ignore lint/correctness/useExhaustiveDependencies: locale depends on language
  }, [t, i18n.language])
}
