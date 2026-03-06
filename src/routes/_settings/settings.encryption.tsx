import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { toast } from 'sonner'
import { useEncryption } from '~/contexts/encryption-context'
import {
  generateKeyPair,
  exportPublicKey,
  exportPrivateKey,
  deriveKeyFromPassphrase,
  encryptPrivateKey,
  envelopeEncryptString,
  storePrivateKey,
  clearStoredPrivateKey,
  encryptData,
  decryptData,
  importPublicKey,
} from '~/lib/crypto'
import { useProfile } from '~/contexts/profile-context'
import {
  ItemCard,
  ItemCardItems,
  ItemCardItem,
  ItemCardItemContent,
  ItemCardItemTitle,
  ItemCardItemDescription,
  ItemCardItemAction,
} from '~/components/item-card'
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
import { Check, Clock, Copy, Lock, ShieldCheck, TriangleAlert, UserCheck, UserX } from 'lucide-react'

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

  const unencryptedCount =
    (allConnections?.filter((c) => !c.encryptedData).length ?? 0) +
    (allBankAccounts?.filter(
      (a) => !a.encryptedData && (a.balance !== 0 || a.number || a.iban || a.name !== 'Encrypted'),
    ).length ?? 0) +
    (allSnapshots?.filter((s) => !s.encryptedData && s.balance !== 0).length ??
      0) +
    (allInvestments?.filter((inv) => !inv.encryptedData && inv.valuation !== 0)
      .length ?? 0)

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

        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm dark:border-yellow-900 dark:bg-yellow-950">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
            <div className="space-y-1">
              <p className="font-medium text-yellow-800 dark:text-yellow-200">
                Important
              </p>
              <p className="text-yellow-700 dark:text-yellow-300">
                If you forget your passphrase, your encrypted data cannot be
                recovered. There is no reset mechanism. Store your passphrase
                safely.
              </p>
            </div>
          </div>
        </div>

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
                  {isEncryptionEnabled && !hasPersonalKey &&
                    'Encryption is enabled. Set up your passphrase to access encrypted data.'}
                  {isEncryptionEnabled && hasPersonalKey && !hasWorkspaceAccess &&
                    'Your passphrase is set up. Waiting for a workspace member to grant you access.'}
                  {isEncryptionEnabled && isUnlocked &&
                    'Your vault is unlocked. Data is being decrypted in your browser.'}
                  {isEncryptionEnabled && hasPersonalKey && hasWorkspaceAccess && !isUnlocked &&
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
                {isEncryptionEnabled && hasPersonalKey && !hasWorkspaceAccess && (
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
                {isEncryptionEnabled && hasPersonalKey && hasWorkspaceAccess && !isUnlocked && (
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
  const membersStatus = useQuery(
    api.encryptionKeys.listMembersEncryptionStatus,
  )
  const resolveUsers = useAction(api.members.resolveUsers)
  const grantAccess = useMutation(api.encryptionKeys.grantMemberAccess)
  const [userInfo, setUserInfo] = useState<
    Record<string, { firstName: string | null; lastName: string | null; email: string }> | null
  >(null)
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

  async function handleGrantAccess(targetUserId: string, targetPublicKey: string) {
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
                      disabled={granting === m.userId || !workspacePrivateKeyJwk}
                      onClick={() =>
                        handleGrantAccess(m.userId, m.publicKey!)
                      }
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
      const personalPublicKeyJwk = await exportPublicKey(personalKeyPair.publicKey)
      const personalPrivateKeyJwk = await exportPrivateKey(personalKeyPair.privateKey)

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
            members will need to set up their own passphrase to access
            encrypted data.
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
          <Button
            onClick={handleEnable}
            disabled={!valid || saving}
          >
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

  const migrateConnection = useMutation(api.encryptionKeys.migrateConnection)
  const migrateAccounts = useMutation(api.encryptionKeys.migrateBankAccount)
  const migrateSnapshot = useMutation(api.encryptionKeys.migrateBalanceSnapshot)
  const migrateInvestment = useMutation(api.encryptionKeys.migrateInvestment)

  const [migrating, setMigrating] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  const unencryptedConnections = allConnections?.filter(
    (c) => !c.encryptedData,
  )
  const unencryptedAccounts = allBankAccounts?.filter(
    (a) => !a.encryptedData && (a.balance !== 0 || a.number || a.iban || a.name !== 'Encrypted'),
  )
  const unencryptedSnapshots = allSnapshots?.filter(
    (s) => !s.encryptedData && s.balance !== 0,
  )
  const unencryptedInvestments = allInvestments?.filter(
    (inv) => !inv.encryptedData && inv.valuation !== 0,
  )

  const totalUnencrypted =
    (unencryptedConnections?.length ?? 0) +
    (unencryptedAccounts?.length ?? 0) +
    (unencryptedSnapshots?.length ?? 0) +
    (unencryptedInvestments?.length ?? 0)

  async function handleMigrate() {
    if (!privateKey || !workspacePublicKey) return
    setMigrating(true)

    const publicKey = await importPublicKey(workspacePublicKey)
    const total = totalUnencrypted
    setProgress({ done: 0, total })
    let done = 0

    for (const conn of unencryptedConnections ?? []) {
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

    for (const acct of unencryptedAccounts ?? []) {
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

    for (const snap of unencryptedSnapshots ?? []) {
      const encrypted = await encryptData({ balance: snap.balance }, publicKey)
      await migrateSnapshot({
        snapshotId: snap._id,
        encryptedData: encrypted,
      })
      done++
      setProgress({ done, total })
    }

    for (const inv of unencryptedInvestments ?? []) {
      const encrypted = await encryptData(
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
      )
      await migrateInvestment({
        investmentId: inv._id,
        encryptedData: encrypted,
      })
      done++
      setProgress({ done, total })
    }

    toast.success('Migration complete')
    setMigrating(false)
    onOpenChange(false)
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
              {unencryptedInvestments?.length ?? 0} investments).
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
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={migrating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleMigrate}
            disabled={migrating || totalUnencrypted === 0}
          >
            {migrating ? 'Encrypting...' : 'Start migration'}
          </Button>
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

  const decryptConn = useMutation(api.encryptionKeys.decryptConnection)
  const decryptAccount = useMutation(api.encryptionKeys.decryptBankAccount)
  const decryptSnapshot = useMutation(api.encryptionKeys.decryptBalanceSnapshot)
  const decryptInvestment = useMutation(api.encryptionKeys.decryptInvestment)
  const disableEncryption = useMutation(
    api.encryptionKeys.disableWorkspaceEncryption,
  )

  const [disabling, setDisabling] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [confirmText, setConfirmText] = useState('')
  const [copied, setCopied] = useState(false)

  const confirmPhrase = 'disable encryption'
  const isConfirmed = confirmText === confirmPhrase

  async function handleCopy() {
    await navigator.clipboard.writeText(confirmPhrase)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const encryptedConnections =
    allConnections?.filter((c) => c.encryptedData) ?? []
  const encryptedAccounts = allBankAccounts?.filter((a) => a.encryptedData) ?? []
  const encryptedSnapshots = allSnapshots?.filter((s) => s.encryptedData) ?? []
  const encryptedInvestments =
    allInvestments?.filter((inv) => inv.encryptedData) ?? []

  const totalEncrypted =
    encryptedConnections.length +
    encryptedAccounts.length +
    encryptedSnapshots.length +
    encryptedInvestments.length

  async function handleDisable() {
    if (!privateKey || !isConfirmed) return
    setDisabling(true)

    const total = totalEncrypted
    setProgress({ done: 0, total })
    let done = 0

    for (const conn of encryptedConnections) {
      const data = await decryptData(conn.encryptedData!, privateKey)
      await decryptConn({
        connectionId: conn._id,
        connectorName: (data.connectorName as string) ?? 'Unknown',
      })
      done++
      setProgress({ done, total })
    }

    for (const acct of encryptedAccounts) {
      const data = await decryptData(acct.encryptedData!, privateKey)
      await decryptAccount({
        bankAccountId: acct._id,
        name: (data.name as string) ?? 'Unknown',
        balance: (data.balance as number) ?? 0,
        number: (data.number as string) ?? undefined,
        iban: (data.iban as string) ?? undefined,
      })
      done++
      setProgress({ done, total })
    }

    for (const snap of encryptedSnapshots) {
      const data = await decryptData(snap.encryptedData!, privateKey)
      await decryptSnapshot({
        snapshotId: snap._id,
        balance: (data.balance as number) ?? 0,
      })
      done++
      setProgress({ done, total })
    }

    for (const inv of encryptedInvestments) {
      const data = await decryptData(inv.encryptedData!, privateKey)
      await decryptInvestment({
        investmentId: inv._id,
        code: (data.code as string) ?? undefined,
        label: (data.label as string) ?? 'Unknown',
        description: (data.description as string) ?? undefined,
        quantity: (data.quantity as number) ?? 0,
        unitprice: (data.unitprice as number) ?? 0,
        unitvalue: (data.unitvalue as number) ?? 0,
        valuation: (data.valuation as number) ?? 0,
        portfolioShare: (data.portfolioShare as number) ?? undefined,
        diff: (data.diff as number) ?? undefined,
        diffPercent: (data.diffPercent as number) ?? undefined,
      })
      done++
      setProgress({ done, total })
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
              {totalEncrypted === 1 ? 'record' : 'records'} will be
              unprotected. This includes your account balances, IBANs, and
              investment holdings.
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
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={disabling}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDisable}
            disabled={!isConfirmed || disabling}
          >
            {disabling ? 'Decrypting...' : 'Disable encryption'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
