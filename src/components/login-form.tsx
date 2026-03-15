import { useSignIn, useSignUp } from '@clerk/tanstack-react-start/legacy'
import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { cn } from '~/lib/utils'

type Mode = 'sign-in' | 'sign-up'
type VerifyState = 'idle' | 'verifying'

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [verifyState, setVerifyState] = useState<VerifyState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { signIn, isLoaded: signInLoaded } = useSignIn()
  const { signUp, isLoaded: signUpLoaded } = useSignUp()
  const navigate = useNavigate()

  const isLoaded = signInLoaded && signUpLoaded

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!signIn) return
    setError(null)
    setLoading(true)
    try {
      const result = await signIn.create({
        identifier: email,
        password,
      })
      if (result.status === 'complete') {
        await navigate({ to: '/onboarding', search: { step: 'legal' } })
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: Array<{ longMessage?: string }> }
      setError(
        clerkErr.errors?.[0]?.longMessage ??
          'Sign in failed. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (!signUp) return
    setError(null)
    setLoading(true)
    try {
      await signUp.create({
        emailAddress: email,
        password,
      })
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      setVerifyState('verifying')
    } catch (err: unknown) {
      const clerkErr = err as { errors?: Array<{ longMessage?: string }> }
      setError(
        clerkErr.errors?.[0]?.longMessage ??
          'Sign up failed. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!signUp) return
    setError(null)
    setLoading(true)
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      })
      if (result.status === 'complete') {
        await navigate({ to: '/onboarding', search: { step: 'legal' } })
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: Array<{ longMessage?: string }> }
      setError(
        clerkErr.errors?.[0]?.longMessage ??
          'Verification failed. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  function handleSocialLogin(provider: string) {
    if (mode === 'sign-in' && signIn) {
      void signIn.authenticateWithRedirect({
        strategy: `oauth_${provider}` as Parameters<
          typeof signIn.authenticateWithRedirect
        >[0]['strategy'],
        redirectUrl: '/sign-in/sso-callback',
        redirectUrlComplete: '/onboarding',
      })
    } else if (mode === 'sign-up' && signUp) {
      void signUp.authenticateWithRedirect({
        strategy: `oauth_${provider}` as Parameters<
          typeof signUp.authenticateWithRedirect
        >[0]['strategy'],
        redirectUrl: '/sign-in/sso-callback',
        redirectUrlComplete: '/onboarding',
      })
    }
  }

  if (!isLoaded) {
    return (
      <div
        className={cn('flex items-center justify-center py-12', className)}
        {...props}
      >
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (verifyState === 'verifying') {
    return (
      <div className={cn('flex flex-col gap-6', className)} {...props}>
        <form onSubmit={handleVerify}>
          <FieldGroup>
            <div className="flex flex-col items-center gap-1 text-center">
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="text-balance text-sm text-muted-foreground">
                We sent a verification code to {email}
              </p>
            </div>
            <Field>
              <FieldLabel htmlFor="code">Verification code</FieldLabel>
              <Input
                id="code"
                type="text"
                placeholder="Enter code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                autoFocus
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Field>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  'Verify'
                )}
              </Button>
            </Field>
            <FieldDescription className="text-center">
              <button
                type="button"
                className="underline underline-offset-4"
                onClick={() => {
                  setVerifyState('idle')
                  setError(null)
                }}
              >
                Back
              </button>
            </FieldDescription>
          </FieldGroup>
        </form>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <form onSubmit={mode === 'sign-in' ? handleSignIn : handleSignUp}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="text-2xl font-bold">
              {mode === 'sign-in' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-balance text-sm text-muted-foreground">
              {mode === 'sign-in'
                ? 'Sign in to your Bunkr account'
                : 'Get started with Bunkr'}
            </p>
          </div>
          <Field>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSocialLogin('google')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                  fill="currentColor"
                />
              </svg>
              Continue with Google
            </Button>
          </Field>
          <FieldSeparator>Or continue with</FieldSeparator>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          {error && <FieldError>{error}</FieldError>}
          <Field>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : mode === 'sign-in' ? (
                'Sign in'
              ) : (
                'Sign up'
              )}
            </Button>
            <FieldDescription className="text-center">
              {mode === 'sign-in' ? (
                <>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    className="underline underline-offset-4"
                    onClick={() => {
                      setMode('sign-up')
                      setError(null)
                    }}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="underline underline-offset-4"
                    onClick={() => {
                      setMode('sign-in')
                      setError(null)
                    }}
                  >
                    Sign in
                  </button>
                </>
              )}
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}
