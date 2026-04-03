import { createFileRoute } from '@tanstack/react-router'
import { WaitlistCarousel } from '~/components/waitlist-carousel'
import { WaitlistForm } from '~/components/waitlist-form'

export const Route = createFileRoute('/waitlist')({
  component: WaitlistPage,
})

function WaitlistPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex items-center justify-center gap-2 md:justify-start">
          <img src="/icon-square.svg" alt="Bunkr" className="size-8 rounded" />
          <span className="text-xl font-bold">Bunkr</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <WaitlistForm />
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <WaitlistCarousel />
        </div>
      </div>
    </div>
  )
}
