import { createFileRoute } from '@tanstack/react-router'
import { LoginForm } from '~/components/login-form'

export const Route = createFileRoute('/sign-in/$')({
  component: SignInPage,
})

function SignInPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex items-center justify-center gap-2 md:justify-start">
          <img src="/icon-square.svg" alt="Bunkr" className="size-8 rounded" />
          <span className="text-xl font-bold">Bunkr</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="max-w-md space-y-4 text-center">
            <h2 className="text-3xl font-bold">Own Your Financial Data</h2>
            <p className="text-lg text-muted-foreground">
              Track your net worth, investments, and cash flow with
              zero-knowledge encryption. Your data stays private — not even we
              can access it.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
