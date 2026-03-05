import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { AppSidebar } from '~/components/app-sidebar'
import { SiteHeader } from '~/components/site-header'
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar'
import { useAccount } from '~/contexts/account-context'
import { Landmark, CirclePlus } from 'lucide-react'
import { AddConnectionDialog } from '~/components/add-connection-dialog'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

function Dashboard() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
            <BankAccountsSection />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function BankAccountsSection() {
  const { activeAccountId, isLoading: accountLoading } = useAccount()
  const bankAccounts = useQuery(
    api.powens.listBankAccounts,
    activeAccountId ? { accountId: activeAccountId } : 'skip',
  )
  const [dialogOpen, setDialogOpen] = React.useState(false)

  if (accountLoading || bankAccounts === undefined) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (bankAccounts.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <Landmark className="size-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">No bank accounts yet</h3>
            <p className="text-sm text-muted-foreground">
              Connect your first bank to start tracking your finances.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <CirclePlus className="mr-2 size-4" />
            Connect a Bank
          </Button>
        </div>
        <AddConnectionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Bank Accounts</h2>
        <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          <CirclePlus className="mr-2 size-4" />
          Add Connection
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {bankAccounts
          .filter((a) => !a.deleted && !a.disabled)
          .map((account) => (
            <Card key={account._id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {account.name}
                </CardTitle>
                <span className="text-xs text-muted-foreground uppercase">
                  {account.type}
                </span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: account.currency,
                  }).format(account.balance)}
                </div>
                {account.iban && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {account.iban.replace(/(.{4})/g, '$1 ').trim()}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
      </div>
      <AddConnectionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
