import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronsUpDown, Plus, Settings, Users } from 'lucide-react'
import { useProfile } from '~/contexts/profile-context'
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
import { ProfileAvatar } from '~/components/profile-avatar'
import { CreateProfileDialog } from '~/components/create-profile-dialog'

export function ProfileSwitcher() {
  const { isMobile } = useSidebar()
  const { profiles, activeProfile, setActiveProfileId, isLoading } =
    useProfile()
  const [dialogOpen, setDialogOpen] = React.useState(false)

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

  const isAllProfiles = !activeProfile && profiles && profiles.length > 0
  const activeLabel = isAllProfiles
    ? 'All Profiles'
    : (activeProfile?.name ?? 'Select Profile')

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
                {isAllProfiles ? (
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Users className="size-4" />
                  </div>
                ) : activeProfile ? (
                  <ProfileAvatar
                    name={activeProfile.name}
                    className="aspect-square size-8"
                  />
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
                Profiles
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setActiveProfileId('all')}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  <Users className="size-4 shrink-0" />
                </div>
                All Profiles
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {profiles?.map((profile) => (
                <DropdownMenuItem
                  key={profile._id}
                  onClick={() => setActiveProfileId(profile._id)}
                  className="gap-2 p-2"
                >
                  <ProfileAvatar name={profile.name} className="size-6" />
                  {profile.name}
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
                  Add profile
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 p-2" asChild>
                <Link to="/profiles">
                  <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <Settings className="size-4" />
                  </div>
                  <span className="font-medium text-muted-foreground">
                    Manage profiles
                  </span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <CreateProfileDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
