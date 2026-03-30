import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { insertAuditLogDirect } from './auditLog'
import { getActorInfo, getAuthUserId, requireAuthUserId } from './lib/auth'
import {
  encryptAgentPrivateKey,
  generateAgentKeyPair,
} from './lib/serverCrypto'

/** Returns a workspace-scoped agent userId to avoid global singleton. */
function agentUserId(workspaceId: Id<'workspaces'>): string {
  return `bunkr-agent:${workspaceId}`
}

// --- Queries ---

export const getAgentStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!membership) return null

    const workspace = await ctx.db.get('workspaces', membership.workspaceId)
    if (!workspace) return null

    return {
      enabled: workspace.agentEnabled === true,
      workspaceId: membership.workspaceId,
      isOwner: membership.role === 'owner',
    }
  },
})

// --- Internal mutations (called from actions) ---

export const storeAgentKey = internalMutation({
  args: {
    agentUserId: v.string(),
    publicKey: v.string(),
    encryptedPrivateKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Atomic check + insert inside a single mutation to prevent race conditions
    const existing = await ctx.db
      .query('encryptionKeys')
      .withIndex('by_userId', (q) => q.eq('userId', args.agentUserId))
      .first()
    if (existing) {
      throw new Error('Agent encryption key already exists')
    }

    await ctx.db.insert('encryptionKeys', {
      userId: args.agentUserId,
      publicKey: args.publicKey,
      encryptedPrivateKey: args.encryptedPrivateKey,
      pbkdf2Salt: '', // Agent uses server secret, not passphrase
      version: 1,
      createdAt: Date.now(),
    })
  },
})

// --- Actions ---

export const generateAgentKeyPairAction = action({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx)

    // Verify user is workspace owner
    const membership = await ctx.runQuery(internal.agent.getOwnerMembership, {
      userId,
    })
    if (!membership) {
      throw new Error('Only workspace owners can activate the agent')
    }

    const secret = process.env.AGENT_KEY_SECRET
    if (!secret) {
      throw new Error('AGENT_KEY_SECRET environment variable is not configured')
    }

    const agentId = agentUserId(membership.workspaceId)

    // Generate X25519 keypair for the agent
    const { publicKeyJwk, privateKeyBytes } = generateAgentKeyPair()

    // Encrypt agent private key with server secret + random salt + AAD bound to public key
    const encryptedPrivateKey = encryptAgentPrivateKey(
      privateKeyBytes,
      secret,
      publicKeyJwk,
    )

    // Store in encryptionKeys table (atomic check + insert inside storeAgentKey mutation)
    await ctx.runMutation(internal.agent.storeAgentKey, {
      agentUserId: agentId,
      publicKey: publicKeyJwk,
      encryptedPrivateKey,
    })

    return { publicKeyJwk }
  },
})

// Internal query for the action to use
export const getOwnerMembership = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first()
    if (!membership || membership.role !== 'owner') return null
    return {
      workspaceId: membership.workspaceId,
      role: membership.role,
    }
  },
})

// --- Mutations ---

export const activateAgent = mutation({
  args: {
    encryptedWorkspacePrivateKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!membership || membership.role !== 'owner') {
      throw new Error('Only workspace owners can activate the agent')
    }

    const workspace = await ctx.db.get('workspaces', membership.workspaceId)
    if (!workspace) throw new Error('Workspace not found')

    // Verify encryption is enabled
    if (!workspace.encryptionEnabled) {
      throw new Error('Workspace encryption must be enabled to activate agent')
    }

    const agentId = agentUserId(membership.workspaceId)

    // Verify agent encryption key exists
    const agentKey = await ctx.db
      .query('encryptionKeys')
      .withIndex('by_userId', (q) => q.eq('userId', agentId))
      .first()
    if (!agentKey) {
      throw new Error('Agent encryption key not found. Generate keypair first.')
    }

    // Check key slot doesn't already exist
    const existingSlot = await ctx.db
      .query('workspaceKeySlots')
      .withIndex('by_workspaceId_userId', (q) =>
        q.eq('workspaceId', membership.workspaceId).eq('userId', agentId),
      )
      .first()
    if (existingSlot) {
      throw new Error('Agent already has a key slot')
    }

    // Create key slot for agent
    await ctx.db.insert('workspaceKeySlots', {
      workspaceId: membership.workspaceId,
      userId: agentId,
      encryptedPrivateKey: args.encryptedWorkspacePrivateKey,
      createdAt: Date.now(),
    })

    // Mark workspace as agent-enabled
    await ctx.db.patch('workspaces', membership.workspaceId, {
      agentEnabled: true,
    })

    // Audit log
    const identity = await ctx.auth.getUserIdentity()
    await insertAuditLogDirect(ctx.db, {
      workspaceId: membership.workspaceId,
      workspaceName: workspace.name,
      actorType: 'user',
      ...getActorInfo(identity),
      event: 'workspace.agent_activated',
      resourceType: 'workspace',
      resourceId: membership.workspaceId,
      metadata: JSON.stringify({}),
    })
  },
})

export const deactivateAgent = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx)

    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!membership || membership.role !== 'owner') {
      throw new Error('Only workspace owners can deactivate the agent')
    }

    const agentId = agentUserId(membership.workspaceId)

    // Delete agent key slot
    const keySlot = await ctx.db
      .query('workspaceKeySlots')
      .withIndex('by_workspaceId_userId', (q) =>
        q.eq('workspaceId', membership.workspaceId).eq('userId', agentId),
      )
      .first()
    if (keySlot) {
      await ctx.db.delete('workspaceKeySlots', keySlot._id)
    }

    // Delete agent encryption key
    const agentKey = await ctx.db
      .query('encryptionKeys')
      .withIndex('by_userId', (q) => q.eq('userId', agentId))
      .first()
    if (agentKey) {
      await ctx.db.delete('encryptionKeys', agentKey._id)
    }

    // Mark workspace as agent-disabled
    const workspace = await ctx.db.get('workspaces', membership.workspaceId)
    if (!workspace) throw new Error('Workspace not found')
    await ctx.db.patch('workspaces', membership.workspaceId, {
      agentEnabled: false,
    })

    // Audit log
    const identity = await ctx.auth.getUserIdentity()
    await insertAuditLogDirect(ctx.db, {
      workspaceId: membership.workspaceId,
      workspaceName: workspace.name,
      actorType: 'user',
      ...getActorInfo(identity),
      event: 'workspace.agent_deactivated',
      resourceType: 'workspace',
      resourceId: membership.workspaceId,
      metadata: JSON.stringify({}),
    })
  },
})

// --- Agent settings ---

export const getAgentSettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!membership) return null

    const workspace = await ctx.db.get('workspaces', membership.workspaceId)
    if (!workspace) return null

    const settings = await ctx.db
      .query('agentSettings')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .first()

    const agentId = agentUserId(membership.workspaceId)
    const keySlot = await ctx.db
      .query('workspaceKeySlots')
      .withIndex('by_workspaceId_userId', (q) =>
        q.eq('workspaceId', membership.workspaceId).eq('userId', agentId),
      )
      .first()

    return {
      agentEnabled: workspace.agentEnabled === true,
      webSearchEnabled: settings?.webSearchEnabled ?? false,
      encryptedInstructions: settings?.encryptedInstructions ?? null,
      hasKeySlot: !!keySlot,
    }
  },
})

export const updateAgentSettings = mutation({
  args: {
    webSearchEnabled: v.optional(v.boolean()),
    encryptedInstructions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!membership || membership.role !== 'owner') {
      throw new Error('Only workspace owners can update agent settings')
    }

    const workspace = await ctx.db.get('workspaces', membership.workspaceId)
    if (!workspace) throw new Error('Workspace not found')

    // Upsert agentSettings row
    const existing = await ctx.db
      .query('agentSettings')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .first()

    const patch: {
      webSearchEnabled?: boolean
      encryptedInstructions?: string
    } = {}
    if (args.webSearchEnabled !== undefined) {
      patch.webSearchEnabled = args.webSearchEnabled
    }
    if (args.encryptedInstructions !== undefined) {
      patch.encryptedInstructions = args.encryptedInstructions
    }

    if (existing) {
      await ctx.db.patch(existing._id, patch)
    } else {
      await ctx.db.insert('agentSettings', {
        workspaceId: membership.workspaceId,
        webSearchEnabled: args.webSearchEnabled ?? false,
        encryptedInstructions: args.encryptedInstructions,
      })
    }

    // Audit log
    const identity = await ctx.auth.getUserIdentity()
    await insertAuditLogDirect(ctx.db, {
      workspaceId: membership.workspaceId,
      workspaceName: workspace.name,
      actorType: 'user',
      ...getActorInfo(identity),
      event: 'workspace.agent_settings_updated',
      resourceType: 'workspace',
      resourceId: membership.workspaceId,
      metadata: JSON.stringify({
        webSearchEnabled: args.webSearchEnabled,
        instructionsUpdated: args.encryptedInstructions !== undefined,
      }),
    })
  },
})

export const getAgentSettingsInternal = internalQuery({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    return ctx.db
      .query('agentSettings')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
      .first()
  },
})

// --- Internal queries (used by agent actions) ---

export const getAgentEncryptionKey = internalQuery({
  args: { agentUserId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query('encryptionKeys')
      .withIndex('by_userId', (q) => q.eq('userId', args.agentUserId))
      .first()
  },
})

export const getAgentKeySlot = internalQuery({
  args: {
    workspaceId: v.id('workspaces'),
    agentUserId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query('workspaceKeySlots')
      .withIndex('by_workspaceId_userId', (q) =>
        q.eq('workspaceId', args.workspaceId).eq('userId', args.agentUserId),
      )
      .first()
  },
})
