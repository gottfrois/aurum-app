import {
  Banknote,
  Building2,
  Bus,
  CreditCard,
  GraduationCap,
  Heart,
  Home,
  Landmark,
  MoreHorizontal,
  Phone,
  ShoppingBag,
  Utensils,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface TransactionCategory {
  label: string
  icon: LucideIcon
  color: string
}

export const TRANSACTION_CATEGORIES: Record<string, TransactionCategory> = {
  revenue: {
    label: 'Revenue',
    icon: Wallet,
    color: 'hsl(142 71% 45%)',
  },
  food_and_restaurants: {
    label: 'Food & Restaurants',
    icon: Utensils,
    color: 'hsl(25 95% 53%)',
  },
  housing: {
    label: 'Housing',
    icon: Home,
    color: 'hsl(217 91% 60%)',
  },
  travel_and_transport: {
    label: 'Travel & Transport',
    icon: Bus,
    color: 'hsl(280 68% 60%)',
  },
  shopping: {
    label: 'Shopping',
    icon: ShoppingBag,
    color: 'hsl(340 82% 52%)',
  },
  leisure: {
    label: 'Leisure',
    icon: GraduationCap,
    color: 'hsl(47 96% 53%)',
  },
  healthcare: {
    label: 'Healthcare',
    icon: Heart,
    color: 'hsl(0 84% 60%)',
  },
  administration_and_taxes: {
    label: 'Taxes & Admin',
    icon: Landmark,
    color: 'hsl(210 40% 50%)',
  },
  bank_insurances: {
    label: 'Banks & Insurance',
    icon: Building2,
    color: 'hsl(190 80% 42%)',
  },
  household: {
    label: 'Household',
    icon: CreditCard,
    color: 'hsl(160 60% 45%)',
  },
  loans: {
    label: 'Loans',
    icon: Banknote,
    color: 'hsl(30 80% 55%)',
  },
  media_and_telecommunications: {
    label: 'Media & Telecom',
    icon: Phone,
    color: 'hsl(260 60% 55%)',
  },
  others: {
    label: 'Others',
    icon: MoreHorizontal,
    color: 'hsl(0 0% 55%)',
  },
}

export function getTransactionCategoryKey(
  categoryParent?: string,
  category?: string,
): string {
  const key = categoryParent ?? category ?? 'others'
  // Normalize: lowercase, replace spaces with underscores
  const normalized = key.toLowerCase().replace(/\s+/g, '_')
  if (normalized in TRANSACTION_CATEGORIES) return normalized
  return 'others'
}
