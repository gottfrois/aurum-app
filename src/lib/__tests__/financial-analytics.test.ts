import { describe, expect, it } from 'vitest'
import type {
  InsightTransaction,
  MonthlyTrendEntry,
  SpendingOverviewEntry,
  YearOverYearEntry,
} from '../financial-analytics'
import {
  ANOMALY_THRESHOLD,
  computeAverageMonthlySpendings,
  computeMonthlyPace,
  computeMonthlyTrends,
  computeSpendingOverview,
  computeSpendingProjection,
  computeTopPayees,
  computeYearOverYear,
  detectAnomalies,
  detectRecurringExpenses,
  pickGranularity,
  resolvePayeeKey,
} from '../financial-analytics'

function makeTxn(
  overrides: Partial<InsightTransaction> = {},
): InsightTransaction {
  return {
    _id: `txn_${Math.random().toString(36).slice(2, 8)}`,
    date: '2025-03-15',
    value: -50,
    wording: 'Test Transaction',
    ...overrides,
  }
}

function makeExpenses(
  entries: Array<{
    date: string
    value: number
    category?: string
    payee?: string
  }>,
): Array<InsightTransaction> {
  return entries.map((e, i) =>
    makeTxn({
      _id: `txn_${i}`,
      date: e.date,
      value: -Math.abs(e.value),
      userCategoryKey: e.category ?? 'groceries',
      counterparty: e.payee ?? 'Store',
    }),
  )
}

describe('resolvePayeeKey', () => {
  it('prefers counterparty', () => {
    expect(
      resolvePayeeKey(
        makeTxn({
          counterparty: 'Netflix',
          simplifiedWording: 'NFLX',
          wording: 'NFLX INC',
        }),
      ),
    ).toBe('Netflix')
  })

  it('falls back to simplifiedWording', () => {
    expect(
      resolvePayeeKey(
        makeTxn({ simplifiedWording: 'NFLX', wording: 'NFLX INC' }),
      ),
    ).toBe('NFLX')
  })

  it('falls back to wording', () => {
    expect(resolvePayeeKey(makeTxn({ wording: 'NFLX INC' }))).toBe('NFLX INC')
  })
})

describe('computeAverageMonthlySpendings', () => {
  it('returns empty array for no transactions', () => {
    expect(computeAverageMonthlySpendings([], 3)).toEqual([])
  })

  it('returns empty for only income transactions', () => {
    expect(
      computeAverageMonthlySpendings([makeTxn({ value: 100 })], 3),
    ).toEqual([])
  })

  it('computes rolling average over 3 months', () => {
    const txns = makeExpenses([
      { date: '2025-01-10', value: 100, category: 'groceries' },
      { date: '2025-02-10', value: 200, category: 'groceries' },
      { date: '2025-03-10', value: 300, category: 'groceries' },
    ])
    const result = computeAverageMonthlySpendings(txns, 3)
    expect(result).toHaveLength(1)
    expect(result[0].categoryKey).toBe('groceries')
    expect(result[0].monthlyAverage).toBe(200) // (100+200+300) / 3
    expect(result[0].total).toBe(600)
    expect(result[0].monthCount).toBe(3)
  })

  it('uses only last N months when more data exists', () => {
    const txns = makeExpenses([
      { date: '2024-10-10', value: 1000, category: 'groceries' }, // outside 3M window
      { date: '2025-01-10', value: 100, category: 'groceries' },
      { date: '2025-02-10', value: 200, category: 'groceries' },
      { date: '2025-03-10', value: 300, category: 'groceries' },
    ])
    const result = computeAverageMonthlySpendings(txns, 3)
    expect(result[0].monthlyAverage).toBe(200) // only last 3 months
  })

  it('excludes budget-excluded transactions', () => {
    const txns = [
      makeTxn({
        date: '2025-01-10',
        value: -100,
        userCategoryKey: 'groceries',
        excludedFromBudget: true,
      }),
      makeTxn({
        date: '2025-02-10',
        value: -200,
        userCategoryKey: 'groceries',
      }),
    ]
    const result = computeAverageMonthlySpendings(txns, 3)
    expect(result).toHaveLength(1)
    expect(result[0].total).toBe(200) // excluded txn not counted
  })

  it('sorts by monthly average descending', () => {
    const txns = makeExpenses([
      { date: '2025-01-10', value: 50, category: 'transport' },
      { date: '2025-01-10', value: 300, category: 'groceries' },
    ])
    const result = computeAverageMonthlySpendings(txns, 3)
    expect(result[0].categoryKey).toBe('groceries')
    expect(result[1].categoryKey).toBe('transport')
  })
})

describe('computeMonthlyTrends', () => {
  it('returns empty array for no transactions', () => {
    expect(computeMonthlyTrends([])).toEqual([])
  })

  it('groups expenses by month and category', () => {
    const txns = makeExpenses([
      { date: '2025-01-10', value: 100, category: 'groceries' },
      { date: '2025-01-20', value: 50, category: 'transport' },
      { date: '2025-02-10', value: 200, category: 'groceries' },
    ])
    const result = computeMonthlyTrends(txns)
    expect(result).toHaveLength(2)
    expect(result[0].month).toBe('2025-01')
    expect(result[0].categories.groceries).toBe(100)
    expect(result[0].categories.transport).toBe(50)
    expect(result[0].total).toBe(150)
    expect(result[1].month).toBe('2025-02')
    expect(result[1].categories.groceries).toBe(200)
    expect(result[1].total).toBe(200)
  })

  it('sorts months chronologically', () => {
    const txns = makeExpenses([
      { date: '2025-03-10', value: 50 },
      { date: '2025-01-10', value: 50 },
      { date: '2025-02-10', value: 50 },
    ])
    const result = computeMonthlyTrends(txns)
    expect(result.map((r: MonthlyTrendEntry) => r.month)).toEqual([
      '2025-01',
      '2025-02',
      '2025-03',
    ])
  })
})

describe('computeSpendingProjection', () => {
  it('projects spend for mid-month', () => {
    const txns = makeExpenses([
      { date: '2025-03-01', value: 100 },
      { date: '2025-03-05', value: 100 },
      { date: '2025-03-10', value: 100 },
    ])
    const today = new Date(2025, 2, 15) // March 15
    const result = computeSpendingProjection(txns, today)
    expect(result.currentSpend).toBe(300)
    expect(result.daysElapsed).toBe(15)
    expect(result.daysTotal).toBe(31)
    expect(result.dailyRate).toBe(20)
    expect(result.projectedSpend).toBe(620)
  })

  it('returns zero projection on day 0 scenario (empty month)', () => {
    const result = computeSpendingProjection([], new Date(2025, 2, 1))
    expect(result.currentSpend).toBe(0)
    expect(result.projectedSpend).toBe(0)
  })

  it('only counts current month transactions', () => {
    const txns = makeExpenses([
      { date: '2025-02-15', value: 500 }, // previous month
      { date: '2025-03-10', value: 100 }, // current month
    ])
    const today = new Date(2025, 2, 15)
    const result = computeSpendingProjection(txns, today)
    expect(result.currentSpend).toBe(100)
  })

  it('handles February correctly', () => {
    const txns = makeExpenses([{ date: '2025-02-10', value: 100 }])
    const today = new Date(2025, 1, 14) // Feb 14, 2025 (non-leap year)
    const result = computeSpendingProjection(txns, today)
    expect(result.daysTotal).toBe(28)
  })
})

describe('detectRecurringExpenses', () => {
  it('returns empty for no transactions', () => {
    expect(detectRecurringExpenses([])).toEqual([])
  })

  it('detects payee appearing in 2+ months as recurring', () => {
    const txns = makeExpenses([
      { date: '2025-01-15', value: 15, payee: 'Netflix' },
      { date: '2025-02-15', value: 15, payee: 'Netflix' },
      { date: '2025-03-15', value: 15, payee: 'Netflix' },
    ])
    const result = detectRecurringExpenses(txns)
    expect(result).toHaveLength(1)
    expect(result[0].payee).toBe('Netflix')
    expect(result[0].monthlyAmount).toBe(15)
    expect(result[0].frequency).toBe(3)
    expect(result[0].months).toEqual(['2025-01', '2025-02', '2025-03'])
  })

  it('does not flag single-month payee as recurring', () => {
    const txns = makeExpenses([
      { date: '2025-01-15', value: 500, payee: 'One-time purchase' },
    ])
    expect(detectRecurringExpenses(txns)).toEqual([])
  })

  it('sorts by monthly amount descending', () => {
    const txns = makeExpenses([
      { date: '2025-01-01', value: 10, payee: 'Cheap' },
      { date: '2025-02-01', value: 10, payee: 'Cheap' },
      { date: '2025-01-01', value: 100, payee: 'Expensive' },
      { date: '2025-02-01', value: 100, payee: 'Expensive' },
    ])
    const result = detectRecurringExpenses(txns)
    expect(result[0].payee).toBe('Expensive')
    expect(result[1].payee).toBe('Cheap')
  })

  it('tracks last date correctly', () => {
    const txns = makeExpenses([
      { date: '2025-01-05', value: 15, payee: 'Netflix' },
      { date: '2025-03-20', value: 15, payee: 'Netflix' },
      { date: '2025-02-12', value: 15, payee: 'Netflix' },
    ])
    const result = detectRecurringExpenses(txns)
    expect(result[0].lastDate).toBe('2025-03-20')
  })
})

describe('detectAnomalies', () => {
  it('returns empty for no transactions', () => {
    expect(detectAnomalies([], 3)).toEqual([])
  })

  it('returns empty for single month of data', () => {
    const txns = makeExpenses([{ date: '2025-03-10', value: 100 }])
    expect(detectAnomalies(txns, 3)).toEqual([])
  })

  it('flags category spending at 2x+ normal', () => {
    const txns = makeExpenses([
      { date: '2025-01-10', value: 100, category: 'groceries' },
      { date: '2025-02-10', value: 100, category: 'groceries' },
      { date: '2025-03-10', value: 250, category: 'groceries' }, // 2.5x average
    ])
    const result = detectAnomalies(txns, 3)
    expect(result).toHaveLength(1)
    expect(result[0].categoryKey).toBe('groceries')
    expect(result[0].ratio).toBe(2.5)
    expect(result[0].averageSpend).toBe(100)
    expect(result[0].currentMonthSpend).toBe(250)
    expect(result[0].month).toBe('2025-03')
  })

  it('does not flag spending below threshold', () => {
    const txns = makeExpenses([
      { date: '2025-01-10', value: 100, category: 'groceries' },
      { date: '2025-02-10', value: 100, category: 'groceries' },
      { date: '2025-03-10', value: 150, category: 'groceries' }, // 1.5x — below 2x
    ])
    expect(detectAnomalies(txns, 3)).toEqual([])
  })

  it('flags exactly at threshold', () => {
    const txns = makeExpenses([
      { date: '2025-01-10', value: 100, category: 'groceries' },
      { date: '2025-02-10', value: 100, category: 'groceries' },
      { date: '2025-03-10', value: 200, category: 'groceries' }, // exactly 2x
    ])
    const result = detectAnomalies(txns, 3)
    expect(result).toHaveLength(1)
    expect(result[0].ratio).toBe(ANOMALY_THRESHOLD)
  })

  it('sorts by ratio descending', () => {
    const txns = makeExpenses([
      { date: '2025-01-10', value: 100, category: 'groceries' },
      { date: '2025-02-10', value: 100, category: 'groceries' },
      { date: '2025-03-10', value: 300, category: 'groceries' }, // 3x
      { date: '2025-01-10', value: 50, category: 'transport' },
      { date: '2025-02-10', value: 50, category: 'transport' },
      { date: '2025-03-10', value: 200, category: 'transport' }, // 4x
    ])
    const result = detectAnomalies(txns, 3)
    expect(result[0].categoryKey).toBe('transport')
    expect(result[1].categoryKey).toBe('groceries')
  })
})

describe('computeTopPayees', () => {
  it('returns empty for no transactions', () => {
    expect(computeTopPayees([], 10)).toEqual([])
  })

  it('ranks payees by total spend', () => {
    const txns = makeExpenses([
      { date: '2025-01-10', value: 50, payee: 'Shop A' },
      { date: '2025-01-15', value: 30, payee: 'Shop A' },
      { date: '2025-01-10', value: 100, payee: 'Shop B' },
    ])
    const result = computeTopPayees(txns, 10)
    expect(result[0].payee).toBe('Shop B')
    expect(result[0].total).toBe(100)
    expect(result[0].transactionCount).toBe(1)
    expect(result[1].payee).toBe('Shop A')
    expect(result[1].total).toBe(80)
    expect(result[1].transactionCount).toBe(2)
  })

  it('respects limit parameter', () => {
    const txns = makeExpenses([
      { date: '2025-01-10', value: 100, payee: 'A' },
      { date: '2025-01-10', value: 90, payee: 'B' },
      { date: '2025-01-10', value: 80, payee: 'C' },
    ])
    const result = computeTopPayees(txns, 2)
    expect(result).toHaveLength(2)
    expect(result[0].payee).toBe('A')
    expect(result[1].payee).toBe('B')
  })
})

describe('computeYearOverYear', () => {
  it('returns empty for no transactions', () => {
    expect(computeYearOverYear([])).toEqual([])
  })

  it('groups spending by calendar month across years', () => {
    const txns = makeExpenses([
      { date: '2024-01-10', value: 100 },
      { date: '2024-01-20', value: 50 },
      { date: '2025-01-10', value: 200 },
      { date: '2024-06-10', value: 300 },
    ])
    const result = computeYearOverYear(txns)

    const jan = result.find((r: YearOverYearEntry) => r.month === 1)
    expect(jan).toBeDefined()
    expect(jan?.years[2024]).toBe(150)
    expect(jan?.years[2025]).toBe(200)

    const jun = result.find((r: YearOverYearEntry) => r.month === 6)
    expect(jun).toBeDefined()
    expect(jun?.years[2024]).toBe(300)
  })

  it('sorts months 1-12', () => {
    const txns = makeExpenses([
      { date: '2025-12-10', value: 50 },
      { date: '2025-03-10', value: 50 },
      { date: '2025-01-10', value: 50 },
    ])
    const result = computeYearOverYear(txns)
    expect(result.map((r: YearOverYearEntry) => r.month)).toEqual([1, 3, 12])
  })
})

describe('pickGranularity', () => {
  it('returns weekly for short ranges (≤62 days)', () => {
    expect(pickGranularity('2025-01-01', '2025-02-15')).toBe('weekly')
  })

  it('returns biweekly for medium ranges (63-180 days)', () => {
    expect(pickGranularity('2025-01-01', '2025-06-01')).toBe('biweekly')
  })

  it('returns monthly for long ranges (>180 days)', () => {
    expect(pickGranularity('2024-01-01', '2025-01-01')).toBe('monthly')
  })
})

describe('computeSpendingOverview', () => {
  it('returns empty for no transactions', () => {
    expect(
      computeSpendingOverview([], new Date(2025, 2, 15), 'monthly'),
    ).toEqual([])
  })

  it('buckets by month with monthly granularity', () => {
    const txns = makeExpenses([
      { date: '2025-01-10', value: 100, category: 'groceries' },
      { date: '2025-01-15', value: 50, category: 'transport' },
      { date: '2025-02-05', value: 200, category: 'groceries' },
    ])
    const result = computeSpendingOverview(
      txns,
      new Date(2025, 2, 15),
      'monthly',
    )
    // 2 actual buckets + 1 projection point
    const actuals = result.filter(
      (e: SpendingOverviewEntry) => e.projectedTotal === null,
    )
    expect(actuals.length).toBeGreaterThanOrEqual(2)
    expect(actuals[0].categories.groceries).toBe(100)
    expect(actuals[0].categories.transport).toBe(50)
    expect(actuals[0].total).toBe(150)
  })

  it('adds projection points based on average of completed buckets', () => {
    const txns = makeExpenses([
      { date: '2025-01-10', value: 100 },
      { date: '2025-02-10', value: 200 },
      { date: '2025-03-05', value: 50 }, // current month partial
    ])
    const result = computeSpendingOverview(
      txns,
      new Date(2025, 2, 15),
      'monthly',
    )
    const projected = result.filter(
      (e: SpendingOverviewEntry) => e.projectedTotal !== null,
    )
    expect(projected.length).toBeGreaterThanOrEqual(1)
    // Average of completed buckets: (100 + 200) / 2 = 150
    expect(projected[0].projectedTotal).toBe(150)
  })

  it('sorts entries chronologically', () => {
    const txns = makeExpenses([
      { date: '2025-03-10', value: 50 },
      { date: '2025-01-10', value: 50 },
      { date: '2025-02-10', value: 50 },
    ])
    const result = computeSpendingOverview(
      txns,
      new Date(2025, 2, 15),
      'monthly',
    )
    const dates = result.map((r: SpendingOverviewEntry) => r.date)
    expect(dates).toEqual([...dates].sort())
  })

  it('produces more data points with weekly granularity', () => {
    const txns = makeExpenses([
      { date: '2025-01-06', value: 50 },
      { date: '2025-01-13', value: 50 },
      { date: '2025-01-20', value: 50 },
      { date: '2025-01-27', value: 50 },
    ])
    const weekly = computeSpendingOverview(
      txns,
      new Date(2025, 1, 15),
      'weekly',
    )
    const monthly = computeSpendingOverview(
      txns,
      new Date(2025, 1, 15),
      'monthly',
    )
    expect(weekly.length).toBeGreaterThan(monthly.length)
  })
})

describe('computeMonthlyPace', () => {
  it('returns empty data for no transactions', () => {
    const result = computeMonthlyPace([], new Date(2025, 2, 15))
    expect(result.currentTotal).toBe(0)
    expect(result.projectedTotal).toBe(0)
    expect(result.data.length).toBe(31) // March has 31 days
  })

  it('builds cumulative actual spending up to today', () => {
    const txns = makeExpenses([
      { date: '2025-03-01', value: 100 },
      { date: '2025-03-05', value: 200 },
      { date: '2025-03-10', value: 50 },
    ])
    const today = new Date(2025, 2, 15) // March 15
    const result = computeMonthlyPace(txns, today)

    // Day 1: cumulative = 100
    expect(result.data[0].actual).toBe(100)
    // Day 5: cumulative = 300
    expect(result.data[4].actual).toBe(300)
    // Day 10: cumulative = 350
    expect(result.data[9].actual).toBe(350)
    // Day 15: cumulative = 350 (no more txns)
    expect(result.data[14].actual).toBe(350)
    // Day 16: null (future)
    expect(result.data[15].actual).toBeNull()
    expect(result.currentTotal).toBe(350)
  })

  it('fills projection from today to end of month', () => {
    const txns = makeExpenses([
      { date: '2025-03-01', value: 100 },
      { date: '2025-03-10', value: 200 },
    ])
    const today = new Date(2025, 2, 10) // March 10
    const result = computeMonthlyPace(txns, today)

    // Projection starts at day 10
    expect(result.data[9].projected).not.toBeNull()
    // Day 31 should have projected value
    expect(result.data[30].projected).not.toBeNull()
    // Daily rate = 300 / 10 = 30
    expect(result.dailyRate).toBe(30)
    expect(result.projectedTotal).toBe(930) // 30 * 31
  })

  it('includes previous month comparison', () => {
    const txns = makeExpenses([
      { date: '2025-02-05', value: 100 },
      { date: '2025-02-15', value: 200 },
      { date: '2025-03-01', value: 50 },
    ])
    const today = new Date(2025, 2, 10)
    const result = computeMonthlyPace(txns, today)

    // Previous month (Feb) day 5: cumulative = 100
    expect(result.data[4].previousMonth).toBe(100)
    // Previous month day 15: cumulative = 300
    expect(result.data[14].previousMonth).toBe(300)
    // Previous month total
    expect(result.previousTotal).toBe(300)
  })
})
