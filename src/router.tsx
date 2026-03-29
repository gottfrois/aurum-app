import { ConvexQueryClient } from '@convex-dev/react-query'
import * as Sentry from '@sentry/tanstackstart-react'
import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { routerWithQueryClient } from '@tanstack/react-router-with-query'
import { ConvexReactClient } from 'convex/react'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string
  if (!CONVEX_URL) {
    console.error('missing envar VITE_CONVEX_URL')
  }
  const convex = new ConvexReactClient(CONVEX_URL, {
    unsavedChangesWarning: false,
  })
  const convexQueryClient = new ConvexQueryClient(convex)

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  })
  convexQueryClient.connect(queryClient)

  const router = routerWithQueryClient(
    createRouter({
      routeTree,
      defaultPreload: 'intent',
      context: { queryClient, convexClient: convex, convexQueryClient },
      scrollRestoration: true,
      defaultPreloadStaleTime: 0,
      defaultErrorComponent: (err) => <p>{err.error.stack}</p>,
      defaultNotFoundComponent: () => <p>not found</p>,
    }),
    queryClient,
  )

  if (!router.isServer) {
    Sentry.init({
      dsn: 'https://9d9f322ee58a91426f41fc85b7da3792@o4511128509349888.ingest.de.sentry.io/4511128517607504',
      sendDefaultPii: true,
      tunnel: '/api/tunnel',
      beforeSend(event) {
        const message = event.exception?.values?.[0]?.value ?? ''
        if (
          message.includes('failed_to_load_clerk_js') ||
          message.includes('Failed to load Clerk JS')
        ) {
          return null
        }
        return event
      },
    })
  }

  return router
}
