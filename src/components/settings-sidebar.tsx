import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  CreditCard,
  Link2,
  Lock,
  Palette,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  SquareUserRound,
  Sticker,
  Tag,
  User,
  Users,
  Workflow,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PortfolioAvatar } from '~/components/portfolio-avatar'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '~/components/ui/sidebar'
import { useEncryption } from '~/contexts/encryption-context'
import { useConnectionsNeedingAttention } from '~/hooks/use-connections-needing-attention'
import { api } from '../../convex/_generated/api'

export function SettingsSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation()
  const { count: connectionIssueCount } = useConnectionsNeedingAttention()
  const { role } = useEncryption()
  const isOwner = role === 'owner'
  const portfolios = useQuery(api.portfolios.listPortfolios)

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/">
                <ArrowLeft />
                <span>{t('nav.backToApp')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('settings.nav.account')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/settings/account">
                    <Palette />
                    <span>{t('settings.nav.preferences')}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/settings/account/profile">
                    <User />
                    <span>{t('settings.nav.profile')}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/settings/account/security">
                    <Shield />
                    <span>{t('settings.nav.security')}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/settings/account/encryption">
                    <Lock />
                    <span>{t('settings.nav.encryption')}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/settings/account/notifications">
                    <Bell />
                    <span>{t('settings.nav.notifications')}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/settings/account/connections">
                    <Link2 />
                    <span>{t('settings.nav.connections')}</span>
                  </Link>
                </SidebarMenuButton>
                {connectionIssueCount > 0 && (
                  <SidebarMenuBadge className="bg-warning text-warning-foreground peer-hover/menu-button:text-warning-foreground peer-data-[active=true]/menu-button:text-warning-foreground">
                    {connectionIssueCount}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isOwner && (
          <SidebarGroup>
            <SidebarGroupLabel>{t('settings.nav.workspace')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/settings/workspace">
                      <Settings />
                      <span>{t('settings.nav.general')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/settings/workspace/members">
                      <Users />
                      <span>{t('settings.nav.members')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/settings/workspace/team">
                      <SquareUserRound />
                      <span>{t('settings.nav.team')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/settings/workspace/permissions">
                      <ShieldCheck />
                      <span>{t('settings.nav.permissions')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/settings/workspace/billing">
                      <CreditCard />
                      <span>{t('settings.nav.billing')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/settings/workspace/categories">
                      <Tag />
                      <span>{t('settings.nav.categories')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/settings/workspace/labels">
                      <Sticker />
                      <span>{t('settings.nav.labels')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/settings/workspace/rules">
                      <Workflow />
                      <span>{t('settings.nav.rules')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/settings/workspace/agent">
                      <Sparkles />
                      <span>{t('settings.nav.agent')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {portfolios && portfolios.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              {t('settings.nav.yourPortfolios')}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {portfolios.map((portfolio) => (
                  <SidebarMenuItem key={portfolio._id}>
                    <SidebarMenuButton asChild>
                      <Link
                        to="/settings/portfolios/$id"
                        params={{ id: portfolio._id }}
                      >
                        <PortfolioAvatar
                          name={portfolio.name}
                          className="size-5"
                        />
                        <span className="flex-1">{portfolio.name}</span>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  )
}
