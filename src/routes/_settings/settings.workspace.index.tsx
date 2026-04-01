import * as Sentry from '@sentry/tanstackstart-react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '~/components/confirm-dialog'
import {
  ItemCard,
  ItemCardItem,
  ItemCardItemAction,
  ItemCardItemContent,
  ItemCardItemDescription,
  ItemCardItems,
  ItemCardItemTitle,
} from '~/components/item-card'
import { RequireOwner } from '~/components/require-owner'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { PageHeader } from '~/components/ui/page-header'
import { Skeleton } from '~/components/ui/skeleton'
import { api } from '../../../convex/_generated/api'

export const Route = createFileRoute('/_settings/settings/workspace/')({
  component: GeneralPage,
})

function GeneralPage() {
  const { t } = useTranslation()
  const workspace = useQuery(api.workspaces.getMyWorkspace)

  if (workspace === undefined) {
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

  if (!workspace) return null

  return (
    <RequireOwner>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
        <PageHeader
          title={t('settings.workspaceGeneral.title')}
          description={t('settings.workspaceGeneral.description')}
        />
        <div className="mt-8 space-y-6">
          <WorkspaceNameCard name={workspace.name} />
          <DeleteWorkspaceCard workspaceName={workspace.name} />
        </div>
      </div>
    </RequireOwner>
  )
}

function WorkspaceNameCard({ name }: { name: string }) {
  const { t } = useTranslation()
  const updateWorkspace = useMutation(api.workspaces.updateWorkspace)
  const [workspaceName, setWorkspaceName] = useState(name)
  const [saving, setSaving] = useState(false)

  async function handleBlur() {
    const trimmed = workspaceName.trim()
    if (trimmed === name) return

    if (!trimmed) {
      setWorkspaceName(name)
      toast.error(t('toast.workspaceNameCannotBeEmpty'))
      return
    }

    setSaving(true)
    try {
      await updateWorkspace({ name: trimmed })
      toast.success(t('toast.workspaceNameUpdated'))
    } catch (error) {
      Sentry.captureException(error)
      setWorkspaceName(name)
      toast.error(t('toast.failedUpdateWorkspaceName'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ItemCard>
      <ItemCardItems>
        <ItemCardItem>
          <ItemCardItemContent>
            <ItemCardItemTitle>
              {t('settings.workspaceGeneral.workspaceName')}
            </ItemCardItemTitle>
          </ItemCardItemContent>
          <ItemCardItemAction>
            <Input
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              disabled={saving}
              className="h-8 w-48 text-sm"
            />
          </ItemCardItemAction>
        </ItemCardItem>
      </ItemCardItems>
    </ItemCard>
  )
}

function DeleteWorkspaceCard({ workspaceName }: { workspaceName: string }) {
  const { t } = useTranslation()
  const deleteWorkspace = useAction(api.workspaces.deleteWorkspace)
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      await deleteWorkspace()
      toast.success(t('toast.workspaceDeleted'))
      navigate({ to: '/' })
    } catch (error) {
      Sentry.captureException(error)
      toast.error(t('toast.failedDeleteWorkspace'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">
        {t('settings.workspaceGeneral.workspaceAccess')}
      </h2>
      <ItemCard>
        <ItemCardItems>
          <ItemCardItem>
            <ItemCardItemContent>
              <ItemCardItemTitle>
                {t('settings.workspaceGeneral.deleteWorkspace')}
              </ItemCardItemTitle>
              <ItemCardItemDescription>
                {t('settings.workspaceGeneral.deleteWorkspaceDescription')}
              </ItemCardItemDescription>
            </ItemCardItemContent>
            <ItemCardItemAction>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmOpen(true)}
              >
                {t('common.delete')}
              </Button>
            </ItemCardItemAction>
          </ItemCardItem>
        </ItemCardItems>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t('settings.workspaceGeneral.deleteWorkspace')}
          description={t('settings.workspaceGeneral.deleteWorkspaceConfirm', {
            name: workspaceName,
          })}
          confirmValue={workspaceName}
          confirmLabel={t('common.delete')}
          loading={loading}
          onConfirm={handleDelete}
        />
      </ItemCard>
    </section>
  )
}
