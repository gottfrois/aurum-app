import { useUser } from '@clerk/tanstack-react-start'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAction, useConvexAuth, useMutation, useQuery } from 'convex/react'
import {
  Briefcase,
  Check,
  ChevronLeft,
  Home,
  Loader2,
  Lock,
  PiggyBank,
  Shield,
  TrendingUp,
  TriangleAlert,
  User,
  Wallet,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '~/components/reui/stepper'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import {
  deriveKeyFromPassphrase,
  encryptPrivateKey,
  encryptString,
  exportPrivateKey,
  exportPublicKey,
  generateKeyPair,
  importPrivateKey,
  storePrivateKey,
} from '~/lib/crypto'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/onboarding')({
  validateSearch: (search: Record<string, unknown>) => ({
    step: (search.step as string | undefined) ?? 'legal',
  }),
  component: OnboardingPage,
})

const STEP_LABELS: Record<string, string> = {
  legal: 'Legal',
  name: 'Name',
  workspace: 'Workspace',
  invite: 'Invite',
  vault: 'Vault',
  portfolio: 'Portfolio',
  connection: 'Connect',
}

const NEW_USER_STEPS = [
  'legal',
  'name',
  'workspace',
  'invite',
  'vault',
  'portfolio',
  'connection',
] as const
const INVITED_USER_STEPS = [
  'legal',
  'vault',
  'portfolio',
  'connection',
] as const

type Step = (typeof NEW_USER_STEPS)[number]

function OnboardingPage() {
  const { step } = Route.useSearch()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()

  const onboardingState = useQuery(
    api.onboarding.getOnboardingState,
    isAuthenticated ? {} : 'skip',
  )

  const checkInvitation = useAction(api.onboarding.checkAndAcceptInvitation)
  const [isInvited, setIsInvited] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const checkedRef = useRef(false)

  // Reset submitting state when step changes
  useEffect(() => {
    setSubmitting(false)
  }, [])

  // Check for pending invitations on first load
  useEffect(() => {
    if (!isAuthenticated || checkedRef.current) return
    if (onboardingState === undefined) return
    // Only check for users without a workspace yet or in progress
    if (onboardingState.status === 'complete') {
      void navigate({ to: '/' })
      return
    }

    checkedRef.current = true
    checkInvitation()
      .then((result) => {
        setIsInvited(result.accepted)
        if (result.accepted) {
          // Invited user — start at legal (they already have a member record with step "vault")
          void navigate({ to: '/onboarding', search: { step: 'legal' } })
        }
      })
      .catch(() => {
        setIsInvited(false)
      })
  }, [isAuthenticated, onboardingState, checkInvitation, navigate])

  if (isAuthLoading || onboardingState === undefined || isInvited === null) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const steps: ReadonlyArray<string> = isInvited
    ? INVITED_USER_STEPS
    : NEW_USER_STEPS
  const currentStep = step as Step
  const currentIndex = steps.indexOf(currentStep)
  // 1-based for the Stepper component
  const activeStepNumber = currentIndex + 1

  function goToStep(nextStep: string) {
    void navigate({ to: '/onboarding', search: { step: nextStep } })
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Stepper indicator */}
        <div className="mb-8">
          <Stepper
            value={activeStepNumber}
            onValueChange={(value) => {
              const targetStep = steps[value - 1]
              // Only allow navigating to completed (previous) steps
              if (targetStep && value < activeStepNumber) {
                goToStep(targetStep)
              }
            }}
            indicators={{
              completed: <Check className="size-3.5" />,
              loading: <Loader2 className="size-3.5 animate-spin" />,
            }}
          >
            <StepperNav>
              {steps.map((s, i) => (
                <StepperItem
                  key={s}
                  step={i + 1}
                  completed={i < currentIndex}
                  disabled={i >= currentIndex}
                  loading={submitting && i === currentIndex}
                >
                  <StepperTrigger>
                    <StepperIndicator>{i + 1}</StepperIndicator>
                  </StepperTrigger>
                  <StepperTitle className="sr-only max-sm:sr-only">
                    {STEP_LABELS[s] ?? s}
                  </StepperTitle>
                  {i < steps.length - 1 && <StepperSeparator />}
                </StepperItem>
              ))}
            </StepperNav>
          </Stepper>
        </div>

        {currentStep === 'legal' && (
          <LegalStep
            onNext={() => goToStep(isInvited ? 'vault' : 'name')}
            onSubmitting={setSubmitting}
          />
        )}
        {currentStep === 'name' && (
          <NameStep
            onNext={() => goToStep('workspace')}
            onBack={() => goToStep('legal')}
            onSubmitting={setSubmitting}
          />
        )}
        {currentStep === 'workspace' && (
          <WorkspaceStep
            onNext={() => goToStep('invite')}
            onBack={() => goToStep('name')}
            onSubmitting={setSubmitting}
          />
        )}
        {currentStep === 'invite' && (
          <InviteStep
            onNext={() => goToStep('vault')}
            onBack={() => goToStep('workspace')}
            onSubmitting={setSubmitting}
          />
        )}
        {currentStep === 'vault' && (
          <VaultStep
            isInvited={isInvited}
            onNext={() => goToStep('portfolio')}
            onBack={() => goToStep(isInvited ? 'legal' : 'invite')}
            onSubmitting={setSubmitting}
          />
        )}
        {currentStep === 'portfolio' && (
          <PortfolioStep
            onNext={() => goToStep('connection')}
            onBack={() => goToStep('vault')}
            onSubmitting={setSubmitting}
          />
        )}
        {currentStep === 'connection' && (
          <ConnectionStep
            onBack={() => goToStep('portfolio')}
            onSubmitting={setSubmitting}
          />
        )}
      </div>
    </div>
  )
}

interface StepProps {
  onNext: () => void
  onSubmitting: (v: boolean) => void
}

interface StepWithBackProps extends StepProps {
  onBack: () => void
}

function StepBackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="absolute left-6 top-6"
      onClick={onClick}
    >
      <ChevronLeft />
    </Button>
  )
}

function LegalStep({ onNext, onSubmitting }: StepProps) {
  const [tos, setTos] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [saving, setSaving] = useState(false)
  const saveConsents = useMutation(api.onboarding.saveConsents)
  const updateStep = useMutation(api.onboarding.updateOnboardingStep)

  async function handleNext() {
    setSaving(true)
    onSubmitting(true)
    try {
      await saveConsents({
        termsOfService: tos,
        privacyPolicy: privacy,
        marketingCommunications: marketing,
      })
      // Don't update step if member doesn't exist yet (new user, no workspace)
      try {
        await updateStep({ step: 'name' })
      } catch {
        // Member record may not exist yet for new users
      }
      onNext()
    } catch (err) {
      toast.error('Failed to save consents')
      console.error(err)
      setSaving(false)
      onSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Legal agreements</CardTitle>
        <CardDescription>
          Please review and accept the following to continue
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="tos" className="flex-1 cursor-pointer">
              I accept the{' '}
              <a
                href="https://bunkr.io/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Terms of Service
              </a>{' '}
              <span className="text-destructive">*</span>
            </Label>
            <Switch id="tos" checked={tos} onCheckedChange={setTos} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="privacy" className="flex-1 cursor-pointer">
              I accept the{' '}
              <a
                href="https://bunkr.io/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Privacy Policy
              </a>{' '}
              <span className="text-destructive">*</span>
            </Label>
            <Switch
              id="privacy"
              checked={privacy}
              onCheckedChange={setPrivacy}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="marketing" className="flex-1 cursor-pointer">
              I agree to receive marketing communications
            </Label>
            <Switch
              id="marketing"
              checked={marketing}
              onCheckedChange={setMarketing}
            />
          </div>
        </div>
        <Button
          className="w-full"
          disabled={!tos || !privacy || saving}
          onClick={handleNext}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : 'Continue'}
        </Button>
      </CardContent>
    </Card>
  )
}

function NameStep({ onNext, onBack, onSubmitting }: StepWithBackProps) {
  const { user } = useUser()
  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [saving, setSaving] = useState(false)

  async function handleNext() {
    if (!user) return
    setSaving(true)
    onSubmitting(true)
    try {
      await user.update({ firstName, lastName })
      onNext()
    } catch (err) {
      toast.error('Failed to update name')
      console.error(err)
      setSaving(false)
      onSubmitting(false)
    }
  }

  return (
    <Card className="relative">
      <StepBackButton onClick={onBack} />
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">What&apos;s your name?</CardTitle>
        <CardDescription>Let us know what to call you</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            autoFocus
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
          />
        </div>
        <Button
          className="w-full"
          disabled={!firstName.trim() || saving}
          onClick={handleNext}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : 'Continue'}
        </Button>
      </CardContent>
    </Card>
  )
}

function WorkspaceStep({ onNext, onBack, onSubmitting }: StepWithBackProps) {
  const { user } = useUser()
  const defaultName = user?.firstName
    ? `${user.firstName}'s workspace`
    : 'My Workspace'
  const [name, setName] = useState(defaultName)
  const [saving, setSaving] = useState(false)
  const createWorkspace = useMutation(api.onboarding.createWorkspaceOnboarding)

  async function handleNext() {
    setSaving(true)
    onSubmitting(true)
    try {
      await createWorkspace({ workspaceName: name })
      onNext()
    } catch (err) {
      toast.error('Failed to create workspace')
      console.error(err)
      setSaving(false)
      onSubmitting(false)
    }
  }

  return (
    <Card className="relative">
      <StepBackButton onClick={onBack} />
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Create your workspace</CardTitle>
        <CardDescription>
          Your workspace is where you manage your finances
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="workspace-name">Workspace name</Label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Workspace"
            autoFocus
          />
        </div>
        <Button
          className="w-full"
          disabled={!name.trim() || saving}
          onClick={handleNext}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : 'Continue'}
        </Button>
      </CardContent>
    </Card>
  )
}

function InviteStep({ onNext, onBack, onSubmitting }: StepWithBackProps) {
  const [emails, setEmails] = useState('')
  const [saving, setSaving] = useState(false)
  const sendInvitation = useAction(api.members.sendInvitation)
  const updateStep = useMutation(api.onboarding.updateOnboardingStep)

  async function handleNext() {
    const emailList = emails
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter(Boolean)

    setSaving(true)
    onSubmitting(true)
    try {
      if (emailList.length > 0) {
        await sendInvitation({ emails: emailList })
      }
      await updateStep({ step: 'vault' })
      onNext()
    } catch (err) {
      toast.error('Failed to send invitations')
      console.error(err)
      setSaving(false)
      onSubmitting(false)
    }
  }

  async function handleSkip() {
    setSaving(true)
    onSubmitting(true)
    try {
      await updateStep({ step: 'vault' })
      onNext()
    } catch {
      setSaving(false)
      onSubmitting(false)
    }
  }

  return (
    <Card className="relative">
      <StepBackButton onClick={onBack} />
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Invite your team</CardTitle>
        <CardDescription>
          Share your workspace with others. You can always do this later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="emails">Email addresses</Label>
          <textarea
            id="emails"
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="Enter email addresses, separated by commas"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleSkip}
            disabled={saving}
          >
            Skip
          </Button>
          <Button className="flex-1" disabled={saving} onClick={handleNext}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              'Send invites'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function VaultStep({
  isInvited,
  onNext,
  onBack,
  onSubmitting,
}: StepWithBackProps & { isInvited: boolean }) {
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const enableEncryption = useMutation(
    api.encryptionKeys.enableWorkspaceEncryption,
  )
  const setupMember = useMutation(api.encryptionKeys.setupMemberEncryption)
  const updateStep = useMutation(api.onboarding.updateOnboardingStep)
  const encryptionState = useQuery(api.encryptionKeys.getWorkspaceEncryption)

  const valid = passphrase.length >= 8 && passphrase === confirm

  // If encryption is already fully set up (existing user), skip this step
  const encryptionAlreadySetUp =
    encryptionState?.enabled === true && encryptionState.hasPersonalKey
  // Capture initial state to avoid UI flash when encryption is set up mid-submit
  const initiallySetUp = useRef(encryptionAlreadySetUp)
  const alreadySetUp = initiallySetUp.current

  async function handleSetup() {
    setSaving(true)
    onSubmitting(true)
    try {
      if (alreadySetUp) {
        // Encryption already configured — just advance
        await updateStep({ step: 'portfolio' })
        onNext()
        return
      }

      const personalKeyPair = await generateKeyPair()
      const personalPublicKeyJwk = await exportPublicKey(
        personalKeyPair.publicKey,
      )
      const personalPrivateKeyJwk = await exportPrivateKey(
        personalKeyPair.privateKey,
      )

      const salt = crypto.getRandomValues(new Uint8Array(32))
      const passphraseKey = await deriveKeyFromPassphrase(passphrase, salt)
      const encryptedPersonalPk = await encryptPrivateKey(
        personalPrivateKeyJwk,
        passphraseKey,
      )
      const saltB64 = btoa(String.fromCharCode(...salt))

      if (isInvited) {
        // Invited user: set up personal key only
        await setupMember({
          publicKey: personalPublicKeyJwk,
          encryptedPrivateKey: JSON.stringify(encryptedPersonalPk),
          pbkdf2Salt: saltB64,
        })
      } else {
        // Owner: set up personal key + workspace keypair + key slot
        const wsKeyPair = await generateKeyPair()
        const wsPublicKeyJwk = await exportPublicKey(wsKeyPair.publicKey)
        const wsPrivateKeyJwk = await exportPrivateKey(wsKeyPair.privateKey)

        const ownerKeySlotEncrypted = await encryptString(
          wsPrivateKeyJwk,
          personalKeyPair.publicKey,
        )

        await enableEncryption({
          personalPublicKey: personalPublicKeyJwk,
          personalEncryptedPrivateKey: JSON.stringify(encryptedPersonalPk),
          personalPbkdf2Salt: saltB64,
          workspacePublicKey: wsPublicKeyJwk,
          ownerKeySlotEncryptedPrivateKey: ownerKeySlotEncrypted,
        })

        // Store workspace private key in IndexedDB
        const wsKey = await importPrivateKey(wsPrivateKeyJwk)
        await storePrivateKey(wsKey)
      }

      await updateStep({ step: 'portfolio' })
      onNext()
    } catch (err) {
      toast.error('Failed to set up encryption')
      console.error(err)
      setSaving(false)
      onSubmitting(false)
    }
  }

  if (alreadySetUp) {
    return (
      <Card className="relative">
        <StepBackButton onClick={onBack} />
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="size-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Vault already set up</CardTitle>
          <CardDescription>
            Your encryption is already configured. Continue to the next step.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" disabled={saving} onClick={handleSetup}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : 'Continue'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="relative">
      <StepBackButton onClick={onBack} />
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Shield className="size-8 text-primary" />
        </div>
        <CardTitle className="text-2xl">Set up your Vault</CardTitle>
        <CardDescription>
          Your financial data is protected with zero-knowledge encryption
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="space-y-1">
            <Lock className="mx-auto size-5 text-muted-foreground" />
            <p className="text-xs font-medium">Zero-knowledge</p>
          </div>
          <div className="space-y-1">
            <Shield className="mx-auto size-5 text-muted-foreground" />
            <p className="text-xs font-medium">Military-grade</p>
          </div>
          <div className="space-y-1">
            <Lock className="mx-auto size-5 text-muted-foreground" />
            <p className="text-xs font-medium">Passphrase-protected</p>
          </div>
        </div>

        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Important</AlertTitle>
          <AlertDescription>
            If you forget your passphrase, your encrypted data cannot be
            recovered. There is no reset mechanism. Store your passphrase
            safely.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="vault-passphrase">Passphrase</Label>
            <Input
              id="vault-passphrase"
              type="password"
              placeholder="At least 8 characters"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vault-confirm">Confirm passphrase</Label>
            <Input
              id="vault-confirm"
              type="password"
              placeholder="Repeat passphrase"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {confirm && passphrase !== confirm && (
              <p className="text-sm text-destructive">
                Passphrases do not match
              </p>
            )}
          </div>
        </div>

        <Button
          className="w-full"
          disabled={!valid || saving}
          onClick={handleSetup}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            'Create Vault'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

const PORTFOLIO_ICONS = [
  { name: 'User', icon: User },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'Home', icon: Home },
  { name: 'Wallet', icon: Wallet },
  { name: 'PiggyBank', icon: PiggyBank },
  { name: 'TrendingUp', icon: TrendingUp },
]

function PortfolioStep({ onNext, onBack, onSubmitting }: StepWithBackProps) {
  const [name, setName] = useState('Personal')
  const [selectedIcon, setSelectedIcon] = useState('User')
  const [saving, setSaving] = useState(false)
  const createPortfolio = useMutation(api.portfolios.createPortfolio)
  const updateStep = useMutation(api.onboarding.updateOnboardingStep)

  async function handleNext() {
    setSaving(true)
    onSubmitting(true)
    try {
      await createPortfolio({ name, icon: selectedIcon })
      await updateStep({ step: 'connection' })
      onNext()
    } catch (err) {
      toast.error('Failed to create portfolio')
      console.error(err)
      setSaving(false)
      onSubmitting(false)
    }
  }

  return (
    <Card className="relative">
      <StepBackButton onClick={onBack} />
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Create your first portfolio</CardTitle>
        <CardDescription>
          Portfolios help you organize your financial accounts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="portfolio-name">Portfolio name</Label>
          <Input
            id="portfolio-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Personal"
            autoFocus
          />
        </div>
        <div className="grid gap-2">
          <Label>Icon</Label>
          <div className="flex flex-wrap gap-2">
            {PORTFOLIO_ICONS.map(({ name: iconName, icon: Icon }) => (
              <button
                key={iconName}
                type="button"
                className={`flex size-10 items-center justify-center rounded-md border transition-colors ${
                  selectedIcon === iconName
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted'
                }`}
                onClick={() => setSelectedIcon(iconName)}
              >
                <Icon className="size-5" />
              </button>
            ))}
          </div>
        </div>
        <Button
          className="w-full"
          disabled={!name.trim() || saving}
          onClick={handleNext}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : 'Continue'}
        </Button>
      </CardContent>
    </Card>
  )
}

function ConnectionStep({
  onBack,
  onSubmitting,
}: Omit<StepWithBackProps, 'onNext'>) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const completeOnboarding = useMutation(api.onboarding.completeOnboarding)
  const portfolios = useQuery(api.portfolios.listPortfolios)
  const generateUrl = useAction(api.powens.generateConnectUrl)

  async function handleConnect() {
    if (!portfolios || portfolios.length === 0) return
    setLoading(true)
    onSubmitting(true)
    try {
      const url = await generateUrl({ portfolioId: portfolios[0]._id })
      window.location.href = url
    } catch (err) {
      toast.error('Failed to start bank connection')
      console.error(err)
      setLoading(false)
      onSubmitting(false)
    }
  }

  async function handleSkip() {
    setLoading(true)
    onSubmitting(true)
    try {
      await completeOnboarding()
      void navigate({ to: '/' })
    } catch (err) {
      toast.error('Failed to complete onboarding')
      console.error(err)
      setLoading(false)
      onSubmitting(false)
    }
  }

  return (
    <Card className="relative">
      <StepBackButton onClick={onBack} />
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Connect your bank</CardTitle>
        <CardDescription>
          Link your bank accounts to start tracking your finances automatically
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleSkip}
            disabled={loading}
          >
            Skip for now
          </Button>
          <Button
            className="flex-1"
            onClick={handleConnect}
            disabled={loading || !portfolios || portfolios.length === 0}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              'Connect bank'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
