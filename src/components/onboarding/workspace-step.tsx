import { useUser } from '@clerk/tanstack-react-start'
import { useAction, useMutation, useQuery } from 'convex/react'
import { Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  ItemCard,
  ItemCardFooter,
  ItemCardItem,
  ItemCardItemAction,
  ItemCardItemContent,
  ItemCardItemDescription,
  ItemCardItems,
  ItemCardItemTitle,
} from '~/components/item-card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { StepLayout } from './step-layout'
import type { OnboardingStepProps } from './types'

type View = 'list' | 'create'

export function WorkspaceStep({ next, back }: OnboardingStepProps) {
  const { t, i18n } = useTranslation()
  const { user } = useUser()

  const pendingInvitations = useQuery(api.members.getPendingInvitationsForUser)
  const acceptInvitation = useAction(api.members.acceptInvitationById)
  const resolveUsersAction = useAction(api.members.resolveUsers)
  const createWorkspace = useMutation(api.onboarding.createWorkspaceOnboarding)

  const hasInvitations =
    pendingInvitations !== undefined && pendingInvitations.length > 0
  const [view, setView] = useState<View>('create')
  const [joiningId, setJoiningId] = useState<Id<'workspaceInvitations'> | null>(
    null,
  )
  const [resolvedUsers, setResolvedUsers] = useState<
    Record<string, { firstName: string | null; lastName: string | null }>
  >({})

  useEffect(() => {
    if (pendingInvitations !== undefined) {
      setView(pendingInvitations.length > 0 ? 'list' : 'create')
    }
  }, [pendingInvitations])

  useEffect(() => {
    if (!pendingInvitations || pendingInvitations.length === 0) return
    const userIds = [...new Set(pendingInvitations.map((inv) => inv.invitedBy))]
    resolveUsersAction({ userIds })
      .then((users) => {
        setResolvedUsers(users)
      })
      .catch(() => {})
  }, [pendingInvitations, resolveUsersAction])

  const handleJoin = useCallback(
    async (invitationId: Id<'workspaceInvitations'>) => {
      setJoiningId(invitationId)
      try {
        await acceptInvitation({ invitationId })
        toast.success('Invitation accepted')
        next()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to accept invitation',
        )
        setJoiningId(null)
      }
    },
    [acceptInvitation, next],
  )

  const defaultName = user?.firstName
    ? `${user.firstName}'s workspace`
    : 'My Workspace'
  const [name, setName] = useState(defaultName)
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    setSaving(true)
    try {
      await createWorkspace({ workspaceName: name, language: i18n.language })
      next()
    } catch (err) {
      toast.error(t('toast.failedCreateWorkspace'))
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (view === 'create') {
    return (
      <StepLayout
        title={t('onboarding.workspace.title')}
        subtitle={t('onboarding.workspace.subtitle')}
        onBack={hasInvitations ? () => setView('list') : back}
        onSubmit={handleCreate}
        submitLabel={t('common.continue')}
        submitDisabled={!name.trim()}
        loading={saving}
      >
        <div className="grid gap-2">
          <Label htmlFor="workspace-name">
            {t('onboarding.workspace.nameLabel')}
          </Label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('onboarding.workspace.namePlaceholder')}
            autoFocus
          />
        </div>
      </StepLayout>
    )
  }

  function getInviterName(userId: string): string {
    const u = resolvedUsers[userId]
    if (!u) return ''
    return [u.firstName, u.lastName].filter(Boolean).join(' ')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-bold">Join or create a workspace</h1>
        <p className="text-balance text-sm text-muted-foreground">
          Join a workspace or create a new one to start tracking your personal
          finance.
        </p>
      </div>

      {pendingInvitations && pendingInvitations.length > 0 && (
        <ItemCard>
          <ItemCardItems>
            {pendingInvitations.map((inv) => (
              <ItemCardItem key={inv._id}>
                <ItemCardItemContent>
                  <ItemCardItemTitle>{inv.workspaceName}</ItemCardItemTitle>
                  <ItemCardItemDescription>
                    {getInviterName(inv.invitedBy)
                      ? `Invited by ${getInviterName(inv.invitedBy)}`
                      : "You've been invited to join"}
                  </ItemCardItemDescription>
                </ItemCardItemContent>
                <ItemCardItemAction>
                  <Button
                    size="sm"
                    onClick={() => handleJoin(inv._id)}
                    loading={joiningId === inv._id}
                    disabled={joiningId !== null && joiningId !== inv._id}
                  >
                    Join
                  </Button>
                </ItemCardItemAction>
              </ItemCardItem>
            ))}
          </ItemCardItems>
          <ItemCardFooter className="justify-between">
            <span className="text-sm text-muted-foreground">
              Or create your own workspace
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setView('create')}
              disabled={joiningId !== null}
            >
              <Plus className="size-4" />
              Create
            </Button>
          </ItemCardFooter>
        </ItemCard>
      )}
    </div>
  )
}
