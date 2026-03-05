import * as React from 'react'
import { useConvexAuth, useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id, Doc } from '../../convex/_generated/dataModel'

interface ProfileContextValue {
  profiles: Doc<'profiles'>[] | undefined
  activeProfileId: Id<'profiles'> | null
  activeProfile: Doc<'profiles'> | undefined
  setActiveProfileId: (id: Id<'profiles'>) => void
  isLoading: boolean
}

const ProfileContext = React.createContext<ProfileContextValue | null>(null)

const STORAGE_KEY = 'aurum-active-profile-id'

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()
  const profiles = useQuery(
    api.profiles.listProfiles,
    isAuthenticated ? {} : 'skip',
  )
  const ensureWorkspace = useMutation(api.workspaces.ensureWorkspace)
  const [activeProfileId, setActiveProfileIdState] =
    React.useState<Id<'profiles'> | null>(null)
  const bootstrapping = React.useRef(false)

  // Bootstrap workspace once Convex auth is ready and we see no profiles
  React.useEffect(() => {
    if (!isAuthenticated) return
    if (profiles === undefined) return
    if (profiles.length > 0) return
    if (bootstrapping.current) return

    bootstrapping.current = true
    ensureWorkspace()
      .catch(() => {
        bootstrapping.current = false
      })
  }, [isAuthenticated, profiles, ensureWorkspace])

  // Set initial active profile from localStorage or first profile
  React.useEffect(() => {
    if (!profiles || profiles.length === 0) return

    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && profiles.some((p) => p._id === stored)) {
      setActiveProfileIdState(stored as Id<'profiles'>)
    } else {
      setActiveProfileIdState(profiles[0]._id)
    }
  }, [profiles])

  const setActiveProfileId = React.useCallback((id: Id<'profiles'>) => {
    setActiveProfileIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }, [])

  const activeProfile = profiles?.find((p) => p._id === activeProfileId)

  const isLoading =
    isAuthLoading || (isAuthenticated && (!profiles || profiles.length === 0))

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        activeProfileId,
        activeProfile,
        setActiveProfileId,
        isLoading,
      }}
    >
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = React.useContext(ProfileContext)
  if (!ctx) {
    throw new Error('useProfile must be used within a ProfileProvider')
  }
  return ctx
}
