import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

async function seedTestData(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const workspaceId = await ctx.db.insert('workspaces', {
      name: 'Test Workspace',
      createdBy: 'user_test',
    })
    const memberId = await ctx.db.insert('workspaceMembers', {
      workspaceId,
      userId: 'user_test',
      role: 'owner',
    })
    const portfolioId = await ctx.db.insert('portfolios', {
      workspaceId,
      memberId,
      name: 'Main',
    })
    const connectionId = await ctx.db.insert('connections', {
      portfolioId,
      powensConnectionId: 1,
      encryptedData: '',
    })
    const bankAccountId = await ctx.db.insert('bankAccounts', {
      connectionId,
      portfolioId,
      powensBankAccountId: 1,
      currency: 'EUR',
      disabled: false,
      deleted: false,
      encryptedIdentity: '',
      encryptedBalance: '',
    })
    return { workspaceId, portfolioId, bankAccountId, memberId }
  })
}

function asUser(t: ReturnType<typeof convexTest>) {
  return t.withIdentity({
    subject: 'user_test',
    issuer: 'test',
    tokenIdentifier: 'test|user_test',
  })
}

describe('createManualTransaction', () => {
  it('creates a manual transaction and returns its id', async () => {
    const t = convexTest(schema, modules)
    const { portfolioId, bankAccountId } = await seedTestData(t)

    const transactionId = await asUser(t).mutation(
      api.transactions.createManualTransaction,
      {
        bankAccountId,
        portfolioId,
        date: '2026-04-01',
        encryptedDetails: 'enc-details',
        encryptedFinancials: 'enc-financials',
        encryptedCategories: 'enc-categories',
      },
    )

    expect(transactionId).toBeDefined()

    const txn = await t.run(async (ctx) => {
      return await ctx.db.get('transactions', transactionId)
    })

    expect(txn).not.toBeNull()
    expect(txn?.source).toBe('manual')
    expect(txn?.date).toBe('2026-04-01')
    expect(txn?.coming).toBe(false)
    expect(txn?.active).toBe(true)
    expect(txn?.deleted).toBe(false)
    expect(txn?.powensTransactionId).toBeUndefined()
    expect(txn?.encryptedDetails).toBe('enc-details')
    expect(txn?.encryptedFinancials).toBe('enc-financials')
    expect(txn?.encryptedCategories).toBe('enc-categories')
  })

  it('rejects when bank account does not belong to portfolio', async () => {
    const t = convexTest(schema, modules)
    const { portfolioId } = await seedTestData(t)

    // Create a second portfolio with its own bank account
    const otherBankAccountId = await t.run(async (ctx) => {
      const ws2 = await ctx.db.insert('workspaces', {
        name: 'Other',
        createdBy: 'user_other',
      })
      const m2 = await ctx.db.insert('workspaceMembers', {
        workspaceId: ws2,
        userId: 'user_other',
        role: 'owner',
      })
      const p2 = await ctx.db.insert('portfolios', {
        workspaceId: ws2,
        memberId: m2,
        name: 'Other',
      })
      const c2 = await ctx.db.insert('connections', {
        portfolioId: p2,
        powensConnectionId: 2,
        encryptedData: '',
      })
      return await ctx.db.insert('bankAccounts', {
        connectionId: c2,
        portfolioId: p2,
        powensBankAccountId: 2,
        currency: 'EUR',
        disabled: false,
        deleted: false,
        encryptedIdentity: '',
        encryptedBalance: '',
      })
    })

    await expect(
      asUser(t).mutation(api.transactions.createManualTransaction, {
        bankAccountId: otherBankAccountId,
        portfolioId,
        date: '2026-04-01',
        encryptedDetails: '',
        encryptedFinancials: '',
        encryptedCategories: '',
      }),
    ).rejects.toThrow()
  })
})

describe('updateManualTransaction', () => {
  it('updates a manual transaction', async () => {
    const t = convexTest(schema, modules)
    const { portfolioId, bankAccountId } = await seedTestData(t)

    const transactionId = await asUser(t).mutation(
      api.transactions.createManualTransaction,
      {
        bankAccountId,
        portfolioId,
        date: '2026-04-01',
        encryptedDetails: 'old-details',
        encryptedFinancials: 'old-financials',
        encryptedCategories: 'old-categories',
      },
    )

    await asUser(t).mutation(api.transactions.updateManualTransaction, {
      transactionId,
      date: '2026-04-05',
      encryptedDetails: 'new-details',
      encryptedFinancials: 'new-financials',
    })

    const txn = await t.run(async (ctx) => {
      return await ctx.db.get('transactions', transactionId)
    })

    expect(txn?.date).toBe('2026-04-05')
    expect(txn?.encryptedDetails).toBe('new-details')
    expect(txn?.encryptedFinancials).toBe('new-financials')
    // Categories should remain unchanged
    expect(txn?.encryptedCategories).toBe('old-categories')
  })

  it('rejects updating a synced transaction', async () => {
    const t = convexTest(schema, modules)
    const { portfolioId, bankAccountId } = await seedTestData(t)

    // Insert a synced transaction directly
    const syncedId = await t.run(async (ctx) => {
      return await ctx.db.insert('transactions', {
        bankAccountId,
        portfolioId,
        powensTransactionId: 999,
        date: '2026-04-01',
        coming: false,
        active: true,
        deleted: false,
        encryptedDetails: '',
        encryptedFinancials: '',
        encryptedCategories: '',
      })
    })

    await expect(
      asUser(t).mutation(api.transactions.updateManualTransaction, {
        transactionId: syncedId,
        date: '2026-04-10',
      }),
    ).rejects.toThrow('Only manual transactions can be edited')
  })
})

describe('deleteManualTransaction', () => {
  it('soft-deletes a manual transaction', async () => {
    const t = convexTest(schema, modules)
    const { portfolioId, bankAccountId } = await seedTestData(t)

    const transactionId = await asUser(t).mutation(
      api.transactions.createManualTransaction,
      {
        bankAccountId,
        portfolioId,
        date: '2026-04-01',
        encryptedDetails: 'details',
        encryptedFinancials: 'financials',
        encryptedCategories: 'categories',
      },
    )

    await asUser(t).mutation(api.transactions.deleteManualTransaction, {
      transactionId,
    })

    const txn = await t.run(async (ctx) => {
      return await ctx.db.get('transactions', transactionId)
    })

    expect(txn).not.toBeNull()
    expect(txn?.deleted).toBe(true)
  })

  it('rejects deleting a synced transaction', async () => {
    const t = convexTest(schema, modules)
    const { portfolioId, bankAccountId } = await seedTestData(t)

    const syncedId = await t.run(async (ctx) => {
      return await ctx.db.insert('transactions', {
        bankAccountId,
        portfolioId,
        powensTransactionId: 888,
        date: '2026-04-01',
        coming: false,
        active: true,
        deleted: false,
        encryptedDetails: '',
        encryptedFinancials: '',
        encryptedCategories: '',
      })
    })

    await expect(
      asUser(t).mutation(api.transactions.deleteManualTransaction, {
        transactionId: syncedId,
      }),
    ).rejects.toThrow('Only manual transactions can be deleted')
  })
})
