import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight, CirclePlus } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import { HotkeyDisplay } from '~/components/ui/kbd'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '~/components/ui/sidebar'
import { useCommandRegistry } from '~/contexts/command-context'
import { usePortfolio } from '~/contexts/portfolio-context'
import {
  ACCOUNT_CATEGORIES,
  getAccountCategoryLabel,
  getCategoryKey,
} from '~/lib/account-categories'
import { api } from '../../convex/_generated/api'

const CONNECTION_ALERT_STATES = new Set([
  'SCARequired',
  'additionalInformationNeeded',
  'decoupled',
  'wrongpass',
  'bug',
])

export function NavMain({
  items,
}: {
  items: Array<{
    title: string
    url: string
    icon?: LucideIcon
  }>
}) {
  const { t } = useTranslation()
  const { commands } = useCommandRegistry()
  const addConnectionCommand = commands.find((c) => c.id === 'connection.add')
  const { isAllPortfolios, isTeamView, allPortfolioIds, singlePortfolioId } =
    usePortfolio()
  const bankAccountsSingle = useQuery(
    api.powens.listBankAccounts,
    singlePortfolioId ? { portfolioId: singlePortfolioId } : 'skip',
  )
  const bankAccountsAll = useQuery(
    api.powens.listAllBankAccounts,
    isAllPortfolios && allPortfolioIds.length > 0
      ? { portfolioIds: allPortfolioIds }
      : 'skip',
  )
  const bankAccounts = isAllPortfolios ? bankAccountsAll : bankAccountsSingle

  const connectionsSingle = useQuery(
    api.powens.listConnections,
    singlePortfolioId ? { portfolioId: singlePortfolioId } : 'skip',
  )
  const connectionsAll = useQuery(
    api.powens.listAllConnections,
    isAllPortfolios && allPortfolioIds.length > 0
      ? { portfolioIds: allPortfolioIds }
      : 'skip',
  )
  const connections = isAllPortfolios ? connectionsAll : connectionsSingle

  const hasConnectionAlert = React.useMemo(
    () =>
      connections?.some((c) => CONNECTION_ALERT_STATES.has(c.state ?? '')) ??
      false,
    [connections],
  )

  const activeCategories = React.useMemo(() => {
    if (!bankAccounts) return []
    const found = new Set<string>()
    for (const acct of bankAccounts) {
      if (!acct.deleted && !acct.disabled) {
        found.add(getCategoryKey(acct.type))
      }
    }
    return Object.entries(ACCOUNT_CATEGORIES)
      .filter(([key]) => found.has(key))
      .map(([key, cat]) => ({ key, ...cat }))
  }, [bankAccounts])

  const [isConnecting, setIsConnecting] = React.useState(false)

  const handleAddConnection = async () => {
    setIsConnecting(true)
    try {
      await addConnectionCommand?.handler()
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        {!isTeamView && !isAllPortfolios && (
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center gap-2">
              <SidebarMenuButton
                tooltip={t('nav.addConnection')}
                className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleAddConnection}
                disabled={isConnecting}
              >
                <CirclePlus className={isConnecting ? 'animate-spin' : ''} />
                <span>
                  {isConnecting ? t('nav.connecting') : t('nav.addConnection')}
                </span>
                <HotkeyDisplay className="ml-auto" hotkey={{ keys: 'c' }} />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
        <SidebarMenu>
          {items.map((item) =>
            item.url === '/accounts' && activeCategories.length > 0 ? (
              <Collapsible
                key={item.title}
                defaultOpen
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip={item.title} asChild>
                    <Link to="/accounts" search={{}}>
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuAction className="data-[state=open]:rotate-90">
                      <ChevronRight />
                    </SidebarMenuAction>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {activeCategories.map((cat) => (
                        <SidebarMenuSubItem key={cat.key}>
                          <SidebarMenuSubButton asChild>
                            <Link to="/accounts" search={{ type: cat.key }}>
                              <cat.icon className="size-4" />
                              <span>{getAccountCategoryLabel(cat.key, t)}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ) : (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton tooltip={item.title} asChild>
                  <Link to={item.url}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
                {item.title === 'Connections' && hasConnectionAlert && (
                  <SidebarMenuBadge>
                    <span className="size-2 rounded-full bg-destructive animate-pulse" />
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            ),
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
