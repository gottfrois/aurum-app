import { useQuery } from 'convex/react'
import * as React from 'react'
import { api } from '../../convex/_generated/api'
import {
  getTransactionCategoryKey,
  TRANSACTION_CATEGORIES,
} from './transaction-categories'

export interface CategoryInfo {
  key: string
  label: string
  color: string
  icon?: string
  parentKey?: string
  builtIn: boolean
}

export function resolveTransactionCategoryKey(transaction: {
  userCategoryKey?: string
  categoryParent?: string
  category?: string
}): string {
  return (
    transaction.userCategoryKey ??
    getTransactionCategoryKey(transaction.categoryParent, transaction.category)
  )
}

export function useCategories(): {
  categories: Array<CategoryInfo>
  categoryMap: Map<string, CategoryInfo>
  getCategory: (key: string) => CategoryInfo
  isLoading: boolean
} {
  const dbCategories = useQuery(api.categories.listCategories, {})
  const isLoading = dbCategories === undefined

  const categories = React.useMemo<Array<CategoryInfo>>(
    () =>
      dbCategories && dbCategories.length > 0
        ? dbCategories.map((c) => ({
            key: c.key,
            label: c.label,
            color: c.color,
            icon: c.icon,
            parentKey: c.parentKey,
            builtIn: c.builtIn,
          }))
        : Object.entries(TRANSACTION_CATEGORIES).map(([key, cat]) => ({
            key,
            label: cat.label,
            color: cat.color,
            builtIn: true,
          })),
    [dbCategories],
  )

  const categoryMap = React.useMemo(
    () => new Map(categories.map((c) => [c.key, c])),
    [categories],
  )

  const getCategory = React.useCallback(
    (key: string): CategoryInfo =>
      categoryMap.get(key) ?? {
        key: 'others',
        label: 'Others',
        color: 'hsl(0 0% 55%)',
        builtIn: true,
      },
    [categoryMap],
  )

  return { categories, categoryMap, getCategory, isLoading }
}
