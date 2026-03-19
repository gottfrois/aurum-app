import { useConvex, useMutation } from 'convex/react'
import { useCallback } from 'react'
import { useBulkOperationOptional } from '~/contexts/bulk-operation-context'
import { useEncryption } from '~/contexts/encryption-context'
import { usePortfolio } from '~/contexts/portfolio-context'
import { decryptFieldGroups, encryptData, importPublicKey } from '~/lib/crypto'
import { api } from '../../convex/_generated/api'

const BATCH_SIZE = 50

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
  const batchUpdateExclusion = useMutation(
    api.transactions.batchUpdateTransactionExclusion,
  )

  const apply = useCallback(
    async (params: {
      pattern: string
      matchType: 'contains' | 'regex'
      categoryKey?: string
      excludeFromBudget?: boolean
    }) => {
      if (!privateKey || !workspacePublicKey) {
        bulkOp?.setError('Encryption not unlocked')
        return
      }

      const pubKey = await importPublicKey(workspacePublicKey)

      const transactions = await convex.query(
        api.transactions.listAllTransactions,
        { portfolioIds: allPortfolioIds },
      )

      if (!transactions || transactions.length === 0) {
        return
      }

      bulkOp?.start(params.pattern, transactions.length)

      let matcher: (text: string) => boolean
      if (params.matchType === 'regex') {
        const re = new RegExp(params.pattern, 'i')
        matcher = (text) => re.test(text)
      } else {
        const lower = params.pattern.toLowerCase()
        matcher = (text) => text.toLowerCase().includes(lower)
      }

      let processed = 0

      for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        // Check cancel
        if (bulkOp?.cancelRef.current) break

        // Check pause — poll until resumed
        while (bulkOp?.pauseRef.current && !bulkOp.cancelRef.current) {
          await sleep(200)
        }
        if (bulkOp?.cancelRef.current) break

        const chunk = transactions.slice(i, i + BATCH_SIZE)
        const categoryItems: Array<{
          transactionId: (typeof transactions)[number]['_id']
          encryptedCategories: string
        }> = []
        const exclusionIds: Array<(typeof transactions)[number]['_id']> = []

        for (const txn of chunk) {
          try {
            // Decrypt details to get wording fields
            const details = await decryptFieldGroups(
              { encryptedDetails: txn.encryptedDetails },
              privateKey,
              txn._id,
            )

            // Build search text from wording fields
            const searchParts = [
              details.wording,
              details.originalWording,
              details.simplifiedWording,
            ].filter(Boolean) as string[]
            const searchText = searchParts.join(' ')

            if (!matcher(searchText)) continue

            // Apply category action
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

            // Apply exclusion action
            if (params.excludeFromBudget && !txn.excludedFromBudget) {
              exclusionIds.push(txn._id)
            }
          } catch {
            // Skip transactions that fail to decrypt
          }
        }

        if (categoryItems.length > 0) {
          try {
            await batchUpdateCategories({ items: categoryItems })
          } catch {
            bulkOp?.setError('Failed to save batch')
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
            bulkOp?.setError('Failed to save batch')
            return
          }
        }

        processed += chunk.length
        bulkOp?.updateProgress(processed)
      }

      if (bulkOp?.cancelRef.current) return
      bulkOp?.complete()
    },
    [
      privateKey,
      workspacePublicKey,
      allPortfolioIds,
      bulkOp,
      convex,
      batchUpdateCategories,
      batchUpdateExclusion,
    ],
  )

  return { apply }
}
