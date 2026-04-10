/**
 * Pure computation functions for the Insights analytics page.
 * All functions take arrays of transactions and return structured data.
 * No React dependencies — designed for easy testing.
 */

export interface InsightTransaction {
  _id: string
  date: string
  value: number
  wording: string
  simplifiedWording?: string
  counterparty?: string
  userCategoryKey?: string
  categoryParent?: string
  category?: string
  excludedFromBudget?: boolean
}

// ─── Helpers ──────────────────────────────────────────────

export function resolvePayeeKey(t: InsightTransaction): string {
  return t.counterparty ?? t.simplifiedWording ?? t.wording
}

function resolveCategoryKey(t: InsightTransaction): string {
  return t.userCategoryKey ?? t.categoryParent ?? t.category ?? 'uncategorized'
}

function toMonth(date: string): string {
  return date.slice(0, 7) // YYYY-MM
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function expensesOnly(
  txns: Array<InsightTransaction>,
): Array<InsightTransaction> {
  return txns.filter((t) => t.value < 0 && !t.excludedFromBudget)
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// ─── AC-1: Average Monthly Spending Per Category ──────────

export interface CategoryMonthlyAverage {
  categoryKey: string
  monthlyAverage: number
  total: number
  monthCount: number
}

export function computeAverageMonthlySpendings(
  transactions: Array<InsightTransaction>,
  rollingMonths: 3 | 6 | 12,
): Array<CategoryMonthlyAverage> {
  const expenses = expensesOnly(transactions)
  if (expenses.length === 0) return []

  // Determine the rolling window cutoff
  const allMonths = new Set(expenses.map((t) => toMonth(t.date)))
  const sortedMonths = [...allMonths].sort()
  const windowMonths = new Set(sortedMonths.slice(-rollingMonths))

  const categoryTotals = new Map<
    string,
    { total: number; months: Set<string> }
  >()

  for (const t of expenses) {
    const month = toMonth(t.date)
    if (!windowMonths.has(month)) continue

    const key = resolveCategoryKey(t)
    const entry = categoryTotals.get(key) ?? { total: 0, months: new Set() }
    entry.total += Math.abs(t.value)
    entry.months.add(month)
    categoryTotals.set(key, entry)
  }

  const monthCount = windowMonths.size

  return [...categoryTotals.entries()]
    .map(([categoryKey, { total }]) => ({
      categoryKey,
      monthlyAverage: round2(total / monthCount),
      total: round2(total),
      monthCount,
    }))
    .sort((a, b) => b.monthlyAverage - a.monthlyAverage)
}

// ─── AC-2: Month-over-Month Spending Trends ───────────────

export interface MonthlyTrendEntry {
  month: string
  categories: Record<string, number>
  total: number
}

export function computeMonthlyTrends(
  transactions: Array<InsightTransaction>,
): Array<MonthlyTrendEntry> {
  const expenses = expensesOnly(transactions)
  if (expenses.length === 0) return []

  const monthMap = new Map<
    string,
    { categories: Map<string, number>; total: number }
  >()

  for (const t of expenses) {
    const month = toMonth(t.date)
    const entry = monthMap.get(month) ?? { categories: new Map(), total: 0 }
    const catKey = resolveCategoryKey(t)
    const absVal = Math.abs(t.value)
    entry.categories.set(catKey, (entry.categories.get(catKey) ?? 0) + absVal)
    entry.total += absVal
    monthMap.set(month, entry)
  }

  return [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { categories, total }]) => ({
      month,
      categories: Object.fromEntries(categories),
      total: round2(total),
    }))
}

// ─── Spending Overview (stacked area with projection) ─────

export type BucketGranularity = 'weekly' | 'biweekly' | 'monthly'

export interface SpendingOverviewEntry {
  /** ISO date of the bucket start (YYYY-MM-DD) */
  date: string
  /** Category totals for this bucket */
  categories: Record<string, number>
  /** Total actual spending in this bucket */
  total: number
  /** Projected total spending — non-null only for projection points */
  projectedTotal: number | null
}

export function pickGranularity(
  startDate: string,
  endDate: string,
): BucketGranularity {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000)
  if (days <= 62) return 'weekly'
  if (days <= 180) return 'biweekly'
  return 'monthly'
}

function getBucketKey(date: string, granularity: BucketGranularity): string {
  if (granularity === 'monthly') return `${date.slice(0, 7)}-01`

  // ISO week-based bucketing: snap to Monday of the week
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday = start of week
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)

  if (granularity === 'biweekly') {
    // Snap to even ISO weeks (week 1-2 → week 1, week 3-4 → week 3, etc.)
    const startOfYear = new Date(monday.getFullYear(), 0, 1)
    const dayOfYear = Math.floor(
      (monday.getTime() - startOfYear.getTime()) / 86_400_000,
    )
    const weekNum = Math.floor(dayOfYear / 7)
    const biweekNum = Math.floor(weekNum / 2) * 2
    const biweekStart = new Date(startOfYear)
    biweekStart.setDate(startOfYear.getDate() + biweekNum * 7)
    // Snap to Monday
    const bwDay = biweekStart.getDay()
    const bwDiff = bwDay === 0 ? -6 : 1 - bwDay
    biweekStart.setDate(biweekStart.getDate() + bwDiff)
    return biweekStart.toISOString().slice(0, 10)
  }

  return monday.toISOString().slice(0, 10)
}

export function computeSpendingOverview(
  transactions: Array<InsightTransaction>,
  today: Date,
  granularity: BucketGranularity,
): Array<SpendingOverviewEntry> {
  const expenses = expensesOnly(transactions)
  if (expenses.length === 0) return []

  const todayStr = today.toISOString().slice(0, 10)
  const todayBucket = getBucketKey(todayStr, granularity)

  // Bucket transactions
  const bucketMap = new Map<
    string,
    { categories: Map<string, number>; total: number }
  >()

  for (const t of expenses) {
    const key = getBucketKey(t.date, granularity)
    const entry = bucketMap.get(key) ?? { categories: new Map(), total: 0 }
    const catKey = resolveCategoryKey(t)
    const absVal = Math.abs(t.value)
    entry.categories.set(catKey, (entry.categories.get(catKey) ?? 0) + absVal)
    entry.total += absVal
    bucketMap.set(key, entry)
  }

  const sorted = [...bucketMap.entries()].sort(([a], [b]) => a.localeCompare(b))

  const entries: Array<SpendingOverviewEntry> = sorted.map(
    ([date, { categories, total }]) => ({
      date,
      categories: Object.fromEntries(categories),
      total: round2(total),
      projectedTotal: null,
    }),
  )

  // Add projection: compute average total per bucket from completed buckets,
  // then project the current (partial) bucket to full and add one future bucket
  const completedBuckets = entries.filter((e) => e.date < todayBucket)
  if (completedBuckets.length >= 1) {
    const avgTotal =
      completedBuckets.reduce((sum, e) => sum + e.total, 0) /
      completedBuckets.length

    // Find current bucket and compute its projected full total
    const currentEntry = entries.find((e) => e.date >= todayBucket)
    if (currentEntry) {
      // Bridge point: the current bucket's actual total also gets a projection marker
      currentEntry.projectedTotal = round2(avgTotal)
    }

    // Add one future projection point
    const lastDate = entries[entries.length - 1]?.date
    if (lastDate) {
      const nextDate = new Date(lastDate)
      if (granularity === 'monthly') {
        nextDate.setMonth(nextDate.getMonth() + 1)
      } else if (granularity === 'biweekly') {
        nextDate.setDate(nextDate.getDate() + 14)
      } else {
        nextDate.setDate(nextDate.getDate() + 7)
      }

      entries.push({
        date: nextDate.toISOString().slice(0, 10),
        categories: {},
        total: 0,
        projectedTotal: round2(avgTotal),
      })
    }
  }

  return entries
}

// ─── Monthly Pace (cumulative daily spending) ─────────────

export interface DailyPaceEntry {
  day: number
  actual: number | null
  projected: number | null
  previousMonth: number | null
}

export function computeMonthlyPace(
  transactions: Array<InsightTransaction>,
  today: Date,
): {
  data: Array<DailyPaceEntry>
  currentTotal: number
  projectedTotal: number
  previousTotal: number
  dailyRate: number
} {
  const expenses = expensesOnly(transactions)

  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const currentMonth = `${year}-${String(month).padStart(2, '0')}`
  const daysElapsed = today.getDate()
  const daysTotal = daysInMonth(year, month)

  // Previous month
  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`
  const prevDaysTotal = daysInMonth(prevYear, prevMonth)

  // Bucket spending by day-of-month
  const currentDayTotals = new Map<number, number>()
  const prevDayTotals = new Map<number, number>()

  for (const t of expenses) {
    const m = toMonth(t.date)
    const dayOfMonth = Number.parseInt(t.date.slice(8, 10), 10)
    const absVal = Math.abs(t.value)

    if (m === currentMonth) {
      currentDayTotals.set(
        dayOfMonth,
        (currentDayTotals.get(dayOfMonth) ?? 0) + absVal,
      )
    } else if (m === prevMonthStr) {
      prevDayTotals.set(
        dayOfMonth,
        (prevDayTotals.get(dayOfMonth) ?? 0) + absVal,
      )
    }
  }

  // Build cumulative data
  let cumActual = 0
  let cumPrev = 0
  let previousTotal = 0
  const data: Array<DailyPaceEntry> = []

  // Compute previous month total first (for reference)
  for (let d = 1; d <= prevDaysTotal; d++) {
    previousTotal += prevDayTotals.get(d) ?? 0
  }

  // Reset for building chart data
  cumPrev = 0
  const maxDays = Math.max(daysTotal, prevDaysTotal)

  for (let d = 1; d <= maxDays; d++) {
    if (d <= daysTotal) {
      if (d <= daysElapsed) {
        cumActual += currentDayTotals.get(d) ?? 0
      }
    }
    if (d <= prevDaysTotal) {
      cumPrev += prevDayTotals.get(d) ?? 0
    }

    data.push({
      day: d,
      actual: d <= daysElapsed ? round2(cumActual) : null,
      projected: null, // filled below
      previousMonth: d <= prevDaysTotal ? round2(cumPrev) : null,
    })
  }

  const dailyRate = daysElapsed > 0 ? cumActual / daysElapsed : 0
  const projectedTotal = round2(dailyRate * daysTotal)

  // Fill projected line from today to end of month
  for (let d = daysElapsed; d <= daysTotal; d++) {
    const idx = d - 1
    if (idx >= 0 && idx < data.length) {
      data[idx].projected = round2(dailyRate * d)
    }
  }

  return {
    data: data.slice(0, daysTotal), // trim to current month length
    currentTotal: round2(cumActual),
    projectedTotal,
    previousTotal: round2(previousTotal),
    dailyRate: round2(dailyRate),
  }
}

// ─── AC-3: Spending Projection ────────────────────────────

export interface SpendingProjection {
  currentSpend: number
  projectedSpend: number
  daysElapsed: number
  daysTotal: number
  dailyRate: number
}

export function computeSpendingProjection(
  transactions: Array<InsightTransaction>,
  today: Date,
): SpendingProjection {
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const currentMonth = `${year}-${String(month).padStart(2, '0')}`
  const daysElapsed = today.getDate()
  const daysTotal = daysInMonth(year, month)

  const currentSpend = expensesOnly(transactions)
    .filter((t) => toMonth(t.date) === currentMonth)
    .reduce((sum, t) => sum + Math.abs(t.value), 0)

  const dailyRate = daysElapsed > 0 ? currentSpend / daysElapsed : 0
  const projectedSpend = dailyRate * daysTotal

  return {
    currentSpend: round2(currentSpend),
    projectedSpend: round2(projectedSpend),
    daysElapsed,
    daysTotal,
    dailyRate: round2(dailyRate),
  }
}

// ─── AC-4: Recurring Transaction Detection ──────────────────

export interface RecurringExpense {
  payee: string
  monthlyAmount: number
  frequency: number
  months: Array<string>
  categoryKey: string
  lastDate: string
}

export function detectRecurringExpenses(
  transactions: Array<InsightTransaction>,
  direction: 'expense' | 'income' = 'expense',
): Array<RecurringExpense> {
  const filtered =
    direction === 'expense'
      ? expensesOnly(transactions)
      : transactions.filter((t) => t.value > 0 && !t.excludedFromBudget)
  if (filtered.length === 0) return []

  const payeeMap = new Map<
    string,
    {
      total: number
      months: Set<string>
      categoryKey: string
      lastDate: string
    }
  >()

  for (const t of filtered) {
    const payee = resolvePayeeKey(t)
    const entry = payeeMap.get(payee) ?? {
      total: 0,
      months: new Set(),
      categoryKey: resolveCategoryKey(t),
      lastDate: t.date,
    }
    entry.total += Math.abs(t.value)
    entry.months.add(toMonth(t.date))
    if (t.date > entry.lastDate) entry.lastDate = t.date
    payeeMap.set(payee, entry)
  }

  return [...payeeMap.entries()]
    .filter(([, { months }]) => months.size >= 2)
    .map(([payee, { total, months, categoryKey, lastDate }]) => ({
      payee,
      monthlyAmount: round2(total / months.size),
      frequency: months.size,
      months: [...months].sort(),
      categoryKey,
      lastDate,
    }))
    .sort((a, b) => b.monthlyAmount - a.monthlyAmount)
}

// ─── AC-6: Anomaly Detection ──────────────────────────────

export const ANOMALY_THRESHOLD = 2.0

export interface SpendingAnomaly {
  categoryKey: string
  currentMonthSpend: number
  averageSpend: number
  ratio: number
  month: string
}

export function detectAnomalies(
  transactions: Array<InsightTransaction>,
  lookbackMonths: number,
): Array<SpendingAnomaly> {
  const expenses = expensesOnly(transactions)
  if (expenses.length === 0) return []

  const allMonths = [...new Set(expenses.map((t) => toMonth(t.date)))].sort()
  if (allMonths.length < 2) return []

  const currentMonth = allMonths[allMonths.length - 1]
  const lookbackSet = new Set(
    allMonths.slice(-(lookbackMonths + 1), -1), // exclude current month from average
  )

  if (lookbackSet.size === 0) return []

  // Compute per-category totals for lookback period and current month
  const categoryLookback = new Map<string, number>()
  const categoryCurrent = new Map<string, number>()

  for (const t of expenses) {
    const month = toMonth(t.date)
    const catKey = resolveCategoryKey(t)
    const absVal = Math.abs(t.value)

    if (month === currentMonth) {
      categoryCurrent.set(catKey, (categoryCurrent.get(catKey) ?? 0) + absVal)
    } else if (lookbackSet.has(month)) {
      categoryLookback.set(catKey, (categoryLookback.get(catKey) ?? 0) + absVal)
    }
  }

  const lookbackCount = lookbackSet.size

  const anomalies: Array<SpendingAnomaly> = []
  for (const [catKey, currentSpend] of categoryCurrent) {
    const lookbackTotal = categoryLookback.get(catKey) ?? 0
    const averageSpend = lookbackTotal / lookbackCount

    if (averageSpend > 0) {
      const ratio = currentSpend / averageSpend
      if (ratio >= ANOMALY_THRESHOLD) {
        anomalies.push({
          categoryKey: catKey,
          currentMonthSpend: round2(currentSpend),
          averageSpend: round2(averageSpend),
          ratio: round2(ratio),
          month: currentMonth,
        })
      }
    }
  }

  return anomalies.sort((a, b) => b.ratio - a.ratio)
}

// ─── AC-7: Top Payees by Spend ────────────────────────────

export interface TopPayee {
  payee: string
  total: number
  transactionCount: number
  categoryKey: string
}

export function computeTopPayees(
  transactions: Array<InsightTransaction>,
  limit: number,
): Array<TopPayee> {
  const expenses = expensesOnly(transactions)
  if (expenses.length === 0) return []

  const payeeMap = new Map<
    string,
    { total: number; count: number; categoryKey: string }
  >()

  for (const t of expenses) {
    const payee = resolvePayeeKey(t)
    const entry = payeeMap.get(payee) ?? {
      total: 0,
      count: 0,
      categoryKey: resolveCategoryKey(t),
    }
    entry.total += Math.abs(t.value)
    entry.count += 1
    payeeMap.set(payee, entry)
  }

  return [...payeeMap.entries()]
    .map(([payee, { total, count, categoryKey }]) => ({
      payee,
      total: round2(total),
      transactionCount: count,
      categoryKey,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

// ─── AC-8: Year-over-Year Comparison ──────────────────────

export interface YearOverYearEntry {
  month: number
  years: Record<number, number>
}

export function computeYearOverYear(
  transactions: Array<InsightTransaction>,
): Array<YearOverYearEntry> {
  const expenses = expensesOnly(transactions)
  if (expenses.length === 0) return []

  const monthYearMap = new Map<number, Map<number, number>>()

  for (const t of expenses) {
    const year = Number.parseInt(t.date.slice(0, 4), 10)
    const month = Number.parseInt(t.date.slice(5, 7), 10)
    const absVal = Math.abs(t.value)

    const yearMap = monthYearMap.get(month) ?? new Map()
    yearMap.set(year, (yearMap.get(year) ?? 0) + absVal)
    monthYearMap.set(month, yearMap)
  }

  return [...monthYearMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([month, yearMap]) => ({
      month,
      years: Object.fromEntries(
        [...yearMap.entries()].map(([y, v]) => [y, round2(v)]),
      ),
    }))
}
