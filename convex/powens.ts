import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from './_generated/server'
import { getCategoryKey } from './lib/accountCategories'
import { getAuthUserId, requireAuthUserId } from './lib/auth'
import { encryptFieldGroups, encryptForProfile } from './lib/serverCrypto'

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
  date?: string | null
  rdate?: string | null
  vdate?: string | null
  value?: number | null
  original_value?: number | null
  original_currency?: { id?: string | null } | null
  type?: string | null
  original_wording?: string | null
  simplified_wording?: string | null
  wording?: string | null
  category?: {
    id?: number | null
    name?: string | null
    parent?: { name?: string | null } | null
  } | null
  categories?: Array<{
    code?: string | null
    parent_code?: string | null
  }> | null
  coming?: boolean | null
  active?: boolean | null
  deleted?: unknown
  counterparty?: string | null
  card?: string | null
  comment?: string | null
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
    portfolioId: Id<'portfolios'>
    balance: number // plaintext balance for daily aggregate delta computation only — NOT stored
    currency: string
  },
): Promise<Id<'balanceSnapshots'>> {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const timestamp = now.getTime()

  const existing = await ctx.db
    .query('balanceSnapshots')
    .withIndex('by_bankAccountId_date', (q) =>
      q.eq('bankAccountId', params.bankAccountId).eq('date', date),
    )
    .first()

  let oldBalance: number
  if (existing) {
    oldBalance = existing.balance
  } else {
    const previous = await ctx.db
      .query('balanceSnapshots')
      .withIndex('by_bankAccountId_timestamp', (q) =>
        q.eq('bankAccountId', params.bankAccountId),
      )
      .order('desc')
      .first()
    oldBalance = previous?.balance ?? 0
  }

  let snapshotId: Id<'balanceSnapshots'>
  if (existing) {
    await ctx.db.patch('balanceSnapshots', existing._id, {
      balance: params.balance,
    })
    snapshotId = existing._id
  } else {
    snapshotId = await ctx.db.insert('balanceSnapshots', {
      bankAccountId: params.bankAccountId,
      portfolioId: params.portfolioId,
      balance: params.balance,
      currency: params.currency,
      date,
      timestamp,
      encryptedData: '', // placeholder — patched with encrypted data by the calling action
    })
  }

  const [portfolio, bankAccount] = await Promise.all([
    ctx.db.get('portfolios', params.portfolioId),
    ctx.db.get('bankAccounts', params.bankAccountId),
  ])
  if (!portfolio) throw new Error('Portfolio not found')

  const balanceDelta = params.balance - oldBalance

  await Promise.all([
    updateDailyNetWorth(ctx, {
      portfolioId: params.portfolioId,
      workspaceId: portfolio.workspaceId,
      date,
      timestamp,
      balanceDelta,
      currency: params.currency,
    }),
    updateDailyCategoryBalance(ctx, {
      portfolioId: params.portfolioId,
      workspaceId: portfolio.workspaceId,
      category: getCategoryKey(bankAccount?.type),
      date,
      timestamp,
      balanceDelta,
      currency: params.currency,
    }),
  ])

  return snapshotId
}

async function updateDailyNetWorth(
  ctx: MutationCtx,
  params: {
    portfolioId: Id<'portfolios'>
    workspaceId: Id<'workspaces'>
    date: string
    timestamp: number
    balanceDelta: number
    currency: string
  },
) {
  const existing = await ctx.db
    .query('dailyNetWorth')
    .withIndex('by_portfolioId_date', (q) =>
      q.eq('portfolioId', params.portfolioId).eq('date', params.date),
    )
    .first()

  if (existing) {
    await ctx.db.patch('dailyNetWorth', existing._id, {
      balance: Math.round((existing.balance + params.balanceDelta) * 100) / 100,
    })
  } else {
    // Carry forward the previous day's net worth so accounts that haven't
    // synced yet today are still reflected in the total.
    const previous = await ctx.db
      .query('dailyNetWorth')
      .withIndex('by_portfolioId_date', (q) =>
        q.eq('portfolioId', params.portfolioId),
      )
      .order('desc')
      .first()
    const carryForward = previous?.balance ?? 0

    await ctx.db.insert('dailyNetWorth', {
      portfolioId: params.portfolioId,
      workspaceId: params.workspaceId,
      date: params.date,
      timestamp: params.timestamp,
      balance: Math.round((carryForward + params.balanceDelta) * 100) / 100,
      currency: params.currency,
    })
  }
}

async function updateDailyCategoryBalance(
  ctx: MutationCtx,
  params: {
    portfolioId: Id<'portfolios'>
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
    .withIndex('by_portfolioId_category_date', (q) =>
      q
        .eq('portfolioId', params.portfolioId)
        .eq('category', params.category)
        .eq('date', params.date),
    )
    .first()

  if (existing) {
    await ctx.db.patch('dailyCategoryBalance', existing._id, {
      balance: Math.round((existing.balance + params.balanceDelta) * 100) / 100,
    })
  } else {
    // Carry forward the previous day's category balance so accounts that
    // haven't synced yet today are still reflected in the total.
    const previous = await ctx.db
      .query('dailyCategoryBalance')
      .withIndex('by_portfolioId_category_date', (q) =>
        q.eq('portfolioId', params.portfolioId).eq('category', params.category),
      )
      .order('desc')
      .first()
    const carryForward = previous?.balance ?? 0

    await ctx.db.insert('dailyCategoryBalance', {
      portfolioId: params.portfolioId,
      workspaceId: params.workspaceId,
      category: params.category,
      date: params.date,
      timestamp: params.timestamp,
      balance: Math.round((carryForward + params.balanceDelta) * 100) / 100,
      currency: params.currency,
    })
  }
}

function getPowensConfig() {
  const baseUrl = process.env.POWENS_BASE_URL
  const clientId = process.env.POWENS_CLIENT_ID
  const clientSecret = process.env.POWENS_CLIENT_SECRET
  const domain = process.env.POWENS_DOMAIN
  if (!baseUrl || !clientId || !clientSecret || !domain) {
    throw new Error('Powens environment variables not configured')
  }
  return { baseUrl, clientId, clientSecret, domain }
}

export const createPowensUser = action({
  args: { portfolioId: v.id('portfolios') },
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

    await ctx.runMutation(internal.powens.updatePortfolioPowensUser, {
      portfolioId: args.portfolioId,
      powensUserToken: token,
      powensUserId,
    })

    return { token, powensUserId }
  },
})

export const generateConnectUrl = action({
  args: { portfolioId: v.id('portfolios') },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    const { baseUrl, clientId, clientSecret, domain } = getPowensConfig()
    const siteUrl = process.env.SITE_URL
    if (!siteUrl) throw new Error('SITE_URL not configured')

    // Get portfolio to check for existing Powens user
    const portfolio = await ctx.runQuery(internal.powens.getPortfolioInternal, {
      portfolioId: args.portfolioId,
    })

    let token = portfolio?.powensUserToken

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
      await ctx.runMutation(internal.powens.updatePortfolioPowensUser, {
        portfolioId: args.portfolioId,
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
    const connectUrl = `https://webview.powens.com/connect?domain=${domain}&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`

    return connectUrl
  },
})

export const generateManageUrl = action({
  args: {
    connectionId: v.id('connections'),
    portfolioId: v.id('portfolios'),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    await requireAuthUserId(ctx)
    const { baseUrl, clientId, domain } = getPowensConfig()
    const siteUrl = process.env.SITE_URL
    if (!siteUrl) throw new Error('SITE_URL not configured')

    const portfolio = await ctx.runQuery(internal.powens.getPortfolioInternal, {
      portfolioId: args.portfolioId,
    })
    if (!portfolio?.powensUserToken) {
      throw new Error('Portfolio has no Powens user token')
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
      headers: { Authorization: `Bearer ${portfolio.powensUserToken}` },
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
    return `https://webview.powens.com/manage?domain=${domain}&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}&connection_id=${connection.powensConnectionId}`
  },
})

export const getPortfolioInternal = internalQuery({
  args: { portfolioId: v.id('portfolios') },
  handler: async (ctx, args) => {
    return await ctx.db.get('portfolios', args.portfolioId)
  },
})

export const updatePortfolioPowensUser = internalMutation({
  args: {
    portfolioId: v.id('portfolios'),
    powensUserToken: v.string(),
    powensUserId: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch('portfolios', args.portfolioId, {
      powensUserToken: args.powensUserToken,
      powensUserId: args.powensUserId,
    })
  },
})

export const handleConnectionCallback = action({
  args: {
    connectionId: v.number(),
    portfolioId: v.id('portfolios'),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)

    await ctx.runAction(internal.powens.syncConnectionFromPowens, {
      portfolioId: args.portfolioId,
      powensConnectionId: args.connectionId,
    })
  },
})

export const upsertConnection = internalMutation({
  args: {
    portfolioId: v.id('portfolios'),
    powensConnectionId: v.number(),
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
      await ctx.db.patch('connections', existing._id, {
        state: args.state,
        lastSync: args.lastSync,
      })
      return existing._id
    }

    return await ctx.db.insert('connections', {
      portfolioId: args.portfolioId,
      powensConnectionId: args.powensConnectionId,
      state: args.state,
      lastSync: args.lastSync,
      encryptedData: '', // placeholder — patched with encrypted data immediately after
    })
  },
})

export const upsertBankAccount = internalMutation({
  args: {
    connectionId: v.id('connections'),
    portfolioId: v.id('portfolios'),
    powensBankAccountId: v.number(),
    type: v.optional(v.string()),
    balance: v.number(), // plaintext balance for daily aggregate delta computation only
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
      await ctx.db.patch('bankAccounts', existing._id, {
        type: args.type,
        currency: args.currency,
        disabled: args.disabled,
        deleted: args.deleted,
        lastSync: args.lastSync,
      })
      bankAccountId = existing._id
    } else {
      bankAccountId = await ctx.db.insert('bankAccounts', {
        connectionId: args.connectionId,
        portfolioId: args.portfolioId,
        powensBankAccountId: args.powensBankAccountId,
        type: args.type,
        currency: args.currency,
        disabled: args.disabled,
        deleted: args.deleted,
        lastSync: args.lastSync,
        encryptedIdentity: '', // placeholder — patched with encrypted data immediately after
        encryptedBalance: '', // placeholder
      })
    }

    const snapshotId = await recordBalanceSnapshot(ctx, {
      bankAccountId,
      portfolioId: args.portfolioId,
      balance: args.balance,
      currency: args.currency,
    })

    return { bankAccountId, snapshotId }
  },
})

export const findPortfolioByPowensUserId = internalQuery({
  args: { powensUserId: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('portfolios')
      .withIndex('by_powensUserId', (q) =>
        q.eq('powensUserId', args.powensUserId),
      )
      .first()
  },
})

export const syncConnectionFromPowens = internalAction({
  args: {
    portfolioId: v.id('portfolios'),
    powensConnectionId: v.number(),
    state: v.optional(v.string()),
    lastSync: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { baseUrl } = getPowensConfig()

    const portfolio = await ctx.runQuery(internal.powens.getPortfolioInternal, {
      portfolioId: args.portfolioId,
    })
    if (!portfolio?.powensUserToken) {
      console.warn('[powens] No user token found for portfolio — skipping sync')
      return
    }

    const publicKey = await ctx.runQuery(
      internal.encryptionKeys.getPublicKeyForPortfolio,
      { portfolioId: args.portfolioId },
    )
    if (!publicKey) {
      throw new Error('Workspace encryption not configured — cannot sync')
    }

    // Fetch connection details with expanded connector
    const connResponse = await fetch(
      `${baseUrl}/users/me/connections/${args.powensConnectionId}?expand=connector`,
      { headers: { Authorization: `Bearer ${portfolio.powensUserToken}` } },
    )

    if (!connResponse.ok) {
      const text = await connResponse.text()
      console.error(
        `[powens] Failed to fetch connection ${args.powensConnectionId}: ${connResponse.status} ${text}`,
      )
      // Still update state from webhook payload even if API fetch fails
      await ctx.runMutation(internal.powens.updateConnectionState, {
        powensConnectionId: args.powensConnectionId,
        state: args.state,
      })
      return
    }

    const connData = (await connResponse.json()) as PowensConnectionResponse
    const realConnectorName = connData.connector?.name ?? 'Unknown'

    const connectionDocId: Id<'connections'> = await ctx.runMutation(
      internal.powens.upsertConnection,
      {
        portfolioId: args.portfolioId,
        powensConnectionId: args.powensConnectionId,
        state: connData.state ?? args.state ?? undefined,
        lastSync: connData.last_update ?? args.lastSync ?? undefined,
      },
    )

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

    // Fetch and sync bank accounts
    const acctResponse = await fetch(
      `${baseUrl}/users/me/connections/${args.powensConnectionId}/accounts`,
      { headers: { Authorization: `Bearer ${portfolio.powensUserToken}` } },
    )

    if (acctResponse.ok) {
      const acctData = (await acctResponse.json()) as PowensAccountResponse
      const bankAccts = acctData.accounts ?? []

      for (const acct of bankAccts) {
        const number = acct.number
        const iban = acct.iban
        const balance = acct.balance ?? 0
        const name = acct.original_name ?? acct.name ?? 'Unnamed Account'

        const { bankAccountId, snapshotId } = (await ctx.runMutation(
          internal.powens.upsertBankAccount,
          {
            connectionId: connectionDocId,
            portfolioId: args.portfolioId,
            powensBankAccountId: acct.id,
            type: acct.type ?? undefined,
            balance,
            currency: acct.currency?.id ?? 'EUR',
            disabled: acct.disabled ?? false,
            deleted: acct.deleted != null,
            lastSync: acct.last_update ?? undefined,
          },
        )) as {
          bankAccountId: Id<'bankAccounts'>
          snapshotId: Id<'balanceSnapshots'>
        }

        const fieldGroups = await encryptFieldGroups(
          {
            encryptedIdentity: { name, number, iban },
            encryptedBalance: { balance },
          },
          publicKey,
          bankAccountId,
        )
        await ctx.runMutation(
          internal.encryptionKeys.patchBankAccountFieldGroups,
          {
            items: [
              {
                id: bankAccountId,
                encryptedIdentity: fieldGroups.encryptedIdentity,
                encryptedBalance: fieldGroups.encryptedBalance,
              },
            ],
          },
        )

        // Encrypt balance snapshot with its own record ID as context
        const snapshotEncrypted = await encryptForProfile(
          { balance },
          publicKey,
          snapshotId,
        )
        await ctx.runMutation(
          internal.encryptionKeys.patchBalanceSnapshotEncryptedData,
          { items: [{ id: snapshotId, encryptedData: snapshotEncrypted }] },
        )
      }
    }

    // Sync investments and transactions
    await ctx.runAction(internal.powens.syncInvestmentsFromWebhook, {
      portfolioId: args.portfolioId,
      powensConnectionId: args.powensConnectionId,
    })

    await ctx.runAction(internal.powens.syncTransactionsFromWebhook, {
      portfolioId: args.portfolioId,
      powensConnectionId: args.powensConnectionId,
    })

    console.log(
      `[powens] Sync complete for connection ${args.powensConnectionId}`,
    )
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
    portfolioId: v.id('portfolios'),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx)
    const { baseUrl } = getPowensConfig()

    const portfolio = await ctx.runQuery(internal.powens.getPortfolioInternal, {
      portfolioId: args.portfolioId,
    })

    const connection = await ctx.runQuery(
      internal.powens.getConnectionInternal,
      { connectionId: args.connectionId },
    )

    // Delete from Powens if we have a token and a Powens connection ID
    if (portfolio?.powensUserToken && connection?.powensConnectionId) {
      const response = await fetch(
        `${baseUrl}/users/me/connections/${connection.powensConnectionId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${portfolio.powensUserToken}` },
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
      portfolioId: args.portfolioId,
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
    portfolioId: v.id('portfolios'),
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
          .withIndex('by_portfolioId_date', (q) =>
            q.eq('portfolioId', args.portfolioId).eq('date', date),
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
          .withIndex('by_portfolioId_category_date', (q) =>
            q
              .eq('portfolioId', args.portfolioId)
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
  args: { portfolioId: v.id('portfolios') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    return await ctx.db
      .query('connections')
      .withIndex('by_portfolioId', (q) => q.eq('portfolioId', args.portfolioId))
      .collect()
  },
})

export const listAllConnections = query({
  args: { portfolioIds: v.array(v.id('portfolios')) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const results = await Promise.all(
      args.portfolioIds.map((portfolioId) =>
        ctx.db
          .query('connections')
          .withIndex('by_portfolioId', (q) => q.eq('portfolioId', portfolioId))
          .collect(),
      ),
    )
    return results.flat()
  },
})

export const listBankAccounts = query({
  args: { portfolioId: v.id('portfolios') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const accounts = await ctx.db
      .query('bankAccounts')
      .withIndex('by_portfolioId', (q) => q.eq('portfolioId', args.portfolioId))
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
        connectionEncryptedData: conn?.encryptedData ?? undefined,
      }
    })
  },
})

export const listAllBankAccounts = query({
  args: { portfolioIds: v.array(v.id('portfolios')) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const allAccounts = await Promise.all(
      args.portfolioIds.map((portfolioId) =>
        ctx.db
          .query('bankAccounts')
          .withIndex('by_portfolioId', (q) => q.eq('portfolioId', portfolioId))
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
    originalValuation: raw.original_valuation ?? undefined,
    vdate: raw.vdate,
    deleted: raw.deleted != null,
  }
}

export const upsertInvestments = internalMutation({
  args: {
    bankAccountId: v.id('bankAccounts'),
    portfolioId: v.id('portfolios'),
    investments: v.array(
      v.object({
        powensInvestmentId: v.number(),
        codeType: v.optional(v.string()),
        originalCurrency: v.optional(v.string()),
        originalValuation: v.optional(v.number()),
        vdate: v.optional(v.string()),
        deleted: v.boolean(),
        encryptedIdentity: v.string(),
        encryptedValuation: v.string(),
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

      const { encryptedIdentity, encryptedValuation, ...invFields } = inv
      let investmentId: Id<'investments'>
      if (existing) {
        await ctx.db.patch('investments', existing._id, {
          ...invFields,
          bankAccountId: args.bankAccountId,
          portfolioId: args.portfolioId,
          encryptedIdentity,
          encryptedValuation,
        })
        investmentId = existing._id
      } else {
        investmentId = await ctx.db.insert('investments', {
          bankAccountId: args.bankAccountId,
          portfolioId: args.portfolioId,
          ...invFields,
          encryptedIdentity,
          encryptedValuation,
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

export const listConnectionsByPortfolio = internalQuery({
  args: { portfolioId: v.id('portfolios') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('connections')
      .withIndex('by_portfolioId', (q) => q.eq('portfolioId', args.portfolioId))
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
    portfolioId: v.id('portfolios'),
    powensConnectionId: v.number(),
  },
  handler: async (ctx, args) => {
    const { baseUrl } = getPowensConfig()

    const portfolio = await ctx.runQuery(internal.powens.getPortfolioInternal, {
      portfolioId: args.portfolioId,
    })
    if (!portfolio?.powensUserToken) return

    const publicKey = await ctx.runQuery(
      internal.encryptionKeys.getPublicKeyForPortfolio,
      { portfolioId: args.portfolioId },
    )
    if (!publicKey) {
      throw new Error('Workspace encryption not configured — cannot sync')
    }

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
        { headers: { Authorization: `Bearer ${portfolio.powensUserToken}` } },
      )

      if (!response.ok) continue

      const data = (await response.json()) as PowensInvestmentResponse
      const rawInvestments = (data.investments ?? []).map(mapPowensInvestment)

      // Step 1: Upsert with placeholder encrypted data to get IDs
      const placeholderInvestments = rawInvestments.map((inv) => ({
        powensInvestmentId: inv.powensInvestmentId,
        codeType: inv.codeType,
        originalCurrency: inv.originalCurrency,
        originalValuation: inv.originalValuation,
        vdate: inv.vdate,
        deleted: inv.deleted,
        encryptedIdentity: '',
        encryptedValuation: '',
      }))

      const investmentIds = (await ctx.runMutation(
        internal.powens.upsertInvestments,
        {
          bankAccountId: ba._id,
          portfolioId: args.portfolioId,
          investments: placeholderInvestments,
        },
      )) as Array<{ powensInvestmentId: number; id: Id<'investments'> }>

      // Step 2: Encrypt with field groups using record IDs, then patch
      const patches: Array<{
        id: Id<'investments'>
        encryptedIdentity: string
        encryptedValuation: string
      }> = []
      for (const inv of rawInvestments) {
        const idEntry = investmentIds.find(
          (e) => e.powensInvestmentId === inv.powensInvestmentId,
        )
        if (!idEntry) continue

        const groups = await encryptFieldGroups(
          {
            encryptedIdentity: {
              code: inv.code,
              label: inv.label,
              description: inv.description,
            },
            encryptedValuation: {
              quantity: inv.quantity,
              unitprice: inv.unitprice,
              unitvalue: inv.unitvalue,
              valuation: inv.valuation,
              portfolioShare: inv.portfolioShare,
              diff: inv.diff,
              diffPercent: inv.diffPercent,
            },
          },
          publicKey,
          idEntry.id,
        )
        patches.push({
          id: idEntry.id,
          encryptedIdentity: groups.encryptedIdentity,
          encryptedValuation: groups.encryptedValuation,
        })
      }

      if (patches.length > 0) {
        await ctx.runMutation(
          internal.encryptionKeys.patchInvestmentFieldGroups,
          { items: patches },
        )
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
}

function mapPowensTransaction(raw: PowensRawTransaction): MappedTransaction {
  return {
    powensTransactionId: raw.id,
    date: raw.date ?? new Date().toISOString().slice(0, 10),
    rdate: raw.rdate ?? undefined,
    vdate: raw.vdate ?? undefined,
    value: raw.value ?? 0,
    originalValue: raw.original_value ?? undefined,
    originalCurrency: raw.original_currency?.id ?? undefined,
    type: raw.type ?? undefined,
    wording: raw.wording ?? raw.original_wording ?? 'Unknown',
    originalWording: raw.original_wording ?? undefined,
    simplifiedWording: raw.simplified_wording ?? undefined,
    category: raw.categories?.[0]?.code ?? raw.category?.name ?? undefined,
    categoryParent:
      raw.categories?.[0]?.parent_code ??
      raw.category?.parent?.name ??
      undefined,
    coming: raw.coming ?? false,
    active: raw.active ?? true,
    deleted: raw.deleted != null,
    counterparty: raw.counterparty ?? undefined,
    card: raw.card ?? undefined,
    comment: raw.comment ?? undefined,
  }
}

export const upsertTransactions = internalMutation({
  args: {
    bankAccountId: v.id('bankAccounts'),
    portfolioId: v.id('portfolios'),
    transactions: v.array(
      v.object({
        powensTransactionId: v.number(),
        date: v.string(),
        rdate: v.optional(v.string()),
        vdate: v.optional(v.string()),
        originalCurrency: v.optional(v.string()),
        type: v.optional(v.string()),
        coming: v.boolean(),
        active: v.boolean(),
        deleted: v.boolean(),
        encryptedDetails: v.string(),
        encryptedFinancials: v.string(),
        encryptedCategories: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const transactionIds: Array<{
      powensTransactionId: number
      id: Id<'transactions'>
    }> = []
    for (const txn of args.transactions) {
      const existing = await ctx.db
        .query('transactions')
        .withIndex('by_powensTransactionId', (q) =>
          q.eq('powensTransactionId', txn.powensTransactionId),
        )
        .first()

      let transactionId: Id<'transactions'>
      if (existing) {
        await ctx.db.patch('transactions', existing._id, {
          ...txn,
          bankAccountId: args.bankAccountId,
          portfolioId: args.portfolioId,
        })
        transactionId = existing._id
      } else {
        transactionId = await ctx.db.insert('transactions', {
          bankAccountId: args.bankAccountId,
          portfolioId: args.portfolioId,
          ...txn,
        })
      }
      transactionIds.push({
        powensTransactionId: txn.powensTransactionId,
        id: transactionId,
      })
    }
    return transactionIds
  },
})

export const syncTransactionsFromWebhook = internalAction({
  args: {
    portfolioId: v.id('portfolios'),
    powensConnectionId: v.number(),
  },
  handler: async (ctx, args) => {
    const { baseUrl } = getPowensConfig()

    const portfolio = await ctx.runQuery(internal.powens.getPortfolioInternal, {
      portfolioId: args.portfolioId,
    })
    if (!portfolio?.powensUserToken) return

    const publicKey = await ctx.runQuery(
      internal.encryptionKeys.getPublicKeyForPortfolio,
      { portfolioId: args.portfolioId },
    )
    if (!publicKey) {
      throw new Error('Workspace encryption not configured — cannot sync')
    }

    const connection = await ctx.runQuery(
      internal.powens.findConnectionByPowensId,
      { powensConnectionId: args.powensConnectionId },
    )
    if (!connection) return

    // Load category rules for auto-categorization
    const categoryRules = await ctx.runQuery(
      internal.categoryRules.listRulesForWorkspace,
      { workspaceId: portfolio.workspaceId },
    )

    const bankAccounts = await ctx.runQuery(
      internal.powens.listBankAccountsByConnection,
      { connectionId: connection._id },
    )

    console.log(
      `[powens] Syncing transactions for ${bankAccounts.length} bank accounts`,
    )

    for (const ba of bankAccounts) {
      // Skip investment-type accounts — they don't have transactions
      if (INVESTMENT_TYPES.includes(ba.type ?? '')) {
        console.log(
          `[powens] Skipping investment account ${ba.powensBankAccountId} (type: ${ba.type})`,
        )
        continue
      }

      let offset = 0
      const limit = 1000

      for (;;) {
        const url = `${baseUrl}/users/me/accounts/${ba.powensBankAccountId}/transactions?limit=${limit}&offset=${offset}&expand=categories`
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${portfolio.powensUserToken}` },
        })

        if (!response.ok) {
          const text = await response.text()
          console.error(
            `[powens] Transaction fetch failed for account ${ba.powensBankAccountId}: ${response.status} ${text}`,
          )
          break
        }

        const data = (await response.json()) as PowensTransactionResponse

        const rawTransactions = (data.transactions ?? []).map(
          mapPowensTransaction,
        )

        console.log(
          `[powens] Fetched ${rawTransactions.length} transactions for account ${ba.powensBankAccountId} (offset: ${offset})`,
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

        // Step 1: Upsert transactions with placeholder encrypted data to get IDs
        const placeholderTransactions = rawTransactions.map((txn) => ({
          powensTransactionId: txn.powensTransactionId,
          date: txn.date,
          rdate: txn.rdate,
          vdate: txn.vdate,
          originalCurrency: txn.originalCurrency,
          type: txn.type,
          coming: txn.coming,
          active: txn.active,
          deleted: txn.deleted,
          encryptedDetails: '',
          encryptedFinancials: '',
          encryptedCategories: '',
        }))

        const transactionIds = (await ctx.runMutation(
          internal.powens.upsertTransactions,
          {
            bankAccountId: ba._id,
            portfolioId: args.portfolioId,
            transactions: placeholderTransactions,
          },
        )) as Array<{ powensTransactionId: number; id: Id<'transactions'> }>

        // Step 2: Encrypt with field groups using record IDs, then patch
        const patches: Array<{
          id: Id<'transactions'>
          encryptedDetails: string
          encryptedFinancials: string
          encryptedCategories: string
        }> = []
        for (const txn of rawTransactions) {
          const idEntry = transactionIds.find(
            (e) => e.powensTransactionId === txn.powensTransactionId,
          )
          if (!idEntry) continue

          const groups = await encryptFieldGroups(
            {
              encryptedDetails: {
                wording: txn.wording,
                originalWording: txn.originalWording,
                simplifiedWording: txn.simplifiedWording,
                counterparty: txn.counterparty,
                card: txn.card,
                comment: txn.comment,
              },
              encryptedFinancials: {
                value: txn.value,
                originalValue: txn.originalValue,
              },
              encryptedCategories: {
                category: txn.category,
                categoryParent: txn.categoryParent,
                userCategoryKey: txn.userCategoryKey,
              },
            },
            publicKey,
            idEntry.id,
          )
          patches.push({
            id: idEntry.id,
            encryptedDetails: groups.encryptedDetails,
            encryptedFinancials: groups.encryptedFinancials,
            encryptedCategories: groups.encryptedCategories,
          })
        }

        if (patches.length > 0) {
          await ctx.runMutation(
            internal.encryptionKeys.patchTransactionFieldGroups,
            { items: patches },
          )
        }

        if (rawTransactions.length < limit) break
        offset += limit
      }
    }
  },
})

export const backfillTransactions = internalAction({
  args: {
    portfolioId: v.id('portfolios'),
    minDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { baseUrl } = getPowensConfig()

    const portfolio = await ctx.runQuery(internal.powens.getPortfolioInternal, {
      portfolioId: args.portfolioId,
    })
    if (!portfolio?.powensUserToken) {
      throw new Error('No Powens token found for this portfolio')
    }

    const publicKey = await ctx.runQuery(
      internal.encryptionKeys.getPublicKeyForPortfolio,
      { portfolioId: args.portfolioId },
    )
    if (!publicKey) {
      throw new Error('Workspace encryption not configured — cannot sync')
    }

    const categoryRules = await ctx.runQuery(
      internal.categoryRules.listRulesForWorkspace,
      { workspaceId: portfolio.workspaceId },
    )

    const connections = await ctx.runQuery(
      internal.powens.listConnectionsByPortfolio,
      { portfolioId: args.portfolioId },
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
          expand: 'categories',
        })
        if (args.minDate) {
          params.set('min_date', args.minDate)
        }

        const response = await fetch(
          `${baseUrl}/users/me/accounts/${ba.powensBankAccountId}/transactions?${params.toString()}`,
          { headers: { Authorization: `Bearer ${portfolio.powensUserToken}` } },
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

        // Step 1: Upsert transactions with placeholder encrypted data to get IDs
        const placeholderTransactions = rawTransactions.map((txn) => ({
          powensTransactionId: txn.powensTransactionId,
          date: txn.date,
          rdate: txn.rdate,
          vdate: txn.vdate,
          originalCurrency: txn.originalCurrency,
          type: txn.type,
          coming: txn.coming,
          active: txn.active,
          deleted: txn.deleted,
          encryptedDetails: '',
          encryptedFinancials: '',
          encryptedCategories: '',
        }))

        const transactionIds = (await ctx.runMutation(
          internal.powens.upsertTransactions,
          {
            bankAccountId: ba._id,
            portfolioId: args.portfolioId,
            transactions: placeholderTransactions,
          },
        )) as Array<{ powensTransactionId: number; id: Id<'transactions'> }>

        // Step 2: Encrypt with field groups using record IDs, then patch
        const patches: Array<{
          id: Id<'transactions'>
          encryptedDetails: string
          encryptedFinancials: string
          encryptedCategories: string
        }> = []
        for (const txn of rawTransactions) {
          const idEntry = transactionIds.find(
            (e) => e.powensTransactionId === txn.powensTransactionId,
          )
          if (!idEntry) continue

          const groups = await encryptFieldGroups(
            {
              encryptedDetails: {
                wording: txn.wording,
                originalWording: txn.originalWording,
                simplifiedWording: txn.simplifiedWording,
                counterparty: txn.counterparty,
                card: txn.card,
                comment: txn.comment,
              },
              encryptedFinancials: {
                value: txn.value,
                originalValue: txn.originalValue,
              },
              encryptedCategories: {
                category: txn.category,
                categoryParent: txn.categoryParent,
                userCategoryKey: txn.userCategoryKey,
              },
            },
            publicKey,
            idEntry.id,
          )
          patches.push({
            id: idEntry.id,
            encryptedDetails: groups.encryptedDetails,
            encryptedFinancials: groups.encryptedFinancials,
            encryptedCategories: groups.encryptedCategories,
          })
        }

        if (patches.length > 0) {
          await ctx.runMutation(
            internal.encryptionKeys.patchTransactionFieldGroups,
            { items: patches },
          )
        }

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
      connectionEncryptedData: connection?.encryptedData ?? undefined,
    }
  },
})
