import type { Id } from './_generated/dataModel'
import { internalMutation } from './_generated/server'
import { getCategoryKey } from './lib/accountCategories'

export const backfillBalanceSnapshots = internalMutation({
  args: {},
  handler: async (_ctx) => {
    // Balance is now encrypted on bankAccounts — backfill from plaintext is no longer possible.
    // Balance snapshots must be created during sync with encrypted data.
    return { backfilled: 0 }
  },
})

export const seedBalanceSnapshots = internalMutation({
  args: {},
  handler: async (_ctx) => {
    // Balance is now encrypted on bankAccounts — seeding from plaintext is no longer possible.
    // Seed data is not compatible with mandatory encryption.
    return { seeded: 0 }
  },
})

export const backfillDailyNetWorth = internalMutation({
  args: {},
  handler: async (ctx) => {
    const [snapshots, portfolios] = await Promise.all([
      ctx.db.query('balanceSnapshots').collect(),
      ctx.db.query('portfolios').collect(),
    ])

    const portfolioWorkspaceMap = new Map<string, Id<'workspaces'>>(
      portfolios.map((p) => [p._id, p.workspaceId]),
    )

    // Group by portfolioId + date, summing balances
    const aggregates = new Map<
      string,
      {
        portfolioId: Id<'portfolios'>
        workspaceId: Id<'workspaces'>
        date: string
        timestamp: number
        balance: number
        currency: string
      }
    >()

    for (const s of snapshots) {
      const workspaceId = portfolioWorkspaceMap.get(s.portfolioId)
      if (!workspaceId) continue
      const key = `${s.portfolioId}:${s.date}`
      const existing = aggregates.get(key)
      if (existing) {
        existing.balance += s.balance
        if (s.timestamp > existing.timestamp) {
          existing.timestamp = s.timestamp
        }
      } else {
        aggregates.set(key, {
          portfolioId: s.portfolioId,
          workspaceId,
          date: s.date,
          timestamp: s.timestamp,
          balance: s.balance,
          currency: s.currency,
        })
      }
    }

    const aggValues = [...aggregates.values()]

    const existingEntries = await Promise.all(
      aggValues.map((agg) =>
        ctx.db
          .query('dailyNetWorth')
          .withIndex('by_portfolioId_date', (q) =>
            q.eq('portfolioId', agg.portfolioId).eq('date', agg.date),
          )
          .first(),
      ),
    )

    let count = 0
    await Promise.all(
      aggValues.map((agg, i) => {
        const existing = existingEntries[i]
        if (existing) {
          return ctx.db.patch('dailyNetWorth', existing._id, {
            balance: Math.round(agg.balance * 100) / 100,
            workspaceId: agg.workspaceId,
          })
        } else {
          count++
          return ctx.db.insert('dailyNetWorth', {
            portfolioId: agg.portfolioId,
            workspaceId: agg.workspaceId,
            date: agg.date,
            timestamp: agg.timestamp,
            balance: Math.round(agg.balance * 100) / 100,
            currency: agg.currency,
          })
        }
      }),
    )
    return { backfilled: count }
  },
})

export const backfillDailyCategoryBalance = internalMutation({
  args: {},
  handler: async (ctx) => {
    const [snapshots, bankAccounts, portfolios] = await Promise.all([
      ctx.db.query('balanceSnapshots').collect(),
      ctx.db.query('bankAccounts').collect(),
      ctx.db.query('portfolios').collect(),
    ])

    const bankAccountMap = new Map(bankAccounts.map((ba) => [ba._id, ba]))
    const portfolioWorkspaceMap = new Map<string, Id<'workspaces'>>(
      portfolios.map((p) => [p._id, p.workspaceId]),
    )

    // Group by portfolioId + category + date
    const aggregates = new Map<
      string,
      {
        portfolioId: Id<'portfolios'>
        workspaceId: Id<'workspaces'>
        category: string
        date: string
        timestamp: number
        balance: number
        currency: string
      }
    >()

    for (const s of snapshots) {
      const ba = bankAccountMap.get(s.bankAccountId)
      const workspaceId = portfolioWorkspaceMap.get(s.portfolioId)
      if (!workspaceId) continue
      const category = getCategoryKey(ba?.type)
      const key = `${s.portfolioId}:${category}:${s.date}`
      const existing = aggregates.get(key)
      if (existing) {
        existing.balance += s.balance
        if (s.timestamp > existing.timestamp) {
          existing.timestamp = s.timestamp
        }
      } else {
        aggregates.set(key, {
          portfolioId: s.portfolioId,
          workspaceId,
          category,
          date: s.date,
          timestamp: s.timestamp,
          balance: s.balance,
          currency: s.currency,
        })
      }
    }

    const aggValues = [...aggregates.values()]

    const existingEntries = await Promise.all(
      aggValues.map((agg) =>
        ctx.db
          .query('dailyCategoryBalance')
          .withIndex('by_portfolioId_category_date', (q) =>
            q
              .eq('portfolioId', agg.portfolioId)
              .eq('category', agg.category)
              .eq('date', agg.date),
          )
          .first(),
      ),
    )

    let count = 0
    await Promise.all(
      aggValues.map((agg, i) => {
        const existing = existingEntries[i]
        if (existing) {
          return ctx.db.patch('dailyCategoryBalance', existing._id, {
            balance: Math.round(agg.balance * 100) / 100,
          })
        } else {
          count++
          return ctx.db.insert('dailyCategoryBalance', {
            portfolioId: agg.portfolioId,
            workspaceId: agg.workspaceId,
            category: agg.category,
            date: agg.date,
            timestamp: agg.timestamp,
            balance: Math.round(agg.balance * 100) / 100,
            currency: agg.currency,
          })
        }
      }),
    )
    return { backfilled: count }
  },
})

export const deleteSeedSnapshots = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query('balanceSnapshots').collect()
    const toDelete = all.filter((snap) => snap.seed)
    await Promise.all(
      toDelete.map((snap) => ctx.db.delete('balanceSnapshots', snap._id)),
    )
    return { deleted: toDelete.length }
  },
})
