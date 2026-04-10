/**
 * Shared hook for fetching transactions by portfolio mode (single/all/team).
 * Handles 3-way query branching + decryption via useCachedDecryptRecords.
 */

import { useQuery } from 'convex/react'
import { usePortfolio } from '~/contexts/portfolio-context'
import { useCachedDecryptRecords } from '~/hooks/use-cached-decrypt'
import type { DateRange } from '~/hooks/use-date-range'
import type { TransactionRecord } from '~/lib/financial-summary'
import { api } from '../../convex/_generated/api'

interface UseTransactionsOptions {
  range: DateRange
  cacheKey: string
  enabled?: boolean
}

interface UseTransactionsReturn {
  transactions: Array<TransactionRecord> | undefined
  isLoading: boolean
}

export function useTransactions({
  range,
  cacheKey,
  enabled = true,
}: UseTransactionsOptions): UseTransactionsReturn {
  const {
    isLoading: portfolioLoading,
    isAllPortfolios,
    isTeamView,
    allPortfolioIds,
    singlePortfolioId,
    portfolios,
  } = usePortfolio()

  const workspaceId = portfolios?.[0]?.workspaceId ?? null

  const transactionsSingle = useQuery(
    api.transactions.listTransactionsByPortfolio,
    enabled && singlePortfolioId
      ? {
          portfolioId: singlePortfolioId,
          startDate: range.start,
          endDate: range.end,
        }
      : 'skip',
  )

  const transactionsAll = useQuery(
    api.transactions.listAllTransactionsByPortfolios,
    enabled && isAllPortfolios && allPortfolioIds.length > 0
      ? {
          portfolioIds: allPortfolioIds,
          startDate: range.start,
          endDate: range.end,
        }
      : 'skip',
  )

  const transactionsTeam = useQuery(
    api.team.listTeamTransactions,
    enabled && isTeamView && workspaceId
      ? {
          workspaceId,
          startDate: range.start,
          endDate: range.end,
        }
      : 'skip',
  )

  const rawTransactions = isTeamView
    ? transactionsTeam
    : isAllPortfolios
      ? transactionsAll
      : transactionsSingle

  const transactions = useCachedDecryptRecords(
    cacheKey,
    rawTransactions as Array<TransactionRecord> | undefined,
  )

  return {
    transactions,
    isLoading: portfolioLoading || transactions === undefined,
  }
}
