import { useSignIn, useSignUp } from '@clerk/tanstack-react-start/legacy'
import { Link, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '~/components/ui/input-otp'
import { cn } from '~/lib/utils'

type Step = 'email' | 'code'
type Mode = 'sign-in' | 'sign-up'

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>('email')
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCooldown = useCallback(() => {
    setCooldown(30)
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current)
    }
  }, [])

  const {
    signIn,
    setActive: setSignInActive,
    isLoaded: signInLoaded,
  } = useSignIn()
  const {
    signUp,
    setActive: setSignUpActive,
    isLoaded: signUpLoaded,
  } = useSignUp()
  const navigate = useNavigate()

  const isLoaded = signInLoaded && signUpLoaded

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    if (!signIn || !signUp) return
    setError(null)
    setLoading(true)
    try {
      // Try sign-in first (existing user)
      const result = await signIn.create({ identifier: email })
      const emailCodeFactor = result.supportedFirstFactors?.find(
        (f) => f.strategy === 'email_code',
      )
      if (emailCodeFactor && 'emailAddressId' in emailCodeFactor) {
        await signIn.prepareFirstFactor({
          strategy: 'email_code',
          emailAddressId: emailCodeFactor.emailAddressId,
        })
        setMode('sign-in')
        setStep('code')
        startCooldown()
      } else {
        setError(t('login.emailCodeUnavailable'))
      }
    } catch (err: unknown) {
      const clerkErr = err as {
        errors?: Array<{ code?: string; longMessage?: string }>
      }
      const shouldTrySignUp = clerkErr.errors?.some(
        (e) =>
          e.code === 'form_identifier_not_found' ||
          e.code === 'form_param_format_invalid',
      )
      if (shouldTrySignUp) {
        // User doesn't exist — create account
        try {
          await signUp.create({ emailAddress: email })
          await signUp.prepareEmailAddressVerification({
            strategy: 'email_code',
          })
          setMode('sign-up')
          setStep('code')
          startCooldown()
        } catch (signUpErr: unknown) {
          const signUpClerkErr = signUpErr as {
            errors?: Array<{ code?: string; longMessage?: string }>
          }
          // Email already exists (e.g. from OAuth) — transfer to sign-in flow
          const alreadyExists = signUpClerkErr.errors?.some(
            (e) => e.code === 'form_identifier_exists',
          )
          const isWaitlistRestricted = signUpClerkErr.errors?.some(
            (e) =>
              e.code === 'form_restricted_to_waitlist' ||
              e.code === 'sign_up_restricted' ||
              e.longMessage?.toLowerCase().includes('waitlist'),
          )
          if (isWaitlistRestricted) {
            void navigate({ to: '/waitlist' })
            return
          }
          if (alreadyExists) {
            setError(t('login.accountExistsOauth'))
          } else {
            setError(
              signUpClerkErr.errors?.[0]?.longMessage ??
                t('login.sendCodeFailed'),
            )
          }
        }
      } else {
        setError(clerkErr.errors?.[0]?.longMessage ?? t('login.sendCodeFailed'))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCodeWithValue = useCallback(
    async (codeValue: string) => {
      setError(null)
      setLoading(true)
      try {
        if (mode === 'sign-in') {
          if (!signIn) return
          const result = await signIn.attemptFirstFactor({
            strategy: 'email_code',
            code: codeValue,
          })
          if (result.status === 'complete' && result.createdSessionId) {
            await setSignInActive({ session: result.createdSessionId })
            await navigate({ to: '/onboarding' })
          }
        } else {
          if (!signUp) return
          const result = await signUp.attemptEmailAddressVerification({
            code: codeValue,
          })
          if (result.status === 'complete' && result.createdSessionId) {
            await setSignUpActive({ session: result.createdSessionId })
            await navigate({ to: '/onboarding' })
          }
        }
      } catch (err: unknown) {
        const clerkErr = err as { errors?: Array<{ longMessage?: string }> }
        setError(
          clerkErr.errors?.[0]?.longMessage ?? t('login.verificationFailed'),
        )
      } finally {
        setLoading(false)
      }
    },
    [mode, signIn, signUp, setSignInActive, setSignUpActive, navigate, t],
  )

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    await handleVerifyCodeWithValue(code)
  }

  async function handleResendCode() {
    if (cooldown > 0 || !signIn || !signUp) return
    setError(null)
    setLoading(true)
    try {
      if (mode === 'sign-in') {
        const result = await signIn.create({ identifier: email })
        const emailCodeFactor = result.supportedFirstFactors?.find(
          (f) => f.strategy === 'email_code',
        )
        if (emailCodeFactor && 'emailAddressId' in emailCodeFactor) {
          await signIn.prepareFirstFactor({
            strategy: 'email_code',
            emailAddressId: emailCodeFactor.emailAddressId,
          })
        }
      } else {
        await signUp.prepareEmailAddressVerification({
          strategy: 'email_code',
        })
      }
      startCooldown()
    } catch (err: unknown) {
      const clerkErr = err as { errors?: Array<{ longMessage?: string }> }
      setError(clerkErr.errors?.[0]?.longMessage ?? t('login.resendFailed'))
    } finally {
      setLoading(false)
    }
  }

  function handleSocialLogin(provider: string) {
    if (signIn) {
      setGoogleLoading(true)
      void signIn.authenticateWithRedirect({
        strategy: `oauth_${provider}` as Parameters<
          typeof signIn.authenticateWithRedirect
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

  if (step === 'code') {
    return (
      <div className={cn('flex flex-col gap-6', className)} {...props}>
        <form onSubmit={handleVerifyCode}>
          <FieldGroup>
            <div className="flex flex-col items-center gap-1 text-center">
              <h1 className="text-2xl font-bold">
                {t('login.checkYourEmail')}
              </h1>
              <p className="text-balance text-sm text-muted-foreground">
                {t('login.verificationCodeSent', { email })}
              </p>
            </div>
            <Field className="items-center">
              <InputOTP
                id="code"
                maxLength={6}
                value={code}
                onChange={setCode}
                onComplete={handleVerifyCodeWithValue}
                autoFocus
                data-1p-ignore
                containerClassName="justify-center"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Field>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  t('login.verify')
                )}
              </Button>
            </Field>
            <FieldDescription className="text-center">
              {cooldown > 0 ? (
                <span>{t('login.resendCodeIn', { seconds: cooldown })}</span>
              ) : (
                <button
                  type="button"
                  className="underline underline-offset-4"
                  onClick={handleResendCode}
                  disabled={loading}
                >
                  {t('login.resendCode')}
                </button>
              )}
              {' · '}
              <button
                type="button"
                className="underline underline-offset-4"
                onClick={() => {
                  setStep('email')
                  setCode('')
                  setError(null)
                }}
              >
                {t('login.useDifferentEmail')}
              </button>
            </FieldDescription>
          </FieldGroup>
        </form>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <form onSubmit={handleSendCode}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="text-2xl font-bold">{t('login.welcomeTitle')}</h1>
            <p className="text-balance text-sm text-muted-foreground">
              {t('login.welcomeSubtitle')}
            </p>
          </div>
          <Field>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSocialLogin('google')}
              loading={googleLoading}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                  fill="currentColor"
                />
              </svg>
              {t('login.continueWithGoogle')}
            </Button>
          </Field>
          <FieldSeparator>{t('login.orContinueWith')}</FieldSeparator>
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
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t('login.continueWithEmail')
              )}
            </Button>
          </Field>
          <FieldDescription className="text-center">
            <Link to="/waitlist" className="underline underline-offset-4">
              {t('login.joinWaitlist')}
            </Link>
          </FieldDescription>
        </FieldGroup>
      </form>
    </div>
  )
}
