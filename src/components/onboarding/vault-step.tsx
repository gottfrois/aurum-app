import { useMutation, useQuery } from 'convex/react'
import { useRef, useState } from 'react'
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
      toast.error('Failed to set up encryption')
      console.error(err)
      setSaving(false)
      setSubmitting(false)
    }
  }

  if (alreadySetUp) {
    return (
      <StepLayout
        title="Vault already set up"
        subtitle="Your encryption is already configured. Continue to the next step."
        onBack={() => goToStep(backStep)}
        onSubmit={handleSetup}
        submitLabel="Continue"
        loading={saving}
      />
    )
  }

  return (
    <StepLayout
      title="Set up your Vault"
      subtitle="Your financial data is protected with zero-knowledge encryption"
      onBack={() => goToStep(backStep)}
      onSubmit={handleSetup}
      submitLabel="Create Vault"
      submitDisabled={!valid}
      loading={saving}
    >
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="vault-passphrase">Passphrase</Label>
          <Input
            id="vault-passphrase"
            type="password"
            placeholder="At least 8 characters"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            There is no reset mechanism. Store your passphrase safely.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="vault-confirm">Confirm passphrase</Label>
          <Input
            id="vault-confirm"
            type="password"
            placeholder="Repeat passphrase"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {confirm && passphrase !== confirm && (
            <p className="text-sm text-destructive">Passphrases do not match</p>
          )}
        </div>
      </div>
    </StepLayout>
  )
}
