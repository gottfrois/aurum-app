import { v } from 'convex/values'
import { action, internalMutation, internalQuery, query } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { getAuthUserId, requireAuthUserId } from './lib/auth'

async function recordBalanceSnapshot(
  ctx: MutationCtx,
  params: {
    bankAccountId: Id<'bankAccounts'>
    profileId: Id<'profiles'>
    balance: number
    currency: string
  },
) {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const timestamp = now.getTime()

  const existing = await ctx.db
    .query('balanceSnapshots')
    .withIndex('by_bankAccountId_date', (q) =>
      q.eq('bankAccountId', params.bankAccountId).eq('date', date),
    )
    .first()

  if (existing) {
    await ctx.db.patch(existing._id, { balance: params.balance })
  } else {
    await ctx.db.insert('balanceSnapshots', {
      bankAccountId: params.bankAccountId,
      profileId: params.profileId,
      balance: params.balance,
      currency: params.currency,
      date,
      timestamp,
    })
  }
}

function getPowensConfig() {
  const baseUrl = process.env.POWENS_BASE_URL
  const clientId = process.env.POWENS_CLIENT_ID
  const clientSecret = process.env.POWENS_CLIENT_SECRET
  if (!baseUrl || !clientId || !clientSecret) {
    throw new Error('Powens environment variables not configured')
  }
  return { baseUrl, clientId, clientSecret }
}

export const createPowensUser = action({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    const { baseUrl, clientId, clientSecret } = getPowensConfig()

    const response = await fetch(`${baseUrl}/auth/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Powens auth/init failed: ${response.status} ${text}`)
    }

    const data = await response.json()
    const token = data.auth_token as string
    const powensUserId = data.id_user as number

    await ctx.runMutation(internal.powens.updateProfilePowensUser, {
      profileId: args.profileId,
      powensUserToken: token,
      powensUserId,
    })

    return { token, powensUserId }
  },
})

export const generateConnectUrl = action({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    const { baseUrl, clientId, clientSecret } = getPowensConfig()
    const siteUrl = process.env.SITE_URL
    if (!siteUrl) throw new Error('SITE_URL not configured')

    // Get profile to check for existing Powens user
    const profile = await ctx.runQuery(
      internal.powens.getProfileInternal,
      { profileId: args.profileId },
    )

    let token = profile?.powensUserToken

    // Create Powens user if needed
    if (!token) {
      const initResponse = await fetch(`${baseUrl}/auth/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
        }),
      })
      if (!initResponse.ok) {
        const text = await initResponse.text()
        throw new Error(`Powens auth/init failed: ${initResponse.status} ${text}`)
      }
      const initData = await initResponse.json()
      token = initData.auth_token as string
      await ctx.runMutation(internal.powens.updateProfilePowensUser, {
        profileId: args.profileId,
        powensUserToken: token,
        powensUserId: initData.id_user as number,
      })
    }

    // Get temporary code for webview
    const codeResponse = await fetch(`${baseUrl}/auth/token/code`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!codeResponse.ok) {
      const text = await codeResponse.text()
      throw new Error(
        `Powens auth/token/code failed: ${codeResponse.status} ${text}`,
      )
    }

    const codeData = await codeResponse.json()
    const code = codeData.code as string

    const redirectUri = `${siteUrl}/powens/callback`
    const connectUrl = `https://webview.powens.com/connect?domain=aurum-sandbox&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`

    return connectUrl
  },
})

export const getProfileInternal = internalQuery({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.profileId)
  },
})

export const updateProfilePowensUser = internalMutation({
  args: {
    profileId: v.id('profiles'),
    powensUserToken: v.string(),
    powensUserId: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, {
      powensUserToken: args.powensUserToken,
      powensUserId: args.powensUserId,
    })
  },
})

export const handleConnectionCallback = action({
  args: {
    connectionId: v.number(),
    profileId: v.id('profiles'),
  },
  returns: v.id('connections'),
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    const { baseUrl } = getPowensConfig()

    const profile = await ctx.runQuery(internal.powens.getProfileInternal, {
      profileId: args.profileId,
    })
    if (!profile?.powensUserToken) {
      throw new Error('Profile has no Powens user token')
    }

    // Fetch connection details with expanded connector
    const connResponse = await fetch(
      `${baseUrl}/users/me/connections/${args.connectionId}?expand=connector`,
      {
        headers: { Authorization: `Bearer ${profile.powensUserToken}` },
      },
    )

    if (!connResponse.ok) {
      const text = await connResponse.text()
      throw new Error(
        `Powens connection fetch failed: ${connResponse.status} ${text}`,
      )
    }

    const connData = await connResponse.json()

    // Store connection
    const connectionDocId: Id<'connections'> = await ctx.runMutation(
      internal.powens.upsertConnection,
      {
        profileId: args.profileId,
        powensConnectionId: args.connectionId,
        connectorName: connData.connector?.name ?? 'Unknown',
        connectorLogo: connData.connector?.logo ?? undefined,
        state: connData.state ?? undefined,
        lastSync: connData.last_update ?? undefined,
      },
    )

    // Sync bank accounts for this connection
    const acctResponse = await fetch(
      `${baseUrl}/users/me/connections/${args.connectionId}/accounts`,
      {
        headers: { Authorization: `Bearer ${profile.powensUserToken}` },
      },
    )

    if (acctResponse.ok) {
      const acctData = await acctResponse.json()
      const bankAccts = acctData.accounts ?? []

      for (const acct of bankAccts) {
        await ctx.runMutation(internal.powens.upsertBankAccount, {
          connectionId: connectionDocId,
          profileId: args.profileId,
          powensBankAccountId: acct.id,
          name: acct.original_name ?? acct.name ?? 'Unnamed Account',
          number: acct.number ?? undefined,
          iban: acct.iban ?? undefined,
          type: acct.type ?? undefined,
          balance: acct.balance ?? 0,
          currency: acct.currency?.id ?? 'EUR',
          disabled: acct.disabled ?? false,
          deleted: acct.deleted != null,
          lastSync: acct.last_update ?? undefined,
        })
      }
    }

    return connectionDocId
  },
})

export const upsertConnection = internalMutation({
  args: {
    profileId: v.id('profiles'),
    powensConnectionId: v.number(),
    connectorName: v.string(),
    connectorLogo: v.optional(v.string()),
    state: v.optional(v.string()),
    lastSync: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('connections')
      .withIndex('by_powensConnectionId', (q) =>
        q.eq('powensConnectionId', args.powensConnectionId),
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        connectorName: args.connectorName,
        connectorLogo: args.connectorLogo,
        state: args.state,
        lastSync: args.lastSync,
      })
      return existing._id
    }

    return await ctx.db.insert('connections', {
      profileId: args.profileId,
      powensConnectionId: args.powensConnectionId,
      connectorName: args.connectorName,
      connectorLogo: args.connectorLogo,
      state: args.state,
      lastSync: args.lastSync,
    })
  },
})

export const upsertBankAccount = internalMutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('bankAccounts')
      .withIndex('by_connectionId', (q) =>
        q.eq('connectionId', args.connectionId),
      )
      .filter((q) =>
        q.eq(q.field('powensBankAccountId'), args.powensBankAccountId),
      )
      .first()

    let bankAccountId: Id<'bankAccounts'>
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        number: args.number,
        iban: args.iban,
        type: args.type,
        balance: args.balance,
        currency: args.currency,
        disabled: args.disabled,
        deleted: args.deleted,
        lastSync: args.lastSync,
      })
      bankAccountId = existing._id
    } else {
      bankAccountId = await ctx.db.insert('bankAccounts', args)
    }

    await recordBalanceSnapshot(ctx, {
      bankAccountId,
      profileId: args.profileId,
      balance: args.balance,
      currency: args.currency,
    })

    return bankAccountId
  },
})

export const findProfileByPowensUserId = internalQuery({
  args: { powensUserId: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('profiles')
      .withIndex('by_powensUserId', (q) =>
        q.eq('powensUserId', args.powensUserId),
      )
      .first()
  },
})

export const syncConnectionFromWebhook = internalMutation({
  args: {
    profileId: v.id('profiles'),
    powensConnectionId: v.number(),
    connectorName: v.string(),
    connectorColor: v.optional(v.string()),
    state: v.optional(v.string()),
    lastSync: v.optional(v.string()),
    bankAccounts: v.array(
      v.object({
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
      }),
    ),
  },
  handler: async (ctx, args) => {
    // Upsert connection
    const existingConn = await ctx.db
      .query('connections')
      .withIndex('by_powensConnectionId', (q) =>
        q.eq('powensConnectionId', args.powensConnectionId),
      )
      .first()

    let connectionId: Id<'connections'>
    if (existingConn) {
      await ctx.db.patch(existingConn._id, {
        connectorName: args.connectorName,
        state: args.state,
        lastSync: args.lastSync,
      })
      connectionId = existingConn._id
    } else {
      connectionId = await ctx.db.insert('connections', {
        profileId: args.profileId,
        powensConnectionId: args.powensConnectionId,
        connectorName: args.connectorName,
        state: args.state,
        lastSync: args.lastSync,
      })
    }

    // Upsert bank accounts
    for (const acct of args.bankAccounts) {
      const existing = await ctx.db
        .query('bankAccounts')
        .withIndex('by_connectionId', (q) =>
          q.eq('connectionId', connectionId),
        )
        .filter((q) =>
          q.eq(q.field('powensBankAccountId'), acct.powensBankAccountId),
        )
        .first()

      let bankAccountId: Id<'bankAccounts'>
      if (existing) {
        await ctx.db.patch(existing._id, {
          name: acct.name,
          number: acct.number,
          iban: acct.iban,
          type: acct.type,
          balance: acct.balance,
          currency: acct.currency,
          disabled: acct.disabled,
          deleted: acct.deleted,
          lastSync: acct.lastSync,
        })
        bankAccountId = existing._id
      } else {
        bankAccountId = await ctx.db.insert('bankAccounts', {
          connectionId,
          profileId: args.profileId,
          ...acct,
        })
      }

      await recordBalanceSnapshot(ctx, {
        bankAccountId,
        profileId: args.profileId,
        balance: acct.balance,
        currency: acct.currency,
      })
    }
  },
})

export const deleteConnection = action({
  args: {
    connectionId: v.id('connections'),
    profileId: v.id('profiles'),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    const { baseUrl } = getPowensConfig()

    const profile = await ctx.runQuery(internal.powens.getProfileInternal, {
      profileId: args.profileId,
    })

    const connection = await ctx.runQuery(
      internal.powens.getConnectionInternal,
      { connectionId: args.connectionId },
    )

    // Delete from Powens if we have a token and a Powens connection ID
    if (profile?.powensUserToken && connection?.powensConnectionId) {
      const response = await fetch(
        `${baseUrl}/users/me/connections/${connection.powensConnectionId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${profile.powensUserToken}` },
        },
      )
      if (!response.ok && response.status !== 404) {
        const text = await response.text()
        throw new Error(
          `Powens connection delete failed: ${response.status} ${text}`,
        )
      }
    }

    // Delete local data
    await ctx.runMutation(internal.powens.deleteConnectionData, {
      connectionId: args.connectionId,
    })
  },
})

export const getConnectionInternal = internalQuery({
  args: { connectionId: v.id('connections') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.connectionId)
  },
})

export const deleteConnectionData = internalMutation({
  args: { connectionId: v.id('connections') },
  handler: async (ctx, args) => {
    // Delete all bank accounts and their snapshots for this connection
    const bankAccounts = await ctx.db
      .query('bankAccounts')
      .withIndex('by_connectionId', (q) =>
        q.eq('connectionId', args.connectionId),
      )
      .collect()
    for (const ba of bankAccounts) {
      const snapshots = await ctx.db
        .query('balanceSnapshots')
        .withIndex('by_bankAccountId_timestamp', (q) =>
          q.eq('bankAccountId', ba._id),
        )
        .collect()
      for (const snap of snapshots) {
        await ctx.db.delete(snap._id)
      }
      await ctx.db.delete(ba._id)
    }
    // Delete the connection itself
    await ctx.db.delete(args.connectionId)
  },
})

export const listConnections = query({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return await ctx.db
      .query('connections')
      .withIndex('by_profileId', (q) => q.eq('profileId', args.profileId))
      .collect()
  },
})

export const listBankAccounts = query({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const accounts = await ctx.db
      .query('bankAccounts')
      .withIndex('by_profileId', (q) => q.eq('profileId', args.profileId))
      .collect()
    const connectionIds = [...new Set(accounts.map((a) => a.connectionId))]
    const connections = await Promise.all(
      connectionIds.map((id) => ctx.db.get(id)),
    )
    const connMap = new Map(
      connections.filter((c): c is NonNullable<typeof c> => c !== null).map((c) => [c._id, c]),
    )
    return accounts.map((a) => ({
      ...a,
      connectorName: connMap.get(a.connectionId)?.connectorName ?? undefined,
    }))
  },
})

export const getBankAccount = query({
  args: { bankAccountId: v.id('bankAccounts') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const account = await ctx.db.get(args.bankAccountId)
    if (!account) return null
    const connection = await ctx.db.get(account.connectionId)
    return {
      ...account,
      connectorName: connection?.connectorName ?? undefined,
    }
  },
})
