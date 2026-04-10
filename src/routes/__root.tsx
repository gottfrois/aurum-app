import '~/lib/i18n'

import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import type { ConvexQueryClient } from '@convex-dev/react-query'
import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  redirect,
  Scripts,
  useLocation,
  useNavigate,
  useRouteContext,
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import type { ConvexReactClient } from 'convex/react'
import { useConvexAuth, useQuery } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { Loader2 } from 'lucide-react'
import { ThemeProvider } from 'next-themes'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { PassphrasePrompt } from '~/components/passphrase-prompt'
import { Toaster } from '~/components/ui/sonner'
import { TooltipProvider } from '~/components/ui/tooltip'
import { BillingProvider } from '~/contexts/billing-context'
import { BulkOperationProvider } from '~/contexts/bulk-operation-context'
import { EncryptionProvider } from '~/contexts/encryption-context'
import { MoneyPreferencesProvider } from '~/contexts/money-preferences-context'
import { PortfolioProvider, usePortfolio } from '~/contexts/portfolio-context'
import { WorkspaceProvider } from '~/contexts/workspace-context'
import { useLanguageSync } from '~/hooks/use-language-sync'
import { usePresenceHeartbeat } from '~/hooks/use-presence-heartbeat'
import appCss from '~/styles/app.css?url'
import { api } from '../../convex/_generated/api'

const fetchClerkAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const { userId, getToken } = await auth()

  let token: string | null = null
  if (userId) {
    try {
      token = await getToken({ template: 'convex' })
    } catch {
      // Session may be stale or invalid
    }
  }

  return { userId, token }
})

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexClient: ConvexReactClient
  convexQueryClient: ConvexQueryClient
}>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Bunkr — Own Your Financial Data',
      },
      {
        name: 'description',
        content:
          'Privacy-focused personal finance tracker. Aggregate your bank accounts, track your net worth, and manage your investments — your data stays private.',
      },
      // OpenGraph
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:url',
        content: 'https://app.bunkr.io',
      },
      {
        property: 'og:title',
        content: 'Bunkr — Own Your Financial Data',
      },
      {
        property: 'og:description',
        content:
          'Privacy-focused personal finance tracker. Aggregate your bank accounts, track your net worth, and manage your investments — your data stays private.',
      },
      {
        property: 'og:image',
        content: 'https://app.bunkr.io/og-image.png',
      },
      {
        property: 'og:image:width',
        content: '1200',
      },
      {
        property: 'og:image:height',
        content: '630',
      },
      {
        property: 'og:site_name',
        content: 'Bunkr',
      },
      // Twitter Card
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:title',
        content: 'Bunkr — Own Your Financial Data',
      },
      {
        name: 'twitter:description',
        content:
          'Privacy-focused personal finance tracker. Aggregate your bank accounts, track your net worth, and manage your investments — your data stays private.',
      },
      {
        name: 'twitter:image',
        content: 'https://app.bunkr.io/og-image.png',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      { rel: 'manifest', href: '/site.webmanifest', color: '#fffff' },
      { rel: 'icon', href: '/favicon.ico' },
      { rel: 'canonical', href: 'https://app.bunkr.io' },
    ],
  }),
  beforeLoad: async (ctx) => {
    const { userId, token } = await fetchClerkAuth()

    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token)
    }

    const isSignIn = ctx.location.pathname.startsWith('/sign-in')
    const isWaitlist = ctx.location.pathname.startsWith('/waitlist')
    const isInvite = ctx.location.pathname.startsWith('/invite')
    const isAuthenticated = userId && token

    if (!isAuthenticated && isInvite) {
      throw redirect({
        to: '/sign-in/$',
        search: { redirect_url: ctx.location.pathname },
      })
    }

    if (!isAuthenticated && !isSignIn && !isWaitlist) {
      throw redirect({ to: '/waitlist' })
    }

    if (isAuthenticated && (isSignIn || isWaitlist)) {
      throw redirect({ to: '/' })
    }

    // Check onboarding state server-side to avoid dashboard flash
    const isOnboarding = ctx.location.pathname.startsWith('/onboarding')
    const isPowens = ctx.location.pathname.startsWith('/powens/callback')
    const isExemptPath =
      isSignIn || isWaitlist || isInvite || isOnboarding || isPowens
    if (isAuthenticated && !isExemptPath) {
      const httpClient = ctx.context.convexQueryClient.serverHttpClient
      if (httpClient) {
        const state = await httpClient.query(api.onboarding.getOnboardingState)
        if (
          state.status === 'none' ||
          (state.status === 'in_progress' && state.step)
        ) {
          throw redirect({ to: '/onboarding' })
        }
      }
    }

    return { userId, token }
  },
  notFoundComponent: () => <div>Route not found</div>,
  component: RootComponent,
})

function RootComponent() {
  const context = useRouteContext({ from: Route.id })
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={context.convexClient} useAuth={useAuth}>
        <LanguageSyncWrapper>
          <TooltipProvider>
            <BillingProvider>
              <WorkspaceProvider>
                <PortfolioProvider>
                  <PresenceHeartbeat>
                    <EncryptionProvider>
                      <BulkOperationProvider>
                        <MoneyPreferencesProvider>
                          <RootDocument>
                            <OnboardingGuard>
                              <Outlet />
                            </OnboardingGuard>
                          </RootDocument>
                        </MoneyPreferencesProvider>
                      </BulkOperationProvider>
                    </EncryptionProvider>
                  </PresenceHeartbeat>
                </PortfolioProvider>
              </WorkspaceProvider>
            </BillingProvider>
          </TooltipProvider>
        </LanguageSyncWrapper>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}

function LanguageSyncWrapper({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useConvexAuth()
  useLanguageSync(isAuthenticated)
  return <>{children}</>
}

function PresenceHeartbeat({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useConvexAuth()
  const { portfolios } = usePortfolio()
  const userId = useAuth().userId
  const workspaceId = portfolios?.[0]?.workspaceId

  if (isAuthenticated && userId && workspaceId) {
    return (
      <PresenceHeartbeatInner roomId={workspaceId} userId={userId}>
        {children}
      </PresenceHeartbeatInner>
    )
  }

  return <>{children}</>
}

function PresenceHeartbeatInner({
  roomId,
  userId,
  children,
}: {
  roomId: string
  userId: string
  children: React.ReactNode
}) {
  usePresenceHeartbeat(roomId, userId)
  return <>{children}</>
}

const EXEMPT_PATHS = [
  '/onboarding',
  '/sign-in',
  '/powens/callback',
  '/waitlist',
  '/invite',
]

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const isExempt = EXEMPT_PATHS.some((p) => location.pathname.startsWith(p))

  const onboardingState = useQuery(
    api.onboarding.getOnboardingState,
    isAuthenticated && !isExempt ? {} : 'skip',
  )

  React.useEffect(() => {
    if (isAuthLoading || isExempt || !isAuthenticated) return
    if (onboardingState === undefined) return // still loading

    if (onboardingState.status === 'none') {
      void navigate({ to: '/onboarding' })
    } else if (
      onboardingState.status === 'in_progress' &&
      onboardingState.step
    ) {
      void navigate({ to: '/onboarding' })
    }
  }, [isAuthLoading, isAuthenticated, isExempt, onboardingState, navigate])

  // Block rendering while determining onboarding status or while redirecting
  // This prevents the full app layout from flashing before redirect
  if (!isExempt && isAuthenticated && !isAuthLoading) {
    if (onboardingState === undefined) {
      return (
        <div className="flex min-h-svh items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )
    }
    if (
      onboardingState.status === 'none' ||
      (onboardingState.status === 'in_progress' && onboardingState.step)
    ) {
      return (
        <div className="flex min-h-svh items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )
    }
  }

  return <>{children}</>
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation()
  return (
    <html lang={i18n.language} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <PassphrasePrompt />
          <Toaster />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
