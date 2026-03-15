import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { KeyRound, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useRef, useState } from 'react'
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
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Badge } from '~/components/ui/badge'
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
import { Skeleton } from '~/components/ui/skeleton'
import { useEncryption } from '~/contexts/encryption-context'
import { usePortfolio } from '~/contexts/portfolio-context'
import {
  decryptData,
  encryptData,
  envelopeEncryptString,
  exportPrivateKey,
  exportPublicKey,
  generateKeyPair,
  importPrivateKey,
  importPublicKey,
  storePrivateKey,
} from '~/lib/crypto'
import { api } from '../../../convex/_generated/api'

export const Route = createFileRoute('/_settings/settings/encryption')({
  component: EncryptionPage,
})

function EncryptionPage() {
  const {
    isEncryptionEnabled,
    isUnlocked,
    isLoading,
    hasPersonalKey,
    hasWorkspaceAccess,
    role,
  } = useEncryption()
  const [rotateOpen, setRotateOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-10 py-16">
        <header>
          <Skeleton className="h-9 w-48" />
        </header>
        <div className="mt-8 space-y-6">
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
      <header>
        <h1 className="text-3xl font-semibold">Encryption</h1>
      </header>
      <div className="mt-8 space-y-6">
        <div>
          <h2 className="text-lg font-medium">Zero-knowledge encryption</h2>
          <p className="text-sm text-muted-foreground">
            Encrypt your financial data so that only workspace members can read
            it. No one else can access your balances, IBANs, or investment
            details — not even us.
          </p>
        </div>

        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Important</AlertTitle>
          <AlertDescription>
            If you forget your passphrase, your encrypted data cannot be
            recovered. There is no reset mechanism. Store your passphrase
            safely.
          </AlertDescription>
        </Alert>

        <ItemCard>
          <ItemCardItems>
            <ItemCardItem>
              <ItemCardItemContent>
                <ItemCardItemTitle>
                  Status
                  <Badge variant="secondary" className="ml-2">
                    <ShieldCheck className="size-3" />
                    Enabled
                  </Badge>
                </ItemCardItemTitle>
                <ItemCardItemDescription>
                  {isEncryptionEnabled &&
                    !hasPersonalKey &&
                    'Encryption is enabled. Set up your passphrase to access encrypted data.'}
                  {isEncryptionEnabled &&
                    hasPersonalKey &&
                    !hasWorkspaceAccess &&
                    'Your passphrase is set up. Waiting for a workspace member to grant you access.'}
                  {isEncryptionEnabled &&
                    isUnlocked &&
                    'Your vault is unlocked. Data is being decrypted in your browser.'}
                  {isEncryptionEnabled &&
                    hasPersonalKey &&
                    hasWorkspaceAccess &&
                    !isUnlocked &&
                    'Your vault is locked. Enter your passphrase to view data.'}
                  {!isEncryptionEnabled &&
                    'Encryption is always enabled for all workspaces.'}
                </ItemCardItemDescription>
              </ItemCardItemContent>
            </ItemCardItem>

            {isEncryptionEnabled && isUnlocked && role === 'owner' && (
              <ItemCardItem>
                <ItemCardItemContent>
                  <ItemCardItemTitle>Key rotation</ItemCardItemTitle>
                  <ItemCardItemDescription>
                    Generate a new workspace keypair and re-encrypt all data.
                    Other members will need to be re-granted access.
                  </ItemCardItemDescription>
                </ItemCardItemContent>
                <ItemCardItemAction>
                  <Button variant="outline" onClick={() => setRotateOpen(true)}>
                    <KeyRound className="size-4" />
                    Rotate keys
                  </Button>
                </ItemCardItemAction>
              </ItemCardItem>
            )}
          </ItemCardItems>
        </ItemCard>
      </div>

      {rotateOpen && (
        <KeyRotationDialog open={rotateOpen} onOpenChange={setRotateOpen} />
      )}
    </div>
  )
}

function KeyRotationDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { privateKey, workspacePublicKey } = useEncryption()
  const { allPortfolioIds } = usePortfolio()

  const allConnections = useQuery(
    api.powens.listAllConnections,
    allPortfolioIds.length > 0 ? { portfolioIds: allPortfolioIds } : 'skip',
  )
  const allBankAccounts = useQuery(
    api.powens.listAllBankAccounts,
    allPortfolioIds.length > 0 ? { portfolioIds: allPortfolioIds } : 'skip',
  )
  const allSnapshots = useQuery(
    api.balanceSnapshots.listAllSnapshotsByPortfolios,
    allPortfolioIds.length > 0
      ? { portfolioIds: allPortfolioIds, startTimestamp: 0 }
      : 'skip',
  )
  const allInvestments = useQuery(
    api.investments.listAllInvestmentsByPortfolios,
    allPortfolioIds.length > 0 ? { portfolioIds: allPortfolioIds } : 'skip',
  )

  const BATCH_SIZE = 50

  const rotateKey = useMutation(api.encryptionKeys.rotateWorkspaceKey)
  const completeRotation = useMutation(api.encryptionKeys.completeKeyRotation)
  const reEncryptConnection = useMutation(
    api.encryptionKeys.reEncryptConnection,
  )
  const reEncryptAccount = useMutation(api.encryptionKeys.reEncryptBankAccount)
  const reEncryptSnapshotBatch = useMutation(
    api.encryptionKeys.reEncryptBalanceSnapshotBatch,
  )
  const reEncryptInvestmentBatch = useMutation(
    api.encryptionKeys.reEncryptInvestmentBatch,
  )

  const [passphrase, setPassphrase] = useState('')
  const [rotating, setRotating] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [step, setStep] = useState<'passphrase' | 'rotating'>('passphrase')
  const cancelRef = useRef(false)
  const isCancelled = () => cancelRef.current

  const encryptedConnections =
    allConnections?.filter((c) => c.encryptedData) ?? []
  const encryptedAccounts =
    allBankAccounts?.filter((a) => a.encryptedData) ?? []
  const encryptedSnapshots = allSnapshots?.filter((s) => s.encryptedData) ?? []
  const encryptedInvestments =
    allInvestments?.filter((inv) => inv.encryptedData) ?? []

  const totalRecords =
    encryptedConnections.length +
    encryptedAccounts.length +
    encryptedSnapshots.length +
    encryptedInvestments.length

  function handleCancel() {
    cancelRef.current = true
  }

  const membersStatus = useQuery(api.encryptionKeys.listMembersEncryptionStatus)

  async function handleRotateComplete() {
    if (!privateKey || !passphrase || !workspacePublicKey || !membersStatus)
      return

    const ownerMember = membersStatus.find((m) => m.role === 'owner')
    if (!ownerMember?.publicKey) {
      toast.error('Could not find owner personal public key')
      return
    }

    cancelRef.current = false
    setRotating(true)
    setStep('rotating')

    try {
      const newWsKeyPair = await generateKeyPair()
      const newWsPublicKeyJwk = await exportPublicKey(newWsKeyPair.publicKey)
      const newWsPrivateKeyJwk = await exportPrivateKey(newWsKeyPair.privateKey)

      const personalPublicKey = await importPublicKey(ownerMember.publicKey)
      const ownerKeySlotEncrypted = await envelopeEncryptString(
        newWsPrivateKeyJwk,
        personalPublicKey,
      )

      await rotateKey({
        newWorkspacePublicKey: newWsPublicKeyJwk,
        ownerKeySlotEncryptedPrivateKey: ownerKeySlotEncrypted,
      })

      const newPublicKey = newWsKeyPair.publicKey
      const total = totalRecords
      setProgress({ done: 0, total })
      let done = 0

      for (const conn of encryptedConnections) {
        if (isCancelled()) break
        const data = await decryptData(
          conn.encryptedData!,
          privateKey,
          conn._id,
        )
        const encrypted = await encryptData(data, newPublicKey, conn._id)
        await reEncryptConnection({
          connectionId: conn._id,
          encryptedData: encrypted,
        })
        done++
        setProgress({ done, total })
      }

      for (const acct of encryptedAccounts) {
        if (isCancelled()) break
        const data = await decryptData(
          acct.encryptedData!,
          privateKey,
          acct._id,
        )
        const encrypted = await encryptData(data, newPublicKey, acct._id)
        await reEncryptAccount({
          bankAccountId: acct._id,
          encryptedData: encrypted,
        })
        done++
        setProgress({ done, total })
      }

      for (let i = 0; i < encryptedSnapshots.length; i += BATCH_SIZE) {
        if (isCancelled()) break
        const chunk = encryptedSnapshots.slice(i, i + BATCH_SIZE)
        const items = await Promise.all(
          chunk.map(async (snap) => {
            const data = await decryptData(
              snap.encryptedData!,
              privateKey,
              snap._id,
            )
            return {
              snapshotId: snap._id,
              encryptedData: await encryptData(data, newPublicKey, snap._id),
            }
          }),
        )
        if (isCancelled()) break
        await reEncryptSnapshotBatch({ items })
        done += chunk.length
        setProgress({ done, total })
      }

      for (let i = 0; i < encryptedInvestments.length; i += BATCH_SIZE) {
        if (isCancelled()) break
        const chunk = encryptedInvestments.slice(i, i + BATCH_SIZE)
        const items = await Promise.all(
          chunk.map(async (inv) => {
            const data = await decryptData(
              inv.encryptedData!,
              privateKey,
              inv._id,
            )
            return {
              investmentId: inv._id,
              encryptedData: await encryptData(data, newPublicKey, inv._id),
            }
          }),
        )
        if (isCancelled()) break
        await reEncryptInvestmentBatch({ items })
        done += chunk.length
        setProgress({ done, total })
      }

      if (isCancelled()) {
        toast.info(
          `Key rotation paused — ${done} of ${total} records re-encrypted. Please complete the rotation.`,
        )
      } else {
        await completeRotation()

        const newWsKey = await importPrivateKey(newWsPrivateKeyJwk)
        await storePrivateKey(newWsKey)

        toast.success(
          'Key rotation complete. Other members need to be re-granted access.',
        )
        onOpenChange(false)
        window.location.reload()
      }
    } catch (err) {
      toast.error('Key rotation failed')
      console.error(err)
    } finally {
      setRotating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rotate encryption keys</DialogTitle>
          <DialogDescription>
            Generate a new workspace keypair and re-encrypt all data. All other
            workspace members will lose access and need to be re-granted.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {step === 'passphrase' && (
            <>
              <Alert>
                <TriangleAlert />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                  All workspace members except you will lose access after
                  rotation. You will need to re-grant access to each member.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Enter your passphrase
                </label>
                <Input
                  type="password"
                  placeholder="Your encryption passphrase"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
              </div>
              {totalRecords > 0 && (
                <p className="text-sm text-muted-foreground">
                  {totalRecords} encrypted{' '}
                  {totalRecords === 1 ? 'record' : 'records'} will be
                  re-encrypted with the new key.
                </p>
              )}
            </>
          )}
          {step === 'rotating' && (
            <div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{
                    width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Re-encrypting: {progress.done} / {progress.total}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          {rotating ? (
            <Button variant="outline" onClick={handleCancel}>
              Stop
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleRotateComplete}
                disabled={!passphrase || rotating}
              >
                Rotate keys
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
