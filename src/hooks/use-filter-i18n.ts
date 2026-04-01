import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { FilterI18nConfig } from '~/components/reui/filters'

/**
 * Returns a translated FilterI18nConfig for the reui Filters component.
 */
export function useFilterI18n(): Partial<FilterI18nConfig> {
  const { t } = useTranslation()

  return useMemo(
    (): Partial<FilterI18nConfig> => ({
      addFilter: t('filters.addFilter'),
      searchFields: t('filters.searchFields'),
      noFieldsFound: t('filters.noFieldsFound'),
      noResultsFound: t('filters.noResultsFound'),
      select: t('filters.select'),
      true: t('filters.true'),
      false: t('filters.false'),
      min: t('filters.min'),
      max: t('filters.max'),
      to: t('filters.to'),
      typeAndPressEnter: t('filters.typeAndPressEnter'),
      selected: t('filters.selected'),
      selectedCount: t('filters.selected'),
      addFilterTitle: t('filters.addFilterTitle'),

      operators: {
        is: t('filters.operators.is'),
        isNot: t('filters.operators.isNot'),
        isAnyOf: t('filters.operators.isAnyOf'),
        isNotAnyOf: t('filters.operators.isNotAnyOf'),
        includesAll: t('filters.operators.includesAll'),
        excludesAll: t('filters.operators.excludesAll'),
        before: t('filters.operators.before'),
        after: t('filters.operators.after'),
        between: t('filters.operators.between'),
        notBetween: t('filters.operators.notBetween'),
        contains: t('filters.operators.contains'),
        notContains: t('filters.operators.notContains'),
        startsWith: t('filters.operators.startsWith'),
        endsWith: t('filters.operators.endsWith'),
        isExactly: t('filters.operators.isExactly'),
        equals: t('filters.operators.equals'),
        notEquals: t('filters.operators.notEquals'),
        greaterThan: t('filters.operators.greaterThan'),
        lessThan: t('filters.operators.lessThan'),
        overlaps: 'overlaps',
        includes: 'includes',
        excludes: 'excludes',
        includesAllOf: 'includes all of',
        includesAnyOf: 'includes any of',
        empty: t('filters.operators.empty'),
        notEmpty: t('filters.operators.notEmpty'),
      },

      placeholders: {
        enterField: (fieldType: string) =>
          t('filters.enterPlaceholder', { field: fieldType }),
        selectField: t('filters.select'),
        searchField: (fieldName: string) =>
          t('filters.searchPlaceholder', { field: fieldName.toLowerCase() }),
        enterKey: t('filters.enterKey'),
        enterValue: t('filters.enterValue'),
      },

      helpers: {
        formatOperator: (operator: string) => operator.replace(/_/g, ' '),
      },
    }),
    [t],
  )
}
