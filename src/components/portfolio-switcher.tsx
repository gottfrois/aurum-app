import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ChevronsUpDown, Home, Plus, Settings, Users } from 'lucide-react'
import * as React from 'react'
import { CreatePortfolioDialog } from '~/components/create-portfolio-dialog'
import { PortfolioAvatar } from '~/components/portfolio-avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '~/components/ui/sidebar'
import { Skeleton } from '~/components/ui/skeleton'
import { usePortfolio } from '~/contexts/portfolio-context'
import { api } from '../../convex/_generated/api'

export function PortfolioSwitcher() {
  const { isMobile } = useSidebar()
  const {
    portfolios,
    activePortfolio,
    setActivePortfolioId,
    isLoading,
    isFamilyView,
  } = usePortfolio()
  const subscription = useQuery(api.billing.getSubscriptionStatus)
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const showFamilyOption =
    subscription?.plan === 'family' && subscription?.isActive

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex items-center gap-2 px-2 py-2">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-4 w-24" />
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!portfolios || portfolios.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            onClick={() => setDialogOpen(true)}
            className="gap-2"
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg border bg-background">
              <Plus className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold text-muted-foreground">
                Add portfolio
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <CreatePortfolioDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </SidebarMenu>
    )
  }

  const activeLabel = isFamilyView
    ? 'Family'
    : activePortfolio
      ? activePortfolio.name
      : 'All Portfolios'

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                {activePortfolio ? (
                  <PortfolioAvatar
                    name={activePortfolio.name}
                    className="aspect-square size-8"
                  />
                ) : isFamilyView ? (
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Home className="size-4" />
                  </div>
                ) : (
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Users className="size-4" />
                  </div>
                )}
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{activeLabel}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? 'bottom' : 'right'}
              align="start"
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Portfolios
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setActivePortfolioId('all')}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  <Users className="size-4 shrink-0" />
                </div>
                All Portfolios
              </DropdownMenuItem>
              {showFamilyOption && (
                <DropdownMenuItem
                  onClick={() => setActivePortfolioId('family')}
                  className="gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-sm border">
                    <Home className="size-4 shrink-0" />
                  </div>
                  Family
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {portfolios.map((portfolio) => (
                <DropdownMenuItem
                  key={portfolio._id}
                  onClick={() => setActivePortfolioId(portfolio._id)}
                  className="gap-2 p-2"
                >
                  <PortfolioAvatar name={portfolio.name} className="size-6" />
                  {portfolio.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 p-2"
                onClick={() => setDialogOpen(true)}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                  <Plus className="size-4" />
                </div>
                <span className="font-medium text-muted-foreground">
                  Add portfolio
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 p-2" asChild>
                <Link to="/portfolios">
                  <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <Settings className="size-4" />
                  </div>
                  <span className="font-medium text-muted-foreground">
                    Manage portfolios
                  </span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <CreatePortfolioDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
