import { useCallback, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useAction, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Mail, X } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import {
  ItemCard,
  ItemCardHeader,
  ItemCardHeaderContent,
  ItemCardHeaderTitle,
  ItemCardItem,
  ItemCardItemAction,
  ItemCardItemContent,
  ItemCardItemDescription,
  ItemCardItemTitle,
  ItemCardItems,
} from '~/components/item-card'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Skeleton } from '~/components/ui/skeleton'

export const Route = createFileRoute('/_settings/settings/members')({
  component: MembersPage,
})

type ResolvedUser = {
  firstName: string | null
  lastName: string | null
  imageUrl: string
  email: string
}

function MembersPage() {
  const data = useQuery(api.members.listMembers)
  const subscription = useQuery(api.billing.getSubscriptionStatus)
  const resolveUsers = useAction(api.members.resolveUsers)
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
      // Clerk API may not be configured yet
    } finally {
      setUsersLoading(false)
    }
  }, [data?.members, resolveUsers])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  if (data === undefined) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-10 py-16">
        <header>
          <Skeleton className="h-9 w-32" />
        </header>
        <div className="mt-8 space-y-6">
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
      <header>
        <h1 className="text-3xl font-semibold">Members</h1>
      </header>
      <div className="mt-8 space-y-6">
        <ItemCard>
          <ItemCardHeader>
            <ItemCardHeaderContent>
              <ItemCardHeaderTitle>
                {data.members.length}{' '}
                {data.members.length === 1 ? 'member' : 'members'}
                {subscription?.isActive && (
                  <span className="text-sm font-normal text-muted-foreground">
                    / {subscription.seats} seat
                    {subscription.seats !== 1 ? 's' : ''}
                  </span>
                )}
              </ItemCardHeaderTitle>
            </ItemCardHeaderContent>
            <InviteDialog
              existingEmails={[
                ...Object.values(users)
                  .map((u) => u.email.toLowerCase())
                  .filter(Boolean),
                ...data.invitations.map((i) => i.email.toLowerCase()),
              ]}
              atSeatLimit={
                subscription?.isActive
                  ? subscription.currentSeats +
                      subscription.pendingInvitations >=
                    subscription.seats
                  : false
              }
            />
          </ItemCardHeader>
          <ItemCardItems>
            {usersLoading
              ? data.members.map((member) => (
                  <ItemCardItem key={member._id}>
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-8 rounded-full" />
                      <ItemCardItemContent>
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </ItemCardItemContent>
                    </div>
                    <ItemCardItemAction>
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </ItemCardItemAction>
                  </ItemCardItem>
                ))
              : data.members.map((member) => {
                  const user = users[member.userId] as ResolvedUser | undefined
                  const name = user
                    ? [user.firstName, user.lastName].filter(Boolean).join(' ')
                    : member.userId
                  const email = user?.email ?? ''
                  const initials = name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)

                  return (
                    <ItemCardItem key={member._id}>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8 rounded-full">
                          <AvatarImage src={user?.imageUrl} alt={name} />
                          <AvatarFallback className="rounded-full text-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <ItemCardItemContent>
                          <ItemCardItemTitle>
                            {name}
                            {member.userId === data.currentUserId && (
                              <span className="text-sm text-muted-foreground">
                                (you)
                              </span>
                            )}
                          </ItemCardItemTitle>
                          <ItemCardItemDescription>
                            {email}
                          </ItemCardItemDescription>
                        </ItemCardItemContent>
                      </div>
                      <ItemCardItemAction>
                        <Badge variant="outline">{member.role}</Badge>
                      </ItemCardItemAction>
                    </ItemCardItem>
                  )
                })}
            {data.invitations.map((invitation) => (
              <PendingInvitationItem
                key={invitation._id}
                invitation={invitation}
              />
            ))}
          </ItemCardItems>
        </ItemCard>
      </div>
    </div>
  )
}

function PendingInvitationItem({
  invitation,
}: {
  invitation: { _id: string; email: string }
}) {
  const revokeInvitation = useAction(api.members.revokeInvitationAction)
  const [revoking, setRevoking] = useState(false)

  async function handleRevoke() {
    setRevoking(true)
    try {
      await revokeInvitation({
        invitationId: invitation._id as never,
      })
      toast.success('Invitation revoked')
    } catch {
      toast.error('Failed to revoke invitation')
    } finally {
      setRevoking(false)
    }
  }

  return (
    <ItemCardItem>
      <div className="flex items-center gap-3">
        <Avatar className="size-8 rounded-full">
          <AvatarFallback className="rounded-full text-xs">
            <Mail className="size-4" />
          </AvatarFallback>
        </Avatar>
        <ItemCardItemContent>
          <ItemCardItemTitle>{invitation.email}</ItemCardItemTitle>
          <ItemCardItemDescription>Pending invitation</ItemCardItemDescription>
        </ItemCardItemContent>
      </div>
      <ItemCardItemAction>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRevoke}
          disabled={revoking}
        >
          Revoke
        </Button>
      </ItemCardItemAction>
    </ItemCardItem>
  )
}

function InviteDialog({
  existingEmails = [],
  atSeatLimit = false,
}: {
  existingEmails?: Array<string>
  atSeatLimit?: boolean
}) {
  const sendInvitation = useAction(api.members.sendInvitation)
  const [open, setOpen] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [emails, setEmails] = useState<Array<string>>([])
  const [sending, setSending] = useState(false)

  function addEmail() {
    const trimmed = emailInput.trim().toLowerCase()
    if (!trimmed) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Invalid email address')
      return
    }
    if (emails.includes(trimmed)) {
      toast.error('Email already added')
      return
    }
    if (existingEmails.includes(trimmed)) {
      toast.error('This person is already a member or has a pending invitation')
      return
    }
    setEmails((prev) => [...prev, trimmed])
    setEmailInput('')
  }

  function removeEmail(email: string) {
    setEmails((prev) => prev.filter((e) => e !== email))
  }

  async function handleSend() {
    if (emails.length === 0) return
    setSending(true)
    try {
      await sendInvitation({ emails })
      toast.success(
        emails.length === 1 ? 'Invitation sent' : 'Invitations sent',
      )
      setEmails([])
      setEmailInput('')
      setOpen(false)
    } catch {
      toast.error('Failed to send invitations')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={atSeatLimit}>
          {atSeatLimit ? 'Seat limit reached' : 'Invite'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite members</DialogTitle>
          <DialogDescription>
            Send invitations to join your workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="email@example.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addEmail()
                }
              }}
            />
            <Button variant="outline" onClick={addEmail}>
              Add
            </Button>
          </div>
          {emails.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {emails.map((email) => (
                <Badge key={email} variant="secondary" className="gap-1 pr-1">
                  {email}
                  <button
                    onClick={() => removeEmail(email)}
                    className="rounded-sm hover:bg-muted"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={handleSend}
            disabled={emails.length === 0 || sending}
          >
            {sending
              ? 'Sending...'
              : `Send ${emails.length === 0 ? '' : emails.length} invitation${emails.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
