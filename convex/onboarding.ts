import { v } from 'convex/values'
import { internal } from './_generated/api'
import { mutation, query } from './_generated/server'
import { getAuthUserId, requireAuthUserId } from './lib/auth'

export const getOnboardingState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { status: 'none' as const }

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (!member) return { status: 'none' as const }

    // Verify the workspace still exists — orphaned members should restart
    const workspace = await ctx.db.get('workspaces', member.workspaceId)
    if (!workspace) {
      return { status: 'none' as const }
    }

    if (member.onboardingStep === 'complete') {
      return {
        status: 'complete' as const,
        memberId: member._id,
        workspaceId: member.workspaceId,
      }
    }

    // Users without onboardingStep (pre-onboarding) or with an in-progress step
    return {
      status: 'in_progress' as const,
      step: member.onboardingStep ?? 'legal',
      role: member.role,
      memberId: member._id,
      workspaceId: member.workspaceId,
    }
  },
})

export const getOnboardingData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const consents = await ctx.db
      .query('userConsents')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    let memberData: {
      role: 'owner' | 'member'
      onboardingStep: string | null
      hasPortfolio: boolean
    } | null = null

    if (member) {
      const workspace = await ctx.db.get('workspaces', member.workspaceId)
      if (workspace) {
        const portfolio = await ctx.db
          .query('portfolios')
          .withIndex('by_memberId', (q) => q.eq('memberId', member._id))
          .first()
        memberData = {
          role: member.role,
          onboardingStep: member.onboardingStep ?? null,
          hasPortfolio: portfolio !== null,
        }
      }
    }

    const encKey = await ctx.db
      .query('encryptionKeys')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    return {
      hasConsents:
        consents?.termsOfService === true && consents?.privacyPolicy === true,
      member: memberData,
      hasEncryptionKey: encKey !== null,
    }
  },
})

export const saveConsents = mutation({
  args: {
    termsOfService: v.boolean(),
    privacyPolicy: v.boolean(),
    marketingCommunications: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    if (!args.termsOfService || !args.privacyPolicy) {
      throw new Error(
        'Terms of Service and Privacy Policy must both be accepted',
      )
    }

    const now = Date.now()

    const existing = await ctx.db
      .query('userConsents')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (existing) {
      await ctx.db.patch('userConsents', existing._id, {
        termsOfService: args.termsOfService,
        termsOfServiceAt: now,
        privacyPolicy: args.privacyPolicy,
        privacyPolicyAt: now,
        marketingCommunications: args.marketingCommunications,
        marketingCommunicationsAt: now,
      })
    } else {
      await ctx.db.insert('userConsents', {
        userId,
        termsOfService: args.termsOfService,
        termsOfServiceAt: now,
        privacyPolicy: args.privacyPolicy,
        privacyPolicyAt: now,
        marketingCommunications: args.marketingCommunications,
        marketingCommunicationsAt: now,
      })
    }
  },
})

export const createWorkspaceOnboarding = mutation({
  args: {
    workspaceName: v.string(),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    // Check if user already has a workspace
    const existing = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (existing) {
      // Verify the workspace still exists
      const workspace = await ctx.db.get('workspaces', existing.workspaceId)
      if (workspace) {
        // Update workspace name and advance onboarding step
        await ctx.db.patch('workspaces', existing.workspaceId, {
          name: args.workspaceName,
        })
        await ctx.db.patch('workspaceMembers', existing._id, {
          onboardingStep: 'invite',
        })
        return existing.workspaceId
      }
      // Workspace was deleted — remove orphaned member and recreate below
      await ctx.db.delete('workspaceMembers', existing._id)
    }

    const workspaceId = await ctx.db.insert('workspaces', {
      name: args.workspaceName,
      createdBy: userId,
    })

    await ctx.db.insert('workspaceMembers', {
      workspaceId,
      userId,
      role: 'owner',
      onboardingStep: 'invite',
      ...(args.language ? { language: args.language } : {}),
    })

    await ctx.scheduler.runAfter(0, internal.categories.seedDefaultCategories, {
      workspaceId,
    })

    return workspaceId
  },
})

export const updateOnboardingStep = mutation({
  args: {
    step: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (!member) return

    await ctx.db.patch('workspaceMembers', member._id, {
      onboardingStep: args.step,
    })
  },
})

export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx)

    const member = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (!member) throw new Error('No workspace membership found')

    await ctx.db.patch('workspaceMembers', member._id, {
      onboardingStep: 'complete',
    })

    // Ensure workspace is marked as encryption-enabled
    const workspace = await ctx.db.get('workspaces', member.workspaceId)
    if (workspace && !workspace.encryptionEnabled) {
      await ctx.db.patch('workspaces', member.workspaceId, {
        encryptionEnabled: true,
      })
    }
  },
})

export const getConsents = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    return await ctx.db
      .query('userConsents')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
  },
})

export const updateMarketingConsent = mutation({
  args: {
    marketingCommunications: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const existing = await ctx.db
      .query('userConsents')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (!existing) throw new Error('No consent record found')

    await ctx.db.patch('userConsents', existing._id, {
      marketingCommunications: args.marketingCommunications,
      marketingCommunicationsAt: Date.now(),
    })
  },
})
