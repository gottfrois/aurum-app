import { useQuery } from 'convex/react'
import * as React from 'react'
import { usePortfolio } from '~/contexts/portfolio-context'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import {
  getTransactionCategoryKey,
  TRANSACTION_CATEGORIES,
} from './transaction-categories'

export const CATEGORY_PALETTE = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
]

export function deriveCategoryKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

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
  const { singlePortfolioId, activePortfolioId } = usePortfolio()
  const queryArgs = singlePortfolioId
    ? { portfolioId: singlePortfolioId as Id<'portfolios'> }
    : activePortfolioId === 'all' || activePortfolioId === 'team'
      ? { includeAllPortfolios: true }
      : {}
  const dbCategories = useQuery(api.categories.listCategories, queryArgs)
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
