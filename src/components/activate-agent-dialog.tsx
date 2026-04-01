import * as Sentry from '@sentry/tanstackstart-react'
import { useAction, useMutation } from 'convex/react'
import { ShieldAlert } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { HotkeyDisplay, Kbd } from '~/components/ui/kbd'
import { Label } from '~/components/ui/label'
import { useEncryption } from '~/contexts/encryption-context'
import { encryptString, importPublicKey } from '~/lib/crypto'
import { api } from '../../convex/_generated/api'

interface ActivateAgentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ActivateAgentDialog({
  open,
  onOpenChange,
}: ActivateAgentDialogProps) {
  const { t } = useTranslation()
  const generateKeyPair = useAction(api.agent.generateAgentKeyPairAction)
  const activateAgent = useMutation(api.agent.activateAgent)
  const { workspacePrivateKeyJwk, unlock } = useEncryption()

  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pendingActivation, setPendingActivation] = useState(false)
  const [agentPublicKeyJwk, setAgentPublicKeyJwk] = useState<string | null>(
    null,
  )

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setPassphrase('')
        setError(null)
        setAgentPublicKeyJwk(null)
        setPendingActivation(false)
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange],
  )

  const handleCancel = useCallback(() => {
    handleOpenChange(false)
  }, [handleOpenChange])

  const doActivate = useCallback(
    async (wsPrivateKeyJwk: string, pubKeyJwk: string) => {
      const recipientPubKey = await importPublicKey(pubKeyJwk)
      const encryptedWsPrivateKey = await encryptString(
        wsPrivateKeyJwk,
        recipientPubKey,
      )
      await activateAgent({
        encryptedWorkspacePrivateKey: encryptedWsPrivateKey,
      })
      toast.success(t('toast.agentActivated'))
      handleOpenChange(false)
    },
    [activateAgent, handleOpenChange, t],
  )

  // After passphrase unlock, the key becomes available on next render
  useEffect(() => {
    if (pendingActivation && workspacePrivateKeyJwk && agentPublicKeyJwk) {
      setPendingActivation(false)
      setLoading(true)
      doActivate(workspacePrivateKeyJwk, agentPublicKeyJwk).finally(() =>
        setLoading(false),
      )
    }
  }, [pendingActivation, workspacePrivateKeyJwk, agentPublicKeyJwk, doActivate])

  async function handleConfirm() {
    if (loading) return
    setError(null)
    setLoading(true)

    try {
      // Step 1: Unlock vault if needed
      if (!workspacePrivateKeyJwk) {
        if (!passphrase) {
          setError(t('toast.passphraseRequired'))
          setLoading(false)
          return
        }
        try {
          await unlock(passphrase)
        } catch {
          setError(t('toast.invalidPassphrase'))
          setLoading(false)
          return
        }
      }

      // Step 2: Generate agent keypair server-side
      const { publicKeyJwk } = await generateKeyPair()
      setAgentPublicKeyJwk(publicKeyJwk)

      // Step 3: Encrypt workspace private key with agent's public key
      if (workspacePrivateKeyJwk) {
        await doActivate(workspacePrivateKeyJwk, publicKeyJwk)
      } else {
        // Key will be available on next render after unlock
        setPendingActivation(true)
        setLoading(false)
      }
    } catch (error) {
      Sentry.captureException(error)
      toast.error(t('toast.failedActivateAgent'))
      setLoading(false)
    }
  }

  const isVaultUnlocked = !!workspacePrivateKeyJwk
  const canSubmit = isVaultUnlocked || passphrase.length > 0

  useHotkeys('escape', handleCancel, {
    enabled: open,
    enableOnFormTags: true,
    preventDefault: true,
  })

  useHotkeys(
    'mod+enter',
    () => {
      void handleConfirm()
    },
    {
      enabled: open && canSubmit && !loading,
      enableOnFormTags: true,
      preventDefault: true,
    },
  )

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-amber-500" />
            {t('dialogs.activateAgent.title')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>{t('dialogs.activateAgent.description1')}</p>
              <p>{t('dialogs.activateAgent.description2')}</p>
              <ul className="list-disc space-y-1 pl-4 text-sm">
                <li>{t('dialogs.activateAgent.point1')}</li>
                <li>{t('dialogs.activateAgent.point2')}</li>
                <li>{t('dialogs.activateAgent.point3')}</li>
                <li>{t('dialogs.activateAgent.point4')}</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {!isVaultUnlocked && (
          <div className="grid gap-2 py-2">
            <Label htmlFor="agent-passphrase">
              {t('dialogs.activateAgent.passphraseLabel')}
            </Label>
            <Input
              id="agent-passphrase"
              type="password"
              placeholder={t('dialogs.activateAgent.passphrasePlaceholder')}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
        <AlertDialogFooter>
          <Button variant="outline" disabled={loading} onClick={handleCancel}>
            {t('common.cancel')} <Kbd>Esc</Kbd>
          </Button>
          <Button
            disabled={loading || !canSubmit}
            loading={loading}
            onClick={() => void handleConfirm()}
          >
            {t('button.activateAgent')}{' '}
            <HotkeyDisplay hotkey={{ keys: 'mod+enter' }} />
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
