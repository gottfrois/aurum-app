import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/_settings/settings/')({
  component: () => <Navigate to="/settings/account" />,
})
