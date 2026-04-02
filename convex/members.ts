import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { insertAuditLogDirect } from './auditLog'
import { resend } from './email'
import { getActorInfo, getAuthUserId, requireAuthUserId } from './lib/auth'

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
  args: {
    invitationId: v.id('workspaceInvitations'),
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    actorAvatarUrl: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { invitationId, actorId, actorName, actorAvatarUrl },
  ) => {
    const invitation = await ctx.db.get('workspaceInvitations', invitationId)

    await ctx.db.patch('workspaceInvitations', invitationId, {
      status: 'revoked',
    })

    if (invitation) {
      const workspace = await ctx.db.get('workspaces', invitation.workspaceId)
      await insertAuditLogDirect(ctx.db, {
        workspaceId: invitation.workspaceId,
        workspaceName: workspace?.name ?? '',
        actorType: 'user',
        actorId,
        actorName,
        actorAvatarUrl,
        event: 'workspace.invitation_revoked',
        resourceType: 'workspace',
        resourceId: invitation.workspaceId,
        metadata: JSON.stringify({
          invitedEmail: invitation.email,
        }),
      })
    }
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

    const identity = await ctx.auth.getUserIdentity()
    const { actorId, actorName, actorAvatarUrl } = getActorInfo(identity)

    await ctx.runMutation(internal.members.revokeInvitation, {
      invitationId,
      actorId,
      actorName,
      actorAvatarUrl,
    })
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

      const workspace = await ctx.db.get('workspaces', member.workspaceId)
      await insertAuditLogDirect(ctx.db, {
        workspaceId: member.workspaceId,
        workspaceName: workspace?.name ?? '',
        actorType: 'user',
        event: 'workspace.member_removed',
        resourceType: 'workspace',
        resourceId: member.workspaceId,
        metadata: JSON.stringify({
          removedUserId: member.userId,
        }),
      })
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
    const invitationId = await ctx.db.insert('workspaceInvitations', {
      workspaceId,
      email,
      invitedBy,
      status: 'pending',
    })

    const workspace = await ctx.db.get('workspaces', workspaceId)
    const workspaceName = workspace?.name ?? 'a workspace'
    await insertAuditLogDirect(ctx.db, {
      workspaceId,
      workspaceName: workspace?.name ?? '',
      actorType: 'user',
      actorId: invitedBy,
      event: 'workspace.member_invited',
      resourceType: 'workspace',
      resourceId: workspaceId,
      metadata: JSON.stringify({
        invitedEmail: email,
      }),
    })

    const fromEmail = process.env.RESEND_FROM_EMAIL
    if (!fromEmail) {
      throw new Error(
        'RESEND_FROM_EMAIL environment variable is not configured',
      )
    }

    const inviteUrl = `${siteUrl}/invite/${invitationId}`
    await resend.sendEmail(ctx, {
      from: fromEmail,
      to: [email],
      subject: `You've been invited to join ${workspaceName} on Bunkr`,
      html: `<p>You have been invited to join <strong>${workspaceName}</strong> on Bunkr.</p><p><a href="${inviteUrl}">Accept the invitation</a></p>`,
    })
  },
})

export const getInvitationById = query({
  args: { invitationId: v.id('workspaceInvitations') },
  handler: async (ctx, { invitationId }) => {
    await requireAuthUserId(ctx)
    const invitation = await ctx.db.get('workspaceInvitations', invitationId)
    if (!invitation) return null

    const workspace = await ctx.db.get('workspaces', invitation.workspaceId)
    return {
      _id: invitation._id,
      email: invitation.email,
      status: invitation.status,
      invitedBy: invitation.invitedBy,
      workspaceId: invitation.workspaceId,
      workspaceName: workspace?.name ?? null,
    }
  },
})

export const getPendingInvitationsForUser = query({
  args: {},
  handler: async (ctx) => {
    await requireAuthUserId(ctx)
    const identity = await ctx.auth.getUserIdentity()
    if (!identity?.email) return []

    const invitations = await ctx.db
      .query('workspaceInvitations')
      .withIndex('by_email', (q) =>
        q.eq('email', identity.email?.toLowerCase() ?? ''),
      )
      .filter((q) => q.eq(q.field('status'), 'pending'))
      .collect()

    const results = await Promise.all(
      invitations.map(async (inv) => {
        const workspace = await ctx.db.get('workspaces', inv.workspaceId)
        if (!workspace) return null
        return {
          _id: inv._id,
          workspaceName: workspace.name,
          workspaceId: inv.workspaceId,
          invitedBy: inv.invitedBy,
        }
      }),
    )

    return results.filter((r): r is NonNullable<typeof r> => r !== null)
  },
})

export const acceptSpecificInvitation = internalMutation({
  args: {
    invitationId: v.id('workspaceInvitations'),
    userId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, { invitationId, userId, email }) => {
    const invitation = await ctx.db.get('workspaceInvitations', invitationId)
    if (!invitation) throw new Error('Invitation not found')
    if (invitation.status !== 'pending') {
      throw new Error('Invitation is no longer pending')
    }
    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      throw new Error('Email does not match invitation')
    }

    const workspace = await ctx.db.get('workspaces', invitation.workspaceId)
    if (!workspace) throw new Error('Workspace no longer exists')

    // Check if already a member of this workspace
    const existingMembers = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    const alreadyMember = existingMembers.find(
      (m) => m.workspaceId === invitation.workspaceId,
    )
    if (alreadyMember) {
      await ctx.db.patch('workspaceInvitations', invitationId, {
        status: 'accepted',
      })
      return { accepted: true, workspaceId: invitation.workspaceId }
    }

    // Create member record
    await ctx.db.insert('workspaceMembers', {
      workspaceId: invitation.workspaceId,
      userId,
      role: 'member',
      onboardingStep: 'vault',
    })

    await ctx.db.patch('workspaceInvitations', invitationId, {
      status: 'accepted',
    })

    await insertAuditLogDirect(ctx.db, {
      workspaceId: invitation.workspaceId,
      workspaceName: workspace.name,
      actorType: 'user',
      actorId: userId,
      event: 'workspace.invitation_accepted',
      resourceType: 'workspace',
      resourceId: invitation.workspaceId,
      metadata: JSON.stringify({ invitedEmail: email }),
    })

    return { accepted: true, workspaceId: invitation.workspaceId }
  },
})

export const acceptInvitationById = action({
  args: { invitationId: v.id('workspaceInvitations') },
  handler: async (
    ctx,
    { invitationId },
  ): Promise<{ accepted: boolean; workspaceId: string }> => {
    const userId = await requireAuthUserId(ctx)

    const clerkSecretKey = process.env.CLERK_SECRET_KEY
    if (!clerkSecretKey) throw new Error('CLERK_SECRET_KEY not configured')

    const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${clerkSecretKey}` },
    })
    if (!res.ok) throw new Error('Failed to fetch user from Clerk')

    const user = (await res.json()) as {
      primary_email_address_id: string
      email_addresses?: Array<{ id: string; email_address: string }>
    }
    const email = user.email_addresses?.find(
      (e) => e.id === user.primary_email_address_id,
    )?.email_address
    if (!email) throw new Error('No email found for user')

    return await ctx.runMutation(internal.members.acceptSpecificInvitation, {
      invitationId,
      userId,
      email: email.toLowerCase(),
    })
  },
})

export const rejectInvitation = action({
  args: { invitationId: v.id('workspaceInvitations') },
  handler: async (ctx, { invitationId }) => {
    const userId = await requireAuthUserId(ctx)

    const clerkSecretKey = process.env.CLERK_SECRET_KEY
    if (!clerkSecretKey) throw new Error('CLERK_SECRET_KEY not configured')

    const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${clerkSecretKey}` },
    })
    if (!res.ok) throw new Error('Failed to fetch user from Clerk')

    const user = (await res.json()) as {
      primary_email_address_id: string
      email_addresses?: Array<{ id: string; email_address: string }>
    }
    const email = user.email_addresses?.find(
      (e) => e.id === user.primary_email_address_id,
    )?.email_address
    if (!email) throw new Error('No email found for user')

    await ctx.runMutation(internal.members.rejectInvitationInternal, {
      invitationId,
      userId,
      email: email.toLowerCase(),
    })
  },
})

export const rejectInvitationInternal = internalMutation({
  args: {
    invitationId: v.id('workspaceInvitations'),
    userId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, { invitationId, userId, email }) => {
    const invitation = await ctx.db.get('workspaceInvitations', invitationId)
    if (!invitation) throw new Error('Invitation not found')
    if (invitation.status !== 'pending') {
      throw new Error('Invitation is no longer pending')
    }
    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      throw new Error('Email does not match invitation')
    }

    await ctx.db.patch('workspaceInvitations', invitationId, {
      status: 'rejected',
    })

    const workspace = await ctx.db.get('workspaces', invitation.workspaceId)
    await insertAuditLogDirect(ctx.db, {
      workspaceId: invitation.workspaceId,
      workspaceName: workspace?.name ?? '',
      actorType: 'user',
      actorId: userId,
      event: 'workspace.invitation_rejected',
      resourceType: 'workspace',
      resourceId: invitation.workspaceId,
      metadata: JSON.stringify({ invitedEmail: email }),
    })
  },
})

export const updateMemberPermissions = mutation({
  args: {
    memberId: v.id('workspaceMembers'),
    permissions: v.object({
      canViewTeamDashboard: v.boolean(),
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

    const workspace = await ctx.db.get('workspaces', membership.workspaceId)
    const identity = await ctx.auth.getUserIdentity()
    await insertAuditLogDirect(ctx.db, {
      workspaceId: membership.workspaceId,
      workspaceName: workspace?.name ?? '',
      actorType: 'user',
      ...getActorInfo(identity),
      event: 'workspace.member_permissions_updated',
      resourceType: 'workspace',
      resourceId: membership.workspaceId,
      metadata: JSON.stringify({
        memberId: args.memberId,
        permissions: args.permissions,
      }),
    })
  },
})
