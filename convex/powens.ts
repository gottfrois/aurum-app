import { v } from 'convex/values'
import { action, internalMutation, internalQuery, query } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { getAuthUserId, requireAuthUserId } from './lib/auth'

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
  args: { accountId: v.id('accounts') },
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

    await ctx.runMutation(internal.powens.updateAccountPowensUser, {
      accountId: args.accountId,
      powensUserToken: token,
      powensUserId,
    })

    return { token, powensUserId }
  },
})

export const generateConnectUrl = action({
  args: { accountId: v.id('accounts') },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    const { baseUrl, clientId, clientSecret } = getPowensConfig()
    const siteUrl = process.env.SITE_URL
    if (!siteUrl) throw new Error('SITE_URL not configured')

    // Get account to check for existing Powens user
    const account = await ctx.runQuery(
      internal.powens.getAccountInternal,
      { accountId: args.accountId },
    )

    let token = account?.powensUserToken

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
      await ctx.runMutation(internal.powens.updateAccountPowensUser, {
        accountId: args.accountId,
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

export const getAccountInternal = internalQuery({
  args: { accountId: v.id('accounts') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.accountId)
  },
})

export const updateAccountPowensUser = internalMutation({
  args: {
    accountId: v.id('accounts'),
    powensUserToken: v.string(),
    powensUserId: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accountId, {
      powensUserToken: args.powensUserToken,
      powensUserId: args.powensUserId,
    })
  },
})

export const handleConnectionCallback = action({
  args: {
    connectionId: v.number(),
    accountId: v.id('accounts'),
  },
  returns: v.id('connections'),
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    const { baseUrl } = getPowensConfig()

    const account = await ctx.runQuery(internal.powens.getAccountInternal, {
      accountId: args.accountId,
    })
    if (!account?.powensUserToken) {
      throw new Error('Account has no Powens user token')
    }

    // Fetch connection details
    const connResponse = await fetch(
      `${baseUrl}/users/me/connections/${args.connectionId}`,
      {
        headers: { Authorization: `Bearer ${account.powensUserToken}` },
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
        accountId: args.accountId,
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
        headers: { Authorization: `Bearer ${account.powensUserToken}` },
      },
    )

    if (acctResponse.ok) {
      const acctData = await acctResponse.json()
      const bankAccts = acctData.accounts ?? []

      for (const acct of bankAccts) {
        await ctx.runMutation(internal.powens.upsertBankAccount, {
          connectionId: connectionDocId,
          accountId: args.accountId,
          powensBankAccountId: acct.id,
          name: acct.name ?? 'Unnamed Account',
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
    accountId: v.id('accounts'),
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
      accountId: args.accountId,
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
      return existing._id
    }

    return await ctx.db.insert('bankAccounts', args)
  },
})

export const findAccountByPowensUserId = internalQuery({
  args: { powensUserId: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('accounts')
      .withIndex('by_powensUserId', (q) =>
        q.eq('powensUserId', args.powensUserId),
      )
      .first()
  },
})

export const syncConnectionFromWebhook = internalMutation({
  args: {
    accountId: v.id('accounts'),
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
        accountId: args.accountId,
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
      } else {
        await ctx.db.insert('bankAccounts', {
          connectionId,
          accountId: args.accountId,
          ...acct,
        })
      }
    }
  },
})

export const listBankAccounts = query({
  args: { accountId: v.id('accounts') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return await ctx.db
      .query('bankAccounts')
      .withIndex('by_accountId', (q) => q.eq('accountId', args.accountId))
      .collect()
  },
})
