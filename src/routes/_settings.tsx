import { createFileRoute, Outlet } from '@tanstack/react-router'
import { CommandPalette } from '~/components/command-palette'
import { CommonCommands } from '~/components/common-commands'
import { SettingsSidebar } from '~/components/settings-sidebar'
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar'
import { CommandProvider } from '~/contexts/command-context'

export const Route = createFileRoute('/_settings')({
  component: SettingsLayout,
})

function SettingsLayout() {
  return (
    <CommandProvider>
      <SidebarProvider className="!h-svh !min-h-0">
        <CommonCommands />
        <SettingsSidebar variant="inset" />
        <SidebarInset className="overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <Outlet />
          </div>
        </SidebarInset>
        <CommandPalette />
      </SidebarProvider>
    </CommandProvider>
  )
}
