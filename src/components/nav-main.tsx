import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { CirclePlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { AddConnectionDialog } from '~/components/add-connection-dialog'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '~/components/ui/sidebar'

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
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton tooltip={item.title} asChild>
                <Link to={item.url}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
      <AddConnectionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </SidebarGroup>
  )
}
