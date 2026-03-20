import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_settings/settings/portfolios/$id')({
  component: PortfolioSettingsLayout,
})

function PortfolioSettingsLayout() {
  return <Outlet />
}
