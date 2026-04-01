import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ActivateAgentDialog } from '~/components/activate-agent-dialog'
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
import { Badge } from '~/components/ui/badge'
import { PageHeader } from '~/components/ui/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Skeleton } from '~/components/ui/skeleton'
import { Switch } from '~/components/ui/switch'
import { Textarea } from '~/components/ui/textarea'
import { useEncryption } from '~/contexts/encryption-context'
import { decryptData, encryptData, importPublicKey } from '~/lib/crypto'
import { api } from '../../../convex/_generated/api'

export const Route = createFileRoute('/_settings/settings/workspace/agent')({
  component: AgentSettingsPage,
})

function AgentSettingsPage() {
  const { t } = useTranslation()
  return (
    <RequireOwner>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
        <div className="shrink-0">
          <PageHeader
            title={t('settings.agent.title')}
            description={t('settings.agent.description')}
          />
        </div>
        <div className="mt-8 space-y-6">
          <AgentSettings />
        </div>
      </div>
    </RequireOwner>
  )
}

function AgentSettings() {
  const { t } = useTranslation()
  const settings = useQuery(api.agent.getAgentSettings)
  const updateSettings = useMutation(api.agent.updateAgentSettings)
  const deactivateAgent = useMutation(api.agent.deactivateAgent)
  const { privateKey, workspacePublicKey } = useEncryption()

  const [activateDialogOpen, setActivateDialogOpen] = useState(false)
  const [instructions, setInstructions] = useState('')
  const [instructionsLoaded, setInstructionsLoaded] = useState(false)
  // Decrypt instructions on load
  useEffect(() => {
    if (!settings?.encryptedInstructions || !privateKey || instructionsLoaded) {
      if (settings && !settings.encryptedInstructions && !instructionsLoaded) {
        setInstructionsLoaded(true)
      }
      return
    }

    void decryptData(
      settings.encryptedInstructions,
      privateKey,
      'agent-instructions',
    ).then((data) => {
      setInstructions((data.instructions as string) ?? '')
      setInstructionsLoaded(true)
    })
  }, [
    settings?.encryptedInstructions,
    privateKey,
    instructionsLoaded,
    settings,
  ])

  const saveInstructions = useCallback(
    async (text: string) => {
      if (!workspacePublicKey) return
      try {
        const pubKey = await importPublicKey(workspacePublicKey)
        const encrypted = await encryptData(
          { instructions: text },
          pubKey,
          'agent-instructions',
        )
        await updateSettings({ encryptedInstructions: encrypted })
        toast.success(t('toast.instructionsSaved'))
      } catch {
        toast.error(t('toast.failedSaveInstructions'))
      }
    },
    [workspacePublicKey, updateSettings],
  )

  const handleInstructionsChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInstructions(e.target.value)
    },
    [],
  )

  const handleInstructionsBlur = useCallback(() => {
    void saveInstructions(instructions)
  }, [saveInstructions, instructions])

  if (settings === undefined) {
    return <Skeleton className="h-48 w-full rounded-lg" />
  }

  if (!settings) return null

  const handleToggleAgent = (checked: boolean) => {
    if (checked) {
      setActivateDialogOpen(true)
      return
    }
    void deactivateAgent()
      .then(() => toast.success(t('toast.agentDeactivated')))
      .catch(() => toast.error(t('toast.failedDeactivateAgent')))
  }

  const handleToggleWebSearch = async (checked: boolean) => {
    try {
      await updateSettings({ webSearchEnabled: checked })
      toast.success(t('toast.settingsUpdated'))
    } catch {
      toast.error(t('status.errorOccurred'))
    }
  }

  return (
    <>
      <ItemCard>
        <ItemCardItems>
          <ItemCardItem>
            <ItemCardItemContent>
              <ItemCardItemTitle>
                {t('settings.agent.bunkrAgent')}{' '}
                <Badge variant="secondary" className="ml-1">
                  {t('settings.agent.beta')}
                </Badge>
              </ItemCardItemTitle>
              <ItemCardItemDescription>
                {t('settings.agent.agentDescription')}
              </ItemCardItemDescription>
            </ItemCardItemContent>
            <ItemCardItemAction>
              <Switch
                checked={settings.agentEnabled}
                onCheckedChange={handleToggleAgent}
              />
            </ItemCardItemAction>
          </ItemCardItem>
        </ItemCardItems>
      </ItemCard>

      {settings.agentEnabled && settings.hasKeySlot && (
        <>
          <ItemCard>
            <ItemCardItems>
              <ItemCardItem>
                <ItemCardItemContent>
                  <ItemCardItemTitle>
                    {t('settings.agent.webSearch')}
                  </ItemCardItemTitle>
                  <ItemCardItemDescription>
                    {t('settings.agent.webSearchDescription')}
                  </ItemCardItemDescription>
                </ItemCardItemContent>
                <ItemCardItemAction>
                  <Switch
                    checked={settings.webSearchEnabled}
                    onCheckedChange={handleToggleWebSearch}
                  />
                </ItemCardItemAction>
              </ItemCardItem>
            </ItemCardItems>
          </ItemCard>

          <ItemCard>
            <ItemCardItems>
              <ItemCardItem>
                <ItemCardItemContent>
                  <ItemCardItemTitle>
                    {t('settings.agent.retention')}
                  </ItemCardItemTitle>
                  <ItemCardItemDescription>
                    {t('settings.agent.retentionDescription')}
                  </ItemCardItemDescription>
                </ItemCardItemContent>
                <ItemCardItemAction>
                  <Select
                    value={String(settings.threadRetentionDays)}
                    onValueChange={async (v) => {
                      try {
                        await updateSettings({
                          threadRetentionDays: Number(v),
                        })
                        toast.success(t('toast.settingsUpdated'))
                      } catch {
                        toast.error(t('status.errorOccurred'))
                      }
                    }}
                  >
                    <SelectTrigger size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">
                        {t('settings.agent.retention1d')}
                      </SelectItem>
                      <SelectItem value="3">
                        {t('settings.agent.retention3d')}
                      </SelectItem>
                      <SelectItem value="7">
                        {t('settings.agent.retention7d')}
                      </SelectItem>
                      <SelectItem value="14">
                        {t('settings.agent.retention14d')}
                      </SelectItem>
                      <SelectItem value="30">
                        {t('settings.agent.retention30d')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </ItemCardItemAction>
              </ItemCardItem>
            </ItemCardItems>
          </ItemCard>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">
                {t('settings.agent.instructions')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('settings.agent.instructionsDescription')}
              </p>
            </div>
            <Textarea
              value={instructions}
              onChange={handleInstructionsChange}
              onBlur={handleInstructionsBlur}
              placeholder={t('settings.agent.instructionsPlaceholder')}
              className="min-h-32"
              disabled={!instructionsLoaded}
            />
          </div>
        </>
      )}

      <ActivateAgentDialog
        open={activateDialogOpen}
        onOpenChange={setActivateDialogOpen}
      />
    </>
  )
}
