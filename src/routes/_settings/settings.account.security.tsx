import { useSession, useUser } from '@clerk/tanstack-react-start'
import { clerkClient } from '@clerk/tanstack-react-start/server'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  ItemCard,
  ItemCardItem,
  ItemCardItemAction,
  ItemCardItemContent,
  ItemCardItemDescription,
  ItemCardItems,
  ItemCardItemTitle,
} from '~/components/item-card'
import { Button } from '~/components/ui/button'
import { PageHeader } from '~/components/ui/page-header'
import { Skeleton } from '~/components/ui/skeleton'

type SessionWithActivitiesResource = Awaited<
  ReturnType<NonNullable<ReturnType<typeof useUser>['user']>['getSessions']>
>[number]

const revokeSessionsFn = createServerFn({ method: 'POST' })
  .inputValidator((data: Array<string>) => data)
  .handler(async ({ data: sessionIds }) => {
    const client = clerkClient()
    await Promise.all(sessionIds.map((id) => client.sessions.revokeSession(id)))
  })

export const Route = createFileRoute('/_settings/settings/account/security')({
  component: SecurityPage,
})

function SecurityPage() {
  const { user } = useUser()
  const { session: currentSession } = useSession()
  const [sessions, setSessions] = useState<
    Array<SessionWithActivitiesResource>
  >([])
  const [loading, setLoading] = useState(true)

  const fetchSessions = useCallback(async () => {
    if (!user) return
    try {
      const result = await user.getSessions()
      setSessions(result.filter((s) => s.status === 'active'))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-10 py-16">
        <header>
          <Skeleton className="h-9 w-48" />
        </header>
        <div className="mt-8 space-y-6">
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  const current = sessions.find((s) => s.id === currentSession?.id)
  const others = sessions.filter((s) => s.id !== currentSession?.id)

  async function revokeAll() {
    try {
      await revokeSessionsFn({ data: others.map((s) => s.id) as Array<string> })
      setSessions((prev) => prev.filter((s) => s.id === currentSession?.id))
      toast.success('All other sessions revoked')
    } catch {
      toast.error('Failed to revoke sessions')
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
      <PageHeader
        title="Security & access"
        description="Manage your sessions and security settings."
      />
      <div className="mt-8 space-y-6">
        <div>
          <h2 className="text-lg font-medium">Sessions</h2>
          <p className="text-sm text-muted-foreground">
            Devices logged into your account
          </p>
        </div>
        {current && (
          <ItemCard>
            <ItemCardItems>
              <SessionItem session={current} isCurrent />
            </ItemCardItems>
          </ItemCard>
        )}
        {others.length > 0 && (
          <ItemCard>
            <ItemCardItems>
              <ItemCardItem>
                <ItemCardItemContent>
                  <ItemCardItemTitle className="text-sm text-muted-foreground">
                    {others.length} other{' '}
                    {others.length === 1 ? 'session' : 'sessions'}
                  </ItemCardItemTitle>
                </ItemCardItemContent>
                <ItemCardItemAction>
                  <Button variant="ghost" size="sm" onClick={revokeAll}>
                    Revoke all
                  </Button>
                </ItemCardItemAction>
              </ItemCardItem>
              {others.map((session) => (
                <SessionItem key={session.id} session={session} />
              ))}
            </ItemCardItems>
          </ItemCard>
        )}
      </div>
    </div>
  )
}

function formatDeviceName(session: SessionWithActivitiesResource): string {
  const { browserName, deviceType } = session.latestActivity
  const browser = browserName ?? 'Unknown browser'
  const os = deviceType ?? 'Unknown device'
  return `${browser} on ${os}`
}

function formatLocation(session: SessionWithActivitiesResource): string {
  const { city, country } = session.latestActivity
  const parts: Array<string> = []
  if (city) parts.push(city)
  if (country) parts.push(country)
  return parts.join(', ')
}

function formatLastSeen(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `Last seen ${diffMinutes}m ago`
  if (diffHours < 24) return `Last seen ${diffHours}h ago`
  return `Last seen ${diffDays}d ago`
}

function SessionItem({
  session,
  isCurrent = false,
}: {
  session: SessionWithActivitiesResource
  isCurrent?: boolean
}) {
  const location = formatLocation(session)

  const locationParts: Array<string> = []
  if (location) locationParts.push(location)
  if (!isCurrent) locationParts.push(formatLastSeen(session.lastActiveAt))

  return (
    <ItemCardItem>
      <ItemCardItemContent>
        <ItemCardItemTitle>{formatDeviceName(session)}</ItemCardItemTitle>
        <ItemCardItemDescription className="flex items-center gap-1.5">
          {isCurrent && (
            <>
              <span className="inline-block size-2 shrink-0 rounded-full bg-success" />
              <span className="text-success">Current session</span>
            </>
          )}
          {isCurrent && locationParts.length > 0 && <span>{'\u00B7'}</span>}
          {locationParts.length > 0 && (
            <span>{locationParts.join(' \u00B7 ')}</span>
          )}
        </ItemCardItemDescription>
      </ItemCardItemContent>
    </ItemCardItem>
  )
}
