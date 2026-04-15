import type { TFunction } from 'i18next'
import type { LucideIcon } from 'lucide-react'
import { Landmark, PiggyBank, Shield, TrendingUp } from 'lucide-react'

export interface AccountCategory {
  label: string
  icon: LucideIcon
  types: Array<string>
}

export const ACCOUNT_CATEGORIES: Record<string, AccountCategory> = {
  checking: {
    label: 'Checking',
    icon: Landmark,
    types: ['checking', 'card'],
  },
  savings: {
    label: 'Savings',
    icon: PiggyBank,
    types: ['savings', 'livret_a', 'ldds'],
  },
  investments: {
    label: 'Investments',
    icon: TrendingUp,
    types: ['market', 'pea', 'pee'],
  },
  insurance: {
    label: 'Insurance',
    icon: Shield,
    types: ['lifeinsurance'],
  },
}

/** Resolve the translated label for an account category key. */
export function getAccountCategoryLabel(key: string, t: TFunction): string {
  return t(`accountTypes.${key}`, {
    defaultValue: ACCOUNT_CATEGORIES[key]?.label ?? key,
  })
}

export { getCategoryKey } from '../../convex/lib/accountCategories'

// Account types that hold securities — kept in sync with INVESTMENT_TYPES in
// convex/powens.ts (what the backend fetches from /users/me/accounts/{id}/investments).
const INVESTMENT_ACCOUNT_TYPES = new Set([
  'market',
  'pea',
  'pee',
  'lifeinsurance',
  'per',
  'perco',
  'perp',
  'madelin',
  'article83',
])

export function isInvestmentAccount(type?: string): boolean {
  return INVESTMENT_ACCOUNT_TYPES.has(type ?? '')
}
