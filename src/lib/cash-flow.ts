/**
 * Pure functions for computing cash flow, category breakdown, and Sankey data.
 * Extracted from transactions-content.tsx for reuse across pages.
 */

import type { CashFlowData } from '~/components/cash-flow-chart'
import type { CategoryInfo } from '~/lib/categories'
import { resolveTransactionCategoryKey } from '~/lib/categories'
import type { TransactionRecord } from '~/lib/financial-summary'

// ─── Cash Flow Chart Data ─────────────────────────────────

export function computeCashFlowData(
  transactions: Array<TransactionRecord> | undefined,
): Array<CashFlowData> {
  if (!transactions) return []
  const monthMap = new Map<string, { income: number; expenses: number }>()
  for (const t of transactions) {
    if (t.excludedFromBudget) continue
    const month = t.date.slice(0, 7)
    const entry = monthMap.get(month) ?? { income: 0, expenses: 0 }
    if (t.value > 0) {
      entry.income += t.value
    } else {
      entry.expenses += Math.abs(t.value)
    }
    monthMap.set(month, entry)
  }
  return [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month: new Date(`${month}-01`).toLocaleDateString('fr-FR', {
        month: 'short',
        year: '2-digit',
      }),
      income: Math.round(data.income * 100) / 100,
      expenses: Math.round(data.expenses * 100) / 100,
    }))
}

// ─── Category Breakdown ───────────────────────────────────

export interface CategoryEntry {
  key: string
  label: string
  value: number
  color: string
}

export function computeCategoryBreakdown(
  transactions: Array<TransactionRecord> | undefined,
  getCategory: (key: string) => CategoryInfo,
  direction: 'income' | 'expense' | 'all',
): { categoryData: Array<CategoryEntry>; total: number } {
  if (!transactions) return { categoryData: [], total: 0 }

  const categoryTotals = new Map<string, number>()
  let sum = 0

  for (const t of transactions) {
    if (t.excludedFromBudget) continue

    const include =
      direction === 'all'
        ? true
        : direction === 'expense'
          ? t.value < 0
          : t.value > 0

    if (!include) continue

    const key = resolveTransactionCategoryKey(t)
    const absValue = Math.abs(t.value)
    categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + absValue)
    sum += absValue
  }

  const categoryData = [...categoryTotals.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([key, value]) => {
      const cat = getCategory(key)
      return {
        key,
        label: cat.label,
        value: Math.round(value * 100) / 100,
        color: cat.color,
      }
    })

  return {
    categoryData,
    total: Math.round(sum * 100) / 100,
  }
}

// ─── Sankey Data ──────────────────────────────────────────

export interface SankeyNode {
  name: string
  color: string
  categoryKey?: string
  intermediate?: boolean
}

export interface SankeyLink {
  source: number
  target: number
  value: number
  stroke: string
}

export function computeSankeyData(
  transactions: Array<TransactionRecord> | undefined,
  getCategory: (key: string) => CategoryInfo,
): { nodes: Array<SankeyNode>; links: Array<SankeyLink> } {
  if (!transactions) return { nodes: [], links: [] }

  let totalIncome = 0
  let totalExpenses = 0
  const categoryExpenses = new Map<string, number>()

  for (const t of transactions) {
    if (t.excludedFromBudget) continue
    if (t.value > 0) {
      totalIncome += t.value
    } else {
      const absValue = Math.abs(t.value)
      totalExpenses += absValue
      const key = resolveTransactionCategoryKey(t)
      categoryExpenses.set(key, (categoryExpenses.get(key) ?? 0) + absValue)
    }
  }

  if (totalIncome === 0 || categoryExpenses.size === 0) {
    return { nodes: [], links: [] }
  }

  const sortedEntries = [...categoryExpenses.entries()].sort(
    ([, a], [, b]) => b - a,
  )

  const round = (n: number) => Math.round(n * 100) / 100
  const savings = round(totalIncome - totalExpenses)

  const nodes: Array<SankeyNode> = [
    { name: 'Income', color: 'hsl(142 71% 45%)' },
    { name: '', color: 'var(--muted)', intermediate: true },
  ]

  const targetOffset = 2
  for (const [key] of sortedEntries) {
    const cat = getCategory(key)
    nodes.push({ name: cat.label, color: cat.color, categoryKey: key })
  }

  if (savings > 0) {
    nodes.push({ name: 'Savings', color: 'hsl(142 71% 45%)' })
  }

  const links: Array<SankeyLink> = []

  links.push({
    source: 0,
    target: 1,
    value: round(totalIncome),
    stroke: 'hsl(142 71% 45%)',
  })

  for (let i = 0; i < sortedEntries.length; i++) {
    const [key, value] = sortedEntries[i]
    const cat = getCategory(key)
    links.push({
      source: 1,
      target: targetOffset + i,
      value: round(value),
      stroke: cat.color,
    })
  }

  if (savings > 0) {
    links.push({
      source: 1,
      target: nodes.length - 1,
      value: savings,
      stroke: 'hsl(142 71% 45%)',
    })
  }

  return { nodes, links }
}
