import { Eye, EyeOff } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Separator } from '~/components/ui/separator'
import { SidebarTrigger } from '~/components/ui/sidebar'
import { usePrivacy } from '~/contexts/privacy-context'

export function SiteHeader({ title = 'Dashboard' }: { title?: string }) {
  const { isPrivate, togglePrivacy } = usePrivacy()

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePrivacy}
            aria-label={isPrivate ? 'Show balances' : 'Hide balances'}
          >
            {isPrivate ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        </div>
      </div>
    </header>
  )
}
