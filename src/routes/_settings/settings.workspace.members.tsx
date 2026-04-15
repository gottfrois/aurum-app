import * as Sentry from '@sentry/tanstackstart-react'
import { createFileRoute } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { useAction, useMutation, useQuery } from 'convex/react'
import { Ellipsis, UserX } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ActivateAgentDialog } from '~/components/activate-agent-dialog'
import { BunkrAvatar } from '~/components/bunkr-avatar'
import { ConfirmDialog } from '~/components/confirm-dialog'
import { DataTable, type DataTableGroup } from '~/components/data-table'
import { PassphraseDialog } from '~/components/passphrase-dialog'
import { RequireOwner } from '~/components/require-owner'
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
import { HotkeyDisplay, Kbd } from '~/components/ui/kbd'
import { PageHeader } from '~/components/ui/page-header'
import { Skeleton } from '~/components/ui/skeleton'
import { Textarea } from '~/components/ui/textarea'
import { useBilling } from '~/contexts/billing-context'
import { useEncryption } from '~/contexts/encryption-context'
import { encryptString, importPublicKey } from '~/lib/crypto'
import { api } from '../../../convex/_generated/api'

export const Route = createFileRoute('/_settings/settings/workspace/members')({
  component: MembersPage,
})

type ResolvedUser = {
  firstName: string | null
  lastName: string | null
  imageUrl: string
  email: string
}

type MemberRow = {
  _id: string
  type: 'human' | 'invitation' | 'agent'
  userId: string
  name: string
  email: string
  imageUrl?: string
  role: 'owner' | 'member' | 'agent'
  encStatus?: {
    hasPersonalKey: boolean
    hasKeySlot: boolean
    publicKey: string | null
  }
  isCurrentUser: boolean
  joinedAt?: number
  online?: boolean
  lastDisconnected?: number
}

function MembersPage() {
  const { t } = useTranslation()
  const data = useQuery(api.members.listMembers)
  const { subscription } = useBilling()
  const agentStatus = useQuery(api.agent.getAgentStatus)
  const resolveUsers = useAction(api.members.resolveUsers)
  const [users, setUsers] = useState<Record<string, ResolvedUser>>({})
  const [usersLoading, setUsersLoading] = useState(true)

  const { isEncryptionEnabled, role } = useEncryption()
  const membersStatus = useQuery(
    api.encryptionKeys.listMembersEncryptionStatus,
    isEncryptionEnabled ? {} : 'skip',
  )
  const presenceData = useQuery(
    api.presence.listRoom,
    data?.workspaceId ? { roomId: data.workspaceId } : 'skip',
  )

  // Stabilize dependency: only re-fetch when the set of member userIds changes
  const memberUserIds = useMemo(
    () => data?.members.map((m) => m.userId).join(',') ?? '',
    [data?.members],
  )

  const fetchUsers = useCallback(async () => {
    if (!memberUserIds) return
    const userIds = memberUserIds.split(',')
    try {
      const resolved = await resolveUsers({ userIds })
      setUsers(resolved)
    } catch {
      // Clerk API may not be configured yet
    } finally {
      setUsersLoading(false)
    }
  }, [memberUserIds, resolveUsers])

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

  const encryptionStatusMap = new Map(
    membersStatus?.map((m) => [m.userId, m]) ?? [],
  )

  const presenceMap = new Map(presenceData?.map((p) => [p.userId, p]) ?? [])

  const isOwner = role === 'owner'

  // Build unified rows
  const rows: MemberRow[] = []

  if (!usersLoading) {
    for (const member of data.members) {
      const user = users[member.userId] as ResolvedUser | undefined
      const name = user
        ? [user.firstName, user.lastName].filter(Boolean).join(' ')
        : member.userId
      const encStatus = encryptionStatusMap.get(member.userId)
      const memberPresence = presenceMap.get(member.userId)

      rows.push({
        _id: member._id,
        type: 'human',
        userId: member.userId,
        name,
        email: user?.email ?? '',
        imageUrl: user?.imageUrl,
        role: member.role,
        encStatus: encStatus
          ? {
              hasPersonalKey: encStatus.hasPersonalKey,
              hasKeySlot: encStatus.hasKeySlot,
              publicKey: encStatus.publicKey,
            }
          : undefined,
        isCurrentUser: member.userId === data.currentUserId,
        joinedAt: member._creationTime,
        online: memberPresence?.online ?? false,
        lastDisconnected: memberPresence?.lastDisconnected ?? 0,
      })
    }

    for (const invitation of data.invitations) {
      rows.push({
        _id: invitation._id,
        type: 'invitation',
        userId: '',
        name: invitation.email,
        email: 'Pending invitation',
        role: 'member',
        isCurrentUser: false,
      })
    }
  }

  // Add agent row if enabled
  if (agentStatus?.enabled) {
    rows.push({
      _id: 'bunkr-agent',
      type: 'agent',
      userId: 'bunkr-agent',
      name: t('settings.members.bunkrAgent'),
      email: t('settings.members.bunkrAgentDescription'),
      role: 'agent',
      isCurrentUser: false,
    })
  }

  const groups: DataTableGroup<MemberRow>[] = [
    {
      label: t('settings.members.membersGroup'),
      filter: (row) => row.type === 'human' || row.type === 'invitation',
    },
    {
      label: t('settings.members.applicationsGroup'),
      filter: (row) => row.type === 'agent',
      action:
        isOwner && !agentStatus?.enabled ? <ActivateAgentButton /> : undefined,
    },
  ]

  return (
    <RequireOwner>
      <div className="flex h-full flex-col overflow-hidden px-10 pt-16">
        <div className="shrink-0">
          <PageHeader
            title={t('settings.members.title')}
            description={t('settings.members.description')}
          />
        </div>
        <div className="mt-8 flex min-h-0 flex-1 flex-col">
          {usersLoading ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : (
            <DataTable
              columns={createMemberColumns(t)}
              data={rows}
              filterColumn="name"
              filterPlaceholder={t('settings.members.filterPlaceholder')}
              getRowId={(row) => row._id}
              groups={groups}
              actions={
                isOwner ? (
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
                ) : undefined
              }
            />
          )}
        </div>
      </div>
    </RequireOwner>
  )
}

// --- Column definitions ---

function createMemberColumns(
  t: ReturnType<typeof useTranslation>['t'],
): ColumnDef<MemberRow, unknown>[] {
  return [
    {
      accessorKey: 'name',
      header: t('settings.members.nameHeader'),
      cell: ({ row }) => {
        const { type, name, imageUrl, isCurrentUser } = row.original

        if (type === 'agent') {
          return (
            <div className="flex items-center gap-3">
              <BunkrAvatar className="size-6" />
              <span className="font-medium">{name}</span>
            </div>
          )
        }

        if (type === 'invitation') {
          const localPart = name.split('@')[0] ?? name
          const invitationInitials =
            localPart
              .split(/[.\-_+]/)
              .filter(Boolean)
              .map((part) => part[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) || localPart.slice(0, 2).toUpperCase()

          return (
            <div className="flex items-center gap-3">
              <Avatar className="size-6 rounded-full border border-dashed border-muted-foreground/50">
                <AvatarFallback className="rounded-full bg-transparent text-[10px] text-muted-foreground">
                  {invitationInitials}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{name}</span>
            </div>
          )
        }

        const initials = name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)

        return (
          <div className="flex items-center gap-3">
            <Avatar className="size-6 rounded-full">
              <AvatarImage src={imageUrl} alt={name} />
              <AvatarFallback className="rounded-full text-[10px]">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium">
              {name}
              {isCurrentUser && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  {t('settings.members.you')}
                </span>
              )}
            </span>
          </div>
        )
      },
    },
    {
      id: 'email',
      header: t('settings.members.emailHeader'),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.email}</span>
      ),
    },
    {
      id: 'status',
      header: t('settings.members.statusHeader'),
      cell: ({ row }) => <MemberStatusCell row={row.original} />,
    },
    {
      id: 'joined',
      header: t('settings.members.joinedHeader'),
      cell: ({ row }) => <MemberJoinedCell row={row.original} />,
    },
    {
      id: 'lastSeen',
      header: t('settings.members.lastSeenHeader'),
      cell: ({ row }) => <MemberPresenceCell row={row.original} />,
    },
    {
      id: 'actions',
      header: '',
      size: 28,
      cell: ({ row }) => <MemberActionsCell row={row.original} />,
    },
  ]
}

function formatRelativeTime(timestamp: number, locale: string): string {
  const now = Date.now()
  const diffSeconds = Math.floor((now - timestamp) / 1000)

  if (diffSeconds < 60) return locale === 'fr' ? "À l'instant" : 'Just now'

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (diffSeconds < 3600) {
    return rtf.format(-Math.floor(diffSeconds / 60), 'minute')
  }
  if (diffSeconds < 86400) {
    return rtf.format(-Math.floor(diffSeconds / 3600), 'hour')
  }
  return rtf.format(-Math.floor(diffSeconds / 86400), 'day')
}

function MemberPresenceCell({ row }: { row: MemberRow }) {
  const { t, i18n } = useTranslation()

  if (row.type !== 'human') return null

  if (row.online) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="inline-block size-2 rounded-full bg-success" />
        <span className="text-muted-foreground">
          {t('settings.members.online')}
        </span>
      </div>
    )
  }

  if (row.lastDisconnected && row.lastDisconnected > 0) {
    return (
      <span className="text-muted-foreground text-sm">
        {formatRelativeTime(row.lastDisconnected, i18n.language)}
      </span>
    )
  }

  return null
}

function MemberJoinedCell({ row }: { row: MemberRow }) {
  const { i18n } = useTranslation()

  if (row.type !== 'human' || !row.joinedAt) return null

  const date = new Date(row.joinedAt)
  return (
    <span className="text-muted-foreground text-sm">
      {date.toLocaleDateString(i18n.language, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}
    </span>
  )
}

function MemberStatusCell({ row }: { row: MemberRow }) {
  const { t } = useTranslation()
  const { isEncryptionEnabled, role } = useEncryption()
  const isOwner = role === 'owner'

  if (row.type === 'agent') {
    return <Badge variant="secondary">{t('settings.members.active')}</Badge>
  }

  if (row.type === 'invitation') {
    return <Badge variant="outline">{t('settings.members.invited')}</Badge>
  }

  if (!isEncryptionEnabled || !row.encStatus) return null

  const { hasKeySlot, hasPersonalKey, publicKey } = row.encStatus

  if (hasKeySlot) return null // Has access, no badge needed

  if (hasPersonalKey && isOwner && publicKey) {
    return (
      <GrantAccessButton
        targetUserId={row.userId}
        targetPublicKey={publicKey}
      />
    )
  }

  if (hasPersonalKey) {
    return (
      <Badge variant="outline">{t('settings.members.pendingAccess')}</Badge>
    )
  }

  return (
    <Badge variant="outline">
      <UserX className="size-3" />
      {t('settings.members.pendingSetup')}
    </Badge>
  )
}

function MemberActionsCell({ row }: { row: MemberRow }) {
  const { role } = useEncryption()
  const isOwner = role === 'owner'

  if (row.type === 'agent' && isOwner) {
    return <DeactivateAgentMenu />
  }

  if (row.type === 'invitation') {
    return <RevokeInvitationMenu invitationId={row._id} />
  }

  if (row.type === 'human' && isOwner && !row.isCurrentUser) {
    return <RemoveMemberMenu memberId={row._id} memberName={row.name} />
  }

  return null
}

// --- Activate Agent Button (for Applications group action) ---

function ActivateAgentButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Activate
      </Button>
      <ActivateAgentDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

// --- Deactivate Agent Menu ---

function DeactivateAgentMenu() {
  const { t } = useTranslation()
  const deactivateAgent = useMutation(api.agent.deactivateAgent)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  async function handleDeactivate() {
    setDeactivating(true)
    try {
      await deactivateAgent()
      toast.success(t('toast.agentDeactivated'))
      setConfirmOpen(false)
    } catch {
      toast.error(t('toast.failedDeactivateAgent'))
    } finally {
      setDeactivating(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 opacity-0 transition-opacity group-hover/row:opacity-100 data-[state=open]:opacity-100"
          >
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
          >
            {t('settings.members.deactivate')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('settings.members.deactivateAgentTitle')}
        description={t('settings.members.deactivateAgentDescription')}
        confirmValue={t('settings.members.bunkrAgent')}
        confirmLabel={t('settings.members.deactivate')}
        loading={deactivating}
        onConfirm={handleDeactivate}
      />
    </>
  )
}

// --- Remove Member Menu ---

function RemoveMemberMenu({
  memberId,
  memberName,
}: {
  memberId: string
  memberName: string
}) {
  const { t } = useTranslation()
  const removeMember = useAction(api.members.removeMember)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function handleRemove() {
    setRemoving(true)
    try {
      await removeMember({ memberId: memberId as never })
      toast.success(t('toast.memberRemoved'))
      setConfirmOpen(false)
    } catch {
      toast.error(t('toast.failedRemoveMember'))
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 opacity-0 transition-opacity group-hover/row:opacity-100 data-[state=open]:opacity-100"
          >
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
          >
            {t('settings.members.removeMember')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('settings.members.removeMemberTitle')}
        description={t('settings.members.removeMemberConfirm', {
          name: memberName,
        })}
        confirmValue={memberName}
        confirmLabel={t('settings.members.remove')}
        loading={removing}
        onConfirm={handleRemove}
      />
    </>
  )
}

// --- Revoke Invitation Menu ---

function RevokeInvitationMenu({ invitationId }: { invitationId: string }) {
  const { t } = useTranslation()
  const revokeInvitation = useAction(api.members.revokeInvitationAction)

  async function handleRevoke() {
    try {
      await revokeInvitation({
        invitationId: invitationId as never,
      })
      toast.success(t('toast.invitationRevoked'))
    } catch (error) {
      Sentry.captureException(error)
      toast.error(t('toast.failedRevokeInvitation'))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 opacity-0 transition-opacity group-hover/row:opacity-100 data-[state=open]:opacity-100"
        >
          <Ellipsis className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem variant="destructive" onClick={handleRevoke}>
          {t('settings.members.revoke')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// --- Grant Access Button ---

function GrantAccessButton({
  targetUserId,
  targetPublicKey,
}: {
  targetUserId: string
  targetPublicKey: string
}) {
  const { t } = useTranslation()
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
      toast.success(t('toast.accessGranted'))
    } catch (err) {
      toast.error(t('toast.failedGrantAccess'))
      console.error(err)
    } finally {
      setGranting(false)
    }
  }

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
        loading={granting}
        onClick={handleClick}
      >
        {t('settings.members.grantAccess')}
      </Button>
      <PassphraseDialog
        open={passphraseOpen}
        onOpenChange={setPassphraseOpen}
        unlock={unlock}
        onUnlocked={() => {
          setPassphraseOpen(false)
          setPendingGrant(true)
        }}
        description={t('settings.members.grantAccessDescription')}
        submitLabel={t('settings.members.unlockAndGrant')}
      />
    </>
  )
}

// --- Invite Dialog ---

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseEmails(input: string): Array<string> {
  return input
    .split(/[,\n]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

function InviteDialog({
  existingEmails = [],
  atSeatLimit = false,
}: {
  existingEmails?: Array<string>
  atSeatLimit?: boolean
}) {
  const { t } = useTranslation()
  const sendInvitation = useAction(api.members.sendInvitation)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [errors, setErrors] = useState<Array<string>>([])
  const [sending, setSending] = useState(false)

  const hasInput = input.trim().length > 0

  function validate(): Array<string> | null {
    const parsed = parseEmails(input)
    if (parsed.length === 0) return null

    const validationErrors: Array<string> = []
    const seen = new Set<string>()
    const validEmails: Array<string> = []

    for (const email of parsed) {
      if (!EMAIL_REGEX.test(email)) {
        validationErrors.push(
          t('settings.members.invalidEmailError', { email }),
        )
        continue
      }
      if (seen.has(email)) {
        validationErrors.push(
          t('settings.members.duplicateEmailError', { email }),
        )
        continue
      }
      if (existingEmails.includes(email)) {
        validationErrors.push(
          t('settings.members.alreadyMemberError', { email }),
        )
        continue
      }
      seen.add(email)
      validEmails.push(email)
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return null
    }

    setErrors([])
    return validEmails
  }

  async function handleSend() {
    const emails = validate()
    if (!emails) return

    setSending(true)
    try {
      await sendInvitation({ emails })
      toast.success(t('toast.invitationSent', { count: emails.length }))
      setInput('')
      setErrors([])
      setOpen(false)
    } catch (error) {
      Sentry.captureException(error)
      toast.error(t('toast.failedSendInvitations'))
    } finally {
      setSending(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setInput('')
      setErrors([])
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={atSeatLimit}>
          {atSeatLimit
            ? t('settings.members.seatLimitReached')
            : t('settings.members.invite')}
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('settings.members.inviteMembersTitle')}</DialogTitle>
          <DialogDescription>
            {t('settings.members.inviteMembersDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Textarea
            placeholder={t('settings.members.emailsPlaceholder')}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              if (errors.length > 0) setErrors([])
            }}
            aria-invalid={errors.length > 0}
            rows={3}
          />
          {errors.length > 0 && (
            <ul className="space-y-1 text-destructive text-sm">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </div>
        <InviteFooter
          onCancel={() => setOpen(false)}
          onConfirm={handleSend}
          disabled={!hasInput || sending}
          sending={sending}
        />
      </DialogContent>
    </Dialog>
  )
}

function InviteFooter({
  onCancel,
  onConfirm,
  disabled,
  sending,
}: {
  onCancel: () => void
  onConfirm: () => void
  disabled: boolean
  sending: boolean
}) {
  const { t } = useTranslation()
  const handleConfirm = useCallback(() => {
    if (!disabled) onConfirm()
  }, [disabled, onConfirm])

  useHotkeys('escape', onCancel, {
    enableOnFormTags: true,
    preventDefault: true,
  })

  useHotkeys('mod+enter', handleConfirm, {
    enabled: !disabled,
    enableOnFormTags: true,
    preventDefault: true,
  })

  return (
    <DialogFooter>
      <Button variant="outline" onClick={onCancel}>
        {t('common.cancel')} <Kbd>Esc</Kbd>
      </Button>
      <Button onClick={handleConfirm} disabled={disabled} loading={sending}>
        {t('settings.members.inviteAction')}{' '}
        <HotkeyDisplay hotkey={{ keys: 'mod+enter' }} />
      </Button>
    </DialogFooter>
  )
}
