import { SignIn } from '@clerk/tanstack-react-start'
import { cn } from '~/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome to Aurum</CardTitle>
          <CardDescription>
            Sign in to manage your personal finances
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <SignIn
            appearance={{
              elements: {
                rootBox: 'w-full',
                cardBox: 'w-full shadow-none',
                card: 'w-full shadow-none p-0',
                header: 'hidden',
                footer: 'hidden',
              },
            }}
          />
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-center text-xs text-balance">
        Your financial data stays private and under your control.
      </p>
    </div>
  )
}
