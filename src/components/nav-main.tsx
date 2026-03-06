import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { CirclePlus, ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

import { useProfile } from '~/contexts/profile-context'
import { AddConnectionDialog } from '~/components/add-connection-dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '~/components/ui/sidebar'
import { ACCOUNT_CATEGORIES, getCategoryKey } from '~/lib/account-categories'

export function NavMain({
  items,
}: {
  items: Array<{
    title: string
    url: string
    icon?: LucideIcon
  }>
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const { isAllProfiles, allProfileIds, singleProfileId } = useProfile()
  const bankAccountsSingle = useQuery(
    api.powens.listBankAccounts,
    singleProfileId ? { profileId: singleProfileId } : 'skip',
  )
  const bankAccountsAll = useQuery(
    api.powens.listAllBankAccounts,
    isAllProfiles && allProfileIds.length > 0
      ? { profileIds: allProfileIds }
      : 'skip',
  )
  const bankAccounts = isAllProfiles ? bankAccountsAll : bankAccountsSingle

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

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              tooltip="Add Connection"
              className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
              onClick={() => setDialogOpen(true)}
            >
              <CirclePlus />
              <span>Add Connection</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) =>
            item.title === 'Accounts' && activeCategories.length > 0 ? (
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
                              <span>{cat.label}</span>
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
              </SidebarMenuItem>
            ),
          )}
        </SidebarMenu>
      </SidebarGroupContent>
      <AddConnectionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </SidebarGroup>
  )
}
