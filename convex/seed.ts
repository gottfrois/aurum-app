import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server'
import { getCategoryKey } from './lib/accountCategories'
import { encryptFieldGroups, encryptForProfile } from './lib/serverCrypto'

// ---------------------------------------------------------------------------
// Demo data constants
// ---------------------------------------------------------------------------

const SEED_POWENS_CONNECTION_ID = -999_001
const SEED_POWENS_CHECKING_ID = -999_101
const SEED_POWENS_SAVINGS_ID = -999_102
const SEED_POWENS_INVEST_ID = -999_103

const SEED_POWENS_INVESTMENT_BASE = -999_200
const SEED_POWENS_TRANSACTION_BASE = -999_300

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Generate a smooth-ish historical balance curve
function generateBalanceHistory(
  startBalance: number,
  endBalance: number,
  days: number,
): number[] {
  const balances: number[] = []
  for (let i = 0; i < days; i++) {
    const t = i / (days - 1)
    const base = startBalance + (endBalance - startBalance) * t
    // Add some noise
    const noise = Math.sin(i * 0.3) * 200 + Math.cos(i * 0.7) * 150
    balances.push(Math.round((base + noise) * 100) / 100)
  }
  // Ensure the last value is exactly the end balance
  balances[days - 1] = endBalance
  return balances
}

// ---------------------------------------------------------------------------
// Demo transaction templates
// ---------------------------------------------------------------------------

const DEMO_TRANSACTIONS = [
  { wording: 'Carrefour', value: -87.43, type: 'debit', category: 'groceries' },
  {
    wording: 'SNCF Voyages',
    value: -156.0,
    type: 'debit',
    category: 'transport',
  },
  {
    wording: 'Virement salaire',
    value: 3200.0,
    type: 'transfer',
    category: 'income',
  },
  {
    wording: 'Netflix',
    value: -13.49,
    type: 'debit',
    category: 'entertainment',
  },
  {
    wording: 'EDF Electricité',
    value: -74.5,
    type: 'debit',
    category: 'housing',
  },
  { wording: 'Amazon.fr', value: -42.99, type: 'debit', category: 'shopping' },
  {
    wording: 'Boulangerie du Coin',
    value: -6.8,
    type: 'debit',
    category: 'food',
  },
  {
    wording: 'Loyer Appartement',
    value: -950.0,
    type: 'debit',
    category: 'housing',
  },
  {
    wording: 'Spotify',
    value: -9.99,
    type: 'debit',
    category: 'entertainment',
  },
  {
    wording: 'Pharmacie Centrale',
    value: -23.45,
    type: 'debit',
    category: 'health',
  },
  { wording: 'Uber Eats', value: -31.2, type: 'debit', category: 'food' },
  {
    wording: 'Assurance Auto',
    value: -65.0,
    type: 'debit',
    category: 'insurance',
  },
  {
    wording: 'Virement Epargne',
    value: -500.0,
    type: 'transfer',
    category: 'savings',
  },
  {
    wording: 'Remboursement Jules',
    value: 45.0,
    type: 'transfer',
    category: 'income',
  },
  { wording: 'Decathlon', value: -89.9, type: 'debit', category: 'shopping' },
  { wording: 'Free Mobile', value: -19.99, type: 'debit', category: 'telecom' },
  { wording: 'Monoprix', value: -34.67, type: 'debit', category: 'groceries' },
  { wording: 'Fnac', value: -129.99, type: 'debit', category: 'shopping' },
  {
    wording: 'Mutuelle Santé',
    value: -45.0,
    type: 'debit',
    category: 'health',
  },
  {
    wording: 'TotalEnergies',
    value: -62.35,
    type: 'debit',
    category: 'transport',
  },
]

// ---------------------------------------------------------------------------
// Demo investment data
// ---------------------------------------------------------------------------

const DEMO_INVESTMENTS = [
  {
    code: 'FR0010315770',
    codeType: 'ISIN',
    label: 'Lyxor MSCI World ETF',
    description: "ETF répliquant l'indice MSCI World",
    quantity: 42,
    unitvalue: 28.45,
    unitprice: 22.1,
  },
  {
    code: 'FR0011550185',
    codeType: 'ISIN',
    label: 'Fonds Euro Sécurité',
    description: 'Fonds en euros capital garanti',
    quantity: 1,
    unitvalue: 8500.0,
    unitprice: 8000.0,
  },
  {
    code: 'LU1681043599',
    codeType: 'ISIN',
    label: 'Amundi S&P 500 ETF',
    description: "ETF répliquant l'indice S&P 500",
    quantity: 15,
    unitvalue: 65.78,
    unitprice: 48.5,
  },
  {
    code: 'FR0010342600',
    codeType: 'ISIN',
    label: 'Amundi CAC 40 ESG',
    description: 'ETF ESG CAC 40',
    quantity: 30,
    unitvalue: 72.3,
    unitprice: 58.9,
  },
]

// ---------------------------------------------------------------------------
// seedDemoData — internalAction (can use serverCrypto for encryption)
// ---------------------------------------------------------------------------

export const seedDemoData = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    // 1. Resolve workspace, portfolio, and encryption key
    const membership = await ctx.runQuery(internal.seed.getMembershipByUserId, {
      userId,
    })
    if (!membership) throw new Error('No workspace found for user')

    const portfolio = await ctx.runQuery(internal.seed.getFirstPortfolio, {
      workspaceId: membership.workspaceId,
    })
    if (!portfolio) throw new Error('No portfolio found')

    const publicKey = await ctx.runQuery(
      internal.encryptionKeys.getPublicKeyForPortfolio,
      { portfolioId: portfolio._id },
    )
    if (!publicKey) {
      throw new Error('Workspace encryption not configured — cannot seed')
    }

    // 2. Create demo connection (with placeholder encrypted data)
    const connectionId: Id<'connections'> = await ctx.runMutation(
      internal.powens.upsertConnection,
      {
        portfolioId: portfolio._id,
        powensConnectionId: SEED_POWENS_CONNECTION_ID,
        state: 'SyncDone',
        lastSync: new Date().toISOString(),
      },
    )

    const connectionEncrypted = await encryptForProfile(
      { connectorName: 'Demo Bank' },
      publicKey,
      connectionId,
    )
    await ctx.runMutation(
      internal.encryptionKeys.patchConnectionEncryptedData,
      { items: [{ id: connectionId, encryptedData: connectionEncrypted }] },
    )

    // 3. Create bank accounts
    const checkingBalance = 4832.57
    const savingsBalance = 15420.0
    const investBalance = 0 // investment account balance comes from investments

    const accounts = [
      {
        powensId: SEED_POWENS_CHECKING_ID,
        name: 'Compte Courant',
        type: 'checking',
        balance: checkingBalance,
        currency: 'EUR',
        iban: 'FR76 1234 5678 9012 3456 7890 123',
        number: '00012345678',
      },
      {
        powensId: SEED_POWENS_SAVINGS_ID,
        name: 'Livret A',
        type: 'savings',
        balance: savingsBalance,
        currency: 'EUR',
        iban: undefined,
        number: '00087654321',
      },
      {
        powensId: SEED_POWENS_INVEST_ID,
        name: 'Assurance Vie',
        type: 'lifeinsurance',
        balance: investBalance,
        currency: 'EUR',
        iban: undefined,
        number: '00099887766',
      },
    ]

    const bankAccountIds: Record<
      string,
      { bankAccountId: Id<'bankAccounts'>; snapshotId: Id<'balanceSnapshots'> }
    > = {}

    for (const acct of accounts) {
      const result = (await ctx.runMutation(internal.powens.upsertBankAccount, {
        connectionId,
        portfolioId: portfolio._id,
        powensBankAccountId: acct.powensId,
        type: acct.type,
        balance: acct.balance,
        currency: acct.currency,
        disabled: false,
        deleted: false,
        lastSync: new Date().toISOString(),
      })) as {
        bankAccountId: Id<'bankAccounts'>
        snapshotId: Id<'balanceSnapshots'>
      }

      bankAccountIds[acct.type] = result

      // Encrypt bank account fields
      const groups = await encryptFieldGroups(
        {
          encryptedIdentity: {
            name: acct.name,
            number: acct.number,
            iban: acct.iban,
          },
          encryptedBalance: { balance: acct.balance },
        },
        publicKey,
        result.bankAccountId,
      )
      await ctx.runMutation(
        internal.encryptionKeys.patchBankAccountFieldGroups,
        {
          items: [
            {
              id: result.bankAccountId,
              encryptedIdentity: groups.encryptedIdentity,
              encryptedBalance: groups.encryptedBalance,
            },
          ],
        },
      )

      // Encrypt balance snapshot
      const snapshotEncrypted = await encryptForProfile(
        { balance: acct.balance },
        publicKey,
        result.snapshotId,
      )
      await ctx.runMutation(
        internal.encryptionKeys.patchBalanceSnapshotEncryptedData,
        {
          items: [{ id: result.snapshotId, encryptedData: snapshotEncrypted }],
        },
      )
    }

    // 4. Seed historical balance snapshots (last 365 days)
    const historyDays = 365
    const checkingHistory = generateBalanceHistory(
      2100,
      checkingBalance,
      historyDays,
    )
    const savingsHistory = generateBalanceHistory(
      10000,
      savingsBalance,
      historyDays,
    )

    for (const [accountType, history] of [
      ['checking', checkingHistory],
      ['savings', savingsHistory],
    ] as const) {
      const ids = bankAccountIds[accountType]
      if (!ids) continue

      // Insert snapshots in batches (skip today — already created above)
      for (let i = 0; i < historyDays - 1; i++) {
        const date = daysAgo(historyDays - 1 - i)
        const balance = history[i]

        const snapshotId: Id<'balanceSnapshots'> = await ctx.runMutation(
          internal.seed.insertSeedSnapshot,
          {
            bankAccountId: ids.bankAccountId,
            portfolioId: portfolio._id,
            workspaceId: membership.workspaceId,
            accountType,
            balance,
            currency: 'EUR',
            date: formatDate(date),
            timestamp: date.getTime(),
          },
        )

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

    // 5. Create demo investments on the investment account
    const investIds = bankAccountIds.lifeinsurance
    if (investIds) {
      const placeholderInvestments = DEMO_INVESTMENTS.map((inv, idx) => ({
        powensInvestmentId: SEED_POWENS_INVESTMENT_BASE - idx,
        codeType: inv.codeType,
        originalCurrency: 'EUR',
        originalValuation: inv.quantity * inv.unitvalue,
        vdate: formatDate(daysAgo(1)),
        deleted: false,
        encryptedIdentity: '',
        encryptedValuation: '',
      }))

      const investmentIds = (await ctx.runMutation(
        internal.powens.upsertInvestments,
        {
          bankAccountId: investIds.bankAccountId,
          portfolioId: portfolio._id,
          investments: placeholderInvestments,
        },
      )) as Array<{ powensInvestmentId: number; id: Id<'investments'> }>

      const patches: Array<{
        id: Id<'investments'>
        encryptedIdentity: string
        encryptedValuation: string
      }> = []

      for (let idx = 0; idx < DEMO_INVESTMENTS.length; idx++) {
        const inv = DEMO_INVESTMENTS[idx]
        const idEntry = investmentIds.find(
          (e) => e.powensInvestmentId === SEED_POWENS_INVESTMENT_BASE - idx,
        )
        if (!idEntry) continue

        const valuation = inv.quantity * inv.unitvalue
        const diff = (inv.unitvalue - inv.unitprice) * inv.quantity
        const diffPercent =
          ((inv.unitvalue - inv.unitprice) / inv.unitprice) * 100

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
              valuation,
              diff: Math.round(diff * 100) / 100,
              diffPercent: Math.round(diffPercent * 100) / 100,
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

    // 6. Create demo transactions on the checking account
    const checkingIds = bankAccountIds.checking
    if (checkingIds) {
      const txns = DEMO_TRANSACTIONS.map((tmpl, idx) => {
        const date = daysAgo(idx * 2 + 1) // spread transactions across time
        return {
          ...tmpl,
          powensTransactionId: SEED_POWENS_TRANSACTION_BASE - idx,
          date: formatDate(date),
        }
      })

      const placeholderTxns = txns.map((txn) => ({
        powensTransactionId: txn.powensTransactionId,
        date: txn.date,
        rdate: undefined as string | undefined,
        vdate: undefined as string | undefined,
        originalCurrency: 'EUR' as string | undefined,
        type: txn.type as string | undefined,
        coming: false,
        active: true,
        deleted: false,
        encryptedDetails: '',
        encryptedFinancials: '',
        encryptedCategories: '',
      }))

      const transactionIds = (await ctx.runMutation(
        internal.powens.upsertTransactions,
        {
          bankAccountId: checkingIds.bankAccountId,
          portfolioId: portfolio._id,
          transactions: placeholderTxns,
        },
      )) as Array<{ powensTransactionId: number; id: Id<'transactions'> }>

      const txnPatches: Array<{
        id: Id<'transactions'>
        encryptedDetails: string
        encryptedFinancials: string
        encryptedCategories: string
      }> = []

      for (const txn of txns) {
        const idEntry = transactionIds.find(
          (e) => e.powensTransactionId === txn.powensTransactionId,
        )
        if (!idEntry) continue

        const groups = await encryptFieldGroups(
          {
            encryptedDetails: {
              wording: txn.wording,
              originalWording: txn.wording,
              simplifiedWording: txn.wording,
              counterparty: undefined,
              card: undefined,
              comment: undefined,
            },
            encryptedFinancials: {
              value: txn.value,
              originalValue: txn.value,
            },
            encryptedCategories: {
              category: txn.category,
              categoryParent: undefined,
              userCategoryKey: undefined,
            },
          },
          publicKey,
          idEntry.id,
        )
        txnPatches.push({
          id: idEntry.id,
          encryptedDetails: groups.encryptedDetails,
          encryptedFinancials: groups.encryptedFinancials,
          encryptedCategories: groups.encryptedCategories,
        })
      }

      if (txnPatches.length > 0) {
        await ctx.runMutation(
          internal.encryptionKeys.patchTransactionFieldGroups,
          { items: txnPatches },
        )
      }
    }

    return { success: true, message: 'Demo data seeded with encryption' }
  },
})

// ---------------------------------------------------------------------------
// Helper queries/mutations used only by seedDemoData
// ---------------------------------------------------------------------------

export const getMembershipByUserId = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
  },
})

export const getFirstPortfolio = internalQuery({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    return await ctx.db
      .query('portfolios')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
      .first()
  },
})

export const insertSeedSnapshot = internalMutation({
  args: {
    bankAccountId: v.id('bankAccounts'),
    portfolioId: v.id('portfolios'),
    workspaceId: v.id('workspaces'),
    accountType: v.string(),
    balance: v.number(),
    currency: v.string(),
    date: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    // Look up previous snapshot to compute delta
    const previous = await ctx.db
      .query('balanceSnapshots')
      .withIndex('by_bankAccountId_timestamp', (q) =>
        q.eq('bankAccountId', args.bankAccountId),
      )
      .order('desc')
      .first()
    const oldBalance = previous?.balance ?? 0
    const balanceDelta = args.balance - oldBalance

    const snapshotId = await ctx.db.insert('balanceSnapshots', {
      bankAccountId: args.bankAccountId,
      portfolioId: args.portfolioId,
      balance: args.balance,
      currency: args.currency,
      date: args.date,
      timestamp: args.timestamp,
      seed: true,
      encryptedData: '', // placeholder — patched with encrypted data by the action
    })

    // Update dailyNetWorth aggregate
    const existingNetWorth = await ctx.db
      .query('dailyNetWorth')
      .withIndex('by_portfolioId_date', (q) =>
        q.eq('portfolioId', args.portfolioId).eq('date', args.date),
      )
      .first()

    if (existingNetWorth) {
      await ctx.db.patch('dailyNetWorth', existingNetWorth._id, {
        balance:
          Math.round((existingNetWorth.balance + balanceDelta) * 100) / 100,
      })
    } else {
      const previousNetWorth = await ctx.db
        .query('dailyNetWorth')
        .withIndex('by_portfolioId_date', (q) =>
          q.eq('portfolioId', args.portfolioId),
        )
        .order('desc')
        .first()
      const carryForward = previousNetWorth?.balance ?? 0

      await ctx.db.insert('dailyNetWorth', {
        portfolioId: args.portfolioId,
        workspaceId: args.workspaceId,
        date: args.date,
        timestamp: args.timestamp,
        balance: Math.round((carryForward + balanceDelta) * 100) / 100,
        currency: args.currency,
      })
    }

    // Update dailyCategoryBalance aggregate
    const category = getCategoryKey(args.accountType)
    const existingCategory = await ctx.db
      .query('dailyCategoryBalance')
      .withIndex('by_portfolioId_category_date', (q) =>
        q
          .eq('portfolioId', args.portfolioId)
          .eq('category', category)
          .eq('date', args.date),
      )
      .first()

    if (existingCategory) {
      await ctx.db.patch('dailyCategoryBalance', existingCategory._id, {
        balance:
          Math.round((existingCategory.balance + balanceDelta) * 100) / 100,
      })
    } else {
      const previousCategory = await ctx.db
        .query('dailyCategoryBalance')
        .withIndex('by_portfolioId_category_date', (q) =>
          q.eq('portfolioId', args.portfolioId).eq('category', category),
        )
        .order('desc')
        .first()
      const carryForward = previousCategory?.balance ?? 0

      await ctx.db.insert('dailyCategoryBalance', {
        portfolioId: args.portfolioId,
        workspaceId: args.workspaceId,
        category,
        date: args.date,
        timestamp: args.timestamp,
        balance: Math.round((carryForward + balanceDelta) * 100) / 100,
        currency: args.currency,
      })
    }

    return snapshotId
  },
})

export const clearDemoData = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!membership) throw new Error('No workspace found')

    const portfolio = await ctx.db
      .query('portfolios')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .first()
    if (!portfolio) throw new Error('No portfolio found')

    // Delete all seeded snapshots and aggregate entries for this portfolio
    const [snapshots, dailyNetWorthEntries, dailyCategoryEntries] =
      await Promise.all([
        ctx.db
          .query('balanceSnapshots')
          .withIndex('by_portfolioId_timestamp', (q) =>
            q.eq('portfolioId', portfolio._id),
          )
          .collect(),
        ctx.db
          .query('dailyNetWorth')
          .withIndex('by_portfolioId_timestamp', (q) =>
            q.eq('portfolioId', portfolio._id),
          )
          .collect(),
        ctx.db
          .query('dailyCategoryBalance')
          .withIndex('by_portfolioId_timestamp', (q) =>
            q.eq('portfolioId', portfolio._id),
          )
          .collect(),
      ])
    await Promise.all([
      ...snapshots
        .filter((s) => s.seed)
        .map((s) => ctx.db.delete('balanceSnapshots', s._id)),
      ...dailyNetWorthEntries.map((d) => ctx.db.delete('dailyNetWorth', d._id)),
      ...dailyCategoryEntries.map((d) =>
        ctx.db.delete('dailyCategoryBalance', d._id),
      ),
    ])

    // Delete all transactions for this portfolio
    const transactions = await ctx.db
      .query('transactions')
      .withIndex('by_portfolioId', (q) => q.eq('portfolioId', portfolio._id))
      .collect()
    for (const txn of transactions) {
      await ctx.db.delete('transactions', txn._id)
    }

    // Delete all investments for this portfolio
    const investments = await ctx.db
      .query('investments')
      .withIndex('by_portfolioId', (q) => q.eq('portfolioId', portfolio._id))
      .collect()
    for (const inv of investments) {
      await ctx.db.delete('investments', inv._id)
    }

    // Delete all bank accounts for this portfolio
    const bankAccounts = await ctx.db
      .query('bankAccounts')
      .withIndex('by_portfolioId', (q) => q.eq('portfolioId', portfolio._id))
      .collect()
    for (const ba of bankAccounts) {
      await ctx.db.delete('bankAccounts', ba._id)
    }

    // Delete all connections for this portfolio
    const connections = await ctx.db
      .query('connections')
      .withIndex('by_portfolioId', (q) => q.eq('portfolioId', portfolio._id))
      .collect()
    for (const conn of connections) {
      await ctx.db.delete('connections', conn._id)
    }

    return { success: true, message: 'Demo data cleared' }
  },
})
