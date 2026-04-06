import { useClerk, useUser } from '@clerk/tanstack-react-start'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAction, useConvexAuth, useQuery } from 'convex/react'
import { Loader2, LogOut } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '~/components/ui/button'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

export const Route = createFileRoute('/invite/$invitationId')({
  component: InvitationPage,
})

function InvitationPage() {
  const { invitationId } = Route.useParams()
  const navigate = useNavigate()
  const { signOut } = useClerk()
  const { user } = useUser()
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()

  const [actionTaken, setActionTaken] = useState(false)

  const invitation = useQuery(
    api.members.getInvitationById,
    isAuthenticated
      ? { invitationId: invitationId as Id<'workspaceInvitations'> }
      : 'skip',
  )

  const acceptInvitation = useAction(api.members.acceptInvitationById)
  const rejectInvitationAction = useAction(api.members.rejectInvitation)
  const resolveUsers = useAction(api.members.resolveUsers)

  const [inviterName, setInviterName] = useState<string | null>(null)

  useEffect(() => {
    if (!invitation?.invitedBy) return
    resolveUsers({ userIds: [invitation.invitedBy] })
      .then((users) => {
        const inviter = users[invitation.invitedBy]
        if (inviter) {
          const name = [inviter.firstName, inviter.lastName]
            .filter(Boolean)
            .join(' ')
          setInviterName(name || inviter.email)
        }
      })
      .catch(() => {})
  }, [invitation?.invitedBy, resolveUsers])

  // Navigate immediately, fire action in background.
  // The page unmounts before the Convex subscription update arrives.
  const handleAccept = useCallback(() => {
    setActionTaken(true)
    void navigate({ to: '/' })
    void acceptInvitation({
      invitationId: invitationId as Id<'workspaceInvitations'>,
    })
      .then(() => toast.success('Invitation accepted'))
      .catch((err: unknown) =>
        toast.error(
          err instanceof Error ? err.message : 'Failed to accept invitation',
        ),
      )
  }, [navigate, acceptInvitation, invitationId])

  const handleReject = useCallback(() => {
    setActionTaken(true)
    void navigate({ to: '/' })
    void rejectInvitationAction({
      invitationId: invitationId as Id<'workspaceInvitations'>,
    })
      .then(() => toast.success('Invitation rejected'))
      .catch((err: unknown) =>
        toast.error(
          err instanceof Error ? err.message : 'Failed to reject invitation',
        ),
      )
  }, [navigate, rejectInvitationAction, invitationId])

  if (isAuthLoading || actionTaken) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const userEmail = user?.primaryEmailAddress?.emailAddress

  let content: React.ReactNode
  if (invitation === undefined) {
    content = (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  } else if (invitation === null) {
    content = (
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Invitation not found</h1>
        <p className="text-balance text-sm text-muted-foreground">
          This invitation does not exist or has expired.
        </p>
      </div>
    )
  } else if (!invitation.workspaceName) {
    content = (
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Workspace not found</h1>
        <p className="text-balance text-sm text-muted-foreground">
          The workspace associated with this invitation no longer exists.
        </p>
      </div>
    )
  } else if (invitation.status !== 'pending') {
    const statusMessage =
      invitation.status === 'accepted'
        ? 'This invitation has already been accepted.'
        : invitation.status === 'revoked'
          ? 'This invitation has been revoked by the workspace owner.'
          : 'This invitation has been rejected.'
    content = (
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Invitation no longer valid</h1>
        <p className="text-balance text-sm text-muted-foreground">
          {statusMessage}
        </p>
      </div>
    )
  } else if (
    userEmail &&
    invitation.email.toLowerCase() !== userEmail.toLowerCase()
  ) {
    content = (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">
            This invite is for another account
          </h1>
          <p className="text-balance text-sm text-muted-foreground">
            The invite link is not valid for the account you are currently
            logged in as <strong>{userEmail}</strong>. Please sign out and sign
            in with the correct email address to accept the invite.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => signOut({ redirectUrl: `/invite/${invitationId}` })}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    )
  } else {
    const displayName = inviterName ?? invitation.email
    content = (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Accept the invite</h1>
          <p className="text-balance text-sm text-muted-foreground">
            {displayName} invited you to join the{' '}
            <strong>{invitation.workspaceName}</strong> workspace on Bunkr. To
            accept the invitation, click the button below.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button onClick={handleAccept}>Accept</Button>
          <Button variant="outline" onClick={handleReject}>
            Reject
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="flex w-full max-w-xs flex-col gap-6">
        <div className="flex items-center justify-center gap-2">
          <img src="/icon-square.svg" alt="Bunkr" className="size-8 rounded" />
          <span className="text-xl font-bold">Bunkr</span>
        </div>
        {content}
      </div>
    </div>
  )
}
