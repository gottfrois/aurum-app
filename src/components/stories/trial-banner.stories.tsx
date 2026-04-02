import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { TrialBanner } from '../trial-banner'

interface TrialBannerDemoProps {
  daysRemaining: number
}

function TrialBannerDemo({ daysRemaining }: TrialBannerDemoProps) {
  return (
    <TrialBanner
      trialEndsAt={Date.now() + daysRemaining * 24 * 60 * 60 * 1000}
    />
  )
}

const meta = {
  title: 'Feedback/TrialBanner',
  component: TrialBannerDemo,
  decorators: [
    (Story) => {
      const rootRoute = createRootRoute({
        component: () => <Story />,
      })
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
      })
      const router = createRouter({
        routeTree: rootRoute.addChildren([indexRoute]),
        history: createMemoryHistory({ initialEntries: ['/'] }),
      })
      return <RouterProvider router={router} />
    },
  ],
  argTypes: {
    daysRemaining: {
      control: { type: 'number', min: 0, max: 30 },
      description: 'Days until trial expires',
    },
  },
} satisfies Meta<typeof TrialBannerDemo>

export default meta
type Story = StoryObj<typeof meta>

export const SevenDaysLeft: Story = {
  args: { daysRemaining: 7 },
}

export const OneDayLeft: Story = {
  args: { daysRemaining: 1 },
}

export const ExpiresToday: Story = {
  args: { daysRemaining: 0 },
}
