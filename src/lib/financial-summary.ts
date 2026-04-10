/**
 * Pure functions for computing financial summary metrics from transactions.
 * Extracted from transactions-content.tsx for reuse across pages.
 */

export interface TransactionRecord {
  _id: string
  bankAccountId: string
  portfolioId: string
  source?: 'manual' | 'csv_import'
  date: string
  rdate?: string
  vdate?: string
  wording: string
  originalWording?: string
  simplifiedWording?: string
  category?: string
  categoryParent?: string
  userCategoryKey?: string
  labelIds?: Array<string>
  excludedFromBudget?: boolean
  value: number
  originalValue?: number
  originalCurrency?: string
  type?: string
  coming: boolean
  counterparty?: string
  card?: string
  comment?: string
  customDescription?: string
  encryptedData?: string
}

export interface FinancialSummaryResult {
  totalIncome: number
  totalExpenses: number
  delta: number
  savingsRate: number
  recurringTotal: number
}

const EMPTY_SUMMARY: FinancialSummaryResult = {
  totalIncome: 0,
  totalExpenses: 0,
  delta: 0,
  savingsRate: 0,
  recurringTotal: 0,
}

export function computeFinancialSummary(
  transactions: Array<TransactionRecord> | undefined,
): FinancialSummaryResult {
  if (!transactions) return EMPTY_SUMMARY

  let totalIncome = 0
  let totalExpenses = 0
  const counterpartyTotals = new Map<
    string,
    { months: Set<string>; total: number }
  >()

  for (const t of transactions) {
    if (t.excludedFromBudget) continue
    if (t.value > 0) {
      totalIncome += t.value
    } else {
      const absValue = Math.abs(t.value)
      totalExpenses += absValue
      const key = t.counterparty ?? t.simplifiedWording ?? t.wording
      if (key) {
        const entry = counterpartyTotals.get(key) ?? {
          months: new Set<string>(),
          total: 0,
        }
        entry.months.add(t.date.slice(0, 7))
        entry.total += absValue
        counterpartyTotals.set(key, entry)
      }
    }
  }

  let recurringTotal = 0
  for (const [, { months, total }] of counterpartyTotals) {
    if (months.size >= 2) {
      recurringTotal += total / months.size
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100
  const delta = round(totalIncome - totalExpenses)
  const savingsRate =
    totalIncome > 0
      ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 1000) / 10
      : 0

  return {
    totalIncome: round(totalIncome),
    totalExpenses: round(totalExpenses),
    delta,
    savingsRate,
    recurringTotal: round(recurringTotal),
  }
}
