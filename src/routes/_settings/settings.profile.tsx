import { useUser } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  ItemCard,
  ItemCardItem,
  ItemCardItemAction,
  ItemCardItemContent,
  ItemCardItems,
  ItemCardItemTitle,
} from '~/components/item-card'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Input } from '~/components/ui/input'
import { Skeleton } from '~/components/ui/skeleton'

export const Route = createFileRoute('/_settings/settings/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  const { user, isLoaded } = useUser()

  if (!isLoaded) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-10 py-16">
        <header>
          <Skeleton className="h-9 w-32" />
        </header>
        <div className="mt-8 space-y-6">
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
      <header>
        <h1 className="text-3xl font-semibold">Profile</h1>
      </header>
      <div className="mt-8 space-y-6">
        <ItemCard>
          <ItemCardItems>
            <ProfilePictureItem />
            <EmailItem />
            <FullNameItem />
          </ItemCardItems>
        </ItemCard>
      </div>
    </div>
  )
}

function ProfilePictureItem() {
  const { user } = useUser()
  if (!user) return null

  const name = user.fullName ?? ''
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <ItemCardItem>
      <ItemCardItemContent>
        <ItemCardItemTitle>Profile picture</ItemCardItemTitle>
      </ItemCardItemContent>
      <ItemCardItemAction>
        <Avatar className="size-10 rounded-full">
          <AvatarImage src={user.imageUrl} alt={name} />
          <AvatarFallback className="rounded-full">{initials}</AvatarFallback>
        </Avatar>
      </ItemCardItemAction>
    </ItemCardItem>
  )
}

function EmailItem() {
  const { user } = useUser()
  if (!user) return null

  return (
    <ItemCardItem>
      <ItemCardItemContent>
        <ItemCardItemTitle>Email</ItemCardItemTitle>
      </ItemCardItemContent>
      <ItemCardItemAction>
        <span className="text-sm text-muted-foreground">
          {user.primaryEmailAddress?.emailAddress ?? ''}
        </span>
      </ItemCardItemAction>
    </ItemCardItem>
  )
}

function FullNameItem() {
  const { user } = useUser()
  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [saving, setSaving] = useState(false)

  if (!user) return null

  async function handleBlur() {
    const trimmed = fullName.trim()

    if (trimmed === (user?.fullName ?? '')) return

    if (!trimmed) {
      setFullName(user?.fullName ?? '')
      toast.error('Name cannot be empty')
      return
    }

    setSaving(true)
    try {
      await user?.update({
        firstName: trimmed.split(' ')[0],
        lastName: trimmed.split(' ').slice(1).join(' ') || undefined,
      })
      toast.success('Profile updated')
    } catch {
      setFullName(user?.fullName ?? '')
      toast.error('Failed to update name')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ItemCardItem>
      <ItemCardItemContent>
        <ItemCardItemTitle>Full name</ItemCardItemTitle>
      </ItemCardItemContent>
      <ItemCardItemAction>
        <Input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          disabled={saving}
          className="h-8 w-48 text-sm"
        />
      </ItemCardItemAction>
    </ItemCardItem>
  )
}
