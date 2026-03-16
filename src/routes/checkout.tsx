import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAction, useQuery } from 'convex/react'
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { cn } from '~/lib/utils'
import { api } from '../../convex/_generated/api'
import { PLANS, type PlanKey } from '../../convex/stripe'

export const Route = createFileRoute('/checkout')({
  component: CheckoutPage,
})

const PLAN_FEATURES: Record<PlanKey, string[]> = {
  solo: [
    '1 seat',
    'Unlimited portfolios',
    'Unlimited bank connections',
    'Full transaction history',
    'Net worth tracking',
    'Portfolio analytics',
    'Zero-knowledge encryption',
  ],
  duo: [
    '2 seats',
    'Everything in Solo',
    'Shared workspace',
    'Invite your partner',
  ],
  family: [
    'Up to 5 seats',
    'Everything in Duo',
    'Family dashboard',
    'Privacy controls',
    'Combined net worth view',
  ],
}

function CheckoutPage() {
  const [isYearly, setIsYearly] = useState(false)
  const [loading, setLoading] = useState<PlanKey | null>(null)
  const subscription = useQuery(api.billing.getSubscriptionStatus)
  const createCheckout = useAction(api.billing.createCheckout)
  const navigate = useNavigate()

  useEffect(() => {
    if (subscription?.isActive) {
      void navigate({ to: '/' })
    }
  }, [subscription, navigate])

  async function handleCheckout(plan: PlanKey) {
    setLoading(plan)
    try {
      const result = await createCheckout({
        plan,
        interval: isYearly ? 'yearly' : 'monthly',
      })
      if (result.url) {
        window.location.href = result.url
      }
    } catch (error) {
      console.error('Checkout error:', error)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Start your 14-day free trial</h1>
        <p className="mt-2 text-muted-foreground">
          Try free for 14 days. You won&apos;t be charged until the trial ends.
        </p>
      </div>

      <div className="mb-8 flex items-center gap-3">
        <button
          onClick={() => setIsYearly(false)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            !isYearly
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setIsYearly(true)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            isYearly
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Yearly
          <Badge variant="secondary" className="ml-1.5">
            Save 17%
          </Badge>
        </button>
      </div>

      <div className="grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
        {(Object.entries(PLANS) as [PlanKey, (typeof PLANS)[PlanKey]][]).map(
          ([key, plan]) => {
            const price = isYearly ? plan.yearly : plan.monthly
            const monthlyEquivalent = isYearly
              ? Math.round(plan.yearly / 12)
              : plan.monthly
            const isPopular = key === 'duo'

            return (
              <Card
                key={key}
                className={cn(
                  'relative flex flex-col',
                  isPopular && 'border-primary shadow-md',
                )}
              >
                {isPopular && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    Most popular
                  </Badge>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>
                    {key === 'solo' && 'For individuals'}
                    {key === 'duo' && 'For couples'}
                    {key === 'family' && 'For the whole family'}
                  </CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">
                      {monthlyEquivalent / 100}&#8364;
                    </span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                  {isYearly && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {price / 100}&#8364; billed annually
                    </p>
                  )}
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {PLAN_FEATURES[key].map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Check className="size-4 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    size="lg"
                    variant={isPopular ? 'default' : 'outline'}
                    onClick={() => handleCheckout(key)}
                    disabled={loading !== null}
                  >
                    {loading === key ? 'Redirecting...' : 'Start free trial'}
                  </Button>
                </CardFooter>
              </Card>
            )
          },
        )}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        14-day free trial on all plans. Cancel anytime.
      </p>
    </div>
  )
}
