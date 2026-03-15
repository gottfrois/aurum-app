import { v } from 'convex/values'
import { internalMutation } from './_generated/server'

export const seedDemoData = internalMutation({
  args: { userId: v.string() },
  handler: async (_ctx, { userId: _userId }) => {
    // Seed data is not compatible with mandatory encryption.
    // All sensitive fields (connectorName, name, balance, code, label, wording, value, etc.)
    // are now stored only in encrypted blobs, which require encryption keys to create.
    // Demo data seeding would need to be reimplemented client-side with access to encryption keys.
    return {
      success: false,
      message: 'Seed data not available — encryption is mandatory',
    }
  },
})

export const clearDemoData = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!membership) throw new Error('No workspace found')

    const portfolio = await ctx.db
      .query('portfolios')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .first()
    if (!portfolio) throw new Error('No portfolio found')

    // Delete all seeded snapshots and aggregate entries for this portfolio
    const [snapshots, dailyNetWorthEntries, dailyCategoryEntries] =
      await Promise.all([
        ctx.db
          .query('balanceSnapshots')
          .withIndex('by_portfolioId_timestamp', (q) =>
            q.eq('portfolioId', portfolio._id),
          )
          .collect(),
        ctx.db
          .query('dailyNetWorth')
          .withIndex('by_portfolioId_timestamp', (q) =>
            q.eq('portfolioId', portfolio._id),
          )
          .collect(),
        ctx.db
          .query('dailyCategoryBalance')
          .withIndex('by_portfolioId_timestamp', (q) =>
            q.eq('portfolioId', portfolio._id),
          )
          .collect(),
      ])
    await Promise.all([
      ...snapshots
        .filter((s) => s.seed)
        .map((s) => ctx.db.delete('balanceSnapshots', s._id)),
      ...dailyNetWorthEntries.map((d) => ctx.db.delete('dailyNetWorth', d._id)),
      ...dailyCategoryEntries.map((d) =>
        ctx.db.delete('dailyCategoryBalance', d._id),
      ),
    ])

    // Delete all transactions for this portfolio
    const transactions = await ctx.db
      .query('transactions')
      .withIndex('by_portfolioId', (q) => q.eq('portfolioId', portfolio._id))
      .collect()
    for (const txn of transactions) {
      await ctx.db.delete('transactions', txn._id)
    }

    // Delete all investments for this portfolio
    const investments = await ctx.db
      .query('investments')
      .withIndex('by_portfolioId', (q) => q.eq('portfolioId', portfolio._id))
      .collect()
    for (const inv of investments) {
      await ctx.db.delete('investments', inv._id)
    }

    // Delete all bank accounts for this portfolio
    const bankAccounts = await ctx.db
      .query('bankAccounts')
      .withIndex('by_portfolioId', (q) => q.eq('portfolioId', portfolio._id))
      .collect()
    for (const ba of bankAccounts) {
      await ctx.db.delete('bankAccounts', ba._id)
    }

    // Delete all connections for this portfolio
    const connections = await ctx.db
      .query('connections')
      .withIndex('by_portfolioId', (q) => q.eq('portfolioId', portfolio._id))
      .collect()
    for (const conn of connections) {
      await ctx.db.delete('connections', conn._id)
    }

    return { success: true, message: 'Demo data cleared' }
  },
})
