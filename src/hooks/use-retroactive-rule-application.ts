import { useConvex, useMutation } from 'convex/react'
import type { PaginationResult } from 'convex/server'
import { useCallback } from 'react'
import { useBulkOperationOptional } from '~/contexts/bulk-operation-context'
import { useEncryption } from '~/contexts/encryption-context'
import { usePortfolio } from '~/contexts/portfolio-context'
import { decryptFieldGroups, encryptData, importPublicKey } from '~/lib/crypto'
import i18n from '~/lib/i18n'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

const BATCH_SIZE = 50
const PAGE_SIZE = 500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useRetroactiveRuleApplication() {
  const { workspacePublicKey, privateKey } = useEncryption()
  const { allPortfolioIds } = usePortfolio()
  const bulkOp = useBulkOperationOptional()
  const convex = useConvex()
  const batchUpdateCategories = useMutation(
    api.transactions.batchUpdateTransactionCategories,
  )
  const batchUpdateLabels = useMutation(
    api.transactions.batchUpdateTransactionLabels,
  )
  const batchUpdateExclusion = useMutation(
    api.transactions.batchUpdateTransactionExclusion,
  )
  const batchUpdateDetails = useMutation(
    api.transactions.batchUpdateTransactionDetails,
  )
  const recordRuleApplication = useMutation(
    api.transactionRules.recordRuleApplication,
  )

  const apply = useCallback(
    async (params: {
      ruleId: Id<'transactionRules'>
      rulePattern: string
      pattern: string
      matchType: 'contains' | 'regex'
      categoryKey?: string
      excludeFromBudget?: boolean
      labelIds?: string[]
      customDescription?: string
      portfolioId?: Id<'portfolios'>
      accountIds?: Array<Id<'bankAccounts'>>
    }) => {
      if (!privateKey || !workspacePublicKey) {
        bulkOp?.setError(i18n.t('error.encryptionNotUnlocked'))
        return
      }

      const pubKey = await importPublicKey(workspacePublicKey)

      // Scope to specific portfolio or all portfolios
      const targetPortfolioIds = params.portfolioId
        ? [params.portfolioId]
        : allPortfolioIds

      // Get total count for progress bar
      const totalCount = await convex.query(
        api.transactions.countAllTransactions,
        { portfolioIds: targetPortfolioIds },
      )
      if (!totalCount) return

      let matcher: (text: string) => boolean
      if (params.matchType === 'regex') {
        const re = new RegExp(params.pattern, 'i')
        matcher = (text) => re.test(text)
      } else {
        const lower = params.pattern.toLowerCase()
        matcher = (text) => text.toLowerCase().includes(lower)
      }

      const accountIdSet =
        params.accountIds && params.accountIds.length > 0
          ? new Set(params.accountIds as string[])
          : null

      bulkOp?.start(params.pattern, totalCount)
      let processed = 0
      let updated = 0

      // Process each portfolio separately using cursor-based pagination
      for (const portfolioId of targetPortfolioIds) {
        let cursor: string | null = null
        let isDone = false

        while (!isDone) {
          if (bulkOp?.cancelRef.current) break

          const result: PaginationResult<
            (typeof api.transactions.listTransactionPage)['_returnType']['page'][number]
          > = await convex.query(api.transactions.listTransactionPage, {
            portfolioId,
            paginationOpts: { numItems: PAGE_SIZE, cursor },
          })

          const page = result.page
          isDone = result.isDone
          cursor = result.continueCursor

          // Process this page in chunks of BATCH_SIZE
          for (let i = 0; i < page.length; i += BATCH_SIZE) {
            if (bulkOp?.cancelRef.current) break

            while (bulkOp?.pauseRef.current && !bulkOp.cancelRef.current) {
              await sleep(200)
            }
            if (bulkOp?.cancelRef.current) break

            const chunk = page.slice(i, i + BATCH_SIZE)
            const categoryItems: Array<{
              transactionId: Id<'transactions'>
              encryptedCategories: string
            }> = []
            const detailItems: Array<{
              transactionId: Id<'transactions'>
              encryptedDetails: string
            }> = []
            const exclusionIds: Array<Id<'transactions'>> = []
            const labelIds: Array<Id<'transactions'>> = []
            const affectedTransactionIds = new Set<Id<'transactions'>>()

            for (const txn of chunk) {
              try {
                // Skip if rule has account filters and this transaction's account is not included
                if (
                  accountIdSet &&
                  !accountIdSet.has(txn.bankAccountId as string)
                ) {
                  continue
                }

                const details = await decryptFieldGroups(
                  { encryptedDetails: txn.encryptedDetails },
                  privateKey,
                  txn._id,
                )

                const searchParts = [
                  details.wording,
                  details.originalWording,
                  details.simplifiedWording,
                ].filter(Boolean) as string[]
                const searchText = searchParts.join(' ')

                if (!matcher(searchText)) continue

                affectedTransactionIds.add(txn._id)

                if (params.categoryKey) {
                  const categories = await decryptFieldGroups(
                    { encryptedCategories: txn.encryptedCategories },
                    privateKey,
                    txn._id,
                  )

                  if (!categories.userCategoryKey) {
                    const newCategories = {
                      ...categories,
                      userCategoryKey: params.categoryKey,
                    }
                    const encrypted = await encryptData(
                      newCategories,
                      pubKey,
                      txn._id,
                      'encryptedCategories',
                    )
                    categoryItems.push({
                      transactionId: txn._id,
                      encryptedCategories: encrypted,
                    })
                  }
                }

                if (params.customDescription && !details.customDescription) {
                  const newDetails = {
                    ...details,
                    customDescription: params.customDescription,
                  }
                  const encrypted = await encryptData(
                    newDetails,
                    pubKey,
                    txn._id,
                    'encryptedDetails',
                  )
                  detailItems.push({
                    transactionId: txn._id,
                    encryptedDetails: encrypted,
                  })
                }

                if (params.excludeFromBudget && !txn.excludedFromBudget) {
                  exclusionIds.push(txn._id)
                }

                if (params.labelIds && params.labelIds.length > 0) {
                  labelIds.push(txn._id)
                }
              } catch {
                // Skip transactions that fail to decrypt
              }
            }

            if (categoryItems.length > 0) {
              try {
                await batchUpdateCategories({ items: categoryItems })
              } catch {
                bulkOp?.setError(i18n.t('error.failedSaveBatch'))
                return
              }
            }

            if (detailItems.length > 0) {
              try {
                await batchUpdateDetails({ items: detailItems })
              } catch {
                bulkOp?.setError(i18n.t('error.failedSaveBatch'))
                return
              }
            }

            if (exclusionIds.length > 0) {
              try {
                await batchUpdateExclusion({
                  transactionIds: exclusionIds,
                  excludedFromBudget: true,
                })
              } catch {
                bulkOp?.setError(i18n.t('error.failedSaveBatch'))
                return
              }
            }

            if (
              params.labelIds &&
              params.labelIds.length > 0 &&
              labelIds.length > 0
            ) {
              try {
                await batchUpdateLabels({
                  transactionIds: labelIds,
                  addLabelIds: params.labelIds as Array<
                    Id<'transactionLabels'>
                  >,
                })
              } catch {
                bulkOp?.setError(i18n.t('error.failedSaveBatch'))
                return
              }
            }

            updated += affectedTransactionIds.size

            if (affectedTransactionIds.size > 0) {
              const appliedActions: string[] = []
              if (params.categoryKey) appliedActions.push('category')
              if (params.customDescription) appliedActions.push('description')
              if (params.excludeFromBudget)
                appliedActions.push('excludeFromBudget')
              if (params.labelIds && params.labelIds.length > 0)
                appliedActions.push('labels')

              await recordRuleApplication({
                ruleId: params.ruleId,
                rulePattern: params.rulePattern,
                transactionIds: [...affectedTransactionIds],
                appliedActions,
              })
            }

            processed += chunk.length
            bulkOp?.updateProgress(processed)
          }
        }

        if (bulkOp?.cancelRef.current) break
      }

      if (bulkOp?.cancelRef.current) return
      bulkOp?.complete(updated)
    },
    [
      privateKey,
      workspacePublicKey,
      allPortfolioIds,
      bulkOp,
      convex,
      batchUpdateCategories,
      batchUpdateDetails,
      batchUpdateExclusion,
      batchUpdateLabels,
      recordRuleApplication,
    ],
  )

  return { apply }
}
