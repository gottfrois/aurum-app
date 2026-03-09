import { v } from 'convex/values'
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from './_generated/server'
import { internal } from './_generated/api'
import { getAuthUserId, requireAuthUserId } from './lib/auth'
import { getCategoryKey } from './lib/accountCategories'
import { encryptForProfile } from './lib/serverCrypto'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'

interface PowensAuthResponse {
  auth_token: string
  id_user: number
}

interface PowensCodeResponse {
  code: string
}

interface PowensConnectionResponse {
  connector?: { name?: string | null } | null
  state?: string | null
  last_update?: string | null
}

interface PowensAccountResponse {
  accounts?: Array<PowensAccount> | null
}

interface PowensAccount {
  id: number
  number?: string | null
  iban?: string | null
  balance?: number | null
  original_name?: string | null
  name?: string | null
  type?: string | null
  currency?: { id?: string | null } | null
  disabled?: boolean | null
  deleted?: unknown
  last_update?: string | null
}

interface PowensTransactionResponse {
  transactions?: Array<PowensRawTransaction>
}

interface PowensRawTransaction {
  id: number
  date?: string
  rdate?: string
  vdate?: string
  value?: number
  original_value?: number
  original_currency?: { id?: string }
  type?: string
  original_wording?: string
  simplified_wording?: string
  wording?: string
  category?: { id?: number; name?: string; parent?: { name?: string } }
  coming?: boolean
  active?: boolean
  deleted?: unknown
  counterparty?: string
  card?: string
  comment?: string
}

interface PowensInvestmentResponse {
  investments?: Array<PowensRawInvestment>
}

interface PowensRawInvestment {
  id: number
  code?: string
  code_type?: string
  label?: string
  description?: string
  quantity?: number
  unitprice?: number
  unitvalue?: number
  valuation?: number
  portfolio_share?: number
  diff?: number
  diff_percent?: number
  original_currency?: { id?: string }
  original_valuation?: number
  vdate?: string
  deleted?: unknown
}

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

  const oldBalance = existing?.balance ?? 0

  if (existing) {
    await ctx.db.patch('balanceSnapshots', existing._id, {
      balance: params.balance,
      encryptedData: params.encryptedData,
      encrypted: !!params.encryptedData,
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
      encrypted: !!params.encryptedData,
    })
  }

  const [profile, bankAccount] = await Promise.all([
    ctx.db.get('profiles', params.profileId),
    ctx.db.get('bankAccounts', params.bankAccountId),
  ])
  if (!profile) throw new Error('Profile not found')

  const balanceDelta = params.balance - oldBalance

  await Promise.all([
    updateDailyNetWorth(ctx, {
      profileId: params.profileId,
      workspaceId: profile.workspaceId,
      date,
      timestamp,
      balanceDelta,
      currency: params.currency,
    }),
    updateDailyCategoryBalance(ctx, {
      profileId: params.profileId,
      workspaceId: profile.workspaceId,
      category: getCategoryKey(bankAccount?.type),
      date,
      timestamp,
      balanceDelta,
      currency: params.currency,
    }),
  ])
}

async function updateDailyNetWorth(
  ctx: MutationCtx,
  params: {
    profileId: Id<'profiles'>
    workspaceId: Id<'workspaces'>
    date: string
    timestamp: number
    balanceDelta: number
    currency: string
  },
) {
  const existing = await ctx.db
    .query('dailyNetWorth')
    .withIndex('by_profileId_date', (q) =>
      q.eq('profileId', params.profileId).eq('date', params.date),
    )
    .first()

  if (existing) {
    await ctx.db.patch('dailyNetWorth', existing._id, {
      balance: Math.round((existing.balance + params.balanceDelta) * 100) / 100,
    })
  } else {
    await ctx.db.insert('dailyNetWorth', {
      profileId: params.profileId,
      workspaceId: params.workspaceId,
      date: params.date,
      timestamp: params.timestamp,
      balance: Math.round(params.balanceDelta * 100) / 100,
      currency: params.currency,
    })
  }
}

async function updateDailyCategoryBalance(
  ctx: MutationCtx,
  params: {
    profileId: Id<'profiles'>
    workspaceId: Id<'workspaces'>
    category: string
    date: string
    timestamp: number
    balanceDelta: number
    currency: string
  },
) {
  const existing = await ctx.db
    .query('dailyCategoryBalance')
    .withIndex('by_profileId_category_date', (q) =>
      q
        .eq('profileId', params.profileId)
        .eq('category', params.category)
        .eq('date', params.date),
    )
    .first()

  if (existing) {
    await ctx.db.patch('dailyCategoryBalance', existing._id, {
      balance: Math.round((existing.balance + params.balanceDelta) * 100) / 100,
    })
  } else {
    await ctx.db.insert('dailyCategoryBalance', {
      profileId: params.profileId,
      workspaceId: params.workspaceId,
      category: params.category,
      date: params.date,
      timestamp: params.timestamp,
      balance: Math.round(params.balanceDelta * 100) / 100,
      currency: params.currency,
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

    const data = (await response.json()) as PowensAuthResponse
    const token = data.auth_token
    const powensUserId = data.id_user

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
    const profile = await ctx.runQuery(internal.powens.getProfileInternal, {
      profileId: args.profileId,
    })

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
        throw new Error(
          `Powens auth/init failed: ${initResponse.status} ${text}`,
        )
      }
      const initData = (await initResponse.json()) as PowensAuthResponse
      token = initData.auth_token
      await ctx.runMutation(internal.powens.updateProfilePowensUser, {
        profileId: args.profileId,
        powensUserToken: token,
        powensUserId: initData.id_user,
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

    const codeData = (await codeResponse.json()) as PowensCodeResponse
    const code = codeData.code

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

    const codeData = (await codeResponse.json()) as PowensCodeResponse
    const code = codeData.code

    const redirectUri = `${siteUrl}/powens/callback`
    return `https://webview.powens.com/manage?domain=aurum-sandbox&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}&connection_id=${connection.powensConnectionId}`
  },
})

export const getProfileInternal = internalQuery({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, args) => {
    return await ctx.db.get('profiles', args.profileId)
  },
})

export const updateProfilePowensUser = internalMutation({
  args: {
    profileId: v.id('profiles'),
    powensUserToken: v.string(),
    powensUserId: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch('profiles', args.profileId, {
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

    const connData = (await connResponse.json()) as PowensConnectionResponse

    // Check if encryption is enabled
    const publicKey: string | null = await ctx.runQuery(
      internal.encryptionKeys.getPublicKeyForProfile,
      { profileId: args.profileId },
    )

    // Store connection (without encrypted data first to get ID)
    const realConnectorName = connData.connector?.name ?? 'Unknown'

    const connectionDocId: Id<'connections'> = await ctx.runMutation(
      internal.powens.upsertConnection,
      {
        profileId: args.profileId,
        powensConnectionId: args.connectionId,
        connectorName: publicKey ? 'Encrypted' : realConnectorName,
        state: connData.state ?? undefined,
        lastSync: connData.last_update ?? undefined,
        encryptedData: undefined,
      },
    )

    // Encrypt connection data with AAD using the record ID
    if (publicKey) {
      const connectionEncryptedData = await encryptForProfile(
        { connectorName: realConnectorName },
        publicKey,
        connectionDocId,
      )
      await ctx.runMutation(
        internal.encryptionKeys.patchConnectionEncryptedData,
        {
          items: [
            { id: connectionDocId, encryptedData: connectionEncryptedData },
          ],
        },
      )
    }

    // Sync bank accounts for this connection
    const acctResponse = await fetch(
      `${baseUrl}/users/me/connections/${args.connectionId}/accounts`,
      {
        headers: { Authorization: `Bearer ${profile.powensUserToken}` },
      },
    )

    if (acctResponse.ok) {
      const acctData = (await acctResponse.json()) as PowensAccountResponse
      const bankAccts = acctData.accounts ?? []

      for (const acct of bankAccts) {
        const number = acct.number
        const iban = acct.iban
        const balance = acct.balance ?? 0
        const name = acct.original_name ?? acct.name ?? 'Unnamed Account'

        // Upsert without encrypted data first to get ID
        const bankAccountId = await ctx.runMutation(
          internal.powens.upsertBankAccount,
          {
            connectionId: connectionDocId,
            profileId: args.profileId,
            powensBankAccountId: acct.id,
            name: publicKey ? 'Encrypted' : name,
            number: publicKey ? undefined : (number ?? undefined),
            iban: publicKey ? undefined : (iban ?? undefined),
            type: acct.type ?? undefined,
            balance: publicKey ? 0 : balance,
            currency: acct.currency?.id ?? 'EUR',
            disabled: acct.disabled ?? false,
            deleted: acct.deleted != null,
            lastSync: acct.last_update ?? undefined,
            encryptedData: undefined,
          },
        )

        // Encrypt bank account data with AAD
        if (publicKey) {
          const encryptedData = await encryptForProfile(
            { name, number, iban, balance },
            publicKey,
            bankAccountId,
          )
          await ctx.runMutation(
            internal.encryptionKeys.patchBankAccountEncryptedData,
            { items: [{ id: bankAccountId, encryptedData }] },
          )
        }

        if (INVESTMENT_TYPES.includes(acct.type ?? '')) {
          const investmentsResponse = await fetch(
            `${baseUrl}/users/me/accounts/${acct.id}/investments`,
            { headers: { Authorization: `Bearer ${profile.powensUserToken}` } },
          )
          if (investmentsResponse.ok) {
            const investmentsData =
              (await investmentsResponse.json()) as PowensInvestmentResponse
            const rawInvestments = (investmentsData.investments ?? []).map(
              mapPowensInvestment,
            )

            if (publicKey) {
              // Upsert without encrypted data to get IDs
              const plainInvestments = rawInvestments.map((inv) => ({
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
                encryptedData: undefined,
              }))

              const investmentIds = (await ctx.runMutation(
                internal.powens.upsertInvestments,
                {
                  bankAccountId,
                  profileId: args.profileId,
                  investments: plainInvestments,
                },
              )) as Array<{
                powensInvestmentId: number
                id: Id<'investments'>
              }>

              // Encrypt with AAD and patch
              const patches: Array<{
                id: Id<'investments'>
                encryptedData: string
              }> = []
              for (const inv of rawInvestments) {
                const idEntry = investmentIds.find(
                  (e) => e.powensInvestmentId === inv.powensInvestmentId,
                )
                if (!idEntry) continue

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
                  idEntry.id,
                )
                patches.push({ id: idEntry.id, encryptedData: encData })
              }

              if (patches.length > 0) {
                await ctx.runMutation(
                  internal.encryptionKeys.patchInvestmentEncryptedData,
                  { items: patches },
                )
              }
            } else {
              await ctx.runMutation(internal.powens.upsertInvestments, {
                bankAccountId,
                profileId: args.profileId,
                investments: rawInvestments,
              })
            }
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
      await ctx.db.patch('connections', existing._id, {
        connectorName: args.connectorName,
        state: args.state,
        lastSync: args.lastSync,
        encryptedData: args.encryptedData,
        encrypted: !!args.encryptedData,
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
      encrypted: !!args.encryptedData,
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

    const encrypted = !!args.encryptedData
    let bankAccountId: Id<'bankAccounts'>
    if (existing) {
      await ctx.db.patch('bankAccounts', existing._id, {
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
        encrypted,
      })
      bankAccountId = existing._id
    } else {
      bankAccountId = await ctx.db.insert('bankAccounts', {
        ...args,
        encrypted,
      })
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
      await ctx.db.patch('connections', existingConn._id, {
        connectorName: args.connectorName,
        state: args.state,
        lastSync: args.lastSync,
        encryptedData: args.encryptedData,
        encrypted: !!args.encryptedData,
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
        encrypted: !!args.encryptedData,
      })
    }

    // Upsert bank accounts and collect IDs
    const bankAccountIds: Array<{
      powensBankAccountId: number
      id: Id<'bankAccounts'>
    }> = []
    for (const acct of args.bankAccounts) {
      const existing = await ctx.db
        .query('bankAccounts')
        .withIndex('by_connectionId', (q) => q.eq('connectionId', connectionId))
        .filter((q) =>
          q.eq(q.field('powensBankAccountId'), acct.powensBankAccountId),
        )
        .first()

      const acctEncrypted = !!acct.encryptedData
      let bankAccountId: Id<'bankAccounts'>
      if (existing) {
        await ctx.db.patch('bankAccounts', existing._id, {
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
          encrypted: acctEncrypted,
        })
        bankAccountId = existing._id
      } else {
        bankAccountId = await ctx.db.insert('bankAccounts', {
          connectionId,
          profileId: args.profileId,
          ...acct,
          encrypted: acctEncrypted,
        })
      }

      bankAccountIds.push({
        powensBankAccountId: acct.powensBankAccountId,
        id: bankAccountId,
      })

      await recordBalanceSnapshot(ctx, {
        bankAccountId,
        profileId: args.profileId,
        balance: acct.balance,
        currency: acct.currency,
        encryptedData: acct.encryptedData,
      })
    }

    return { connectionId, bankAccountIds }
  },
})

export const updateConnectionState = internalMutation({
  args: {
    powensConnectionId: v.number(),
    state: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('connections')
      .withIndex('by_powensConnectionId', (q) =>
        q.eq('powensConnectionId', args.powensConnectionId),
      )
      .first()

    if (existing) {
      await ctx.db.patch('connections', existing._id, {
        state: args.state,
      })
      console.log(
        `[powens] Updated connection ${args.powensConnectionId} state to: ${args.state ?? 'null'}`,
      )
    } else {
      console.warn(
        `[powens] No connection found for powensConnectionId ${args.powensConnectionId} — cannot update state`,
      )
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
    return await ctx.db.get('connections', args.connectionId)
  },
})

export const deleteConnectionData = internalMutation({
  args: {
    connectionId: v.id('connections'),
    profileId: v.id('profiles'),
  },
  handler: async (ctx, args) => {
    const bankAccounts = await ctx.db
      .query('bankAccounts')
      .withIndex('by_connectionId', (q) =>
        q.eq('connectionId', args.connectionId),
      )
      .collect()

    // Query snapshots, investments, and transactions per bank account using indexed lookups
    const [snapshotsByAccount, investmentsByAccount, transactionsByAccount] =
      await Promise.all([
        Promise.all(
          bankAccounts.map((ba) =>
            ctx.db
              .query('balanceSnapshots')
              .withIndex('by_bankAccountId_timestamp', (q) =>
                q.eq('bankAccountId', ba._id),
              )
              .collect(),
          ),
        ),
        Promise.all(
          bankAccounts.map((ba) =>
            ctx.db
              .query('investments')
              .withIndex('by_bankAccountId', (q) =>
                q.eq('bankAccountId', ba._id),
              )
              .collect(),
          ),
        ),
        Promise.all(
          bankAccounts.map((ba) =>
            ctx.db
              .query('transactions')
              .withIndex('by_bankAccountId', (q) =>
                q.eq('bankAccountId', ba._id),
              )
              .collect(),
          ),
        ),
      ])

    const snapshots = snapshotsByAccount.flat()
    const investments = investmentsByAccount.flat()
    const transactions = transactionsByAccount.flat()

    // Compute deltas per date and per category+date to subtract from aggregates
    const dateDeltas = new Map<string, number>()
    const categoryDateDeltas = new Map<string, number>()
    const bankAccountTypeMap = new Map(
      bankAccounts.map((ba) => [ba._id, getCategoryKey(ba.type)]),
    )

    for (const s of snapshots) {
      dateDeltas.set(s.date, (dateDeltas.get(s.date) ?? 0) + s.balance)
      const category = bankAccountTypeMap.get(s.bankAccountId) ?? 'checking'
      const catKey = `${category}:${s.date}`
      categoryDateDeltas.set(
        catKey,
        (categoryDateDeltas.get(catKey) ?? 0) + s.balance,
      )
    }

    // Delete records
    await Promise.all([
      ...snapshots.map((s) => ctx.db.delete('balanceSnapshots', s._id)),
      ...investments.map((i) => ctx.db.delete('investments', i._id)),
      ...transactions.map((t) => ctx.db.delete('transactions', t._id)),
      ...bankAccounts.map((ba) => ctx.db.delete('bankAccounts', ba._id)),
      ctx.db.delete('connections', args.connectionId),
    ])

    // Update dailyNetWorth aggregates by subtracting deleted balances
    const dnwEntries = await Promise.all(
      [...dateDeltas.keys()].map((date) =>
        ctx.db
          .query('dailyNetWorth')
          .withIndex('by_profileId_date', (q) =>
            q.eq('profileId', args.profileId).eq('date', date),
          )
          .first(),
      ),
    )

    await Promise.all(
      [...dateDeltas.entries()].map(([, delta], i) => {
        const dnw = dnwEntries[i]
        if (!dnw) return
        const newBalance = Math.round((dnw.balance - delta) * 100) / 100
        if (newBalance === 0) {
          return ctx.db.delete('dailyNetWorth', dnw._id)
        }
        return ctx.db.patch('dailyNetWorth', dnw._id, {
          balance: newBalance,
        })
      }),
    )

    // Update dailyCategoryBalance aggregates
    const dcbKeys = [...categoryDateDeltas.keys()]
    const dcbEntries = await Promise.all(
      dcbKeys.map((key) => {
        const [category, date] = key.split(':')
        return ctx.db
          .query('dailyCategoryBalance')
          .withIndex('by_profileId_category_date', (q) =>
            q
              .eq('profileId', args.profileId)
              .eq('category', category)
              .eq('date', date),
          )
          .first()
      }),
    )

    await Promise.all(
      dcbKeys.map((key, i) => {
        const dcb = dcbEntries[i]
        if (!dcb) return
        const delta = categoryDateDeltas.get(key) ?? 0
        const newBalance = Math.round((dcb.balance - delta) * 100) / 100
        if (newBalance === 0) {
          return ctx.db.delete('dailyCategoryBalance', dcb._id)
        }
        return ctx.db.patch('dailyCategoryBalance', dcb._id, {
          balance: newBalance,
        })
      }),
    )
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
      connectionIds.map((id) => ctx.db.get('connections', id)),
    )
    const connMap = new Map(
      connections
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((c) => [c._id, c]),
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
      connectionIds.map((id) => ctx.db.get('connections', id)),
    )
    const connMap = new Map(
      connections
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((c) => [c._id, c]),
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

interface MappedInvestment {
  powensInvestmentId: number
  code: string | undefined
  codeType: string | undefined
  label: string
  description: string | undefined
  quantity: number
  unitprice: number
  unitvalue: number
  valuation: number
  portfolioShare: number | undefined
  diff: number | undefined
  diffPercent: number | undefined
  originalCurrency: string | undefined
  originalValuation: number | undefined
  vdate: string | undefined
  deleted: boolean
  encryptedData?: string
}

function mapPowensInvestment(raw: PowensRawInvestment): MappedInvestment {
  return {
    powensInvestmentId: raw.id,
    code: raw.code,
    codeType: raw.code_type,
    label: raw.label ?? 'Unknown',
    description: raw.description,
    quantity: raw.quantity ?? 0,
    unitprice: raw.unitprice ?? 0,
    unitvalue: raw.unitvalue ?? 0,
    valuation: raw.valuation ?? 0,
    portfolioShare: raw.portfolio_share,
    diff: raw.diff,
    diffPercent: raw.diff_percent,
    originalCurrency: raw.original_currency?.id,
    originalValuation: raw.original_valuation,
    vdate: raw.vdate,
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
    const investmentIds: Array<{
      powensInvestmentId: number
      id: Id<'investments'>
    }> = []
    for (const inv of args.investments) {
      const existing = await ctx.db
        .query('investments')
        .withIndex('by_powensInvestmentId', (q) =>
          q.eq('powensInvestmentId', inv.powensInvestmentId),
        )
        .first()

      const { encryptedData, ...invFields } = inv
      const invEncrypted = !!encryptedData
      let investmentId: Id<'investments'>
      if (existing) {
        await ctx.db.patch('investments', existing._id, {
          ...invFields,
          bankAccountId: args.bankAccountId,
          profileId: args.profileId,
          encryptedData,
          encrypted: invEncrypted,
        })
        investmentId = existing._id
      } else {
        investmentId = await ctx.db.insert('investments', {
          bankAccountId: args.bankAccountId,
          profileId: args.profileId,
          ...invFields,
          encryptedData,
          encrypted: invEncrypted,
        })
      }
      investmentIds.push({
        powensInvestmentId: inv.powensInvestmentId,
        id: investmentId,
      })
    }
    return investmentIds
  },
})

export const listConnectionsByProfile = internalQuery({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('connections')
      .withIndex('by_profileId', (q) => q.eq('profileId', args.profileId))
      .collect()
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

      const data = (await response.json()) as PowensInvestmentResponse
      const rawInvestments = (data.investments ?? []).map(mapPowensInvestment)

      if (publicKey) {
        // Step 1: Upsert without encrypted data to get IDs
        const plainInvestments = rawInvestments.map((inv) => ({
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
          encryptedData: undefined,
        }))

        const investmentIds = (await ctx.runMutation(
          internal.powens.upsertInvestments,
          {
            bankAccountId: ba._id,
            profileId: args.profileId,
            investments: plainInvestments,
          },
        )) as Array<{ powensInvestmentId: number; id: Id<'investments'> }>

        // Step 2: Encrypt with AAD using record IDs, then patch
        const patches: Array<{ id: Id<'investments'>; encryptedData: string }> =
          []
        for (const inv of rawInvestments) {
          const idEntry = investmentIds.find(
            (e) => e.powensInvestmentId === inv.powensInvestmentId,
          )
          if (!idEntry) continue

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
            idEntry.id,
          )
          patches.push({ id: idEntry.id, encryptedData: encData })
        }

        if (patches.length > 0) {
          await ctx.runMutation(
            internal.encryptionKeys.patchInvestmentEncryptedData,
            { items: patches },
          )
        }
      } else {
        await ctx.runMutation(internal.powens.upsertInvestments, {
          bankAccountId: ba._id,
          profileId: args.profileId,
          investments: rawInvestments,
        })
      }
    }
  },
})

interface MappedTransaction {
  powensTransactionId: number
  date: string
  rdate: string | undefined
  vdate: string | undefined
  value: number
  originalValue: number | undefined
  originalCurrency: string | undefined
  type: string | undefined
  wording: string
  originalWording: string | undefined
  simplifiedWording: string | undefined
  category: string | undefined
  categoryParent: string | undefined
  coming: boolean
  active: boolean
  deleted: boolean
  counterparty: string | undefined
  card: string | undefined
  comment: string | undefined
  userCategoryKey?: string
  encryptedData?: string
}

function mapPowensTransaction(raw: PowensRawTransaction): MappedTransaction {
  return {
    powensTransactionId: raw.id,
    date: raw.date ?? new Date().toISOString().slice(0, 10),
    rdate: raw.rdate,
    vdate: raw.vdate,
    value: raw.value ?? 0,
    originalValue: raw.original_value,
    originalCurrency: raw.original_currency?.id,
    type: raw.type,
    wording: raw.wording ?? raw.original_wording ?? 'Unknown',
    originalWording: raw.original_wording,
    simplifiedWording: raw.simplified_wording,
    category: raw.category?.name,
    categoryParent: raw.category?.parent?.name,
    coming: raw.coming ?? false,
    active: raw.active ?? true,
    deleted: raw.deleted != null,
    counterparty: raw.counterparty,
    card: raw.card,
    comment: raw.comment,
  }
}

export const upsertTransactions = internalMutation({
  args: {
    bankAccountId: v.id('bankAccounts'),
    profileId: v.id('profiles'),
    transactions: v.array(
      v.object({
        powensTransactionId: v.number(),
        date: v.string(),
        rdate: v.optional(v.string()),
        vdate: v.optional(v.string()),
        value: v.number(),
        originalValue: v.optional(v.number()),
        originalCurrency: v.optional(v.string()),
        type: v.optional(v.string()),
        wording: v.string(),
        originalWording: v.optional(v.string()),
        simplifiedWording: v.optional(v.string()),
        category: v.optional(v.string()),
        categoryParent: v.optional(v.string()),
        coming: v.boolean(),
        active: v.boolean(),
        deleted: v.boolean(),
        counterparty: v.optional(v.string()),
        card: v.optional(v.string()),
        comment: v.optional(v.string()),
        userCategoryKey: v.optional(v.string()),
        encryptedData: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const txn of args.transactions) {
      const existing = await ctx.db
        .query('transactions')
        .withIndex('by_powensTransactionId', (q) =>
          q.eq('powensTransactionId', txn.powensTransactionId),
        )
        .first()

      const { encryptedData, userCategoryKey, ...txnFields } = txn
      const txnEncrypted = !!encryptedData
      if (existing) {
        await ctx.db.patch('transactions', existing._id, {
          ...txnFields,
          bankAccountId: args.bankAccountId,
          profileId: args.profileId,
          encryptedData,
          encrypted: txnEncrypted,
          // Preserve manual category overrides — never overwrite userCategoryKey
          ...(existing.userCategoryKey
            ? {}
            : userCategoryKey
              ? { userCategoryKey }
              : {}),
        })
      } else {
        await ctx.db.insert('transactions', {
          bankAccountId: args.bankAccountId,
          profileId: args.profileId,
          ...txnFields,
          ...(userCategoryKey ? { userCategoryKey } : {}),
          encryptedData,
          encrypted: txnEncrypted,
        })
      }
    }
  },
})

export const syncTransactionsFromWebhook = internalAction({
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

    const connection = await ctx.runQuery(
      internal.powens.findConnectionByPowensId,
      { powensConnectionId: args.powensConnectionId },
    )
    if (!connection) return

    // Load category rules for auto-categorization
    const categoryRules = await ctx.runQuery(
      internal.categoryRules.listRulesForWorkspace,
      { workspaceId: profile.workspaceId },
    )

    const bankAccounts = await ctx.runQuery(
      internal.powens.listBankAccountsByConnection,
      { connectionId: connection._id },
    )

    for (const ba of bankAccounts) {
      // Skip investment-type accounts — they don't have transactions
      if (INVESTMENT_TYPES.includes(ba.type ?? '')) continue

      let offset = 0
      const limit = 1000

      for (;;) {
        const response = await fetch(
          `${baseUrl}/users/me/accounts/${ba.powensBankAccountId}/transactions?limit=${limit}&offset=${offset}&expand=category`,
          { headers: { Authorization: `Bearer ${profile.powensUserToken}` } },
        )

        if (!response.ok) break

        const data = (await response.json()) as PowensTransactionResponse
        const rawTransactions = (data.transactions ?? []).map(
          mapPowensTransaction,
        )

        if (rawTransactions.length === 0) break

        // Apply category rules to incoming transactions
        for (const txn of rawTransactions) {
          if (txn.userCategoryKey) continue
          const text = [txn.wording, txn.originalWording, txn.simplifiedWording]
            .filter(Boolean)
            .join(' ')
          for (const rule of categoryRules) {
            let matched = false
            if (rule.matchType === 'contains') {
              matched = text.toLowerCase().includes(rule.pattern.toLowerCase())
            } else {
              try {
                matched = new RegExp(rule.pattern, 'i').test(text)
              } catch {
                // invalid regex, skip
              }
            }
            if (matched) {
              txn.userCategoryKey = rule.categoryKey
              break
            }
          }
        }

        let transactions: Array<MappedTransaction> = rawTransactions
        if (publicKey) {
          transactions = await Promise.all(
            rawTransactions.map(async (txn) => {
              const encData = await encryptForProfile(
                {
                  wording: txn.wording,
                  originalWording: txn.originalWording,
                  simplifiedWording: txn.simplifiedWording,
                  value: txn.value,
                  originalValue: txn.originalValue,
                  counterparty: txn.counterparty,
                  card: txn.card,
                  comment: txn.comment,
                  category: txn.category,
                  categoryParent: txn.categoryParent,
                  userCategoryKey: txn.userCategoryKey,
                },
                publicKey,
              )
              return {
                ...txn,
                wording: 'Encrypted',
                originalWording: undefined,
                simplifiedWording: undefined,
                value: 0,
                originalValue: undefined,
                counterparty: undefined,
                card: undefined,
                comment: undefined,
                category: undefined,
                categoryParent: undefined,
                userCategoryKey: undefined,
                encryptedData: encData,
              }
            }),
          )
        }

        await ctx.runMutation(internal.powens.upsertTransactions, {
          bankAccountId: ba._id,
          profileId: args.profileId,
          transactions,
        })

        if (rawTransactions.length < limit) break
        offset += limit
      }
    }
  },
})

export const backfillTransactions = internalAction({
  args: {
    profileId: v.id('profiles'),
    minDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { baseUrl } = getPowensConfig()

    const profile = await ctx.runQuery(internal.powens.getProfileInternal, {
      profileId: args.profileId,
    })
    if (!profile?.powensUserToken) {
      throw new Error('No Powens token found for this profile')
    }

    const publicKey: string | null = await ctx.runQuery(
      internal.encryptionKeys.getPublicKeyForProfile,
      { profileId: args.profileId },
    )

    const categoryRules = await ctx.runQuery(
      internal.categoryRules.listRulesForWorkspace,
      { workspaceId: profile.workspaceId },
    )

    const connections = await ctx.runQuery(
      internal.powens.listConnectionsByProfile,
      { profileId: args.profileId },
    )

    const bankAccounts = (
      await Promise.all(
        connections.map((c) =>
          ctx.runQuery(internal.powens.listBankAccountsByConnection, {
            connectionId: c._id,
          }),
        ),
      )
    ).flat()

    let totalSynced = 0

    for (const ba of bankAccounts) {
      if (INVESTMENT_TYPES.includes(ba.type ?? '')) continue

      let offset = 0
      const limit = 1000

      for (;;) {
        const params = new URLSearchParams({
          limit: String(limit),
          offset: String(offset),
          expand: 'category',
        })
        if (args.minDate) {
          params.set('min_date', args.minDate)
        }

        const response = await fetch(
          `${baseUrl}/users/me/accounts/${ba.powensBankAccountId}/transactions?${params.toString()}`,
          { headers: { Authorization: `Bearer ${profile.powensUserToken}` } },
        )

        if (!response.ok) break

        const data = (await response.json()) as PowensTransactionResponse
        const rawTransactions = (data.transactions ?? []).map(
          mapPowensTransaction,
        )

        if (rawTransactions.length === 0) break

        for (const txn of rawTransactions) {
          if (txn.userCategoryKey) continue
          const text = [txn.wording, txn.originalWording, txn.simplifiedWording]
            .filter(Boolean)
            .join(' ')
          for (const rule of categoryRules) {
            let matched = false
            if (rule.matchType === 'contains') {
              matched = text.toLowerCase().includes(rule.pattern.toLowerCase())
            } else {
              try {
                matched = new RegExp(rule.pattern, 'i').test(text)
              } catch {
                // invalid regex, skip
              }
            }
            if (matched) {
              txn.userCategoryKey = rule.categoryKey
              break
            }
          }
        }

        let transactions: Array<MappedTransaction> = rawTransactions
        if (publicKey) {
          transactions = await Promise.all(
            rawTransactions.map(async (txn) => {
              const encData = await encryptForProfile(
                {
                  wording: txn.wording,
                  originalWording: txn.originalWording,
                  simplifiedWording: txn.simplifiedWording,
                  value: txn.value,
                  originalValue: txn.originalValue,
                  counterparty: txn.counterparty,
                  card: txn.card,
                  comment: txn.comment,
                  category: txn.category,
                  categoryParent: txn.categoryParent,
                  userCategoryKey: txn.userCategoryKey,
                },
                publicKey,
              )
              return {
                ...txn,
                wording: 'Encrypted',
                originalWording: undefined,
                simplifiedWording: undefined,
                value: 0,
                originalValue: undefined,
                counterparty: undefined,
                card: undefined,
                comment: undefined,
                category: undefined,
                categoryParent: undefined,
                userCategoryKey: undefined,
                encryptedData: encData,
              }
            }),
          )
        }

        await ctx.runMutation(internal.powens.upsertTransactions, {
          bankAccountId: ba._id,
          profileId: args.profileId,
          transactions,
        })

        totalSynced += rawTransactions.length
        if (rawTransactions.length < limit) break
        offset += limit
      }
    }

    return { synced: totalSynced }
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
    const account = await ctx.db.get('bankAccounts', args.bankAccountId)
    if (!account) return null
    const connection = await ctx.db.get('connections', account.connectionId)
    return {
      ...account,
      connectorName: connection?.connectorName ?? undefined,
      connectionEncryptedData: connection?.encryptedData ?? undefined,
    }
  },
})
