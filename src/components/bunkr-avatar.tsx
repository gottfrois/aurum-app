import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'

export function BunkrAvatar({ className }: { className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarImage src="/icon-circle.svg" alt="Bunkr" />
      <AvatarFallback>B</AvatarFallback>
    </Avatar>
  )
}
