import * as Sentry from '@sentry/tanstackstart-react'
import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      const prevCat = currentCategoryKey
        ? getCategory(currentCategoryKey)
        : undefined
      const newCat = getCategory(categoryKey)
      await updateCategory({
        transactionId: transactionId as Id<'transactions'>,
        encryptedCategories,
        categoryKey,
        categoryLabel: categoryLabel || newCat.label,
        categoryColor: newCat.color,
        previousCategoryKey: currentCategoryKey || undefined,
        previousCategoryLabel: prevCat?.label || undefined,
        previousCategoryColor: prevCat?.color || undefined,
      })
      const label = categoryLabel || getCategory(categoryKey).label
      toast.success(t('toast.categoryUpdated'), {
        description: t('toast.categoryUpdatedDesc', { label }),
        action: onCreateRule
          ? {
              label: t('categoryPicker.createRule'),
              onClick: () => onCreateRule(wording, categoryKey),
            }
          : undefined,
      })
    } catch (error) {
      Sentry.captureException(error)
      toast.error(t('toast.failedUpdateCategory'))
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
