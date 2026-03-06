import type { LucideIcon } from 'lucide-react'
import { Landmark, PiggyBank, TrendingUp, Shield } from 'lucide-react'

export interface AccountCategory {
  label: string
  icon: LucideIcon
  types: string[]
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

const typeToCategory = new Map<string, string>()
for (const [key, cat] of Object.entries(ACCOUNT_CATEGORIES)) {
  for (const t of cat.types) {
    typeToCategory.set(t, key)
  }
}

export function getCategoryKey(accountType: string | undefined): string {
  return typeToCategory.get(accountType ?? '') ?? 'checking'
}

const INVESTMENT_ACCOUNT_TYPES = new Set(
  ACCOUNT_CATEGORIES.investments.types,
)

export function isInvestmentAccount(type?: string): boolean {
  return INVESTMENT_ACCOUNT_TYPES.has(type ?? '')
}
