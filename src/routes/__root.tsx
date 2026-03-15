import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  redirect,
  useRouteContext,
} from '@tanstack/react-router'
import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { createServerFn } from '@tanstack/react-start'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import * as React from 'react'
import { ThemeProvider } from 'next-themes'
import type { QueryClient } from '@tanstack/react-query'
import type { ConvexQueryClient } from '@convex-dev/react-query'
import type { ConvexReactClient } from 'convex/react'
import { TooltipProvider } from '~/components/ui/tooltip'
import { PortfolioProvider } from '~/contexts/portfolio-context'
import { PrivacyProvider } from '~/contexts/privacy-context'
import { EncryptionProvider } from '~/contexts/encryption-context'
import { Toaster } from '~/components/ui/sonner'
import { PassphrasePrompt } from '~/components/passphrase-prompt'
import appCss from '~/styles/app.css?url'

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

    if (!userId && !ctx.location.pathname.startsWith('/sign-in')) {
      throw redirect({ to: '/sign-in/$', params: { _splat: '' } })
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
        <TooltipProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <PortfolioProvider>
              <EncryptionProvider>
                <PrivacyProvider>
                  <RootDocument>
                    <Outlet />
                  </RootDocument>
                </PrivacyProvider>
              </EncryptionProvider>
            </PortfolioProvider>
          </ThemeProvider>
        </TooltipProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <PassphrasePrompt />
        <Toaster />
        <Scripts />
      </body>
    </html>
  )
}
