import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
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
import { RequireOwner } from '~/components/require-owner'
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

export const Route = createFileRoute(
  '/_settings/settings/workspace/permissions',
)({
  component: PermissionsPage,
})

function PermissionsPage() {
  const { t } = useTranslation()
  return (
    <RequireOwner>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
        <div className="shrink-0">
          <PageHeader
            title={t('settings.permissions.title')}
            description={t('settings.permissions.description')}
          />
        </div>
        <div className="mt-8 space-y-6">
          <PermissionsSettings />
        </div>
      </div>
    </RequireOwner>
  )
}

function PermissionsSettings() {
  const { t } = useTranslation()
  const workspace = useQuery(api.workspaces.getMyWorkspace)
  const updatePolicies = useMutation(api.workspaces.updateWorkspacePolicies)

  if (workspace === undefined) {
    return <Skeleton className="h-48 w-full rounded-lg" />
  }

  if (!workspace) return null

  const categoryCreation = workspace.policies?.categoryCreation ?? 'owners_only'
  const labelCreation = workspace.policies?.labelCreation ?? 'owners_only'
  const ruleCreation = workspace.policies?.ruleCreation ?? 'owners_only'

  const handleChange = async (
    field: 'categoryCreation' | 'labelCreation' | 'ruleCreation',
    value: 'owners_only' | 'all_members',
  ) => {
    try {
      await updatePolicies({
        categoryCreation:
          field === 'categoryCreation' ? value : categoryCreation,
        labelCreation: field === 'labelCreation' ? value : labelCreation,
        ruleCreation: field === 'ruleCreation' ? value : ruleCreation,
      })
      toast.success(t('toast.permissionsUpdated'))
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('toast.failedUpdatePermissions'),
      )
    }
  }

  return (
    <ItemCard>
      <ItemCardItems>
        <ItemCardItem>
          <ItemCardItemContent>
            <ItemCardItemTitle>
              {t('settings.permissions.categoryCreation')}
            </ItemCardItemTitle>
            <ItemCardItemDescription>
              {t('settings.permissions.categoryCreationDescription')}
            </ItemCardItemDescription>
          </ItemCardItemContent>
          <ItemCardItemAction>
            <Select
              value={categoryCreation}
              onValueChange={(v) =>
                handleChange(
                  'categoryCreation',
                  v as 'owners_only' | 'all_members',
                )
              }
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owners_only">
                  {t('settings.permissions.ownersOnly')}
                </SelectItem>
                <SelectItem value="all_members">
                  {t('settings.permissions.allMembers')}
                </SelectItem>
              </SelectContent>
            </Select>
          </ItemCardItemAction>
        </ItemCardItem>
        <ItemCardItem>
          <ItemCardItemContent>
            <ItemCardItemTitle>
              {t('settings.permissions.labelCreation')}
            </ItemCardItemTitle>
            <ItemCardItemDescription>
              {t('settings.permissions.labelCreationDescription')}
            </ItemCardItemDescription>
          </ItemCardItemContent>
          <ItemCardItemAction>
            <Select
              value={labelCreation}
              onValueChange={(v) =>
                handleChange(
                  'labelCreation',
                  v as 'owners_only' | 'all_members',
                )
              }
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owners_only">
                  {t('settings.permissions.ownersOnly')}
                </SelectItem>
                <SelectItem value="all_members">
                  {t('settings.permissions.allMembers')}
                </SelectItem>
              </SelectContent>
            </Select>
          </ItemCardItemAction>
        </ItemCardItem>
        <ItemCardItem>
          <ItemCardItemContent>
            <ItemCardItemTitle>
              {t('settings.permissions.automationRules')}
            </ItemCardItemTitle>
            <ItemCardItemDescription>
              {t('settings.permissions.automationRulesDescription')}
            </ItemCardItemDescription>
          </ItemCardItemContent>
          <ItemCardItemAction>
            <Select
              value={ruleCreation}
              onValueChange={(v) =>
                handleChange('ruleCreation', v as 'owners_only' | 'all_members')
              }
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owners_only">
                  {t('settings.permissions.ownersOnly')}
                </SelectItem>
                <SelectItem value="all_members">
                  {t('settings.permissions.allMembers')}
                </SelectItem>
              </SelectContent>
            </Select>
          </ItemCardItemAction>
        </ItemCardItem>
      </ItemCardItems>
    </ItemCard>
  )
}
