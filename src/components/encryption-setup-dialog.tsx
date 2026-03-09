import { useState } from 'react'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { ShieldCheck, TriangleAlert } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useEncryption } from '~/contexts/encryption-context'
import {
  deriveKeyFromPassphrase,
  encryptPrivateKey,
  envelopeEncryptString,
  exportPrivateKey,
  exportPublicKey,
  generateKeyPair,
  importPrivateKey,
  storePrivateKey,
} from '~/lib/crypto'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

const DISMISSED_KEY = 'bunkr-encryption-setup-dismissed'

export function EncryptionSetupDialog() {
  const { isEncryptionEnabled, isLoading, role } = useEncryption()
  const [dismissed, setDismissed] = useState(
    () =>
      typeof window !== 'undefined' &&
      localStorage.getItem(DISMISSED_KEY) === 'true',
  )
  const [step, setStep] = useState<'prompt' | 'setup'>('prompt')
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const enableEncryption = useMutation(
    api.encryptionKeys.enableWorkspaceEncryption,
  )

  // Only show for owners, when encryption is not enabled, not loading, and not dismissed
  if (isLoading || isEncryptionEnabled || role !== 'owner' || dismissed) {
    return null
  }

  const valid = passphrase.length >= 8 && passphrase === confirm

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setDismissed(true)
  }

  async function handleEnable() {
    setSaving(true)
    try {
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

      const wsKeyPair = await generateKeyPair()
      const wsPublicKeyJwk = await exportPublicKey(wsKeyPair.publicKey)
      const wsPrivateKeyJwk = await exportPrivateKey(wsKeyPair.privateKey)

      const ownerKeySlotEncrypted = await envelopeEncryptString(
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

      // Import as non-extractable CryptoKey and store in IndexedDB
      const wsKey = await importPrivateKey(wsPrivateKeyJwk)
      await storePrivateKey(wsKey)

      toast.success('Encryption enabled')
      window.location.reload()
    } catch (err) {
      toast.error('Failed to enable encryption')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent showCloseButton={step === 'prompt'}>
        {step === 'prompt' ? (
          <>
            <DialogHeader>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 sm:mx-0">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle>Protect your financial data</DialogTitle>
              <DialogDescription>
                Enable zero-knowledge encryption so that only you can read your
                financial data. Not even we can access it. You can always enable
                this later from settings.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={handleDismiss}>
                Maybe later
              </Button>
              <Button onClick={() => setStep('setup')}>
                Set up encryption
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create your passphrase</DialogTitle>
              <DialogDescription>
                This passphrase protects your encryption keys. You&apos;ll need
                it to unlock your data on new devices. It cannot be recovered if
                lost.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>Important</AlertTitle>
                <AlertDescription>
                  If you forget your passphrase, your encrypted data cannot be
                  recovered. There is no reset mechanism. Store your passphrase
                  safely.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <label className="text-sm font-medium">Passphrase</label>
                <Input
                  type="password"
                  placeholder="At least 8 characters"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Confirm passphrase
                </label>
                <Input
                  type="password"
                  placeholder="Repeat passphrase"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                {confirm && passphrase !== confirm && (
                  <p className="text-sm text-destructive">
                    Passphrases do not match
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep('prompt')}
                disabled={saving}
              >
                Back
              </Button>
              <Button onClick={handleEnable} disabled={!valid || saving}>
                {saving ? 'Setting up...' : 'Enable encryption'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
