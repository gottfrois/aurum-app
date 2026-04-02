import { Presence } from '@convex-dev/presence'
import { v } from 'convex/values'
import { components } from './_generated/api'
import { mutation, query } from './_generated/server'
import { getAuthUserId } from './lib/auth'

const presence = new Presence(components.presence)

// Required by the usePresence React hook — wraps heartbeat with auth.
export const heartbeat = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    interval: v.number(),
  },
  handler: async (ctx, { roomId, userId, sessionId, interval }) => {
    const authUserId = await getAuthUserId(ctx)
    if (!authUserId) return { roomToken: '', sessionToken: '' }
    return presence.heartbeat(ctx, roomId, userId, sessionId, interval)
  },
})

// Required by the usePresence React hook — shared query cache (no per-user auth).
export const list = query({
  args: { roomToken: v.string() },
  handler: async (ctx, { roomToken }) => {
    return presence.list(ctx, roomToken)
  },
})

// Required by the usePresence React hook — called via sendBeacon on page unload.
export const disconnect = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    return presence.disconnect(ctx, sessionToken)
  },
})

// List all presence states for a workspace room — used by the members page.
export const listRoom = query({
  args: { roomId: v.string() },
  handler: async (ctx, { roomId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return presence.listRoom(ctx, roomId)
  },
})
