import { Eye, EyeOff, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '~/components/ui/button'
import { AnimatedToggle } from '~/components/ui/animated-toggle'
import { Separator } from '~/components/ui/separator'
import { SidebarTrigger } from '~/components/ui/sidebar'
import { usePrivacy } from '~/contexts/privacy-context'

export function SiteHeader({ title = 'Dashboard' }: { title?: string }) {
  const { isPrivate, togglePrivacy } = usePrivacy()
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePrivacy}
            aria-label={isPrivate ? 'Show balances' : 'Hide balances'}
          >
            {isPrivate ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
          <AnimatedToggle
            checked={resolvedTheme === 'dark'}
            onChange={(dark) => setTheme(dark ? 'dark' : 'light')}
            icons={{
              on: <Moon className="size-full" />,
              off: <Sun className="size-full" />,
            }}
            size="sm"
            label="Toggle dark mode"
          />
        </div>
      </div>
    </header>
  )
}
