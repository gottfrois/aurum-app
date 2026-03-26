import { Link } from '@tanstack/react-router'
import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react'
import * as React from 'react'
import {
  Breadcrumb,
  BreadcrumbItem as BreadcrumbItemUI,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '~/components/ui/breadcrumb'
import { Button } from '~/components/ui/button'
import { Separator } from '~/components/ui/separator'
import { SidebarTrigger } from '~/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import { useEncryption } from '~/contexts/encryption-context'
import { usePrivacy } from '~/contexts/privacy-context'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export function SiteHeader({
  title = 'Dashboard',
  breadcrumbs,
}: {
  title?: string
  breadcrumbs?: Array<BreadcrumbItem>
}) {
  const { isPrivate, togglePrivacy } = usePrivacy()
  const { isUnlocked, lock } = useEncryption()

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((item, index) => {
                const isLast = index === breadcrumbs.length - 1
                return (
                  <React.Fragment key={item.href ?? item.label}>
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItemUI>
                      {isLast ? (
                        <BreadcrumbPage>{item.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link to={item.href}>{item.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItemUI>
                  </React.Fragment>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        ) : (
          <h1 className="text-base font-medium">{title}</h1>
        )}
        <div className="ml-auto flex items-center gap-1">
          {isUnlocked && <EncryptionStatusButton onLock={lock} />}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={togglePrivacy}
                aria-label={isPrivate ? 'Show balances' : 'Hide balances'}
              >
                {isPrivate ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isPrivate ? 'Show balances' : 'Hide balances'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  )
}

function EncryptionStatusButton({ onLock }: { onLock: () => void }) {
  return (
    <div className="flex items-center">
      <div className="flex h-8 items-center divide-x divide-border rounded-md border">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1.5 rounded-l-md px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-3.5" />
              <span className="hidden sm:inline">Encrypted</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Your data is encrypted using zero-knowledge encryption
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onLock}
              className="inline-flex items-center rounded-r-md px-2 py-1.5 text-foreground transition-colors hover:bg-accent"
              aria-label="Lock vault"
            >
              <Lock className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Lock vault</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
