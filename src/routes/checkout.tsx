import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Check, Home, User, Users } from 'lucide-react'
import { CheckoutLink } from '@convex-dev/polar/react'
import { api } from '../../convex/_generated/api'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Skeleton } from '~/components/ui/skeleton'

export const Route = createFileRoute('/checkout')({
  component: CheckoutPage,
})

const TIERS = [
  {
    key: 'solo',
    name: 'Solo',
    icon: User,
    seats: 1,
    monthlyKey: 'soloMonthly' as const,
    yearlyKey: 'soloYearly' as const,
    description: 'For individuals tracking their finances',
    features: [
      'Unlimited bank connections',
      'Unlimited profiles',
      'Full transaction history',
      'Net worth tracking',
      'Portfolio analytics',
      'End-to-end encryption',
    ],
  },
  {
    key: 'team',
    name: 'Team',
    icon: Users,
    seats: 3,
    monthlyKey: 'teamMonthly' as const,
    yearlyKey: 'teamYearly' as const,
    description: 'For couples or small teams',
    popular: true,
    features: [
      'Everything in Solo',
      'Up to 3 members',
      'Workspace collaboration',
      'Shared financial overview',
    ],
  },
  {
    key: 'family',
    name: 'Family',
    icon: Home,
    seats: 5,
    monthlyKey: 'familyMonthly' as const,
    yearlyKey: 'familyYearly' as const,
    description: 'For the whole family',
    features: ['Everything in Team', 'Up to 5 members', 'Priority support'],
  },
]

function getPrice(
  products: Record<
    string,
    { prices: Array<{ priceAmount?: number | null }> } | undefined
  >,
  key: string,
): number | null {
  const product = products[key]
  if (!product) return null
  return (product.prices[0]?.priceAmount ?? 0) / 100
}

function CheckoutPage() {
  const [isYearly, setIsYearly] = useState(false)
  const products = useQuery(api.polar.getConfiguredProducts)
  const subscription = useQuery(api.billing.getSubscriptionStatus)
  const navigate = useNavigate()

  useEffect(() => {
    if (subscription && subscription.isActive) {
      void navigate({ to: '/' })
    }
  }, [subscription, navigate])

  if (products === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-6 px-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[500px] w-[320px] rounded-xl" />
        ))}
      </div>
    )
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
            Save 20%
          </Badge>
        </button>
      </div>

      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-3">
        {TIERS.map((tier) => {
          const productKey = isYearly ? tier.yearlyKey : tier.monthlyKey
          const product = products[productKey]
          const productId = product?.id ?? null
          const price = getPrice(
            products as Record<
              string,
              { prices: Array<{ priceAmount?: number | null }> }
            >,
            productKey,
          )
          const TierIcon = tier.icon

          return (
            <Card
              key={tier.key}
              className={`flex flex-col${tier.popular ? ' relative border-primary shadow-md' : ''}`}
            >
              {tier.popular && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  Most popular
                </Badge>
              )}
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg bg-muted">
                  <TierIcon className="size-5" />
                </div>
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <CardDescription className="min-h-[2lh]">
                  {tier.description}
                </CardDescription>
                <div className="mt-4">
                  {price !== null ? (
                    <>
                      <span className="text-4xl font-bold">{price}&#8364;</span>
                      <span className="text-muted-foreground">
                        /{isYearly ? 'year' : 'month'}
                      </span>
                    </>
                  ) : (
                    <Skeleton className="mx-auto h-10 w-24" />
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tier.seats} {tier.seats === 1 ? 'seat' : 'seats'} included
                </p>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
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
                {productId ? (
                  <CheckoutLink
                    polarApi={api.polar}
                    productIds={[productId]}
                    trialInterval="day"
                    trialIntervalCount={14}
                    embed={false}
                    className="w-full"
                  >
                    <Button
                      className="w-full"
                      size="lg"
                      variant={tier.popular ? 'default' : 'outline'}
                    >
                      Start free trial
                    </Button>
                  </CheckoutLink>
                ) : (
                  <Button className="w-full" size="lg" disabled>
                    Start free trial
                  </Button>
                )}
              </CardFooter>
            </Card>
          )
        })}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        14-day free trial on all plans. Cancel anytime.
      </p>
    </div>
  )
}
