import { v } from 'convex/values'
import { mutation, query, internalQuery } from './_generated/server'
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
    if (wsEnc) await ctx.db.delete(wsEnc._id)

    // Delete all key slots
    const slots = await ctx.db
      .query('workspaceKeySlots')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .collect()
    for (const slot of slots) {
      await ctx.db.delete(slot._id)
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
      if (key) await ctx.db.delete(key._id)
    }
  },
})

// Get workspace public key via profile → workspace → workspaceEncryption
export const getPublicKeyForProfile = internalQuery({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId)
    if (!profile) return null
    const wsEnc = await ctx.db
      .query('workspaceEncryption')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', profile.workspaceId),
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
    await ctx.db.patch(args.connectionId, {
      encryptedData: args.encryptedData,
      connectorName: 'Encrypted',
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
    await ctx.db.patch(args.connectionId, {
      connectorName: args.connectorName,
      encryptedData: undefined,
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
    await ctx.db.patch(args.bankAccountId, {
      encryptedData: args.encryptedData,
      name: 'Encrypted',
      balance: 0,
      number: undefined,
      iban: undefined,
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
    await ctx.db.patch(args.snapshotId, {
      encryptedData: args.encryptedData,
      balance: 0,
    })
  },
})

export const migrateInvestment = mutation({
  args: {
    investmentId: v.id('investments'),
    encryptedData: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    await ctx.db.patch(args.investmentId, {
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
    })
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
    await ctx.db.patch(args.bankAccountId, {
      name: args.name,
      balance: args.balance,
      number: args.number,
      iban: args.iban,
      encryptedData: undefined,
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
    await ctx.db.patch(args.snapshotId, {
      balance: args.balance,
      encryptedData: undefined,
    })
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
    await ctx.db.patch(investmentId, {
      ...fields,
      encryptedData: undefined,
    })
  },
})
