import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  encryptionKeys: defineTable({
    userId: v.string(),
    publicKey: v.string(),
    encryptedPrivateKey: v.string(),
    pbkdf2Salt: v.string(),
    version: v.number(),
    createdAt: v.number(),
  }).index('by_userId', ['userId']),

  workspaceEncryption: defineTable({
    workspaceId: v.id('workspaces'),
    publicKey: v.string(),
    previousPublicKey: v.optional(v.string()),
    keyVersion: v.optional(v.number()),
    createdBy: v.string(),
    createdAt: v.number(),
  }).index('by_workspaceId', ['workspaceId']),

  workspaceKeySlots: defineTable({
    workspaceId: v.id('workspaces'),
    userId: v.string(),
    encryptedPrivateKey: v.string(),
    createdAt: v.number(),
  })
    .index('by_workspaceId_userId', ['workspaceId', 'userId'])
    .index('by_workspaceId', ['workspaceId']),

  workspaces: defineTable({
    name: v.string(),
    createdBy: v.string(),
    encryptionEnabled: v.optional(v.boolean()),
  }),

  workspaceMembers: defineTable({
    workspaceId: v.id('workspaces'),
    userId: v.string(),
    role: v.union(v.literal('owner'), v.literal('member')),
  })
    .index('by_userId', ['userId'])
    .index('by_workspaceId', ['workspaceId']),

  workspaceInvitations: defineTable({
    workspaceId: v.id('workspaces'),
    email: v.string(),
    invitedBy: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('accepted'),
      v.literal('revoked'),
    ),
  })
    .index('by_workspaceId', ['workspaceId'])
    .index('by_email', ['email']),

  profiles: defineTable({
    workspaceId: v.id('workspaces'),
    name: v.string(),
    icon: v.optional(v.string()),
    powensUserToken: v.optional(v.string()),
    powensUserId: v.optional(v.number()),
  })
    .index('by_workspaceId', ['workspaceId'])
    .index('by_powensUserId', ['powensUserId']),

  connections: defineTable({
    profileId: v.id('profiles'),
    powensConnectionId: v.number(),
    connectorName: v.string(),
    state: v.optional(v.string()),
    lastSync: v.optional(v.string()),
    encryptedData: v.optional(v.string()),
    encrypted: v.optional(v.boolean()),
  })
    .index('by_profileId', ['profileId'])
    .index('by_powensConnectionId', ['powensConnectionId'])
    .index('by_profileId_encrypted', ['profileId', 'encrypted']),

  bankAccounts: defineTable({
    connectionId: v.id('connections'),
    profileId: v.id('profiles'),
    powensBankAccountId: v.number(),
    name: v.string(),
    number: v.optional(v.string()),
    iban: v.optional(v.string()),
    type: v.optional(v.string()),
    balance: v.number(),
    currency: v.string(),
    disabled: v.boolean(),
    deleted: v.boolean(),
    lastSync: v.optional(v.string()),
    encryptedData: v.optional(v.string()),
    encrypted: v.optional(v.boolean()),
  })
    .index('by_connectionId', ['connectionId'])
    .index('by_profileId', ['profileId'])
    .index('by_profileId_encrypted', ['profileId', 'encrypted']),

  investments: defineTable({
    bankAccountId: v.id('bankAccounts'),
    profileId: v.id('profiles'),
    powensInvestmentId: v.number(),
    code: v.optional(v.string()),
    codeType: v.optional(v.string()),
    label: v.string(),
    description: v.optional(v.string()),
    quantity: v.number(),
    unitprice: v.number(),
    unitvalue: v.number(),
    valuation: v.number(),
    portfolioShare: v.optional(v.number()),
    diff: v.optional(v.number()),
    diffPercent: v.optional(v.number()),
    originalCurrency: v.optional(v.string()),
    originalValuation: v.optional(v.number()),
    vdate: v.optional(v.string()),
    deleted: v.boolean(),
    encryptedData: v.optional(v.string()),
    encrypted: v.optional(v.boolean()),
  })
    .index('by_bankAccountId', ['bankAccountId'])
    .index('by_profileId', ['profileId'])
    .index('by_powensInvestmentId', ['powensInvestmentId'])
    .index('by_profileId_encrypted', ['profileId', 'encrypted']),

  balanceSnapshots: defineTable({
    bankAccountId: v.id('bankAccounts'),
    profileId: v.id('profiles'),
    balance: v.number(),
    currency: v.string(),
    date: v.string(),
    timestamp: v.number(),
    seed: v.optional(v.boolean()),
    encryptedData: v.optional(v.string()),
    encrypted: v.optional(v.boolean()),
  })
    .index('by_bankAccountId_timestamp', ['bankAccountId', 'timestamp'])
    .index('by_bankAccountId_date', ['bankAccountId', 'date'])
    .index('by_profileId_timestamp', ['profileId', 'timestamp'])
    .index('by_profileId_encrypted', ['profileId', 'encrypted']),

  dailyNetWorth: defineTable({
    profileId: v.id('profiles'),
    workspaceId: v.id('workspaces'),
    date: v.string(),
    timestamp: v.number(),
    balance: v.number(),
    currency: v.string(),
  })
    .index('by_profileId_timestamp', ['profileId', 'timestamp'])
    .index('by_profileId_date', ['profileId', 'date'])
    .index('by_workspaceId_timestamp', ['workspaceId', 'timestamp']),

  dailyCategoryBalance: defineTable({
    profileId: v.id('profiles'),
    workspaceId: v.id('workspaces'),
    category: v.string(),
    date: v.string(),
    timestamp: v.number(),
    balance: v.number(),
    currency: v.string(),
  })
    .index('by_profileId_category_date', ['profileId', 'category', 'date'])
    .index('by_profileId_timestamp', ['profileId', 'timestamp'])
    .index('by_workspaceId_timestamp', ['workspaceId', 'timestamp']),
})
