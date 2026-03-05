import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
    createdBy: v.string(),
  }),

  workspaceMembers: defineTable({
    workspaceId: v.id('workspaces'),
    userId: v.string(),
    role: v.union(v.literal('owner'), v.literal('member')),
  })
    .index('by_userId', ['userId'])
    .index('by_workspaceId', ['workspaceId']),

  accounts: defineTable({
    workspaceId: v.id('workspaces'),
    name: v.string(),
    icon: v.optional(v.string()),
    powensUserToken: v.optional(v.string()),
    powensUserId: v.optional(v.number()),
  })
    .index('by_workspaceId', ['workspaceId'])
    .index('by_powensUserId', ['powensUserId']),

  connections: defineTable({
    accountId: v.id('accounts'),
    powensConnectionId: v.number(),
    connectorName: v.string(),
    connectorLogo: v.optional(v.string()),
    state: v.optional(v.string()),
    lastSync: v.optional(v.string()),
  })
    .index('by_accountId', ['accountId'])
    .index('by_powensConnectionId', ['powensConnectionId']),

  bankAccounts: defineTable({
    connectionId: v.id('connections'),
    accountId: v.id('accounts'),
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
  })
    .index('by_connectionId', ['connectionId'])
    .index('by_accountId', ['accountId']),
})
