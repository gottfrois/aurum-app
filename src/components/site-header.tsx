import { useQuery } from 'convex/react'
import { Eye, EyeOff, Lock, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { api } from '../../convex/_generated/api'
import { Button } from '~/components/ui/button'
import { Separator } from '~/components/ui/separator'
import { SidebarTrigger } from '~/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import { usePrivacy } from '~/contexts/privacy-context'
import { useEncryption } from '~/contexts/encryption-context'

export function SiteHeader({ title = 'Dashboard' }: { title?: string }) {
  const { isPrivate, togglePrivacy } = usePrivacy()
  const { isEncryptionEnabled, isUnlocked, lock } = useEncryption()

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto flex items-center gap-1">
          {isEncryptionEnabled && isUnlocked && (
            <EncryptionStatusButton onLock={lock} />
          )}
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
  const unencryptedCount = useQuery(
    api.encryptionKeys.countUnencryptedRecords,
    {},
  )
  const hasUnencrypted =
    unencryptedCount !== null &&
    unencryptedCount !== undefined &&
    unencryptedCount > 0

  return (
    <div className="flex items-center">
      <div className="flex h-8 items-center divide-x divide-border rounded-md border">
        {hasUnencrypted ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/settings/encryption"
                className="relative inline-flex items-center gap-1.5 rounded-l-md px-2.5 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-accent dark:text-amber-400"
              >
                <ShieldAlert className="size-3.5" />
                <span className="hidden sm:inline">Unprotected data</span>
                <span className="absolute -top-1.5 -right-1.5 flex min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 py-0.5 text-[10px] leading-none font-bold text-white">
                  {unencryptedCount > 99 ? '99+' : unencryptedCount}
                </span>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              {unencryptedCount} unencrypted records — click to migrate
            </TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1.5 rounded-l-md px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="size-3.5" />
                <span className="hidden sm:inline">End-to-end encrypted</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              All your data is end-to-end encrypted
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
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
