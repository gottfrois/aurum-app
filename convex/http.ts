import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import { encryptForProfile } from './lib/serverCrypto'
import { polar } from './polar'
import type { Id } from './_generated/dataModel'

const http = httpRouter()

// Polar webhook routes (POST /polar/events)
polar.registerRoutes(http)

interface WebhookPayload {
  type?: string | null
  id_user?: number | null
  id?: number | null
  accounts?: Array<WebhookAccount> | null
  connector?: { name?: string | null } | null
  state?: string | null
  last_update?: string | null
}

interface WebhookAccount {
  id: number
  number?: string | null
  iban?: string | null
  balance?: number | null
  original_name?: string | null
  name?: string | null
  type?: string | null
  currency?: { id?: string | null } | null
  disabled?: boolean | null
  deleted?: unknown
  last_update?: string | null
}

http.route({
  path: '/powens/callback',
  method: 'GET',
  // eslint-disable-next-line @typescript-eslint/require-await
  handler: httpAction(async (_, request) => {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connection_id')
    const state = url.searchParams.get('state')

    const siteUrl = process.env.SITE_URL ?? 'http://localhost:3000'

    const params = new URLSearchParams()
    if (connectionId) params.set('connection_id', connectionId)
    if (state) params.set('state', state)

    return new Response(null, {
      status: 302,
      headers: {
        Location: `${siteUrl}/powens/callback?${params.toString()}`,
      },
    })
  }),
})

http.route({
  path: '/powens/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const payload = (await request.json()) as WebhookPayload

    const type = payload.type

    if (type === 'CONNECTION_SYNCED') {
      const powensUserId = payload.id_user
      const powensConnectionId = payload.id
      const accounts = payload.accounts

      if (!powensUserId || !powensConnectionId) {
        return new Response('Missing id_user or id', { status: 400 })
      }

      // Find the profile linked to this Powens user
      const profile = await ctx.runQuery(
        internal.powens.findProfileByPowensUserId,
        { powensUserId },
      )

      if (!profile) {
        console.warn(`No profile found for Powens user ${powensUserId}`)
        return new Response('OK', { status: 200 })
      }

      // Check if encryption is enabled for this profile
      const publicKey: string | null = await ctx.runQuery(
        internal.encryptionKeys.getPublicKeyForProfile,
        { profileId: profile._id },
      )

      const realConnectorName = payload.connector?.name ?? 'Unknown'

      // Step 1: Sync records without encrypted data to get IDs
      const bankAccounts = (accounts ?? []).map((acct) => {
        const number = acct.number ?? undefined
        const iban = acct.iban ?? undefined
        const balance = acct.balance ?? 0
        const name = acct.original_name ?? acct.name ?? 'Unnamed Account'

        return {
          powensBankAccountId: acct.id,
          name: publicKey ? 'Encrypted' : name,
          number: publicKey ? undefined : number,
          iban: publicKey ? undefined : iban,
          type: acct.type ?? undefined,
          balance: publicKey ? 0 : balance,
          currency: acct.currency?.id ?? 'EUR',
          disabled: acct.disabled ?? false,
          deleted: acct.deleted != null,
          lastSync: acct.last_update ?? undefined,
          encryptedData: undefined,
          // Keep original values for encryption
          _rawName: name,
          _rawNumber: number,
          _rawIban: iban,
          _rawBalance: balance,
        }
      })

      // Sync without encrypted data first (get record IDs back)
      const syncResult = (await ctx.runMutation(
        internal.powens.syncConnectionFromWebhook,
        {
          profileId: profile._id,
          powensConnectionId,
          connectorName: publicKey ? 'Encrypted' : realConnectorName,
          state: payload.state ?? undefined,
          lastSync: payload.last_update ?? undefined,
          encryptedData: undefined,
          bankAccounts: bankAccounts.map(
            ({ _rawName, _rawNumber, _rawIban, _rawBalance, ...acct }) => acct,
          ),
        },
      )) as {
        connectionId: Id<'connections'>
        bankAccountIds: Array<{
          powensBankAccountId: number
          id: Id<'bankAccounts'>
        }>
      }

      // Step 2: If encryption enabled, encrypt with AAD using record IDs, then patch
      if (publicKey) {
        // Encrypt connection data with AAD
        const connectionEncryptedData = await encryptForProfile(
          { connectorName: realConnectorName },
          publicKey,
          syncResult.connectionId,
        )
        await ctx.runMutation(
          internal.encryptionKeys.patchConnectionEncryptedData,
          {
            items: [
              {
                id: syncResult.connectionId,
                encryptedData: connectionEncryptedData,
              },
            ],
          },
        )

        // Encrypt bank account data with AAD
        const bankAccountPatches: Array<{
          id: Id<'bankAccounts'>
          encryptedData: string
        }> = []
        const balanceSnapshotPatches: Array<{
          id: Id<'balanceSnapshots'>
          encryptedData: string
        }> = []

        for (const acct of bankAccounts) {
          const idEntry = syncResult.bankAccountIds.find(
            (ba) => ba.powensBankAccountId === acct.powensBankAccountId,
          )
          if (!idEntry) continue

          const encryptedData = await encryptForProfile(
            {
              name: acct._rawName,
              number: acct._rawNumber,
              iban: acct._rawIban,
              balance: acct._rawBalance,
            },
            publicKey,
            idEntry.id,
          )
          bankAccountPatches.push({ id: idEntry.id, encryptedData })
        }

        if (bankAccountPatches.length > 0) {
          await ctx.runMutation(
            internal.encryptionKeys.patchBankAccountEncryptedData,
            { items: bankAccountPatches },
          )
        }

        if (balanceSnapshotPatches.length > 0) {
          await ctx.runMutation(
            internal.encryptionKeys.patchBalanceSnapshotEncryptedData,
            { items: balanceSnapshotPatches },
          )
        }
      }

      await ctx.runAction(internal.powens.syncInvestmentsFromWebhook, {
        profileId: profile._id,
        powensConnectionId,
      })
    }

    return new Response('OK', { status: 200 })
  }),
})

export default http
