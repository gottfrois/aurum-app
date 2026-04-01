import * as Sentry from '@sentry/tanstackstart-react'
import { createFileRoute } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { Home } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  ItemCard,
  ItemCardHeader,
  ItemCardHeaderContent,
  ItemCardHeaderTitle,
  ItemCardItem,
  ItemCardItemAction,
  ItemCardItemContent,
  ItemCardItemDescription,
  ItemCardItems,
  ItemCardItemTitle,
} from '~/components/item-card'
import { RequireOwner } from '~/components/require-owner'
import { RequireTeamPlan } from '~/components/require-team-plan'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '~/components/ui/empty'
import { PageHeader } from '~/components/ui/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Skeleton } from '~/components/ui/skeleton'
import { api } from '../../../convex/_generated/api'

export const Route = createFileRoute('/_settings/settings/workspace/team')({
  component: TeamSettingsPage,
})

type ResolvedUser = {
  firstName: string | null
  lastName: string | null
  imageUrl: string
  email: string
}

type AccessLevel = 'full' | 'dashboard-only' | 'none'

function toAccessLevel(
  permissions:
    | { canViewTeamDashboard: boolean; canViewMemberBreakdown: boolean }
    | undefined,
): AccessLevel {
  const canDash = permissions?.canViewTeamDashboard ?? true
  const canBreakdown = permissions?.canViewMemberBreakdown ?? true
  if (!canDash) return 'none'
  if (!canBreakdown) return 'dashboard-only'
  return 'full'
}

function fromAccessLevel(level: AccessLevel) {
  switch (level) {
    case 'full':
      return { canViewTeamDashboard: true, canViewMemberBreakdown: true }
    case 'dashboard-only':
      return { canViewTeamDashboard: true, canViewMemberBreakdown: false }
    case 'none':
      return { canViewTeamDashboard: false, canViewMemberBreakdown: false }
  }
}

function TeamSettingsPage() {
  const { t } = useTranslation()
  return (
    <RequireOwner>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
        <PageHeader
          title={t('settings.teamDashboard.title')}
          description={t('settings.teamDashboard.description')}
        />
        <div className="mt-8 space-y-6">
          <RequireTeamPlan fallback={<UpgradePrompt />}>
            <TeamPermissions />
          </RequireTeamPlan>
        </div>
      </div>
    </RequireOwner>
  )
}

function UpgradePrompt() {
  const { t } = useTranslation()
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Home />
        </EmptyMedia>
        <EmptyTitle>{t('settings.teamDashboard.teamPlanRequired')}</EmptyTitle>
        <EmptyDescription>
          {t('settings.teamDashboard.teamPlanDescription')}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function TeamPermissions() {
  const { t } = useTranslation()
  const data = useQuery(api.members.listMembers)
  const resolveUsers = useAction(api.members.resolveUsers)
  const updatePermissions = useMutation(api.members.updateMemberPermissions)
  const [users, setUsers] = useState<Record<string, ResolvedUser>>({})
  const [usersLoading, setUsersLoading] = useState(true)

  const fetchUsers = useCallback(async () => {
    if (!data?.members.length) return
    const userIds = data.members.map((m) => m.userId)
    setUsersLoading(true)
    try {
      const resolved = await resolveUsers({ userIds })
      setUsers(resolved)
    } catch {
      // Clerk API may not be configured
    } finally {
      setUsersLoading(false)
    }
  }, [data?.members, resolveUsers])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  if (data === undefined) {
    return (
      <ItemCard>
        <ItemCardHeader>
          <ItemCardHeaderContent>
            <Skeleton className="h-5 w-40" />
          </ItemCardHeaderContent>
        </ItemCardHeader>
        <ItemCardItems>
          {[1, 2].map((i) => (
            <ItemCardItem key={i}>
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            </ItemCardItem>
          ))}
        </ItemCardItems>
      </ItemCard>
    )
  }

  if (!data) return null

  // Only show non-owner members (owner always has full access implicitly)
  const nonOwnerMembers = data.members.filter((m) => m.role !== 'owner')

  if (nonOwnerMembers.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Home />
          </EmptyMedia>
          <EmptyTitle>{t('settings.teamDashboard.noMembers')}</EmptyTitle>
          <EmptyDescription>
            {t('settings.teamDashboard.noMembersDescription')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  async function handleChange(memberId: string, level: AccessLevel) {
    try {
      await updatePermissions({
        memberId: memberId as never,
        permissions: fromAccessLevel(level),
      })
      toast.success(t('toast.permissionsUpdated'))
    } catch (error) {
      Sentry.captureException(error)
      toast.error(t('toast.failedUpdatePermissions'))
    }
  }

  return (
    <ItemCard>
      <ItemCardHeader>
        <ItemCardHeaderContent>
          <ItemCardHeaderTitle>
            {t('settings.teamDashboard.memberAccess')}
          </ItemCardHeaderTitle>
        </ItemCardHeaderContent>
      </ItemCardHeader>
      <ItemCardItems>
        {nonOwnerMembers.map((member) => {
          const user = users[member.userId] as ResolvedUser | undefined
          const name =
            usersLoading || !user
              ? member.userId
              : [user.firstName, user.lastName].filter(Boolean).join(' ')
          const initials = name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
          const level = toAccessLevel(member.permissions)

          return (
            <ItemCardItem key={member._id}>
              <div className="flex items-center gap-3">
                {usersLoading ? (
                  <Skeleton className="size-8 rounded-full" />
                ) : (
                  <Avatar className="size-8 rounded-full">
                    <AvatarImage src={user?.imageUrl} alt={name} />
                    <AvatarFallback className="rounded-full text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                )}
                <ItemCardItemContent>
                  <ItemCardItemTitle>
                    {usersLoading ? <Skeleton className="h-4 w-28" /> : name}
                  </ItemCardItemTitle>
                  <ItemCardItemDescription>
                    {level === 'full'
                      ? t('settings.teamDashboard.fullAccess')
                      : level === 'dashboard-only'
                        ? t('settings.teamDashboard.dashboardOnly')
                        : t('settings.teamDashboard.noAccess')}
                    {member.sharedPortfolioCount > 0 && (
                      <span className="ml-1">
                        &middot; {member.sharedPortfolioCount}{' '}
                        {t('settings.teamDashboard.shared')}
                      </span>
                    )}
                  </ItemCardItemDescription>
                </ItemCardItemContent>
              </div>
              <ItemCardItemAction>
                <Select
                  value={level}
                  onValueChange={(value) =>
                    handleChange(member._id, value as AccessLevel)
                  }
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">
                      {t('settings.teamDashboard.fullAccess')}
                    </SelectItem>
                    <SelectItem value="dashboard-only">
                      {t('settings.teamDashboard.dashboardOnly')}
                    </SelectItem>
                    <SelectItem value="none">
                      {t('settings.teamDashboard.noAccess')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </ItemCardItemAction>
            </ItemCardItem>
          )
        })}
      </ItemCardItems>
    </ItemCard>
  )
}
