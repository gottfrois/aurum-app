import { internalMutation } from './_generated/server'
import { getCategoryKey } from './lib/accountCategories'
import type { Id } from './_generated/dataModel'

export const backfillBalanceSnapshots = internalMutation({
  args: {},
  handler: async (ctx) => {
    const bankAccounts = await ctx.db.query('bankAccounts').collect()
    const now = new Date()
    const date = now.toISOString().slice(0, 10)
    const timestamp = now.getTime()

    const existingSnapshots = await Promise.all(
      bankAccounts.map((ba) =>
        ctx.db
          .query('balanceSnapshots')
          .withIndex('by_bankAccountId_date', (q) =>
            q.eq('bankAccountId', ba._id).eq('date', date),
          )
          .first(),
      ),
    )

    const toInsert = bankAccounts.filter((_, i) => !existingSnapshots[i])
    await Promise.all(
      toInsert.map((ba) =>
        ctx.db.insert('balanceSnapshots', {
          bankAccountId: ba._id,
          profileId: ba.profileId,
          balance: ba.balance,
          currency: ba.currency,
          date,
          timestamp,
          encrypted: false,
        }),
      ),
    )
    return { backfilled: toInsert.length }
  },
})

export const seedBalanceSnapshots = internalMutation({
  args: {},
  handler: async (ctx) => {
    const bankAccounts = await ctx.db.query('bankAccounts').collect()
    const now = new Date()
    const days = 90

    let count = 0
    for (const ba of bankAccounts) {
      for (let i = days; i >= 1; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        const date = d.toISOString().slice(0, 10)
        const timestamp = d.getTime()

        // Random walk: drift +-2% from current balance
        const variation = 1 + (Math.random() - 0.5) * 0.04 * (i / days)
        const balance = Math.round(ba.balance * variation * 100) / 100

        await ctx.db.insert('balanceSnapshots', {
          bankAccountId: ba._id,
          profileId: ba.profileId,
          balance,
          currency: ba.currency,
          date,
          timestamp,
          seed: true,
          encrypted: false,
        })
        count++
      }
    }
    return { seeded: count }
  },
})

export const backfillDailyNetWorth = internalMutation({
  args: {},
  handler: async (ctx) => {
    const [snapshots, profiles] = await Promise.all([
      ctx.db.query('balanceSnapshots').collect(),
      ctx.db.query('profiles').collect(),
    ])

    const profileWorkspaceMap = new Map<string, Id<'workspaces'>>(
      profiles.map((p) => [p._id, p.workspaceId]),
    )

    // Group by profileId + date, summing balances
    const aggregates = new Map<
      string,
      {
        profileId: Id<'profiles'>
        workspaceId: Id<'workspaces'>
        date: string
        timestamp: number
        balance: number
        currency: string
      }
    >()

    for (const s of snapshots) {
      const workspaceId = profileWorkspaceMap.get(s.profileId)
      if (!workspaceId) continue
      const key = `${s.profileId}:${s.date}`
      const existing = aggregates.get(key)
      if (existing) {
        existing.balance += s.balance
        if (s.timestamp > existing.timestamp) {
          existing.timestamp = s.timestamp
        }
      } else {
        aggregates.set(key, {
          profileId: s.profileId,
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
          .withIndex('by_profileId_date', (q) =>
            q.eq('profileId', agg.profileId).eq('date', agg.date),
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
          })
        } else {
          count++
          return ctx.db.insert('dailyNetWorth', {
            profileId: agg.profileId,
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
    const [snapshots, bankAccounts, profiles] = await Promise.all([
      ctx.db.query('balanceSnapshots').collect(),
      ctx.db.query('bankAccounts').collect(),
      ctx.db.query('profiles').collect(),
    ])

    const bankAccountMap = new Map(bankAccounts.map((ba) => [ba._id, ba]))
    const profileWorkspaceMap = new Map<string, Id<'workspaces'>>(
      profiles.map((p) => [p._id, p.workspaceId]),
    )

    // Group by profileId + category + date
    const aggregates = new Map<
      string,
      {
        profileId: Id<'profiles'>
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
      const workspaceId = profileWorkspaceMap.get(s.profileId)
      if (!workspaceId) continue
      const category = getCategoryKey(ba?.type)
      const key = `${s.profileId}:${category}:${s.date}`
      const existing = aggregates.get(key)
      if (existing) {
        existing.balance += s.balance
        if (s.timestamp > existing.timestamp) {
          existing.timestamp = s.timestamp
        }
      } else {
        aggregates.set(key, {
          profileId: s.profileId,
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
          .withIndex('by_profileId_category_date', (q) =>
            q
              .eq('profileId', agg.profileId)
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
            profileId: agg.profileId,
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
