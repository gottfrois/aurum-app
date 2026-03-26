import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { TrialBanner } from '../trial-banner'

const rootRoute = createRootRoute({
  component: () => null,
})
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/' })
const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute]),
  history: createMemoryHistory({ initialEntries: ['/'] }),
})

const meta = {
  title: 'Feedback/TrialBanner',
  component: TrialBanner,
  decorators: [
    (Story) => (
      // @ts-expect-error -- router type mismatch with app's registered router
      <RouterProvider router={router}>
        <Story />
      </RouterProvider>
    ),
  ],
} satisfies Meta<typeof TrialBanner>

export default meta
type Story = StoryObj<typeof meta>

export const SevenDaysLeft: Story = {
  args: {
    trialEndsAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  },
}

export const OneDayLeft: Story = {
  args: {
    trialEndsAt: Date.now() + 1 * 24 * 60 * 60 * 1000,
  },
}

export const ExpiresToday: Story = {
  args: {
    trialEndsAt: Date.now(),
  },
}
