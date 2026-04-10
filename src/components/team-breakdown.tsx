import { useAction, useQuery } from 'convex/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { useCachedDecryptRecords } from '~/hooks/use-cached-decrypt'
import { useMoney } from '~/hooks/use-money'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

type ResolvedUser = {
  firstName: string | null
  lastName: string | null
  imageUrl: string
  email: string
}

type DecryptedBankAccount = {
  _id: string
  portfolioId: string
  balance: number
  currency?: string
  deleted: boolean
  disabled: boolean
}

export function TeamBreakdown({
  workspaceId,
}: {
  workspaceId: Id<'workspaces'>
}) {
  const { t } = useTranslation()
  const breakdownMeta = useQuery(api.team.getTeamMemberBreakdown, {
    workspaceId,
  })
  const sharedPortfolios = useQuery(api.team.listSharedPortfolios, {
    workspaceId,
  })
  const rawBankAccounts = useQuery(api.team.listTeamBankAccounts, {
    workspaceId,
  })
  const bankAccounts = useCachedDecryptRecords(
    'bankAccounts',
    rawBankAccounts,
  ) as DecryptedBankAccount[] | undefined

  const resolveUsers = useAction(api.members.resolveUsers)
  const [users, setUsers] = useState<Record<string, ResolvedUser>>({})
  const { format: formatCurrency } = useMoney()

  const fetchUsers = useCallback(async () => {
    if (!sharedPortfolios?.length) return
    const uniqueIds = new Set<string>(
      sharedPortfolios
        .map((p: { memberUserId: string | null }) => p.memberUserId)
        .filter((id: string | null): id is string => id !== null),
    )
    const userIds = Array.from(uniqueIds)
    if (userIds.length === 0) return
    try {
      const resolved = await resolveUsers({ userIds })
      setUsers(resolved)
    } catch {
      // Clerk API may not be configured
    }
  }, [sharedPortfolios, resolveUsers])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Compute member breakdown from decrypted bank accounts
  const breakdown = useMemo(() => {
    if (!breakdownMeta || !bankAccounts) return null

    // Sum balances per portfolio from active bank accounts
    const portfolioBalanceMap = new Map<
      string,
      { balance: number; currency: string }
    >()
    for (const a of bankAccounts) {
      if (a.deleted || a.disabled) continue
      const existing = portfolioBalanceMap.get(a.portfolioId)
      if (existing) {
        existing.balance += a.balance
      } else {
        portfolioBalanceMap.set(a.portfolioId, {
          balance: a.balance,
          currency: a.currency ?? 'EUR',
        })
      }
    }

    // Group by memberId
    const byMember = new Map<
      string,
      {
        memberId: string
        balance: number
        shareAmounts: boolean
        currency: string
      }
    >()
    for (const meta of breakdownMeta) {
      const portfolioData = portfolioBalanceMap.get(meta.portfolioId)
      const balance = portfolioData?.balance ?? 0
      const currency = portfolioData?.currency ?? 'EUR'

      const existing = byMember.get(meta.memberId)
      if (existing) {
        existing.balance += balance
        if (!meta.shareAmounts) existing.shareAmounts = false
      } else {
        byMember.set(meta.memberId, {
          memberId: meta.memberId,
          balance,
          shareAmounts: meta.shareAmounts,
          currency,
        })
      }
    }

    const totalBalance = [...byMember.values()].reduce(
      (sum, m) => sum + m.balance,
      0,
    )

    return [...byMember.values()].map((m) => ({
      memberId: m.memberId,
      balance: m.shareAmounts ? m.balance : null,
      percentage: totalBalance > 0 ? (m.balance / totalBalance) * 100 : 0,
      currency: m.currency,
    }))
  }, [breakdownMeta, bankAccounts])

  if (!breakdown || breakdown.length === 0) return null

  // Resolve memberId -> userId via sharedPortfolios
  const memberUserMap = new Map<string, string>()
  if (sharedPortfolios) {
    for (const p of sharedPortfolios) {
      if (p.memberUserId) {
        memberUserMap.set(p.memberId, p.memberUserId)
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('charts.teamBreakdown')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {breakdown.map((member) => {
          const userId = memberUserMap.get(member.memberId)
          const user = userId ? users[userId] : undefined
          const name = user
            ? [user.firstName, user.lastName].filter(Boolean).join(' ')
            : t('charts.member')
          const initials = name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)

          return (
            <div key={member.memberId} className="flex items-center gap-3">
              <Avatar className="size-8">
                <AvatarImage src={user?.imageUrl} alt={name} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {member.balance !== null
                      ? formatCurrency(member.balance, member.currency)
                      : `${Math.round(member.percentage)}%`}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(member.percentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
