import { useAction, useQuery } from 'convex/react'
import { useCallback, useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { useFormatCurrency } from '~/contexts/privacy-context'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

type ResolvedUser = {
  firstName: string | null
  lastName: string | null
  imageUrl: string
  email: string
}

export function FamilyBreakdown({
  workspaceId,
}: {
  workspaceId: Id<'workspaces'>
}) {
  const breakdown = useQuery(api.family.getFamilyMemberBreakdown, {
    workspaceId,
  })
  const sharedPortfolios = useQuery(api.family.listSharedPortfolios, {
    workspaceId,
  })
  const resolveUsers = useAction(api.members.resolveUsers)
  const [users, setUsers] = useState<Record<string, ResolvedUser>>({})
  const formatCurrency = useFormatCurrency()

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
        <CardTitle>Family Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {breakdown.map((member) => {
          const userId = memberUserMap.get(member.memberId)
          const user = userId ? users[userId] : undefined
          const name = user
            ? [user.firstName, user.lastName].filter(Boolean).join(' ')
            : 'Member'
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
