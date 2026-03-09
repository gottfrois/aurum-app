import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import {
  Check,
  Clock,
  Copy,
  Lock,
  ShieldCheck,
  TriangleAlert,
  UserCheck,
  UserX,
} from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { useEncryption } from '~/contexts/encryption-context'
import {
  clearStoredPrivateKey,
  decryptData,
  deriveKeyFromPassphrase,
  encryptData,
  encryptPrivateKey,
  envelopeEncryptString,
  exportPrivateKey,
  exportPublicKey,
  generateKeyPair,
  importPublicKey,
  storePrivateKey,
} from '~/lib/crypto'
import { useProfile } from '~/contexts/profile-context'
import {
  ItemCard,
  ItemCardItem,
  ItemCardItemAction,
  ItemCardItemContent,
  ItemCardItemDescription,
  ItemCardItemTitle,
  ItemCardItems,
} from '~/components/item-card'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { Skeleton } from '~/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Label } from '~/components/ui/label'

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
  const { allProfileIds } = useProfile()
  const [setupOpen, setSetupOpen] = useState(false)
  const [memberSetupOpen, setMemberSetupOpen] = useState(false)
  const [migrateOpen, setMigrateOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)

  const shouldQueryMigration =
    isEncryptionEnabled && isUnlocked && allProfileIds.length > 0
  const allConnections = useQuery(
    api.powens.listAllConnections,
    shouldQueryMigration ? { profileIds: allProfileIds } : 'skip',
  )
  const allBankAccounts = useQuery(
    api.powens.listAllBankAccounts,
    shouldQueryMigration ? { profileIds: allProfileIds } : 'skip',
  )
  const allSnapshots = useQuery(
    api.balanceSnapshots.listAllSnapshotsByProfiles,
    shouldQueryMigration
      ? { profileIds: allProfileIds, startTimestamp: 0 }
      : 'skip',
  )
  const allInvestments = useQuery(
    api.investments.listAllInvestmentsByProfiles,
    shouldQueryMigration ? { profileIds: allProfileIds } : 'skip',
  )
  const allTransactions = useQuery(
    api.transactions.listAllTransactions,
    shouldQueryMigration ? { profileIds: allProfileIds } : 'skip',
  )

  const unencryptedCount =
    (allConnections?.filter((c) => !c.encryptedData).length ?? 0) +
    (allBankAccounts?.filter(
      (a) =>
        !a.encryptedData &&
        (a.balance !== 0 || a.number || a.iban || a.name !== 'Encrypted'),
    ).length ?? 0) +
    (allSnapshots?.filter((s) => !s.encryptedData && s.balance !== 0).length ??
      0) +
    (allInvestments?.filter((inv) => !inv.encryptedData && inv.valuation !== 0)
      .length ?? 0) +
    (allTransactions?.filter(
      (t) => !t.encryptedData && (t.value !== 0 || t.wording !== 'Encrypted'),
    ).length ?? 0)

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
                  {isEncryptionEnabled ? (
                    <Badge variant="secondary" className="ml-2">
                      <ShieldCheck className="size-3" />
                      Enabled
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="ml-2">
                      Disabled
                    </Badge>
                  )}
                </ItemCardItemTitle>
                <ItemCardItemDescription>
                  {!isEncryptionEnabled &&
                    'Enable encryption to protect your financial data at rest.'}
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
                </ItemCardItemDescription>
              </ItemCardItemContent>
              <ItemCardItemAction>
                {!isEncryptionEnabled && role === 'owner' && (
                  <Button variant="ghost" onClick={() => setSetupOpen(true)}>
                    <Lock className="size-4" />
                    Enable
                  </Button>
                )}
                {!isEncryptionEnabled && role !== 'owner' && (
                  <Badge variant="outline">Owner only</Badge>
                )}
                {isEncryptionEnabled && !hasPersonalKey && (
                  <Button
                    variant="ghost"
                    onClick={() => setMemberSetupOpen(true)}
                  >
                    <Lock className="size-4" />
                    Set up passphrase
                  </Button>
                )}
                {isEncryptionEnabled &&
                  hasPersonalKey &&
                  !hasWorkspaceAccess && (
                    <Badge variant="outline">
                      <Clock className="size-3" />
                      Pending access
                    </Badge>
                  )}
                {isEncryptionEnabled && isUnlocked && role === 'owner' && (
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDisableOpen(true)}
                  >
                    Disable
                  </Button>
                )}
                {isEncryptionEnabled &&
                  hasPersonalKey &&
                  hasWorkspaceAccess &&
                  !isUnlocked && (
                    <Badge variant="outline">
                      <Lock className="size-3" />
                      Locked
                    </Badge>
                  )}
              </ItemCardItemAction>
            </ItemCardItem>

            {isEncryptionEnabled && isUnlocked && unencryptedCount > 0 && (
              <ItemCardItem>
                <ItemCardItemContent>
                  <ItemCardItemTitle>Migrate existing data</ItemCardItemTitle>
                  <ItemCardItemDescription>
                    {unencryptedCount} unencrypted{' '}
                    {unencryptedCount === 1 ? 'record' : 'records'} found.
                  </ItemCardItemDescription>
                </ItemCardItemContent>
                <ItemCardItemAction>
                  <Button
                    variant="outline"
                    onClick={() => setMigrateOpen(true)}
                  >
                    Migrate
                  </Button>
                </ItemCardItemAction>
              </ItemCardItem>
            )}
          </ItemCardItems>
        </ItemCard>

        {isEncryptionEnabled && isUnlocked && <MembersAccessSection />}
      </div>

      <SetupDialog open={setupOpen} onOpenChange={setSetupOpen} />
      <MemberSetupDialog
        open={memberSetupOpen}
        onOpenChange={setMemberSetupOpen}
      />
      {migrateOpen && (
        <MigrateDialog open={migrateOpen} onOpenChange={setMigrateOpen} />
      )}
      {disableOpen && (
        <DisableDialog open={disableOpen} onOpenChange={setDisableOpen} />
      )}
    </div>
  )
}

function MembersAccessSection() {
  const { workspacePrivateKeyJwk } = useEncryption()
  const membersStatus = useQuery(api.encryptionKeys.listMembersEncryptionStatus)
  const resolveUsers = useAction(api.members.resolveUsers)
  const grantAccess = useMutation(api.encryptionKeys.grantMemberAccess)
  const [userInfo, setUserInfo] = useState<Record<
    string,
    { firstName: string | null; lastName: string | null; email: string }
  > | null>(null)
  const [granting, setGranting] = useState<string | null>(null)
  const resolvedRef = useRef(false)

  // Resolve user info from Clerk
  useEffect(() => {
    if (!membersStatus || membersStatus.length === 0) return
    if (resolvedRef.current) return
    resolvedRef.current = true

    const userIds = membersStatus.map((m) => m.userId)
    resolveUsers({ userIds })
      .then(setUserInfo)
      .catch(() => {
        resolvedRef.current = false
      })
  }, [membersStatus, resolveUsers])

  if (!membersStatus || membersStatus.length <= 1) return null

  async function handleGrantAccess(
    targetUserId: string,
    targetPublicKey: string,
  ) {
    if (!workspacePrivateKeyJwk) return
    setGranting(targetUserId)
    try {
      const recipientPubKey = await importPublicKey(targetPublicKey)
      const encryptedWsPrivateKey = await envelopeEncryptString(
        workspacePrivateKeyJwk,
        recipientPubKey,
      )
      await grantAccess({
        targetUserId,
        encryptedPrivateKey: encryptedWsPrivateKey,
      })
      toast.success('Access granted')
    } catch (err) {
      toast.error('Failed to grant access')
      console.error(err)
    } finally {
      setGranting(null)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-medium">Member access</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Manage which workspace members can decrypt financial data.
      </p>
      <ItemCard>
        <ItemCardItems>
          {membersStatus.map((m) => {
            const info = userInfo?.[m.userId]
            const displayName = info
              ? [info.firstName, info.lastName].filter(Boolean).join(' ') ||
                info.email
              : m.userId

            let status: 'access' | 'pending' | 'no-setup'
            if (m.hasKeySlot) status = 'access'
            else if (m.hasPersonalKey) status = 'pending'
            else status = 'no-setup'

            return (
              <ItemCardItem key={m.userId}>
                <ItemCardItemContent>
                  <ItemCardItemTitle>
                    {displayName}
                    {m.role === 'owner' && (
                      <Badge variant="outline" className="ml-2">
                        Owner
                      </Badge>
                    )}
                  </ItemCardItemTitle>
                  <ItemCardItemDescription>
                    {info?.email && info.email !== displayName && info.email}
                  </ItemCardItemDescription>
                </ItemCardItemContent>
                <ItemCardItemAction>
                  {status === 'access' && (
                    <Badge variant="secondary">
                      <UserCheck className="size-3" />
                      Has access
                    </Badge>
                  )}
                  {status === 'pending' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        granting === m.userId || !workspacePrivateKeyJwk
                      }
                      onClick={() => handleGrantAccess(m.userId, m.publicKey!)}
                    >
                      {granting === m.userId ? 'Granting...' : 'Grant access'}
                    </Button>
                  )}
                  {status === 'no-setup' && (
                    <Badge variant="outline">
                      <UserX className="size-3" />
                      Pending setup
                    </Badge>
                  )}
                </ItemCardItemAction>
              </ItemCardItem>
            )
          })}
        </ItemCardItems>
      </ItemCard>
    </div>
  )
}

function SetupDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const enableEncryption = useMutation(
    api.encryptionKeys.enableWorkspaceEncryption,
  )
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  const valid = passphrase.length >= 8 && passphrase === confirm

  async function handleEnable() {
    setSaving(true)
    try {
      // Generate personal RSA keypair
      const personalKeyPair = await generateKeyPair()
      const personalPublicKeyJwk = await exportPublicKey(
        personalKeyPair.publicKey,
      )
      const personalPrivateKeyJwk = await exportPrivateKey(
        personalKeyPair.privateKey,
      )

      // Encrypt personal private key with passphrase
      const salt = crypto.getRandomValues(new Uint8Array(32))
      const passphraseKey = await deriveKeyFromPassphrase(passphrase, salt)
      const encryptedPersonalPk = await encryptPrivateKey(
        personalPrivateKeyJwk,
        passphraseKey,
      )
      const saltB64 = btoa(String.fromCharCode(...salt))

      // Generate workspace RSA keypair
      const wsKeyPair = await generateKeyPair()
      const wsPublicKeyJwk = await exportPublicKey(wsKeyPair.publicKey)
      const wsPrivateKeyJwk = await exportPrivateKey(wsKeyPair.privateKey)

      // Encrypt workspace private key with owner's personal public key
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

      // Store workspace private key locally for immediate use
      storePrivateKey(wsPrivateKeyJwk)

      toast.success('Encryption enabled')
      onOpenChange(false)
      window.location.reload()
    } catch (err) {
      toast.error('Failed to enable encryption')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enable encryption</DialogTitle>
          <DialogDescription>
            Create a passphrase to protect your financial data. All workspace
            members will need to set up their own passphrase to access encrypted
            data.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
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
            <label className="text-sm font-medium">Confirm passphrase</label>
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
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleEnable} disabled={!valid || saving}>
            {saving ? 'Setting up...' : 'Enable encryption'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MemberSetupDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const setupMember = useMutation(api.encryptionKeys.setupMemberEncryption)
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  const valid = passphrase.length >= 8 && passphrase === confirm

  async function handleSetup() {
    setSaving(true)
    try {
      const keyPair = await generateKeyPair()
      const publicKeyJwk = await exportPublicKey(keyPair.publicKey)
      const privateKeyJwk = await exportPrivateKey(keyPair.privateKey)

      const salt = crypto.getRandomValues(new Uint8Array(32))
      const passphraseKey = await deriveKeyFromPassphrase(passphrase, salt)
      const encryptedPk = await encryptPrivateKey(privateKeyJwk, passphraseKey)
      const saltB64 = btoa(String.fromCharCode(...salt))

      await setupMember({
        publicKey: publicKeyJwk,
        encryptedPrivateKey: JSON.stringify(encryptedPk),
        pbkdf2Salt: saltB64,
      })

      toast.success(
        'Passphrase set up. A workspace member with access will grant you permission.',
      )
      onOpenChange(false)
    } catch (err) {
      toast.error('Failed to set up passphrase')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set up your passphrase</DialogTitle>
          <DialogDescription>
            Create a passphrase to protect your encryption key. After setup, a
            workspace member with access will need to grant you permission to
            decrypt data.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
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
            <label className="text-sm font-medium">Confirm passphrase</label>
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
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSetup} disabled={!valid || saving}>
            {saving ? 'Setting up...' : 'Set up passphrase'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MigrateDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { privateKey, workspacePublicKey } = useEncryption()
  const { allProfileIds } = useProfile()

  const allConnections = useQuery(
    api.powens.listAllConnections,
    allProfileIds.length > 0 ? { profileIds: allProfileIds } : 'skip',
  )
  const allBankAccounts = useQuery(
    api.powens.listAllBankAccounts,
    allProfileIds.length > 0 ? { profileIds: allProfileIds } : 'skip',
  )
  const allSnapshots = useQuery(
    api.balanceSnapshots.listAllSnapshotsByProfiles,
    allProfileIds.length > 0
      ? { profileIds: allProfileIds, startTimestamp: 0 }
      : 'skip',
  )
  const allInvestments = useQuery(
    api.investments.listAllInvestmentsByProfiles,
    allProfileIds.length > 0 ? { profileIds: allProfileIds } : 'skip',
  )
  const allTransactions = useQuery(
    api.transactions.listAllTransactions,
    allProfileIds.length > 0 ? { profileIds: allProfileIds } : 'skip',
  )

  const BATCH_SIZE = 50

  const migrateConnection = useMutation(api.encryptionKeys.migrateConnection)
  const migrateAccounts = useMutation(api.encryptionKeys.migrateBankAccount)
  const migrateSnapshotBatch = useMutation(
    api.encryptionKeys.migrateBalanceSnapshotBatch,
  )
  const migrateInvestmentBatch = useMutation(
    api.encryptionKeys.migrateInvestmentBatch,
  )
  const migrateTransactionBatch = useMutation(
    api.encryptionKeys.migrateTransactionBatch,
  )

  const [migrating, setMigrating] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const cancelRef = useRef(false)
  const isCancelled = () => cancelRef.current

  const unencryptedConnections = allConnections?.filter((c) => !c.encryptedData)
  const unencryptedAccounts = allBankAccounts?.filter(
    (a) =>
      !a.encryptedData &&
      (a.balance !== 0 || a.number || a.iban || a.name !== 'Encrypted'),
  )
  const unencryptedSnapshots = allSnapshots?.filter(
    (s) => !s.encryptedData && s.balance !== 0,
  )
  const unencryptedInvestments = allInvestments?.filter(
    (inv) => !inv.encryptedData && inv.valuation !== 0,
  )
  const unencryptedTransactions = allTransactions?.filter(
    (t) => !t.encryptedData && (t.value !== 0 || t.wording !== 'Encrypted'),
  )

  const totalUnencrypted =
    (unencryptedConnections?.length ?? 0) +
    (unencryptedAccounts?.length ?? 0) +
    (unencryptedSnapshots?.length ?? 0) +
    (unencryptedInvestments?.length ?? 0) +
    (unencryptedTransactions?.length ?? 0)

  function handleCancel() {
    cancelRef.current = true
  }

  async function handleMigrate() {
    if (!privateKey || !workspacePublicKey) return
    cancelRef.current = false
    setMigrating(true)

    const publicKey = await importPublicKey(workspacePublicKey)
    const total = totalUnencrypted
    setProgress({ done: 0, total })
    let done = 0

    // Connections — small count, keep sequential
    for (const conn of unencryptedConnections ?? []) {
      if (isCancelled()) break
      const encrypted = await encryptData(
        { connectorName: conn.connectorName },
        publicKey,
      )
      await migrateConnection({
        connectionId: conn._id,
        encryptedData: encrypted,
      })
      done++
      setProgress({ done, total })
    }

    // Accounts — small count, keep sequential
    for (const acct of unencryptedAccounts ?? []) {
      if (isCancelled()) break
      const encrypted = await encryptData(
        {
          name: acct.name,
          number: acct.number,
          iban: acct.iban,
          balance: acct.balance,
        },
        publicKey,
      )
      await migrateAccounts({
        bankAccountId: acct._id,
        encryptedData: encrypted,
      })
      done++
      setProgress({ done, total })
    }

    // Snapshots — bulk: encrypt in parallel, write in batches
    const snapshots = unencryptedSnapshots ?? []
    for (let i = 0; i < snapshots.length; i += BATCH_SIZE) {
      if (isCancelled()) break
      const chunk = snapshots.slice(i, i + BATCH_SIZE)
      const items = await Promise.all(
        chunk.map(async (snap) => ({
          snapshotId: snap._id,
          encryptedData: await encryptData(
            { balance: snap.balance },
            publicKey,
          ),
        })),
      )
      if (isCancelled()) break
      await migrateSnapshotBatch({ items })
      done += chunk.length
      setProgress({ done, total })
    }

    // Investments — bulk: encrypt in parallel, write in batches
    const investments = unencryptedInvestments ?? []
    for (let i = 0; i < investments.length; i += BATCH_SIZE) {
      if (isCancelled()) break
      const chunk = investments.slice(i, i + BATCH_SIZE)
      const items = await Promise.all(
        chunk.map(async (inv) => ({
          investmentId: inv._id,
          encryptedData: await encryptData(
            {
              code: inv.code,
              label: inv.label,
              description: inv.description,
              quantity: inv.quantity,
              unitprice: inv.unitprice,
              unitvalue: inv.unitvalue,
              valuation: inv.valuation,
              portfolioShare: inv.portfolioShare,
              diff: inv.diff,
              diffPercent: inv.diffPercent,
            },
            publicKey,
          ),
        })),
      )
      if (isCancelled()) break
      await migrateInvestmentBatch({ items })
      done += chunk.length
      setProgress({ done, total })
    }

    // Transactions — bulk: encrypt in parallel, write in batches
    const txns = unencryptedTransactions ?? []
    for (let i = 0; i < txns.length; i += BATCH_SIZE) {
      if (isCancelled()) break
      const chunk = txns.slice(i, i + BATCH_SIZE)
      const items = await Promise.all(
        chunk.map(async (txn) => ({
          transactionId: txn._id,
          encryptedData: await encryptData(
            {
              wording: txn.wording,
              originalWording: txn.originalWording,
              simplifiedWording: txn.simplifiedWording,
              value: txn.value,
              originalValue: txn.originalValue,
              counterparty: txn.counterparty,
              card: txn.card,
              comment: txn.comment,
              category: txn.category,
              categoryParent: txn.categoryParent,
            },
            publicKey,
          ),
        })),
      )
      if (isCancelled()) break
      await migrateTransactionBatch({ items })
      done += chunk.length
      setProgress({ done, total })
    }

    if (isCancelled()) {
      toast.info(`Migration paused — ${done} of ${total} records encrypted`)
    } else {
      toast.success('Migration complete')
    }
    setMigrating(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Migrate existing data</DialogTitle>
          <DialogDescription>
            This will encrypt all existing plaintext financial data. The
            encryption happens in your browser — plaintext values are replaced
            with ciphertext.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 text-sm">
          {totalUnencrypted === 0 ? (
            <p className="text-muted-foreground">
              All records are already encrypted. Nothing to migrate.
            </p>
          ) : (
            <p>
              <span className="font-medium">{totalUnencrypted}</span> records
              need encryption ({unencryptedAccounts?.length ?? 0} accounts,{' '}
              {unencryptedSnapshots?.length ?? 0} snapshots,{' '}
              {unencryptedInvestments?.length ?? 0} investments,{' '}
              {unencryptedTransactions?.length ?? 0} transactions).
            </p>
          )}
          {migrating && (
            <div className="mt-3">
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{
                    width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {progress.done} / {progress.total}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          {migrating ? (
            <Button variant="outline" onClick={handleCancel}>
              Stop
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleMigrate} disabled={totalUnencrypted === 0}>
                {progress.done > 0 ? 'Resume migration' : 'Start migration'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DisableDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { privateKey } = useEncryption()
  const { allProfileIds } = useProfile()

  const allConnections = useQuery(
    api.powens.listAllConnections,
    allProfileIds.length > 0 ? { profileIds: allProfileIds } : 'skip',
  )
  const allBankAccounts = useQuery(
    api.powens.listAllBankAccounts,
    allProfileIds.length > 0 ? { profileIds: allProfileIds } : 'skip',
  )
  const allSnapshots = useQuery(
    api.balanceSnapshots.listAllSnapshotsByProfiles,
    allProfileIds.length > 0
      ? { profileIds: allProfileIds, startTimestamp: 0 }
      : 'skip',
  )
  const allInvestments = useQuery(
    api.investments.listAllInvestmentsByProfiles,
    allProfileIds.length > 0 ? { profileIds: allProfileIds } : 'skip',
  )
  const allTransactions = useQuery(
    api.transactions.listAllTransactions,
    allProfileIds.length > 0 ? { profileIds: allProfileIds } : 'skip',
  )

  const BATCH_SIZE = 50

  const decryptConn = useMutation(api.encryptionKeys.decryptConnection)
  const decryptAccount = useMutation(api.encryptionKeys.decryptBankAccount)
  const decryptSnapshotBatch = useMutation(
    api.encryptionKeys.decryptBalanceSnapshotBatch,
  )
  const decryptInvestmentBatch = useMutation(
    api.encryptionKeys.decryptInvestmentBatch,
  )
  const decryptTransactionBatch = useMutation(
    api.encryptionKeys.decryptTransactionBatch,
  )
  const disableEncryption = useMutation(
    api.encryptionKeys.disableWorkspaceEncryption,
  )

  const [disabling, setDisabling] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [confirmText, setConfirmText] = useState('')
  const [copied, setCopied] = useState(false)
  const cancelRef = useRef(false)
  const isCancelled = () => cancelRef.current

  const confirmPhrase = 'disable encryption'
  const isConfirmed = confirmText === confirmPhrase

  async function handleCopy() {
    await navigator.clipboard.writeText(confirmPhrase)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const encryptedConnections =
    allConnections?.filter((c) => c.encryptedData) ?? []
  const encryptedAccounts =
    allBankAccounts?.filter((a) => a.encryptedData) ?? []
  const encryptedSnapshots = allSnapshots?.filter((s) => s.encryptedData) ?? []
  const encryptedInvestments =
    allInvestments?.filter((inv) => inv.encryptedData) ?? []
  const encryptedTransactions =
    allTransactions?.filter((t) => t.encryptedData) ?? []

  const totalEncrypted =
    encryptedConnections.length +
    encryptedAccounts.length +
    encryptedSnapshots.length +
    encryptedInvestments.length +
    encryptedTransactions.length

  function handleCancel() {
    cancelRef.current = true
  }

  async function handleDisable() {
    if (!privateKey || !isConfirmed) return
    cancelRef.current = false
    setDisabling(true)

    const total = totalEncrypted
    setProgress({ done: 0, total })
    let done = 0

    // Connections — small count, keep sequential
    for (const conn of encryptedConnections) {
      if (isCancelled()) break
      const data = await decryptData(conn.encryptedData!, privateKey)
      await decryptConn({
        connectionId: conn._id,
        connectorName: (data.connectorName as string | undefined) ?? 'Unknown',
      })
      done++
      setProgress({ done, total })
    }

    // Accounts — small count, keep sequential
    for (const acct of encryptedAccounts) {
      if (isCancelled()) break
      const data = await decryptData(acct.encryptedData!, privateKey)
      await decryptAccount({
        bankAccountId: acct._id,
        name: (data.name as string | undefined) ?? 'Unknown',
        balance: (data.balance as number | undefined) ?? 0,
        number: (data.number as string | undefined) ?? undefined,
        iban: (data.iban as string | undefined) ?? undefined,
      })
      done++
      setProgress({ done, total })
    }

    // Snapshots — bulk: decrypt in parallel, write in batches
    for (let i = 0; i < encryptedSnapshots.length; i += BATCH_SIZE) {
      if (isCancelled()) break
      const chunk = encryptedSnapshots.slice(i, i + BATCH_SIZE)
      const items = await Promise.all(
        chunk.map(async (snap) => {
          const data = await decryptData(snap.encryptedData!, privateKey)
          return {
            snapshotId: snap._id,
            balance: (data.balance as number | undefined) ?? 0,
          }
        }),
      )
      if (isCancelled()) break
      await decryptSnapshotBatch({ items })
      done += chunk.length
      setProgress({ done, total })
    }

    // Investments — bulk: decrypt in parallel, write in batches
    for (let i = 0; i < encryptedInvestments.length; i += BATCH_SIZE) {
      if (isCancelled()) break
      const chunk = encryptedInvestments.slice(i, i + BATCH_SIZE)
      const items = await Promise.all(
        chunk.map(async (inv) => {
          const data = await decryptData(inv.encryptedData!, privateKey)
          return {
            investmentId: inv._id,
            code: (data.code as string | undefined) ?? undefined,
            label: (data.label as string | undefined) ?? 'Unknown',
            description: (data.description as string | undefined) ?? undefined,
            quantity: (data.quantity as number | undefined) ?? 0,
            unitprice: (data.unitprice as number | undefined) ?? 0,
            unitvalue: (data.unitvalue as number | undefined) ?? 0,
            valuation: (data.valuation as number | undefined) ?? 0,
            portfolioShare:
              (data.portfolioShare as number | undefined) ?? undefined,
            diff: (data.diff as number | undefined) ?? undefined,
            diffPercent: (data.diffPercent as number | undefined) ?? undefined,
          }
        }),
      )
      if (isCancelled()) break
      await decryptInvestmentBatch({ items })
      done += chunk.length
      setProgress({ done, total })
    }

    // Transactions — bulk: decrypt in parallel, write in batches
    for (let i = 0; i < encryptedTransactions.length; i += BATCH_SIZE) {
      if (isCancelled()) break
      const chunk = encryptedTransactions.slice(i, i + BATCH_SIZE)
      const items = await Promise.all(
        chunk.map(async (txn) => {
          const data = await decryptData(txn.encryptedData!, privateKey)
          return {
            transactionId: txn._id,
            wording: (data.wording as string | undefined) ?? 'Unknown',
            originalWording:
              (data.originalWording as string | undefined) ?? undefined,
            simplifiedWording:
              (data.simplifiedWording as string | undefined) ?? undefined,
            value: (data.value as number | undefined) ?? 0,
            originalValue:
              (data.originalValue as number | undefined) ?? undefined,
            counterparty:
              (data.counterparty as string | undefined) ?? undefined,
            card: (data.card as string | undefined) ?? undefined,
            comment: (data.comment as string | undefined) ?? undefined,
            category: (data.category as string | undefined) ?? undefined,
            categoryParent:
              (data.categoryParent as string | undefined) ?? undefined,
          }
        }),
      )
      if (isCancelled()) break
      await decryptTransactionBatch({ items })
      done += chunk.length
      setProgress({ done, total })
    }

    if (isCancelled()) {
      toast.info(`Decryption paused — ${done} of ${total} records decrypted`)
      setDisabling(false)
      return
    }

    await disableEncryption()
    clearStoredPrivateKey()

    toast.success('Encryption disabled')
    setDisabling(false)
    onOpenChange(false)
    window.location.reload()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disable encryption</DialogTitle>
          <DialogDescription>
            Your financial data will no longer be protected by encryption.
            Anyone with access to the app will be able to see your balances,
            account numbers, and investment details.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {totalEncrypted > 0 && (
            <p className="text-sm">
              <span className="font-medium">{totalEncrypted}</span>{' '}
              {totalEncrypted === 1 ? 'record' : 'records'} will be unprotected.
              This includes your account balances, IBANs, and investment
              holdings.
            </p>
          )}
          <div className="grid gap-2">
            <Label
              htmlFor="disable-confirm"
              className="flex flex-wrap items-center gap-1 text-sm"
            >
              Type
              <Badge
                variant="secondary"
                className="cursor-pointer gap-1 font-mono"
                onClick={handleCopy}
              >
                {confirmPhrase}
                {copied ? (
                  <Check className="size-3" />
                ) : (
                  <Copy className="size-3" />
                )}
              </Badge>
              to confirm
            </Label>
            <Input
              id="disable-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={confirmPhrase}
              disabled={disabling}
            />
          </div>
          {disabling && (
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
                {progress.done} / {progress.total}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          {disabling ? (
            <Button variant="outline" onClick={handleCancel}>
              Stop
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisable}
                disabled={!isConfirmed}
              >
                {progress.done > 0 ? 'Resume decryption' : 'Disable encryption'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
