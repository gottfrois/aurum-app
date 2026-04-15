import { useConvex, useMutation } from 'convex/react'
import { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { HotkeyDisplay, Kbd } from '~/components/ui/kbd'
import { Label } from '~/components/ui/label'
import { useEncryption } from '~/contexts/encryption-context'
import {
  decryptPrivateKeyWithRecoveryCode,
  deriveKeyFromPassphrase,
  encryptPrivateKey,
  hashRecoveryCode,
  normalizeRecoveryCode,
} from '~/lib/crypto'
import { api } from '../../convex/_generated/api'

interface PassphraseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  unlock: (passphrase: string) => Promise<string>
  onUnlocked: (wsPrivateKeyJwk: string) => void
  description?: string
  submitLabel?: string
}

export function PassphraseDialog({
  open,
  onOpenChange,
  unlock,
  onUnlocked,
  description,
  submitLabel,
}: PassphraseDialogProps) {
  const { t } = useTranslation()
  const { unlockWithPersonalKey } = useEncryption()
  const resolvedDescription =
    description ?? t('dialogs.passphrase.defaultDescription')
  const resolvedSubmitLabel = submitLabel ?? t('common.unlock')
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)
  const [mode, setMode] = useState<
    'passphrase' | 'recovery' | 'new-passphrase'
  >('passphrase')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [recoveredKeyJwk, setRecoveredKeyJwk] = useState<string | null>(null)
  const [newPassphrase, setNewPassphrase] = useState('')
  const [newPassphraseConfirm, setNewPassphraseConfirm] = useState('')

  const convex = useConvex()
  const querySlotByHash = (args: { codeHash: string }) =>
    convex.query(api.encryptionKeys.getRecoveryCodeSlotByHash, args)
  const updatePersonalKey = useMutation(
    api.encryptionKeys.updatePersonalEncryptedKey,
  )
  const invalidateCode = useMutation(api.encryptionKeys.invalidateRecoveryCode)

  function resetState() {
    setPassphrase('')
    setError(null)
    setMode('passphrase')
    setRecoveryCode('')
    setRecoveredKeyJwk(null)
    setNewPassphrase('')
    setNewPassphraseConfirm('')
  }

  async function submitPassphrase() {
    if (!passphrase) return
    setError(null)
    setUnlocking(true)
    try {
      const wsPrivateKeyJwk = await unlock(passphrase)
      resetState()
      onUnlocked(wsPrivateKeyJwk)
    } catch {
      setError(t('toast.invalidPassphrase'))
    } finally {
      setUnlocking(false)
    }
  }

  async function submitRecovery() {
    const normalized = normalizeRecoveryCode(recoveryCode)
    if (!normalized) return
    setError(null)
    setUnlocking(true)
    try {
      const codeHash = await hashRecoveryCode(normalized)
      const slot = await querySlotByHash({ codeHash })
      if (!slot) {
        setError(t('recoveryCodes.invalidCode'))
        return
      }
      if (slot.usedAt) {
        setError(t('recoveryCodes.codeAlreadyUsed'))
        return
      }

      const { ct, iv } = JSON.parse(slot.encryptedPrivateKey) as {
        ct: string
        iv: string
      }
      const personalPrivateKeyJwk = await decryptPrivateKeyWithRecoveryCode(
        { ct, iv, salt: slot.pbkdf2Salt },
        normalized,
      )

      setRecoveredKeyJwk(personalPrivateKeyJwk)
      setMode('new-passphrase')
    } catch {
      setError(t('recoveryCodes.invalidCode'))
    } finally {
      setUnlocking(false)
    }
  }

  async function submitNewPassphrase() {
    if (
      !recoveredKeyJwk ||
      newPassphrase.length < 8 ||
      newPassphrase !== newPassphraseConfirm
    )
      return
    setError(null)
    setUnlocking(true)
    try {
      // Re-encrypt with new passphrase
      const salt = crypto.getRandomValues(new Uint8Array(32))
      const passphraseKey = await deriveKeyFromPassphrase(newPassphrase, salt)
      const encrypted = await encryptPrivateKey(recoveredKeyJwk, passphraseKey)
      const saltB64 = btoa(String.fromCharCode(...salt))

      await updatePersonalKey({
        encryptedPrivateKey: JSON.stringify(encrypted),
        pbkdf2Salt: saltB64,
      })

      // Invalidate the used recovery code
      const codeHash = await hashRecoveryCode(
        normalizeRecoveryCode(recoveryCode),
      )
      await invalidateCode({ codeHash })

      // Unlock the vault
      const wsPrivateKeyJwk = await unlockWithPersonalKey(recoveredKeyJwk)

      toast.success(t('recoveryCodes.recoverySuccess'))
      resetState()
      onUnlocked(wsPrivateKeyJwk)
    } catch {
      setError(t('recoveryCodes.recoveryFailed'))
    } finally {
      setUnlocking(false)
    }
  }

  function handleFormSubmit(
    handler: () => Promise<void>,
  ): (e: React.FormEvent) => void {
    return (e) => {
      e.preventDefault()
      handler()
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) resetState()
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false}>
        {mode === 'passphrase' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('dialogs.passphrase.title')}</DialogTitle>
              <DialogDescription>{resolvedDescription}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleFormSubmit(submitPassphrase)}>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="passphrase-input">
                    {t('dialogs.passphrase.label')}
                  </Label>
                  <Input
                    id="passphrase-input"
                    type="password"
                    placeholder={t('dialogs.passphrase.placeholder')}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    autoFocus
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  onClick={() => {
                    setError(null)
                    setMode('recovery')
                  }}
                >
                  {t('recoveryCodes.useRecoveryCode')}
                </button>
              </div>
              <PassphraseFooter
                onCancel={() => handleOpenChange(false)}
                onSubmit={submitPassphrase}
                disabled={!passphrase}
                unlocking={unlocking}
                submitLabel={resolvedSubmitLabel}
              />
            </form>
          </>
        )}

        {mode === 'recovery' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('recoveryCodes.enterCodeTitle')}</DialogTitle>
              <DialogDescription>
                {t('recoveryCodes.enterCodeDescription')}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleFormSubmit(submitRecovery)}>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="recovery-code-input">
                    {t('recoveryCodes.codeLabel')}
                  </Label>
                  <Input
                    id="recovery-code-input"
                    type="text"
                    className="font-mono"
                    placeholder="xxxxx-xxxxx"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    autoFocus
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  onClick={() => {
                    setError(null)
                    setRecoveryCode('')
                    setMode('passphrase')
                  }}
                >
                  {t('recoveryCodes.backToPassphrase')}
                </button>
              </div>
              <PassphraseFooter
                onCancel={() => handleOpenChange(false)}
                onSubmit={submitRecovery}
                disabled={!normalizeRecoveryCode(recoveryCode)}
                unlocking={unlocking}
                submitLabel={t('recoveryCodes.recover')}
              />
            </form>
          </>
        )}

        {mode === 'new-passphrase' && (
          <>
            <DialogHeader>
              <DialogTitle>
                {t('recoveryCodes.setNewPassphraseTitle')}
              </DialogTitle>
              <DialogDescription>
                {t('recoveryCodes.setNewPassphraseDescription')}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleFormSubmit(submitNewPassphrase)}>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="new-passphrase-input">
                    {t('recoveryCodes.newPassphraseLabel')}
                  </Label>
                  <Input
                    id="new-passphrase-input"
                    type="password"
                    placeholder={t('onboarding.vault.passphrasePlaceholder')}
                    value={newPassphrase}
                    onChange={(e) => setNewPassphrase(e.target.value)}
                    autoFocus
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-passphrase-confirm-input">
                    {t('recoveryCodes.confirmNewPassphraseLabel')}
                  </Label>
                  <Input
                    id="new-passphrase-confirm-input"
                    type="password"
                    placeholder={t('onboarding.vault.confirmPlaceholder')}
                    value={newPassphraseConfirm}
                    onChange={(e) => setNewPassphraseConfirm(e.target.value)}
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  {newPassphraseConfirm &&
                    newPassphrase !== newPassphraseConfirm && (
                      <p className="text-sm text-destructive">
                        {t('toast.passphraseMismatch')}
                      </p>
                    )}
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
              <PassphraseFooter
                onCancel={() => handleOpenChange(false)}
                onSubmit={submitNewPassphrase}
                disabled={
                  newPassphrase.length < 8 ||
                  newPassphrase !== newPassphraseConfirm
                }
                unlocking={unlocking}
                submitLabel={t('recoveryCodes.setPassphraseAndUnlock')}
              />
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PassphraseFooter({
  onCancel,
  onSubmit,
  disabled,
  unlocking,
  submitLabel,
}: {
  onCancel: () => void
  onSubmit: () => void
  disabled: boolean
  unlocking: boolean
  submitLabel: string
}) {
  const { t } = useTranslation()
  useHotkeys('escape', onCancel, {
    enableOnFormTags: true,
    preventDefault: true,
  })
  useHotkeys('mod+enter', onSubmit, {
    enabled: !disabled && !unlocking,
    enableOnFormTags: true,
    preventDefault: true,
  })

  return (
    <DialogFooter className="mt-4">
      <Button type="button" variant="outline" onClick={onCancel}>
        {t('common.cancel')} <Kbd>Esc</Kbd>
      </Button>
      <Button type="submit" disabled={disabled} loading={unlocking}>
        {submitLabel} <HotkeyDisplay hotkey={{ keys: 'mod+enter' }} />
      </Button>
    </DialogFooter>
  )
}
