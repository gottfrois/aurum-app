import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Layers, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '~/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import { api } from '../../convex/_generated/api'

export function NavFavorites() {
  const favorites = useQuery(api.filterViewFavorites.list)
  const toggleFavorite = useMutation(api.filterViewFavorites.toggle)

  if (!favorites || favorites.length === 0) return null

  const handleRemove = async (viewId: string) => {
    try {
      await toggleFavorite({ viewId: viewId as never })
      toast.success('Removed from favorites')
    } catch {
      toast.error('Failed to remove favorite')
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Favorites</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {favorites.map((fav) => (
            <SidebarMenuItem key={fav._id}>
              <SidebarMenuButton tooltip={fav.view.name} asChild>
                <Link to="/views/$viewId" params={{ viewId: fav.viewId }}>
                  {fav.view.color ? (
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: fav.view.color }}
                    />
                  ) : (
                    <Layers className="size-4" />
                  )}
                  <span className="truncate">{fav.view.name}</span>
                </Link>
              </SidebarMenuButton>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuAction
                    showOnHover
                    onClick={() => void handleRemove(fav.viewId)}
                  >
                    <X className="size-4" />
                  </SidebarMenuAction>
                </TooltipTrigger>
                <TooltipContent side="right">Remove favorite</TooltipContent>
              </Tooltip>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
