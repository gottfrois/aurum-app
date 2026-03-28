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

const navMain = [
  {
    title: 'Dashboard',
    url: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Transactions',
    url: '/transactions',
    icon: ArrowLeftRight,
  },
  {
    title: 'Views',
    url: '/views',
    icon: Layers,
  },
  {
    title: 'Accounts',
    url: '/accounts',
    icon: Landmark,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { commands } = useCommandRegistry()
  const shortcutsCommand = commands.find((c) => c.id === 'shortcuts.show')

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
                    <span>Shortcuts</span>
                    <Kbd className="ml-auto">?</Kbd>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/settings">
                    <Settings />
                    <span>Settings</span>
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
