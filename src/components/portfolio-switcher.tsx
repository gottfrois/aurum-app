import { Link } from '@tanstack/react-router'
import { ChevronsUpDown, Layers, Plus, Settings, Users } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
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
import { useBilling } from '~/contexts/billing-context'
import { usePortfolio } from '~/contexts/portfolio-context'

export function PortfolioSwitcher() {
  const { t } = useTranslation()
  const { isMobile } = useSidebar()
  const {
    portfolios,
    activePortfolio,
    setActivePortfolioId,
    isLoading,
    isTeamView,
  } = usePortfolio()
  const { subscription } = useBilling()
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const showTeamOption = subscription?.plan === 'team' && subscription?.isActive

  if (isLoading || portfolios === undefined) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex h-12 items-center gap-2 px-2 py-2">
            <Skeleton className="size-8 shrink-0 rounded-lg" />
            <Skeleton className="h-4 flex-1" />
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (portfolios.length === 0) {
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
                {t('portfolio.addPortfolio')}
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <CreatePortfolioDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </SidebarMenu>
    )
  }

  const activeLabel = isTeamView
    ? t('portfolio.team')
    : activePortfolio
      ? activePortfolio.name
      : t('portfolio.allMyPortfolios')

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
                ) : isTeamView ? (
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Users className="size-4" />
                  </div>
                ) : (
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Layers className="size-4" />
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
                {t('portfolio.portfoliosLabel')}
              </DropdownMenuLabel>
              {showTeamOption && (
                <DropdownMenuItem
                  onClick={() => setActivePortfolioId('team')}
                  className="gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-sm border">
                    <Users className="size-4 shrink-0" />
                  </div>
                  {t('portfolio.team')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => setActivePortfolioId('all')}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  <Layers className="size-4 shrink-0" />
                </div>
                {t('portfolio.allMyPortfolios')}
              </DropdownMenuItem>
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
                  {t('portfolio.addPortfolio')}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 p-2" asChild>
                <Link to="/portfolios">
                  <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <Settings className="size-4" />
                  </div>
                  <span className="font-medium text-muted-foreground">
                    {t('portfolio.managePortfolios')}
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
