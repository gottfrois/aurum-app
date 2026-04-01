import { Link } from '@tanstack/react-router'
import {
  ArrowLeftRight,
  Keyboard,
  Landmark,
  Layers,
  LayoutDashboard,
  Settings,
} from 'lucide-react'
import type * as React from 'react'
import { useTranslation } from 'react-i18next'
import { NavFavorites } from '~/components/nav-favorites'
import { NavMain } from '~/components/nav-main'
import { NavUser } from '~/components/nav-user'
import { PortfolioSwitcher } from '~/components/portfolio-switcher'
import { HotkeyDisplay, Kbd } from '~/components/ui/kbd'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '~/components/ui/sidebar'
import { useCommandRegistry } from '~/contexts/command-context'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation()
  const { commands } = useCommandRegistry()
  const shortcutsCommand = commands.find((c) => c.id === 'shortcuts.show')

  const navMain = [
    {
      title: t('nav.dashboard'),
      url: '/',
      icon: LayoutDashboard,
    },
    {
      title: t('nav.transactions'),
      url: '/transactions',
      icon: ArrowLeftRight,
    },
    {
      title: t('nav.views'),
      url: '/views',
      icon: Layers,
    },
    {
      title: t('nav.accounts'),
      url: '/accounts',
      icon: Landmark,
    },
  ]

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <PortfolioSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavFavorites />
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {shortcutsCommand && (
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={shortcutsCommand.handler}>
                    <Keyboard />
                    <span>{t('nav.shortcuts')}</span>
                    <Kbd className="ml-auto">?</Kbd>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/settings">
                    <Settings />
                    <span>{t('nav.settings')}</span>
                    <HotkeyDisplay
                      hotkey={{ keys: 'g+s' }}
                      className="ml-auto"
                    />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
