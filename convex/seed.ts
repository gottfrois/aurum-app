import { v } from 'convex/values'
import { internalMutation } from './_generated/server'

// Deterministic pseudo-random based on seed
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

export const seedDemoData = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    // Find user's workspace and profile
    const membership = await ctx.db
      .query('workspaceMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!membership) throw new Error('No workspace found')

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .first()
    if (!profile) throw new Error('No profile found')

    // --- Connections ---
    const bnpConnection = await ctx.db.insert('connections', {
      profileId: profile._id,
      powensConnectionId: 90001,
      connectorName: 'BNP Paribas',
      state: 'SyncDone',
      lastSync: new Date().toISOString(),
      encrypted: false,
    })

    const boursoConnection = await ctx.db.insert('connections', {
      profileId: profile._id,
      powensConnectionId: 90002,
      connectorName: 'Boursorama',
      state: 'SyncDone',
      lastSync: new Date().toISOString(),
      encrypted: false,
    })

    const fortuneoConnection = await ctx.db.insert('connections', {
      profileId: profile._id,
      powensConnectionId: 90003,
      connectorName: 'Fortuneo',
      state: 'SyncDone',
      lastSync: new Date().toISOString(),
      encrypted: false,
    })

    // --- Bank Accounts ---
    const bnpChecking = await ctx.db.insert('bankAccounts', {
      connectionId: bnpConnection,
      profileId: profile._id,
      powensBankAccountId: 80001,
      name: 'Compte Courant',
      iban: 'FR7630004000031234567890143',
      type: 'checking',
      balance: 4820.35,
      currency: 'EUR',
      disabled: false,
      deleted: false,
      lastSync: new Date().toISOString(),
      encrypted: false,
    })

    const bnpLivretA = await ctx.db.insert('bankAccounts', {
      connectionId: bnpConnection,
      profileId: profile._id,
      powensBankAccountId: 80002,
      name: 'Livret A',
      type: 'livret_a',
      balance: 22950.0,
      currency: 'EUR',
      disabled: false,
      deleted: false,
      lastSync: new Date().toISOString(),
      encrypted: false,
    })

    const boursoChecking = await ctx.db.insert('bankAccounts', {
      connectionId: boursoConnection,
      profileId: profile._id,
      powensBankAccountId: 80003,
      name: 'Compte Courant',
      iban: 'FR7640618000011234567890189',
      type: 'checking',
      balance: 3175.6,
      currency: 'EUR',
      disabled: false,
      deleted: false,
      lastSync: new Date().toISOString(),
      encrypted: false,
    })

    const boursoPEA = await ctx.db.insert('bankAccounts', {
      connectionId: boursoConnection,
      profileId: profile._id,
      powensBankAccountId: 80004,
      name: 'PEA',
      type: 'pea',
      balance: 38420.8,
      currency: 'EUR',
      disabled: false,
      deleted: false,
      lastSync: new Date().toISOString(),
      encrypted: false,
    })

    const boursoAV = await ctx.db.insert('bankAccounts', {
      connectionId: boursoConnection,
      profileId: profile._id,
      powensBankAccountId: 80005,
      name: 'Assurance Vie',
      type: 'lifeinsurance',
      balance: 52340.15,
      currency: 'EUR',
      disabled: false,
      deleted: false,
      lastSync: new Date().toISOString(),
      encrypted: false,
    })

    const fortuneoCTO = await ctx.db.insert('bankAccounts', {
      connectionId: fortuneoConnection,
      profileId: profile._id,
      powensBankAccountId: 80006,
      name: 'Compte-Titres',
      type: 'market',
      balance: 15890.42,
      currency: 'EUR',
      disabled: false,
      deleted: false,
      lastSync: new Date().toISOString(),
      encrypted: false,
    })

    const fortuneoLDDS = await ctx.db.insert('bankAccounts', {
      connectionId: fortuneoConnection,
      profileId: profile._id,
      powensBankAccountId: 80007,
      name: 'LDDS',
      type: 'ldds',
      balance: 12000.0,
      currency: 'EUR',
      disabled: false,
      deleted: false,
      lastSync: new Date().toISOString(),
      encrypted: false,
    })

    // --- Investments (PEA) ---
    await ctx.db.insert('investments', {
      bankAccountId: boursoPEA,
      profileId: profile._id,
      powensInvestmentId: 70001,
      code: 'LU1681043599',
      codeType: 'ISIN',
      label: 'Amundi MSCI World UCITS ETF',
      quantity: 42,
      unitprice: 420.5,
      unitvalue: 498.35,
      valuation: 20930.7,
      portfolioShare: 54.48,
      diff: 3269.7,
      diffPercent: 18.52,
      deleted: false,
      encrypted: false,
    })

    await ctx.db.insert('investments', {
      bankAccountId: boursoPEA,
      profileId: profile._id,
      powensInvestmentId: 70002,
      code: 'LU1681044480',
      codeType: 'ISIN',
      label: 'Amundi Euro Stoxx 50 ETF',
      quantity: 85,
      unitprice: 98.2,
      unitvalue: 112.45,
      valuation: 9558.25,
      portfolioShare: 24.88,
      diff: 1211.25,
      diffPercent: 14.51,
      deleted: false,
      encrypted: false,
    })

    await ctx.db.insert('investments', {
      bankAccountId: boursoPEA,
      profileId: profile._id,
      powensInvestmentId: 70003,
      code: 'FR0010315770',
      codeType: 'ISIN',
      label: 'Lyxor CAC 40 ETF',
      quantity: 55,
      unitprice: 125.3,
      unitvalue: 144.05,
      valuation: 7922.75,
      portfolioShare: 20.62,
      diff: 1031.25,
      diffPercent: 14.96,
      deleted: false,
      encrypted: false,
    })

    // --- Investments (CTO) ---
    await ctx.db.insert('investments', {
      bankAccountId: fortuneoCTO,
      profileId: profile._id,
      powensInvestmentId: 70004,
      code: 'US0378331005',
      codeType: 'ISIN',
      label: 'Apple Inc.',
      quantity: 12,
      unitprice: 142.5,
      unitvalue: 178.72,
      valuation: 2144.64,
      portfolioShare: 13.5,
      diff: 434.64,
      diffPercent: 25.41,
      originalCurrency: 'USD',
      originalValuation: 2330.0,
      deleted: false,
      encrypted: false,
    })

    await ctx.db.insert('investments', {
      bankAccountId: fortuneoCTO,
      profileId: profile._id,
      powensInvestmentId: 70005,
      code: 'US5949181045',
      codeType: 'ISIN',
      label: 'Microsoft Corp.',
      quantity: 8,
      unitprice: 280.0,
      unitvalue: 415.6,
      valuation: 3324.8,
      portfolioShare: 20.92,
      diff: 1084.8,
      diffPercent: 48.43,
      originalCurrency: 'USD',
      originalValuation: 3612.0,
      deleted: false,
      encrypted: false,
    })

    await ctx.db.insert('investments', {
      bankAccountId: fortuneoCTO,
      profileId: profile._id,
      powensInvestmentId: 70006,
      code: 'IE00BK5BQT80',
      codeType: 'ISIN',
      label: 'Vanguard FTSE All-World ETF',
      quantity: 75,
      unitprice: 95.2,
      unitvalue: 113.5,
      valuation: 8512.5,
      portfolioShare: 53.57,
      diff: 1372.5,
      diffPercent: 19.23,
      deleted: false,
      encrypted: false,
    })

    // --- Investments (Assurance Vie) ---
    await ctx.db.insert('investments', {
      bankAccountId: boursoAV,
      profileId: profile._id,
      powensInvestmentId: 70007,
      label: 'Fonds Euro Exclusif',
      quantity: 1,
      unitprice: 35000.0,
      unitvalue: 37850.0,
      valuation: 37850.0,
      portfolioShare: 72.32,
      diff: 2850.0,
      diffPercent: 8.14,
      deleted: false,
      encrypted: false,
    })

    await ctx.db.insert('investments', {
      bankAccountId: boursoAV,
      profileId: profile._id,
      powensInvestmentId: 70008,
      code: 'FR0010135103',
      codeType: 'ISIN',
      label: 'Amundi MSCI Emerging Markets',
      quantity: 120,
      unitprice: 95.0,
      unitvalue: 102.88,
      valuation: 12345.6,
      portfolioShare: 23.59,
      diff: 945.6,
      diffPercent: 8.29,
      deleted: false,
      encrypted: false,
    })

    await ctx.db.insert('investments', {
      bankAccountId: boursoAV,
      profileId: profile._id,
      powensInvestmentId: 70009,
      code: 'FR0011869320',
      codeType: 'ISIN',
      label: 'Lyxor Green Bond ETF',
      quantity: 30,
      unitprice: 64.0,
      unitvalue: 71.48,
      valuation: 2144.55,
      portfolioShare: 4.09,
      diff: 224.55,
      diffPercent: 11.69,
      deleted: false,
      encrypted: false,
    })

    // --- Balance Snapshots (1 year of daily data) ---
    // More volatile and interesting curves:
    // - Checking accounts: salary spikes + spending dips (sawtooth pattern)
    // - Savings: slow steady growth with occasional lump deposits
    // - Investments: market-like volatility with momentum and corrections
    // - Insurance: steady growth with mild fluctuations
    const accounts = [
      {
        id: bnpChecking,
        base: 3200,
        end: 4820,
        volatility: 0.04,
        salaryDay: 25,
        salaryAmount: 3400,
        spendRate: 110,
      },
      {
        id: boursoChecking,
        base: 2200,
        end: 3175,
        volatility: 0.03,
        salaryDay: 28,
        salaryAmount: 1800,
        spendRate: 55,
      },
      { id: bnpLivretA, base: 18500, end: 22950, volatility: 0.002 },
      { id: fortuneoLDDS, base: 8500, end: 12000, volatility: 0.002 },
      { id: boursoPEA, base: 26000, end: 38420, volatility: 0.015 },
      { id: fortuneoCTO, base: 10500, end: 15890, volatility: 0.018 },
      { id: boursoAV, base: 44000, end: 52340, volatility: 0.006 },
    ]

    const now = new Date()
    const oneYearAgo = new Date(now)
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const totalDays = Math.round(
      (now.getTime() - oneYearAgo.getTime()) / (1000 * 60 * 60 * 24),
    )

    for (const account of accounts) {
      let balance = account.base
      let seed = Math.round(account.base * 7.13)
      let momentum = 0
      const current = new Date(oneYearAgo)
      let dayIndex = 0

      while (current <= now) {
        const dateStr = current.toISOString().split('T')[0]
        const timestamp = current.getTime()
        const dayOfMonth = current.getDate()
        const progress = dayIndex / totalDays

        seed++
        const r1 = seededRandom(seed)
        seed++
        const r2 = seededRandom(seed)

        if (
          'salaryDay' in account &&
          account.salaryDay &&
          account.salaryAmount
        ) {
          // Checking accounts: salary deposits + daily spending
          if (dayOfMonth === account.salaryDay) {
            balance += account.salaryAmount
          }
          // Daily spending with weekend variation
          const dayOfWeek = current.getDay()
          const weekendMultiplier =
            dayOfWeek === 0 || dayOfWeek === 6 ? 1.6 : 1.0
          balance -= account.spendRate * weekendMultiplier * (0.5 + r1)
          // Occasional larger expenses
          if (r2 > 0.93) {
            balance -= 200 + r1 * 500
          }
          // Gradual upward drift toward end balance
          balance += ((account.end - account.base) / totalDays) * 0.3
        } else {
          // Investment / savings accounts: momentum-based random walk
          // Target drift to reach end balance
          const drift = (account.end - account.base) / totalDays

          // Market-like: momentum + mean reversion + random shocks
          const shock = (r1 - 0.5) * 2 * account.volatility * balance
          momentum = momentum * 0.92 + shock * 0.3
          let change = drift + momentum + shock

          // Occasional larger moves (earnings, market events)
          if (r2 > 0.96) {
            change += (r1 - 0.4) * account.volatility * balance * 3
          }
          // Small correction if drifting too far from expected path
          const expected =
            account.base + (account.end - account.base) * progress
          const deviation = (balance - expected) / expected
          change -= deviation * balance * 0.02

          balance += change
        }

        // Floor: never drop below 60% of base
        balance = Math.max(balance, account.base * 0.6)

        // Last 5 days: lerp toward target end balance for guaranteed profit
        const daysRemaining = totalDays - dayIndex
        if (daysRemaining <= 5 && daysRemaining >= 0) {
          const t = 1 - daysRemaining / 5
          balance = balance + (account.end - balance) * t
        }

        const snapshotBalance = Math.round(balance * 100) / 100

        await ctx.db.insert('balanceSnapshots', {
          bankAccountId: account.id,
          profileId: profile._id,
          balance: snapshotBalance,
          currency: 'EUR',
          date: dateStr,
          timestamp,
          seed: true,
          encrypted: false,
        })

        // Update dailyNetWorth aggregate
        const existingDnw = await ctx.db
          .query('dailyNetWorth')
          .withIndex('by_profileId_date', (q) =>
            q.eq('profileId', profile._id).eq('date', dateStr),
          )
          .first()

        if (existingDnw) {
          await ctx.db.patch('dailyNetWorth', existingDnw._id, {
            balance:
              Math.round((existingDnw.balance + snapshotBalance) * 100) / 100,
          })
        } else {
          await ctx.db.insert('dailyNetWorth', {
            profileId: profile._id,
            date: dateStr,
            timestamp,
            balance: snapshotBalance,
            currency: 'EUR',
          })
        }

        current.setDate(current.getDate() + 1)
        dayIndex++
      }
    }

    return { success: true, message: 'Demo data seeded (1 year)' }
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

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_workspaceId', (q) =>
        q.eq('workspaceId', membership.workspaceId),
      )
      .first()
    if (!profile) throw new Error('No profile found')

    // Delete all seeded snapshots
    const snapshots = await ctx.db
      .query('balanceSnapshots')
      .withIndex('by_profileId_timestamp', (q) =>
        q.eq('profileId', profile._id),
      )
      .collect()
    for (const s of snapshots) {
      if (s.seed) await ctx.db.delete('balanceSnapshots', s._id)
    }

    // Delete all dailyNetWorth entries for this profile
    const dailyNetWorthEntries = await ctx.db
      .query('dailyNetWorth')
      .withIndex('by_profileId_timestamp', (q) =>
        q.eq('profileId', profile._id),
      )
      .collect()
    for (const d of dailyNetWorthEntries) {
      await ctx.db.delete('dailyNetWorth', d._id)
    }

    // Delete all investments for this profile
    const investments = await ctx.db
      .query('investments')
      .withIndex('by_profileId', (q) => q.eq('profileId', profile._id))
      .collect()
    for (const inv of investments) {
      await ctx.db.delete('investments', inv._id)
    }

    // Delete all bank accounts for this profile
    const bankAccounts = await ctx.db
      .query('bankAccounts')
      .withIndex('by_profileId', (q) => q.eq('profileId', profile._id))
      .collect()
    for (const ba of bankAccounts) {
      await ctx.db.delete('bankAccounts', ba._id)
    }

    // Delete all connections for this profile
    const connections = await ctx.db
      .query('connections')
      .withIndex('by_profileId', (q) => q.eq('profileId', profile._id))
      .collect()
    for (const conn of connections) {
      await ctx.db.delete('connections', conn._id)
    }

    return { success: true, message: 'Demo data cleared' }
  },
})
