import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { resend } from './email'
import { getAuthUserId, requireAuthUserId } from './lib/auth'

export const listMembers = query({
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

    const invitations = await ctx.db
      .query('workspaceInvitations')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .filter((q) => q.eq(q.field('status'), 'pending'))
      .collect()

    const portfolios = await ctx.db
      .query('portfolios')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .collect()

    const membersWithSharing = members.map((m) => {
      const sharedCount = portfolios.filter(
        (p) => p.memberId === m._id && p.shared === true,
      ).length
      return {
        ...m,
        sharedPortfolioCount: sharedCount,
      }
    })

    return {
      members: membersWithSharing,
      invitations,
      currentUserId: userId,
      workspaceId: membership.workspaceId,
    }
  },
})

export const sendInvitation = action({
  args: { emails: v.array(v.string()) },
  handler: async (ctx, { emails }) => {
    const userId = await requireAuthUserId(ctx)

    const membership = await ctx.runQuery(
      internal.members.getMembershipByUserId,
      { userId },
    )

    if (!membership || membership.role !== 'owner') {
      throw new Error('Only workspace owners can invite members')
    }

    // Check seat limits before sending invitations
    const subscription = await ctx.runQuery(
      internal.billing.getOwnerSubscription,
      { ownerUserId: userId },
    )
    if (subscription.isActive) {
      const currentMembers = await ctx.runQuery(
        internal.members.getMembersByWorkspace,
        { workspaceId: membership.workspaceId },
      )
      const pendingInvites = await ctx.runQuery(
        internal.members.countPendingInvitations,
        { workspaceId: membership.workspaceId },
      )
      const totalSeats = currentMembers.length + pendingInvites + emails.length
      if (totalSeats > subscription.seats) {
        throw new Error(
          `Seat limit reached. Your plan allows ${subscription.seats} seat${subscription.seats !== 1 ? 's' : ''}. You currently have ${currentMembers.length} member${currentMembers.length !== 1 ? 's' : ''} and ${pendingInvites} pending invitation${pendingInvites !== 1 ? 's' : ''}.`,
        )
      }
    }

    const siteUrl = process.env.SITE_URL ?? 'http://localhost:3000'

    const members = await ctx.runQuery(internal.members.getMembersByWorkspace, {
      workspaceId: membership.workspaceId,
    })

    const clerkSecretKey = process.env.CLERK_SECRET_KEY
    const memberEmails = new Set<string>()
    if (clerkSecretKey) {
      await Promise.all(
        members.map(async (m) => {
          const res = await fetch(
            `https://api.clerk.com/v1/users/${m.userId}`,
            {
              headers: { Authorization: `Bearer ${clerkSecretKey}` },
            },
          )
          if (res.ok) {
            const user = (await res.json()) as {
              primary_email_address_id: string
              email_addresses?: Array<{ id: string; email_address: string }>
            }
            const email = user.email_addresses?.find(
              (e) => e.id === user.primary_email_address_id,
            )?.email_address
            if (email) memberEmails.add(email.toLowerCase())
          }
        }),
      )
    }

    for (const email of emails) {
      if (memberEmails.has(email.toLowerCase())) continue

      const existing = await ctx.runQuery(
        internal.members.getPendingInvitation,
        { workspaceId: membership.workspaceId, email },
      )

      if (existing) continue

      await ctx.runMutation(internal.members.sendInvitationEmail, {
        workspaceId: membership.workspaceId,
        email,
        invitedBy: userId,
        siteUrl,
      })
    }
  },
})

export const revokeInvitation = internalMutation({
  args: { invitationId: v.id('workspaceInvitations') },
  handler: async (ctx, { invitationId }) => {
    await ctx.db.patch('workspaceInvitations', invitationId, {
      status: 'revoked',
    })
  },
})

export const revokeInvitationAction = action({
  args: { invitationId: v.id('workspaceInvitations') },
  handler: async (ctx, { invitationId }) => {
    const userId = await requireAuthUserId(ctx)

    const membership = await ctx.runQuery(
      internal.members.getMembershipByUserId,
      { userId },
    )

    if (!membership || membership.role !== 'owner') {
      throw new Error('Only workspace owners can revoke invitations')
    }

    await ctx.runMutation(internal.members.revokeInvitation, { invitationId })
  },
})

export const removeMember = action({
  args: { memberId: v.id('workspaceMembers') },
  handler: async (ctx, { memberId }) => {
    const userId = await requireAuthUserId(ctx)

    const membership = await ctx.runQuery(
      internal.members.getMembershipByUserId,
      { userId },
    )

    if (!membership || membership.role !== 'owner') {
      throw new Error('Only workspace owners can remove members')
    }

    await ctx.runMutation(internal.members.deleteMember, { memberId })
  },
})

export const deleteMember = internalMutation({
  args: { memberId: v.id('workspaceMembers') },
  handler: async (ctx, { memberId }) => {
    const member = await ctx.db.get('workspaceMembers', memberId)
    if (member) {
      // Remove workspace key slot
      const keySlot = await ctx.db
        .query('workspaceKeySlots')
        .withIndex('by_workspaceId_userId', (q) =>
          q.eq('workspaceId', member.workspaceId).eq('userId', member.userId),
        )
        .first()
      if (keySlot) await ctx.db.delete('workspaceKeySlots', keySlot._id)

      // Remove personal encryption key
      const personalKey = await ctx.db
        .query('encryptionKeys')
        .withIndex('by_userId', (q) => q.eq('userId', member.userId))
        .first()
      if (personalKey) await ctx.db.delete('encryptionKeys', personalKey._id)
    }
    await ctx.db.delete('workspaceMembers', memberId)
  },
})

export const resolveUsers = action({
  args: { userIds: v.array(v.string()) },
  handler: async (ctx, { userIds }) => {
    await requireAuthUserId(ctx)

    const clerkSecretKey = process.env.CLERK_SECRET_KEY
    if (!clerkSecretKey) {
      throw new Error('CLERK_SECRET_KEY not configured')
    }

    const results: Record<
      string,
      {
        firstName: string | null
        lastName: string | null
        imageUrl: string
        email: string
      }
    > = {}

    await Promise.all(
      userIds.map(async (id) => {
        const res = await fetch(`https://api.clerk.com/v1/users/${id}`, {
          headers: { Authorization: `Bearer ${clerkSecretKey}` },
        })
        if (res.ok) {
          const user = (await res.json()) as {
            first_name: string | null
            last_name: string | null
            image_url: string
            primary_email_address_id: string
            email_addresses?: Array<{ id: string; email_address: string }>
          }
          results[id] = {
            firstName: user.first_name,
            lastName: user.last_name,
            imageUrl: user.image_url,
            email:
              user.email_addresses?.find(
                (e) => e.id === user.primary_email_address_id,
              )?.email_address ?? '',
          }
        }
      }),
    )

    return results
  },
})

export const getMembersByWorkspace = internalQuery({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    return await ctx.db
      .query('workspaceMembers')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
      .collect()
  },
})

export const getMembershipByUserId = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
  },
})

export const getPendingInvitation = internalQuery({
  args: { workspaceId: v.id('workspaces'), email: v.string() },
  handler: async (ctx, { workspaceId, email }) => {
    return await ctx.db
      .query('workspaceInvitations')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
      .filter((q) =>
        q.and(
          q.eq(q.field('email'), email),
          q.eq(q.field('status'), 'pending'),
        ),
      )
      .first()
  },
})

export const countPendingInvitations = internalQuery({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    const invitations = await ctx.db
      .query('workspaceInvitations')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
      .filter((q) => q.eq(q.field('status'), 'pending'))
      .collect()
    return invitations.length
  },
})

export const createInvitation = internalMutation({
  args: {
    workspaceId: v.id('workspaces'),
    email: v.string(),
    invitedBy: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('workspaceInvitations', {
      ...args,
      status: 'pending',
    })
  },
})

export const sendInvitationEmail = internalMutation({
  args: {
    workspaceId: v.id('workspaces'),
    email: v.string(),
    invitedBy: v.string(),
    siteUrl: v.string(),
  },
  handler: async (ctx, { workspaceId, email, invitedBy, siteUrl }) => {
    await ctx.db.insert('workspaceInvitations', {
      workspaceId,
      email,
      invitedBy,
      status: 'pending',
    })

    const fromEmail = process.env.RESEND_FROM_EMAIL
    if (!fromEmail) {
      throw new Error(
        'RESEND_FROM_EMAIL environment variable is not configured',
      )
    }

    await resend.sendEmail(ctx, {
      from: fromEmail,
      to: [email],
      subject: 'You have been invited to join a workspace on Bunkr',
      html: `<p>You have been invited to join a workspace on Bunkr.</p><p><a href="${siteUrl}">Sign in to accept the invitation</a></p>`,
    })
  },
})

export const updateMemberPermissions = mutation({
  args: {
    memberId: v.id('workspaceMembers'),
    permissions: v.object({
      canViewFamilyDashboard: v.boolean(),
      canViewMemberBreakdown: v.boolean(),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (!membership || membership.role !== 'owner') {
      throw new Error('Only workspace owners can update member permissions')
    }

    const target = await ctx.db.get('workspaceMembers', args.memberId)
    if (!target || target.workspaceId !== membership.workspaceId) {
      throw new Error('Member not found')
    }

    await ctx.db.patch('workspaceMembers', args.memberId, {
      permissions: args.permissions,
    })
  },
})
