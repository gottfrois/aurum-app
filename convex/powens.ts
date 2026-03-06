import { v } from 'convex/values'
import { action, internalAction, internalMutation, internalQuery, query } from './_generated/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { getAuthUserId, requireAuthUserId } from './lib/auth'
import { encryptForProfile } from './lib/serverCrypto'

const INVESTMENT_TYPES = ['market', 'pea', 'pee']

async function recordBalanceSnapshot(
  ctx: MutationCtx,
  params: {
    bankAccountId: Id<'bankAccounts'>
    profileId: Id<'profiles'>
    balance: number
    currency: string
    encryptedData?: string
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
    await ctx.db.patch(existing._id, {
      balance: params.balance,
      encryptedData: params.encryptedData,
    })
  } else {
    await ctx.db.insert('balanceSnapshots', {
      bankAccountId: params.bankAccountId,
      profileId: params.profileId,
      balance: params.balance,
      currency: params.currency,
      date,
      timestamp,
      encryptedData: params.encryptedData,
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

export const generateManageUrl = action({
  args: {
    connectionId: v.id('connections'),
    profileId: v.id('profiles'),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    await requireAuthUserId(ctx)
    const { baseUrl, clientId } = getPowensConfig()
    const siteUrl = process.env.SITE_URL
    if (!siteUrl) throw new Error('SITE_URL not configured')

    const profile = await ctx.runQuery(internal.powens.getProfileInternal, {
      profileId: args.profileId,
    })
    if (!profile?.powensUserToken) {
      throw new Error('Profile has no Powens user token')
    }

    const connection: Doc<'connections'> | null = await ctx.runQuery(
      internal.powens.getConnectionInternal,
      { connectionId: args.connectionId },
    )
    if (!connection?.powensConnectionId) {
      throw new Error('Connection not found')
    }

    // Get temporary code for webview
    const codeResponse = await fetch(`${baseUrl}/auth/token/code`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${profile.powensUserToken}` },
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
    return `https://webview.powens.com/manage?domain=aurum-sandbox&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}&connection_id=${connection.powensConnectionId}`
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

    // Check if encryption is enabled
    const publicKey: string | null = await ctx.runQuery(
      internal.encryptionKeys.getPublicKeyForProfile,
      { profileId: args.profileId },
    )

    // Store connection
    const realConnectorName = connData.connector?.name ?? 'Unknown'
    let connectionEncryptedData: string | undefined
    if (publicKey) {
      connectionEncryptedData = await encryptForProfile(
        { connectorName: realConnectorName },
        publicKey,
      )
    }

    const connectionDocId: Id<'connections'> = await ctx.runMutation(
      internal.powens.upsertConnection,
      {
        profileId: args.profileId,
        powensConnectionId: args.connectionId,
        connectorName: publicKey ? 'Encrypted' : realConnectorName,
        state: connData.state ?? undefined,
        lastSync: connData.last_update ?? undefined,
        encryptedData: connectionEncryptedData,
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
        const number = acct.number ?? undefined
        const iban = acct.iban ?? undefined
        const balance = acct.balance ?? 0
        const name = acct.original_name ?? acct.name ?? 'Unnamed Account'

        let encryptedData: string | undefined
        if (publicKey) {
          encryptedData = await encryptForProfile(
            { name, number, iban, balance },
            publicKey,
          )
        }

        const bankAccountId = await ctx.runMutation(internal.powens.upsertBankAccount, {
          connectionId: connectionDocId,
          profileId: args.profileId,
          powensBankAccountId: acct.id,
          name: publicKey ? 'Encrypted' : name,
          number: publicKey ? undefined : number,
          iban: publicKey ? undefined : iban,
          type: acct.type ?? undefined,
          balance: publicKey ? 0 : balance,
          currency: acct.currency?.id ?? 'EUR',
          disabled: acct.disabled ?? false,
          deleted: acct.deleted != null,
          lastSync: acct.last_update ?? undefined,
          encryptedData,
        })

        if (INVESTMENT_TYPES.includes(acct.type ?? '')) {
          const investmentsResponse = await fetch(
            `${baseUrl}/users/me/accounts/${acct.id}/investments`,
            { headers: { Authorization: `Bearer ${profile.powensUserToken}` } },
          )
          if (investmentsResponse.ok) {
            const investmentsData = await investmentsResponse.json()
            const rawInvestments = (investmentsData.investments ?? []).map(mapPowensInvestment)

            let investments = rawInvestments
            if (publicKey) {
              investments = await Promise.all(
                rawInvestments.map(async (inv: ReturnType<typeof mapPowensInvestment>) => {
                  const encData = await encryptForProfile(
                    {
                      code: inv.code,
                      label: inv.label,
                      description: inv.description,
                      quantity: inv.quantity,
                      unitprice: inv.unitprice,
                      unitvalue: inv.unitvalue,
                      valuation: inv.valuation,
                      portfolioShare: inv.portfolioShare,
                      diff: inv.diff,
                      diffPercent: inv.diffPercent,
                    },
                    publicKey,
                  )
                  return {
                    ...inv,
                    code: undefined,
                    label: 'Encrypted',
                    description: undefined,
                    quantity: 0,
                    unitprice: 0,
                    unitvalue: 0,
                    valuation: 0,
                    portfolioShare: undefined,
                    diff: undefined,
                    diffPercent: undefined,
                    encryptedData: encData,
                  }
                }),
              )
            }

            await ctx.runMutation(internal.powens.upsertInvestments, {
              bankAccountId,
              profileId: args.profileId,
              investments,
            })
          }
        }
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
    state: v.optional(v.string()),
    lastSync: v.optional(v.string()),
    encryptedData: v.optional(v.string()),
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
        state: args.state,
        lastSync: args.lastSync,
        encryptedData: args.encryptedData,
      })
      return existing._id
    }

    return await ctx.db.insert('connections', {
      profileId: args.profileId,
      powensConnectionId: args.powensConnectionId,
      connectorName: args.connectorName,
      state: args.state,
      lastSync: args.lastSync,
      encryptedData: args.encryptedData,
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
    encryptedData: v.optional(v.string()),
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
        encryptedData: args.encryptedData,
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
      encryptedData: args.encryptedData,
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
    state: v.optional(v.string()),
    lastSync: v.optional(v.string()),
    encryptedData: v.optional(v.string()),
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
        encryptedData: v.optional(v.string()),
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
        encryptedData: args.encryptedData,
      })
      connectionId = existingConn._id
    } else {
      connectionId = await ctx.db.insert('connections', {
        profileId: args.profileId,
        powensConnectionId: args.powensConnectionId,
        connectorName: args.connectorName,
        state: args.state,
        lastSync: args.lastSync,
        encryptedData: args.encryptedData,
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
          encryptedData: acct.encryptedData,
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
        encryptedData: acct.encryptedData,
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
      profileId: args.profileId,
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
  args: {
    connectionId: v.id('connections'),
    profileId: v.id('profiles'),
  },
  handler: async (ctx, args) => {
    const [bankAccounts, snapshots, investments] = await Promise.all([
      ctx.db
        .query('bankAccounts')
        .withIndex('by_connectionId', (q) =>
          q.eq('connectionId', args.connectionId),
        )
        .collect(),
      ctx.db
        .query('balanceSnapshots')
        .withIndex('by_profileId_timestamp', (q) =>
          q.eq('profileId', args.profileId),
        )
        .collect(),
      ctx.db
        .query('investments')
        .withIndex('by_profileId', (q) =>
          q.eq('profileId', args.profileId),
        )
        .collect(),
    ])

    const bankAccountIds = new Set(bankAccounts.map((ba) => ba._id))

    await Promise.all([
      ...snapshots
        .filter((s) => bankAccountIds.has(s.bankAccountId))
        .map((s) => ctx.db.delete(s._id)),
      ...investments
        .filter((i) => bankAccountIds.has(i.bankAccountId))
        .map((i) => ctx.db.delete(i._id)),
      ...bankAccounts.map((ba) => ctx.db.delete(ba._id)),
      ctx.db.delete(args.connectionId),
    ])
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

export const listAllConnections = query({
  args: { profileIds: v.array(v.id('profiles')) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const results = await Promise.all(
      args.profileIds.map((profileId) =>
        ctx.db
          .query('connections')
          .withIndex('by_profileId', (q) => q.eq('profileId', profileId))
          .collect(),
      ),
    )
    return results.flat()
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
    return accounts.map((a) => {
      const conn = connMap.get(a.connectionId)
      return {
        ...a,
        connectorName: conn?.connectorName ?? undefined,
        connectionEncryptedData: conn?.encryptedData ?? undefined,
      }
    })
  },
})

export const listAllBankAccounts = query({
  args: { profileIds: v.array(v.id('profiles')) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const allAccounts = await Promise.all(
      args.profileIds.map((profileId) =>
        ctx.db
          .query('bankAccounts')
          .withIndex('by_profileId', (q) => q.eq('profileId', profileId))
          .collect(),
      ),
    )
    const accounts = allAccounts.flat()
    const connectionIds = [...new Set(accounts.map((a) => a.connectionId))]
    const connections = await Promise.all(
      connectionIds.map((id) => ctx.db.get(id)),
    )
    const connMap = new Map(
      connections.filter((c): c is NonNullable<typeof c> => c !== null).map((c) => [c._id, c]),
    )
    return accounts.map((a) => {
      const conn = connMap.get(a.connectionId)
      return {
        ...a,
        connectorName: conn?.connectorName ?? undefined,
        connectionEncryptedData: conn?.encryptedData ?? undefined,
      }
    })
  },
})

function mapPowensInvestment(raw: Record<string, unknown>) {
  return {
    powensInvestmentId: raw.id as number,
    code: (raw.code as string) ?? undefined,
    codeType: (raw.code_type as string) ?? undefined,
    label: (raw.label as string) ?? 'Unknown',
    description: (raw.description as string) ?? undefined,
    quantity: (raw.quantity as number) ?? 0,
    unitprice: (raw.unitprice as number) ?? 0,
    unitvalue: (raw.unitvalue as number) ?? 0,
    valuation: (raw.valuation as number) ?? 0,
    portfolioShare: (raw.portfolio_share as number) ?? undefined,
    diff: (raw.diff as number) ?? undefined,
    diffPercent: (raw.diff_percent as number) ?? undefined,
    originalCurrency:
      ((raw.original_currency as Record<string, unknown>)?.id as string) ??
      undefined,
    originalValuation: (raw.original_valuation as number) ?? undefined,
    vdate: (raw.vdate as string) ?? undefined,
    deleted: raw.deleted != null,
  }
}

export const upsertInvestments = internalMutation({
  args: {
    bankAccountId: v.id('bankAccounts'),
    profileId: v.id('profiles'),
    investments: v.array(
      v.object({
        powensInvestmentId: v.number(),
        code: v.optional(v.string()),
        codeType: v.optional(v.string()),
        label: v.string(),
        description: v.optional(v.string()),
        quantity: v.number(),
        unitprice: v.number(),
        unitvalue: v.number(),
        valuation: v.number(),
        portfolioShare: v.optional(v.number()),
        diff: v.optional(v.number()),
        diffPercent: v.optional(v.number()),
        originalCurrency: v.optional(v.string()),
        originalValuation: v.optional(v.number()),
        vdate: v.optional(v.string()),
        deleted: v.boolean(),
        encryptedData: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const inv of args.investments) {
      const existing = await ctx.db
        .query('investments')
        .withIndex('by_powensInvestmentId', (q) =>
          q.eq('powensInvestmentId', inv.powensInvestmentId),
        )
        .first()

      const { encryptedData, ...invFields } = inv
      if (existing) {
        await ctx.db.patch(existing._id, {
          ...invFields,
          bankAccountId: args.bankAccountId,
          profileId: args.profileId,
          encryptedData,
        })
      } else {
        await ctx.db.insert('investments', {
          bankAccountId: args.bankAccountId,
          profileId: args.profileId,
          ...invFields,
          encryptedData,
        })
      }
    }
  },
})

export const listBankAccountsByConnection = internalQuery({
  args: { connectionId: v.id('connections') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('bankAccounts')
      .withIndex('by_connectionId', (q) =>
        q.eq('connectionId', args.connectionId),
      )
      .collect()
  },
})

export const syncInvestmentsFromWebhook = internalAction({
  args: {
    profileId: v.id('profiles'),
    powensConnectionId: v.number(),
  },
  handler: async (ctx, args) => {
    const { baseUrl } = getPowensConfig()

    const profile = await ctx.runQuery(internal.powens.getProfileInternal, {
      profileId: args.profileId,
    })
    if (!profile?.powensUserToken) return

    const publicKey: string | null = await ctx.runQuery(
      internal.encryptionKeys.getPublicKeyForProfile,
      { profileId: args.profileId },
    )

    // Find the connection doc
    const connection = await ctx.runQuery(
      internal.powens.findConnectionByPowensId,
      { powensConnectionId: args.powensConnectionId },
    )
    if (!connection) return

    const bankAccounts = await ctx.runQuery(
      internal.powens.listBankAccountsByConnection,
      { connectionId: connection._id },
    )

    for (const ba of bankAccounts) {
      if (!INVESTMENT_TYPES.includes(ba.type ?? '')) continue

      const response = await fetch(
        `${baseUrl}/users/me/accounts/${ba.powensBankAccountId}/investments`,
        { headers: { Authorization: `Bearer ${profile.powensUserToken}` } },
      )

      if (!response.ok) continue

      const data = await response.json()
      const rawInvestments = (data.investments ?? []).map(mapPowensInvestment)

      let investments = rawInvestments
      if (publicKey) {
        investments = await Promise.all(
          rawInvestments.map(async (inv: ReturnType<typeof mapPowensInvestment>) => {
            const encData = await encryptForProfile(
              {
                code: inv.code,
                label: inv.label,
                description: inv.description,
                quantity: inv.quantity,
                unitprice: inv.unitprice,
                unitvalue: inv.unitvalue,
                valuation: inv.valuation,
                portfolioShare: inv.portfolioShare,
                diff: inv.diff,
                diffPercent: inv.diffPercent,
              },
              publicKey,
            )
            return {
              ...inv,
              code: undefined,
              label: 'Encrypted',
              description: undefined,
              quantity: 0,
              unitprice: 0,
              unitvalue: 0,
              valuation: 0,
              portfolioShare: undefined,
              diff: undefined,
              diffPercent: undefined,
              encryptedData: encData,
            }
          }),
        )
      }

      await ctx.runMutation(internal.powens.upsertInvestments, {
        bankAccountId: ba._id,
        profileId: args.profileId,
        investments,
      })
    }
  },
})

export const findConnectionByPowensId = internalQuery({
  args: { powensConnectionId: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('connections')
      .withIndex('by_powensConnectionId', (q) =>
        q.eq('powensConnectionId', args.powensConnectionId),
      )
      .first()
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
      connectionEncryptedData: connection?.encryptedData ?? undefined,
    }
  },
})
