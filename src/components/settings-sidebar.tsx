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
                <span>Back to app</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/settings/account">
                    <Palette />
                    <span>Preferences</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/settings/account/profile">
                    <User />
                    <span>Profile</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/settings/account/security">
                    <Shield />
                    <span>Security & access</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/settings/account/encryption">
                    <Lock />
                    <span>Encryption</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/settings/account/notifications">
                    <Bell />
                    <span>Notifications</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/settings/account/connections">
                    <Link2 />
                    <span>Connections</span>
                  </Link>
                </SidebarMenuButton>
                {connectionIssueCount > 0 && (
                  <SidebarMenuBadge className="bg-destructive text-destructive-foreground">
                    {connectionIssueCount}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isOwner && (
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/settings/workspace">
                      <Settings />
                      <span>General</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/settings/workspace/members">
                      <Users />
                      <span>Members</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/settings/workspace/team">
                      <SquareUserRound />
                      <span>Team</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/settings/workspace/permissions">
                      <ShieldCheck />
                      <span>Permissions</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/settings/workspace/billing">
                      <CreditCard />
                      <span>Billing</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/settings/workspace/categories">
                      <Tag />
                      <span>Categories</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/settings/workspace/labels">
                      <Sticker />
                      <span>Labels</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/settings/workspace/rules">
                      <Workflow />
                      <span>Rules</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/settings/workspace/agent">
                      <Sparkles />
                      <span>AI & Agents</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {portfolios && portfolios.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Your portfolios</SidebarGroupLabel>
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
