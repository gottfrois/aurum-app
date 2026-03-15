import { registerRoutes } from '@convex-dev/stripe'
import { httpRouter } from 'convex/server'
import { components, internal } from './_generated/api'
import { httpAction } from './_generated/server'

const http = httpRouter()

// Stripe webhook routes
registerRoutes(http, components.stripe, {
  webhookPath: '/stripe/webhook',
})

http.route({
  path: '/powens/callback',
  method: 'GET',
  // eslint-disable-next-line @typescript-eslint/require-await
  handler: httpAction(async (_, request) => {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connection_id')
    const state = url.searchParams.get('state')

    const siteUrl = process.env.SITE_URL ?? 'http://localhost:3000'

    const params = new URLSearchParams()
    if (connectionId) params.set('connection_id', connectionId)
    if (state) params.set('state', state)

    return new Response(null, {
      status: 302,
      headers: {
        Location: `${siteUrl}/powens/callback?${params.toString()}`,
      },
    })
  }),
})

// ── Powens webhook routes ──────────────────────────────────────────────
// Each event type gets its own path so we can parse the exact payload shape.
// Configure these URLs in the Powens dashboard per event type.

// CONNECTION_SYNCED — full sync: connection + accounts + transactions
// Payload: { user, connection: { ...Connection, connector, accounts: [{ ...Account, transactions }] } }
http.route({
  path: '/powens/webhook/connection-synced',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const payload = (await request.json()) as {
      connection?: {
        id?: number | null
        id_user?: number | null
        state?: string | null
        last_update?: string | null
      } | null
    }

    const conn = payload.connection
    if (!conn || !conn.id_user || !conn.id) {
      console.warn(
        '[powens/webhook/connection-synced] Missing connection.id_user or connection.id',
      )
      return new Response('OK', { status: 200 })
    }

    const profile = await ctx.runQuery(
      internal.powens.findProfileByPowensUserId,
      { powensUserId: conn.id_user },
    )
    if (!profile) {
      console.warn(
        `[powens/webhook/connection-synced] No profile for Powens user ${conn.id_user}`,
      )
      return new Response('OK', { status: 200 })
    }

    console.log('[powens/webhook/connection-synced] Syncing connection', {
      powensConnectionId: conn.id,
      state: conn.state,
      last_update: conn.last_update,
    })

    await ctx.runAction(internal.powens.syncConnectionFromPowens, {
      profileId: profile._id,
      powensConnectionId: conn.id,
      state: conn.state ?? undefined,
      lastSync: conn.last_update ?? undefined,
    })

    return new Response('OK', { status: 200 })
  }),
})

// CONNECTION_DELETED — clean up connection and related data
// Payload: flat connection object { id, id_user, state, ... }
http.route({
  path: '/powens/webhook/connection-deleted',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const payload = (await request.json()) as {
      id?: number | null
      id_user?: number | null
    }

    if (!payload.id_user || !payload.id) {
      console.warn('[powens/webhook/connection-deleted] Missing id_user or id')
      return new Response('OK', { status: 200 })
    }

    const profile = await ctx.runQuery(
      internal.powens.findProfileByPowensUserId,
      { powensUserId: payload.id_user },
    )
    if (!profile) {
      console.warn(
        `[powens/webhook/connection-deleted] No profile for Powens user ${payload.id_user}`,
      )
      return new Response('OK', { status: 200 })
    }

    const connection = await ctx.runQuery(
      internal.powens.findConnectionByPowensId,
      { powensConnectionId: payload.id },
    )
    if (!connection) {
      console.warn(
        `[powens/webhook/connection-deleted] No connection found for ${payload.id}`,
      )
      return new Response('OK', { status: 200 })
    }

    console.log(
      `[powens/webhook/connection-deleted] Deleting connection ${payload.id}`,
    )

    await ctx.runMutation(internal.powens.deleteConnectionData, {
      connectionId: connection._id,
      profileId: profile._id,
    })

    return new Response('OK', { status: 200 })
  }),
})

// ACCOUNTS_FETCHED — connection synced accounts (pre-transaction processing)
// Payload: { user, connection: { ...Connection, accounts, connector } }
http.route({
  path: '/powens/webhook/accounts-fetched',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const payload = (await request.json()) as {
      connection?: {
        id?: number | null
        id_user?: number | null
        state?: string | null
        last_update?: string | null
      } | null
    }

    const conn = payload.connection
    if (!conn || !conn.id_user || !conn.id) {
      console.warn(
        '[powens/webhook/accounts-fetched] Missing connection.id_user or connection.id',
      )
      return new Response('OK', { status: 200 })
    }

    const profile = await ctx.runQuery(
      internal.powens.findProfileByPowensUserId,
      { powensUserId: conn.id_user },
    )
    if (!profile) {
      console.warn(
        `[powens/webhook/accounts-fetched] No profile for Powens user ${conn.id_user}`,
      )
      return new Response('OK', { status: 200 })
    }

    console.log('[powens/webhook/accounts-fetched] Syncing connection', {
      powensConnectionId: conn.id,
      state: conn.state,
    })

    // Reuse the same sync — it fetches everything from the API
    await ctx.runAction(internal.powens.syncConnectionFromPowens, {
      profileId: profile._id,
      powensConnectionId: conn.id,
      state: conn.state ?? undefined,
      lastSync: conn.last_update ?? undefined,
    })

    return new Response('OK', { status: 200 })
  }),
})

// ACCOUNT_SYNCED — individual account synced with transactions
// Payload: { ...Account (flat), transactions: [...] }
http.route({
  path: '/powens/webhook/account-synced',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const payload = (await request.json()) as {
      id_connection?: number | null
      id_user?: number | null
    }

    if (!payload.id_user || !payload.id_connection) {
      console.warn(
        '[powens/webhook/account-synced] Missing id_user or id_connection',
      )
      return new Response('OK', { status: 200 })
    }

    const profile = await ctx.runQuery(
      internal.powens.findProfileByPowensUserId,
      { powensUserId: payload.id_user },
    )
    if (!profile) {
      console.warn(
        `[powens/webhook/account-synced] No profile for Powens user ${payload.id_user}`,
      )
      return new Response('OK', { status: 200 })
    }

    console.log('[powens/webhook/account-synced] Syncing connection', {
      powensConnectionId: payload.id_connection,
    })

    // Sync the full connection — simpler than handling individual accounts
    await ctx.runAction(internal.powens.syncConnectionFromPowens, {
      profileId: profile._id,
      powensConnectionId: payload.id_connection,
    })

    return new Response('OK', { status: 200 })
  }),
})

// ACCOUNT_FOUND — new account discovered
// Payload: flat { id, id_user, id_connection, type, ... }
http.route({
  path: '/powens/webhook/account-found',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const payload = (await request.json()) as {
      id_connection?: number | null
      id_user?: number | null
    }

    if (!payload.id_user || !payload.id_connection) {
      console.warn(
        '[powens/webhook/account-found] Missing id_user or id_connection',
      )
      return new Response('OK', { status: 200 })
    }

    const profile = await ctx.runQuery(
      internal.powens.findProfileByPowensUserId,
      { powensUserId: payload.id_user },
    )
    if (!profile) {
      console.warn(
        `[powens/webhook/account-found] No profile for Powens user ${payload.id_user}`,
      )
      return new Response('OK', { status: 200 })
    }

    console.log('[powens/webhook/account-found] Syncing connection', {
      powensConnectionId: payload.id_connection,
    })

    await ctx.runAction(internal.powens.syncConnectionFromPowens, {
      profileId: profile._id,
      powensConnectionId: payload.id_connection,
    })

    return new Response('OK', { status: 200 })
  }),
})

export default http
