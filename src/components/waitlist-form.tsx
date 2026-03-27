import { useClerk } from '@clerk/tanstack-react-start'
import { Link } from '@tanstack/react-router'
import { CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { cn } from '~/lib/utils'

export function WaitlistForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const clerk = useClerk()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await clerk.joinWaitlist({ emailAddress: email })
      setSuccess(true)
    } catch (err: unknown) {
      const clerkErr = err as {
        errors?: Array<{ longMessage?: string }>
      }
      setError(
        clerkErr.errors?.[0]?.longMessage ??
          'Could not join the waitlist. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className={cn('flex flex-col gap-6', className)} {...props}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-3 text-center">
            <CircleCheck className="size-10 text-green-500" />
            <h1 className="text-2xl font-bold">You're on the list!</h1>
            <p className="text-balance text-sm text-muted-foreground">
              We'll send an email to <strong>{email}</strong> when your spot is
              ready.
            </p>
          </div>
          <FieldDescription className="text-center">
            <Link
              to="/sign-in/$"
              params={{ _splat: '' }}
              className="underline underline-offset-4"
            >
              Already have access? Sign in
            </Link>
          </FieldDescription>
        </FieldGroup>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="text-2xl font-bold">Join the Waitlist</h1>
            <p className="text-balance text-sm text-muted-foreground">
              Sign up for early access to Bunkr
            </p>
          </div>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </Field>
          {error && <FieldError>{error}</FieldError>}
          <Field>
            <Button type="submit" loading={loading}>
              Join waitlist
            </Button>
          </Field>
          <FieldDescription className="text-center">
            <Link
              to="/sign-in/$"
              params={{ _splat: '' }}
              className="underline underline-offset-4"
            >
              Already have access? Sign in
            </Link>
          </FieldDescription>
        </FieldGroup>
      </form>
    </div>
  )
}
