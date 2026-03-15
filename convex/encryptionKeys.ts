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

// Member sets up their personal RSA keypair
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

// Owner disables workspace encryption — removes workspace encryption + all key slots + all personal keys
export const disableWorkspaceEncryption = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx)

    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!membership || membership.role !== 'owner') {
      throw new Error('Only workspace owners can disable encryption')
    }

    // Delete workspace encryption record
    const wsEnc = await ctx.db
      .query('workspaceEncryption')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .first()
    if (wsEnc) await ctx.db.delete('workspaceEncryption', wsEnc._id)

    // Delete all key slots
    const slots = await ctx.db
      .query('workspaceKeySlots')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .collect()
    for (const slot of slots) {
      await ctx.db.delete('workspaceKeySlots', slot._id)
    }

    // Delete all personal keys for workspace members
    const members = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .collect()
    for (const m of members) {
      const key = await ctx.db
        .query('encryptionKeys')
        .withIndex('by_userId', (q) => q.eq('userId', m.userId))
        .first()
      if (key) await ctx.db.delete('encryptionKeys', key._id)
    }

    // Mark workspace as encryption-disabled
    await ctx.db.patch('workspaces', membership.workspaceId, {
      encryptionEnabled: false,
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

export const migrateConnection = mutation({
  args: {
    connectionId: v.id('connections'),
    encryptedData: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    await ctx.db.patch('connections', args.connectionId, {
      encryptedData: args.encryptedData,
      connectorName: 'Encrypted',
      encrypted: true,
    })
  },
})

export const decryptConnection = mutation({
  args: {
    connectionId: v.id('connections'),
    connectorName: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    await ctx.db.patch('connections', args.connectionId, {
      connectorName: args.connectorName,
      encryptedData: undefined,
      encrypted: false,
    })
  },
})

// Migration mutations
export const migrateBankAccount = mutation({
  args: {
    bankAccountId: v.id('bankAccounts'),
    encryptedData: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    await ctx.db.patch('bankAccounts', args.bankAccountId, {
      encryptedData: args.encryptedData,
      name: 'Encrypted',
      balance: 0,
      number: undefined,
      iban: undefined,
      encrypted: true,
    })
  },
})

export const migrateBalanceSnapshot = mutation({
  args: {
    snapshotId: v.id('balanceSnapshots'),
    encryptedData: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    await ctx.db.patch('balanceSnapshots', args.snapshotId, {
      encryptedData: args.encryptedData,
      balance: 0,
      encrypted: true,
    })
  },
})

export const migrateBalanceSnapshotBatch = mutation({
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
        balance: 0,
        encrypted: true,
      })
    }
  },
})

export const migrateInvestment = mutation({
  args: {
    investmentId: v.id('investments'),
    encryptedData: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    await ctx.db.patch('investments', args.investmentId, {
      encryptedData: args.encryptedData,
      code: undefined,
      label: 'Encrypted',
      description: undefined,
      quantity: 0,
      unitprice: 0,
      unitvalue: 0,
      valuation: 0,
      portfolioShare: undefined,
      diff: undefined,
      diffPercent: undefined,
      encrypted: true,
    })
  },
})

export const migrateInvestmentBatch = mutation({
  args: {
    items: v.array(
      v.object({
        investmentId: v.id('investments'),
        encryptedData: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    for (const item of args.items) {
      await ctx.db.patch('investments', item.investmentId, {
        encryptedData: item.encryptedData,
        code: undefined,
        label: 'Encrypted',
        description: undefined,
        quantity: 0,
        unitprice: 0,
        unitvalue: 0,
        valuation: 0,
        portfolioShare: undefined,
        diff: undefined,
        diffPercent: undefined,
        encrypted: true,
      })
    }
  },
})

export const decryptBankAccount = mutation({
  args: {
    bankAccountId: v.id('bankAccounts'),
    name: v.string(),
    balance: v.number(),
    number: v.optional(v.string()),
    iban: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    await ctx.db.patch('bankAccounts', args.bankAccountId, {
      name: args.name,
      balance: args.balance,
      number: args.number,
      iban: args.iban,
      encryptedData: undefined,
      encrypted: false,
    })
  },
})

export const decryptBalanceSnapshot = mutation({
  args: {
    snapshotId: v.id('balanceSnapshots'),
    balance: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    await ctx.db.patch('balanceSnapshots', args.snapshotId, {
      balance: args.balance,
      encryptedData: undefined,
      encrypted: false,
    })
  },
})

export const decryptBalanceSnapshotBatch = mutation({
  args: {
    items: v.array(
      v.object({
        snapshotId: v.id('balanceSnapshots'),
        balance: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    for (const item of args.items) {
      await ctx.db.patch('balanceSnapshots', item.snapshotId, {
        balance: item.balance,
        encryptedData: undefined,
        encrypted: false,
      })
    }
  },
})

export const decryptInvestment = mutation({
  args: {
    investmentId: v.id('investments'),
    code: v.optional(v.string()),
    label: v.string(),
    description: v.optional(v.string()),
    quantity: v.number(),
    unitprice: v.number(),
    unitvalue: v.number(),
    valuation: v.number(),
    portfolioShare: v.optional(v.number()),
    diff: v.optional(v.number()),
    diffPercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    const { investmentId, ...fields } = args
    await ctx.db.patch('investments', investmentId, {
      ...fields,
      encryptedData: undefined,
      encrypted: false,
    })
  },
})

export const migrateTransactionBatch = mutation({
  args: {
    items: v.array(
      v.object({
        transactionId: v.id('transactions'),
        encryptedData: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    for (const item of args.items) {
      await ctx.db.patch('transactions', item.transactionId, {
        encryptedData: item.encryptedData,
        wording: 'Encrypted',
        originalWording: undefined,
        simplifiedWording: undefined,
        value: 0,
        originalValue: undefined,
        counterparty: undefined,
        card: undefined,
        comment: undefined,
        category: undefined,
        categoryParent: undefined,
        userCategoryKey: undefined,
        encrypted: true,
      })
    }
  },
})

export const decryptTransactionBatch = mutation({
  args: {
    items: v.array(
      v.object({
        transactionId: v.id('transactions'),
        wording: v.string(),
        originalWording: v.optional(v.string()),
        simplifiedWording: v.optional(v.string()),
        value: v.number(),
        originalValue: v.optional(v.number()),
        counterparty: v.optional(v.string()),
        card: v.optional(v.string()),
        comment: v.optional(v.string()),
        category: v.optional(v.string()),
        categoryParent: v.optional(v.string()),
        userCategoryKey: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    for (const item of args.items) {
      const { transactionId, ...fields } = item
      await ctx.db.patch('transactions', transactionId, {
        ...fields,
        encryptedData: undefined,
        encrypted: false,
      })
    }
  },
})

export const decryptInvestmentBatch = mutation({
  args: {
    items: v.array(
      v.object({
        investmentId: v.id('investments'),
        code: v.optional(v.string()),
        label: v.string(),
        description: v.optional(v.string()),
        quantity: v.number(),
        unitprice: v.number(),
        unitvalue: v.number(),
        valuation: v.number(),
        portfolioShare: v.optional(v.number()),
        diff: v.optional(v.number()),
        diffPercent: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    for (const item of args.items) {
      const { investmentId, ...fields } = item
      await ctx.db.patch('investments', investmentId, {
        ...fields,
        encryptedData: undefined,
        encrypted: false,
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

// Patch encrypted data on records after server-side creates them (for AAD support)
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
        encrypted: true,
      })
    }
  },
})

export const patchBankAccountEncryptedData = internalMutation({
  args: {
    items: v.array(
      v.object({
        id: v.id('bankAccounts'),
        encryptedData: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      await ctx.db.patch('bankAccounts', item.id, {
        encryptedData: item.encryptedData,
        encrypted: true,
      })
    }
  },
})

export const patchInvestmentEncryptedData = internalMutation({
  args: {
    items: v.array(
      v.object({
        id: v.id('investments'),
        encryptedData: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      await ctx.db.patch('investments', item.id, {
        encryptedData: item.encryptedData,
        encrypted: true,
      })
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
        encrypted: true,
      })
    }
  },
})
