import { createFileRoute, Outlet } from '@tanstack/react-router'
import { SettingsSidebar } from '~/components/settings-sidebar'
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar'

export const Route = createFileRoute('/_settings')({
  component: SettingsLayout,
})

function SettingsLayout() {
  return (
    <SidebarProvider>
      <SettingsSidebar variant="inset" />
      <SidebarInset>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
