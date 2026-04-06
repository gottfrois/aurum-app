import { v } from 'convex/values'
import { internal } from './_generated/api'
import { action, internalMutation } from './_generated/server'
import { requireAuthUserId } from './lib/auth'

export const deleteAccount = action({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx)

    // Delete all user data in Convex first
    await ctx.runMutation(internal.account.deleteAccountData, { userId })

    // Delete Clerk user last (so user can retry if Convex deletion fails)
    const clerkSecretKey = process.env.CLERK_SECRET_KEY
    if (clerkSecretKey) {
      const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${clerkSecretKey}` },
      })
      if (!res.ok && res.status !== 404) {
        throw new Error('Failed to delete Clerk user')
      }
    }
  },
})

export const deleteAccountData = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    // 1. Find all memberships
    const memberships = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()

    // 2. For each membership, delete portfolio data
    for (const member of memberships) {
      const portfolios = await ctx.db
        .query('portfolios')
        .withIndex('by_memberId', (q) => q.eq('memberId', member._id))
        .collect()

      for (const portfolio of portfolios) {
        const transactions = await ctx.db
          .query('transactions')
          .withIndex('by_portfolioId', (q) =>
            q.eq('portfolioId', portfolio._id),
          )
          .collect()
        for (const t of transactions) await ctx.db.delete('transactions', t._id)

        const investments = await ctx.db
          .query('investments')
          .withIndex('by_portfolioId', (q) =>
            q.eq('portfolioId', portfolio._id),
          )
          .collect()
        for (const i of investments) await ctx.db.delete('investments', i._id)

        const snapshots = await ctx.db
          .query('balanceSnapshots')
          .withIndex('by_portfolioId_timestamp', (q) =>
            q.eq('portfolioId', portfolio._id),
          )
          .collect()
        for (const s of snapshots)
          await ctx.db.delete('balanceSnapshots', s._id)

        const accounts = await ctx.db
          .query('bankAccounts')
          .withIndex('by_portfolioId', (q) =>
            q.eq('portfolioId', portfolio._id),
          )
          .collect()
        for (const a of accounts) await ctx.db.delete('bankAccounts', a._id)

        const connections = await ctx.db
          .query('connections')
          .withIndex('by_portfolioId', (q) =>
            q.eq('portfolioId', portfolio._id),
          )
          .collect()
        for (const c of connections) await ctx.db.delete('connections', c._id)

        await ctx.db.delete('portfolios', portfolio._id)
      }

      // 3. Delete per-membership data
      const keySlots = await ctx.db
        .query('workspaceKeySlots')
        .withIndex('by_workspaceId_userId', (q) =>
          q.eq('workspaceId', member.workspaceId).eq('userId', userId),
        )
        .collect()
      for (const k of keySlots) await ctx.db.delete('workspaceKeySlots', k._id)

      const favorites = await ctx.db
        .query('filterViewFavorites')
        .withIndex('by_workspaceId_userId', (q) =>
          q.eq('workspaceId', member.workspaceId).eq('userId', userId),
        )
        .collect()
      for (const f of favorites)
        await ctx.db.delete('filterViewFavorites', f._id)

      await ctx.db.delete('workspaceMembers', member._id)
    }

    // 4. Delete user-level data
    const encKeys = await ctx.db
      .query('encryptionKeys')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    for (const k of encKeys) await ctx.db.delete('encryptionKeys', k._id)

    const recoverySlots = await ctx.db
      .query('recoveryCodeSlots')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    for (const r of recoverySlots)
      await ctx.db.delete('recoveryCodeSlots', r._id)

    const consents = await ctx.db
      .query('userConsents')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    for (const c of consents) await ctx.db.delete('userConsents', c._id)

    const threads = await ctx.db
      .query('agentThreadMetadata')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    for (const t of threads) await ctx.db.delete('agentThreadMetadata', t._id)
  },
})
