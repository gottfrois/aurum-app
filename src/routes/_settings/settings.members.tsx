import { createFileRoute } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { Ellipsis, Mail, UserX, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '~/components/confirm-dialog'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Skeleton } from '~/components/ui/skeleton'
import { useEncryption } from '~/contexts/encryption-context'
import { encryptString, importPublicKey } from '~/lib/crypto'
import { api } from '../../../convex/_generated/api'

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

  const { isEncryptionEnabled, isUnlocked, role } = useEncryption()
  const membersStatus = useQuery(
    api.encryptionKeys.listMembersEncryptionStatus,
    isEncryptionEnabled ? {} : 'skip',
  )

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

  // Build a lookup map from userId to encryption status
  const encryptionStatusMap = new Map(
    membersStatus?.map((m) => [m.userId, m]) ?? [],
  )

  const isOwner = role === 'owner'

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

                  const encStatus = encryptionStatusMap.get(member.userId)

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
                        <div className="flex items-center gap-2">
                          <MemberActionBadge
                            encStatus={encStatus}
                            isOwner={isOwner}
                            isUnlocked={isUnlocked}
                            isEncryptionEnabled={isEncryptionEnabled}
                          />
                          {isOwner && member.userId !== data.currentUserId && (
                            <RemoveMemberMenu
                              memberId={member._id}
                              memberName={name}
                            />
                          )}
                        </div>
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

function RemoveMemberMenu({
  memberId,
  memberName,
}: {
  memberId: string
  memberName: string
}) {
  const removeMember = useAction(api.members.removeMember)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function handleRemove() {
    setRemoving(true)
    try {
      await removeMember({ memberId: memberId as never })
      toast.success('Member removed')
      setConfirmOpen(false)
    } catch {
      toast.error('Failed to remove member')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
          >
            Remove member
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove member"
        description={`Are you sure you want to remove ${memberName} from this workspace? They will lose access to all shared data.`}
        confirmValue={memberName}
        confirmLabel="Remove"
        loading={removing}
        onConfirm={handleRemove}
      />
    </>
  )
}

function MemberActionBadge({
  encStatus,
  isOwner,
  isUnlocked,
  isEncryptionEnabled,
}: {
  encStatus:
    | {
        userId: string
        hasPersonalKey: boolean
        hasKeySlot: boolean
        publicKey: string | null
      }
    | undefined
  isOwner: boolean
  isUnlocked: boolean
  isEncryptionEnabled: boolean
}) {
  if (!isEncryptionEnabled || !encStatus) {
    return null
  }

  let status: 'access' | 'pending' | 'no-setup'
  if (encStatus.hasKeySlot) status = 'access'
  else if (encStatus.hasPersonalKey) status = 'pending'
  else status = 'no-setup'

  return (
    <div className="flex items-center gap-2">
      {status === 'pending' && isOwner && (
        <GrantAccessButton
          targetUserId={encStatus.userId}
          targetPublicKey={encStatus.publicKey!}
          isUnlocked={isUnlocked}
        />
      )}
      {status === 'pending' && !isOwner && (
        <Badge variant="outline">Pending access</Badge>
      )}
      {status === 'no-setup' && (
        <Badge variant="outline">
          <UserX className="size-3" />
          Pending setup
        </Badge>
      )}
    </div>
  )
}

function GrantAccessButton({
  targetUserId,
  targetPublicKey,
}: {
  targetUserId: string
  targetPublicKey: string
  isUnlocked: boolean
}) {
  const { workspacePrivateKeyJwk, unlock } = useEncryption()
  const grantAccess = useMutation(api.encryptionKeys.grantMemberAccess)
  const [granting, setGranting] = useState(false)
  const [passphraseOpen, setPassphraseOpen] = useState(false)
  const [pendingGrant, setPendingGrant] = useState(false)

  async function doGrantAccess(wsPrivateKeyJwk: string) {
    setGranting(true)
    try {
      const recipientPubKey = await importPublicKey(targetPublicKey)
      const encryptedWsPrivateKey = await encryptString(
        wsPrivateKeyJwk,
        recipientPubKey,
      )
      await grantAccess({
        targetUserId,
        encryptedPrivateKey: encryptedWsPrivateKey,
      })
      toast.success('Access granted')
    } catch (err) {
      toast.error('Failed to grant access')
      console.error(err)
    } finally {
      setGranting(false)
    }
  }

  // After passphrase dialog unlocks the vault, workspacePrivateKeyJwk becomes
  // available on the next render. This effect auto-triggers the grant.
  useEffect(() => {
    if (pendingGrant && workspacePrivateKeyJwk) {
      setPendingGrant(false)
      doGrantAccess(workspacePrivateKeyJwk)
    }
  })

  async function handleClick() {
    if (workspacePrivateKeyJwk) {
      await doGrantAccess(workspacePrivateKeyJwk)
    } else {
      setPassphraseOpen(true)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={granting}
        onClick={handleClick}
      >
        {granting ? 'Granting...' : 'Grant access'}
      </Button>
      <PassphraseDialog
        open={passphraseOpen}
        onOpenChange={setPassphraseOpen}
        unlock={unlock}
        onUnlocked={() => {
          setPassphraseOpen(false)
          setPendingGrant(true)
        }}
      />
    </>
  )
}

function PassphraseDialog({
  open,
  onOpenChange,
  unlock,
  onUnlocked,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  unlock: (passphrase: string) => Promise<void>
  onUnlocked: () => void
}) {
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!passphrase) return
    setError(null)
    setUnlocking(true)
    try {
      await unlock(passphrase)
      setPassphrase('')
      onUnlocked()
    } catch {
      setError('Invalid passphrase. Please try again.')
    } finally {
      setUnlocking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter your passphrase</DialogTitle>
          <DialogDescription>
            Your passphrase is needed to decrypt the workspace key before
            granting access to this member.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="grant-passphrase">Passphrase</Label>
              <Input
                id="grant-passphrase"
                type="password"
                placeholder="Your encryption passphrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                autoFocus
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!passphrase || unlocking}>
              {unlocking ? 'Unlocking...' : 'Unlock & grant access'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
