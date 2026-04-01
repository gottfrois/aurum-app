import { useClerk } from '@clerk/tanstack-react-start'
import { Link } from '@tanstack/react-router'
import { CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
        clerkErr.errors?.[0]?.longMessage ?? t('toast.joinWaitlistFailed'),
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
            <h1 className="text-2xl font-bold">{t('waitlist.successTitle')}</h1>
            <p className="text-balance text-sm text-muted-foreground">
              {t('waitlist.successDescription', { email })}
            </p>
          </div>
          <FieldDescription className="text-center">
            <Link
              to="/sign-in/$"
              params={{ _splat: '' }}
              className="underline underline-offset-4"
            >
              {t('waitlist.signinLink')}
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
            <h1 className="text-2xl font-bold">{t('waitlist.title')}</h1>
            <p className="text-balance text-sm text-muted-foreground">
              {t('waitlist.subtitle')}
            </p>
          </div>
          <Field>
            <FieldLabel htmlFor="email">{t('form.email')}</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder={t('form.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </Field>
          {error && <FieldError>{error}</FieldError>}
          <Field>
            <Button type="submit" loading={loading}>
              {t('waitlist.joinButton')}
            </Button>
          </Field>
          <FieldDescription className="text-center">
            <Link
              to="/sign-in/$"
              params={{ _splat: '' }}
              className="underline underline-offset-4"
            >
              {t('waitlist.signinLink')}
            </Link>
          </FieldDescription>
        </FieldGroup>
      </form>
    </div>
  )
}
