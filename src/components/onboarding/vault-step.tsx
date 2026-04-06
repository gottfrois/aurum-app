import { useMutation, useQuery } from 'convex/react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { RecoveryCodesDisplay } from '~/components/recovery-codes-display'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  deriveKeyFromPassphrase,
  encryptPrivateKey,
  encryptPrivateKeyWithRecoveryCode,
  encryptString,
  exportPrivateKey,
  exportPublicKey,
  generateKeyPair,
  generateRecoveryCodes,
  importPrivateKey,
  storePrivateKey,
} from '~/lib/crypto'
import { api } from '../../../convex/_generated/api'
import { StepLayout } from './step-layout'
import type { OnboardingStepProps } from './types'

interface PendingOwnerSetup {
  personalPublicKeyJwk: string
  personalEncryptedPrivateKey: string
  personalPbkdf2Salt: string
  workspacePublicKey: string
  ownerKeySlotEncryptedPrivateKey: string
  wsPrivateKeyJwk: string
  recoveryCodes: string[]
  recoveryCodeSlots: Array<{
    codeHash: string
    encryptedPrivateKey: string
    pbkdf2Salt: string
    slotIndex: number
  }>
}

export function VaultStep({ next, back, isInvited }: OnboardingStepProps) {
  const { t } = useTranslation()
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [phase, setPhase] = useState<'passphrase' | 'codes'>('passphrase')
  const [pendingSetup, setPendingSetup] = useState<PendingOwnerSetup | null>(
    null,
  )
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

  const onBack = back

  async function handlePassphraseSubmit() {
    setSaving(true)
    try {
      if (alreadySetUp) {
        await updateStep({ step: 'portfolio' })
        next()
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
        await updateStep({ step: 'portfolio' })
        next()
      } else {
        const wsKeyPair = await generateKeyPair()
        const wsPublicKeyJwk = await exportPublicKey(wsKeyPair.publicKey)
        const wsPrivateKeyJwk = await exportPrivateKey(wsKeyPair.privateKey)

        const ownerKeySlotEncrypted = await encryptString(
          wsPrivateKeyJwk,
          personalKeyPair.publicKey,
        )

        // Generate recovery codes and encrypt personal private key with each
        const codes = generateRecoveryCodes()
        const recoverySlots = await Promise.all(
          codes.map(async (code, i) => {
            const result = await encryptPrivateKeyWithRecoveryCode(
              personalPrivateKeyJwk,
              code,
            )
            return {
              codeHash: result.codeHash,
              encryptedPrivateKey: JSON.stringify({
                ct: result.ct,
                iv: result.iv,
              }),
              pbkdf2Salt: result.salt,
              slotIndex: i,
            }
          }),
        )

        setPendingSetup({
          personalPublicKeyJwk,
          personalEncryptedPrivateKey: JSON.stringify(encryptedPersonalPk),
          personalPbkdf2Salt: saltB64,
          workspacePublicKey: wsPublicKeyJwk,
          ownerKeySlotEncryptedPrivateKey: ownerKeySlotEncrypted,
          wsPrivateKeyJwk,
          recoveryCodes: codes,
          recoveryCodeSlots: recoverySlots,
        })
        setPhase('codes')
        setSaving(false)
      }
    } catch (err) {
      toast.error(t('toast.failedSetupEncryption'))
      console.error(err)
      setSaving(false)
    }
  }

  async function handleCodesConfirm() {
    if (!pendingSetup) return
    setSaving(true)
    try {
      await enableEncryption({
        personalPublicKey: pendingSetup.personalPublicKeyJwk,
        personalEncryptedPrivateKey: pendingSetup.personalEncryptedPrivateKey,
        personalPbkdf2Salt: pendingSetup.personalPbkdf2Salt,
        workspacePublicKey: pendingSetup.workspacePublicKey,
        ownerKeySlotEncryptedPrivateKey:
          pendingSetup.ownerKeySlotEncryptedPrivateKey,
        recoveryCodeSlots: pendingSetup.recoveryCodeSlots,
      })

      const wsKey = await importPrivateKey(pendingSetup.wsPrivateKeyJwk)
      await storePrivateKey(wsKey)

      await updateStep({ step: 'portfolio' })
      next()
    } catch (err) {
      toast.error(t('toast.failedSetupEncryption'))
      console.error(err)
      setSaving(false)
    }
  }

  if (alreadySetUp) {
    return (
      <StepLayout
        title={t('onboarding.vault.alreadySetupTitle')}
        subtitle={t('onboarding.vault.alreadySetupSubtitle')}
        onBack={onBack}
        onSubmit={handlePassphraseSubmit}
        submitLabel={t('common.continue')}
        loading={saving}
      />
    )
  }

  if (phase === 'codes' && pendingSetup) {
    return (
      <StepLayout
        title={t('recoveryCodes.title')}
        subtitle={t('recoveryCodes.subtitle')}
        onBack={() => {
          setPhase('passphrase')
          setPendingSetup(null)
        }}
        onSubmit={handleCodesConfirm}
        submitLabel={t('recoveryCodes.iveSavedMyCodes')}
        loading={saving}
      >
        <RecoveryCodesDisplay codes={pendingSetup.recoveryCodes} />
      </StepLayout>
    )
  }

  return (
    <StepLayout
      title={t('onboarding.vault.title')}
      subtitle={t('onboarding.vault.subtitle')}
      onBack={onBack}
      onSubmit={handlePassphraseSubmit}
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
