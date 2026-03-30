import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useState } from 'react'
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
  return (
    <RequireOwner>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
        <div className="shrink-0">
          <PageHeader
            title="AI & Agents"
            description="Configure the Bunkr AI assistant for your workspace."
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
        toast.success('Instructions saved')
      } catch {
        toast.error('Failed to save instructions')
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
      .then(() => toast.success('Bunkr Agent deactivated'))
      .catch(() => toast.error('Failed to deactivate agent'))
  }

  const handleToggleWebSearch = async (checked: boolean) => {
    try {
      await updateSettings({ webSearchEnabled: checked })
      toast.success('Settings updated')
    } catch {
      toast.error('Failed to update settings')
    }
  }

  return (
    <>
      <ItemCard>
        <ItemCardItems>
          <ItemCardItem>
            <ItemCardItemContent>
              <ItemCardItemTitle>
                Bunkr Agent{' '}
                <Badge variant="secondary" className="ml-1">
                  Beta
                </Badge>
              </ItemCardItemTitle>
              <ItemCardItemDescription>
                Allow conversations with Bunkr Agent inside your workspace
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
                  <ItemCardItemTitle>Enable web search</ItemCardItemTitle>
                  <ItemCardItemDescription>
                    Allow Bunkr Agent to search the public web for current
                    information and cite sources
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

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">Instructions</h3>
              <p className="text-sm text-muted-foreground">
                Provide custom instructions that guide how Bunkr Agent responds
                in your workspace.
              </p>
            </div>
            <Textarea
              value={instructions}
              onChange={handleInstructionsChange}
              onBlur={handleInstructionsBlur}
              placeholder="Optional agent instructions..."
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
