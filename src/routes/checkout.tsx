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
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/checkout')({
  component: CheckoutPage,
})

const FEATURES = [
  'Unlimited bank connections',
  'Unlimited profiles',
  'Full transaction history',
  'Net worth tracking',
  'Portfolio analytics',
  'Zero-knowledge encryption',
  'Workspace collaboration',
  'Priority support',
]

const SEAT_PRICE = {
  monthly: 9,
  yearly: 89,
}

function CheckoutPage() {
  const [isYearly, setIsYearly] = useState(false)
  const [loading, setLoading] = useState(false)
  const subscription = useQuery(api.billing.getSubscriptionStatus)
  const createCheckout = useAction(api.billing.createCheckout)
  const navigate = useNavigate()

  useEffect(() => {
    if (subscription?.isActive) {
      void navigate({ to: '/' })
    }
  }, [subscription, navigate])

  const price = isYearly ? SEAT_PRICE.yearly : SEAT_PRICE.monthly

  async function handleCheckout() {
    setLoading(true)
    try {
      const result = await createCheckout({
        interval: isYearly ? 'yearly' : 'monthly',
      })
      if (result.url) {
        window.location.href = result.url
      }
    } catch (error) {
      console.error('Checkout error:', error)
    } finally {
      setLoading(false)
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
            Save 18%
          </Badge>
        </button>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Bunkr</CardTitle>
          <CardDescription>
            Personal finance tracking for you and your family
          </CardDescription>
          <div className="mt-4">
            <span className="text-4xl font-bold">{price}&#8364;</span>
            <span className="text-muted-foreground">
              /seat/{isYearly ? 'year' : 'month'}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Start with 1 seat, add more anytime
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
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
            onClick={handleCheckout}
            disabled={loading}
          >
            {loading ? 'Redirecting...' : 'Start free trial'}
          </Button>
        </CardFooter>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        14-day free trial. Cancel anytime. Add seats as you grow.
      </p>
    </div>
  )
}
