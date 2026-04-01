import { v } from 'convex/values'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { getAuthUserId, requireAuthUserId } from './lib/auth'

// Returns workspace encryption status + current user's key slot
export const getWorkspaceEncryption = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!membership) return null

    const wsEnc = await ctx.db
      .query('workspaceEncryption')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .first()

    const workspace = await ctx.db.get('workspaces', membership.workspaceId)

    // When encryption is not enabled, still return role so the UI knows
    // whether the user can enable it
    if (!wsEnc) {
      return {
        workspaceId: membership.workspaceId,
        workspacePublicKey: null,
        hasPersonalKey: false,
        personalKey: null,
        hasKeySlot: false,
        keySlot: null,
        role: membership.role,
        enabled: false as const,
        workspacePolicies: workspace?.policies ?? null,
      }
    }

    const personalKey = await ctx.db
      .query('encryptionKeys')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    const keySlot = await ctx.db
      .query('workspaceKeySlots')
      .withIndex('by_workspaceId_userId', (q) =>
        q.eq('workspaceId', membership.workspaceId).eq('userId', userId),
      )
      .first()

    return {
      workspaceId: membership.workspaceId,
      workspacePublicKey: wsEnc.publicKey,
      hasPersonalKey: personalKey !== null,
      personalKey: personalKey
        ? {
            encryptedPrivateKey: personalKey.encryptedPrivateKey,
            pbkdf2Salt: personalKey.pbkdf2Salt,
          }
        : null,
      hasKeySlot: keySlot !== null,
      keySlot: keySlot
        ? { encryptedPrivateKey: keySlot.encryptedPrivateKey }
        : null,
      role: membership.role,
      enabled: true as const,
      workspacePolicies: workspace?.policies ?? null,
    }
  },
})

// List all workspace members with their encryption status (for settings page)
export const listMembersEncryptionStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!membership) return null

    const members = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .collect()

    const result = await Promise.all(
      members.map(async (m) => {
        const personalKey = await ctx.db
          .query('encryptionKeys')
          .withIndex('by_userId', (q) => q.eq('userId', m.userId))
          .first()

        const keySlot = await ctx.db
          .query('workspaceKeySlots')
          .withIndex('by_workspaceId_userId', (q) =>
            q.eq('workspaceId', membership.workspaceId).eq('userId', m.userId),
          )
          .first()

        return {
          userId: m.userId,
          role: m.role,
          hasPersonalKey: personalKey !== null,
          publicKey: personalKey?.publicKey ?? null,
          hasKeySlot: keySlot !== null,
        }
      }),
    )

    return result
  },
})

// Owner enables workspace encryption: creates personal key + workspace keypair + own key slot
export const enableWorkspaceEncryption = mutation({
  args: {
    personalPublicKey: v.string(),
    personalEncryptedPrivateKey: v.string(),
    personalPbkdf2Salt: v.string(),
    workspacePublicKey: v.string(),
    ownerKeySlotEncryptedPrivateKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!membership || membership.role !== 'owner') {
      throw new Error('Only workspace owners can enable encryption')
    }

    const existing = await ctx.db
      .query('workspaceEncryption')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .first()
    if (existing) {
      throw new Error('Workspace encryption is already enabled')
    }

    // Store personal keypair
    await ctx.db.insert('encryptionKeys', {
      userId,
      publicKey: args.personalPublicKey,
      encryptedPrivateKey: args.personalEncryptedPrivateKey,
      pbkdf2Salt: args.personalPbkdf2Salt,
      version: 1,
      createdAt: Date.now(),
    })

    // Store workspace public key
    await ctx.db.insert('workspaceEncryption', {
      workspaceId: membership.workspaceId,
      publicKey: args.workspacePublicKey,
      createdBy: userId,
      createdAt: Date.now(),
    })

    // Mark workspace as encryption-enabled
    const workspace = await ctx.db.get('workspaces', membership.workspaceId)
    if (!workspace) {
      throw new Error('Workspace not found')
    }
    await ctx.db.patch('workspaces', membership.workspaceId, {
      encryptionEnabled: true,
    })

    // Store owner's key slot (workspace private key encrypted with owner's personal public key)
    await ctx.db.insert('workspaceKeySlots', {
      workspaceId: membership.workspaceId,
      userId,
      encryptedPrivateKey: args.ownerKeySlotEncryptedPrivateKey,
      createdAt: Date.now(),
    })
  },
})

// Member sets up their personal X25519 keypair
export const setupMemberEncryption = mutation({
  args: {
    publicKey: v.string(),
    encryptedPrivateKey: v.string(),
    pbkdf2Salt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const existing = await ctx.db
      .query('encryptionKeys')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (existing) {
      throw new Error('Personal encryption key already exists')
    }

    await ctx.db.insert('encryptionKeys', {
      userId,
      publicKey: args.publicKey,
      encryptedPrivateKey: args.encryptedPrivateKey,
      pbkdf2Salt: args.pbkdf2Salt,
      version: 1,
      createdAt: Date.now(),
    })
  },
})

// Grant a member access by storing a key slot for them
export const grantMemberAccess = mutation({
  args: {
    targetUserId: v.string(),
    encryptedPrivateKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!membership) throw new Error('Not a workspace member')

    // Verify target is also a member of the same workspace
    const targetMembership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .filter((q) => q.eq(q.field('userId'), args.targetUserId))
      .first()
    if (!targetMembership) throw new Error('Target is not a workspace member')

    // Check they don't already have a slot
    const existingSlot = await ctx.db
      .query('workspaceKeySlots')
      .withIndex('by_workspaceId_userId', (q) =>
        q
          .eq('workspaceId', membership.workspaceId)
          .eq('userId', args.targetUserId),
      )
      .first()
    if (existingSlot) throw new Error('Member already has access')

    await ctx.db.insert('workspaceKeySlots', {
      workspaceId: membership.workspaceId,
      userId: args.targetUserId,
      encryptedPrivateKey: args.encryptedPrivateKey,
      createdAt: Date.now(),
    })
  },
})

// Get workspace public key via portfolio → workspace → workspaceEncryption
export const getPublicKeyForPortfolio = internalQuery({
  args: { portfolioId: v.id('portfolios') },
  handler: async (ctx, args) => {
    const portfolio = await ctx.db.get('portfolios', args.portfolioId)
    if (!portfolio) return null
    const wsEnc = await ctx.db
      .query('workspaceEncryption')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', portfolio.workspaceId),
      )
      .first()
    return wsEnc?.publicKey ?? null
  },
})

// --- Re-encryption mutations for key rotation ---

export const reEncryptConnection = mutation({
  args: {
    connectionId: v.id('connections'),
    encryptedData: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    await ctx.db.patch('connections', args.connectionId, {
      encryptedData: args.encryptedData,
    })
  },
})

export const reEncryptBankAccount = mutation({
  args: {
    bankAccountId: v.id('bankAccounts'),
    encryptedIdentity: v.string(),
    encryptedBalance: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    await ctx.db.patch('bankAccounts', args.bankAccountId, {
      encryptedIdentity: args.encryptedIdentity,
      encryptedBalance: args.encryptedBalance,
    })
  },
})

export const reEncryptBalanceSnapshotBatch = mutation({
  args: {
    items: v.array(
      v.object({
        snapshotId: v.id('balanceSnapshots'),
        encryptedData: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    for (const item of args.items) {
      await ctx.db.patch('balanceSnapshots', item.snapshotId, {
        encryptedData: item.encryptedData,
      })
    }
  },
})

export const reEncryptInvestmentBatch = mutation({
  args: {
    items: v.array(
      v.object({
        investmentId: v.id('investments'),
        encryptedIdentity: v.string(),
        encryptedValuation: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    for (const item of args.items) {
      await ctx.db.patch('investments', item.investmentId, {
        encryptedIdentity: item.encryptedIdentity,
        encryptedValuation: item.encryptedValuation,
      })
    }
  },
})

export const reEncryptTransactionBatch = mutation({
  args: {
    items: v.array(
      v.object({
        transactionId: v.id('transactions'),
        encryptedDetails: v.string(),
        encryptedFinancials: v.string(),
        encryptedCategories: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    for (const item of args.items) {
      await ctx.db.patch('transactions', item.transactionId, {
        encryptedDetails: item.encryptedDetails,
        encryptedFinancials: item.encryptedFinancials,
        encryptedCategories: item.encryptedCategories,
      })
    }
  },
})

// Key rotation: owner generates new workspace keypair, re-encrypts all data
export const rotateWorkspaceKey = mutation({
  args: {
    newWorkspacePublicKey: v.string(),
    ownerKeySlotEncryptedPrivateKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!membership || membership.role !== 'owner') {
      throw new Error('Only workspace owners can rotate keys')
    }

    const wsEnc = await ctx.db
      .query('workspaceEncryption')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .first()
    if (!wsEnc) {
      throw new Error('Workspace encryption is not enabled')
    }

    // Store previous public key for backward compatibility during re-encryption
    const currentVersion = wsEnc.keyVersion ?? 1
    await ctx.db.patch('workspaceEncryption', wsEnc._id, {
      previousPublicKey: wsEnc.publicKey,
      publicKey: args.newWorkspacePublicKey,
      keyVersion: currentVersion + 1,
    })

    // Delete all existing key slots (members need to be re-granted)
    const slots = await ctx.db
      .query('workspaceKeySlots')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .collect()
    for (const slot of slots) {
      await ctx.db.delete('workspaceKeySlots', slot._id)
    }

    // Create new owner key slot
    await ctx.db.insert('workspaceKeySlots', {
      workspaceId: membership.workspaceId,
      userId,
      encryptedPrivateKey: args.ownerKeySlotEncryptedPrivateKey,
      createdAt: Date.now(),
    })
  },
})

// Called after all records have been re-encrypted with the new key
export const completeKeyRotation = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx)

    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!membership || membership.role !== 'owner') {
      throw new Error('Only workspace owners can complete key rotation')
    }

    const wsEnc = await ctx.db
      .query('workspaceEncryption')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .first()
    if (!wsEnc) {
      throw new Error('Workspace encryption is not enabled')
    }

    await ctx.db.patch('workspaceEncryption', wsEnc._id, {
      previousPublicKey: undefined,
    })
  },
})

// --- Patch mutations for server-side encryption (called after record creation) ---

export const patchConnectionEncryptedData = internalMutation({
  args: {
    items: v.array(
      v.object({
        id: v.id('connections'),
        encryptedData: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      await ctx.db.patch('connections', item.id, {
        encryptedData: item.encryptedData,
      })
    }
  },
})

export const patchBankAccountFieldGroups = internalMutation({
  args: {
    items: v.array(
      v.object({
        id: v.id('bankAccounts'),
        encryptedIdentity: v.string(),
        encryptedBalance: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      await ctx.db.patch('bankAccounts', item.id, {
        encryptedIdentity: item.encryptedIdentity,
        encryptedBalance: item.encryptedBalance,
      })
    }
  },
})

export const patchInvestmentFieldGroups = internalMutation({
  args: {
    items: v.array(
      v.object({
        id: v.id('investments'),
        encryptedIdentity: v.string(),
        encryptedValuation: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      await ctx.db.patch('investments', item.id, {
        encryptedIdentity: item.encryptedIdentity,
        encryptedValuation: item.encryptedValuation,
      })
    }
  },
})

export const patchTransactionFieldGroups = internalMutation({
  args: {
    items: v.array(
      v.object({
        id: v.id('transactions'),
        encryptedDetails: v.optional(v.string()),
        encryptedFinancials: v.string(),
        encryptedCategories: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      const patch: Record<string, string> = {
        encryptedFinancials: item.encryptedFinancials,
      }
      if (item.encryptedDetails !== undefined) {
        patch.encryptedDetails = item.encryptedDetails
      }
      if (item.encryptedCategories !== undefined) {
        patch.encryptedCategories = item.encryptedCategories
      }
      await ctx.db.patch('transactions', item.id, patch)
    }
  },
})

export const patchBalanceSnapshotEncryptedData = internalMutation({
  args: {
    items: v.array(
      v.object({
        id: v.id('balanceSnapshots'),
        encryptedData: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      await ctx.db.patch('balanceSnapshots', item.id, {
        encryptedData: item.encryptedData,
      })
    }
  },
})
