import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { CategoryCombobox } from '~/components/category-combobox'
import { useEncryption } from '~/contexts/encryption-context'
import { useCategories } from '~/lib/categories'
import { encryptData, importPublicKey } from '~/lib/crypto'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

interface CategoryPickerProps {
  transactionId: string
  currentCategoryKey: string
  wording: string
  onCreateRule?: (wording: string, categoryKey: string) => void
  modal?: boolean
}

export function CategoryPicker({
  transactionId,
  currentCategoryKey,
  wording,
  onCreateRule,
  modal,
}: CategoryPickerProps) {
  const { getCategory } = useCategories()
  const { workspacePublicKey } = useEncryption()
  const updateCategory = useMutation(api.transactions.updateTransactionCategory)

  const handleChange = async (categoryKey: string, categoryLabel: string) => {
    if (categoryKey === currentCategoryKey) return

    try {
      if (!workspacePublicKey) throw new Error('Vault not unlocked')
      const pubKey = await importPublicKey(workspacePublicKey)
      const encryptedCategories = await encryptData(
        {
          category: categoryKey,
          categoryParent: undefined,
          userCategoryKey: categoryKey,
        },
        pubKey,
        transactionId,
        'encryptedCategories',
      )
      await updateCategory({
        transactionId: transactionId as Id<'transactions'>,
        encryptedCategories,
      })
      const label = categoryLabel || getCategory(categoryKey).label
      toast.success('Category updated', {
        description: `Changed to "${label}"`,
        action: onCreateRule
          ? {
              label: 'Create rule',
              onClick: () => onCreateRule(wording, categoryKey),
            }
          : undefined,
      })
    } catch {
      toast.error('Failed to update category')
    }
  }

  return (
    <CategoryCombobox
      value={currentCategoryKey}
      onChange={handleChange}
      allowCreate
      modal={modal}
    />
  )
}
