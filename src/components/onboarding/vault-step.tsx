import { useMutation, useQuery } from 'convex/react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  deriveKeyFromPassphrase,
  encryptPrivateKey,
  encryptString,
  exportPrivateKey,
  exportPublicKey,
  generateKeyPair,
  importPrivateKey,
  storePrivateKey,
} from '~/lib/crypto'
import { api } from '../../../convex/_generated/api'
import { StepLayout } from './step-layout'
import type { OnboardingStepProps } from './types'

export function VaultStep({
  goToStep,
  setSubmitting,
  isInvited,
}: OnboardingStepProps) {
  const { t } = useTranslation()
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const enableEncryption = useMutation(
    api.encryptionKeys.enableWorkspaceEncryption,
  )
  const setupMember = useMutation(api.encryptionKeys.setupMemberEncryption)
  const updateStep = useMutation(api.onboarding.updateOnboardingStep)
  const encryptionState = useQuery(api.encryptionKeys.getWorkspaceEncryption)

  const valid = passphrase.length >= 8 && passphrase === confirm

  const encryptionAlreadySetUp =
    encryptionState?.enabled === true && encryptionState.hasPersonalKey
  const initiallySetUp = useRef(encryptionAlreadySetUp)
  const alreadySetUp = initiallySetUp.current

  const backStep = isInvited ? 'legal' : 'invite'

  async function handleSetup() {
    setSaving(true)
    setSubmitting(true)
    try {
      if (alreadySetUp) {
        await updateStep({ step: 'portfolio' })
        goToStep('portfolio')
        return
      }

      const personalKeyPair = await generateKeyPair()
      const personalPublicKeyJwk = await exportPublicKey(
        personalKeyPair.publicKey,
      )
      const personalPrivateKeyJwk = await exportPrivateKey(
        personalKeyPair.privateKey,
      )

      const salt = crypto.getRandomValues(new Uint8Array(32))
      const passphraseKey = await deriveKeyFromPassphrase(passphrase, salt)
      const encryptedPersonalPk = await encryptPrivateKey(
        personalPrivateKeyJwk,
        passphraseKey,
      )
      const saltB64 = btoa(String.fromCharCode(...salt))

      if (isInvited) {
        await setupMember({
          publicKey: personalPublicKeyJwk,
          encryptedPrivateKey: JSON.stringify(encryptedPersonalPk),
          pbkdf2Salt: saltB64,
        })
      } else {
        const wsKeyPair = await generateKeyPair()
        const wsPublicKeyJwk = await exportPublicKey(wsKeyPair.publicKey)
        const wsPrivateKeyJwk = await exportPrivateKey(wsKeyPair.privateKey)

        const ownerKeySlotEncrypted = await encryptString(
          wsPrivateKeyJwk,
          personalKeyPair.publicKey,
        )

        await enableEncryption({
          personalPublicKey: personalPublicKeyJwk,
          personalEncryptedPrivateKey: JSON.stringify(encryptedPersonalPk),
          personalPbkdf2Salt: saltB64,
          workspacePublicKey: wsPublicKeyJwk,
          ownerKeySlotEncryptedPrivateKey: ownerKeySlotEncrypted,
        })

        const wsKey = await importPrivateKey(wsPrivateKeyJwk)
        await storePrivateKey(wsKey)
      }

      await updateStep({ step: 'portfolio' })
      goToStep('portfolio')
    } catch (err) {
      toast.error(t('toast.failedSetupEncryption'))
      console.error(err)
      setSaving(false)
      setSubmitting(false)
    }
  }

  if (alreadySetUp) {
    return (
      <StepLayout
        title={t('onboarding.vault.alreadySetupTitle')}
        subtitle={t('onboarding.vault.alreadySetupSubtitle')}
        onBack={() => goToStep(backStep)}
        onSubmit={handleSetup}
        submitLabel={t('common.continue')}
        loading={saving}
      />
    )
  }

  return (
    <StepLayout
      title={t('onboarding.vault.title')}
      subtitle={t('onboarding.vault.subtitle')}
      onBack={() => goToStep(backStep)}
      onSubmit={handleSetup}
      submitLabel={t('button.createVault')}
      submitDisabled={!valid}
      loading={saving}
    >
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="vault-passphrase">
            {t('onboarding.vault.passphraseLabel')}
          </Label>
          <Input
            id="vault-passphrase"
            type="password"
            placeholder={t('onboarding.vault.passphrasePlaceholder')}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            {t('onboarding.vault.passphraseWarning')}
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="vault-confirm">
            {t('onboarding.vault.confirmLabel')}
          </Label>
          <Input
            id="vault-confirm"
            type="password"
            placeholder={t('onboarding.vault.confirmPlaceholder')}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {confirm && passphrase !== confirm && (
            <p className="text-sm text-destructive">
              {t('toast.passphraseMismatch')}
            </p>
          )}
        </div>
      </div>
    </StepLayout>
  )
}
