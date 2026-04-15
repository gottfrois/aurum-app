import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import * as Sentry from '@sentry/tanstackstart-react'
import { createFileRoute } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { GripVertical, Landmark, Link2, Loader2 } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  ItemCard,
  ItemCardHeader,
  ItemCardHeaderContent,
  ItemCardHeaderTitle,
  ItemCardItem,
  ItemCardItemAction,
  ItemCardItemContent,
  ItemCardItemDescription,
  ItemCardItems,
  ItemCardItemTitle,
} from '~/components/item-card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '~/components/ui/empty'
import { Input } from '~/components/ui/input'
import { PageHeader } from '~/components/ui/page-header'
import { Skeleton } from '~/components/ui/skeleton'
import {
  Sortable,
  SortableItem,
  SortableItemHandle,
} from '~/components/ui/sortable'
import { useEncryption } from '~/contexts/encryption-context'
import { useCachedDecryptRecords } from '~/hooks/use-cached-decrypt'
import { encryptData, importPublicKey } from '~/lib/crypto'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

type DecryptedConnection = Doc<'connections'> & {
  connectorName?: string
}

type DecryptedBankAccount = Doc<'bankAccounts'> & {
  name?: string
  number?: string
  iban?: string
  customName?: string
  connectorName?: string
}

export const Route = createFileRoute(
  '/_settings/settings/portfolios/$id/connections',
)({
  component: PortfolioConnectionsPage,
})

function PortfolioConnectionsPage() {
  const { t } = useTranslation()
  const { id } = Route.useParams()
  const portfolioId = id as Id<'portfolios'>
  const rawConnections = useQuery(api.powens.listConnections, { portfolioId })
  const connections = useCachedDecryptRecords('connections', rawConnections) as
    | DecryptedConnection[]
    | undefined

  const rawBankAccounts = useQuery(api.powens.listBankAccounts, {
    portfolioId,
  })
  const bankAccounts = useCachedDecryptRecords(
    'bankAccounts',
    rawBankAccounts,
  ) as DecryptedBankAccount[] | undefined

  const accountsByConnection = React.useMemo(() => {
    if (!bankAccounts) return new Map<string, DecryptedBankAccount[]>()
    const map = new Map<string, DecryptedBankAccount[]>()
    for (const account of bankAccounts) {
      if (account.deleted) continue
      const list = map.get(account.connectionId) ?? []
      list.push(account)
      map.set(account.connectionId, list)
    }
    return map
  }, [bankAccounts])

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
      <PageHeader
        title={t('settings.portfolioConnections.title')}
        description={t('settings.portfolioConnections.description')}
      />
      <div className="mt-8 space-y-6">
        <ConnectionsList
          connections={connections}
          accountsByConnection={accountsByConnection}
        />
      </div>
    </div>
  )
}

function getConnectionState(
  state: string | null | undefined,
  t: (key: string) => string,
): {
  label: string
  dotColor: string
} {
  switch (state) {
    case null:
    case undefined:
    case 'SyncDone':
      return {
        label: t('settings.connections.statusConnected'),
        dotColor: 'bg-success',
      }
    case 'SCARequired':
    case 'additionalInformationNeeded':
    case 'decoupled':
    case 'webauthRequired':
      return {
        label: t('settings.connections.statusActionNeeded'),
        dotColor: 'bg-warning',
      }
    case 'validating':
      return {
        label: t('settings.connections.statusSyncing'),
        dotColor: 'bg-info',
      }
    case 'wrongpass':
    case 'bug':
      return {
        label: t('settings.connections.statusError'),
        dotColor: 'bg-destructive',
      }
    case 'rateLimiting':
      return {
        label: t('settings.connections.statusRateLimited'),
        dotColor: 'bg-warning',
      }
    default:
      return {
        label: t('settings.connections.statusUnknown'),
        dotColor: 'bg-muted-foreground',
      }
  }
}

function formatAccountType(
  type: string | null | undefined,
  t: (key: string) => string,
): string {
  switch (type) {
    case 'checking':
      return t('accountTypes.checking')
    case 'card':
      return t('accountTypes.card')
    case 'savings':
      return t('accountTypes.savings')
    case 'livret_a':
      return t('accountTypes.livret_a')
    case 'ldds':
      return t('accountTypes.ldds')
    case 'market':
      return t('accountTypes.market')
    case 'pea':
      return t('accountTypes.pea')
    case 'pee':
      return t('accountTypes.pee')
    case 'lifeinsurance':
      return t('accountTypes.lifeinsurance')
    case 'per':
      return t('accountTypes.per')
    case 'perco':
      return t('accountTypes.perco')
    case 'perp':
      return t('accountTypes.perp')
    case 'madelin':
      return t('accountTypes.madelin')
    case 'article83':
      return t('accountTypes.article83')
    default:
      return type ?? t('accountTypes.account')
  }
}

function ConnectionsList({
  connections,
  accountsByConnection,
}: {
  connections: DecryptedConnection[] | undefined
  accountsByConnection: Map<string, DecryptedBankAccount[]>
}) {
  const { t } = useTranslation()
  if (connections === undefined) {
    return <Skeleton className="h-48 w-full rounded-lg" />
  }

  if (connections.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Link2 />
          </EmptyMedia>
          <EmptyTitle>{t('settings.portfolioConnections.empty')}</EmptyTitle>
          <EmptyDescription>
            {t('settings.portfolioConnections.emptyDescription')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="space-y-6">
      {connections.map((connection) => (
        <ConnectionCard
          key={connection._id}
          connection={connection}
          accounts={accountsByConnection.get(connection._id) ?? []}
        />
      ))}
    </div>
  )
}

function ConnectionCard({
  connection,
  accounts,
}: {
  connection: DecryptedConnection
  accounts: DecryptedBankAccount[]
}) {
  const { t } = useTranslation()
  const generateManageUrl = useAction(api.powens.generateManageUrl)
  const reorderBankAccounts = useMutation(api.powens.reorderBankAccounts)
  const [editing, setEditing] = React.useState(false)
  const { label, dotColor } = getConnectionState(connection.state, t)

  const [localAccounts, setLocalAccounts] = React.useState<
    DecryptedBankAccount[] | null
  >(null)
  const pendingReorder = React.useRef(false)

  React.useEffect(() => {
    if (!pendingReorder.current) {
      setLocalAccounts(accounts)
    }
  }, [accounts])

  const sortedAccounts = React.useMemo(() => {
    const source = localAccounts ?? accounts
    return [...source].sort((a, b) => {
      const ao = a.sortOrder ?? Number.POSITIVE_INFINITY
      const bo = b.sortOrder ?? Number.POSITIVE_INFINITY
      if (ao !== bo) return ao - bo
      return a._creationTime - b._creationTime
    })
  }, [localAccounts, accounts])

  async function handleManage() {
    setEditing(true)
    try {
      const url = await generateManageUrl({
        connectionId: connection._id,
        portfolioId: connection.portfolioId,
      })
      window.location.href = url
    } catch (err) {
      Sentry.captureException(err)
      toast.error(t('toast.failedManageConnection'))
      setEditing(false)
    }
  }

  const handleReorder = (reordered: DecryptedBankAccount[]) => {
    pendingReorder.current = true
    const orderedIds = reordered.map((a) => a._id)
    const sortOrderMap = new Map(orderedIds.map((id, i) => [id, i]))
    const base = localAccounts ?? accounts
    const next = base.map((a) =>
      sortOrderMap.has(a._id)
        ? { ...a, sortOrder: sortOrderMap.get(a._id) }
        : a,
    )
    setLocalAccounts(next)

    reorderBankAccounts({ orderedBankAccountIds: orderedIds })
      .catch((error) => {
        Sentry.captureException(error)
        toast.error(t('toast.failedReorderAccounts'))
        setLocalAccounts(accounts)
      })
      .finally(() => {
        pendingReorder.current = false
      })
  }

  return (
    <ItemCard>
      <ItemCardHeader>
        <ItemCardHeaderContent>
          <ItemCardHeaderTitle>
            <div className="flex items-center gap-2">
              {connection.connectorName ??
                t('settings.portfolioConnections.connectionNumber', {
                  id: connection.powensConnectionId,
                })}
              <div className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                <span className={`size-2 rounded-full ${dotColor}`} />
                {label}
              </div>
            </div>
          </ItemCardHeaderTitle>
        </ItemCardHeaderContent>
        <Button
          variant="ghost"
          size="sm"
          disabled={editing}
          onClick={handleManage}
        >
          {editing && <Loader2 className="animate-spin" />}
          {t('settings.connections.manage')}
        </Button>
      </ItemCardHeader>
      <ItemCardItems>
        {sortedAccounts.length === 0 ? (
          <ItemCardItem>
            <ItemCardItemContent>
              <ItemCardItemDescription>
                {t('settings.portfolioConnections.noAccounts')}
              </ItemCardItemDescription>
            </ItemCardItemContent>
          </ItemCardItem>
        ) : (
          <Sortable
            value={sortedAccounts}
            onValueChange={handleReorder}
            getItemValue={(a) => a._id}
            modifiers={[restrictToVerticalAxis]}
          >
            {sortedAccounts.map((account) => (
              <SortableItem key={account._id} value={account._id}>
                <BankAccountItem account={account} />
              </SortableItem>
            ))}
          </Sortable>
        )}
      </ItemCardItems>
    </ItemCard>
  )
}

function BankAccountItem({ account }: { account: DecryptedBankAccount }) {
  const { t } = useTranslation()
  const { workspacePublicKey } = useEncryption()
  const updateCustomName = useMutation(api.powens.updateBankAccountCustomName)
  const originalName =
    account.connectorName ?? account.name ?? t('accountTypes.account')
  const [inputValue, setInputValue] = React.useState(account.customName ?? '')
  const [saving, setSaving] = React.useState(false)

  // Sync input when decrypted customName changes (e.g., after initial decryption)
  const prevCustomName = React.useRef(account.customName)
  React.useEffect(() => {
    if (account.customName !== prevCustomName.current) {
      setInputValue(account.customName ?? '')
      prevCustomName.current = account.customName
    }
  }, [account.customName])

  const identifier = account.iban
    ? account.iban.replace(/(.{4})/g, '$1 ').trim()
    : account.number

  async function handleBlur() {
    const trimmed = inputValue.trim()
    const currentCustomName = account.customName ?? ''

    if (trimmed === currentCustomName) return

    setSaving(true)
    try {
      if (!trimmed) {
        // Clear custom name
        await updateCustomName({
          bankAccountId: account._id,
          encryptedCustomName: undefined,
        })
        toast.success(t('toast.customNameCleared'))
      } else {
        if (!workspacePublicKey)
          throw new Error(t('settings.portfolioConnections.vaultNotUnlocked'))
        const pubKey = await importPublicKey(workspacePublicKey)
        const encryptedCustomName = await encryptData(
          { customName: trimmed },
          pubKey,
          account._id,
          'encryptedCustomName',
        )
        await updateCustomName({
          bankAccountId: account._id,
          encryptedCustomName,
        })
        toast.success(t('toast.customNameUpdated'))
      }
    } catch (error) {
      Sentry.captureException(error)
      setInputValue(account.customName ?? '')
      toast.error(t('toast.failedUpdateCustomName'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ItemCardItem className="gap-3">
      <div className="flex shrink-0 items-center gap-1.5">
        <SortableItemHandle className="flex items-center text-muted-foreground/60 hover:text-muted-foreground">
          <GripVertical className="size-4" />
        </SortableItemHandle>
        <div className="flex size-8 items-center justify-center rounded-sm border bg-muted text-muted-foreground">
          <Landmark className="size-4" />
        </div>
      </div>
      <ItemCardItemContent className="min-w-0 flex-1">
        <ItemCardItemTitle className="min-w-0">
          <span className="truncate">{originalName}</span>
          <Badge variant="outline" className="shrink-0 font-normal">
            {formatAccountType(account.type, t)}
          </Badge>
        </ItemCardItemTitle>
        {identifier && (
          <ItemCardItemDescription className="truncate">
            {identifier}
          </ItemCardItemDescription>
        )}
      </ItemCardItemContent>
      <ItemCardItemAction>
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          disabled={saving}
          placeholder={t('settings.portfolioConnections.customNamePlaceholder')}
          className="h-8 w-72 text-sm"
        />
      </ItemCardItemAction>
    </ItemCardItem>
  )
}
