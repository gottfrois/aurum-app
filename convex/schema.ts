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

  recoveryCodeSlots: defineTable({
    userId: v.string(),
    codeHash: v.string(),
    encryptedPrivateKey: v.string(),
    pbkdf2Salt: v.string(),
    slotIndex: v.number(),
    usedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_codeHash', ['userId', 'codeHash']),

  workspaces: defineTable({
    name: v.string(),
    createdBy: v.string(),
    encryptionEnabled: v.optional(v.boolean()),
    agentEnabled: v.optional(v.boolean()),
    policies: v.optional(
      v.object({
        categoryCreation: v.union(
          v.literal('owners_only'),
          v.literal('all_members'),
        ),
        labelCreation: v.union(
          v.literal('owners_only'),
          v.literal('all_members'),
        ),
        ruleCreation: v.union(
          v.literal('owners_only'),
          v.literal('all_members'),
        ),
      }),
    ),
  }),

  workspaceMembers: defineTable({
    workspaceId: v.id('workspaces'),
    userId: v.string(),
    role: v.union(v.literal('owner'), v.literal('member')),
    onboardingStep: v.optional(v.string()),
    language: v.optional(v.string()),
    permissions: v.optional(
      v.object({
        canViewTeamDashboard: v.boolean(),
        canViewMemberBreakdown: v.boolean(),
      }),
    ),
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
      v.literal('rejected'),
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
    shared: v.optional(v.boolean()),
    shareAmounts: v.optional(v.boolean()),
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
    encryptedCustomName: v.optional(v.string()),
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
    currency: v.string(),
    date: v.string(),
    timestamp: v.number(),
    seed: v.optional(v.boolean()),
    encryptedData: v.string(),
  })
    .index('by_bankAccountId_timestamp', ['bankAccountId', 'timestamp'])
    .index('by_bankAccountId_date', ['bankAccountId', 'date'])
    .index('by_portfolioId_timestamp', ['portfolioId', 'timestamp']),

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
    labelIds: v.optional(v.array(v.id('transactionLabels'))),
    excludedFromBudget: v.optional(v.boolean()),
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
    portfolioId: v.optional(v.id('portfolios')),
    key: v.string(),
    label: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
    icon: v.optional(v.string()),
    parentKey: v.optional(v.string()),
    builtIn: v.boolean(),
    sortOrder: v.optional(v.number()),
    createdAt: v.optional(v.number()),
  })
    .index('by_workspaceId', ['workspaceId'])
    .index('by_workspaceId_key', ['workspaceId', 'key'])
    .index('by_portfolioId', ['portfolioId']),

  transactionRules: defineTable({
    workspaceId: v.id('workspaces'),
    portfolioId: v.optional(v.id('portfolios')),
    accountIds: v.optional(v.array(v.id('bankAccounts'))),
    pattern: v.string(),
    matchType: v.union(v.literal('contains'), v.literal('regex')),
    categoryKey: v.optional(v.string()),
    excludeFromBudget: v.optional(v.boolean()),
    labelIds: v.optional(v.array(v.id('transactionLabels'))),
    customDescription: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    createdBy: v.string(),
    createdAt: v.number(),
    impactedTransactionCount: v.optional(v.number()),
  })
    .index('by_workspaceId', ['workspaceId'])
    .index('by_portfolioId', ['portfolioId']),

  filterViews: defineTable({
    workspaceId: v.id('workspaces'),
    entityType: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    filters: v.string(),
    visibility: v.optional(
      v.union(
        v.literal('personal'),
        v.literal('workspace'),
        v.literal('portfolio'),
      ),
    ),
    portfolioId: v.optional(v.id('portfolios')),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index('by_workspaceId_entityType', ['workspaceId', 'entityType'])
    .index('by_workspaceId', ['workspaceId']),

  filterViewFavorites: defineTable({
    workspaceId: v.id('workspaces'),
    userId: v.string(),
    viewId: v.id('filterViews'),
    sortOrder: v.number(),
    createdAt: v.number(),
  })
    .index('by_workspaceId_userId', ['workspaceId', 'userId'])
    .index('by_viewId', ['viewId']),

  transactionLabels: defineTable({
    workspaceId: v.id('workspaces'),
    portfolioId: v.optional(v.id('portfolios')),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
    createdAt: v.number(),
  })
    .index('by_workspaceId', ['workspaceId'])
    .index('by_portfolioId', ['portfolioId']),

  batchOperations: defineTable({
    workspaceId: v.id('workspaces'),
    userId: v.string(),
    type: v.union(
      v.literal('labels'),
      v.literal('category'),
      v.literal('exclusion'),
      v.literal('description'),
    ),
    status: v.union(
      v.literal('processing'),
      v.literal('complete'),
      v.literal('error'),
    ),
    total: v.number(),
    processed: v.number(),
    label: v.string(),
    error: v.optional(v.string()),
    retainUntil: v.number(),
    createdAt: v.number(),
  })
    .index('by_workspaceId_status', ['workspaceId', 'status'])
    .index('by_retainUntil', ['retainUntil']),

  agentSettings: defineTable({
    workspaceId: v.id('workspaces'),
    webSearchEnabled: v.boolean(),
    encryptedInstructions: v.optional(v.string()),
    threadRetentionDays: v.optional(v.number()),
  }).index('by_workspaceId', ['workspaceId']),

  agentThreadMetadata: defineTable({
    workspaceId: v.id('workspaces'),
    userId: v.string(),
    threadId: v.string(),
    portfolioId: v.optional(v.id('portfolios')),
    portfolioScope: v.optional(
      v.union(v.literal('portfolio'), v.literal('all'), v.literal('team')),
    ),
    createdAt: v.number(),
  })
    .index('by_threadId', ['threadId'])
    .index('by_workspaceId', ['workspaceId'])
    .index('by_userId', ['userId']),

  auditLogs: defineTable({
    timestamp: v.number(),
    retainUntil: v.optional(v.number()),
    workspaceId: v.id('workspaces'),
    workspaceName: v.string(),
    portfolioId: v.optional(v.id('portfolios')),
    portfolioName: v.optional(v.string()),
    actorType: v.union(v.literal('user'), v.literal('system')),
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    actorAvatarUrl: v.optional(v.string()),
    event: v.string(),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    resourceName: v.optional(v.string()),
    metadata: v.string(),
  })
    .index('by_workspaceId_timestamp', ['workspaceId', 'timestamp'])
    .index('by_resourceId_timestamp', ['resourceId', 'timestamp'])
    .index('by_retainUntil', ['retainUntil']),
})
