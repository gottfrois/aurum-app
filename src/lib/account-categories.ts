import { Landmark, PiggyBank, Shield, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

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

export { getCategoryKey } from '../../convex/lib/accountCategories'

const INVESTMENT_ACCOUNT_TYPES = new Set(ACCOUNT_CATEGORIES.investments.types)

export function isInvestmentAccount(type?: string): boolean {
  return INVESTMENT_ACCOUNT_TYPES.has(type ?? '')
}
