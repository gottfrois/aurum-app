import * as Sentry from '@sentry/tanstackstart-react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Link2 } from 'lucide-react'
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

  const rawBankAccounts = useQuery(api.powens.listBankAccounts, { portfolioId })
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
        dotColor: 'bg-emerald-500',
      }
    case 'SCARequired':
    case 'additionalInformationNeeded':
    case 'decoupled':
    case 'webauthRequired':
      return {
        label: t('settings.connections.statusActionNeeded'),
        dotColor: 'bg-amber-500',
      }
    case 'validating':
      return {
        label: t('settings.connections.statusSyncing'),
        dotColor: 'bg-blue-500',
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
        dotColor: 'bg-amber-500',
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
    case 'savings':
      return t('accountTypes.savings')
    case 'market':
    case 'pea':
    case 'pee':
      return t('accountTypes.investment')
    case 'life_insurance':
      return t('accountTypes.insurance')
    case 'card':
      return t('accountTypes.card')
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
      {connections.map((connection) => {
        const { label, dotColor } = getConnectionState(connection.state, t)
        const accounts = accountsByConnection.get(connection._id) ?? []
        return (
          <ItemCard key={connection._id}>
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
            </ItemCardHeader>
            <ItemCardItems>
              {accounts.length === 0 ? (
                <ItemCardItem>
                  <ItemCardItemContent>
                    <ItemCardItemDescription>
                      {t('settings.portfolioConnections.noAccounts')}
                    </ItemCardItemDescription>
                  </ItemCardItemContent>
                </ItemCardItem>
              ) : (
                accounts.map((account) => (
                  <BankAccountItem key={account._id} account={account} />
                ))
              )}
            </ItemCardItems>
          </ItemCard>
        )
      })}
    </div>
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
    <ItemCardItem>
      <ItemCardItemContent>
        <ItemCardItemTitle>
          <div className="flex items-center gap-2">
            {originalName}
            <Badge variant="outline" className="font-normal">
              {formatAccountType(account.type, t)}
            </Badge>
          </div>
        </ItemCardItemTitle>
        {identifier && (
          <ItemCardItemDescription>{identifier}</ItemCardItemDescription>
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
          className="h-8 w-48 text-sm"
        />
      </ItemCardItemAction>
    </ItemCardItem>
  )
}
