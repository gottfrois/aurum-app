import { Navigate } from '@tanstack/react-router'
import { useEncryption } from '~/contexts/encryption-context'

export function RequireOwner({ children }: { children: React.ReactNode }) {
  const { role } = useEncryption()

  if (role === null) return null
  if (role !== 'owner') return <Navigate to="/settings" />

  return children
}
