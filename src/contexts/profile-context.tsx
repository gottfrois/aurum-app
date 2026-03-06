import * as React from 'react'
import { useConvexAuth, useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id, Doc } from '../../convex/_generated/dataModel'

type ActiveProfileId = Id<'profiles'> | 'all' | null

interface ProfileContextValue {
  profiles: Doc<'profiles'>[] | undefined
  activeProfileId: ActiveProfileId
  activeProfile: Doc<'profiles'> | undefined
  setActiveProfileId: (id: Id<'profiles'> | 'all') => void
  isAllProfiles: boolean
  allProfileIds: Id<'profiles'>[]
  /** activeProfileId when a single profile is selected, null otherwise */
  singleProfileId: Id<'profiles'> | null
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
    React.useState<ActiveProfileId>(null)
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
    if (stored === 'all') {
      setActiveProfileIdState('all')
    } else if (stored && profiles.some((p) => p._id === stored)) {
      setActiveProfileIdState(stored as Id<'profiles'>)
    } else {
      setActiveProfileIdState(profiles[0]._id)
    }
  }, [profiles])

  const setActiveProfileId = React.useCallback((id: Id<'profiles'> | 'all') => {
    setActiveProfileIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }, [])

  const isAllProfiles = activeProfileId === 'all'
  const singleProfileId: Id<'profiles'> | null =
    activeProfileId && activeProfileId !== 'all' ? activeProfileId : null
  const activeProfile = isAllProfiles
    ? undefined
    : profiles?.find((p) => p._id === activeProfileId)

  const allProfileIds = React.useMemo(
    () => profiles?.map((p) => p._id) ?? [],
    [profiles],
  )

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
        isAllProfiles,
        allProfileIds,
        singleProfileId,
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
