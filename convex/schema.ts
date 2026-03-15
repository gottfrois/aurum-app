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
    onboardingStep: v.optional(v.string()),
  })
    .index('by_userId', ['userId'])
    .index('by_workspaceId', ['workspaceId']),

  userConsents: defineTable({
    userId: v.string(),
    termsOfService: v.boolean(),
    termsOfServiceAt: v.number(),
    privacyPolicy: v.boolean(),
    privacyPolicyAt: v.number(),
    marketingCommunications: v.boolean(),
    marketingCommunicationsAt: v.number(),
  }).index('by_userId', ['userId']),

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

  portfolios: defineTable({
    workspaceId: v.id('workspaces'),
    memberId: v.id('workspaceMembers'),
    name: v.string(),
    icon: v.optional(v.string()),
    powensUserToken: v.optional(v.string()),
    powensUserId: v.optional(v.number()),
  })
    .index('by_workspaceId', ['workspaceId'])
    .index('by_memberId', ['memberId'])
    .index('by_powensUserId', ['powensUserId']),

  connections: defineTable({
    portfolioId: v.id('portfolios'),
    powensConnectionId: v.number(),
    state: v.optional(v.string()),
    lastSync: v.optional(v.string()),
    encryptedData: v.string(),
  })
    .index('by_portfolioId', ['portfolioId'])
    .index('by_powensConnectionId', ['powensConnectionId']),

  bankAccounts: defineTable({
    connectionId: v.id('connections'),
    portfolioId: v.id('portfolios'),
    powensBankAccountId: v.number(),
    type: v.optional(v.string()),
    currency: v.string(),
    disabled: v.boolean(),
    deleted: v.boolean(),
    lastSync: v.optional(v.string()),
    encryptedIdentity: v.string(),
    encryptedBalance: v.string(),
  })
    .index('by_connectionId', ['connectionId'])
    .index('by_portfolioId', ['portfolioId']),

  investments: defineTable({
    bankAccountId: v.id('bankAccounts'),
    portfolioId: v.id('portfolios'),
    powensInvestmentId: v.number(),
    codeType: v.optional(v.string()),
    originalCurrency: v.optional(v.string()),
    originalValuation: v.optional(v.number()),
    vdate: v.optional(v.string()),
    deleted: v.boolean(),
    encryptedIdentity: v.string(),
    encryptedValuation: v.string(),
  })
    .index('by_bankAccountId', ['bankAccountId'])
    .index('by_portfolioId', ['portfolioId'])
    .index('by_powensInvestmentId', ['powensInvestmentId']),

  balanceSnapshots: defineTable({
    bankAccountId: v.id('bankAccounts'),
    portfolioId: v.id('portfolios'),
    balance: v.number(), // plaintext for daily aggregate delta computation (dailyNetWorth, dailyCategoryBalance)
    currency: v.string(),
    date: v.string(),
    timestamp: v.number(),
    seed: v.optional(v.boolean()),
    encryptedData: v.string(),
  })
    .index('by_bankAccountId_timestamp', ['bankAccountId', 'timestamp'])
    .index('by_bankAccountId_date', ['bankAccountId', 'date'])
    .index('by_portfolioId_timestamp', ['portfolioId', 'timestamp']),

  dailyNetWorth: defineTable({
    portfolioId: v.id('portfolios'),
    workspaceId: v.id('workspaces'),
    date: v.string(),
    timestamp: v.number(),
    balance: v.number(),
    currency: v.string(),
  })
    .index('by_portfolioId_timestamp', ['portfolioId', 'timestamp'])
    .index('by_portfolioId_date', ['portfolioId', 'date'])
    .index('by_workspaceId_timestamp', ['workspaceId', 'timestamp']),

  transactions: defineTable({
    bankAccountId: v.id('bankAccounts'),
    portfolioId: v.id('portfolios'),
    powensTransactionId: v.number(),
    date: v.string(),
    rdate: v.optional(v.string()),
    vdate: v.optional(v.string()),
    originalCurrency: v.optional(v.string()),
    type: v.optional(v.string()),
    coming: v.boolean(),
    active: v.boolean(),
    deleted: v.boolean(),
    labelIds: v.optional(v.array(v.id('labels'))),
    encryptedDetails: v.string(),
    encryptedFinancials: v.string(),
    encryptedCategories: v.string(),
  })
    .index('by_bankAccountId', ['bankAccountId'])
    .index('by_portfolioId', ['portfolioId'])
    .index('by_portfolioId_date', ['portfolioId', 'date'])
    .index('by_powensTransactionId', ['powensTransactionId']),

  transactionCategories: defineTable({
    workspaceId: v.id('workspaces'),
    key: v.string(),
    label: v.string(),
    color: v.string(),
    icon: v.optional(v.string()),
    parentKey: v.optional(v.string()),
    builtIn: v.boolean(),
    sortOrder: v.optional(v.number()),
  })
    .index('by_workspaceId', ['workspaceId'])
    .index('by_workspaceId_key', ['workspaceId', 'key']),

  categoryRules: defineTable({
    workspaceId: v.id('workspaces'),
    pattern: v.string(),
    matchType: v.union(v.literal('contains'), v.literal('regex')),
    categoryKey: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
  }).index('by_workspaceId', ['workspaceId']),

  filterViews: defineTable({
    workspaceId: v.id('workspaces'),
    entityType: v.string(),
    name: v.string(),
    filters: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
  }).index('by_workspaceId_entityType', ['workspaceId', 'entityType']),

  labels: defineTable({
    workspaceId: v.id('workspaces'),
    name: v.string(),
    color: v.string(),
    createdAt: v.number(),
  }).index('by_workspaceId', ['workspaceId']),

  dailyCategoryBalance: defineTable({
    portfolioId: v.id('portfolios'),
    workspaceId: v.id('workspaces'),
    category: v.string(),
    date: v.string(),
    timestamp: v.number(),
    balance: v.number(),
    currency: v.string(),
  })
    .index('by_portfolioId_category_date', ['portfolioId', 'category', 'date'])
    .index('by_portfolioId_timestamp', ['portfolioId', 'timestamp'])
    .index('by_workspaceId_timestamp', ['workspaceId', 'timestamp']),
})
